import { useProgress } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, FONT, titleText } from '@/ui/theme';

export default function LoadingScreen() {
  useLang();
  const { progress, active } = useProgress();
  const [visible, setVisible]   = useState(true);
  const [opacity, setOpacity]   = useState(1);
  const timerRef = useRef(null);
  // Sahne artık tamamen kodla üretiliyor; yüklenecek dosya yoksa useProgress
  // hiç 100'e çıkmaz. Kısa bir bekleme sonunda hiçbir yükleme başlamadıysa
  // ya da yükleme takıldıysa ekranı yine de kapat.
  const [idleDone, setIdleDone] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => { const s = useProgress.getState(); if (!s.active) setIdleDone(true); }, 900);
    const b = setTimeout(() => setIdleDone(true), 12000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  useEffect(() => {
    // Once loading is fully done (active=false, progress=100), fade out
    if ((!active && progress >= 100) || idleDone) {
      clearTimeout(timerRef.current);
      // Small delay so the scene has one frame to render before we hide
      timerRef.current = setTimeout(() => {
        setOpacity(0);
        timerRef.current = setTimeout(() => setVisible(false), 500);
      }, 300);
    }
    return () => clearTimeout(timerRef.current);
  }, [active, progress, idleDone]);

  if (!visible) return null;

  const pct = idleDone ? 100 : Math.floor(progress);

  return (
    <div style={{ ...S.overlay, opacity }}>
      <div style={S.box}>
        <div style={S.horse}>🐴</div>
        <div style={S.title}>HORSE RUNNER</div>
        <div style={S.barTrack}>
          <div style={{ ...S.barFill, width: `${pct}%` }} />
        </div>
        <div style={S.pct}>{pct < 100 ? `${t('YÜKLENİYOR…')} %${pct}` : t('HAZIR!')}</div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: `radial-gradient(circle at 50% 40%, #3a2414, ${C.bgDeep})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    transition: 'opacity 0.5s ease',
    fontFamily: FONT,
    userSelect: 'none',
  },
  box: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 },
  horse: { fontSize: 72, animation: 'bounce 0.6s infinite alternate' },
  title: { ...titleText(36), letterSpacing: 3 },
  barTrack: {
    width: 280,
    height: 16,
    background: C.edgeDk,
    border: `3px solid ${C.edge}`,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})`,
    borderRadius: 999,
    transition: 'width 0.15s ease',
  },
  pct: { fontSize: 14, fontWeight: 800, letterSpacing: 2, color: C.gold },
};
