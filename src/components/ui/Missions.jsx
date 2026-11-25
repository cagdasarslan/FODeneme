import useGameStore from '@/store/useGameStore';
import { SAFE_TOP, BOTTOM_SPACE } from '@/utils/safeArea';
import { t } from '@/i18n';
import { C, FONT, DISPLAY, btn, panel, tile, pill, titleText, backdrop } from '@/ui/theme';
import useLang from '@/i18n/useLang';

// Görev sekmesi modalı: günlük görevler + günlük ödül + liderlik kısayolları
export default function Missions({ onClose, onDaily, onLeaderboard }) {
  useLang();
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
          <span style={S.title}>🎯 {t('GÖREVLER')}</span>
          <button aria-label={t('Kapat')} className="hr-press" style={S.close} onClick={onClose}>✕</button>
        </div>

        <button className="hr-press" style={{ ...S.bigBtn, ...S.dailyBtn }} onClick={onDaily}>
          🎁 {t('GÜNLÜK ÖDÜL')}
          {canClaimStreak && <span style={S.dot} />}
        </button>

        <div style={S.sectionLabel}>{t('GÜNLÜK GÖREVLER')}</div>
        {missions.map(m => (
          <div key={m.id} style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{t(m.label)}</div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${(m.progress / m.target) * 100}%`, background: m.done ? `linear-gradient(90deg, ${C.greenHi}, ${C.green})` : `linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})` }} />
              </div>
              <div style={S.prog}>{m.progress}/{m.target}</div>
            </div>
            {m.claimed ? (
              <span style={S.doneTick}>✓</span>
            ) : m.done ? (
              <button className="hr-press" style={S.claim} onClick={() => claimMission(m.id)}>🥕 {m.reward}</button>
            ) : (
              <span style={S.reward}>🥕 {m.reward}</span>
            )}
          </div>
        ))}

        {/* Haftalık görevler — pazartesi sıfırlanır, büyük ödül */}
        <div style={{ ...S.sectionLabel, marginTop: 18 }}>{t('HAFTALIK GÖREVLER')}</div>
        {weekly.map(m => (
          <div key={m.id} style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{t(m.label)}</div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${(m.progress / m.target) * 100}%`, background: m.done ? `linear-gradient(90deg, ${C.greenHi}, ${C.green})` : `linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})` }} />
              </div>
              <div style={S.prog}>{m.progress.toLocaleString()}/{m.target.toLocaleString()}</div>
            </div>
            {m.claimed ? (
              <span style={S.doneTick}>✓</span>
            ) : m.done ? (
              <button className="hr-press" style={S.claim} onClick={() => claimWeekly(m.id)}>🥕 {m.reward}</button>
            ) : (
              <span style={S.reward}>🥕 {m.reward}</span>
            )}
          </div>
        ))}

        {/* Başarımlar — kalıcı hedefler */}
        <div style={{ ...S.sectionLabel, marginTop: 18 }}>{t('BAŞARIMLAR')}</div>
        {achievements.map(a => (
          <div key={a.id} style={S.row}>
            <span style={{ fontSize: 18 }}>{a.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{t(a.label)}</div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${(a.progress / a.target) * 100}%`, background: a.done ? `linear-gradient(90deg, ${C.greenHi}, ${C.green})` : `linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})` }} />
              </div>
              <div style={S.prog}>{a.progress.toLocaleString()}/{a.target.toLocaleString()}</div>
            </div>
            {a.claimed ? (
              <span style={S.doneTick}>✓</span>
            ) : a.done ? (
              <button className="hr-press" style={S.claim} onClick={() => claimAchievement(a.id)}>🥕 {a.reward}</button>
            ) : (
              <span style={S.reward}>🥕 {a.reward}</span>
            )}
          </div>
        ))}

        <button className="hr-press" style={{ ...S.bigBtn, ...S.lbBtn }} onClick={onLeaderboard}>
          🏆 {t('LİDERLİK TABLOSU')}
        </button>
      </div>
    </div>
  );
}

const S = {
  modal: { position: 'fixed', inset: 0, background: backdrop, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 640, padding: 14, paddingTop: `calc(14px + ${SAFE_TOP})`, paddingBottom: `calc(14px + ${BOTTOM_SPACE})`, boxSizing: 'border-box' },
  box: { ...panel, width: '100%', maxWidth: 400, maxHeight: '88vh', overflowY: 'auto', padding: '18px 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { ...titleText(26), textTransform: 'uppercase' },
  close: { ...btn.icon, width: 44, height: 44, fontSize: 18 },
  bigBtn: { position: 'relative', width: '100%', padding: '12px', minHeight: 50, fontSize: 16, textTransform: 'uppercase' },
  dailyBtn: { ...btn.primary, marginBottom: 16 },
  dot: { position: 'absolute', top: 7, right: 10, width: 14, height: 14, borderRadius: '50%', background: C.red, border: `2px solid ${C.cream}` },
  sectionLabel: { fontFamily: DISPLAY, fontSize: 15, letterSpacing: 1, color: C.ink, marginBottom: 6 },
  row: { ...tile, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 6 },
  label: { fontSize: 13, color: C.ink, fontWeight: 800, marginBottom: 5 },
  barBg: { height: 10, background: C.edgeDk, borderRadius: 999, overflow: 'hidden', border: `2px solid ${C.edge}` },
  barFill: { height: '100%', borderRadius: 999, transition: 'width 0.4s' },
  prog: { fontSize: 11, color: C.inkSoft, fontWeight: 800, marginTop: 3 },
  reward: { fontSize: 14, color: C.inkSoft, fontFamily: DISPLAY, letterSpacing: 1, whiteSpace: 'nowrap' },
  claim: { ...btn.success, fontSize: 14, padding: '8px 12px', minHeight: 44, whiteSpace: 'nowrap' },
  doneTick: { fontSize: 22, color: C.green, fontWeight: 900, minWidth: 44, textAlign: 'center' },
  lbBtn: { ...btn.secondary, marginTop: 16 },
};
