import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP, IS_MOBILE } from '@/utils/device';
import { G, makeMats, makeP } from '@/utils/procKit';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

// Mars dekoru kodla üretilir (eskiden 12 space-kit GLB). Ölçüler GLB sınır
// kutularından; kitin orijin kayması (merkez ≈ x2, z1.5) da korunur ki
// yerleşim/döndürme eskisiyle aynı görünsün.
const DM = makeMats({
  hull: '#e4e2dc', hullDk: '#a8a8a8', red: '#c8402c', metal: '#8a8e94', metalDk: '#55595e',
  panel: '#2c4c7a', window: { color: '#9cd8ff', emissive: '#4aa8e0', emissiveIntensity: 0.5 },
  glow: { color: '#ffb070', emissive: '#ff7a20', emissiveIntensity: 0.9 },
  rock: '#8a3a1e', rock2: '#a04a26', rockDk: '#6a2a14', craterIn: '#5e2410', craterRim: '#a8482a',
  door: '#3a3e44', yellow: '#e0b030',
});
const P = makeP(DM);
const C = ({ c, children }) => <group position={[c[0], 0, c[1]]}>{children}</group>;

// hangar_largeA: 2 × 3, H 1.0 — tonoz çatılı hangar
function HangarLg() {
  return (<C c={[2, 1.5]}>
    <P g="box" m="hullDk" p={[0, 0, 0]} s={[2, 0.5, 2.9]} />
    <P g="halfCylZ" m="hull" p={[0, 0.5, 0]} s={[1, 0.5, 3]} />
    <P g="box" m="door" p={[0, 0, 1.45]} s={[1.2, 0.7, 0.04]} />
    <P g="box" m="yellow" p={[0, 0.7, 1.46]} s={[1.3, 0.05, 0.04]} />
    <P g="box" m="metalDk" p={[1.0, 0, -0.6]} s={[0.08, 0.35, 0.8]} />
  </C>);
}
// hangar_roundA: 3.3 × 2.8, H 1.5 — kubbe + giriş tüneli
function HangarRd() {
  return (<C c={[2, 1.5]}>
    <P g="cyl12" m="hullDk" p={[0, 0, 0]} s={[1.38, 0.15, 1.2]} />
    <mesh geometry={G.dome} material={DM.hull} position={[0, 0.15, 0]} scale={[1.38, 1.35, 1.2]} castShadow={!IS_MOBILE} receiveShadow={!IS_MOBILE} />
    <P g="halfCylZ" m="hull" p={[0, 0, 1.2]} s={[0.4, 0.55, 0.6]} />
    <P g="box" m="door" p={[0, 0, 1.5]} s={[0.5, 0.45, 0.03]} />
    <P g="box" m="window" p={[0, 1.0, 0.78]} s={[0.6, 0.12, 0.05]} r={[-0.6, 0, 0]} />
  </C>);
}
// satelliteDish(_large): 0.84 / 0.68 genişlik, H 0.81 / 0.62
function Dish({ big }) {
  return (<C c={big ? [2, 1.4] : [2, 1.465]}>
    <group scale={big ? 1 : 0.77}>
      <P g="box" m="metalDk" p={[0, 0, 0]} s={[0.36, 0.08, 0.36]} />
      <P g="cyl8" m="metal" p={[0, 0.08, 0]} s={[0.04, 0.3, 0.04]} />
      <group position={[0, 0.48, 0]} rotation={[-0.7, 0, 0]}>
        <mesh geometry={G.dome} material={DM.hull} scale={[0.4, -0.14, 0.4]} castShadow={!IS_MOBILE} />
        <P g="cyl8" m="metal" p={[0, 0, 0]} s={[0.012, 0.3, 0.012]} />
        <P g="box" m="red" p={[0, 0.3, 0]} s={[0.05, 0.05, 0.05]} />
      </group>
    </group>
  </C>);
}
// machine_generator: 0.7 × 0.53, H 0.4
function Generator() {
  return (<C c={[1.95, 1.435]}>
    <P g="box" m="metal" p={[-0.08, 0, 0]} s={[0.5, 0.3, 0.5]} />
    <P g="box" m="metalDk" p={[-0.08, 0.3, 0]} s={[0.4, 0.04, 0.4]} />
    <P g="cyl8" m="hull" p={[0.26, 0, 0.12]} s={[0.08, 0.4, 0.08]} />
    <P g="cyl8" m="hull" p={[0.26, 0, -0.12]} s={[0.08, 0.36, 0.08]} />
    <P g="box" m="glow" p={[-0.08, 0.12, 0.251]} s={[0.3, 0.06, 0.01]} />
    <P g="box" m="yellow" p={[-0.08, 0.02, 0.252]} s={[0.5, 0.03, 0.01]} />
  </C>);
}
// rock_largeA/B: 0.92 × 0.85, H 0.5 — kaya kümesi
function Rocks({ b }) {
  const parts = b
    ? [[0.1, 0.05, 0.32, 0.5], [-0.25, 0.2, 0.2, 0.3], [0.25, -0.28, 0.16, 0.22]]
    : [[-0.1, 0, 0.3, 0.48], [0.25, 0.15, 0.22, 0.32], [-0.2, -0.3, 0.14, 0.2], [0.15, -0.25, 0.12, 0.15]];
  return (<C c={[2.0, 1.5]}>
    {parts.map(([x, z, r, h], i) => (
      <P key={i} g="rock" m={['rock', 'rock2', 'rockDk', 'rock'][i]} p={[x, h * 0.42, z]} s={[r, h * 0.62, r * 0.9]} r={[0, i * 1.7 + (b ? 0.5 : 0), 0]} />
    ))}
  </C>);
}
// crater: 0.72 × 0.82, H 0.12 — sığ çanak
function Crater() {
  return (<C c={[2, 1.5]}>
    <P g="cyl12" m="craterRim" p={[0, 0, 0]} s={[0.38, 0.1, 0.4]} />
    <P g="cyl12" m="craterIn" p={[0, 0.1, 0]} s={[0.27, 0.012, 0.29]} />
    <P g="rock" m="rockDk" p={[0.33, 0.04, 0.12]} s={[0.06, 0.05, 0.06]} />
  </C>);
}
// Roket: eski üç parça (yüzgeç + gövde + burun, ×2.2) ≈ 6.2 m; merkez (4.4, 3.3)
function Rocket({ position, ry = 0 }) {
  return (
    <group position={position} rotation={[0, ry, 0]}>
      <group position={[4.4, 0, 3.3]}>
        <P g="cyl8" m="metalDk" p={[0, 0, 0]} s={[1.3, 0.12, 1.3]} />
        <P g="cone8" m="metalDk" p={[0, 0.12, 0]} s={[0.55, 0.6, 0.55]} />
        <P g="cyl12" m="hull" p={[0, 0.7, 0]} s={[0.75, 3.4, 0.75]} />
        <P g="cyl12" m="red" p={[0, 2.4, 0]} s={[0.77, 0.3, 0.77]} />
        <P g="cone8" m="red" p={[0, 4.1, 0]} s={[0.75, 2.05, 0.75]} />
        <P g="box" m="window" p={[0, 3.3, 0.7]} s={[0.35, 0.35, 0.12]} />
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, k * Math.PI / 2 + Math.PI / 4, 0]}>
            <P g="box" m="red" p={[0, 0.5, 0.95]} s={[0.1, 1.3, 0.75]} />
          </group>
        ))}
        {[-1, 1].map((sx) => (<group key={sx}>
          <P g="cyl8" m="hullDk" p={[sx * 1.0, 0.5, 0]} s={[0.28, 2.2, 0.28]} />
          <P g="cone8" m="red" p={[sx * 1.0, 2.7, 0]} s={[0.28, 0.6, 0.28]} />
        </group>))}
      </group>
    </group>
  );
}

