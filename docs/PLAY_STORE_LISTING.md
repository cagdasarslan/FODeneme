# Horse Runner — Google Play mağaza metinleri (1.0.5)

Play Console → **Büyüme → Mağazadaki varlık → Ana mağaza girişi**.
Varsayılan dil **Türkçe (tr-TR)**; **İngilizce (en-US)** çeviri olarak eklenir
("Çevirileri yönet → Kendi çevirilerimi ekle").

Görseller: `docs/store-assets/` — `tr/` ve `en/` klasörlerinde 1080×1920 telefon
ekran görüntüleri, `feature_graphic_1024x500.png`, `icon_512.png`.

---

## Türkçe (tr-TR)

**Uygulama adı** (30 karakter): `Horse Runner: At Koşusu`

**Kısa açıklama** (80 karakter):
```
Atına atla, engelleri aş! 6 harita, Pegasus kanatları ve kendi tayını yetiştir.
```

**Tam açıklama** (4000 karakter):
```
Atına atla ve durmadan koş! Horse Runner; at yarışı pistinden Mars çöllerine, uzay kolonisinden ortaçağ köyüne uzanan sonsuz bir koşu macerası.

▶ KOLAY KONTROLLER
• Sağa-sola kaydır: şerit değiştir
• Yukarı kaydır: engellerin üstünden zıpla
• Aşağı kaydır: kapıların altından eğilerek geç
Ne kadar uzağa gidersen skorun o kadar yükselir. Kıl payı kurtuluşlar ve seriler ekstra puan getirir!

🗺️ 6 CANLI HARİTA
• At Yarışı: tezahürat eden tribünler arasında yarış
• Şehir: taksiler ve trafik ışıkları arasında dörtnala
• Çöller: roketler, toz hortumları ve kızıl kumlar
• Uzay Kolonisi: ışıklı kubbeler, dronlar ve halkalı gezegen
• Ortaçağ Köyü: şatolar, değirmenler ve kuyular
• Zindan: meşaleler ve gizemli koridorlar

✨ 6 YETENEK
Süper Nal mıknatısı, Pegasus kanatları ile uçuş, Şimşek Nalı turbo, Nal Zırhı kalkanı, Zaman Büyüsü ve Altın Havuç. Yolda beliren yetenekleri kap, havuçla geliştir, süreleri uzat!

🏇 ATLAR VE JOKEYLER
Anadolu Alası'ndan Ahal Teke'ye 6 at, kovboydan büyücüye 8 jokey. Hızı, manevrayı ve zıplamayı geliştir, en yükseğe sen zıpla!

🐣 KENDİ TAYINI YETİŞTİR
Ahırda iki atı çiftleştir, tayını besle, tımarla ve antrenmanla büyüt. Nadir özelliklerle doğan şampiyonları keşfet.

🏅 GÖREVLER VE ÖDÜLLER
Günlük ve haftalık görevler, harita madalyaları, günlük giriş ödülleri ve hediye sandıkları.

🏆 LİDERLİK TABLOSU
Günün, haftanın ve tüm zamanların en iyileriyle yarış.

☁️ İlerlemen buluta yedeklenir; telefon değiştirsen bile kaybolmaz.

Ücretsiz oyna, hemen indir! 🥕
```

**Sürüm notları** (500 karakter) — Üretim → Yeni sürüm oluştur:
```
<tr-TR>
Büyük güncelleme!
• Yeni atlar ve jokeyler: dörtnala koşu, zıplama ve eğilme animasyonları
• Pegasus kanatlarıyla gerçek uçuş
• Tüm haritalar yenilendi; At Yarışı, Çöl ve Uzay daha canlı
• Yeni sıcak tasarım ve daha okunaklı menüler
• Engeller daha anlaşılır, yolda uyarı okları
• Çentikli telefonlarda menü sorunu giderildi
• Türkçe karakter sorunları düzeltildi
• Daha akıcı performans ve hata düzeltmeleri
</tr-TR>
```

---

## English (en-US)

**App name** (30 chars): `Horse Runner: Endless Ride`

**Short description** (80 chars):
```
Saddle up and dodge! 6 worlds, Pegasus wings and foals to raise in your stable.
```

**Full description** (4000 chars):
```
Saddle up and ride forever! Horse Runner is an endless running adventure that takes you from the racetrack to the red dunes of Mars, from a space colony to a medieval village.

▶ EASY CONTROLS
• Swipe left/right: switch lanes
• Swipe up: jump over obstacles
• Swipe down: duck under gates
The farther you ride, the higher you score. Close calls and combos earn bonus points!

🗺️ 6 LIVELY WORLDS
• Horse Race: gallop past cheering grandstands
• City: weave between taxis and traffic lights
• Desert: rockets, dust devils and red sand
• Space Colony: glowing domes, drones and a ringed planet
• Medieval Village: castles, windmills and wells
• Dungeon: torches and mysterious corridors

✨ 6 POWER-UPS
Magnet Horseshoe, Pegasus Wings flight, Lightning Shoe turbo, Horseshoe Armor shield, Time Spell and Golden Carrot. Grab them on the road, upgrade them with carrots and make them last longer!

🏇 HORSES & JOCKEYS
6 horses and 8 jockeys, from cowboy to wizard. Upgrade speed, agility and jump power to reach new heights!

🐣 RAISE YOUR OWN FOAL
Breed two horses in your stable, then feed, groom and train your foal. Discover rare champions with special traits.

🏅 MISSIONS & REWARDS
Daily and weekly missions, map medals, daily login rewards and gift chests.

🏆 LEADERBOARDS
Race the best players of the day, the week and all time.

☁️ Cloud save keeps your progress safe, even when you switch phones.

Free to play. Download now! 🥕
```

**Release notes** (500 chars):
```
<en-US>
Big update!
• New horses and jockeys with gallop, jump and duck animations
• Real flight with Pegasus Wings
• All worlds rebuilt; Horse Race, Desert and Space are more alive
• Fresh warm design and clearer menus
• Easier-to-read obstacles with warning arrows on the road
• Fixed menus on phones with a notch
• Fixed Turkish character display
• Smoother performance and bug fixes
</en-US>
```

---

## Kontrol listesi (bu sürüm)

- [ ] AAB: GitHub Actions → "Android build" → `release-aab` işinin artifact'ı
      (imzalı olması için yükleme anahtarı sırları tanımlı olmalı) ya da yerelde
      Android Studio → Generate Signed App Bundle
- [ ] Sürüm: 1.0.5 (versionCode 6)
- [ ] Ekran görüntüleri: tr/ ve en/ klasörlerindeki 8'er görsel
- [ ] Öne çıkan grafik 1024×500
- [ ] Sürüm notları (TR + EN)
- [ ] Veri güvenliği formu değişmedi (yeni veri toplanmıyor)
- [ ] Reklam içeriyor: Evet (banner + ödüllü)
