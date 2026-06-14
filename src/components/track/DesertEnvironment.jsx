import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const SPC = '/assets/models/space/';
const M_ROCKET_BASE  = SPC + 'rocket_baseA.glb';
const M_ROCKET_TOP   = SPC + 'rocket_topA.glb';
const M_ROCKET_FINS  = SPC + 'rocket_finsA.glb';
const M_HANGAR_LG    = SPC + 'hangar_largeA.glb';
const M_HANGAR_RD    = SPC + 'hangar_roundA.glb';
const M_SAT_LG       = SPC + 'satelliteDish_large.glb';
const M_SAT_SM       = SPC + 'satelliteDish.glb';
const M_GENERATOR    = SPC + 'machine_generator.glb';
const M_ROCK_A       = SPC + 'rock_largeA.glb';
const M_ROCK_B       = SPC + 'rock_largeB.glb';
const M_CRATER       = SPC + 'crater.glb';
const M_CRATER_LG    = SPC + 'craterLarge.glb';

useGLTF.preload(M_ROCKET_BASE);
useGLTF.preload(M_ROCKET_TOP);
useGLTF.preload(M_ROCKET_FINS);
useGLTF.preload(M_HANGAR_LG);
useGLTF.preload(M_HANGAR_RD);
useGLTF.preload(M_SAT_LG);
useGLTF.preload(M_SAT_SM);
useGLTF.preload(M_GENERATOR);
useGLTF.preload(M_ROCK_A);
useGLTF.preload(M_ROCK_B);
useGLTF.preload(M_CRATER);
useGLTF.preload(M_CRATER_LG);

function cloneScene(scene) {
  const c = scene.clone(true);
  c.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return c;
}

function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(path);
  const clone = useMemo(() => cloneScene(scene), [scene]);
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  return <primitive object={clone} position={position} scale={s} rotation={rotation} />;
}

function Rocket({ position, ry = 0 }) {
  const bases = useGLTF(M_ROCKET_BASE);
  const tops  = useGLTF(M_ROCKET_TOP);
  const fins  = useGLTF(M_ROCKET_FINS);
  const base  = useMemo(() => cloneScene(bases.scene), [bases.scene]);
  const top   = useMemo(() => cloneScene(tops.scene),  [tops.scene]);
  const fin   = useMemo(() => cloneScene(fins.scene),  [fins.scene]);
  return (
    <group position={position} rotation={[0, ry, 0]}>
      <primitive object={fin}  scale={[2.2, 2.2, 2.2]} position={[0, 0,    0]} />
      <primitive object={base} scale={[2.2, 2.2, 2.2]} position={[0, 2.2,  0]} />
      <primitive object={top}  scale={[2.2, 2.2, 2.2]} position={[0, 4.4,  0]} />
    </group>
  );
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
        <boxGeometry args={[44, 0.10, SEG_LEN]} />
        <meshStandardMaterial color="#b84020" roughness={0.95} />
      </mesh>
      <mesh receiveShadow position={[31, 0.05, 0]}>
        <boxGeometry args={[44, 0.10, SEG_LEN]} />
        <meshStandardMaterial color="#b84020" roughness={0.95} />
      </mesh>
      {/* Road - 18 units wide so lanes at ±4 sit comfortably inside */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[18, 0.30, SEG_LEN]} />
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
  const speed   = useGameStore((s) => s.speed);
  const phase   = useGameStore((s) => s.phase);
  const groupsRef = useRef([]);
  const posRef    = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const vel = (speed || 10) * delta;
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

      {/* Mars lighting */}
      <ambientLight intensity={0.3} color="#220a00" />
      <directionalLight
        castShadow
        position={[60, 80, -100]}
        intensity={1.8}
        color="#ff7733"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <hemisphereLight skyColor="#ff5500" groundColor="#1a0800" intensity={0.5} />

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
