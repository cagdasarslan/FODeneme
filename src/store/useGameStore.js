import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  INITIAL_SPEED,
  MAX_SPEED,
  SPEED_INCREMENT,
  ADRENALINE_DECAY_RATE,
  ADRENALINE_CLOSE_CALL_GAIN,
  ADRENALINE_MAX,
  SCORE_PER_METER,
  GOLD_PER_CLOSE_CALL,
} from '@/constants/game';
import {
  startGuestSession,
  fetchMyHighScore,
  submitScore,
} from '@/services/LeaderboardService';

// ---------------------------------------------------------------------------
// Types (JSDoc for IDE hints without TypeScript overhead)
// ---------------------------------------------------------------------------
/**
 * @typedef {'idle'|'playing'|'paused'|'gameover'} GamePhase
 */

const useGameStore = create(
  subscribeWithSelector((set, get) => ({
    // ── Session ──────────────────────────────────────────────────────────────
    playerId: null,
    sessionReady: false,
    sessionError: null,

    // ── Persistent stats (hydrated from LootLocker on session start) ─────────
    highScore: 0,
    gold: 0,

    // ── Live run state ────────────────────────────────────────────────────────
    /** @type {GamePhase} */
    phase: 'idle',
    score: 0,
    speed: INITIAL_SPEED,
    adrenaline: 0,
    distance: 0,

    // ── Horse config (can be swapped via Garage) ──────────────────────────────
    selectedHorseId: 'default',
    ownedHorseIds: ['default'],

    // =========================================================================
    // Session actions
    // =========================================================================

    /**
     * Called once on app mount.  Starts a LootLocker Guest Session, then
     * hydrates highScore from the leaderboard so the HUD is accurate
     * before the first run.
     */
    initSession: async () => {
      try {
        const { playerId } = await startGuestSession();
        const highScore = await fetchMyHighScore();

        set({ playerId, highScore, sessionReady: true, sessionError: null });
      } catch (err) {
        console.error('[GameStore] initSession failed:', err);
        set({ sessionError: err.message, sessionReady: false });
      }
    },

    // =========================================================================
    // Run lifecycle actions
    // =========================================================================

    startRun: () =>
      set({
        phase: 'playing',
        score: 0,
        speed: INITIAL_SPEED,
        adrenaline: 0,
        distance: 0,
      }),

    pauseRun: () => set({ phase: 'paused' }),
    resumeRun: () => set({ phase: 'playing' }),

    endRun: async () => {
      const { score, highScore, sessionReady } = get();
      const newHighScore = Math.max(score, highScore);

      set({ phase: 'gameover', highScore: newHighScore });

      if (sessionReady) {
        try {
          await submitScore(newHighScore);
        } catch (err) {
          console.error('[GameStore] submitScore failed:', err);
        }
      }
    },

    // =========================================================================
    // Per-frame tick — call this from useFrame with delta
    // =========================================================================

    tick: (delta) => {
      const { phase, speed, score, distance, adrenaline } = get();
      if (phase !== 'playing') return;

      const newSpeed = Math.min(speed + SPEED_INCREMENT, MAX_SPEED);
      const traveled = newSpeed * delta;
      const newAdrenaline = Math.max(0, adrenaline - ADRENALINE_DECAY_RATE * delta);

      set({
        speed: newSpeed,
        distance: distance + traveled,
        score: score + traveled * SCORE_PER_METER,
        adrenaline: newAdrenaline,
      });
    },

    // =========================================================================
    // Event actions
    // =========================================================================

    registerCloseCall: () => {
      const { phase, adrenaline, gold } = get();
      if (phase !== 'playing') return;

      set({
        adrenaline: Math.min(adrenaline + ADRENALINE_CLOSE_CALL_GAIN, ADRENALINE_MAX),
        gold: gold + GOLD_PER_CLOSE_CALL,
      });
    },

    registerCollision: () => {
      const { phase } = get();
      if (phase === 'playing') get().endRun();
    },

    // =========================================================================
    // Garage / inventory actions
    // =========================================================================

    selectHorse: (horseId) => {
      const { ownedHorseIds } = get();
      if (ownedHorseIds.includes(horseId)) set({ selectedHorseId: horseId });
    },

    purchaseHorse: (horseId, price) => {
      const { gold, ownedHorseIds } = get();
      if (gold < price || ownedHorseIds.includes(horseId)) return false;

      set({
        gold: gold - price,
        ownedHorseIds: [...ownedHorseIds, horseId],
      });
      return true;
    },
  }))
);

export default useGameStore;
