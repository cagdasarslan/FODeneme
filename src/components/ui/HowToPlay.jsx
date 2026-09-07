import { useState } from 'react';
import { t } from '@/i18n';
import { SAFE_BOTTOM, topPlus } from '@/utils/safeArea';
import useLang from '@/i18n/useLang';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

const SECTIONS = [
  {
    id: 'gameplay',
    icon: '🎮',
    title: 'NASIL OYNANIR',
    content: [
      {
        type: 'text',
        text: 'Horse Runner, sonsuz koşu türünde 3B bir at yarışı oyunudur. Atın otomatik koşar; senin görevin şerit değiştirip engelleri aşmak ve olabildiğince uzağa gitmektir.',
      },
      {
        type: 'list',
        title: 'Kontroller (Mobil)',
        items: [
          '👉 Sağa/sola kaydır — şerit değiştir',
          '👆 Yukarı kaydır — ZIPLA (yerdeki engelleri aş)',
          '👇 Aşağı kaydır — EĞİL (üstten geçen bariyerlerin altından geç)',
          'Parmağını kaldırmadan art arda kaydırabilirsin',
        ],
      },
      {
        type: 'list',
        title: 'Kontroller (Klavye)',
        items: [
          '◄ ► veya A / D — şerit değiştir',
          '↑ / Space / W — zıpla',
          '↓ / S — eğil',
        ],
      },
      {
        type: 'list',
        title: 'Temel Kurallar',
        items: [
          'Yerdeki engelleri ZIPLAYARAK aş — havadayken sana çarpamazlar',
          'Üstten geçen bariyerler zıplayarak GEÇİLMEZ, altından EĞİLEREK geç',
          'Her metre 1 puan; ne kadar uzağa gidersen o kadar yüksek skor',
          'Her haritanın ayrı en yüksek skoru saklanır',
        ],
      },
    ],
  },
  {
    id: 'moves',
    icon: '⚡',
    title: 'COMBO & ADRENALİN',
    content: [
      {
        type: 'text',
        text: 'Riskli hamleler seni ödüllendirir. Bir engelin dibinden geçmek (makas), üzerinden atlamak veya altından kaymak hem combo hem adrenalin kazandırır.',
      },
      {
        type: 'list',
        title: 'Combo (Çarpan)',
        items: [
          'Art arda riskli hamle yaptıkça skor çarpanın artar: x1 → x2 → x3 → x4',
          'Her 3 hamlede çarpan bir kademe yükselir',
          '5 saniye yeni hamle gelmezse combo sıfırlanır',
          'Combo yükselince özel ses + titreşim ile geri bildirim alırsın',
        ],
      },
      {
        type: 'list',
        title: 'Adrenalin',
        items: [
          'Engele çok yakın geçince (makas) +20 adrenalin kazanırsın',
          'Gösterge 100\'e dolunca ADRENALİN PATLAMASI başlar',
          'Patlama: 3 saniye boyunca 2x skor + hız patlaması',
          'Zamanla yavaşça azalır — sürekli risk al!',
        ],
      },
      {
        type: 'list',
        title: 'Tökezleme (İkinci Şans)',
        items: [
          'İlk çarpışma seni ÖLDÜRMEZ — tökezlersin, hızın kısa süre düşer',
          'Ama 7,5 saniyelik tehlike penceresi açılır',
          'Bu pencere içinde ikinci çarpışma = oyun biter',
          'Tökezledikten sonra topla kendini ve dikkatli koş!',
        ],
      },
    ],
  },
  {
    id: 'powerups',
    icon: '✨',
    title: 'GÜÇLENDİRİCİLER',
    content: [
      {
        type: 'text',
        text: 'Koşarken her 10-15 saniyede yolda parlayan bir güçlendirici belirir. Üzerinden geçince aktifleşir. 6 farklı güç vardır ve hepsi rastgele gelir.',
      },
      {
        type: 'table',
        headers: ['Güç', 'Etki', 'Süre'],
        rows: [
          ['🧲 Süper Nal', 'Havuçları kendine çeker', '10 sn'],
          ['🪽 Pegasus', 'Kanatlanıp uçarsın (engel yok)', '6 sn'],
          ['🚀 Şimşek Nalı', 'Turbo hız + çarpışmazlık', '5 sn'],
          ['🛡️ Nal Zırhı', 'Bir çarpışmayı emer', '15 sn'],
          ['⏳ Zaman Büyüsü', 'Dünya yavaşlar, sen normal', '5 sn'],
          ['💰 Altın Havuç', 'Topladığın havuç 2 katı', '8 sn'],
        ],
      },
      {
        type: 'list',
        title: 'Güçlendirici Yükseltme',
        items: [
          'MAĞAZA → Yetenekler sekmesinden her gücü 5 seviyeye çıkar',
          'Her seviye etki süresini uzatır (Sv5\'te 2 katı)',
          'Maliyet: 750 → 1.500 → 3.000 → 6.000 → 12.000 🥕',
        ],
      },
    ],
  },
  {
    id: 'maps',
    icon: '🗺️',
    title: 'HARİTALAR',
    content: [
      {
        type: 'cards',
        items: [
          { icon: '🌿', name: 'AT YARIŞI', sub: 'Çiftlik / Pist', desc: 'Başlangıç haritası — herkese açık. Fıçı, saman ve kütük engelleri.', color: '#6aaa44' },
          { icon: '🏙️', name: 'ŞEHİR', sub: '1.000 skor ile açılır', desc: 'Araba, taksi, polis ve çöp kutusu engelleri.', color: '#4a90d9' },
          { icon: '🌵', name: 'ÇÖLLER', sub: '3.000 skor ile açılır', desc: 'Kum fırtınası, uzun kaktüs ve büyük kaya engelleri.', color: '#d4a020' },
          { icon: '🚀', name: 'UZAY KOLONİSİ', sub: '6.000 skor ile açılır', desc: 'Düşük yerçekimi — daha yüksek zıpla! Rover, meteor, platform.', color: '#aa44ff' },
          { icon: '🏰', name: 'ORTAÇAĞ KÖYÜ', sub: '10.000 skor ile açılır', desc: 'Kuyu, kaya, ağaç ve tarla engelleri.', color: '#c8843c' },
          { icon: '💀', name: 'ZİNDAN', sub: '15.000 skor ile açılır', desc: 'Sandık, fıçı, kasa, diken ve masa engelleri.', color: '#9a6cff' },
        ],
      },
      {
        type: 'text',
        text: 'Kilit eşiği HERHANGİ bir haritadaki en iyi skorunla açılır — illa o haritada yapman gerekmez.',
      },
    ],
  },
  {
    id: 'medals',
    icon: '🏅',
    title: 'MADALYALAR',
    content: [
      {
        type: 'text',
        text: 'Her haritada tek koşuda ulaşabileceğin 3 skor hedefi vardır. Ana menüde OYNA butonunun altında bir sonraki hedefin her zaman görünür.',
      },
      {
        type: 'list',
        title: 'Nasıl Kazanılır?',
        items: [
          '🥉 Bronz — ilk eşiği geç → +300 🥕',
          '🥈 Gümüş — ikinci eşiği geç → +700 🥕',
          '🥇 Altın — üçüncü eşiği geç → +1.500 🥕',
          'Her madalya bir kez ödül verir; eşikler her haritada farklıdır',
        ],
      },
      {
        type: 'text',
        text: 'Örnek (At Yarışı): 🥉 500 · 🥈 1.500 · 🥇 4.000 skor. Zorlaştıkça ödül büyür!',
      },
    ],
  },
  {
    id: 'missions',
    icon: '🎯',
    title: 'GÖREVLER & ÖDÜLLER',
    content: [
      {
        type: 'list',
        title: 'İlk Adımlar (Yeni Oyuncu)',
        items: [
          'Ana menüdeki rehber kart seni sistemlerle tanıştırır',
          'Her adımı tamamlayınca havuç ödülü alırsın',
          'Hepsi bitince kart otomatik kaybolur',
        ],
      },
      {
        type: 'list',
        title: 'Günlük & Haftalık Görevler',
        items: [
          '🎯 sekmesinden her gün 3 günlük + 3 haftalık görev',
          'Örnek: mesafe koş, havuç topla, engel atla, koşu tamamla',
          'Günlük ödül 120-250 🥕, haftalık 1.000-1.500 🥕',
        ],
      },
      {
        type: 'list',
        title: 'Günlük Giriş Serisi (Streak)',
        items: [
          'Her gün oyuna gir → artan ödül (1.000 → 7.000 🥕)',
          'Seri bozulmadıkça ödül büyür',
        ],
      },
      {
        type: 'list',
        title: 'Günlük 50.000 Puan Hedefi',
        items: [
          'O gün TÜM haritalarda toplam 50.000 puana ulaş',
          'Bir hediye sandığı kazan — içinden havuç veya güç boost\'u çıkar',
          '%2 ihtimalle 3.000 havuç JACKPOT!',
        ],
      },
    ],
  },
  {
    id: 'horses',
    icon: '🐴',
    title: 'ATLAR & YÜKSELTME',
    content: [
      {
        type: 'text',
        text: 'Altı at var. Her atın üç statı (hız, manevra, zıplama) ayrı ayrı 5 seviyeye yükseltilebilir. Ayrıca Çiftlik\'te ÜCRETSİZ antrenmanla da güçlenir.',
      },
      {
        type: 'table',
        headers: ['At', 'Fiyat', 'Hız', 'Manevra', 'Zıpla', 'MaxHız'],
        rows: [
          ['🟤 ANADOLU ALASI', 'Ücretsiz', 'x1.2', 'x1.1', 'x1.1', '50'],
          ['🤍 PAMUK', 'Ücretsiz', 'x1.3', 'x1.2', 'x1.2', '58'],
          ['⬛ KARAYEL', '250', 'x1.4', 'x0.9', 'x1.1', '60'],
          ['⬜ AKKOR KÜHEYLAN', '600', 'x1.8', 'x1.3', 'x1.5', '80'],
          ['🌟 AKAT', '1.200', 'x1.6', 'x1.5', 'x1.3', '75'],
          ['🟡 AHAL TEKE', '2.000', 'x1.7', 'x1.3', 'x1.4', '78'],
        ],
      },
      {
        type: 'list',
        title: 'Yükseltme',
        items: [
          'Her stat ayrı ayrı 5 seviyeye çıkar',
          'Maliyet: 750 → 1.500 → 3.000 → 6.000 → 12.000 🥕',
          'Reklam izleyerek sonraki yükseltmede %50 indirim',
          'MAĞAZA → Atlarım sekmesinden yapılır',
        ],
      },
    ],
  },
  {
    id: 'jockeys',
    icon: '🏇',
    title: 'JOKEYLER',
    content: [
      {
        type: 'text',
        text: 'Jokeyin yalnızca görsel — istatistikleri değiştirmez. İstediğin stili seç!',
      },
      {
        type: 'table',
        headers: ['Jokey', 'Fiyat'],
        rows: [
          ['🤠 KOVBOY', 'Ücretsiz'],
          ['👤 KASUAL', '200 🥕'],
          ['🥷 NİNJA', '500 🥕'],
          ['⚔️ VİKİNG', '800 🥕'],
          ['🏴‍☠️ KORSAN', '1.000 🥕'],
          ['🧟 ZOMBİ', '1.200 🥕'],
          ['👑 ALTIN ŞOVALYE', '2.000 🥕'],
          ['🧙 BÜYÜCÜ', '2.500 🥕'],
        ],
      },
    ],
  },
  {
    id: 'carrots',
    icon: '🥕',
    title: 'HAVUÇLAR',
    content: [
      {
        type: 'text',
        text: 'Havuç oyunun para birimidir. Atları, jokeyleri, yükseltmeleri ve tayları havuçla alırsın.',
      },
      {
        type: 'list',
        title: 'Nasıl Kazanılır?',
        items: [
          'Koşuda yoldaki turuncu havuçları toplayarak',
          'Madalyalar (300-1.500), görevler ve giriş serisinden',
          'Günlük hediye sandığından',
          'Ödüllü reklam izleyerek (günde 5 kez, her biri 200 🥕)',
          'MAĞAZA\'dan gerçek parayla havuç paketi (₺1,49 - ₺169,99)',
        ],
      },
    ],
  },
  {
    id: 'hara',
    icon: '🐣',
    title: 'AHIR & YAVRU AT',
    content: [
      {
        type: 'text',
        text: 'AHIR\'da iki atı çiftleştirip yavru üretir, büyütüp yeni bir ata dönüştürürsün. Yetişkin yavru, ebeveynlerinin statlarını miras alır.',
      },
      {
        type: 'list',
        title: 'Yavru Edinme',
        items: [
          'Çiftleştirme 300 🥕 (sonrasında 6 saat bekleme)',
          'Mağazadan hazır yavru: Tier 1 200 🥕, Tier 2 500 🥕',
          'Reklam izleyerek BEDAVA şanslı yavru',
          'Başlangıçta 2 ahır yuvası; ek yuva 1.000 🥕',
        ],
      },
      {
        type: 'stages',
        title: 'Büyüme Aşamaları (toplam ~7 saat)',
        items: [
          { stage: 'TAY', duration: '1 saat', bp: '80 BP', scale: '%50 boy', gate: 'Bağ gerekmez', color: '#ffcc44' },
          { stage: 'YAVRU', duration: '2 saat', bp: '180 BP', scale: '%65 boy', gate: '1 bağ', color: '#ff9944' },
          { stage: 'GENÇ', duration: '4 saat', bp: '350 BP', scale: '%80 boy', gate: '2 bağ', color: '#44ccff' },
          { stage: 'YETİŞKİN', duration: 'Hazır!', bp: 'Tamam', scale: '%100 boy', gate: 'Ata dönüşür', color: '#44ff88' },
        ],
      },
      {
        type: 'list',
        title: '⏩ Hızlandır (YENİ!)',
        items: [
          'Beklemek istemiyor musun? Aşamayı anında geç',
          'Havuçla: kalan her saat için ~40 🥕 (en fazla 150)',
          'Ya da reklam izleyerek TAMAMEN ücretsiz',
        ],
      },
      {
        type: 'list',
        title: 'Bakım & Büyüme Puanı (BP)',
        items: [
          '🌾 BESLE — 15 🥕 · Tokluk +40, BP +5 (günde 4)',
          '✂️ TIMAR — Ücretsiz · Mutluluk +30, BP +5, Bağ +1 (4 sa)',
          '🏃 ANTREN — Ücretsiz · BP +20, Bağ +1 (24 sa)',
          'Koşuda her 500m → +15 BP kazanırsın',
        ],
      },
      {
        type: 'list',
        title: 'Özel Yetenekler (%5 şans)',
        items: [
          '🏆 Şampiyon — Tüm statlar +%10',
          '💨 Rüzgar — Max hız +5',
          '🌙 Sıçrayan — Zıplama +%15',
        ],
      },
    ],
  },
  {
    id: 'account',
    icon: '☁️',
    title: 'KAYIT & HESAP',
    content: [
      {
        type: 'text',
        text: 'İlerlemen otomatik olarak buluta yedeklenir. Telefonunu değiştirsen veya oyunu silsen bile kaybolmaz.',
      },
      {
        type: 'list',
        title: 'İlerlemeni Koru',
        items: [
          'Google veya Apple ile giriş yap → hesabına bağlanır',
          'Ya da Ayarlar\'daki KURTARMA KODU\'nu bir yere kaydet',
          'Yeni cihazda kodu girerek tüm ilerlemeni geri al',
          'Havuçlar, atlar, madalyalar, tayların — hepsi güvende',
        ],
      },
    ],
  },
];

