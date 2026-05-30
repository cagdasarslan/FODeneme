import { useEffect, useRef } from 'react';

const KEYS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyA: 'left',
  KeyD: 'right',
};

/**
 * Returns a ref whose `.current` object has `left` and `right` booleans.
 * Polling via ref (not state) keeps re-renders out of the hot game loop.
 */
export function useHorseControls() {
  const keys = useRef({ left: false, right: false });

  useEffect(() => {
    const down = (e) => {
      const dir = KEYS[e.code];
      if (dir) keys.current[dir] = true;
    };
    const up = (e) => {
      const dir = KEYS[e.code];
      if (dir) keys.current[dir] = false;
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return keys;
}
