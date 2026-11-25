import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { IS_MOBILE } from '@/utils/device';
import { G, makeMats, makeP, makeCheckerTex } from '@/utils/procKit';

const SEG_LEN       = 120;
const SEG_COUNT     = 6;
const RECYCLE_AFTER = SEG_LEN + 20;  // only recycle after full segment clears camera
const ROAD_HALF     = 9;

// ── Materials ────────────────────────────────────────────────────────────────
const MC = {
  grassLight: '#4e8040', grassDark: '#3a6828',
  cornStem: '#4a7c28', cornCob: '#f0c040',
  hay: '#d4a828', hayDark: '#b88c1a',
  barnRed: '#8b1a1a', barnRoof: '#3a0808',
  barnDoor: '#1a0202', barnWindow: '#a4c4e8', barnSide: '#6d1515',
  siloWall: '#c8bea0', siloDome: '#9a9282',
  barrierRedC: '#cc2222', barrierWhtC: '#e8e8e8',
  skyTop: '#4e9cc8', skyMid: '#7abce0', skyHorizon: '#b8d8f0',
  sunCore: '#fff8a0', cloudW: '#f4f8fc',
  mtnFar: '#78a090', mtnMid: '#6a9078', mtnSnow: '#eef2f6',
};
const M = {};
Object.entries(MC).forEach(([k, v]) => {
  M[k] = new THREE.MeshStandardMaterial({ color: v, roughness: 0.85 });
});
M.cloudW    = new THREE.MeshStandardMaterial({ color: MC.cloudW, transparent: true, opacity: 0.9, roughness: 1 });
M.sunCore   = new THREE.MeshStandardMaterial({ color: MC.sunCore, emissive: '#ffe060', emissiveIntensity: 1.2 });
M.barnWindow= new THREE.MeshStandardMaterial({ color: MC.barnWindow, roughness: 0.2, metalness: 0.3 });
M.skyTop    = new THREE.MeshStandardMaterial({ color: MC.skyTop,     side: THREE.BackSide });
M.skyMid    = new THREE.MeshStandardMaterial({ color: MC.skyMid,     side: THREE.BackSide });
M.skyHorizon= new THREE.MeshStandardMaterial({ color: MC.skyHorizon, side: THREE.BackSide });

// Gece varyantları
M.skyTopN     = new THREE.MeshBasicMaterial({ color: '#060a18', side: THREE.BackSide });
M.skyMidN     = new THREE.MeshBasicMaterial({ color: '#0a1028', side: THREE.BackSide });
M.skyHorizonN = new THREE.MeshBasicMaterial({ color: '#141a38', side: THREE.BackSide });
M.moon        = new THREE.MeshStandardMaterial({ color: '#e8ecf4', emissive: '#c8d4f0', emissiveIntensity: 0.9 });
M.cloudN      = new THREE.MeshStandardMaterial({ color: '#2a3048', transparent: true, opacity: 0.7, roughness: 1 });

// ── Kodla üretilen dekor ──────────────────────────────────────────────────────
// Eskiden 35 GLB (racing/citykit/retro kitleri) kullanılıyordu. Her öğe artık
// paylaşılan geometri + malzemeden birkaç gövde. Ölçüler GLB'lerin sınır
// kutularından (model birimi) alındı ve aynı ölçekle çağrılır; Kenney racing
// parçalarının orijin kayması da korunur (C = sınır kutusu merkezi).
const FM = makeMats({
  white: '#eeeeea', grey: '#9a9c9e', greyDk: '#5c6064', concrete: '#b8b4aa', metal: '#7c8288',
  fenceMesh: { color: '#c8ccd0', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide },
  seatBlue: '#2f5fa8', seatRed: '#b83232', seatYel: '#e0b030',
  tentRed: '#d04848', tentWht: '#f2ece0', wood: '#7a5230', woodDk: '#553820', crateW: '#a87c48',
  leaf: '#3f7a34', leaf2: '#4f9040', leafDk: '#2f6028', trunk: '#5a3d24',
  adOrange: '#e8742c', adBlue: '#2c6ee8', flagGreen: '#22a040',
  lamp: { color: '#fff4c0', emissive: '#ffe080', emissiveIntensity: 0.8 },
  roof: '#5a5650', glass: '#3b4a5c',
});
FM.checker = new THREE.MeshStandardMaterial({ map: makeCheckerTex(4), roughness: 0.8, side: THREE.DoubleSide });
const P = makeP(FM);
const C = ({ c, children }) => <group position={[c[0], 0, c[1]]}>{children}</group>;

