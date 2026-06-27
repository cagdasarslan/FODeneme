import { useEffect } from 'react';
import { controlsState } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';

// Kaydırma kontrolü: sağa/sola kaydır → şerit değiştir, yukarı kaydır → zıpla.
// Şerit değişimi ve zıplama "kenar tetikli" olduğundan, her kaydırmada
// ilgili kontrolü kısa bir darbe (pulse) olarak true→false yapıyoruz.
const SWIPE_THRESH = 34; // px — bu mesafeyi geçince kaydırma sayılır
const PULSE_MS     = 100;

function pulse(dir) {
  controlsState[dir] = true;
  setTimeout(() => { controlsState[dir] = false; }, PULSE_MS);
}

export default function TouchPad() {
  const phase = useGameStore(s => s.phase);

  useEffect(() => {
    if (phase !== 'playing') return;
    let sx = 0, sy = 0, tracking = false;

    const onStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      sx = t.clientX; sy = t.clientY; tracking = true;
    };
    const onMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) >= SWIPE_THRESH && Math.abs(dx) > Math.abs(dy)) {
        pulse(dx > 0 ? 'right' : 'left');
        sx = t.clientX; sy = t.clientY; // tek dokunuşta peş peşe kaydırmaya izin ver
      } else if (-dy >= SWIPE_THRESH && Math.abs(dy) > Math.abs(dx)) {
        pulse('jump');
        sx = t.clientX; sy = t.clientY;
      }
    };
    const onEnd = () => { tracking = false; };

    window.addEventListener('touchstart',  onStart, { passive: true });
    window.addEventListener('touchmove',   onMove,  { passive: true });
    window.addEventListener('touchend',    onEnd,   { passive: true });
    window.addEventListener('touchcancel', onEnd,   { passive: true });
    return () => {
      window.removeEventListener('touchstart',  onStart);
      window.removeEventListener('touchmove',   onMove);
      window.removeEventListener('touchend',    onEnd);
      window.removeEventListener('touchcancel', onEnd);
      controlsState.left = controlsState.right = controlsState.jump = false;
    };
  }, [phase]);

  if (phase !== 'playing') return null;
  return <div style={hint}>← → şerit&nbsp;&nbsp;·&nbsp;&nbsp;↑ zıpla</div>;
}

const hint = {
  position: 'fixed',
  bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'rgba(255,255,255,0.5)',
  fontFamily: 'monospace',
  fontSize: 12,
  letterSpacing: 1,
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 5000,
};
