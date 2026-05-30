import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import useGameStore from '@/store/useGameStore';

const TILE_LENGTH = 80;
const TILE_COUNT = 4;
const TRACK_WIDTH = 12;

export default function Track() {
  const tilesRef = useRef(
    Array.from({ length: TILE_COUNT }, (_, i) => i * TILE_LENGTH)
  );

  const speed = useGameStore((s) => s.speed);
  const phase = useGameStore((s) => s.phase);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;

    tilesRef.current = tilesRef.current.map((z) => {
      const next = z - speed * delta;
      // Recycle tile to the back of the queue when it leaves the camera.
      return next < -TILE_LENGTH ? next + TILE_COUNT * TILE_LENGTH : next;
    });
  });

  return (
    <>
      {tilesRef.current.map((z, i) => (
        <RigidBody key={i} type="fixed" position={[0, -0.5, z]}>
          <mesh receiveShadow>
            <boxGeometry args={[TRACK_WIDTH, 0.5, TILE_LENGTH]} />
            <meshStandardMaterial color="#4a4a5a" />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
