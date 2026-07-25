import { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP, IS_MOBILE } from '@/utils/device';

// ── ZİNDAN (KayKit Dungeon Pack) — karanlık taş koridor, meşale ışıkları ──────
const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const DUN = '/assets/models/dungeon/';
const D_WALL       = DUN + 'wall.glb';
const D_WALL_BROKE = DUN + 'wall_broken.glb';
const D_WALL_GATE  = DUN + 'wall_gate.glb';
const D_PILLAR     = DUN + 'pillar.glb';
const D_PILLAR_BRK = DUN + 'pillar_broken.glb';
const D_TORCH      = DUN + 'torch.glb';
const D_BANNER     = DUN + 'banner.glb';
const D_BARREL     = DUN + 'barrelDark.glb';
const D_CRATE      = DUN + 'crateDark.glb';
const D_CHEST      = DUN + 'chest_rare.glb';
const D_BOOKCASE   = DUN + 'bookcaseFilled.glb';
const D_BOOKCASE_W = DUN + 'bookcaseWideFilled.glb';
const D_TABLE      = DUN + 'tableSmall.glb';
const D_BENCH      = DUN + 'bench.glb';
const D_WEAPONRACK = DUN + 'weaponRack.glb';
const D_POTS       = DUN + 'pots.glb';
const D_LOOT       = DUN + 'lootSackA.glb';
const D_BRICKS     = DUN + 'bricks.glb';

// Yalnızca gerçekten kullanılan modeller preload edilir (bellek/yük için).
const ALL_MODELS = [
  D_WALL_BROKE, D_WALL_GATE, D_PILLAR, D_PILLAR_BRK, D_TORCH, D_BANNER,
  D_BARREL, D_CRATE, D_CHEST, D_WEAPONRACK, D_POTS, D_LOOT,
];
ALL_MODELS.forEach((p) => useGLTF.preload(p));

// Model döndürüldükten sonra yatayda merkeze çek (pivot kaymalarını giderir)
function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  const off    = useRef([0, 0]);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse((n) => { if (n.isMesh) { n.castShadow = !IS_MOBILE; n.receiveShadow = !IS_MOBILE; } });
    const box = new THREE.Box3().setFromObject(cloned.current);
    off.current = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
  }
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  return (
    <group position={position} scale={s} rotation={rotation}>
      <primitive object={cloned.current} position={[-off.current[0], 0, -off.current[1]]} />
    </group>
  );
}

// Deterministik pseudo-random
function pr(a, b = 0) {
  return (((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1) + 1) % 1;
}

// ── Zemin — koyu taş döşeme (instanced, tek draw call) ───────────────────────
const ROAD_W = 18;
const tileGeo = new THREE.BoxGeometry(0.94, 0.2, 0.94);
const tileMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
const TILE_COLORS = ['#8a8494', '#7d7789', '#948da0', '#736d80', '#867f93', '#9a93a8'].map(c => new THREE.Color(c));

function StoneFloor({ segIdx }) {
  const ref = useRef();
  const { count, matrices, colors } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const STEP = IS_MOBILE ? 1.5 : 1.0;
    const cols = Math.floor(ROAD_W / STEP);
    const rows = Math.floor(SEG_LEN / STEP);
    const mats = [];
    const cols_ = [];
    let n = 0;
    for (let r = 0; r < rows; r++) {
      const z = -SEG_LEN / 2 + r * STEP + STEP / 2;
      const rowOffset = (r % 2) * 0.5;
      for (let c = 0; c < cols; c++) {
        const x = -ROAD_W / 2 + c * STEP + STEP / 2 + rowOffset;
        if (x > ROAD_W / 2 - 0.3) continue;
        const sy = 0.6 + pr(n + 2, segIdx) * 0.5;
        dummy.position.set(x + (pr(n, segIdx) - 0.5) * 0.1, 0.14, z + (pr(n + 1, segIdx) - 0.5) * 0.1);
        dummy.rotation.set(0, (pr(n + 4, segIdx) - 0.5) * 0.3, 0);
        dummy.scale.set(1, sy, 1);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
        cols_.push(TILE_COLORS[Math.floor(pr(n + 5, segIdx) * TILE_COLORS.length) % TILE_COLORS.length]);
        n++;
      }
    }
    return { count: n, matrices: mats, colors: cols_ };
  }, [segIdx]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < matrices.length; i++) {
      m.setMatrixAt(i, matrices[i]);
      m.setColorAt(i, colors[i]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [matrices, colors]);

  return <instancedMesh ref={ref} args={[tileGeo, tileMat, count]} receiveShadow />;
}

// ── Meşale alevi — SADECE emissive küre (dinamik ışık YOK) ────────────────────
// Gündüz zindanında point-light'a gerek yok; onlarca dinamik ışık GPU'yu aşırı
// zorluyor ve WebGL context kaybına (oyun çökmesine) yol açıyordu. Alev, gün
// ışığında öz-parlayan bir küre olarak dekoratif kalır.
const flameGeo = new THREE.SphereGeometry(0.22, 6, 5);
const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347' });
function TorchFlame({ position }) {
  const flameRef = useRef();
  const seed = useMemo(() => Math.random() * 100, []);
  useFrame(() => {
    const flick = 0.9 + Math.sin(performance.now() / 1000 * 11 + seed) * 0.15;
    if (flameRef.current) flameRef.current.scale.setScalar(flick);
  });
  return <mesh ref={flameRef} geometry={flameGeo} material={flameMat} position={position} />;
}

