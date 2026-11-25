import { useRef, useCallback, useEffect, useState, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { makeKinematicBody } from '@/utils/kinematicBody';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { upsertObstacle, setObstacleActive, clearRegistry } from '@/utils/obstacleRegistry';
import { LANES, OBSTACLE_SPAWN_Z as SPAWN_Z, OBSTACLE_RECYCLE_Z as RECYCLE_Z, OBSTACLE_MIN_GAP as MIN_GAP } from '@/constants/game';
import {
  G, P, mat, HazardTop, HAZARD, BANNER_RED, BANNER_CREAM, SHADOW_MAT,
  GLASS, TAIL, HEAD, TIRE,
} from './obstacleKit';

// ── Görsel dil (tüm haritalarda aynı) ─────────────────────────────────────────
//  JUMP  : alçak & geniş (≤ ~1.1 m), düz üst + krem tehlike şeridi
//  SLIDE : iki direk + kiriş kapısı, altında kırmızı/krem damalı afiş
//  LANE  : uzun (> 2.2 m) — ağaç, araç, kuyu… Yükseklik ipucudur.
// Görseller HITBOX ayak izine sığacak şekilde boyutlandırıldı (tersi değil).
// Kök grup y=0.15'te durur; yerel y=0 zemin seviyesi.

const BASE_TIMER = 2.0;
const POOL       = 18;

const PATTERNS = [
  [0, 1], [0, 2], [1, 2],
  [0], [2], [1],
  [0, 1, 2],
];

// IcosahedronGeometry(0.5,0)'ı bir YÜZÜ yukarı bakacak şekilde döndürür → düz üst
const ICO_FLAT = -0.3649;
// Tohumlu sözde-rastgele (spawn'dan bağımsız, modül seviyesinde sabit)
const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

// ── Çiftlik ───────────────────────────────────────────────────────────────────
const C_BARREL = mat('#8a5424', { e: 0.25 });
const C_BAND   = mat('#9aa0a8', { e: 0.15, metal: 0.7, rough: 0.4 });
function Barrel() {
  return (
    <group>
      <P g={G.cyl8} m={C_BARREL} p={[0, 0.5, 0]} s={[1.22, 1.0, 1.22]} />
      {[0.22, 0.78].map((y) => <P key={y} g={G.cyl8} m={C_BAND} p={[0, y, 0]} s={[1.28, 0.08, 1.28]} shadow={false} />)}
      <HazardTop y={1.0} w={1.0} />
    </group>
  );
}

const C_HAY   = mat('#dcb44a', { e: 0.22 });
const C_STRAW = mat('#f0d47a', { e: 0.3 });
const C_TWINE = mat('#8a6a3a', { e: 0.1 });
function HayBale() {
  return (
    <group>
      <P g={G.rbox} m={C_HAY} p={[0, 0.475, 0]} s={[1.34, 0.95, 1.34]} />
      {[-0.36, 0.36].map((x) => <P key={x} m={C_TWINE} p={[x, 0.475, 0]} s={[0.07, 0.97, 1.36]} shadow={false} />)}
      {[0.2, 0.38, 0.56, 0.74].map((y) => (
        <group key={y}>
          <P m={C_STRAW} p={[0, y, 0.675]} s={[1.18, 0.035, 0.02]} shadow={false} />
          <P m={C_STRAW} p={[0, y, -0.675]} s={[1.18, 0.035, 0.02]} shadow={false} />
        </group>
      ))}
      <HazardTop y={0.95} w={1.1} />
    </group>
  );
}

const C_LOG     = mat('#9a6a3a', { e: 0.22 });
const C_LOGEND  = mat('#d6b07a', { e: 0.25 });
const C_PLANK   = mat('#b88a52', { e: 0.22 });
const ROT_X = [0, 0, Math.PI / 2];
function LogPile() {
  const logs = [[0.26, -0.36], [0.26, 0], [0.26, 0.36], [0.71, -0.18], [0.71, 0.18]];
  return (
    <group>
      {logs.map(([y, z], i) => (
        <group key={i}>
          <P g={G.cyl8} m={C_LOG} p={[0, y, z]} s={[0.52, 1.4, 0.52]} r={ROT_X} />
          <P g={G.cyl8} m={C_LOGEND} p={[0.71, y, z]} s={[0.44, 0.03, 0.44]} r={ROT_X} shadow={false} />
          <P g={G.cyl8} m={C_LOGEND} p={[-0.71, y, z]} s={[0.44, 0.03, 0.44]} r={ROT_X} shadow={false} />
        </group>
      ))}
      <P m={C_PLANK} p={[0, 0.98, 0]} s={[1.36, 0.06, 0.8]} />
      <HazardTop y={1.01} w={1.1} />
    </group>
  );
}

// ── Şehir ─────────────────────────────────────────────────────────────────────
const C_BUMPER = mat('#2a2a30', { e: 0.08 });
const C_RIM    = mat('#c8ccd2', { e: 0.15, metal: 0.6, rough: 0.4 });
const ROT_Z90  = [0, 0, Math.PI / 2];
// Uzun kasalı minivan: şerit değiştirme engeli (≈2.3 m). Arka yüz (+z) ata bakar.
function Van({ body, lower = null, roof = null }) {
  const low = lower ?? body;
  return (
    <group>
      {[[-0.64, -0.82], [0.64, -0.82], [-0.64, 0.82], [0.64, 0.82]].map(([x, z]) => (
        <group key={x + ':' + z}>
          <P g={G.cyl12} m={TIRE} p={[x, 0.35, z]} s={[0.7, 0.2, 0.7]} r={ROT_Z90} />
          <P g={G.cyl12} m={C_RIM} p={[x * 1.04, 0.35, z]} s={[0.36, 0.2, 0.36]} r={ROT_Z90} shadow={false} />
        </group>
      ))}
      <P g={G.rbox} m={low} p={[0, 0.8, 0]} s={[1.5, 0.85, 2.5]} />
      <P g={G.rbox} m={body} p={[0, 1.7, -0.1]} s={[1.36, 0.95, 1.8]} />
      <P m={GLASS} p={[0, 1.78, -0.1]} s={[1.38, 0.5, 1.5]} shadow={false} />
      <P m={GLASS} p={[0, 1.78, -0.1]} s={[1.18, 0.5, 1.82]} shadow={false} />
      <P m={C_BUMPER} p={[0, 0.48, 1.22]} s={[1.52, 0.18, 0.1]} shadow={false} />
      <P m={C_BUMPER} p={[0, 0.48, -1.22]} s={[1.52, 0.18, 0.1]} shadow={false} />
      {[-0.55, 0.55].map((x) => (
        <group key={x}>
          <P m={TAIL} p={[x, 1.02, 1.25]} s={[0.3, 0.16, 0.03]} shadow={false} />
          <P m={HEAD} p={[x, 0.95, -1.25]} s={[0.28, 0.14, 0.03]} shadow={false} />
        </group>
      ))}
      <P m={roof ?? body} p={[0, 2.21, -0.1]} s={[1.1, 0.08, 1.4]} />
    </group>
  );
}
const C_CAR    = mat('#3a6ea8', { e: 0.22 });
const C_TAXI   = mat('#f2c12e', { e: 0.25 });
const C_POL    = mat('#eef0f4', { e: 0.2 });
const C_POLLOW = mat('#20242c', { e: 0.1 });
const C_SIREN_R = mat('#ff2a2a', { e: 1.4 });
const C_SIREN_B = mat('#2a6aff', { e: 1.4 });
function CityCar() { return <Van body={C_CAR} />; }
function CityTaxi() {
  return (
    <group>
      <Van body={C_TAXI} />
      <P m={BANNER_CREAM} p={[0, 2.37, -0.1]} s={[0.62, 0.24, 0.26]} />
      {[-0.2, 0.2].map((x) => <P key={x} m={C_POLLOW} p={[x, 2.37, 0.02]} s={[0.2, 0.12, 0.02]} shadow={false} />)}
    </group>
  );
}
function CityPolice() {
  return (
    <group>
      <Van body={C_POL} lower={C_POLLOW} />
      <P m={C_SIREN_R} p={[-0.28, 2.32, -0.1]} s={[0.5, 0.16, 0.3]} />
      <P m={C_SIREN_B} p={[0.28, 2.32, -0.1]} s={[0.5, 0.16, 0.3]} />
    </group>
  );
}
const C_DUMP    = mat('#2f7a4a', { e: 0.25 });
const C_DUMPLID = mat('#215a36', { e: 0.2 });
function CityDump() {
  return (
    <group>
      {[-0.55, 0.55].map((x) => <P key={x} g={G.cyl8} m={TIRE} p={[x, 0.08, 0.3]} s={[0.16, 0.12, 0.16]} r={ROT_Z90} shadow={false} />)}
      <P m={C_DUMP} p={[0, 0.52, 0]} s={[1.38, 0.8, 0.9]} />
      {[-0.4, 0, 0.4].map((x) => <P key={x} m={C_DUMPLID} p={[x, 0.52, 0.46]} s={[0.08, 0.7, 0.04]} shadow={false} />)}
      <P m={C_DUMPLID} p={[0, 0.96, 0]} s={[1.42, 0.08, 0.94]} />
      <HazardTop y={1.0} w={1.2} />
    </group>
  );
}

// ── Çöl ───────────────────────────────────────────────────────────────────────
const C_CACTUS = mat('#4f9a46', { e: 0.25 });
const C_FLOWER = mat('#ff6aa0', { e: 0.6 });
const C_SAND   = mat('#c9783e', { e: 0.25 });
function DesertCactusTall() {
  return (
    <group>
      <P g={G.cap} m={C_CACTUS} p={[0, 1.4, 0]} s={[0.56, 0.95, 0.56]} />
      {/* yan kollar (x) */}
      <P g={G.cap} m={C_CACTUS} p={[0.28, 1.25, 0]} s={[0.32, 0.22, 0.32]} r={ROT_Z90} />
      <P g={G.cap} m={C_CACTUS} p={[0.43, 1.6, 0]} s={[0.32, 0.38, 0.32]} />
      <P g={G.cap} m={C_CACTUS} p={[-0.27, 1.75, 0]} s={[0.28, 0.2, 0.28]} r={ROT_Z90} />
      <P g={G.cap} m={C_CACTUS} p={[-0.44, 2.05, 0]} s={[0.28, 0.32, 0.28]} />
      {/* ön kol (ata doğru, z) */}
      <P g={G.cap} m={C_CACTUS} p={[0, 0.95, 0.27]} s={[0.28, 0.2, 0.28]} r={[Math.PI / 2, 0, 0]} />
      <P g={G.cap} m={C_CACTUS} p={[0, 1.25, 0.4]} s={[0.26, 0.3, 0.26]} />
      <P g={G.sph} m={C_FLOWER} p={[0, 2.82, 0]} s={[0.22, 0.14, 0.22]} shadow={false} />
      <P g={G.ico} m={C_SAND} p={[0.2, 0.12, -0.3]} s={[0.6, 0.4, 0.5]} />
    </group>
  );
}
function DesertCactusShort() {
  return (
    <group>
      <P g={G.cap} m={C_CACTUS} p={[0, 0.45, 0]} s={[1.0, 0.45, 0.9]} />
      <P g={G.sph} m={C_FLOWER} p={[0, 0.92, 0]} s={[0.2, 0.1, 0.2]} shadow={false} />
      <HazardTop y={0.85} w={0.5} />
    </group>
  );
}

// Kaya + düz levha: iki-üç kaya üstüne yatırılmış düz taş levha (zıplama engeli)
function RockSlab({ hx, hz, rock, slab, seed, top = 1.0 }) {
  const rnd = seeded(seed);
  const n = 2 + (seed % 2);
  const rocks = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    // ico yarıçapı 0.5 → döndürülse de yarı-genişlik ≤ 0.5·ölçek
    const sx = hx * 0.9 * (0.9 + rnd() * 0.1);
    const sy = (top - 0.12) * (0.9 + rnd() * 0.1);
    const sz = hz * 1.95 * (0.9 + rnd() * 0.1);
    rocks.push({ x: (t - 0.5) * hx * 1.05, sx, sy, sz, ry: rnd() * Math.PI });
  }
  return (
    <group>
      {rocks.map((r, i) => (
        <group key={i} position={[r.x, (top - 0.12) * 0.5, 0]} scale={[r.sx, r.sy, r.sz]}>
          <P g={G.ico} m={rock} r={[ICO_FLAT, r.ry, 0]} />
        </group>
      ))}
      <P m={slab} p={[0, top - 0.07, 0]} s={[hx * 1.9, 0.14, hz * 1.8]} r={[0, 0, (rnd() - 0.5) * 0.04]} />
      <HazardTop y={top} w={hx * 1.5} />
    </group>
  );
}
const C_DROCK = mat('#b8683a', { e: 0.28 });
const C_DSLAB = mat('#e0a466', { e: 0.3 });
function DesertRockA() { return <RockSlab hx={1.12} hz={0.9} rock={C_DROCK} slab={C_DSLAB} seed={11} top={0.95} />; }
function DesertRockB() { return <RockSlab hx={1.12} hz={0.9} rock={C_DROCK} slab={C_DSLAB} seed={24} top={1.0} />; }
function DesertRockC() { return <RockSlab hx={1.12} hz={0.9} rock={mat('#a85a34', { e: 0.28 })} slab={C_DSLAB} seed={37} top={0.9} />; }