// fenceStraight: 1.0 × 0.49, ince — beyaz direkler + tel örgü
function RFence() {
  return (<C c={[0.15, -0.665]}>
    <P g="box" m="white" p={[-0.485, 0, 0]} s={[0.03, 0.49, 0.03]} />
    <P g="box" m="white" p={[0.485, 0, 0]} s={[0.03, 0.49, 0.03]} />
    <P g="box" m="white" p={[0, 0.46, 0]} s={[1, 0.025, 0.025]} />
    <P g="box" m="white" p={[0, 0.02, 0]} s={[1, 0.02, 0.02]} />
    <P g="box" m="fenceMesh" p={[0, 0.04, 0]} s={[0.96, 0.42, 0.006]} />
  </C>);
}
// lightPostLarge: 0.38 × 0.79 — çift lambalı direk
function RLightPost() {
  return (<C c={[-0.35, -0.62]}>
    <P g="box" m="greyDk" p={[0, 0, 0]} s={[0.07, 0.04, 0.07]} />
    <P g="cyl8" m="greyDk" p={[0, 0, 0]} s={[0.016, 0.74, 0.016]} />
    <P g="box" m="greyDk" p={[0, 0.72, 0]} s={[0.34, 0.02, 0.02]} />
    {[-0.15, 0.15].map((x) => (<group key={x}>
      <P g="box" m="greyDk" p={[x, 0.735, 0]} s={[0.08, 0.05, 0.09]} />
      <P g="box" m="lamp" p={[x, 0.728, 0]} s={[0.07, 0.01, 0.08]} />
    </group>))}
  </C>);
}
// grandStand(Covered): 1×1, H 0.89 / 1.18 — ön (-z) alçak, basamaklar arkaya yükselir
const SEATS = ['seatBlue', 'seatRed', 'seatBlue', 'seatYel', 'seatBlue'];
function RGrandStand({ covered }) {
  return (<C c={[0.15, -1.15]}>
    {SEATS.map((seat, i) => {
      const top = 0.15 + i * 0.14, z = -0.4 + i * 0.2;
      return (<group key={i}>
        <P g="box" m="concrete" p={[0, 0, z]} s={[1, top, 0.2]} />
        <P g="box" m={seat} p={[0, top, z + 0.02]} s={[0.96, 0.035, 0.09]} />
      </group>);
    })}
    <P g="box" m="grey" p={[0, 0, 0.49]} s={[1, 0.89, 0.03]} />
    <P g="box" m="grey" p={[-0.49, 0, 0.1]} s={[0.025, 0.8, 0.8]} />
    <P g="box" m="grey" p={[0.49, 0, 0.1]} s={[0.025, 0.8, 0.8]} />
    {covered && (<>
      <P g="box" m="metal" p={[-0.46, 0, -0.46]} s={[0.03, 1.12, 0.03]} />
      <P g="box" m="metal" p={[0.46, 0, -0.46]} s={[0.03, 1.12, 0.03]} />
      <P g="box" m="white" p={[0, 1.12, -0.02]} s={[1.04, 0.05, 1.1]} r={[-0.06, 0, 0]} />
    </>)}
  </C>);
}
// tent / tentLong: 1×1 veya 2×1, H 0.69 — ayaklar, çizgili saçak, piramit çatı
function RTent({ long }) {
  const w = long ? 2 : 1;
  return (<C c={[long ? 0.65 : 0.15, -1.15]}>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
      <P key={i} g="box" m="white" p={[x * (w / 2 - 0.04), 0, z * 0.46]} s={[0.025, 0.42, 0.025]} />
    ))}
    <P g="box" m="tentWht" p={[0, 0.36, 0]} s={[w, 0.07, 1]} />
    <P g="cone4" m="tentRed" p={[0, 0.42, 0]} s={[w * 1.04, 0.27, 1.04]} />
    <P g="box" m="wood" p={[0, 0.17, -0.2]} s={[w * 0.7, 0.03, 0.25]} />
    <P g="box" m="woodDk" p={[0, 0, -0.2]} s={[w * 0.66, 0.17, 0.2]} />
  </C>);
}
// billboard / billboardLow: 1.0 genişlik, H 0.99 / 0.68
function RBillboard({ low }) {
  const h = low ? 0.68 : 0.99, y0 = h - 0.48;
  return (<C c={[0.09, -0.85]}>
    <P g="box" m="greyDk" p={[-0.33, 0, 0]} s={[0.04, y0 + 0.05, 0.04]} />
    <P g="box" m="greyDk" p={[0.33, 0, 0]} s={[0.04, y0 + 0.05, 0.04]} />
    <P g="box" m="greyDk" p={[-0.33, 0, 0.12]} s={[0.025, y0 + 0.2, 0.025]} r={[-0.45, 0, 0]} />
    <P g="box" m="greyDk" p={[0.33, 0, 0.12]} s={[0.025, y0 + 0.2, 0.025]} r={[-0.45, 0, 0]} />
    <P g="box" m="white" p={[0, y0, 0]} s={[1, 0.48, 0.05]} />
    <P g="box" m={low ? 'adBlue' : 'adOrange'} p={[0, y0 + 0.04, 0]} s={[0.92, 0.4, 0.06]} />
    <P g="box" m="white" p={[-0.12, y0 + 0.2, 0]} s={[0.55, 0.07, 0.065]} />
    <P g="box" m="white" p={[-0.2, y0 + 0.1, 0]} s={[0.38, 0.04, 0.065]} />
  </C>);
}
// flagCheckers / flagGreen: H 1.24
function RFlag({ green }) {
  return (<C c={[-0.25, -0.67]}>
    <P g="box" m="greyDk" p={[-0.08, 0, 0]} s={[0.05, 0.03, 0.05]} />
    <P g="cyl8" m="white" p={[-0.08, 0, 0]} s={[0.012, 1.24, 0.012]} />
    <P g="box" m={green ? 'flagGreen' : 'checker'} p={[0.015, 0.96, 0]} s={[0.18, 0.24, 0.008]} />
  </C>);
}
// treeLarge (H 1.5) / treeSmall (H 1.06): katmanlı çam
function RTree({ small }) {
  return (<C c={[-0.35, -0.65]}>
    <group scale={small ? 0.71 : 1}>
      <P g="cyl6" m="trunk" p={[0, 0, 0]} s={[0.03, 0.4, 0.03]} />
      <P g="cone8" m="leafDk" p={[0, 0.3, 0]} s={[0.18, 0.6, 0.18]} />
      <P g="cone8" m="leaf" p={[0, 0.65, 0]} s={[0.14, 0.5, 0.14]} />
      <P g="cone8" m="leaf2" p={[0, 0.98, 0]} s={[0.095, 0.52, 0.095]} />
    </group>
  </C>);
}
// retro tree-large: r 0.46, H 1.7 — yuvarlak taçlı
function RetroTreeM() {
  return (<>
    <P g="cyl6" m="trunk" p={[0, 0, 0]} s={[0.07, 0.75, 0.07]} />
    <P g="blob" m="leaf" p={[0, 1.0, 0]} s={[0.44, 0.36, 0.44]} r={[0, 0.4, 0]} />
    <P g="blob" m="leaf2" p={[0.08, 1.38, -0.05]} s={[0.3, 0.3, 0.3]} />
    <P g="blob" m="leafDk" p={[-0.22, 0.85, 0.15]} s={[0.24, 0.22, 0.24]} />
  </>);
}
// detail-barrel (r 0.12, H 0.3) / barrels (0.6 × 0.3, H 0.49)
function BarrelM({ x = 0, y = 0, h = 0.3 }) {
  return (<>
    <P g="cyl8" m="wood" p={[x, y, 0]} s={[0.115, h, 0.115]} />
    <P g="cyl8" m="greyDk" p={[x, y + h * 0.18, 0]} s={[0.12, 0.02, 0.12]} />
    <P g="cyl8" m="greyDk" p={[x, y + h * 0.78, 0]} s={[0.12, 0.02, 0.12]} />
  </>);
}
const BarrelGroupM = () => (<>
  <BarrelM x={-0.17} h={0.25} /><BarrelM x={0.17} h={0.25} /><BarrelM y={0.25} h={0.24} />
</>);
// detail-crate (0.3³) / detail-crate-small (0.2³)
function CrateM({ k = 1 }) {
  return (<group scale={k}>
    <P g="box" m="crateW" p={[0, 0, 0]} s={[0.3, 0.3, 0.3]} />
    <P g="box" m="woodDk" p={[0, 0.005, 0]} s={[0.31, 0.04, 0.31]} />
    <P g="box" m="woodDk" p={[0, 0.255, 0]} s={[0.31, 0.04, 0.31]} />
    <P g="box" m="woodDk" p={[0, 0, 0]} s={[0.04, 0.3, 0.31]} />
  </group>);
}
// overhead: 1.26 genişlik, H 0.66 — başlangıç kapısı
function ROverhead() {
  return (<C c={[0.15, -0.555]}>
    <P g="box" m="grey" p={[-0.6, 0, 0]} s={[0.06, 0.6, 0.14]} />
    <P g="box" m="grey" p={[0.6, 0, 0]} s={[0.06, 0.6, 0.14]} />
    <P g="box" m="white" p={[0, 0.54, 0]} s={[1.26, 0.12, 0.16]} />
    <P g="box" m="checker" p={[0, 0.555, 0]} s={[1.0, 0.09, 0.17]} />
    {[-0.3, 0, 0.3].map((x) => <P key={x} g="box" m="seatRed" p={[x, 0.5, 0.03]} s={[0.08, 0.04, 0.06]} />)}
  </C>);
}

