# App Store Yayın Rehberi — Horse Runner (iOS)

Bundle ID: `com.cagdasarslan.horserunner`
Play Store karşılığı: `docs/PLAY_STORE.md`

Ön koşul: **Apple Developer Program** üyeliği (yıllık 99 USD). Ücretsiz Apple ID
ile App Store'a yükleme yapılamaz.

---

## 1. Bundle ID kaydı (developer.apple.com)

Certificates, Identifiers & Profiles → Identifiers → **+**

- Tür: **App IDs** → **App**
- **Description:** `Horse Runner` (yalnızca sizin listenizde görünür, Türkçe karakter kabul etmez)
- **Bundle ID:** **Explicit** seçin, `com.cagdasarslan.horserunner`
- **Capabilities:** hiçbirini işaretlemeyin
  - In-App Purchase ve GameKit zaten varsayılan açık
  - Push Notifications gerekmez (yalnızca yerel bildirim kullanılıyor)
  - Sign in with Apple gerekmez (giriş tarayıcı OAuth ile yapılıyor)
  - Associated Domains gerekmez (`horserunner://` özel şeması kullanılıyor)

Bundle ID sonradan **değiştirilemez ve tekrar kullanılamaz**. İki kez kontrol edin.

---

## 2. Sözleşmeler, vergi ve banka (App Store Connect)

Bu adım atlanırsa satın alma ürünleri "Missing Metadata" durumunda kalır ve
uygulama reddedilir. Ücretli ürün satacağınız için zorunludur.

appstoreconnect.apple.com → **Business** (eski adıyla Agreements, Tax, and Banking)

1. **Paid Apps** sözleşmesini kabul edin
2. **Bank Account** — kendi adınıza IBAN
3. **Tax Forms** — Türkiye için genelde W-8BEN formu (ABD dışı birey)
4. **Contact Info** — fatura, teknik ve yasal iletişim kişileri

Onay birkaç saat ile birkaç gün sürebilir. Diğer adımlarla paralel ilerleyin.

---

## 3. Uygulama kaydı (App Store Connect)

**Apps** → **+** → **New App**

