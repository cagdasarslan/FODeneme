import { useState, useEffect, useRef } from 'react';
import useGameStore from '@/store/useGameStore';
import { showRewardedAds, REWARDED_AVAILABLE } from '@/services/AdService';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, FONT, DISPLAY, btn, panel, titleText, backdrop } from '@/ui/theme';

// Çarpışma sonrası "devam et" ekranı:
//  - Havuçla devam et (maliyet her seferinde 3 kat artar)
//  - Reklam izleyerek devam et (gereken reklam sayısı her seferinde 3 kat artar)
//  - Vazgeç → gerçek game over
export default function ContinueOverlay() {
  useLang();
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

  // 3-2-1 geri sayım; 0'a inince devam (revive) işlemini tetikler.
  // Uygulama arka plandayken geri sayım DURUR — aksi halde at oyuncu
  // görmeden koşmaya başlıyordu.
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => {
    if (countdown <= 0 || hidden) return;
    const tm = setTimeout(() => {
      if (countdown === 1) pendingRef.current?.();
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(tm);
  }, [countdown, hidden]);

  if (phase !== 'crashed') return null;

  const cost = continueCost();
  const canAfford = carrots >= cost.carrots;
  const adOffered = REWARDED_AVAILABLE && cost.adAllowed;

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
          <div style={S.countText}>{t('Reklam izleniyor')}</div>
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
          <div style={S.countText}>{t('Hazır ol…')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.backdrop}>
      <div style={S.panel}>
        <div style={S.title}>{t('ÇARPTIN!')}</div>
        <div style={S.sub}>{t('Devam etmek ister misin?')}</div>

        <button
          className="hr-press"
          style={{ ...S.btn, ...S.carrotBtn, ...(canAfford ? {} : S.disabled) }}
          onClick={() => { if (canAfford) startCountdown(() => continueWithCarrots()); }}
        >
          <span style={S.btnMain}>🥕 {t('{n} havuçla devam et', { n: cost.carrots.toLocaleString() })}</span>
          <span style={S.btnSubText}>
            {canAfford ? `${t('Bakiye:')} ${carrots.toLocaleString()} 🥕` : t('Yetersiz havuç ({n})', { n: carrots.toLocaleString() })}
          </span>
        </button>

        {adOffered && (
          <button
            className="hr-press"
            style={{ ...S.btn, ...S.adBtn, ...(watching ? S.disabled : {}) }}
            onClick={handleAd}
          >
            <span style={S.btnMain}>📺 {t('Reklam izleyerek devam et')}</span>
            <span style={S.btnSubText}>{watching ? t('Reklam yükleniyor…') : t('İzleyerek ücretsiz devam et')}</span>
          </button>
        )}

        <button className="hr-press" style={S.giveUp} onClick={() => giveUp()} disabled={watching}>
          {t('VAZGEÇ')}
        </button>

        {reviveCount > 0 && (
          <div style={S.note}>{t('Bu koşuda {n}. devam — havuç maliyeti her seferinde 3 katına çıkar', { n: reviveCount })}</div>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 6000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: backdrop,
    padding: 16,
  },
  countWrap: { textAlign: 'center', fontFamily: FONT },
  countNum: { ...titleText(96, C.goldHi) },
  countText: { fontSize: 16, fontWeight: 800, letterSpacing: 1.5, color: C.cream, marginTop: 14, textTransform: 'uppercase' },
  panel: {
    ...panel,
    width: '100%', maxWidth: 360,
    padding: '22px 20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  title: { ...titleText(38, C.red), textTransform: 'uppercase', marginBottom: 2 },
  sub: { fontFamily: FONT, fontSize: 14, fontWeight: 800, color: C.inkSoft, marginBottom: 4 },
  btn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '10px 14px', minHeight: 56,
    width: '100%',
  },
  carrotBtn: { ...btn.primary },
  adBtn:     { ...btn.success, textShadow: `0 2px 0 ${C.greenEdge}` },
  disabled:  { opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(0.4)' },
  btnMain:    { fontFamily: DISPLAY, fontSize: 17, letterSpacing: 0.8, textTransform: 'uppercase' },
  btnSubText: { fontFamily: FONT, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textShadow: 'none' },
  giveUp: { ...btn.ghost, marginTop: 2, fontSize: 14, letterSpacing: 1, padding: 8, color: C.inkSoft },
  note: { fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: 0.3 },
};
