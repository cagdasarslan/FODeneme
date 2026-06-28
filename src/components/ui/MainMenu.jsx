import { useState, useEffect } from 'react';
import useGameStore from '@/store/useGameStore';
import { CHARACTERS } from '@/constants/characters';
import { HORSES } from '@/constants/horses';
import Leaderboard from '@/components/ui/Leaderboard';
import HowToPlay from '@/components/ui/HowToPlay';
import CarrotShop from '@/components/ui/CarrotShop';
import AdButton from '@/components/ui/AdButton';
import { showBanner, hideBanner } from '@/services/AdService';
import { AD_DAILY_CARROTS, AD_DAILY_MAX } from '@/constants/game';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.getPlatform() !== 'web';

function StatRow({ label, value, color }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <span style={{ ...styles.statValue, color: color ?? '#fff' }}>{value}</span>
    </div>
  );
}

const MAP_INFO = {
  1: { emoji: '🌿', name: 'AT YARIŞI',  color: '#6aaa44' },
  2: { emoji: '🏙️', name: 'ŞEHİR',     color: '#4a90d9' },
  3: { emoji: '🌵', name: 'ÇÖLLER',     color: '#d4a020' },
  4: { emoji: '🚀', name: 'UZAY',       color: '#aa44ff' },
  5: { emoji: '🏰', name: 'ORTAÇAĞ',    color: '#c8843c' },
};

function getDailyChallenge() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const challenges = ['500m koş', '1000m koş', '10 havuç topla', '3 koşu tamamla'];
  return challenges[dayOfYear % 4];
}

function getDailyProgress(dateStr) {
  try {
    const raw = localStorage.getItem(`daily_${dateStr}`);
    if (!raw) return { progress: 0, completed: false };
    return JSON.parse(raw);
  } catch {
    return { progress: 0, completed: false };
  }
}

const isMobile = window.innerWidth < 500;

