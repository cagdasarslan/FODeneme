import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

// ── Hava durumu efektleri ─────────────────────────────────────────────────────
// Harita 1-2: yağmur (koşu bazında runId'ye göre %50 ihtimalle)
// Harita 3:   sürekli hafif kum fırtınası
// Harita 4:   meteor yağmuru çizgileri

const RAIN_COUNT   = 500;
const SAND_COUNT   = 350;
const METEOR_COUNT = 60;

// Oyuncu etrafındaki efekt hacmi
const VOL_X = 40, VOL_Y = 25, VOL_Z = 70;

function wrap(v, min, max) {
  const range = max - min;
  while (v < min) v += range;
  while (v > max) v -= range;
  return v;
}

function Rain() {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * VOL_X;
      arr[i * 3 + 1] = Math.random() * VOL_Y;
      arr[i * 3 + 2] = -Math.random() * VOL_Z + 15;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const { phase, speed } = useGameStore.getState();
    if (phase !== 'playing') return;
    const arr = ref.current.geometry.attributes.position.array;
    const fall = 28 * delta;            // düşme hızı
    const drift = speed * delta;        // at ileri gittikçe damlalar geriye akar
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 3 + 1] -= fall;
      arr[i * 3 + 2] += drift;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] += VOL_Y;
      arr[i * 3 + 2] = wrap(arr[i * 3 + 2], -VOL_Z + 15, 15);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#9db8d8" size={0.09} transparent opacity={0.65}
        sizeAttenuation depthWrite={false} />
    </points>
  );
}

function SandStorm() {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(SAND_COUNT * 3);
    for (let i = 0; i < SAND_COUNT; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * VOL_X;
      arr[i * 3 + 1] = Math.random() * 8 + 0.3;
      arr[i * 3 + 2] = -Math.random() * VOL_Z + 15;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const { phase, speed } = useGameStore.getState();
    if (phase !== 'playing') return;
    const arr = ref.current.geometry.attributes.position.array;
    const t = performance.now() / 1000;
    for (let i = 0; i < SAND_COUNT; i++) {
      // yanal rüzgar + at hızıyla geriye akış
      arr[i * 3]     += (10 + Math.sin(t * 2 + i) * 4) * delta;
      arr[i * 3 + 1] += Math.sin(t * 3 + i * 1.7) * 0.8 * delta;
      arr[i * 3 + 2] += speed * delta * 0.9;
      if (arr[i * 3] > VOL_X / 2) arr[i * 3] -= VOL_X;
      arr[i * 3 + 2] = wrap(arr[i * 3 + 2], -VOL_Z + 15, 15);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#e0a050" size={0.22} transparent opacity={0.45}
        sizeAttenuation depthWrite={false} />
    </points>
  );
}

function MeteorShower() {
  const ref = useRef();
  // Her meteor: baş + arkasında 5 iz noktası → çizgi hissi
  const TRAIL = 6;
  const positions = useMemo(() => {
    const arr = new Float32Array(METEOR_COUNT * TRAIL * 3);
    for (let i = 0; i < METEOR_COUNT; i++) {
      const x = (Math.random() - 0.5) * 120;
      const y = Math.random() * 60 + 20;
      const z = -Math.random() * 250 - 30;
      for (let j = 0; j < TRAIL; j++) {
        const k = (i * TRAIL + j) * 3;
        arr[k] = x + j * 0.5; arr[k + 1] = y + j * 0.7; arr[k + 2] = z;
      }
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const { phase } = useGameStore.getState();
    if (phase !== 'playing') return;
    const arr = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < METEOR_COUNT; i++) {
      for (let j = 0; j < TRAIL; j++) {
        const k = (i * TRAIL + j) * 3;
        arr[k]     -= 22 * delta;  // sola-aşağı süzülme
        arr[k + 1] -= 30 * delta;
      }
      const head = i * TRAIL * 3;
      if (arr[head + 1] < 5) {
        const x = (Math.random() - 0.5) * 120 + 60;
        const y = Math.random() * 40 + 60;
        const z = -Math.random() * 250 - 30;
        for (let j = 0; j < TRAIL; j++) {
          const k = (i * TRAIL + j) * 3;
          arr[k] = x + j * 0.5; arr[k + 1] = y + j * 0.7; arr[k + 2] = z;
        }
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffcc88" size={0.5} transparent opacity={0.85}
        sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function Weather() {
  const mapId = useGameStore((s) => s.mapId);

  if (mapId === 4) return <MeteorShower />;
  if (mapId === 3) return <SandStorm />;
  // Harita 1-2: yağmur kaldırıldı
  return null;
}
