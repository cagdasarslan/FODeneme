import { useRef, useEffect, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import useGameStore from '@/store/useGameStore';
import { HORSES } from '@/constants/horses';
import { sfx } from '@/utils/audio';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';

// ── Çiftlik: 4 tarafı çitle çevrili sarı kumlu serbest antrenman alanı ────────
// Sürükle → at o yöne yürür/koşar. ZIPLA butonu (veya boşluk) ile zıplar.
// Satın alınan engeller zemine yerleştirilir; üzerinden zıplamak XP kazandırır,
// her 100 XP atın en düşük stat'ına +1 bedava seviye verir.

const HALF        = 20;    // çit yarı-boyutu
const MOVE_CLAMP  = 18.3;  // at bu sınırın dışına çıkamaz
const WALK_SPEED  = 3.5;
const RUN_SPEED   = 9;
const JUMP_V      = 8.5;
const GRAVITY     = -22;
const XP_PER_JUMP = 20;

const MODEL_PATH = '/assets/models/horse.glb';

// Sahne ↔ UI arası hafif giriş kanalı (re-render tetiklemez)
export const paddockInput = { dx: 0, dz: 0, mag: 0, jump: false };

// ── Materyaller / geometriler ────────────────────────────────────────────────
const sandMat  = new THREE.MeshStandardMaterial({ color: '#c49a4e', roughness: 1 });
const grassMat = new THREE.MeshStandardMaterial({ color: '#4e8040', roughness: 1 });
const postMat  = new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.9 });
const railMat  = new THREE.MeshStandardMaterial({ color: '#a5825a', roughness: 0.85 });
const postGeo  = new THREE.CylinderGeometry(0.09, 0.11, 1.3, 8);

const barPostMat = new THREE.MeshStandardMaterial({ color: '#eeeeee', roughness: 0.6 });
const barMat     = new THREE.MeshStandardMaterial({ color: '#d03030', roughness: 0.6 });
const hayMat     = new THREE.MeshStandardMaterial({ color: '#d8b040', roughness: 1 });
const wallMat    = new THREE.MeshStandardMaterial({ color: '#9a8a7a', roughness: 0.95 });

function Fence() {
  const posts = [];
  for (let i = -HALF; i <= HALF; i += 4) {
    posts.push([i, -HALF], [i, HALF], [-HALF, i], [HALF, i]);
  }
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} geometry={postGeo} material={postMat} position={[x, 0.65, z]} castShadow />
      ))}
      {/* 2 yatay ray × 4 kenar */}
      {[0.45, 0.95].map((y) => (
        <group key={y}>
          <mesh material={railMat} position={[0, y, -HALF]}><boxGeometry args={[HALF * 2, 0.09, 0.09]} /></mesh>
          <mesh material={railMat} position={[0, y,  HALF]}><boxGeometry args={[HALF * 2, 0.09, 0.09]} /></mesh>
          <mesh material={railMat} position={[-HALF, y, 0]}><boxGeometry args={[0.09, 0.09, HALF * 2]} /></mesh>
          <mesh material={railMat} position={[ HALF, y, 0]}><boxGeometry args={[0.09, 0.09, HALF * 2]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function PaddockObstacle({ type }) {
  if (type === 'hay') {
    return (
      <mesh castShadow material={hayMat} rotation={[0, 0, Math.PI / 2]} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 1.4, 10]} />
      </mesh>
    );
  }
  if (type === 'wall') {
    return (
      <mesh castShadow material={wallMat} position={[0, 0.45, 0]}>
        <boxGeometry args={[2.0, 0.9, 0.4]} />
      </mesh>
    );
  }
  // 'bar' — klasik atlama bariyeri
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} material={barPostMat} position={[s * 1.0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.95, 8]} />
        </mesh>
      ))}
      <mesh material={barMat} position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[2.2, 0.12, 0.12]} />
      </mesh>
    </group>
  );
}

