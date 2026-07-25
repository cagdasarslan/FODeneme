import { Capacitor } from '@capacitor/core';
import { SUPA_URL, SUPA_KEY } from '@/constants/supabase';
import { isSupaConfigured } from '@/services/SupaLeaderboard';

/*
  GOOGLE / APPLE GİRİŞİ — Supabase Auth (OAuth, implicit flow).
  Giriş yapan oyuncunun bulut kaydı Google/Apple hesabına bağlanır: oyunu
  silip yeniden kuran oyuncu tek dokunuşla her şeyini geri alır (kod gerekmez).

  ── Supabase panelinde bir kez yapılandır: ──────────────────────────────────
  1) Authentication → Providers → Google: AÇ
     - Google Cloud Console'da OAuth Client (Web) oluştur,
       Authorized redirect URI: https://vdyjyuqdzkpsixnopndx.supabase.co/auth/v1/callback
     - Client ID + Secret'ı Supabase'e yapıştır.
  2) Authentication → Providers → Apple: AÇ (App Store'a çıkarken;
     Apple Developer'dan Services ID + Key ister)
  3) Authentication → URL Configuration → Redirect URLs'e ekle:
     horserunner://auth   (Android/iOS uygulaması için)
  ────────────────────────────────────────────────────────────────────────────
*/

const isNative = Capacitor.getPlatform() !== 'web';
const REDIRECT = isNative ? 'horserunner://auth' : (typeof window !== 'undefined' ? window.location.origin : '');

const SESSION_KEY = 'supaAuth_v1'; // {access_token, refresh_token, expires_at, user:{id,email,name}}

const anonHeaders = () => ({ apikey: SUPA_KEY, 'Content-Type': 'application/json' });

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'); } catch (e) { return null; }
}
function saveSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export function getAuthUser() {
  return loadSession()?.user ?? null;
}

// ── Giriş başlat: sistem tarayıcısında Supabase OAuth sayfası ────────────────
export async function signInWith(provider /* 'google' | 'apple' */) {
  if (!isSupaConfigured()) return false;
  const url = `${SUPA_URL}/auth/v1/authorize?provider=${provider}` +
    `&redirect_to=${encodeURIComponent(REDIRECT)}`;
  if (isNative) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, windowName: '_system' });
  } else {
    window.location.href = url;
  }
  return true; // sonuç appUrlOpen / sayfa dönüşünde yakalanır
}

// ── Dönen URL'deki tokenları işle (#access_token=...&refresh_token=...) ──────
async function handleAuthCallback(rawUrl, onSignedIn) {
  const hash = rawUrl.split('#')[1];
  if (!hash) return false;
  const p = new URLSearchParams(hash);
  const access = p.get('access_token');
  const refresh = p.get('refresh_token');
  if (!access) return false;
  const user = await fetchUser(access);
  if (!user) return false;
  saveSession({
    access_token: access,
    refresh_token: refresh,
    expires_at: Date.now() + (parseInt(p.get('expires_in') ?? '3600', 10) - 60) * 1000,
    user,
  });
  await onSignedIn?.(user);
  return true;
}

async function fetchUser(accessToken) {
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return {
      id: u.id,
      email: u.email ?? '',
      name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? '',
      provider: u.app_metadata?.provider ?? '',
    };
  } catch (e) { return null; }
}

// Oturumu tazele (refresh token ile) — açılışta çağrılır
export async function refreshSessionIfNeeded() {
  const s = loadSession();
  if (!s?.refresh_token) return null;
  if (s.expires_at && Date.now() < s.expires_at) return s.user;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: anonHeaders(),
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!res.ok) { saveSession(null); return null; }
    const d = await res.json();
    saveSession({
      access_token: d.access_token,
      refresh_token: d.refresh_token ?? s.refresh_token,
      expires_at: Date.now() + ((d.expires_in ?? 3600) - 60) * 1000,
      user: s.user,
    });
    return s.user;
  } catch (e) { return s.user; } // çevrimdışı: eldeki kullanıcıyla devam
}

export function signOut() {
  saveSession(null);
}

// ── Başlatma: deep link dinleyicisi + web'de hash yakalama ───────────────────
// onSignedIn(user): giriş tamamlanınca çağrılır (bulut kaydı bağlama vs.)
let _inited = false;
export async function initAuth(onSignedIn) {
  if (_inited || !isSupaConfigured()) return;
  _inited = true;

  if (isNative) {
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith('horserunner://auth')) return;
      try {
        const { Browser } = await import('@capacitor/browser');
        Browser.close().catch(() => {});
      } catch (e) { /* tarayıcı zaten kapalı */ }
      await handleAuthCallback(url, onSignedIn);
    });
  } else if (window.location.hash.includes('access_token=')) {
    // Web dönüşü: hash'i işle ve URL'i temizle
    const ok = await handleAuthCallback(window.location.href, onSignedIn);
    if (ok) window.history.replaceState(null, '', window.location.pathname);
  }
}
