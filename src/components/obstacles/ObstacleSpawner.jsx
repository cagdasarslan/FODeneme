import { useRef, useCallback, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { upsertObstacle, setObstacleActive } from '@/utils/obstacleRegistry';
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

const BASE_TIMER = 2.0;
const POOL       = 18;

const PATTERNS = [
  [0, 1], [0, 2], [1, 2],
  [0], [2], [1],
  [0, 1, 2],
];

// ── Prosedürel farm engelleri ─────────────────────────────────────────────────
const MAT = {
  barrel:  new THREE.MeshStandardMaterial({ color: '#4a2e0a', roughness: 0.7 }),
  band:    new THREE.MeshStandardMaterial({ color: '#777', metalness: 0.8 }),
  hay:     new THREE.MeshStandardMaterial({ color: '#c8a030' }),
  log:     new THREE.MeshStandardMaterial({ color: '#7a5530' }),
  logRing: new THREE.MeshStandardMaterial({ color: '#5a3a18' }),
};

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
function CityGLB({ path, scale = 1, yOffset = 0, rotY = 0 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  return <primitive object={cloned.current} scale={scale} position={[0, yOffset, 0]} rotation={[0, rotY, 0]} />;
}
function CityCar()    { return <CityGLB path={M_CAR_S} scale={3.5} yOffset={0.25} />; }
function CityTaxi()   { return <CityGLB path={M_CAR_T} scale={3.5} yOffset={0.25} />; }
function CityPolice() { return <CityGLB path={M_CAR_P} scale={3.5} yOffset={0.25} />; }
function CityDump()   { return <CityGLB path={M_DUMP}  scale={2.5} yOffset={0.0}  />; }
function CityBoxA()   { return <CityGLB path={M_BOX_A} scale={4.0} yOffset={0.0}  />; }
function CityBoxB()   { return <CityGLB path={M_BOX_B} scale={4.0} yOffset={0.0}  />; }

// ── Desert GLB obstacles ─────────────────────────────────────────────────────
function DesertGLB({ path, scale = 1 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  return <primitive object={cloned.current} scale={scale} />;
}
function DesertCactusShort() { return <DesertGLB path={M_CACTUS_S}   scale={2.5} />; }
function DesertCactusTall()  { return <DesertGLB path={M_CACTUS_T}   scale={2.5} />; }
function DesertRockA()       { return <DesertGLB path={M_DES_ROCK_A} scale={2.5} />; }
function DesertRockB()       { return <DesertGLB path={M_DES_ROCK_B} scale={2.5} />; }
function DesertRockC()       { return <DesertGLB path={M_DES_ROCK_C} scale={2.5} />; }

// ── Space GLB obstacles ───────────────────────────────────────────────────────
function SpaceGLB({ path, scale = 1, yOffset = 0 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  return <primitive object={cloned.current} scale={scale} position={[0, yOffset, 0]} />;
}
function SpaceBarrels()   { return <SpaceGLB path={M_SP_BARRELS}    scale={3.0} />; }
function SpaceRover()     { return <SpaceGLB path={M_SP_ROVER}      scale={2.2} />; }
function SpaceMeteor()    { return <SpaceGLB path={M_SP_METEOR}     scale={3.0} yOffset={0.4} />; }
function SpaceMeteorDet() { return <SpaceGLB path={M_SP_METEOR_DET} scale={2.8} yOffset={0.3} />; }
function SpacePlatLow()   { return <SpaceGLB path={M_SP_PLAT_LOW}   scale={3.5} />; }
function SpaceRockA()     { return <SpaceGLB path={M_SP_ROCK_A}     scale={2.8} />; }
function SpaceRockB()     { return <SpaceGLB path={M_SP_ROCK_B}     scale={2.8} />; }

// ── Engel tipi listeleri ──────────────────────────────────────────────────────
const TYPES_FARM = [
  Barrel, HayBale, LogPile,
  Barrel, HayBale, LogPile,
  Barrel, LogPile,
];
const TYPES_CITY = [
  CityCar, CityTaxi, CityPolice, CityDump,
  CityCar, CityTaxi, CityPolice, CityDump,
];
const TYPES_DESERT = [
  DesertCactusShort, DesertCactusTall, DesertRockA, DesertRockB, DesertRockC,
  DesertCactusShort, DesertCactusTall, DesertRockA,
];
const TYPES_SPACE = [
  SpaceBarrels, SpaceRover, SpaceMeteor, SpaceMeteorDet,
  SpacePlatLow, SpaceRockA, SpaceRockB,
  SpaceBarrels, SpaceRover, SpaceMeteor,
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
  HITBOX_MAP.set(CityCar,   [1.10, 1.80]);
  HITBOX_MAP.set(CityTaxi,  [1.10, 1.80]);
  HITBOX_MAP.set(CityPolice,[1.10, 1.80]);
  HITBOX_MAP.set(CityDump,  [0.90, 1.20]);
};
const _setDesert = () => {
  HITBOX_MAP.set(DesertCactusShort, [0.55, 0.55]);
  HITBOX_MAP.set(DesertCactusTall,  [0.50, 0.50]);
  HITBOX_MAP.set(DesertRockA,       [1.10, 1.10]);
  HITBOX_MAP.set(DesertRockB,       [1.10, 1.10]);
  HITBOX_MAP.set(DesertRockC,       [1.10, 1.10]);
};
const _setSpace = () => {
  HITBOX_MAP.set(SpaceBarrels,   [0.85, 0.85]);
  HITBOX_MAP.set(SpaceRover,     [1.20, 1.60]);
  HITBOX_MAP.set(SpaceMeteor,    [1.10, 1.10]);
  HITBOX_MAP.set(SpaceMeteorDet, [1.00, 1.00]);
  HITBOX_MAP.set(SpacePlatLow,   [1.50, 0.90]);
  HITBOX_MAP.set(SpaceRockA,     [1.20, 1.20]);
  HITBOX_MAP.set(SpaceRockB,     [1.20, 1.20]);
};
_setFarm(); _setCity(); _setDesert(); _setSpace();
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
  const runId   = useGameStore((s) => s.runId);
  const mapId   = useGameStore((s) => s.mapId);
  const types   = mapId === 4 ? TYPES_SPACE : mapId === 3 ? TYPES_SPACE : mapId === 2 ? TYPES_CITY : TYPES_FARM;
  const poolRef = useRef(null);
  if (!poolRef.current) {
    poolRef.current = Array.from({ length: POOL }, (_, i) => ({
      id: i, x: LANES[i % 3], z: SPAWN_Z - i * 30,
      typeIdx: i % types.length,
      Type: types[i % types.length],
      TypeFn: types[i % types.length],
      active: false,
    }));
  }
  const rbRefs   = useRef({});
  const timerRef = useRef(0);
  const waveIdx  = useRef(0);

  const onRef = useCallback((id, rb) => { rbRefs.current[id] = rb; }, []);

  useEffect(() => {
    timerRef.current = 0;
    waveIdx.current  = 0;
    poolRef.current.forEach((obs) => {
      obs.active = false;
      obs.z      = SPAWN_Z - obs.id * 30;
      upsertObstacle(obs.id, obs.x, obs.z);  // clear stale position before deactivating
      setObstacleActive(obs.id, false);
      rbRefs.current[obs.id]?.setTranslation({ x: obs.x, y: -100, z: obs.z }, true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const speed = useGameStore.getState().speed;
    const spawnInterval = Math.max(0.8, BASE_TIMER - speed * 0.022);
    timerRef.current += delta;

    poolRef.current.forEach((obs) => {
      if (!obs.active) return;
      obs.z += speed * delta;
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

    const maxPattern = speed > 35 ? PATTERNS.length : speed > 22 ? 5 : 3;
    const pattern    = PATTERNS[Math.floor(Math.random() * maxPattern)];
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
