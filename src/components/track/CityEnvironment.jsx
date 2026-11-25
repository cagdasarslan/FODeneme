import { useRef, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const SEG_LEN       = 120;
const SEG_COUNT     = 6;
const RECYCLE_AFTER = SEG_LEN + 20;
const ROAD_HALF     = 6;   // half of road width = 12m
const SIDEWALK_W    = 3;   // sidewalk width
const BLD_SCALE     = 5;   // building tile 2m → 10m footprint
const BLD_HALF      = BLD_SCALE;            // 5 = half of 10m footprint
const BLD_CENTER_X  = ROAD_HALF + SIDEWALK_W + BLD_HALF; // 6+3+5 = 14

const K = '/assets/models/kaykit/';

// Props
const K_ROAD     = K+'road_straight.gltf';
const K_LIGHT    = K+'streetlight.gltf';
const K_TRAFFIC  = K+'trafficlight_A.gltf';
const K_BUSH     = K+'bush.gltf';
const K_CAR_S    = K+'car_sedan.gltf';
const K_CAR_T    = K+'car_taxi.gltf';
const K_CAR_P    = K+'car_police.gltf';
const K_DUMP     = K+'dumpster.gltf';
const K_HYDRANT  = K+'firehydrant.gltf';
const K_TOWER    = K+'watertower.gltf';
const K_BENCH    = K+'bench.gltf';

[K_TOWER, K_ROAD, K_LIGHT, K_TRAFFIC, K_BUSH, K_CAR_S, K_CAR_T,
  K_CAR_P, K_DUMP, K_HYDRANT, K_BENCH]
  .forEach(p => useGLTF.preload(p));

// ── Per-instance GLB clone ────────────────────────────────────────────────────
function GLBInner({ path, position = [0,0,0], scale = 1, rotY = 0 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }
  return (
    <primitive object={cloned.current}
      position={position} scale={scale} rotation={[0, rotY, 0]} />
  );
}
function GLB(props) {
  return <Suspense fallback={null}><GLBInner {...props} /></Suspense>;
}

// ── Materials ─────────────────────────────────────────────────────────────────
const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#b0a898', roughness: 0.9 });
const skyTopMat   = new THREE.MeshStandardMaterial({ color: '#3a6ea8', side: THREE.BackSide });
const skyMidMat   = new THREE.MeshStandardMaterial({ color: '#5a90c8', side: THREE.BackSide });
const skyHorMat   = new THREE.MeshStandardMaterial({ color: '#88b8e0', side: THREE.BackSide });
const sunMat      = new THREE.MeshStandardMaterial({ color: '#fffacc', emissive:'#ffd060', emissiveIntensity:1 });
const cloudMat    = new THREE.MeshStandardMaterial({ color: '#f0f4ff', transparent:true, opacity:0.85, roughness:1 });
// Gece varyantları
const skyTopMatN  = new THREE.MeshBasicMaterial({ color: '#060a18', side: THREE.BackSide });
const skyMidMatN  = new THREE.MeshBasicMaterial({ color: '#0a1028', side: THREE.BackSide });
const skyHorMatN  = new THREE.MeshBasicMaterial({ color: '#141a38', side: THREE.BackSide });
const moonMat     = new THREE.MeshStandardMaterial({ color: '#e8ecf4', emissive:'#c8d4f0', emissiveIntensity:0.9 });
const cloudMatN   = new THREE.MeshStandardMaterial({ color: '#2a3048', transparent:true, opacity:0.7, roughness:1 });
const groundMat   = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness:0.95 });

// Track.jsx already renders the visual road — no road tiles needed here.
// K_ROAD is kept in preload list for potential future use.

// ── Sidewalk (procedural concrete strip) ─────────────────────────────────────
const swGeo = new THREE.BoxGeometry(SIDEWALK_W, 0.18, SEG_LEN);
function Sidewalks() {
  const cx = ROAD_HALF + SIDEWALK_W / 2;
  return (
    <>
      <mesh receiveShadow geometry={swGeo} material={sidewalkMat}
        position={[-cx, 0.09, -SEG_LEN/2]} />
      <mesh receiveShadow geometry={swGeo} material={sidewalkMat}
        position={[ cx, 0.09, -SEG_LEN/2]} />
    </>
  );
}

// ── Building row — 12 adjacent buildings per side per segment ─────────────────
// All buildings: 2×2m model. scale=BLD_SCALE=5 → 10m×10m footprint.
// Placed every 10m in z: centres at z=-5, -15, -25, ... -115 (perfectly adjacent)
const BLD_STEP = BLD_SCALE * 2; // 10m
const BLD_COUNT = Math.ceil(SEG_LEN / BLD_STEP); // 12

