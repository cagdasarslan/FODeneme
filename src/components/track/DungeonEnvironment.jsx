import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { SHADOW_MAP, IS_MOBILE } from '@/utils/device';
import { makeStoneTexture } from '@/utils/stoneTexture';
import { makeMats, makeP } from '@/utils/procKit';

// ── ZİNDAN (KayKit Dungeon Pack) — karanlık taş koridor, meşale ışıkları ──────
const SEG_LEN = 120;
const SEG_COUNT = 6;
const RECYCLE_AFTER = SEG_LEN + 20;

// Dekor kodla üretilir (eskiden KayKit GLB'leri: kırık duvar 3.736, çömlekler
// 3.638, çuval 1.168 üçgen...). Her öğe aynı ölçüde onlarca üçgen.
const MAT = makeMats({
  stone: '#8f8998', stoneDk: '#6c6676', wood: '#5a3b22', woodDk: '#3e2816', iron: '#3a3a40',
  gold: { color: '#d8a83a', metalness: 0.6, roughness: 0.4 }, cloth: '#7a1f2a', clay: '#9a5a3a',
  sack: '#a88a5a', fire: { color: '#ffb040', emissive: '#ff7a10', emissiveIntensity: 1.2 },
});
const P = makeP(MAT);
const ITEMS = {
  // Duvar süsleri birim ölçüde: 4 m genişlik, 4 m boy (×2.2)
  gate: () => (<>
    <P g="box" m="stoneDk" p={[-1.5, 0, 0]} s={[1, 4, 1.5]} />
    <P g="box" m="stoneDk" p={[1.5, 0, 0]} s={[1, 4, 1.5]} />
    <P g="box" m="stoneDk" p={[0, 3, 0]} s={[2, 1, 1.5]} />
    <P g="box" m="woodDk" p={[0, 0, 0.1]} s={[2, 3, 0.2]} />
  </>),
  broken: () => (<>
    <P g="box" m="stone" p={[-1.2, 0, 0]} s={[1.6, 3.2, 1.4]} />
    <P g="box" m="stone" p={[1.2, 0, 0]} s={[1.6, 2.2, 1.4]} />
    <P g="rock" m="stoneDk" p={[0.2, 0.3, 0.9]} s={[0.5, 0.35, 0.5]} />
    <P g="rock" m="stone" p={[-0.5, 0.2, 1.1]} s={[0.35, 0.25, 0.35]} />
  </>),
  banner: () => (<>
    <P g="box" m="iron" p={[0, 1.9, 0.1]} s={[1.5, 0.06, 0.06]} />
    <P g="box" m="cloth" p={[0, 0.5, 0.12]} s={[1.3, 1.4, 0.03]} />
    <P g="box" m="gold" p={[0, 1.1, 0.14]} s={[0.4, 0.4, 0.02]} />
  </>),
  barrel: () => (<>
    <P g="cyl8" m="wood" p={[0, 0, 0]} s={[0.45, 1, 0.45]} />
    <P g="cyl8" m="iron" p={[0, 0.2, 0]} s={[0.47, 0.06, 0.47]} />
    <P g="cyl8" m="iron" p={[0, 0.75, 0]} s={[0.47, 0.06, 0.47]} />
  </>),
  crate: () => (<>
    <P g="box" m="wood" p={[0, 0, 0]} s={[1, 1, 1]} />
    <P g="box" m="woodDk" p={[0, 0, 0]} s={[1.03, 0.12, 1.03]} />
    <P g="box" m="woodDk" p={[0, 0.88, 0]} s={[1.03, 0.12, 1.03]} />
  </>),
  chest: () => (<>
    <P g="box" m="wood" p={[0, 0, 0]} s={[1.8, 0.45, 1.05]} />
    <P g="cyl8" m="woodDk" p={[-0.9, 0.45, 0]} s={[0.52, 1.8, 0.52]} r={[0, 0, -Math.PI / 2]} />
    <P g="box" m="gold" p={[0, 0.25, 0.53]} s={[0.2, 0.25, 0.04]} />
  </>),
  pots: () => [[0, 0, 0.42, 0.9], [0.5, 0.35, 0.3, 0.6], [-0.45, 0.3, 0.32, 0.7]].map(([x, z, r, h], i) => (
    <group key={i} position={[x, 0, z]}>
      <P g="cyl8" m="clay" p={[0, 0, 0]} s={[r, h * 0.7, r]} />
      <P g="cone8" m="clay" p={[0, h * 0.7, 0]} s={[r, h * 0.3, r]} />
    </group>
  )),
  loot: () => (<>
    <P g="rock" m="sack" p={[0, 0.45, 0]} s={[0.48, 0.5, 0.48]} />
    <P g="cyl8" m="woodDk" p={[0, 0.85, 0]} s={[0.12, 0.2, 0.12]} />
  </>),
  rack: () => (<>
    <P g="box" m="wood" p={[0, 0, -0.1]} s={[1.1, 0.8, 0.1]} />
    {[-0.35, 0, 0.35].map((x) => <P key={x} g="box" m="iron" p={[x, 0.05, 0]} s={[0.05, 0.85, 0.05]} />)}
  </>),
  torch: () => (<>
    <P g="cyl8" m="woodDk" p={[0, 0, 0]} s={[0.06, 1.2, 0.06]} />
    <P g="cone8" m="iron" p={[0, 1.15, 0]} s={[0.2, 0.25, 0.2]} r={[Math.PI, 0, 0]} />
  </>),
};
const D_WALL_BROKE = 'broken', D_WALL_GATE = 'gate', D_TORCH = 'torch', D_BANNER = 'banner', D_BARREL = 'barrel',
  D_CRATE = 'crate', D_CHEST = 'chest', D_WEAPONRACK = 'rack', D_POTS = 'pots', D_LOOT = 'loot';

