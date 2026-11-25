import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { makeBatch, bakeGeo, Baked, Anim, mulberry, BATCH_MAT } from '@/utils/procKit';

const SEG_LEN       = 120;
const SEG_COUNT     = 6;
const RECYCLE_AFTER = SEG_LEN + 20;  // only recycle after full segment clears camera
const ROAD_HALF     = 9;

// ── Materials ────────────────────────────────────────────────────────────────
const MC = {
  grassLight: '#4e8040', grassDark: '#3a6828',
  cornStem: '#4a7c28', cornCob: '#f0c040',
  hay: '#d4a828', hayDark: '#b88c1a',
  barnRed: '#8b1a1a', barnRoof: '#3a0808',
  barnDoor: '#1a0202', barnWindow: '#a4c4e8', barnSide: '#6d1515',
  siloWall: '#c8bea0', siloDome: '#9a9282',
  barrierRedC: '#cc2222', barrierWhtC: '#e8e8e8',
  skyTop: '#4e9cc8', skyMid: '#7abce0', skyHorizon: '#b8d8f0',
  sunCore: '#fff8a0', cloudW: '#f4f8fc',
  mtnFar: '#78a090', mtnMid: '#6a9078', mtnSnow: '#eef2f6',
};
const M = {};
Object.entries(MC).forEach(([k, v]) => {
  M[k] = new THREE.MeshStandardMaterial({ color: v, roughness: 0.85 });
});
M.cloudW    = new THREE.MeshStandardMaterial({ color: MC.cloudW, transparent: true, opacity: 0.9, roughness: 1 });
M.sunCore   = new THREE.MeshStandardMaterial({ color: MC.sunCore, emissive: '#ffe060', emissiveIntensity: 1.2 });
M.barnWindow= new THREE.MeshStandardMaterial({ color: MC.barnWindow, roughness: 0.2, metalness: 0.3 });
M.skyTop    = new THREE.MeshStandardMaterial({ color: MC.skyTop,     side: THREE.BackSide });
M.skyMid    = new THREE.MeshStandardMaterial({ color: MC.skyMid,     side: THREE.BackSide });
M.skyHorizon= new THREE.MeshStandardMaterial({ color: MC.skyHorizon, side: THREE.BackSide });

// Gece varyantları
M.skyTopN     = new THREE.MeshBasicMaterial({ color: '#060a18', side: THREE.BackSide });
M.skyMidN     = new THREE.MeshBasicMaterial({ color: '#0a1028', side: THREE.BackSide });
M.skyHorizonN = new THREE.MeshBasicMaterial({ color: '#141a38', side: THREE.BackSide });
M.moon        = new THREE.MeshStandardMaterial({ color: '#e8ecf4', emissive: '#c8d4f0', emissiveIntensity: 0.9 });
M.cloudN      = new THREE.MeshStandardMaterial({ color: '#2a3048', transparent: true, opacity: 0.7, roughness: 1 });

// ── Canlı hipodrom (toplu geometri) ─────────────────────────────────────────
// Eskiden her bariyer bloğu/çit/bayrak ayrı mesh'ti (~2.000 çizim çağrısı).
// Şimdi segment başına birkaç birleşik geometri + InstancedMesh seyirciler.
// Segment içeriği yerel z ∈ [-120, 0]; yol yarı genişliği 9 (bariyer ±11).
const COL = {
  barR: '#cc2222', barW: '#eeeeee', white: '#eeeeea', grey: '#9a9c9e', greyDk: '#5c6064', concrete: '#b8b4aa',
  metal: '#7c8288', seatBlue: '#2f5fa8', seatRed: '#b83232', seatYel: '#e0b030', seatGrn: '#2f8a4a',
  tentRed: '#d04848', tentWht: '#f2ece0', tentBlue: '#3a6ec8', wood: '#7a5230', woodDk: '#553820',
  leaf: '#3f7a34', leaf2: '#4f9040', leafDk: '#2f6028', trunk: '#5a3d24', hedge: '#2f6a2c', hedge2: '#3a7a34',
  soil: '#6a4a2a', grass: '#4e8040', grass2: '#58904a', grass3: '#44743a', hill: '#5a9048', hill2: '#4a8040', hill3: '#6a9a50',
  ads: ['#e8742c', '#2c6ee8', '#22a040', '#d0302c', '#f0c020', '#7a3ac8'],
  flowers: ['#ff5a7a', '#ffd040', '#ffffff', '#c060ff', '#ff8030'],
  bunt: ['#d02c2c', '#f0c020', '#2c6ee8', '#ffffff', '#22a040'],
  lamp: '#fff4c0', window: '#ffe8a0', glass: '#3b4a5c', roof: '#5a5650', roofRed: '#8a2a20', brick: '#b06a50',
  cream: '#efe4cc', barn: '#8b1a1a', barnRoof: '#3a0808', silo: '#c8bea0', hay: '#d4a828', trailer: '#d8d8d4', trailer2: '#5a7fa8',
};