// citykit binaları: [genişlik, derinlik, yükseklik, renk] (model birimi)
const CB = {
  bld: [[0.88, 0.94, 1.29, '#c9b79c'], [0.98, 0.94, 1.29, '#a8584a'], [0.88, 1.1, 0.89, '#8fa3b5'],
    [0.84, 0.9, 1.29, '#d8cfc0'], [1.64, 1.0, 0.89, '#b9926a']],
  sky: [[1.36, 1.36, 2.88, '#8aa0b4'], [1.36, 1.36, 4.48, '#9fb2c0'], [1.28, 1.38, 4.08, '#7c8ea0']],
  low: [[0.5, 0.5, 2.0, '#b8b0a0'], [0.5, 0.5, 2.23, '#9aa8b0'], [0.5, 0.5, 2.25, '#c0a080'], [0.5, 0.5, 1.75, '#a09080']],
};
function makeFacadeTex() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#3b4a5c'; g.fillRect(6, 7, 20, 16);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 28, 32, 4);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const _facade = makeFacadeTex();
const _cbMats = new Map();
function cbMat(color, cols, rows) {
  const key = `${color}|${cols}|${rows}`;
  let m = _cbMats.get(key);
  if (!m) {
    const t = _facade.clone(); t.repeat.set(cols, rows); t.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({ color, map: t, roughness: 0.85, flatShading: true });
    _cbMats.set(key, m);
  }
  return m;
}
const SHADOW = !IS_MOBILE;
function CityBuildingM({ spec, sky }) {
  const [w, d, h, color] = spec;
  const hb = sky ? h * 0.7 : h;             // gökdelende kademeli üst kısım
  const rows = Math.max(2, Math.round(hb / 0.16));
  const cols = Math.max(2, Math.round(w / 0.2));
  return (<>
    <mesh geometry={G.box} material={cbMat(color, cols, rows)} scale={[w, hb, d]} castShadow={SHADOW} receiveShadow={SHADOW} />
    <P g="box" m="roof" p={[0, hb, 0]} s={[w + 0.04, 0.04, d + 0.04]} />
    {sky && (<>
      <mesh geometry={G.box} material={cbMat(color, cols - 1, Math.max(2, Math.round((h - hb) / 0.16)))}
        position={[0, hb, 0]} scale={[w * 0.72, h - hb - 0.05, d * 0.72]} castShadow={SHADOW} />
      <P g="box" m="roof" p={[0, h - 0.05, 0]} s={[w * 0.76, 0.05, d * 0.76]} />
    </>)}
  </>);
}

