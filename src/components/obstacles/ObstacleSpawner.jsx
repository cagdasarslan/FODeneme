import { useRef, useCallback, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { upsertObstacle, setObstacleActive, clearRegistry } from '@/utils/obstacleRegistry';
import { LANES, OBSTACLE_SPAWN_Z as SPAWN_Z, OBSTACLE_RECYCLE_Z as RECYCLE_Z, OBSTACLE_MIN_GAP as MIN_GAP } from '@/constants/game';

// ── KayKit city obstacle models ───────────────────────────────────────────────
const KK = '/assets/models/kaykit/';
const M_CAR_S  = KK+'car_sedan.gltf';
const M_CAR_T  = KK+'car_taxi.gltf';
const M_CAR_P  = KK+'car_police.gltf';
const M_DUMP   = KK+'dumpster.gltf';
const M_BOX_A  = KK+'box_A.gltf';
const M_BOX_B  = KK+'box_B.gltf';
[M_CAR_S, M_CAR_T, M_CAR_P, M_DUMP, M_BOX_A, M_BOX_B].forEach(p => useGLTF.preload(p));

// ── Desert obstacle models ────────────────────────────────────────────────────
const DES = '/assets/models/desert/';
const M_CACTUS_S = DES + 'cactus_short.glb';
const M_CACTUS_T = DES + 'cactus_tall.glb';
const M_DES_ROCK_A = DES + 'rock_largeA.glb';
const M_DES_ROCK_B = DES + 'rock_largeB.glb';
const M_DES_ROCK_C = DES + 'rock_largeC.glb';
[M_CACTUS_S, M_CACTUS_T, M_DES_ROCK_A, M_DES_ROCK_B, M_DES_ROCK_C].forEach(p => useGLTF.preload(p));

// ── Space obstacle models ─────────────────────────────────────────────────────
const SPC = '/assets/models/space/';
const M_SP_BARRELS    = SPC + 'barrels.glb';
const M_SP_ROVER      = SPC + 'rover.glb';
const M_SP_METEOR     = SPC + 'meteor.glb';
const M_SP_METEOR_DET = SPC + 'meteor_detailed.glb';
const M_SP_PLAT_LOW   = SPC + 'platform_low.glb';
const M_SP_ROCK_A     = SPC + 'rock_largeA.glb';
const M_SP_ROCK_B     = SPC + 'rock_largeB.glb';
[M_SP_BARRELS, M_SP_ROVER, M_SP_METEOR, M_SP_METEOR_DET,
 M_SP_PLAT_LOW, M_SP_ROCK_A, M_SP_ROCK_B].forEach(p => useGLTF.preload(p));

// ── Medieval obstacle models ──────────────────────────────────────────────────
const MED = '/assets/models/medieval/';
const M_MED_WELL    = MED + 'well.glb';
const M_MED_ROCKS   = MED + 'detail_rocks.glb';
const M_MED_ROCKS_S = MED + 'detail_rocks_small.glb';
const M_MED_TREE_A  = MED + 'detail_treeA.glb';
const M_MED_TREE_B  = MED + 'detail_treeB.glb';
const M_MED_FARM    = MED + 'farm_plot.glb';
[M_MED_WELL, M_MED_ROCKS, M_MED_ROCKS_S, M_MED_TREE_A, M_MED_TREE_B, M_MED_FARM].forEach(p => useGLTF.preload(p));

// ── Dungeon obstacle models (KayKit Dungeon Pack) ─────────────────────────────
const DUN = '/assets/models/dungeon/';
const M_DUN_CRATE   = DUN + 'crate.glb';
const M_DUN_BARREL  = DUN + 'barrel.glb';
const M_DUN_CHEST   = DUN + 'chest_common.glb';
const M_DUN_SPIKES  = DUN + 'tileSpikes_large.glb';
const M_DUN_BRICKS  = DUN + 'bricks.glb';
const M_DUN_TABLE   = DUN + 'tableSmall.glb';
[M_DUN_CRATE, M_DUN_BARREL, M_DUN_CHEST, M_DUN_SPIKES, M_DUN_BRICKS, M_DUN_TABLE].forEach(p => useGLTF.preload(p));

const BASE_TIMER = 2.0;
const POOL       = 18;

const PATTERNS = [
  [0, 1], [0, 2], [1, 2],
  [0], [2], [1],
  [0, 1, 2],
];

// ── Prosedürel farm engelleri ─────────────────────────────────────────────────
const MAT = {
  barrel:  new THREE.MeshStandardMaterial({ color: '#7a4a14', roughness: 0.7, emissive: '#7a4a14', emissiveIntensity: 0.25 }),
  band:    new THREE.MeshStandardMaterial({ color: '#999', metalness: 0.8 }),
  hay:     new THREE.MeshStandardMaterial({ color: '#d8b040', emissive: '#d8b040', emissiveIntensity: 0.2 }),
  log:     new THREE.MeshStandardMaterial({ color: '#9a6a3a', emissive: '#9a6a3a', emissiveIntensity: 0.22 }),
  logRing: new THREE.MeshStandardMaterial({ color: '#6a4a22' }),
};

// Klonlanan materyalleri işaretle → unmount'ta GÜVENLE dispose edilebilir.
// (Geometriler useGLTF önbelleğiyle PAYLAŞILDIĞI için ASLA dispose edilmez;
//  yalnız burada .clone() ile ürettiğimiz benzersiz materyaller dispose edilir.)
function _markCloned(m) { m.userData.__cloned = true; return m; }

// Unmount temizliği: klonladığımız (işaretli) materyalleri serbest bırak.
function disposeClonedMaterials(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.userData?.__cloned) {
      o.material.dispose();
    }
  });
}

