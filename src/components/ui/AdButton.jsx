import { useState } from 'react';
import { showRewardedAds, REWARDED_AVAILABLE } from '@/services/AdService';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, FONT, DISPLAY, btn, titleText, backdrop } from '@/ui/theme';

// Ödüllü reklam butonu — N reklamı SIRAYLA gösterir, HEPSİ bitmeden ödül vermez.
// İzleme sırasında tam ekran "Reklam X/N" katmanı kalır (erken kapanmaz).
export default function AdButton({
  label, sub, ads = 1, onReward, color = '#7ce29a', disabled = false, compact = false,
}) {
  const [busy, setBusy] = useState(false);
  useLang();
  const [prog, setProg] = useState({ c: 0, t: 0 });

  // Reklam gösterilemiyorsa (reklam kimliği yok / yayın web sürümü) buton hiç
  // görünmez — reklam izlemeden ödül vermek politika ihlalidir.
  if (!REWARDED_AVAILABLE) return null;

  const handle = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setProg({ c: 1, t: ads });
    const ok = await showRewardedAds(ads, (c, t) => setProg({ c, t }));
    setBusy(false);
    if (ok) onReward?.();
  };

  return (
    <>
      <button
        onClick={handle}
        disabled={busy || disabled}
        className="hr-press"
        style={{ ...S.btn, ...(compact ? S.compact : {}), opacity: disabled ? 0.5 : 1 }}
      >
        <span style={S.main}>📺 {label}{ads > 1 ? ` (${t('{n} reklam', { n: ads })})` : ''}</span>
        {sub && <span style={S.sub}>{sub}</span>}
      </button>

      {busy && (
        <div style={S.overlay}>
          <div style={S.spinner}>📺</div>
          <div style={S.ovTitle}>{t('Reklam izleniyor')}</div>
          <div style={S.ovCount}>{prog.c} / {prog.t}</div>
          <div style={S.ovNote}>{t('Ödül için reklamların bitmesini bekleyin…')}</div>
        </div>
      )}
    </>
  );
}

// Not: `color` prop'u geriye dönük uyumluluk için kabul edilir; tema yeşil "ödül" butonu kullanır.
const S = {
  btn: {
    ...btn.success,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    width: '100%', minHeight: 48, padding: '8px 12px',
    textShadow: `0 2px 0 ${C.greenEdge}`,
    WebkitTapHighlightColor: 'transparent',
  },
  compact: { minHeight: 44, padding: '6px 10px', borderRadius: 12, boxShadow: `0 4px 0 ${C.greenEdge}` },
  main: { fontFamily: DISPLAY, fontSize: 15, letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase' },
  sub: { fontFamily: FONT, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textShadow: 'none' },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: backdrop,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT, gap: 8,
  },
  spinner: { fontSize: 56, animation: 'pulse 0.8s infinite alternate' },
  ovTitle: { ...titleText(24), textTransform: 'uppercase' },
  ovCount: { ...titleText(44, C.goldHi) },
  ovNote: { fontSize: 13, fontWeight: 800, color: C.cream, marginTop: 6, letterSpacing: 0.5, textAlign: 'center', padding: '0 16px' },
};