// ── Uzay ──────────────────────────────────────────────────────────────────────
const C_CAN    = mat('#d8dde6', { e: 0.25, metal: 0.5, rough: 0.35 });
const C_CYAN   = mat('#4fe0ff', { e: 1.3 });
const C_FRAME  = mat('#5a6070', { e: 0.15, metal: 0.6, rough: 0.4 });
const ROT_X90  = [Math.PI / 2, 0, 0];
function SpaceBarrels() {
  return (
    <group>
      {[-0.56, 0, 0.56].map((x) => (
        <group key={x}>
          <P g={G.cyl12} m={C_CAN} p={[x, 0.38, 0]} s={[0.74, 1.7, 0.74]} r={ROT_X90} />
          {[-0.5, 0.5].map((z) => <P key={z} g={G.cyl12} m={C_CYAN} p={[x, 0.38, z]} s={[0.78, 0.08, 0.78]} r={ROT_X90} shadow={false} />)}
        </group>
      ))}
      <P m={C_FRAME} p={[0, 0.8, 0]} s={[1.86, 0.07, 1.5]} />
      <HazardTop y={0.835} w={1.5} />
    </group>
  );
}
const C_ROVER = mat('#e8e8ee', { e: 0.25, metal: 0.3 });
const C_BEACON = mat('#ff3040', { e: 2.0 });
function SpaceRover() {
  return (
    <group>
      {[[-0.34, -0.3], [0.34, -0.3], [-0.34, 0.3], [0.34, 0.3]].map(([x, z]) => (
        <P key={x + ':' + z} g={G.cyl8} m={TIRE} p={[x, 0.14, z]} s={[0.28, 0.12, 0.28]} r={ROT_Z90} />
      ))}
      <P m={C_ROVER} p={[0, 0.38, 0]} s={[0.6, 0.3, 0.9]} />
      <P m={C_FRAME} p={[0, 0.56, 0]} s={[0.8, 0.04, 0.6]} />
      <P g={G.cyl8} m={C_FRAME} p={[0, 1.55, 0]} s={[0.1, 2.0, 0.1]} />
      <P g={G.cone8} m={C_ROVER} p={[0, 2.25, 0.05]} s={[0.74, 0.22, 0.74]} r={[-0.5, 0, 0]} />
      {[1.0, 1.6].map((y) => <P key={y} g={G.cyl8} m={C_CYAN} p={[0, y, 0]} s={[0.16, 0.05, 0.16]} shadow={false} />)}
      <P g={G.sph} m={C_BEACON} p={[0, 2.66, 0]} s={[0.2, 0.2, 0.2]} shadow={false} />
    </group>
  );
}
const C_MET   = mat('#5a5560', { e: 0.18 });
const C_LAVA  = mat('#ff6a1e', { e: 1.6 });
function Meteor({ hx, hz, top, lava = C_LAVA, rock = C_MET }) {
  // Yüzü yukarı ikosahedron: üst yüz DÜZ; yarısı toprağa gömülü
  const sx = hx / 0.425 * 0.88, sz = hz / 0.425 * 0.84;
  const sy = top / 0.62;
  return (
    <group>
      <group position={[0, top - sy * 0.401, 0]} scale={[sx, sy, sz]}>
        <P g={G.ico} m={rock} r={[ICO_FLAT, 0, 0]} />
        <P g={G.ico} m={lava} r={[ICO_FLAT, 0.6, 0]} s={[0.94, 0.94, 0.94]} shadow={false} />
      </group>
      <HazardTop y={top} w={hx * 0.55} d={0.18} />
    </group>
  );
}
function SpaceMeteor()    { return <Meteor hx={1.2} hz={1.0} top={1.0} />; }
function SpaceMeteorDet() { return <Meteor hx={1.1} hz={0.95} top={0.95} lava={mat('#b04aff', { e: 1.5 })} rock={mat('#4a4658', { e: 0.18 })} />; }
function SpacePlatLow() {
  return (
    <group>
      {[[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]].map(([x, z]) => (
        <P key={x + ':' + z} m={C_FRAME} p={[x, 0.33, z]} s={[0.16, 0.66, 0.16]} />
      ))}
      <P m={C_CAN} p={[0, 0.75, 0]} s={[2.7, 0.18, 1.72]} />
      {[-0.84, 0.84].map((z) => <P key={z} m={C_CYAN} p={[0, 0.7, z]} s={[2.6, 0.05, 0.04]} shadow={false} />)}
      <HazardTop y={0.84} w={2.2} />
    </group>
  );
}
function Crystals({ col }) {
  const m = mat(col, { e: 0.7, rough: 0.3 });
  return (
    <group>
      <P g={G.ico} m={C_MET} p={[0, 0.2, 0]} s={[2.6, 0.9, 2.2]} r={[ICO_FLAT, 0, 0]} />
      <P g={G.oct} m={m} p={[0, 1.45, 0]} s={[1.0, 2.9, 1.0]} />
      <P g={G.oct} m={m} p={[0.72, 1.0, 0.1]} s={[0.7, 2.0, 0.7]} r={[0, 0, -0.3]} />
      <P g={G.oct} m={m} p={[-0.7, 0.9, -0.1]} s={[0.66, 1.8, 0.66]} r={[0, 0, 0.32]} />
      <P g={G.oct} m={m} p={[0.1, 0.75, 0.6]} s={[0.55, 1.4, 0.55]} r={[0.35, 0, 0]} />
    </group>
  );
}
function SpaceRockA() { return <Crystals col="#a060ff" />; }
function SpaceRockB() { return <Crystals col="#40d8ff" />; }

