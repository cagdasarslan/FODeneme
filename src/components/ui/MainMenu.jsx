import { useState, useEffect } from 'react';
import useGameStore from '@/store/useGameStore';
import { CHARACTERS } from '@/constants/characters';
import { HORSES } from '@/constants/horses';
import Leaderboard from '@/components/ui/Leaderboard';
import HowToPlay from '@/components/ui/HowToPlay';
import Tutorial from '@/components/ui/Tutorial';
import CarrotShop from '@/components/ui/CarrotShop';
import Settings from '@/components/ui/Settings';
import DailyReward from '@/components/ui/DailyReward';
import Missions from '@/components/ui/Missions';
import AdButton from '@/components/ui/AdButton';
import { showBanner, hideBanner } from '@/services/AdService';
import { AD_DAILY_CARROTS, AD_DAILY_MAX, MAP_UNLOCKS, MAP_MEDALS, MEDAL_ICONS } from '@/constants/game';
import { getActiveEvent } from '@/constants/events';
import { fetchLeaderboard } from '@/services/LeaderboardService';
import { Capacitor } from '@capacitor/core';
import { restoreFromCloud } from '@/services/CloudSave';
import { signInWith } from '@/services/AuthService';
import { GAME_BUILD } from '@/constants/game';

const isNative = Capacitor.getPlatform() !== 'web';

// Oyun sonu skoru: 0'dan hedefe hızla sayarak dolar (ease-out)
function AnimatedScore({ value }) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    const target = Math.floor(value);
    if (target <= 0) { setDisp(0); return; }
    const t0 = performance.now();
    const DUR = 800;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / DUR);
      setDisp(Math.floor(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{disp.toLocaleString()}</>;
}

// Yeni rekor konfetisi — hafif, saf CSS animasyonlu emoji parçacıkları
const CONFETTI = ['🎉', '⭐', '🥕', '🏆', '✨'];
function Confetti() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} style={{
          position: 'absolute', top: -20, left: `${(i * 53) % 100}%`,
          fontSize: 14 + (i % 3) * 6,
          animation: `confFall ${1.6 + (i % 5) * 0.35}s ${(i % 7) * 0.18}s ease-in infinite`,
        }}>{CONFETTI[i % CONFETTI.length]}</span>
      ))}
      <style>{`@keyframes confFall {
        0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(340px) rotate(300deg); opacity: 0; }
      }`}</style>
    </div>
  );
}

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
  6: { emoji: '💀', name: 'ZİNDAN',     color: '#9a6cff' },
};

const isMobile = window.innerWidth < 500;

