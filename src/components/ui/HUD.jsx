import { useRef, useEffect, useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { INITIAL_SPEED } from '@/constants/game';
import { HORSES } from '@/constants/horses';

// Gösterge skalası: en hızlı atın boost'lu üst hızına göre (40'ta doygunlaşmasın)
const TOP_SPEED = Math.max(...HORSES.map(h => h.baseMaxSpeed ?? 40)) * 1.3;
import TouchPad from '@/components/ui/TouchPad';
import { POWERUP_IDS, POWERUP_BY_ID } from '@/constants/powerups';

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
  // Aktif yetenekler — string selector: yalnız saniye değişince render olur
  const powerupLine = useGameStore((s) =>
    POWERUP_IDS
      .filter((id) => s[id + 'Active'])
      .map((id) => `${POWERUP_BY_ID[id].emoji} ${Math.ceil(s[id + 'Timer'])}s`)
      .join('   ')
  );
  const adrenalinBoosting = useGameStore((s) => s.adrenalinBoosting);
  const comboMult         = useGameStore((s) => s.comboMult);
  const stumbleActive     = useGameStore((s) => s.stumbleActive);
  const mapId             = useGameStore((s) => s.mapId);

  // İlk oyun eğitimi (tutorial): kurulumdan sonra YALNIZCA ilk koşuda gösterilir.
  // Gösterim BAŞLAR BAŞLAMAZ kalıcı işaretlenir — oyuncu ilk koşuda erken ölse
  // bile bir daha asla çıkmaz.
  const [tutStep, setTutStep] = useState(() =>
    localStorage.getItem('tut_done') ? 3 : 0
  );
  useEffect(() => {
    if (phase !== 'playing' || tutStep >= 3) return;
    if (tutStep === 0) localStorage.setItem('tut_done', '1'); // tek seferlik
    const t = setTimeout(() => setTutStep((s) => s + 1), 3500);
    return () => clearTimeout(t);
  }, [phase, tutStep]);

  if (phase !== 'playing' && phase !== 'paused') return null;

  const TUT_MSGS = ['👆 ← → kaydırarak şerit değiştir', '👆 ↑ yukarı kaydır = ZIPLA', '👆 ↓ aşağı kaydır = EĞİL'];

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

      {powerupLine && (
        <div style={{ position:'fixed', top:70, left:'50%', transform:'translateX(-50%)',
          fontFamily:'monospace', fontSize:18, fontWeight:900, color:'#00e5ff',
          textShadow:'0 0 15px #00aaff', letterSpacing:2, pointerEvents:'none',
          whiteSpace:'nowrap' }}>
          {powerupLine}
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

      {/* Combo çarpanı — art arda riskli hamleler skoru katlar */}
      {comboMult > 1 && (
        <div style={{ position:'fixed', top:132, left:'50%', transform:'translateX(-50%)',
          fontFamily:'monospace', fontSize:18, fontWeight:900, color:'#ffd54a',
          textShadow:'0 0 14px #ffb300', letterSpacing:3, pointerEvents:'none',
          animation:'pulse 0.4s infinite alternate' }}>
          🔥 COMBO x{comboMult}
        </div>
      )}

      {/* Tökezleme uyarısı — pencere içinde ikinci çarpma öldürür */}
      {stumbleActive && (
        <div style={{ position:'fixed', top:160, left:'50%', transform:'translateX(-50%)',
          fontFamily:'monospace', fontSize:14, fontWeight:900, color:'#ff5544',
          textShadow:'0 0 12px #ff2200', letterSpacing:2, pointerEvents:'none',
          background:'rgba(0,0,0,0.45)', padding:'6px 14px', borderRadius:8,
          border:'1px solid rgba(255,60,40,0.5)',
          animation:'pulse 0.6s infinite alternate' }}>
          ⚠️ TÖKEZLEDİN — bir daha çarparsan düşersin!
        </div>
      )}

      {/* İlk oyun eğitimi */}
      {tutStep < 3 && (
        <div style={{ position:'fixed', top:'46%', left:'50%', transform:'translateX(-50%)',
          fontFamily:'monospace', fontSize:17, fontWeight:800, color:'#fff',
          textShadow:'0 2px 6px #000', letterSpacing:1, pointerEvents:'none',
          background:'rgba(0,0,0,0.55)', padding:'12px 20px', borderRadius:12,
          border:'1px solid rgba(255,215,0,0.4)', whiteSpace:'nowrap' }}>
          {TUT_MSGS[tutStep]}
        </div>
      )}

      {/* Çöl imza mekaniği: periyodik kum fırtınası vinyeti (görüş daralır) */}
      {mapId === 3 && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:4000,
          background:'radial-gradient(ellipse at center, transparent 30%, rgba(200,110,30,0.85) 100%)',
          animation:'sandPulse 30s infinite', opacity:0 }} />
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
        @keyframes sandPulse {
          0%, 78%  { opacity: 0; }
          84%, 92% { opacity: 1; }
          100%     { opacity: 0; }
        }
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