| Alan | Değer |
|---|---|
| Platforms | iOS |
| Name | `Horse Runner: Endless Ride` (max 30 karakter, App Store'da görünen ad) |
| Primary Language | English (U.S.) — Türkçe'yi sonra yerelleştirme olarak eklersiniz |
| Bundle ID | Listeden `com.cagdasarslan.horserunner` |
| SKU | `horserunner-ios` (kendi iç referansınız, kullanıcıya görünmez) |
| User Access | Full Access |

Ad benzersiz olmalı — App Store'da aynı isimde başka uygulama varsa kabul edilmez.

---

## 4. Satın alma ürünleri

Play'deki ürünler iOS'a geçmez, 11 ürünü baştan tanımlayacaksınız. Ürün
kimliklerini **aynı tutun**, kod her iki platformda da aynı kimlikleri kullanıyor.

**Monetization** → **In-App Purchases** → **+**

Havuç paketleri için tür: **Consumable**
`remove_ads` için tür: **Non-Consumable**

Her ürün için:

| Alan | Açıklama |
|---|---|
| Reference Name | Sizin listenizde görünen ad, örn. `1000 Carrots` |
| Product ID | `carrots_1000` — kodla birebir aynı |
| Price | Apple'ın fiyat basamaklarından en yakınını seçin |
| Display Name | Kullanıcının gördüğü ad, örn. `1,000 Carrots` |
| Description | Kısa açıklama, örn. `Starter pack of 1,000 carrots.` |
| Review Screenshot | Mağaza ekranının görüntüsü (zorunlu) |

### Ürün listesi

| Product ID | Tür | Display Name | Play fiyatı (referans) |
|---|---|---|---|
| `carrots_1000` | Consumable | 1,000 Carrots | 5,39 TL |
| `carrots_2500` | Consumable | 2,500 Carrots | 11,99 TL |
| `carrots_5000` | Consumable | 5,000 Carrots | 21,99 TL |
| `carrots_10000` | Consumable | 10,000 Carrots | 39,99 TL |
| `carrots_20000` | Consumable | 20,000 Carrots | 74,99 TL |
| `carrots_30000` | Consumable | 30,000 Carrots | 104,99 TL |
| `carrots_50000` | Consumable | 50,000 Carrots | 159,99 TL |
| `carrots_75000` | Consumable | 75,000 Carrots | 219,99 TL |
| `carrots_100000` | Consumable | 100,000 Carrots | 279,99 TL |
| `carrots_250000` | Consumable | 250,000 Carrots | 629,99 TL |
| `remove_ads` | Non-Consumable | Remove Ads | 59,99 TL |

Apple fiyat basamakları Play'inkilerle birebir örtüşmez; en yakın basamağı
seçmek yeterli. Apple'ın asgari fiyatı Play'inkinden yüksek olabilir.

**Review Screenshot** her ürün için ayrı ayrı isteniyor ama aynı görsel
(oyunun mağaza ekranı) hepsinde kullanılabilir.

---

## 5. Mağaza sayfası

Uygulama kaydının içinde, sol menüde **iOS App → 1.0 Prepare for Submission**.

### Metinler

**Promotional Text** (170 karakter, sürüm göndermeden değiştirilebilir)
```
New: English and Turkish support, six worlds to unlock and your own stable of champion horses.
```

**Description** — `docs/` içindeki İngilizce mağaza metnini kullanabilirsiniz
(Play için yazılan uzun açıklama App Store'da da geçerli).

**Keywords** (100 karakter, virgülle ayrılmış, boşluk kullanmayın)
```
horse,runner,endless,racing,jump,pony,stable,breeding,arcade,run
```

**Support URL** (zorunlu)
```
https://cagdasarslan.github.io/HorseRunner/privacy-policy.html
```

**Marketing URL** (isteğe bağlı) — boş bırakılabilir

### Ekran görüntüleri

Apple, Google'dan katı. Zorunlu boyutlar:

- **6.7"** (iPhone 15/16 Pro Max) — 1290 × 2796 px
- **6.5"** (iPhone 11 Pro Max) — 1242 × 2688 px

En az 3, en fazla 10 görsel. Simülatörde doğru cihaz modelini seçip **⌘S** ile
ekran görüntüsü alabilirsiniz — boyutlar otomatik doğru olur.

Görsellerde durum çubuğu görünmesi sorun değil, ama çerçeve/mockup eklerseniz
gerçek cihaz görüntüsüyle uyumlu olmalı.

### App Privacy

**App Privacy** bölümü, Play'deki Veri Güvenliği formunun karşılığı. Aynı
cevapları verin:

- Toplanan veri: **Identifiers** (reklam kimliği), **Usage Data** (oyun içi
  etkileşim), **User Content** (oyuncu adı)
- Reklam kimliği: **Third-Party Advertising** amacıyla kullanılıyor (AdMob)
- Kullanıcıya bağlı mı: oyuncu adı ve ilerleme hesaba bağlı → **Yes**
- İzleme (Tracking): AdMob kişiselleştirilmiş reklam gösteriyorsa **Yes**

Privacy Policy URL:
```
https://cagdasarslan.github.io/HorseRunner/privacy-policy.html
```

### Yaş derecelendirmesi

**Age Rating** → anket. Oyun için tüm sorulara **None** demek yeterli; reklam
içerdiği için "Unrestricted Web Access" sorusuna **No** deyin (oyun tarayıcı
açmıyor, yalnızca OAuth için harici tarayıcı kullanıyor).

---

## 6. Derleme ve yükleme

Xcode'da:

1. Üstteki hedef seçiciden **Any iOS Device (arm64)** seçin (simülatör değil)
2. **Product → Archive** — birkaç dakika sürer
3. Organizer penceresi açılır → **Distribute App**
4. **App Store Connect** → **Upload** → Next
5. İmzalama: **Automatically manage signing** → Next
6. **Upload**

Yükleme bitince App Store Connect'te **TestFlight** sekmesinde derleme
görünür. İşlenmesi 15-60 dakika sürer.

### Sürüm numarası

`ios/App/App/Info.plist` içindeki `CFBundleShortVersionString` (kullanıcıya
görünen sürüm) ve `CFBundleVersion` (derleme numarası). Her yüklemede
**CFBundleVersion artmalı**, aynı numara ikinci kez kabul edilmez.

---

## 7. TestFlight ile test

Derleme işlendikten sonra:

- **TestFlight → Internal Testing** → kendinizi tester olarak ekleyin
- iPhone'a TestFlight uygulamasını kurun, davetten yükleyin

Burada mutlaka doğrulayın:

- Satın alma akışı (TestFlight'ta satın almalar **sandbox** modunda, gerçek
  para gitmez)
- Ödüllü reklam izleyip ödülün gelmesi
- Tam ekran, çentik hizalaması, dil değişimi
- Bulut kaydı ve kurtarma kodu

---

## 8. İncelemeye gönderme

Prepare for Submission sayfasında:

- **Build** bölümünde TestFlight'taki derlemeyi seçin
- **App Review Information** — Apple inceleme ekibi için:
  - İletişim bilgileri
  - **Notes**: satın almaların nasıl test edileceğini yazın, örn.
    `Tap the Shop tab to see carrot packages. All purchases are consumable except Remove Ads.`
  - Demo hesabı gerekmez (giriş zorunlu değil)
- **Version Release**: Manually release / Automatically release

**Add for Review** → **Submit**

İnceleme genelde 24-48 saat sürer, Google'dan hızlıdır ama daha titizdir.

---

## Sık karşılaşılan ret sebepleri

| Sebep | Önlem |
|---|---|
| Satın alma çalışmıyor | Ürünler App Store Connect'te **Ready to Submit** durumunda olmalı, ilk sürümle birlikte gönderilmeli |
| "Remove Ads" için geri yükleme yok | Kalıcı ürünlerde **Restore Purchases** zorunlu. Kod bunu açılışta otomatik yapıyor (`store.get(...).owned`), ancak Apple bazen görünür bir buton ister |
| Ekran görüntüleri uygulamayı yansıtmıyor | Gerçek oyun görüntüsü kullanın, mockup/pazarlama görseli koymayın |
| Gizlilik politikası erişilemiyor | URL'nin herkese açık olduğunu gizli sekmede doğrulayın |
| Guideline 4.8 — üçüncü taraf giriş | Google girişi sunuyorsanız Apple girişi de sunulmalı. Oyunda ikisi de var ✓ |
| Boş/eksik metadata | Tüm zorunlu alanlar doldurulmalı |

---

## Bilinen eksikler (yayından önce halledin)

- [ ] App Store Connect'te 11 satın alma ürünü tanımlı değil → mağaza çalışmaz
- [ ] Gerçek iPhone'da hiç test edilmedi (yalnızca simülatör)
- [ ] `Info.plist`'te durum çubuğu gizleme anahtarları eklenmiş olmalı:
      `UIStatusBarHidden` = YES, `UIViewControllerBasedStatusBarAppearance` = NO
- [ ] Uygulama simgesi `npx @capacitor/assets generate --ios` ile üretilmeli
