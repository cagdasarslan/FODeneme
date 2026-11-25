import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP } from '@/utils/device';
import { makeBatch, bakeGeo, Baked, Anim, useBlink, mulberry, HorizonRing } from '@/utils/procKit';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

// ── Dolu, canlı Mars kenarları (toplu geometri) ─────────────────────────────
// Her segment: zemin (1 çağrı) + yakın/orta dekor (lit+glow+blink, 3 çağrı) +
// uzak silüet (1 çağrı) + birkaç InstancedMesh hareketli öğe. Yol yarı genişliği 9.
const ROAD_HALF = 9;
const COL = {
  ground: '#b84020', ground2: '#a83a1c', ground3: '#c85028', road: '#7a3018', lane: '#ff9944',
  hull: '#e4e2dc', hullDk: '#a8a8a8', red: '#c8402c', metal: '#8a8e94', metalDk: '#55595e',
  panel: '#2c4c7a', window: '#9cd8ff', glow: '#ffb070', yellow: '#e0b030', door: '#3a3e44',
  rock: '#8a3a1e', rock2: '#a04a26', rockDk: '#6a2a14', craterIn: '#5e2410', craterRim: '#a8482a',
  cactus: '#4f7a3a', cactus2: '#3f6a30', bone: '#efe6d0', palm: '#3f8a3a', palm2: '#5aa040', trunk: '#7a5230',
  water: '#4ad0e8', mesa1: '#9a3a1c', mesa2: '#b44a24', mesa3: '#7e2e16', dune: '#c4562a', dune2: '#b04a22',
  ridge: '#8e3a22', beacon: '#ff5a20', solar: '#22385e', canvas: '#e8d8b8', stripe: '#c8402c',
};

