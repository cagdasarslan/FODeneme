import { useState } from 'react';

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
        <button style={ST.skip} onClick={finish}>ATLA ✕</button>

        {/* İçerik */}
        <div style={ST.iconWrap}>
          <span style={{ ...ST.icon, animation: ANIM[s.anim] }}>{s.icon}</span>
        </div>
        <div style={ST.title}>{s.title}</div>
        <div style={ST.lines}>
          {s.lines.map((l, i) => (
            <p key={i} style={ST.line}>{l}</p>
          ))}
        </div>
        {s.hint && <div style={ST.hint}>{s.hint}</div>}

        {/* İlerleme noktaları */}
        <div style={ST.dots}>
          {STEPS.map((_, i) => (
            <span key={i} style={{ ...ST.dot, background: i === step ? '#ffd700' : 'rgba(255,255,255,0.25)', width: i === step ? 22 : 8 }} />
          ))}
        </div>

        {/* Butonlar */}
        <div style={ST.btnRow}>
          {step > 0 && (
            <button style={ST.backBtn} onClick={() => setStep(step - 1)}>‹ GERİ</button>
          )}
          {isLast ? (
            <button style={ST.startBtn} onClick={finish}>HADİ BAŞLAYALIM! 🏁</button>
          ) : (
            <button style={ST.nextBtn} onClick={() => setStep(step + 1)}>İLERİ ›</button>
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
    background: 'radial-gradient(ellipse at center, rgba(18,18,40,0.97), rgba(6,6,14,0.99))',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--game-font)', padding: 16, boxSizing: 'border-box',
  },
  card: {
    position: 'relative',
    width: '100%', maxWidth: 400,
    background: 'linear-gradient(165deg, rgba(20,20,44,0.96), rgba(10,10,22,0.98))',
    border: '1px solid rgba(255,215,0,0.28)', borderRadius: 18,
    padding: '34px 22px 22px', textAlign: 'center',
    boxShadow: '0 12px 60px rgba(0,0,0,0.7), 0 0 90px rgba(255,215,0,0.05)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  skip: {
    position: 'absolute', top: 12, right: 12,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
    color: 'rgba(255,255,255,0.55)', borderRadius: 8, padding: '6px 12px',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--game-font)', letterSpacing: 1,
  },
  iconWrap: {
    height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: 62, display: 'inline-block', lineHeight: 1 },
  title: {
    fontSize: 22, fontWeight: 800, letterSpacing: 3, color: '#ffd700',
    marginBottom: 14,
  },
  lines: { marginBottom: 6 },
  line: {
    color: 'rgba(255,255,255,0.82)', fontSize: 14.5, lineHeight: 1.55,
    margin: '0 0 8px',
  },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, marginBottom: 4 },
  dots: {
    display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
    margin: '18px 0 16px',
  },
  dot: { height: 8, borderRadius: 4, transition: 'all 0.2s' },
  btnRow: { display: 'flex', gap: 10, width: '100%', justifyContent: 'center' },
  backBtn: {
    padding: '13px 18px', fontSize: 14, fontFamily: 'var(--game-font)', fontWeight: 700, letterSpacing: 1,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
  },
  nextBtn: {
    flex: 1, padding: '13px 20px', fontSize: 15, fontFamily: 'var(--game-font)', fontWeight: 800, letterSpacing: 2,
    background: 'linear-gradient(135deg,#e8b84b,#c8881b)', border: 'none',
    borderRadius: 10, cursor: 'pointer', color: '#1a0a00',
    boxShadow: '0 4px 16px rgba(232,184,75,0.35)',
  },
  startBtn: {
    flex: 1, padding: '14px 20px', fontSize: 15, fontFamily: 'var(--game-font)', fontWeight: 800, letterSpacing: 1.5,
    background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', border: 'none',
    borderRadius: 10, cursor: 'pointer', color: '#1a0a00',
    boxShadow: '0 4px 20px rgba(255,159,0,0.45)',
  },
};
