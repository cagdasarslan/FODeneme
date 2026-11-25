import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP, IS_MOBILE } from '@/utils/device';
import { makeMats, makeP } from '@/utils/procKit';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const ROAD_COLOR = '#6b3a2a';
const GROUND_COLOR = '#2a1a35';
const ROAD_W = 18;

// ── Üs yapıları kodla üretilir ──────────────────────────────────────────────
// Eskiden 26 KayKit modeli (yapı başına 500-1.500 üçgen); şimdi aynı ölçüde
// kutu/kubbe/silindir gövdeler. Birim ölçüde (~2 m taban) çizilir.
const MAT = makeMats({
  hull: '#d9dde3', hull2: '#b8c0cc', dark: '#4a5060', orange: '#e0702c', teal: '#3fb6b0',
  glass: { color: '#7fd0ff', emissive: '#2a8cff', emissiveIntensity: 0.6 },
  solar: { color: '#1d2a5a', metalness: 0.4, roughness: 0.3 },
  rock: '#7a3e2c', rock2: '#5e2f22', cargo: '#c9a23a', cargo2: '#5a7fa8',
});
const P = makeP(MAT);
const Dome = ({ r = 1, h = 1, m = 'hull' }) => <P g="dome" m={m} p={[0, 0, 0]} s={[r, h, r]} />;
const Window = ({ y = 0.45, z = 0.9, w = 0.6 }) => <P g="box" m="glass" p={[0, y, z]} s={[w, 0.18, 0.04]} />;
function BaseModule({ v = 0 }) {
  return (<>
    <P g="cyl12" m="hull2" p={[0, 0, 0]} s={[1, 0.3, 1]} />
    <group position={[0, 0.3, 0]}><Dome r={0.95} h={0.7} m={v === 1 ? 'hull2' : 'hull'} /></group>
    <Window y={0.45} z={0.88} />
    <P g="box" m={v === 2 ? 'teal' : 'orange'} p={[0, 0, 1.0]} s={[0.4, 0.55, 0.3]} />
  </>);
}
function Garage() {
  return (<>
    <P g="box" m="hull" p={[0, 0, 0]} s={[2, 0.8, 2]} />
    <P g="box" m="dark" p={[0, 0, 1.0]} s={[1.2, 0.6, 0.04]} />
    <P g="box" m="orange" p={[0, 0.8, 0]} s={[2.05, 0.08, 2.05]} />
  </>);
}
function Depot({ v = 0 }) {
  return (<>
    <P g="box" m="hull2" p={[0, 0, 0]} s={[2, 0.15, 2]} />
    <P g="box" m={v ? 'cargo2' : 'cargo'} p={[-0.45, 0.15, 0]} s={[0.8, 0.8, 1.6]} />
    <P g="box" m={v ? 'cargo' : 'cargo2'} p={[0.5, 0.15, -0.3]} s={[0.7, 0.6, 0.7]} />
  </>);
}
function Struct({ h = 2 }) {
  return (<>
    {[[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].map(([x, z], i) => (
      <P key={i} g="box" m="dark" p={[x, 0, z]} s={[0.12, h, 0.12]} />
    ))}
    <P g="box" m="hull2" p={[0, h * 0.5, 0]} s={[1.6, 0.08, 1.6]} />
    <P g="box" m="orange" p={[0, h, 0]} s={[1.7, 0.1, 1.7]} />
  </>);
}
function Drill() {
  return (<>
    <Struct h={1.4} />
    <P g="cone8" m="orange" p={[0, 1.5, 0]} s={[0.35, 0.6, 0.35]} r={[Math.PI, 0, 0]} />
    <P g="cyl8" m="dark" p={[0, 0, 0]} s={[0.12, 2, 0.12]} />
  </>);
}
function Turbine({ h = 1.7 }) {
  return (<>
    <P g="cyl8" m="hull" p={[0, 0, 0]} s={[0.07, h, 0.07]} />
    {[0, 1, 2].map((i) => (
      <P key={i} g="box" m="hull2" p={[0, h, 0.1]} s={[0.1, 0.8, 0.03]} r={[0, 0, (i * 2 * Math.PI) / 3]} />
    ))}
  </>);
}
function Pad() {
  return (<>
    <P g="cyl12" m="dark" p={[0, 0, 0]} s={[1.25, 0.15, 1.25]} />
    <P g="cyl12" m="orange" p={[0, 0.15, 0]} s={[0.9, 0.02, 0.9]} />
    <P g="cyl12" m="dark" p={[0, 0.16, 0]} s={[0.75, 0.02, 0.75]} />
  </>);
}
function Lander() {
  return (<>
    {[0, 1, 2, 3].map((i) => (
      <P key={i} g="box" m="dark" p={[Math.cos(i * 1.57) * 0.5, 0, Math.sin(i * 1.57) * 0.5]} s={[0.06, 0.45, 0.06]} />
    ))}
    <P g="cyl8" m="hull" p={[0, 0.4, 0]} s={[0.5, 0.35, 0.5]} />
    <P g="cone8" m="hull2" p={[0, 0.75, 0]} s={[0.5, 0.45, 0.5]} />
    <Window y={0.5} z={0.48} w={0.3} />
  </>);
}
function Solar() {
  return (<>
    <P g="box" m="dark" p={[0, 0, 0]} s={[0.08, 0.3, 0.08]} />
    <P g="box" m="solar" p={[0, 0.3, 0]} s={[1.4, 0.04, 1.0]} r={[0.35, 0, 0]} />
  </>);
}
function Tunnel() {
  return <P g="cyl12" m="hull2" p={[-1, 0.5, 0]} s={[0.3, 2, 0.3]} r={[0, 0, -Math.PI / 2]} />;
}
function CargoStack() {
  return (<>
    <P g="box" m="cargo" p={[0, 0, 0]} s={[1, 0.5, 1]} />
    <P g="box" m="cargo2" p={[0, 0.5, 0]} s={[0.95, 0.5, 0.95]} r={[0, 0.3, 0]} />
  </>);
}
const Container = ({ m }) => <P g="box" m={m} p={[0, 0, 0]} s={[0.5, 0.2, 0.5]} />;
function Rocks({ big }) {
  return [[0, 0, 0.55], [0.55, 0.3, 0.35], [-0.5, -0.3, 0.3]].map(([x, z, r], i) => (
    <P key={i} g="rock" m={i ? 'rock2' : 'rock'} p={[x, r * (big ? 0.8 : 0.3), z]} s={[r, r * (big ? 1.4 : 0.6), r]} r={[0, i, 0]} />
  ));
}
function Truck() {
  return (<>
    <P g="box" m="hull" p={[0, 0.1, 0]} s={[0.45, 0.25, 0.85]} />
    <P g="box" m="glass" p={[0, 0.35, 0.25]} s={[0.4, 0.14, 0.25]} />
    {[[-0.24, -0.28], [0.24, -0.28], [-0.24, 0.28], [0.24, 0.28]].map(([x, z], i) => (
      <P key={i} g="cyl8" m="dark" p={[x, 0.1, z]} s={[0.1, 0.06, 0.1]} r={[0, 0, Math.PI / 2]} />
    ))}
  </>);
}
const ITEMS = {
  baseA: () => <BaseModule v={0} />, baseB: () => <BaseModule v={1} />, baseC: () => <BaseModule v={2} />,
  garage: () => <Garage />, depotA: () => <Depot v={0} />, depotB: () => <Depot v={1} />,
  structT: () => <Struct h={2} />, structL: () => <Struct h={1} />, drill: () => <Drill />,
  windT: () => <Turbine h={1.7} />, windL: () => <Turbine h={0.6} />, pad: () => <Pad />,
  lander: () => <Lander />, solar: () => <Solar />, tunnel: () => <Tunnel />,
  cargoA: () => <CargoStack />, cargoB: () => <CargoStack />,
  contA: () => <Container m="cargo" />, contB: () => <Container m="cargo2" />, contC: () => <Container m="teal" />,
  rocksA: () => <Rocks />, rocksB: () => <Rocks big />, truck: () => <Truck />,
};
const M_BASE_A = 'baseA', M_BASE_B = 'baseB', M_BASE_C = 'baseC', M_BASE_GAR = 'garage', M_DEPOT_A = 'depotA',
  M_DEPOT_B = 'depotB', M_STRUCT_T = 'structT', M_STRUCT_L = 'structL', M_DRILL = 'drill', M_WIND_T = 'windT',
  M_WIND_L = 'windL', M_PAD_LG = 'pad', M_LANDER_A = 'lander', M_SOLAR = 'solar', M_TUNNEL = 'tunnel',
  M_CARGO_AS = 'cargoA', M_CARGO_BS = 'cargoB', M_CONT_A = 'contA', M_CONT_B = 'contB', M_CONT_C = 'contC',
  M_ROCKS_A = 'rocksA', M_ROCKS_B = 'rocksB', M_TRUCK = 'truck';

function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const make = ITEMS[path];
  return <group position={position} scale={scale} rotation={rotation}>{make ? make() : null}</group>;
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

const stripMat = new THREE.MeshStandardMaterial({ color: '#3a2a50', emissive: '#ff5522', emissiveIntensity: 0.6 });

function RoadSegment() {
  return (
    <group>
      {/* Geniş zemin — harita dışını (boşluğu) kapatır */}
      <mesh receiveShadow position={[-109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      {/* yol kenarı ışık şeridi */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 9.4, 0.7, 0]} material={stripMat}>
          <boxGeometry args={[0.25, 0.25, SEG_LEN]} />
        </mesh>
      ))}
      {/* Yol — 18 birim */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[ROAD_W, 0.30, SEG_LEN + 0.6]} />
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

  // Assetler 2 kat büyütüldü; yola taşmaması için x dışarı kaydırıldı
  const buildings = [
    { m: M_BASE_A, s: 6.4 }, { m: M_BASE_B, s: 6.4 }, { m: M_BASE_C, s: 6.4 },
    { m: M_BASE_GAR, s: 6.4 }, { m: M_DEPOT_A, s: 6.0 }, { m: M_DEPOT_B, s: 6.0 },
    { m: M_STRUCT_T, s: 6.8 }, { m: M_DRILL, s: 6.4 }, { m: M_WIND_T, s: 6.8 },
    { m: M_PAD_LG, s: 5.6 }, { m: M_LANDER_A, s: 6.0 }, { m: M_SOLAR, s: 6.0 },
    { m: M_TUNNEL, s: 6.4 },
  ];
  const buildingCount = IS_MOBILE ? 8 : 14;
  for (let i = 0; i < buildingCount; i++) {
    const z = -half + 4 + i * (SEG_LEN / buildingCount) + (pr(i, segIdx) - 0.5) * 3;
    const side = i % 2 === 0 ? -1 : 1;
    const dx = side * (18 + pr(i + 5, segIdx) * 4); // büyük yapılar yoldan uzak
    const b = buildings[Math.floor(pr(i + 20, segIdx * 3) * buildings.length) % buildings.length];
    const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    props.push({ id: `b${i}`, x: dx, z, m: b.m, scale: b.s, ry: ry + (pr(i + 30, segIdx) - 0.5) * 0.3 });
  }

  const fillers = [
    { m: M_CARGO_AS, s: 5.2 }, { m: M_CARGO_BS, s: 5.2 }, { m: M_CONT_A, s: 6.8 },
    { m: M_CONT_B, s: 6.8 }, { m: M_CONT_C, s: 6.8 }, { m: M_ROCKS_A, s: 6.0 },
    { m: M_ROCKS_B, s: 6.0 }, { m: M_TRUCK, s: 6.0 }, { m: M_WIND_L, s: 5.6 },
    { m: M_STRUCT_L, s: 6.0 },
  ];
  const fillerCount = IS_MOBILE ? 10 : 18;
  for (let i = 0; i < fillerCount; i++) {
    const z = -half + i * (SEG_LEN / fillerCount) + (pr(i + 40, segIdx) - 0.5) * 3;
    const side = pr(i + 60, segIdx) > 0.5 ? 1 : -1;
    const dx = side * (13 + pr(i + 70, segIdx) * 4); // yol kenarının dışında
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
  const phase = useGameStore((s) => s.phase);
  const posRef = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));
  const groupsRef = useRef([]);

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
