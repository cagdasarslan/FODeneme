import { useState, useEffect } from 'react';
import useGameStore from '@/store/useGameStore';
import { fetchLeaderboard } from '@/services/LeaderboardService';
import { fetchPeriodTop, fetchTotalTop, getTotalScore, getPlayerName, isSupaConfigured, getPublicIdSync } from '@/services/SupaLeaderboard';
import { t } from '@/i18n';
import { C, FONT, DISPLAY, btn, panel, tile, pill, titleText, backdrop } from '@/ui/theme';
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
              const me = getPublicIdSync();
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
          isMe: r.player_id === getPublicIdSync(),
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
          <button aria-label={t('Kapat')} className="hr-press" style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Dönem sekmeleri */}
        <div style={S.tabs}>
          {TABS.map(tb => (
            <button
              key={tb.id}
              className="hr-press"
              style={{ ...S.tab, ...(tab === tb.id ? S.tabOn : {}) }}
              onClick={() => setTab(tb.id)}
            >{t(tb.label)}</button>
          ))}
        </div>

        {tab === 'all' && isSupaConfigured() && (
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 8, letterSpacing: 1 }}>
            🧮 {t('Tüm haritalardaki her oynayışın TOPLAM skoru')}
          </div>
        )}

        {seasonalUnavailable ? (
          <div style={S.status}>
            📅 {t('Sezonluk tablolar yakında!')}<br />
            <span style={{ fontSize: 11 }}>
              {t('(Supabase yapılandırması bekleniyor — TÜMÜ sekmesi aktif)')}
            </span>
          </div>
        ) : loading ? (
          <div style={S.status}>{t('Yükleniyor...')}</div>
        ) : error ? (
          <div style={{ ...S.status, color: C.red }}>{error}</div>
        ) : (
          <div style={S.list}>
            {entries.map((e, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              return (
                <div key={e.key} style={{ ...S.row, background: e.isMe ? '#fbe7b8' : C.creamDk, borderColor: e.isMe ? C.goldLo : C.creamDk }}>
                  <span style={S.rank}>{medal}</span>
                  <span style={{ ...S.name, color: C.ink }}>
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
    background: backdrop,
    paddingTop: SAFE_TOP, paddingBottom: BOTTOM_SPACE, boxSizing: 'border-box',
  },
  panel: {
    ...panel, padding: '20px 20px',
    width: 420, maxWidth: '95vw',
    maxHeight: '100%', display: 'flex', flexDirection: 'column',
  },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 24 },
  title: { ...titleText(26), flex: 1, margin: 0 },
  closeBtn: { ...btn.icon, width: 44, height: 44, fontSize: 18 },
  tabs: { display: 'flex', gap: 4, marginBottom: 12, background: C.woodDk, border: `3px solid ${C.edge}`, borderRadius: 14, padding: 4 },
  tab: {
    flex: 1, padding: '8px 2px', minHeight: 44, fontSize: 13, letterSpacing: 1,
    background: 'transparent', color: C.textOnDark, border: 'none',
    borderRadius: 10, cursor: 'pointer', fontFamily: DISPLAY,
  },
  tabOn: { background: `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})`, color: C.ink, boxShadow: `0 3px 0 ${C.edge}` },
  list: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    ...tile, display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', border: '3px solid',
  },
  rank:  { minWidth: 38, fontFamily: DISPLAY, fontSize: 16, color: C.inkSoft, flexShrink: 0 },
  name:  { flex: 1, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  score: { fontFamily: DISPLAY, fontSize: 17, color: C.greenEdge, letterSpacing: 1, flexShrink: 0 },
  status: { textAlign: 'center', color: C.inkSoft, fontFamily: FONT, fontWeight: 800, padding: 24, lineHeight: 1.7 },
};
