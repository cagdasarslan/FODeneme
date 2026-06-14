import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';

const TILE_LENGTH   = 100;
const TILE_COUNT    = 6;
const ROAD_WIDTH    = 12;
const SHOULDER_W    = 2.5;
// Recycle after the full tile clears the camera (camera z≈14, tile length=100)
const RECYCLE_AFTER = TILE_LENGTH + 20;

const roadMat    = new THREE.MeshStandardMaterial({ color: '#1e1e28', roughness: 0.95 });
const shoulderMat= new THREE.MeshStandardMaterial({ color: '#b09a72', roughness: 1 });
const groundMat  = new THREE.MeshStandardMaterial({ color: '#4e8040', roughness: 1 });
const lineMat    = new THREE.MeshStandardMaterial({ color: '#f0f0f0' });
const dashMat    = new THREE.MeshStandardMaterial({ color: '#f5d800', emissive: '#b8a000', emissiveIntensity: 0.15 });

const roadGeo   = new THREE.BoxGeometry(ROAD_WIDTH, 0.3, TILE_LENGTH);
const shldGeo   = new THREE.BoxGeometry(SHOULDER_W, 0.25, TILE_LENGTH);
const groundGeo = new THREE.BoxGeometry(160, 0.15, TILE_LENGTH);
const dashGeo   = new THREE.BoxGeometry(0.16, 0.01, 5);
const laneGeo   = new THREE.BoxGeometry(0.14, 0.01, 4);
const edgeGeo   = new THREE.BoxGeometry(0.22, 0.01, TILE_LENGTH);

const DASH_COUNT = 7;
const DASH_SPACE = TILE_LENGTH / DASH_COUNT;

// ── Yol detayları: çatlak, lastik izi, yama ───────────────────────────────────
const crackMat = new THREE.MeshStandardMaterial({ color: '#101018', roughness: 1 });
const tireMat  = new THREE.MeshStandardMaterial({ color: '#15151d', transparent: true, opacity: 0.55, roughness: 1 });
const patchMat = new THREE.MeshStandardMaterial({ color: '#2a2a36', roughness: 0.9 });
const crackGeo = new THREE.BoxGeometry(0.08, 0.012, 2.2);
const tireGeo  = new THREE.BoxGeometry(0.35, 0.011, 7);
const patchGeo = new THREE.BoxGeometry(1.6, 0.013, 2.4);

function RoadDetails({ seed }) {
  // tile başına deterministik "rastgele"
  const h = n => ((seed * 7919 + n * 1013) % 1000) / 1000;
  const half = TILE_LENGTH / 2;
  return (
    <group>
      {/* çatlaklar */}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={`c${i}`} geometry={crackGeo} material={crackMat}
          position={[(h(i) - 0.5) * 10, 0.153, -half + h(i + 10) * TILE_LENGTH]}
          rotation={[0, (h(i + 20) - 0.5) * 1.2, 0]} />
      ))}
      {/* lastik izleri — çift şerit */}
      {Array.from({ length: 2 }, (_, i) => {
        const x = (h(i + 30) - 0.5) * 8;
        const z = -half + h(i + 40) * TILE_LENGTH;
        const rot = (h(i + 50) - 0.5) * 0.4;
        return (
          <group key={`t${i}`} position={[x, 0.153, z]} rotation={[0, rot, 0]}>
            <mesh geometry={tireGeo} material={tireMat} position={[-0.55, 0, 0]} />
            <mesh geometry={tireGeo} material={tireMat} position={[ 0.55, 0, 0]} />
          </group>
        );
      })}
      {/* asfalt yamaları */}
      {Array.from({ length: 2 }, (_, i) => (
        <mesh key={`p${i}`} geometry={patchGeo} material={patchMat}
          position={[(h(i + 60) - 0.5) * 9, 0.1515, -half + h(i + 70) * TILE_LENGTH]}
          rotation={[0, (h(i + 80) - 0.5) * 0.5, 0]} />
      ))}
    </group>
  );
}

// ── Sokak lambası (gece modu) ─────────────────────────────────────────────────
const poleGeo   = new THREE.CylinderGeometry(0.06, 0.08, 6.5, 6);
const armGeo    = new THREE.BoxGeometry(0.06, 0.06, 1.4);
const headGeo   = new THREE.BoxGeometry(0.55, 0.18, 0.32);
const poleMat   = new THREE.MeshStandardMaterial({ color: '#4a4a5a', roughness: 0.7, metalness: 0.5 });
const headMatOff= new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.4, metalness: 0.6 });
const headMatOn = new THREE.MeshStandardMaterial({ color: '#fffacc', emissive: '#ffe879', emissiveIntensity: 3.5, roughness: 0.3 });

const LAMP_SPACING = 25;
const LAMP_COUNT   = Math.floor(TILE_LENGTH / LAMP_SPACING); // 4
const LAMP_X       = ROAD_WIDTH / 2 + 1.8;

