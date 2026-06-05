import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Sky } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const ROAD_COLOR = '#8b7355';
const SAND_COLOR = '#c2955a';

function RoadSegment() {
  return (
    <group>
      {/* Sand ground on sides */}
      <mesh receiveShadow position={[-22, 0.05, 0]}>
        <boxGeometry args={[44, 0.10, SEG_LEN]} />
        <meshStandardMaterial color={SAND_COLOR} />
      </mesh>
      <mesh receiveShadow position={[22, 0.05, 0]}>
        <boxGeometry args={[44, 0.10, SEG_LEN]} />
        <meshStandardMaterial color={SAND_COLOR} />
      </mesh>
      {/* Road - exactly 9 units wide */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[9, 0.30, SEG_LEN]} />
        <meshStandardMaterial color={ROAD_COLOR} />
      </mesh>
      {/* Lane markings at x=-4 and x=4 */}
      {[-4, 4].map((x) =>
        Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`lm-${x}-${i}`} position={[x, 0.31, -SEG_LEN / 2 + 8 + i * 14]}>
            <boxGeometry args={[0.15, 0.02, 5]} />
            <meshStandardMaterial color="#e8d5a0" />
          </mesh>
        ))
      )}
    </group>
  );
}

function ProceduralCactus({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 2.4, 8]} />
        <meshStandardMaterial color="#5a8a3a" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[-0.42, 1.6, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.8, 8]} />
        <meshStandardMaterial color="#5a8a3a" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0.42, 1.4, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.6, 8]} />
        <meshStandardMaterial color="#5a8a3a" roughness={0.8} />
      </mesh>
    </group>
  );
}

function ProceduralRock({ position, scale = 1 }) {
  return (
    <mesh castShadow position={position} scale={[scale * 0.8, scale * 0.55, scale * 0.8]}>
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color="#a08060" roughness={0.9} />
    </mesh>
  );
}

function getSideProps(segIdx) {
  const props = [];
  const pseudoRand = (n) => ((Math.sin(n * 127.1 + segIdx * 311.7) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 7; i++) {
    const localZ = -SEG_LEN / 2 + pseudoRand(i * 3) * SEG_LEN;
    const lx = -(6.5 + pseudoRand(i * 3 + 1) * 12);
    const rx = 6.5 + pseudoRand(i * 3 + 2) * 12;
    const type = pseudoRand(i * 7) > 0.45 ? 'cactus' : 'rock';
    const scale = 0.5 + pseudoRand(i * 11) * 1.0;
    props.push({ id: `l${i}`, x: lx, z: localZ, type, scale });
    props.push({ id: `r${i}`, x: rx, z: localZ, type, scale });
  }
  return props;
}

function SegmentContent({ segIdx }) {
  const sideProps = getSideProps(segIdx);
  return (
    <>
      <RoadSegment />
      {sideProps.map((p) =>
        p.type === 'cactus' ? (
          <ProceduralCactus key={p.id} position={[p.x, 0, p.z]} />
        ) : (
          <ProceduralRock key={p.id} position={[p.x, 0, p.z]} scale={p.scale} />
        )
      )}
    </>
  );
}

export default function DesertEnvironment() {
  const speed = useGameStore((s) => s.speed);
  const running = useGameStore((s) => s.running);
  const segRefs = useRef(Array.from({ length: SEG_COUNT }, () => ({ ref: null })));
  const posRef = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));
  const groupsRef = useRef([]);

  useFrame((_, delta) => {
    if (!running) return;
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
      <Sky
        sunPosition={[100, 20, -200]}
        turbidity={8}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.52}
        azimuth={0.25}
      />
      {/* Warm orange desert sun - no ambientLight/hemiLight, those come from App.jsx */}
      <directionalLight
        castShadow
        position={[60, 80, -100]}
        intensity={2.2}
        color="#ffbb66"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
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
