import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BALL, cyl, cone, capsule, mat, P, darken, luminance } from './procParts';
import ProcRider from './procRider';
import { CHARACTERS } from '@/constants/characters';

// ═════════════════════════════════════════════════════════════════════════════
// Prosedürel at (+ eyer + binici). 1 birim = 1 m, sonra kökte ölçeklenir.
// Hiyerarşi: root > rearPivot > bodyPivot > { neckPivot > headPivot,
//   tail zinciri, 4× hipPivot > kneePivot, eyer, binici }. Pivotlar eklemlerde.
// Model +z'ye bakar; çağıran (oyun) eski GLB gibi y'de π döndürür.
// Animasyon tamamen `driveRef.current` ile sürülür (yoksa idle):
//   { mode:'run'|'walk'|'idle', speed, airborne, velY, slideLeft(ms),
//     stumbleAge(s), crashAge(s|-1), lateral(-1..1) }
// ═════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;
const SPEED_MIN = 16, SPEED_MAX = 55;
const LEATHER = '#7a4a1f';

// ── Donlar (coat) ────────────────────────────────────────────────────────────
const COATS = {
  chestnut:          { base: '#9a4a1e', mane: '#5a2810', hoof: '#2e2218', muzzle: '#6e3416', blaze: true, socks: [0, 0, 1, 1] },
  black:             { base: '#22201e', mane: '#0e0d0c', hoof: '#121110', muzzle: '#3a3632', emissive: 0.15 },
  white:             { base: '#e8e2d6', mane: '#c9bfae', hoof: '#8a8070', muzzle: '#b8ab9a' },
  stylized_chestnut: { base: '#f2f2f4', mane: '#8c8c96', hoof: '#212126', muzzle: '#9a9aa4' },
  ahal_teke:         { base: '#d9a84e', mane: '#141416', hoof: '#141416', muzzle: '#5a4428', points: '#2a2420', metal: 0.45 },
  pamuk:             { base: '#f6f4f0', mane: '#ece8e0', hoof: '#b8b2a8', muzzle: '#d8c8c0', blaze: false },
};

export function coatFor(variant) {
  if (!variant) return COATS.chestnut;
  if (COATS[variant.id]) return COATS[variant.id];
  const base = variant.bodyColor ?? '#9a4a1e';
  const lum = luminance(base);
  return {
    base,
    mane: variant.maneColor ?? darken(base, 0.55),
    hoof: variant.hoofColor ?? '#2e2218',
    muzzle: lum > 0.6 ? darken(base, 0.8) : darken(base, 0.7),
    emissive: lum < 0.04 ? 0.15 : 0,
  };
}

// Don başına malzeme takımı (önbellekli). Gövde malzemesi tökezleme kırmızı
// flaşı için don başına ayrı örnektir.
const _coatMats = new Map();
function coatMats(c) {
  const key = JSON.stringify(c);
  let m = _coatMats.get(key);
  if (!m) {
    const bodyOpts = { r: c.metal ? 0.38 : 0.8, m: c.metal ?? 0, e: c.emissive ? c.base : undefined, ei: c.emissive ?? 0, own: 'coat' };
    const body = mat(c.base, bodyOpts);
    m = {
      body,
      baseEmissive: body.emissive.clone(), baseEI: body.emissiveIntensity,
      mane: mat(c.mane, { r: 0.9, e: c.emissive ? c.mane : undefined, ei: c.emissive ? 0.2 : 0 }),
      hoof: mat(c.hoof, { r: 0.55 }),
      muzzle: mat(c.muzzle ?? c.base, { r: 0.75, e: c.emissive ? c.muzzle : undefined, ei: c.emissive ?? 0 }),
      lower: c.points ? mat(c.points, { r: 0.8 }) : body,
      sock: mat('#f4f1ea', { r: 0.8 }),
      blaze: mat('#f4f1ea', { r: 0.8 }),
      eye: mat('#0c0a09', { r: 0.25 }),
      nostril: mat('#141010', { r: 0.9 }),
    };
    _coatMats.set(key, m);
  }
  return m;
}

