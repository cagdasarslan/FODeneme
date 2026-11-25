import { useRef } from 'react';
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

// Prosedürel havuç: 6 dilimli turuncu koni + 3 yeşil yaprak kutusu. Geometri ve
// materyaller modül seviyesinde BİR KEZ üretilir; kare başına yalnız transform yazılır.
const carrotMat  = new THREE.MeshStandardMaterial({ color: '#ff8a1e', roughness: 0.55, emissive: '#ff8a1e', emissiveIntensity: 0.3, flatShading: true });
const leafMat    = new THREE.MeshStandardMaterial({ color: '#3a9a48', roughness: 0.8, emissive: '#3a9a48', emissiveIntensity: 0.3, flatShading: true });
const carrotGeo  = new THREE.ConeGeometry(0.22, 0.8, 6);
const leafGeo    = new THREE.BoxGeometry(0.07, 0.34, 0.12);
const LEAVES = [[0, 0], [0.32, 2.1], [-0.32, 4.2]]; // [eğim, y-dönüşü]
const SPIN = 3;            // rad/s
const BOB_A = 0.15, BOB_W = Math.PI * 2 * 2; // ±0.15, 2 Hz
const POP_T = 0.12;        // toplama "pop" süresi (s): ölçek 1 → 1.6 → 0

function CarrotMesh() {
  return (
    <group>
      {/* uç aşağıda */}
      <mesh geometry={carrotGeo} material={carrotMat} rotation={[Math.PI, 0, 0]} castShadow />
      {LEAVES.map(([tilt, ry], i) => (
        <group key={i} position={[0, 0.4, 0]} rotation={[0, ry, 0]}>
          <mesh geometry={leafGeo} material={leafMat} position={[Math.sin(tilt) * 0.17, 0.15, 0]} rotation={[0, 0, -tilt]} />
        </group>
      ))}
    </group>
  );
}

function resetPool(pool, groupRefs) {
  pool.forEach((c, i) => {
    c.x = 0;
    c.z = SPAWN_Z - i * 50;
    c.active = false;
    c.pop = 0;
    const grp = groupRefs[i];
    if (grp) grp.visible = false;
  });
}

export default function CarrotSpawner() {
  const poolRef    = useRef(
    Array.from({ length: POOL }, (_, i) => ({
      id: i, x: 0, z: SPAWN_Z - i * 50, active: false, pop: 0, phase: (i * 1.37) % (Math.PI * 2),
    }))
  );
  const groupRefs  = useRef(Array(POOL).fill(null));
  const timerRef   = useRef(0);
  const lastRunRef = useRef(-1);
  const lastReviveRef = useRef(-1);

  useFrame((_, delta) => {
    const { phase, speed, runId, reviveId, magnetActive: magnetOn } = useGameStore.getState();

    // Yeni koşu VEYA devam et (revive) → havuç havuzunu temizle (ikilenme olmasın)
    if (runId !== lastRunRef.current || reviveId !== lastReviveRef.current) {
      lastRunRef.current = runId;
      lastReviveRef.current = reviveId;
      timerRef.current = 0;
      resetPool(poolRef.current, groupRefs.current);
      return; // skip movement logic this frame
    }

    if (phase !== 'playing') return;

    const hx = horseRef.x;
    timerRef.current += delta;
    const t = performance.now() / 1000;

    // Move and collect
    let collected = 0;
    poolRef.current.forEach((c, i) => {
      if (c.pop > 0) { // toplama pop animasyonu (yalnız görsel)
        c.pop -= delta;
        const grp = groupRefs.current[i];
        if (grp) {
          const k = 1 - Math.max(0, c.pop) / POP_T; // 0 → 1
          const sc = k < 0.5 ? 1 + 1.2 * k : 1.6 * (1 - k) * 2;
          grp.scale.setScalar(Math.max(0.001, sc));
          grp.position.y += delta * 3;
          if (c.pop <= 0) { grp.visible = false; grp.scale.setScalar(1); }
        }
      }
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
        grp.position.set(c.x, 0.55 + Math.sin(t * BOB_W + c.phase) * BOB_A, c.z);
        grp.rotation.y += delta * SPIN; // dönüş (allocation yok)
        grp.visible = true;
      }

      if (c.z > RECYCLE_Z) {
        c.active = false;
        if (grp) grp.visible = false;
        return;
      }

      // Collection check (horse is always at z≈0 in world space)
      const dx = Math.abs(c.x - hx);
      const dz = Math.abs(c.z);
      if (dx < COLLECT_DX && dz < COLLECT_DZ) {
        c.active = false;
        c.pop = POP_T; // görünür kalır, pop animasyonu sonunda gizlenir
        collected++;
      }
    });
    if (collected > 0) useGameStore.getState().collectCarrots(collected);

    // Spawn new formation
    if (timerRef.current < FORMATION_INTERVAL) return;
    timerRef.current = 0;

    const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)]();
    for (const pos of formation) {
      const slot = poolRef.current.find(c => !c.active && !(c.pop > 0));
      if (!slot) break;
      slot.x = pos.x;
      slot.z = pos.z;
      slot.active = true;
      slot.pop = 0;
      const g = groupRefs.current[slot.id];
      if (g) g.scale.setScalar(1);
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
