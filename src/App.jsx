import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import useGameStore from '@/store/useGameStore';
import CameraRig from '@/components/CameraRig';
import Horse from '@/components/horse/Horse';
import Track from '@/components/track/Track';
import FarmEnvironment from '@/components/track/FarmEnvironment';
import CityEnvironment from '@/components/track/CityEnvironment';
import DesertEnvironment from '@/components/track/DesertEnvironment';
import ObstacleSpawner from '@/components/obstacles/ObstacleSpawner';
import CarrotSpawner from '@/components/track/CarrotSpawner';
import SuperNalSpawner from '@/components/track/SuperNalSpawner';
import HUD from '@/components/ui/HUD';
import MainMenu from '@/components/ui/MainMenu';
import Garage from '@/components/ui/Garage';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function App() {
  const initSession = useGameStore((s) => s.initSession);
  const mapId       = useGameStore((s) => s.mapId);

  useEffect(() => { initSession(); }, [initSession]);

  const fogColor   = mapId === 2 ? '#88b8e0' : mapId === 3 ? '#f5d090' : '#a8d4e8';
  const hemiGround = mapId === 2 ? '#333333' : '#4e8040';

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 8, 14], fov: 68, near: 0.1, far: 600 }}
        style={{ width: '100vw', height: '100vh' }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        <fog attach="fog" args={[fogColor, 90, 420]} />

        <CameraRig />

        {mapId !== 3 && (
          <>
            <ambientLight intensity={0.65} />
            <directionalLight castShadow position={[-50, 80, 30]}
              intensity={2.0}
              shadow-mapSize={[2048, 2048]}
              shadow-camera-near={1} shadow-camera-far={280}
              shadow-camera-left={-60} shadow-camera-right={60}
              shadow-camera-top={60}    shadow-camera-bottom={-60}
            />
            <hemisphereLight skyColor="#87ceeb" groundColor={hemiGround} intensity={0.55} />
          </>
        )}

        <>
          {mapId === 3 ? <DesertEnvironment /> : mapId === 1 ? <FarmEnvironment /> : <CityEnvironment />}
          <Physics gravity={[0, -20, 0]}>
            <Track />
            <ObstacleSpawner />
            <CarrotSpawner />
            <SuperNalSpawner />
            <Horse />
          </Physics>
        </>
      </Canvas>

      <LoadingScreen />
      <HUD />
      <MainMenu />
      <Garage />
    </>
  );
}
