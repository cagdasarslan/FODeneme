import useGameStore from '@/store/useGameStore';
import { sfx } from '@/utils/audio';

// Ayarlar: ses aç/kapat + görüntü kalitesi (DÜŞÜK / YÜKSEK)
export default function Settings({ onClose }) {
  const soundOn   = useGameStore(s => s.soundOn);
  const graphics  = useGameStore(s => s.graphics);
  const setSoundOn = useGameStore(s => s.setSoundOn);
  const setGraphics = useGameStore(s => s.setGraphics);

  return (
    <div style={S.modal}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>⚙️ AYARLAR</span>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        {/* Ses */}
        <div style={S.row}>
          <span style={S.label}>🔊 Ses</span>
          <div style={S.seg}>
            {[['AÇIK', true], ['KAPALI', false]].map(([txt, val]) => (
              <button
                key={txt}
                style={{ ...S.segBtn, ...(soundOn === val ? S.segOn : {}) }}
                onClick={() => { setSoundOn(val); if (val) sfx.click(); }}
              >{txt}</button>
            ))}
          </div>
        </div>

        {/* Görüntü */}
        <div style={S.row}>
          <span style={S.label}>🎮 Görüntü</span>
          <div style={S.seg}>
            {[['DÜŞÜK', 'low'], ['YÜKSEK', 'high']].map(([txt, val]) => (
              <button
                key={txt}
                style={{ ...S.segBtn, ...(graphics === val ? S.segOn : {}) }}
                onClick={() => { setGraphics(val); sfx.click(); }}
              >{txt}</button>
            ))}
          </div>
        </div>

        <div style={S.note}>
          DÜŞÜK görüntü: gölgeler kapalı, daha akıcı (yavaş telefonlar için).
        </div>
      </div>
    </div>
  );
}

const S = {
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 650, padding: 16,
  },
  box: {
    width: '100%', maxWidth: 360,
    background: 'linear-gradient(160deg, rgba(18,18,34,0.98), rgba(10,10,20,0.99))',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '18px 18px',
    fontFamily: 'monospace',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 800, letterSpacing: 1, color: '#fff' },
  close: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, fontSize: 14, cursor: 'pointer' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 700 },
  seg: { display: 'flex', gap: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 },
  segBtn: {
    minWidth: 64, padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
    background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 7,
    cursor: 'pointer', fontFamily: 'monospace', transition: 'all 0.15s',
  },
  segOn: { background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', color: '#0a0a14' },
  note: { fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 6, lineHeight: 1.5 },
};
