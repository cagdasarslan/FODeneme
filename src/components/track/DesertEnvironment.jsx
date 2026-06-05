import { useRef, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const SEG_LEN       = 120;
const SEG_COUNT     = 6;
const RECYCLE_AFTER = SEG_LEN + 20;
const ROAD_HALF     = 4.5;

const D = '/assets/models/desert/';
const PATHS = {
  cactusShort: D + 'cactus_short.glb',
  cactusTall:  D + 'cactus_tall.glb',
  rockA:       D + 'rock_largeA.glb',
  rockB:       D + 'rock_largeB.glb',
  rockC:       D + 'rock_largeC.glb',
  rockSmA:     D + 'rock_smallA.glb',
  rockSmB:     D + 'rock_smallB.glb',
};
Object.values(PATHS).forEach(p => useGLTF.preload(p));

// ── Shared materials ──────────────────────────────────────────────────────────
const matRoad  = new THREE.MeshStandardMaterial({ color: '#8a7255', roughness: 0.9 });
const matSand  = new THREE.MeshStandardMaterial({ color: '#c8a060', roughness: 0.95 });
const matSandF = new THREE.MeshStandardMaterial({ color: '#b48840', roughness: 0.95 });
const matDune  = new THREE.MeshStandardMaterial({ color: '#d4a86a', roughness: 1.0 });
const markMat  = new THREE.MeshStandardMaterial({ color: '#e8d4a0', roughness: 0.8 });
const markGeo  = new THREE.BoxGeometry(0.18, 0.02, 3.2);

// ── GLB helper ────────────────────────────────────────────────────────────────
function GLBInner({ path, position = [0,0,0], scale = 1, rotY = 0 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }
  return <primitive object={cloned.current} position={position} scale={scale} rotation={[0, rotY, 0]} />;
}
function GLB(props) {
  return <Suspense fallback={null}><GLBInner {...props} /></Suspense>;
}

// ── Deterministic hash for variety ───────────────────────────────────────────
const h = (seed, n) => ((seed * 7919 + n * 1013) % 1000) / 1000;

// ── Lane markings ─────────────────────────────────────────────────────────────
function LaneMarkings() {
  const half  = SEG_LEN / 2;
  const count = Math.ceil(SEG_LEN / 8);
  return (
    <group position={[0, 0.17, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i}>
          <mesh geometry={markGeo} material={markMat} position={[-4, 0, -half + i * 8 + 4]} />
          <mesh geometry={markGeo} material={markMat} position={[ 4, 0, -half + i * 8 + 4]} />
        </group>
      ))}
    </group>
  );
}

// ── Props per side, determined by seed ───────────────────────────────────────
const PROP_SLOTS = [
  // close border
  { dx: 10.5, dzFrac: 0.10 },
  { dx: 11.0, dzFrac: 0.32 },
  { dx: 10.8, dzFrac: 0.54 },
  { dx: 11.5, dzFrac: 0.76 },
  // mid
  { dx: 18.0, dzFrac: 0.20 },
  { dx: 20.0, dzFrac: 0.42 },
  { dx: 19.5, dzFrac: 0.65 },
  { dx: 21.0, dzFrac: 0.88 },
  // far decoration
  { dx: 32.0, dzFrac: 0.15 },
  { dx: 35.0, dzFrac: 0.48 },
  { dx: 38.0, dzFrac: 0.75 },
];

const PROP_TYPES = [
  PATHS.cactusShort, PATHS.cactusTall, PATHS.rockA,
  PATHS.rockB, PATHS.rockSmA, PATHS.cactusShort, PATHS.cactusTall,
];
const PROP_SCALES = [2.2, 2.8, 1.8, 2.0, 1.5, 3.0, 3.5];

