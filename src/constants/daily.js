// Günlük giriş serisi ödülleri (1-7. gün). 7. günden sonra her gün MAX verir.
export const STREAK_REWARDS = [1000, 1500, 2000, 3000, 4000, 5500, 7000];
export const STREAK_MAX_REWARD = 7000; // 7+ günlerde her gün

// Günlük görev havuzu — her gün 3 tanesi deterministik seçilir.
// type alanı oyun içi sayaçlarla eşleşir.
export const MISSION_POOL = [
  { id: 'dist1',   type: 'distance', target: 1500, reward: 150, label: 'Toplam 1500m koş' },
  { id: 'dist2',   type: 'distance', target: 3000, reward: 250, label: 'Toplam 3000m koş' },
  { id: 'carrot1', type: 'carrots',  target: 100,  reward: 150, label: '100 havuç topla' },
  { id: 'carrot2', type: 'carrots',  target: 250,  reward: 250, label: '250 havuç topla' },
  { id: 'jump1',   type: 'jumps',    target: 20,   reward: 120, label: '20 kez zıpla' },
  { id: 'over1',   type: 'jumpover', target: 10,   reward: 180, label: '10 engel üstünden atla' },
  { id: 'run1',    type: 'runs',     target: 5,    reward: 120, label: '5 kez oyna' },
  { id: 'close1',  type: 'closecall',target: 8,    reward: 180, label: '8 makas (kıl payı) yap' },
];

// Tarihe göre deterministik 3 görev seç
export function pickDailyMissions(dateStr) {
  let h = 0;
  for (const ch of dateStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = MISSION_POOL.map((_, i) => i);
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const j = (h % pool.length);
    out.push(MISSION_POOL[pool.splice(j, 1)[0]]);
    h = (h * 131 + 17) >>> 0;
  }
  return out;
}
