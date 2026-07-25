# Horse Runner — Google Play Yayın Rehberi

Bu dosya, oyunu Play Console'a yüklerken ihtiyacın olan her şeyi içerir:
imzalama, AAB derleme, mağaza metinleri, Veri Güvenliği ve içerik derecelendirme
cevapları, uygulama içi ürünler ve adım adım kontrol listesi.

---

## 0) Özet — Yayına kadar eksikler

| # | İş | Durum | Kimde |
|---|----|-------|-------|
| 1 | Upload keystore (imzalama anahtarı) oluştur | ⛔ Sen yapacaksın (yerelde) | Sen |
| 2 | `.aab` (App Bundle) derle | ✅ Script hazır (`npm run bundle:release`) | Sen |
| 3 | Gizlilik politikası yayına al (URL) | ✅ `docs/privacy-policy.html` hazır | Sen (host) |
| 4 | Gerçek AdMob kimlikleri (veya reklamsız v1) | ⚠️ Kararını ver | Sen |
| 5 | Uygulama içi ürünleri Console'da oluştur | ⏳ Aşağıda liste var | Sen |
| 6 | Mağaza listesi (metin + görseller) | ✅ Metinler + görseller hazır | Sen (yükle) |
| 7 | Veri Güvenliği formu | ✅ Cevaplar aşağıda | Sen (doldur) |
| 8 | İçerik derecelendirme anketi | ✅ Cevaplar aşağıda | Sen (doldur) |

---

## 1) İmzalama anahtarı (upload key) — BİR KEZ

> ⚠️ Bu anahtarı **kaybetme ve yedekle**. Uygulamanı güncellemek için gerekir.
> (Play App Signing kullanırsan Google ana anahtarı tutar; yine de upload
> anahtarını sakla.)

Bilgisayarında (JDK kurulu olmalı), proje kökünde:

```bash
keytool -genkey -v -keystore android/horse-runner-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Sorulara cevap ver (ad, kuruluş, parola). Sonra `android/keystore.properties`
dosyasını oluştur (örnek: `android/keystore.properties.example`):

```
storeFile=horse-runner-upload.jks
storePassword=<keystore parolası>
keyAlias=upload
keyPassword=<anahtar parolası>
```

Bu dosya ve `.jks` **git'e girmez** (`.gitignore`'da).

---

## 2) App Bundle (.aab) derleme

```bash
npm install
npm run bundle:release
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`
→ Play Console'a **bu dosyayı** yükleyeceksin (APK değil, AAB).

Sürüm güncellemelerinde `android/app/build.gradle` içinde `versionCode` (tam sayı,
her yüklemede +1) ve `versionName` (ör. "1.0.1") değerlerini artır.

---

## 3) Gizlilik politikası URL'i

`docs/privacy-policy.html` hazır. Yayına almak için en kolay yol **GitHub Pages**:

1. GitHub'da repo → Settings → Pages → Source: `main` dalı, `/docs` klasörü.
2. Birkaç dakika sonra şu adres yayına girer:
   `https://cagdasarslan.github.io/FODeneme/privacy-policy.html`
3. Bu URL'i Play Console → Uygulama içeriği → **Gizlilik Politikası** alanına yaz.

(İstersen kendi alan adında da barındırabilirsin — içeriği aynı.)

---

## 4) AdMob kararı

Kod, gerçek AdMob kimliği girilmediğinde reklamları **otomatik kapatır**
(`ADS_ENABLED`), böylece test reklamı yanlışlıkla yayınlanmaz. İki seçenek:

- **A) Reklamsız başla (önerilen, en hızlı):** hiçbir şey yapma. Ödüllü bonus
  butonları reklam göstermeden ödülü verir. Sonra istediğinde eklersin.