// ── At modeli (varyant destekli: morph horse.glb veya iskeletli özel model) ───
function PaddockHorseModel({ variant, animRef }) {
  const path     = variant?.model ?? MODEL_PATH;
  const skeletal = !!variant?.skeletal;
  const useScale = variant?.modelScale ?? 0.013;
  const useY     = variant?.modelY ?? -1.05;

  const groupRef = useRef();
  const { scene, animations } = useGLTF(path);
  const { actions, names } = useAnimations(animations, groupRef);
  const cloned = useRef(null);
  const cur = useRef('');

  if (!cloned.current) {
    cloned.current = skeletal ? skeletonClone(scene) : scene.clone(true);
    cloned.current.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        if (!variant?.noTint) {
          o.material = o.material.clone();
          o.material.color.set(variant?.bodyColor ?? '#8B4513');
          if (variant?.whiteWash) { o.material.map = null; o.material.needsUpdate = true; }
        }
      }
    });
  }

  // Klip adı çözümleyici: bazı modellerde 'walk/run' yerine 'horse.walk/
  // horse.gallop' gibi adlar var. Aday listesinden ilk bulunanı döndür.
  const pick = (cands) => { for (const c of cands) if (actions[c]) return c; return null; };
  const clipFor = useRef(null);
  // ÖNEMLİ: GLTF ilk render'da henüz yüklenmemişse `actions` boş olur; bu yüzden
  // klip çözümlemesini ÇÖZÜLENE KADAR tekrarla (yoksa null'lar cache'lenip
  // animasyon hiç oynamıyordu — Ahal Teke gibi preload'suz atlarda ayaklar
  // hareket etmiyordu).
  if (skeletal && (!clipFor.current || !(clipFor.current.idle || clipFor.current.walk || clipFor.current.run))) {
    clipFor.current = {
      idle: pick(['idle', 'Idle', 'horse.idle']),
      walk: pick(['walk', 'Walk', 'horse.walk']),
      run:  pick(['run', 'Run', 'gallop', 'horse.gallop', 'horse.canter', 'horse.trot']),
    };
  }

  useFrame(() => {
    const speed = animRef.current.speed;
    if (skeletal) {
      // idle / walk / run klipleri arasında geçiş (model-özel adlarla)
      const key = speed === 0 ? 'idle' : speed <= WALK_SPEED + 0.1 ? 'walk' : 'run';
      const want = clipFor.current?.[key] ?? clipFor.current?.walk ?? clipFor.current?.run;
      if (want && cur.current !== want && actions[want]) {
        if (actions[cur.current]) actions[cur.current].fadeOut(0.2);
        actions[want].reset().fadeIn(0.2).play();
        cur.current = want;
      }
    } else {
      // Morph model (horse.glb): durunca animasyonu durdur VE morph
      // etkilerini sıfırla — stop() mixer'ı keser ama son kare değerlerini
      // mesh'te bırakır; fill(0) atı doğal duruşa (4 ayak yerde) döndürür.
      const a = actions['horse_A_'] ?? actions[names[0]];
      if (a) {
        if (speed === 0) {
          if (a.isRunning()) {
            a.stop();
            cloned.current.traverse((o) => {
              if (o.morphTargetInfluences) o.morphTargetInfluences.fill(0);
            });
          }
        } else {
          if (!a.isRunning()) a.reset().play();
          a.timeScale = Math.max(0.4, speed / 10);
        }
      }
    }
  });

  return (
    <group ref={groupRef} scale={useScale} position={[0, useY, 0]}>
      <primitive object={cloned.current} />
    </group>
  );
}