function RoadSegment({ segIdx }) {
  return (
    <group>
      {/* Koyu taban — koridor dışı zifiri karanlık */}
      <mesh receiveShadow position={[-109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color="#6a7a5a" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color="#6a7a5a" roughness={1} />
      </mesh>
      {/* Derz tabanı */}
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[ROAD_W, 0.2, SEG_LEN + 0.6]} />
        <meshStandardMaterial color="#55505f" roughness={1} />
      </mesh>
      {/* Sürekli taş duvar — GLB yerine tek uzun kutu (çizim sayısı düşük).
          Yüzlerce ayrı duvar GLB'si WebGL context kaybına yol açıyordu. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 13.2, 2.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 4.8, SEG_LEN + 0.6]} />
          <meshStandardMaterial color="#8f8998" roughness={1} />
        </mesh>
      ))}
      <StoneFloor segIdx={segIdx} />
    </group>
  );
}

// Koridor duvarları + dekor + meşaleler
function getSideProps(segIdx) {
  const props = [];
  const half = SEG_LEN / 2;

  // Duvar üstü SEYREK dekor GLB'leri (kapı/kırık/pano) — sürekli kutu duvarın
  // üstüne serpiştirilir. Az sayıda: performans için (eskiden 26/segment vardı).
  const wallDecor = [D_WALL_GATE, D_WALL_BROKE, D_BANNER];
  const decorCount = IS_MOBILE ? 3 : 5;
  for (let i = 0; i < decorCount; i++) {
    const z = -half + (i + 0.5) * (SEG_LEN / decorCount) + (pr(i + 10, segIdx) - 0.5) * 4;
    const side = pr(i + 20, segIdx) > 0.5 ? 1 : -1;
    const m = wallDecor[Math.floor(pr(i + 25, segIdx * 3) * wallDecor.length) % wallDecor.length];
    props.push({ id: `w${i}`, x: side * 12.6, z, m, scale: 2.2, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }

  // Duvar dibi dekoru — az sayıda çeşit, seyrek
  const fillers = [
    { m: D_BARREL, s: 2.6 }, { m: D_CRATE, s: 2.6 }, { m: D_CHEST, s: 2.8 },
    { m: D_POTS, s: 2.4 }, { m: D_LOOT, s: 2.4 }, { m: D_WEAPONRACK, s: 2.4 },
  ];
  const fillerCount = IS_MOBILE ? 5 : 8;
  for (let i = 0; i < fillerCount; i++) {
    const z    = -half + i * (SEG_LEN / fillerCount) + (pr(i + 40, segIdx) - 0.5) * 4;
    const side = pr(i + 60, segIdx) > 0.5 ? 1 : -1;
    const dx   = side * (10.2 + pr(i + 70, segIdx) * 1.2);
    const f    = fillers[Math.floor(pr(i + 80, segIdx * 5) * fillers.length) % fillers.length];
    props.push({ id: `f${i}`, x: dx, z, m: f.m, scale: f.s, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }

  // Sütunlar — daha seyrek
  const pillarStep = 40;
  const pillarCount = Math.floor(SEG_LEN / pillarStep);
  for (let i = 0; i < pillarCount; i++) {
    const z = -half + i * pillarStep + pillarStep / 2;
    for (const side of [-1, 1]) {
      const broken = pr(i * 3 + side + 200, segIdx) < 0.25;
      props.push({ id: `p${i}s${side}`, x: side * 11.5, z, m: broken ? D_PILLAR_BRK : D_PILLAR, scale: 2.0, ry: 0 });
    }
  }

  return props;
}

// Meşale konumları — sütun hizasında, ışık sayısı mobilde kısıtlı
function getTorches(segIdx) {
  const torches = [];
  const half = SEG_LEN / 2;
  const step = IS_MOBILE ? 50 : 40;
  const n = Math.floor(SEG_LEN / step);
  for (let i = 0; i < n; i++) {
    const z = -half + i * step + step / 2;
    const side = (i + segIdx) % 2 === 0 ? -1 : 1;
    torches.push({ id: `t${i}`, x: side * 9.6, z, withLight: true });
  }
  return torches;
}

function SegmentContent({ segIdx }) {
  const props   = useMemo(() => getSideProps(segIdx), [segIdx]);
  const torches = useMemo(() => getTorches(segIdx), [segIdx]);
  return (
    <>
      <RoadSegment segIdx={segIdx} />
      {props.map((p) => (
        <Model key={p.id} path={p.m} position={[p.x, 0, p.z]} scale={p.scale} rotation={[0, p.ry ?? 0, 0]} />
      ))}
      {torches.map((t) => (
        <group key={t.id} position={[t.x, 0, t.z]}>
          <Model path={D_TORCH} position={[0, 0, 0]} scale={2.2} />
          <TorchFlame position={[0, 3.0, 0]} />
        </group>
      ))}
    </>
  );
}

export default function DungeonEnvironment() {
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
      {/* Gündüz: açık hava harabe zindanı — üstü açık taş koridor */}
      <color attach="background" args={['#a8c8e8']} />

      {/* Gün ışığı — gölge YOK (gölge haritası büyük GPU yükü + context kaybı
          riski; düz gündüz ışığında görsel fark yok). Meşaleler dekoratif. */}
      <ambientLight intensity={0.85} color="#fff2e0" />
      <directionalLight position={[-30, 70, 35]} intensity={1.7} color="#fff2d8" />
      <hemisphereLight skyColor="#bcd8f0" groundColor="#5a5468" intensity={0.7} />

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
