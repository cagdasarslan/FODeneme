import useGameStore from '@/store/useGameStore';

export default function MainMenu() {
  const { phase, sessionReady, sessionError, highScore, startRun } = useGameStore(
    (s) => ({
      phase: s.phase,
      sessionReady: s.sessionReady,
      sessionError: s.sessionError,
      highScore: s.highScore,
      startRun: s.startRun,
    })
  );

  if (phase !== 'idle' && phase !== 'gameover') return null;

  return (
    <div style={styles.overlay}>
      <h1 style={styles.title}>HORSE RUNNER</h1>

      {phase === 'gameover' && <p style={styles.sub}>GAME OVER</p>}

      <p style={styles.score}>Best: {Math.floor(highScore)}</p>

      {sessionError && (
        <p style={styles.error}>Session error — playing offline</p>
      )}

      {!sessionReady && !sessionError && (
        <p style={styles.loading}>Connecting...</p>
      )}

      <button style={styles.btn} onClick={startRun}>
        {phase === 'gameover' ? 'RETRY' : 'PLAY'}
      </button>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    fontFamily: 'monospace',
    gap: 16,
  },
  title: { fontSize: 48, letterSpacing: 6, margin: 0 },
  sub: { fontSize: 20, color: '#ff5555', margin: 0 },
  score: { fontSize: 18, margin: 0 },
  loading: { fontSize: 14, opacity: 0.7, margin: 0 },
  error: { fontSize: 13, color: '#ffaa00', margin: 0 },
  btn: {
    padding: '12px 48px',
    fontSize: 20,
    fontFamily: 'monospace',
    background: '#e8b84b',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    letterSpacing: 3,
    fontWeight: 700,
  },
};