function bTree(b, x, z, k, rng) {
  b.push([x, 0, z], rng() * 6, k);
  if (rng() > 0.4) {
    b.add('cyl6', COL.trunk, [0, 0, 0], [0.22, 2.2, 0.22]);
    b.add('blob', rng() > 0.5 ? COL.leaf : COL.leaf2, [0, 3.0, 0], [1.6, 1.4, 1.6]);
    b.add('blob', COL.leafDk, [0.5, 3.9, -0.3], [1.0, 0.9, 1.0]);
  } else {
    b.add('cyl6', COL.trunk, [0, 0, 0], [0.18, 1.2, 0.18]);
    b.add('cone8', COL.leafDk, [0, 1.0, 0], [1.3, 2.4, 1.3]);
    b.add('cone8', COL.leaf, [0, 2.5, 0], [0.95, 2.0, 0.95]);
  }
  b.pop();
}
// Tribün: z boyunca L uzunluğunda, ön (yola bakan) yüz -fx yönünde
function bStand(b, x, z, L, fx, covered, seatRng, crowd) {
  const rows = 5;
  const seats = [COL.seatBlue, COL.seatRed, COL.seatYel, COL.seatGrn];
  const sc = seats[Math.floor(seatRng() * seats.length)];
  for (let i = 0; i < rows; i++) {
    const top = 0.6 + i * 0.75, px = x + fx * (i * 1.1), dens = 0.5 - i * 0.04;
    b.add('box', COL.concrete, [px, 0, z], [1.1, top, L]);
    b.add('box', sc, [px - fx * 0.15, top, z], [0.5, 0.18, L - 0.2]);
    for (let j = 0; j < Math.floor(L / 1.25); j++) {
      if (seatRng() < dens) crowd.push([px - fx * 0.12, top + 0.18, z - L / 2 + 0.7 + j * 1.25 + (seatRng() - 0.5) * 0.3, seatRng()]);
    }
  }
  const backX = x + fx * (rows * 1.1 - 0.4);
  b.add('box', COL.grey, [backX, 0, z], [0.3, 0.6 + rows * 0.75 + 1.2, L]);
  b.add('box', COL.grey, [x + fx * 2.2, 0, z - L / 2], [rows * 1.1 + 0.4, 4.6, 0.3]);
  b.add('box', COL.grey, [x + fx * 2.2, 0, z + L / 2], [rows * 1.1 + 0.4, 4.6, 0.3]);
  if (covered) {
    for (let j = 0; j <= 4; j++) b.add('box', COL.metal, [backX, 0, z - L / 2 + j * L / 4], [0.2, 8.2, 0.2]);
    b.add('box', COL.white, [x + fx * 2.2, 8.0, z], [rows * 1.1 + 2.0, 0.25, L + 1], [0, 0, fx * 0.12]);
    b.add('box', COL.seatRed, [x - fx * 0.6, 7.7, z], [0.15, 0.5, L + 1]);
  }
  // ön duvar + reklam bandı
  b.add('box', COL.white, [x - fx * 0.7, 0, z], [0.2, 1.1, L]);
  b.add('box', COL.ads[Math.floor(seatRng() * 6)], [x - fx * 0.81, 0.3, z], [0.02, 0.6, L * 0.9]);
}
function bClubhouse(b, x, z, fx, rng) {
  b.push([x, 0, z]);
  b.add('box', COL.cream, [0, 0, 0], [9, 5.6, 16]);
  b.add('prism', COL.roofRed, [0, 5.6, 0], [9.8, 2.6, 16.8]);
  b.add('box', COL.cream, [0, 0, 0], [4, 10, 4]);
  b.add('cone4', COL.roofRed, [0, 10, 0], [5, 3.5, 5]);
  b.add('box', COL.white, [-fx * 2.02, 7.6, 0], [0.05, 1.6, 1.6]);
  b.add('box', COL.greyDk, [-fx * 2.05, 7.6, 0], [0.04, 0.9, 0.12]);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) b.add('quad', COL.window, [-fx * 4.53, 1.2 + r * 2.3, -6 + c * 3], [1.4, 1.2, 1], -fx * Math.PI / 2, 'glow');
  b.add('box', COL.white, [-fx * 5.4, 2.6, 0], [1.8, 0.2, 14]);
  for (let c = 0; c < 5; c++) b.add('cyl6', COL.white, [-fx * 6.1, 0, -6 + c * 3], [0.12, 2.6, 0.12]);
  b.add('box', COL.tentRed, [-fx * 6.0, 2.8, 0], [0.3, 0.4, 14.4]);
  b.pop();
}
function bTent(b, x, z, long, c) {
  const w = long ? 10 : 5;
  b.push([x, 0, z]);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add('box', COL.white, [px * 2.2, 0, pz * (w / 2 - 0.2)], [0.12, 2.4, 0.12]);
  b.add('box', COL.tentWht, [0, 2.2, 0], [5, 0.4, w]);
  b.add('prism', c, [0, 2.6, 0], [5.2, 1.6, w + 0.2]);
  b.add('box', COL.wood, [0, 0, 0], [1.4, 1.0, w * 0.7]);
  b.pop();
}
function bTrailer(b, x, z, ry, rng) {
  b.push([x, 0, z], ry);
  const c = rng() > 0.5 ? COL.trailer : COL.trailer2;
  b.add('box', c, [0, 0.6, 0], [2.2, 2.4, 5]);
  b.add('box', COL.greyDk, [0, 0.4, 0], [2.3, 0.25, 5.1]);
  b.add('box', COL.glass, [1.11, 2.1, 0.8], [0.04, 0.5, 2.4]);
  b.add('box', COL.seatRed, [1.12, 1.2, 0], [0.04, 0.2, 4.6]);
  b.add('wheel', COL.greyDk, [0, 0.4, 0.6], [2.4, 0.45, 0.45]);
  b.add('box', COL.greyDk, [0, 0.4, 3.0], [0.2, 0.2, 1.4]);
  b.pop();
}
function bLightTower(b, x, z, fx) {
  b.push([x, 0, z]);
  b.add('box', COL.concrete, [0, 0, 0], [1.4, 0.4, 1.4]);
  for (const [px, pz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) b.add('box', COL.metal, [px, 0.4, pz], [0.1, 15, 0.1]);
  for (let y = 2; y < 15; y += 2.4) b.add('box', COL.metal, [0, y, 0], [0.8, 0.08, 0.8]);
  b.add('box', COL.greyDk, [0, 15.2, 0], [0.5, 2.0, 3.6]);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) b.add('quad', COL.lamp, [-fx * 0.26, 15.6 + r * 0.9, -1.1 + c * 1.1], [0.8, 0.7, 1], -fx * Math.PI / 2, 'glow');
  b.pop();
}
function bBillboard(b, x, z, fx, c) {
  b.push([x, 0, z]);
  b.add('box', COL.greyDk, [0, 0, -2], [0.25, 3, 0.25]);
  b.add('box', COL.greyDk, [0, 0, 2], [0.25, 3, 0.25]);
  b.add('box', COL.white, [0, 3, 0], [0.3, 2.6, 6]);
  b.add('box', c, [-fx * 0.16, 3.15, 0], [0.04, 2.3, 5.7]);
  b.add('box', COL.white, [-fx * 0.19, 4.1, -0.6], [0.04, 0.4, 3.4]);
  b.add('box', COL.white, [-fx * 0.19, 3.5, -1.0], [0.04, 0.25, 2.4]);
  b.pop();
}
function bBarn(b, x, z, ry) {
  b.push([x, 0, z], ry);
  b.add('box', COL.barn, [0, 0, 0], [7, 5.2, 9]);
  b.add('prism', COL.barnRoof, [0, 5.2, 0], [7.6, 3.0, 9.4]);
  b.add('box', '#1a0202', [0, 0, 4.52], [2.2, 3.1, 0.1]);
  b.add('box', COL.white, [0, 3.2, 4.53], [2.4, 0.15, 0.1]);
  b.add('cyl12', COL.silo, [5, 0, -1.5], [1.3, 8.5, 1.3]);
  b.add('dome', '#9a9282', [5, 8.5, -1.5], [1.32, 1.1, 1.32]);
  b.pop();
}
function bHay(b, x, z) {
  for (const [bx, by] of [[-0.9, 0.45], [0, 0.45], [0.9, 0.45], [-0.45, 1.33], [0.45, 1.33]]) b.add('wheel', COL.hay, [x, by, z + bx], [0.88, 0.44, 0.44], [0, Math.PI / 2, 0]);
}
function bFlowerBed(b, x, z, len, rng) {
  b.add('box', COL.woodDk, [x, 0, z], [1.8, 0.3, len]);
  b.add('box', COL.soil, [x, 0.3, z], [1.6, 0.04, len - 0.2]);
  const n = Math.floor(len / 0.9);
  for (let i = 0; i < n; i++) for (const dx of [i % 2 ? -0.35 : 0.35]) {
    b.add('box', COL.flowers[Math.floor(rng() * 5)], [x + dx + (rng() - 0.5) * 0.2, 0.34, z - len / 2 + 0.5 + i * 0.9], [0.32, 0.26 + rng() * 0.12, 0.32], rng());
  }
}
function bHedge(b, x, z, len) {
  b.add('box', COL.hedge, [x, 0, z], [1.2, 1.2, len]);
  b.add('box', COL.hedge2, [x, 1.2, z], [1.0, 0.25, len - 0.2]);
}

