import { Capacitor } from '@capacitor/core';
import { CARROT_PACKAGES, REMOVE_ADS_ID, REMOVE_ADS_PRICE } from '@/constants/iap';

// Google Play Billing entegrasyonu (cordova-plugin-purchase / CdvPurchase v13).
// Eklenti native tarafta window.CdvPurchase olarak yüklenir; bundler'a bağımlı
// olmamak için doğrudan window üzerinden erişiyoruz. Web/geliştirmede eklenti
// yoksa satın alma simüle edilir (UI test edilebilsin diye).

const isNative = Capacitor.getPlatform() !== 'web';
let initialized = false;
let onGrant = null;            // (productId, carrots) => void  — havuç ekleme callback'i
let onRemoveAds = null;        // () => void — reklamsız satın alımı işlendiğinde
const livePrices = {};         // productId -> Play'in gerçek fiyatı

function CDV() { return (typeof window !== 'undefined') ? window.CdvPurchase : undefined; }

// Satın alma onaylanınca havuçları ekleyecek callback'i kaydet
export function setGrantHandler(fn) { onGrant = fn; }
export function setRemoveAdsHandler(fn) { onRemoveAds = fn; }

export function getDisplayPrice(pkg) {
  return livePrices[pkg.id] || pkg.price;
}
export function getRemoveAdsPrice() {
  return livePrices[REMOVE_ADS_ID] || REMOVE_ADS_PRICE;
}

export async function initBilling() {
  if (initialized || !isNative) return;
  const cdv = CDV();
  if (!cdv) return;
  try {
    const { store, ProductType, Platform } = cdv;
    store.register([
      ...CARROT_PACKAGES.map(p => ({
        id: p.id,
        type: ProductType.CONSUMABLE,
        platform: Platform.GOOGLE_PLAY,
      })),
      // Reklamsız: kalıcı (non-consumable) ürün
      { id: REMOVE_ADS_ID, type: ProductType.NON_CONSUMABLE, platform: Platform.GOOGLE_PLAY },
    ]);

    // Onaylanan siparişleri işle → havuç ekle / reklamsızı etkinleştir
    store.when()
      .approved(tx => tx.verify())
      .verified(receipt => {
        receipt.finish();
        const items = receipt.collection || [];
        items.forEach(item => {
          if (item.id === REMOVE_ADS_ID) { onRemoveAds && onRemoveAds(); return; }
          const pkg = CARROT_PACKAGES.find(p => p.id === item.id);
          if (pkg && onGrant) onGrant(pkg.id, pkg.carrots);
        });
      });

    await store.initialize([Platform.GOOGLE_PLAY]);

    // Yerelleştirilmiş fiyatları sakla
    [...CARROT_PACKAGES, { id: REMOVE_ADS_ID }].forEach(p => {
      const prod = store.get(p.id, Platform.GOOGLE_PLAY);
      const offer = prod && prod.pricing;
      if (offer && offer.price) livePrices[p.id] = offer.price;
    });

    // RESTORE: daha önce reklamsız satın alınmışsa (cihaz değişimi vb.) geri yükle
    const ra = store.get(REMOVE_ADS_ID, Platform.GOOGLE_PLAY);
    if (ra && ra.owned && onRemoveAds) onRemoveAds();

    initialized = true;
  } catch (e) {
    console.warn('[Billing] init failed:', e);
  }
}

// Bir paketi satın al. Başarılıysa { ok:true }. Web/dev'de simülasyon.
export async function purchase(productId) {
  const isRemoveAds = productId === REMOVE_ADS_ID;
  const pkg = CARROT_PACKAGES.find(p => p.id === productId);
  if (!pkg && !isRemoveAds) return { ok: false, reason: 'Ürün bulunamadı' };

  // Web / geliştirme: gerçek SDK yok → simüle et
  if (!isNative || !CDV()) {
    if (isRemoveAds) { onRemoveAds && onRemoveAds(); }
    else if (onGrant) onGrant(pkg.id, pkg.carrots);
    return { ok: true, simulated: true };
  }

  try {
    await initBilling();
    const { store, Platform } = CDV();
    const product = store.get(productId, Platform.GOOGLE_PLAY);
    const offer = product && product.getOffer();
    if (!offer) return { ok: false, reason: 'Ürün hazır değil' };
    await store.order(offer);
    // Havuçlar approved/verified akışında eklenir; burada sadece tetikledik.
    return { ok: true };
  } catch (e) {
    console.warn('[Billing] purchase failed:', e);
    return { ok: false, reason: 'Satın alma iptal edildi' };
  }
}
