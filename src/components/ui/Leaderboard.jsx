import { useState, useEffect } from 'react';
import useGameStore from '@/store/useGameStore';
import { fetchLeaderboard } from '@/services/LeaderboardService';

export default function Leaderboard({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const playerId = useGameStore(s => s.playerId);

  useEffect(() => {
    fetchLeaderboard(20)
      .then(data => { setEntries(data); setLoading(false); })
      .catch(() => { setError('Bağlantı hatası'); setLoading(false); });
  }, []);

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <span>🏆</span>
          <h2 style={S.title}>KÜRESEL SKOR</h2>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && <div style={S.status}>Yükleniyor...</div>}
        {error   && <div style={{ ...S.status, color: '#ff6644' }}>{error}</div>}

        {!loading && !error && (
          <div style={S.list}>
            {entries.map((e, i) => {
              const isMe = String(e.player?.id) === String(playerId);
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
              return (
                <div key={e.rank ?? i} style={{ ...S.row, background: isMe ? 'rgba(255,215,0,0.12)' : 'transparent', borderColor: isMe ? '#ffd700' : 'rgba(255,255,255,0.07)' }}>
                  <span style={S.rank}>{medal}</span>
                  <span style={{ ...S.name, color: isMe ? '#ffd700' : '#fff' }}>
                    {e.player?.name || `Oyuncu ${e.player?.id}`}
                    {isMe ? ' (Sen)' : ''}
                  </span>
                  <span style={S.score}>{(e.score ?? 0).toLocaleString()}</span>
                </div>
              );
            })}
            {entries.length === 0 && <div style={S.status}>Henüz skor yok.</div>}
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
  },
  panel: {
    background: 'rgba(8,10,22,0.97)',
    border: '1px solid rgba(255,215,0,0.25)',
    borderRadius: 16, padding: '24px 28px',
    width: 420, maxWidth: '95vw',
    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    fontFamily: 'monospace', boxShadow: '0 12px 60px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
  },
  title: {
    flex: 1, margin: 0, color: '#ffd700', fontSize: 20,
    letterSpacing: 4, fontFamily: 'monospace',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
    fontSize: 18, cursor: 'pointer', padding: '4px 8px',
  },
  list: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, border: '1px solid',
    transition: 'background 0.15s',
  },
  rank:  { width: 28, fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.6)', flexShrink: 0 },
  name:  { flex: 1, fontSize: 13, letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  score: { fontWeight: 700, fontSize: 15, color: '#33ff99', letterSpacing: 1, flexShrink: 0 },
  status: { textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', padding: 24 },
};