// Çok koyu materyalleri zemin renginde kaybolmaktan kurtar: rengi minimum
// açıklığa çek + hafif öz-ışıma ver. Klonlar; paylaşılan orijinali bozmaz.
function ensureVisible(root, { minLight = 0.32, glow = 0.3 } = {}) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = _markCloned(o.material.clone());
    if (m.color) {
      const hsl = { h: 0, s: 0, l: 0 };
      m.color.getHSL(hsl);
      if (hsl.l < minLight) m.color.setHSL(hsl.h, Math.max(hsl.s, 0.3), minLight);
      if (m.emissive) { m.emissive.copy(m.color); m.emissiveIntensity = glow; }
    }
    o.material = m;
  });
}

// Engel materyallerini hafif öz-aydınlat (koyu modeller yolla aynı renge düşmesin).
// Materyali KLONLAYIP değiştirir; yan dekorla paylaşılan orijinali bozmaz.
function brightenObstacle(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = _markCloned(o.material.clone());
    if (m.color && m.emissive) {
      m.emissive.copy(m.color);
      m.emissiveIntensity = 0.28;
    }
    o.material = m;
  });
}

function Barrel() {
  // Silindiri zemin üstüne oturtmak için y=0.7 offset (merkez yarıçapı 0.7)
  return (
    <group position={[0, 0.7, 0]}>
      <mesh castShadow><cylinderGeometry args={[0.6, 0.6, 1.4, 12]} /><primitive object={MAT.barrel} attach="material" /></mesh>
      {[-0.4, 0.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[0.62, 0.07, 6, 14]} />
          <primitive object={MAT.band} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function HayBale() {
  // Silindir yatık — merkezi y=0.6'da (zemin üstünde)
  return (
    <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[0, 0.65, 0]}>
      <cylinderGeometry args={[0.65, 0.65, 1.3, 10]} />
      <primitive object={MAT.hay} attach="material" />
    </mesh>
  );
}

function LogPile() {
  return (
    <group>
      {[[-0.38, 0.3, 0], [0.38, 0.3, 0], [0, 0.85, 0]].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[Math.PI/2, 0, i*0.3]}>
          <mesh castShadow><cylinderGeometry args={[0.27, 0.27, 1.3, 8]} /><primitive object={MAT.log} attach="material" /></mesh>
          <mesh position={[0, 0.66, 0]}><cylinderGeometry args={[0.27, 0.27, 0.06, 8]} /><primitive object={MAT.logRing} attach="material" /></mesh>
        </group>
      ))}
    </group>
  );
}

