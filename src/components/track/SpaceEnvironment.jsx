import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP, IS_MOBILE } from '@/utils/device';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const ROAD_COLOR = '#6b3a2a';
const GROUND_COLOR = '#2a1a35';
const ROAD_W = 18;

// ── KayKit Space Base Bits modelleri ──────────────────────────────────────────
const SB = '/assets/models/spacebits/';
const M_BASE_A   = SB + 'basemodule_A.gltf';
const M_BASE_B   = SB + 'basemodule_B.gltf';
const M_BASE_C   = SB + 'basemodule_C.gltf';
const M_BASE_GAR = SB + 'basemodule_garage.gltf';
const M_DEPOT_A  = SB + 'cargodepot_A.gltf';
const M_DEPOT_B  = SB + 'cargodepot_B.gltf';
const M_STRUCT_T = SB + 'structure_tall.gltf';
const M_STRUCT_L = SB + 'structure_low.gltf';
const M_DRILL    = SB + 'drill_structure.gltf';
const M_WIND_T   = SB + 'windturbine_tall.gltf';
const M_WIND_L   = SB + 'windturbine_low.gltf';
const M_PAD_LG   = SB + 'landingpad_large.gltf';
const M_LANDER_A = SB + 'lander_A.gltf';
const M_LANDER_B = SB + 'lander_B.gltf';
const M_SOLAR    = SB + 'roofmodule_solarpanels.gltf';
const M_TUNNEL   = SB + 'tunnel_straight_A.gltf';
// dolgu / küçük
const M_CARGO_AS = SB + 'cargo_A_stacked.gltf';
const M_CARGO_BS = SB + 'cargo_B_stacked.gltf';
const M_CONT_A   = SB + 'containers_A.gltf';
const M_CONT_B   = SB + 'containers_B.gltf';
const M_CONT_C   = SB + 'containers_C.gltf';
const M_ROCKS_A  = SB + 'rocks_A.gltf';
const M_ROCKS_B  = SB + 'rocks_B.gltf';
const M_TRUCK    = SB + 'spacetruck.gltf';
// uzak yüksek duvar
const M_TERR_T   = SB + 'terrain_tall.gltf';
const M_TERR_TC  = SB + 'terrain_tall_curved.gltf';

const ALL = [
  M_BASE_A, M_BASE_B, M_BASE_C, M_BASE_GAR, M_DEPOT_A, M_DEPOT_B, M_STRUCT_T,
  M_STRUCT_L, M_DRILL, M_WIND_T, M_WIND_L, M_PAD_LG, M_LANDER_A, M_LANDER_B,
  M_SOLAR, M_TUNNEL, M_CARGO_AS, M_CARGO_BS, M_CONT_A, M_CONT_B, M_CONT_C,
  M_ROCKS_A, M_ROCKS_B, M_TRUCK, M_TERR_T, M_TERR_TC,
];
ALL.forEach((p) => useGLTF.preload(p));

// Klonla + yatayda merkeze çek (pivot kaymalarını giderir); mobilde gölge kapalı
function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  const off = useRef([0, 0]);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse((n) => { if (n.isMesh) { n.castShadow = !IS_MOBILE; n.receiveShadow = !IS_MOBILE; } });
    const box = new THREE.Box3().setFromObject(cloned.current);
    off.current = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
  }
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  return (
    <group position={position} scale={s} rotation={rotation}>
      <primitive object={cloned.current} position={[-off.current[0], 0, -off.current[1]]} />
    </group>
  );
}

function Stars() {
  const positions = useMemo(() => {
    const arr = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 600;
      arr[i * 3 + 1] = Math.random() * 200 + 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 600;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.5} sizeAttenuation />
    </points>
  );
}

function BigPlanet() {
  return (
    <group position={[120, 60, -300]}>
      <mesh>
        <sphereGeometry args={[30, 32, 32]} />
        <meshStandardMaterial color="#7b4fa6" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI * 0.15, 0, 0]}>
        <torusGeometry args={[44, 3, 4, 64]} />
        <meshStandardMaterial color="#9b6fc0" roughness={0.8} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

const wallMat  = new THREE.MeshStandardMaterial({ color: '#241a30', roughness: 0.9, metalness: 0.2 });
const stripMat = new THREE.MeshStandardMaterial({ color: '#3a2a50', emissive: '#ff5522', emissiveIntensity: 0.6 });