// ── Dekor öğeleri (eski GLB yerleşimleriyle aynı konum/ölçek) ─────────────────
function Item({ position, scale = 1, rotY = 0, children }) {
  return <group position={position} scale={scale} rotation={[0, rotY, 0]}>{children}</group>;
}

// ── Racing track barrier strip (no GLBs — procedural red/white blocks) ────────
const barrierGeo = new THREE.BoxGeometry(2.0, 0.9, 0.4);
const barrierMatR = new THREE.MeshStandardMaterial({ color: '#cc2222', roughness: 0.7 });
const barrierMatW = new THREE.MeshStandardMaterial({ color: '#eeeeee', roughness: 0.7 });

function BarrierRow({ x = 0, z = 0 }) {
  const count = Math.ceil(SEG_LEN / 2.0);
  const half  = SEG_LEN / 2;
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} castShadow receiveShadow
          geometry={barrierGeo}
          material={i % 2 === 0 ? barrierMatR : barrierMatW}
          position={[0, 0.45, -half + i * 2.0 + 1.0]}
        />
      ))}
    </group>
  );
}


// ── Racing fence (spaced, not every metre) ───────────────────────────────────
function RacingFence({ x = 0, z = 0 }) {
  const spacing = 8;
  const count   = Math.ceil(SEG_LEN / spacing);
  const half    = SEG_LEN / 2;
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: count }, (_, i) => (
        <Item key={i} position={[0, 0, -half + i * spacing + spacing / 2]} scale={8} rotY={Math.PI / 2}>
          <RFence />
        </Item>
      ))}
    </group>
  );
}

