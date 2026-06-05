import { useRef, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const SEG_LEN       = 120;
const SEG_COUNT     = 6;
const RECYCLE_AFTER = SEG_LEN + 20;  // only recycle after full segment clears camera
const ROAD_HALF     = 9;

// ── Asset paths ───────────────────────────────────────────────────────────────
const R = '/assets/models/racing/';
const C = '/assets/models/citykit/';
const RF = '/assets/models/retro/';

const RACING = {
  fenceStraight:     R+'fenceStraight.glb',
  barrierRed:        R+'barrierRed.glb',
  barrierWhite:      R+'barrierWhite.glb',
  billboard:         R+'billboard.glb',
  billboardLow:      R+'billboardLow.glb',
  lightPostLarge:    R+'lightPostLarge.glb',
  lightPostModern:   R+'lightPostModern.glb',
  grandStand:        R+'grandStand.glb',
  grandStandCovered: R+'grandStandCovered.glb',
  tent:              R+'tent.glb',
  tentLong:          R+'tentLong.glb',
  treeLarge:         R+'treeLarge.glb',
  treeSmall:         R+'treeSmall.glb',
  flagCheckers:      R+'flagCheckers.glb',
  flagGreen:         R+'flagGreen.glb',
  pylon:             R+'pylon.glb',
  overhead:          R+'overhead.glb',
};

const CITY = {
  bldA: C+'building-a.glb',
  bldB: C+'building-b.glb',
  bldC: C+'building-c.glb',
  bldD: C+'building-d.glb',
  bldE: C+'building-e.glb',
  skyA: C+'building-skyscraper-a.glb',
  skyB: C+'building-skyscraper-b.glb',
  skyC: C+'building-skyscraper-c.glb',
  lowA: C+'low-detail-building-a.glb',
  lowB: C+'low-detail-building-b.glb',
  lowC: C+'low-detail-building-c.glb',
  lowD: C+'low-detail-building-d.glb',
};

const RETRO = {
  barrel:  RF+'detail-barrel.glb',
  barrels: RF+'barrels.glb',
  crate:   RF+'detail-crate.glb',
  crateS:  RF+'detail-crate-small.glb',
  fence:   RF+'fence-wood.glb',
  tree:    RF+'tree-large.glb',
};

[...Object.values(RACING), ...Object.values(CITY), ...Object.values(RETRO)]
  .forEach(p => useGLTF.preload(p));

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

// ── Generic GLB with per-instance clone ──────────────────────────────────────
function GLBInner({ path, position = [0,0,0], scale = 1, rotY = 0, rotX = 0 }) {
  const { scene } = useGLTF(path);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }
  return <primitive object={cloned.current}
    position={position} scale={scale} rotation={[rotX, rotY, 0]} />;
}
function GLB(props) {
  return <Suspense fallback={null}><GLBInner {...props} /></Suspense>;
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
        <GLB key={i} path={RACING.fenceStraight}
          position={[0, 0, -half + i * spacing + spacing / 2]}
          scale={8} rotY={Math.PI / 2}
        />
      ))}
    </group>
  );
}

// ── Light posts ───────────────────────────────────────────────────────────────
// lightPostLarge H=0.80 → scale=7.5 → H≈6m
function LightPost({ x = 0, z = 0, rotY = 0 }) {
  return <GLB path={RACING.lightPostLarge} position={[x, 0, z]} scale={7.5} rotY={rotY} />;
}

// ── Grandstand — grandStand H=0.90 → scale=9 → H≈8.1m ───────────────────────
function GrandStand({ x = 0, z = 0, rotY = 0, covered = false }) {
  const path = covered ? RACING.grandStandCovered : RACING.grandStand;
  return <GLB path={path} position={[x, 0, z]} scale={9} rotY={rotY} />;
}

// ── Tent ─ tent H=0.70 → scale=6 → H≈4.2m ───────────────────────────────────
function Tent({ x = 0, z = 0, rotY = 0, long = false }) {
  return <GLB path={long ? RACING.tentLong : RACING.tent}
    position={[x, 0, z]} scale={6} rotY={rotY} />;
}

