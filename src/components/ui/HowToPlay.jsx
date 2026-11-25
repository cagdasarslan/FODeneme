import { useState } from 'react';
import { t } from '@/i18n';
import { BOTTOM_SPACE, topPlus } from '@/utils/safeArea';
import useLang from '@/i18n/useLang';
import { C, FONT, DISPLAY, btn, panel, tile, titleText, backdrop } from '@/ui/theme';

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
          'Maliyet: 750 → 1.200 → 1.900 → 3.050 → 4.900 🥕',
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
          'Maliyet: 750 → 1.200 → 1.900 → 3.050 → 4.900 🥕',
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
          'Ödüllü reklam izleyerek (günde 5 kez, her biri 120 🥕)',
          'MAĞAZA\'dan gerçek parayla havuç paketi',
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
            <div key={i} style={{ ...s.mapCard, borderLeftColor: item.color }}>
              <span style={s.mapCardIcon}>{item.icon}</span>
              <div style={{ ...s.mapCardName }}>{t(item.name)}</div>
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
              <div key={i} style={{ ...s.stageCard, borderLeftColor: item.color }}>
                <div style={{ ...s.stageName }}>{t(item.stage)}</div>
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
          <button aria-label={t('Kapat')} className="hr-press" style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Mobilde: üstte yatay kaydırmalı sekme şeridi (tam genişlik içerik) */}
        {isMobile ? (
          <>
            <div style={s.tabStrip}>
              {SECTIONS.map(sec => (
                <button
                  key={sec.id}
                  className="hr-press"
                  style={{
                    ...s.tabBtn,
                    background: activeSection === sec.id ? `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})` : C.wood,
                    borderColor: C.edge,
                    color: activeSection === sec.id ? C.ink : C.textOnDark,
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
                  className="hr-press"
                  style={{
                    ...s.sideBtn,
                    background: activeSection === sec.id ? `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})` : 'transparent',
                    borderLeft: activeSection === sec.id ? `4px solid ${C.edge}` : '4px solid transparent',
                    color: activeSection === sec.id ? C.ink : C.textOnDark,
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
    background: backdrop,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT,
    padding: isMobile ? '0' : '16px', boxSizing: 'border-box',
  },
  modal: {
    ...panel,
    width: isMobile ? '100vw' : '92vw', maxWidth: 820,
    height: isMobile ? '100dvh' : '88vh', maxHeight: isMobile ? '100dvh' : 680,
    border: isMobile ? 'none' : panel.border,
    borderRadius: isMobile ? 0 : 24, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', boxShadow: isMobile ? 'none' : panel.boxShadow,
    // Tam ekranda (mobil) başlık ve alt kenar güvenli alanda kalsın
    paddingBottom: isMobile ? BOTTOM_SPACE : 0,
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: isMobile ? `${topPlus(12)} 16px 12px` : '14px 20px',
    background: C.wood, borderBottom: `4px solid ${C.edge}`, flexShrink: 0,
  },
  headerTitle: { ...titleText(isMobile ? 22 : 24) },
  closeBtn: { ...btn.icon, width: 44, height: 44, fontSize: 18, background: C.woodDk },
  // ── Mobil yatay sekme şeridi ──
  tabStrip: {
    display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0,
    padding: '10px 12px', background: C.woodDk, borderBottom: `4px solid ${C.edge}`,
    WebkitOverflowScrolling: 'touch',
  },
  tabBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: '8px 12px', minWidth: 66, minHeight: 48, flexShrink: 0,
    border: '3px solid', borderRadius: 12, cursor: 'pointer', boxShadow: `0 3px 0 ${C.edge}`, '--hr-edge': C.edge,
    fontFamily: FONT, fontWeight: 800,
  },
  tabText: { fontSize: 11, letterSpacing: 0.3, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' },
  // ── Masaüstü kenar çubuğu ──
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 180, minWidth: 140, background: C.woodDk, borderRight: `4px solid ${C.edge}`,
    display: 'flex', flexDirection: 'column', gap: 2,
    padding: '10px 0', overflowY: 'auto',
  },
  sideBtn: {
    display: 'flex', alignItems: 'center', gap: 8, minHeight: 44,
    padding: '10px 16px', border: 'none', cursor: 'pointer',
    fontFamily: FONT, fontSize: 12, letterSpacing: 0.5, textAlign: 'left',
  },
  sideBtnIcon: { fontSize: 16, minWidth: 20 },
  sideBtnText: { fontWeight: 800 },
  // ── İçerik ──
  content: { flex: 1, overflowY: 'auto', padding: isMobile ? '16px 16px calc(24px + env(safe-area-inset-bottom,0px))' : '18px 22px', WebkitOverflowScrolling: 'touch' },
  sectionTitle: {
    fontFamily: DISPLAY, fontSize: isMobile ? 22 : 22, letterSpacing: 1, color: C.ink,
    marginBottom: 16, paddingBottom: 10,
    borderBottom: `3px dashed ${C.inkSoft}`,
  },
  bodyText: {
    color: C.ink, fontWeight: 700, fontSize: isMobile ? 14 : 13, lineHeight: 1.75,
    margin: '0 0 14px',
  },
  listBlock: { ...tile, padding: '10px 12px', marginBottom: 14 },
  listTitle: {
    fontFamily: DISPLAY, fontSize: isMobile ? 15 : 14, letterSpacing: 1, color: C.woodDk,
    marginBottom: 8, textTransform: 'uppercase',
  },
  ul: { margin: 0, paddingLeft: 20 },
  li: { color: C.ink, fontWeight: 700, fontSize: isMobile ? 13.5 : 12.5, lineHeight: 1.85, marginBottom: 2 },
  tableWrap: { marginBottom: 18, overflow: 'hidden' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: `3px solid ${C.edge}`, borderRadius: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 12 : 11 },
  th: {
    background: C.wood, color: C.textOnDark, fontFamily: DISPLAY, fontWeight: 400,
    padding: isMobile ? '8px 8px' : '7px 10px', textAlign: 'left', letterSpacing: 0.5,
    borderBottom: `3px solid ${C.edge}`, whiteSpace: 'nowrap',
  },
  td: {
    padding: isMobile ? '8px 8px' : '7px 10px', color: C.ink, fontWeight: 700, background: C.creamDk,
    borderBottom: `2px solid ${C.cream}`, fontSize: isMobile ? 12.5 : 12, whiteSpace: 'nowrap',
  },
  cardsGrid: {
    display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
    gap: 10, marginBottom: 14,
  },
  mapCard: { ...tile, border: `3px solid ${C.edge}`, borderLeftWidth: 8, padding: '11px 10px' },
  mapCardIcon: { fontSize: 24 },
  mapCardName: { fontFamily: DISPLAY, fontSize: 14, letterSpacing: 1, color: C.ink, marginTop: 6 },
  mapCardSub: { fontSize: 11, fontWeight: 800, color: C.inkSoft, marginTop: 3 },
  mapCardDesc: { fontSize: 11.5, fontWeight: 700, color: C.ink, marginTop: 6, lineHeight: 1.5 },
  stagesWrap: { marginBottom: 18 },
  stagesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  stageCard: { ...tile, border: `3px solid ${C.edge}`, borderLeftWidth: 8, padding: '10px 12px' },
  stageName: { fontFamily: DISPLAY, fontSize: 15, letterSpacing: 1, color: C.ink, marginBottom: 6 },
  stageRow: { fontSize: 12, fontWeight: 700, color: C.ink, lineHeight: 1.8 },
};
