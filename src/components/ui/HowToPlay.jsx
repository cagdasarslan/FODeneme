import { useState } from 'react';

const SECTIONS = [
  {
    id: 'gameplay',
    icon: '🎮',
    title: 'NASIL OYNANIR',
    content: [
      {
        type: 'text',
        text: 'Horse Runner, sonsuz koşu türünde 3D bir at yarışı oyunudur. Atın otomatik koşar, senin görevin engelleri aşmak ve olabildiğince uzağa gitmektir.',
      },
      {
        type: 'list',
        title: 'Kontroller',
        items: [
          '◄ / A tuşu — Sola geç',
          '► / D tuşu — Sağa geç',
          'Mobilde — Ekrana sol / sağ dokun',
          'Oyunu OYNA butonuna basarak başlatırsın',
        ],
      },
      {
        type: 'list',
        title: 'Skor',
        items: [
          'Her metre 1 puan kazandırır',
          'Ne kadar uzağa gidersen o kadar yüksek skor',
          'Her haritanın ayrı en yüksek skoru saklanır',
          'Liderlik tablosunda diğer oyuncularla yarış!',
        ],
      },
    ],
  },
  {
    id: 'adrenaline',
    icon: '⚡',
    title: 'ADRENALİN',
    content: [
      {
        type: 'text',
        text: 'Adrenalin, engellere yakın geçince dolan özel bir gösterge. Dolunca ekran sallanır, kamera öne eğilir ve oyun daha yoğun hissetttirir.',
      },
      {
        type: 'list',
        title: 'Nasıl Dolar?',
        items: [
          'Bir engele çok yakın geçersen +20 adrenalin kazanırsın',
          'Zamanla yavaşça azalır',
          '100\'e ulaşınca maksimum etki başlar',
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
          { icon: '🌿', name: 'AT YARIŞI', sub: 'Çiftlik / Pist', desc: 'Başlangıç haritası. Fıçı, saman balyası ve kütük yığını engelleri.', color: '#6aaa44' },
          { icon: '🏙️', name: 'ŞEHİR', sub: 'Kent Sokakları', desc: 'Şehir haritası. Araba, taksi, polis arabası ve çöp kutusu engelleri.', color: '#4a90d9' },
          { icon: '🌵', name: 'ÇÖLLER', sub: 'Mars Kolonisi', desc: 'Kırmızı Mars zemini, roketler ve uzay binaları. Kaktüs ve kaya engelleri.', color: '#d4a020' },
          { icon: '🚀', name: 'UZAY KOLONİSİ', sub: "Mars'ta At Yarışı", desc: 'Uzay temalı harita. Rover, varil, meteor ve platform engelleri.', color: '#aa44ff' },
        ],
      },
    ],
  },
  {
    id: 'horses',
    icon: '🐴',
    title: 'ATLAR & YÜKSELTMELERİ',
    content: [
      {
        type: 'text',
        text: 'Üç farklı at satın alabilir ve her birini 5 seviyeye kadar yükseltebilirsin. Yükseltme maliyeti seviyeye göre artar.',
      },
      {
        type: 'table',
        headers: ['At', 'Fiyat', 'Hız', 'Manevra', 'Zıplama', 'Max Hız'],
        rows: [
          ['🟤 ANADOLU ALASI', 'Ücretsiz', 'x1.0', 'x1.0', 'x1.0', '40'],
          ['⬛ KARAYEL', '250 🥕', 'x1.4', 'x0.9', 'x1.1', '60'],
          ['⬜ AKKOR KÜHEYLAN', '600 🥕', 'x1.8', 'x1.3', 'x1.5', '80'],
        ],
      },
      {
        type: 'list',
        title: 'Yükseltme',
        items: [
          'Her at maksimum 5. seviyeye yükseltilebilir',
          'Seviye 2: 150 🥕 | Seviye 3: 225 🥕 | Seviye 4: 300 🥕 | Seviye 5: 375 🥕',
          'Yükseltme her seviyede atın tüm statlarını güçlendirir',
          'Yükseltmeler MAĞAZA → At sekmesinden yapılır',
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
        text: 'Jokeyin sadece görsel etki yapar, istatistikleri değiştirmez. İstediğin stili seç!',
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
        text: 'Havuçlar oyunun para birimidir. Yolda koşarken toplarsın, mağazada harcarsın.',
      },
      {
        type: 'list',
        title: 'Nasıl Kazanılır?',
        items: [
          'Koşu sırasında yolda beliren turuncu havuçları toplayarak',
          'Süper Nal güçlendiricisine basan at kısaca otomatik havuç toplar',
          'Ahır bakım aksiyonları (besleme, tımar, antrenman) da puan katkısı sağlar',
        ],
      },
    ],
  },
  {
    id: 'superhal',
    icon: '✨',
    title: 'SÜPER NAL',
    content: [
      {
        type: 'text',
        text: 'Yolda zaman zaman parlayan altın bir at nalı belirir. Buna basarsan Süper Nal moduna girersin!',
      },
      {
        type: 'list',
        title: 'Süper Nal Efektleri',
        items: [
          'Kısa süreliğine çarpışmazlık — engellere çarpmaz',
          'Otomatik havuç toplama',
          'Görsel efekt: atın çevresinde altın aura',
          'Süre dolunca normal moda döner',
        ],
      },
    ],
  },
  {
    id: 'hara',
    icon: '🐣',
    title: 'AHIR & YAVRU AT SİSTEMİ',
    content: [
      {
        type: 'text',
        text: 'AHIR butonundan iki atı çiftleştirip yavru üretebilirsin. Yavru büyüdükçe koşu performansına bonus katkı sağlar.',
      },
      {
        type: 'list',
        title: 'Çiftleştirme',
        items: [
          'Her çiftleştirme 300 🥕 tutar',
          'Çiftleştirmeden sonra 6 saat bekleme süresi uygulanır',
          'Ahırda başlangıçta 2 yuva bulunur; ek yuva 1.000 🥕\'e satın alınır',
          'Mağazadan hazır Tier 1 yavru 200 🥕, Tier 2 yavru 500 🥕\'e alınabilir',
        ],
      },
      {
        type: 'stages',
        title: 'Büyüme Aşamaları',
        items: [
          { stage: 'TAY', duration: '4 saat', bp: '100 BP hedef', scale: '%50 boy', gate: 'Bağ gerekmez', color: '#ffcc44' },
          { stage: 'YAVRU', duration: '8 saat', bp: '250 BP hedef', scale: '%65 boy', gate: '2 bağ gerek', color: '#ff9944' },
          { stage: 'GENÇ', duration: '12 saat', bp: '500 BP hedef', scale: '%80 boy', gate: '2 bağ gerek', color: '#44ccff' },
          { stage: 'YETİŞKİN', duration: 'Tam büyük', bp: 'Tamamlandı', scale: '%100 boy', gate: 'Tam güç', color: '#44ff88' },
        ],
      },
      {
        type: 'list',
        title: 'Bakım Aksiyonları',
        items: [
          '🌾 BESLE — 15 🥕 · Tokluk +40, Büyüme Puanı +5 (günde max 4 kez)',
          '✂️ TIMAR — Ücretsiz · Mutluluk +30, Büyüme Puanı +5, Bağ +1 (4 saatte bir)',
          '🏃 ANTREN — Ücretsiz · Büyüme Puanı +20, Bağ +1 (24 saatte bir)',
          'Tokluk 6 saatte sıfırlanır, Mutluluk 18 saatte sıfırlanır — düzenli bak!',
        ],
      },
      {
        type: 'list',
        title: 'Büyüme Puanı (BP)',
        items: [
          'Her 500 metre koşuda +10 BP kazanırsın',
          'BP yeterince dolunca ve bağ şartı sağlanınca bir sonraki aşamaya geçilir',
          'Yetişkin ata ulaşınca MAĞAZA\'da aktif at olarak seçebilirsin',
        ],
      },
      {
        type: 'list',
        title: 'Özel Yetenekler (Trait)',
        items: [
          '%5 ihtimalle yavru özel bir yetenek ile doğar',
          '🏆 Şampiyon — Tüm statlar +%10',
          '💨 Rüzgar — Max hız +5',
          '🌙 Sıçrayan — Zıplama gücü +%15',
        ],
      },
    ],
  },
  {
    id: 'daily',
    icon: '🎯',
    title: 'GÜNLÜK HEDEF',
    content: [
      {
        type: 'text',
        text: 'Her gün ana menüde bir günlük hedef belirir. Tamamlayınca ilerleme çubuğu yeşile döner.',
      },
      {
        type: 'list',
        title: 'Hedef Örnekleri',
        items: [
          '500 metre koş',
          '1000 metre koş',
          '10 havuç topla',
          '3 koşu tamamla',
        ],
      },
    ],
  },
];

function renderContent(block, idx) {
  switch (block.type) {
    case 'text':
      return <p key={idx} style={s.bodyText}>{block.text}</p>;

    case 'list':
      return (
        <div key={idx} style={s.listBlock}>
          {block.title && <div style={s.listTitle}>{block.title}</div>}
          <ul style={s.ul}>
            {block.items.map((item, i) => (
              <li key={i} style={s.li}>{item}</li>
            ))}
          </ul>
        </div>
      );

    case 'table':
      return (
        <div key={idx} style={s.tableWrap}>
          {block.title && <div style={s.listTitle}>{block.title}</div>}
          <div style={s.tableScroll}>
            <table style={s.table}>
              <thead>
                <tr>
                  {block.headers.map((h, i) => <th key={i} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j} style={s.td}>{cell}</td>)}
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
              <div style={{ ...s.mapCardName, color: item.color }}>{item.name}</div>
              <div style={s.mapCardSub}>{item.sub}</div>
              <div style={s.mapCardDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      );

    case 'stages':
      return (
        <div key={idx} style={s.stagesWrap}>
          {block.title && <div style={s.listTitle}>{block.title}</div>}
          <div style={s.stagesGrid}>
            {block.items.map((item, i) => (
              <div key={i} style={{ ...s.stageCard, borderColor: item.color }}>
                <div style={{ ...s.stageName, color: item.color }}>{item.stage}</div>
                <div style={s.stageRow}>⏱ {item.duration}</div>
                <div style={s.stageRow}>📊 {item.bp}</div>
                <div style={s.stageRow}>📏 {item.scale}</div>
                <div style={s.stageRow}>🔒 {item.gate}</div>
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
  const [activeSection, setActiveSection] = useState('gameplay');
  const section = SECTIONS.find(s => s.id === activeSection);

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerTitle}>📖 OYUN REHBERİ</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          {/* Sidebar */}
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
                <span style={s.sideBtnText}>{sec.title}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={s.content}>
            <div style={s.sectionTitle}>
              {section.icon} {section.title}
            </div>
            {section.content.map((block, i) => renderContent(block, i))}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'monospace',
  },
  modal: {
    width: '92vw', maxWidth: 820,
    height: '88vh', maxHeight: 680,
    background: 'linear-gradient(160deg,rgba(12,12,28,0.97) 0%,rgba(8,8,18,0.99) 100%)',
    border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: 14, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', boxShadow: '0 12px 50px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 16, fontWeight: 700, letterSpacing: 3, color: '#ffd700' },
  closeBtn: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
    fontSize: 14, fontFamily: 'monospace',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 180, minWidth: 140, borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', flexDirection: 'column', gap: 2,
    padding: '10px 0', overflowY: 'auto',
  },
  sideBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', border: 'none', cursor: 'pointer',
    fontFamily: 'monospace', fontSize: 11, letterSpacing: 1,
    transition: 'all 0.12s', textAlign: 'left',
  },
  sideBtnIcon: { fontSize: 16, minWidth: 20 },
  sideBtnText: { fontWeight: 700 },
  content: { flex: 1, overflowY: 'auto', padding: '18px 22px' },
  sectionTitle: {
    fontSize: 15, fontWeight: 700, letterSpacing: 3, color: '#ffd700',
    marginBottom: 16, paddingBottom: 10,
    borderBottom: '1px solid rgba(255,215,0,0.2)',
  },
  bodyText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.8,
    margin: '0 0 14px',
  },
  listBlock: { marginBottom: 16 },
  listTitle: {
    fontSize: 11, letterSpacing: 2, color: 'rgba(255,215,0,0.7)',
    fontWeight: 700, marginBottom: 8, textTransform: 'uppercase',
  },
  ul: { margin: 0, paddingLeft: 20 },
  li: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 2.0, letterSpacing: 0.5 },
  tableWrap: { marginBottom: 16, overflow: 'hidden' },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: {
    background: 'rgba(255,215,0,0.08)', color: 'rgba(255,215,0,0.8)',
    padding: '7px 10px', textAlign: 'left', letterSpacing: 1,
    borderBottom: '1px solid rgba(255,215,0,0.2)',
  },
  td: {
    padding: '7px 10px', color: 'rgba(255,255,255,0.7)',
    borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12,
  },
  cardsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10, marginBottom: 10,
  },
  mapCard: {
    border: '1px solid', borderRadius: 10, padding: '12px',
    background: 'rgba(255,255,255,0.03)',
  },
  mapCardIcon: { fontSize: 24 },
  mapCardName: { fontSize: 11, fontWeight: 700, letterSpacing: 2, marginTop: 6 },
  mapCardSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  mapCardDesc: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 1.6 },
  stagesWrap: { marginBottom: 16 },
  stagesGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 },
  stageCard: {
    border: '1px solid', borderRadius: 8, padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
  },
  stageName: { fontSize: 13, fontWeight: 700, letterSpacing: 2, marginBottom: 6 },
  stageRow: { fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.9 },
};