// ── Geometriler (modül seviyesi) ─────────────────────────────────────────────
const G = {
  barrel: capsule(0.5, 0.9, 8),
  foreUpper: cyl(0.1, 0.065, 0.5, 6),
  hindUpper: cyl(0.13, 0.07, 0.5, 6),
  cannon: cyl(0.058, 0.05, 0.44, 6),
  hoof: cyl(0.06, 0.082, 0.12, 6),
  neck: cyl(0.13, 0.24, 0.92, 6),
  ear: cone(0.045, 0.18, 4),
  tailTip: cone(0.09, 0.4, 5),
};

// ── Poz parametreleri (Float32Array indeksleri) ──────────────────────────────
const BY = 0, BP = 1, BR = 2, BREATH = 3, NECK = 4, HEAD = 5, YAW = 6;
const HIP = 7, KNEE = 11, TX = 15, TZ = 18, MANE = 21;
const RY = 26, RLEAN = 27, RROLL = 28, REAR = 29;
const NP = 30;

const NECK0 = 0.87;           // boyun dikeyden 50° (yataydan 40° yukarı)
const HEAD0 = -0.06;          // burun ~45° aşağı (dünyada)
const TAIL0 = [0.85, -0.35, -0.25];
const KSIGN = [1, 1, -1, -1]; // ön diz geriye, arka diz (hock) öne katlanır
const GALLOP_OFF = [0.5, 0.6, 0.0, 0.1]; // LF RF LH RH
const WALK_OFF = [0.25, 0.75, 0.0, 0.5];

const IDLE_DRIVE = { mode: 'idle', speed: 0 };
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const _red = new THREE.Color('#ff2a1a');

function writeIdle(o, t, S) {
  o.fill(0);
  o[BREATH] = 0.01 * Math.sin(t * 1.7);
  o[NECK] = NECK0 - 0.08 + 0.03 * Math.sin(t * 0.6);
  o[HEAD] = HEAD0 + 0.06 + 0.04 * Math.sin(t * 0.8 + 1);
  o[YAW] = S.yaw;
  for (let i = 0; i < 3; i++) {
    o[TX + i] = TAIL0[i] - (i === 0 ? 0.25 : 0);
    o[TZ + i] = 0.22 * Math.sin(t * 1.4 - i * 0.6) * (1 + i * 0.4) * (0.6 + 0.4 * Math.sin(t * 0.37));
  }
  for (let i = 0; i < 5; i++) o[MANE + i] = 0.05 * Math.sin(t * 1.1 - i * 0.5);
  o[RLEAN] = 0.06;
}

function writeWalk(o, pw, t, S) {
  o.fill(0);
  for (let i = 0; i < 4; i++) {
    const s = Math.sin(TAU * (pw + WALK_OFF[i]));
    o[HIP + i] = -s * 0.32;
    o[KNEE + i] = Math.max(0, -Math.cos(TAU * (pw + WALK_OFF[i]))) * 0.7 * KSIGN[i];
  }
  o[BY] = 0.02 * Math.abs(Math.sin(TAU * pw * 2));
  o[NECK] = NECK0 - 0.02;
  o[HEAD] = HEAD0 + 0.06 * Math.sin(TAU * pw * 2);
  o[YAW] = S.yaw * 0.4;
  for (let i = 0; i < 3; i++) { o[TX + i] = TAIL0[i] - (i === 0 ? 0.2 : 0); o[TZ + i] = 0.12 * Math.sin(TAU * (pw - 0.15 * i)); }
  for (let i = 0; i < 5; i++) o[MANE + i] = 0.08 * Math.sin(TAU * pw * 2 - i * 0.4);
  o[RY] = -0.01; o[RLEAN] = 0.12;
}

