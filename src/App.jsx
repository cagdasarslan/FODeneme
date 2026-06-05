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
import SpaceEnvironment from '@/components/track/SpaceEnvironment';
import ObstacleSpawner from '@/components/obstacles/ObstacleSpawner';
import CarrotSpawner from '@/components/track/CarrotSpawner';
import SuperNalSpawner from '@/components/track/SuperNalSpawner';
import HUD from '@/components/ui/HUD';
import MainMenu from '@/components/ui/MainMenu';
import Garage from '@/components/ui/Garage';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function App() {
  const initSession = useGameStore((s) => s.initSession);
  const mapId = useGameStore((s) => s.mapId);
  useEffect(() => { initSession(); }, [initSession]);

  const isSpace  = mapId === 4;
  const isMars   = mapId === 3;
  const fogColor = mapId === 4 ? '#0d0518' : mapId === 3 ? '#0d0518' : mapId === 2 ? '#88b8e0' : '#a8d4e8';
  const hemiGround = mapId === 2 ? '#333333' : '#4e8040';

  function EnvLayer() {
    if (mapId === 4) return <SpaceEnvironment />;
    if (mapId === 3) return <DesertEnvironment />;
    if (mapId === 2) return <CityEnvironment />;
    return <FarmEnvironment />;
  }

  return (
    <>
      <Canvas shadows camera={{ position: [0,8,14], fov:68, near:0.1, far:600 }}
        style={{ width:'100vw', height:'100vh' }}
        gl={{ antialias:true, powerPreference:'high-performance' }}
        dpr={[1,2]} performance={{ min:0.5 }}>
        <fog attach="fog" args={[fogColor, (isSpace || isMars) ? 120 : 90, (isSpace || isMars) ? 500 : 420]} />
        <CameraRig />
        {!isSpace && !isMars && (
          <>
            <ambientLight intensity={0.65} />
            <directionalLight castShadow position={[-50,80,30]} intensity={2.0}
              shadow-mapSize={[2048,2048]} shadow-camera-near={1} shadow-camera-far={280}
              shadow-camera-left={-60} shadow-camera-right={60}
              shadow-camera-top={60} shadow-camera-bottom={-60} />
            <hemisphereLight skyColor="#87ceeb" groundColor={hemiGround} intensity={0.55} />
          </>
        )}
        <EnvLayer />
        <Physics gravity={[0,-20,0]}>
          <Track />
          <ObstacleSpawner />
          <CarrotSpawner />
          <SuperNalSpawner />
          <Horse />
        </Physics>
      </Canvas>
      <LoadingScreen />
      <HUD />
      <MainMenu />
      <Garage />
    </>
  );
}