function RoadSegment() {
  return (
    <group>
      {/* Geniş zemin — harita dışını (boşluğu) kapatır */}
      <mesh receiveShadow position={[-109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      {/* Sürekli yüksek duvar — iki yanda harita dışını TAMAMEN kapatır */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 14, 9, 0]} material={wallMat}>
            <boxGeometry args={[4, 18, SEG_LEN]} />
          </mesh>
          {/* yol kenarı ışık şeridi */}
          <mesh position={[side * 9.4, 0.7, 0]} material={stripMat}>
            <boxGeometry args={[0.25, 0.25, SEG_LEN]} />
          </mesh>
        </group>
      ))}
      {/* Yol — 18 birim */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[ROAD_W, 0.30, SEG_LEN]} />
        <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
      </mesh>
      {[-4, 4].map((x) =>
        Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`lm-${x}-${i}`} position={[x, 0.31, -SEG_LEN / 2 + 8 + i * 14]}>
            <boxGeometry args={[0.15, 0.02, 5]} />
            <meshStandardMaterial color="#ff6633" emissive="#ff3300" emissiveIntensity={0.4} />
          </mesh>
        ))
      )}
    </group>
  );
}

function pr(a, b = 0) {
  return (((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1) + 1) % 1;
}

// Yol kenarına SIK uzay üssü yapıları + harita dışını kapatan yüksek duvar
function getSideProps(segIdx) {
  const props = [];
  const half = SEG_LEN / 2;

  const buildings = [
    { m: M_BASE_A, s: 3.2 }, { m: M_BASE_B, s: 3.2 }, { m: M_BASE_C, s: 3.2 },
    { m: M_BASE_GAR, s: 3.2 }, { m: M_DEPOT_A, s: 3.0 }, { m: M_DEPOT_B, s: 3.0 },
    { m: M_STRUCT_T, s: 3.4 }, { m: M_DRILL, s: 3.2 }, { m: M_WIND_T, s: 3.4 },
    { m: M_PAD_LG, s: 2.8 }, { m: M_LANDER_A, s: 3.0 }, { m: M_SOLAR, s: 3.0 },
    { m: M_TUNNEL, s: 3.2 },
  ];
  const buildingCount = IS_MOBILE ? 8 : 14;
  for (let i = 0; i < buildingCount; i++) {
    const z = -half + 4 + i * (SEG_LEN / buildingCount) + (pr(i, segIdx) - 0.5) * 3;
    const side = i % 2 === 0 ? -1 : 1;
    const dx = side * (10.5 + pr(i + 5, segIdx) * 1.5); // yol kenarı ile duvar arası
    const b = buildings[Math.floor(pr(i + 20, segIdx * 3) * buildings.length) % buildings.length];
    const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    props.push({ id: `b${i}`, x: dx, z, m: b.m, scale: b.s, ry: ry + (pr(i + 30, segIdx) - 0.5) * 0.3 });
  }

  const fillers = [
    { m: M_CARGO_AS, s: 2.6 }, { m: M_CARGO_BS, s: 2.6 }, { m: M_CONT_A, s: 3.4 },
    { m: M_CONT_B, s: 3.4 }, { m: M_CONT_C, s: 3.4 }, { m: M_ROCKS_A, s: 3.0 },
    { m: M_ROCKS_B, s: 3.0 }, { m: M_TRUCK, s: 3.0 }, { m: M_WIND_L, s: 2.8 },
    { m: M_STRUCT_L, s: 3.0 },
  ];
  const fillerCount = IS_MOBILE ? 10 : 18;
  for (let i = 0; i < fillerCount; i++) {
    const z = -half + i * (SEG_LEN / fillerCount) + (pr(i + 40, segIdx) - 0.5) * 3;
    const side = pr(i + 60, segIdx) > 0.5 ? 1 : -1;
    const dx = side * (9.6 + pr(i + 70, segIdx) * 1.8); // yol kenarına bitişik
    const f = fillers[Math.floor(pr(i + 80, segIdx * 5) * fillers.length) % fillers.length];
    props.push({ id: `f${i}`, x: dx, z, m: f.m, scale: f.s, ry: pr(i + 90, segIdx) * Math.PI * 2 });
  }

  return props;
}

function SegmentContent({ segIdx }) {
  const props = useMemo(() => getSideProps(segIdx), [segIdx]);
  return (
    <>
      <RoadSegment />
      {props.map((p) => (
        <Model key={p.id} path={p.m} position={[p.x, 0, p.z]} scale={p.scale} rotation={[0, p.ry ?? 0, 0]} />
      ))}
    </>
  );
}

export default function SpaceEnvironment() {
  const speed = useGameStore((s) => s.speed);
  const phase = useGameStore((s) => s.phase);
  const posRef = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));
  const groupsRef = useRef([]);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const vel = (speed || 10) * delta;
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
        intensity={3.0}
        color="#ffb488"
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-near={1}
        shadow-camera-far={350}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      {/* karşı dolgu ışığı — modeller karanlıkta silüet kalmasın */}
      <directionalLight position={[-60, 40, 60]} intensity={1.1} color="#88aaff" />
      <hemisphereLight skyColor="#8877cc" groundColor="#221133" intensity={0.8} />
      <ambientLight intensity={0.7} color="#9988cc" />
      <Stars />
      <BigPlanet />
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