function writeGallop(o, p, tn) {
  o.fill(0);
  const amp = 1 + 0.25 * tn;
  for (let i = 0; i < 4; i++) {
    const s = Math.sin(TAU * (p + GALLOP_OFF[i]));
    o[HIP + i] = -s * 0.7 * amp;                       // − = ileri savrulma
    o[KNEE + i] = Math.max(0, -s) * 1.1 * amp * KSIGN[i];
  }
  const sp = Math.sin(TAU * p);
  o[BY] = 0.09 * Math.abs(sp);
  o[BP] = 0.06 * Math.sin(TAU * p + Math.PI / 2);
  o[NECK] = NECK0 + 0.12 + 0.06 * Math.sin(TAU * (p - 0.04));
  o[HEAD] = HEAD0 - 0.14 * Math.sin(TAU * (p - 0.08));
  const tAmp = [0.15, 0.25, 0.35];
  for (let i = 0; i < 3; i++) {
    o[TX + i] = TAIL0[i] + (i === 0 ? 0.3 * tn : 0) + tAmp[i] * Math.sin(TAU * (p - 0.12 * (i + 1)));
    o[TZ + i] = 0.05 * Math.sin(TAU * (p * 0.5 - 0.1 * i));
  }
  for (let i = 0; i < 5; i++) o[MANE + i] = 0.2 * Math.sin(TAU * p - i * 0.4);
  o[RY] = -0.5 * o[BY];
  o[RLEAN] = 0.25 + 0.15 * tn;
}

const mixInto = (o, src, w) => { if (w > 0.0005) for (let i = 0; i < NP; i++) o[i] += (src[i] - o[i]) * w; };

