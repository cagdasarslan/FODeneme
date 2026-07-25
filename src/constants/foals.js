export const STAGES = ['TAY', 'YAVRU', 'GENC', 'YETISKIN'];

// minMs = minimum real time per stage (not cumulative)
// Kasual-dostu süreler: eskiden 4/8/12s = toplam 24 SAAT (bir tayı büyütmek
// tam bir gün alıyordu — mobil bir runner için çok cezalandırıcıydı). Artık
// 1/2/4s = toplam 7 saat; ayrıca "Hızlandır" ile havuç/reklamla anında geçilir.
export const STAGE_CONFIG = {
  TAY:      { minMs: 1 * 3600_000, bp: 80,  bondGate: 0, scale: 0.50 },
  YAVRU:    { minMs: 2 * 3600_000, bp: 180, bondGate: 1, scale: 0.65 },
  GENC:     { minMs: 4 * 3600_000, bp: 350, bondGate: 2, scale: 0.80 },
  YETISKIN: { minMs: 0,            bp: 0,   bondGate: 0, scale: 1.00 },
};

// "Hızlandır": kalan bekleme süresini anında geç. Havuç maliyeti kalan saate
// göre ölçeklenir; alternatif olarak ödüllü reklamla ücretsiz.
export const RUSH_COST_PER_HOUR = 40;   // her kalan (yukarı yuvarlanmış) saat başına havuç
export const RUSH_MAX_COST       = 150; // üst sınır (tek stage için)

export const BREED_COST        = 300;
export const BREED_COOLDOWN_MS = 6 * 3600_000;
export const SHOP_TIER1_COST   = 200;
export const SHOP_TIER2_COST   = 500;
export const EXTRA_SLOT_COST   = 1000;

export const TOKLUK_DECAY_PER_MS  = 100 / (6  * 3600_000);
export const MUTLULUK_DECAY_PER_MS = 100 / (18 * 3600_000);

export const FEED_COST     = 15;
export const FEED_TOKLUK   = 40;
export const FEED_BP       = 5;
export const FEED_MAX_DAY  = 4;

export const GROOM_MUTLULUK    = 30;
export const GROOM_BP          = 5;
export const GROOM_BOND        = 1;
export const GROOM_COOLDOWN_MS = 4 * 3600_000;

export const TRAIN_BP          = 20;
export const TRAIN_BOND        = 1;
export const TRAIN_COOLDOWN_MS = 24 * 3600_000;

export const BP_PER_500M = 15; // koşuyla BP kazanımı (aktif oyuncu daha hızlı ilerlesin)

export const TRAITS = {
  sampiyon: { label: '🏆 Şampiyon', desc: 'Tüm statlar +%10',  effect: { allMult: 0.10 } },
  ruzgar:   { label: '💨 Rüzgar',   desc: 'Max hız +5',         effect: { maxSpeedBonus: 5 } },
  sicrayan: { label: '🌙 Sıçrayan', desc: 'Zıplama +%15',       effect: { jumpMult: 0.15 } },
};
export const TRAIT_CHANCE = 0.05;
