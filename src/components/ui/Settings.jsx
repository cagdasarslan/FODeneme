import { useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { sfx } from '@/utils/audio';
import { getRecoveryCode, restoreFromCloud, pushCloudSave, deleteAllData, hasLocalProgress } from '@/services/CloudSave';
import { getAuthUser, signInWith, signOut } from '@/services/AuthService';
import { t, getLang, setLang } from '@/i18n';
import useLang from '@/i18n/useLang';
import { C, FONT, DISPLAY, btn, panel, tile, titleText, backdrop } from '@/ui/theme';
import { SAFE_TOP, BOTTOM_SPACE } from '@/utils/safeArea';

// Ayarlar: ses aç/kapat + görüntü kalitesi (DÜŞÜK / YÜKSEK)
export default function Settings({ onClose }) {
  useLang();
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
          <span style={S.title}>⚙️ {t('AYARLAR')}</span>
          <button aria-label={t('Kapat')} className="hr-press" style={S.close} onClick={onClose}>✕</button>
        </div>

        {/* Oyun sesleri (SFX + nal) */}
        <div style={S.row}>
          <span style={S.label}>🔊 {t('Oyun Sesleri')}</span>
          <div style={S.seg}>
            {[['AÇIK', true], ['KAPALI', false]].map(([txt, val]) => (
              <button
                className="hr-press"
                key={txt}
                style={{ ...S.segBtn, ...(soundOn === val ? S.segOn : {}) }}
                onClick={() => { setSoundOn(val); if (val) sfx.click(); }}
              >{t(txt)}</button>
            ))}
          </div>
        </div>

        {/* Harita müziği */}
        <div style={S.row}>
          <span style={S.label}>🎵 {t('Harita Müziği')}</span>
          <div style={S.seg}>
            {[['AÇIK', true], ['KAPALI', false]].map(([txt, val]) => (
              <button
                className="hr-press"
                key={txt}
                style={{ ...S.segBtn, ...(musicOn === val ? S.segOn : {}) }}
                onClick={() => setMusicOn(val)}
              >{t(txt)}</button>
            ))}
          </div>
        </div>

        {/* Görüntü — 3 kademe: DÜŞÜK / ORTA / YÜKSEK */}
        <div style={S.row}>
          <span style={S.label}>🎮 {t('Görüntü')}</span>
          <div style={S.seg}>
            {[['DÜŞÜK', 'low'], ['ORTA', 'medium'], ['YÜKSEK', 'high']].map(([txt, val]) => (
              <button
                className="hr-press"
                key={txt}
                style={{ ...S.segBtn, minWidth: 52, padding: '8px 6px', ...(graphics === val ? S.segOn : {}) }}
                onClick={() => {
                  localStorage.setItem('gfx_user', '1'); // otomatik kalite artık karışmaz
                  setGraphics(val);
                  sfx.click();
                }}
              >{t(txt)}</button>
            ))}
          </div>
        </div>


        {/* Dil / Language */}
        <div style={S.row}>
          <span style={S.label}>🌐 {t('Dil')}</span>
          <div style={S.seg}>
            {[['Türkçe', 'tr'], ['English', 'en']].map(([txt, val]) => (
              <button
                className="hr-press"
                key={val}
                style={{ ...S.segBtn, ...(getLang() === val ? S.segOn : {}) }}
                onClick={() => { setLang(val); sfx.click(); }}
              >{txt}</button>
            ))}
          </div>
        </div>

        {/* Bulut kaydı — kurtarma kodu + geri yükleme */}
        <CloudSection />

        <div style={S.note}>
          {t('DÜŞÜK: gölge yok, en akıcı · ORTA: dengeli · YÜKSEK: gölge + ışıltı (bloom). Yavaş telefonlar için DÜŞÜK/ORTA önerilir.')}
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
    // Mevcut ilerleme koddaki kayıtla değiştirilecek — oyuncuya sor
    if (hasLocalProgress() && !window.confirm(t('Bu cihazdaki ilerlemen bu kodun kaydıyla değiştirilecek. Devam edilsin mi?'))) return;
    setBusy(true);
    setMsg(t('Yükleniyor…'));
    const r = await restoreFromCloud(code);
    if (r.ok) {
      setMsg('✓ ' + t('Geri yüklendi! Oyun yeniden başlatılıyor…'));
      setTimeout(() => window.location.reload(), 1200);
    } else {
      setMsg('⚠ ' + r.reason);
      setBusy(false);
    }
  };

  const user = getAuthUser();

  return (
    <div style={{ borderTop: `3px dashed ${C.inkSoft}`, paddingTop: 12, marginBottom: 12 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 16, color: C.ink, marginBottom: 8 }}>
        ☁️ {t('Bulut Kaydı')}
      </div>

      {/* Google / Apple hesabı: yedek hesaba bağlanır, kod gerekmez */}
      {user ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#d8f0c8', border: `3px solid ${C.greenEdge}`,
          borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.greenEdge, fontWeight: 800 }}>✓ {t('HESABA BAĞLI')}</div>
            <div style={{ fontSize: 11, color: C.ink, fontWeight: 700, marginTop: 2 }}>{user.email || user.name || user.provider}</div>
          </div>
          <button
            className="hr-press"
            style={{ ...btn.secondary, minWidth: 60, minHeight: 44, padding: '6px 12px', fontSize: 13 }}
            onClick={() => { signOut(); sfx.click(); window.location.reload(); }}
          >{t('ÇIKIŞ')}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            className="hr-press"
            style={{ ...btn.secondary, flex: 1, padding: '10px 8px', minHeight: 48, fontSize: 13,
              background: '#fffaf0', color: C.ink }}
            onClick={() => { sfx.click(); signInWith('google'); }}
          >🇬 {t('Google ile Giriş')}</button>
          <button
            className="hr-press"
            style={{ ...btn.secondary, flex: 1, padding: '10px 8px', minHeight: 48, fontSize: 13,
              background: C.edgeDk, color: C.textOnDark }}
            onClick={() => { sfx.click(); signInWith('apple'); }}
          > {t('Apple ile Giriş')}</button>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, lineHeight: 1.5, marginBottom: 8 }}>
        {user
          ? t('İlerlemen hesabına otomatik yedekleniyor. Oyunu silsen bile giriş yapınca her şey geri gelir.')
          : <>{t('Giriş yaparsan ilerlemen hesabına bağlanır. Giriş yapmazsan da bu kodla geri alabilirsin —')} <b style={{ color: C.red }}>{t('kodu bir yere not et!')}</b></>}
      </div>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: C.creamDk, border: `3px dashed ${C.edge}`, minHeight: 44, boxSizing: 'border-box',
          borderRadius: 12, padding: '8px 12px', marginBottom: 10, cursor: 'pointer',
        }}
        onClick={() => {
          navigator.clipboard?.writeText(myCode).catch(() => {});
          pushCloudSave();
          sfx.click();
          setMsg('✓ ' + t('Kod kopyalandı + yedek alındı'));
        }}
      >
        <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 800 }}>{t('KURTARMA KODUN')}</span>
        <span style={{ fontSize: 18, fontFamily: DISPLAY, letterSpacing: 3, color: C.ink }}>{myCode}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={code}
          maxLength={12}
          placeholder={t('Eski kodunu gir…')}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') doRestore(); }}
          style={{ ...S.nameInput, letterSpacing: 2 }}
        />
        <button
          className="hr-press"
          style={{ ...btn.primary, minWidth: 90, minHeight: 44, fontSize: 13, padding: '6px 10px', boxShadow: `0 4px 0 ${C.edge}`, opacity: code.trim().length < 6 || busy ? 0.4 : 1 }}
          disabled={code.trim().length < 6 || busy}
          onClick={doRestore}
        >{t('GERİ YÜKLE')}</button>
      </div>
      {msg && <div style={{ fontSize: 11, marginTop: 6, color: msg.startsWith('⚠') ? C.red : C.greenEdge, fontWeight: 800 }}>{msg}</div>}

      {/* Hesap / veri silme — Google Play ve App Store şartı */}
      <button
        className="hr-press"
        style={{ ...btn.danger, marginTop: 14, width: '100%', padding: '10px', minHeight: 48, fontSize: 14 }}
        onClick={async () => {
          if (!window.confirm(t('Tüm ilerlemen (havuç, atlar, madalyalar, taylar) bu cihazdan ve buluttan kalıcı olarak silinecek. Bu geri alınamaz. Emin misin?'))) return;
          try { signOut(); } catch (e) {}
          await deleteAllData();
          window.location.reload();
        }}
      >🗑 {t('VERİLERİMİ SİL')}</button>
    </div>
  );
}

