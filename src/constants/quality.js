// ── Görüntü kalitesi ön ayarları (DÜŞÜK / ORTA / YÜKSEK) ─────────────────────
// Mobil performansı korumak için her katman net sınırlarla tanımlı. Cihaz üst
// sınırları (MAX_DPR, IS_MOBILE) App'te bunların ÜZERİNE uygulanır.
export const QUALITY_TIERS = ['low', 'medium', 'high'];

export const QUALITY = {
  low: {
    label: 'DÜŞÜK',
    shadows: false,   // gölge haritası kapalı (en büyük GPU yükü)
    dpr: 1,           // pixel-ratio 1 (net değil ama akıcı)
    antialias: false,
    bloom: false,     // post-process yok
    emissive: 0.25,   // toplanabilirlerin öz-parlaması (ucuz)
    particleScale: 0.4, // toz/parçacık yoğunluğu
  },
  medium: {
    label: 'ORTA',
    shadows: true,
    dpr: 1.5,
    antialias: false,
    bloom: false,
    emissive: 0.45,
    particleScale: 0.75,
  },
  high: {
    label: 'YÜKSEK',
    shadows: true,
    dpr: 2,
    antialias: true,  // yalnız masaüstünde (App'te IS_MOBILE ile kısılır)
    bloom: true,      // hafif bloom (yalnız yüksek)
    emissive: 0.6,
    particleScale: 1.0,
  },
};

export const getQuality = (g) => QUALITY[g] ?? QUALITY.high;