// lightPostLarge H=0.80 → scale=7.5 → H≈6m
function LightPost({ x = 0, z = 0, rotY = 0 }) {
  return <Item position={[x, 0, z]} scale={7.5} rotY={rotY}><RLightPost /></Item>;
}
// grandStand H=0.90 → scale=9 → H≈8.1m
function GrandStand({ x = 0, z = 0, rotY = 0, covered = false }) {
  return <Item position={[x, 0, z]} scale={9} rotY={rotY}><RGrandStand covered={covered} /></Item>;
}
// tent H=0.70 → scale=6 → H≈4.2m
function Tent({ x = 0, z = 0, rotY = 0, long = false }) {
  return <Item position={[x, 0, z]} scale={6} rotY={rotY}><RTent long={long} /></Item>;
}
// billboard 1×1 → scale=5 → 5×5m
function Billboard({ x = 0, z = 0, rotY = 0, low = false }) {
  return <Item position={[x, 0, z]} scale={5} rotY={rotY}><RBillboard low={low} /></Item>;
}
// flag H=1.25 → scale=4 → H≈5m
function Flag({ x = 0, z = 0, rotY = 0, green = false }) {
  return <Item position={[x, 0, z]} scale={4} rotY={rotY}><RFlag green={green} /></Item>;
}
// treeLarge H=1.51 → scale=3.5 → H≈5.3m
function RaceTree({ x = 0, z = 0, scale = 1, rotY = 0, small = false }) {
  return <Item position={[x, 0, z]} scale={3.5 * scale} rotY={rotY}><RTree small={small} /></Item>;
}
// retro barrel / crate (scale 0.5)
function Barrel({ x = 0, z = 0, rotY = 0, group = false }) {
  return <Item position={[x, 0, z]} scale={0.5} rotY={rotY}>{group ? <BarrelGroupM /> : <BarrelM />}</Item>;
}
function Crate({ x = 0, z = 0, rotY = 0, small = false }) {
  return <Item position={[x, 0, z]} scale={0.5} rotY={rotY}><CrateM k={small ? 2 / 3 : 1} /></Item>;
}
// retro tree H=1.70 → scale=3 → H≈5.1m
function RetroTree({ x = 0, z = 0, scale = 1, rotY = 0 }) {
  return <Item position={[x, 0, z]} scale={3 * scale} rotY={rotY}><RetroTreeM /></Item>;
}
// Arka plan şehir binaları (scale 7 / gökdelen 10 / düşük detay 6)
function CityBuilding({ x = 0, z = 0, rotY = 0, type = 0, sky = false, low = false }) {
  const list = sky ? CB.sky : low ? CB.low : CB.bld;
  const sc   = sky ? 10 : low ? 6 : 7;
  return <Item position={[x, 0, z]} scale={sc} rotY={rotY}><CityBuildingM spec={list[type % list.length]} sky={sky} /></Item>;
}
// overhead W=1.26 → scale=20
function Overhead({ z = 0 }) {
  return <Item position={[0, 0, z]} scale={20}><ROverhead /></Item>;
}

