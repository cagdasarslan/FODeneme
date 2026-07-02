import { useRef, useEffect, useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { INITIAL_SPEED } from '@/constants/game';
import { HORSES } from '@/constants/horses';

// Gösterge skalası: en hızlı atın boost'lu üst hızına göre (40'ta doygunlaşmasın)
const TOP_SPEED = Math.max(...HORSES.map(h => h.baseMaxSpeed ?? 40)) * 1.3;
import TouchPad from '@/components/ui/TouchPad';

const isMobile = 'ontouchstart' in window;

// ── Close-call flash mesajları ────────────────────────────────────────────────
const CLOSE_TEXTS = ['MAKAS!', 'KIL PAYI!', 'ADRENALIN!', 'YAKINDI!', 'ATEŞ!'];

function CloseCallFlash() {
  const [text, setText]     = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return useGameStore.subscribe(
      (s) => s.adrenaline,
      (adrenaline, prev) => {
        if (adrenaline > prev + 5) {
          setText(CLOSE_TEXTS[Math.floor(Math.random() * CLOSE_TEXTS.length)]);
          setVisible(true);
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setVisible(false), 900);
        }
      }
    );
  }, []);

  if (!visible) return null;

  return (
    <div style={styles.flash}>
      {text}
    </div>
  );
}

// ── Ana HUD ───────────────────────────────────────────────────────────────────
export default function HUD() {
  // KRİTİK PERFORMANS: skor/hız/adrenalin her frame kesirli değişir. Obje
  // selector her store set'inde yeni referans üretip HUD'u 60fps yeniden
  // render ediyordu (yüksek hızda donmaların ana sebebi). Primitive + floor
  // selector'larla yalnızca görünen değer değişince render olur.
  const score      = useGameStore((s) => Math.floor(s.score));
  const highScore  = useGameStore((s) => Math.floor(s.highScore));
  const carrots    = useGameStore((s) => s.carrots);
  const adrenaline = useGameStore((s) => Math.floor(s.adrenaline));
  const speed      = useGameStore((s) => Math.floor(s.speed));
  const phase      = useGameStore((s) => s.phase);
  const magnetActive      = useGameStore((s) => s.magnetActive);
  const adrenalinBoosting = useGameStore((s) => s.adrenalinBoosting);

  if (phase !== 'playing' && phase !== 'paused') return null;

  const adrColor = adrenaline > 75 ? '#ff3333' : adrenaline > 40 ? '#ff9900' : '#33aaff';
  const isMaxAdr = adrenaline > 90;

  const spct = Math.min(1, Math.max(0, (speed - INITIAL_SPEED) / (TOP_SPEED - INITIAL_SPEED)));
  const speedColor = spct < 0.4 ? '#33ff99' : spct < 0.75 ? '#ffcc00' : '#ff4422';

  return (
    <>
      {/* Üst bar */}
      <div style={styles.topBar}>
        <div style={styles.statBlock}>
          <span style={styles.label}>SKOR</span>
          <span style={styles.value}>{Math.floor(score).toLocaleString()}</span>
          {/* Hız — skorun tam altında */}
          <span style={{ ...styles.speedLine, color: speedColor }}>
            🏇 {Math.floor(speed)} km/h
          </span>
        </div>
        <div style={styles.statBlock}>
          <span style={styles.label}>EN YÜKSEK</span>
          <span style={{ ...styles.value, color: '#f5d060' }}>
            {Math.floor(highScore).toLocaleString()}
          </span>
        </div>
        <div style={styles.statBlock}>
          <span style={styles.label}>🥕 HAVUÇ</span>
          <span style={{ ...styles.value, color: '#ffd700' }}>{carrots}</span>
        </div>
      </div>

      {magnetActive && (
        <div style={{ position:'fixed', top:70, left:'50%', transform:'translateX(-50%)',
          fontFamily:'monospace', fontSize:18, fontWeight:900, color:'#00aaff',
          textShadow:'0 0 15px #00aaff', letterSpacing:3, pointerEvents:'none',
          animation:'pulse 0.5s infinite alternate' }}>
          🧲 SÜPER NAL AKTİF
        </div>
      )}

      {adrenalinBoosting && (
        <div style={{ position:'fixed', top:100, left:'50%', transform:'translateX(-50%)',
          fontFamily:'monospace', fontSize:22, fontWeight:900, color:'#ff4400',
          textShadow:'0 0 20px #ff6600, 0 0 40px #ff2200', letterSpacing:3, pointerEvents:'none',
          animation:'pulse 0.3s infinite alternate' }}>
          ⚡ ADRENALİN PATLAMASI — 2X SKOR!
        </div>
      )}

      {/* Adrenalin barı */}
      <div style={styles.adrWrap}>
        <div style={{ ...styles.adrLabel, color: adrColor, animation: isMaxAdr ? 'pulse 0.5s infinite alternate' : 'none' }}>
          {isMaxAdr ? '⚡ MAX ADRENALİN' : `ADRENALİN ${Math.floor(adrenaline)}%`}
        </div>
        <div style={styles.adrTrack}>
          <div style={{ ...styles.adrFill, width: `${adrenaline}%`, background: adrColor }} />
          {/* Parıltı efekti */}
          {adrenaline > 5 && (
            <div style={{ ...styles.adrGlow, width: `${adrenaline}%`, background: adrColor }} />
          )}
        </div>
      </div>

      {/* Kontrol ipuçları (sol alt) */}
      {!isMobile && (
        <div style={styles.hints}>
          <span>← → / A D &nbsp;|&nbsp; SPACE / ↑ Zıpla</span>
        </div>
      )}

      {/* Close-call flash */}
      <CloseCallFlash />

      <TouchPad />

      <style>{`
        @keyframes pulse { from { opacity:1; transform:scale(1); } to { opacity:0.6; transform:scale(1.06); } }
      `}</style>
    </>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const styles = {
  topBar: {
    position: 'fixed',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 2,
    userSelect: 'none',
    pointerEvents: 'none',
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    padding: '6px 18px',
    borderBottom: '2px solid rgba(255,255,255,0.1)',
    minWidth: 100,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 2,
  },
  value: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: 700,
    textShadow: '0 0 8px rgba(255,255,255,0.4)',
  },
  speedLine: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    marginTop: 3,
    textShadow: '0 0 8px currentColor',
  },
  adrWrap: {
    position: 'fixed',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 380,
    userSelect: 'none',
    pointerEvents: 'none',
  },
  adrLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 5,
    textShadow: '0 0 10px currentColor',
    fontWeight: 700,
  },
  adrTrack: {
    height: 10,
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  adrFill: {
    height: '100%',
    borderRadius: 5,
    transition: 'width 0.08s, background 0.25s',
    position: 'absolute',
  },
  adrGlow: {
    height: '100%',
    borderRadius: 5,
    filter: 'blur(6px)',
    opacity: 0.5,
    position: 'absolute',
    transition: 'width 0.08s',
  },
  hints: {
    position: 'fixed',
    bottom: 16,
    left: 16,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'monospace',
    fontSize: 12,
    userSelect: 'none',
    pointerEvents: 'none',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
  },
  flash: {
    position: 'fixed',
    top: '38%',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: 'monospace',
    fontSize: 36,
    fontWeight: 900,
    color: '#ff4400',
    textShadow: '0 0 20px #ff4400, 0 2px 4px #000',
    letterSpacing: 4,
    pointerEvents: 'none',
    userSelect: 'none',
    animation: 'flashIn 0.15s ease-out',
  },
};
