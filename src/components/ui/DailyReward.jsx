import { useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { STREAK_REWARDS, STREAK_MAX_REWARD } from '@/constants/daily';

// Günlük giriş ödülü — 7 günlük takvim, her gün artan ödül.
export default function DailyReward({ onClose }) {
  const streakDay   = useGameStore(s => s.streakDay);
  const canClaim    = useGameStore(s => s.canClaimStreak)();
  const claimStreak = useGameStore(s => s.claimStreak);
  const [flash, setFlash] = useState('');

  const handleClaim = () => {
    const r = claimStreak();
    if (r > 0) setFlash(`+${r} 🥕 alındı!`);
  };

  return (
    <div style={S.modal}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>🎁 GÜNLÜK ÖDÜL</span>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        <div style={S.sub}>
          {streakDay > 7 ? '🔥 7+ gün! Artık her gün 7000 🥕' : 'Her gün giriş yap, ödülün büyüsün!'}
        </div>

        <div style={S.grid}>
          {STREAK_REWARDS.map((rw, i) => {
            const day = i + 1;
            const effDay = Math.min(streakDay, 7); // 7+ günde 7. kutu "bugün"
            const claimed = day < effDay || (day === effDay && !canClaim);
            const isToday = day === effDay && canClaim;
            return (
              <div key={day} style={{
                ...S.day,
                ...(isToday ? S.dayToday : {}),
                ...(claimed ? S.dayClaimed : {}),
                ...(day === 7 ? S.dayBig : {}),
              }}>
                <div style={S.dayNum}>{day === 7 ? '🏆' : `${day}.`}</div>
                <div style={S.dayCarrot}>🥕</div>
                <div style={S.dayAmt}>{rw}</div>
                {claimed && <div style={S.tick}>✓</div>}
              </div>
            );
          })}
        </div>

        {flash && <div style={S.flash}>{flash}</div>}

        {canClaim ? (
          <button style={S.claimBtn} onClick={handleClaim}>
            {`${streakDay}. GÜN ÖDÜLÜNÜ AL (🥕 ${streakDay <= 7 ? STREAK_REWARDS[streakDay - 1] : STREAK_MAX_REWARD})`}
          </button>
        ) : (
          <div style={S.done}>✓ Bugünün ödülü alındı — yarın tekrar gel!</div>
        )}
      </div>
    </div>
  );
}

const S = {
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 680, padding: 14 },
  box: { width: '100%', maxWidth: 380, background: 'linear-gradient(160deg, rgba(18,18,34,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 16, padding: '18px 16px', fontFamily: 'var(--game-font)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: 800, letterSpacing: 1, color: '#ffd700' },
  close: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, fontSize: 14, cursor: 'pointer' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  day: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' },
  dayBig: { gridColumn: 'span 1', border: '1px solid rgba(255,215,0,0.5)', background: 'rgba(255,215,0,0.1)' },
  dayToday: { border: '2px solid #ffd700', background: 'rgba(255,215,0,0.15)', boxShadow: '0 0 14px rgba(255,215,0,0.3)' },
  dayClaimed: { opacity: 0.45 },
  dayNum: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' },
  dayCarrot: { fontSize: 16 },
  dayAmt: { fontSize: 11, fontWeight: 800, color: '#ffd700' },
  tick: { position: 'absolute', top: 2, right: 4, color: '#33ff99', fontWeight: 900, fontSize: 12 },
  flash: { textAlign: 'center', color: '#33ff99', fontWeight: 700, fontSize: 13, marginTop: 12 },
  claimBtn: { marginTop: 14, width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--game-font)', fontWeight: 800, letterSpacing: 1, fontSize: 13, color: '#0a0a14', background: 'linear-gradient(135deg,#ffd54a,#ff9f00)' },
  done: { marginTop: 14, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '10px' },
};
