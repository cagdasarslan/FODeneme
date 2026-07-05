import { useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { sfx } from '@/utils/audio';
import { getRecoveryCode, restoreFromCloud, pushCloudSave } from '@/services/CloudSave';
import { getAuthUser, signInWith, signOut } from '@/services/AuthService';

// Ayarlar: ses aç/kapat + görüntü kalitesi (DÜŞÜK / YÜKSEK)
export default function Settings({ onClose }) {
  const soundOn   = useGameStore(s => s.soundOn);
  const musicOn   = useGameStore(s => s.musicOn);
  const graphics  = useGameStore(s => s.graphics);
  const setSoundOn = useGameStore(s => s.setSoundOn);
  const setMusicOn = useGameStore(s => s.setMusicOn);
  const setGraphics = useGameStore(s => s.setGraphics);

  return (
    <div style={S.modal}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>⚙️ AYARLAR</span>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        {/* Oyun sesleri (SFX + nal) */}
        <div style={S.row}>
          <span style={S.label}>🔊 Oyun Sesleri</span>
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

        {/* Harita müziği */}
        <div style={S.row}>
          <span style={S.label}>🎵 Harita Müziği</span>
          <div style={S.seg}>
            {[['AÇIK', true], ['KAPALI', false]].map(([txt, val]) => (
              <button
                key={txt}
                style={{ ...S.segBtn, ...(musicOn === val ? S.segOn : {}) }}
                onClick={() => setMusicOn(val)}
              >{txt}</button>
            ))}
          </div>
        </div>

        {/* Görüntü — 3 kademe: DÜŞÜK / ORTA / YÜKSEK */}
        <div style={S.row}>
          <span style={S.label}>🎮 Görüntü</span>
          <div style={S.seg}>
            {[['DÜŞÜK', 'low'], ['ORTA', 'medium'], ['YÜKSEK', 'high']].map(([txt, val]) => (
              <button
                key={txt}
                style={{ ...S.segBtn, minWidth: 52, padding: '8px 6px', ...(graphics === val ? S.segOn : {}) }}
                onClick={() => {
                  localStorage.setItem('gfx_user', '1'); // otomatik kalite artık karışmaz
                  setGraphics(val);
                  sfx.click();
                }}
              >{txt}</button>
            ))}
          </div>
        </div>

        {/* Bulut kaydı — kurtarma kodu + geri yükleme */}
        <CloudSection />

        <div style={S.note}>
          DÜŞÜK: gölge yok, en akıcı · ORTA: dengeli · YÜKSEK: gölge + ışıltı (bloom). Yavaş telefonlar için DÜŞÜK/ORTA önerilir.
        </div>
      </div>
    </div>
  );
}

// ── Bulut kaydı bölümü ────────────────────────────────────────────────────────
// İlerleme otomatik yedeklenir; oyunu silen oyuncu KURTARMA KODU ile geri alır.
function CloudSection() {
  const [code, setCode]   = useState('');
  const [msg, setMsg]     = useState('');
  const [busy, setBusy]   = useState(false);
  const myCode = getRecoveryCode();

  const doRestore = async () => {
    if (busy || code.trim().length < 6) return;
    setBusy(true);
    setMsg('Yükleniyor…');
    const r = await restoreFromCloud(code);
    if (r.ok) {
      setMsg('✓ Geri yüklendi! Oyun yeniden başlatılıyor…');
      setTimeout(() => window.location.reload(), 1200);
    } else {
      setMsg('⚠ ' + r.reason);
      setBusy(false);
    }
  };

  const user = getAuthUser();

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 700, marginBottom: 6 }}>
        ☁️ Bulut Kaydı
      </div>

      {/* Google / Apple hesabı: yedek hesaba bağlanır, kod gerekmez */}
      {user ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(51,255,153,0.08)', border: '1px solid rgba(51,255,153,0.35)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#33ff99', fontWeight: 700 }}>✓ HESABA BAĞLI</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{user.email || user.name || user.provider}</div>
          </div>
          <button
            style={{ ...S.segBtn, minWidth: 60, border: '1px solid rgba(255,255,255,0.2)' }}
            onClick={() => { signOut(); sfx.click(); window.location.reload(); }}
          >ÇIKIŞ</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            style={{ flex: 1, padding: '10px 8px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
              fontFamily: 'var(--game-font)', borderRadius: 8, cursor: 'pointer',
              background: '#fff', color: '#1a1a2a', border: 'none' }}
            onClick={() => { sfx.click(); signInWith('google'); }}
          >🇬 Google ile Giriş</button>
          <button
            style={{ flex: 1, padding: '10px 8px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
              fontFamily: 'var(--game-font)', borderRadius: 8, cursor: 'pointer',
              background: '#000', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
            onClick={() => { sfx.click(); signInWith('apple'); }}
          > Apple ile Giriş</button>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 8 }}>
        {user
          ? 'İlerlemen hesabına otomatik yedekleniyor. Oyunu silsen bile giriş yapınca her şey geri gelir.'
          : <>Giriş yaparsan ilerlemen hesabına bağlanır. Giriş yapmazsan da bu kodla geri alabilirsin — <b style={{ color: '#ffd700' }}>kodu bir yere not et!</b></>}
      </div>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,215,0,0.08)', border: '1px dashed rgba(255,215,0,0.4)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 10, cursor: 'pointer',
        }}
        onClick={() => {
          navigator.clipboard?.writeText(myCode).catch(() => {});
          pushCloudSave();
          sfx.click();
          setMsg('✓ Kod kopyalandı + yedek alındı');
        }}
      >
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>KURTARMA KODUN</span>
        <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, color: '#ffd700' }}>{myCode}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={code}
          maxLength={12}
          placeholder="Eski kodunu gir…"
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') doRestore(); }}
          style={{ ...S.nameInput, letterSpacing: 2 }}
        />
        <button
          style={{ ...S.segBtn, ...S.segOn, minWidth: 90, opacity: code.trim().length < 6 || busy ? 0.4 : 1 }}
          disabled={code.trim().length < 6 || busy}
          onClick={doRestore}
        >GERİ YÜKLE</button>
      </div>
      {msg && <div style={{ fontSize: 10, marginTop: 6, color: msg.startsWith('⚠') ? '#ff8866' : '#33ff99', fontWeight: 700 }}>{msg}</div>}
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
    fontFamily: 'var(--game-font)',
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
    cursor: 'pointer', fontFamily: 'var(--game-font)', transition: 'all 0.15s',
  },
  segOn: { background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', color: '#0a0a14' },
  nameInput: {
    flex: 1, minWidth: 0, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--game-font)',
    fontWeight: 700, background: 'rgba(0,0,0,0.4)', color: '#ffd700',
    border: '1px solid rgba(255,215,0,0.35)', borderRadius: 8, outline: 'none',
  },
  note: { fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 6, lineHeight: 1.5 },
};
