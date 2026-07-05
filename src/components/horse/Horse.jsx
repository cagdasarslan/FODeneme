import { useRef, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { sfx, setGallopSpeed } from '@/utils/audio';
import { useGLTF, useAnimations } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useHorseControls } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';
import HorseErrorBoundary from './HorseErrorBoundary';
import { obstacleRegistry } from '@/utils/obstacleRegistry';
import { horseRef } from '@/utils/horseRef';
import { HALF_TRACK, HORSE_LATERAL_SPEED, LANES, COLLISION_DX, COLLISION_DZ, CLOSE_CALL_RADIUS, SLIDE_DURATION_MS, SPACE_GRAVITY_MULT, SPACE_JUMP_MULT } from '@/constants/game';
import { getHitbox, getKind } from '@/components/obstacles/ObstacleSpawner';
import { getTimeScale } from '@/utils/slowmo';
import { haptic } from '@/utils/haptics';
import { CHARACTERS } from '@/constants/characters';
import { HORSES } from '@/constants/horses';

const CHAR_BASE = '/assets/models/characters/';
CHARACTERS.forEach(c => useGLTF.preload(CHAR_BASE + c.file));

// ── Jockey — selected character riding on top of the horse ────────────────────
// At sırtı (eyer) hizası: RigidBody-lokal koordinatlarda
const JOCKEY_Y = 0.55;
const JOCKEY_Z = 0.18;
function JockeyInner({ charFile }) {
  const { scene } = useGLTF(CHAR_BASE + charFile);
  const cloned = useRef(null);
  const groupRef = useRef();
  const t = useRef(0);

  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  useFrame((_, delta) => {
    const { phase, speed } = useGameStore.getState();
    if (phase !== 'playing' || !groupRef.current) return;
    t.current += delta * (speed / 12) * 3.5;
    const s = t.current;
    const bob = Math.abs(Math.sin(s * 2)) * 0.05;
    const sway = Math.sin(s * 2) * 0.03;
    const lean = 0.22 + Math.min(0.14, (speed - 12) / 180);
    groupRef.current.position.y = JOCKEY_Y + bob;
    groupRef.current.rotation.x = lean;
    groupRef.current.rotation.z = sway;
  });

  return (
    <group ref={groupRef} position={[0, JOCKEY_Y, JOCKEY_Z]} rotation={[0.22, Math.PI, 0]}>
      <primitive object={cloned.current} scale={0.30} />
    </group>
  );
}

function Jockey() {
  const selectedCharacterId = useGameStore(s => s.selectedCharacterId);
  const char = CHARACTERS.find(c => c.id === selectedCharacterId) ?? CHARACTERS[0];
  return (
    <Suspense fallback={null}>
      {/* key=char.file: karakter değişince yeniden klonlansın (hep aynı jokey bug'ı) */}
      <JockeyInner key={char.file} charFile={char.file} />
    </Suspense>
  );
}

// ── Pegasus Kanatları (uçuş yeteneği görseli) ────────────────────────────────
const wingMat = new THREE.MeshStandardMaterial({
  color: '#ffffff', emissive: '#cfe8ff', emissiveIntensity: 0.5,
  roughness: 0.35, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
});
const wingGeo2 = new THREE.BoxGeometry(1.15, 0.06, 0.5);

function PegasusWings() {
  const visible = useGameStore((s) => s.wingsActive);
  const lRef = useRef();
  const rRef = useRef();
  useFrame(() => {
    if (!visible) return;
    const a = Math.sin(performance.now() / 90) * 0.55; // kanat çırpma
    if (lRef.current) lRef.current.rotation.z =  0.35 + a;
    if (rRef.current) rRef.current.rotation.z = -0.35 - a;
  });
  if (!visible) return null;
  return (
    <group position={[0, 0.45, 0.1]}>
      <group ref={lRef} position={[-0.2, 0, 0]}>
        <mesh geometry={wingGeo2} material={wingMat} position={[-0.62, 0, 0]} castShadow />
      </group>
      <group ref={rRef} position={[0.2, 0, 0]}>
        <mesh geometry={wingGeo2} material={wingMat} position={[0.62, 0, 0]} castShadow />
      </group>
    </group>
  );
}