function buildSegment(bS, bD, seg, anim) {
  const theme = seg % 4;
  for (const side of [-1, 1]) {
    const rng = mulberry(seg * 4373 + (side + 2) * 59);
    const X = (d) => side * (ROAD_HALF + d);
    const fx = side; // dışa doğru
    let b = bD;
    // bariyer (kırmızı/beyaz bloklar) — sürekli
    for (let i = 0; i < 30; i++) b.add('box', i % 2 ? COL.barW : COL.barR, [X(2), 0, -118 + i * 4], [0.4, 0.9, 4.0]);
    // beyaz çit: direkler + 3 ray
    for (let i = 0; i < 15; i++) b.add('box', COL.white, [X(3.5), 0, -119 + i * 8], [0.12, 1.5, 0.12]);
    for (const y of [0.5, 1.0, 1.42]) b.add('box', COL.white, [X(3.5), y, -60], [0.06, 0.08, 120.4]);
    // sponsor panoları (kesintisiz)
    for (let i = 0; i < 20; i++) {
      const z = -117 + i * 6;
      b.add('box', COL.ads[(i + seg + (side > 0 ? 3 : 0)) % 6], [X(4.3), 0, z], [0.15, 1.0, 5.9]);
      b.add('quad', COL.white, [X(4.3) - side * 0.08, 0.5, z], [3.2 - (i % 3) * 0.6, 0.24, 1], -side * Math.PI / 2);
    }
    // bayrak süsü: direkler + üçgen flamalar
    for (let p = 0; p < 10; p++) {
      const z0 = -118 + p * 12;
      b.add('cyl6', COL.white, [X(5), 0, z0], [0.07, 4.2, 0.07]);
      for (let k = 1; k < 8; k++) {
        const t = k / 8, sag = Math.sin(t * Math.PI) * 0.7;
        b.add('cone4', COL.bunt[(k + p) % 5], [X(5), 3.95 - sag - 0.5, z0 + t * 12], [0.05, 0.5, 0.45], [Math.PI, 0, 0]);
      }
    }
    // biçilmiş çim şeritleri
    for (let i = 0; i < 6; i++) b.add('box', i % 2 ? COL.grass2 : COL.grass3, [X(30), -0.04, -110 + i * 20], [44, 0.05, 10]);
    // YAKIN (6-9 m): çit/çiçek tarhı/variller dönüşümlü
    for (let i = 0; i < 6; i++) {
      const z = -110 + i * 20 + rng() * 4;
      if ((i + theme) % 2) bFlowerBed(b, X(6.5), z, 8, rng); else bHedge(b, X(6.5), z, 10);
    }
    b = bS;
    // ORTA: tribün (her iki yanda; tema ile kapalı/açık), kulüp binası veya çadır sırası
    const L = 40;
    const standZ = side < 0 ? -30 - (theme % 2) * 10 : -80 + (theme % 2) * 10;
    bStand(b, X(11), standZ, L, fx, (theme + (side > 0 ? 1 : 0)) % 2 === 0, rng, anim.crowd);
    anim.flags.push([X(11 + 5.5), 9.8, standZ - L / 2 + 2], [X(11 + 5.5), 9.8, standZ + L / 2 - 2]);
    // tribünün boş kalan tarafı
    const otherZ = standZ < -60 ? -25 : -95;
    const k = (theme + (side > 0 ? 2 : 0)) % 4;
    if (k === 0) { bClubhouse(b, X(19), otherZ, fx, rng); anim.flags.push([X(19), 14.6, otherZ]); }
    else if (k === 1) { bTent(b, X(14), otherZ - 8, true, COL.tentRed); bTent(b, X(14), otherZ + 8, false, COL.tentBlue); bTent(b, X(21), otherZ, false, COL.tentRed); }
    else if (k === 2) { for (let t = 0; t < 4; t++) bTrailer(b, X(14 + (t % 2) * 4), otherZ - 12 + t * 6, 0.1 * t, rng); }
    else { bBarn(b, X(20), otherZ, side < 0 ? Math.PI / 2 : -Math.PI / 2); bHay(b, X(13), otherZ - 9); bHay(b, X(13), otherZ + 10); }
    // ışık kuleleri + reklam panosu
    bLightTower(b, X(9), standZ - L / 2 - 6, fx);
    bLightTower(b, X(9), otherZ + (otherZ < -60 ? 22 : -22), fx);
    bBillboard(b, X(9.5), standZ + L / 2 + 6, fx, COL.ads[(seg + side + 6) % 6]);
    // arkadaki ağaç sırası (tribün arkası boş kalmasın)
    for (let i = 0; i < 9; i++) bTree(b, X(27 + rng() * 10), -118 + i * 13.5 + rng() * 5, 1.1 + rng() * 0.6, rng);
  }
  for (const [x, y, z] of anim.flags) bS.add('cyl6', COL.white, [x, 0, z], [0.08, y + 0.15, 0.08]);
  // başlangıç kapısı (her iki segmentte bir)
  if (theme % 2 === 0) {
    const b = bS, z = -60;
    for (const sx of [-1, 1]) { b.add('box', COL.grey, [sx * 12, 0, z], [1.0, 11, 2.4]); }
    b.add('box', COL.white, [0, 10.0, z], [25, 2.2, 2.6]);
    for (let i = 0; i < 20; i++) for (let r = 0; r < 2; r++) b.add('box', (i + r) % 2 ? '#111111' : '#f4f4f4', [-9.5 + i, 10.3 + r * 0.8, z + 1.32], [1, 0.8, 0.05]);
  }
}

