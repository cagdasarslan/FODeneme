import { Capacitor } from '@capacitor/core';
import {
  AdMob, RewardAdPluginEvents,
  BannerAdSize, BannerAdPosition,
} from '@capacitor-community/admob';

// ⚠️ TEST kimlikleri (Google örnek). Yayına almadan önce kendi AdMob
// reklam birim kimliklerinizle değiştirin; ayrıca AndroidManifest.xml
// içindeki AdMob App ID'yi de kendi uygulamanızınkiyle güncelleyin.
const REWARD_AD_ID = 'ca-app-pub-3940256099942544/5224354917';
const BANNER_AD_ID = 'ca-app-pub-3940256099942544/6300978111';

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
  if (!isNative) { await new Promise(r => setTimeout(r, 5000)); return true; }
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

export async function showBanner() {
  if (!isNative || bannerShown) return;
  await ensureInit();
  try {
    await AdMob.showBanner({
      adId: BANNER_AD_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
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
  } catch (e) {
    console.warn('[AdService] hideBanner failed:', e);
  }
}