const FLY_Y = 4.2;            // uçuş yüksekliği (RigidBody y)
const _horseT = { x: 0, y: 0, z: 0 }; // her kare rapier setTranslation için paylaşılan obje (allocation yok)
// Çarpışma toleransı: hitbox'ın kenarına sürtmek öldürmesin — yalnızca
// gerçekten engelin İÇİNE girince çarpma sayılır (yanlardan %25, önden %12 pay)
const HIT_TOL_X = 0.75;
const HIT_TOL_Z = 0.88;
// Zıplama muafiyeti (jump clearance): at zeminden bu kadar yükseldiyse zemin
// engelleri artık çarpmaz. Eskiden 1.0 idi — yakından zıplayınca at daha bu
// yüksekliğe tırmanamadan hitbox'a giriyor, "değmeden yanıyordun". Havadayken
// hitbox da daralır: kalkış/iniş kenarları affedilir.
const CLEAR_JUMP_Y  = 0.4;
const AIR_TOL       = 0.7;
const CLOSE_CALL_CD   = 0.8;  // close-call cooldown (saniye)
const GROUND_Y        = 1.2;  // yol yüzeyindeki rigidBody y yüksekliği
const JUMP_FORCE      = 9;    // zıplama başlangıç hızı (m/s)
const JUMP_GRAVITY    = -24;  // yerçekimi ivmesi (m/s²)

const TILT_MAX    = 0.18;
const TILT_SMOOTH = 9;
const MODEL_PATH = '/assets/models/horse.glb';

// ── Materyaller ───────────────────────────────────────────────────────────────
const M_BODY  = new THREE.MeshStandardMaterial({ color: '#8B4513' });
const M_DARK  = new THREE.MeshStandardMaterial({ color: '#5C2A08' });
const M_MANE  = new THREE.MeshStandardMaterial({ color: '#2C1005' });
const M_EYE   = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveIntensity: 0.1 });
const M_HOOF  = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
const M_DUST  = new THREE.MeshStandardMaterial({ color: '#c8a06a', transparent: true, opacity: 0.35, depthWrite: false });

