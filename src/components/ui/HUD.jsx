import { useRef, useEffect, useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { INITIAL_SPEED } from '@/constants/game';
import { HORSES } from '@/constants/horses';

// Gösterge skalası: en hızlı atın boost'lu üst hızına göre (40'ta doygunlaşmasın)
const TOP_SPEED = Math.max(...HORSES.map(h => h.baseMaxSpeed ?? 40)) * 1.3;
import TouchPad from '@/components/ui/TouchPad';
import { POWERUP_IDS, POWERUP_BY_ID } from '@/constants/powerups';
import { SAFE_TOP, topPlus } from '@/utils/safeArea';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';

const isMobile = 'ontouchstart' in window;

// ── Close-call flash mesajları ────────────────────────────────────────────────
const CLOSE_TEXTS = ['MAKAS!', 'KIL PAYI!', 'ADRENALIN!', 'YAKINDI!', 'ATEŞ!'];
// çeviri: CLOSE_TEXTS öğeleri gösterilirken t() ile geçirilir

function CloseCallFlash() {
  const [text, setText]     = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return useGameStore.subscribe(
      (s) => s.adrenaline,
      (adrenaline, prev) => {
        if (adrenaline > prev + 5) {
          setText(t(CLOSE_TEXTS[Math.floor(Math.random() * CLOSE_TEXTS.length)]));
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
  useLang();
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

  const TUT_MSGS = [t('👆 ← → kaydırarak şerit değiştir'), t('👆 ↑ yukarı kaydır = ZIPLA'), t('👆 ↓ aşağı kaydır = EĞİL')];

  const adrColor = adrenaline > 75 ? '#ff3333' : adrenaline > 40 ? '#ff9900' : '#33aaff';
  const isMaxAdr = adrenaline > 90;

  const spct = Math.min(1, Math.max(0, (speed - INITIAL_SPEED) / (TOP_SPEED - INITIAL_SPEED)));
  const speedColor = spct < 0.4 ? '#33ff99' : spct < 0.75 ? '#ffcc00' : '#ff4422';

  return (
    <>
      {/* Duraklatma ekranı */}
      {phase === 'paused' && (
        <div style={styles.pauseOverlay}>
          <div style={styles.pauseTitle}>⏸ {t('DURAKLATILDI')}</div>
          <div style={styles.pauseScore}>{t('SKOR')}: {Math.floor(score).toLocaleString()}</div>
          <button style={styles.pauseResume} onClick={() => useGameStore.getState().resumeRun()}>
            ▶ {t('DEVAM ET')}
          </button>
          <button style={styles.pauseQuit} onClick={() => useGameStore.getState().endRun()}>
            🏁 {t('KOŞUYU BİTİR')}
          </button>
        </div>
      )}

      {/* Duraklat düğmesi */}
      {phase === 'playing' && (
        <button
          style={styles.pauseBtn}
          onClick={() => useGameStore.getState().pauseRun()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          ⏸
        </button>
      )}

      {/* Üst bar */}
      <div style={styles.topBar}>
        <div style={styles.statBlock}>
          <span style={styles.label}>{t('SKOR')}</span>
          <span style={styles.value}>{Math.floor(score).toLocaleString()}</span>
          {/* Hız — skorun tam altında */}
          <span style={{ ...styles.speedLine, color: speedColor }}>
            🏇 {Math.floor(speed)} km/h
          </span>
        </div>
        <div style={styles.statBlock}>
          <span style={styles.label}>{t('EN YÜKSEK')}</span>
          <span style={{ ...styles.value, color: '#f5d060' }}>
            {Math.floor(highScore).toLocaleString()}
          </span>
        </div>
        <div style={styles.statBlock}>
          <span style={styles.label}>🥕 {t('HAVUÇ')}</span>
          <span style={{ ...styles.value, color: '#ffd700' }}>{carrots}</span>
        </div>
      </div>

      {powerupLine && (
        <div style={{ position:'fixed', top:70, left:'50%', transform:'translateX(-50%)',
          fontFamily:'var(--game-font)', fontSize:18, fontWeight:900, color:'#00e5ff',
          textShadow:'0 0 15px #00aaff', letterSpacing:2, pointerEvents:'none',
          whiteSpace:'nowrap' }}>
          {powerupLine}
        </div>
      )}

      {adrenalinBoosting && (
        <div style={{ position:'fixed', top:100, left:'50%', transform:'translateX(-50%)',
          fontFamily:'var(--game-font)', fontSize:22, fontWeight:900, color:'#ff4400',
          textShadow:'0 0 20px #ff6600, 0 0 40px #ff2200', letterSpacing:3, pointerEvents:'none',
          animation:'pulse 0.3s infinite alternate' }}>
          ⚡ ADRENALİN PATLAMASI — 2X SKOR!
        </div>
      )}

      {/* Combo çarpanı — art arda riskli hamleler skoru katlar */}
      {comboMult > 1 && (
        <div style={{ position:'fixed', top:132, left:'50%', transform:'translateX(-50%)',
          fontFamily:'var(--game-font)', fontSize:18, fontWeight:900, color:'#ffd54a',
          textShadow:'0 0 14px #ffb300', letterSpacing:3, pointerEvents:'none',
          animation:'pulse 0.4s infinite alternate' }}>
          🔥 COMBO x{comboMult}
        </div>
      )}

      {/* Tökezleme uyarısı — pencere içinde ikinci çarpma öldürür */}
      {stumbleActive && (
        <div style={{ position:'fixed', top:160, left:'50%', transform:'translateX(-50%)',
          fontFamily:'var(--game-font)', fontSize:14, fontWeight:900, color:'#ff5544',
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
          fontFamily:'var(--game-font)', fontSize:17, fontWeight:800, color:'#fff',
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
          {isMaxAdr ? '⚡ ' + t('MAX ADRENALİN') : `${t('ADRENALİN')} ${Math.floor(adrenaline)}%`}
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
          <span>← → / A D &nbsp;|&nbsp; SPACE / ↑ {t('Zıpla')}</span>
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
  pauseOverlay: {
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 18, fontFamily: 'var(--game-font)', userSelect: 'none',
  },
  pauseTitle: { fontSize: 30, fontWeight: 700, letterSpacing: 3, color: '#fff', textShadow:'0 2px 8px rgba(0,0,0,0.6)' },
  pauseScore: { fontSize: 15, fontWeight: 700, letterSpacing: 2, color: '#f5d060' },
  pauseResume: {
    padding: '14px 52px', fontSize: 18, fontWeight: 900, letterSpacing: 3,
    fontFamily: 'var(--game-font)', color: '#fff', border: 'none', borderRadius: 12,
    background: 'linear-gradient(135deg,#2a8a4a,#1a6a30)', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(42,138,74,0.5)',
  },
  pauseQuit: {
    padding: '10px 36px', fontSize: 12, fontWeight: 700, letterSpacing: 2,
    fontFamily: 'var(--game-font)', color: 'rgba(255,255,255,0.7)', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)',
    cursor: 'pointer',
  },
  pauseBtn: {
    position: 'fixed', top: topPlus(8), right: 10, zIndex: 60,
    width: 40, height: 40, borderRadius: 10, fontSize: 18, lineHeight: 1,
    background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)',
    color: '#fff', cursor: 'pointer', fontFamily: 'var(--game-font)',
  },
  topBar: {
    position: 'fixed',
    // Çentik / Dynamic Island altında kalmasın (iOS)
    top: SAFE_TOP,
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
    fontFamily: 'var(--game-font)',
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 2,
    fontWeight: 600,
  },
  value: {
    color: '#fff',
    fontFamily: 'var(--game-font)',
    fontSize: 19,
    fontWeight: 700,
    letterSpacing: 0.5,
    textShadow: '0 1px 3px rgba(0,0,0,0.7)',
  },
  speedLine: {
    fontFamily: 'var(--game-font)',
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
    fontFamily: 'var(--game-font)',
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
    fontFamily: 'var(--game-font)',
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
    fontFamily: 'var(--game-font)',
    fontSize: 27,
    fontWeight: 700,
    color: '#ff7a2a',
    textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 14px #ff5500',
    letterSpacing: 2,
    pointerEvents: 'none',
    userSelect: 'none',
    animation: 'flashIn 0.15s ease-out',
  },
};
