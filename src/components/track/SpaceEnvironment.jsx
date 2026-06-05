import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const ROAD_COLOR = '#6b3a2a';
const GROUND_COLOR = '#2a1a35';

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
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
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
      {/* Ring */}
      <mesh rotation={[Math.PI * 0.15, 0, 0]}>
        <torusGeometry args={[44, 3, 4, 64]} />
        <meshStandardMaterial color="#9b6fc0" roughness={0.8} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function ProceduralCrater({ position, radius = 1.5 }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.7, radius, 16]} />
        <meshStandardMaterial color="#3d2255" roughness={1} />
      </mesh>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.65, 16]} />
        <meshStandardMaterial color="#1e0f2a" roughness={1} />
      </mesh>
    </group>
  );
}

function ProceduralSpaceRock({ position, scale = 1 }) {
  return (
    <mesh castShadow position={position} scale={[scale * 0.7, scale * 0.5, scale * 0.7]}>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#4a3060" roughness={0.95} metalness={0.2} />
    </mesh>
  );
}

function ProceduralRocket({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 3, 8]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <coneGeometry args={[0.3, 1, 8]} />
        <meshStandardMaterial color="#cc4444" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-0.5, 0.5].map((dx) => (
        <mesh key={dx} castShadow position={[dx, 0.8, 0]} rotation={[0, 0, dx > 0 ? 0.4 : -0.4]}>
          <boxGeometry args={[0.15, 0.8, 0.4]} />
          <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function RoadSegment() {
  return (
    <group>
      {/* Alien ground on sides */}
      <mesh receiveShadow position={[-22, 0.05, 0]}>
        <boxGeometry args={[44, 0.10, SEG_LEN]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[22, 0.05, 0]}>
        <boxGeometry args={[44, 0.10, SEG_LEN]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      {/* Road - exactly 9 units wide, dark reddish-brown */}
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[9, 0.30, SEG_LEN]} />
        <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
      </mesh>
      {/* Lane markings at x=-4 and x=4 */}
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

function getSideProps(segIdx) {
  const props = [];
  const pseudoRand = (n) => ((Math.sin(n * 127.1 + segIdx * 311.7) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 6; i++) {
    const localZ = -SEG_LEN / 2 + pseudoRand(i * 3) * SEG_LEN;
    const lx = -(6.5 + pseudoRand(i * 3 + 1) * 12);
    const rx = 6.5 + pseudoRand(i * 3 + 2) * 12;
    const r = pseudoRand(i * 5);
    const type = r < 0.3 ? 'crater' : r < 0.65 ? 'rock' : 'rocket';
    const scale = 0.5 + pseudoRand(i * 11) * 1.0;
    const craterR = 0.8 + pseudoRand(i * 13) * 1.5;
    props.push({ id: `l${i}`, x: lx, z: localZ, type, scale, craterR });
    props.push({ id: `r${i}`, x: rx, z: localZ, type, scale, craterR });
  }
  return props;
}

function SegmentContent({ segIdx }) {
  const sideProps = getSideProps(segIdx);
  return (
    <>
      <RoadSegment />
      {sideProps.map((p) => {
        if (p.type === 'crater') return <ProceduralCrater key={p.id} position={[p.x, 0.11, p.z]} radius={p.craterR} />;
        if (p.type === 'rocket') return <ProceduralRocket key={p.id} position={[p.x, 0, p.z]} />;
        return <ProceduralSpaceRock key={p.id} position={[p.x, 0, p.z]} scale={p.scale} />;
      })}
    </>
  );
}

export default function SpaceEnvironment() {
  const speed = useGameStore((s) => s.speed);
  const running = useGameStore((s) => s.running);
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
      <color attach="background" args={['#0d0518']} />
      {/* SpaceEnvironment manages its own lights */}
      <directionalLight
        castShadow
        position={[80, 60, -150]}
        intensity={2.6}
        color="#ff8844"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={350}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <hemisphereLight skyColor="#6622aa" groundColor="#110022" intensity={0.4} />
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