// ── Yapı kurucuları (b: makeBatch) — taban y=0, birim: metre ───────────────
function bRocket(b, x, z, ry, k = 2.2) {
  b.push([x, 0, z], ry, k);
  b.add('cyl8', COL.metalDk, [0, 0, 0], [1.3, 0.12, 1.3]);
  b.add('cone8', COL.metalDk, [0, 0.12, 0], [0.55, 0.6, 0.55]);
  b.add('cyl12', COL.hull, [0, 0.7, 0], [0.75, 3.4, 0.75]);
  b.add('cyl12', COL.red, [0, 2.4, 0], [0.77, 0.3, 0.77]);
  b.add('cone8', COL.red, [0, 4.1, 0], [0.75, 2.05, 0.75]);
  b.add('box', COL.window, [0, 3.3, 0.7], [0.35, 0.35, 0.12], 0, 'glow');
  for (let k2 = 0; k2 < 4; k2++) { b.push([0, 0, 0], k2 * Math.PI / 2 + Math.PI / 4); b.add('box', COL.red, [0, 0.5, 0.95], [0.1, 1.3, 0.75]); b.pop(); }
  for (const sx of [-1, 1]) {
    b.add('cyl8', COL.hullDk, [sx * 1.0, 0.5, 0], [0.28, 2.2, 0.28]);
    b.add('cone8', COL.red, [sx * 1.0, 2.7, 0], [0.28, 0.6, 0.28]);
  }
  // fırlatma kulesi + yanıp sönen ışıklar
  b.add('box', COL.metalDk, [1.9, 0, 0], [0.25, 6.4, 0.25]);
  for (let y = 1; y < 6; y += 1.2) b.add('box', COL.metal, [1.45, y, 0], [0.9, 0.06, 0.06]);
  b.add('box', COL.beacon, [1.9, 6.4, 0], [0.22, 0.22, 0.22], 0, 'blink');
  b.add('box', COL.beacon, [0, 6.2, 0], [0.12, 0.2, 0.12], 0, 'blink');
  b.pop();
}
function bHangarLg(b, x, z, ry, k = 2.2) {
  b.push([x, 0, z], ry, k);
  b.add('box', COL.hullDk, [0, 0, 0], [2, 0.5, 2.9]);
  b.add('halfCylZ', COL.hull, [0, 0.5, 0], [1, 0.5, 3]);
  b.add('box', COL.door, [0, 0, 1.45], [1.2, 0.7, 0.04]);
  b.add('box', COL.yellow, [0, 0.7, 1.46], [1.3, 0.05, 0.04]);
  b.add('box', COL.glow, [0, 0.62, 1.47], [1.1, 0.04, 0.03], 0, 'glow');
  b.add('box', COL.metalDk, [1.0, 0, -0.6], [0.08, 0.35, 0.8]);
  b.pop();
}
function bHangarRd(b, x, z, ry, k = 2.2) {
  b.push([x, 0, z], ry, k);
  b.add('cyl12', COL.hullDk, [0, 0, 0], [1.38, 0.15, 1.2]);
  b.add('dome', COL.hull, [0, 0.15, 0], [1.38, 1.35, 1.2]);
  b.add('halfCylZ', COL.hull, [0, 0, 1.2], [0.4, 0.55, 0.6]);
  b.add('box', COL.door, [0, 0, 1.5], [0.5, 0.45, 0.03]);
  b.add('box', COL.window, [0, 1.0, 0.78], [0.6, 0.12, 0.05], [-0.6, 0, 0], 'glow');
  b.add('box', COL.window, [0.9, 0.55, 0.55], [0.3, 0.1, 0.05], [0, 1, 0], 'glow');
  b.add('box', COL.beacon, [0, 1.5, 0], [0.08, 0.08, 0.08], 0, 'blink');
  b.pop();
}
function bGenerator(b, x, z, ry, k = 1.6) {
  b.push([x, 0, z], ry, k);
  b.add('box', COL.metal, [-0.08, 0, 0], [0.5, 0.3, 0.5]);
  b.add('box', COL.metalDk, [-0.08, 0.3, 0], [0.4, 0.04, 0.4]);
  b.add('cyl8', COL.hull, [0.26, 0, 0.12], [0.08, 0.4, 0.08]);
  b.add('cyl8', COL.hull, [0.26, 0, -0.12], [0.08, 0.36, 0.08]);
  b.add('box', COL.glow, [-0.08, 0.12, 0.251], [0.3, 0.06, 0.01], 0, 'glow');
  b.add('box', COL.yellow, [-0.08, 0.02, 0.252], [0.5, 0.03, 0.01]);
  b.pop();
}
function bDishBase(b, x, z, k) { // döner çanak tabanı (çanak başı Anim'de)
  b.push([x, 0, z], 0, k);
  b.add('box', COL.metalDk, [0, 0, 0], [0.5, 0.1, 0.5]);
  b.add('cyl8', COL.metal, [0, 0.1, 0], [0.05, 0.4, 0.05]);
  b.pop();
}
function bTanks(b, x, z, ry) {
  b.push([x, 0, z], ry);
  for (const [tx, tz, r, h] of [[-1.6, 0, 1.2, 3.4], [1.0, 0.4, 1.0, 2.8], [0, -2.2, 0.8, 2.2]]) {
    b.add('cyl8', COL.hull, [tx, 0, tz], [r, h, r]);
    b.add('cone8', COL.hullDk, [tx, h, tz], [r, r * 0.4, r]);
    b.add('cyl8', COL.red, [tx, h * 0.6, tz], [r * 1.02, 0.25, r * 1.02]);
  }
  b.add('box', COL.metalDk, [-0.3, 1.0, 0.2], [2.6, 0.12, 0.12]);
  b.pop();
}
function bHabitat(b, x, z, ry) {
  b.push([x, 0, z], ry);
  b.add('cyl12', COL.hullDk, [0, 0, 0], [3.2, 0.4, 3.2]);
  b.add('dome', COL.hull, [0, 0.4, 0], [3.0, 2.6, 3.0]);
  for (let i = 0; i < 6; i++) { b.push([0, 0, 0], i * Math.PI / 3); b.add('box', COL.window, [0, 1.1, 2.75], [0.9, 0.35, 0.1], [-0.35, 0, 0], 'glow'); b.pop(); }
  b.add('halfCylZ', COL.hull, [0, 0, 3.4], [0.9, 1.2, 1.6]);
  b.add('box', COL.glow, [0, 0.2, 4.2], [0.9, 0.9, 0.05], 0, 'glow');
  b.add('cyl8', COL.metal, [1.5, 2.2, 0], [0.04, 1.8, 0.04]);
  b.add('box', COL.beacon, [1.5, 4.0, 0], [0.16, 0.16, 0.16], 0, 'blink');
  b.pop();
}
function bSolar(b, x, z, ry) {
  b.push([x, 0, z], ry);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    b.add('box', COL.metalDk, [c * 2.4 - 2.4, 0, r * 2.2 - 2.2], [0.1, 0.6, 0.1]);
    b.add('box', COL.solar, [c * 2.4 - 2.4, 0.6, r * 2.2 - 2.2], [2.1, 0.06, 1.5], [0.4, 0, 0]);
  }
  b.pop();
}
function bTower(b, x, z) { // iletişim kulesi
  b.push([x, 0, z]);
  for (const [px, pz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.add('box', COL.metal, [px * 0.6, 0, pz * 0.6], [0.12, 12, 0.12]);
  for (let y = 1.5; y < 12; y += 2.5) b.add('box', COL.metalDk, [0, y, 0], [0.85, 0.08, 0.85]);
  b.add('box', COL.red, [0, 10, 0], [0.9, 0.5, 0.9]);
  b.add('box', COL.beacon, [0, 12.1, 0], [0.3, 0.3, 0.3], 0, 'blink');
  b.add('box', COL.beacon, [0, 7, 0.5], [0.18, 0.18, 0.18], 0, 'blink');
  b.pop();
}
function bPalm(b, x, z, h, ry) {
  b.push([x, 0, z], ry);
  b.add('cyl6', COL.trunk, [0, 0, 0], [0.2, h * 0.55, 0.2], [0, 0, -0.06]);
  b.add('cyl6', COL.trunk, [0.18, h * 0.53, 0], [0.15, h * 0.5, 0.15], [0, 0, -0.18]);
  const tx = 0.4;
  for (let i = 0; i < 5; i++) b.add('box', i % 2 ? COL.palm : COL.palm2, [tx, h, 0], [0.5, 0.06, 2.6], [0.45, i * Math.PI * 0.4, 0]);
  b.add('blob', COL.trunk, [tx, h, 0], 0.32);
  b.pop();
}
function bOasis(b, x, z, rng) {
  b.add('cyl12', COL.rock2, [x, 0, z], [6.4, 0.12, 4.6]);
  b.add('cyl12', COL.water, [x, 0.12, z], [5.6, 0.04, 3.9], 0, 'glow');
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    bPalm(b, x + Math.cos(a) * 6.5, z + Math.sin(a) * 4.8, 4 + rng() * 3, rng() * 6);
  }
  for (let i = 0; i < 5; i++) { const a = rng() * 6.28; b.add('rock', COL.rockDk, [x + Math.cos(a) * 6, 0.2, z + Math.sin(a) * 4.4], [0.6, 0.4, 0.5], [0, a, 0]); }
}
function bCamp(b, x, z, ry) { // kumaş çadır kampı
  b.push([x, 0, z], ry);
  for (let i = 0; i < 3; i++) {
    b.add('prism', i === 1 ? COL.stripe : COL.canvas, [i * 3.4 - 3.4, 0, 0], [2.6, 2.0, 3.2]);
  }
  b.add('box', COL.trunk, [0, 0, 3.0], [3, 0.5, 0.6]);
  b.add('box', COL.glow, [0, 0.05, 2.0], [0.4, 0.3, 0.4], 0, 'glow');
  b.pop();
}
function bCactus(b, x, z, h, ry) {
  b.push([x, 0, z], ry);
  b.add('cyl6', COL.cactus, [0, 0, 0], [0.28, h, 0.28]);
  b.add('cone6', COL.cactus, [0, h, 0], [0.28, 0.18, 0.28]);
  b.add('box', COL.cactus2, [0.35, h * 0.35, 0], [0.4, 0.24, 0.24]);
  b.add('cyl6', COL.cactus2, [0.55, h * 0.35, 0], [0.17, h * 0.4, 0.17]);
  if (h > 2.2) {
    b.add('box', COL.cactus2, [-0.3, h * 0.5, 0], [0.36, 0.22, 0.22]);
    b.add('cyl6', COL.cactus2, [-0.48, h * 0.5, 0], [0.15, h * 0.3, 0.15]);
  }
  b.pop();
}
function bSkull(b, x, z, ry) {
  b.push([x, 0, z], ry);
  b.add('blob', COL.bone, [0, 0.28, 0], [0.32, 0.26, 0.4]);
  b.add('box', COL.rockDk, [-0.1, 0.32, 0.3], [0.1, 0.08, 0.06]);
  b.add('box', COL.rockDk, [0.1, 0.32, 0.3], [0.1, 0.08, 0.06]);
  b.add('cone4', COL.bone, [0.35, 0.35, 0], [0.12, 0.6, 0.12], [0, 0, -1.1]);
  b.add('cone4', COL.bone, [-0.35, 0.35, 0], [0.12, 0.6, 0.12], [0, 0, 1.1]);
  for (let i = 0; i < 4; i++) b.add('box', COL.bone, [0.2 * i - 0.3, 0.05, -0.9], [0.08, 0.08, 0.9], [0, 0.3 * i, 0]);
  b.pop();
}
function bMesa(b, x, z, r, h, rng) {
  const cols = [COL.mesa1, COL.mesa2, COL.mesa3];
  b.add('cyl6', cols[0], [x, 0, z], [r, h * 0.45, r * 0.8], rng() * 3);
  b.add('cyl6', cols[1], [x, h * 0.45, z], [r * 0.86, h * 0.35, r * 0.7], rng() * 3);
  b.add('cyl6', cols[2], [x, h * 0.8, z], [r * 0.72, h * 0.2, r * 0.6], rng() * 3);
  b.add('rock', COL.rockDk, [x + r * 0.9, 0, z + r * 0.3], [r * 0.4, r * 0.3, r * 0.4]);
}

// Bir segmentin tüm statik dekoru
function buildSegment(bS, bD, segIdx, anim) {
  let b = bD;
  for (const side of [-1, 1]) {
    const rng = mulberry(segIdx * 7919 + (side + 2) * 131);
    const X = (d) => side * (ROAD_HALF + d);
    // pist kenarı ışıkları (yanıp söner)
    for (let z = -56; z < 60; z += 12) {
      b.add('box', COL.metalDk, [X(1.4), 0, z], [0.15, 0.9, 0.15]);
      b.add('box', COL.beacon, [X(1.4), 0.9, z], [0.22, 0.18, 0.22], 0, 'blink');
    }
    // zemin dokusu: koyu/açık kum lekeleri
    for (let i = 0; i < 8; i++) b.add('cyl6', rng() > 0.5 ? COL.ground2 : COL.ground3, [X(4 + rng() * 60), 0.1, -60 + rng() * 120], [2 + rng() * 6, 0.02, 1.5 + rng() * 4], rng() * 3);
    // YAKIN (2-7 m): kaktüs kümeleri, kayalar, kafatası, krater
    for (let i = 0; i < 6; i++) {
      const z = -58 + i * 20 + rng() * 10, d = 2.5 + rng() * 4;
      const kind = rng();
      if (kind < 0.45) {
        bCactus(b, X(d), z, 1.8 + rng() * 1.6, rng() * 6);
        if (rng() > 0.4) bCactus(b, X(d + 1.2), z + 1.4, 1.2 + rng(), rng() * 6);
      } else if (kind < 0.7) {
        for (let k = 0; k < 3; k++) b.add('rock', [COL.rock, COL.rock2, COL.rockDk][k], [X(d + k * 0.6), 0.25, z + k * 0.7 - 0.7], [0.6 - k * 0.12, 0.45, 0.55], [0, rng() * 6, 0]);
      } else if (kind < 0.85) {
        bSkull(b, X(d), z, rng() * 6);
      } else {
        b.add('cyl12', COL.craterRim, [X(d + 1), 0, z], [1.6, 0.25, 1.7]);
        b.add('cyl12', COL.craterIn, [X(d + 1), 0.25, z], [1.15, 0.03, 1.2]);
      }
    }
    // küçük taşlar (sık)
    for (let i = 0; i < 6; i++) b.add('rock', rng() > 0.5 ? COL.rockDk : COL.rock2, [X(2 + rng() * 14), 0.1, -60 + rng() * 120], 0.15 + rng() * 0.3, [rng(), rng() * 6, 0]);
    // boru hattı (sürekli, yolla paralel) — bandı doldurur
    b.add('cyl8', COL.hullDk, [X(8.5), 1.0, 0], [0.35, 120.6, 0.35], [Math.PI / 2, 0, 0]);
    for (let z = -55; z < 60; z += 10) {
      b.add('box', COL.metalDk, [X(8.5), 0, z], [0.2, 1.0, 0.2]);
      b.add('box', COL.red, [X(8.5), 0.62, z], [0.8, 0.76, 0.3]);
    }
    b = bS;
    // ORTA (11-36 m): yapı sırası
    const types = ['rocket', 'hangarLg', 'hangarRd', 'tanks', 'habitat', 'solar', 'tower', 'oasis', 'camp', 'gen'];
    let z = -54 + rng() * 6;
    while (z < 56) {
      const t = types[Math.floor(rng() * types.length)];
      const d = 13 + rng() * 6;
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      let step = 16;
      if (t === 'rocket') { bRocket(b, X(d + 4), z, rng() * 6); step = 14; }
      else if (t === 'hangarLg') { bHangarLg(b, X(d + 3), z, ry); step = 14; }
      else if (t === 'hangarRd') { bHangarRd(b, X(d + 3), z, ry); step = 13; }
      else if (t === 'tanks') { bTanks(b, X(d + 2), z, rng() * 6); step = 10; }
      else if (t === 'habitat') { bHabitat(b, X(d + 4), z, ry); step = 14; }
      else if (t === 'solar') { bSolar(b, X(d + 3), z, 0); step = 12; }
      else if (t === 'tower') { bTower(b, X(d), z); bGenerator(b, X(d + 3), z + 2, ry); step = 8; }
      else if (t === 'oasis') { bOasis(b, X(d + 6), z + 4, rng); step = 18; }
      else if (t === 'camp') { bCamp(b, X(d + 2), z, ry); step = 12; }
      else { bGenerator(b, X(d), z, ry); bDishBase(b, X(d + 3), z + 3, 2.2); anim.dishes.push([X(d + 3), 2.2 * 0.5 + 0.1, z + 3, 2.2]); step = 9; }
      z += step + 3 + rng() * 5;
    }
    // ikinci sıra (36-55 m): büyük hangarlar, çanaklar, roketler — derinlik
    for (let z2 = -50 + rng() * 14; z2 < 58; z2 += 34 + rng() * 12) {
      const k = rng();
      if (k < 0.3) bRocket(b, X(38 + rng() * 10), z2, rng() * 6, 2.8);
      else if (k < 0.6) bHangarLg(b, X(40 + rng() * 8), z2, rng() * 6, 3.2);
      else if (k < 0.8) { bDishBase(b, X(40), z2, 4); anim.dishes.push([X(40), 4 * 0.5 + 0.1, z2, 4]); }
      else bTanks(b, X(42), z2, rng() * 6);
    }
    b = bD;
    // dağınık kaktüs ve kaya (orta bant boşlukları)
    for (let i = 0; i < 2; i++) bCactus(b, X(22 + rng() * 30), -60 + rng() * 120, 1.6 + rng() * 2, rng() * 6);
    for (let i = 0; i < 3; i++) b.add('rock', COL.rock, [X(20 + rng() * 40), 0.4, -60 + rng() * 120], [1 + rng() * 1.5, 0.8 + rng(), 1 + rng()], [0, rng() * 6, 0]);
    anim.flags.push([X(3.2), 0, -40 + rng() * 20], [X(3.2), 0, 20 + rng() * 20]);
    anim.devils.push([X(10 + rng() * 25), -60 + rng() * 120]);
    for (let i = 0; i < 2; i++) anim.weeds.push([X(3 + rng() * 14), -60 + rng() * 120, rng()]);
    if (side === (segIdx % 2 ? 1 : -1)) anim.rovers.push([X(6 + rng() * 2), rng() * 120 - 60]);
  }
  // bayrak direkleri
  b = bD;
  for (const [x, , z] of anim.flags) b.add('cyl8', COL.metal, [x, 0, z], [0.06, 4.2, 0.06]);
}

// UZAK silüet: kum tepeleri, mesalar, sırt — gölgesiz, ucuz
function buildFar(b, segIdx) {
  for (const side of [-1, 1]) {
    const rng = mulberry(segIdx * 104729 + side * 17);
    const X = (d) => side * (ROAD_HALF + d);
    for (let i = 0; i < 4; i++) b.add('blob', rng() > 0.5 ? COL.dune : COL.dune2, [X(58 + rng() * 30), -2, -60 + i * 30 + rng() * 15], [14 + rng() * 10, 5 + rng() * 5, 12 + rng() * 8], [0, rng() * 3, 0]);
    for (let i = 0; i < 2; i++) bMesa(b, X(100 + rng() * 60), -60 + i * 60 + rng() * 40, 14 + rng() * 14, 18 + rng() * 22, rng);
    b.add('cone6', COL.ridge, [X(230 + rng() * 60), 0, rng() * 60 - 30], [70 + rng() * 30, 50 + rng() * 40, 60], [0, rng() * 3, 0]);
    b.add('blob', COL.mesa3, [X(170 + rng() * 30), -4, rng() * 100 - 50], [40, 14 + rng() * 10, 45]);
  }
}

function buildGround(b) {
  b.add('box', COL.ground, [-(ROAD_HALF + 200), 0, 0], [400, 0.1, SEG_LEN + 0.6]);
  b.add('box', COL.ground, [ROAD_HALF + 200, 0, 0], [400, 0.1, SEG_LEN + 0.6]);
  b.add('box', COL.road, [0, 0, 0], [18, 0.3, SEG_LEN + 0.6]);
  for (const x of [-4, 4]) for (let i = 0; i < 8; i++) b.add('box', COL.lane, [x, 0.3, -SEG_LEN / 2 + 8 + i * 14], [0.15, 0.02, 5]);
}

// ── Hareketli öğelerin gövdeleri (paylaşılan) ──────────────────────────────
const dishHeadGeo = bakeGeo((b) => {
  b.push([0, 0, 0], [-0.6, 0, 0]);
  b.add('dome', COL.hull, [0, 0, 0], [0.45, -0.16, 0.45]);
  b.add('cyl8', COL.metal, [0, 0, 0], [0.012, 0.32, 0.012]);
  b.add('box', COL.red, [0, 0.32, 0], [0.05, 0.05, 0.05]);
  b.pop();
});
const flagGeo = bakeGeo((b) => {
  for (let i = 0; i < 4; i++) b.add('box', i % 2 ? COL.hull : COL.red, [0.25 + i * 0.4, 0, 0], [0.4, 1, 0.03]);
});
const weedGeo = bakeGeo((b) => {
  b.add('blob', '#8a6a3a', [0, 0, 0], 0.55);
  b.add('blob', '#6e5228', [0, 0, 0], [0.62, 0.45, 0.5], [0.7, 0.4, 0]);
});
const roverGeo = bakeGeo((b) => {
  b.add('box', COL.hull, [0, 0.45, 0], [1.6, 0.5, 2.4]);
  b.add('box', COL.window, [0, 0.95, 0.5], [1.2, 0.4, 0.9]);
  b.add('box', COL.solar, [0, 0.96, -0.6], [1.5, 0.05, 1.0]);
  for (const [x, z] of [[-0.9, -0.85], [0.9, -0.85], [-0.9, 0], [0.9, 0], [-0.9, 0.85], [0.9, 0.85]]) b.add('wheel', COL.metalDk, [x, 0.35, z], [0.25, 0.35, 0.35]);
  b.add('cyl8', COL.metal, [0.5, 0.95, -0.9], [0.03, 1.0, 0.03]);
  b.add('box', COL.red, [0.5, 1.95, -0.9], [0.1, 0.1, 0.1]);
});
const devilGeo = new THREE.ConeGeometry(1, 1, 10, 1, true).rotateX(Math.PI).translate(0, 0.5, 0);
const devilMat = new THREE.MeshBasicMaterial({ color: '#e8a070', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });

function SegmentAnims({ anim }) {
  const { dishes, flags, devils, weeds, rovers } = anim;
  return (<>
    {dishes.length > 0 && <Anim geo={dishHeadGeo} count={dishes.length}
      init={(i, o) => { const [x, y, z, k] = dishes[i]; o.position.set(x, y, z); o.scale.setScalar(k); o.userData.p = i * 1.7; }}
      update={(i, t, o) => { o.rotation.y = t * 0.6 + o.userData.p; }} />}
    <Anim geo={flagGeo} count={flags.length}
      init={(i, o) => { const [x, , z] = flags[i]; o.position.set(x, 3.6, z); o.scale.set(1, 0.9, 1); o.userData.p = i * 2.1; }}
      update={(i, t, o) => { const p = o.userData.p; o.rotation.y = Math.PI / 2 + Math.sin(t * 3 + p) * 0.35; o.scale.x = 0.9 + Math.sin(t * 7 + p) * 0.1; }} />
    <Anim geo={weedGeo} count={weeds.length} margin={12}
      init={(i, o) => { const [x, z] = weeds[i]; o.userData.x = x; o.userData.z = z; o.position.set(x, 0.55, z); }}
      update={(i, t, o) => {
        const u = o.userData; const zz = ((u.z + 60 + t * 3.2 + i * 37) % 120) - 60;
        o.position.set(u.x + Math.sin(t * 0.7 + i) * 1.5, 0.55 + Math.abs(Math.sin(t * 4 + i)) * 0.5, zz);
        o.rotation.set(t * 5, 0, t * 1.3);
      }} />
    <Anim geo={devilGeo} mat={devilMat} count={devils.length} margin={10}
      init={(i, o) => { const [x, z] = devils[i]; o.userData.x = x; o.userData.z = z; o.position.set(x, 0, z); o.scale.set(2.2, 9, 2.2); }}
      update={(i, t, o) => { const u = o.userData; o.rotation.y = -t * 6; o.position.x = u.x + Math.sin(t * 0.4 + i) * 4 * Math.sign(u.x) * 0.5; o.position.z = u.z + Math.cos(t * 0.3 + i) * 6; const s = 2 + Math.sin(t * 1.5 + i) * 0.4; o.scale.set(s, 8 + Math.sin(t + i) * 1.5, s); }} />
    {rovers.length > 0 && <Anim geo={roverGeo} count={rovers.length} margin={60} shadow
      init={(i, o) => { const [x, z] = rovers[i]; o.userData.x = x; o.userData.z = z; o.position.set(x, 0, z); }}
      update={(i, t, o) => { const u = o.userData; o.position.z = ((u.z + 60 + t * 4) % 120) - 60; o.position.y = Math.abs(Math.sin(t * 6)) * 0.05; }} />}
  </>);
}

function SegmentContent({ segIdx }) {
  const { geos, detail, anim } = useMemo(() => {
    const anim = { dishes: [], flags: [], devils: [], weeds: [], rovers: [] };
    const bS = makeBatch(), bD = makeBatch(); buildSegment(bS, bD, segIdx, anim);
    return { geos: bS.build(), detail: bD.build(), anim };
  }, [segIdx]);
  return (
    <>
      <Baked build={buildGround} deps={[]} />
      <Baked geos={geos} shadow lod={405} />
      <Baked geos={detail} shadow lod={210} />
      <Baked build={(b) => buildFar(b, segIdx)} deps={[segIdx]} />
      <SegmentAnims anim={anim} />
    </>
  );
}

// Gökyüzü: yıldızlar, büyük gezegen + iki ay
function Stars() {
  const geo = useMemo(() => {
    const positions = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 350 + Math.random() * 50;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ffffff" size={0.7} sizeAttenuation fog={false} />
    </points>
  );
}

function Planet() {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.02; });
  return (
    <group>
      <mesh ref={ref} position={[120, 80, -400]}>
        <sphereGeometry args={[38, 24, 16]} />
        <meshStandardMaterial color="#3a7acc" roughness={0.7} metalness={0.1} fog={false} />
      </mesh>
      <mesh position={[-150, 120, -420]}>
        <sphereGeometry args={[9, 12, 8]} />
        <meshStandardMaterial color="#d8c8b0" roughness={0.9} fog={false} />
      </mesh>
      <mesh position={[40, 150, -440]}>
        <sphereGeometry args={[5, 10, 6]} />
        <meshStandardMaterial color="#e8b090" roughness={0.9} fog={false} />
      </mesh>
    </group>
  );
}