// ── 3D sahne ──────────────────────────────────────────────────────────────────
export default function PaddockScene() {
  const paddockObstacles = useGameStore((s) => s.paddockObstacles);
  const selectedHorseId  = useGameStore((s) => s.selectedHorseId);
  const customHorses     = useGameStore((s) => s.customHorses ?? []);
  const variant = [...HORSES, ...customHorses].find((h) => h.id === selectedHorseId) ?? HORSES[0];

  const horseRefG = useRef();          // atın kök grubu (pozisyon + yaw)
  const posRef  = useRef({ x: 0, z: 4 });
  const yawRef  = useRef(0);
  const yRef    = useRef(0);
  const vyRef   = useRef(0);
  const animRef = useRef({ speed: 0 });
  const clearedRef = useRef(new Set()); // bu zıplamada aşılan engeller

  // Klavye (masaüstü testi): WASD/ok + boşluk
  useEffect(() => {
    const keys = {};
    const dn = (e) => {
      keys[e.code] = true;
      if (e.code === 'Space') paddockInput.jump = true;
      sync();
    };
    const up = (e) => { keys[e.code] = false; sync(); };
    const sync = () => {
      let dx = 0, dz = 0;
      if (keys.KeyA || keys.ArrowLeft)  dx -= 1;
      if (keys.KeyD || keys.ArrowRight) dx += 1;
      if (keys.KeyW || keys.ArrowUp)    dz -= 1;
      if (keys.KeyS || keys.ArrowDown)  dz += 1;
      const l = Math.hypot(dx, dz);
      paddockInput.dx = l ? dx / l : 0;
      paddockInput.dz = l ? dz / l : 0;
      paddockInput.mag = l ? 1 : 0;
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  useFrame(({ camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const p = posRef.current;

    // Hareket
    const mag = paddockInput.mag;
    const speed = mag > 0.62 ? RUN_SPEED : mag > 0.05 ? WALK_SPEED : 0;
    animRef.current.speed = speed;
    if (speed > 0) {
      p.x = THREE.MathUtils.clamp(p.x + paddockInput.dx * speed * delta, -MOVE_CLAMP, MOVE_CLAMP);
      p.z = THREE.MathUtils.clamp(p.z + paddockInput.dz * speed * delta, -MOVE_CLAMP, MOVE_CLAMP);
      const targetYaw = Math.atan2(paddockInput.dx, paddockInput.dz);
      let d = targetYaw - yawRef.current;
      while (d >  Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yawRef.current += d * Math.min(1, 10 * delta);
    }

    // Engel çarpışması: yeterince yükseğe zıplamadıysa (y < 0.45) engellerin
    // içinden geçilemez — at engel yarıçapının dışına itilir. Zıplayarak
    // üzerinden geçmek serbest (XP de oradan kazanılıyor).
    if (yRef.current < 0.45) {
      const obstacles = useGameStore.getState().paddockObstacles;
      const R = 1.15;
      for (const o of obstacles) {
        const dx = p.x - o.x, dz = p.z - o.z;
        const d = Math.hypot(dx, dz);
        if (d < R && d > 0.0001) {
          p.x = THREE.MathUtils.clamp(o.x + (dx / d) * R, -MOVE_CLAMP, MOVE_CLAMP);
          p.z = THREE.MathUtils.clamp(o.z + (dz / d) * R, -MOVE_CLAMP, MOVE_CLAMP);
        }
      }
    }

    // Zıplama
    if (paddockInput.jump) {
      paddockInput.jump = false;
      if (yRef.current <= 0.01) { vyRef.current = JUMP_V; sfx.jump(); }
    }
    if (yRef.current > 0 || vyRef.current > 0) {
      vyRef.current += GRAVITY * delta;
      yRef.current = Math.max(0, yRef.current + vyRef.current * delta);
      if (yRef.current === 0) { vyRef.current = 0; clearedRef.current.clear(); }
    }

    // Havadayken engel üstünden geçiş → XP
    if (yRef.current > 0.3) {
      const st = useGameStore.getState();
      for (const o of st.paddockObstacles) {
        if (clearedRef.current.has(o.id)) continue;
        if (Math.hypot(p.x - o.x, p.z - o.z) < 1.4) {
          clearedRef.current.add(o.id);
          const leveled = st.addTrainingXP(st.selectedHorseId, XP_PER_JUMP);
          sfx.collect();
          st.showPaddockToast(
            leveled.length
              ? '🎉 ' + t('SEVİYE ATLADI!') + ` (+${XP_PER_JUMP} XP)`
              : `+${XP_PER_JUMP} XP`
          );
        }
      }
    }

    // Grubu uygula
    if (horseRefG.current) {
      horseRefG.current.position.set(p.x, 1.1 + yRef.current, p.z);
      horseRefG.current.rotation.y = yawRef.current;
    }

    // Kamera: atı takip eden sabit açı
    camera.fov = THREE.MathUtils.lerp(camera.fov, 55, 4 * delta);
    camera.updateProjectionMatrix();
    const camTarget = new THREE.Vector3(p.x, 7.5, p.z + 11);
    camera.position.lerp(camTarget, 4 * delta);
    camera.lookAt(p.x, 1, p.z);
  });

  // Zemine dokun → yerleştirme modundaysa engeli koy
  const onGround = (e) => {
    const st = useGameStore.getState();
    if (!st.paddockPlacing) return;
    e.stopPropagation();
    const x = THREE.MathUtils.clamp(e.point.x, -HALF + 2, HALF - 2);
    const z = THREE.MathUtils.clamp(e.point.z, -HALF + 2, HALF - 2);
    st.placePaddockObstacle(x, z);
    st.showPaddockToast('✅ ' + t('Engel yerleştirildi'));
  };

  return (
    <group>
      <color attach="background" args={['#9fd0e8']} />
      <ambientLight intensity={0.65} color="#fff4e0" />
      <directionalLight castShadow position={[-25, 40, 20]} intensity={2.0} color="#fff2d8"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30} />
      <hemisphereLight skyColor="#bfe3f5" groundColor="#7a6030" intensity={0.55} />

      {/* Çevre çimi + sarı kum zemin */}
      <mesh material={grassMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[160, 160]} />
      </mesh>
      <mesh material={sandMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}
        receiveShadow onPointerDown={onGround}>
        <planeGeometry args={[HALF * 2 + 3, HALF * 2 + 3]} />
      </mesh>

      <Fence />

      {/* Yerleştirilen engeller */}
      {paddockObstacles.map((o) => (
        <group key={o.id} position={[o.x, 0, o.z]}>
          <PaddockObstacle type={o.type} />
        </group>
      ))}

      {/* At */}
      <group ref={horseRefG} position={[0, 1.1, 4]}>
        <Suspense fallback={null}>
          <PaddockHorseModel variant={variant} animRef={animRef} />
        </Suspense>
      </group>
    </group>
  );
}

// ── DOM katmanı (Canvas dışında render edilir) ────────────────────────────────
const SHOP_ITEMS = [
  { type: 'bar',  emoji: '🚧', name: 'Atlama Bariyeri', cost: 150 },
  { type: 'hay',  emoji: '🌾', name: 'Saman Balyası',   cost: 250 },
  { type: 'wall', emoji: '🧱', name: 'Taş Duvar',       cost: 400 },
];

export function PaddockUI() {
  useLang();
  const exitPaddock  = useGameStore((s) => s.exitPaddock);
  const carrots      = useGameStore((s) => s.carrots);
  const selectedHorseId = useGameStore((s) => s.selectedHorseId);
  const trainingXP   = useGameStore((s) => s.trainingXP);
  const horseUpgrades = useGameStore((s) => s.horseUpgrades);
  const placing      = useGameStore((s) => s.paddockPlacing);
  const buyPaddockObstacle = useGameStore((s) => s.buyPaddockObstacle);
  const setPaddockPlacing  = useGameStore((s) => s.setPaddockPlacing);
  const toast   = useGameStore((s) => s.paddockToast);
  const toastId = useGameStore((s) => s.paddockToastId);
  const customHorses = useGameStore((s) => s.customHorses ?? []);
  const freeUpgradeDate = useGameStore((s) => s.freeUpgradeDate);
  const canClaimFreeUpgrade = useGameStore((s) => s.canClaimFreeUpgrade);
  const claimFreeUpgrade = useGameStore((s) => s.claimFreeUpgrade);
  const horse = [...HORSES, ...customHorses].find((h) => h.id === selectedHorseId) ?? HORSES[0];

  const [shopOpen, setShopOpen] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false); // günlük ücretsiz yükseltme modalı
  const [toastVisible, setToastVisible] = useState(false);
  const dragRef = useRef(null);

  // Toast görünürlüğü
  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const t = setTimeout(() => setToastVisible(false), 1600);
    return () => clearTimeout(t);
  }, [toastId, toast]);

  // Sanal joystick — ÇOKLU DOKUNUŞ güvenli: canvas'a ilk basan parmağın
  // identifier'ına kilitlenir. Böylece ikinci parmakla ZIPLA'ya basıp
  // kaldırmak joystick'i SIFIRLAMAZ (hem koşup hem zıplama mümkün).
  useEffect(() => {
    const isCanvas = (e) => e.target && e.target.tagName === 'CANVAS';
    const start = (x, y, id) => { dragRef.current = { x, y, id }; };
    const move = (x, y) => {
      if (!dragRef.current) return;
      if (useGameStore.getState().paddockPlacing) return; // yerleştirirken yürüme
      const dx = x - dragRef.current.x;
      const dy = y - dragRef.current.y;
      const len = Math.hypot(dx, dy);
      const mag = Math.min(1, len / 90);
      paddockInput.dx = len > 8 ? dx / len : 0;
      paddockInput.dz = len > 8 ? dy / len : 0; // ekranda aşağı = kameraya doğru (+z)
      paddockInput.mag = len > 8 ? mag : 0;
    };
    const end = () => { dragRef.current = null; paddockInput.dx = paddockInput.dz = paddockInput.mag = 0; };

    const ts = (e) => {
      if (dragRef.current !== null) return;            // zaten bir parmak sürüklüyor
      if (!isCanvas(e)) return;                        // buton dokunuşları joystick değil
      const t = e.changedTouches[0];
      if (t) start(t.clientX, t.clientY, t.identifier);
    };
    const tm = (e) => {
      const d = dragRef.current;
      if (!d) return;
      // yalnızca joystick parmağını izle (identifier eşleşmesi)
      for (const t of e.touches) {
        if (t.identifier === d.id) { move(t.clientX, t.clientY); return; }
      }
    };
    const te = (e) => {
      const d = dragRef.current;
      if (!d) return;
      // yalnızca joystick parmağı kalktıysa bitir; ZIPLA parmağı ise dokunma
      for (const t of e.changedTouches) {
        if (t.identifier === d.id) { end(); return; }
      }
    };
    const md = (e) => { if (isCanvas(e)) start(e.clientX, e.clientY, 'mouse'); };
    const mm = (e) => { if (dragRef.current?.id === 'mouse') move(e.clientX, e.clientY); };
    const mu = () => { if (dragRef.current?.id === 'mouse') end(); };

    window.addEventListener('touchstart',  ts, { passive: true });
    window.addEventListener('touchmove',   tm, { passive: true });
    window.addEventListener('touchend',    te);
    window.addEventListener('touchcancel', te);
    window.addEventListener('mousedown',   md);
    window.addEventListener('mousemove',   mm);
    window.addEventListener('mouseup',     mu);
    return () => {
      window.removeEventListener('touchstart',  ts);
      window.removeEventListener('touchmove',   tm);
      window.removeEventListener('touchend',    te);
      window.removeEventListener('touchcancel', te);
      window.removeEventListener('mousedown',   md);
      window.removeEventListener('mousemove',   mm);
      window.removeEventListener('mouseup',     mu);
      end();
    };
  }, []);

  const xp  = trainingXP[selectedHorseId] ?? 0;
  const ups = horseUpgrades[selectedHorseId] ?? { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 };
  const totalLv = (ups.speedLevel ?? 0) + (ups.maneuvLevel ?? 0) + (ups.jumpLevel ?? 0);

  return (
    <>
      {/* Üst bar: çık + at bilgisi + XP */}
      <div style={S.topBar}>
        <button style={S.exitBtn} onClick={exitPaddock}>← {t('ÇIK')}</button>
        <div style={S.horseInfo}>
          <div style={S.horseName}>🐎 {t(horse.name)} <span style={S.lv}>{t('SV')} {Math.min(totalLv, 10)}/10{totalLv >= 10 ? ' ✓' : ''}</span></div>
          {totalLv < 10 ? (
            <>
              <div style={S.xpBarBg}><div style={{ ...S.xpBarFill, width: `${xp}%` }} /></div>
              <div style={S.xpText}>{t('Antrenman:')} {xp}/100 XP</div>
            </>
          ) : (
            <div style={S.xpText}>🏆 {t('Antrenman tamamlandı! Günlük ücretsiz yükseltme aç.')}</div>
          )}
        </div>
        <div style={S.carrots}>🥕 {carrots.toLocaleString()}</div>
      </div>

      {/* Yerleştirme ipucu */}
      {placing && (
        <div style={S.placingHint}>
          👇 {t('Zemine dokun → engeli yerleştir')}
          <button style={S.cancelPlace} onClick={() => setPaddockPlacing(null)}>{t('İptal')}</button>
        </div>
      )}

      {/* Toast */}
      {toastVisible && <div style={S.toast}>{toast}</div>}

      {/* Alt kontroller */}
      <div style={S.hint}>{t('parmağını sürükle → yürü / koş')}</div>
      <button
        style={S.jumpBtn}
        onTouchStart={(e) => { e.stopPropagation(); paddockInput.jump = true; }}
        onTouchEnd={(e) => e.stopPropagation()}
        onMouseDown={(e) => { e.stopPropagation(); paddockInput.jump = true; }}
      >
        ⬆<br /><span style={{ fontSize: 10 }}>{t('ZIPLA')}</span>
      </button>
      <button style={S.shopBtn} onClick={() => setShopOpen(true)}>🛒 {t('ENGEL AL')}</button>

      {/* Antrenman 10'a ulaştıysa: günlük ücretsiz yükseltme */}
      {totalLv >= 10 && (
        <button
          style={{ ...S.freeBtn, opacity: canClaimFreeUpgrade(selectedHorseId) ? 1 : 0.5 }}
          onClick={() => setFreeOpen(true)}
        >
          🎁 {canClaimFreeUpgrade(selectedHorseId) ? t('ÜCRETSİZ YÜKSELT') : t('BUGÜN KULLANILDI')}
        </button>
      )}

      {/* Günlük ücretsiz yükseltme modalı — atın özelliklerini göster, 1'ini seç */}
      {freeOpen && (
        <div style={S.shopModal}>
          <div style={S.shopBox}>
            <div style={S.shopHeader}>
              <span style={S.shopTitle}>🎁 {t('GÜNLÜK ÜCRETSİZ YÜKSELTME')}</span>
              <button style={S.close} onClick={() => setFreeOpen(false)}>✕</button>
            </div>
            <div style={S.shopNote}>
              {t('{name} antrenmanı tamamladı! Günde 1 kez bir özelliği ücretsiz yükselt.', { name: t(horse.name) })}
            </div>
            {[
              { key: 'speedLevel',  icon: '⚡', label: t('HIZ'),     color: '#ff9800' },
              { key: 'maneuvLevel', icon: '🎯', label: t('MANEVRA'), color: '#4fc3f7' },
              { key: 'jumpLevel',   icon: '🌙', label: t('ZIPLAMA'), color: '#ce93d8' },
            ].map(({ key, icon, label, color }) => {
              const lvl = ups[key] ?? 0;
              const maxed = lvl >= 5;
              const canClaim = canClaimFreeUpgrade(selectedHorseId);
              return (
                <button
                  key={key}
                  style={{ ...S.shopItem, opacity: (maxed || !canClaim) ? 0.45 : 1, cursor: (maxed || !canClaim) ? 'default' : 'pointer' }}
                  disabled={maxed || !canClaim}
                  onClick={() => {
                    if (claimFreeUpgrade(selectedHorseId, key)) setFreeOpen(false);
                  }}
                >
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, letterSpacing: 1, color }}>{label}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i < lvl ? color : 'rgba(255,255,255,0.15)' }} />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: maxed ? '#888' : '#33ff99' }}>{maxed ? t('MAKS') : `+1 →${lvl + 1}`}</span>
                </button>
              );
            })}
            {!canClaimFreeUpgrade(selectedHorseId) && (
              <div style={{ ...S.shopNote, color: '#ff9966' }}>{t('Bugünkü ücretsiz yükseltme kullanıldı — yarın tekrar gel!')}</div>
            )}
          </div>
        </div>
      )}

      {/* Engel mağazası */}
      {shopOpen && (
        <div style={S.shopModal}>
          <div style={S.shopBox}>
            <div style={S.shopHeader}>
              <span style={S.shopTitle}>🛒 {t('ENGEL MAĞAZASI')}</span>
              <button style={S.close} onClick={() => setShopOpen(false)}>✕</button>
            </div>
            <div style={S.shopNote}>{t('Engel al, zemine yerleştir, üzerinden atlayarak atını geliştir!')} {t('Her atlayış +{n} XP.', { n: XP_PER_JUMP })}</div>
            {SHOP_ITEMS.map((it) => (
              <button
                key={it.type}
                style={{ ...S.shopItem, opacity: carrots >= it.cost ? 1 : 0.45 }}
                onClick={() => {
                  const ok = buyPaddockObstacle(it.type, it.cost);
                  if (ok) setShopOpen(false);
                }}
              >
                <span style={{ fontSize: 22 }}>{it.emoji}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{t(it.name)}</span>
                <span style={{ color: '#ffd700', fontWeight: 800 }}>🥕 {it.cost}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const S = {
  topBar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 5000,
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)',
    fontFamily: 'var(--game-font)', userSelect: 'none',
  },
  exitBtn: {
    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.25)',
    color: '#fff', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--game-font)',
    fontWeight: 700, fontSize: 12, letterSpacing: 1, cursor: 'pointer',
  },
  horseInfo: { flex: 1, minWidth: 0 },
  horseName: { color: '#fff', fontWeight: 800, fontSize: 13, textShadow: '0 1px 3px #000' },
  lv: { color: '#ffd700', fontSize: 11 },
  xpBarBg: { height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 3, overflow: 'hidden', marginTop: 4, maxWidth: 220 },
  xpBarFill: { height: '100%', background: 'linear-gradient(90deg,#33ff99,#ffd700)', borderRadius: 3, transition: 'width 0.3s' },
  xpText: { color: 'rgba(255,255,255,0.75)', fontSize: 9, marginTop: 2, textShadow: '0 1px 2px #000' },
  carrots: { color: '#ffd700', fontWeight: 800, fontSize: 13, textShadow: '0 1px 3px #000' },
  placingHint: {
    position: 'fixed', top: 74, left: '50%', transform: 'translateX(-50%)', zIndex: 5001,
    background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,215,0,0.5)', color: '#ffd700',
    borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--game-font)', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  cancelPlace: { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--game-font)', fontSize: 11 },
  toast: {
    position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 5002,
    color: '#33ff99', fontFamily: 'var(--game-font)', fontSize: 22, fontWeight: 900,
    textShadow: '0 0 14px rgba(51,255,153,0.7), 0 2px 4px #000', pointerEvents: 'none',
  },
  hint: {
    position: 'fixed', bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', left: 14, zIndex: 5000,
    color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--game-font)', fontSize: 11, pointerEvents: 'none',
    textShadow: '0 1px 3px #000',
  },
  jumpBtn: {
    position: 'fixed', right: 16, bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', zIndex: 5000,
    width: 76, height: 76, borderRadius: '50%',
    background: 'rgba(255,165,0,0.25)', border: '2px solid rgba(255,165,0,0.6)', color: '#fff',
    fontSize: 22, fontFamily: 'var(--game-font)', fontWeight: 800, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  shopBtn: {
    position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', zIndex: 5000,
    background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,215,0,0.5)', color: '#ffd700',
    borderRadius: 22, padding: '11px 18px', fontFamily: 'var(--game-font)', fontWeight: 800, fontSize: 12,
    letterSpacing: 1, cursor: 'pointer',
  },
  freeBtn: {
    position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', zIndex: 5000,
    background: 'linear-gradient(135deg,#2a8a4a,#1a6a30)', border: '1px solid rgba(51,255,153,0.6)', color: '#eafff2',
    borderRadius: 22, padding: '11px 20px', fontFamily: 'var(--game-font)', fontWeight: 800, fontSize: 12,
    letterSpacing: 1, cursor: 'pointer', boxShadow: '0 0 20px rgba(51,255,153,0.35)',
  },
  shopModal: {
    position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
  },
  shopBox: {
    width: '100%', maxWidth: 360, background: 'linear-gradient(160deg, rgba(18,18,34,0.98), rgba(10,10,20,0.99))',
    border: '1px solid rgba(255,215,0,0.3)', borderRadius: 16, padding: '16px 14px', fontFamily: 'var(--game-font)',
  },
  shopHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  shopTitle: { color: '#ffd700', fontWeight: 800, fontSize: 15, letterSpacing: 1 },
  close: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, cursor: 'pointer' },
  shopNote: { color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 1.5, marginBottom: 12 },
  shopItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 8,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '12px 12px', color: '#fff', fontFamily: 'var(--game-font)',
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
};