// Uzak katman: ağaçlı tepeler, tarlalar, çiftlik — gölgesiz
function buildFar(b, seg) {
  for (const side of [-1, 1]) {
    const rng = mulberry(seg * 7717 + side * 13);
    const X = (d) => side * (ROAD_HALF + d);
    for (let i = 0; i < 4; i++) b.add('box', [COL.grass2, COL.hay, COL.grass3, '#8aa040'][Math.floor(rng() * 4)], [X(60 + rng() * 30), -0.03, -110 + i * 30], [30 + rng() * 10, 0.05, 26]);
    for (let i = 0; i < 3; i++) {
      const hx = X(80 + rng() * 60), hz = -120 + i * 40 + rng() * 20, r = 24 + rng() * 20;
      b.add('blob', [COL.hill, COL.hill2, COL.hill3][i % 3], [hx, -r * 0.35, hz], [r, r * 0.6, r * 0.8], [0, rng() * 3, 0]);
      for (let t = 0; t < 4; t++) bTree(b, hx + (rng() - 0.5) * r, hz + (rng() - 0.5) * r * 0.8, 2 + rng(), rng);
    }
    for (let i = 0; i < 6; i++) bTree(b, X(42 + rng() * 18), -120 + rng() * 120, 1.3 + rng() * 0.8, rng);
    if (rng() > 0.4) bBarn(b, X(70 + rng() * 20), -60 + rng() * 40, rng() * 6);
  }
}

