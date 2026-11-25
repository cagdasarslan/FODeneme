import { useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { STREAK_REWARDS, STREAK_MAX_REWARD } from '@/constants/daily';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { SAFE_TOP, BOTTOM_SPACE } from '@/utils/safeArea';
import { C, FONT, DISPLAY, btn, panel, tile, titleText, backdrop } from '@/ui/theme';

// Günlük giriş ödülü — 7 günlük takvim, her gün artan ödül.
export default function DailyReward({ onClose }) {
  useLang();
  const streakDay   = useGameStore(s => s.streakDay);
  const canClaim    = useGameStore(s => s.canClaimStreak)();
  const claimStreak = useGameStore(s => s.claimStreak);
  const [flash, setFlash] = useState('');

  const handleClaim = () => {
    const r = claimStreak();
    if (r > 0) setFlash(`+${r} 🥕 ` + t('alındı!'));
  };

  return (
    <div style={S.modal}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>🎁 {t('GÜNLÜK ÖDÜL')}</span>
          <button aria-label={t('Kapat')} className="hr-press" style={S.close} onClick={onClose}>✕</button>
        </div>

        <div style={S.sub}>
          {streakDay > 7 ? '🔥 ' + t('7+ gün! Artık her gün 7000 havuç') : t('Her gün giriş yap, ödülün büyüsün!')}
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
          <button className="hr-press" style={S.claimBtn} onClick={handleClaim}>
            {t('{n}. GÜN ÖDÜLÜNÜ AL', { n: streakDay }) + ` (🥕 ${streakDay <= 7 ? STREAK_REWARDS[streakDay - 1] : STREAK_MAX_REWARD})`}
          </button>
        ) : (
          <div style={S.done}>✓ {t('Bugünün ödülü alındı — yarın tekrar gel!')}</div>
        )}
      </div>
    </div>
  );
}

const S = {
  modal: { position: 'fixed', inset: 0, background: backdrop, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 680, padding: 14, paddingTop: `calc(14px + ${SAFE_TOP})`, paddingBottom: `calc(14px + ${BOTTOM_SPACE})`, boxSizing: 'border-box' },
  box: { ...panel, width: '100%', maxWidth: 380, padding: '18px 16px 20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  title: { ...titleText(24), textTransform: 'uppercase' },
  close: { ...btn.icon, width: 44, height: 44, fontSize: 16, flexShrink: 0 },
  sub: { fontSize: 13, fontWeight: 800, color: C.inkSoft, textAlign: 'center', marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  day: { ...tile, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px', border: `2px solid ${C.edge}`, boxShadow: `0 3px 0 ${C.edge}` },
  dayBig: { gridColumn: 'span 1', background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})` },
  dayToday: { border: `3px solid ${C.edge}`, background: `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})`, transform: 'translateY(-2px)', boxShadow: `0 5px 0 ${C.edge}` },
  dayClaimed: { opacity: 0.55 },
  dayNum: { fontSize: 12, fontWeight: 800, color: C.inkSoft, fontFamily: FONT },
  dayCarrot: { fontSize: 18 },
  dayAmt: { fontSize: 15, color: C.ink, fontFamily: DISPLAY },
  tick: { position: 'absolute', top: 2, right: 4, color: C.greenEdge, fontWeight: 900, fontSize: 14 },
  flash: { textAlign: 'center', color: C.greenEdge, fontWeight: 800, fontSize: 14, marginTop: 12 },
  claimBtn: { ...btn.primary, marginTop: 16, width: '100%', minHeight: 52, padding: '12px', fontSize: 16, textTransform: 'uppercase' },
  done: { ...tile, marginTop: 16, textAlign: 'center', color: C.inkSoft, fontWeight: 800, fontSize: 13, padding: '12px' },
};
