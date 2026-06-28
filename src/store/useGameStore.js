import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { setSfxEnabled, setMusicEnabled, sfx, startMusic, startGallop } from '@/utils/audio';
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
} from '@/constants/game';
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
    runCarrots: 0,      // bu koşuda toplanan havuç (oyun sonu 2x için)
    carrotsDoubled: false, // oyun sonu havuç katlama kullanıldı mı
    startBoost: false,  // sonraki koşuya boost (mıknatıs) ile başla
    upgradeDiscount: false, // sonraki yükseltme indirimli
    bonusSlots: 0,      // reklamla kazanılan geçici ahır slotu (kalıcı değil)
    adBonusToday: parseInt(localStorage.getItem(`ad_bonus_${new Date().toDateString()}`) ?? '0', 10),
    magnetActive: false,
    magnetTimer: 0,
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
        startBoost: false,
        adrenalinBoosting: false,
        adrenalinBoostTimer: 0,
      })),

    pauseRun: () => set({ phase: 'paused' }),
    resumeRun: () => set({ phase: 'playing' }),

    endRun: async () => {
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

      const boostCap = adrenalinBoosting ? Math.min(cap * 1.3, MAX_SPEED * 1.3) : cap;
      const newSpeed = Math.min(speed + SPEED_INCREMENT * delta, boostCap);
      const traveled = newSpeed * delta;
      const newAdrenaline = adrenalinBoosting ? 0 : Math.max(0, adrenaline - ADRENALINE_DECAY_RATE * delta);

      const magnetUpdate = magnetTimer > 0
        ? { magnetTimer: Math.max(0, magnetTimer - delta), magnetActive: magnetTimer - delta > 0 }
        : {};

      set({
        speed: newSpeed,
        distance: distance + traveled,
        score: score + traveled * SCORE_PER_METER * scoreMult,
        adrenaline: newAdrenaline,
        ...magnetUpdate,
        ...boostUpdate,
      });
    },

    // =========================================================================
    // Event actions
    // =========================================================================

    registerCloseCall: () => {
      const { phase, adrenaline } = get();
      if (phase !== 'playing') return;

      set({
        adrenaline: Math.min(adrenaline + ADRENALINE_CLOSE_CALL_GAIN, ADRENALINE_MAX),
      });
    },

    registerJumpOver: () => {
      const { phase, adrenaline } = get();
      if (phase !== 'playing') return;
      set({
        adrenaline: Math.min(adrenaline + ADRENALINE_JUMP_GAIN, ADRENALINE_MAX),
      });
    },

    // Çarpışma → önce "devam et" teklifi göster (gameover'ı ertele)
    registerCollision: () => {
      const { phase } = get();
      if (phase === 'playing') { sfx.crash(); set({ phase: 'crashed' }); }
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
      const c = get().carrots + count;
      localStorage.setItem('carrots', String(c));
      const dateKey = `daily_carrots_${new Date().toDateString()}`;
      const dailyC = (parseInt(localStorage.getItem(dateKey) ?? '0') + count);
      localStorage.setItem(dateKey, String(dailyC));
      sfx.collect();
      set({ carrots: c, dailyCarrots: dailyC, runCarrots: get().runCarrots + count });
    },

    activateMagnet: () => {
      sfx.powerup();
      set({ magnetActive: true, magnetTimer: 10 });
    },

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
