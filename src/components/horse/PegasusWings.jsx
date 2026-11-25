import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

// ── Pegasus kanatları: prosedürel tüylü kanat (yalnız görsel) ───────────────
// Her kanat: omuz (kol) + el (uç) eklemi. Kolda ikincil (secondary) tüyler,
// elde birincil (primary) tüyler, üstte iki sıra örtü (covert) tüyü.
// Tüyler krem-beyaz, uçları hafif altın (vertex color). Kanat yerel ekseni:
// +x dışa (kanat açıklığı), +z geriye (firar kenarı), +y yukarı.

const ARM_LEN  = 0.95;   // omuz → bilek
const HAND_LEN = 0.75;   // bilek → el ucu (birincil tüyler ~+0.5 uzatır → ≈2.2 m)

const CREAM = new THREE.Color('#fffaf0');
const WHITE = new THREE.Color('#ffffff');
const GOLD  = new THREE.Color('#f2c14e');

// Tüy: tabanı orijinde, +z boyunca uzanan, ince sivri yaprak (birim uzunluk).
function makeFeatherGeo(width, goldFrom, root = WHITE) {
  const s = new THREE.Shape();
  const w = width / 2;
  s.moveTo(-w * 0.35, 0);
  s.quadraticCurveTo(-w * 1.05, 0.45, -w * 0.55, 0.92);
  s.quadraticCurveTo(-w * 0.1, 1.02, 0, 1.0);
  s.quadraticCurveTo(w * 0.7, 0.9, w * 0.9, 0.5);
  s.quadraticCurveTo(w * 0.8, 0.1, w * 0.35, 0);
  s.lineTo(-w * 0.35, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 3 });
  g.rotateX(Math.PI / 2); // şekil y → +z, kalınlık −y
  g.translate(0, 0.006, 0);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getZ(i); // 0 kök → 1 uç
    if (t < goldFrom) c.copy(root).lerp(CREAM, t / goldFrom);
    else c.copy(CREAM).lerp(GOLD, Math.min(1, (t - goldFrom) / (1 - goldFrom)) * 0.95);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const primaryGeo   = makeFeatherGeo(0.2, 0.7);
const secondaryGeo = makeFeatherGeo(0.24, 0.82);
const covertGeo    = makeFeatherGeo(0.26, 0.86, new THREE.Color('#f3e6cc'));
const featherMat = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.05,
  emissive: '#fff4dc', emissiveIntensity: 0.22, side: THREE.DoubleSide,
});
const boneMat = new THREE.MeshStandardMaterial({ color: '#fff6e6', flatShading: true, roughness: 0.7, emissive: '#fff0d0', emissiveIntensity: 0.15 });
const armGeo  = new THREE.CylinderGeometry(0.07, 0.09, 1, 6).rotateZ(Math.PI / 2).translate(0.5, 0, 0);

// [kökün kol/el boyunca konumu (0..1), uzunluk, temel açı (rad, +=dışa)]
const PRIMARIES   = Array.from({ length: 9 }, (_, i) => [i / 8, 0.95 + 0.45 * Math.sin((i / 8) * Math.PI * 0.85), 0.15 + i * 0.13]);
const SECONDARIES = Array.from({ length: 9 }, (_, i) => [i / 8, 0.72 - i * 0.012, 0.02 + i * 0.012]);
const COVERTS_A   = Array.from({ length: 10 }, (_, i) => [i / 9, 0.42, 0.05 + i * 0.03]);
const COVERTS_H   = Array.from({ length: 7 }, (_, i) => [i / 6, 0.5, 0.25 + i * 0.1]);
const MARGIN      = Array.from({ length: 12 }, (_, i) => [i / 11, 0.24, 0.1 + i * 0.05]);

function FeatherRow({ data, geo, len, refs, y = 0, zOff = 0 }) {
  return data.map(([u, l, a], i) => (
    <mesh key={i} ref={(el) => refs && (refs[i] = el)} geometry={geo} material={featherMat}
      position={[u * len, y - i * 0.002, zOff]} rotation={[0, a, 0]} scale={[1, 1, l]} castShadow />
  ));
}

// Kanat çırpma eğrisi: aşağı vuruş (ilk %38) yukarı vuruştan hızlı.
// +1 = kanat yukarıda, −1 = aşağıda.
const DOWN = 0.38;
function stroke(p) {
  p = ((p % 1) + 1) % 1;
  if (p < DOWN) return Math.cos((p / DOWN) * Math.PI);
  return -Math.cos(((p - DOWN) / (1 - DOWN)) * Math.PI);
}

