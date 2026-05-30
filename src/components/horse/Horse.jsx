import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useHorseControls } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';
import {
  LANE_WIDTH,
  LANE_COUNT,
  HORSE_LATERAL_SPEED,
  HORSE_LANE_SNAP_THRESHOLD,
} from '@/constants/game';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const HALF_TRACK = ((LANE_COUNT - 1) / 2) * LANE_WIDTH; // max |x| the horse may occupy
const TILT_FACTOR = 0.25;          // radians of body lean per lateral input
const TILT_SMOOTH = 8;             // lerp speed for lean animation

// ---------------------------------------------------------------------------
// Model path — swap this string when you have a real .glb from Sketchfab.
// The placeholder keeps the component runnable with just a visible capsule.
// ---------------------------------------------------------------------------
const MODEL_PATH = '/assets/models/horse.glb';

// Preload so Three's asset manager starts the network request immediately.
useGLTF.preload(MODEL_PATH);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * Horse — physics-driven player character.
 *
 * Props
 *   modelPath  override the default .glb path (useful for Garage preview)
 *   scale      uniform scale applied to the loaded model (default 1)
 */
export default function Horse({ modelPath = MODEL_PATH, scale = 1 }) {
  const rigidBodyRef = useRef(null);
  const modelGroupRef = useRef(null);
  const tiltRef = useRef(0);

  const controls = useHorseControls();
  const { phase, tick, registerCloseCall, registerCollision } = useGameStore(
    (s) => ({
      phase: s.phase,
      tick: s.tick,
      registerCloseCall: s.registerCloseCall,
      registerCollision: s.registerCollision,
    })
  );

  // ── Model & animations ────────────────────────────────────────────────────
  const { scene, animations } = useGLTF(modelPath);
  const { actions, names } = useAnimations(animations, modelGroupRef);

  // Clone scene so multiple Horse instances don't share materials.
  const clonedScene = useRef(scene.clone(true));

  // Play the "Gallop" (or first available) animation when the run starts.
  useEffect(() => {
    if (phase !== 'playing') {
      Object.values(actions).forEach((a) => a?.fadeOut(0.3));
      return;
    }

    const gallop =
      actions['Gallop'] ??
      actions[names.find((n) => /gallop|run/i.test(n))] ??
      actions[names[0]];

    gallop?.reset().fadeIn(0.3).play();

    return () => gallop?.fadeOut(0.3);
  }, [phase, actions, names]);

  // ── Per-frame update ───────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (phase !== 'playing' || !rigidBodyRef.current) return;

    tick(delta);

    const rb = rigidBodyRef.current;
    const pos = rb.translation();

    // Lateral input → velocity impulse
    let vx = 0;
    if (controls.current.left) vx = -HORSE_LATERAL_SPEED;
    if (controls.current.right) vx = HORSE_LATERAL_SPEED;

    // Clamp to track bounds
    const clampedX = THREE.MathUtils.clamp(pos.x + vx * delta, -HALF_TRACK, HALF_TRACK);
    rb.setTranslation({ x: clampedX, y: pos.y, z: pos.z }, true);

    // Lean the visual model into the turn direction
    const targetTilt = -vx * TILT_FACTOR * (1 / HORSE_LATERAL_SPEED);
    tiltRef.current = THREE.MathUtils.lerp(tiltRef.current, targetTilt, TILT_SMOOTH * delta);

    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.z = tiltRef.current;
    }
  });

  // ── Collision callbacks ────────────────────────────────────────────────────
  const handleCollisionEnter = ({ other }) => {
    const tag = other.rigidBodyObject?.userData?.tag;

    if (tag === 'obstacle') registerCollision();
    if (tag === 'closeCall') registerCloseCall();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[0, 1, 0]}
      onCollisionEnter={handleCollisionEnter}
    >
      {/* Capsule collider sits at horse body centre */}
      <CapsuleCollider args={[0.5, 0.6]} />

      {/* Visual model group */}
      <group ref={modelGroupRef} scale={scale}>
        <primitive object={clonedScene.current} />
      </group>
    </RigidBody>
  );
}
