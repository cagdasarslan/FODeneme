export const LANE_COUNT  = 3;
export const LANE_WIDTH  = 4;    // şerit genişliği — yol 12 birim / 3 şerit
export const HALF_TRACK  = 4.5;  // at bu sınırdan çıkamaz
export const LANES       = [-4, 0, 4];

export const INITIAL_SPEED    = 16;
export const MAX_SPEED        = 55;
export const SPEED_INCREMENT  = 1.5;  // birim/s² — delta ile çarpılır

export const ADRENALINE_CLOSE_CALL_GAIN = 20;
export const ADRENALINE_JUMP_GAIN       = 18; // engel üzerinden atlama ödülü
export const ADRENALINE_DECAY_RATE      = 8;
export const ADRENALINE_MAX             = 100;

// Devam et (revive) — her kullanımda maliyet 3 katına çıkar
export const CONTINUE_BASE_CARROTS = 200;
export const CONTINUE_BASE_ADS     = 1;
export const CONTINUE_MULTIPLIER   = 3;

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