// ── Ortaçağ ───────────────────────────────────────────────────────────────────
const C_STONE  = mat('#9a948a', { e: 0.22 });
const C_STONED = mat('#7a746c', { e: 0.18 });
const C_WOOD   = mat('#7a5232', { e: 0.2 });
const C_ROOF   = mat('#a8452e', { e: 0.25 });
const C_WATER  = mat('#2a5a8a', { e: 0.5 });
function MedWell() {
  return (
    <group>
      <P g={G.cyl8} m={C_STONE} p={[0, 0.45, 0]} s={[1.9, 0.9, 1.8]} />
      <P g={G.cyl8} m={C_STONED} p={[0, 0.94, 0]} s={[2.0, 0.12, 1.88]} />
      <P g={G.cyl8} m={C_WATER} p={[0, 0.86, 0]} s={[1.6, 0.04, 1.5]} shadow={false} />
      {[-0.8, 0.8].map((x) => <P key={x} m={C_WOOD} p={[x, 1.65, 0]} s={[0.15, 1.5, 0.15]} />)}
      <P g={G.cyl8} m={C_WOOD} p={[0, 2.05, 0]} s={[0.12, 1.6, 0.12]} r={ROT_Z90} />
      <P g={G.cyl8} m={C_WOOD} p={[0, 1.6, 0]} s={[0.3, 0.3, 0.3]} />
      <P g={G.cone4} m={C_ROOF} p={[0, 2.78, 0]} s={[2.75, 0.8, 2.55]} r={[0, Math.PI / 4, 0]} />
    </group>
  );
}
const C_MROCK = mat('#8a8680', { e: 0.22 });
const C_MSLAB = mat('#b4aea4', { e: 0.25 });
function MedRocks()   { return <RockSlab hx={1.22} hz={1.0} rock={C_MROCK} slab={C_MSLAB} seed={52} top={1.0} />; }
function MedRocksSm() { return <RockSlab hx={0.83} hz={0.76} rock={C_MROCK} slab={C_MSLAB} seed={64} top={0.85} />; }
const C_TRUNK  = mat('#6a4428', { e: 0.18 });
const C_LEAF   = mat('#4a9a3c', { e: 0.25 });
const C_LEAF2  = mat('#3a8434', { e: 0.25 });
function MedTreeA() {
  return (
    <group>
      <P g={G.cyl8} m={C_TRUNK} p={[0, 0.9, 0]} s={[0.42, 1.8, 0.42]} />
      <P g={G.ico} m={C_LEAF} p={[0, 2.2, 0]} s={[1.8, 1.5, 1.4]} />
      <P g={G.ico} m={C_LEAF2} p={[0.1, 2.95, 0]} s={[1.3, 1.1, 1.05]} r={[0, 0.7, 0]} />
    </group>
  );
}
function MedTreeB() {
  return (
    <group>
      <P g={G.cyl8} m={C_TRUNK} p={[0, 0.6, 0]} s={[0.36, 1.2, 0.36]} />
      <P g={G.cone8} m={C_LEAF2} p={[0, 1.55, 0]} s={[1.48, 1.3, 1.14]} />
      <P g={G.cone8} m={C_LEAF2} p={[0, 2.3, 0]} s={[1.18, 1.1, 0.92]} />
      <P g={G.cone8} m={C_LEAF2} p={[0, 2.95, 0]} s={[0.84, 0.9, 0.66]} />
    </group>
  );
}
const C_CABBAGE = mat('#7ac050', { e: 0.3 });
function MedFarm() {
  return (
    <group>
      {[-0.95, 0.95].map((z) => (
        <group key={z}>
          {[-1.25, 0, 1.25].map((x) => <P key={x} m={C_WOOD} p={[x, 0.5, z]} s={[0.16, 1.0, 0.16]} />)}
          <P m={C_WOOD} p={[0, 0.45, z]} s={[2.6, 0.1, 0.08]} />
          <P m={C_PLANK} p={[0, 0.97, z]} s={[2.66, 0.06, 0.2]} />
          <HazardTop y={1.0} w={2.2} d={0.12} z={z} />
        </group>
      ))}
      {[-1.25, 1.25].map((x) => <P key={x} m={C_WOOD} p={[x, 0.45, 0]} s={[0.08, 0.1, 1.9]} />)}
      {[-0.7, 0, 0.7].map((x) => [-0.4, 0.4].map((z) => (
        <P key={x + ':' + z} g={G.ico} m={C_CABBAGE} p={[x, 0.2, z]} s={[0.45, 0.4, 0.45]} />
      )))}
    </group>
  );
}