// ── Procedural elements (no GLBs) ────────────────────────────────────────────
function HayStack({ x = 0, z = 0 }) {
  const bales = [[-0.9,0.45,0],[0,0.45,0],[0.9,0.45,0],[-0.45,1.35,0],[0.45,1.35,0],[0,2.25,0]];
  return (
    <group position={[x, 0, z]}>
      {bales.map(([bx,by,bz], i) => (
        <mesh key={i} castShadow position={[bx,by,bz]} rotation={[0,0,Math.PI/2]}>
          <cylinderGeometry args={[0.44,0.44,0.88,10]} />
          <primitive object={i%2===0 ? M.hay : M.hayDark} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function CornField({ x = 0, z = 0, w = 12, d = 18 }) {
  const rows = 4, cols = 6;
  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow position={[0,0.02,0]}>
        <boxGeometry args={[w,0.08,d]} />
        <primitive object={M.grassDark} attach="material" />
      </mesh>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const px = -w/2+(w/cols)*c+w/cols/2+Math.sin(r*7+c*3)*0.3;
          const pz = -d/2+(d/rows)*r+d/rows/2;
          const h  = 1.4+Math.sin(r*3+c*5)*0.3;
          return (
            <group key={`${r}-${c}`} position={[px,0,pz]}>
              <mesh position={[0,h/2,0]}>
                <cylinderGeometry args={[0.055,0.09,h,5]} />
                <primitive object={M.cornStem} attach="material" />
              </mesh>
              <mesh position={[0.13,h*0.62,0]} rotation={[0,0,0.4]}>
                <cylinderGeometry args={[0.09,0.07,0.42,6]} />
                <primitive object={M.cornCob} attach="material" />
              </mesh>
            </group>
          );
        })
      )}
    </group>
  );
}

function Barn({ x = 0, z = 0 }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0,2.6,0]}>
        <boxGeometry args={[7,5.2,9]} /><primitive object={M.barnRed} attach="material" />
      </mesh>
      {[-3.51,3.51].map((ox,i) => (
        <mesh key={i} position={[ox,2.6,0]}>
          <boxGeometry args={[0.12,5.2,9]} /><primitive object={M.barnSide} attach="material" />
        </mesh>
      ))}
      <mesh castShadow position={[0,8.4,0]}>
        <coneGeometry args={[2.6,3.4,4]} /><primitive object={M.barnRoof} attach="material" />
      </mesh>
      <mesh position={[0,1.55,4.62]}>
        <boxGeometry args={[2.2,3.1,0.15]} /><primitive object={M.barnDoor} attach="material" />
      </mesh>
      {[[-2.4,3.8],[2.4,3.8]].map(([wx,wy],i) => (
        <mesh key={i} position={[wx,wy,4.62]}>
          <boxGeometry args={[0.9,0.9,0.12]} /><primitive object={M.barnWindow} attach="material" />
        </mesh>
      ))}
      {/* silo */}
      <group position={[4.8,0,-1.5]}>
        <mesh castShadow receiveShadow position={[0,4.0,0]}>
          <cylinderGeometry args={[1.3,1.35,8.0,12]} /><primitive object={M.siloWall} attach="material" />
        </mesh>
        <mesh castShadow position={[0,8.0,0]}>
          <sphereGeometry args={[1.34,12,8,0,Math.PI*2,0,Math.PI/2]} />
          <primitive object={M.siloDome} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ── Sky ───────────────────────────────────────────────────────────────────────
function NightStars() {
  const positions = (() => {
    const arr = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 350 + Math.random() * 100;
      arr[i * 3]     = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.random() * 220 + 30;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  })();
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.9} sizeAttenuation />
    </points>
  );
}

