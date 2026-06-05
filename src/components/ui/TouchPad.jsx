import { useEffect, useRef } from 'react';
import { controlsState } from '@/hooks/useHorseControls';
import useGameStore from '@/store/useGameStore';

// Prevent ghost clicks / double-fire
function bindTouch(el, onStart, onEnd) {
  if (!el) return () => {};
  const ts = (e) => { e.preventDefault(); onStart(); };
  const te = (e) => { e.preventDefault(); onEnd(); };
  el.addEventListener('touchstart', ts, { passive: false });
  el.addEventListener('touchend',   te, { passive: false });
  el.addEventListener('touchcancel',te, { passive: false });
  return () => {
    el.removeEventListener('touchstart', ts);
    el.removeEventListener('touchend',   te);
    el.removeEventListener('touchcancel',te);
  };
}

export default function TouchPad() {
  const phase = useGameStore(s => s.phase);
  const leftRef  = useRef();
  const rightRef = useRef();
  const jumpRef  = useRef();

  useEffect(() => {
    const cleanL = bindTouch(leftRef.current,
      () => { controlsState.left  = true;  },
      () => { controlsState.left  = false; }
    );
    const cleanR = bindTouch(rightRef.current,
      () => { controlsState.right = true;  },
      () => { controlsState.right = false; }
    );
    const cleanJ = bindTouch(jumpRef.current,
      () => { controlsState.jump  = true;  },
      () => { controlsState.jump  = false; }
    );
    return () => { cleanL(); cleanR(); cleanJ(); };
  }, []);

  // Reset all controls when game stops so horse doesn't keep moving
  useEffect(() => {
    if (phase !== 'playing') {
      controlsState.left = false;
      controlsState.right = false;
      controlsState.jump = false;
    }
  }, [phase]);

  if (phase !== 'playing') return null;

  return (
    <div style={S.wrap}>
      {/* Left button */}
      <div ref={leftRef} style={{ ...S.btn, left: 16, bottom: 24 }}>
        <span style={S.arrow}>◄</span>
      </div>

      {/* Right button */}
      <div ref={rightRef} style={{ ...S.btn, left: 112, bottom: 24 }}>
        <span style={S.arrow}>►</span>
      </div>

      {/* Jump button — right side */}
      <div ref={jumpRef} style={{ ...S.btn, ...S.jumpBtn, right: 16, bottom: 24 }}>
        <span style={{ ...S.arrow, fontSize: 22 }}>▲</span>
        <span style={S.jumpLabel}>ZIPLA</span>
      </div>
    </div>
  );
}

const BTN_SIZE = 80;
const S = {
  wrap: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 5000,
  },
  btn: {
    position: 'absolute',
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    background: 'rgba(255,255,255,0.12)',
    border: '2px solid rgba(255,255,255,0.25)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    // env() for safe area (notch/home bar)
    marginBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  jumpBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    background: 'rgba(255,165,0,0.18)',
    border: '2px solid rgba(255,165,0,0.4)',
  },
  arrow: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 1,
    pointerEvents: 'none',
  },
  jumpLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 8,
    letterSpacing: 1,
    fontFamily: 'monospace',
    marginTop: 2,
    pointerEvents: 'none',
  },
};