// ── Zindan ────────────────────────────────────────────────────────────────────
const C_CRATE = mat('#9a6634', { e: 0.25 });
const C_TRIM  = mat('#5a3a1c', { e: 0.15 });
const C_IRON  = mat('#7a7e88', { e: 0.2, metal: 0.6, rough: 0.4 });
const C_GOLD  = mat('#ffc23a', { e: 0.7, metal: 0.5, rough: 0.3 });
function DunCrate() {
  const W = 1.9, H = 0.95, D = 1.8;
  return (
    <group>
      <P m={C_CRATE} p={[0, H / 2, 0]} s={[W, H, D]} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <P key={sx + ':' + sz} m={C_TRIM} p={[sx * (W / 2 - 0.04), H / 2, sz * (D / 2 - 0.04)]} s={[0.1, H + 0.02, 0.1]} shadow={false} />
      ))}
      {[0.05, H - 0.05].map((y) => (
        <group key={y}>
          <P m={C_TRIM} p={[0, y, D / 2]} s={[W + 0.02, 0.1, 0.06]} shadow={false} />
          <P m={C_TRIM} p={[0, y, -D / 2]} s={[W + 0.02, 0.1, 0.06]} shadow={false} />
          <P m={C_TRIM} p={[W / 2, y, 0]} s={[0.06, 0.1, D + 0.02]} shadow={false} />
          <P m={C_TRIM} p={[-W / 2, y, 0]} s={[0.06, 0.1, D + 0.02]} shadow={false} />
        </group>
      ))}
      <P m={C_TRIM} p={[0, H / 2, D / 2 + 0.01]} s={[2.0, 0.1, 0.04]} r={[0, 0, Math.atan2(H, W)]} shadow={false} />
      <HazardTop y={H} w={1.5} />
    </group>
  );
}
const C_DBARREL = mat('#7a4a22', { e: 0.25 });
function DunBarrel() {
  return (
    <group>
      {[-0.43, 0.43].map((x) => (
        <group key={x}>
          <P g={G.cyl8} m={C_DBARREL} p={[x, 0.44, 0]} s={[0.86, 1.66, 0.86]} r={ROT_X90} />
          {[-0.5, 0.5].map((z) => <P key={z} g={G.cyl8} m={C_IRON} p={[x, 0.44, z]} s={[0.9, 0.07, 0.9]} r={ROT_X90} shadow={false} />)}
        </group>
      ))}
      <P m={C_TRIM} p={[0, 0.9, 0]} s={[1.6, 0.06, 0.7]} />
      <HazardTop y={0.93} w={1.3} />
    </group>
  );
}
const C_CHEST = mat('#8a3a2a', { e: 0.25 });
function DunChest() {
  return (
    <group>
      <P m={C_CHEST} p={[0, 0.36, 0]} s={[2.2, 0.72, 1.7]} />
      <P m={C_CHEST} p={[0, 0.86, 0]} s={[2.24, 0.28, 1.74]} />
      {[-0.7, 0.7].map((x) => <P key={x} m={C_GOLD} p={[x, 0.5, 0]} s={[0.1, 1.02, 1.76]} shadow={false} />)}
      <P m={C_GOLD} p={[0, 0.72, 0.88]} s={[0.24, 0.3, 0.06]} shadow={false} />
      <HazardTop y={1.0} w={1.6} />
    </group>
  );
}
const C_SPIKEBASE = mat('#9a4a30', { e: 0.25 });
function DunSpikes() {
  const cones = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) cones.push([-1.0 + i * 0.5, -0.66 + j * 0.44]);
  return (
    <group>
      <P m={C_SPIKEBASE} p={[0, 0.07, 0]} s={[2.6, 0.14, 2.0]} />
      {cones.map(([x, z]) => <P key={x + ':' + z} g={G.cone6} m={C_IRON} p={[x, 0.44, z]} s={[0.3, 0.6, 0.3]} />)}
      {[-0.94, 0.94].map((z) => <P key={z} m={HAZARD} p={[0, 0.15, z]} s={[2.6, 0.03, 0.1]} shadow={false} />)}
    </group>
  );
}
const C_BRICK  = mat('#b4633f', { e: 0.25 });
const C_BRICK2 = mat('#9a5034', { e: 0.22 });
const C_FLAME  = mat('#ffa030', { e: 2.0 });
function DunBricks() {
  return (
    <group>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <P key={i} m={i % 2 ? C_BRICK2 : C_BRICK} p={[i % 2 ? 0.02 : -0.02, 0.22 + i * 0.44, 0]} s={[1.4, 0.42, 1.32]} />
      ))}
      <P m={C_STONED} p={[0, 2.75, 0]} s={[1.48, 0.2, 1.4]} />
      <P g={G.cyl8} m={C_TRIM} p={[0, 1.8, 0.62]} s={[0.1, 0.4, 0.1]} shadow={false} />
      <P g={G.cone6} m={C_FLAME} p={[0, 2.12, 0.62]} s={[0.16, 0.3, 0.16]} shadow={false} />
    </group>
  );
}
function DunTable() {
  // Demir mangal ayağı (uzun, ince) — şerit değiştirme engeli
  return (
    <group>
      <P g={G.cyl8} m={C_IRON} p={[0, 0.08, 0]} s={[1.0, 0.16, 1.0]} />
      <P g={G.cyl8} m={C_IRON} p={[0, 1.2, 0]} s={[0.14, 2.2, 0.14]} />
      <P g={G.cone8} m={C_IRON} p={[0, 2.4, 0]} s={[0.96, 0.4, 0.96]} r={[Math.PI, 0, 0]} />
      <P g={G.cone6} m={C_FLAME} p={[0, 2.85, 0]} s={[0.5, 0.6, 0.5]} shadow={false} />
    </group>
  );
}