// ── Procedural placeholder ────────────────────────────────────────────────────
function HorsePlaceholder({ groupRef }) {
  const bodyRef   = useRef();
  const legRefs   = [useRef(), useRef(), useRef(), useRef()];
  const headRef   = useRef();
  const tailRef   = useRef();
  const dustRefs  = [useRef(), useRef(), useRef(), useRef()];
  const t         = useRef(0);
  const phase     = useGameStore((s) => s.phase);
  const speed     = useGameStore((s) => s.speed);

  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    t.current += delta * (speed / 12) * 3.5;
    const s = t.current;

    // Gövde zıplaması
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.abs(Math.sin(s * 2)) * 0.12;
    }
    // Baş sallama
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(s * 2) * 0.18;
    }
    // Kuyruk sallama
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(s * 3) * 0.25;
    }
    // Bacaklar — dörtnala ritmi (çapraz çift)
    const legAngles = [
      Math.sin(s * 2),          // sol ön
      Math.sin(s * 2 + Math.PI),// sağ ön
      Math.sin(s * 2 + Math.PI),// sol arka
      Math.sin(s * 2),           // sağ arka
    ];
    legRefs.forEach((r, i) => {
      if (r.current) r.current.rotation.x = legAngles[i] * 0.55;
    });
    // Toz parçacıkları — sol/sağ arka bacaklar
    dustRefs.forEach((r, i) => {
      if (!r.current) return;
      const cycle = (s * 2 + (i < 2 ? 0 : Math.PI)) % (Math.PI * 2);
      r.current.visible = cycle < 0.6;
      r.current.scale.setScalar(0.5 + Math.sin(cycle) * 0.5);
      r.current.material.opacity = 0.25 * Math.sin(cycle);
    });
  });

  const legPos = [
    [-0.22, 0, 0.38],  // sol ön
    [ 0.22, 0, 0.38],  // sağ ön
    [-0.22, 0, -0.38], // sol arka
    [ 0.22, 0, -0.38], // sağ arka
  ];

  return (
    <group ref={groupRef} position={[0, -0.12, 0]}>
      {/* Gövde */}
      <group ref={bodyRef} position={[0, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.65, 0.52, 1.3]} />
          <primitive object={M_BODY} attach="material" />
        </mesh>
        {/* Boyun */}
        <mesh castShadow position={[0, 0.3, 0.52]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.28, 0.52, 0.26]} />
          <primitive object={M_BODY} attach="material" />
        </mesh>
        {/* Baş */}
        <group ref={headRef} position={[0, 0.62, 0.72]}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.38, 0.52]} />
            <primitive object={M_BODY} attach="material" />
          </mesh>
          {/* Burun */}
          <mesh position={[0, -0.1, 0.28]}>
            <boxGeometry args={[0.22, 0.22, 0.18]} />
            <primitive object={M_DARK} attach="material" />
          </mesh>
          {/* Gözler */}
          {[-0.15, 0.15].map((x, i) => (
            <mesh key={i} position={[x, 0.06, 0.22]}>
              <sphereGeometry args={[0.055, 6, 6]} />
              <primitive object={M_EYE} attach="material" />
            </mesh>
          ))}
          {/* Kulaklar */}
          {[-0.1, 0.1].map((x, i) => (
            <mesh key={i} position={[x, 0.28, -0.06]}>
              <coneGeometry args={[0.055, 0.15, 4]} />
              <primitive object={M_BODY} attach="material" />
            </mesh>
          ))}
        </group>
        {/* Yele */}
        <mesh position={[0, 0.48, 0.35]}>
          <boxGeometry args={[0.1, 0.28, 0.5]} />
          <primitive object={M_MANE} attach="material" />
        </mesh>
        {/* Kuyruk */}
        <group ref={tailRef} position={[0, 0.1, -0.7]}>
          <mesh>
            <boxGeometry args={[0.1, 0.5, 0.14]} />
            <primitive object={M_MANE} attach="material" />
          </mesh>
        </group>
        {/* Bacaklar */}
        {legPos.map((pos, i) => (
          <group key={i} ref={legRefs[i]} position={pos}>
            {/* Uyluk */}
            <mesh castShadow position={[0, -0.22, 0]}>
              <boxGeometry args={[0.14, 0.44, 0.14]} />
              <primitive object={M_BODY} attach="material" />
            </mesh>
            {/* Diz eklem */}
            <mesh position={[0, -0.48, 0]}>
              <sphereGeometry args={[0.08, 6, 6]} />
              <primitive object={M_DARK} attach="material" />
            </mesh>
            {/* Alt bacak */}
            <mesh castShadow position={[0, -0.66, 0]}>
              <boxGeometry args={[0.1, 0.36, 0.1]} />
              <primitive object={M_DARK} attach="material" />
            </mesh>
            {/* Toynak */}
            <mesh position={[0, -0.88, 0]}>
              <boxGeometry args={[0.14, 0.1, 0.16]} />
              <primitive object={M_HOOF} attach="material" />
            </mesh>
          </group>
        ))}
        {/* Toz parçacıkları */}
        {[[-0.22, -0.9, -0.38], [0.22, -0.9, -0.38], [-0.22, -0.9, 0.38], [0.22, -0.9, 0.38]].map(
          (pos, i) => (
            <mesh key={i} ref={dustRefs[i]} position={pos} visible={false}>
              <sphereGeometry args={[0.25, 5, 5]} />
              <primitive object={M_DUST} attach="material" />
            </mesh>
          )
        )}
      </group>
    </group>
  );
}

