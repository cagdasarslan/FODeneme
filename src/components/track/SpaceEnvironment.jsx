import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP } from '@/utils/device';
import { makeBatch, bakeGeo, Baked, Anim, useBlink, mulberry, HorizonRing } from '@/utils/procKit';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const ROAD_COLOR = '#6b3a2a';
const GROUND_COLOR = '#2a1a35';
const ROAD_W = 18;

// ── Canlı uzay kolonisi (toplu geometri) ────────────────────────────────────
// Segment başına: zemin (1) + yapılar (lit/glow/blink) + yakın detay (LOD) +
// uzak silüet + birkaç InstancedMesh hareketli öğe. Yol yarı genişliği 9.
const ROAD_HALF = ROAD_W / 2;
const COL = {
  ground: GROUND_COLOR, ground2: '#352245', ground3: '#22142c', road: ROAD_COLOR, lane: '#ff6633', strip: '#ff6a3a',
  hull: '#d9dde3', hull2: '#b8c0cc', dark: '#4a5060', darker: '#30343e', orange: '#e0702c', teal: '#3fb6b0',
  glass: '#7fd0ff', warm: '#ffd890', solar: '#1d2a5a', rock: '#5e3a4c', rock2: '#4a2c3e', rockDk: '#33202c',
  cargo: '#c9a23a', cargo2: '#5a7fa8', cargo3: '#a84a3a', beacon: '#ff3a3a', beacon2: '#40ff90',
  cry1: '#40f0ff', cry2: '#ff60e0', cry3: '#a070ff', green: '#60ff90', ridge: '#2a1a3a', ridge2: '#3a2448',
  tower: '#3a3f52', tower2: '#4a4060',
};

