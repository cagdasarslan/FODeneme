// Gerçek para ile havuç paketleri (Google Play yönetilen/tüketilebilir ürünler)
// productId'ler Play Console'da BİREBİR aynı olmalı (consumable olarak oluşturun).
// price alanı yalnızca yedek/gösterim içindir; mağaza açıldığında Play'in
// yerelleştirilmiş gerçek fiyatı varsa onun yerine geçer.
export const CARROT_PACKAGES = [
  { id: 'carrots_1000',   carrots: 1000,   price: '₺14,99'  },
  { id: 'carrots_2500',   carrots: 2500,   price: '₺34,99'  },
  { id: 'carrots_5000',   carrots: 5000,   price: '₺59,99'  },
  { id: 'carrots_10000',  carrots: 10000,  price: '₺99',    badge: 'POPÜLER' },
  { id: 'carrots_20000',  carrots: 20000,  price: '₺189'    },
  { id: 'carrots_30000',  carrots: 30000,  price: '₺270',   badge: 'AVANTAJLI' },
  { id: 'carrots_50000',  carrots: 50000,  price: '₺429'    },
  { id: 'carrots_75000',  carrots: 75000,  price: '₺599'    },
  { id: 'carrots_100000', carrots: 100000, price: '₺749'    },
  { id: 'carrots_250000', carrots: 250000, price: '₺1.699', badge: 'EN İYİ DEĞER' },
];
