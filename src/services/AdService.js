import { Capacitor } from '@capacitor/core';
import {
  AdMob, RewardAdPluginEvents, BannerAdPluginEvents,
  BannerAdSize, BannerAdPosition,
} from '@capacitor-community/admob';

// ── AdMob reklam kimlikleri ──────────────────────────────────────────────────
// Kimlikler platforma özeldir: Android birimleri iOS'ta çalışmaz, tersi de.
// Uygulama kimlikleri (App ID) kodda değil, platform dosyalarında durur:
//   Android → AndroidManifest.xml, com.google.android.gms.ads.APPLICATION_ID
//   iOS     → ios/App/App/Info.plist, GADApplicationIdentifier
// iOS'ta bu anahtar yoksa Google SDK'sı uygulamayı bilerek çökertir.
const TEST_PREFIX = 'ca-app-pub-3940256099942544';

const AD_IDS = {
  android: {
    reward: 'ca-app-pub-3920099901614778/4114106996',
    banner: 'ca-app-pub-3920099901614778/7670354416',
  },
  ios: {
    reward: 'ca-app-pub-3920099901614778/1435142184',
    banner: 'ca-app-pub-3920099901614778/7808978847',
  },
};

const ids = AD_IDS[Capacitor.getPlatform()] ?? { reward: '', banner: '' };
const REWARD_AD_ID = ids.reward;
const BANNER_AD_ID = ids.banner;

// Gerçek kimlik girilmediyse ilgili reklam türü devre dışı kalır — test
// reklamı asla yayınlanmaz (AdMob politikası ihlali olur). İki tür ayrı ayrı
// kontrol edilir ki biri hazırken diğeri beklemesin.
const isReal = (id) => !!id && !id.startsWith(TEST_PREFIX);
export const ADS_ENABLED = isReal(REWARD_AD_ID);
export const BANNER_ENABLED = isReal(BANNER_AD_ID);

const isNative = Capacitor.getPlatform() !== 'web';
const IS_DEV = !!import.meta.env?.DEV;

// Ödüllü reklam bu cihazda gerçekten gösterilebilir mi? Web'de yalnızca
// geliştirme modunda simüle edilir; yayındaki sürümde reklam yoksa butonlar
// gizlenir — reklam izlemeden ödül vermek AdMob politikası ihlalidir.
export const REWARDED_AVAILABLE = (isNative && ADS_ENABLED) || (!isNative && IS_DEV);

let initPromise = null;

// AB/EEA kullanıcıları için Google UMP onay formu reklamlardan ÖNCE sorulmalı
// (Google EU User Consent Policy). Onay gerekmiyorsa form hiç açılmaz.
async function requestConsent() {
  try {
    const info = await AdMob.requestConsentInfo();
    if (info?.isConsentFormAvailable && info.status === 'REQUIRED') {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    console.warn('[AdService] consent failed:', e);
  }
}

function ensureInit() {
  if (!isNative) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      await requestConsent();
      try {
        // Aile dostu bir oyun: yetişkin içerikli reklamları kapat
        await AdMob.initialize({ maxAdContentRating: 'ParentalGuidance' });
      } catch (e) {
        console.warn('[AdService] init failed:', e);
        initPromise = null; // bir sonraki denemede tekrar dene
      }
    })();
  }
  return initPromise;
}

// Uygulama açılışında çağrılır: onay formu oyuncu bir reklama basmadan önce
// sorulmuş olur (reklam anında form açılması kötü deneyim).
export function initAds() {
  if (isNative && (ADS_ENABLED || BANNER_ENABLED)) ensureInit();
}

const AD_TIMEOUT_MS = 90_000;     // hiç olay gelmezse oyuncu kilitlenmesin
const REWARD_GRACE_MS = 1500;     // iOS'ta ödül olayı kapanıştan SONRA gelebiliyor

// Tek bir ödüllü reklam göster. Ödül kazanılırsa true, aksi halde false döner.
export async function showRewardedAd() {
  if (!REWARDED_AVAILABLE) return false;
  if (!isNative) { await new Promise(r => setTimeout(r, 600)); return true; } // geliştirme simülasyonu
  await ensureInit();

  return new Promise(async (resolve) => {
    let rewarded = false;
    let dismissed = false;
    let settled = false;
    const handles = [];
    let graceTimer = null;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      clearTimeout(graceTimer);
      clearTimeout(timeout);
      handles.forEach(h => { try { h.remove(); } catch (e) {} });
      resolve(val);
    };
    const timeout = setTimeout(() => finish(rewarded), AD_TIMEOUT_MS);

    const onReward = () => { rewarded = true; if (dismissed) finish(true); };

    try {
      // Dinleyicileri reklam gösterilmeden ÖNCE kesin olarak kaydet; aksi halde
      // erken gelen olaylar kaçıyor ve geç eklenen dinleyiciler hiç kaldırılmıyordu.
      handles.push(...await Promise.all([
        AdMob.addListener(RewardAdPluginEvents.Rewarded, onReward),
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          dismissed = true;
          if (rewarded) finish(true);
          // Ödül olayı kapanıştan sonra gelirse kaybetme: kısa süre bekle
          else graceTimer = setTimeout(() => finish(rewarded), REWARD_GRACE_MS);
        }),
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)),
        AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => finish(false)),
      ]));
      if (settled) { handles.forEach(h => { try { h.remove(); } catch (e) {} }); return; }

      await AdMob.prepareRewardVideoAd({ adId: REWARD_AD_ID });
      // showRewardVideoAd ödül kazanıldığında ödül nesnesiyle çözülür — olaylara
      // ek bir güvence olarak bunu da ödül sayıyoruz.
      const item = await AdMob.showRewardVideoAd();
      if (item && (item.amount != null || item.type)) onReward();
    } catch (e) {
      console.warn('[AdService] showRewardedAd failed:', e);
      finish(rewarded);
    }
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
// Banner alanı reklam yüklenmese/gizlense bile HER ZAMAN ayrılır: arayüz
// reklam gelince zıplamasın, alt butonlar banner'ın altında kalmasın.
// "Reklamları Kaldır" satın alındıysa alan kapatılır.
export const BANNER_RESERVE_PX = 60;
function setBannerHeight(px) {
  if (typeof document === 'undefined') return;
  let adsRemoved = false;
  try { adsRemoved = localStorage.getItem('adsRemoved') === '1'; } catch { /* yok */ }
  const h = adsRemoved ? 0 : Math.max(px || 0, BANNER_RESERVE_PX);
  document.documentElement.style.setProperty('--banner-h', `${h}px`);
}
// Açılışta alanı hemen ayır
setBannerHeight(0);
export function refreshBannerReserve() { setBannerHeight(bannerShown ? null : 0); }

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
