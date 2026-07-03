import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { horseRef } from '@/utils/horseRef';
import { POWERUPS } from '@/constants/powerups';

// ── Genel YETENEK spawner'ı ───────────────────────────────────────────────────
// ~40 saniyede bir yolda rastgele bir yetenek belirir (her tipin kendine özgü
// şekli/rengi vardır). Alınca store.activatePowerup(id) tetiklenir.
const SPAWN_Z   = -90;
const RECYCLE_Z = 12;
const LANES     = [-4, 0, 4];
const SPAWN_INTERVAL = 40; // saniye

// ── Tip başına ayırt edici mini-meshler ──────────────────────────────────────
const mats = Object.fromEntries(POWERUPS.map(p => [p.id,
  new THREE.MeshStandardMaterial({
    color: p.color, metalness: 0.6, roughness: 0.25,
    emissive: p.color, emissiveIntensity: 0.55,
  })]));
const torusGeo   = new THREE.TorusGeometry(0.5, 0.15, 8, 20, Math.PI * 1.6);
const wingGeo    = new THREE.BoxGeometry(0.85, 0.08, 0.42);
const boltGeo    = new THREE.ConeGeometry(0.32, 1.0, 4);
const shieldGeo  = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16);
const coneGeo    = new THREE.ConeGeometry(0.42, 0.7, 8);
const carrotGeo  = new THREE.ConeGeometry(0.3, 1.0, 8);

function PowerupMesh({ type }) {
  const m = mats[type];
  switch (type) {
    case 'wings': return (
      <group>
        <mesh geometry={wingGeo} material={m} position={[-0.5, 0, 0]} rotation={[0, 0,  0.45]} />
        <mesh geometry={wingGeo} material={m} position={[ 0.5, 0, 0]} rotation={[0, 0, -0.45]} />
      </group>
    );
    case 'turbo': return <mesh geometry={boltGeo} material={m} rotation={[0, 0, Math.PI]} />;
    case 'shield': return <mesh geometry={shieldGeo} material={m} rotation={[Math.PI / 2, 0, 0]} />;
    case 'slowmo': return ( // kum saati
      <group>
        <mesh geometry={coneGeo} material={m} position={[0,  0.35, 0]} rotation={[Math.PI, 0, 0]} />
        <mesh geometry={coneGeo} material={m} position={[0, -0.35, 0]} />
      </group>
    );
    case 'golden': return <mesh geometry={carrotGeo} material={m} rotation={[0, 0, Math.PI]} />;
    default: return <mesh geometry={torusGeo} material={m} rotation={[Math.PI / 2, 0, 0]} />; // magnet nal
  }
}

export default function SuperNalSpawner() {
  const phase = useGameStore(s => s.phase);
  const [type, setType] = useState('magnet');

  const state = useRef({ x: 0, z: -200, active: false });
  const groupRef = useRef();
  const timerRef = useRef(SPAWN_INTERVAL * 0.55); // ilk yetenek daha erken gelsin
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
        grp.position.set(s.x, 1.2 + Math.sin(spinRef.current) * 0.3, s.z);
        grp.rotation.y = spinRef.current;
        grp.visible = true;
      }

      if (s.z > RECYCLE_Z) {
        s.active = false;
        if (grp) grp.visible = false;
        timerRef.current = 0;
        return;
      }

      // Toplama
      const dx = Math.abs(s.x - hx);
      const dz = Math.abs(s.z);
      if (dx < 1.8 && dz < 1.5) {
        s.active = false;
        if (grp) grp.visible = false;
        timerRef.current = 0;
        useGameStore.getState().activatePowerup(type);
      }
    } else if (timerRef.current >= SPAWN_INTERVAL) {
      timerRef.current = 0;
      s.x = LANES[Math.floor(Math.random() * LANES.length)];
      s.z = SPAWN_Z;
      s.active = true;
      // Rastgele yetenek seç
      setType(POWERUPS[Math.floor(Math.random() * POWERUPS.length)].id);
    }
  });

  const color = POWERUPS.find(p => p.id === type)?.color ?? '#ffd700';
  return (
    <group ref={groupRef} visible={false}>
      <PowerupMesh type={type} />
      <pointLight color={color} intensity={2.2} distance={9} />
    </group>
  );
}
