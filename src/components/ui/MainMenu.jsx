import { useState, useEffect } from 'react';
import { GoogleButton } from './SignInButtons';
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
import { restoreFromCloud, hasLocalProgress } from '@/services/CloudSave';
import { signInWith } from '@/services/AuthService';
import { GAME_BUILD } from '@/constants/game';
import { SAFE_TOP, BOTTOM_SPACE, topPlus } from '@/utils/safeArea';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, FONT, DISPLAY, btn, panel, tile, pill, titleText, backdrop } from '@/ui/theme';

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
      <span style={{ ...styles.statValue, color: color ?? C.ink }}>{value}</span>
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
  useLang();
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
    if (hasLocalProgress() && !window.confirm(t('Bu cihazdaki ilerlemen bu kodun kaydıyla değiştirilecek. Devam edilsin mi?'))) return;
    setRestoreMsg(t('Yükleniyor…'));
    const r = await restoreFromCloud(restoreCode);
    if (r.ok) {
      setRestoreMsg('✓ ' + t('Hesabın geri yüklendi!'));
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
          <button className="hr-press" style={styles.iconBtn} aria-label={t('OYUN REHBERİ')} onClick={() => setShowGuide(true)}>📖</button>
          <button className="hr-press" style={styles.iconBtn} aria-label={t('AYARLAR')} onClick={() => setShowSettings(true)}>⚙️</button>
        </div>

        {/* Sabit başlık + OYNA — menü açılınca ilk görünen, kaydırmayla oynamaz */}
        <div style={styles.fixedHeader}>
          {!isGameOver && (
            <div style={styles.titleWrap}>
              <div style={styles.titleSub}>🐴</div>
              <h1 style={styles.title}>HORSE RUNNER</h1>
              <div style={styles.titleSubline}>{t('KOŞ · YETİŞTİR · YARIŞ')}</div>
            </div>
          )}
          {/* Oyun sonunda logo gizli: buton sağ üst ikonların altında kalsın */}
          <button className="hr-press" style={{ ...styles.btn, ...(isGameOver ? { marginTop: 46 } : {}) }} onClick={startRun}>
            {isGameOver ? t('TEKRAR OYNA') : '▶  ' + t('OYNA')}
          </button>
          {/* Harita madalyaları — seçili haritanın kısa vadeli hedefi */}
          {(() => {
            const thr = MAP_MEDALS[mapId] ?? [];
            const earned = (medals?.[mapId]) ?? 0;
            const nextTarget = earned < thr.length ? thr[earned] : null;
            return (
              <div style={styles.medalStrip}>
                <div style={styles.medalIcons}>
                  {thr.map((thrVal, i) => (
                    <span key={i} title={`${thrVal.toLocaleString()} ${t('skor')}`}
                      style={{ fontSize: 18, opacity: i < earned ? 1 : 0.28, filter: i < earned ? 'none' : 'grayscale(1)' }}>
                      {MEDAL_ICONS[i]}
                    </span>
                  ))}
                </div>
                <span style={styles.medalGoal}>
                  {nextTarget
                    ? <>{t('Sonraki madalya:')} <b style={{ color: C.gold }}>{nextTarget.toLocaleString()}</b> {t('skor')}</>
                    : <span style={{ color: C.greenHi }}>{t('Tüm madalyalar alındı!')} 🏅</span>}
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
              {activeEvent.emoji} {t('{name} ETKİNLİĞİ!', { name: t(activeEvent.name) })}
            </div>
          )}

          {/* Yapı etiketi — hangi sürümün yüklü olduğunu doğrulamak için */}
          <div style={{ position: 'fixed', top: topPlus(4), right: 8, fontSize: 10, color: C.cream, fontFamily: FONT, zIndex: 5 }}>
            {GAME_BUILD}
          </div>

          {/* Oyun sonu skor paneli — en üstte, en görünür yerde */}
          {isGameOver && (
            <div style={{ ...styles.resultsWrap, position: 'relative' }}>
              {isNewRecord && <Confetti />}
              <div style={styles.gameOverText}>GAME OVER</div>
              {isNewRecord && <div style={styles.newRecord}>🏆 {t('YENİ REKOR!')}</div>}
              <div style={styles.statsCard}>
                <div style={{ ...styles.mapBadge, borderColor: mapInfo.color }}>
                  {mapInfo.emoji} {t(mapInfo.name)}
                </div>
                <StatRow label={t('SKOR')} value={<AnimatedScore value={score} />} color={C.ink} />
                <StatRow label={t('BU HARİTA REKORU')} value={Math.floor(mapHs).toLocaleString()} color={C.inkSoft} />
                <StatRow label={t('BU KOŞUDA')} value={`+${(runCarrots ?? 0).toLocaleString()} 🥕`} color={C.ink} />
                <StatRow label={t('TOPLAM HAVUÇ')} value={`🥕 ${carrots.toLocaleString()}`} color={C.inkSoft} />
              </div>
              {/* Arkadaşını geç — liderlikte bir üstteki oyuncu */}
              {rival && (
                <div style={styles.rivalRow}>
                  🎯 {t('{rank}. sıradaki', { rank: rival.rank })} <b>{rival.name}</b>{t('oyuncusunu geçmek için')}{' '}
                  <b style={{ color: C.red }}>{rival.diff.toLocaleString()}</b> {t('puan!')}
                </div>
              )}
              {runCarrots > 0 && !carrotsDoubled && (
                <div style={{ marginTop: 10, width: '100%' }}>
                  <AdButton label={t('Havuçları 2 KATINA çıkar (+{n})', { n: runCarrots })} sub={t('Bu koşuda {n} havuç topladın', { n: runCarrots })} color="#ffcf66" onReward={() => doubleRunCarrots()} />
                </div>
              )}
            </div>
          )}

          {/* Havuç + günlük ödül */}
          <div style={styles.topRow}>
            <div style={{ ...styles.carrotPill, cursor: 'pointer' }} onClick={() => setShowShop(true)}>
              🥕 <span style={styles.carrotNum}>{carrots.toLocaleString()}</span>
              <span style={styles.carrotPlus}>＋</span>
            </div>
            <button className="hr-press" style={styles.dailyIconBtn} aria-label={t('GÜNLÜK ÖDÜL')} onClick={() => setShowDaily(true)}>
              🎁
              {canClaimStreak && <span style={styles.dailyDot} />}
            </button>
            {/* Liderlik — ana sayfadan hızlı erişim */}
            <button className="hr-press" style={styles.dailyIconBtn} aria-label={t('LİDERLİK')} onClick={() => setShowLeaderboard(true)}>
              🏆
            </button>
          </div>

          {/* İLK ADIMLAR — yeni oyuncuya meta sistemleri tanıtan rehber (ölünce de görünür) */}
          {onboardOpen && (
            <div style={styles.onboardCard}>
              <div style={styles.onboardHeader}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <span style={styles.onboardTitle}>{t('İLK ADIMLAR')}</span>
                <span style={styles.onboardCount}>
                  {onboarding.filter(s => s.claimed).length}/{onboarding.length}
                </span>
              </div>
              {/* Menü kalabalığını azaltmak için yalnızca SIRADAKİ adım gösterilir */}
              {[onboarding.find(x => x.done && !x.claimed) ?? onboarding.find(x => !x.done)].filter(Boolean).map(st => {
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
                    <span style={{ flex: 1, fontSize: 12, color: st.claimed ? C.green : C.ink, fontWeight: 800 }}>
                      {t(st.label)}
                    </span>
                    {st.claimed ? null : st.done ? (
                      <span style={styles.onboardClaim}>{t('AL')} +{st.reward} 🥕</span>
                    ) : (
                      <span style={styles.onboardGo}>{t('GİT')} →</span>
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
              borderColor: goal.done && !goal.claimed ? C.goldLo : C.edge,
              background: goal.done && !goal.claimed ? '#ffe08a' : C.creamDk,
            }} onClick={() => { if (goal.done && !goal.claimed) { const r = openDailyChest(); if (r) setChestReward(r); } }}>
              <span style={{ fontSize: 26 }}>{goal.claimed ? '✅' : goal.done ? '🎁' : '🎯'}</span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={styles.foalName}>{t('Günlük Görev · 50.000 Puan')}</div>
                {goal.claimed ? (
                  <div style={{ ...styles.foalStatus, color: C.green }}>{t('Bugünkü sandık alındı — yarın tekrar!')} 🎁</div>
                ) : goal.done ? (
                  <div style={{ ...styles.foalStatus, color: C.inkSoft }}>{t('Tamamlandı! Sandığı açmak için dokun')} 👉</div>
                ) : (
                  <>
                    <div style={{ height: 10, background: C.edgeDk, border: `2px solid ${C.edge}`, borderRadius: 999, overflow: 'hidden', marginTop: 5 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, goal.score / goal.target * 100)}%`, background: `linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})`, borderRadius: 999 }} />
                    </div>
                    <div style={{ ...styles.foalStatus, color: C.inkSoft, marginTop: 3 }}>
                      {goal.score.toLocaleString()} / {goal.target.toLocaleString()} ({t('tüm haritalar')})
                    </div>
                  </>
                )}
              </div>
              {goal.done && !goal.claimed && <span style={{ ...styles.foalGo, color: C.ink }}>{t('AÇ')} →</span>}
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
                  <div style={styles.foalName}>🐣 {f.name} <span style={styles.foalStage}>({t(f.stage)})</span></div>
                  <div style={{ ...styles.foalStatus, color: hungry ? C.red : C.green }}>
                    {hungry ? '⚠️ ' + t('Acıktı — hemen besle!') : t('Tokluk %{a} · Mutluluk %{b}', { a: Math.floor(f.tokluk), b: Math.floor(f.mutluluk) })}
                  </div>
                </div>
                <span style={styles.foalGo}>{t('BAK')} →</span>
              </div>
            );
          })() : !onboardOpen && (
            // İlk Adımlar kartı zaten "tay büyüt" adımını içerir — tekrar gösterme
            <div style={styles.foalCard} onClick={() => openGarage('hara')}>
              <span style={{ fontSize: 26 }}>🐣</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={styles.foalName}>{t('İlk tayını yetiştir!')}</div>
                <div style={{ ...styles.foalStatus, color: C.inkSoft }}>{t('Çiftleştir, besle, büyüt — kendi şampiyonunu yarat')}</div>
              </div>
              <span style={styles.foalGo}>{t('AHIR')} →</span>
            </div>
          ))}

          {/* Oyun bitti ekranı */}
          {sessionError && <p style={styles.warn}>⚠ {t('Çevrimdışı mod')}</p>}

          {/* Harita seçici */}
          <div style={styles.sectionTitle}>🗺️ {t('HARİTA SEÇ')}</div>
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
                    borderColor: mapId === m.id ? m.color : C.edge,
                    background:  mapId === m.id ? `rgba(${m.rgb},0.22)` : C.creamDk,
                    boxShadow: mapId === m.id ? `0 4px 0 ${C.edge}` : `0 3px 0 ${C.woodDk}`,
                    opacity: locked ? 0.45 : 1,
                    cursor: locked ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => { if (!locked) setMapId(m.id); }}
                >
                  <span style={styles.mapEmoji}>{locked ? '🔒' : m.emoji}</span>
                  <span style={{ ...styles.mapName, color: C.ink }}>{t(m.name)}</span>
                  <span style={styles.mapSub}>{t(m.sub)}</span>
                  <span style={{ ...styles.mapHsChip, color: locked ? C.red : C.inkSoft }}>
                    {locked ? `🔒 ${t('{n} skor gerekli', { n: need.toLocaleString() })}` : `⬡ ${Math.floor(m.hs).toLocaleString()}`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Aktif jokey + at */}
          <div style={styles.activeRow} onClick={openGarage}>
            <div style={styles.activeItem}>
              <span style={styles.activeEmoji}>{activeChar.emoji}</span>
              <span style={styles.activeName}>{t(activeChar.name)}</span>
            </div>
            <div style={styles.activeDivider} />
            <div style={styles.activeItem}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: activeHorse.bodyColor, border: `2px solid ${activeHorse.maneColor}` }} />
              <span style={styles.activeName}>{t(activeHorse.name)}</span>
              <span style={styles.levelPill}>{t('SV')} {horseLevel}</span>
            </div>
            <span style={styles.changeHint}>{t('DEĞİŞTİR')} →</span>
          </div>

          {/* Reklam alanları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {(AD_DAILY_MAX - adBonusToday) > 0 && (
              <AdButton label={t('Bedava {n} havuç', { n: AD_DAILY_CARROTS })} sub={t('Bugün {n} hakkın kaldı', { n: AD_DAILY_MAX - adBonusToday })} color="#ffd700" compact onReward={() => claimAdCarrots()} />
            )}
            {!isGameOver && (
              <AdButton label={t('Süper Nal ile başla')} sub={t('Bu koşuya mıknatıs boost\'u ile başla')} color="#00cfff" compact onReward={() => { armStartBoost(); startRun(); }} />
            )}
          </div>

        </div>

        {/* Alt sekme çubuğu */}
        <div style={styles.bottomNav}>
          <button className="hr-press" style={{ ...styles.navBtn, ...styles.navActive }}>
            <span style={styles.navIcon}>🏠</span><span style={{ ...styles.navLabel, color: C.ink }}>{t('Ana')}</span>
          </button>
          <button className="hr-press" style={styles.navBtn} onClick={() => useGameStore.getState().enterPaddock()}>
            <span style={styles.navIcon}>🐎</span><span style={styles.navLabel}>{t('Çiftlik')}</span>
          </button>
          <button className="hr-press" style={styles.navBtn} onClick={() => openGarage()}>
            <span style={styles.navIcon}>🏇</span><span style={styles.navLabel}>{t('Garaj')}</span>
          </button>
          <button className="hr-press" style={styles.navBtn} onClick={() => openGarage('hara')}>
            <span style={styles.navIcon}>🐣</span><span style={styles.navLabel}>{t('Ahır')}</span>
          </button>
          <button className="hr-press" style={styles.navBtn} onClick={() => setShowMissions(true)}>
            <span style={styles.navIcon}>🎯</span><span style={styles.navLabel}>{t('Görev')}</span>
            {canClaimStreak && <span style={styles.navDot} />}
          </button>
          <button className="hr-press" style={styles.navBtn} onClick={() => setShowShop(true)}>
            <span style={styles.navIcon}>💎</span><span style={styles.navLabel}>{t('Mağaza')}</span>
          </button>
        </div>
      </div>

      {/* Tek seferlik kullanıcı adı onboarding'i */}
      {showNameModal && (
        <div style={styles.nameOverlay}>
          <div style={styles.nameBox}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>🏇</div>
            <div style={styles.nameTitle}>{t('KULLANICI ADINI SEÇ')}</div>
            <div style={styles.nameSub}>{t('Liderlik tablosunda bu adla görüneceksin')}</div>
            <input
              autoFocus
              value={nameInput}
              maxLength={16}
              placeholder={t('ör. ŞimşekBinici')}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
              style={styles.nameInput}
            />
            <div style={styles.nameHint}>{nameInput.trim().length < 3 ? t('En az 3 karakter') : `${nameInput.trim().length}/16`}</div>
            <button
              className="hr-press"
              style={{ ...styles.nameBtn, opacity: nameInput.trim().length < 3 ? 0.4 : 1 }}
              disabled={nameInput.trim().length < 3}
              onClick={saveName}
            >
              {t('BAŞLA')} 🏁
            </button>

            {/* Daha önce oynadıysa: kurtarma koduyla ilerlemeyi geri al */}
            {!restoreMode ? (
              <div
                style={{ marginTop: 12, fontSize: 11, color: C.blueEdge, textDecoration: 'underline', cursor: 'pointer', fontWeight: 800, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setRestoreMode(true)}
              >
                ☁️ {t('Daha önce oynadın mı? İlerlemeni geri yükle')}
              </div>
            ) : (
              <div style={{ marginTop: 12, width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  value={restoreCode}
                  maxLength={12}
                  placeholder={t('Kurtarma kodu')}
                  onChange={e => setRestoreCode(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') doRestore(); }}
                  style={{ ...styles.nameInput, letterSpacing: 2 }}
                />
                <button
                  className="hr-press"
                  style={{ ...styles.nameBtn, ...btn.info, opacity: restoreCode.trim().length < 6 ? 0.4 : 1 }}
                  disabled={restoreCode.trim().length < 6}
                  onClick={doRestore}
                >
                  ☁️ {t('GERİ YÜKLE')}
                </button>
                <GoogleButton style={{ marginTop: 10, width: '100%' }} onClick={() => signInWith('google')}>
                  {t('Google hesabımla geri yükle')}
                </GoogleButton>
                {restoreMsg && <div style={{ fontSize: 11, fontWeight: 800, color: restoreMsg.startsWith('⚠') ? C.red : C.green }}>{restoreMsg}</div>}
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
            <div style={styles.chestTitle}>{t('SANDIK AÇILDI!')}</div>
            <div style={{ fontSize: 44, margin: '8px 0' }}>{chestReward.icon}</div>
            <div style={styles.chestReward}>
              {chestReward.type === 'carrots' ? `+${chestReward.amount.toLocaleString()} 🥕` : t(chestReward.label)}
            </div>
            <div style={styles.chestSub}>{chestReward.type === 'carrots' ? t(chestReward.label) : t('Sonraki koşunda aktif!')}</div>
            <button className="hr-press" style={styles.chestBtn} onClick={() => setChestReward(null)}>{t('HARİKA!')}</button>
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
              {newMedals.length > 1 ? t('{n} MADALYA KAZANDIN!', { n: newMedals.length }) : t('MADALYA KAZANDIN!')}
            </div>
            <div style={styles.chestReward}>
              +{newMedals.reduce((a, m) => a + m.reward, 0).toLocaleString()} 🥕
            </div>
            <div style={styles.chestSub}>{t('Yeni hedef için tekrar koş!')}</div>
            <button className="hr-press" style={styles.chestBtn} onClick={clearNewMedals}>{t('HARİKA!')}</button>
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
    background: backdrop,
    fontFamily: FONT,
    userSelect: 'none',
    // Native'de alttaki AdMob banner'ı alt sekme çubuğunu kapatmasın:
    // kartın tamamını banner yüksekliği kadar yukarı kaldır.
    paddingBottom: BOTTOM_SPACE,
    // Çentik / Dynamic Island menü kartını kesmesin (iOS)
    paddingTop: SAFE_TOP,
    boxSizing: 'border-box',
  },
  card: {
    ...panel,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    minWidth: isMobile ? 'auto' : 380,
    width: isMobile ? '96vw' : 420,
    maxWidth: '96vw',
    maxHeight: '92vh',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1, overflowY: 'auto', minHeight: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '14px 18px 14px',
  },
  topIcons: { position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6, zIndex: 2 },
  iconBtn: { ...btn.icon, width: 44, height: 44, fontSize: 18 },
  topRow: { display: 'flex', alignItems: 'center', gap: 8 },
  nameOverlay: {
    position: 'fixed', inset: 0, zIndex: 15000,
    background: backdrop,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  nameBox: {
    ...panel,
    width: '100%', maxWidth: 340, textAlign: 'center', boxSizing: 'border-box',
    padding: '26px 22px',
  },
  nameTitle: { ...titleText(22), letterSpacing: 1 },
  nameSub: { fontSize: 12, fontWeight: 700, color: C.inkSoft, marginTop: 10, marginBottom: 16 },
  nameInput: {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 16, minHeight: 48,
    fontFamily: FONT, fontWeight: 800, textAlign: 'center',
    background: '#fffaf0', color: C.ink,
    border: `3px solid ${C.edge}`, borderRadius: 14, outline: 'none',
    boxShadow: `inset 0 3px 0 ${C.creamDk}`,
  },
  nameHint: { fontSize: 11, fontWeight: 700, color: C.inkSoft, marginTop: 6 },
  nameBtn: {
    ...btn.primary,
    marginTop: 14, width: '100%', padding: 14, minHeight: 48,
    fontSize: 17, textTransform: 'uppercase',
  },
  eventBadge: {
    ...pill,
    fontSize: 12, letterSpacing: 1.5,
    border: '3px solid',
    animation: 'pulse 1.2s infinite alternate',
  },
  foalCard: {
    ...tile,
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    border: `3px solid ${C.edge}`, boxShadow: `0 4px 0 ${C.edge}`,
    padding: '10px 12px', cursor: 'pointer', boxSizing: 'border-box', minHeight: 56,
  },
  foalName: { fontFamily: FONT, fontSize: 13, fontWeight: 800, color: C.ink },
  foalStage: { fontSize: 11, color: C.inkSoft, fontWeight: 700 },
  foalStatus: { fontFamily: FONT, fontSize: 11, fontWeight: 700, marginTop: 2 },
  foalGo: { fontFamily: DISPLAY, fontSize: 13, letterSpacing: 0.5, color: C.woodDk, whiteSpace: 'nowrap' },
  // ── Hediye sandığı modalı ──
  chestOverlay: {
    position: 'fixed', inset: 0, zIndex: 13000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: backdrop, padding: 20,
  },
  chestBox: {
    ...panel,
    width: '100%', maxWidth: 320, textAlign: 'center', boxSizing: 'border-box',
    padding: '28px 24px',
  },
  chestTitle: { ...titleText(26), marginTop: 6 },
  chestReward: { fontFamily: DISPLAY, color: C.ink, fontSize: 30, letterSpacing: 1 },
  chestSub: { color: C.inkSoft, fontSize: 13, fontWeight: 700, marginTop: 6, lineHeight: 1.5 },
  chestBtn: {
    ...btn.primary,
    marginTop: 22, padding: '12px 40px', minHeight: 48, fontSize: 18, textTransform: 'uppercase',
  },
  rivalRow: {
    ...tile,
    marginTop: 8, fontFamily: FONT, fontSize: 12, fontWeight: 700,
    border: `2px solid ${C.woodDk}`, padding: '8px 12px',
  },
  dailyIconBtn: { ...btn.icon, position: 'relative', width: 44, height: 44, fontSize: 18 },
  sectionTitle: { alignSelf: 'flex-start', fontFamily: DISPLAY, fontSize: 14, letterSpacing: 1, color: C.ink, marginTop: 4 },
  bottomNav: {
    display: 'flex', borderTop: `4px solid ${C.edge}`,
    background: `linear-gradient(180deg, ${C.wood}, ${C.woodDk})`, flexShrink: 0,
  },
  navBtn: {
    position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'transparent', border: 'none', cursor: 'pointer', minHeight: 52,
    padding: '8px 2px calc(8px + env(safe-area-inset-bottom, 0px))', fontFamily: FONT,
  },
  navActive: { background: `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})`, boxShadow: `inset 0 -4px 0 ${C.edge}` },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 11, letterSpacing: 0.3, color: C.cream, fontWeight: 800 },
  navDot: { position: 'absolute', top: 6, right: '50%', marginRight: -16, width: 10, height: 10, borderRadius: '50%', background: C.red, border: `2px solid ${C.cream}` },
  titleWrap: { textAlign: 'center' },
  titleSub: { fontSize: 42, marginBottom: 2, animation: 'bounce 1.2s infinite alternate' },
  title: { ...titleText(40), margin: 0, letterSpacing: 2, fontWeight: 400 },
  titleSubline: {
    fontSize: 12, fontWeight: 800,
    letterSpacing: 4,
    color: C.gold,
    marginTop: 10,
  },
  carrotPill: {
    ...pill,
    display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box',
    border: `3px solid ${C.edgeDk}`, padding: '4px 6px 4px 14px', fontSize: 16,
  },
  carrotNum: { fontFamily: DISPLAY, color: C.gold, fontSize: 20, letterSpacing: 0.5 },
  carrotLabel: { color: C.gold, fontSize: 11 },
  carrotPlus: {
    marginLeft: 8, width: 26, height: 26, borderRadius: '50%',
    background: `linear-gradient(180deg, ${C.greenHi}, ${C.green})`, border: `2px solid ${C.greenEdge}`,
    color: '#fff', fontWeight: 900, fontSize: 15,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  gameOverText: { ...titleText(34, '#ff8a6a'), textAlign: 'center', letterSpacing: 2 },
  newRecord: { ...titleText(22, C.goldHi), textAlign: 'center' },
  resultsWrap: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%' },
  statsCard: {
    ...tile,
    border: `3px solid ${C.edge}`, boxShadow: `0 4px 0 ${C.edge}`,
    padding: '14px 20px', width: '100%', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  mapBadge: {
    ...pill,
    alignSelf: 'center', padding: '4px 14px', color: C.cream,
    border: '3px solid', fontSize: 12, letterSpacing: 1.5,
    marginBottom: 4,
  },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 },
  statLabel: { color: C.inkSoft, fontSize: 12, fontWeight: 800, letterSpacing: 1 },
  statValue: { fontFamily: DISPLAY, fontSize: 20, letterSpacing: 0.5 },
  introWrap: { textAlign: 'center', width: '100%' },
  dailyWidget: {
    ...tile, border: `2px solid ${C.woodDk}`,
    padding: '10px 16px', marginBottom: 10, textAlign: 'left',
  },
  dailyHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  dailyIcon: { fontSize: 14 },
  dailyLabel: { fontSize: 11, letterSpacing: 1.5, color: C.inkSoft, fontWeight: 800, flex: 1 },
  dailyDone: { fontSize: 11, color: C.green, letterSpacing: 1, fontWeight: 800 },
  dailyChallenge: { fontSize: 13, color: C.ink, fontWeight: 800, letterSpacing: 1, marginBottom: 8 },
  progressBarBg: { height: 10, background: C.edgeDk, border: `2px solid ${C.edge}`, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})`, transition: 'width 0.5s ease' },
  dailyRewardBtn: {
    ...btn.primary,
    position: 'relative', width: '100%', padding: '11px', marginBottom: 10, minHeight: 44,
    fontSize: 14, textTransform: 'uppercase',
  },
  dailyDot: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: '50%', background: C.red, border: `2px solid ${C.cream}` },
  missionRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: `2px dashed ${C.creamDk}` },
  missionLabel: { fontSize: 12, color: C.ink, fontWeight: 800, marginBottom: 4 },
  missionProg: { fontSize: 11, color: C.inkSoft, fontWeight: 700, marginTop: 2 },
  missionReward: { fontSize: 12, color: C.inkSoft, fontWeight: 800, whiteSpace: 'nowrap' },
  missionClaim: { ...btn.primary, fontSize: 13, padding: '6px 10px', minHeight: 44, whiteSpace: 'nowrap' },
  missionDone: { fontSize: 16, color: C.green, fontWeight: 900 },
  introText: { color: C.inkSoft, fontSize: 13, fontWeight: 700, lineHeight: 1.7, margin: '8px 0 0' },
  controlsHint: { marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' },
  key: {
    background: C.creamDk, border: `2px solid ${C.edge}`, boxShadow: `0 2px 0 ${C.edge}`,
    borderRadius: 6, padding: '2px 8px', fontSize: 14, color: C.ink,
  },
  hintText: { fontSize: 12, fontWeight: 700, color: C.inkSoft },
  warn:       { color: C.red, fontSize: 12, fontWeight: 800, margin: 0 },
  connecting: { color: C.inkSoft, fontSize: 12, fontWeight: 700, margin: 0 },
  mapHsRow: {
    display: 'flex', gap: 12, alignItems: 'center', fontSize: 12,
    color: C.inkSoft, fontWeight: 700,
  },
  mapHsVal: { fontFamily: DISPLAY, color: C.ink },
  mapRow: {
    display: 'flex', gap: 8, width: '100%',
    flexWrap: 'wrap', justifyContent: 'center',
  },
  mapCard: {
    flex: '1 1 80px', minWidth: 78, maxWidth: 140,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 3, padding: '10px 6px', borderRadius: 14,
    cursor: 'pointer', border: '3px solid', transition: 'all 0.15s',
    boxSizing: 'border-box', marginBottom: 4,
  },
  mapEmoji: { fontSize: 24 },
  mapName: { fontFamily: DISPLAY, fontSize: 12, letterSpacing: 0.5, textAlign: 'center' },
  mapSub:  { color: C.inkSoft, fontSize: 10, fontWeight: 700, textAlign: 'center' },
  mapHsChip: { fontFamily: DISPLAY, fontSize: 12, letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },
  nightBtn: {
    ...btn.secondary,
    padding: '8px 24px', fontSize: 13, minHeight: 44,
    width: '100%', transition: 'all 0.15s',
  },
  activeRow: {
    ...tile,
    display: 'flex', alignItems: 'center', gap: 10,
    border: `3px solid ${C.edge}`, boxShadow: `0 4px 0 ${C.edge}`,
    padding: '10px 16px', minHeight: 52,
    cursor: 'pointer', width: '100%', boxSizing: 'border-box',
  },
  activeItem: { display: 'flex', alignItems: 'center', gap: 7, flex: 1 },
  activeDivider: { width: 2, height: 24, background: C.woodDk, opacity: 0.4 },
  activeEmoji: { fontSize: 20 },
  activeName: { color: C.ink, fontSize: 12, fontWeight: 800, letterSpacing: 1 },
  levelPill: { ...pill, fontSize: 11, padding: '2px 8px' },
  changeHint: { fontFamily: DISPLAY, color: C.woodDk, fontSize: 12, letterSpacing: 0.5 },
  fixedHeader: {
    flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    padding: '18px 18px 14px',
    borderBottom: `4px solid ${C.edge}`,
    background: `linear-gradient(180deg, #3a2414 0%, ${C.bgDeep} 100%)`,
  },
  medalStrip: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%',
  },
  onboardCard: {
    ...tile,
    width: '100%', boxSizing: 'border-box',
    border: `3px solid ${C.blueEdge}`, boxShadow: `0 4px 0 ${C.blueEdge}`,
    background: '#e6eefa', padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  onboardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  onboardTitle: { flex: 1, fontSize: 15, letterSpacing: 1, color: C.blueEdge, fontFamily: DISPLAY },
  onboardCount: { fontSize: 12, color: C.blueEdge, fontWeight: 800 },
  onboardRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', minHeight: 44, borderTop: `2px dashed rgba(30,74,122,0.25)` },
  onboardClaim: { ...btn.success, fontSize: 12, padding: '5px 10px', borderRadius: 10, boxShadow: `0 3px 0 ${C.greenEdge}`, whiteSpace: 'nowrap' },
  onboardGo: { fontFamily: DISPLAY, fontSize: 13, color: C.blueEdge, whiteSpace: 'nowrap' },
  medalIcons: { display: 'flex', gap: 2 },
  medalGoal: { fontSize: 12, color: C.cream, fontFamily: FONT, fontWeight: 700 },
  btn: {
    ...btn.primary,
    padding: '13px 52px', minHeight: 56,
    fontSize: 24, textTransform: 'uppercase',
    width: '100%',
  },
  leaderboardBtn: { ...btn.secondary, padding: '10px 24px', fontSize: 15, minHeight: 44, width: '100%' },
  garageBtn: { ...btn.secondary, padding: '10px 24px', fontSize: 15, minHeight: 44, width: '100%' },
  guideBtn: { ...btn.ghost, padding: '9px 24px', fontSize: 13, width: '100%' },
};