export default function MainMenu() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  // İlk oynayış eğitimi — yalnızca bir kez (intro_v1)
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('intro_v1'));

  // İlk girişte TEK SEFERLİK kullanıcı adı — liderlikte bu adla görünür
  const [showNameModal, setShowNameModal] = useState(() => !localStorage.getItem('nameSet'));
  const [nameInput, setNameInput] = useState(() => localStorage.getItem('playerName') || '');
  const saveName = () => {
    const n = nameInput.trim();
    if (n.length < 3) return;
    localStorage.setItem('playerName', n.slice(0, 16));
    localStorage.setItem('nameSet', '1');
    setShowNameModal(false);
  };
  // Yeniden kurulumda eski hesabı kurtarma koduyla geri al
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [restoreMsg, setRestoreMsg]   = useState('');
  const doRestore = async () => {
    if (restoreCode.trim().length < 6) return;
    setRestoreMsg('Yükleniyor…');
    const r = await restoreFromCloud(restoreCode);
    if (r.ok) {
      setRestoreMsg('✓ Hesabın geri yüklendi!');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setRestoreMsg('⚠ ' + r.reason);
    }
  };

  const {
    phase, sessionReady, sessionError, score, carrots,
    startRun, openGarage, selectedCharacterId, selectedHorseId,
    mapId, setMapId, highScoreMap1, highScoreMap2, highScoreMap3, highScoreMap4, highScoreMap5, highScoreMap6,
    horseUpgrades,
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
    highScoreMap6:       s.highScoreMap6,
    horseUpgrades:       s.horseUpgrades,
    runCarrots:          s.runCarrots,
    carrotsDoubled:      s.carrotsDoubled,
    doubleRunCarrots:    s.doubleRunCarrots,
    claimAdCarrots:      s.claimAdCarrots,
    adBonusToday:        s.adBonusToday,
    armStartBoost:       s.armStartBoost,
  }));

  // Tay vitrini — en acil tayın durumu ana ekranda
  const foals = useGameStore(s => s.foals);

  // Harita madalyaları
  const medals         = useGameStore(s => s.medals);
  const newMedals      = useGameStore(s => s.newMedals);
  const clearNewMedals = useGameStore(s => s.clearNewMedals);

  // İlk Adımlar (onboarding) — tamamlanmayı etkileyen alanlara abone ol
  const onboardClaimed  = useGameStore(s => s.onboardClaimed);
  const trainingXP      = useGameStore(s => s.trainingXP);
  const enterPaddock    = useGameStore(s => s.enterPaddock);
  const claimOnboardStep = useGameStore(s => s.claimOnboardStep);
  const onboarding = useGameStore(s => s.getOnboarding)();
  const onboardOpen = onboarding.some(st => !st.claimed); // hepsi alınınca kart kaybolur

  // "Arkadaşını geç": oyun sonunda liderlikte bir üstündeki oyuncuyu göster
  const [rival, setRival] = useState(null);
  useEffect(() => {
    if (phase !== 'gameover') { setRival(null); return; }
    let on = true;
    fetchLeaderboard(100).then(items => {
      if (!on || !Array.isArray(items)) return;
      const myId = sessionStorage.getItem('ll_player_id');
      const idx = items.findIndex(it => String(it.member_id) === String(myId));
      if (idx > 0) {
        const up = items[idx - 1];
        setRival({
          rank: idx, // üstteki oyuncunun sırası (1-bazlı: idx)
          name: up.player?.name || `Jokey#${String(up.member_id).slice(-4)}`,
          diff: Math.max(1, Math.floor(up.score) - Math.floor(score)),
        });
      }
    }).catch(() => {});
    return () => { on = false; };
  }, [phase]);

  const activeEvent = getActiveEvent();

  // Günlük sistem (re-render için ilgili alanlara abone ol)
  const dailyCarrots   = useGameStore(s => s.dailyCarrots);
  const missionClaimed = useGameStore(s => s.missionClaimed);
  const streakDay      = useGameStore(s => s.streakDay);
  const lastClaimDate  = useGameStore(s => s.lastClaimDate);
  const getMissions    = useGameStore(s => s.getMissions);
  const claimMission   = useGameStore(s => s.claimMission);
  const canClaimStreak = useGameStore(s => s.canClaimStreak)();
  const missions = getMissions(); // dailyCarrots/missionClaimed değişince yenilenir
  // Günlük skor görevi (50k) + hediye sandığı
  const dailyScore       = useGameStore(s => s.dailyScore);
  const chestClaimedDate = useGameStore(s => s.chestClaimedDate);
  const getDailyGoal     = useGameStore(s => s.getDailyGoal);
  const openDailyChest   = useGameStore(s => s.openDailyChest);
  const goal = getDailyGoal(); // dailyScore/chestClaimedDate değişince yenilenir
  const [chestReward, setChestReward] = useState(null); // sandık açılış modalı

  // Banner reklam — yalnızca ana menü/oyun sonu ekranında
  useEffect(() => {
    if (phase === 'idle' || phase === 'gameover') showBanner();
    else hideBanner();
  }, [phase]);

  const activeChar  = CHARACTERS.find(c => c.id === selectedCharacterId) ?? CHARACTERS[0];
  const activeHorse = HORSES.find(h => h.id === selectedHorseId) ?? HORSES[0];
  const mapHs       = mapId === 6 ? (highScoreMap6 ?? 0) : mapId === 5 ? (highScoreMap5 ?? 0) : mapId === 4 ? (highScoreMap4 ?? 0) : mapId === 3 ? highScoreMap3 : mapId === 2 ? highScoreMap2 : highScoreMap1;
  const mapInfo     = MAP_INFO[mapId] ?? MAP_INFO[1];
  // Atın gerçek yükseltme seviyesi = 3 statın toplam seviyesi (0–15)
  const hu          = horseUpgrades?.[selectedHorseId] ?? { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 };
  const horseLevel  = (hu.speedLevel ?? 0) + (hu.maneuvLevel ?? 0) + (hu.jumpLevel ?? 0);


  if (phase !== 'idle' && phase !== 'gameover') return null;

  const isGameOver  = phase === 'gameover';
  const isNewRecord = isGameOver && Math.floor(score) > 0 && Math.floor(score) >= Math.floor(mapHs);

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Üst köşe ikonları */}
        <div style={styles.topIcons}>
          <button style={styles.iconBtn} onClick={() => setShowGuide(true)}>📖</button>
          <button style={styles.iconBtn} onClick={() => setShowSettings(true)}>⚙️</button>
        </div>

        {/* Sabit başlık + OYNA — menü açılınca ilk görünen, kaydırmayla oynamaz */}
        <div style={styles.fixedHeader}>
          <div style={styles.titleWrap}>
            <div style={styles.titleSub}>🐴</div>
            <h1 style={styles.title}>HORSE RUNNER</h1>
            <div style={styles.titleSubline}>KOŞ · YETİŞTİR · YARIŞ</div>
          </div>
          <button style={styles.btn} onClick={startRun}>
            {isGameOver ? 'TEKRAR OYNA' : '▶  OYNA'}
          </button>
          {/* Harita madalyaları — seçili haritanın kısa vadeli hedefi */}
          {(() => {
            const thr = MAP_MEDALS[mapId] ?? [];
            const earned = (medals?.[mapId]) ?? 0;
            const nextTarget = earned < thr.length ? thr[earned] : null;
            return (
              <div style={styles.medalStrip}>
                <div style={styles.medalIcons}>
                  {thr.map((t, i) => (
                    <span key={i} title={`${t.toLocaleString()} skor`}
                      style={{ fontSize: 18, opacity: i < earned ? 1 : 0.28, filter: i < earned ? 'none' : 'grayscale(1)' }}>
                      {MEDAL_ICONS[i]}
                    </span>
                  ))}
                </div>
                <span style={styles.medalGoal}>
                  {nextTarget
                    ? <>Sonraki madalya: <b style={{ color: '#ffd54a' }}>{nextTarget.toLocaleString()}</b> skor</>
                    : <span style={{ color: '#8ee69a' }}>Tüm madalyalar alındı! 🏅</span>}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Kaydırılabilir içerik */}
        <div style={styles.scrollArea}>
          {/* Mevsimsel etkinlik rozeti */}
          {activeEvent && (
            <div style={{ ...styles.eventBadge, borderColor: activeEvent.color, color: activeEvent.color }}>
              {activeEvent.emoji} {activeEvent.name} ETKİNLİĞİ!
            </div>
          )}

          {/* Yapı etiketi — hangi sürümün yüklü olduğunu doğrulamak için */}
          <div style={{ position: 'fixed', top: 'calc(4px + env(safe-area-inset-top, 0px))', right: 8, fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--game-font)', zIndex: 5 }}>
            {GAME_BUILD}
          </div>

          {/* Havuç + günlük ödül */}
          <div style={styles.topRow}>
            <div style={{ ...styles.carrotPill, cursor: 'pointer' }} onClick={() => setShowShop(true)}>
              🥕 <span style={styles.carrotNum}>{carrots.toLocaleString()}</span>
              <span style={styles.carrotPlus}>＋</span>
            </div>
            <button style={styles.dailyIconBtn} onClick={() => setShowDaily(true)}>
              🎁
              {canClaimStreak && <span style={styles.dailyDot} />}
            </button>
            {/* Liderlik — ana sayfadan hızlı erişim */}
            <button style={styles.dailyIconBtn} onClick={() => setShowLeaderboard(true)}>
              🏆
            </button>
          </div>

          {/* Oyun sonu skor paneli — en üstte, en görünür yerde */}
          {isGameOver && (
            <div style={{ ...styles.resultsWrap, position: 'relative' }}>
              {isNewRecord && <Confetti />}
              <div style={styles.gameOverText}>GAME OVER</div>
              {isNewRecord && <div style={styles.newRecord}>🏆 YENİ REKOR!</div>}
              <div style={styles.statsCard}>
                <div style={{ ...styles.mapBadge, borderColor: mapInfo.color, color: mapInfo.color }}>
                  {mapInfo.emoji} {mapInfo.name}
                </div>
                <StatRow label="SKOR" value={<AnimatedScore value={score} />} color="#fff" />
                <StatRow label="BU HARİTA REKORU" value={Math.floor(mapHs).toLocaleString()} color={mapInfo.color} />
                <StatRow label="HAVUÇ" value={`🥕 ${carrots}`} color="#ffd700" />
              </div>
              {/* Arkadaşını geç — liderlikte bir üstteki oyuncu */}
              {rival && (
                <div style={styles.rivalRow}>
                  🎯 {rival.rank}. sıradaki <b>{rival.name}</b>'i geçmek için{' '}
                  <b style={{ color: '#ffd700' }}>{rival.diff.toLocaleString()}</b> puan!
                </div>
              )}
              {runCarrots > 0 && !carrotsDoubled && (
                <div style={{ marginTop: 10, width: '100%' }}>
                  <AdButton label={`Havuçları 2 KATINA çıkar (+${runCarrots})`} sub={`Bu koşuda ${runCarrots} havuç topladın`} color="#ffcf66" onReward={() => doubleRunCarrots()} />
                </div>
              )}
            </div>
          )}

          {/* İLK ADIMLAR — yeni oyuncuya meta sistemleri tanıtan rehber (ölünce de görünür) */}
          {onboardOpen && (
            <div style={styles.onboardCard}>
              <div style={styles.onboardHeader}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <span style={styles.onboardTitle}>İLK ADIMLAR</span>
                <span style={styles.onboardCount}>
                  {onboarding.filter(s => s.claimed).length}/{onboarding.length}
                </span>
              </div>
              {onboarding.map(st => {
                const nav = () => {
                  if (st.done) return;
                  if (st.id === 'play')  startRun();
                  else if (st.id === 'train') enterPaddock();
                  else if (st.id === 'hara')  openGarage('hara');
                  else if (st.id === 'shop')  openGarage();
                };
                return (
                  <div key={st.id} style={{ ...styles.onboardRow, opacity: st.claimed ? 0.55 : 1, cursor: (!st.done || (st.done && !st.claimed)) ? 'pointer' : 'default' }}
                    onClick={st.done && !st.claimed ? () => { claimOnboardStep(st.id); } : nav}>
                    <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>
                      {st.claimed ? '✅' : st.icon}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: st.claimed ? '#8ee69a' : '#fff', fontWeight: 600 }}>
                      {st.label}
                    </span>
                    {st.claimed ? null : st.done ? (
                      <span style={styles.onboardClaim}>AL +{st.reward} 🥕</span>
                    ) : (
                      <span style={styles.onboardGo}>GİT →</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Günlük skor görevi: bugün tüm haritalarda 50.000 puan → hediye sandık */}
          {(
            <div style={{
              ...styles.foalCard, cursor: goal.done && !goal.claimed ? 'pointer' : 'default',
              borderColor: goal.done && !goal.claimed ? '#ffd54a' : 'rgba(255,255,255,0.1)',
              background: goal.done && !goal.claimed ? 'rgba(255,213,74,0.12)' : 'rgba(255,255,255,0.04)',
            }} onClick={() => { if (goal.done && !goal.claimed) { const r = openDailyChest(); if (r) setChestReward(r); } }}>
              <span style={{ fontSize: 26 }}>{goal.claimed ? '✅' : goal.done ? '🎁' : '🎯'}</span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={styles.foalName}>Günlük Görev · 50.000 Puan</div>
                {goal.claimed ? (
                  <div style={{ ...styles.foalStatus, color: '#8ee69a' }}>Bugünkü sandık alındı — yarın tekrar! 🎁</div>
                ) : goal.done ? (
                  <div style={{ ...styles.foalStatus, color: '#ffd54a' }}>Tamamlandı! Sandığı açmak için dokun 👉</div>
                ) : (
                  <>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden', marginTop: 5 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, goal.score / goal.target * 100)}%`, background: 'linear-gradient(90deg,#ffd54a,#ff9f00)', borderRadius: 3 }} />
                    </div>
                    <div style={{ ...styles.foalStatus, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                      {goal.score.toLocaleString()} / {goal.target.toLocaleString()} (tüm haritalar)
                    </div>
                  </>
                )}
              </div>
              {goal.done && !goal.claimed && <span style={{ ...styles.foalGo, color: '#ffd54a' }}>AÇ →</span>}
            </div>
          )}

          {/* Tay vitrini — oyunun farkı: koşu + at yetiştiriciliği */}
          {!isGameOver && (foals.length > 0 ? (() => {
            const f = foals[0];
            const hungry = f.tokluk < 40;
            return (
              <div style={styles.foalCard} onClick={() => openGarage('hara')}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: f.genes.bodyColor, border: `3px solid ${f.genes.maneColor}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={styles.foalName}>🐣 {f.name} <span style={styles.foalStage}>({f.stage})</span></div>
                  <div style={{ ...styles.foalStatus, color: hungry ? '#ff8866' : '#8ee69a' }}>
                    {hungry ? '⚠️ Acıktı — hemen besle!' : `Tokluk %${Math.floor(f.tokluk)} · Mutluluk %${Math.floor(f.mutluluk)}`}
                  </div>
                </div>
                <span style={styles.foalGo}>BAK →</span>
              </div>
            );
          })() : (
            <div style={styles.foalCard} onClick={() => openGarage('hara')}>
              <span style={{ fontSize: 26 }}>🐣</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={styles.foalName}>İlk tayını yetiştir!</div>
                <div style={{ ...styles.foalStatus, color: 'rgba(255,255,255,0.5)' }}>Çiftleştir, besle, büyüt — kendi şampiyonunu yarat</div>
              </div>
              <span style={styles.foalGo}>AHIR →</span>
            </div>
          ))}

          {/* Oyun bitti ekranı */}
          {sessionError && <p style={styles.warn}>⚠ Çevrimdışı mod</p>}

          {/* Harita seçici */}
          <div style={styles.sectionTitle}>🗺️ HARİTA SEÇ</div>
          <div style={styles.mapRow}>
            {[
              { id: 1, emoji: '🌿', name: 'AT YARIŞI',     sub: 'Çiftlik / Pist',    color: '#6aaa44', rgb: '106,170,68', hs: highScoreMap1 },
              { id: 2, emoji: '🏙️', name: 'ŞEHİR',        sub: 'Kent Sokakları',    color: '#4a90d9', rgb: '74,144,217', hs: highScoreMap2 },
              { id: 3, emoji: '🌵', name: 'ÇÖLLER',        sub: 'Çöl Koşusu',        color: '#d4a020', rgb: '212,160,32', hs: highScoreMap3 },
              { id: 4, emoji: '🚀', name: 'UZAY KOLONİSİ', sub: "Mars'ta At Yarışı", color: '#aa44ff', rgb: '170,68,255', hs: highScoreMap4 ?? 0 },
              { id: 5, emoji: '🏰', name: 'ORTAÇAĞ KÖYÜ',  sub: 'Köy Yolu',          color: '#c8843c', rgb: '200,132,60',  hs: highScoreMap5 ?? 0 },
              { id: 6, emoji: '💀', name: 'ZİNDAN',        sub: 'Karanlık Koridor',  color: '#9a6cff', rgb: '154,108,255', hs: highScoreMap6 ?? 0 },
            ].map(m => {
              // Harita kilidi: herhangi bir haritadaki en iyi skor eşiği geçmeli
              const maxHS = Math.max(highScoreMap1, highScoreMap2, highScoreMap3, highScoreMap4 ?? 0, highScoreMap5 ?? 0, highScoreMap6 ?? 0);
              const need  = MAP_UNLOCKS[m.id] ?? 0;
              const locked = need > 0 && maxHS < need;
              return (
                <div
                  key={m.id}
                  style={{
                    ...styles.mapCard,
                    borderColor: mapId === m.id ? m.color : 'rgba(255,255,255,0.1)',
                    background:  mapId === m.id ? `rgba(${m.rgb},0.13)` : 'rgba(255,255,255,0.04)',
                    boxShadow: mapId === m.id ? `0 0 12px rgba(${m.rgb},0.3)` : 'none',
                    opacity: locked ? 0.45 : 1,
                    cursor: locked ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => { if (!locked) setMapId(m.id); }}
                >
                  <span style={styles.mapEmoji}>{locked ? '🔒' : m.emoji}</span>
                  <span style={{ ...styles.mapName, color: mapId === m.id ? m.color : '#fff' }}>{m.name}</span>
                  <span style={styles.mapSub}>{m.sub}</span>
                  <span style={{ ...styles.mapHsChip, color: locked ? '#ff8866' : mapId === m.id ? m.color : 'rgba(255,255,255,0.3)' }}>
                    {locked ? `🔒 ${need.toLocaleString()} skor gerekli` : `⬡ ${Math.floor(m.hs).toLocaleString()}`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Aktif jokey + at */}
          <div style={styles.activeRow} onClick={openGarage}>
            <div style={styles.activeItem}>
              <span style={styles.activeEmoji}>{activeChar.emoji}</span>
              <span style={styles.activeName}>{activeChar.name}</span>
            </div>
            <div style={styles.activeDivider} />
            <div style={styles.activeItem}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: activeHorse.bodyColor, border: `2px solid ${activeHorse.maneColor}` }} />
              <span style={styles.activeName}>{activeHorse.name}</span>
              <span style={styles.levelPill}>SV {horseLevel}</span>
            </div>
            <span style={styles.changeHint}>DEĞİŞTİR →</span>
          </div>

          {/* Reklam alanları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {(AD_DAILY_MAX - adBonusToday) > 0 && (
              <AdButton label={`Bedava ${AD_DAILY_CARROTS} havuç`} sub={`Bugün ${AD_DAILY_MAX - adBonusToday} hakkın kaldı`} color="#ffd700" compact onReward={() => claimAdCarrots()} />
            )}
            {!isGameOver && (
              <AdButton label="Süper Nal ile başla" sub="Bu koşuya mıknatıs boost'u ile başla" color="#00cfff" compact onReward={() => { armStartBoost(); startRun(); }} />
            )}
          </div>

        </div>

        {/* Alt sekme çubuğu */}
        <div style={styles.bottomNav}>
          <button style={{ ...styles.navBtn, ...styles.navActive }}>
            <span style={styles.navIcon}>🏠</span><span style={styles.navLabel}>Ana</span>
          </button>
          <button style={styles.navBtn} onClick={() => useGameStore.getState().enterPaddock()}>
            <span style={styles.navIcon}>🐎</span><span style={styles.navLabel}>Çiftlik</span>
          </button>
          <button style={styles.navBtn} onClick={() => openGarage()}>
            <span style={styles.navIcon}>🏇</span><span style={styles.navLabel}>Garaj</span>
          </button>
          <button style={styles.navBtn} onClick={() => openGarage('hara')}>
            <span style={styles.navIcon}>🐣</span><span style={styles.navLabel}>Ahır</span>
          </button>
          <button style={styles.navBtn} onClick={() => setShowMissions(true)}>
            <span style={styles.navIcon}>🎯</span><span style={styles.navLabel}>Görev</span>
            {canClaimStreak && <span style={styles.navDot} />}
          </button>
          <button style={styles.navBtn} onClick={() => setShowShop(true)}>
            <span style={styles.navIcon}>💎</span><span style={styles.navLabel}>Mağaza</span>
          </button>
        </div>
      </div>

      {/* Tek seferlik kullanıcı adı onboarding'i */}
      {showNameModal && (
        <div style={styles.nameOverlay}>
          <div style={styles.nameBox}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>🏇</div>
            <div style={styles.nameTitle}>KULLANICI ADINI SEÇ</div>
            <div style={styles.nameSub}>Liderlik tablosunda bu adla görüneceksin</div>
            <input
              autoFocus
              value={nameInput}
              maxLength={16}
              placeholder="ör. ŞimşekBinici"
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
              style={styles.nameInput}
            />
            <div style={styles.nameHint}>{nameInput.trim().length < 3 ? 'En az 3 karakter' : `${nameInput.trim().length}/16`}</div>
            <button
              style={{ ...styles.nameBtn, opacity: nameInput.trim().length < 3 ? 0.4 : 1 }}
              disabled={nameInput.trim().length < 3}
              onClick={saveName}
            >
              BAŞLA 🏁
            </button>

            {/* Daha önce oynadıysa: kurtarma koduyla ilerlemeyi geri al */}
            {!restoreMode ? (
              <div
                style={{ marginTop: 12, fontSize: 11, color: '#7fd4ff', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}
                onClick={() => setRestoreMode(true)}
              >
                ☁️ Daha önce oynadın mı? İlerlemeni geri yükle
              </div>
            ) : (
              <div style={{ marginTop: 12, width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  value={restoreCode}
                  maxLength={12}
                  placeholder="Kurtarma kodun (Ayarlar'daydı)"
                  onChange={e => setRestoreCode(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') doRestore(); }}
                  style={{ ...styles.nameInput, letterSpacing: 2 }}
                />
                <button
                  style={{ ...styles.nameBtn, background: 'linear-gradient(135deg,#3a9aff,#1a6ad0)', opacity: restoreCode.trim().length < 6 ? 0.4 : 1 }}
                  disabled={restoreCode.trim().length < 6}
                  onClick={doRestore}
                >
                  ☁️ GERİ YÜKLE
                </button>
                <button
                  style={{ ...styles.nameBtn, background: '#fff', color: '#1a1a2a' }}
                  onClick={() => signInWith('google')}
                >
                  🇬 Google hesabımla geri yükle
                </button>
                {restoreMsg && <div style={{ fontSize: 10, fontWeight: 700, color: restoreMsg.startsWith('⚠') ? '#ff8866' : '#33ff99' }}>{restoreMsg}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* İlk oynayış eğitimi — ad seçildikten sonra bir kez */}
      {showTutorial && !showNameModal && <Tutorial onClose={() => setShowTutorial(false)} />}

      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      {showGuide && <HowToPlay onClose={() => setShowGuide(false)} />}
      {showShop && <CarrotShop onClose={() => setShowShop(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showDaily && <DailyReward onClose={() => setShowDaily(false)} />}
      {showMissions && (
        <Missions
          onClose={() => setShowMissions(false)}
          onDaily={() => { setShowMissions(false); setShowDaily(true); }}
          onLeaderboard={() => { setShowMissions(false); setShowLeaderboard(true); }}
        />
      )}

      {/* Hediye sandığı açılış modalı */}
      {chestReward && (
        <div style={styles.chestOverlay} onClick={() => setChestReward(null)}>
          <div style={styles.chestBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 64, animation: 'pulse 0.6s ease-out' }}>🎁</div>
            <div style={styles.chestTitle}>SANDIK AÇILDI!</div>
            <div style={{ fontSize: 44, margin: '8px 0' }}>{chestReward.icon}</div>
            <div style={styles.chestReward}>
              {chestReward.type === 'carrots' ? `+${chestReward.amount.toLocaleString()} 🥕` : chestReward.label}
            </div>
            <div style={styles.chestSub}>{chestReward.type === 'carrots' ? chestReward.label : 'Sonraki koşunda aktif!'}</div>
            <button style={styles.chestBtn} onClick={() => setChestReward(null)}>HARİKA!</button>
          </div>
        </div>
      )}

      {/* Madalya ödül toast'ı — koşu sonunda yeni madalya kazanılınca */}
      {newMedals && newMedals.length > 0 && (
        <div style={styles.chestOverlay} onClick={clearNewMedals}>
          <div style={styles.chestBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 64, animation: 'pulse 0.6s ease-out' }}>
              {MEDAL_ICONS[newMedals[newMedals.length - 1].tier - 1]}
            </div>
            <div style={styles.chestTitle}>
              {newMedals.length > 1 ? `${newMedals.length} MADALYA KAZANDIN!` : 'MADALYA KAZANDIN!'}
            </div>
            <div style={styles.chestReward}>
              +{newMedals.reduce((a, m) => a + m.reward, 0).toLocaleString()} 🥕
            </div>
            <div style={styles.chestSub}>Yeni hedef için tekrar koş!</div>
            <button style={styles.chestBtn} onClick={clearNewMedals}>HARİKA!</button>
          </div>
        </div>
      )}
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
    fontFamily: 'var(--game-font)',
    userSelect: 'none',
    // Native'de alttaki AdMob banner'ı alt sekme çubuğunu kapatmasın:
    // kartın tamamını banner yüksekliği kadar yukarı kaldır.
    paddingBottom: isNative ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0,
    boxSizing: 'border-box',
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, rgba(12,12,28,0.96) 0%, rgba(8,8,18,0.98) 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 0,
    minWidth: isMobile ? 'auto' : 380,
    width: isMobile ? '96vw' : 420,
    maxWidth: '96vw',
    maxHeight: '92vh',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 80px rgba(255,215,0,0.04)',
  },
  scrollArea: {
    flex: 1, overflowY: 'auto', minHeight: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '14px 18px 14px',
  },
  topIcons: { position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6, zIndex: 2 },
  iconBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, width: 34, height: 34, fontSize: 16, cursor: 'pointer' },
  topRow: { display: 'flex', alignItems: 'center', gap: 8 },
  nameOverlay: {
    position: 'fixed', inset: 0, zIndex: 15000,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  nameBox: {
    width: '100%', maxWidth: 340, textAlign: 'center',
    background: 'linear-gradient(160deg, rgba(18,18,34,0.98), rgba(10,10,20,0.99))',
    border: '1px solid rgba(255,215,0,0.35)', borderRadius: 18, padding: '26px 22px',
    fontFamily: 'var(--game-font)',
  },
  nameTitle: { fontSize: 17, fontWeight: 800, letterSpacing: 2, color: '#fff' },
  nameSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6, marginBottom: 16 },
  nameInput: {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 15,
    fontFamily: 'var(--game-font)', fontWeight: 700, textAlign: 'center',
    background: 'rgba(0,0,0,0.45)', color: '#ffd700',
    border: '1px solid rgba(255,215,0,0.4)', borderRadius: 10, outline: 'none',
  },
  nameHint: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 6 },
  nameBtn: {
    marginTop: 14, width: '100%', padding: 14, borderRadius: 12, border: 'none',
    fontFamily: 'var(--game-font)', fontWeight: 800, letterSpacing: 2, fontSize: 14,
    color: '#0a0a14', background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', cursor: 'pointer',
  },
  eventBadge: {
    fontFamily: 'var(--game-font)', fontSize: 11, fontWeight: 800, letterSpacing: 2,
    border: '1px solid', borderRadius: 20, padding: '6px 16px',
    animation: 'pulse 1.2s infinite alternate',
  },
  foalCard: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    background: 'rgba(129,199,132,0.08)', border: '1px solid rgba(129,199,132,0.3)',
    borderRadius: 10, padding: '10px 12px', cursor: 'pointer', boxSizing: 'border-box',
  },
  foalName: { fontFamily: 'var(--game-font)', fontSize: 12, fontWeight: 800, color: '#fff' },
  foalStage: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 400 },
  foalStatus: { fontFamily: 'var(--game-font)', fontSize: 10, marginTop: 2 },
  foalGo: { fontFamily: 'var(--game-font)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' },
  // ── Hediye sandığı modalı ──
  chestOverlay: {
    position: 'fixed', inset: 0, zIndex: 13000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(5px)', padding: 20,
  },
  chestBox: {
    width: '100%', maxWidth: 320, textAlign: 'center', fontFamily: 'var(--game-font)',
    background: 'linear-gradient(160deg, rgba(28,22,10,0.98), rgba(12,10,6,0.99))',
    border: '1px solid rgba(255,213,74,0.5)', borderRadius: 18, padding: '28px 24px',
    boxShadow: '0 0 50px rgba(255,180,0,0.25)',
  },
  chestTitle: { color: '#ffd54a', fontWeight: 800, fontSize: 20, letterSpacing: 3, textShadow: '0 0 16px rgba(255,180,0,0.5)' },
  chestReward: { color: '#fff', fontWeight: 800, fontSize: 26, letterSpacing: 1 },
  chestSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 6, lineHeight: 1.5 },
  chestBtn: {
    marginTop: 22, padding: '12px 40px', fontSize: 15, fontWeight: 800, letterSpacing: 2, color: '#0a0a14',
    border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', cursor: 'pointer',
    fontFamily: 'var(--game-font)', boxShadow: '0 0 24px rgba(255,180,0,0.4)',
  },
  rivalRow: {
    marginTop: 8, fontFamily: 'var(--game-font)', fontSize: 11, color: 'rgba(255,255,255,0.8)',
    background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)',
    borderRadius: 8, padding: '8px 12px',
  },
  dailyIconBtn: { position: 'relative', background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.35)', borderRadius: 20, width: 38, height: 32, fontSize: 16, cursor: 'pointer' },
  sectionTitle: { alignSelf: 'flex-start', fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: 4 },
  bottomNav: {
    display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(8,8,16,0.96)', flexShrink: 0,
  },
  navBtn: {
    position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '8px 2px calc(8px + env(safe-area-inset-bottom, 0px))', fontFamily: 'var(--game-font)',
  },
  navActive: { background: 'rgba(255,215,0,0.08)' },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 9, letterSpacing: 1, color: 'rgba(255,255,255,0.6)', fontWeight: 700 },
  navDot: { position: 'absolute', top: 6, right: '50%', marginRight: -16, width: 8, height: 8, borderRadius: '50%', background: '#ff3b3b', boxShadow: '0 0 6px #ff3b3b' },
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
  dailyRewardBtn: {
    position: 'relative', width: '100%', padding: '11px', marginBottom: 10,
    background: 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,160,0,0.12))',
    border: '1px solid rgba(255,215,0,0.4)', borderRadius: 10, color: '#ffd700',
    fontFamily: 'var(--game-font)', fontWeight: 800, letterSpacing: 2, fontSize: 12, cursor: 'pointer',
  },
  dailyDot: { position: 'absolute', top: 8, right: 12, width: 10, height: 10, borderRadius: '50%', background: '#ff3b3b', boxShadow: '0 0 8px #ff3b3b' },
  missionRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' },
  missionLabel: { fontSize: 11, color: '#fff', fontWeight: 700, marginBottom: 4 },
  missionProg: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  missionReward: { fontSize: 11, color: 'rgba(255,215,0,0.55)', fontWeight: 700, whiteSpace: 'nowrap' },
  missionClaim: { fontSize: 11, fontWeight: 800, color: '#0a0a14', background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontFamily: 'var(--game-font)', whiteSpace: 'nowrap' },
  missionDone: { fontSize: 16, color: '#33ff99', fontWeight: 900 },
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
    padding: '8px 24px', fontSize: 11, fontFamily: 'var(--game-font)',
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
  fixedHeader: {
    flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    padding: '18px 18px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(14,14,32,0.6) 0%, rgba(8,8,18,0) 100%)',
  },
  medalStrip: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%',
  },
  onboardCard: {
    width: '100%', boxSizing: 'border-box',
    background: 'linear-gradient(160deg, rgba(90,140,255,0.14), rgba(60,80,200,0.08))',
    border: '1px solid rgba(120,160,255,0.35)', borderRadius: 12, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  onboardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  onboardTitle: { flex: 1, fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#bcd2ff', fontFamily: 'var(--game-font)' },
  onboardCount: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700 },
  onboardRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  onboardClaim: { fontSize: 11, fontWeight: 800, color: '#1a0a00', background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap' },
  onboardGo: { fontSize: 11, fontWeight: 700, color: '#7fb0ff', whiteSpace: 'nowrap' },
  medalIcons: { display: 'flex', gap: 2 },
  medalGoal: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--game-font)', fontWeight: 600 },
  btn: {
    padding: '13px 52px',
    fontSize: 18, fontFamily: 'var(--game-font)', fontWeight: 700, letterSpacing: 3,
    background: 'linear-gradient(135deg,#e8b84b,#c8881b)',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    color: '#1a0a00', boxShadow: '0 4px 16px rgba(232,184,75,0.4)',
    transition: 'transform 0.1s, box-shadow 0.1s', width: '100%',
  },
  leaderboardBtn: {
    padding: '10px 24px', fontSize: 13, fontFamily: 'var(--game-font)',
    fontWeight: 700, letterSpacing: 2,
    background: 'rgba(255,215,0,0.08)',
    border: '1px solid rgba(255,215,0,0.35)',
    borderRadius: 6, cursor: 'pointer', color: '#ffd700',
    width: '100%', transition: 'background 0.15s',
  },
  garageBtn: {
    padding: '10px 24px', fontSize: 13, fontFamily: 'var(--game-font)',
    fontWeight: 700, letterSpacing: 2,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,215,0,0.25)',
    borderRadius: 6, cursor: 'pointer', color: '#ffd700',
    width: '100%', transition: 'background 0.15s',
  },
  guideBtn: {
    padding: '9px 24px', fontSize: 12, fontFamily: 'var(--game-font)',
    fontWeight: 700, letterSpacing: 2,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
    width: '100%', transition: 'color 0.15s, border-color 0.15s',
  },
};
