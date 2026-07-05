import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { INITIAL_SPEED, MAX_SPEED } from '@/constants/game';
import { getSlowmoIntensity, updateSlowmo } from '@/utils/slowmo';

// Sinematik slow-mo kamera efekt sabitleri
const SLOWMO_FOV_ZOOM = 12;   // slow-mo'da FOV bu kadar küçülür (zoom-in)
const SLOWMO_SHAKE    = 0.11;  // çarpma anı sarsıntı şiddeti

// Desatürasyon: 3B canvas'a CSS filtre uygula (EffectComposer'a gerek yok, tüm
// kalite kademelerinde çalışır). Yalnız CANVAS'ı etkiler → HUD/DOM tam renkli
// kalır. Değer değişmedikçe DOM'a yazma (ucuz).
function applyDesat(gl, intensity, ref) {
  if (!gl || !gl.domElement) return;
  const filter = intensity > 0.001
    ? `saturate(${(1 - intensity * 0.8).toFixed(3)}) contrast(${(1 + intensity * 0.12).toFixed(3)}) brightness(${(1 - intensity * 0.08).toFixed(3)})`
    : '';
  if (ref.current !== filter) {
    gl.domElement.style.filter = filter;
    ref.current = filter;
  }
}

const BASE_FOV    = 68;
const MAX_FOV     = 88;
const BASE_Y      = 8;      // kamera yüksekliği
const BASE_Z      = 14;     // kamera derinliği
const LOOK_AT     = new THREE.Vector3(0, 0.5, -6); // kamera hedefi: piste doğru
const REST_POS    = new THREE.Vector3(0, BASE_Y, BASE_Z); // menü/idle kamera konumu (paylaşılan)
const BOB_AMP     = 0.07;
const BOB_FREQ    = 2.2;
const SHAKE_DECAY = 6;

export function useDynamicCamera() {
  const shakeRef   = useRef(0);
  const bobTimeRef = useRef(0);
  const fovRef     = useRef(BASE_FOV);
  const posRef     = useRef(new THREE.Vector3(0, BASE_Y, BASE_Z));
  const desatRef   = useRef(''); // son uygulanan canvas filtresi (yeniden yazmayı önler)

  useGameStore.subscribe(
    (s) => s.adrenaline,
    (adrenaline, prev) => {
      if (adrenaline > prev) shakeRef.current = Math.min(0.2, shakeRef.current + 0.09);
    }
  );

  useFrame((frameState, rawDelta) => {
    const { camera, gl } = frameState;
    // Slow-mo controller'ı TEK KAYNAK olarak burada ilerlet (kamera her karede
    // çalışır — 'crashed'/menü dahil — böylece ölüm sonrası da yumuşak çıkar).
    updateSlowmo(Math.min(rawDelta, 0.1));
    // Düşük FPS'te lerp alpha > 1 olup kamera ıraksamasın diye delta sınırla
    const delta = Math.min(rawDelta, 1 / 30);
    const { phase, speed, adrenaline, mapId } = useGameStore.getState();

    // Çiftlik (paddock) kendi kamerasını yönetir — burada dokunma
    if (phase === 'paddock') { applyDesat(gl, 0, desatRef); return; }

    // ── Sinematik slow-mo yoğunluğu (0..1) ──
    const smInt = getSlowmoIntensity();

    // FOV hızla büyür. t NEGATİF olabilir (Zaman Büyüsü/slowmo hızı
    // INITIAL_SPEED'in altına indirir) → Math.pow(negatif, 0.55)=NaN olur ve
    // kamera FOV'unu bozup tüm sahneyi çökertir. 0-1 arası kıstır.
    const t        = THREE.MathUtils.clamp((speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED), 0, 1);
    let targetFov  = THREE.MathUtils.lerp(BASE_FOV, MAX_FOV, Math.pow(t, 0.55));
    targetFov     -= smInt * SLOWMO_FOV_ZOOM; // slow-mo'da zoom-in (FOV küçülür)
    // slow-mo'da FOV daha hızlı kilitlensin (etki net hissedilsin)
    fovRef.current  = THREE.MathUtils.lerp(fovRef.current, targetFov, (2 + smInt * 8) * delta);
    camera.fov      = fovRef.current;
    camera.updateProjectionMatrix();

    // ── Desatürasyon (canvas CSS filtresi) — HUD DOM'unu ETKİLEMEZ ──
    applyDesat(gl, smInt, desatRef);

    if (phase !== 'playing') {
      camera.position.lerp(REST_POS, 5 * delta); // paylaşılan sabit — allocation yok
      camera.lookAt(LOOK_AT);
      return;
    }

    // Dörtnala bob
    bobTimeRef.current += delta * (speed / 12) * BOB_FREQ;
    const bob = Math.abs(Math.sin(bobTimeRef.current)) * BOB_AMP * Math.min(1, speed / 16);

    // Sarsıntı: adrenalin + slow-mo çarpma darbesi (yoğunlukla ölçekli)
    shakeRef.current = THREE.MathUtils.lerp(shakeRef.current, 0, SHAKE_DECAY * delta);
    if (smInt > 0.001) shakeRef.current = Math.max(shakeRef.current, smInt * SLOWMO_SHAKE);
    const sx = (Math.random() - 0.5) * 2 * shakeRef.current;
    const sy = (Math.random() - 0.5) * shakeRef.current;

    // Adrenalin'e göre kamera hafif öne eğilir (immersive)
    const adLean = (adrenaline / 100) * 0.5;
    const targetY = BASE_Y + bob + sy - adLean * 0.4;
    const targetZ = BASE_Z + sx - adLean * 0.8;

    posRef.current.set(sx * 0.3, targetY, targetZ);
    camera.position.lerp(posRef.current, 12 * delta);

    // Kamera her zaman pistin önüne baksın
    camera.lookAt(LOOK_AT);

    // Hafif tilt (lookAt sonrası z-eksen dönüşü)
    const adTilt = (adrenaline / 100) * 0.03;
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, adTilt, 3 * delta);
  });
}
