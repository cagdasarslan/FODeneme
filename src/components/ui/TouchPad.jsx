import { useEffect } from 'react';
import { controlsState } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';

// Sürükleyerek yönlendirme: ekranın HERHANGİ bir yerine parmağını koyup
// yatay sürükle → at şerit takip eder (geri sürüklersen geri döner).
// Yukarı sürükle → zıpla. Parmağı kaldırmaya gerek yok.
const LANE_DRAG_PX = 48;  // bir şerit değiştirmek için yatay sürükleme mesafesi
const JUMP_DRAG_PX = 44;  // zıplamak için yukarı sürükleme mesafesi
const PULSE_MS     = 90;

function pulse(dir) {
  controlsState[dir] = true;
  setTimeout(() => { controlsState[dir] = false; }, PULSE_MS);
}

export default function TouchPad() {
  const phase = useGameStore(s => s.phase);

  useEffect(() => {
    if (phase !== 'playing') return;
    let startX = 0, startY = 0;
    let laneStep = 0;     // bu dokunuşta uygulanan net şerit kayması
    let jumped = false;   // bu dokunuşta zıplandı mı
    let tracking = false;

    const onStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX; startY = t.clientY;
      laneStep = 0; jumped = false; tracking = true;
    };
    const onMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Yatay sürükleme → şerit (mutlak: parmağın net konumuna göre)
      const desired = Math.round(dx / LANE_DRAG_PX);
      if (desired !== laneStep) {
        const diff = desired - laneStep;
        const dir = diff > 0 ? 'right' : 'left';
        for (let i = 0; i < Math.abs(diff); i++) pulse(dir);
        laneStep = desired;
      }

      // Yukarı sürükleme → zıpla (dokunuş başına bir kez)
      if (!jumped && -dy >= JUMP_DRAG_PX) {
        pulse('jump');
        jumped = true;
      }
    };
    const onEnd = () => {
      tracking = false;
      controlsState.left = controlsState.right = controlsState.jump = false;
    };

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
  return <div style={hint}>parmağını sürükle: ← → şerit&nbsp;&nbsp;·&nbsp;&nbsp;↑ zıpla</div>;
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
