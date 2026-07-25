/**
 * Şehir-3 haritası (city3.glb) için tam sahne:
 *  - GLB modeli (statik, scale=20)
 *  - At + jokey (şehir yolları boyunca hareket)
 *  - Kamera (yola teğet takip)
 *  - Engeller (yol-uzayında spawn/recycle)
 */
import { useRef, useEffect, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '@/store/useGameStore';
import { HORSES } from '@/constants/horses';
import { useHorseControls } from '@/hooks/useHorseControls';
import { HORSE_LATERAL_SPEED } from '@/constants/game';
import { getCity3Curve, getCity3Length, getCity3Frame, CITY3_SCALE } from '@/constants/city3Path';

// ── Asset preload ─────────────────────────────────────────────────────────────
const CITY3_GLB  = '/assets/models/city3.glb';
const HORSE_GLB  = '/assets/models/horse.glb';
useGLTF.preload(CITY3_GLB);
useGLTF.preload(HORSE_GLB);

// ── Oyun sabitleri ────────────────────────────────────────────────────────────
const HALF_TRACK    = 4.5;
const LANE_W        = 4;
const LANES         = [-LANE_W, 0, LANE_W];
const POOL          = 18;
const SPAWN_DIST    = 90;
const RECYCLE_BACK  = 18;
const BASE_TIMER    = 2.2;
const JUMP_FORCE    = 9;
const JUMP_GRAV     = -24;
const GROUND_H      = 1.2;
const CLOSE_CALL_CD = 0.8;
const CAM_BACK      = 13;
const CAM_UP        = 8;
const TILT_MAX      = 0.18;
const TILT_SMOOTH   = 9;

const PATTERNS = [[0,1],[0,2],[1,2],[0],[2],[1],[0,1,2]];

// ── Prosedürel engeller ───────────────────────────────────────────────────────
const MAT = {
  barrel: new THREE.MeshStandardMaterial({ color: '#4a2e0a', roughness: 0.7 }),
  band:   new THREE.MeshStandardMaterial({ color: '#777', metalness: 0.8 }),
  hay:    new THREE.MeshStandardMaterial({ color: '#c8a030' }),
  crate:  new THREE.MeshStandardMaterial({ color: '#9a7030', roughness: 0.9 }),
  edge:   new THREE.MeshStandardMaterial({ color: '#6a4818' }),
  cone:   new THREE.MeshStandardMaterial({ color: '#ff6600', roughness: 0.6 }),
  sign:   new THREE.MeshStandardMaterial({ color: '#dddddd' }),
  signpole: new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.9 }),
};

function Barrel() {
  return (
    <group>
      <mesh castShadow><cylinderGeometry args={[0.42,0.42,1.0,12]}/><primitive object={MAT.barrel} attach="material"/></mesh>
      {[-0.28,0.28].map((y,i)=>(
        <mesh key={i} position={[0,y,0]}>
          <torusGeometry args={[0.43,0.045,6,14]}/>
          <primitive object={MAT.band} attach="material"/>
        </mesh>
      ))}
    </group>
  );
}

function Cone() {
  return (
    <group>
      <mesh castShadow position={[0,0.45,0]}><coneGeometry args={[0.35,0.9,8]}/><primitive object={MAT.cone} attach="material"/></mesh>
      <mesh castShadow position={[0,0.04,0]}><cylinderGeometry args={[0.5,0.5,0.08,12]}/><primitive object={MAT.band} attach="material"/></mesh>
    </group>
  );
}

function Crate() {
  return (
    <group>
      <mesh castShadow><boxGeometry args={[0.9,0.9,0.9]}/><primitive object={MAT.crate} attach="material"/></mesh>
      {[[0,0,0.46],[0,0,-0.46],[0.46,0,0],[-0.46,0,0]].map((p,i)=>(
        <mesh key={i} position={p} rotation={[0,i<2?0:Math.PI/2,0]}>
          <boxGeometry args={[0.92,0.08,0.06]}/><primitive object={MAT.edge} attach="material"/>
        </mesh>
      ))}
    </group>
  );
}

function RoadSign() {
  return (
    <group>
      <mesh castShadow position={[0,0.6,0]}><cylinderGeometry args={[0.06,0.06,1.2,8]}/><primitive object={MAT.signpole} attach="material"/></mesh>
      <mesh castShadow position={[0,1.28,0]}><boxGeometry args={[0.7,0.5,0.05]}/><primitive object={MAT.sign} attach="material"/></mesh>
    </group>
  );
}

const TYPES = [Barrel, Cone, Crate, RoadSign, Cone, Barrel, Crate, RoadSign];