const ITEMS = {
  hangarLg: () => <HangarLg />, hangarRd: () => <HangarRd />, satLg: () => <Dish big />, satSm: () => <Dish />,
  generator: () => <Generator />, rockA: () => <Rocks />, rockB: () => <Rocks b />, crater: () => <Crater />,
};
const M_HANGAR_LG = 'hangarLg', M_HANGAR_RD = 'hangarRd', M_SAT_LG = 'satLg', M_SAT_SM = 'satSm',
  M_GENERATOR = 'generator', M_ROCK_A = 'rockA', M_ROCK_B = 'rockB', M_CRATER = 'crater';

function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  const make = ITEMS[path];
  return <group position={position} scale={s} rotation={rotation}>{make ? make() : null}</group>;
}

// Stars procedural
function Stars() {
  const geo = useMemo(() => {
    const positions = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
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
      <pointsMaterial color="#ffffff" size={0.7} sizeAttenuation />
    </points>
  );
}

function Planet() {
  return (
    <mesh position={[120, 80, -400]}>
      <sphereGeometry args={[38, 32, 32]} />
      <meshStandardMaterial color="#3a7acc" roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

function RoadSegment() {
  return (
    <group>
      {/* Mars terrain sides — starts after road edge at ±9 */}
      <mesh receiveShadow position={[-31, 0.05, 0]}>
        <boxGeometry args={[44, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color="#b84020" roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[31, 0.05, 0]}>
        <boxGeometry args={[44, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color="#b84020" roughness={0.95} />
      </mesh>
      {/* Road - 18 units wide so lanes at ±4 sit comfortably inside */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[18, 0.30, SEG_LEN + 0.6]} />
        <meshStandardMaterial color="#7a3018" roughness={0.85} />
      </mesh>
      {/* Lane markings */}
      {[-4, 4].map((x) =>
        Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`lm-${x}-${i}`} position={[x, 0.31, -SEG_LEN / 2 + 8 + i * 14]}>
            <boxGeometry args={[0.15, 0.02, 5]} />
            <meshStandardMaterial color="#ff9944" emissive="#ff6600" emissiveIntensity={0.3} />
          </mesh>
        ))
      )}
    </group>
  );
}

// Deterministic pseudo-random
function pr(a, b = 0) {
  return (((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1) + 1) % 1;
}

function getSideProps(segIdx) {
  const props = [];

  // Near zone: craters + rocks (dx 7-14)
  for (let i = 0; i < 5; i++) {
    const z   = -SEG_LEN / 2 + pr(i, segIdx * 3 + 0) * SEG_LEN;
    const dxL = -(9.5 + pr(i, segIdx * 3 + 1) * 7);
    const dxR =   9.5 + pr(i, segIdx * 3 + 2) * 7;
    const t   = pr(i + 10, segIdx) > 0.5 ? 'crater' : 'rock';
    props.push({ id: `nL${i}`, x: dxL, z, type: t });
    props.push({ id: `nR${i}`, x: dxR, z, type: t });
  }

  // Mid zone: generators + small satellite dishes (dx 16-24)
  for (let i = 0; i < 4; i++) {
    const z   = -SEG_LEN / 2 + pr(i + 20, segIdx * 5) * SEG_LEN;
    const side = pr(i + 30, segIdx) > 0.5 ? 1 : -1;
    const dx  = side * (16 + pr(i + 40, segIdx) * 8);
    const t   = pr(i + 50, segIdx) > 0.45 ? 'generator' : 'satSm';
    props.push({ id: `mM${i}`, x: dx, z, type: t });
  }

  // Far zone: rockets, large hangars, large dishes (dx 22-38)
  for (let i = 0; i < 6; i++) {
    const z    = -SEG_LEN / 2 + pr(i + 60, segIdx * 7) * SEG_LEN;
    const side = pr(i + 70, segIdx) > 0.5 ? 1 : -1;
    const dx   = side * (22 + pr(i + 80, segIdx) * 16);
    const ry   = pr(i + 90, segIdx) * Math.PI * 2;
    const bucket = pr(i + 100, segIdx);
    let type;
    if (bucket < 0.25)       type = 'rocket';
    else if (bucket < 0.5)   type = 'hangarLg';
    else if (bucket < 0.75)  type = 'hangarRd';
    else                     type = 'satLg';
    props.push({ id: `fF${i}`, x: dx, z, type, ry });
  }

  // Rock clusters far (dx 28-50)
  for (let i = 0; i < 4; i++) {
    const z   = -SEG_LEN / 2 + pr(i + 110, segIdx * 9) * SEG_LEN;
    const dxL = -(28 + pr(i + 120, segIdx) * 22);
    const dxR =   28 + pr(i + 130, segIdx) * 22;
    props.push({ id: `rkL${i}`, x: dxL, z, type: 'rockA', scale: 1.2 + pr(i + 140, segIdx) * 1.5 });
    props.push({ id: `rkR${i}`, x: dxR, z, type: 'rockB', scale: 1.2 + pr(i + 150, segIdx) * 1.5 });
  }

  return props;
}

function PropItem({ p }) {
  const y = 0;
  const ry = p.ry ?? 0;
  switch (p.type) {
    case 'rocket':    return <Rocket position={[p.x, y, p.z]} ry={ry} />;
    case 'hangarLg':  return <Model path={M_HANGAR_LG} position={[p.x, y, p.z]} scale={2.0} rotation={[0, ry, 0]} />;
    case 'hangarRd':  return <Model path={M_HANGAR_RD} position={[p.x, y, p.z]} scale={2.0} rotation={[0, ry, 0]} />;
    case 'satLg':     return <Model path={M_SAT_LG}    position={[p.x, y, p.z]} scale={2.2} rotation={[0, ry, 0]} />;
    case 'satSm':     return <Model path={M_SAT_SM}    position={[p.x, y, p.z]} scale={1.6} rotation={[0, ry, 0]} />;
    case 'generator': return <Model path={M_GENERATOR} position={[p.x, y, p.z]} scale={1.5} rotation={[0, ry, 0]} />;
    case 'crater':    return <Model path={M_CRATER}    position={[p.x, y, p.z]} scale={1.4} />;
    case 'rock':      return <Model path={M_ROCK_A}    position={[p.x, y, p.z]} scale={1.2} rotation={[0, ry, 0]} />;
    case 'rockA':     return <Model path={M_ROCK_A}    position={[p.x, y, p.z]} scale={p.scale ?? 1} rotation={[0, ry, 0]} />;
    case 'rockB':     return <Model path={M_ROCK_B}    position={[p.x, y, p.z]} scale={p.scale ?? 1} rotation={[0, ry, 0]} />;
    default:          return null;
  }
}

function SegmentContent({ segIdx }) {
  const props = useMemo(() => getSideProps(segIdx), [segIdx]);
  return (
    <>
      <RoadSegment />
      {props.map((p) => <PropItem key={p.id} p={p} />)}
    </>
  );
}

export default function DesertEnvironment() {
  const phase   = useGameStore((s) => s.phase);
  const groupsRef = useRef([]);
  const posRef    = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));

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