// ── Üstten geçen engel (EĞİLEREK altından geçilir) ────────────────────────────
// İki direk + kiriş; kirişin altında kırmızı/krem damalı afiş (alt kenar 1.68 m),
// direk tepelerinde sallanan iki flama, şeritte koyu zemin gölgesi.
const PENNANT_MAT = new THREE.MeshStandardMaterial({ color: '#c0392b', emissive: '#c0392b', emissiveIntensity: 0.4, side: THREE.DoubleSide });
const BANNER_COLS = 7, CELL_W = 0.4, CELL_H = 0.38;
const BANNER_CELLS = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < BANNER_COLS; c++) {
  BANNER_CELLS.push({ x: (c - (BANNER_COLS - 1) / 2) * CELL_W, y: 2.45 - CELL_H / 2 - r * CELL_H, red: (r + c) % 2 === 0 });
}
function OverheadGate({ post, beam, glow = null }) {
  const pm = mat(post, { e: 0.18 });
  const bm = glow ? mat(beam, { e: 1.0, emissive: glow, rough: 0.4 }) : mat(beam, { e: 0.25 });
  const pen = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < 2; i++) { const p = pen.current[i]; if (p) p.rotation.y = Math.sin(t * 3 + i * 1.7) * 0.45 + (i ? Math.PI : 0); }
  });
  return (
    <group>
      <mesh geometry={G.plane} material={SHADOW_MAT} position={[0, 0.02, 0]} scale={[3.1, 1, 0.88]} renderOrder={1} userData={{ noBBox: true }} />
      {[-1.5, 1.5].map((x, i) => (
        <group key={x}>
          <P m={pm} p={[x, 0.12, 0]} s={[0.46, 0.24, 0.8]} />
          <P m={pm} p={[x, 1.42, 0]} s={[0.24, 2.84, 0.24]} />
          <P g={G.cyl8} m={pm} p={[x, 3.06, 0]} s={[0.05, 0.44, 0.05]} shadow={false} />
          <mesh ref={(el) => (pen.current[i] = el)} geometry={G.pennant} material={PENNANT_MAT} position={[x, 3.27, 0]} />
        </group>
      ))}
      <P m={bm} p={[0, 2.6, 0]} s={[3.24, 0.3, 0.34]} />
      {BANNER_CELLS.map((c, i) => (
        <P key={i} m={c.red ? BANNER_RED : BANNER_CREAM} p={[c.x, c.y, 0]} s={[CELL_W, CELL_H, 0.04]} shadow={false} />
      ))}
    </group>
  );
}
function OverheadFarm()     { return <OverheadGate post="#7a5a34" beam="#a5825a" />; }
function OverheadCity()     { return <OverheadGate post="#666a70" beam="#d8b400" />; }
function OverheadDesert()   { return <OverheadGate post="#8a4a20" beam="#a05a28" />; }
function OverheadSpace()    { return <OverheadGate post="#556" beam="#66ccff" glow="#2288ff" />; }
function OverheadMedieval() { return <OverheadGate post="#7a7a7a" beam="#909090" />; }
function OverheadDungeon()  { return <OverheadGate post="#4a4454" beam="#6a6278" glow="#ff9a3c" />; }

