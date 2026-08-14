// Gerçek para ile havuç paketleri (Google Play yönetilen/tüketilebilir ürünler)
// productId'ler Play Console'da BİREBİR aynı olmalı (consumable olarak oluşturun).
// price alanı yalnızca yedek/gösterim içindir; mağaza açıldığında Play'in
// yerelleştirilmiş gerçek fiyatı varsa onun yerine geçer.
// Tek seferlik "Reklamları Kaldır" (NON-CONSUMABLE) — banner tamamen kapanır;
// ödüllü reklamlar isteğe bağlı oldukları için kalır.
export const REMOVE_ADS_ID    = 'remove_ads';
export const REMOVE_ADS_PRICE = '₺59,99';

export const CARROT_PACKAGES = [
  { id: 'carrots_1000',   carrots: 1000,   price: '₺5,39'   },
  { id: 'carrots_2500',   carrots: 2500,   price: '₺11,99'   },
  { id: 'carrots_5000',   carrots: 5000,   price: '₺21,99'   },
  { id: 'carrots_10000',  carrots: 10000,  price: '₺39,99',   badge: 'POPÜLER' },
  { id: 'carrots_20000',  carrots: 20000,  price: '₺74,99'  },
  { id: 'carrots_30000',  carrots: 30000,  price: '₺104,99',  badge: 'AVANTAJLI' },
  { id: 'carrots_50000',  carrots: 50000,  price: '₺159,99'  },
  { id: 'carrots_75000',  carrots: 75000,  price: '₺219,99'  },
  { id: 'carrots_100000', carrots: 100000, price: '₺279,99'  },
  { id: 'carrots_250000', carrots: 250000, price: '₺629,99', badge: 'EN İYİ DEĞER' },
];