// ── KayKit city obstacles ────────────────────────────────────────────────────
function CityGLB({ path, scale = 1, yOffset = 0, rotY = 0, brighten = false }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  useEffect(() => () => disposeClonedMaterials(cloned.current), []);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // Araç renkleri orijinal kalır; yalnız koyu konteyner/kutular aydınlatılır
    if (brighten) ensureVisible(cloned.current, { minLight: 0.34, glow: 0.28 });
  }
  return <primitive object={cloned.current} scale={scale} position={[0, yOffset, 0]} rotation={[0, rotY, 0]} />;
}
function CityCar()    { return <CityGLB path={M_CAR_S} scale={3.5} yOffset={0.25} />; }
function CityTaxi()   { return <CityGLB path={M_CAR_T} scale={3.5} yOffset={0.25} />; }
function CityPolice() { return <CityGLB path={M_CAR_P} scale={3.5} yOffset={0.25} />; }
function CityDump()   { return <CityGLB path={M_DUMP}  scale={2.5} yOffset={0.0} brighten />; }
function CityBoxA()   { return <CityGLB path={M_BOX_A} scale={4.0} yOffset={0.0} brighten />; }
function CityBoxB()   { return <CityGLB path={M_BOX_B} scale={4.0} yOffset={0.0} brighten />; }

// ── Desert GLB obstacles ─────────────────────────────────────────────────────
// Scale goes on a wrapper <group>; centering offset goes on the <primitive>
// inside the group so the math is: (vertex_cx + (-cx)) * scale = 0. Putting
// scale and offset on the same node would require offset = -cx * scale which
// does not work because Box3 gives unscaled coordinates.
function DesertGLB({ path, scale = 1 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  useEffect(() => () => disposeClonedMaterials(cloned.current), []);
  const off    = useRef([0, 0]);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(cloned.current);
    off.current = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
    // Çöl ışığı loş + yol koyu kırmızı: koyu kaya/kaktüs görünmez oluyordu
    ensureVisible(cloned.current, { minLight: 0.4, glow: 0.35 });
  }
  return (
    <group scale={scale}>
      <primitive object={cloned.current} position={[-off.current[0], 0, -off.current[1]]} />
    </group>
  );
}
function DesertCactusShort() { return <DesertGLB path={M_CACTUS_S}   scale={3.1} />; }
function DesertCactusTall()  { return <DesertGLB path={M_CACTUS_T}   scale={3.1} />; }
function DesertRockA()       { return <DesertGLB path={M_DES_ROCK_A} scale={3.0} />; }
function DesertRockB()       { return <DesertGLB path={M_DES_ROCK_B} scale={3.0} />; }
function DesertRockC()       { return <DesertGLB path={M_DES_ROCK_C} scale={3.0} />; }

