import { getLang } from '@/i18n';
// "Saddle & Wood" arayüz teması — tüm ekranların ortak renk ve buton stilleri.
// Kalın koyu kahve kenar + alt "taban" gölgesi = basılabilir ahşap/deri buton.
// Butonlara className="hr-press" verin (index.css: basınca çöker).

export const C = {
  edge:     '#5a3418', // kalın kenar ve taban gölgesi
  edgeDk:   '#3a2414',
  bgDeep:   '#2a1a0e', // ekran arkası
  wood:     '#a8672e', // ikincil buton
  woodDk:   '#7a4a1f',
  cream:    '#fff1d0', // panel/kart zemini
  creamDk:  '#f3dca8', // panel içi kutu
  ink:      '#5a3418', // krem üstü yazı
  inkSoft:  '#8a5a2a', // krem üstü ikincil yazı (4.5:1 krem üzerinde)
  gold:     '#f0c060',
  goldHi:   '#ffcf4a', // ana buton üst
  goldLo:   '#f0a020', // ana buton alt
  green:    '#3a9a48',
  greenHi:  '#5ac060',
  greenEdge:'#1e5a26',
  red:      '#c0392b',
  redEdge:  '#7a1e14',
  blue:     '#3a7ac0',
  blueEdge: '#1e4a7a',
  carrot:   '#ff8a1e',
  textOnDark: '#fff1d0',
};

export const FONT = 'var(--game-font)';
export const DISPLAY = 'var(--display-font)';

const base = (bg, edge, color, h = 4) => ({
  background: bg,
  border: `3px solid ${edge}`,
  boxShadow: `0 ${h}px 0 ${edge}`,
  color,
  borderRadius: 16,
  fontFamily: DISPLAY,
  letterSpacing: 1,
  cursor: 'pointer',
  '--hr-edge': edge,
});

// Buton varyantları (style objesi). Kullanım: style={{ ...btn.primary, width: 260 }}
export const btn = {
  primary:   base(`linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})`, C.edge, C.ink, 6),
  secondary: base(C.wood, C.edge, C.textOnDark),
  success:   base(`linear-gradient(180deg, ${C.greenHi}, ${C.green})`, C.greenEdge, '#fff', 6),
  danger:    base(C.red, C.redEdge, '#fff'),
  info:      base(C.blue, C.blueEdge, '#fff'),
  ghost:     { background: 'none', border: 'none', color: C.woodDk, fontFamily: FONT, fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', minHeight: 44 },
  icon:      { ...base(C.wood, C.edge, C.textOnDark), width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
};

// Krem panel (modal kartı)
export const panel = {
  background: C.cream,
  border: `4px solid ${C.edge}`,
  borderRadius: 24,
  boxShadow: `0 10px 0 ${C.edge}, 0 18px 40px rgba(0,0,0,0.45)`,
  color: C.ink,
  fontFamily: FONT,
};

// Panel içi kutu / satır
export const tile = {
  background: C.creamDk,
  borderRadius: 14,
  color: C.ink,
};

// Koyu "hap" etiket (rekor, hız vb.)
export const pill = {
  background: C.edge,
  color: C.gold,
  borderRadius: 999,
  padding: '5px 14px',
  fontFamily: FONT,
  fontWeight: 800,
};

// Başlık: krem yazı, kalın kahve kontur + taban gölgesi
export const titleText = (size = 40, color = C.cream) => ({
  fontFamily: DISPLAY,
  fontSize: size,
  color,
  fontWeight: 400,
  // paint-order: kontur dolgunun ALTINDA çizilir → ğ/ş/İ/ü gibi işaretler
  // konturla yenip "lekelenmez". Görünen dış kontur genişlik/2 olduğu için ×2.
  WebkitTextStroke: `${Math.max(3, Math.round(size / 9))}px ${C.edge}`,
  paintOrder: 'stroke fill',
  textShadow: `0 ${Math.max(3, Math.round(size / 10))}px 0 ${C.edge}`,
  lineHeight: 1.12,
  letterSpacing: 1,
});

// Ekran karartma (modal arkası)
export const backdrop = 'rgba(42,26,14,0.78)';

// Sayı biçimi — arayüzün her yerinde aynı: geçerli dile göre binlik ayırıcı
// (tr: 1.000 · en: 1,000). Dil değişince useLang ile yeniden çizilir.
export const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString(getLang() === 'en' ? 'en-US' : 'tr-TR');

// Hareket azaltma tercihi (yeni animasyonlar bunu dikkate alır)
export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