function SideProps({ seed, side }) {
  const half = SEG_LEN / 2;
  return (
    <>
      {PROP_SLOTS.map((slot, i) => {
        const typeIdx = Math.floor(h(seed, i * 3 + 7) * PROP_TYPES.length);
        const scale   = PROP_SCALES[typeIdx] * (0.85 + h(seed, i * 5) * 0.45);
        const rotY    = h(seed, i * 2) * Math.PI * 2;
        const dz      = -half + slot.dzFrac * SEG_LEN;
        return (
          <GLB
            key={i}
            path={PROP_TYPES[typeIdx]}
            position={[side * slot.dx, 0, dz]}
            scale={scale}
            rotY={rotY}
          />
        );
      })}
    </>
  );
}

// ── Single scrolling track segment ───────────────────────────────────────────
function DesertSegment({ seed }) {
  const half = SEG_LEN / 2;
  return (
    <group>
      {/* Road */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[9, 0.30, SEG_LEN]} />
        <primitive object={matRoad} attach="material" />
      </mesh>
      {/* Near sand strip both sides */}
      <mesh receiveShadow position={[-19, 0, 0]}>
        <boxGeometry args={[22, 0.30, SEG_LEN]} />
        <primitive object={matSand} attach="material" />
      </mesh>
      <mesh receiveShadow position={[19, 0, 0]}>
        <boxGeometry args={[22, 0.30, SEG_LEN]} />
        <primitive object={matSand} attach="material" />
      </mesh>
      {/* Far ground fill */}
      <mesh receiveShadow position={[-60, -0.1, 0]}>
        <boxGeometry args={[80, 0.20, SEG_LEN]} />
        <primitive object={matSandF} attach="material" />
      </mesh>
      <mesh receiveShadow position={[60, -0.1, 0]}>
        <boxGeometry args={[80, 0.20, SEG_LEN]} />
        <primitive object={matSandF} attach="material" />
      </mesh>
      {/* Dune silhouettes far L/R */}
      <mesh receiveShadow position={[-62, 5, 0]} scale={[38, 10, SEG_LEN * 0.9]}>
        <sphereGeometry args={[1, 8, 5]} />
        <primitive object={matDune} attach="material" />
      </mesh>
      <mesh receiveShadow position={[62, 5, 0]} scale={[38, 10, SEG_LEN * 0.9]}>
        <sphereGeometry args={[1, 8, 5]} />
        <primitive object={matDune} attach="material" />
      </mesh>
      <LaneMarkings />
      <SideProps seed={seed} side={-1} />
      <SideProps seed={seed} side={ 1} />
    </group>
  );
}

// ── Wide ground plane always under player ────────────────────────────────────
function GroundPlane() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -300]}>
      <planeGeometry args={[500, 1200]} />
      <primitive object={matSandF} attach="material" />
    </mesh>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DesertEnvironment() {
  const grpRefs = useRef([]);
  const posRef  = useRef(Array.from({ length: SEG_COUNT }, (_, i) => 5 - i * SEG_LEN));
  const phase   = useGameStore(s => s.phase);
  const runId   = useGameStore(s => s.runId);

  useEffect(() => {
    posRef.current = Array.from({ length: SEG_COUNT }, (_, i) => 5 - i * SEG_LEN);
    posRef.current.forEach((z, i) => grpRefs.current[i]?.position.set(0, 0, z));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useFrame((_, delta) => {
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
      {/* Desert HDRI sky */}
      <Environment
        files="/assets/hdri/rogland_clear_night_2k.hdr"
        background
        backgroundBlurriness={0.02}
      />
      {/* Warm sun */}
      <directionalLight
        castShadow
        position={[80, 120, -60]}
        intensity={2.4}
        color="#ffe090"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      <hemisphereLight skyColor="#f5c060" groundColor="#7a5020" intensity={0.65} />

      <GroundPlane />

      {posRef.current.map((z, i) => (
        <group key={i} ref={el => (grpRefs.current[i] = el)} position={[0, 0, z]}>
          <DesertSegment seed={i} />
        </group>
      ))}
    </>
  );
}