function StreetLamps({ seed }) {
  const night = useGameStore(s => s.nightMode);
  const mapId = useGameStore(s => s.mapId);
  // Sokak lambası yalnızca harita 1-2'de mantıklı
  if (mapId === 3 || mapId === 4) return null;

  const half = TILE_LENGTH / 2;
  return (
    <group>
      {Array.from({ length: LAMP_COUNT }, (_, i) => {
        // Alternatif taraflar: çift indeks sol, tek indeks sağ
        const side = ((seed * LAMP_COUNT + i) % 2 === 0) ? -1 : 1;
        const x = side * LAMP_X;
        const z = -half + LAMP_SPACING * i + LAMP_SPACING / 2;
        return (
          <group key={i} position={[x, 0, z]}>
            {/* direk */}
            <mesh geometry={poleGeo} material={poleMat} position={[0, 3.25, 0]} castShadow />
            {/* kol — yola doğru uzanıyor */}
            <mesh geometry={armGeo} material={poleMat}
              position={[-side * 0.65, 6.5, 0]} rotation={[0, 0, side * 0.18]} />
            {/* lamba kafası */}
            <mesh geometry={headGeo} material={night ? headMatOn : headMatOff}
              position={[-side * 1.35, 6.46, 0]} />
            {/* ışık kaynağı — yalnızca gece modunda */}
            {night && (
              <pointLight
                position={[-side * 1.35, 6.0, 0]}
                distance={32} decay={1.3}
                intensity={45} color="#ffe8a0"
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function RoadTile({ seed = 0 }) {
  return (
    <group>
      <mesh receiveShadow geometry={groundGeo} material={groundMat} position={[0, -0.23, 0]} />
      <mesh receiveShadow geometry={shldGeo}   material={shoulderMat} position={[-(ROAD_WIDTH/2+SHOULDER_W/2), -0.02, 0]} />
      <mesh receiveShadow geometry={shldGeo}   material={shoulderMat} position={[ ROAD_WIDTH/2+SHOULDER_W/2,  -0.02, 0]} />
      <mesh receiveShadow geometry={roadGeo}   material={roadMat} />
      <mesh geometry={edgeGeo} material={lineMat} position={[-(ROAD_WIDTH/2-0.2), 0.152, 0]} />
      <mesh geometry={edgeGeo} material={lineMat} position={[ ROAD_WIDTH/2-0.2,  0.152, 0]} />
      {Array.from({ length: DASH_COUNT }, (_, i) => {
        const z = -TILE_LENGTH/2 + DASH_SPACE*i + DASH_SPACE/2;
        return <mesh key={i} geometry={dashGeo} material={dashMat} position={[0, 0.152, z]} />;
      })}
      {Array.from({ length: DASH_COUNT }, (_, i) => {
        const z = -TILE_LENGTH/2 + DASH_SPACE*i + DASH_SPACE/2;
        return (
          <group key={i}>
            <mesh geometry={laneGeo} material={lineMat} position={[-2, 0.152, z]} />
            <mesh geometry={laneGeo} material={lineMat} position={[ 2, 0.152, z]} />
          </group>
        );
      })}
      <RoadDetails seed={seed} />
      <StreetLamps seed={seed} />
    </group>
  );
}

export default function Track() {
  // Tile 0 starts at z=5 so road is visible immediately around horse (z=0)
  const INIT_POS = () => Array.from({ length: TILE_COUNT }, (_, i) => 5 - i * TILE_LENGTH);
  const posRef  = useRef(INIT_POS());
  const grpRefs = useRef([]);
  const phyRefs = useRef([]);
  const phase   = useGameStore((s) => s.phase);
  const runId   = useGameStore((s) => s.runId);
  // Maps 3 (Desert) and 4 (Space) render their own road visuals; show farm road only on 1-2
  const showRoad = useGameStore((s) => s.mapId <= 2);

  useEffect(() => {
    posRef.current = INIT_POS();
    posRef.current.forEach((z, i) => {
      grpRefs.current[i]?.position.set(0, 0, z);
      phyRefs.current[i]?.setTranslation({ x: 0, y: -0.12, z }, true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    const speed = useGameStore.getState().speed;
    posRef.current = posRef.current.map((z, i) => {
      const next     = z + speed * delta;
      const recycled = next > RECYCLE_AFTER ? next - TILE_COUNT * TILE_LENGTH : next;
      grpRefs.current[i]?.position.set(0, 0, recycled);
      phyRefs.current[i]?.setTranslation({ x: 0, y: -0.12, z: recycled }, true);
      return recycled;
    });
  });

  return (
    <>
      {posRef.current.map((z, i) => (
        <group key={i} ref={el => (grpRefs.current[i] = el)} position={[0, 0, z]}>
          {showRoad && <RoadTile seed={i} />}
        </group>
      ))}
      {posRef.current.map((z, i) => (
        <RigidBody key={`p${i}`} ref={el => (phyRefs.current[i] = el)}
          type="kinematicPosition" position={[0, -0.12, z]} colliders="cuboid">
          <mesh><boxGeometry args={[160, 0.22, TILE_LENGTH]} />
            <meshStandardMaterial transparent opacity={0} /></mesh>
        </RigidBody>
      ))}
    </>
  );
}
