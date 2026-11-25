import { useRef, useEffect, useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { INITIAL_SPEED, STUMBLE_WINDOW_MS } from '@/constants/game';
import { HORSES } from '@/constants/horses';

// Gösterge skalası: en hızlı atın boost'lu üst hızına göre (40'ta doygunlaşmasın)
const TOP_SPEED = Math.max(...HORSES.map(h => h.baseMaxSpeed ?? 40)) * 1.3;
import TouchPad from '@/components/ui/TouchPad';
import { POWERUP_IDS, POWERUP_BY_ID } from '@/constants/powerups';
import { SAFE_TOP, topPlus } from '@/utils/safeArea';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, FONT, DISPLAY, btn, panel, pill, titleText, backdrop, fmt } from '@/ui/theme';

// ── Close-call flash mesajları ────────────────────────────────────────────────
// Yatayda ortalanmış sabit satır. 'pulse' animasyonu transform'u (scale) yazdığı
// için translateX(-50%) ile ortalanan öğeler sağa kayıyordu; ortalama dış kutuda.
const CENTER_ROW = (top) => ({ position: 'fixed', top, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' });

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

  // Düşük adrenalinde yazı krem: eskiden kahve hap üstüne kahve yazı → görünmez "boş hap"
  const adrColor = adrenaline > 75 ? '#ff8a6a' : adrenaline > 40 ? C.gold : C.cream;
  const adrFillBg = adrenaline > 75 ? `linear-gradient(180deg, #ff6a3a, ${C.red})` : `linear-gradient(90deg, ${C.goldHi}, ${C.carrot})`;
  const isMaxAdr = adrenaline > 90;

  const spct = Math.min(1, Math.max(0, (speed - INITIAL_SPEED) / (TOP_SPEED - INITIAL_SPEED)));
  const speedColor = spct < 0.4 ? '#9ee08a' : spct < 0.75 ? C.gold : '#ff8a6a';

  return (
    <>
      {/* Duraklatma ekranı */}
      {phase === 'paused' && (
        <div style={styles.pauseOverlay}>
          <div style={styles.pauseTitle}>⏸ {t('DURAKLATILDI')}</div>
          <div style={styles.pauseScore}>{t('SKOR')}: {fmt(score)}</div>
          <button className="hr-press" style={styles.pauseResume} onClick={() => useGameStore.getState().resumeRun()}>
            ▶ {t('DEVAM ET')}
          </button>
          <button className="hr-press" style={styles.pauseQuit} onClick={() => useGameStore.getState().endRun()}>
            🏁 {t('KOŞUYU BİTİR')}
          </button>
        </div>
      )}

      {/* Duraklat düğmesi */}
      {phase === 'playing' && (
        <button
          className="hr-press"
          style={styles.pauseBtn}
          onClick={() => useGameStore.getState().pauseRun()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          ⏸
        </button>
      )}

      {/* Üst şerit: havuç (sol) · skor + rekor (orta) · hız (sağ). Duraklat ayrı, sağda. */}
      <div style={styles.topBar}>
        <span style={styles.stripCarrots}>🥕 {fmt(carrots)}</span>
        <div style={styles.stripCenter}>
          <span style={styles.value}>{fmt(score)}</span>
          <span style={styles.label}>{t('REKOR')} {fmt(highScore)}</span>
        </div>
        <span style={{ ...styles.speedLine, color: speedColor }}>{Math.floor(speed)} km/h</span>
      </div>

      {powerupLine && (
        <div style={{ position:'fixed', top: topPlus(70), left:'50%', transform:'translateX(-50%)',
          ...pill, fontSize:16, color:C.cream, border:`2px solid ${C.edgeDk}`, boxShadow:`0 3px 0 ${C.edgeDk}`,
          letterSpacing:2, pointerEvents:'none',
          whiteSpace:'nowrap' }}>
          {powerupLine}
        </div>
      )}

      {adrenalinBoosting && (
        <div style={CENTER_ROW(topPlus(58))}>
        <div style={{ textAlign:'center', maxWidth:'92vw',
          ...titleText(20, C.goldHi), letterSpacing:2, pointerEvents:'none',
          animation:'pulse 0.3s infinite alternate' }}>
          ⚡ {t('ADRENALİN PATLAMASI — 2X SKOR!')}
        </div>
        </div>
      )}

      {/* Combo çarpanı — art arda riskli hamleler skoru katlar */}
      {comboMult > 1 && (
        <div style={CENTER_ROW(topPlus(90))}>
        <div style={{ ...titleText(20, C.carrot), letterSpacing:3, pointerEvents:'none',
          animation:'pulse 0.4s infinite alternate' }}>
          🔥 COMBO x{comboMult}
        </div>
        </div>
      )}

      {/* Tökezleme uyarısı — pencere içinde ikinci çarpma öldürür */}
      {stumbleActive && (
        // Konum dış kutuda, animasyon iç kutuda: 'pulse' keyframe'i transform'u
        // (scale) yazdığı için translateX(-50%)'i eziyor, uyarı sağa kayıp taşıyordu
        <div style={{ position:'fixed', top: topPlus(118), left:0, right:0, display:'flex', justifyContent:'center', pointerEvents:'none' }}>
        <div style={{ textAlign:'center', maxWidth:'88vw',
          fontFamily:FONT, fontSize:13, fontWeight:900, color:'#fff', letterSpacing:0.5, pointerEvents:'none',
          background:C.red, padding:'6px 14px', borderRadius:12,
          border:`3px solid ${C.cream}`, boxShadow:`0 4px 0 ${C.redEdge}`,
          animation:'pulse 0.6s infinite alternate' }}>
          ⚠️ {t('TÖKEZLEDİN — bir daha çarparsan düşersin!')}
          {/* Kalan tehlike süresi — oyuncu ikinci çarpmanın neden öldürdüğünü görsün */}
          <div style={{ marginTop:5, height:5, background:C.redEdge, borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', background:C.cream,
              width: `${Math.max(0, Math.min(100, (useGameStore.getState().stumbleUntil - Date.now()) / STUMBLE_WINDOW_MS * 100))}%` }} />
          </div>
        </div>
        </div>
      )}

      {/* İlk oyun eğitimi — üst üçte birde (şeridi kapatmaz); duraklatınca gizlenir */}
      {tutStep < 3 && phase === 'playing' && (
        <div style={{ position:'fixed', top:'26%', left:0, right:0, display:'flex', justifyContent:'center', pointerEvents:'none' }}>
          <div style={{ ...panel, display:'flex', alignItems:'center', gap:10,
            fontSize:16, fontWeight:800, letterSpacing:0.3,
            padding:'10px 18px', borderRadius:16, borderWidth:3, maxWidth:'90vw', boxSizing:'border-box',
            boxShadow:`0 5px 0 ${C.edge}` }}>
            <span key={tutStep} className={tutStep === 0 ? 'hr-swipe-x' : 'hr-swipe-y'}
              style={{ fontSize:26, width:40, textAlign:'center', flexShrink:0, animationDirection: tutStep === 2 ? 'reverse' : 'normal' }} aria-hidden>👆</span>
            <span>{TUT_MSGS[tutStep].replace(/^👆\s*/, '')}</span>
          </div>
        </div>
      )}

      {/* Çöl imza mekaniği: periyodik kum fırtınası vinyeti (görüş daralır) */}
      {mapId === 3 && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:4000,
          background:'radial-gradient(ellipse at center, transparent 30%, rgba(200,110,30,0.85) 100%)',
          animation:'sandPulse 30s infinite', opacity:0 }} />
      )}

      {/* Adrenalin barı — 0 iken boş çerçeve göstermesin */}
      {adrenaline > 0 && (
        <div style={styles.adrWrap}>
          <div style={{ ...styles.adrLabel, color: adrColor, animation: isMaxAdr ? 'pulse 0.5s infinite alternate' : 'none' }}>
            {isMaxAdr ? '⚡ ' + t('MAX ADRENALİN') : `${t('ADRENALİN')} ${Math.floor(adrenaline)}%`}
          </div>
          <div style={styles.adrTrack}>
            <div style={{ ...styles.adrFill, width: `${adrenaline}%`, background: adrFillBg }} />
            {adrenaline > 5 && (
              <div style={{ ...styles.adrGlow, width: `${adrenaline}%` }} />
            )}
          </div>
        </div>
      )}

      {/* Kontrol ipucu tek hap olarak TouchPad'de (ilk koşular) */}
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
    background: backdrop,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 18, fontFamily: FONT, userSelect: 'none',
  },
  pauseTitle: { ...titleText(40), textTransform: 'uppercase' },
  pauseScore: { ...pill, fontSize: 15, letterSpacing: 1 },
  pauseResume: {
    ...btn.primary, padding: '14px 52px', fontSize: 22, minHeight: 56,
    textTransform: 'uppercase',
  },
  pauseQuit: {
    ...btn.secondary, padding: '10px 32px', fontSize: 15, minHeight: 48,
    textTransform: 'uppercase',
  },
  pauseBtn: {
    ...btn.icon,
    position: 'fixed', top: topPlus(8), right: 8, zIndex: 60,
    width: 48, height: 48, fontSize: 18, lineHeight: 1,
  },
  topBar: {
    position: 'fixed',
    // Çentik / Dynamic Island altında kalmasın (iOS); sağda duraklat düğmesine yer
    top: topPlus(8), left: 8, right: 64, height: 48,
    maxWidth: 520, margin: '0 auto', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    padding: '0 12px',
    background: 'rgba(42,26,14,0.55)', border: `2px solid ${C.edge}`, borderRadius: 14,
    color: C.cream, fontFamily: FONT,
    userSelect: 'none', pointerEvents: 'none',
  },
  stripCarrots: { flex: 1, fontFamily: DISPLAY, fontSize: 18, letterSpacing: 0.5, whiteSpace: 'nowrap', color: C.cream },
  stripCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 },
  label: {
    color: C.cream, opacity: 0.85, fontFamily: FONT, fontSize: 12, fontWeight: 800,
    letterSpacing: 0.8, whiteSpace: 'nowrap', marginTop: 1, textAlign: 'center',
  },
  value: {
    color: C.cream, fontFamily: DISPLAY, fontSize: 28, lineHeight: 1, letterSpacing: 0.5,
    textShadow: `0 2px 0 ${C.edgeDk}`,
  },
  speedLine: {
    flex: 1, textAlign: 'right', fontFamily: FONT, fontWeight: 800,
    fontSize: 12, letterSpacing: 0.3, whiteSpace: 'nowrap',
  },
  adrWrap: {
    position: 'fixed',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(380px, calc(100vw - 32px))',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  adrLabel: {
    ...pill,
    display: 'table',
    margin: '0 auto 5px',
    padding: '2px 12px',
    fontSize: 11,
    letterSpacing: 1.5,
    textAlign: 'center',
    border: `2px solid ${C.edgeDk}`,
  },
  adrTrack: {
    height: 14,
    background: C.edgeDk,
    border: `2px solid ${C.edge}`,
    boxShadow: `0 3px 0 ${C.edge}`,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  adrFill: {
    height: '100%',
    borderRadius: 6,
    transition: 'width 0.08s, background 0.25s',
    position: 'absolute',
  },
  adrGlow: {
    height: '40%',
    top: 2,
    borderRadius: 6,
    background: 'rgba(255,241,208,0.45)',
    position: 'absolute',
    transition: 'width 0.08s',
  },
  flash: {
    position: 'fixed',
    top: '38%',
    left: '50%',
    transform: 'translateX(-50%)',
    ...titleText(32, C.carrot),
    pointerEvents: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    animation: 'flashIn 0.15s ease-out',
  },
};
