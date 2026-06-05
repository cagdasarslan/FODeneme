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

function RoadTile() {
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
          <RoadTile />
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