// ── GLB model — varsayılan morph ('horse_A_') VEYA özel iskeletli model ───────
function HorseModel({ modelPath, scale, groupRef, horseVariant }) {
  // Varyant kendi modelini taşıyabilir (ör. stilize kestane)
  const path      = horseVariant?.model ?? modelPath;
  const useScale  = horseVariant?.modelScale ?? scale;
  const useY      = horseVariant?.modelY ?? -1.05;
  const useZ      = horseVariant?.modelZ ?? 0;
  const clipName  = horseVariant?.animClip ?? 'horse_A_';
  const skeletal  = !!horseVariant?.skeletal;
  const noTint    = !!horseVariant?.noTint;

  const { scene, animations } = useGLTF(path);
  const { actions, names }    = useAnimations(animations, groupRef);
  const clonedScene  = useRef(null);
  const clonedPath   = useRef(null);
  const lastVariant  = useRef(null);
  const phase        = useGameStore((s) => s.phase);

  // Model yolu değişince yeniden klonla. İskeletli (skinned) modeller için
  // SkeletonUtils.clone şart (scene.clone iskeleti bozar).
  if (clonedPath.current !== path) {
    clonedPath.current = path;
    lastVariant.current = null;
    clonedScene.current = skeletal ? skeletonClone(scene) : scene.clone(true);
    clonedScene.current.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow    = true;
        obj.receiveShadow = true;
        if (obj.morphTargetInfluences) obj.updateMorphTargets?.();
      }
    });
  }

  // Renklendirme yalnızca varsayılan (dokusuz) modelde
  if (!noTint && horseVariant && horseVariant.id !== lastVariant.current) {
    lastVariant.current = horseVariant.id;
    let meshIdx = 0;
    clonedScene.current.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material = obj.material.clone();
      obj.material.color.set(meshIdx === 0 ? horseVariant.bodyColor : horseVariant.maneColor);
      if (horseVariant.whiteWash) {
        obj.material.map = null;
        obj.material.roughness = 0.55;
        obj.material.metalness = 0.0;
        obj.material.needsUpdate = true;
      }
      meshIdx++;
    });
  }

  const pickAction = () => actions[clipName] ?? actions['run'] ?? actions[names[0]];

  useEffect(() => {
    const action = pickAction();
    if (!action) return;
    if (phase === 'playing') action.reset().fadeIn(0.25).play();
    else action.fadeOut(0.25);
    return () => action.stop();
  }, [phase, actions, names]);

  useFrame(() => {
    const action = pickAction();
    if (action) action.timeScale = useGameStore.getState().speed / 14;
  });

  return (
    <group ref={groupRef} scale={useScale} rotation={[0, Math.PI, 0]} position={[0, useY, useZ]}>
      <primitive object={clonedScene.current} />
    </group>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
// Yol yüzeyi y=0.15, collider alt = pos.y − 1.05 → pos.y = 0.15 + 1.05 = 1.2
// Three.js Horse.glb scale 0.013 ≈ 1.3 birim yükseklik
export default function Horse({ modelPath = MODEL_PATH, scale = 0.013 }) {
  const rigidBodyRef   = useRef(null);
  const modelGroupRef  = useRef(null);
  const placeholderRef = useRef(null);
  const tiltRef        = useRef(0);
  const velYRef        = useRef(0);
  const onGroundRef    = useRef(true);
  const jumpPressedRef = useRef(false);

  const controls      = useHorseControls();
  const closeCoolRef  = useRef(0);
  const graceRef      = useRef(0); // collision grace period at run start
  const laneRef       = useRef(1); // 0=sol, 1=orta, 2=sağ
  const prevLeftRef   = useRef(false);
  const prevRightRef  = useRef(false);
  const selectedHorseId = useGameStore((s) => s.selectedHorseId);
  const horseUpgrades   = useGameStore((s) => s.horseUpgrades);
  const customHorses    = useGameStore((s) => s.customHorses ?? []);
  const horseVariant    = [...HORSES, ...customHorses].find(h => h.id === selectedHorseId) ?? HORSES[0];
  const horseUps        = horseUpgrades?.[selectedHorseId] ?? { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 };
  const { phase, tick, registerCloseCall, registerCollision, registerJumpOver, runId, reviveId } = useGameStore(
    (s) => ({
      phase: s.phase,
      tick: s.tick,
      registerCloseCall: s.registerCloseCall,
      registerCollision: s.registerCollision,
      registerJumpOver: s.registerJumpOver,
      runId: s.runId,
      reviveId: s.reviveId,
    })
  );
  const mapId     = useGameStore((s) => s.mapId);
  const stumbleId = useGameStore((s) => s.stumbleId);
  const jumpedRef = useRef(new Set()); // bu zıplamada üzerinden atlanan engeller
  const clearedJumpRef = useRef(false); // bu zıplamada muafiyet yüksekliğine ulaşıldı mı
  const prevFlyingRef = useRef(false); // Pegasus uçuşu geçiş takibi

  // ── Eğilme (slide) durumu ──────────────────────────────────────────────────
  const crouchRef       = useRef();       // model+jokey sarmalayıcı (çömelme görseli)
  const slideUntilRef   = useRef(0);      // performance.now() < bu → eğiliyor
  const slidePressedRef = useRef(false);
  const slidUnderRef    = useRef(new Set()); // altından kayılan üst engeller (tek ödül)

  // Tökezleme: store stumbleId artınca kısa dokunulmazlık ver (ikinci çarpma
  // penceresi içinde tekrar aynı engele takılmasın)
  useEffect(() => {
    if (stumbleId > 0) graceRef.current = Math.max(graceRef.current, 1.2);
  }, [stumbleId]);

  // Yeni koşu başlayınca ata başlangıç pozisyonuna dön
  useEffect(() => {
    if (!rigidBodyRef.current) return;
    rigidBodyRef.current.setTranslation({ x: 0, y: GROUND_Y, z: 0 }, true);
    velYRef.current     = 0;
    onGroundRef.current = true;
    tiltRef.current     = 0;
    closeCoolRef.current = 0;
    graceRef.current     = 1.5;
    laneRef.current      = 1;
    prevLeftRef.current  = false;
    prevRightRef.current = false;
    jumpedRef.current.clear();
    slideUntilRef.current = 0;
    slidUnderRef.current.clear();
  }, [runId]);

  // Devam et (revive): skoru koruyarak atı diriltir — pozisyon sıfırlanır ve
  // ekrandaki engeller geçene kadar uzun bir dokunulmazlık (grace) verilir.
  useEffect(() => {
    if (reviveId === 0 || !rigidBodyRef.current) return;
    rigidBodyRef.current.setTranslation({ x: 0, y: GROUND_Y, z: 0 }, true);
    velYRef.current      = 0;
    onGroundRef.current  = true;
    tiltRef.current      = 0;
    closeCoolRef.current = 0;
    graceRef.current     = 2.5; // ekrandaki engeller güvenle geçsin
    laneRef.current      = 1;
    prevLeftRef.current  = false;
    prevRightRef.current = false;
    jumpedRef.current.clear();
  }, [reviveId]);

  useFrame((_, delta) => {
    if (phase !== 'playing' || !rigidBodyRef.current) return;
    tick(delta);
    setGallopSpeed(useGameStore.getState().speed); // nal sesi temposu (slow-mo'da store.speed yavaşladığı için otomatik senkron)
    // Sinematik slow-mo: atın kendi hareketi (şerit + zıplama yayı) dünyayla
    // uyumlu yavaşlasın. gdt = ölçeklenmiş delta.
    const gts = getTimeScale();
    const gdt = delta * gts;

    const rb  = rigidBodyRef.current;
    const pos = rb.translation();

    // ── Şerit bazlı yatay hareket (lane snap) ─────────────────────────────
    const maneuvMult  = (horseVariant.baseManeuvMult ?? 1.0) * (1 + horseUps.maneuvLevel * 0.1);
    const laneSpeed   = HORSE_LATERAL_SPEED * maneuvMult;
    const leftNow  = controls.current.left;
    const rightNow = controls.current.right;
    if (leftNow  && !prevLeftRef.current)  laneRef.current = Math.max(0, laneRef.current - 1);
    if (rightNow && !prevRightRef.current) laneRef.current = Math.min(2, laneRef.current + 1);
    prevLeftRef.current  = leftNow;
    prevRightRef.current = rightNow;
    const targetX  = LANES[laneRef.current];
    const newX     = THREE.MathUtils.lerp(pos.x, targetX, laneSpeed * gdt);
    const clampedX = THREE.MathUtils.clamp(newX, -HALF_TRACK, HALF_TRACK);
    const vx = (clampedX - pos.x) / Math.max(delta, 0.001);

    // ── Yetenek durumları (Pegasus uçuşu / turbo muafiyeti) ────────────────
    const st0    = useGameStore.getState();
    const flying = st0.wingsActive;
    const immune = flying || st0.turboActive;
    if (flying && !prevFlyingRef.current) {
      onGroundRef.current = false; // uçuşa geç
    } else if (!flying && prevFlyingRef.current) {
      // Uçuş bitti: yere inerken çarpmaması için kısa dokunulmazlık
      graceRef.current = Math.max(graceRef.current, 0.8);
    }
    prevFlyingRef.current = flying;

    // ── Eğilme (slide) — üst engellerin altından geçmek için ───────────────
    const nowMs   = performance.now();
    const sliding = !flying && nowMs < slideUntilRef.current;
    const wantsSlide = controls.current.slide;
    if (wantsSlide && !slidePressedRef.current && onGroundRef.current && !sliding && !flying) {
      slideUntilRef.current = nowMs + SLIDE_DURATION_MS;
      sfx.click();
      haptic.light();
    }
    slidePressedRef.current = wantsSlide;

    // ── Zıplama (zıplama çarpanı; UZAY'da düşük yerçekimi = süzülen zıplama) ─
    const inSpace   = mapId === 4;
    const jumpMult  = (horseVariant.baseJumpMult ?? 1.0) * (1 + horseUps.jumpLevel * 0.06)
                    * (inSpace ? SPACE_JUMP_MULT : 1);
    const gravity   = JUMP_GRAVITY * (inSpace ? SPACE_GRAVITY_MULT : 1);
    const wantsJump = controls.current.jump;
    if (wantsJump && !jumpPressedRef.current && onGroundRef.current && !sliding && !flying) {
      velYRef.current     = JUMP_FORCE * jumpMult;
      onGroundRef.current = false;
      sfx.jump();
      useGameStore.getState().bumpDaily('jumps', 1);
    }
    jumpPressedRef.current = wantsJump;

    let newY = pos.y;
    if (flying) {
      // Pegasus uçuşu: sabit yüksekliğe süzül
      velYRef.current     = 0;
      onGroundRef.current = false;
      newY = THREE.MathUtils.lerp(pos.y, FLY_Y, Math.min(1, 5 * delta));
    } else if (!onGroundRef.current) {
      velYRef.current += gravity * gdt;
      newY += velYRef.current * gdt;
      // Bu zıplamada muafiyet yüksekliğine ulaşıldıysa işaretle → iniş dahil
      // tüm yay boyunca zemin engellerine muaf kal ("üstünden geçtim" hissi)
      if (newY > GROUND_Y + CLEAR_JUMP_Y) clearedJumpRef.current = true;
      if (newY <= GROUND_Y) {
        newY            = GROUND_Y;
        velYRef.current = 0;
        onGroundRef.current = true;
        clearedJumpRef.current = false; // yere inince sıfırla
      }
    }

    // Çömelme görseli: model+jokey sarmalayıcısını yumuşakça bastır
    if (crouchRef.current) {
      const tY = sliding ? 0.55 : 1;
      const tP = sliding ? -0.35 : 0;
      crouchRef.current.scale.y    = THREE.MathUtils.lerp(crouchRef.current.scale.y, tY, 14 * delta);
      crouchRef.current.position.y = THREE.MathUtils.lerp(crouchRef.current.position.y, tP, 14 * delta);
    }

    _horseT.x = clampedX; _horseT.y = newY; _horseT.z = pos.z;
    rb.setTranslation(_horseT, true); // paylaşılan obje — her karede allocation yok
    horseRef.x = clampedX;
    horseRef.z = pos.z;

    // ── Görsel tilt & zıplama eğimi ────────────────────────────────────────
    const targetTilt = THREE.MathUtils.clamp(-vx / (laneSpeed || 1) * TILT_MAX, -TILT_MAX, TILT_MAX);
    tiltRef.current  = THREE.MathUtils.lerp(tiltRef.current, targetTilt, TILT_SMOOTH * delta);
    const ref = modelGroupRef.current ?? placeholderRef.current;
    if (ref) {
      ref.rotation.z = tiltRef.current;
      // Zıplarken hafif öne eğim
      ref.rotation.x = onGroundRef.current ? 0 : THREE.MathUtils.clamp(-velYRef.current * 0.015, -0.25, 0.2);
    }

    graceRef.current     = Math.max(0, graceRef.current - delta);
    closeCoolRef.current = Math.max(0, closeCoolRef.current - delta);

    // ── Engel üzerinden atlama → adrenalin ödülü (yalnız ZEMİN engelleri) ──
    if (!immune && !onGroundRef.current && newY > GROUND_Y + CLEAR_JUMP_Y) {
      for (const [id, obs] of obstacleRegistry) {
        if (!obs.active || jumpedRef.current.has(id)) continue;
        if (getKind(obs.TypeFn) === 'overhead') continue;
        const [hbDx, hbDz] = getHitbox(obs.TypeFn);
        if (Math.abs(pos.x - obs.x) < hbDx && Math.abs(pos.z - obs.z) < hbDz) {
          jumpedRef.current.add(id);
          registerJumpOver();
        }
      }
    } else if (onGroundRef.current && jumpedRef.current.size) {
      jumpedRef.current.clear();
    }

    // ── ÜST ENGELLER: her yükseklikte kontrol — zıplayarak geçilmez! ───────
    // Eğilerek geçmek serbesttir ve ödül verir.
    if (!immune && graceRef.current <= 0) {
      for (const [id, obs] of obstacleRegistry) {
        if (!obs.active || getKind(obs.TypeFn) !== 'overhead') continue;
        if (obs.z > 2) { slidUnderRef.current.delete(id); continue; } // geçti → işareti temizle (pool id'si yeniden kullanılır)
        const [hbDx, hbDz] = getHitbox(obs.TypeFn);
        const dx = Math.abs(pos.x - obs.x);
        const dz = Math.abs(pos.z - obs.z);
        if (dx < hbDx * HIT_TOL_X && dz < hbDz * HIT_TOL_Z) {
          if (sliding) {
            if (!slidUnderRef.current.has(id)) {
              slidUnderRef.current.add(id);
              useGameStore.getState().registerSlideUnder();
            }
          } else {
            // Nal Zırhı: ilk çarpmayı emer
            if (useGameStore.getState().consumeShield()) {
              graceRef.current = 1.0;
              return;
            }
            registerCollision();
            return;
          }
        }
      }
    }

    // ── Zemin çarpışması — yeterince yüksekteyken atla ─────────────────────
    if (immune) return;
    const airborne = !onGroundRef.current;
    // Muafiyet: eşiğin üstündeysen VEYA bu zıplamada bir kez tepeye ulaştıysan
    // (iniş boyunca da güvenli) → zemin engeli çarpmaz
    if (airborne && (newY > GROUND_Y + CLEAR_JUMP_Y || clearedJumpRef.current)) return;
    if (graceRef.current > 0) return;
    // Havada ama eşiğin altında (kalkış/iniş anı): hitbox'ı daralt — kenara
    // sürtmek değil, ancak tam üstüne inmek çarpma sayılır
    const tolX = HIT_TOL_X * (airborne ? AIR_TOL : 1);
    const tolZ = HIT_TOL_Z * (airborne ? AIR_TOL : 1);
    for (const [, obs] of obstacleRegistry) {
      if (!obs.active) continue;
      if (getKind(obs.TypeFn) === 'overhead') continue; // yukarıda ele alındı
      const [hbDx, hbDz] = getHitbox(obs.TypeFn);
      const dx = Math.abs(pos.x - obs.x);
      const dz = Math.abs(pos.z - obs.z);
      if (dx < hbDx * tolX && dz < hbDz * tolZ) {
        // Nal Zırhı: ilk çarpmayı emer
        if (useGameStore.getState().consumeShield()) {
          graceRef.current = 1.0;
          return;
        }
        registerCollision();
        return;
      }
      if (dx < CLOSE_CALL_RADIUS && dz < CLOSE_CALL_RADIUS && closeCoolRef.current <= 0) {
        registerCloseCall();
        closeCoolRef.current = CLOSE_CALL_CD;
      }
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[0, 1.2, 0]}
    >
      <CapsuleCollider args={[0.5, 0.55]} />

      {/* Çömelme sarmalayıcısı: eğilirken model + jokey birlikte bastırılır */}
      <group ref={crouchRef}>
        <HorseErrorBoundary
          fallback={<HorsePlaceholder groupRef={placeholderRef} />}
        >
          <Suspense fallback={<HorsePlaceholder groupRef={placeholderRef} />}>
            <HorseModel modelPath={modelPath} scale={scale} groupRef={modelGroupRef} horseVariant={horseVariant} />
          </Suspense>
        </HorseErrorBoundary>

        <Jockey />
        <PegasusWings />
      </group>
    </RigidBody>
  );
}