export default function DesertEnvironment() {
  const phase   = useGameStore((s) => s.phase);
  const groupsRef = useRef([]);
  const posRef    = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));

  useBlink(1.6);
  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const vel = (useGameStore.getState().speed || 10) * delta; // abonelik yok: kare başı render olmasın
    for (let i = 0; i < SEG_COUNT; i++) {
      posRef.current[i] += vel;
      if (posRef.current[i] > RECYCLE_AFTER) {
        const minZ = Math.min(...posRef.current);
        posRef.current[i] = minZ - SEG_LEN;
      }
      if (groupsRef.current[i]) groupsRef.current[i].position.z = posRef.current[i];
    }
  });

  return (
    <>
      {/* Mars sky */}
      <color attach="background" args={['#c0581a']} />
      <Stars />
      <Planet />
      <HorizonRing seed={3} colors={['#a8481c', '#9a4018', '#b4501e']} kind="cyl6" hMin={18} hMax={45} />
      <HorizonRing seed={9} colors={['#b85020', '#ac4a1c']} kind="blob" count={16} minR={360} maxR={400} hMin={10} hMax={22} wMin={50} wMax={90} />

      {/* Mars lighting — telefonda yeterince aydınlık olsun diye artırıldı */}
      <ambientLight intensity={0.7} color="#5a2a10" />
      <directionalLight
        castShadow
        position={[60, 80, -100]}
        intensity={2.8}
        color="#ffa066"
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <hemisphereLight skyColor="#ff7a33" groundColor="#3a1505" intensity={0.9} />

      {Array.from({ length: SEG_COUNT }, (_, i) => (
        <group
          key={i}
          ref={(el) => (groupsRef.current[i] = el)}
          position={[0, 0, -i * SEG_LEN]}
        >
          <SegmentContent segIdx={i} />
        </group>
      ))}
    </>
  );
}
