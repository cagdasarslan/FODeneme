import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore from '@/store/useGameStore';
import { horseRef } from '@/utils/horseRef';
import { POWERUPS } from '@/constants/powerups';
import { PowerupMesh } from './powerupMeshes';

// ── Genel YETENEK spawner'ı ───────────────────────────────────────────────────
// 10-15 saniyede bir (rastgele) yolda bir yetenek belirir. Tip seçimi "karışık
// torba" ile yapılır: 6 yeteneğin hepsi rastgele sırayla bir kez çıkmadan
// hiçbiri tekrarlanmaz — böylece her yetenek mutlaka görülür.
const SPAWN_Z   = -90;
const RECYCLE_Z = 12;
const LANES     = [-4, 0, 4];
const nextInterval = () => 10 + Math.random() * 5; // saniye

function shuffledBag() {
  const bag = POWERUPS.map(p => p.id);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export default function SuperNalSpawner() {
  const phase = useGameStore(s => s.phase);
  const [type, setType] = useState('magnet');

  const state = useRef({ x: 0, z: -200, active: false });
  const groupRef = useRef();
  const timerRef  = useRef(0);
  const nextAtRef = useRef(nextInterval());
  const spinRef   = useRef(0);
  const bagRef    = useRef(shuffledBag());

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
        nextAtRef.current = nextInterval();
        return;
      }

      // Toplama
      const dx = Math.abs(s.x - hx);
      const dz = Math.abs(s.z);
      if (dx < 1.8 && dz < 1.5) {
        s.active = false;
        if (grp) grp.visible = false;
        timerRef.current = 0;
        nextAtRef.current = nextInterval();
        useGameStore.getState().activatePowerup(type);
      }
    } else if (timerRef.current >= nextAtRef.current) {
      timerRef.current = 0;
      s.x = LANES[Math.floor(Math.random() * LANES.length)];
      s.z = SPAWN_Z;
      s.active = true;
      // Karışık torbadan sıradaki yetenek (torba bitince yeniden karılır)
      if (bagRef.current.length === 0) bagRef.current = shuffledBag();
      // geliştirme: window.__pupForce = 'shield' → sonraki spawn bu tip olur
      const forced = import.meta.env.DEV && window.__pupForce;
      setType(forced || bagRef.current.pop());
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