- **B) Gerçek reklamlarla başla:** AdMob'da uygulama + reklam birimleri oluştur:
  - `android/app/src/main/AndroidManifest.xml` → AdMob App ID'yi değiştir.
  - `src/services/AdService.js` → `REWARD_AD_ID` ve `BANNER_AD_ID`'yi değiştir.
  - Yeniden derle. (Gerçek kimlik girilince `ADS_ENABLED` kendiliğinden açılır.)

> Not: Play Console'da "Uygulamanızda reklam var mı?" → B seçtiysen **Evet**.

---

## 5) Uygulama içi ürünler (Play Console → Para kazanma → Ürünler)

Ürün kimlikleri koddakiyle **birebir** aynı olmalı. Hepsi **Tüketilebilir**
(havuç paketleri), "Reklamları Kaldır" ise **Tüketilemez**.

| Ürün Kimliği (Product ID) | Tür | Önerilen fiyat |
|---|---|---|
| `carrots_1000` | Tüketilebilir | ₺1,49 |
| `carrots_2500` | Tüketilebilir | ₺3,49 |
| `carrots_5000` | Tüketilebilir | ₺5,99 |
| `carrots_10000` | Tüketilebilir | ₺9,99 |
| `carrots_20000` | Tüketilebilir | ₺18,99 |
| `carrots_30000` | Tüketilebilir | ₺26,99 |
| `carrots_50000` | Tüketilebilir | ₺42,99 |
| `carrots_75000` | Tüketilebilir | ₺59,99 |
| `carrots_100000` | Tüketilebilir | ₺74,99 |
| `carrots_250000` | Tüketilebilir | ₺169,99 |
| `remove_ads` | Tüketilemez | ₺59,99 |

> IAP'nin çalışması için uygulamanın en az bir kez (İç Test kanalına) yüklenmiş
> olması gerekir. Ürünleri oluşturduktan sonra gerçek cihazda test et.

---

## 6) Mağaza listesi metinleri

**Uygulama adı:** `Horse Runner`

**Kısa açıklama (max 80 karakter):**
> Sonsuz at koşusu! Engelleri aş, atını yetiştir, liderlik tablosunda yarış.

**Tam açıklama (max 4000 karakter):**
```
🐴 HORSE RUNNER — Sonsuz At Koşusu Macerası!

Atına atla ve durmadan koş! Engelleri aş, havuçları topla ve liderlik
tablosunun zirvesine oyna. Basit dokunmatik kontroller, akıcı oynanış ve
saatlerce eğlence.

▶ NASIL OYNANIR
• Kaydırarak şerit değiştir
• Yukarı kaydır → ZIPLA, engellerin üzerinden atla
• Aşağı kaydır → EĞİL, bariyerlerin altından geç
• Ne kadar uzağa gidersen o kadar yüksek skor!

🗺️ 6 EŞSİZ HARİTA
Çiftlik pisti, şehir sokakları, çöl, uzay kolonisi, ortaçağ köyü ve karanlık
zindan — her biri kendi engelleri ve atmosferiyle.

✨ GÜÇLENDİRİCİLER
Mıknatıs, Pegasus kanatları, turbo, kalkan, zaman büyüsü ve altın havuç —
yolda beliren güçleri kap, öne geç!

🏇 ATLARI TOPLA & YÜKSELT
6 farklı at, üç ayrı stat (hız, manevra, zıplama) ile sınırsız yükseltme.
Çiftlikte ücretsiz antrenmanla da güçlendir.

🐣 KENDİ ATINI YETİŞTİR
Ahır'da iki atı çiftleştir, yavruyu büyüt ve efsanevi bir şampiyon yarat.
Nadir özel yeteneklerle doğan atları keşfet!

🏅 HEDEFLER & ÖDÜLLER
Her haritada madalyalar kazan, günlük görevleri tamamla, giriş serini koru
ve hediye sandıklarını aç.

🏆 LİDERLİK TABLOSU
Günlük, haftalık ve tüm zamanların en iyileriyle yarış.

İlerlemen buluta yedeklenir — telefon değiştirsen bile kaybolmaz.

Ücretsiz oyna, hemen indir! 🥕
```

