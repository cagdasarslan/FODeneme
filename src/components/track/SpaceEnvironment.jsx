import { useRef, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const SEG_LEN       = 120;
const SEG_COUNT     = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const SP = '/assets/models/space/';
const PATHS = {
  crater:       SP + 'crater.glb',
  craterLarge:  SP + 'craterLarge.glb',
  rock:         SP + 'rock.glb',
  rockSmA:      SP + 'rocks_smallA.glb',
  rockSmB:      SP + 'rocks_smallB.glb',
  rockLargeA:   SP + 'rock_largeA.glb',
  rockLargeB:   SP + 'rock_largeB.glb',
  hangar:       SP + 'hangar_roundA.glb',
  hangarLarge:  SP + 'hangar_largeA.glb',
  satellite:    SP + 'satelliteDish.glb',
  satelliteLg:  SP + 'satelliteDish_large.glb',
  rocketBase:   SP + 'rocket_baseA.glb',
  rocketTop:    SP + 'rocket_topA.glb',
  rocketFins:   SP + 'rocket_finsA.glb',
  generator:    SP + 'machine_generator.glb',
};
Object.values(PATHS).forEach(p => useGLTF.preload(p));

// ── Shared materials ──────────────────────────────────────────────────────────
const matRoad  = new THREE.MeshStandardMaterial({ color: '#6b3a2a', roughness: 0.85 });
const matDust  = new THREE.MeshStandardMaterial({ color: '#8c4a30', roughness: 0.95 });
const matDustF = new THREE.MeshStandardMaterial({ color: '#7a3f28', roughness: 0.95 });
const matRidge = new THREE.MeshStandardMaterial({ color: '#5a2e1a', roughness: 1.0 });
const markMat  = new THREE.MeshStandardMaterial({ color: '#ff9955', roughness: 0.7, emissive: '#ff5500', emissiveIntensity: 0.3 });
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

// ── Deterministic hash ────────────────────────────────────────────────────────
const h = (seed, n) => ((seed * 7919 + n * 1013) % 1000) / 1000;

// ── Lane markings — glowing orange ───────────────────────────────────────────
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

// ── Background horizon structures (rocket, hangar, satellite) ─────────────────
const BG_SLOTS = [
  { dx: 42, dzFrac: 0.10 }, { dx: 50, dzFrac: 0.40 }, { dx: 45, dzFrac: 0.70 },
  { dx: 55, dzFrac: 0.25 }, { dx: 48, dzFrac: 0.85 },
];
const BG_LEFT_SLOTS = [
  { dx: 38, dzFrac: 0.15 }, { dx: 52, dzFrac: 0.55 }, { dx: 44, dzFrac: 0.90 },
];

function BackgroundStructures({ seed }) {
  const half = SEG_LEN / 2;
  const items = [];

  // Right side — hangars, satellites, rockets
  BG_SLOTS.forEach((slot, i) => {
    const t    = h(seed, i * 4 + 1);
    const rotY = h(seed, i * 3) * Math.PI * 2;
    const dz   = -half + slot.dzFrac * SEG_LEN;
    if (t < 0.3) {
      items.push(<GLB key={`rr${i}`} path={PATHS.rocketBase}  position={[ slot.dx, 0, dz]} scale={5.5} rotY={rotY} />);
      items.push(<GLB key={`rt${i}`} path={PATHS.rocketTop}   position={[ slot.dx, 5.2, dz]} scale={5.5} rotY={rotY} />);
      items.push(<GLB key={`rf${i}`} path={PATHS.rocketFins}  position={[ slot.dx, 0, dz]} scale={5.5} rotY={rotY} />);
    } else if (t < 0.6) {
      items.push(<GLB key={`hr${i}`} path={PATHS.hangarLarge} position={[ slot.dx, 0, dz]} scale={6.0} rotY={rotY} />);
    } else {
      items.push(<GLB key={`sr${i}`} path={PATHS.satelliteLg} position={[ slot.dx, 0, dz]} scale={4.5} rotY={rotY} />);
    }
  });

  // Left side — generators, satellites, hangar
  BG_LEFT_SLOTS.forEach((slot, i) => {
    const t    = h(seed, i * 7 + 13);
    const rotY = h(seed, i * 5 + 3) * Math.PI * 2;
    const dz   = -half + slot.dzFrac * SEG_LEN;
    if (t < 0.4) {
      items.push(<GLB key={`sl${i}`} path={PATHS.satellite}   position={[-slot.dx, 0, dz]} scale={4.0} rotY={rotY} />);
    } else if (t < 0.75) {
      items.push(<GLB key={`gl${i}`} path={PATHS.generator}   position={[-slot.dx, 0, dz]} scale={5.0} rotY={rotY} />);
    } else {
      items.push(<GLB key={`hl${i}`} path={PATHS.hangar}      position={[-slot.dx, 0, dz]} scale={5.5} rotY={rotY} />);
    }
  });

  return <>{items}</>;
}

// ── Near-road props (craters, rocks) ─────────────────────────────────────────
const NEAR_SLOTS = [
  { dx: 10, dzFrac: 0.08 }, { dx: 12, dzFrac: 0.25 }, { dx: 11, dzFrac: 0.50 },
  { dx: 13, dzFrac: 0.72 }, { dx: 10, dzFrac: 0.90 },
  { dx: 10, dzFrac: 0.15 }, { dx: 12, dzFrac: 0.38 }, { dx: 11, dzFrac: 0.62 },
  { dx: 14, dzFrac: 0.80 },
];

function NearProps({ seed }) {
  const half = SEG_LEN / 2;
  return (
    <>
      {NEAR_SLOTS.map((slot, i) => {
        const t     = h(seed, i * 11 + 5);
        const side  = i % 2 === 0 ? 1 : -1;
        const rotY  = h(seed, i * 6) * Math.PI * 2;
        const scale = 1.5 + h(seed, i * 3) * 1.5;
        const dz    = -half + slot.dzFrac * SEG_LEN;
        const path  = t < 0.25 ? PATHS.craterLarge :
                      t < 0.50 ? PATHS.crater :
                      t < 0.70 ? PATHS.rockLargeA :
                      t < 0.85 ? PATHS.rockLargeB : PATHS.rock;
        return (
          <GLB key={i} path={path} position={[side * slot.dx, 0, dz]} scale={scale} rotY={rotY} />
        );
      })}
      {/* Scattered small rocks */}
      {Array.from({ length: 8 }, (_, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const dx   = 7 + h(seed, i * 17) * 5;
        const dz   = -half + h(seed, i * 9 + 2) * SEG_LEN;
        const path = h(seed, i * 13) < 0.5 ? PATHS.rockSmA : PATHS.rockSmB;
        return (
          <GLB key={`sm${i}`} path={path} position={[side * dx, 0, dz]}
            scale={1.0 + h(seed, i * 7) * 1.2} rotY={h(seed, i) * Math.PI * 2} />
        );
      })}
    </>
  );
}

// ── Wide star-field ground ────────────────────────────────────────────────────
function GroundPlane() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -300]}>
      <planeGeometry args={[500, 1200]} />
      <primitive object={matDustF} attach="material" />
    </mesh>
  );
}

