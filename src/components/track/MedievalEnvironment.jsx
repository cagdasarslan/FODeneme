import { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP, IS_MOBILE } from '@/utils/device';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

const MED = '/assets/models/medieval/';
// Büyük yapılar — yol kenarı dekoru
const M_CASTLE     = MED + 'castle.glb';
const M_HOUSE      = MED + 'house.glb';
const M_MARKET     = MED + 'market.glb';
const M_MILL       = MED + 'mill.glb';
const M_WATERMILL  = MED + 'watermill.glb';
const M_WATCHTOWER = MED + 'watchtower.glb';
const M_BARRACKS   = MED + 'barracks.glb';
const M_ARCHERY    = MED + 'archeryrange.glb';
const M_LUMBER     = MED + 'lumbermill.glb';
const M_MINE       = MED + 'mine.glb';
const M_WALL       = MED + 'wall_straight.glb';
const M_WALL_GATE  = MED + 'wall_gate.glb';
const M_WALL_TOWER = MED + 'wall_corner.glb';
// Doğa — küçük dolgu dekoru
const M_TREE_A     = MED + 'detail_treeA.glb';
const M_TREE_B     = MED + 'detail_treeB.glb';
const M_TREE_C     = MED + 'detail_treeC.glb';
const M_FOREST     = MED + 'forest.glb';
const M_FORESTA    = MED + 'detail_forestA.glb';
const M_FORESTB    = MED + 'detail_forestB.glb';
const M_ROCKS      = MED + 'detail_rocks.glb';
const M_ROCKS_SM   = MED + 'detail_rocks_small.glb';
const M_HILL       = MED + 'detail_hill.glb';
const M_MOUNTAIN   = MED + 'mountain.glb';
const M_WELL       = MED + 'well.glb';
const M_FARM       = MED + 'farm_plot.glb';

const ALL_MODELS = [
  M_CASTLE, M_HOUSE, M_MARKET, M_MILL, M_WATERMILL, M_WATCHTOWER, M_BARRACKS,
  M_ARCHERY, M_LUMBER, M_MINE, M_WALL, M_WALL_GATE, M_WALL_TOWER,
  M_TREE_A, M_TREE_B, M_TREE_C, M_FOREST, M_FORESTA, M_FORESTB,
  M_ROCKS, M_ROCKS_SM, M_HILL, M_MOUNTAIN, M_WELL, M_FARM,
];
ALL_MODELS.forEach((p) => useGLTF.preload(p));

// Model döndürüldükten sonra yatayda merkeze çek (pivot kaymalarını giderir)
function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  const off    = useRef([0, 0]);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    // Mobilde yan dekorların gölge üretmesi en büyük performans yükü → kapat
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

