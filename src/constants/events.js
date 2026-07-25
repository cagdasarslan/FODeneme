// Mevsimsel etkinlikler — aya göre otomatik açılır, yeni asset gerektirmez.
// Dekorlar mevcut ortamlara koşullu eklenir (Track/Weather), menüde rozet çıkar.
export function getActiveEvent(d = new Date()) {
  const m = d.getMonth(); // 0-11
  if (m === 9)  return { id: 'halloween', name: 'CADILAR BAYRAMI', emoji: '🎃', color: '#ff8c00' };
  if (m === 11) return { id: 'winter',    name: 'KIŞ ŞENLİĞİ',     emoji: '❄️', color: '#9fd8ff' };
  if (m === 8)  return { id: 'harvest',   name: 'HASAT FESTİVALİ', emoji: '🌾', color: '#e8c261' };
  return null;
}