// ── City3 GLB ─────────────────────────────────────────────────────────────────
function City3GLB() {
  const { scene } = useGLTF(CITY3_GLB);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.scale.setScalar(CITY3_SCALE);
    cloned.current.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }
  return <primitive object={cloned.current} />;
}

// ── At modeli ─────────────────────────────────────────────────────────────────
function HorseGLB({ groupRef, variant }) {
  const { scene, animations } = useGLTF(HORSE_GLB);
  const { actions } = useAnimations(animations, scene);
  const cloned = useRef(null);
  const lastVariant = useRef(null);

  if (!cloned.current) {
    cloned.current = scene.clone(true);
  }

  useEffect(() => {
    if (!actions) return;
    const run = actions['AnimalArmature|AnimalArmature|AnimalArmature|Run'] ?? Object.values(actions)[0];
    if (run) { run.reset().fadeIn(0.3).play(); }
  }, [actions]);

  useEffect(() => {
    if (!variant || variant.id === lastVariant.current) return;
    lastVariant.current = variant.id;
    let meshIdx = 0;
    cloned.current.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.color.set(meshIdx === 0 ? variant.bodyColor : variant.maneColor);
      meshIdx++;
    });
  }, [variant]);

  return (
    <group ref={groupRef}>
      <primitive object={cloned.current} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

// ── Gökyüzü ───────────────────────────────────────────────────────────────────
const SKY_MAT = new THREE.MeshBasicMaterial({ color: '#7ab8e0', side: THREE.BackSide });
function City3Sky() {
  return (
    <mesh>
      <sphereGeometry args={[800, 16, 16]} />
      <primitive object={SKY_MAT} attach="material" />
    </mesh>
  );
}

// ── Ana sahne bileşeni ────────────────────────────────────────────────────────
export default function City3Scene() {
  const { camera } = useThree();
  const {
    phase, runId,
    tick, registerCollision, registerCloseCall,
    selectedHorseId,
  } = useGameStore(s => ({
    phase:               s.phase,
    runId:               s.runId,
    tick:                s.tick,
    registerCollision:   s.registerCollision,
    registerCloseCall:   s.registerCloseCall,
    selectedHorseId:     s.selectedHorseId,
  }));

  const horseVariant = HORSES.find(h => h.id === selectedHorseId) ?? HORSES[0];
  const controls    = useHorseControls();

  // ── Koşu durumu ─────────────────────────────────────────────────────────────
  const stateRef = useRef({
    dist: 0, lat: 0,
    height: GROUND_H, velY: 0, onGround: true,
    jumpPressed: false, cooldown: 0, tilt: 0,
  });

  // ── Engel havuzu ─────────────────────────────────────────────────────────────
  const poolRef = useRef(
    Array.from({ length: POOL }, (_, i) => ({
      id: i, active: false, dist: 0, lat: LANES[i % 3], typeIdx: i % TYPES.length,
    }))
  );
  const timerRef = useRef(0);

  // ── Three.js ref'leri ─────────────────────────────────────────────────────
  const horseGroupRef = useRef();
  const modelGroupRef = useRef();
  const obsGroupRefs  = useRef(Array(POOL).fill(null));

  // ── Yeni koşuda sıfırla ──────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    s.dist = 0; s.lat = 0; s.velY = 0;
    s.height = GROUND_H; s.onGround = true;
    s.jumpPressed = false; s.cooldown = 0; s.tilt = 0;
    timerRef.current = 0;
    poolRef.current.forEach(o => { o.active = false; });
  }, [runId]);

  // ── Kamera başlangıç ─────────────────────────────────────────────────────
  useEffect(() => {
    camera.fov  = 68;
    camera.near = 0.1;
    camera.far  = 800;
    camera.updateProjectionMatrix();
  }, [camera]);

  // ── Yardımcı vektörler ───────────────────────────────────────────────────
  const _camPos  = useRef(new THREE.Vector3());
  const _lookAt  = useRef(new THREE.Vector3());
  const _tmp     = useRef(new THREE.Vector3());

  // ── Ana döngü ────────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    tick(delta);

    const speed = useGameStore.getState().speed;
    const s = stateRef.current;

    // ── At hareketi ──────────────────────────────────────────────────────
    s.dist += speed * delta;

    let dlat = 0;
    if (controls.current.left)  dlat = -HORSE_LATERAL_SPEED;
    if (controls.current.right) dlat =  HORSE_LATERAL_SPEED;
    s.lat = THREE.MathUtils.clamp(s.lat + dlat * delta, -HALF_TRACK, HALF_TRACK);

    // Zıplama
    const wantsJump = controls.current.jump;
    if (wantsJump && !s.jumpPressed && s.onGround) {
      s.velY = JUMP_FORCE; s.onGround = false;
    }
    s.jumpPressed = wantsJump;
    if (!s.onGround) {
      s.velY += JUMP_GRAV * delta;
      s.height += s.velY * delta;
      if (s.height <= GROUND_H) { s.height = GROUND_H; s.velY = 0; s.onGround = true; }
    }

    // ── İz çerçevesi ─────────────────────────────────────────────────────
    const { point, tangent, right } = getCity3Frame(s.dist);

    const horsePos = _tmp.current
      .copy(point)
      .addScaledVector(right, s.lat);
    horsePos.y += s.height - GROUND_H;  // jump offset on top of road Y

    if (horseGroupRef.current) horseGroupRef.current.position.copy(horsePos);

    if (horseGroupRef.current) {
      const yaw = Math.atan2(tangent.x, tangent.z);
      horseGroupRef.current.rotation.y = yaw;
    }

    const targetTilt = THREE.MathUtils.clamp(-dlat / HORSE_LATERAL_SPEED * TILT_MAX, -TILT_MAX, TILT_MAX);
    s.tilt = THREE.MathUtils.lerp(s.tilt, targetTilt, TILT_SMOOTH * delta);
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.z = s.tilt;
      modelGroupRef.current.rotation.x = s.onGround ? 0 : THREE.MathUtils.clamp(-s.velY * 0.015, -0.25, 0.2);
    }

    // ── Kamera ───────────────────────────────────────────────────────────
    const { point: camPt, right: camRight } = getCity3Frame(s.dist - CAM_BACK);
    _camPos.current
      .copy(camPt)
      .addScaledVector(camRight, s.lat * 0.35)
      .setY(point.y + CAM_UP);
    camera.position.copy(_camPos.current);
    _lookAt.current.copy(horsePos).setY(horsePos.y + 0.8);
    camera.lookAt(_lookAt.current);

    // ── Engel güncelleme ─────────────────────────────────────────────────
    s.cooldown = Math.max(0, s.cooldown - delta);

    poolRef.current.forEach((obs, i) => {
      if (!obs.active) return;
      const grp = obsGroupRefs.current[i];
      if (grp) {
        const { point: op, right: or, tangent: ot } = getCity3Frame(obs.dist);
        grp.position.copy(op).addScaledVector(or, obs.lat);
        grp.position.y = op.y + 0.55;
        grp.rotation.y = Math.atan2(ot.x, ot.z);
      }

      if (s.dist - obs.dist > RECYCLE_BACK) { obs.active = false; return; }

      if (s.onGround || s.height < GROUND_H + 1.0) {
        const dDist = Math.abs(obs.dist - s.dist);
        const dLat  = Math.abs(obs.lat - s.lat);
        if (dDist < 1.4 && dLat < 1.5) { registerCollision(); return; }
        if (dDist < 2.8 && dLat < 2.4 && s.cooldown <= 0) {
          registerCloseCall();
          s.cooldown = CLOSE_CALL_CD;
        }
      }
    });

    // ── Engel spawn ───────────────────────────────────────────────────────
    timerRef.current += delta;
    const spawnInterval = Math.max(0.8, BASE_TIMER - speed * 0.022);
    if (timerRef.current < spawnInterval) return;
    timerRef.current = 0;

    const maxPat = speed > 35 ? PATTERNS.length : speed > 22 ? 5 : 3;
    const pattern = PATTERNS[Math.floor(Math.random() * maxPat)];

    pattern.forEach((laneIdx) => {
      const slot = poolRef.current.find(o => !o.active);
      if (!slot) return;
      const spawnDist = s.dist + SPAWN_DIST;
      const existing = poolRef.current.filter(o => o.active && o.lat === LANES[laneIdx]);
      if (existing.some(o => Math.abs(o.dist - spawnDist) < 18)) return;
      slot.dist    = spawnDist;
      slot.lat     = LANES[laneIdx];
      slot.active  = true;
    });
  });

  return (
    <>
      <City3Sky />

      <Suspense fallback={null}>
        <City3GLB />
      </Suspense>

      {/* At */}
      <group ref={horseGroupRef}>
        <Suspense fallback={null}>
          <HorseGLB groupRef={modelGroupRef} variant={horseVariant} />
        </Suspense>
      </group>

      {/* Engel havuzu */}
      {poolRef.current.map((obs, i) => (
        <group
          key={obs.id}
          ref={el => (obsGroupRefs.current[i] = el)}
          visible={obs.active}
        >
          <Suspense fallback={null}>
            {(() => { const T = TYPES[obs.typeIdx]; return <T />; })()}
          </Suspense>
        </group>
      ))}
    </>
  );
}
