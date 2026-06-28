import { useState } from 'react';
import { showRewardedAds } from '@/services/AdService';

// Ödüllü reklam butonu — N reklamı SIRAYLA gösterir, HEPSİ bitmeden ödül vermez.
// İzleme sırasında tam ekran "Reklam X/N" katmanı kalır (erken kapanmaz).
export default function AdButton({
  label, sub, ads = 1, onReward, color = '#7ce29a', disabled = false, compact = false,
}) {
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ c: 0, t: 0 });

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
        style={{ ...S.btn, ...(compact ? S.compact : {}), borderColor: color, color, opacity: disabled ? 0.4 : 1 }}
      >
        <span style={S.main}>📺 {label}{ads > 1 ? ` (${ads} reklam)` : ''}</span>
        {sub && <span style={S.sub}>{sub}</span>}
      </button>

      {busy && (
        <div style={S.overlay}>
          <div style={S.spinner}>📺</div>
          <div style={S.ovTitle}>Reklam izleniyor</div>
          <div style={S.ovCount}>{prog.c} / {prog.t}</div>
          <div style={S.ovNote}>Ödül için reklamların bitmesini bekleyin…</div>
        </div>
      )}
    </>
  );
}

const S = {
  btn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    width: '100%', minHeight: 44, padding: '8px 12px',
    background: 'rgba(60,180,90,0.12)', border: '2px solid', borderRadius: 10,
    cursor: 'pointer', fontFamily: 'monospace', transition: 'all 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  compact: { minHeight: 38, padding: '6px 10px', borderWidth: 1, borderRadius: 8 },
  main: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5, textAlign: 'center' },
  sub: { fontSize: 9, opacity: 0.75, letterSpacing: 1 },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'monospace', gap: 8,
  },
  spinner: { fontSize: 56, animation: 'pulse 0.8s infinite alternate' },
  ovTitle: { fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: 2 },
  ovCount: { fontSize: 40, fontWeight: 900, color: '#ffd54a', textShadow: '0 0 20px rgba(255,200,50,0.6)' },
  ovNote: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6, letterSpacing: 1 },
};