export default function MainMenu() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showShop, setShowShop] = useState(false);

  const {
    phase, sessionReady, sessionError, score, carrots,
    startRun, openGarage, selectedCharacterId, selectedHorseId,
    mapId, setMapId, highScoreMap1, highScoreMap2, highScoreMap3, highScoreMap4, highScoreMap5,
    horseLevels, nightMode, toggleNightMode,
    runCarrots, carrotsDoubled, doubleRunCarrots, claimAdCarrots, adBonusToday, armStartBoost,
  } = useGameStore(s => ({
    phase:               s.phase,
    sessionReady:        s.sessionReady,
    sessionError:        s.sessionError,
    score:               s.score,
    carrots:             s.carrots,
    startRun:            s.startRun,
    openGarage:          s.openGarage,
    selectedCharacterId: s.selectedCharacterId,
    selectedHorseId:     s.selectedHorseId,
    mapId:               s.mapId,
    setMapId:            s.setMapId,
    highScoreMap1:       s.highScoreMap1,
    highScoreMap2:       s.highScoreMap2,
    highScoreMap3:       s.highScoreMap3,
    highScoreMap4:       s.highScoreMap4,
    highScoreMap5:       s.highScoreMap5,
    horseLevels:         s.horseLevels,
    nightMode:           s.nightMode,
    toggleNightMode:     s.toggleNightMode,
    runCarrots:          s.runCarrots,
    carrotsDoubled:      s.carrotsDoubled,
    doubleRunCarrots:    s.doubleRunCarrots,
    claimAdCarrots:      s.claimAdCarrots,
    adBonusToday:        s.adBonusToday,
    armStartBoost:       s.armStartBoost,
  }));

  // Banner reklam — yalnızca ana menü/oyun sonu ekranında
  useEffect(() => {
    if (phase === 'idle' || phase === 'gameover') showBanner();
    else hideBanner();
  }, [phase]);

  const activeChar  = CHARACTERS.find(c => c.id === selectedCharacterId) ?? CHARACTERS[0];
  const activeHorse = HORSES.find(h => h.id === selectedHorseId) ?? HORSES[0];
  const mapHs       = mapId === 5 ? (highScoreMap5 ?? 0) : mapId === 4 ? (highScoreMap4 ?? 0) : mapId === 3 ? highScoreMap3 : mapId === 2 ? highScoreMap2 : highScoreMap1;
  const mapInfo     = MAP_INFO[mapId] ?? MAP_INFO[1];
  const horseLevel  = (horseLevels && horseLevels[selectedHorseId]) ?? 1;

  const dateStr = new Date().toDateString();
  const dailyChallenge = getDailyChallenge();
  const dailyProgress = getDailyProgress(dateStr);
  // Show a 30% progress bar visually for richness
  const progressPct = dailyProgress.completed ? 100 : Math.min(dailyProgress.progress || 30, 100);

  if (phase !== 'idle' && phase !== 'gameover') return null;

  const isGameOver  = phase === 'gameover';
  const isNewRecord = isGameOver && Math.floor(score) > 0 && Math.floor(score) >= Math.floor(mapHs);

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Başlık */}
        <div style={styles.titleWrap}>
          <div style={styles.titleSub}>🐴</div>
          <h1 style={styles.title}>HORSE RUNNER</h1>
          <div style={styles.titleSubline}>SONSUZ AT KOŞUSU</div>
        </div>

        {/* Carrot count pill — tıklayınca havuç mağazası açılır */}
        <div style={{ ...styles.carrotPill, cursor: 'pointer' }} onClick={() => setShowShop(true)}>
          🥕 <span style={styles.carrotNum}>{carrots.toLocaleString()}</span> <span style={styles.carrotLabel}>havuç</span>
          <span style={styles.carrotPlus}>＋</span>
        </div>

        {/* Oyun bitti ekranı */}
        {isGameOver && (
          <div style={styles.resultsWrap}>
            <div style={styles.gameOverText}>GAME OVER</div>
            {isNewRecord && (
              <div style={styles.newRecord}>🏆 YENİ REKOR!</div>
            )}
            <div style={styles.statsCard}>
              {/* Map badge */}
              <div style={{ ...styles.mapBadge, borderColor: mapInfo.color, color: mapInfo.color }}>
                {mapInfo.emoji} {mapInfo.name}
              </div>
              <StatRow label="SKOR"              value={Math.floor(score).toLocaleString()}  color="#fff" />
              <StatRow label="BU HARİTA REKORU"  value={Math.floor(mapHs).toLocaleString()}  color={mapInfo.color} />
              <StatRow label="HARİTA 1 REKORU"   value={Math.floor(highScoreMap1).toLocaleString()} color="#6aaa44" />
              <StatRow label="HARİTA 2 REKORU"   value={Math.floor(highScoreMap2).toLocaleString()} color="#4a90d9" />
              <StatRow label="ÇÖLLER REKORU"      value={Math.floor(highScoreMap3).toLocaleString()}         color="#d4a020" />
              <StatRow label="UZAY REKORU"       value={Math.floor(highScoreMap4 ?? 0).toLocaleString()}   color="#aa44ff" />
              <StatRow label="ORTAÇAĞ REKORU"    value={Math.floor(highScoreMap5 ?? 0).toLocaleString()}   color="#c8843c" />
              <StatRow label="HAVUÇ"             value={`🥕 ${carrots}`}                                    color="#ffd700" />
            </div>

            {/* Reklam izle → bu koşunun havuçlarını 2 katına çıkar */}
            {runCarrots > 0 && !carrotsDoubled && (
              <div style={{ marginTop: 10 }}>
                <AdButton
                  label={`Havuçları 2 KATINA çıkar (+${runCarrots})`}
                  sub={`Bu koşuda ${runCarrots} havuç topladın`}
                  color="#ffcf66"
                  onReward={() => doubleRunCarrots()}
                />
              </div>
            )}
          </div>
        )}

        {/* İlk menü — daily challenge + intro */}
        {!isGameOver && (
          <div style={styles.introWrap}>
            {/* Daily challenge widget */}
            <div style={styles.dailyWidget}>
              <div style={styles.dailyHeader}>
                <span style={styles.dailyIcon}>🎯</span>
                <span style={styles.dailyLabel}>GÜNLÜK HEDEF</span>
                {dailyProgress.completed && <span style={styles.dailyDone}>✓ TAMAMLANDI</span>}
              </div>
              <div style={styles.dailyChallenge}>{dailyChallenge}</div>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${progressPct}%`, background: dailyProgress.completed ? '#33ff99' : '#ffd700' }} />
              </div>
            </div>

            <p style={styles.introText}>
              Engelleri aşarak yol al.<br />
              Makas atarken adrenalin kazan!
            </p>
            <div style={styles.controlsHint}>
              <kbd style={styles.key}>◄</kbd>
              <kbd style={styles.key}>►</kbd>
              <span style={styles.hintText}>veya A / D</span>
            </div>
          </div>
        )}

        {/* Bağlantı durumu */}
        {sessionError && (
          <p style={styles.warn}>⚠ Çevrimdışı mod</p>
        )}
        {!sessionReady && !sessionError && (
          <p style={styles.connecting}>● Sunucuya bağlanıyor…</p>
        )}

        {/* Per-map highscore — idle ekranında seçili haritanın rekoru */}
        {!isGameOver && (
          <div style={styles.mapHsRow}>
            <span style={{ color: mapInfo.color }}>{mapInfo.emoji} {mapInfo.name}</span>
            <span style={styles.mapHsVal}>En İyi: {Math.floor(mapHs).toLocaleString()}</span>
          </div>
        )}

        {/* Harita seçici */}
        <div style={styles.mapRow}>
          {[
            { id: 1, emoji: '🌿', name: 'AT YARIŞI',     sub: 'Çiftlik / Pist',    color: '#6aaa44', rgb: '106,170,68', hs: highScoreMap1 },
            { id: 2, emoji: '🏙️', name: 'ŞEHİR',        sub: 'Kent Sokakları',    color: '#4a90d9', rgb: '74,144,217', hs: highScoreMap2 },
            { id: 3, emoji: '🌵', name: 'ÇÖLLER',        sub: 'Çöl Koşusu',        color: '#d4a020', rgb: '212,160,32', hs: highScoreMap3 },
            { id: 4, emoji: '🚀', name: 'UZAY KOLONİSİ', sub: "Mars'ta At Yarışı", color: '#aa44ff', rgb: '170,68,255', hs: highScoreMap4 ?? 0 },
            { id: 5, emoji: '🏰', name: 'ORTAÇAĞ KÖYÜ',  sub: 'Köy Yolu',          color: '#c8843c', rgb: '200,132,60',  hs: highScoreMap5 ?? 0 },
          ].map(m => (
            <div
              key={m.id}
              style={{
                ...styles.mapCard,
                borderColor: mapId === m.id ? m.color : 'rgba(255,255,255,0.1)',
                background:  mapId === m.id ? `rgba(${m.rgb},0.13)` : 'rgba(255,255,255,0.04)',
                boxShadow: mapId === m.id ? `0 0 12px rgba(${m.rgb},0.3)` : 'none',
              }}
              onClick={() => setMapId(m.id)}
            >
              <span style={styles.mapEmoji}>{m.emoji}</span>
              <span style={{ ...styles.mapName, color: mapId === m.id ? m.color : '#fff' }}>{m.name}</span>
              <span style={styles.mapSub}>{m.sub}</span>
              <span style={{ ...styles.mapHsChip, color: mapId === m.id ? m.color : 'rgba(255,255,255,0.3)' }}>
                ⬡ {Math.floor(m.hs).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Gece modu (harita 1-2) */}
        {(mapId === 1 || mapId === 2) && (
          <button
            style={{
              ...styles.nightBtn,
              borderColor: nightMode ? '#8fa8e0' : 'rgba(255,255,255,0.15)',
              color: nightMode ? '#8fa8e0' : 'rgba(255,255,255,0.5)',
              background: nightMode ? 'rgba(143,168,224,0.1)' : 'transparent',
            }}
            onClick={toggleNightMode}
          >
            {nightMode ? '🌙 GECE MODU: AÇIK' : '☀️ GECE MODU: KAPALI'}
          </button>
        )}

        {/* Aktif jokey + at göster */}
        <div style={styles.activeRow} onClick={openGarage}>
          <div style={styles.activeItem}>
            <span style={styles.activeEmoji}>{activeChar.emoji}</span>
            <span style={styles.activeName}>{activeChar.name}</span>
          </div>
          <div style={styles.activeDivider} />
          <div style={styles.activeItem}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: activeHorse.bodyColor, border: `2px solid ${activeHorse.maneColor}` }} />
            <span style={styles.activeName}>{activeHorse.name}</span>
            <span style={styles.levelPill}>SEVİYE {horseLevel}</span>
          </div>
          <span style={styles.changeHint}>DEĞİŞTİR →</span>
        </div>

        {/* Ödüllü reklam alanları */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {(AD_DAILY_MAX - adBonusToday) > 0 && (
            <AdButton
              label={`Bedava ${AD_DAILY_CARROTS} havuç`}
              sub={`Bugün ${AD_DAILY_MAX - adBonusToday} hakkın kaldı`}
              color="#ffd700"
              compact
              onReward={() => claimAdCarrots()}
            />
          )}
          {!isGameOver && (
            <AdButton
              label="Süper Nal ile başla"
              sub="Bu koşuya mıknatıs boost'u ile başla"
              color="#00cfff"
              compact
              onReward={() => { armStartBoost(); startRun(); }}
            />
          )}
        </div>

        <button style={styles.btn} onClick={startRun}>
          {isGameOver ? 'TEKRAR OYNA' : 'OYNA'}
        </button>

        <button style={styles.leaderboardBtn} onClick={() => setShowLeaderboard(true)}>
          🏆 LİDERLİK TABLOSU
        </button>

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button style={{ ...styles.garageBtn, flex: 2 }} onClick={openGarage}>
            🏇 MAĞAZA &nbsp;·&nbsp; 🥕 {carrots}
          </button>
          <button style={{ ...styles.garageBtn, flex: 1 }} onClick={() => openGarage('hara')}>
            🐣 AHIR
          </button>
        </div>

        <button style={styles.guideBtn} onClick={() => setShowGuide(true)}>
          📖 OYUN REHBERİ
        </button>

        {/* Alt banner reklamı menüyü kapatmasın diye boşluk (yalnızca native) */}
        {isNative && <div style={{ height: 64, flexShrink: 0 }} />}
      </div>

      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      {showGuide && <HowToPlay onClose={() => setShowGuide(false)} />}
      {showShop && <CarrotShop onClose={() => setShowShop(false)} />}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(3px)',
    fontFamily: 'monospace',
    userSelect: 'none',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    background: 'linear-gradient(160deg, rgba(12,12,28,0.95) 0%, rgba(8,8,18,0.97) 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: isMobile ? '20px 18px' : '30px 44px',
    minWidth: isMobile ? 'auto' : 360,
    width: isMobile ? '96vw' : 'auto',
    maxWidth: '96vw',
    maxHeight: '92vh',
    overflowY: 'auto',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 80px rgba(255,215,0,0.04)',
  },
  titleWrap: { textAlign: 'center' },
  titleSub: { fontSize: 42, marginBottom: 2, animation: 'bounce 1.2s infinite alternate' },
  title: {
    fontSize: 38,
    letterSpacing: 6,
    margin: 0,
    color: '#fff',
    textShadow: '0 0 20px rgba(255,200,50,0.5)',
  },
  titleSubline: {
    fontSize: 11,
    letterSpacing: 5,
    color: 'rgba(255,215,0,0.5)',
    marginTop: 4,
  },
  carrotPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)',
    borderRadius: 20, padding: '5px 16px', fontSize: 14,
  },
  carrotNum: { color: '#ffd700', fontWeight: 700, fontSize: 18 },
  carrotLabel: { color: 'rgba(255,215,0,0.6)', fontSize: 11 },
  carrotPlus: {
    marginLeft: 8, width: 20, height: 20, borderRadius: '50%',
    background: '#ffd700', color: '#0a0a14', fontWeight: 900, fontSize: 14,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  gameOverText: {
    fontSize: 24, color: '#ff4444', letterSpacing: 4,
    fontWeight: 700, textAlign: 'center', textShadow: '0 0 12px #ff2200',
  },
  newRecord: {
    fontSize: 18, color: '#ffd700', letterSpacing: 2, textAlign: 'center',
  },
  resultsWrap: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%' },
  statsCard: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 10, padding: '14px 20px', width: '100%',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  mapBadge: {
    alignSelf: 'center', padding: '3px 14px', borderRadius: 20,
    border: '1px solid', fontSize: 11, letterSpacing: 2, fontWeight: 700,
    marginBottom: 4,
  },
  statRow: { display: 'flex', justifyContent: 'space-between', gap: 24 },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 1 },
  statValue: { fontSize: 15, fontWeight: 700 },
  introWrap: { textAlign: 'center', width: '100%' },
  dailyWidget: {
    background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: 10, padding: '10px 16px', marginBottom: 10, textAlign: 'left',
  },
  dailyHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  dailyIcon: { fontSize: 14 },
  dailyLabel: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,215,0,0.7)', fontWeight: 700, flex: 1 },
  dailyDone: { fontSize: 9, color: '#33ff99', letterSpacing: 1, fontWeight: 700 },
  dailyChallenge: { fontSize: 13, color: '#fff', fontWeight: 700, letterSpacing: 1, marginBottom: 8 },
  progressBarBg: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2, transition: 'width 0.5s ease' },
  introText: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.7, margin: '8px 0 0' },
  controlsHint: { marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' },
  key: {
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4, padding: '2px 8px', fontSize: 14, color: '#fff',
  },
  hintText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  warn:       { color: '#ffaa00', fontSize: 12, margin: 0 },
  connecting: { color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 },
  mapHsRow: {
    display: 'flex', gap: 12, alignItems: 'center', fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  mapHsVal: { fontWeight: 700, color: '#fff' },
  mapRow: {
    display: 'flex', gap: 8, width: '100%',
    flexWrap: 'wrap', justifyContent: 'center',
  },
  mapCard: {
    flex: '1 1 80px', minWidth: 78, maxWidth: 140,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 3, padding: '10px 6px', borderRadius: 10,
    cursor: 'pointer', border: '2px solid', transition: 'all 0.15s',
    boxSizing: 'border-box',
  },
  mapEmoji: { fontSize: 22 },
  mapName: { fontSize: 10, fontWeight: 700, letterSpacing: 2 },
  mapSub:  { color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: 1 },
  mapHsChip: { fontSize: 10, fontWeight: 700, letterSpacing: 1, marginTop: 2 },
  nightBtn: {
    padding: '8px 24px', fontSize: 11, fontFamily: 'monospace',
    fontWeight: 700, letterSpacing: 2,
    border: '1px solid', borderRadius: 6, cursor: 'pointer',
    width: '100%', transition: 'all 0.15s',
  },
  activeRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '10px 16px',
    cursor: 'pointer', width: '100%', boxSizing: 'border-box',
  },
  activeItem: { display: 'flex', alignItems: 'center', gap: 7, flex: 1 },
  activeDivider: { width: 1, height: 20, background: 'rgba(255,255,255,0.15)' },
  activeEmoji: { fontSize: 20 },
  activeName: { color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 2 },
  levelPill: {
    fontSize: 9, color: '#ffd700', fontWeight: 700, letterSpacing: 1,
    background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)',
    borderRadius: 10, padding: '2px 7px',
  },
  changeHint: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  btn: {
    padding: '13px 52px',
    fontSize: 18, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 3,
    background: 'linear-gradient(135deg,#e8b84b,#c8881b)',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    color: '#1a0a00', boxShadow: '0 4px 16px rgba(232,184,75,0.4)',
    transition: 'transform 0.1s, box-shadow 0.1s', width: '100%',
  },
  leaderboardBtn: {
    padding: '10px 24px', fontSize: 13, fontFamily: 'monospace',
    fontWeight: 700, letterSpacing: 2,
    background: 'rgba(255,215,0,0.08)',
    border: '1px solid rgba(255,215,0,0.35)',
    borderRadius: 6, cursor: 'pointer', color: '#ffd700',
    width: '100%', transition: 'background 0.15s',
  },
  garageBtn: {
    padding: '10px 24px', fontSize: 13, fontFamily: 'monospace',
    fontWeight: 700, letterSpacing: 2,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,215,0,0.25)',
    borderRadius: 6, cursor: 'pointer', color: '#ffd700',
    width: '100%', transition: 'background 0.15s',
  },
  guideBtn: {
    padding: '9px 24px', fontSize: 12, fontFamily: 'monospace',
    fontWeight: 700, letterSpacing: 2,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
    width: '100%', transition: 'color 0.15s, border-color 0.15s',
  },
};
