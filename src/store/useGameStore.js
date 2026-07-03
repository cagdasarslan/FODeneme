import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { setSfxEnabled, setMusicEnabled, sfx, startMusic, startGallop } from '@/utils/audio';
import { STREAK_REWARDS, STREAK_MAX_REWARD, pickDailyMissions, pickWeeklyMissions, weekKey } from '@/constants/daily';
import { submitScoreSupa } from '@/services/SupaLeaderboard';
import { HORSES } from '@/constants/horses';
import {
  INITIAL_SPEED,
  MAX_SPEED,
  SPEED_INCREMENT,
  ADRENALINE_DECAY_RATE,
  ADRENALINE_CLOSE_CALL_GAIN,
  ADRENALINE_JUMP_GAIN,
  ADRENALINE_MAX,
  SCORE_PER_METER,
  CONTINUE_BASE_CARROTS,
  CONTINUE_BASE_ADS,
  CONTINUE_MULTIPLIER,
  AD_DAILY_CARROTS,
  AD_DAILY_MAX,
  AD_UPGRADE_DISCOUNT,
  COMBO_WINDOW_MS,
  COMBO_PER_STEP,
  COMBO_MAX_MULT,
  STUMBLE_WINDOW_MS,
} from '@/constants/game';
import { ACHIEVEMENTS } from '@/constants/achievements';
import { POWERUP_IDS, powerupDuration, powerupUpgradeCost, POWERUP_MAX_LEVEL } from '@/constants/powerups';
import { haptic } from '@/utils/haptics';
import {
  startGuestSession,
  fetchMyHighScore,
  submitScore,
} from '@/services/LeaderboardService';
import {
  BREED_COST, BREED_COOLDOWN_MS, SHOP_TIER1_COST, SHOP_TIER2_COST, EXTRA_SLOT_COST,
  STAGE_CONFIG, TRAITS, TRAIT_CHANCE, TOKLUK_DECAY_PER_MS, MUTLULUK_DECAY_PER_MS,
  FEED_COST, FEED_TOKLUK, FEED_BP, FEED_MAX_DAY,
  GROOM_MUTLULUK, GROOM_BP, GROOM_BOND, GROOM_COOLDOWN_MS,
  TRAIN_BP, TRAIN_BOND, TRAIN_COOLDOWN_MS, BP_PER_500M,
} from '@/constants/foals';

// ---------------------------------------------------------------------------
// Havuç kalıcılığı — sık toplandığında her seferinde localStorage'a yazmak
// (özellikle mobilde) jank yapar. Yazımı en fazla saniyede bir yap (debounce).
let _carrotSaveTimer = null;
let _todayKey = null;
function scheduleCarrotSave(get) {
  if (_carrotSaveTimer) return;
  _carrotSaveTimer = setTimeout(() => {
    _carrotSaveTimer = null;
    const s = get();
    localStorage.setItem('carrots', String(s.carrots));
    if (_todayKey) localStorage.setItem(_todayKey, String(s.dailyCarrots));
  }, 1000);
}
function flushCarrotSave(get) {
  if (_carrotSaveTimer) { clearTimeout(_carrotSaveTimer); _carrotSaveTimer = null; }
  const s = get();
  localStorage.setItem('carrots', String(s.carrots));
  if (_todayKey) localStorage.setItem(_todayKey, String(s.dailyCarrots));
}

