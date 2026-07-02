import { SUPA_URL, SUPA_KEY } from '@/constants/supabase';

// Sezonluk liderlik (gün/hafta/ay/yıl) — Supabase REST.
// Yapılandırılmamışsa tüm çağrılar sessizce boş döner.
export const isSupaConfigured = () => !!(SUPA_URL && SUPA_KEY);

const headers = () => ({
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
});

// Oyuncu adı: kalıcı, düzenlenebilir basit takma ad
export function getPlayerName() {
  let n = localStorage.getItem('playerName');
  if (!n) {
    n = 'Jokey' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('playerName', n);
  }
  return n;
}
export function getPlayerLocalId() {
  let id = localStorage.getItem('supaPlayerId');
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('supaPlayerId', id);
  }
  return id;
}

export async function submitScoreSupa(score, mapId) {
  if (!isSupaConfigured() || !score) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/scores`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        player_id: getPlayerLocalId(),
        player_name: getPlayerName(),
        score: Math.floor(score),
        map_id: mapId,
      }),
    });
  } catch (e) { /* offline — sorun değil */ }
}

function sinceFor(period) {
  const d = new Date();
  if (period === 'day')  { d.setHours(0, 0, 0, 0); return d; }
  if (period === 'week') { const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0,0,0,0); return d; }
  if (period === 'month'){ d.setDate(1); d.setHours(0,0,0,0); return d; }
  d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d; // year
}

// Dönemin en iyileri: üst kayıtları çekip oyuncu başına en yüksek skoru bırak
export async function fetchPeriodTop(period, limit = 10) {
  if (!isSupaConfigured()) return [];
  try {
    const since = sinceFor(period).toISOString();
    const url = `${SUPA_URL}/rest/v1/scores` +
      `?select=player_id,player_name,score` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      `&order=score.desc&limit=200`;
    const res = await fetch(url, { headers: headers() });
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    const best = new Map();
    for (const r of rows) {
      if (!best.has(r.player_id)) best.set(r.player_id, r); // zaten skor desc sıralı
    }
    return [...best.values()].slice(0, limit);
  } catch (e) { return []; }
}
