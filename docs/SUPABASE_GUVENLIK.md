# Supabase Güvenlik Geçişi

Oyunun Supabase projesi: `vdyjyuqdzkpsixnopndx`

## Sorunlar

1. **Liderlik tabloları kurtarma kodlarını herkese açık gösteriyordu.**
   `scores` ve `totals` tablolarındaki `player_id` alanı oyuncunun kurtarma
   kodunun kendisiydi; liderliği çeken herkes tüm kodları görebiliyordu. Bir kodu
   bilen, o oyuncunun ilerlemesini kendi cihazına çekebilir.
2. **Profiller koşulsuz kurallarla açıktı** (`using (true)`): anon anahtarla tüm
   kayıtlar listelenip değiştirilebiliyordu.
3. **Liderliğe istenen skor yazılabiliyordu.**

## Uygulamada yapılanlar (1.0.4)

- Liderliğe artık kurtarma kodu değil, kodun **SHA-256 özeti** yazılıyor.
- Bulut kaydı okuma/yazma/silme sunucu fonksiyonlarıyla (`save_profile`,
  `restore_profile`, `delete_profile`) yapılıyor. Fonksiyonlar kurulu değilse
  uygulama eski yönteme düşer — SQL'den önce de sonra da çalışır.
- "Verilerimi Sil", fonksiyon kuruluysa profil + liderlik kayıtlarını gerçekten
  siler.

## Senin yapacakların

### Adım 1 — `docs/supabase/001_guvenlik.sql` (hemen)

Supabase panosu → **SQL Editor** → dosyanın tamamını yapıştır → **Run**.

- Eski 1.0.3 sürümünü **bozmaz**: mevcut kurallar değişmez.
- Liderlikteki tüm ham kodları özete çevirir; eski sürümden gelen yeni ham
  kodları da otomatik özetler.
- 500.000 üstü sahte skorları reddeder.
- İki kez çalıştırmak zararsızdır.

Bu dosya yerel bir PostgreSQL 16 üzerinde, Supabase tablolarının aynısıyla test
edildi: eski sürüm yazmaları özetleniyor, sahte skor reddediliyor, toplamlar
birleşiyor, fonksiyonlar anon rolüyle çalışıyor, uygulamanın ürettiği özet
veritabanınınkiyle birebir aynı.

Doğrulama (SQL Editor, ikisi de 0 dönmeli):

```sql
select count(*) from scores where player_id like 'p\_%' or player_id like 'u\_%';
select count(*) from totals where player_id like 'p\_%' or player_id like 'u\_%';
```

### Adım 2 — `docs/supabase/002_dogrudan_erisimi_kapat.sql` (sonra)

1.0.4 oyuncuların büyük çoğunluğuna ulaşınca (Play Console → İstatistikler →
uygulama sürümleri) çalıştır. Profillere doğrudan erişimi kapatır. Erken
uygulanırsa 1.0.3'teki oyuncuların bulut yedeği çalışmaz.

## Bilinmesi gerekenler

- Adım 1'den önce sızmış olabilecek kurtarma kodları geçerli kalmaya devam
  eder (kodları değiştirmek oyuncuların kayıtlı kodlarını bozar). Adım 1'den
  sonra yeni sızıntı olmaz.
- Liderlik toplamları (`totals`) hâlâ istemciden güncelleniyor; biri kendi
  toplamını şişirebilir. Tam çözüm skorun sunucuda hesaplanması — ileride.
- Satın alma doğrulaması (sunucu tarafı makbuz kontrolü) henüz yok — ileride.
