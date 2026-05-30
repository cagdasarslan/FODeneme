import { useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Environment, OrbitControls } from '@react-three/drei';
import useGameStore from '@/store/useGameStore';
import Horse from '@/components/horse/Horse';
import Track from '@/components/track/Track';
import HUD from '@/components/ui/HUD';
import MainMenu from '@/components/ui/MainMenu';

export default function App() {
  const initSession = useGameStore((s) => s.initSession);

  useEffect(() => {
    initSession();
  }, [initSession]);

  return (
    <>
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 4, 10], fov: 65, near: 0.1, far: 500 }}
        style={{ width: '100vw', height: '100vh', background: '#1a1a2e' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          position={[5, 10, 5]}
          intensity={1.5}
          shadow-mapSize={[2048, 2048]}
        />

        {/* Poly Haven HDRI — swap the path to a downloaded .hdr file */}
        <Environment preset="sunset" />

        <Physics gravity={[0, -20, 0]}>
          <Suspense fallback={null}>
            <Track />
            <Horse />
          </Suspense>
        </Physics>
      </Canvas>

      {/* 2D overlay UI (outside Canvas so no R3F context needed) */}
      <HUD />
      <MainMenu />
    </>
  );
}
