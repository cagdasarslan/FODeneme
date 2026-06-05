import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { horseRef } from '@/utils/horseRef';

const SPAWN_Z   = -90;
const RECYCLE_Z = 12;
const LANES     = [-4, 0, 4];
const SPAWN_INTERVAL = 45; // seconds

const shalMat = new THREE.MeshStandardMaterial({ color:'#ffd700', metalness:0.8, roughness:0.2, emissive:'#aa8800', emissiveIntensity:0.3 });
const tGeo    = new THREE.TorusGeometry(0.5, 0.15, 8, 20, Math.PI * 1.6);

function HorseshoeMesh() {
  return (
    <group rotation={[0, 0, Math.PI * 0.1]}>
      <mesh geometry={tGeo} material={shalMat} castShadow rotation={[Math.PI/2,0,0]} />
    </group>
  );
}

export default function SuperNalSpawner() {
  const phase = useGameStore(s => s.phase);

  const state = useRef({ x: 0, z: -200, active: false });
  const groupRef = useRef();
  const timerRef = useRef(0);
  const spinRef  = useRef(0);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const speed = useGameStore.getState().speed;
    const hx = horseRef.x;

    timerRef.current += delta;
    spinRef.current  += delta * 2;

    const s = state.current;
    if (s.active) {
      s.z += speed * delta;
      const grp = groupRef.current;
      if (grp) {
        grp.position.set(s.x, 1.2 + Math.sin(spinRef.current)*0.3, s.z);
        grp.rotation.y = spinRef.current;
        grp.visible = true;
      }

      if (s.z > RECYCLE_Z) {
        s.active = false;
        if (grp) grp.visible = false;
        timerRef.current = 0;
        return;
      }

      // Collection
      const dx = Math.abs(s.x - hx);
      const dz = Math.abs(s.z);
      if (dx < 1.8 && dz < 1.5) {
        s.active = false;
        if (grp) grp.visible = false;
        timerRef.current = 0;
        useGameStore.getState().activateMagnet();
      }
    } else if (timerRef.current >= SPAWN_INTERVAL) {
      timerRef.current = 0;
      s.x = LANES[Math.floor(Math.random() * LANES.length)];
      s.z = SPAWN_Z;
      s.active = true;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <HorseshoeMesh />
      <pointLight color="#ffd700" intensity={2} distance={8} />
    </group>
  );
}