// ── Günlük sistem (giriş serisi + görevler) kalıcılığı ──────────────────────
const todayStr = () => new Date().toDateString();
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toDateString(); };
function loadDaily() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem('daily_v1') ?? '{}'); } catch (e) { d = {}; }
  return {
    streakDay: d.streakDay ?? 1,
    lastClaimDate: d.lastClaimDate ?? '',
    statsDate: d.statsDate ?? '',
    dailyStats: d.dailyStats ?? { distance: 0, jumps: 0, jumpover: 0, runs: 0, closecall: 0 },
    missionClaimed: d.missionClaimed ?? [],
    // Haftalık görevler (pazartesi sıfırlanır)
    weekDate: d.weekDate ?? '',
    weekStats: d.weekStats ?? { distance: 0, jumps: 0, jumpover: 0, runs: 0, closecall: 0, carrots: 0 },
    weeklyClaimed: d.weeklyClaimed ?? [],
  };
}
function saveDaily(s) {
  localStorage.setItem('daily_v1', JSON.stringify({
    streakDay: s.streakDay, lastClaimDate: s.lastClaimDate,
    statsDate: s.statsDate, dailyStats: s.dailyStats, missionClaimed: s.missionClaimed,
    weekDate: s.weekDate, weekStats: s.weekStats, weeklyClaimed: s.weeklyClaimed,
  }));
  localStorage.setItem('life_v1', JSON.stringify(s.lifeStats));
}
let _dailySaveTimer = null;
function scheduleDailySave(get) {
  if (_dailySaveTimer) return;
  _dailySaveTimer = setTimeout(() => { _dailySaveTimer = null; saveDaily(get()); }, 1000);
}

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
    carrots: parseInt(localStorage.getItem('carrots') ?? '0', 10),

    // ── Daily tracking ────────────────────────────────────────────────────────
    dailyCarrots: parseInt(localStorage.getItem(`daily_carrots_${new Date().toDateString()}`) ?? '0', 10),

    // ── Günlük sistem (giriş serisi + görevler) ───────────────────────────────
    ...loadDaily(),

    // ── Ömür-boyu istatistikler + başarımlar ──────────────────────────────────
    lifeStats: JSON.parse(localStorage.getItem('life_v1') ?? '{"distance":0,"jumps":0,"jumpover":0,"runs":0,"closecall":0}'),
    achClaimed: JSON.parse(localStorage.getItem('achClaimed') ?? '[]'),

    // ── Reklamsız (tek seferlik IAP) ──────────────────────────────────────────
    adsRemoved: localStorage.getItem('adsRemoved') === '1',
    setAdsRemoved: () => {
      localStorage.setItem('adsRemoved', '1');
      set({ adsRemoved: true });
    },

    // ── Live run state ────────────────────────────────────────────────────────
    /** @type {GamePhase} */
    phase: 'idle',
    score: 0,
    speed: INITIAL_SPEED,
    adrenaline: 0,
    distance: 0,
    runId: 0,
    reviveId: 0,        // her devam-et (revive) işleminde artar → at sıfırlanır
    reviveCount: 0,     // bu koşuda kaç kez devam edildi (maliyet 3^reviveCount)
    // Combo (art arda makas / engel atlama → skor çarpanı x1..x4)
    combo: 0,
    comboExpire: 0,
    comboMult: 1,
    // Tökezleme (ilk çarpma affedilir; pencere içinde ikincisi öldürür)
    stumbleUntil: 0,
    stumbleId: 0,
    stumbleActive: false,
    runCarrots: 0,      // bu koşuda toplanan havuç (oyun sonu 2x için)
    carrotsDoubled: false, // oyun sonu havuç katlama kullanıldı mı
    startBoost: false,  // sonraki koşuya boost (mıknatıs) ile başla
    upgradeDiscount: false, // sonraki yükseltme indirimli
    bonusSlots: 0,      // reklamla kazanılan geçici ahır slotu (kalıcı değil)
    adBonusToday: parseInt(localStorage.getItem(`ad_bonus_${new Date().toDateString()}`) ?? '0', 10),
    magnetActive: false,
    magnetTimer: 0,
    // Diğer yetenekler (Süper Nal ile aynı desen: <id>Active / <id>Timer)
    wingsActive: false,  wingsTimer: 0,
    turboActive: false,  turboTimer: 0,
    shieldActive: false, shieldTimer: 0,
    slowmoActive: false, slowmoTimer: 0,
    goldenActive: false, goldenTimer: 0,
    speedBase: INITIAL_SPEED, // gerçek hız ilerlemesi (slowmo/turbo geçici bindirme yapar)
    // Yetenek seviyeleri (kalıcı): süre = baseDur × (1 + 0.2 × seviye)
    powerupLevels: JSON.parse(localStorage.getItem('powerupLevels') ?? '{}'),
    adrenalinBoosting: false,
    adrenalinBoostTimer: 0,

    // ── Horse config ──────────────────────────────────────────────────────────
    selectedHorseId: localStorage.getItem('selectedHorseId') ?? 'chestnut',
    ownedHorseIds: JSON.parse(localStorage.getItem('ownedHorseIds') ?? '["chestnut"]'),

    // ── Horse levels (legacy, kept for compat) ────────────────────────────────
    horseLevels: JSON.parse(localStorage.getItem('horseLevels') ?? '{"chestnut":1,"black":1,"white":1}'),

    // ── Horse upgrades: {[horseId]: {speedLevel, maneuvLevel, jumpLevel}} ─────
    horseUpgrades: JSON.parse(localStorage.getItem('horseUpgrades') ?? JSON.stringify({
      chestnut: { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 },
      black:    { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 },
      white:    { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 },
    })),

    // ── Per-map high scores ───────────────────────────────────────────────────
    highScoreMap1: parseInt(localStorage.getItem('hs_map1') ?? '0', 10),
    highScoreMap2: parseInt(localStorage.getItem('hs_map2') ?? '0', 10),
    highScoreMap3: parseInt(localStorage.getItem('hs_map3') ?? '0', 10),
    highScoreMap4: parseInt(localStorage.getItem('hs_map4') ?? '0', 10),
    highScoreMap5: parseInt(localStorage.getItem('hs_map5') ?? '0', 10),

    // ── Character (jockey) config ─────────────────────────────────────────────
    selectedCharacterId: localStorage.getItem('selectedCharId') ?? 'cowboy',
    ownedCharacterIds: JSON.parse(localStorage.getItem('ownedCharIds') ?? '["cowboy"]'),

    // ── Map selection ─────────────────────────────────────────────────────────
    mapId: parseInt(localStorage.getItem('mapId') ?? '1', 10), // 1=Farm/Race, 2=City

    // ── Night mode (maps 1-2; mars/space have their own atmosphere) ──────────
    nightMode: localStorage.getItem('nightMode') === '1',

    // ── Ayarlar ───────────────────────────────────────────────────────────────
    soundOn: localStorage.getItem('soundOn') !== '0',          // oyun sesleri (SFX + nal)
    musicOn: localStorage.getItem('musicOn') !== '0',          // harita müziği
    graphics: localStorage.getItem('graphics') || 'high',       // 'low' | 'high'

    // ── UI phase ──────────────────────────────────────────────────────────────
    showGarage: false,
    garageOpenTab: null,

    // ── Hara (foal system) ────────────────────────────────────────────────────
    foals: JSON.parse(localStorage.getItem('foals') ?? '[]'),
    stableSlots: parseInt(localStorage.getItem('stableSlots') ?? '1', 10),
    lastBreedAt: parseInt(localStorage.getItem('lastBreedAt') ?? '0', 10),
    customHorses: JSON.parse(localStorage.getItem('customHorses') ?? '[]'),

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
      set((s) => ({
        phase: 'playing',
        score: 0,
        speed: INITIAL_SPEED,
        adrenaline: 0,
        distance: 0,
        runId: s.runId + 1,
        reviveCount: 0,
        runCarrots: 0,
        carrotsDoubled: false,
        // Reklam boost'u alındıysa mıknatısla başla
        magnetActive: s.startBoost,
        magnetTimer: s.startBoost ? 12 : 0,
        wingsActive: false,  wingsTimer: 0,
        turboActive: false,  turboTimer: 0,
        shieldActive: false, shieldTimer: 0,
        slowmoActive: false, slowmoTimer: 0,
        goldenActive: false, goldenTimer: 0,
        speedBase: INITIAL_SPEED,
        startBoost: false,
        adrenalinBoosting: false,
        adrenalinBoostTimer: 0,
        combo: 0, comboExpire: 0, comboMult: 1,
        stumbleUntil: 0, stumbleActive: false,
      })),

    pauseRun: () => set({ phase: 'paused' }),
    resumeRun: () => set({ phase: 'playing' }),

    endRun: async () => {
      flushCarrotSave(get); // bekleyen havuç yazımını hemen diske al
      // Günlük görev sayaçları: bu koşunun mesafesi + 1 koşu
      const _dist = Math.floor(get().distance || 0);
      if (_dist > 0) get().bumpDaily('distance', _dist);
      get().bumpDaily('runs', 1);
      saveDaily(get());
      // Sezonluk liderlik (Supabase yapılandırıldıysa) — arka planda gönder
      submitScoreSupa(get().score, get().mapId);
      const { score, highScore, mapId, highScoreMap1, highScoreMap2, highScoreMap3, highScoreMap4, highScoreMap5, sessionReady } = get();
      const newHighScore = Math.max(score, highScore);
      const hsKey = mapId === 5 ? 'hs_map5' : mapId === 4 ? 'hs_map4' : mapId === 3 ? 'hs_map3' : mapId === 2 ? 'hs_map2' : 'hs_map1';
      const currentMapHs = mapId === 5 ? highScoreMap5 : mapId === 4 ? highScoreMap4 : mapId === 3 ? highScoreMap3 : mapId === 2 ? highScoreMap2 : highScoreMap1;
      const newMapHs = Math.max(score, currentMapHs);
      localStorage.setItem(hsKey, String(Math.floor(newMapHs)));
      const mapHsUpdate = mapId === 5
        ? { highScoreMap5: newMapHs }
        : mapId === 4
        ? { highScoreMap4: newMapHs }
        : mapId === 3
          ? { highScoreMap3: newMapHs }
          : mapId === 2
            ? { highScoreMap2: newMapHs }
            : { highScoreMap1: newMapHs };

      set({ phase: 'gameover', highScore: newHighScore, ...mapHsUpdate });
      get().addRunBP(get().distance);

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
      const { phase, speed, score, distance, adrenaline, magnetTimer, horseUpgrades, adrenalinBoosting, adrenalinBoostTimer } = get();
      if (phase !== 'playing') return;

      const allHorsesForTick = [...HORSES, ...(get().customHorses ?? [])];
      const horse = allHorsesForTick.find(h => h.id === get().selectedHorseId);
      const ups = horseUpgrades[get().selectedHorseId] ?? { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 };
      const speedMult = (horse?.baseSpeedMult ?? 1.0) * (1 + ups.speedLevel * 0.05);
      const cap = (horse?.baseMaxSpeed ?? MAX_SPEED) * speedMult;

      // Adrenalin boost: MAX'a ulaşınca 3s 2x skor + hız patlaması
      let boostUpdate = {};
      let scoreMult = 1;
      if (!adrenalinBoosting && adrenaline >= ADRENALINE_MAX) {
        boostUpdate = { adrenalinBoosting: true, adrenalinBoostTimer: 3, adrenaline: 0 };
      } else if (adrenalinBoosting) {
        const t = adrenalinBoostTimer - delta;
        boostUpdate = t > 0
          ? { adrenalinBoostTimer: t }
          : { adrenalinBoosting: false, adrenalinBoostTimer: 0 };
        scoreMult = 2;
      }

      // Yetenek zamanlayıcıları (magnet dahil, tek desen)
      const puUpdate = {};
      const puActive = (id) => (puUpdate[id + 'Active'] !== undefined ? puUpdate[id + 'Active'] : get()[id + 'Active']);
      for (const id of POWERUP_IDS) {
        const tv = get()[id + 'Timer'];
        if (tv > 0) {
          const nt = Math.max(0, tv - delta);
          puUpdate[id + 'Timer'] = nt;
          puUpdate[id + 'Active'] = nt > 0;
        }
      }

      // Hız: gerçek ilerleme speedBase'te; turbo/slowmo geçici bindirme yapar
      const boostCap = adrenalinBoosting ? Math.min(cap * 1.3, MAX_SPEED * 1.3) : cap;
      const speedBase = Math.min((get().speedBase ?? speed) + SPEED_INCREMENT * delta, boostCap);
      let effSpeed = speedBase;
      if (puActive('turbo'))  effSpeed = boostCap * 1.15;      // turbo: tavan üstü hız
      if (puActive('slowmo')) effSpeed = effSpeed * 0.5;       // zaman büyüsü: dünya yavaş
      const traveled = effSpeed * delta;                        // dünya/mesafe (yavaşlamış)
      const scoreSpeed = puActive('slowmo') ? speedBase : effSpeed; // skor normal akar
      const newAdrenaline = adrenalinBoosting ? 0 : Math.max(0, adrenaline - ADRENALINE_DECAY_RATE * delta);

      // Combo: pencere doldu mu → sıfırla; çarpanı türet
      const now = Date.now();
      let combo = get().combo;
      if (combo > 0 && now > get().comboExpire) combo = 0;
      const comboMult = 1 + Math.min(COMBO_MAX_MULT - 1, Math.floor(combo / COMBO_PER_STEP));

      set({
        speed: effSpeed,
        speedBase,
        distance: distance + traveled,
        score: score + scoreSpeed * delta * SCORE_PER_METER * scoreMult * comboMult,
        adrenaline: newAdrenaline,
        combo,
        comboMult,
        stumbleActive: now < get().stumbleUntil,
        ...puUpdate,
        ...boostUpdate,
      });
    },

    // ── Yetenek etkinleştirme / geliştirme ──────────────────────────────────
    activatePowerup: (id) => {
      const lvl = get().powerupLevels[id] ?? 0;
      const dur = powerupDuration(id, lvl);
      sfx.powerup();
      haptic.medium();
      set({ [id + 'Active']: true, [id + 'Timer']: dur });
    },

    // Kalkan çarpmayı emer (bir kez) — tüketildiğinde kapanır
    consumeShield: () => {
      if (!get().shieldActive) return false;
      sfx.crash();
      haptic.medium();
      set({ shieldActive: false, shieldTimer: 0 });
      return true;
    },

    upgradePowerup: (id) => {
      const s = get();
      const lvl = s.powerupLevels[id] ?? 0;
      if (lvl >= POWERUP_MAX_LEVEL) return false;
      const cost = powerupUpgradeCost(lvl);
      if (s.carrots < cost) return false;
      const carrots = s.carrots - cost;
      const powerupLevels = { ...s.powerupLevels, [id]: lvl + 1 };
      localStorage.setItem('carrots', String(carrots));
      localStorage.setItem('powerupLevels', JSON.stringify(powerupLevels));
      set({ carrots, powerupLevels });
      sfx.powerup();
      haptic.success();
      return true;
    },

    // =========================================================================
    // Event actions
    // =========================================================================

    // Combo artırıcı: art arda riskli aksiyonlar skor çarpanını yükseltir
    _bumpCombo: () => {
      const combo = get().combo + 1;
      set({ combo, comboExpire: Date.now() + COMBO_WINDOW_MS });
    },

    registerCloseCall: () => {
      const { phase, adrenaline } = get();
      if (phase !== 'playing') return;
      get().bumpDaily('closecall', 1);
      get()._bumpCombo();
      set({
        adrenaline: Math.min(adrenaline + ADRENALINE_CLOSE_CALL_GAIN, ADRENALINE_MAX),
      });
    },

    registerJumpOver: () => {
      const { phase, adrenaline } = get();
      if (phase !== 'playing') return;
      get().bumpDaily('jumpover', 1);
      get()._bumpCombo();
      haptic.light();
      set({
        adrenaline: Math.min(adrenaline + ADRENALINE_JUMP_GAIN, ADRENALINE_MAX),
      });
    },

    // Üst engelin altından EĞİLEREK geçme ödülü
    registerSlideUnder: () => {
      const { phase, adrenaline } = get();
      if (phase !== 'playing') return;
      get()._bumpCombo();
      haptic.light();
      sfx.collect();
      set({
        adrenaline: Math.min(adrenaline + ADRENALINE_JUMP_GAIN, ADRENALINE_MAX),
      });
    },

    // Çarpışma → TÖKEZLEME sistemi (piyasa runner'ları gibi affedici):
    // İlk çarpma = tökezle (hız yarıya düşer, 15sn tehlike penceresi).
    // Pencere içinde ikinci çarpma = gerçek çarpış → "devam et" ekranı.
    registerCollision: () => {
      const s = get();
      if (s.phase !== 'playing') return;
      const now = Date.now();
      if (now < s.stumbleUntil) {
        sfx.crash();
        haptic.heavy();
        set({ phase: 'crashed' });
      } else {
        sfx.crash();
        haptic.heavy();
        set({
          stumbleUntil: now + STUMBLE_WINDOW_MS,
          stumbleId: s.stumbleId + 1,
          stumbleActive: true,
          speed: Math.max(INITIAL_SPEED, s.speed * 0.55), // tökezleme: yavaşla
          combo: 0, comboMult: 1,                          // combo kırılır
        });
      }
    },

    // Mevcut devam-et maliyetleri (reviveCount'a göre kümülatif 3 kat)
    continueCost: () => {
      const n = get().reviveCount;
      return {
        carrots: CONTINUE_BASE_CARROTS * Math.pow(CONTINUE_MULTIPLIER, n),
        ads:     CONTINUE_BASE_ADS     * Math.pow(CONTINUE_MULTIPLIER, n),
      };
    },

    _doRevive: () => {
      // Son hızdan devam et (speed sıfırlanmaz); engeller spawner'larda temizlenir
      set((s) => ({
        phase: 'playing',
        reviveCount: s.reviveCount + 1,
        reviveId: s.reviveId + 1,
        adrenaline: 0,
        adrenalinBoosting: false,
        adrenalinBoostTimer: 0,
        combo: 0, comboExpire: 0, comboMult: 1,
        stumbleUntil: 0, stumbleActive: false,
        wingsActive: false,  wingsTimer: 0,
        turboActive: false,  turboTimer: 0,
        slowmoActive: false, slowmoTimer: 0,
        goldenActive: false, goldenTimer: 0,
        speedBase: s.speed,
      }));
    },

    continueWithCarrots: () => {
      const { phase, carrots } = get();
      if (phase !== 'crashed') return false;
      const cost = get().continueCost().carrots;
      if (carrots < cost) return false;
      const newCarrots = carrots - cost;
      localStorage.setItem('carrots', String(newCarrots));
      set({ carrots: newCarrots });
      get()._doRevive();
      return true;
    },

    // Reklam izleyerek devam et (gerçek reklam SDK'sı entegre edilene kadar
    // tıklama doğrudan devam ettirir; gereken reklam sayısı UI'da gösterilir)
    continueWithAd: () => {
      const { phase } = get();
      if (phase !== 'crashed') return;
      get()._doRevive();
    },

    giveUp: () => {
      const { phase } = get();
      if (phase === 'crashed') get().endRun();
    },

    // =========================================================================
    // Ödüllü reklam ödülleri (reklam izlendikten SONRA çağrılır)
    // =========================================================================

    // Oyun sonu: bu koşuda toplanan havuçları bir kez daha ekle (2x)
    doubleRunCarrots: () => {
      const { runCarrots, carrots, carrotsDoubled } = get();
      if (carrotsDoubled || runCarrots <= 0) return 0;
      const c = carrots + runCarrots;
      localStorage.setItem('carrots', String(c));
      set({ carrots: c, carrotsDoubled: true });
      return runCarrots;
    },

    // Günlük bedava havuç (reklam başına), günde AD_DAILY_MAX kez
    adBonusLeft: () => Math.max(0, AD_DAILY_MAX - get().adBonusToday),
    claimAdCarrots: () => {
      const { carrots, adBonusToday } = get();
      if (adBonusToday >= AD_DAILY_MAX) return 0;
      const c = carrots + AD_DAILY_CARROTS;
      const n = adBonusToday + 1;
      localStorage.setItem('carrots', String(c));
      localStorage.setItem(`ad_bonus_${new Date().toDateString()}`, String(n));
      set({ carrots: c, adBonusToday: n });
      return AD_DAILY_CARROTS;
    },

    // Sonraki koşuya boost (mıknatıs) ile başla
    armStartBoost: () => set({ startBoost: true }),

    // Sonraki yükseltmede indirim
    armUpgradeDiscount: () => set({ upgradeDiscount: true }),

    // Tay bekleme süresini (cooldown) sıfırla: 'groom' | 'train' | 'breed'
    skipFoalCooldown: (id, type) => {
      if (type === 'breed') { localStorage.setItem('lastBreedAt', '0'); set({ lastBreedAt: 0 }); return true; }
      const { foals } = get();
      const idx = foals.findIndex(f => f.id === id);
      if (idx === -1) return false;
      const key = type === 'train' ? 'lastTrainedAt' : 'lastGroomedAt';
      const newFoals = foals.map((f, i) => (i === idx ? { ...f, [key]: 0 } : f));
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
      return true;
    },

    // Reklamla geçici ekstra ahır slotu (sayfa yenilenince sıfırlanır)
    addTempStableSlot: () => set({ bonusSlots: get().bonusSlots + 1 }),

    // Gerçek para ile satın alınan havuçları ekle (IAP)
    addCarrots: (amount) => {
      if (!amount || amount <= 0) return;
      const c = get().carrots + amount;
      localStorage.setItem('carrots', String(c));
      set({ carrots: c });
    },

    // =========================================================================
    // Çiftlik (paddock) — serbest antrenman alanı
    // =========================================================================
    paddockObstacles: JSON.parse(localStorage.getItem('paddockObstacles') ?? '[]'),
    trainingXP: JSON.parse(localStorage.getItem('trainingXP') ?? '{}'),
    paddockPlacing: null,   // satın alınan, yerleştirme bekleyen engel tipi
    paddockToast: '',
    paddockToastId: 0,

    enterPaddock: () => set({ phase: 'paddock' }),
    exitPaddock:  () => set({ phase: 'idle', paddockPlacing: null }),

    setPaddockPlacing: (type) => set({ paddockPlacing: type }),
    showPaddockToast: (msg) =>
      set((s) => ({ paddockToast: msg, paddockToastId: s.paddockToastId + 1 })),

    // Engel satın al (havuç düş) → yerleştirme moduna geç
    buyPaddockObstacle: (type, cost) => {
      const { carrots } = get();
      if (carrots < cost) return false;
      const c = carrots - cost;
      localStorage.setItem('carrots', String(c));
      set({ carrots: c, paddockPlacing: type });
      return true;
    },

    // Yerleştirme modundaki engeli zemine koy
    placePaddockObstacle: (x, z) => {
      const { paddockPlacing, paddockObstacles } = get();
      if (!paddockPlacing) return;
      const next = [...paddockObstacles, { id: `po_${Date.now()}`, type: paddockPlacing, x, z }];
      localStorage.setItem('paddockObstacles', JSON.stringify(next));
      set({ paddockObstacles: next, paddockPlacing: null });
    },

    // Antrenman XP'si: her 100 XP'de en düşük seviyeli stat +1 (bedava gelişim)
    addTrainingXP: (horseId, amount) => {
      const s = get();
      let xp = (s.trainingXP[horseId] ?? 0) + amount;
      const ups = { ...(s.horseUpgrades[horseId] ?? { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 }) };
      const leveled = [];
      while (xp >= 100) {
        const order = ['jumpLevel', 'speedLevel', 'maneuvLevel'];
        const open = order.filter((k) => (ups[k] ?? 0) < 5);
        if (!open.length) { xp = 99; break; } // hepsi maksimum
        const k = open.reduce((a, b) => ((ups[a] ?? 0) <= (ups[b] ?? 0) ? a : b));
        ups[k] = (ups[k] ?? 0) + 1;
        leveled.push(k);
        xp -= 100;
      }
      const trainingXP = { ...s.trainingXP, [horseId]: xp };
      const horseUpgrades = { ...s.horseUpgrades, [horseId]: ups };
      localStorage.setItem('trainingXP', JSON.stringify(trainingXP));
      localStorage.setItem('horseUpgrades', JSON.stringify(horseUpgrades));
      set({ trainingXP, horseUpgrades });
      return leveled;
    },

    // =========================================================================
    // Günlük sistem: giriş serisi + görevler
    // =========================================================================

    // Uygulama açılışında çağrılır: gün değiştiyse sıfırla, seri kopmuşsa düşür
    initDaily: () => {
      const s = get();
      const today = todayStr();
      let { streakDay, lastClaimDate, statsDate, dailyStats, missionClaimed,
            weekDate, weekStats, weeklyClaimed } = s;
      // Yeni gün → günlük sayaç ve görev talepleri sıfırla
      if (statsDate !== today) {
        statsDate = today;
        dailyStats = { distance: 0, jumps: 0, jumpover: 0, runs: 0, closecall: 0 };
        missionClaimed = [];
      }
      // Yeni hafta → haftalık sayaç ve talepleri sıfırla
      const wk = weekKey();
      if (weekDate !== wk) {
        weekDate = wk;
        weekStats = { distance: 0, jumps: 0, jumpover: 0, runs: 0, closecall: 0, carrots: 0 };
        weeklyClaimed = [];
      }
      // Seri: dün talep edilmediyse ve bugün de değilse → kopmuş, başa dön
      if (lastClaimDate && lastClaimDate !== today && lastClaimDate !== yesterdayStr()) {
        streakDay = 1;
      }
      const next = { streakDay, lastClaimDate, statsDate, dailyStats, missionClaimed,
                     weekDate, weekStats, weeklyClaimed };
      saveDaily({ ...get(), ...next });
      set(next);

      // Ücretsiz at migrasyonu: stilize kestane atı herkese ekle
      const owned = get().ownedHorseIds;
      if (!owned.includes('stylized_chestnut')) {
        const next2 = [...owned, 'stylized_chestnut'];
        localStorage.setItem('ownedHorseIds', JSON.stringify(next2));
        set({ ownedHorseIds: next2 });
      }
    },

    canClaimStreak: () => get().lastClaimDate !== todayStr(),

    claimStreak: () => {
      const s = get();
      if (s.lastClaimDate === todayStr()) return 0;
      // 1-7. gün tablodan, 7+ günlerde sabit MAX
      const reward = s.streakDay <= STREAK_REWARDS.length
        ? STREAK_REWARDS[s.streakDay - 1]
        : STREAK_MAX_REWARD;
      const newCarrots = s.carrots + reward;
      localStorage.setItem('carrots', String(newCarrots));
      const nextDay = s.streakDay + 1; // sınırsız ilerler (başa dönmez)
      const next = { carrots: newCarrots, streakDay: nextDay, lastClaimDate: todayStr() };
      set(next);
      saveDaily(get());
      sfx.powerup();
      haptic.success();
      return reward;
    },

    // Bugünün 3 görevi + canlı ilerleme + tamamlandı/talep durumu
    getMissions: () => {
      const s = get();
      const list = pickDailyMissions(todayStr());
      const progressOf = (m) => m.type === 'carrots' ? s.dailyCarrots : (s.dailyStats[m.type] ?? 0);
      return list.map(m => {
        const progress = Math.min(progressOf(m), m.target);
        return { ...m, progress, done: progress >= m.target, claimed: s.missionClaimed.includes(m.id) };
      });
    },

    claimMission: (id) => {
      const s = get();
      const m = pickDailyMissions(todayStr()).find(x => x.id === id);
      if (!m || s.missionClaimed.includes(id)) return 0;
      const progress = m.type === 'carrots' ? s.dailyCarrots : (s.dailyStats[m.type] ?? 0);
      if (progress < m.target) return 0;
      const newCarrots = s.carrots + m.reward;
      localStorage.setItem('carrots', String(newCarrots));
      const missionClaimed = [...s.missionClaimed, id];
      set({ carrots: newCarrots, missionClaimed });
      saveDaily(get());
      sfx.collect();
      haptic.success();
      return m.reward;
    },

    // Günlük sayaç arttırıcı (oyun olaylarından çağrılır)
    bumpDaily: (key, n = 1) => {
      const s = get();
      const dailyStats = { ...s.dailyStats, [key]: (s.dailyStats[key] ?? 0) + n };
      // Haftalık + ömür-boyu istatistikler de birlikte artar
      const weekStats = { ...s.weekStats, [key]: (s.weekStats[key] ?? 0) + n };
      const lifeStats = { ...s.lifeStats, [key]: (s.lifeStats[key] ?? 0) + n };
      set({ dailyStats, weekStats, lifeStats });
      // sık çağrılabilir; kaydı debounce et (havuç gibi)
      scheduleDailySave(get);
    },

    // Haftalık görevler: bu haftanın 3 görevi + ilerleme/talep durumu
    getWeeklyMissions: () => {
      const s = get();
      const list = pickWeeklyMissions(weekKey());
      return list.map((m) => {
        const progress = Math.min(Math.floor(s.weekStats[m.type] ?? 0), m.target);
        return { ...m, progress, done: progress >= m.target, claimed: s.weeklyClaimed.includes(m.id) };
      });
    },

    claimWeekly: (id) => {
      const s = get();
      const m = get().getWeeklyMissions().find((x) => x.id === id);
      if (!m || !m.done || m.claimed) return 0;
      const carrots = s.carrots + m.reward;
      const weeklyClaimed = [...s.weeklyClaimed, id];
      localStorage.setItem('carrots', String(carrots));
      set({ carrots, weeklyClaimed });
      saveDaily(get());
      sfx.powerup();
      haptic.success();
      return m.reward;
    },

    // =========================================================================
    // Başarımlar (achievements) — kalıcı hedefler, havuç ödülü
    // =========================================================================

    getAchievements: () => {
      const s = get();
      const maxhs = Math.max(
        s.highScoreMap1 ?? 0, s.highScoreMap2 ?? 0, s.highScoreMap3 ?? 0,
        s.highScoreMap4 ?? 0, s.highScoreMap5 ?? 0
      );
      return ACHIEVEMENTS.map((a) => {
        const raw = a.stat === 'maxhs' ? maxhs : (s.lifeStats[a.stat] ?? 0);
        const progress = Math.min(Math.floor(raw), a.target);
        return { ...a, progress, done: progress >= a.target, claimed: s.achClaimed.includes(a.id) };
      });
    },

    claimAchievement: (id) => {
      const s = get();
      const a = get().getAchievements().find((x) => x.id === id);
      if (!a || !a.done || a.claimed) return 0;
      const carrots = s.carrots + a.reward;
      const achClaimed = [...s.achClaimed, id];
      localStorage.setItem('carrots', String(carrots));
      localStorage.setItem('achClaimed', JSON.stringify(achClaimed));
      set({ carrots, achClaimed });
      sfx.powerup();
      haptic.success();
      return a.reward;
    },

    // =========================================================================
    // Garage / inventory actions
    // =========================================================================

    selectHorse: (horseId) => {
      const { ownedHorseIds } = get();
      if (!ownedHorseIds.includes(horseId)) return;
      localStorage.setItem('selectedHorseId', horseId);
      set({ selectedHorseId: horseId });
    },

    purchaseHorse: (horseId, price) => {
      const { carrots, ownedHorseIds } = get();
      if (carrots < price || ownedHorseIds.includes(horseId)) return false;
      const next = [...ownedHorseIds, horseId];
      localStorage.setItem('ownedHorseIds', JSON.stringify(next));
      const newCarrots = carrots - price;
      localStorage.setItem('carrots', String(newCarrots));
      set({ carrots: newCarrots, ownedHorseIds: next });
      return true;
    },

    upgradeHorseStat: (horseId, stat) => {
      const { carrots, horseUpgrades, upgradeDiscount } = get();
      const ups = horseUpgrades[horseId] ?? { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 };
      const currentLevel = ups[stat] ?? 0;
      if (currentLevel >= 5) return false;
      let cost = 750 * Math.pow(2, currentLevel);
      if (upgradeDiscount) cost = Math.ceil(cost * (1 - AD_UPGRADE_DISCOUNT));
      if (carrots < cost) return false;
      const newUps = { ...horseUpgrades, [horseId]: { ...ups, [stat]: currentLevel + 1 } };
      localStorage.setItem('horseUpgrades', JSON.stringify(newUps));
      const newCarrots = carrots - cost;
      localStorage.setItem('carrots', String(newCarrots));
      // indirim tek seferlik — kullanıldıktan sonra sıfırla
      set({ carrots: newCarrots, horseUpgrades: newUps, upgradeDiscount: false });
      return true;
    },

    selectCharacter: (id) => {
      const { ownedCharacterIds } = get();
      if (!ownedCharacterIds.includes(id)) return;
      localStorage.setItem('selectedCharId', id);
      set({ selectedCharacterId: id });
    },

    purchaseCharacter: (id, price) => {
      const { carrots, ownedCharacterIds } = get();
      if (carrots < price || ownedCharacterIds.includes(id)) return false;
      const next = [...ownedCharacterIds, id];
      localStorage.setItem('ownedCharIds', JSON.stringify(next));
      const newCarrots = carrots - price;
      localStorage.setItem('carrots', String(newCarrots));
      set({ carrots: newCarrots, ownedCharacterIds: next });
      return true;
    },

    setMapId: (id) => { localStorage.setItem('mapId', id); set({ mapId: id }); },

    toggleNightMode: () => {
      const next = !get().nightMode;
      localStorage.setItem('nightMode', next ? '1' : '0');
      set({ nightMode: next });
    },

    setSoundOn: (on) => {
      localStorage.setItem('soundOn', on ? '1' : '0');
      setSfxEnabled(on);
      if (on && get().phase === 'playing') startGallop();
      set({ soundOn: on });
    },

    setMusicOn: (on) => {
      localStorage.setItem('musicOn', on ? '1' : '0');
      setMusicEnabled(on);
      if (on && get().phase === 'playing') startMusic(get().mapId);
      set({ musicOn: on });
    },

    setGraphics: (q) => {
      const v = q === 'low' ? 'low' : 'high';
      localStorage.setItem('graphics', v);
      set({ graphics: v });
    },

    openGarage:  (tab = null) => set({ showGarage: true, garageOpenTab: tab }),
    closeGarage: () => set({ showGarage: false, garageOpenTab: null }),

    collectCarrots: (count = 1) => {
      const s = get();
      if (s.goldenActive) count *= 2; // 💰 Altın Havuç: 2 kat
      if (!_todayKey) _todayKey = `daily_carrots_${new Date().toDateString()}`;
      sfx.collect();
      // state'i hemen güncelle, localStorage yazımını debounce et (jank önleme)
      set({
        carrots: s.carrots + count,
        dailyCarrots: s.dailyCarrots + count,
        runCarrots: s.runCarrots + count,
        weekStats: { ...s.weekStats, carrots: (s.weekStats.carrots ?? 0) + count },
      });
      scheduleCarrotSave(get);
    },

    activateMagnet: () => get().activatePowerup('magnet'),

    // ── Hara actions ──────────────────────────────────────────────────────────

    breedFoal: (parentAId, parentBId) => {
      const { carrots, foals, stableSlots, bonusSlots, ownedHorseIds, lastBreedAt } = get();
      if (!ownedHorseIds.includes(parentAId) || !ownedHorseIds.includes(parentBId)) return { ok: false, reason: 'Atlar sahiplenilmemiş' };
      if (parentAId === parentBId) return { ok: false, reason: 'Aynı at seçildi' };
      if (foals.length >= stableSlots + bonusSlots) return { ok: false, reason: 'Ahır dolu' };
      if (carrots < BREED_COST) return { ok: false, reason: 'Yetersiz havuç' };
      const now = Date.now();
      if (now - lastBreedAt < BREED_COOLDOWN_MS) return { ok: false, reason: 'Cooldown devam ediyor' };

      const allHorses = [...HORSES, ...get().foals.filter(f => f.stage === 'YETISKIN').map(f => ({
        id: f.id, baseSpeedMult: f.genes.speedMult, baseManeuvMult: f.genes.maneuvMult,
        baseJumpMult: f.genes.jumpMult, baseMaxSpeed: f.genes.maxSpeed,
        bodyColor: f.genes.bodyColor, maneColor: f.genes.maneColor,
      })), ...(get().customHorses ?? [])];
      const horseA = allHorses.find(h => h.id === parentAId);
      const horseB = allHorses.find(h => h.id === parentBId);
      if (!horseA || !horseB) return { ok: false, reason: 'At bulunamadı' };

      // Genetic interpolation
      const rnd = (v, spread = 0.10) => Math.max(0.1, v + (Math.random() * 2 - 1) * spread);
      const lerpColor = (c1, c2) => {
        const parse = c => [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
        const [r1,g1,b1] = parse(c1 ?? '#8d6e63'); const [r2,g2,b2] = parse(c2 ?? '#8d6e63');
        const t = Math.random();
        const drift = () => Math.floor((Math.random()-0.5)*20);
        return '#' + [Math.round(r1+(r2-r1)*t)+drift(), Math.round(g1+(g2-g1)*t)+drift(), Math.round(b1+(b2-b1)*t)+drift()]
          .map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
      };

      const traitRoll = Math.random() < TRAIT_CHANCE ? Object.keys(TRAITS)[Math.floor(Math.random()*3)] : null;

      const genes = {
        speedMult:  rnd(((horseA.baseSpeedMult??1) + (horseB.baseSpeedMult??1)) / 2),
        maneuvMult: rnd(((horseA.baseManeuvMult??1) + (horseB.baseManeuvMult??1)) / 2),
        jumpMult:   rnd(((horseA.baseJumpMult??1) + (horseB.baseJumpMult??1)) / 2),
        maxSpeed:   rnd(((horseA.baseMaxSpeed??40) + (horseB.baseMaxSpeed??40)) / 2, 4),
        bodyColor:  lerpColor(horseA.bodyColor, horseB.bodyColor),
        maneColor:  lerpColor(horseA.maneColor, horseB.maneColor),
        trait: traitRoll,
      };

      const foal = {
        id: `foal_${Date.now()}`,
        source: 'breed', parentA: parentAId, parentB: parentBId,
        bornAt: now, stage: 'TAY', stageStartedAt: now,
        bp: 0, tokluk: 80, mutluluk: 80, bag: 0,
        lastFedAt: 0, lastGroomedAt: 0, lastTrainedAt: 0,
        genes, name: `Yavru ${Math.floor(Math.random()*9000)+1000}`,
        feedsToday: 0, feedDayKey: new Date().toDateString(),
      };

      const newFoals = [...foals, foal];
      const newCarrots = carrots - BREED_COST;
      localStorage.setItem('foals', JSON.stringify(newFoals));
      localStorage.setItem('lastBreedAt', String(now));
      localStorage.setItem('carrots', String(newCarrots));
      set({ foals: newFoals, carrots: newCarrots, lastBreedAt: now });
      return { ok: true, foal };
    },

    buyFoal: (tier) => {
      const { carrots, foals, stableSlots, bonusSlots } = get();
      const cost = tier === 2 ? SHOP_TIER2_COST : SHOP_TIER1_COST;
      if (carrots < cost) return { ok: false, reason: 'Yetersiz havuç' };
      if (foals.length >= stableSlots + bonusSlots) return { ok: false, reason: 'Ahır dolu' };

      const tierRanges = tier === 2
        ? { speed: [1.2, 1.8], maneuv: [0.9, 1.5], jump: [1.0, 1.6], maxSpeed: [50, 75] }
        : { speed: [0.8, 1.3], maneuv: [0.8, 1.2], jump: [0.8, 1.2], maxSpeed: [35, 55] };
      const rr = (min, max) => min + Math.random() * (max - min);
      const COLORS = ['#8d6e63','#5d4037','#212121','#424242','#EDE8D8','#C0B898','#bf8040','#795548'];
      const genes = {
        speedMult:  rr(...tierRanges.speed),
        maneuvMult: rr(...tierRanges.maneuv),
        jumpMult:   rr(...tierRanges.jump),
        maxSpeed:   rr(...tierRanges.maxSpeed),
        bodyColor:  COLORS[Math.floor(Math.random()*COLORS.length)],
        maneColor:  COLORS[Math.floor(Math.random()*COLORS.length)],
        trait: null,
      };
      const now = Date.now();
      const foal = {
        id: `foal_${now}`, source: 'shop', parentA: null, parentB: null,
        bornAt: now, stage: 'TAY', stageStartedAt: now,
        bp: 0, tokluk: 80, mutluluk: 80, bag: 0,
        lastFedAt: 0, lastGroomedAt: 0, lastTrainedAt: 0,
        genes, name: `Tier${tier} Yavru ${Math.floor(Math.random()*9000)+1000}`,
        feedsToday: 0, feedDayKey: new Date().toDateString(),
      };
      const newFoals = [...foals, foal];
      const newCarrots = carrots - cost;
      localStorage.setItem('foals', JSON.stringify(newFoals));
      localStorage.setItem('carrots', String(newCarrots));
      set({ foals: newFoals, carrots: newCarrots });
      return { ok: true, foal };
    },

    // Reklamla şanslı tay (reroll): havuçsuz, istatistikler 3 denemenin en iyisi
    buyFoalLucky: (tier) => {
      const { foals, stableSlots, bonusSlots } = get();
      if (foals.length >= stableSlots + bonusSlots) return { ok: false, reason: 'Ahır dolu' };
      const tierRanges = tier === 2
        ? { speed: [1.2, 1.8], maneuv: [0.9, 1.5], jump: [1.0, 1.6], maxSpeed: [50, 75] }
        : { speed: [0.8, 1.3], maneuv: [0.8, 1.2], jump: [0.8, 1.2], maxSpeed: [35, 55] };
      const best = (min, max) => Math.max(rr3(min, max), rr3(min, max), rr3(min, max));
      function rr3(min, max) { return min + Math.random() * (max - min); }
      const COLORS = ['#8d6e63','#5d4037','#212121','#424242','#EDE8D8','#C0B898','#bf8040','#795548'];
      const genes = {
        speedMult:  best(...tierRanges.speed),
        maneuvMult: best(...tierRanges.maneuv),
        jumpMult:   best(...tierRanges.jump),
        maxSpeed:   best(...tierRanges.maxSpeed),
        bodyColor:  COLORS[Math.floor(Math.random()*COLORS.length)],
        maneColor:  COLORS[Math.floor(Math.random()*COLORS.length)],
        trait: null,
      };
      const now = Date.now();
      const foal = {
        id: `foal_${now}`, source: 'shop', parentA: null, parentB: null,
        bornAt: now, stage: 'TAY', stageStartedAt: now,
        bp: 0, tokluk: 80, mutluluk: 80, bag: 0,
        lastFedAt: 0, lastGroomedAt: 0, lastTrainedAt: 0,
        genes, name: `Şanslı Tay ${Math.floor(Math.random()*9000)+1000}`,
        feedsToday: 0, feedDayKey: new Date().toDateString(),
      };
      const newFoals = [...foals, foal];
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
      return { ok: true, foal };
    },

    // Tay/at ismini değiştir — en fazla 20 karakter, benzersiz olmalı
    renameFoal: (id, rawName) => {
      const name = (rawName ?? '').trim();
      if (!name) return { ok: false, reason: 'İsim boş olamaz' };
      if (name.length > 20) return { ok: false, reason: 'En fazla 20 karakter' };
      const { foals, customHorses } = get();
      const lower = name.toLowerCase();
      const taken = [
        ...HORSES.map(h => h.name),
        ...(customHorses ?? []).map(c => c.name),
        ...foals.filter(f => f.id !== id).map(f => f.name),
      ].some(n => (n ?? '').toLowerCase() === lower);
      if (taken) return { ok: false, reason: 'Bu isim zaten kullanılıyor' };
      const newFoals = foals.map(f => (f.id === id ? { ...f, name } : f));
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
      return { ok: true };
    },

    feedFoal: (id) => {
      const { carrots, foals } = get();
      const idx = foals.findIndex(f => f.id === id);
      if (idx === -1) return false;
      const foal = foals[idx];
      if (carrots < FEED_COST) return false;
      const today = new Date().toDateString();
      const feedsToday = foal.feedDayKey === today ? foal.feedsToday : 0;
      if (feedsToday >= FEED_MAX_DAY) return false;
      const updated = { ...foal,
        tokluk: Math.min(100, foal.tokluk + FEED_TOKLUK),
        bp: foal.bp + FEED_BP,
        lastFedAt: Date.now(),
        feedsToday: feedsToday + 1,
        feedDayKey: today,
      };
      const newFoals = foals.map((f, i) => i === idx ? updated : f);
      const newCarrots = carrots - FEED_COST;
      localStorage.setItem('foals', JSON.stringify(newFoals));
      localStorage.setItem('carrots', String(newCarrots));
      set({ foals: newFoals, carrots: newCarrots });
      return true;
    },

    groomFoal: (id) => {
      const { foals } = get();
      const idx = foals.findIndex(f => f.id === id);
      if (idx === -1) return false;
      const foal = foals[idx];
      const now = Date.now();
      if (now - foal.lastGroomedAt < GROOM_COOLDOWN_MS) return false;
      const updated = { ...foal,
        mutluluk: Math.min(100, foal.mutluluk + GROOM_MUTLULUK),
        bp: foal.bp + GROOM_BP,
        bag: Math.min(5, foal.bag + GROOM_BOND),
        lastGroomedAt: now,
      };
      const newFoals = foals.map((f, i) => i === idx ? updated : f);
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
      return true;
    },

    trainFoal: (id) => {
      const { foals } = get();
      const idx = foals.findIndex(f => f.id === id);
      if (idx === -1) return false;
      const foal = foals[idx];
      const now = Date.now();
      if (now - foal.lastTrainedAt < TRAIN_COOLDOWN_MS) return false;
      const updated = { ...foal,
        bp: foal.bp + TRAIN_BP,
        bag: Math.min(5, foal.bag + TRAIN_BOND),
        lastTrainedAt: now,
      };
      const newFoals = foals.map((f, i) => i === idx ? updated : f);
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
      return true;
    },

    addRunBP: (distanceMeters) => {
      const { foals } = get();
      if (foals.length === 0) return;
      const gain = Math.floor(distanceMeters / 500) * BP_PER_500M;
      if (gain <= 0) return;
      // Only fed foals (tokluk >= 20) earn BP from runs
      const newFoals = foals.map(f => f.tokluk >= 20 ? { ...f, bp: f.bp + gain } : f);
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
    },

    tickFoals: (now) => {
      const { foals } = get();
      if (foals.length === 0) return;
      const newFoals = foals.map(foal => {
        if (foal.stage === 'YETISKIN') return foal;
        const newTokluk = Math.max(0, foal.tokluk - TOKLUK_DECAY_PER_MS * (now - (foal.lastTickAt || foal.bornAt)));
        const newMutluluk = Math.max(0, foal.mutluluk - MUTLULUK_DECAY_PER_MS * (now - (foal.lastTickAt || foal.bornAt)));
        return { ...foal, tokluk: newTokluk, mutluluk: newMutluluk, lastTickAt: now };
      });
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
    },

    advanceStageIfReady: (id) => {
      const { foals } = get();
      const idx = foals.findIndex(f => f.id === id);
      if (idx === -1) return false;
      const foal = foals[idx];
      if (foal.stage === 'YETISKIN') return false;

      const stageOrder = ['TAY', 'YAVRU', 'GENC', 'YETISKIN'];
      const currentIdx = stageOrder.indexOf(foal.stage);
      const cfg = STAGE_CONFIG[foal.stage];
      const now = Date.now();
      const elapsed = now - foal.stageStartedAt;

      if (elapsed < cfg.minMs) return false;
      if (foal.bp < cfg.bp) return false;
      if (foal.bag < cfg.bondGate) return false;
      if (foal.tokluk < 20) return false;

      const nextStage = stageOrder[currentIdx + 1];
      const updated = { ...foal, stage: nextStage, stageStartedAt: now };
      const newFoals = foals.map((f, i) => i === idx ? updated : f);
      localStorage.setItem('foals', JSON.stringify(newFoals));
      set({ foals: newFoals });
      return true;
    },

    matureFoal: (id) => {
      const { foals, ownedHorseIds, horseUpgrades } = get();
      const foal = foals.find(f => f.id === id);
      if (!foal || foal.stage !== 'YETISKIN') return false;

      // Care quality bonus: 0..10%
      const careScore = 0.5 * (foal.mutluluk / 100) + 0.5 * (foal.bag / 5);
      const careBonus = careScore * 0.10;

      // Apply trait
      let { speedMult, maneuvMult, jumpMult, maxSpeed } = foal.genes;
      const trait = foal.genes.trait;
      if (trait === 'sampiyon') { speedMult *= 1.10; maneuvMult *= 1.10; jumpMult *= 1.10; }
      if (trait === 'ruzgar')   { maxSpeed += 5; }
      if (trait === 'sicrayan') { jumpMult += 0.15; }
      speedMult  *= (1 + careBonus);
      maneuvMult *= (1 + careBonus);
      jumpMult   *= (1 + careBonus);
      maxSpeed   *= (1 + careBonus);

      const newHorse = {
        id: foal.id,
        name: foal.name,
        price: 0,
        bodyColor: foal.genes.bodyColor,
        maneColor: foal.genes.maneColor,
        hoofColor: '#3e2723',
        desc: trait ? TRAITS[trait]?.label ?? 'Özel at' : 'Ahırda yetişti',
        accentColor: foal.genes.bodyColor,
        baseSpeedMult:  speedMult,
        baseManeuvMult: maneuvMult,
        baseJumpMult:   jumpMult,
        baseMaxSpeed:   maxSpeed,
        fromHara: true,
      };

      const customHorses = JSON.parse(localStorage.getItem('customHorses') ?? '[]');
      customHorses.push(newHorse);
      localStorage.setItem('customHorses', JSON.stringify(customHorses));

      const newOwned = [...ownedHorseIds, foal.id];
      const newFoals = foals.filter(f => f.id !== id);
      const newUpgrades = { ...horseUpgrades, [foal.id]: { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 } };

      localStorage.setItem('ownedHorseIds', JSON.stringify(newOwned));
      localStorage.setItem('foals', JSON.stringify(newFoals));
      localStorage.setItem('horseUpgrades', JSON.stringify(newUpgrades));
      set({ foals: newFoals, ownedHorseIds: newOwned, horseUpgrades: newUpgrades, customHorses: [...(get().customHorses ?? []), newHorse] });
      return newHorse;
    },

    buyStableSlot: () => {
      const { carrots, stableSlots } = get();
      if (carrots < EXTRA_SLOT_COST) return false;
      const newSlots = stableSlots + 1;
      const newCarrots = carrots - EXTRA_SLOT_COST;
      localStorage.setItem('stableSlots', String(newSlots));
      localStorage.setItem('carrots', String(newCarrots));
      set({ stableSlots: newSlots, carrots: newCarrots });
      return true;
    },
  }))
);

export default useGameStore;