// height lookup so we can place water towers only on tall buildings
const BLD_HEIGHTS = [1.65, 1.65, 2.98, 2.97, 2.35, 2.35, 2.98, 3.05];

// Binalar kodla üretilir. Eskiden 8 GLB bina modeli (×144 kopya) şehirdeki
// ~160.000 üçgenin neredeyse tamamıydı; kutu gövde + pencere dokusu + çatı
// kenarıyla bina başına ~36 üçgen kalıyor, görünüm aynı ölçü ve renklerde.
const BLD_COLORS = ['#c9b79c', '#a8584a', '#8fa3b5', '#d8cfc0', '#7c6a5a', '#b9926a', '#6f8a7a', '#c4a484'];
function makeFacadeTex(night) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  // 2×2 pencere: dokuda kat başına bir sıra, iki sütun
  for (let c = 0; c < 2; c++) {
    const lit = night && c === 0;
    g.fillStyle = lit ? '#ffe7a0' : '#3b4a5c';
    g.fillRect(c * 32 + 7, 10, 18, 30);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(c * 32 + 7, 10, 18, 4);
  }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 56, 64, 8); // kat çizgisi
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const _facadeTex = typeof document !== 'undefined' ? makeFacadeTex(false) : null;
const bldBoxGeo  = new THREE.BoxGeometry(1, 1, 1);
const roofMat    = new THREE.MeshStandardMaterial({ color: '#55534f', roughness: 0.9 });
// Tip başına malzeme (renk) — dokunun tekrarı yüksekliğe göre ayarlanır
const _bldMats = new Map();
function bldMat(typeIdx, floors) {
  const key = typeIdx * 100 + floors;
  let m = _bldMats.get(key);
  if (!m) {
    const tex = _facadeTex.clone();
    tex.repeat.set(4, floors);
    tex.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({ color: BLD_COLORS[typeIdx], map: tex, roughness: 0.85 });
    _bldMats.set(key, m);
  }
  return m;
}

function BuildingRow({ side, seed }) {
  const sx = side === 'left' ? -BLD_CENTER_X : BLD_CENTER_X;
  const W = BLD_STEP - 0.4;
  return (
    <>
      {Array.from({ length: BLD_COUNT }, (_, i) => {
        const typeIdx = (seed * 13 + i * 7 + (side === 'right' ? 4 : 0)) % BLD_COLORS.length;
        const zc = -(i * BLD_STEP + BLD_STEP / 2);
        const h = BLD_HEIGHTS[typeIdx] * BLD_SCALE;
        const floors = Math.max(2, Math.round(h / 3.2));
        const hasTower = (seed * 17 + i * 11) % 7 === 0 && BLD_HEIGHTS[typeIdx] > 2.5;
        return (
          <group key={i}>
            <mesh castShadow receiveShadow geometry={bldBoxGeo} material={bldMat(typeIdx, floors)}
              position={[sx, h / 2, zc]} scale={[W, h, W]} />
            <mesh geometry={bldBoxGeo} material={roofMat}
              position={[sx, h + 0.25, zc]} scale={[W + 0.5, 0.5, W + 0.5]} />
            {hasTower && (
              <GLB path={K_TOWER} position={[sx, h + 0.5, zc]} scale={3} />
            )}
          </group>
        );
      })}
    </>
  );
}

// ── Street props ───────────────────────────────────────────────────────────────
// streetlight H=0.96 → scale=5 → H≈4.8m
// trafficlight H=0.73 → scale=5 → H≈3.65m
// car W=0.42, D=0.94 → scale=3.5 → realistic ~1.5×3.3m
// bush H=0.38 → scale=3 → H≈1.14m
// dumpster scale=2.5 → ~1.4×0.8m
// firehydrant scale=3 → ~0.42×0.66m

const CAR_PATHS = [K_CAR_S, K_CAR_T, K_CAR_P];