function bDome(b, x, z, r, ry, rng) {
  b.push([x, 0, z], ry);
  b.add('cyl12', COL.hull2, [0, 0, 0], [r * 1.05, 0.5, r * 1.05]);
  b.add('dome', rng() > 0.5 ? COL.hull : COL.hull2, [0, 0.5, 0], [r, r * 0.8, r]);
  const n = 6;
  for (let i = 0; i < n; i++) { b.push([0, 0, 0], (i / n) * Math.PI * 2); b.add('quad', rng() > 0.25 ? COL.warm : COL.glass, [0, 0.5 + r * 0.25, r * 0.96], [r * 0.38, r * 0.14, 1], [-0.3, 0, 0], 'glow'); b.pop(); }
  b.add('box', COL.glass, [0, 0.55, r * 1.04], [r * 1.6, 0.12, 0.06], 0, 'glow');
  b.add('halfCylZ', COL.hull, [0, 0, r * 1.05], [0.8, 1.3, 1.4]);
  b.add('box', COL.orange, [0, 0, r * 1.05 + 0.75], [1.0, 1.0, 0.1]);
  b.add('cyl8', COL.dark, [r * 0.4, r * 0.8, 0], [0.05, r * 0.6, 0.05]);
  b.add('box', COL.beacon, [r * 0.4, r * 1.4 + 0.5, 0], [0.22, 0.22, 0.22], 0, 'blink');
  b.pop();
}
function bBlock(b, x, z, w, d, h, ry, rng, far = false, fx = 1) { // kule/blok + ışıklı pencere bantları
  b.push([x, 0, z], ry);
  b.add('box', rng() > 0.5 ? COL.tower : COL.tower2, [0, 0, 0], [w, h, d]);
  const rows = Math.max(2, Math.floor(h / (far ? 3.5 : 2.2)));
  for (let r = 0; r < rows; r++) {
    const y = 1.4 + r * (h - 1.6) / rows;
    const c = rng() > 0.3 ? COL.warm : COL.glass;
    b.add('quad', c, [0, y, d / 2 + 0.03], [w * 0.82, 0.4, 1], 0, 'glow');
    b.add('quad', c, [fx * (w / 2 + 0.03), y, 0], [d * 0.82, 0.4, 1], fx * Math.PI / 2, 'glow');
  }
  b.add('box', COL.dark, [0, h, 0], [w * 1.04, 0.3, d * 1.04]);
  if (h > 10) { b.add('cyl8', COL.dark, [w * 0.3, h + 0.3, 0], [0.06, 3, 0.06]); b.add('box', COL.beacon, [w * 0.3, h + 3.3, 0], [0.3, 0.3, 0.3], 0, 'blink'); }
  b.pop();
}
function bHab(b, x, z, ry, rng) { // silindir modüller + bağlantı tüneli
  b.push([x, 0, z], ry);
  for (const [mx, mz] of [[-2.6, 0], [2.6, 0]]) {
    b.add('cyl12', COL.hull, [mx, 0, mz], [1.8, 2.6, 1.8]);
    b.add('cyl12', COL.orange, [mx, 2.6, mz], [1.85, 0.25, 1.85]);
    b.add('box', COL.warm, [mx, 1.4, mz + 1.75], [1.2, 0.4, 0.1], 0, 'glow');
  }
  b.add('box', COL.hull2, [0, 0.6, 0], [3.4, 1.2, 1.2]);
  b.add('box', COL.glass, [0, 0.9, 0.61], [2.6, 0.3, 0.05], 0, 'glow');
  b.add('box', rng() > 0.5 ? COL.beacon : COL.beacon2, [2.6, 3.0, 0], [0.2, 0.2, 0.2], 0, 'blink');
  b.pop();
}
function bGreenhouse(b, x, z) {
  b.push([x, 0, z]);
  b.add('box', COL.dark, [0, 0, 0], [5.4, 0.3, 12.4]);
  b.add('halfCylZ', COL.hull2, [0, 0.3, 0], [2.6, 2.4, 12]);
  for (let i = -2; i <= 2; i++) b.add('box', COL.green, [0, 0.35, i * 2.4], [4.4, 0.6, 1.6], 0, 'glow');
  for (let i = -3; i <= 3; i++) b.add('halfCylZ', COL.dark, [0, 0.3, i * 2], [2.65, 2.45, 0.15]);
  b.pop();
}
function bSolarField(b, x, z, rows = 3, cols = 3) {
  b.push([x, 0, z]);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = (c - (cols - 1) / 2) * 3.2, pz = (r - (rows - 1) / 2) * 2.6;
    b.add('box', COL.dark, [px, 0, pz], [0.12, 0.8, 0.12]);
    b.add('box', COL.solar, [px, 0.8, pz], [2.9, 0.08, 1.9], [0.45, 0, 0]);
  }
  b.pop();
}
function bAntenna(b, x, z, h) {
  b.push([x, 0, z]);
  b.add('box', COL.darker, [0, 0, 0], [1.2, 0.4, 1.2]);
  b.add('cyl6', COL.hull2, [0, 0.4, 0], [0.12, h, 0.12]);
  for (let y = 2; y < h; y += 3) b.add('box', COL.dark, [0, y, 0], [1.4, 0.08, 0.08]);
  b.add('box', COL.beacon, [0, h + 0.4, 0], [0.3, 0.3, 0.3], 0, 'blink');
  b.add('box', COL.beacon2, [0.7, h * 0.6, 0], [0.18, 0.18, 0.18], 0, 'blink');
  b.pop();
}
function bCraneBase(b, x, z, h) { // dönen kol Anim'de
  b.push([x, 0, z]);
  b.add('box', COL.darker, [0, 0, 0], [2.4, 0.5, 2.4]);
  for (const [px, pz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.add('box', COL.orange, [px, 0.5, pz], [0.14, h, 0.14]);
  for (let y = 2; y < h; y += 2.5) { b.add('box', COL.orange, [0, y, 0.5], [1.1, 0.1, 0.1], [0, 0, 0.6]); b.add('box', COL.orange, [0.5, y + 1.2, 0], [0.1, 0.1, 1.1], [0.6, 0, 0]); }
  b.add('box', COL.beacon, [0, h + 2.4, 0], [0.25, 0.25, 0.25], 0, 'blink');
  b.pop();
}
function bPad(b, x, z, withShip, rng) {
  b.push([x, 0, z]);
  b.add('cyl12', COL.dark, [0, 0, 0], [4.2, 0.25, 4.2]);
  b.add('cyl12', COL.orange, [0, 0.25, 0], [3.2, 0.03, 3.2]);
  b.add('cyl12', COL.dark, [0, 0.27, 0], [2.7, 0.03, 2.7]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.add('box', COL.beacon2, [Math.cos(a) * 3.8, 0.25, Math.sin(a) * 3.8], [0.25, 0.12, 0.25], 0, 'blink'); }
  if (withShip) { b.push([0, 0.3, 0], rng() * 6, 1.6); bShipBody(b); b.pop(); }
  b.pop();
}
function bShipBody(b) {
  for (let i = 0; i < 4; i++) { b.push([0, 0, 0], i * Math.PI / 2 + 0.78); b.add('box', COL.dark, [0, 0, 1.0], [0.1, 0.9, 0.1], [0.4, 0, 0]); b.pop(); }
  b.add('cyl8', COL.hull, [0, 0.7, 0], [1.0, 0.8, 1.0]);
  b.add('cone8', COL.hull2, [0, 1.5, 0], [1.0, 1.0, 1.0]);
  b.add('box', COL.glass, [0, 1.1, 0.95], [0.6, 0.25, 0.08], 0, 'glow');
  b.add('box', COL.orange, [0, 0.95, 0], [2.4, 0.08, 0.4]);
}
function bCargo(b, x, z, ry, rng) {
  b.push([x, 0, z], ry);
  const cs = [COL.cargo, COL.cargo2, COL.cargo3, COL.teal];
  b.add('box', cs[Math.floor(rng() * 4)], [0, 0, 0], [2.4, 1.2, 1.2]);
  b.add('box', cs[Math.floor(rng() * 4)], [0.2, 1.2, 0], [2.4, 1.2, 1.2], 0.15);
  b.add('box', cs[Math.floor(rng() * 4)], [0, 0, 1.4], [2.4, 1.2, 1.2]);
  b.pop();
}
function bCrystals(b, x, z, rng) {
  const c = [COL.cry1, COL.cry2, COL.cry3][Math.floor(rng() * 3)];
  for (let i = 0; i < 4; i++) {
    const h = 0.8 + rng() * 1.8;
    b.add('cone4', c, [x + (rng() - 0.5) * 1.4, 0, z + (rng() - 0.5) * 1.4], [0.35 + rng() * 0.2, h, 0.35 + rng() * 0.2], [(rng() - 0.5) * 0.6, rng() * 3, (rng() - 0.5) * 0.6], 'glow');
  }
  b.add('rock', COL.rockDk, [x, 0.15, z], [0.8, 0.35, 0.7]);
}

function buildSegment(bS, bD, segIdx, anim) {
  for (const side of [-1, 1]) {
    const rng = mulberry(segIdx * 6151 + (side + 2) * 97);
    const X = (d) => side * (ROAD_HALF + d);
    let b = bD;
    // yol kenarı: ışıklı bariyer şeridi + babalar
    b.add('box', COL.darker, [X(0.4), 0, 0], [0.4, 0.55, SEG_LEN]);
    b.add('box', COL.strip, [X(0.4), 0.55, 0], [0.25, 0.25, SEG_LEN], 0, 'glow');
    for (let z = -55; z < 60; z += 10) {
      b.add('cyl6', COL.dark, [X(2.2), 0, z], [0.15, 1.1, 0.15]);
      b.add('box', z % 20 ? COL.glass : COL.beacon2, [X(2.2), 1.1, z], [0.26, 0.2, 0.26], 0, z % 20 ? 'glow' : 'blink');
    }
    // zemin lekeleri
    for (let i = 0; i < 7; i++) b.add('cyl6', rng() > 0.5 ? COL.ground2 : COL.ground3, [X(4 + rng() * 50), 0.1, -60 + rng() * 120], [2 + rng() * 5, 0.02, 1.5 + rng() * 3.5], rng() * 3);
    // YAKIN (2.5-7 m): kristaller, kaya, kargo, kutular
    for (let i = 0; i < 6; i++) {
      const z = -57 + i * 20 + rng() * 10, d = 3 + rng() * 3.5, k = rng();
      if (k < 0.45) bCrystals(b, X(d), z, rng);
      else if (k < 0.7) bCargo(b, X(d + 0.8), z, rng() * 0.6, rng);
      else for (let j = 0; j < 3; j++) b.add('rock', [COL.rock, COL.rock2, COL.rockDk][j], [X(d + j * 0.7), 0.3, z + j * 0.8], [0.7 - j * 0.15, 0.55, 0.6], [0, rng() * 6, 0]);
    }
    for (let i = 0; i < 5; i++) b.add('rock', COL.rock2, [X(3 + rng() * 14), 0.1, -60 + rng() * 120], 0.2 + rng() * 0.3, [rng(), rng() * 6, 0]);
    // boru hattı (iki boru, sürekli)
    b = bS;
    b.add('cyl8', COL.hull2, [X(8.5), 1.0, 0], [0.32, SEG_LEN + 0.6, 0.32], [Math.PI / 2, 0, 0]);
    b.add('cyl8', COL.teal, [X(9.3), 0.7, 0], [0.22, SEG_LEN + 0.6, 0.22], [Math.PI / 2, 0, 0]);
    for (let z = -55; z < 60; z += 10) { b.add('box', COL.dark, [X(8.9), 0, z], [1.6, 1.0, 0.25]); b.add('box', COL.glass, [X(8.5), 1.0, z], [0.75, 0.2, 0.2], 0, 'glow'); }
    // ORTA (12-34 m): kubbeler, modüller, sera, pist, vinç, anten, güneş paneli
    const types = ['dome', 'dome', 'hab', 'green', 'pad', 'crane', 'antenna', 'solar', 'dish', 'block'];
    let z = -54 + rng() * 6;
    while (z < 56) {
      const t = types[Math.floor(rng() * types.length)];
      const d = 13 + rng() * 5, ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      let step = 14;
      if (t === 'dome') { const r = 3.5 + rng() * 2.5; bDome(b, X(d + r), z, r, ry, rng); step = r * 2 + 3; }
      else if (t === 'hab') { bHab(b, X(d + 2), z, ry + Math.PI / 2, rng); step = 10; }
      else if (t === 'green') { bGreenhouse(b, X(d + 3), z + 4); step = 15; }
      else if (t === 'pad') { const ship = rng() > 0.4; bPad(b, X(d + 4), z + 2, ship, rng); if (!ship) anim.landers.push([X(d + 4), z + 2]); step = 12; }
      else if (t === 'crane') { const h = 10 + rng() * 5; bCraneBase(b, X(d + 1), z, h); anim.cranes.push([X(d + 1), h + 0.5, z]); bCargo(b, X(d + 5), z + 3, 0.2, rng); step = 11; }
      else if (t === 'antenna') { bAntenna(b, X(d), z, 9 + rng() * 6); bCargo(b, X(d + 3), z + 2, rng(), rng); step = 7; }
      else if (t === 'solar') { bSolarField(b, X(d + 4), z + 2); step = 10; }
      else if (t === 'dish') { b.add('box', COL.darker, [X(d + 2), 0, z], [1.6, 0.4, 1.6]); b.add('cyl8', COL.hull2, [X(d + 2), 0.4, z], [0.2, 1.6, 0.2]); anim.dishes.push([X(d + 2), 2.0, z, 4.5]); step = 9; }
      else { bBlock(b, X(d + 3), z, 5, 5, 8 + rng() * 6, 0, rng, false, -side); step = 9; }
      z += step + 2 + rng() * 4;
    }
    // ARKA SIRA (36-60 m): yüksek kuleler / büyük kubbeler — şehir silüeti
    for (let z2 = -52 + rng() * 10; z2 < 58; z2 += 22 + rng() * 10) {
      if (rng() < 0.6) bBlock(b, X(40 + rng() * 14), z2, 6 + rng() * 4, 6 + rng() * 4, 14 + rng() * 22, 0, rng, false, -side);
      else bDome(b, X(42 + rng() * 10), z2, 6 + rng() * 4, side < 0 ? Math.PI / 2 : -Math.PI / 2, rng);
    }
    // dronlar
    for (let i = 0; i < 2; i++) anim.drones.push([X(4 + rng() * 22), 4 + rng() * 5, -60 + rng() * 120]);
  }
}

function buildFar(b, segIdx) {
  for (const side of [-1, 1]) {
    const rng = mulberry(segIdx * 92821 + side * 29);
    const X = (d) => side * (ROAD_HALF + d);
    for (let i = 0; i < 3; i++) bBlock(b, X(80 + rng() * 40), -60 + i * 40 + rng() * 20, 8 + rng() * 6, 8 + rng() * 6, 25 + rng() * 40, 0, rng, true, -side);
    for (let i = 0; i < 3; i++) b.add('blob', rng() > 0.5 ? COL.ridge : COL.ridge2, [X(130 + rng() * 60), -6, -60 + i * 40 + rng() * 20], [30 + rng() * 20, 16 + rng() * 14, 25 + rng() * 10], [0, rng() * 3, 0]);
    b.add('cone6', COL.ridge, [X(240 + rng() * 60), 0, rng() * 60 - 30], [70 + rng() * 30, 60 + rng() * 50, 60], [0, rng() * 3, 0]);
  }
}

function buildGround(b) {
  b.add('box', COL.ground, [-(ROAD_HALF + 200), 0, 0], [400, 0.1, SEG_LEN + 0.6]);
  b.add('box', COL.ground, [ROAD_HALF + 200, 0, 0], [400, 0.1, SEG_LEN + 0.6]);
  b.add('box', COL.road, [0, 0, 0], [ROAD_W, 0.3, SEG_LEN + 0.6]);
  for (const x of [-4, 4]) for (let i = 0; i < 8; i++) b.add('box', COL.lane, [x, 0.3, -SEG_LEN / 2 + 8 + i * 14], [0.15, 0.02, 5], 0, 'glow');
}

// ── Hareketli gövdeler ─────────────────────────────────────────────────────
const dishHeadGeo = bakeGeo((b) => {
  b.push([0, 0, 0], [-0.6, 0, 0]);
  b.add('dome', COL.hull, [0, 0, 0], [0.45, -0.16, 0.45]);
  b.add('cyl8', COL.dark, [0, 0, 0], [0.012, 0.32, 0.012]);
  b.add('box', COL.orange, [0, 0.32, 0], [0.05, 0.05, 0.05]);
  b.pop();
});
const droneGeo = bakeGeo((b) => {
  b.add('blob', COL.hull, [0, 0, 0], [0.5, 0.3, 0.5]);
  b.add('box', COL.dark, [0, 0, 0], [2.0, 0.08, 0.12]);
  b.add('box', COL.dark, [0, 0, 0], [0.12, 0.08, 2.0]);
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.add('cyl8', COL.orange, [x, 0.05, z], [0.3, 0.04, 0.3]);
  b.add('box', COL.glass, [0, -0.2, 0.35], [0.3, 0.12, 0.1]);
});
const jibGeo = bakeGeo((b) => {
  b.add('box', COL.orange, [3, 0, 0], [9, 0.5, 0.5]);
  b.add('box', COL.darker, [-2.2, -0.3, 0], [1.6, 1.0, 1.0]);
  b.add('box', COL.dark, [6.5, -2.5, 0], [0.05, 5, 0.05]);
  b.add('box', COL.cargo2, [6.5, -5.4, 0], [1.6, 0.9, 0.9]);
});
const landerGeo = bakeGeo((b) => { b.push([0, 0, 0], 0, 1.6); bShipBody(b); b.pop(); b.add('cone8', '#ffb060', [0, -1.6, 0], [0.7, 1.8, 0.7]); });

function SegmentAnims({ anim }) {
  const { dishes, drones, cranes, landers } = anim;
  return (<>
    {dishes.length > 0 && <Anim geo={dishHeadGeo} count={dishes.length}
      init={(i, o) => { const [x, y, z, k] = dishes[i]; o.position.set(x, y, z); o.scale.setScalar(k); o.userData.p = i * 2.3; }}
      update={(i, t, o) => { o.rotation.y = t * 0.5 + o.userData.p; }} />}
    <Anim geo={droneGeo} count={drones.length} margin={10}
      init={(i, o) => { const [x, y, z] = drones[i]; o.userData = { x, y, z }; o.position.set(x, y, z); }}
      update={(i, t, o) => { const u = o.userData; o.position.set(u.x + Math.sin(t * 0.5 + i * 2) * 3, u.y + Math.sin(t * 1.7 + i) * 0.6, u.z + Math.cos(t * 0.4 + i) * 8); o.rotation.y = t * 0.8 + i; o.rotation.z = Math.sin(t + i) * 0.12; }} />
    {cranes.length > 0 && <Anim geo={jibGeo} count={cranes.length} margin={6}
      init={(i, o) => { const [x, y, z] = cranes[i]; o.position.set(x, y, z); o.userData.p = i * 1.3; }}
      update={(i, t, o) => { o.rotation.y = Math.sin(t * 0.25 + o.userData.p) * 1.6; }} />}
    {landers.length > 0 && <Anim geo={landerGeo} count={landers.length} margin={20}
      init={(i, o) => { const [x, z] = landers[i]; o.position.set(x, 3, z); o.userData.p = i * 3.1; }}
      update={(i, t, o) => { const c = (t * 0.12 + o.userData.p) % 1; const y = 2.2 + (1 - Math.cos(c * 2 * Math.PI)) * 9; o.position.y = y; o.rotation.y = t * 0.3; }} />}
  </>);
}

function SegmentContent({ segIdx }) {
  const { geos, detail, far, anim } = useMemo(() => {
    const anim = { dishes: [], drones: [], cranes: [], landers: [] };
    const bS = makeBatch(), bD = makeBatch(), bF = makeBatch();
    buildSegment(bS, bD, segIdx, anim); buildFar(bF, segIdx);
    return { geos: bS.build(), detail: bD.build(), far: bF.build(), anim };
  }, [segIdx]);
  return (
    <>
      <Baked build={buildGround} deps={[]} />
      <Baked geos={geos} shadow lod={410} />
      <Baked geos={detail} lod={200} />
      <Baked geos={far} />
      <SegmentAnims anim={anim} />
    </>
  );
}

function Stars() {
  const positions = useMemo(() => {
    const arr = new Float32Array(2500 * 3);
    for (let i = 0; i < 2500; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.48, r = 380 + Math.random() * 60;
      arr[i * 3] = Math.cos(th) * Math.sin(ph) * r;
      arr[i * 3 + 1] = Math.cos(ph) * r * 0.8 + 5;
      arr[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.9} sizeAttenuation fog={false} />
    </points>
  );
}

function BigPlanet() {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03; });
  return (
    <>
      <group position={[120, 70, -380]}>
        <mesh ref={ref}>
          <sphereGeometry args={[42, 28, 20]} />
          <meshStandardMaterial color="#7b4fa6" emissive="#2a1040" roughness={0.7} metalness={0.1} fog={false} />
        </mesh>
        <mesh rotation={[Math.PI * 0.42, 0.2, 0]}>
          <torusGeometry args={[62, 5, 3, 48]} />
          <meshBasicMaterial color="#c79be8" transparent opacity={0.55} fog={false} />
        </mesh>
      </group>
      <mesh position={[-140, 110, -400]}>
        <sphereGeometry args={[12, 14, 10]} />
        <meshStandardMaterial color="#9ad0e0" emissive="#204050" roughness={0.8} fog={false} />
      </mesh>
      <mesh position={[-40, 160, -430]}>
        <sphereGeometry args={[6, 10, 8]} />
        <meshStandardMaterial color="#e0b8a0" emissive="#402820" roughness={0.9} fog={false} />
      </mesh>
    </>
  );
}

export default function SpaceEnvironment() {
  const phase = useGameStore((s) => s.phase);
  const posRef = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));
  const groupsRef = useRef([]);

  useBlink(1.3);
  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const vel = (useGameStore.getState().speed || 10) * delta; // abonelik yok: kare başı render olmasın
    for (let i = 0; i < SEG_COUNT; i++) {
      posRef.current[i] += vel;
      if (posRef.current[i] > RECYCLE_AFTER) {
        const minZ = Math.min(...posRef.current);
        posRef.current[i] = minZ - SEG_LEN;
      }
      if (groupsRef.current[i]) {
        groupsRef.current[i].position.z = posRef.current[i];
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#0d0518']} />
      <directionalLight
        castShadow
        position={[80, 60, -150]}
        intensity={3.6}
        color="#ffd0b0"
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-near={1}
        shadow-camera-far={350}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      {/* karşı dolgu ışığı — modeller karanlıkta silüet kalmasın */}
      <directionalLight position={[-60, 40, 60]} intensity={1.6} color="#a0c0ff" />
      <hemisphereLight skyColor="#aa99dd" groundColor="#332244" intensity={1.1} />
      <ambientLight intensity={1.0} color="#b0a0d0" />
      <Stars />
      <BigPlanet />
      <HorizonRing seed={5} colors={['#24123a', '#2c1846', '#1e0f30']} hMin={30} hMax={85} />
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
