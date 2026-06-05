import { useEffect, useRef } from 'react';

// Singleton so TouchPad and useHorseControls share the same object
export const controlsState = { left: false, right: false, jump: false };

const MOVE_KEYS = {
  ArrowLeft:  'left',
  ArrowRight: 'right',
  KeyA:       'left',
  KeyD:       'right',
};
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);

export function useHorseControls() {
  const keys = useRef(controlsState);

  useEffect(() => {
    const down = (e) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) controlsState[dir] = true;
      if (JUMP_KEYS.has(e.code)) controlsState.jump = true;
    };
    const up = (e) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) controlsState[dir] = false;
      if (JUMP_KEYS.has(e.code)) controlsState.jump = false;
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