**Görseller** (hepsi `scratchpad/store/` klasöründe üretildi — sana gönderildi):
- Uygulama ikonu: 512×512
- Öne çıkan grafik: 1024×500
- Telefon ekran görüntüleri: 5 adet 1080×1920 (min 2 gerekir)

**Kategori:** Oyun → Yarış (veya Aksiyon)
**Etiketler/İletişim:** leronsoftware@gmail.com

---

## 7) Veri Güvenliği (Data Safety) formu cevapları

- **Veri topluyor mu?** Evet.
- **Toplanan veri türleri:**
  - Kişisel bilgiler → **E-posta adresi** (yalnız Google/Apple ile giriş yapılırsa) · İsteğe bağlı · Hesap yönetimi
  - Uygulama etkinliği → **Uygulama içi eylemler / oyun ilerlemesi** · Zorunlu · Uygulama işlevselliği
  - Uygulama bilgisi ve performansı → yok (crash SDK eklemediysen)
  - Cihaz/diğer kimlikler → **Cihaz veya diğer kimlikler** (bulut kaydı kimliği + AdMob kullanıyorsan reklam kimliği) · Uygulama işlevselliği / Reklamlar
  - Satın alma geçmişi → **Satın alma geçmişi** · Uygulama işlevselliği
- **Veriler şifreli aktarılıyor mu?** Evet (HTTPS).
- **Kullanıcı silme talep edebilir mi?** Evet (e-posta ile).
- **Veriler üçüncü taraflarla paylaşılıyor mu?** Reklam kullanıyorsan AdMob ile
  reklam kimliği paylaşılır; aksi halde hayır.

> AdMob'u KAPALI başlatırsan (seçenek A), "Reklam kimliği" ve reklamla ilgili
> paylaşımı işaretleme.

---

## 8) İçerik Derecelendirme anketi

- Kategori: **Oyun**
- Şiddet: Yok / Karikatürize hafif (at koşusu; kan/şiddet yok)
- Cinsellik: Yok
- Küfür: Yok
- Kumar: Yok (rastgele sandık ödülü var ama gerçek parayla şans oyunu değil —
  "Simüle edilmiş kumar" **Hayır**)
- Kullanıcı etkileşimi: Liderlik tablosunda takma ad görünür (kullanıcı içeriği
  paylaşımı sınırlı) → sorulursa belirt.
- Sonuç genelde: **PEGI 3 / Everyone** civarı.

---

## 9) Adım adım yayın akışı

1. `keytool` ile upload key oluştur → `android/keystore.properties` doldur (§1).
2. `npm run bundle:release` → `.aab` üret (§2).
3. Gizlilik politikasını yayına al, URL'i not et (§3).
4. Play Console → **Uygulama oluştur** (ad: Horse Runner, dil: Türkçe, oyun, ücretsiz).
5. **Uygulama içeriği**: gizlilik politikası URL'i, reklam beyanı, hedef kitle
   (13+), Veri Güvenliği (§7), içerik derecelendirme (§8).
6. **Mağaza listesi**: metinler (§6) + görseller.
7. **Para kazanma → Ürünler**: uygulama içi ürünleri oluştur (§5).
8. **Sürümler → İç test**: `.aab`'yi yükle, kendini test kullanıcısı ekle,
   gerçek cihazda oyunu ve satın almaları test et.
9. Her şey çalışıyorsa **Üretim** kanalına yükselt, ülkeleri seç, incelemeye gönder.
10. Google incelemesi genelde birkaç saat–birkaç gün sürer.

---

## 10) Sürüm güncellemesi (ileride)

```bash
# android/app/build.gradle: versionCode +1, versionName güncelle
npm run bundle:release
# yeni .aab'yi Console'a yükle
```
