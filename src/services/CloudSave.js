import { SUPA_URL, SUPA_KEY } from '@/constants/supabase';
import { isSupaConfigured, getPlayerLocalId, getPlayerName } from '@/services/SupaLeaderboard';
import { getAuthUser } from '@/services/AuthService';

/*
  BULUT KAYDI — tüm kalıcı oyuncu verisi Supabase'te 'profiles' tablosunda tutulur.
  Oyunu silip yeniden yükleyen oyuncu, Ayarlar'daki KURTARMA KODU ile tüm
  ilerlemesini geri alır (kod = oyuncunun gizli kimliği, tahmin edilemez).

  ── Supabase SQL Editor'da bir kez çalıştır: ────────────────────────────────
  create table if not exists profiles (
    id text primary key,
    name text,
    data jsonb not null,
    updated_at timestamptz not null default now()
  );
  alter table profiles enable row level security;
  create policy "anon upsert" on profiles for insert to anon with check (true);
  create policy "anon update" on profiles for update to anon using (true);
  create policy "anon select" on profiles for select to anon using (true);
  ────────────────────────────────────────────────────────────────────────────
*/

// Buluta yedeklenen kalıcı anahtarlar (günlük/ephemeral anahtarlar bilinçli dışarıda)
const SAVE_KEYS = [
  'carrots', 'playerName', 'nameSet', 'supaPlayerId', 'tut_done',
  'selectedHorseId', 'ownedHorseIds', 'horseLevels', 'horseUpgrades',
  'selectedCharId', 'ownedCharIds', 'powerupLevels', 'customHorses',
  'hs_map1', 'hs_map2', 'hs_map3', 'hs_map4', 'hs_map5', 'hs_map6',
  'totalScore', 'adsRemoved', 'daily_v1', 'life_v1', 'achClaimed', 'medals_v1', 'onboard_v1',
  'foals', 'stableSlots', 'lastBreedAt', 'trainingXP', 'paddockObstacles', 'freeUpgradeDate',
  'mapId', 'soundOn', 'musicOn',
];

const headers = () => ({
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates',
});

function collectSave() {
  const data = {};
  for (const k of SAVE_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;
  }
  return data;
}

// Yedek hangi kimlikle tutulur: Google/Apple girişi varsa hesaba bağlı
// ('u_<uid>'), yoksa cihazın yerel kimliği (kurtarma kodu)
function getSaveId() {
  const u = getAuthUser();
  return u ? 'u_' + u.id : getPlayerLocalId();
}

// Kullanıcıya gösterilen kod: p_ öneki olmadan, büyük harf (girişte normalize edilir)
export function getRecoveryCode() {
  return getPlayerLocalId().replace(/^p_/, '').toUpperCase();
}
function codeToId(code) {
  const c = code.trim().toLowerCase().replace(/^p_/, '');
  return 'p_' + c;
}

// ── Yükleme (push) — debounce'lu, sessizce başarısız olur ────────────────────
let _pushTimer = null;
let _lastPushed = '';

export function scheduleCloudSave(delayMs = 4000) {
  if (!isSupaConfigured()) return;
  if (_pushTimer) return;
  _pushTimer = setTimeout(() => { _pushTimer = null; pushCloudSave(); }, delayMs);
}

export async function pushCloudSave() {
  if (!isSupaConfigured()) return false;
  try {
    const data = collectSave();
    const body = JSON.stringify(data);
    if (body === _lastPushed) return true; // değişiklik yok
    const res = await fetch(`${SUPA_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        id: getSaveId(),
        name: getPlayerName(),
        data,
        updated_at: new Date().toISOString(),
      }),
    });
    if (res.ok) { _lastPushed = body; return true; }
    return false;
  } catch (e) { return false; } // çevrimdışı — sonraki denemede
}

// ── Geri yükleme (pull) — kurtarma koduyla ───────────────────────────────────
export async function restoreFromCloud(code) {
  if (!isSupaConfigured()) return { ok: false, reason: 'Bulut kaydı yapılandırılmamış' };
  try {
    const id = codeToId(code);
    const res = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=data,updated_at`,
      { headers: headers() }
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, reason: 'Bu koda ait kayıt bulunamadı' };
    }
    const data = rows[0].data ?? {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') localStorage.setItem(k, v);
    }
    // Kimliği geri yüklenen hesaba bağla (liderlik geçmişi de korunur)
    localStorage.setItem('supaPlayerId', id);
    localStorage.setItem('nameSet', '1');
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'Bağlantı hatası — internetini kontrol et' };
  }
}

// ── Google/Apple girişi tamamlanınca çağrılır ────────────────────────────────
// Hesapta yedek VARSA indir (yeniden kurulum senaryosu), YOKSA mevcut
// ilerlemeyi hesaba bağlayarak yükle (ilk giriş senaryosu).
export async function linkCloudToAccount(user) {
  try {
    const id = 'u_' + user.id;
    const res = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=data`,
      { headers: headers() }
    );
    const rows = await res.json();
    const remote = Array.isArray(rows) && rows[0]?.data;
    const localHasProgress = !!localStorage.getItem('nameSet');
    if (remote && Object.keys(remote).length > 0 && !localHasProgress) {
      // Temiz kurulum + hesapta yedek var → indir
      for (const [k, v] of Object.entries(remote)) {
        if (typeof v === 'string') localStorage.setItem(k, v);
      }
      localStorage.setItem('nameSet', '1');
      window.location.reload();
      return 'restored';
    }
    // Mevcut ilerlemeyi hesaba yaz (hesapta yedek yoksa ya da yerel daha güncelse
    // yerel kazanır — oyuncu aktif cihazında oynuyordur)
    _lastPushed = '';
    await pushCloudSave();
    return 'linked';
  } catch (e) { return 'error'; }
}

// ── Otomatik yedekleme kancaları ─────────────────────────────────────────────
// App başlangıcında bir kez çağrılır: periyodik + arka plana geçişte yedekle
let _inited = false;
export function initCloudSave() {
  if (_inited || !isSupaConfigured()) return;
  _inited = true;
  setInterval(() => scheduleCloudSave(0), 90_000); // 90 sn'de bir (değişiklik varsa)
  const onHide = () => {
    if (document.visibilityState === 'hidden') pushCloudSave();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => pushCloudSave());
  // Açılışta ilk yedek (kayıt yoksa oluşur)
  scheduleCloudSave(6000);
}