// ── Hareketli gövdeler ─────────────────────────────────────────────────────
const bodyGeo = bakeGeo((b) => { b.add('box', '#ffffff', [0, 0, 0], [0.42, 0.62, 0.3]); });
const headGeo = bakeGeo((b) => { b.add('box', '#e8b890', [0, 0.62, 0], [0.24, 0.27, 0.24]); });
const flagGeo = bakeGeo((b) => { for (let i = 0; i < 3; i++) b.add('box', ['#d02c2c', '#ffffff', '#2c6ee8'][i], [0.9, -0.3 * i, 0], [1.8, 0.3, 0.03]); });
const birdGeo = bakeGeo((b) => {
  b.add('box', '#2a2a30', [0.45, 0, 0], [0.9, 0.04, 0.3], [0, 0, 0.35]);
  b.add('box', '#2a2a30', [-0.45, 0, 0], [0.9, 0.04, 0.3], [0, 0, -0.35]);
  b.add('box', '#2a2a30', [0, 0, 0], [0.18, 0.12, 0.6]);
});
const SHIRTS = ['#e04040', '#3070e0', '#f0c020', '#30a050', '#ffffff', '#ff8030', '#a050d0', '#40c0d0', '#f070a0', '#202830'].map((c) => new THREE.Color(c));
const _c = new THREE.Color();