function Sky() {
  const night = false; // gece modu kaldırıldı
  const clouds = [
    [-95,38,-200,1.3],[55,44,-240,1.0],[-20,42,-310,1.5],
    [120,37,-180,1.1],[-170,50,-260,1.2],[30,46,-160,0.9],
  ];
  return (
    <>
      <mesh><sphereGeometry args={[500,16,12]} /><primitive object={night ? M.skyTopN : M.skyTop} attach="material" /></mesh>
      <mesh position={[0,-30,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={night ? M.skyMidN : M.skyMid} attach="material" /></mesh>
      <mesh position={[0,-80,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={night ? M.skyHorizonN : M.skyHorizon} attach="material" /></mesh>
      <mesh position={[-90,75,-280]}><sphereGeometry args={[night ? 10 : 14,14,12]} /><primitive object={night ? M.moon : M.sunCore} attach="material" /></mesh>
      {night && <NightStars />}
      {clouds.map(([cx,cy,cz,cs],ci) => (
        <group key={ci} position={[cx,cy,cz]} scale={cs}>
          {[[0,0,0,8],[8,-1,0,6],[-7,-2,0,5.5],[2,2.5,0,5],[-3,2,1,4.5]].map(([px,py,pz,r],pi)=>(
            <mesh key={pi} position={[px,py,pz]}>
              <sphereGeometry args={[r,7,6]} />
              <primitive object={night ? M.cloudN : M.cloudW} attach="material" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Mountains() {
  const peaks = [
    [-200,-320,60,100],[-90,-340,50,115],[60,-310,55,105],
    [190,-300,48,90],[-280,-260,42,85],[150,-280,52,98],
  ];
  return (
    <>
      {peaks.map(([x,z,rx,ry],i) => (
        <group key={i} position={[x,0,z]}>
          <mesh><coneGeometry args={[rx,ry,6+(i%2)]} /><primitive object={i%2===0?M.mtnFar:M.mtnMid} attach="material" /></mesh>
          <mesh position={[0,ry*0.4,0]}><coneGeometry args={[rx*0.25,ry*0.26,6]} /><meshStandardMaterial color={MC.mtnSnow} /></mesh>
        </group>
      ))}
    </>
  );
}

// ── Wide ground always under the player ──────────────────────────────────────
function GroundPlane() {
  return (
    <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[0, -0.08, -280]}>
      <planeGeometry args={[400, 1200]} />
      <primitive object={M.grassLight} attach="material" />
    </mesh>
  );
}

// ── Track Segment ─────────────────────────────────────────────────────────────
// Each segment has ~14-18 procedural props.
// seed=0-5 cycles through 4 themes for variety.
function TrackSegment({ seed }) {
  const theme = seed % 4;
  // deterministic "random" from seed
  const h = n => (seed * 7919 + n * 1013) % 1000 / 1000;

  const leftX  = -(ROAD_HALF + 1.5);
  const rightX =   ROAD_HALF + 1.5;

  return (
    <group>
      {/* ── Safety barriers flush with road ── */}
      <BarrierRow x={leftX  - 0.5} z={0} />
      <BarrierRow x={rightX + 0.5} z={0} />

      {/* ── Racing fence panels outside barriers ── */}
      <RacingFence x={leftX  - 2.0} z={0} />
      <RacingFence x={rightX + 2.0} z={0} />

      {/* ── Light posts (2 per segment, alternating sides) ── */}
      <LightPost x={leftX  - 1.0} z={-25} rotY={ Math.PI * 0.5} />
      <LightPost x={rightX + 1.0} z={-85} rotY={-Math.PI * 0.5} />

      {/* ── Overhead gantry every other segment ── */}
      {theme % 2 === 0 && <Overhead z={-60} />}

      {/* ── Flags ── */}
      <Flag x={leftX  - 2.5} z={-10}  rotY={Math.PI * 0.5} green={theme === 1} />
      <Flag x={rightX + 2.5} z={-100} rotY={Math.PI * 0.5} green={theme === 2} />

      {/* ── Grandstands (far outside, 1 per segment side alternating) ── */}
      {theme === 0 && (
        <GrandStand x={leftX  - 22} z={-50} rotY={-Math.PI/2} covered={false} />
      )}
      {theme === 1 && (
        <GrandStand x={rightX + 22} z={-70} rotY={ Math.PI/2} covered={true}  />
      )}
      {theme === 2 && (
        <GrandStand x={leftX  - 22} z={-30} rotY={-Math.PI/2} covered={true}  />
      )}
      {theme === 3 && (
        <GrandStand x={rightX + 22} z={-90} rotY={ Math.PI/2} covered={false} />
      )}

      {/* ── Tents (1-2 per segment) ── */}
      <Tent x={leftX  - 18} z={-80} rotY={-Math.PI/2} long={theme % 2 === 0} />
      {theme % 3 !== 0 && (
        <Tent x={rightX + 16} z={-30} rotY={Math.PI/2} long={false} />
      )}

      {/* ── Billboard (1 per segment) ── */}
      <Billboard
        x={(theme % 2 === 0 ? leftX : rightX) + (theme%2===0 ? -28 : 28)}
        z={-45 - h(5)*20}
        rotY={theme % 2 === 0 ? -Math.PI/2 : Math.PI/2}
        low={theme === 3}
      />

      {/* ── Roadside props (barrels / crates at fence line) ── */}
      <Barrel x={leftX  - 3} z={-20} rotY={h(1)*Math.PI*2} group={theme===1} />
      <Crate  x={rightX + 3} z={-55} rotY={h(2)*Math.PI*2} small={theme===2} />
      {theme % 2 === 0 && (
        <Barrel x={rightX + 3} z={-90} rotY={h(3)*Math.PI*2} />
      )}

      {/* ── Background city buildings (far left and right) ── */}
      <CityBuilding x={leftX  - 55} z={-40}  rotY={-Math.PI/2} type={seed}     sky={theme===0} />
      <CityBuilding x={rightX + 55} z={-80}  rotY={ Math.PI/2} type={seed+1}   sky={theme===1} />
      <CityBuilding x={leftX  - 70} z={-100} rotY={-Math.PI/2} type={seed+2}   low={theme===2} />
      {theme % 3 !== 2 && (
        <CityBuilding x={rightX + 70} z={-20} rotY={Math.PI/2} type={seed+3}   low={theme===3} />
      )}

      {/* ── Trees (4 per segment, outside the spectator zone) ── */}
      <RaceTree  x={leftX  - 38} z={-35}  scale={0.9 + h(6)*0.3} rotY={h(7)*Math.PI*2} />
      <RaceTree  x={rightX + 38} z={-65}  scale={0.8 + h(8)*0.3} rotY={h(9)*Math.PI*2} />
      <RetroTree x={leftX  - 42} z={-95}  scale={0.9 + h(10)*0.2} rotY={h(11)*Math.PI*2} />
      <RetroTree x={rightX + 42} z={-15}  scale={0.8 + h(12)*0.2} rotY={h(13)*Math.PI*2} />

      {/* ── Farm feature on one side per theme ── */}
      {theme === 0 && <Barn    x={leftX  - 38} z={-70} />}
      {theme === 2 && <Barn    x={rightX + 38} z={-45} />}
      {theme === 1 && <HayStack x={leftX  - 16} z={-55} />}
      {theme === 3 && <CornField x={leftX - 22} z={-75} />}
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FarmEnvironment() {
  const grpRefs = useRef([]);
  const posRef  = useRef(Array.from({ length: SEG_COUNT }, (_, i) => 5 - i * SEG_LEN));
  const phase   = useGameStore((s) => s.phase);
  const runId   = useGameStore((s) => s.runId);

  useEffect(() => {
    posRef.current = Array.from({ length: SEG_COUNT }, (_, i) => 5 - i * SEG_LEN);
    posRef.current.forEach((z, i) => grpRefs.current[i]?.position.set(0, 0, z));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const speed = useGameStore.getState().speed;
    posRef.current = posRef.current.map((z, i) => {
      const next     = z + speed * delta;
      const recycled = next > RECYCLE_AFTER ? next - SEG_COUNT * SEG_LEN : next;
      grpRefs.current[i]?.position.set(0, 0, recycled);
      return recycled;
    });
  });

  return (
    <>
      <Sky />
      <Mountains />
      <GroundPlane />
      {posRef.current.map((z, i) => (
        <group key={i} ref={el => (grpRefs.current[i] = el)} position={[0, 0, z]}>
          <TrackSegment seed={i} />
        </group>
      ))}
    </>
  );
}
