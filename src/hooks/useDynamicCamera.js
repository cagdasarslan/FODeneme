import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { INITIAL_SPEED, MAX_SPEED } from '@/constants/game';

const BASE_FOV    = 68;
const MAX_FOV     = 88;
const BASE_Y      = 8;      // kamera yüksekliği
const BASE_Z      = 14;     // kamera derinliği
const LOOK_AT     = new THREE.Vector3(0, 0.5, -6); // kamera hedefi: piste doğru
// City map uses a lower camera so street-level buildings are visible
const CITY_BASE_Y = 5;
const CITY_BASE_Z = 12;
const CITY_LOOK_AT = new THREE.Vector3(0, 0, -30);
const BOB_AMP     = 0.07;
const BOB_FREQ    = 2.2;
const SHAKE_DECAY = 6;

export function useDynamicCamera() {
  const shakeRef   = useRef(0);
  const bobTimeRef = useRef(0);
  const fovRef     = useRef(BASE_FOV);
  const posRef     = useRef(new THREE.Vector3(0, BASE_Y, BASE_Z));

  useGameStore.subscribe(
    (s) => s.adrenaline,
    (adrenaline, prev) => {
      if (adrenaline > prev) shakeRef.current = Math.min(0.2, shakeRef.current + 0.09);
    }
  );

  useFrame(({ camera }, delta) => {
    const { phase, speed, adrenaline, mapId } = useGameStore.getState();

    // FOV hızla büyür
    const t        = (speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED);
    const targetFov = THREE.MathUtils.lerp(BASE_FOV, MAX_FOV, Math.pow(t, 0.55));
    fovRef.current  = THREE.MathUtils.lerp(fovRef.current, targetFov, 2 * delta);
    camera.fov      = fovRef.current;
    camera.updateProjectionMatrix();

    const isCity = mapId === 2;
    const camBaseY = isCity ? CITY_BASE_Y : BASE_Y;
    const camBaseZ = isCity ? CITY_BASE_Z : BASE_Z;
    const camLookAt = isCity ? CITY_LOOK_AT : LOOK_AT;

    if (phase !== 'playing') {
      camera.position.lerp(new THREE.Vector3(0, camBaseY, camBaseZ), 5 * delta);
      camera.lookAt(camLookAt);
      return;
    }

    // Dörtnala bob
    bobTimeRef.current += delta * (speed / 12) * BOB_FREQ;
    const bob = Math.abs(Math.sin(bobTimeRef.current)) * BOB_AMP * Math.min(1, speed / 16);

    // Adrenalin sarsıntısı
    shakeRef.current = THREE.MathUtils.lerp(shakeRef.current, 0, SHAKE_DECAY * delta);
    const sx = (Math.random() - 0.5) * 2 * shakeRef.current;
    const sy = (Math.random() - 0.5) * shakeRef.current;

    // Adrenalin'e göre kamera hafif öne eğilir (immersive)
    const adLean = (adrenaline / 100) * 0.5;
    const targetY = camBaseY + bob + sy - adLean * 0.4;
    const targetZ = camBaseZ + sx - adLean * 0.8;

    posRef.current.set(sx * 0.3, targetY, targetZ);
    camera.position.lerp(posRef.current, 12 * delta);

    // Kamera her zaman pistin önüne baksın
    camera.lookAt(camLookAt);

    // Hafif tilt (lookAt sonrası z-eksen dönüşü)
    const adTilt = (adrenaline / 100) * 0.03;
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, adTilt, 3 * delta);
  });
}