function Model({ path, position, scale = 1, rotation = [0, 0, 0] }) {
  const make = ITEMS[path];
  return <group position={position} scale={scale} rotation={rotation}>{make ? make() : null}</group>;
}

// Sütunlar kodla üretilir: GLB sütun 2.656 üçgendi (×30 ≈ 80.000), bu
// sürüm aynı ölçüde (3.2 m taban, 8 m boy) ~44 üçgen.
const pillarMat   = new THREE.MeshStandardMaterial({ color: '#77736c', roughness: 0.95 });
const pillarBoxG  = new THREE.BoxGeometry(1, 1, 1);
const pillarShaft = new THREE.CylinderGeometry(1.05, 1.15, 1, 8);
function Pillar({ position, broken }) {
  const shaftH = broken ? 5.2 : 6.8;
  return (
    <group position={position}>
      <mesh geometry={pillarBoxG} material={pillarMat} position={[0, 0.3, 0]} scale={[3.2, 0.6, 3.2]} />
      <mesh geometry={pillarShaft} material={pillarMat} position={[0, 0.6 + shaftH / 2, 0]} scale={[1, shaftH, 1]}
        rotation={[broken ? 0.06 : 0, 0, broken ? 0.05 : 0]} />
      {!broken && <mesh geometry={pillarBoxG} material={pillarMat} position={[0, 7.7, 0]} scale={[3.2, 0.6, 3.2]} />}
    </group>
  );
}

// Deterministik pseudo-random
function pr(a, b = 0) {
  return (((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1) + 1) % 1;
}

// ── Zemin — koyu taş döşeme (instanced, tek draw call) ───────────────────────
const ROAD_W = 18;
const TILE_COLORS = ['#8a8494', '#7d7789', '#948da0', '#736d80', '#867f93', '#9a93a8'].map(c => new THREE.Color(c));

// Yol yüzeyi: tek düzlem + kanvasa çizilmiş taş dokusu (eskiden ~2.100 ayrı
// 3B kutu → yol parçası başına ~25.000 üçgen; şimdi 2). Doku tüm parçalarda ortak.
let _roadTex = null;
function StoneFloor() {
  const tex = useMemo(() => {
    if (!_roadTex) {
      _roadTex = makeStoneTexture({
        colors: TILE_COLORS.map(c => '#' + c.getHexString()),
        mortar: '#55505f', cells: 16, fill: 0.9, seed: 11,
      });
    }
    return _roadTex;
  }, []);
  // Taş boyutu eskisiyle aynı: masaüstünde 1,0 m, mobilde 1.5 m aralık
  const step = IS_MOBILE ? 1.5 : 1.0;
  const repX = ROAD_W / step / 16;
  const repY = (SEG_LEN + 0.6) / step / 16;
  const map = useMemo(() => {
    const t = tex.clone();
    t.repeat.set(repX, repY);
    t.needsUpdate = true;
    return t;
  }, [tex, repX, repY]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.205, 0]} receiveShadow>
      <planeGeometry args={[ROAD_W, SEG_LEN + 0.6]} />
      <meshStandardMaterial map={map} roughness={1} metalness={0} />
    </mesh>
  );
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
      <StoneFloor />
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
      props.push({ id: `p${i}s${side}`, x: side * 11.5, z, m: broken ? 'pillar_broken' : 'pillar', scale: 2.0, ry: 0 });
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
        p.m.startsWith('pillar')
          ? <Pillar key={p.id} position={[p.x, 0, p.z]} broken={p.m === 'pillar_broken'} />
          : <Model key={p.id} path={p.m} position={[p.x, 0, p.z]} scale={p.scale} rotation={[0, p.ry ?? 0, 0]} />
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