// ── Rol: jump / slide / lane (yalnız görsel dil + telegraf + 3-şerit seçimi) ──
const LANE_TYPES = new Set([
  CityCar, CityTaxi, CityPolice, DesertCactusTall, SpaceRover, SpaceRockA, SpaceRockB,
  MedWell, MedTreeA, MedTreeB, DunBricks, DunTable,
]);
const SLIDE_TYPES = new Set([OverheadFarm, OverheadCity, OverheadDesert, OverheadSpace, OverheadMedieval, OverheadDungeon]);
export function getRole(T) { return SLIDE_TYPES.has(T) ? 'slide' : LANE_TYPES.has(T) ? 'lane' : 'jump'; }

// ── Telegraf: engelin 8 m önünde (ata doğru) zemin ok işareti ─────────────────
// Yuva başına materyal (modül seviyesinde) — opaklık uzaklığa göre her kare yazılır.
const TELE_Z = 8;
const TELE_MATS = Array.from({ length: POOL }, () => ({
  jump:  new THREE.MeshBasicMaterial({ color: '#ff8a1e', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  slide: new THREE.MeshBasicMaterial({ color: '#3a7ac0', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
}));
function Telegraph({ id, role }) {
  if (role === 'lane') return null;
  const m = TELE_MATS[id][role];
  const g = role === 'jump' ? G.chevUp : G.chevDown;
  return (
    <group position={[0, 0.03, TELE_Z]} userData={{ noBBox: true }}>
      <mesh geometry={g} material={m} position={[0, 0, -0.55]} renderOrder={2} userData={{ noBBox: true }} />
      <mesh geometry={g} material={m} position={[0, 0, 0.55]} renderOrder={2} userData={{ noBBox: true }} />
    </group>
  );
}

// Tip → tür: 'overhead' = altından eğilerek geçilir; diğerleri zemin engeli
const KIND_MAP = new Map([
  [OverheadFarm, 'overhead'], [OverheadCity, 'overhead'], [OverheadDesert, 'overhead'],
  [OverheadSpace, 'overhead'], [OverheadMedieval, 'overhead'], [OverheadDungeon, 'overhead'],
]);
export function getKind(TypeFn) { return KIND_MAP.get(TypeFn) ?? 'ground'; }

// ── Engel tipi listeleri ──────────────────────────────────────────────────────
const TYPES_FARM = [
  Barrel, HayBale, LogPile,
  Barrel, HayBale, LogPile,
  Barrel, LogPile, OverheadFarm, OverheadFarm,
];
const TYPES_CITY = [
  CityCar, CityTaxi, CityPolice, CityDump,
  CityCar, CityTaxi, CityPolice, CityDump, OverheadCity, OverheadCity,
];
const TYPES_DESERT = [
  // Küçük kısa kaktüs kaldırıldı — yalnızca uzun kaktüs + büyük kayalar
  DesertCactusTall, DesertRockA, DesertRockB, DesertRockC,
  DesertCactusTall, DesertRockA, DesertRockB, DesertRockC, OverheadDesert, OverheadDesert,
];
const TYPES_SPACE = [
  SpaceBarrels, SpaceRover, SpaceMeteor, SpaceMeteorDet,
  SpacePlatLow, SpaceRockA, SpaceRockB,
  SpaceBarrels, SpaceRover, SpaceMeteor, OverheadSpace, OverheadSpace,
];
const TYPES_MEDIEVAL = [
  MedWell, MedRocks, MedRocksSm, MedTreeA, MedTreeB, MedFarm,
  MedRocks, MedTreeA, MedRocksSm, MedTreeB, OverheadMedieval, OverheadMedieval,
];
const TYPES_DUNGEON = [
  DunCrate, DunBarrel, DunChest, DunSpikes, DunBricks, DunTable,
  DunCrate, DunBarrel, DunSpikes, DunChest, OverheadDungeon, OverheadDungeon,
];

// ── Tip → hitbox [dx, dz] eşlemesi (function ref, minification-safe) ──────────
const HITBOX_MAP = new Map();
// Farm
const _setFarm = () => {
  HITBOX_MAP.set(Barrel,    [0.65, 0.65]);
  HITBOX_MAP.set(HayBale,   [0.70, 0.70]);
  HITBOX_MAP.set(LogPile,   [0.75, 0.65]);
};
// City
const _setCity = () => {
  // Arabalar uzun; derinlik biraz kısaltıldı ki zıplanabilsin (yatay korundu)
  HITBOX_MAP.set(CityCar,   [0.78, 1.30]);
  HITBOX_MAP.set(CityTaxi,  [0.78, 1.30]);
  HITBOX_MAP.set(CityPolice,[0.78, 1.30]);
  HITBOX_MAP.set(CityDump,  [0.72, 0.50]); // görsele oturtuldu (küçük çöp kutusu)
};
// Hitbox'lar görsel scale'lerle senkron tutulmalı — modeller büyütüldüğünde
// burası da orantılı güncellenmeli, yoksa "havada ölme / içinden geçme" olur.
const _setDesert = () => {
  HITBOX_MAP.set(DesertCactusShort, [0.55, 0.48]);
  HITBOX_MAP.set(DesertCactusTall,  [0.60, 0.55]);
  // Kayalar derindi (dz 1.32) → zıplayınca ön kenar erken yakalıyordu. Derinlik
  // diğer haritalarla tutarlı hale getirildi (zıplanabilir), yatay korundu.
  HITBOX_MAP.set(DesertRockA,       [1.15, 0.92]);
  HITBOX_MAP.set(DesertRockB,       [1.15, 0.92]);
  HITBOX_MAP.set(DesertRockC,       [1.15, 0.92]);
};
const _setSpace = () => {
  HITBOX_MAP.set(SpaceBarrels,   [0.96, 0.92]);
  HITBOX_MAP.set(SpaceRover,     [0.42, 0.48]); // rover küçük model (~0.8 birim); görsele oturtuldu
  HITBOX_MAP.set(SpaceMeteor,    [1.20, 1.00]);
  HITBOX_MAP.set(SpaceMeteorDet, [1.10, 0.95]);
  HITBOX_MAP.set(SpacePlatLow,   [1.40, 0.90]);
  HITBOX_MAP.set(SpaceRockA,     [1.30, 1.02]);
  HITBOX_MAP.set(SpaceRockB,     [1.30, 1.02]);
};
const _setMedieval = () => {
  HITBOX_MAP.set(MedWell,    [1.05, 0.95]);
  HITBOX_MAP.set(MedRocks,   [1.25, 1.02]);
  HITBOX_MAP.set(MedRocksSm, [0.85, 0.78]);
  // Ağaçlar YÜKSEK ama gövde İNCE; hitbox derinliği gövdeyle eşitlendi
  // (eskiden görselin ~1.3 katıydı → gövdeye değmeden ölünüyordu)
  HITBOX_MAP.set(MedTreeA,   [0.80, 0.62]);
  HITBOX_MAP.set(MedTreeB,   [0.75, 0.58]);
  HITBOX_MAP.set(MedFarm,    [1.35, 1.05]);
};
const _setDungeon = () => {
  HITBOX_MAP.set(DunCrate,  [1.00, 0.95]);
  HITBOX_MAP.set(DunBarrel, [0.90, 0.88]);
  HITBOX_MAP.set(DunChest,  [1.15, 0.90]);
  HITBOX_MAP.set(DunSpikes, [1.35, 1.05]);
  HITBOX_MAP.set(DunBricks, [0.74, 0.70]);
  HITBOX_MAP.set(DunTable,  [0.54, 0.56]);
};
const _setOverhead = () => {
  [OverheadFarm, OverheadCity, OverheadDesert, OverheadSpace, OverheadMedieval, OverheadDungeon]
    .forEach(T => HITBOX_MAP.set(T, [1.70, 0.45]));
};
_setFarm(); _setCity(); _setDesert(); _setSpace(); _setMedieval(); _setDungeon(); _setOverhead();
export function getHitbox(TypeFnOrName) {
  if (typeof TypeFnOrName === 'function') return HITBOX_MAP.get(TypeFnOrName) ?? [1.00, 1.00];
  return [1.00, 1.00];
}

// ── Tek engel bileşeni ────────────────────────────────────────────────────────
// Görsel tip PROP olarak gelir: yuva yeniden kullanılıp tipi değişince bileşen
// yeniden çizilir. Eskiden tip yalnızca ref nesnesinde değişiyordu; React
// yeniden render etmediği için ekranda eski engel (ör. fıçı) kalırken çarpışma
// yeni tipe (ör. üst bariyer) göre yapılıyordu → "çarpmadan ölme" hatası.
const Obstacle = memo(function Obstacle({ data, Type, onRef }) {
  return (
    // Kinematik gövde: başlangıçta görünmez (-100), konumu spawner her karede verir.
    // position özelliği yok — yeniden çizimde (tip değişince) engel ışınlanmasın.
    <group ref={g => onRef(data.id, g ? makeKinematicBody(g, [data.x, -100, data.z]) : null)} userData={{ tag: 'obstacle' }}>
      <Type />
      <Telegraph id={data.id} role={getRole(Type)} />
    </group>
  );
}, (a, b) => a.Type === b.Type && a.data === b.data);

// ── Spawner ───────────────────────────────────────────────────────────────────
export default function ObstacleSpawner() {
  const phase   = useGameStore((s) => s.phase);
  const mapId   = useGameStore((s) => s.mapId);
  const types   = mapId === 6 ? TYPES_DUNGEON : mapId === 5 ? TYPES_MEDIEVAL : mapId === 4 ? TYPES_SPACE : mapId === 3 ? TYPES_DESERT : mapId === 2 ? TYPES_CITY : TYPES_FARM;
  // Component is keyed by runId in App, so this always runs with current types.
  const poolRef = useRef(
    Array.from({ length: POOL }, (_, i) => ({
      id: i, x: LANES[i % 3], z: SPAWN_Z - i * 30,
      typeIdx: i % types.length,
      Type: types[i % types.length],
      TypeFn: types[i % types.length],
      active: false,
    }))
  );
  // Her yuvanın ekranda çizilen tipi — çarpışma tipiyle (registry) aynı kaynak
  // 3 şeritli dalga ([0,1,2]) YALNIZ zıplama/eğilme tipleri kullanır — uzun
  // şerit-değiştirme engelleri tüm yolu kapatıp "geçilmez duvar" gibi okunmasın.
  const allLaneTypes = useRef(types.filter(T => getRole(T) !== 'lane')).current;
  const [slotTypes, setSlotTypes] = useState(() => poolRef.current.map(o => o.Type));
  // Geliştirme test kancası: ekranda çizilen tip ile çarpışma tipini karşılaştırmak için
  const slotTypesRef = useRef(slotTypes);
  slotTypesRef.current = slotTypes;
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__hrObstacles = () => poolRef.current.map(o => ({
      id: o.id, active: o.active, x: o.x, z: o.z,
      type: o.TypeFn?.name, shown: slotTypesRef.current[o.id]?.name, kind: getKind(o.TypeFn),
    }));
    // Görsel-vs-hitbox kontrolü: her yuvanın mesh bbox'ı (telegraf/gölge hariç),
    // grup konumuna göre yerel koordinatta.
    window.__hrObstacleBBoxes = () => {
      const box = new THREE.Box3(), tmp = new THREE.Box3();
      return poolRef.current.map(o => {
        const g = rbRefs.current[o.id]?.object3d;
        if (!g) return null;
        g.updateMatrixWorld(true);
        box.makeEmpty();
        g.traverse(m => {
          if (!m.isMesh) return;
          let n = m, skip = false;
          while (n && n !== g) { if (n.userData?.noBBox) { skip = true; break; } n = n.parent; }
          if (skip) return;
          box.union(tmp.makeEmpty().expandByObject(m, true)); // köşe-hassas
        });
        const T = slotTypesRef.current[o.id];
        const p = g.position;
        return { type: T?.name, role: getRole(T), hb: getHitbox(T),
          min: [box.min.x - p.x, box.min.y - p.y, box.min.z - p.z], max: [box.max.x - p.x, box.max.y - p.y, box.max.z - p.z] };
      }).filter(Boolean);
    };
    return () => { delete window.__hrObstacles; delete window.__hrObstacleBBoxes; };
  }, []);
  const rbRefs   = useRef({});
  const timerRef = useRef(0);
  const waveIdx  = useRef(0);
  const lastFullRef = useRef(false); // önceki dalga 3 şeridi kapladı mı
  const lastReviveRef = useRef(useGameStore.getState().reviveId);

  const onRef = useCallback((id, rb) => { rbRefs.current[id] = rb; }, []);

  // Clear stale registry entries from previous run so ghost collisions can't occur
  useEffect(() => { clearRegistry(); }, []);

  useFrame((_, delta) => {
    // Devam et (revive) olunca öndeki tüm engelleri temizle (ikilenme/çarpma olmasın)
    const reviveId = useGameStore.getState().reviveId;
    if (reviveId !== lastReviveRef.current) {
      lastReviveRef.current = reviveId;
      poolRef.current.forEach((obs) => {
        obs.active = false;
        setObstacleActive(obs.id, false);
        rbRefs.current[obs.id]?.setTranslation({ x: obs.x, y: -100, z: obs.z }, true);
      });
      clearRegistry();
      timerRef.current = 0;
    }

    if (phase !== 'playing') return;
    const speed = useGameStore.getState().speed;
    const spawnInterval = Math.max(0.8, BASE_TIMER - speed * 0.022);
    timerRef.current += delta;

    poolRef.current.forEach((obs) => {
      const tm = TELE_MATS[obs.id];
      if (!obs.active) { tm.jump.opacity = 0; tm.slide.opacity = 0; return; }
      obs.z += speed * delta;
      // Telegraf: 70 m'den 40 m'ye yaklaşırken 0 → 0.5 opaklığa belirir
      const ahead = -obs.z;
      const a = 0.5 * Math.min(1, Math.max(0, (70 - ahead) / 30));
      tm.jump.opacity = a; tm.slide.opacity = a;
      // Hareketli engel: şeritler arasında yanal salınım (zamanlamayla geçilir)
      if (obs.mover) {
        obs.movT = (obs.movT ?? 0) + delta;
        obs.x = Math.max(-4, Math.min(4, obs.baseX + Math.sin(obs.movT * 1.7 + obs.movPhase) * 4));
      }
      rbRefs.current[obs.id]?.setTranslation({ x: obs.x, y: 0.15, z: obs.z }, true);
      upsertObstacle(obs.id, obs.x, obs.z);
      if (obs.z > RECYCLE_Z) {
        obs.active = false;
        setObstacleActive(obs.id, false);
        rbRefs.current[obs.id]?.setTranslation({ x: obs.x, y: -100, z: obs.z }, true);
      }
    });

    if (timerRef.current < spawnInterval) return;
    timerRef.current = 0;

    let maxPattern = speed > 35 ? PATTERNS.length : speed > 22 ? 5 : 3;
    // Önceki dalga 3 şeridi kapladıysa, bu dalga en fazla 2 şerit olsun
    // (arada geçilemeyen art arda duvar oluşmasın)
    if (lastFullRef.current) maxPattern = Math.min(maxPattern, 6); // [0,1,2] (idx 6) hariç
    let pattern = PATTERNS[Math.floor(Math.random() * maxPattern)];
    lastFullRef.current = pattern.length === 3;
    waveIdx.current++;

    let typesChanged = false;
    pattern.forEach((laneIdx, pi) => {
      const slot = poolRef.current.find((o) => !o.active);
      if (!slot) return;

      const existing = poolRef.current.filter((o) => o.active && o.x === LANES[laneIdx]);
      if (existing.some((o) => Math.abs(o.z - SPAWN_Z) < MIN_GAP)) return;

      const pick     = pattern.length === 3 && allLaneTypes.length ? allLaneTypes : types;
      const TypeFn   = pick[Math.floor(Math.random() * pick.length)];
      const typeIdx  = types.indexOf(TypeFn);
      slot.x         = LANES[laneIdx];
      slot.z         = SPAWN_Z + pi * 0.5;
      slot.typeIdx   = typeIdx;
      if (slot.Type !== TypeFn) typesChanged = true;
      slot.Type      = TypeFn;
      slot.TypeFn    = TypeFn;
      // Hareketli engel: yalnızca TEK şeritli dalgalarda, yüksek hızda, zemin
      // engellerinde — %30 şans. Salınarak şerit değiştirir (dinamiklik).
      slot.mover = pattern.length === 1 && speed > 24 &&
                   getKind(TypeFn) === 'ground' && Math.random() < 0.30;
      slot.baseX    = slot.x;
      slot.movPhase = Math.random() * Math.PI * 2;
      slot.movT     = 0;
      slot.active    = true;
      upsertObstacle(slot.id, slot.x, slot.z, TypeFn);   // position BEFORE active=true
      setObstacleActive(slot.id, true);
      rbRefs.current[slot.id]?.setTranslation({ x: slot.x, y: 0.15, z: slot.z }, true);
    });
    // Görseli yeni tiple eşitle (dalga başına tek render; engel henüz uzakta)
    if (typesChanged) setSlotTypes(poolRef.current.map(o => o.Type));
  });

  return (
    <>
      {poolRef.current.map((obs) => (
        <Obstacle key={obs.id} data={obs} Type={slotTypes[obs.id] ?? obs.Type} onRef={onRef} />
      ))}
    </>
  );
}
