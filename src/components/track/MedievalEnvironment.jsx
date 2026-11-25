import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP, IS_MOBILE } from '@/utils/device';
import { makeStoneTexture } from '@/utils/stoneTexture';

const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

// Büyük yapılar — yol kenarı dekoru
// Ortaçağ dekoru tamamen kodla üretilir. Eskiden 25 GLB model (yapı başına
// ~1.700-2.300, orman/tepe ~1.700-2.900 üçgen) haritanın ~165.000 üçgeninin
// büyük kısmıydı. Aynı ölçü ve renklerde basit gövdelerle her öğe 20-150 üçgen.
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
const MAT = {
  plaster: mat('#e6d8b8'), plaster2: mat('#d9c39a'), stone: mat('#9a958c'), stoneDk: mat('#7a756c'),
  wood: mat('#6b4a2e'), roofRed: mat('#9c3b2a'), roofBlue: mat('#3f5a86'), roofBrown: mat('#6e4b32'),
  leaf: mat('#4f8a3a'), leaf2: mat('#3e7232'), leaf3: mat('#6a9a3e'), trunk: mat('#5a3d24'),
  rock: mat('#8d8a84'), grass: mat('#6f9a48'), mountain: mat('#7f8a78'), snow: mat('#f2f4f6'),
  crop: mat('#c9a84a'),
};
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  roof: new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4),
  cone8: new THREE.ConeGeometry(1, 1, 8, 1),
  cone6: new THREE.ConeGeometry(1, 1, 6, 1),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  trunk: new THREE.CylinderGeometry(0.12, 0.16, 1, 5),
  blob: new THREE.IcosahedronGeometry(1, 0),
  rock: new THREE.DodecahedronGeometry(1, 0),
  hill: new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
};
[G.cone8, G.cone6, G.cyl8, G.trunk, G.box].forEach((g) => g.translate(0, 0.5, 0)); // tabanı y=0
G.roof.translate(0, 0.5, 0);
const shadow = !IS_MOBILE;
function P({ g, m, p, s, r }) {
  return <mesh geometry={G[g]} material={MAT[m]} position={p} scale={s} rotation={r} castShadow={shadow} receiveShadow={shadow} />;
}

// Birim ölçüde (≈1.7 m taban) çizilir, çağıran ölçekler — GLB'lerle aynı düzen
function House({ roof = 'roofRed', wall = 'plaster', h = 0.55 }) {
  return (<>
    <P g="box" m={wall} p={[0, 0, 0]} s={[1.5, h, 1.2]} />
    <P g="box" m="wood" p={[0, h * 0.45, 0.605]} s={[1.52, 0.05, 0.02]} />
    <P g="box" m="wood" p={[0, 0, 0.61]} s={[0.25, 0.32, 0.02]} />
    <P g="roof" m={roof} p={[0, h, 0]} s={[2.15, 0.55, 1.75]} />
  </>);
}
function Tower({ h = 1.6, r = 0.4, roof = 'roofBlue' }) {
  return (<>
    <P g="cyl8" m="stone" p={[0, 0, 0]} s={[r, h, r]} />
    <P g="cone8" m={roof} p={[0, h, 0]} s={[r * 1.3, r * 1.8, r * 1.3]} />
  </>);
}
function Castle() {
  return (<>
    <P g="box" m="stone" p={[0, 0, 0]} s={[1.3, 1.2, 1.3]} />
    <P g="box" m="stoneDk" p={[0, 1.2, 0]} s={[0.7, 0.7, 0.7]} />
    <P g="roof" m="roofBlue" p={[0, 1.9, 0]} s={[1.0, 0.6, 1.0]} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
      <group key={i} position={[x * 0.7, 0, z * 0.7]}><Tower h={1.7} r={0.24} /></group>
    ))}
  </>);
}
function Mill() {
  return (<>
    <P g="cyl8" m="plaster2" p={[0, 0, 0]} s={[0.45, 1.1, 0.45]} />
    <P g="cone8" m="roofBrown" p={[0, 1.1, 0]} s={[0.55, 0.5, 0.55]} />
    <group position={[0, 1.05, 0.5]}>
      <P g="box" m="wood" p={[0, -0.6, 0]} s={[0.08, 1.2, 0.03]} />
      <P g="box" m="wood" p={[0, -0.04, 0]} s={[1.2, 0.08, 0.03]} />
    </group>
  </>);
}
function Well() {
  return (<>
    <P g="cyl8" m="stone" p={[0, 0, 0]} s={[0.45, 0.3, 0.45]} />
    <P g="box" m="wood" p={[-0.38, 0, 0]} s={[0.06, 0.7, 0.06]} />
    <P g="box" m="wood" p={[0.38, 0, 0]} s={[0.06, 0.7, 0.06]} />
    <P g="roof" m="roofBrown" p={[0, 0.68, 0]} s={[1.1, 0.3, 0.9]} />
  </>);
}
function Farm() {
  return (<>
    <P g="box" m="trunk" p={[0, 0, 0]} s={[1.4, 0.05, 1.2]} />
    {[-0.45, -0.15, 0.15, 0.45].map((x) => <P key={x} g="box" m="crop" p={[x, 0.05, 0]} s={[0.16, 0.18, 1.1]} />)}
  </>);
}
function Tree({ kind = 0 }) {
  const leaf = ['leaf', 'leaf2', 'leaf3'][kind % 3];
  return (<>
    <P g="trunk" m="trunk" p={[0, 0, 0]} s={[1, 0.35, 1]} />
    {kind === 1
      ? <P g="cone6" m={leaf} p={[0, 0.2, 0]} s={[0.26, 0.6, 0.26]} />
      : <P g="blob" m={leaf} p={[0, 0.48, 0]} s={[0.26, 0.3, 0.26]} />}
  </>);
}
const FOREST_SPOTS = [[-0.6, -0.3, 0], [-0.2, 0.25, 1], [0.25, -0.35, 2], [0.6, 0.2, 0], [0.05, 0, 1], [-0.45, 0.45, 2], [0.5, -0.5, 1]];
function Forest({ n = 5, big = 1 }) {
  return FOREST_SPOTS.slice(0, n).map(([x, z, k], i) => (
    <group key={i} position={[x, 0, z]} scale={big * (0.9 + (i % 3) * 0.15)}><Tree kind={k} /></group>
  ));
}
function Rocks({ n = 3 }) {
  return [[0, 0, 0.4], [0.5, 0.2, 0.28], [-0.45, -0.15, 0.22]].slice(0, n).map(([x, z, r], i) => (
    <P key={i} g="rock" m="rock" p={[x, r * 0.4, z]} s={[r, r * 0.7, r]} r={[0, i * 1.3, 0]} />
  ));
}
function Hill() {
  return (<>
    <P g="hill" m="grass" p={[0, 0, 0]} s={[0.9, 0.9, 0.8]} />
    <group position={[0.3, 0.55, 0.1]} scale={0.8}><Tree kind={0} /></group>
  </>);
}
function Mountain() {
  return (<>
    <P g="cone6" m="mountain" p={[0, 0, 0]} s={[0.95, 1.25, 0.95]} />
    <P g="cone6" m="snow" p={[0, 0.85, 0]} s={[0.31, 0.41, 0.31]} />
  </>);
}

