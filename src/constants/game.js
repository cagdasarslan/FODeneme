export const LANE_COUNT  = 3;
export const LANE_WIDTH  = 4;    // şerit genişliği — yol 12 birim / 3 şerit
export const HALF_TRACK  = 4.5;  // at bu sınırdan çıkamaz
export const LANES       = [-4, 0, 4];

export const INITIAL_SPEED    = 16;
export const MAX_SPEED        = 55;
// Piyasa runner'ları gibi yavaş ve akıcı hızlanma (eski 1.5 çok agresifti:
// 26 saniyede maksimuma çıkıyordu). 0.5 ile artış dakikalara yayılır.
export const SPEED_INCREMENT  = 0.5;  // birim/s² — delta ile çarpılır

export const ADRENALINE_CLOSE_CALL_GAIN = 20;
export const ADRENALINE_JUMP_GAIN       = 18; // engel üzerinden atlama ödülü
export const ADRENALINE_DECAY_RATE      = 8;
export const ADRENALINE_MAX             = 100;

// Devam et (revive) — her kullanımda maliyet 3 katına çıkar
export const CONTINUE_BASE_CARROTS = 200;
export const CONTINUE_BASE_ADS     = 1;
export const CONTINUE_MULTIPLIER   = 3;

// Eğilme (slide) — üstten geçen engellerin altından kaymak için
export const SLIDE_DURATION_MS = 700;

// Combo: art arda makas/engel-atlama skoru katlar (x1 → x4)
export const COMBO_WINDOW_MS = 5000;  // bu süre içinde yeni aksiyon gelmezse sıfırlanır
export const COMBO_PER_STEP  = 3;     // her 3 combo'da çarpan +1
export const COMBO_MAX_MULT  = 4;

// Tökezleme (stumble): ilk çarpma affedilir — bu pencere içinde ikinci çarpma öldürür.
// Uyarı + tehlike penceresi 7.5 sn.
export const STUMBLE_WINDOW_MS = 7500;

// Günlük skor görevi: o gün TÜM haritalarda toplam bu puana ulaşınca hediye sandık
export const DAILY_SCORE_GOAL = 50000;

// Çiftlik antrenman tavanı: ücretsiz XP eğitimi toplam bu seviyeye kadar
// (eskiden 15). Üstü (10→15) günlük ücretsiz yükseltme ödülüyle açılır.
export const PADDOCK_TRAIN_CAP = 10;

// Harita kilitleri: herhangi bir haritadaki en iyi skorun eşiği
export const MAP_UNLOCKS = { 2: 1000, 3: 3000, 4: 6000, 5: 10000, 6: 15000 };

// Uzay imza mekaniği: düşük yerçekimi
export const SPACE_GRAVITY_MULT = 0.62;
export const SPACE_JUMP_MULT    = 1.05;

// Ödüllü reklam ödülleri — 1 reklam ≈ 200 havuç değerinde olacak şekilde
export const AD_CARROT_VALUE     = 200;  // 1 reklamın havuç karşılığı
export const AD_DAILY_CARROTS    = 200;  // günlük bedava havuç (1 reklam = 200)
export const AD_DAILY_MAX        = 5;    // günde en fazla kaç kez
export const AD_UPGRADE_DISCOUNT = 0.5;  // yükseltmede %50 indirim

export const HORSE_LATERAL_SPEED = 10;

export const SCORE_PER_METER   = 1;

export const OBSTACLE_SPAWN_Z  = -85;
export const OBSTACLE_RECYCLE_Z = 15;
export const OBSTACLE_MIN_GAP  = 20;
export const CLOSE_CALL_RADIUS = 2.2;   // dış eşik
export const COLLISION_DX      = 1.6;   // çarpışma X eşiği
export const COLLISION_DZ      = 1.4;   // çarpışma Z eşiği

// Tip başına hitbox yarı-genişlikleri [dx, dz]
export const OBSTACLE_HITBOX = {
  Barrel:     [0.65, 0.65],
  HayBale:    [0.70, 0.70],
  LogPile:    [0.75, 0.65],
  CityCar:    [1.10, 1.80],
  CityTaxi:   [1.10, 1.80],
  CityPolice: [1.10, 1.80],
  CityDump:   [0.90, 1.20],
  default:    [1.00, 1.00],
};

// Yapı etiketi — ana menüde görünür; APK'nın güncel olduğunu doğrulamak için
// her önemli düzeltmede güncellenir
export const GAME_BUILD = 'BUILD 07.09 #2';

// ── HARİTA MADALYALARI — kısa vadeli somut hedefler ──────────────────────────
// Her harita için tek koşuda ulaşılması gereken 3 skor eşiği (bronz/gümüş/altın).
// Kazanılan her madalya bir kez havuç ödülü verir. Oyuncuya "bir sonraki hedef"
// hissi verir; görevlerden bağımsız, kalıcı ilerleme.
export const MAP_MEDALS = {
  1: [500, 1500, 4000],
  2: [1000, 3000, 7000],
  3: [2000, 5000, 10000],
  4: [3000, 7000, 14000],
  5: [4000, 9000, 18000],
  6: [5000, 12000, 24000],
};
// Bronz / Gümüş / Altın ödülleri (havuç)
export const MEDAL_REWARDS = [300, 700, 1500];
export const MEDAL_ICONS = ['🥉', '🥈', '🥇'];
