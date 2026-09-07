import { Capacitor } from '@capacitor/core';

// iOS'ta env(safe-area-inset-*) Capacitor WebView'ında bazen 0 döner; o zaman
// arayüz durum çubuğunun/çentiğin altında kalır. Bu yüzden iOS'ta bir taban
// değer garanti ediyoruz: env() daha büyükse (çentikli modeller) o kazanır.
//
// Android tam ekran (immersive) çalıştığı için taban değere gerek yok.
const isIOS = Capacitor.getPlatform() === 'ios';

export const SAFE_TOP = isIOS
  ? 'max(env(safe-area-inset-top, 0px), 44px)'
  : 'env(safe-area-inset-top, 0px)';

export const SAFE_BOTTOM = isIOS
  ? 'max(env(safe-area-inset-bottom, 0px), 20px)'
  : 'env(safe-area-inset-bottom, 0px)';

// "calc(8px + <üst güvenli alan>)" gibi ifadeler için yardımcı
export const topPlus = (px) => `calc(${px}px + ${SAFE_TOP})`;
export const bottomPlus = (px) => `calc(${px}px + ${SAFE_BOTTOM})`;

// AdMob banner web görünümünün üzerine çizilir. Yüksekliğini AdService
// --banner-h değişkenine yazar; tam ekran katmanlar bu kadar alt boşluk
// bırakmalı ki içerik reklamın arkasında kalmasın.
const isNative = Capacitor.getPlatform() !== 'web';
export const BOTTOM_SPACE = isNative
  ? `calc(var(--banner-h, 0px) + ${SAFE_BOTTOM})`
  : '0px';