// ── Billboard — W=1.00, H=1.00 → scale=5 → 5×5m ────────────────────────────
function Billboard({ x = 0, z = 0, rotY = 0, low = false }) {
  return <GLB path={low ? RACING.billboardLow : RACING.billboard}
    position={[x, 0, z]} scale={5} rotY={rotY} />;
}

// ── Checkered / green flag pole ───────────────────────────────────────────────
// flagCheckers H=1.25 → scale=4 → H≈5m
function Flag({ x = 0, z = 0, rotY = 0, green = false }) {
  return <GLB path={green ? RACING.flagGreen : RACING.flagCheckers}
    position={[x, 0, z]} scale={4} rotY={rotY} />;
}

// ── Racing trees — treeLarge H=1.51 → scale=3.5 → H≈5.3m ────────────────────
function RaceTree({ x = 0, z = 0, scale = 1, rotY = 0, small = false }) {
  return <GLB path={small ? RACING.treeSmall : RACING.treeLarge}
    position={[x, 0, z]} scale={3.5 * scale} rotY={rotY} />;
}

// ── Retro barrel / crate (H=2 → scale=0.5 → 1m) ────────────────────────────
function Barrel({ x = 0, z = 0, rotY = 0, group = false }) {
  return <GLB path={group ? RETRO.barrels : RETRO.barrel}
    position={[x, 0, z]} scale={0.5} rotY={rotY} />;
}
function Crate({ x = 0, z = 0, rotY = 0, small = false }) {
  return <GLB path={small ? RETRO.crateS : RETRO.crate}
    position={[x, 0, z]} scale={0.5} rotY={rotY} />;
}

// ── Retro tree (H=1.70 → scale=3 → H≈5.1m) ──────────────────────────────────
function RetroTree({ x = 0, z = 0, scale = 1, rotY = 0 }) {
  return <GLB path={RETRO.tree} position={[x, 0, z]} scale={3 * scale} rotY={rotY} />;
}

// ── City building (background — 2×2 modules, scale=7 → 14m wide)  ────────────
const CITY_BLDS   = [CITY.bldA, CITY.bldB, CITY.bldC, CITY.bldD, CITY.bldE];
const CITY_LOW    = [CITY.lowA, CITY.lowB, CITY.lowC, CITY.lowD];
const CITY_SKY    = [CITY.skyA, CITY.skyB, CITY.skyC];

function CityBuilding({ x = 0, z = 0, rotY = 0, type = 0, sky = false, low = false }) {
  const paths = sky ? CITY_SKY : low ? CITY_LOW : CITY_BLDS;
  const sc    = sky ? 10 : low ? 6 : 7;
  return <GLB path={paths[type % paths.length]} position={[x, 0, z]} scale={sc} rotY={rotY} />;
}

// ── Overhead gantry — overhead W=1.00 → scale=20 → 20m wide ─────────────────
function Overhead({ z = 0 }) {
  return <GLB path={RACING.overhead} position={[0, 0, z]} scale={20} rotY={0} />;
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
function Sky() {
  const clouds = [
    [-95,38,-200,1.3],[55,44,-240,1.0],[-20,42,-310,1.5],
    [120,37,-180,1.1],[-170,50,-260,1.2],[30,46,-160,0.9],
  ];
  return (
    <>
      <mesh><sphereGeometry args={[500,16,12]} /><primitive object={M.skyTop} attach="material" /></mesh>
      <mesh position={[0,-30,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={M.skyMid} attach="material" /></mesh>
      <mesh position={[0,-80,0]}><cylinderGeometry args={[500,500,80,16,1,true]} /><primitive object={M.skyHorizon} attach="material" /></mesh>
      <mesh position={[-90,75,-280]}><sphereGeometry args={[14,14,12]} /><primitive object={M.sunCore} attach="material" /></mesh>
      {clouds.map(([cx,cy,cz,cs],ci) => (
        <group key={ci} position={[cx,cy,cz]} scale={cs}>
          {[[0,0,0,8],[8,-1,0,6],[-7,-2,0,5.5],[2,2.5,0,5],[-3,2,1,4.5]].map(([px,py,pz,r],pi)=>(
            <mesh key={pi} position={[px,py,pz]}>
              <sphereGeometry args={[r,7,6]} />
              <primitive object={M.cloudW} attach="material" />
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
// Each segment has ~14-18 GLBs — well within GPU budget.
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
