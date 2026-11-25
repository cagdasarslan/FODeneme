import { useEffect } from 'react';
import { controlsState } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, pill } from '@/ui/theme';

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
  useLang();
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
  // İpucu yalnızca ilk birkaç koşuda: öğrenen oyuncunun ekranını kalabalıklaştırmasın
  if ((useGameStore.getState().lifeStats?.runs ?? 0) >= 3) return null;
  // Dokunmatik olmayan cihazda klavye ipucu (tek hap — eskiden HUD'da ikinci hap vardı)
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  return <div style={hint}>{touch ? t('kaydır: ← → şerit · ↑ zıpla · ↓ eğil') : `← → / A D · SPACE / ↑ ${t('Zıpla')}`}</div>;
}

const hint = {
  position: 'fixed',
  // Adrenalin barının (alt 28-56px) ÜSTÜNDE — eskiden barın üzerine biniyordu
  bottom: 'calc(66px + env(safe-area-inset-bottom, 0px))',
  whiteSpace: 'nowrap',
  left: '50%',
  transform: 'translateX(-50%)',
  ...pill,
  color: C.cream,
  fontSize: 12,
  padding: '4px 12px',
  letterSpacing: 0.5,
  opacity: 0.9,
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 5000,
};