function Wing({ side, stateRef }) {
  const shoulder = useRef();
  const hand = useRef();
  const prim = useRef([]).current;
  const sec  = useRef([]).current;
  useFrame(() => {
    const st = stateRef.current;
    const o = st.open;                 // 0 katlı → 1 açık
    const p = st.phase;
    const g = st.glide;                // 0 çırpma → 1 süzülme
    const s   = stroke(p);
    const sL  = stroke(p - 0.09);      // uç gecikmesi
    const down = ((p % 1) + 1) % 1 < DOWN;
    // Açık (çırpma/süzülme) poz
    const rollFlap  = 0.12 + 0.62 * s;
    const rollGlide = 0.18 + 0.04 * Math.sin(st.t * 1.6);
    const roll = THREE.MathUtils.lerp(rollFlap, rollGlide, g);
    const handFlap  = 0.42 * (sL - s) - (down ? 0.06 : 0.28); // yukarı vuruşta el içe katlanır
    const handRoll  = THREE.MathUtils.lerp(handFlap, -0.08, g);
    const sweepOpen = -THREE.MathUtils.lerp(down ? 0.05 : 0.32, 0.08, g); // yukarıda kanat geriye toplanır
    const spread    = THREE.MathUtils.lerp(down ? 1.0 : 0.62, 1.0, g);
    // Katlı poz: kanat sırta doğru, geriye yatırılmış
    const R = THREE.MathUtils.lerp(-0.25, roll, o);
    const Y = THREE.MathUtils.lerp(-1.25, sweepOpen, o);
    if (shoulder.current) {
      shoulder.current.rotation.set(0, Y, R * 1, 'YXZ');
      shoulder.current.scale.setScalar(0.35 + 0.65 * Math.min(1, o * 1.4));
    }
    if (hand.current) {
      hand.current.rotation.set(0, THREE.MathUtils.lerp(-2.3, -0.1 * (1 - spread), o), THREE.MathUtils.lerp(0, handRoll, o));
    }
    const sp = THREE.MathUtils.lerp(0.15, spread, o);
    for (let i = 0; i < prim.length; i++) { const m = prim[i]; if (m) m.rotation.y = PRIMARIES[i][2] * sp - (1 - sp) * 0.1; }
    for (let i = 0; i < sec.length; i++)  { const m = sec[i];  if (m) m.rotation.y = SECONDARIES[i][2] * sp; }
  });
  return (
    <group scale={[side, 1, 1]}>
      <group ref={shoulder}>
        <mesh geometry={armGeo} material={boneMat} scale={[ARM_LEN, 1, 1]} />
        <FeatherRow data={SECONDARIES} geo={secondaryGeo} len={ARM_LEN} refs={sec} y={-0.01} zOff={0.02} />
        <FeatherRow data={COVERTS_A} geo={covertGeo} len={ARM_LEN} y={0.02} zOff={0.0} />
        <FeatherRow data={MARGIN} geo={covertGeo} len={ARM_LEN} y={0.045} zOff={-0.05} />
        <group ref={hand} position={[ARM_LEN, 0, 0]}>
          <mesh geometry={armGeo} material={boneMat} scale={[HAND_LEN, 0.75, 0.75]} />
          <FeatherRow data={PRIMARIES} geo={primaryGeo} len={HAND_LEN} refs={prim} y={-0.015} zOff={0.01} />
          <FeatherRow data={COVERTS_H} geo={covertGeo} len={HAND_LEN} y={0.02} zOff={-0.02} />
        </group>
      </group>
    </group>
  );
}

// Kök: atın cidago (omuz) noktasına yerleştirilir. position/rotation dışarıdan.
export default function PegasusWings(props) {
  const active = useGameStore((s) => s.wingsActive);
  const [mounted, setMounted] = useState(active);
  useEffect(() => { if (active) setMounted(true); }, [active]);
  const stateRef = useRef({ open: 0, phase: 0, glide: 0, t: 0, cyc: 0 });
  useFrame((_, rawDelta) => {
    const d = Math.min(rawDelta, 1 / 20);
    const st = stateRef.current;
    st.t += d;
    // Hızlı açılış / kapanış (~0.35 sn)
    const target = active ? 1 : 0;
    st.open += Math.sign(target - st.open) * Math.min(Math.abs(target - st.open), d / 0.35);
    if (!active && st.open <= 0.001 && mounted) setMounted(false);
    // Döngü: 3 çırpma, ardından ~1.1 sn süzülme (tepe pozu)
    const FLAP_HZ = 2.1;
    if (st.glide > 0.5 || st.cyc >= 3) {
      st.glideT = (st.glideT ?? 0) + d;
      st.glide = Math.min(1, st.glide + d * 3.5);
      if (st.glideT > 1.1) { st.cyc = 0; st.glideT = 0; st.glide = 0.49; st.phase = 0; }
    } else {
      st.glide = Math.max(0, st.glide - d * 4);
      const prev = st.phase;
      st.phase += d * FLAP_HZ;
      if (Math.floor(st.phase) > Math.floor(prev)) st.cyc++;
    }
  });
  if (!mounted) return null;
  return (
    <group {...props}>
      <group position={[0.16, 0, 0]}><Wing side={1} stateRef={stateRef} /></group>
      <group position={[-0.16, 0, 0]}><Wing side={-1} stateRef={stateRef} /></group>
    </group>
  );
}
