import { useProgress } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';

export default function LoadingScreen() {
  const { progress, active } = useProgress();
  const [visible, setVisible]   = useState(true);
  const [opacity, setOpacity]   = useState(1);
  const timerRef = useRef(null);

  useEffect(() => {
    // Once loading is fully done (active=false, progress=100), fade out
    if (!active && progress >= 100) {
      clearTimeout(timerRef.current);
      // Small delay so the scene has one frame to render before we hide
      timerRef.current = setTimeout(() => {
        setOpacity(0);
        timerRef.current = setTimeout(() => setVisible(false), 500);
      }, 300);
    }
    return () => clearTimeout(timerRef.current);
  }, [active, progress]);

  if (!visible) return null;

  const pct = Math.floor(progress);

  return (
    <div style={{ ...S.overlay, opacity }}>
      <div style={S.box}>
        <div style={S.horse}>🐴</div>
        <div style={S.title}>HORSE RUNNER</div>
        <div style={S.barTrack}>
          <div style={{ ...S.barFill, width: `${pct}%` }} />
        </div>
        <div style={S.pct}>{pct < 100 ? `YÜKLENİYOR… %${pct}` : 'HAZIR!'}</div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: '#0a0a14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    transition: 'opacity 0.5s ease',
    fontFamily: 'var(--game-font)',
    userSelect: 'none',
  },
  box: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
  },
  horse: {
    fontSize: 72,
    animation: 'bounce 0.6s infinite alternate',
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 6,
    color: '#fff',
    textShadow: '0 0 20px rgba(255,200,50,0.5)',
  },
  barTrack: {
    width: 280,
    height: 8,
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #c8881b, #f5d060)',
    borderRadius: 4,
    transition: 'width 0.15s ease',
  },
  pct: {
    fontSize: 12,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.5)',
  },
};
