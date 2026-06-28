import { useState, useEffect, useRef } from 'react';
import useGameStore from '@/store/useGameStore';
import { showRewardedAds } from '@/services/AdService';

// Çarpışma sonrası "devam et" ekranı:
//  - Havuçla devam et (maliyet her seferinde 3 kat artar)
//  - Reklam izleyerek devam et (gereken reklam sayısı her seferinde 3 kat artar)
//  - Vazgeç → gerçek game over
export default function ContinueOverlay() {
  const phase    = useGameStore(s => s.phase);
  const carrots  = useGameStore(s => s.carrots);
  const reviveCount = useGameStore(s => s.reviveCount);
  const continueCost       = useGameStore(s => s.continueCost);
  const continueWithCarrots = useGameStore(s => s.continueWithCarrots);
  const continueWithAd      = useGameStore(s => s.continueWithAd);
  const giveUp              = useGameStore(s => s.giveUp);

  const [watching, setWatching] = useState(false);
  const [adProg, setAdProg] = useState({ c: 0, t: 0 });
  const [countdown, setCountdown] = useState(0);
  const pendingRef = useRef(null);

  // 3-2-1 geri sayım; 0'a inince devam (revive) işlemini tetikler
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => {
      if (countdown === 1) pendingRef.current?.();
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (phase !== 'crashed') return null;

  const cost = continueCost();
  const canAfford = carrots >= cost.carrots;

  const startCountdown = (action) => { pendingRef.current = action; setCountdown(3); };

  const handleAd = async () => {
    if (watching || countdown > 0) return;
    setWatching(true);
    setAdProg({ c: 1, t: cost.ads });
    const ok = await showRewardedAds(cost.ads, (c, t) => setAdProg({ c, t }));
    setWatching(false);
    if (ok) startCountdown(() => continueWithAd());
  };

  // Reklam izleme ekranı — tüm reklamlar bitene kadar kalır
  if (watching) {
    return (
      <div style={S.backdrop}>
        <div style={S.countWrap}>
          <div style={{ fontSize: 56 }}>📺</div>
          <div style={S.countText}>Reklam izleniyor</div>
          <div style={S.countNum}>{adProg.c} / {adProg.t}</div>
        </div>
      </div>
    );
  }

  // Geri sayım ekranı
  if (countdown > 0) {
    return (
      <div style={S.backdrop}>
        <div style={S.countWrap}>
          <div style={S.countNum}>{countdown}</div>
          <div style={S.countText}>Hazır ol…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.backdrop}>
      <div style={S.panel}>
        <div style={S.title}>ÇARPTIN!</div>
        <div style={S.sub}>Devam etmek ister misin?</div>

        <button
          style={{ ...S.btn, ...S.carrotBtn, ...(canAfford ? {} : S.disabled) }}
          onClick={() => { if (canAfford) startCountdown(() => continueWithCarrots()); }}
        >
          <span style={S.btnMain}>🥕 {cost.carrots.toLocaleString()} havuçla devam et</span>
          <span style={S.btnSubText}>
            {canAfford ? `Bakiye: ${carrots.toLocaleString()} 🥕` : `Yetersiz havuç (${carrots.toLocaleString()})`}
          </span>
        </button>

        <button
          style={{ ...S.btn, ...S.adBtn, ...(watching ? S.disabled : {}) }}
          onClick={handleAd}
        >
          <span style={S.btnMain}>📺 Reklam izle ({cost.ads} reklam)</span>
          <span style={S.btnSubText}>{watching ? 'Reklam yükleniyor…' : 'İzleyerek ücretsiz devam et'}</span>
        </button>

        <button style={S.giveUp} onClick={() => giveUp()} disabled={watching}>
          VAZGEÇ
        </button>

        {reviveCount > 0 && (
          <div style={S.note}>Bu koşuda {reviveCount}. devam — maliyet her seferinde 3 katına çıkar</div>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 6000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
    padding: 16,
  },
  countWrap: { textAlign: 'center', fontFamily: 'monospace' },
  countNum: { fontSize: 96, fontWeight: 900, color: '#ffd54a', textShadow: '0 0 30px rgba(255,200,50,0.7)', lineHeight: 1 },
  countText: { fontSize: 14, letterSpacing: 3, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  panel: {
    width: '100%', maxWidth: 360,
    background: 'linear-gradient(160deg, rgba(18,18,34,0.97), rgba(10,10,20,0.98))',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
    padding: '22px 20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: '0 10px 50px rgba(0,0,0,0.7)',
  },
  title: {
    fontFamily: 'monospace', fontSize: 28, fontWeight: 900, letterSpacing: 3,
    color: '#ff4422', textShadow: '0 0 18px rgba(255,68,34,0.6)',
  },
  sub: { fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  btn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    border: '2px solid', borderRadius: 10, padding: '12px 14px',
    cursor: 'pointer', width: '100%', transition: 'all 0.15s',
    fontFamily: 'monospace',
  },
  carrotBtn: { background: 'rgba(255,165,0,0.14)', borderColor: 'rgba(255,165,0,0.5)', color: '#ffcf66' },
  adBtn:     { background: 'rgba(60,180,90,0.14)', borderColor: 'rgba(80,200,110,0.5)', color: '#7ce29a' },
  disabled:  { opacity: 0.4, cursor: 'not-allowed' },
  btnMain:    { fontSize: 15, fontWeight: 700, letterSpacing: 1 },
  btnSubText: { fontSize: 10, opacity: 0.75, letterSpacing: 1 },
  giveUp: {
    marginTop: 4, background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', fontSize: 12,
    letterSpacing: 2, cursor: 'pointer', padding: 8,
  },
  note: { fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 },
};
