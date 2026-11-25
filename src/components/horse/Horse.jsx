import { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { sfx, setGallopSpeed } from '@/utils/audio';
import { makeKinematicBody } from '@/utils/kinematicBody';
import * as THREE from 'three';
import { useHorseControls } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';
import ProcHorse from './ProcHorse';
import PegasusWings from './PegasusWings';
import { obstacleRegistry } from '@/utils/obstacleRegistry';
import { horseRef } from '@/utils/horseRef';
import { HALF_TRACK, HORSE_LATERAL_SPEED, LANES, COLLISION_DX, COLLISION_DZ, CLOSE_CALL_RADIUS, SLIDE_DURATION_MS, SPACE_GRAVITY_MULT, SPACE_JUMP_MULT } from '@/constants/game';
import { getHitbox, getKind, OVERHEAD_TOP } from '@/components/obstacles/ObstacleSpawner';
import { getTimeScale } from '@/utils/slowmo';
import { haptic } from '@/utils/haptics';
import { HORSES } from '@/constants/horses';

// ── Pegasus Kanatları (uçuş yeteneği görseli) ────────────────────────────────
// Kanat kökü (cidago) gövde-lokal konumu
const WING_Y = 0.66;
const WING_Z = -0.55;
const FLY_Y = 4.2;            // uçuş yüksekliği (RigidBody y)
const _horseT = { x: 0, y: 0, z: 0 }; // her kare setTranslation için paylaşılan obje (allocation yok)
// Çarpışma toleransı: hitbox'ın kenarına sürtmek öldürmesin — yalnızca
// gerçekten engelin İÇİNE girince çarpma sayılır (yanlardan %25, önden %12 pay)
const HIT_TOL_X = 0.68;
const HIT_TOL_Z = 0.78;
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

// ── Görsel at (prosedürel) ───────────────────────────────────────────────────
// Eski GLB ile aynı boyut/yerleşim: toynak tabanı gövde-lokal y=−1.04 (yol
// yüzeyi), baş −z yönünde, cidago ≈1.65 m. Yalnız görsel; çarpışma etkilenmez.
const VIS_SCALE = 1.08;
const VIS_Y     = -1.04;
const VIS_Z     = 0.1;

// ── Ana bileşen ───────────────────────────────────────────────────────────────
// Yol yüzeyi y=0.15, collider alt = pos.y − 1.05 → pos.y = 0.15 + 1.05 = 1.2
// eslint-disable-next-line no-unused-vars
export default function Horse({ modelPath, scale } = {}) {
  const rigidBodyRef   = useRef(null);
  // Kinematik gövde (eski Rapier RigidBody'nin yerine); başlangıç konumu yalnızca ilk bağlanışta
  const bodyRefCb = useCallback((g) => { rigidBodyRef.current = g ? makeKinematicBody(g, [0, 1.2, 0]) : null; }, []);
  const modelGroupRef  = useRef(null);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  // Görsel animasyon sürücüsü (ProcHorse okur): fizik döngüsü + durum izleyici yazar
  const driveRef = useRef({ mode: 'idle', speed: 0, airborne: false, velY: 0, slideLeft: 0, stumbleAge: 99, crashAge: -1, lateral: 0 });
  const stumbleAtRef = useRef(-1e9);
  const crashAtRef   = useRef(-1);
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
  const clearedObsRef = useRef(new Set()); // zıplayarak geçilen engeller — artık çarpamaz
  const justLandedRef = useRef(false); // bu karede yere indi (düşük FPS iniş artefaktı koruması)
  const jumpBufRef    = useRef(0); // zıplama girdi tamponu (saniye)
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
    if (stumbleId > 0) stumbleAtRef.current = performance.now();
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
    clearedObsRef.current.clear();
    justLandedRef.current = false;
    slideUntilRef.current = 0;
    slidUnderRef.current.clear();
    crashAtRef.current = -1;
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
    clearedObsRef.current.clear();
    justLandedRef.current = false;
    crashAtRef.current = -1;
  }, [reviveId]);

  // Görsel durum izleyici (her fazda çalışır): mod, hız, tökezleme, çarpma
  useFrame(() => {
    const st = useGameStore.getState();
    const d = driveRef.current;
    const now = performance.now();
    if ((st.dying || st.phase === 'crashed') && crashAtRef.current < 0) crashAtRef.current = now;
    d.crashAge = crashAtRef.current >= 0 ? (now - crashAtRef.current) / 1000 : -1;
    d.stumbleAge = (now - stumbleAtRef.current) / 1000;
    d.mode = st.phase === 'playing' && !st.dying ? 'run' : 'idle';
    d.speed = st.speed;
    if (st.phase !== 'playing') { d.airborne = false; d.slideLeft = 0; d.lateral = 0; }
  });

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
    // Girdi tamponu: havada/kayarken basılan zıplama YUTULMAZ — 0.25 sn
    // hatırlanır ve at müsait olur olmaz zıplar. "Bastım ama zıplamadı →
    // çarptım" hissinin kaynağı buydu.
    if (wantsJump && !jumpPressedRef.current) jumpBufRef.current = 0.25;
    jumpPressedRef.current = wantsJump;
    if (jumpBufRef.current > 0 && onGroundRef.current && !sliding && !flying) {
      jumpBufRef.current  = 0;
      velYRef.current     = JUMP_FORCE * jumpMult;
      onGroundRef.current = false;
      if (window.__dbg) window.__dbg.realJumps = (window.__dbg.realJumps || 0) + 1;
      sfx.jump();
      useGameStore.getState().bumpDaily('jumps', 1);
    }
    jumpBufRef.current = Math.max(0, jumpBufRef.current - delta);

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
        justLandedRef.current  = true;  // iniş karesi: hâlâ havada gibi değerlendir
      }
    }

    // Görsel sürücü: kayma/zıplama pozları ProcHorse'ta (yalnız görsel)
    const drv = driveRef.current;
    drv.airborne  = !onGroundRef.current && !flying;
    drv.velY      = velYRef.current;
    drv.slideLeft = sliding ? slideUntilRef.current - nowMs : 0;
    drv.lateral   = THREE.MathUtils.clamp(vx / (laneSpeed * 4 || 1), -1, 1);

    _horseT.x = clampedX; _horseT.y = newY; _horseT.z = pos.z;
    rb.setTranslation(_horseT, true); // paylaşılan obje — her karede allocation yok
    horseRef.x = clampedX;
    horseRef.z = pos.z;

    // ── Görsel tilt & zıplama eğimi ────────────────────────────────────────
    const targetTilt = THREE.MathUtils.clamp(-vx / (laneSpeed || 1) * TILT_MAX, -TILT_MAX, TILT_MAX);
    tiltRef.current  = THREE.MathUtils.lerp(tiltRef.current, targetTilt, TILT_SMOOTH * delta);
    const ref = modelGroupRef.current;
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

    // Test kancası (yalnızca window.__dbg tanımlıysa): otomatik test botu için at durumu
    if (window.__dbg) window.__dbg.horseState = { x: pos.x, y: pos.y, z: pos.z, sliding, onGround: onGroundRef.current };

    // ── ÜST ENGELLER: eğilerek geçilir (ödüllü). Zıplayarak geçmek yalnız at
    // kirişin/afişin içine girerse çarpmadır: toynaklar kiriş üstünün
    // (OVERHEAD_TOP, yol yüzeyinden; toynak yüksekliği = y − GROUND_Y) üzerindeyse
    // temiz aşma sayılır (yükseltilmiş zıplama).
    // Kapı düzlemi incedir: yalnız gerçekten kapı hizasından geçerken sayılır
    // (derin hitbox yüzünden kapıya varmadan "çarptın" olmaz).
    const OVERHEAD_DZ = 0.55;
    if (!immune && graceRef.current <= 0) {
      for (const [id, obs] of obstacleRegistry) {
        if (!obs.active || getKind(obs.TypeFn) !== 'overhead') continue;
        if (obs.z > 2) { slidUnderRef.current.delete(id); continue; } // geçti → işareti temizle (pool id'si yeniden kullanılır)
        const [hbDx] = getHitbox(obs.TypeFn);
        const dx = Math.abs(pos.x - obs.x);
        const dz = Math.abs(pos.z - obs.z);
        // Süpürmeli kontrol: kapı bu karede at hizasını geçtiyse de say
        // (yüksek hız / düşük FPS'te tek karede kapının içinden geçilmesin)
        const stepO = useGameStore.getState().speed * delta;
        const crossO = obs.z > pos.z - OVERHEAD_DZ && obs.z - stepO < pos.z + OVERHEAD_DZ;
        if (dx < hbDx * HIT_TOL_X && crossO) {
          if (sliding) {
            if (!slidUnderRef.current.has(id)) {
              slidUnderRef.current.add(id);
              useGameStore.getState().registerSlideUnder();
            }
          } else if (!onGroundRef.current && Math.min(pos.y, newY) - GROUND_Y > OVERHEAD_TOP) {
            if (!slidUnderRef.current.has(id)) {
              slidUnderRef.current.add(id);
              registerJumpOver();
            }
          } else if (slidUnderRef.current.has(id)) {
            // bu kapı zaten temiz geçildi (kayarak/üstünden) — kuyruk karesi çarpma sayılmaz
          } else {
            // Nal Zırhı: ilk çarpmayı emer
            if (useGameStore.getState().consumeShield()) {
              graceRef.current = 1.0;
              return;
            }
            if (window.__dbg) window.__dbg.hits.push({ kind: 'overhead', type: obs.TypeFn?.name, dx: +dx.toFixed(2), dz: +dz.toFixed(2), y: +pos.y.toFixed(2), airborne: !onGroundRef.current });
            registerCollision();
            return;
          }
        }
      }
    }

    // ── Zemin çarpışması — yeterince yüksekteyken atla ─────────────────────
    if (immune) { justLandedRef.current = false; return; }
    // İniş karesi de "havada" sayılır: düşük FPS'te at tek karede inip aynı
    // karede altındaki engele çarpmasın (görsel olarak hâlâ havadadır)
    const airborne = !onGroundRef.current || justLandedRef.current;
    justLandedRef.current = false;
    // Havadayken (zıplarken) HİÇBİR zemin engeline çarpma — endless-runner
    // standardı. Kalkış/iniş anındaki haksız ölümleri tamamen ortadan kaldırır.
    // Sadece üstten geçen (overhead) engeller eğilmeyi gerektirir; onlar yukarıda
    // ayrı ele alınıyor. Yakın geçiş (close-call) ödülü aşağıda korunuyor.
    if (airborne) {
      for (const [id, obs] of obstacleRegistry) {
        if (!obs.active) continue;
        if (getKind(obs.TypeFn) === 'overhead') continue;
        if (obs.z > 2) { clearedObsRef.current.delete(id); continue; }
        const dx = Math.abs(pos.x - obs.x);
        const dz = Math.abs(pos.z - obs.z);
        // Havadayken üzerinde/çok yakınında olunan engeli KALICI "geçildi"
        // işaretle: inişte hitbox'ın arka kenarına basmak çarpma sayılmaz.
        // Bant, kare başına kat edilen yol kadar genişletilir (swept):
        // yüksek hız + düşük FPS'te engel tek karede bandı atlayamasın.
        const [hbDx, hbDz] = getHitbox(obs.TypeFn);
        const sweep = useGameStore.getState().speed * delta * 1.5;
        if (dx < hbDx * HIT_TOL_X && dz < hbDz + 1.0 + sweep) clearedObsRef.current.add(id);
        if (dx < CLOSE_CALL_RADIUS && dz < CLOSE_CALL_RADIUS && closeCoolRef.current <= 0) {
          registerCloseCall();
          closeCoolRef.current = CLOSE_CALL_CD;
        }
      }
      return;
    }
    if (graceRef.current > 0) return;
    const tolX = HIT_TOL_X;
    const tolZ = HIT_TOL_Z;
    for (const [id, obs] of obstacleRegistry) {
      if (!obs.active) continue;
      if (getKind(obs.TypeFn) === 'overhead') continue; // yukarıda ele alındı
      // Engel oyuncuyu geçti → işareti temizle (pool id'si yeniden kullanılır)
      if (obs.z > 2) { clearedObsRef.current.delete(id); continue; }
      if (clearedObsRef.current.has(id)) continue; // zıplayarak geçildi — asla çarpmaz
      const [hbDx, hbDz] = getHitbox(obs.TypeFn);
      const dx = Math.abs(pos.x - obs.x);
      const dz = Math.abs(pos.z - obs.z);
      // Süpürmeli kontrol: engelin önceki kareden bu kareye kat ettiği yol at
      // hizasından geçiyorsa çarpışma (tek kare kontrolünde turbo / düşük FPS'te
      // engel atın üstünden atlıyor, bazen geçilip bazen ölünüyordu).
      const wZ = hbDz * tolZ;
      const stepG = useGameStore.getState().speed * delta;
      const crossG = obs.z > pos.z - wZ && obs.z - stepG < pos.z + wZ;
      if (dx < hbDx * tolX && crossG) {
        // Nal Zırhı: ilk çarpmayı emer
        if (useGameStore.getState().consumeShield()) {
          graceRef.current = 1.0;
          return;
        }
        if (window.__dbg) window.__dbg.hits.push({ kind: 'ground', type: obs.TypeFn?.name, dx: +dx.toFixed(2), dz: +dz.toFixed(2), y: +pos.y.toFixed(2), airborne });
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
    <group ref={bodyRefCb}>

      {/* Çömelme sarmalayıcısı: kayma pozu artık ProcHorse içinde (ezme yok) */}
      <group ref={crouchRef}>
        <group ref={modelGroupRef} rotation={[0, Math.PI, 0]}>
          <group position={[0, VIS_Y, -VIS_Z]}>
            <ProcHorse variant={horseVariant} characterId={selectedCharacterId} driveRef={driveRef} scale={VIS_SCALE} />
          </group>
        </group>
        <PegasusWings position={[0, WING_Y, WING_Z]} />
      </group>
    </group>
  );
}