// ── Space GLB obstacles ───────────────────────────────────────────────────────
function SpaceGLB({ path, scale = 1, yOffset = 0 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  useEffect(() => () => disposeClonedMaterials(cloned.current), []);
  const off    = useRef([0, 0]);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(cloned.current);
    off.current = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
    brightenObstacle(cloned.current);
  }
  return (
    <group scale={scale} position={[0, yOffset, 0]}>
      <primitive object={cloned.current} position={[-off.current[0], 0, -off.current[1]]} />
    </group>
  );
}
function SpaceBarrels()   { return <SpaceGLB path={M_SP_BARRELS}    scale={3.4} />; }
function SpaceRover()     { return <SpaceGLB path={M_SP_ROVER}      scale={2.7} />; }
function SpaceMeteor()    { return <SpaceGLB path={M_SP_METEOR}     scale={3.5} yOffset={0.4} />; }
function SpaceMeteorDet() { return <SpaceGLB path={M_SP_METEOR_DET} scale={3.3} yOffset={0.3} />; }
function SpacePlatLow()   { return <SpaceGLB path={M_SP_PLAT_LOW}   scale={3.5} />; }
function SpaceRockA()     { return <SpaceGLB path={M_SP_ROCK_A}     scale={3.3} />; }
function SpaceRockB()     { return <SpaceGLB path={M_SP_ROCK_B}     scale={3.3} />; }

// ── Medieval GLB obstacles ────────────────────────────────────────────────────
function MedievalGLB({ path, scale = 1, yOffset = 0, tint = null }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  useEffect(() => () => disposeClonedMaterials(cloned.current), []);
  const off    = useRef([0, 0, 0]);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(cloned.current);
    // X/Z merkezle + TABANI y=0'a hizala. Bazı zindan modellerinin pivotu
    // merkezde (ör. diken tuzağı minY=-1.0) → yarısı zeminin altında kalıp
    // "görünmez engel"e çarpma yaratıyordu. -minY ile tabana oturtulur.
    off.current = [(box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2];
    brightenObstacle(cloned.current);
    if (tint) { // zeminle aynı renkte kalan modeli haritaya uygun renge boya
      cloned.current.traverse(o => {
        if (!o.isMesh || !o.material) return;
        o.material.color.set(tint);
        if (o.material.emissive) o.material.emissive.set(tint);
      });
    }
  }
  return (
    <group scale={scale} position={[0, yOffset, 0]}>
      <primitive object={cloned.current} position={[-off.current[0], -off.current[1], -off.current[2]]} />
    </group>
  );
}
// Zindan engelleri MedievalGLB ile aynı merkezleme/parlatma mantığını kullanır
function DunCrate()  { return <MedievalGLB path={M_DUN_CRATE}  scale={1.8} />; }
function DunBarrel() { return <MedievalGLB path={M_DUN_BARREL} scale={1.8} />; }
function DunChest()  { return <MedievalGLB path={M_DUN_CHEST}  scale={1.6} />; }
function DunSpikes() { return <MedievalGLB path={M_DUN_SPIKES} scale={0.7} tint="#9a4a30" />; }
function DunBricks() { return <MedievalGLB path={M_DUN_BRICKS} scale={1.6} tint="#b4633f" />; }
function DunTable()  { return <MedievalGLB path={M_DUN_TABLE}  scale={1.6} />; }

function MedWell()    { return <MedievalGLB path={M_MED_WELL}    scale={3.0} />; }
function MedRocks()   { return <MedievalGLB path={M_MED_ROCKS}   scale={3.0} />; }
function MedRocksSm() { return <MedievalGLB path={M_MED_ROCKS_S} scale={3.4} />; }
function MedTreeA()   { return <MedievalGLB path={M_MED_TREE_A}  scale={3.6} />; }
function MedTreeB()   { return <MedievalGLB path={M_MED_TREE_B}  scale={3.6} />; }
function MedFarm()    { return <MedievalGLB path={M_MED_FARM}    scale={3.0} />; }

