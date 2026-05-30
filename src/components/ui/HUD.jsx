import { useEffect } from 'react';
import useGameStore from '@/store/useGameStore';

export default function HUD() {
  const { score, highScore, gold, adrenaline, speed, phase } = useGameStore(
    (s) => ({
      score: s.score,
      highScore: s.highScore,
      gold: s.gold,
      adrenaline: s.adrenaline,
      speed: s.speed,
      phase: s.phase,
    })
  );

  if (phase === 'idle' || phase === 'gameover') return null;

  return (
    <div style={styles.hud}>
      <div style={styles.row}>
        <span>Score: {Math.floor(score)}</span>
        <span>Best: {Math.floor(highScore)}</span>
        <span>Gold: {gold}</span>
        <span>{Math.floor(speed)} km/h</span>
      </div>

      {/* Adrenaline bar */}
      <div style={styles.adrenalineTrack}>
        <div
          style={{
            ...styles.adrenalineFill,
            width: `${adrenaline}%`,
            background: adrenaline > 75 ? '#ff3333' : adrenaline > 40 ? '#ff9900' : '#33aaff',
          }}
        />
      </div>
      {adrenaline > 0 && (
        <div style={styles.adrenalineLabel}>ADRENALINE {Math.floor(adrenaline)}%</div>
      )}
    </div>
  );
}

const styles = {
  hud: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 16,
    userSelect: 'none',
    pointerEvents: 'none',
    textShadow: '1px 1px 4px #000',
    width: 480,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  adrenalineTrack: {
    height: 8,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  adrenalineFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.1s, background 0.3s',
  },
  adrenalineLabel: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 4,
    opacity: 0.85,
  },
};