// Seyirci zıplaması GPU'da: örnek matrisleri statik kalır (kare başı yükleme
// yok); faz örneğin konumundan türetilir, zaman tek bir uniform.
const crowdTime = { value: 0 };
function makeCrowdMat() {
  const m = BATCH_MAT.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCrowdT = crowdTime;
    sh.vertexShader = 'uniform float uCrowdT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = instanceMatrix[3].xyz;
  float ph = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float w = ph > 0.75 ? 9.0 : 3.5 + ph * 4.0;
  transformed.y += max(0.0, sin(uCrowdT * w + ph * 40.0)) * 0.22;
#endif`);
  };
  m.customProgramCacheKey = () => 'crowd-bob';
  return m;
}
const crowdMat = makeCrowdMat();

function Crowd({ crowd }) {
  const n = crowd.length;
  const colors = useMemo(() => crowd.map((c) => SHIRTS[Math.floor(c[3] * 997) % SHIRTS.length]), [crowd]);
  const init = (i, o) => { const [x, y, z] = crowd[i]; o.position.set(x, y, z); };
  if (!n) return null;
  return (<>
    <Anim geo={bodyGeo} mat={crowdMat} count={n} init={init} colors={colors} margin={3} lod={170} />
    <Anim geo={headGeo} mat={crowdMat} count={n} init={init} margin={3} lod={170} />
  </>);
}

function SegmentContent({ seg }) {
  const { geos, detail, far, anim } = useMemo(() => {
    const anim = { crowd: [], flags: [] };
    const bS = makeBatch(), bD = makeBatch(), bF = makeBatch();
    buildSegment(bS, bD, seg, anim); buildFar(bF, seg);
    return { geos: bS.build(), detail: bD.build(), far: bF.build(), anim };
  }, [seg]);
  const { flags } = anim;
  return (<>
    <Baked geos={geos} shadow lod={400} />
    <Baked geos={detail} shadow lod={180} />
    <Baked geos={far} />
    <Crowd crowd={anim.crowd} />
    <Anim geo={flagGeo} count={flags.length} lod={300}
      init={(i, o) => { const [x, y, z] = flags[i]; o.position.set(x, y, z); o.userData.p = i * 1.9; }}
      update={(i, t, o) => { const p = o.userData.p; o.rotation.y = Math.sin(t * 2.5 + p) * 0.5; o.scale.x = 0.85 + Math.sin(t * 6 + p) * 0.15; }} />
  </>);
}

function Birds() {
  const N = 12;
  return (<Anim geo={birdGeo} count={N} margin={80}
    init={(i, o) => { o.userData = { r: 30 + (i % 4) * 8, h: 24 + (i % 3) * 4, p: i * 0.5, cx: i < 6 ? -40 : 45, cz: -120 - (i % 2) * 30 }; }}
    update={(i, t, o) => {
      const u = o.userData, a = t * 0.25 + u.p;
      o.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 2 + i) * 0.6, u.cz + Math.sin(a) * u.r);
      o.rotation.set(0, -a, Math.sin(t * 8 + i) * 0.5);
    }} />);
}