// ── Üstten geçen engel (EĞİLEREK altından geçilir) ────────────────────────────
// Kiriş alt yüzü at başı hizasında; eğilmeden (veya zıplayarak) geçmek çarpma.
function OverheadGate({ post = '#8a6a44', beam = '#a5825a', glow = null }) {
  const beamMat = glow
    ? { color: beam, emissive: glow, emissiveIntensity: 1.2, roughness: 0.4 }
    : { color: beam, roughness: 0.8 };
  // Kapı bilinçli olarak YÜKSEK: "üzerinden atlanır" gibi değil, "altından
  // eğilerek geçilir" diye okunmalı. Kirişten sarkan latalar zıplama yolunu
  // görsel olarak da kapatır — zıplayan at gerçekten latalara değer.
  return (
    <group>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} position={[x, 1.25, 0]} castShadow>
          <boxGeometry args={[0.22, 2.5, 0.22]} />
          <meshStandardMaterial color={post} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, 0]} castShadow>
        <boxGeometry args={[3.5, 0.32, 0.32]} />
        <meshStandardMaterial {...beamMat} />
      </mesh>
      {[-1.0, -0.35, 0.35, 1.0].map((x) => (
        <mesh key={'s' + x} position={[x, 1.86, 0]} castShadow>
          <boxGeometry args={[0.14, 0.72, 0.14]} />
          <meshStandardMaterial {...beamMat} />
        </mesh>
      ))}
    </group>
  );
}
function OverheadFarm()     { return <OverheadGate post="#7a5a34" beam="#a5825a" />; }
function OverheadCity()     { return <OverheadGate post="#666" beam="#d8b400" />; }
function OverheadDesert()   { return <OverheadGate post="#8a4a20" beam="#a05a28" />; }
function OverheadSpace()    { return <OverheadGate post="#556" beam="#66ccff" glow="#2288ff" />; }
function OverheadMedieval() { return <OverheadGate post="#7a7a7a" beam="#909090" />; }
function OverheadDungeon()  { return <OverheadGate post="#4a4454" beam="#6a6278" glow="#ff9a3c" />; }

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
  HITBOX_MAP.set(DesertCactusShort, [0.68, 0.68]);
  HITBOX_MAP.set(DesertCactusTall,  [0.60, 0.55]);
  // Kayalar derindi (dz 1.32) → zıplayınca ön kenar erken yakalıyordu. Derinlik
  // diğer haritalarla tutarlı hale getirildi (zıplanabilir), yatay korundu.
  HITBOX_MAP.set(DesertRockA,       [1.15, 0.92]);
  HITBOX_MAP.set(DesertRockB,       [1.15, 0.92]);
  HITBOX_MAP.set(DesertRockC,       [1.15, 0.92]);
};
const _setSpace = () => {
  HITBOX_MAP.set(SpaceBarrels,   [0.96, 0.92]);
  HITBOX_MAP.set(SpaceRover,     [0.60, 0.65]); // rover küçük model (~0.8 birim); görsele oturtuldu
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
  HITBOX_MAP.set(DunBricks, [1.05, 0.98]);
  HITBOX_MAP.set(DunTable,  [0.85, 0.88]);
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
function Obstacle({ data, onRef }) {
  return (
    <RigidBody
      ref={rb => onRef(data.id, rb)}
      type="kinematicPosition"
      position={[data.x, -100, data.z]}
      colliders={false}
      userData={{ tag: 'obstacle' }}
    >
      <Suspense fallback={null}>
        <data.Type />
      </Suspense>
    </RigidBody>
  );
}

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
      if (!obs.active) return;
      obs.z += speed * delta;
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

    pattern.forEach((laneIdx, pi) => {
      const slot = poolRef.current.find((o) => !o.active);
      if (!slot) return;

      const existing = poolRef.current.filter((o) => o.active && o.x === LANES[laneIdx]);
      if (existing.some((o) => Math.abs(o.z - SPAWN_Z) < MIN_GAP)) return;

      const typeIdx  = Math.floor(Math.random() * types.length);
      const TypeFn   = types[typeIdx];
      slot.x         = LANES[laneIdx];
      slot.z         = SPAWN_Z + pi * 0.5;
      slot.typeIdx   = typeIdx;
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
  });

  return (
    <>
      {poolRef.current.map((obs) => (
        <Obstacle key={obs.id} data={obs} onRef={onRef} />
      ))}
    </>
  );
}