function StreetProps({ seed }) {
  const h = n => (seed * 7919 + n * 1013) % 1000 / 1000;
  const lx = -(ROAD_HALF + 1.2); // just outside road left
  const rx =  (ROAD_HALF + 1.2); // just outside road right

  // streetlights every 30m (4 per segment), alternating sides
  const lights = [-15, -45, -75, -105];
  // parked cars on sidewalk (2-3 per segment)
  const carZs = [
    -20 - h(0) * 10,
    -60 - h(1) * 10,
    -95 - h(2) * 10,
  ];

  return (
    <>
      {/* Street lights */}
      {lights.map((z, i) => (
        <GLB key={`sl${i}`}
          path={K_LIGHT}
          position={[i % 2 === 0 ? lx : rx, 0, z]}
          scale={5}
          rotY={i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2}
        />
      ))}

      {/* Traffic lights at segment start and ⅔ point */}
      {[0, -80].map((z, i) => (
        <GLB key={`tl${i}`}
          path={K_TRAFFIC}
          position={[i === 0 ? rx : lx, 0, z]}
          scale={5}
          rotY={i === 0 ? -Math.PI / 2 : Math.PI / 2}
        />
      ))}

      {/* Parked cars on sidewalk */}
      {carZs.map((z, i) => {
        const side = (seed + i) % 2 === 0;
        const cx = side ? -(ROAD_HALF + SIDEWALK_W * 0.5) : (ROAD_HALF + SIDEWALK_W * 0.5);
        const carPath = CAR_PATHS[(seed * 3 + i) % 3];
        return (
          <GLB key={`car${i}`}
            path={carPath}
            position={[cx, 0.17, z]}
            scale={3.5}
            rotY={side ? -Math.PI / 2 : Math.PI / 2}
          />
        );
      })}

      {/* Bushes / planters near buildings */}
      {[-25, -85].map((z, i) => (
        <GLB key={`bush${i}`}
          path={K_BUSH}
          position={[(i % 2 === 0 ? -1 : 1) * (ROAD_HALF + 1.0), 0.17, z]}
          scale={3}
        />
      ))}

      {/* Dumpster + fire hydrant */}
      <GLB path={K_DUMP}
        position={[lx - 1, 0.17, -50 - h(5) * 15]}
        scale={2.5}
        rotY={h(6) * Math.PI * 2}
      />
      <GLB path={K_HYDRANT}
        position={[rx + 0.5, 0.17, -30 - h(7) * 20]}
        scale={3}
      />

      {/* Bench — every other segment */}
      {seed % 3 === 0 && (
        <GLB path={K_BENCH}
          position={[lx - 0.5, 0.17, -65]}
          scale={4}
          rotY={Math.PI / 2}
        />
      )}
    </>
  );
}

// ── City Sky ──────────────────────────────────────────────────────────────────
function CitySky() {
  const night = false; // gece modu kaldırıldı
  const clouds = [
    [-80,35,-180,1.2],[40,40,-220,0.9],[-30,38,-300,1.4],
    [130,36,-170,1.0],[-160,44,-250,1.1],
  ];
  return (
    <>
      <mesh><sphereGeometry args={[500,16,12]} /><primitive object={night ? skyTopMatN : skyTopMat} attach="material" /></mesh>
      <mesh position={[0,-30,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={night ? skyMidMatN : skyMidMat} attach="material" /></mesh>
      <mesh position={[0,-80,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={night ? skyHorMatN : skyHorMat} attach="material" /></mesh>
      <mesh position={[-80,65,-260]}><sphereGeometry args={[night ? 9 : 12,12,10]} /><primitive object={night ? moonMat : sunMat} attach="material" /></mesh>
      {clouds.map(([cx,cy,cz,cs],ci) => (
        <group key={ci} position={[cx,cy,cz]} scale={cs}>
          {[[0,0,0,7],[7,-1,0,5],[-6,-2,0,5],[2,2,0,4.5]].map(([px,py,pz,r],pi)=>(
            <mesh key={pi} position={[px,py,pz]}>
              <sphereGeometry args={[r,6,5]} />
              <primitive object={night ? cloudMatN : cloudMat} attach="material" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

// ── City ground (asphalt base extending beyond buildings) ─────────────────────
function CityGround() {
  return (
    <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-0.01,-280]}>
      <planeGeometry args={[300,1200]} />
      <primitive object={groundMat} attach="material" />
    </mesh>
  );
}

// ── City Segment ──────────────────────────────────────────────────────────────
function CitySegment({ seed }) {
  return (
    <group>
      <Sidewalks />
      <BuildingRow side="left"  seed={seed} />
      <BuildingRow side="right" seed={seed} />
      <StreetProps seed={seed} />
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CityEnvironment() {
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
      <CitySky />
      <CityGround />
      {posRef.current.map((z, i) => (
        <group key={i} ref={el => (grpRefs.current[i] = el)} position={[0, 0, z]}>
          <CitySegment seed={i} />
        </group>
      ))}
    </>
  );
}
