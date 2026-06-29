import { useEffect } from 'react';
import { controlsState } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';

// Sürükleyerek yönlendirme + EKSEN KİLİDİ:
// Her dokunuşta önce baskın yön belirlenir (yatay → şerit, dikey → zıpla)
// ve dokunuş bitene kadar yalnızca o eksen uygulanır. Böylece zıplarken
// (dikey) at sağa-sola kaymaz, şerit değiştirirken (yatay) yanlışlıkla zıplamaz.
const LANE_DRAG_PX = 50;  // bir şerit değiştirmek için yatay sürükleme mesafesi
const JUMP_DRAG_PX = 42;  // zıplamak için yukarı sürükleme mesafesi
const AXIS_LOCK_PX = 14;  // bu mesafeyi geçince baskın eksene kilitlenir
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
    let laneStep = 0;        // bu dokunuşta uygulanan net şerit kayması
    let jumped = false;      // bu dokunuşta zıplandı mı
    let axis = null;         // 'h' | 'v' — kilitlenen baskın eksen
    let tracking = false;

    const onStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX; startY = t.clientY;
      laneStep = 0; jumped = false; axis = null; tracking = true;
    };
    const onMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Baskın ekseni belirle (bir kez kilitlenir)
      if (!axis) {
        if (Math.abs(dx) >= AXIS_LOCK_PX || Math.abs(dy) >= AXIS_LOCK_PX) {
          axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        } else {
          return; // henüz net bir yön yok
        }
      }

      if (axis === 'h') {
        // Yatay sürükleme → şerit (mutlak; başlangıç noktasının yatayını referans al)
        const desired = Math.round(dx / LANE_DRAG_PX);
        if (desired !== laneStep) {
          const diff = desired - laneStep;
          const dir = diff > 0 ? 'right' : 'left';
          for (let i = 0; i < Math.abs(diff); i++) pulse(dir);
          laneStep = desired;
        }
      } else {
        // Dikey sürükleme → yukarı ise zıpla (dokunuş başına bir kez)
        if (!jumped && -dy >= JUMP_DRAG_PX) {
          pulse('jump');
          jumped = true;
        }
      }
    };
    const onEnd = () => {
      tracking = false;
      axis = null;
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
