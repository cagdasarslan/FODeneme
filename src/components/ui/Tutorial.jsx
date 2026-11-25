import { useState } from 'react';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, FONT, btn, panel, tile, titleText, backdrop } from '@/ui/theme';

// Tek seferlik ilk-oynayış eğitimi. localStorage 'intro_v1' ile bir kez gösterilir.
// Yeni oyuncuya oyunun amacını ve temel hamleleri adım adım tanıtır.
const STEPS = [
  {
    icon: '🐴',
    title: 'HOŞ GELDİN!',
    lines: [
      'Horse Runner\'a hoş geldin!',
      'Atın otomatik koşar — senin görevin engelleri aşıp olabildiğince uzağa gitmek.',
      'Ne kadar uzağa gidersen o kadar çok puan!',
    ],
    anim: 'bob',
  },
  {
    icon: '👈 👉',
    title: 'ŞERİT DEĞİŞTİR',
    lines: [
      'Yol 3 şeritten oluşur.',
      'Parmağını sağa veya sola KAYDIR → at o şeride geçer.',
      'Engellerden kaçmak için şerit değiştir.',
    ],
    hint: '(Klavye: ◄ ► veya A / D)',
    anim: 'slideLR',
  },
  {
    icon: '⬆️',
    title: 'ZIPLA',
    lines: [
      'Yukarı KAYDIR → atın zıplar.',
      'Yerdeki engellerin (fıçı, kaya, kaktüs...) ÜZERİNDEN atla.',
      'Havadayken bu engeller sana çarpamaz!',
    ],
    hint: '(Klavye: ↑ veya Space)',
    anim: 'jump',
  },
  {
    icon: '⬇️',
    title: 'EĞİL',
    lines: [
      'Aşağı KAYDIR → atın eğilir.',
      'Üstten geçen BARİYERLERİN altından eğilerek geç.',
      '⚠️ Bunları zıplayarak geçemezsin — mutlaka eğil!',
    ],
    hint: '(Klavye: ↓ veya S)',
    anim: 'crouch',
  },
  {
    icon: '🥕 ✨',
    title: 'TOPLA & GÜÇLEN',
    lines: [
      'Yoldaki havuçları topla — onlarla at, jokey ve yükseltme al.',
      'Ara sıra parlayan güçlendiriciler belirir: mıknatıs, kalkan, turbo, kanat...',
      'Üzerlerinden geç, güçlerini kullan!',
    ],
    anim: 'pulse',
  },
  {
    icon: '🏅',
    title: 'HEDEFLER & ÖDÜLLER',
    lines: [
      'Her haritada madalyalar kazan (🥉🥈🥇).',
      'Günlük görevler, giriş serisi ve İLK ADIMLAR rehberi seni ödüllendirir.',
      'Çiftlik\'te atını eğit, Ahır\'da yeni atlar yetiştir!',
      'Hazırsan başlayalım! 🏁',
    ],
    anim: 'bob',
  },
];

export default function Tutorial({ onClose }) {
  useLang();
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem('intro_v1', '1');
    onClose();
  };

  return (
    <div style={ST.overlay}>
      <style>{KEYFRAMES}</style>
      <div style={ST.card}>
        {/* Atla */}
        <button className="hr-press" style={ST.skip} onClick={finish}>{t('ATLA')} ✕</button>

        {/* İçerik */}
        <div style={ST.iconWrap}>
          <span style={{ ...ST.icon, animation: ANIM[s.anim] }}>{s.icon}</span>
        </div>
        <div style={ST.title}>{t(s.title)}</div>
        <div style={ST.lines}>
          {s.lines.map((l, i) => (
            <p key={i} style={ST.line}>{t(l)}</p>
          ))}
        </div>
        {s.hint && <div style={ST.hint}>{t(s.hint)}</div>}

        {/* İlerleme noktaları */}
        <div style={ST.dots}>
          {STEPS.map((_, i) => (
            <span key={i} style={{ ...ST.dot, background: i === step ? C.goldLo : C.creamDk, width: i === step ? 22 : 8 }} />
          ))}
        </div>

        {/* Butonlar */}
        <div style={ST.btnRow}>
          {step > 0 && (
            <button className="hr-press" style={ST.backBtn} onClick={() => setStep(step - 1)}>‹ {t('GERİ')}</button>
          )}
          {isLast ? (
            <button className="hr-press" style={ST.startBtn} onClick={finish}>{t('HADİ BAŞLAYALIM!')} 🏁</button>
          ) : (
            <button className="hr-press" style={ST.nextBtn} onClick={() => setStep(step + 1)}>{t('İLERİ')} ›</button>
          )}
        </div>
      </div>
    </div>
  );
}

const ANIM = {
  bob: 'tutBob 1.6s ease-in-out infinite',
  slideLR: 'tutSlide 1.6s ease-in-out infinite',
  jump: 'tutJump 1.3s ease-in-out infinite',
  crouch: 'tutCrouch 1.4s ease-in-out infinite',
  pulse: 'tutPulse 1.4s ease-in-out infinite',
};

const KEYFRAMES = `
@keyframes tutBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes tutSlide { 0%,100%{transform:translateX(-16px)} 50%{transform:translateX(16px)} }
@keyframes tutJump { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-22px)} 55%{transform:translateY(-22px)} }
@keyframes tutCrouch { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(0.7) translateY(8px)} }
@keyframes tutPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }
`;

const ST = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 20000,
    background: backdrop,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT, padding: 16, boxSizing: 'border-box',
  },
  card: {
    ...panel,
    position: 'relative',
    width: '100%', maxWidth: 400,
    padding: '38px 22px 24px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  skip: {
    ...btn.secondary,
    position: 'absolute', top: 10, right: 10,
    minHeight: 44, borderRadius: 12, padding: '6px 12px',
    fontSize: 13,
  },
  iconWrap: {
    height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: 62, display: 'inline-block', lineHeight: 1 },
  title: { ...titleText(30), textTransform: 'uppercase', marginBottom: 16 },
  lines: { marginBottom: 6 },
  line: {
    color: C.ink, fontSize: 15, fontWeight: 700, lineHeight: 1.5,
    margin: '0 0 8px',
  },
  hint: { ...tile, color: C.inkSoft, fontSize: 12, fontWeight: 800, padding: '4px 12px', marginTop: 2, marginBottom: 4 },
  dots: {
    display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
    margin: '18px 0 16px',
  },
  dot: { height: 10, borderRadius: 5, border: `2px solid ${C.edge}`, transition: 'all 0.2s' },
  btnRow: { display: 'flex', gap: 10, width: '100%', justifyContent: 'center' },
  backBtn: { ...btn.secondary, padding: '12px 18px', fontSize: 16, minHeight: 52, textTransform: 'uppercase' },
  nextBtn: { ...btn.primary, flex: 1, padding: '12px 20px', fontSize: 18, minHeight: 52, textTransform: 'uppercase' },
  startBtn: { ...btn.primary, flex: 1, padding: '12px 20px', fontSize: 18, minHeight: 52, textTransform: 'uppercase' },
};