// ── Procedural star field (static points) ────────────────────────────────────
function Stars() {
  const geo = useRef(null);
  if (!geo.current) {
    const positions = new Float32Array(2000 * 3);
    const rng = (n) => ((n * 127773 + 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2000; i++) {
      positions[i * 3]     = (rng(i * 3 + 1) - 0.5) * 900;
      positions[i * 3 + 1] = 20 + rng(i * 3 + 2) * 200;
      positions[i * 3 + 2] = (rng(i * 3 + 3) - 0.5) * 1200;
    }
    geo.current = new THREE.BufferGeometry();
    geo.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }
  return (
    <points geometry={geo.current}>
      <pointsMaterial size={0.35} color="#ffffff" sizeAttenuation />
    </points>
  );
}

// ── Giant planet/moon on horizon ─────────────────────────────────────────────
function HorizonPlanet() {
  return (
    <mesh position={[120, 80, -400]}>
      <sphereGeometry args={[55, 24, 16]} />
      <meshStandardMaterial
        color="#c06040"
        roughness={0.7}
        emissive="#400800"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

// ── Single scrolling track segment ───────────────────────────────────────────
function SpaceSegment({ seed }) {
  const half = SEG_LEN / 2;
  return (
    <group>
      {/* Road surface */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[9, 0.30, SEG_LEN]} />
        <primitive object={matRoad} attach="material" />
      </mesh>
      {/* Dust strip both sides */}
      <mesh receiveShadow position={[-19, 0, 0]}>
        <boxGeometry args={[22, 0.30, SEG_LEN]} />
        <primitive object={matDust} attach="material" />
      </mesh>
      <mesh receiveShadow position={[19, 0, 0]}>
        <boxGeometry args={[22, 0.30, SEG_LEN]} />
        <primitive object={matDust} attach="material" />
      </mesh>
      {/* Far ground */}
      <mesh receiveShadow position={[-60, -0.1, 0]}>
        <boxGeometry args={[80, 0.20, SEG_LEN]} />
        <primitive object={matDustF} attach="material" />
      </mesh>
      <mesh receiveShadow position={[60, -0.1, 0]}>
        <boxGeometry args={[80, 0.20, SEG_LEN]} />
        <primitive object={matDustF} attach="material" />
      </mesh>
      {/* Rocky ridgeline silhouettes */}
      <mesh receiveShadow position={[-68, 6, 0]} scale={[30, 12, SEG_LEN * 0.9]}>
        <sphereGeometry args={[1, 8, 5]} />
        <primitive object={matRidge} attach="material" />
      </mesh>
      <mesh receiveShadow position={[68, 6, 0]} scale={[30, 12, SEG_LEN * 0.9]}>
        <sphereGeometry args={[1, 8, 5]} />
        <primitive object={matRidge} attach="material" />
      </mesh>
      <LaneMarkings />
      <NearProps seed={seed} />
      <BackgroundStructures seed={seed} />
    </group>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function SpaceEnvironment() {
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
      {/* Deep space sky — procedural color via background color */}
      <color attach="background" args={['#0d0518']} />

      {/* Warm orange "alien sun" directional light */}
      <directionalLight
        castShadow
        position={[60, 100, -80]}
        intensity={2.6}
        color="#ff8844"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      {/* Subtle purple fill from the other side */}
      <hemisphereLight skyColor="#3311aa" groundColor="#4a1808" intensity={0.55} />
      {/* Faint ambient so shadows aren't pitch black */}
      <ambientLight intensity={0.18} color="#220833" />

      <Stars />
      <HorizonPlanet />
      <GroundPlane />

      {posRef.current.map((z, i) => (
        <group key={i} ref={el => (grpRefs.current[i] = el)} position={[0, 0, z]}>
          <SpaceSegment seed={i * 31 + 7} />
        </group>
      ))}
    </>
  );
}
