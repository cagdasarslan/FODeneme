import { useState } from 'react';
import { showRewardedAds } from '@/services/AdService';

// Ödüllü reklam butonu — reklam(lar)ı gösterir, hepsi izlenirse onReward() çağırır.
// Mobil dokunmatik için yeterli yükseklik + net durum (yükleniyor) gösterir.
export default function AdButton({
  label, sub, ads = 1, onReward, color = '#7ce29a', disabled = false, compact = false,
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (busy || disabled) return;
    setBusy(true);
    const ok = await showRewardedAds(ads);
    setBusy(false);
    if (ok) onReward?.();
  };
  return (
    <button
      onClick={handle}
      disabled={busy || disabled}
      style={{
        ...S.btn,
        ...(compact ? S.compact : {}),
        borderColor: color,
        color,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={S.main}>📺 {busy ? 'Reklam yükleniyor…' : label}</span>
      {sub && !busy && <span style={S.sub}>{sub}</span>}
    </button>
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
};
