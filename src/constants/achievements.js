// Başarımlar — kalıcı (ömür boyu) istatistiklerle ilerler, havuç ödülü verir.
// stat: lifeStats alanı; 'maxhs' özel = tüm haritaların en iyi skoru.
export const ACHIEVEMENTS = [
  { id: 'dist10k',  stat: 'distance',  target: 10000,  reward: 500,  label: 'Toplam 10.000m koş',        emoji: '🏃' },
  { id: 'dist50k',  stat: 'distance',  target: 50000,  reward: 2000, label: 'Toplam 50.000m koş',        emoji: '🌍' },
  { id: 'jump100',  stat: 'jumps',     target: 100,    reward: 300,  label: '100 kez zıpla',             emoji: '🦘' },
  { id: 'jump1000', stat: 'jumps',     target: 1000,   reward: 1500, label: '1.000 kez zıpla',           emoji: '🚀' },
  { id: 'over50',   stat: 'jumpover',  target: 50,     reward: 500,  label: '50 engel üstünden atla',    emoji: '🎪' },
  { id: 'over250',  stat: 'jumpover',  target: 250,    reward: 1800, label: '250 engel üstünden atla',   emoji: '🏆' },
  { id: 'runs25',   stat: 'runs',      target: 25,     reward: 400,  label: '25 koşu tamamla',           emoji: '🎽' },
  { id: 'close100', stat: 'closecall', target: 100,    reward: 600,  label: '100 makas (kıl payı) yap',  emoji: '⚡' },
  { id: 'hs2k',     stat: 'maxhs',     target: 2000,   reward: 750,  label: 'Bir haritada 2.000 skor',   emoji: '🥈' },
  { id: 'hs10k',    stat: 'maxhs',     target: 10000,  reward: 3000, label: 'Bir haritada 10.000 skor',  emoji: '🥇' },
];
