import useGameStore from '@/store/useGameStore';

// Görev sekmesi modalı: günlük görevler + günlük ödül + liderlik kısayolları
export default function Missions({ onClose, onDaily, onLeaderboard }) {
  const dailyCarrots   = useGameStore(s => s.dailyCarrots);
  const missionClaimed = useGameStore(s => s.missionClaimed);
  const getMissions    = useGameStore(s => s.getMissions);
  const claimMission   = useGameStore(s => s.claimMission);
  const canClaimStreak = useGameStore(s => s.canClaimStreak)();
  const lifeStats      = useGameStore(s => s.lifeStats);
  const achClaimed     = useGameStore(s => s.achClaimed);
  const weekStats      = useGameStore(s => s.weekStats);
  const weeklyClaimed  = useGameStore(s => s.weeklyClaimed);
  const getAchievements   = useGameStore(s => s.getAchievements);
  const claimAchievement  = useGameStore(s => s.claimAchievement);
  const getWeeklyMissions = useGameStore(s => s.getWeeklyMissions);
  const claimWeekly       = useGameStore(s => s.claimWeekly);
  const missions = getMissions(); // dailyCarrots/missionClaimed değişince yenilenir
  const weekly   = getWeeklyMissions(); // weekStats/weeklyClaimed değişince yenilenir
  const achievements = getAchievements(); // lifeStats/achClaimed değişince yenilenir

  return (
    <div style={S.modal}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>🎯 GÖREVLER</span>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        <button style={{ ...S.bigBtn, ...S.dailyBtn }} onClick={onDaily}>
          🎁 GÜNLÜK ÖDÜL
          {canClaimStreak && <span style={S.dot} />}
        </button>

        <div style={S.sectionLabel}>GÜNLÜK GÖREVLER</div>
        {missions.map(m => (
          <div key={m.id} style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{m.label}</div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${(m.progress / m.target) * 100}%`, background: m.done ? '#33ff99' : '#ffd700' }} />
              </div>
              <div style={S.prog}>{m.progress}/{m.target}</div>
            </div>
            {m.claimed ? (
              <span style={S.doneTick}>✓</span>
            ) : m.done ? (
              <button style={S.claim} onClick={() => claimMission(m.id)}>🥕 {m.reward}</button>
            ) : (
              <span style={S.reward}>🥕 {m.reward}</span>
            )}
          </div>
        ))}

        {/* Haftalık görevler — pazartesi sıfırlanır, büyük ödül */}
        <div style={{ ...S.sectionLabel, marginTop: 18, color: 'rgba(140,180,255,0.85)' }}>HAFTALIK GÖREVLER</div>
        {weekly.map(m => (
          <div key={m.id} style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{m.label}</div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${(m.progress / m.target) * 100}%`, background: m.done ? '#33ff99' : '#6a9fff' }} />
              </div>
              <div style={S.prog}>{m.progress.toLocaleString()}/{m.target.toLocaleString()}</div>
            </div>
            {m.claimed ? (
              <span style={S.doneTick}>✓</span>
            ) : m.done ? (
              <button style={S.claim} onClick={() => claimWeekly(m.id)}>🥕 {m.reward}</button>
            ) : (
              <span style={S.reward}>🥕 {m.reward}</span>
            )}
          </div>
        ))}

        {/* Başarımlar — kalıcı hedefler */}
        <div style={{ ...S.sectionLabel, marginTop: 18 }}>BAŞARIMLAR</div>
        {achievements.map(a => (
          <div key={a.id} style={S.row}>
            <span style={{ fontSize: 18 }}>{a.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{a.label}</div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${(a.progress / a.target) * 100}%`, background: a.done ? '#33ff99' : '#8899ff' }} />
              </div>
              <div style={S.prog}>{a.progress.toLocaleString()}/{a.target.toLocaleString()}</div>
            </div>
            {a.claimed ? (
              <span style={S.doneTick}>✓</span>
            ) : a.done ? (
              <button style={S.claim} onClick={() => claimAchievement(a.id)}>🥕 {a.reward}</button>
            ) : (
              <span style={S.reward}>🥕 {a.reward}</span>
            )}
          </div>
        ))}

        <button style={{ ...S.bigBtn, ...S.lbBtn }} onClick={onLeaderboard}>
          🏆 LİDERLİK TABLOSU
        </button>
      </div>
    </div>
  );
}

const S = {
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 640, padding: 14 },
  box: { width: '100%', maxWidth: 400, maxHeight: '88vh', overflowY: 'auto', background: 'linear-gradient(160deg, rgba(18,18,34,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, padding: '18px 16px', fontFamily: 'var(--game-font)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 800, letterSpacing: 1, color: '#fff' },
  close: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, fontSize: 14, cursor: 'pointer' },
  bigBtn: { position: 'relative', width: '100%', padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--game-font)', fontWeight: 800, letterSpacing: 2, fontSize: 12 },
  dailyBtn: { background: 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,160,0,0.12))', border: '1px solid rgba(255,215,0,0.4)', color: '#ffd700', marginBottom: 14 },
  dot: { position: 'absolute', top: 9, right: 12, width: 10, height: 10, borderRadius: '50%', background: '#ff3b3b', boxShadow: '0 0 8px #ff3b3b' },
  sectionLabel: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,215,0,0.7)', fontWeight: 700, marginBottom: 6 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' },
  label: { fontSize: 12, color: '#fff', fontWeight: 700, marginBottom: 5 },
  barBg: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.4s' },
  prog: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  reward: { fontSize: 11, color: 'rgba(255,215,0,0.55)', fontWeight: 700, whiteSpace: 'nowrap' },
  claim: { fontSize: 11, fontWeight: 800, color: '#0a0a14', background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', border: 'none', borderRadius: 7, padding: '7px 11px', cursor: 'pointer', fontFamily: 'var(--game-font)', whiteSpace: 'nowrap' },
  doneTick: { fontSize: 16, color: '#33ff99', fontWeight: 900 },
  lbBtn: { marginTop: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#ffd060' },
};
