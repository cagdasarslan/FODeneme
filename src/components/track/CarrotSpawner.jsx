import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { horseRef } from '@/utils/horseRef';

const SPAWN_Z    = -90;
const RECYCLE_Z  = 12;
const POOL       = 80;
const LANES      = [-4, 0, 4];
const COLLECT_DX = 1.4;
const COLLECT_DZ = 1.2;
const MAGNET_RANGE = 18;
const MAGNET_PULL  = 12; // units per second
const FORMATION_INTERVAL = 2.8; // seconds between formations

// Formation patterns
const FORMATIONS = [
  // LINE_LEFT: 15 carrots down left lane
  () => Array.from({length:15}, (_,i) => ({ x:-4, z: SPAWN_Z - i*2.5 })),
  // LINE_CENTER: 15 carrots down center lane
  () => Array.from({length:15}, (_,i) => ({ x:0,  z: SPAWN_Z - i*2.5 })),
  // LINE_RIGHT: 15 carrots down right lane
  () => Array.from({length:15}, (_,i) => ({ x:4,  z: SPAWN_Z - i*2.5 })),
  // ALL_LANES: rows of 3 carrots
  () => Array.from({length:6}, (_,i) => [
    { x:-4, z: SPAWN_Z - i*5 },
    { x:0,  z: SPAWN_Z - i*5 },
    { x:4,  z: SPAWN_Z - i*5 },
  ]).flat(),
  // ZIGZAG: alternating lanes
  () => Array.from({length:18}, (_,i) => ({ x: LANES[i%3], z: SPAWN_Z - i*2 })),
];

const carrotMat  = new THREE.MeshStandardMaterial({ color: '#ff7700', roughness:0.6 });
const leafMat    = new THREE.MeshStandardMaterial({ color: '#22aa22', roughness:0.8 });
const carrotGeo  = new THREE.ConeGeometry(0.22, 0.8, 6);
const leafGeo    = new THREE.SphereGeometry(0.18, 6, 4);

function CarrotMesh() {
  return (
    <group rotation={[0, 0, Math.PI]}>
      <mesh geometry={carrotGeo} material={carrotMat} castShadow />
      <mesh geometry={leafGeo} material={leafMat} position={[0, -0.5, 0]} />
    </group>
  );
}

export default function CarrotSpawner() {
  const phase = useGameStore(s => s.phase);
  const runId = useGameStore(s => s.runId);
  const magnetActive = useGameStore(s => s.magnetActive);

  const poolRef = useRef(
    Array.from({ length: POOL }, (_, i) => ({
      id: i, x: 0, z: SPAWN_Z - i * 50, active: false,
    }))
  );
  const groupRefs = useRef(Array(POOL).fill(null));
  const timerRef  = useRef(0);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const speed = useGameStore.getState().speed;
    const hx = horseRef.x;
    const magnetOn = useGameStore.getState().magnetActive;

    timerRef.current += delta;

    // Move and collect
    let collected = 0;
    poolRef.current.forEach((c, i) => {
      if (!c.active) return;
      c.z += speed * delta;

      // Magnet pull
      if (magnetOn && c.z > SPAWN_Z && c.z < RECYCLE_Z) {
        const dist = Math.abs(c.x - hx);
        if (dist < MAGNET_RANGE) {
          const dir = hx > c.x ? 1 : -1;
          c.x += dir * Math.min(dist, MAGNET_PULL * delta);
        }
      }

      const grp = groupRefs.current[i];
      if (grp) {
        grp.position.set(c.x, 0.4, c.z);
        grp.visible = true;
      }

      if (c.z > RECYCLE_Z) {
        c.active = false;
        if (grp) grp.visible = false;
        return;
      }

      // Collection check
      const dx = Math.abs(c.x - hx);
      const dz = Math.abs(c.z);
      if (dx < COLLECT_DX && dz < COLLECT_DZ) {
        c.active = false;
        if (grp) grp.visible = false;
        collected++;
      }
    });
    if (collected > 0) useGameStore.getState().collectCarrots(collected);

    // Spawn new formation
    if (timerRef.current < FORMATION_INTERVAL) return;
    timerRef.current = 0;

    const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)]();
    for (const pos of formation) {
      const slot = poolRef.current.find(c => !c.active);
      if (!slot) break;
      slot.x = pos.x;
      slot.z = pos.z;
      slot.active = true;
    }
  });

  return (
    <>
      {poolRef.current.map((c, i) => (
        <group
          key={c.id}
          ref={el => (groupRefs.current[i] = el)}
          visible={false}
        >
          <CarrotMesh />
        </group>
      ))}
    </>
  );
}
