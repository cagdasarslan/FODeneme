// Basit mobil/cihaz tespiti — render maliyetini düşürmek için kullanılır.
export const IS_MOBILE = typeof navigator !== 'undefined'
  && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

// Gölge haritası çözünürlüğü (mobilde daha küçük → daha hızlı)
export const SHADOW_MAP = IS_MOBILE ? 1024 : 2048;

// Maksimum piksel oranı (retina ekranlarda 2x = 4 kat piksel; mobilde sınırla)
export const MAX_DPR = IS_MOBILE ? 1.3 : 2;
