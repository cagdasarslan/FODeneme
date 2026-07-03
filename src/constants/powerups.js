// Koşu içi yetenekler — yolda beliren parlak nesnelerle alınır.
// Süreler seviye ile uzar: süre = baseDur × (1 + 0.2 × seviye)  (Sv5 = 2×)
export const POWERUPS = [
  { id: 'magnet', name: 'Süper Nal',          emoji: '🧲', color: '#00cfff', baseDur: 10, desc: 'Havuçları mıknatıs gibi çeker' },
  { id: 'wings',  name: 'Pegasus Kanatları',  emoji: '🪽', color: '#ffffff', baseDur: 6,  desc: 'Uç! Tüm engellerin üstünden süzül' },
  { id: 'turbo',  name: 'Şimşek Nalı',        emoji: '🚀', color: '#ffd54a', baseDur: 5,  desc: 'Maksimum hız + çarpışma muafiyeti' },
  { id: 'shield', name: 'Nal Zırhı',          emoji: '🛡️', color: '#e8c261', baseDur: 15, desc: 'İlk çarpma bedava (kalkan kırılır)' },
  { id: 'slowmo', name: 'Zaman Büyüsü',       emoji: '⏳', color: '#b388ff', baseDur: 5,  desc: 'Dünya yavaşlar, skor normal akar' },
  { id: 'golden', name: 'Altın Havuç',        emoji: '💰', color: '#ffb300', baseDur: 8,  desc: 'Toplanan havuçlar 2 kat sayılır' },
];

export const POWERUP_IDS = POWERUPS.map(p => p.id);
export const POWERUP_BY_ID = Object.fromEntries(POWERUPS.map(p => [p.id, p]));

export const powerupDuration = (id, level = 0) =>
  (POWERUP_BY_ID[id]?.baseDur ?? 5) * (1 + 0.2 * level);

// At geliştirmeyle aynı maliyet eğrisi: 750 → 1500 → 3000 → 6000 → 12000
export const powerupUpgradeCost = (level) => 750 * Math.pow(2, level);
export const POWERUP_MAX_LEVEL = 5;