// ── Bileşen ──────────────────────────────────────────────────────────────────
// variant: HORSES girdisi (veya {bodyColor, maneColor}); coat: hazır don (öncelikli)
// characterId: binici (null → binicisiz, eyersiz); scale: kök ölçek
export default function ProcHorse({ variant, coat, characterId = 'cowboy', driveRef, scale = 1, saddle = true }) {
  const c = useMemo(() => coat ?? coatFor(variant), [coat, variant]);
  const M = coatMats(c);
  const char = CHARACTERS.find((ch) => ch.id === characterId);
  const padColor = char?.color ?? '#8b1d1d';

  const R = useRef({}).current;
  const ref = (k) => (e) => { R[k] = e; };
  const S = useRef(null);
  if (!S.current) {
    S.current = {
      p: Math.random(), pw: 0, t: Math.random() * 10,
      wRun: 0, wWalk: 0, wJump: 0, wSlide: 0, wStum: 0, wCrash: 0,
      yaw: 0, yawT: 0, nextTurn: 2 + Math.random() * 3, lean: 0,
      flash: 0,
      base: new Float32Array(NP), tmp: new Float32Array(NP), pose: new Float32Array(NP),
    };
  }

  useFrame((_, rawDt) => {
    const st = S.current;
    const dt = Math.min(rawDt, 0.05);
    const d = driveRef?.current ?? IDLE_DRIVE;
    const k = 1 - Math.exp(-12 * dt);
    st.t += dt;
    const t = st.t;
    const speed = d.speed ?? 0;
    const tn = clamp((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1);
    const mode = d.mode ?? 'idle';
    const crashing = (d.crashAge ?? -1) >= 0;

    // Ara sıra baş çevirme (idle)
    st.nextTurn -= dt;
    if (st.nextTurn <= 0) {
      st.yawT = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 0.9;
      st.nextTurn = 2.5 + Math.random() * 4;
    }
    st.yaw += (st.yawT - st.yaw) * (1 - Math.exp(-3 * dt));

    // Faz ilerlemesi
    const freq = clamp(1.6 + speed * 0.035, 1.6, 3.8);
    if (mode === 'run' && !crashing) st.p = (st.p + freq * dt) % 1;
    if (mode === 'walk') st.pw = (st.pw + clamp(speed / 3.5, 0.4, 1.4) * 0.95 * dt) % 1;

    // Ağırlıklar (asla anlık geçiş yok)
    st.wRun += ((mode === 'run' ? 1 : 0) - st.wRun) * k;
    st.wWalk += ((mode === 'walk' ? 1 : 0) - st.wWalk) * k;
    const slideLeft = d.slideLeft ?? 0;
    const slideT = slideLeft > 0 ? Math.min(1, slideLeft / 120) : 0;       // son 120ms yumuşak çıkış
    st.wSlide += (slideT - st.wSlide) * k;
    st.wJump += ((d.airborne && !crashing ? 1 : 0) - st.wJump) * k;
    const sAge = d.stumbleAge ?? 99;
    st.wStum += ((sAge < 0.35 ? 1 : 0) - st.wStum) * (1 - Math.exp(-20 * dt));
    st.wCrash += ((crashing ? 1 : 0) - st.wCrash) * k;

    // Taban pozu: idle → yürüyüş → dörtnala
    const o = st.pose, tmp = st.tmp;
    writeIdle(o, t, st);
    if (st.wWalk > 0.001) { writeWalk(tmp, st.pw, t, st); mixInto(o, tmp, st.wWalk); }
    if (st.wRun > 0.001) { writeGallop(tmp, st.p, tn); mixInto(o, tmp, st.wRun); }

    // ── Zıplama: ön bacaklar toplanır, arka bacaklar uzanır ──
    if (st.wJump > 0.001) {
      const w = st.wJump;
      const push = clamp((d.velY ?? 0) / 9, 0, 1);       // kalkışta arka itiş
      o[HIP] = lerp(o[HIP], -0.9, w); o[HIP + 1] = lerp(o[HIP + 1], -0.85, w);
      o[KNEE] = lerp(o[KNEE], 1.6, w); o[KNEE + 1] = lerp(o[KNEE + 1], 1.5, w);
      o[HIP + 2] = lerp(o[HIP + 2], 0.55 + 0.35 * push, w); o[HIP + 3] = lerp(o[HIP + 3], 0.5 + 0.35 * push, w);
      o[KNEE + 2] = lerp(o[KNEE + 2], -0.15, w); o[KNEE + 3] = lerp(o[KNEE + 3], -0.2, w);
      o[BY] = lerp(o[BY], 0, w);
      o[NECK] = lerp(o[NECK], NECK0 + 0.2, w); o[HEAD] = lerp(o[HEAD], HEAD0 - 0.1, w);
      o[TX] = lerp(o[TX], TAIL0[0] + 0.5, w);
      o[RY] = lerp(o[RY], 0.1, w); o[RLEAN] = lerp(o[RLEAN], 0.5, w);
    }
    // ── Kayma: gövde alçalır, ön bacaklar ileri, binici boyna yapışır ──
    if (st.wSlide > 0.001) {
      const w = st.wSlide;
      o[BY] = lerp(o[BY], -0.35, w); o[BP] = lerp(o[BP], 0.04, w);
      o[HIP] = lerp(o[HIP], -1.05, w); o[HIP + 1] = lerp(o[HIP + 1], -0.95, w);
      o[KNEE] = lerp(o[KNEE], 0.12, w); o[KNEE + 1] = lerp(o[KNEE + 1], 0.2, w);
      o[HIP + 2] = lerp(o[HIP + 2], 0.8, w); o[HIP + 3] = lerp(o[HIP + 3], 0.75, w);
      o[KNEE + 2] = lerp(o[KNEE + 2], -1.6, w); o[KNEE + 3] = lerp(o[KNEE + 3], -1.5, w);
      o[NECK] = lerp(o[NECK], NECK0 + 0.55, w); o[HEAD] = lerp(o[HEAD], HEAD0 - 0.35, w);
      o[TX] = lerp(o[TX], TAIL0[0] + 0.5, w);
      o[RY] = lerp(o[RY], -0.08, w); o[RLEAN] = lerp(o[RLEAN], 1.1, w); // (−0.3 gövdeye gömüyordu; gövde zaten 0.35 alçalıyor)
    }
    // ── Tökezleme: baş düşer, gövde 8 Hz yalpalar ──
    if (st.wStum > 0.001) {
      const w = st.wStum;
      const wob = Math.sin(TAU * 8 * Math.min(sAge, 0.35));
      o[HEAD] += 0.4 * w; o[NECK] += 0.2 * w;
      o[BR] += 0.15 * wob * w;
      o[RROLL] += -0.22 * wob * w; o[RLEAN] += 0.2 * w;
    }
    // ── Şerit değişimi: baş gidilen yöne döner (gövde yalpası Horse.jsx tilt'inde)
    o[YAW] += -0.2 * (d.lateral ?? 0);
    // ── Çarpma: şahlanma + ön bacaklar çırpınır ──
    if (st.wCrash > 0.001) {
      const w = st.wCrash;
      const ca = Math.max(0, d.crashAge ?? 0);
      o[REAR] = lerp(o[REAR], -0.6, w);
      o[HIP] = lerp(o[HIP], -1.0 + 0.6 * Math.sin(ca * 15), w);
      o[HIP + 1] = lerp(o[HIP + 1], -1.0 + 0.6 * Math.sin(ca * 15 + 2.2), w);
      o[KNEE] = lerp(o[KNEE], 1.2 + 0.4 * Math.sin(ca * 15 + 1), w);
      o[KNEE + 1] = lerp(o[KNEE + 1], 1.2 + 0.4 * Math.sin(ca * 15 + 3), w);
      o[HIP + 2] = lerp(o[HIP + 2], 0.6, w); o[HIP + 3] = lerp(o[HIP + 3], 0.6, w);
      o[KNEE + 2] = lerp(o[KNEE + 2], -0.25, w); o[KNEE + 3] = lerp(o[KNEE + 3], -0.25, w);
      o[BY] = lerp(o[BY], 0, w);
      o[NECK] = lerp(o[NECK], NECK0 - 0.35, w); o[HEAD] = lerp(o[HEAD], HEAD0 - 0.3, w);
      o[TX] = lerp(o[TX], TAIL0[0] - 0.2, w);
    }

    // ── Uygula ──
    if (R.rear) R.rear.rotation.x = o[REAR];
    if (R.body) {
      R.body.position.y = 1.15 + o[BY];
      R.body.rotation.x = o[BP];
      R.body.rotation.z = o[BR];
      R.body.scale.y = 1 + o[BREATH];
    }
    if (R.neck) { R.neck.rotation.x = o[NECK]; R.neck.rotation.y = o[YAW] * 0.6; }
    if (R.head) { R.head.rotation.x = o[HEAD]; R.head.rotation.y = o[YAW] * 0.4; }
    for (let i = 0; i < 4; i++) {
      const h = R['hip' + i], kn = R['knee' + i];
      if (h) h.rotation.x = o[HIP + i];
      if (kn) kn.rotation.x = o[KNEE + i];
    }
    for (let i = 0; i < 3; i++) {
      const tg = R['tail' + i];
      if (tg) { tg.rotation.x = o[TX + i]; tg.rotation.z = o[TZ + i]; }
    }
    for (let i = 0; i < 5; i++) { const m = R['mane' + i]; if (m) m.rotation.z = o[MANE + i]; }

    if (R.rider) {
      const ca = d.crashAge ?? -1;
      let ry = 0.4 + o[RY], rz = 0.02, rx = o[RLEAN], rroll = o[RROLL];
      if (ca >= 0) {
        // Binici parabolik yayla fırlar: 1.5 yukarı, 2 ileri, 4 rad/s döner
        const T = 0.75, u = Math.min(ca / T, 1);
        ry += 1.5 * 4 * u * (1 - u) - 1.2 * u * u;
        rz += 2 * u;
        rx = lerp(rx, 0.3, u) + 4 * Math.min(ca, T);
        rroll += 0.6 * u;
      }
      R.rider.position.y = ry;
      R.rider.position.z = rz;
      R.rider.rotation.z = rroll;
      if (ca >= 0) { R.rider.rotation.x = rx - o[RLEAN]; if (R.lean) R.lean.rotation.x = o[RLEAN]; }
      else { R.rider.rotation.x = 0; if (R.lean) R.lean.rotation.x = rx; }
    }

    // Tökezleme kırmızı flaşı (0.15 sn)
    const flash = sAge < 0.15 ? 1 - sAge / 0.15 : 0;
    if (flash > 0 || st.flash > 0) {
      if (flash > 0) {
        M.body.emissive.copy(_red);
        M.body.emissiveIntensity = 0.7 * flash;
      } else {
        M.body.emissive.copy(M.baseEmissive);
        M.body.emissiveIntensity = M.baseEI;
      }
      st.flash = flash;
    }
  });

  const tuft = (i) => {
    const y = 0.12 + i * 0.17;
    const r = 0.24 - 0.11 * (y / 0.92);
    return (
      <group key={i} ref={ref('mane' + i)} position={[0, y, -r * 0.9]}>
        <P m={M.mane} p={[0, 0.02, -0.05]} s={[0.07, 0.22 - i * 0.012, 0.13]} r={[0.25, 0, 0]} />
      </group>
    );
  };

  const leg = (i) => {
    const front = i < 2;
    const x = (i % 2 === 0 ? -1 : 1) * 0.2;
    const z = front ? 0.6 : -0.6;
    const sock = c.socks?.[i];
    const lowerM = sock ? M.sock : M.lower;
    return (
      <group key={i} ref={ref('hip' + i)} position={[x, -0.05, z]}>
        {front
          ? <P g={G.foreUpper} m={M.body} p={[0, -0.25, 0]} />
          : <>
              <P g={G.hindUpper} m={M.body} p={[0, -0.25, 0]} />
              <P g={BALL} m={M.body} p={[0, 0.02, -0.02]} s={[0.24, 0.46, 0.4]} />
            </>}
        <group ref={ref('knee' + i)} position={[0, -0.5, 0]}>
          <P g={BALL} m={lowerM} p={[0, 0, 0]} s={[0.12, 0.12, 0.13]} />
          <P g={G.cannon} m={lowerM} p={[0, -0.22, 0]} />
          <P g={BALL} m={lowerM} p={[0, -0.44, 0.005]} s={[0.115, 0.1, 0.12]} />
          <P g={G.hoof} m={M.hoof} p={[0, -0.54, 0.01]} />
        </group>
      </group>
    );
  };

  return (
    <group scale={scale}>
      <group ref={ref('rear')} position={[0, 0, -0.6]}>
        <group ref={ref('body')} position={[0.0, 1.15, 0.6]}>
          {/* Gövde: fıçı + geniş göğüs + geniş sağrı + yağır */}
          <P g={G.barrel} m={M.body} r={[Math.PI / 2, 0, 0]} s={[0.62, 0.85, 0.7]} />
          <P g={BALL} m={M.body} p={[0, 0.02, 0.6]} s={[0.7, 0.68, 0.55]} />
          <P g={BALL} m={M.body} p={[0, 0.06, -0.55]} s={[0.7, 0.7, 0.66]} />
          <P g={BALL} m={M.body} p={[0, 0.27, 0.42]} s={[0.34, 0.36, 0.55]} />

          {saddle && <>
            {/* Eyer: deri + karakter renginde eyer altlığı, üzengiler */}
            <P m={mat(padColor, { r: 0.9 })} p={[0, 0.35, 0.04]} s={[0.7, 0.04, 0.6]} />
            <P m={mat(LEATHER, { r: 0.6 })} p={[0, 0.39, 0.04]} s={[0.46, 0.07, 0.44]} />
            <P m={mat(LEATHER, { r: 0.6 })} p={[0, 0.45, 0.25]} s={[0.22, 0.1, 0.07]} />
            <P m={mat(LEATHER, { r: 0.6 })} p={[0, 0.46, -0.17]} s={[0.34, 0.12, 0.06]} />
            {[-1, 1].map((sd) => (
              <group key={sd}>
                <P m={mat(LEATHER, { r: 0.6 })} p={[sd * 0.355, 0.15, 0.1]} s={[0.025, 0.3, 0.045]} r={[0, 0, -sd * 0.12]} shadow={false} />
                <P m={mat('#9a9a9a', { m: 0.6, r: 0.4 })} p={[sd * 0.38, -0.08, 0.12]} s={[0.05, 0.03, 0.13]} shadow={false} />
                {/* kolan */}
                <P m={mat(LEATHER, { r: 0.6 })} p={[sd * 0.305, -0.12, 0.2]} s={[0.03, 0.5, 0.07]} shadow={false} />
              </group>
            ))}
          </>}

          {/* Boyun > baş */}
          <group ref={ref('neck')} position={[0, 0.2, 0.66]} rotation-order="YXZ">
            <P g={G.neck} m={M.body} p={[0, 0.44, 0]} s={[0.72, 1, 1]} />
            {[0, 1, 2, 3, 4].map(tuft)}
            {saddle && [-1, 1].map((sd) => (
              <P key={sd} m={mat('#3a2410', { r: 0.6 })} p={[sd * 0.1, 0.42, 0.02]} s={[0.012, 0.98, 0.012]} r={[-0.2, 0, -sd * 0.08]} shadow={false} />
            ))}
            <group ref={ref('head')} position={[0, 0.88, 0]}>
              <group rotation={[0, 0, 0]}>
                {/* kafatası + yanaklar + 15% dar burun */}
                <P m={M.body} p={[0, 0.02, 0.1]} s={[0.26, 0.3, 0.38]} />
                <P m={M.body} p={[0, -0.08, 0.02]} s={[0.24, 0.16, 0.24]} />
                <P m={M.muzzle} p={[0, -0.04, 0.42]} s={[0.22, 0.22, 0.3]} />
                {[-1, 1].map((sd) => (
                  <group key={sd}>
                    <P m={M.eye} p={[sd * 0.132, 0.07, 0.12]} s={[0.02, 0.055, 0.07]} shadow={false} />
                    <P m={M.nostril} p={[sd * 0.06, 0.0, 0.572]} s={[0.04, 0.05, 0.01]} shadow={false} />
                    <P g={G.ear} m={M.body} p={[sd * 0.08, 0.24, -0.03]} r={[-0.25, 0, -sd * 0.18]} />
                  </group>
                ))}
                <P m={M.mane} p={[0, 0.2, 0.06]} s={[0.08, 0.06, 0.16]} r={[0.35, 0, 0]} />
                {c.blaze && <>
                  <P m={M.blaze} p={[0, 0.172, 0.12]} s={[0.07, 0.01, 0.3]} shadow={false} />
                  <P m={M.blaze} p={[0, 0.072, 0.42]} s={[0.06, 0.01, 0.3]} shadow={false} />
                </>}
                {saddle && <P m={mat('#3a2410', { r: 0.6 })} p={[0, -0.03, 0.36]} s={[0.235, 0.05, 0.05]} shadow={false} />}
              </group>
            </group>
          </group>

          {/* Kuyruk: 3 zincir segment */}
          <group position={[0, 0.33, -0.88]}>
            <group ref={ref('tail0')}>
              <P m={M.mane} p={[0, -0.14, 0]} s={[0.1, 0.3, 0.11]} />
              <group ref={ref('tail1')} position={[0, -0.28, 0]}>
                <P m={M.mane} p={[0, -0.14, 0]} s={[0.14, 0.32, 0.12]} />
                <group ref={ref('tail2')} position={[0, -0.28, 0]}>
                  <P g={G.tailTip} m={M.mane} p={[0, -0.18, 0]} r={[Math.PI, 0, 0]} s={[1, 1, 0.8]} />
                </group>
              </group>
            </group>
          </group>

          {[0, 1, 2, 3].map(leg)}

          {characterId && (
            <group ref={ref('rider')} position={[0, 0.4, 0.02]}>
              <group scale={0.95}>
                <ProcRider characterId={characterId} leanRef={ref('lean')} />
              </group>
            </group>
          )}
        </group>
      </group>
    </group>
  );
}