const ITEMS = {
  house: () => <House />, market: () => <House roof="roofBlue" wall="plaster2" h={0.45} />,
  barracks: () => <House roof="roofBrown" wall="stone" h={0.65} />,
  lumber: () => <House roof="roofBrown" wall="plaster2" h={0.5} />,
  mine: () => <House roof="roofBrown" wall="stoneDk" h={0.4} />,
  archery: () => (<><House roof="roofRed" h={0.5} /><group position={[0.7, 0, 0.5]}><Tower h={1.0} r={0.18} roof="roofRed" /></group></>),
  watchtower: () => <Tower h={1.6} r={0.35} roof="roofRed" />,
  mill: () => <Mill />, watermill: () => <Mill />, well: () => <Well />, farm: () => <Farm />, castle: () => <Castle />,
  treeA: () => <Tree kind={0} />, treeB: () => <Tree kind={1} />, treeC: () => <Tree kind={2} />,
  forestA: () => <Forest n={5} />, forestB: () => <Forest n={4} />, forest: () => <Forest n={7} big={1.6} />,
  rocks: () => <Rocks n={3} />, rocksSm: () => <group scale={0.5}><Rocks n={2} /></group>,
  hill: () => <Hill />, mountain: () => <Mountain />,
};
const M_CASTLE = 'castle', M_HOUSE = 'house', M_MARKET = 'market', M_MILL = 'mill', M_WATERMILL = 'watermill',
  M_WATCHTOWER = 'watchtower', M_BARRACKS = 'barracks', M_ARCHERY = 'archery', M_LUMBER = 'lumber', M_MINE = 'mine',
  M_TREE_A = 'treeA', M_TREE_B = 'treeB', M_TREE_C = 'treeC', M_FOREST = 'forest', M_FORESTA = 'forestA',
  M_FORESTB = 'forestB', M_ROCKS = 'rocks', M_ROCKS_SM = 'rocksSm', M_HILL = 'hill', M_MOUNTAIN = 'mountain',
  M_WELL = 'well', M_FARM = 'farm';

function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  const make = ITEMS[path];
  return <group position={position} scale={s} rotation={rotation}>{make ? make() : null}</group>;
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
const COBBLE_COLORS = ['#4a463f', '#534e46', '#3e3a34', '#5a544b', '#423e38', '#4f4942'].map(c => new THREE.Color(c));

// Yol yüzeyi: tek düzlem + kanvasa çizilmiş taş dokusu (eskiden ~2.100 ayrı
// 3B kutu → yol parçası başına ~25.000 üçgen; şimdi 2). Doku tüm parçalarda ortak.
let _roadTex = null;
function CobbleRoad() {
  const tex = useMemo(() => {
    if (!_roadTex) {
      _roadTex = makeStoneTexture({
        colors: COBBLE_COLORS.map(c => '#' + c.getHexString()),
        mortar: '#33302b', cells: 16, fill: 0.9, seed: 7,
      });
    }
    return _roadTex;
  }, []);
  // Taş boyutu eskisiyle aynı: masaüstünde 1,0 m, mobilde 1.4 m aralık
  const step = IS_MOBILE ? 1.4 : 1.0;
  const repX = ROAD_W / step / 16;
  const repY = (SEG_LEN + 0.6) / step / 16;
  const map = useMemo(() => {
    const t = tex.clone();
    t.repeat.set(repX, repY);
    t.needsUpdate = true;
    return t;
  }, [tex, repX, repY]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.245, 0]} receiveShadow>
      <planeGeometry args={[ROAD_W, SEG_LEN + 0.6]} />
      <meshStandardMaterial map={map} roughness={1} metalness={0} />
    </mesh>
  );
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
      <CobbleRoad />
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
  const phase   = useGameStore((s) => s.phase);
  const groupsRef = useRef([]);
  const posRef    = useRef(Array.from({ length: SEG_COUNT }, (_, i) => -i * SEG_LEN));

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const vel = (useGameStore.getState().speed || 10) * delta; // abonelik yok: kare başı render olmasın
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