// ── Gökyüzü dekoru ────────────────────────────────────────────────────────────
function Clouds() {
  const cloudMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.85 }),
    []
  );
  const clouds = useMemo(() => {
    const pr = (n) => ((Math.sin(n * 91.3) * 6151.7) % 1 + 1) % 1;
    return Array.from({ length: 10 }, (_, i) => ({
      x: (pr(i) - 0.5) * 240,
      y: 50 + pr(i + 50) * 40,
      z: -80 - pr(i + 100) * 320,
      s: 6 + pr(i + 150) * 10,
    }));
  }, []);
  return (
    <group>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} material={cloudMat}>
          <sphereGeometry args={[c.s, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

// ── Yol parçası — parke taşı (cobblestone) yol, yeşil çayır kenarlar ───────────
const GROUND_COLOR = '#4e8040';
const ROAD_W   = 18;

// Deterministik pseudo-random
function pr(a, b = 0) {
  return (((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1) + 1) % 1;
}

// Parke taşı geometri/materyali (paylaşılan) + renk paleti
const cobbleGeo = new THREE.BoxGeometry(0.92, 0.22, 0.92);
const cobbleMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
const COBBLE_COLORS = ['#4a463f', '#534e46', '#3e3a34', '#5a544b', '#423e38', '#4f4942'].map(c => new THREE.Color(c));

// InstancedMesh ile binlerce taş tek draw call'da — segIdx'e göre deterministik
function CobbleRoad({ segIdx }) {
  const ref = useRef();
  const { count, matrices, colors } = useMemo(() => {
    const dummy = new THREE.Object3D();
    // Mobilde taş sayısını ~yarıya indir (en ağır haritaydı) — taşlar biraz
    // daha büyük/seyrek olur ama kare süresi belirgin düşer.
    const STEP = IS_MOBILE ? 1.4 : 1.0;      // taş aralığı
    const cols = Math.floor(ROAD_W / STEP);  // ~18 sütun
    const rows = Math.floor(SEG_LEN / STEP); // 120 sıra
    const mats = [];
    const cols_ = [];
    let n = 0;
    for (let r = 0; r < rows; r++) {
      const z = -SEG_LEN / 2 + r * STEP + STEP / 2;
      const rowOffset = (r % 2) * 0.5;       // tuğla deseni — sıralar kaydırılır
      for (let c = 0; c < cols; c++) {
        let x = -ROAD_W / 2 + c * STEP + STEP / 2 + rowOffset;
        if (x > ROAD_W / 2 - 0.3) continue;  // kenardan taşmasın
        const jx = (pr(n, segIdx) - 0.5) * 0.12;
        const jz = (pr(n + 1, segIdx) - 0.5) * 0.12;
        const sy = 0.7 + pr(n + 2, segIdx) * 0.6;       // yükseklik varyasyonu
        const sxz = 0.9 + pr(n + 3, segIdx) * 0.14;
        dummy.position.set(x + jx, 0.16, z + jz);
        dummy.rotation.set(0, (pr(n + 4, segIdx) - 0.5) * 0.5, 0);
        dummy.scale.set(sxz, sy, sxz);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
        cols_.push(COBBLE_COLORS[Math.floor(pr(n + 5, segIdx) * COBBLE_COLORS.length) % COBBLE_COLORS.length]);
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

  return <instancedMesh ref={ref} args={[cobbleGeo, cobbleMat, count]} receiveShadow />;
}

function RoadSegment({ segIdx = 0 }) {
  return (
    <group>
      {/* Çayır kenarlar — geniş, harita dışını kapatır */}
      <mesh receiveShadow position={[-109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[109, 0.05, 0]}>
        <boxGeometry args={[200, 0.10, SEG_LEN + 0.6]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      {/* Koyu harç tabanı — taşların arasındaki derzler */}
      <mesh receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[ROAD_W, 0.24, SEG_LEN + 0.6]} />
        <meshStandardMaterial color="#33302b" roughness={1} />
      </mesh>
      {/* Parke taşları */}
      <CobbleRoad segIdx={segIdx} />
    </group>
  );
}

// Yol kenarına SIK YERLEŞTİRİLMİŞ, iç içe köy yapıları + doğa
// Asset'ler 5-10 kat büyütüldü; yolu kapatmamaları için x dışarı kaydırıldı
function getSideProps(segIdx) {
  const props = [];
  const half = SEG_LEN / 2;

  // Büyük yapılar — büyütülmüş (6-8x), yol kenarının hemen dışında
  const buildings = [
    { m: M_HOUSE, s: 7 }, { m: M_MARKET, s: 7 }, { m: M_MILL, s: 6.5 },
    { m: M_WATERMILL, s: 6.5 }, { m: M_WATCHTOWER, s: 7 }, { m: M_BARRACKS, s: 6.5 },
    { m: M_ARCHERY, s: 6.5 }, { m: M_LUMBER, s: 6.5 }, { m: M_WELL, s: 6 },
    { m: M_FARM, s: 6.5 }, { m: M_CASTLE, s: 8 }, { m: M_MINE, s: 6.5 },
  ];
  // Her segmentte yol boyunca yapılar (mobilde daha az → performans)
  const buildingCount = IS_MOBILE ? 7 : 12;
  for (let i = 0; i < buildingCount; i++) {
    const z    = -half + 6 + i * (SEG_LEN / buildingCount) + (pr(i, segIdx) - 0.5) * 4;
    const side = i % 2 === 0 ? -1 : 1;
    const dx   = side * (19 + pr(i + 5, segIdx) * 5); // büyük yapılar yoldan uzak
    const b    = buildings[Math.floor(pr(i + 20, segIdx * 3) * buildings.length) % buildings.length];
    // Yapı yola dönük (yan taraf yolun ortasına bakar)
    const ry   = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    props.push({ id: `b${i}`, x: dx, z, m: b.m, scale: b.s, ry: ry + (pr(i + 30, segIdx) - 0.5) * 0.3 });
  }

  // Ağaç / kaya dolgu — büyütülmüş (5-6x), yol kenarına yakın ama yolu kapatmaz
  const fillers = [
    { m: M_TREE_A, s: 6 }, { m: M_TREE_B, s: 6 }, { m: M_TREE_C, s: 6 },
    { m: M_ROCKS, s: 5 }, { m: M_ROCKS_SM, s: 5.5 }, { m: M_FORESTA, s: 5.5 },
    { m: M_FORESTB, s: 5.5 }, { m: M_HILL, s: 6 },
  ];
  const fillerCount = IS_MOBILE ? 12 : 22;
  for (let i = 0; i < fillerCount; i++) {
    const z    = -half + i * (SEG_LEN / fillerCount) + (pr(i + 40, segIdx) - 0.5) * 3;
    const side = pr(i + 60, segIdx) > 0.5 ? 1 : -1;
    const dx   = side * (12 + pr(i + 70, segIdx) * 6); // yol kenarına yakın
    const f    = fillers[Math.floor(pr(i + 80, segIdx * 5) * fillers.length) % fillers.length];
    props.push({ id: `f${i}`, x: dx, z, m: f.m, scale: f.s, ry: pr(i + 90, segIdx) * Math.PI * 2 });
  }

  // Uzak DEV doğa duvarı — dağ/orman silüeti, harita dışını tamamen kapatır
  const bgCount = IS_MOBILE ? 5 : 8;
  for (let i = 0; i < bgCount; i++) {
    const z    = -half + pr(i + 110, segIdx) * SEG_LEN;
    const side = i % 2 === 0 ? -1 : 1;
    const dx   = side * (42 + pr(i + 120, segIdx) * 26);
    const m    = pr(i + 130, segIdx) > 0.5 ? M_MOUNTAIN : M_FOREST;
    props.push({ id: `bg${i}`, x: dx, z, m, scale: 9 + pr(i + 135, segIdx) * 3, ry: pr(i + 140, segIdx) * Math.PI * 2 });
  }

  return props;
}

function SegmentContent({ segIdx }) {
  const props = useMemo(() => getSideProps(segIdx), [segIdx]);
  return (
    <>
      <RoadSegment segIdx={segIdx} />
      {props.map((p) => (
        <Model key={p.id} path={p.m} position={[p.x, 0, p.z]} scale={p.scale} rotation={[0, p.ry ?? 0, 0]} />
      ))}
    </>
  );
}

export default function MedievalEnvironment() {
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
      {/* Berrak köy gökyüzü */}
      <color attach="background" args={['#9fd0e8']} />
      <Clouds />

      {/* Gündüz ışığı */}
      <ambientLight intensity={0.6} color="#fff4e0" />
      <directionalLight
        castShadow
        position={[-40, 70, 40]}
        intensity={2.0}
        color="#fff2d8"
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <hemisphereLight skyColor="#bfe3f5" groundColor="#3a6028" intensity={0.6} />

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