const S = {
  modal: {
    position: 'fixed', inset: 0, background: backdrop,
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 650, padding: 16,
    paddingTop: `calc(16px + ${SAFE_TOP})`, paddingBottom: `calc(16px + ${BOTTOM_SPACE})`, boxSizing: 'border-box',
  },
  box: { ...panel, width: '100%', maxWidth: 360, padding: '18px 18px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { ...titleText(26), textTransform: 'uppercase' },
  close: { ...btn.icon, width: 44, height: 44, fontSize: 18 },
  row: { ...tile, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 6px 6px 12px' },
  label: { fontSize: 14, color: C.ink, fontWeight: 800 },
  seg: { display: 'flex', gap: 4, background: C.woodDk, border: `3px solid ${C.edge}`, borderRadius: 14, padding: 3 },
  segBtn: {
    minWidth: 60, minHeight: 40, padding: '8px 10px', fontSize: 13, letterSpacing: 1,
    background: 'transparent', color: C.textOnDark, border: 'none', borderRadius: 10,
    cursor: 'pointer', fontFamily: DISPLAY,
  },
  segOn: { background: `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})`, color: C.ink, boxShadow: `0 3px 0 ${C.edge}` },
  nameInput: {
    flex: 1, minWidth: 0, minHeight: 44, padding: '9px 12px', fontSize: 14, fontFamily: FONT,
    fontWeight: 800, background: '#fffaf0', color: C.ink, boxSizing: 'border-box',
    border: `3px solid ${C.edge}`, borderRadius: 12, outline: 'none',
  },
  note: { fontSize: 11, fontWeight: 700, color: C.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 1.5 },
};
