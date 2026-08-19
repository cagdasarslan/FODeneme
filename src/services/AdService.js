import { Capacitor } from '@capacitor/core';
import {
  AdMob, RewardAdPluginEvents, BannerAdPluginEvents,
  BannerAdSize, BannerAdPosition,
} from '@capacitor-community/admob';

// ── AdMob reklam kimlikleri ──────────────────────────────────────────────────
// Kendi AdMob birim kimliklerini buraya yapıştır. Aşağıdakiler Google'ın TEST
// kimlikleridir; gerçek kimlik girilene kadar reklamlar KAPALI kalır (test
// reklamlarını yayına göndermek AdMob politikasını ihlal eder). Ayrıca
// AndroidManifest.xml'deki AdMob App ID'yi de kendi uygulamanınkiyle değiştir.
const TEST_PREFIX = 'ca-app-pub-3940256099942544';
const REWARD_AD_ID = 'ca-app-pub-3920099901614778/4114106996';
const BANNER_AD_ID = 'ca-app-pub-3920099901614778/7670354416';

// Gerçek kimlik girilmediyse ilgili reklam türü devre dışı kalır — test
// reklamı asla yayınlanmaz (AdMob politikası ihlali olur). İki tür ayrı ayrı
// kontrol edilir ki biri hazırken diğeri beklemesin.
export const ADS_ENABLED = !REWARD_AD_ID.startsWith(TEST_PREFIX);
export const BANNER_ENABLED = !BANNER_AD_ID.startsWith(TEST_PREFIX);

const isNative = Capacitor.getPlatform() !== 'web';
let initialized = false;

async function ensureInit() {
  if (initialized || !isNative) return;
  try {
    await AdMob.initialize({});
    initialized = true;
  } catch (e) {
    console.warn('[AdService] init failed:', e);
  }
}

// Tek bir ödüllü reklam göster. Ödül kazanılırsa true, aksi halde false döner.
// Web/native olmayan ortamda (geliştirme) ~5sn bekleyip true döner (placeholder)
// ki reklam ekranı erken kapanmasın (3 reklam ≈ 15sn+ simülasyonda).
export async function showRewardedAd() {
  // Gerçek AdMob kimliği yoksa reklam gösterme (test reklamı yayınlama) —
  // ödülü doğrudan ver ki oyuncu bonus butonlarını yine de kullanabilsin.
  if (!isNative || !ADS_ENABLED) { await new Promise(r => setTimeout(r, 400)); return true; }
  await ensureInit();

  return new Promise((resolve) => {
    let rewarded = false;
    let settled = false;
    const listeners = [];
    const cleanup = () => { listeners.forEach(l => l?.remove?.()); };
    const finish = (val) => { if (settled) return; settled = true; cleanup(); resolve(val); };

    AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; }).then(l => listeners.push(l));
    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(rewarded)).then(l => listeners.push(l));
    AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)).then(l => listeners.push(l));

    (async () => {
      try {
        await AdMob.prepareRewardVideoAd({ adId: REWARD_AD_ID });
        await AdMob.showRewardVideoAd();
      } catch (e) {
        console.warn('[AdService] showRewardedAd failed:', e);
        finish(false);
      }
    })();
  });
}

// Gereken sayıda ödüllü reklamı SIRAYLA göster; hepsi bitmeden ödül verilmez.
// onProgress(cur, total) her reklam başlamadan önce çağrılır (ilerleme UI'si için).
export async function showRewardedAds(count, onProgress) {
  for (let i = 0; i < count; i++) {
    onProgress?.(i + 1, count);
    const ok = await showRewardedAd();
    if (!ok) return false; // biri iptal/başarısız olursa devam etme
  }
  return true;
}

// ── Banner reklam (yalnızca ana menüde) ───────────────────────────────────────
let bannerShown = false;
let sizeListener = null;

// Banner web görünümünün ÜZERİNE çizilir; arayüzün altı kapanmasın diye
// yüksekliğini CSS değişkenine yazıyoruz (#root bunu alt boşluk olarak kullanır).
function setBannerHeight(px) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--banner-h', `${px || 0}px`);
}

export async function showBanner() {
  if (!isNative || !BANNER_ENABLED || bannerShown) return;
  // "Reklamları Kaldır" satın alındıysa banner asla gösterilmez
  if (localStorage.getItem('adsRemoved') === '1') return;
  await ensureInit();
  try {
    if (!sizeListener) {
      sizeListener = await AdMob.addListener(
        BannerAdPluginEvents.SizeChanged,
        (info) => setBannerHeight(info?.height)
      );
    }
    // Uyarlanabilir banner yüksekliği ekran genişliğiyle büyüyor; tablette
    // ekranın çok yerini kaplıyor. Geniş ekranlarda sabit 320x50 kullan.
    const isWide = (typeof window !== 'undefined') && window.innerWidth >= 600;
    await AdMob.showBanner({
      adId: BANNER_AD_ID,
      adSize: isWide ? BannerAdSize.BANNER : BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
    bannerShown = true;
  } catch (e) {
    console.warn('[AdService] showBanner failed:', e);
  }
}

export async function hideBanner() {
  if (!isNative || !bannerShown) return;
  try {
    await AdMob.removeBanner();
    bannerShown = false;
    setBannerHeight(0);
  } catch (e) {
    console.warn('[AdService] hideBanner failed:', e);
  }
}
