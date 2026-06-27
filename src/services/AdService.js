import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

// ⚠️ TEST kimlikleri (Google örnek). Yayına almadan önce kendi AdMob ödüllü
// reklam birim kimliğinizle değiştirin; ayrıca AndroidManifest.xml içindeki
// AdMob App ID'yi de kendi uygulamanızınkiyle güncelleyin.
const REWARD_AD_ID = 'ca-app-pub-3940256099942544/5224354917';

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
// Web/native olmayan ortamda (geliştirme) anında true döner (placeholder).
export async function showRewardedAd() {
  if (!isNative) return true;
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

// Gereken sayıda ödüllü reklamı sırayla göster; hepsi ödüllendirilirse true.
export async function showRewardedAds(count) {
  for (let i = 0; i < count; i++) {
    const ok = await showRewardedAd();
    if (!ok) return false; // biri iptal/başarısız olursa devam etme
  }
  return true;
}
