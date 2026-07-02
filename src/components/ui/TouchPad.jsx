import { useEffect } from 'react';
import { controlsState } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';

// Swipe kontrolü — her "swipe segmenti" kendi baskın eksenini seçer:
//  • Parmak eşiği geçince o anki baskın yön uygulanır (yatay→şerit, dikey→zıpla)
//  • Uygulandıktan sonra orijin parmağın olduğu yere sıfırlanır → parmağı
//    kaldırmadan art arda swipe yapılabilir ve YÖN DEĞİŞTİRİLEBİLİR.
// Eski "dokunuş boyunca eksen kilidi" bazı swipe'ları yutuyordu (zıplarken
// kayma / sağa-sola çekince geçmeme). Segment bazlı seçim bunu çözer:
// zıplama swipe'ının küçük yatay bileşeni eşiğe ulaşamadan segment biter.
const SWIPE_PX  = 26;  // bir aksiyon için gereken sürükleme mesafesi
const PULSE_MS  = 80;

function pulse(dir) {
  controlsState[dir] = true;
  setTimeout(() => { controlsState[dir] = false; }, PULSE_MS);
}

export default function TouchPad() {
  const phase = useGameStore(s => s.phase);

  useEffect(() => {
    if (phase !== 'playing') return;
    let ox = 0, oy = 0;        // segment orijini
    let tracking = false;

    const onStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      ox = t.clientX; oy = t.clientY; tracking = true;
    };
    const onMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - ox;
      const dy = t.clientY - oy;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < SWIPE_PX && ay < SWIPE_PX) return;

      if (ax >= ay) {
        pulse(dx > 0 ? 'right' : 'left');
      } else if (dy < 0) {
        pulse('jump');
      } else {
        pulse('slide'); // aşağı kaydır → eğil
      }
      // Segmenti sıfırla: bir sonraki swipe için yeni orijin.
      ox = t.clientX; oy = t.clientY;
    };
    const onEnd = () => {
      tracking = false;
      controlsState.left = controlsState.right = controlsState.jump = controlsState.slide = false;
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
      controlsState.left = controlsState.right = controlsState.jump = controlsState.slide = false;
    };
  }, [phase]);

  if (phase !== 'playing') return null;
  return <div style={hint}>kaydır: ← → şerit · ↑ zıpla · ↓ eğil</div>;
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