function renderContent(block, idx) {
  switch (block.type) {
    case 'text':
      return <p key={idx} style={s.bodyText}>{t(block.text)}</p>;

    case 'list':
      return (
        <div key={idx} style={s.listBlock}>
          {block.title && <div style={s.listTitle}>{t(block.title)}</div>}
          <ul style={s.ul}>
            {block.items.map((item, i) => (
              <li key={i} style={s.li}>{t(item)}</li>
            ))}
          </ul>
        </div>
      );

    case 'table':
      return (
        <div key={idx} style={s.tableWrap}>
          {block.title && <div style={s.listTitle}>{t(block.title)}</div>}
          <div style={s.tableScroll}>
            <table style={s.table}>
              <thead>
                <tr>
                  {block.headers.map((h, i) => <th key={i} style={s.th}>{t(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j} style={s.td}>{t(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'cards':
      return (
        <div key={idx} style={s.cardsGrid}>
          {block.items.map((item, i) => (
            <div key={i} style={{ ...s.mapCard, borderColor: item.color }}>
              <span style={s.mapCardIcon}>{item.icon}</span>
              <div style={{ ...s.mapCardName, color: item.color }}>{t(item.name)}</div>
              <div style={s.mapCardSub}>{t(item.sub)}</div>
              <div style={s.mapCardDesc}>{t(item.desc)}</div>
            </div>
          ))}
        </div>
      );

    case 'stages':
      return (
        <div key={idx} style={s.stagesWrap}>
          {block.title && <div style={s.listTitle}>{t(block.title)}</div>}
          <div style={s.stagesGrid}>
            {block.items.map((item, i) => (
              <div key={i} style={{ ...s.stageCard, borderColor: item.color }}>
                <div style={{ ...s.stageName, color: item.color }}>{t(item.stage)}</div>
                <div style={s.stageRow}>⏱ {t(item.duration)}</div>
                <div style={s.stageRow}>📊 {t(item.bp)}</div>
                <div style={s.stageRow}>📏 {t(item.scale)}</div>
                <div style={s.stageRow}>🔒 {t(item.gate)}</div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export default function HowToPlay({ onClose }) {
  useLang();
  const [activeSection, setActiveSection] = useState('gameplay');
  const section = SECTIONS.find(sec => sec.id === activeSection);

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerTitle}>📖 {t('OYUN REHBERİ')}</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Mobilde: üstte yatay kaydırmalı sekme şeridi (tam genişlik içerik) */}
        {isMobile ? (
          <>
            <div style={s.tabStrip}>
              {SECTIONS.map(sec => (
                <button
                  key={sec.id}
                  style={{
                    ...s.tabBtn,
                    background: activeSection === sec.id ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: activeSection === sec.id ? '#ffd700' : 'rgba(255,255,255,0.1)',
                    color: activeSection === sec.id ? '#ffd700' : 'rgba(255,255,255,0.6)',
                  }}
                  onClick={() => setActiveSection(sec.id)}
                >
                  <span style={{ fontSize: 16 }}>{sec.icon}</span>
                  <span style={s.tabText}>{t(sec.title)}</span>
                </button>
              ))}
            </div>
            <div style={s.content}>
              <div style={s.sectionTitle}>{section.icon} {t(section.title)}</div>
              {section.content.map((block, i) => renderContent(block, i))}
            </div>
          </>
        ) : (
          /* Masaüstü: solda dikey kenar çubuğu */
          <div style={s.body}>
            <div style={s.sidebar}>
              {SECTIONS.map(sec => (
                <button
                  key={sec.id}
                  style={{
                    ...s.sideBtn,
                    background: activeSection === sec.id ? 'rgba(255,215,0,0.12)' : 'transparent',
                    borderLeft: activeSection === sec.id ? '3px solid #ffd700' : '3px solid transparent',
                    color: activeSection === sec.id ? '#ffd700' : 'rgba(255,255,255,0.55)',
                  }}
                  onClick={() => setActiveSection(sec.id)}
                >
                  <span style={s.sideBtnIcon}>{sec.icon}</span>
                  <span style={s.sideBtnText}>{t(sec.title)}</span>
                </button>
              ))}
            </div>
            <div style={s.content}>
              <div style={s.sectionTitle}>{section.icon} {t(section.title)}</div>
              {section.content.map((block, i) => renderContent(block, i))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--game-font)',
    padding: isMobile ? '0' : '16px', boxSizing: 'border-box',
  },
  modal: {
    width: isMobile ? '100vw' : '92vw', maxWidth: 820,
    height: isMobile ? '100dvh' : '88vh', maxHeight: isMobile ? '100dvh' : 680,
    background: 'linear-gradient(160deg,rgba(12,12,28,0.98) 0%,rgba(8,8,18,0.99) 100%)',
    border: isMobile ? 'none' : '1px solid rgba(255,215,0,0.2)',
    borderRadius: isMobile ? 0 : 14, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', boxShadow: '0 12px 50px rgba(0,0,0,0.7)',
    // Tam ekranda (mobil) başlık ve alt kenar güvenli alanda kalsın
    paddingBottom: isMobile ? SAFE_BOTTOM : 0,
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: isMobile ? `${topPlus(12)} 16px 12px` : '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
  },
  headerTitle: { fontSize: isMobile ? 15 : 16, fontWeight: 700, letterSpacing: 2, color: '#ffd700' },
  closeBtn: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff', borderRadius: 8, padding: isMobile ? '8px 16px' : '4px 12px', cursor: 'pointer',
    fontSize: 16, fontFamily: 'var(--game-font)',
  },
  // ── Mobil yatay sekme şeridi ──
  tabStrip: {
    display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0,
    padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    WebkitOverflowScrolling: 'touch',
  },
  tabBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: '8px 12px', minWidth: 66, flexShrink: 0,
    border: '1px solid', borderRadius: 10, cursor: 'pointer',
    fontFamily: 'var(--game-font)', fontWeight: 700,
  },
  tabText: { fontSize: 8.5, letterSpacing: 0.3, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' },
  // ── Masaüstü kenar çubuğu ──
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 180, minWidth: 140, borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', flexDirection: 'column', gap: 2,
    padding: '10px 0', overflowY: 'auto',
  },
  sideBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--game-font)', fontSize: 11, letterSpacing: 1,
    transition: 'all 0.12s', textAlign: 'left',
  },
  sideBtnIcon: { fontSize: 16, minWidth: 20 },
  sideBtnText: { fontWeight: 700 },
  // ── İçerik ──
  content: { flex: 1, overflowY: 'auto', padding: isMobile ? '16px 16px calc(24px + env(safe-area-inset-bottom,0px))' : '18px 22px', WebkitOverflowScrolling: 'touch' },
  sectionTitle: {
    fontSize: isMobile ? 16 : 15, fontWeight: 700, letterSpacing: 2, color: '#ffd700',
    marginBottom: 16, paddingBottom: 10,
    borderBottom: '1px solid rgba(255,215,0,0.2)',
  },
  bodyText: {
    color: 'rgba(255,255,255,0.78)', fontSize: isMobile ? 14 : 13, lineHeight: 1.75,
    margin: '0 0 14px',
  },
  listBlock: { marginBottom: 18 },
  listTitle: {
    fontSize: isMobile ? 12 : 11, letterSpacing: 1.5, color: 'rgba(255,215,0,0.75)',
    fontWeight: 700, marginBottom: 8, textTransform: 'uppercase',
  },
  ul: { margin: 0, paddingLeft: 20 },
  li: { color: 'rgba(255,255,255,0.72)', fontSize: isMobile ? 13.5 : 12, lineHeight: 1.85, letterSpacing: 0.2, marginBottom: 2 },
  tableWrap: { marginBottom: 18, overflow: 'hidden' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 12 : 11 },
  th: {
    background: 'rgba(255,215,0,0.08)', color: 'rgba(255,215,0,0.8)',
    padding: isMobile ? '8px 8px' : '7px 10px', textAlign: 'left', letterSpacing: 0.5,
    borderBottom: '1px solid rgba(255,215,0,0.2)', whiteSpace: 'nowrap',
  },
  td: {
    padding: isMobile ? '8px 8px' : '7px 10px', color: 'rgba(255,255,255,0.72)',
    borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: isMobile ? 12.5 : 12, whiteSpace: 'nowrap',
  },
  cardsGrid: {
    display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
    gap: 10, marginBottom: 14,
  },
  mapCard: {
    border: '1px solid', borderRadius: 10, padding: '11px 10px',
    background: 'rgba(255,255,255,0.03)',
  },
  mapCardIcon: { fontSize: 24 },
  mapCardName: { fontSize: isMobile ? 11 : 11, fontWeight: 700, letterSpacing: 1, marginTop: 6 },
  mapCardSub: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  mapCardDesc: { fontSize: isMobile ? 11 : 11, color: 'rgba(255,255,255,0.62)', marginTop: 6, lineHeight: 1.5 },
  stagesWrap: { marginBottom: 18 },
  stagesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  stageCard: {
    border: '1px solid', borderRadius: 8, padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
  },
  stageName: { fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 6 },
  stageRow: { fontSize: 11, color: 'rgba(255,255,255,0.62)', lineHeight: 1.8 },
};