// ── Sky ───────────────────────────────────────────────────────────────────────
function NightStars() {
  const positions = (() => {
    const arr = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 350 + Math.random() * 100;
      arr[i * 3]     = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.random() * 220 + 30;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  })();
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.9} sizeAttenuation />
    </points>
  );
}

function Sky() {
  const night = false; // gece modu kaldırıldı
  const clouds = [
    [-95,38,-200,1.3],[55,44,-240,1.0],[-20,42,-310,1.5],
    [120,37,-180,1.1],[-170,50,-260,1.2],[30,46,-160,0.9],
  ];
  return (
    <>
      <mesh><sphereGeometry args={[500,16,12]} /><primitive object={night ? M.skyTopN : M.skyTop} attach="material" /></mesh>
      <mesh position={[0,-30,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={night ? M.skyMidN : M.skyMid} attach="material" /></mesh>
      <mesh position={[0,-80,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={night ? M.skyHorizonN : M.skyHorizon} attach="material" /></mesh>
      <mesh position={[-90,75,-280]}><sphereGeometry args={[night ? 10 : 14,14,12]} /><primitive object={night ? M.moon : M.sunCore} attach="material" /></mesh>
      {night && <NightStars />}
      {clouds.map(([cx,cy,cz,cs],ci) => (
        <group key={ci} position={[cx,cy,cz]} scale={cs}>
          {[[0,0,0,8],[8,-1,0,6],[-7,-2,0,5.5],[2,2.5,0,5],[-3,2,1,4.5]].map(([px,py,pz,r],pi)=>(
            <mesh key={pi} position={[px,py,pz]}>
              <sphereGeometry args={[r,7,6]} />
              <primitive object={night ? M.cloudN : M.cloudW} attach="material" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Mountains() {
  const peaks = [
    [-200,-320,60,100],[-90,-340,50,115],[60,-310,55,105],
    [190,-300,48,90],[-280,-260,42,85],[150,-280,52,98],
  ];
  return (
    <>
      {peaks.map(([x,z,rx,ry],i) => (
        <group key={i} position={[x,0,z]}>
          <mesh><coneGeometry args={[rx,ry,6+(i%2)]} /><primitive object={i%2===0?M.mtnFar:M.mtnMid} attach="material" /></mesh>
          <mesh position={[0,ry*0.4,0]}><coneGeometry args={[rx*0.25,ry*0.26,6]} /><meshStandardMaterial color={MC.mtnSnow} /></mesh>
        </group>
      ))}
    </>
  );
}

// ── Wide ground always under the player ──────────────────────────────────────
function GroundPlane() {
  return (
    <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[0, -0.08, -280]}>
      <planeGeometry args={[400, 1200]} />
      <primitive object={M.grassLight} attach="material" />
    </mesh>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FarmEnvironment() {
  const grpRefs = useRef([]);
  const posRef  = useRef(Array.from({ length: SEG_COUNT }, (_, i) => 5 - i * SEG_LEN));
  const phase   = useGameStore((s) => s.phase);
  const runId   = useGameStore((s) => s.runId);

  useEffect(() => {
    posRef.current = Array.from({ length: SEG_COUNT }, (_, i) => 5 - i * SEG_LEN);
    posRef.current.forEach((z, i) => grpRefs.current[i]?.position.set(0, 0, z));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useFrame(({ clock }, delta) => {
    crowdTime.value = clock.elapsedTime;
    if (phase !== 'playing') return;
    const speed = useGameStore.getState().speed;
    posRef.current = posRef.current.map((z, i) => {
      const next     = z + speed * delta;
      const recycled = next > RECYCLE_AFTER ? next - SEG_COUNT * SEG_LEN : next;
      grpRefs.current[i]?.position.set(0, 0, recycled);
      return recycled;
    });
  });

  return (
    <>
      <Sky />
      <Mountains />
      <GroundPlane />
      <Birds />
      {posRef.current.map((z, i) => (
        <group key={i} ref={el => (grpRefs.current[i] = el)} position={[0, 0, z]}>
          <SegmentContent seg={i} />
        </group>
      ))}
    </>
  );
}
