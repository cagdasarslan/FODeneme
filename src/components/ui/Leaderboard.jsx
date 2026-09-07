import { useState, useEffect } from 'react';
import useGameStore from '@/store/useGameStore';
import { fetchLeaderboard } from '@/services/LeaderboardService';
import { fetchPeriodTop, fetchTotalTop, getTotalScore, getPlayerName, isSupaConfigured, getPlayerLocalId } from '@/services/SupaLeaderboard';
import { t } from '@/i18n';
import useLang from '@/i18n/useLang';
import { SAFE_TOP, BOTTOM_SPACE } from '@/utils/safeArea';

// Sekmeler: sezonluk tablolar (Supabase) + TÜMÜ (LootLocker, tüm zamanlar).
// Sezonluk tablolar dönem sonunda kendiliğinden "sıfırlanır" (tarih filtresi) —
// harcamadan bağımsız, adil rekabet.
const TABS = [
  { id: 'day',   label: 'GÜN' },
  { id: 'week',  label: 'HAFTA' },
  { id: 'month', label: 'AY' },
  { id: 'year',  label: 'YIL' },
  { id: 'all',   label: 'TÜMÜ' },
];

export default function Leaderboard({ onClose }) {
  useLang();
  const [tab, setTab] = useState(isSupaConfigured() ? 'week' : 'all');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const playerId = useGameStore(s => s.playerId);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null); setEntries([]);
    // TÜMÜ: her oynayışın skorunu toplayan kümülatif toplam (Supabase 'totals').
    // Supabase yoksa eski tüm-zamanlar rekor tablosuna (LootLocker) düşer.
    const load = tab === 'all'
      ? (isSupaConfigured()
          ? fetchTotalTop(20).then(rows => {
              const me = getPlayerLocalId();
              let list = rows.map((r, i) => ({
                key: r.player_id + i,
                name: r.player_name,
                score: r.total ?? 0,
                isMe: r.player_id === me,
              }));
              // Kendi toplamım listede yoksa (ilk 20 dışında) en alta ekle
              if (!list.some(e => e.isMe) && getTotalScore() > 0) {
                list = [...list, { key: 'me', name: getPlayerName(), score: getTotalScore(), isMe: true }];
              }
              return list;
            })
          : fetchLeaderboard(20).then(data => data.map((e, i) => ({
              key: e.rank ?? i,
              name: e.player?.name || `${t('Oyuncu')} ${e.player?.id}`,
              score: e.score ?? 0,
              isMe: String(e.player?.id) === String(playerId),
            }))))
      : fetchPeriodTop(tab, 20).then(rows => rows.map((r, i) => ({
          key: r.player_id + i,
          name: r.player_name,
          score: r.score,
          isMe: r.player_id === getPlayerLocalId(),
        })));
    load
      .then(list => { if (on) { setEntries(list); setLoading(false); } })
      .catch(() => { if (on) { setError(t('Bağlantı hatası')); setLoading(false); } });
    return () => { on = false; };
  }, [tab, playerId]);

  const seasonalUnavailable = tab !== 'all' && !isSupaConfigured();

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <span>🏆</span>
          <h2 style={S.title}>{t('LİDERLİK')}</h2>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Dönem sekmeleri */}
        <div style={S.tabs}>
          {TABS.map(tb => (
            <button
              key={tb.id}
              style={{ ...S.tab, ...(tab === tb.id ? S.tabOn : {}) }}
              onClick={() => setTab(tb.id)}
            >{t(tb.label)}</button>
          ))}
        </div>

        {tab === 'all' && isSupaConfigured() && (
          <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: 1 }}>
            🧮 {t('Tüm haritalardaki her oynayışın TOPLAM skoru')}
          </div>
        )}

        {seasonalUnavailable ? (
          <div style={S.status}>
            📅 {t('Sezonluk tablolar yakında!')}<br />
            <span style={{ fontSize: 10, opacity: 0.7 }}>
              {t('(Supabase yapılandırması bekleniyor — TÜMÜ sekmesi aktif)')}
            </span>
          </div>
        ) : loading ? (
          <div style={S.status}>{t('Yükleniyor...')}</div>
        ) : error ? (
          <div style={{ ...S.status, color: '#ff6644' }}>{error}</div>
        ) : (
          <div style={S.list}>
            {entries.map((e, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              return (
                <div key={e.key} style={{ ...S.row, background: e.isMe ? 'rgba(255,215,0,0.12)' : 'transparent', borderColor: e.isMe ? '#ffd700' : 'rgba(255,255,255,0.07)' }}>
                  <span style={S.rank}>{medal}</span>
                  <span style={{ ...S.name, color: e.isMe ? '#ffd700' : '#fff' }}>
                    {e.name}{e.isMe ? ' (' + t('Sen') + ')' : ''}
                  </span>
                  <span style={S.score}>{(e.score ?? 0).toLocaleString()}</span>
                </div>
              );
            })}
            {entries.length === 0 && <div style={S.status}>{t('Bu dönemde henüz skor yok — ilk sen ol!')} 🏇</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 12000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)',
    paddingTop: SAFE_TOP, paddingBottom: BOTTOM_SPACE, boxSizing: 'border-box',
  },
  panel: {
    background: 'rgba(8,10,22,0.97)',
    border: '1px solid rgba(255,215,0,0.25)',
    borderRadius: 16, padding: '24px 28px',
    width: 420, maxWidth: '95vw',
    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--game-font)', boxShadow: '0 12px 60px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  title: {
    flex: 1, margin: 0, color: '#ffd700', fontSize: 20,
    letterSpacing: 4, fontFamily: 'var(--game-font)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
    fontSize: 18, cursor: 'pointer', padding: '4px 8px',
  },
  tabs: { display: 'flex', gap: 4, marginBottom: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 },
  tab: {
    flex: 1, padding: '7px 2px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
    background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none',
    borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--game-font)',
  },
  tabOn: { background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', color: '#0a0a14' },
  list: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, border: '1px solid',
    transition: 'background 0.15s',
  },
  rank:  { width: 28, fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.6)', flexShrink: 0 },
  name:  { flex: 1, fontSize: 13, letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  score: { fontWeight: 700, fontSize: 15, color: '#33ff99', letterSpacing: 1, flexShrink: 0 },
  status: { textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--game-font)', padding: 24, lineHeight: 1.7 },
};
