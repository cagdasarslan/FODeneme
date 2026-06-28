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
import MedievalEnvironment from '@/components/track/MedievalEnvironment';
import ObstacleSpawner from '@/components/obstacles/ObstacleSpawner';
import CarrotSpawner from '@/components/track/CarrotSpawner';
import Weather from '@/components/track/Weather';
import SuperNalSpawner from '@/components/track/SuperNalSpawner';
import HUD from '@/components/ui/HUD';
import MainMenu from '@/components/ui/MainMenu';
import ContinueOverlay from '@/components/ui/ContinueOverlay';
import Garage from '@/components/ui/Garage';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { IS_MOBILE, MAX_DPR, SHADOW_MAP } from '@/utils/device';
import { startMusic, stopMusic, startGallop, stopGallop } from '@/utils/audio';

// ── EnvLayer MUST be defined outside App so React sees the same component
// type across re-renders. Defining it inside App creates a new function
// reference every render → React unmounts/remounts the entire environment
// subtree, causing asset flickering and wrong-map assets appearing.
function EnvLayer({ mapId }) {
  if (mapId === 5) return <MedievalEnvironment />;
  if (mapId === 4) return <SpaceEnvironment />;
  if (mapId === 3) return <DesertEnvironment />;
  if (mapId === 2) return <CityEnvironment />;
  return <FarmEnvironment />;
}

export default function App() {
  const initSession = useGameStore((s) => s.initSession);
  const mapId    = useGameStore((s) => s.mapId);
  const runId    = useGameStore((s) => s.runId);
  const nightMode = useGameStore((s) => s.nightMode);
  const graphics  = useGameStore((s) => s.graphics);
  const phase = useGameStore((s) => s.phase);
  useEffect(() => { initSession(); }, [initSession]);

  // Müzik + nal sesi: yalnızca oyun oynanırken
  useEffect(() => {
    if (phase === 'playing') { startMusic(mapId); startGallop(); }
    else { stopMusic(); stopGallop(); }
  }, [phase, mapId]);

  // Görüntü kalitesi (Ayarlar): low = gölgesiz + düşük dpr, high = tam
  const lowGfx     = graphics === 'low';
  const shadowsOn  = !lowGfx;
  const dprMax     = lowGfx ? 1 : MAX_DPR;
  const antialias  = !lowGfx && !IS_MOBILE;

  const isSpace  = mapId === 4;
  const isMars   = mapId === 3;
  const isMedieval = mapId === 5;
  const selfLit  = isSpace || isMars || isMedieval; // env yönetir kendi ışığını
  const isNight  = nightMode && !selfLit;
  const fogColor = mapId === 4 ? '#0d0518' : mapId === 3 ? '#c0581a'
    : mapId === 5 ? '#9fd0e8'
    : isNight ? '#0a0e1e'
    : mapId === 2 ? '#88b8e0' : '#a8d4e8';
  const hemiGround = mapId === 2 ? '#333333' : '#4e8040';

  return (
    <>
      <Canvas key={graphics} shadows={shadowsOn} camera={{ position: [0,8,14], fov:68, near:0.1, far:600 }}
        style={{ width:'100vw', height:'100vh' }}
        gl={{ antialias, powerPreference:'high-performance' }}
        dpr={[1,dprMax]} performance={{ min:0.5 }}>
        <fog attach="fog" args={[fogColor, selfLit ? 120 : isNight ? 60 : 90, selfLit ? 500 : isNight ? 280 : 420]} />
        <CameraRig />
        {!selfLit && (
          <>
            <ambientLight intensity={isNight ? 0.34 : 0.65} />
            <directionalLight castShadow position={[-50,80,30]}
              intensity={isNight ? 0.85 : 2.0}
              color={isNight ? '#aebfe8' : '#ffffff'}
              shadow-mapSize={[SHADOW_MAP,SHADOW_MAP]} shadow-camera-near={1} shadow-camera-far={280}
              shadow-camera-left={-60} shadow-camera-right={60}
              shadow-camera-top={60} shadow-camera-bottom={-60} />
            <hemisphereLight skyColor={isNight ? '#26305a' : '#87ceeb'}
              groundColor={isNight ? '#10121e' : hemiGround}
              intensity={isNight ? 0.45 : 0.55} />
          </>
        )}
        {/* key=mapId: environment fully remounts when map changes, eliminating
            stale segment groups from the previous map. */}
        <EnvLayer mapId={mapId} key={mapId} />
        <Weather />
        <Physics gravity={[0,-20,0]}>
          <Track />
          {/* key=runId: spawners fully remount on every new run so pools are
              re-created with the current map's obstacle/carrot types and no
              stale state (active flags, timers) leaks across runs. */}
          <ObstacleSpawner key={runId} />
          <CarrotSpawner />
          <SuperNalSpawner key={runId} />
          <Horse />
        </Physics>
      </Canvas>
      <LoadingScreen />
      <HUD />
      <ContinueOverlay />
      <MainMenu />
      <Garage />
    </>
  );
}
