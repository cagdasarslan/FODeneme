import { useEffect, useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { CARROT_PACKAGES, REMOVE_ADS_ID } from '@/constants/iap';
import { initBilling, purchase, restorePurchases, setGrantHandler, setRemoveAdsHandler, setPricesUpdatedHandler, getDisplayPrice, getRemoveAdsPrice } from '@/services/BillingService';
import { hideBanner, refreshBannerReserve } from '@/services/AdService';
import { SAFE_TOP, BOTTOM_SPACE } from '@/utils/safeArea';
import { t } from '@/i18n';
import { C, FONT, DISPLAY, btn, panel, tile, pill, titleText, backdrop, fmt } from '@/ui/theme';
import useLang from '@/i18n/useLang';

// Gerçek para ile havuç satın alma mağazası (Google Play Billing).
export default function CarrotShop({ onClose }) {
  useLang();
  const carrots = useGameStore(s => s.carrots);
  const addCarrots = useGameStore(s => s.addCarrots);
  const adsRemoved = useGameStore(s => s.adsRemoved);
  const setAdsRemoved = useGameStore(s => s.setAdsRemoved);
  const [busy, setBusy] = useState(null);   // satın alınan productId
  const [flash, setFlash] = useState('');
  const [, force] = useState(0);

  useEffect(() => {
    setGrantHandler((productId, amount) => {
      addCarrots(amount);
      setFlash('✅ ' + t('{n} havuç hesabına eklendi!', { n: fmt(amount) }));
      setTimeout(() => setFlash(''), 2500);
    });
    setRemoveAdsHandler(() => {
      setAdsRemoved();
      hideBanner();
      setFlash('🎉 ' + t('Reklamlar kaldırıldı — iyi koşular!'));
      setTimeout(() => setFlash(''), 2500);
    });
    setPricesUpdatedHandler(() => force(n => n + 1)); // Play fiyatları geç gelirse tazele
    initBilling().then(() => force(n => n + 1));
  }, [addCarrots, setAdsRemoved]);

  const handleBuy = async (pkg) => {
    if (busy) return;
    setBusy(pkg.id);
    const res = await purchase(pkg.id);
    setBusy(null);
    if (!res.ok) setFlash(`❌ ${t(res.reason || 'Satın alma başarısız')}`), setTimeout(() => setFlash(''), 2500);
  };

  return (
    <div style={S.modal}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>💎 {t('HAVUÇ MAĞAZASI')}</span>
          <button aria-label={t('Kapat')} className="hr-press" style={S.close} onClick={onClose}>✕</button>
        </div>

        <div style={S.balance}>🥕 {fmt(carrots)} {t('havuç')}</div>

        {flash && <div style={S.flash}>{flash}</div>}

        <div style={S.grid}>
          {CARROT_PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              className="hr-press"
              style={{ ...S.pkg, ...(pkg.badge ? S.pkgHot : {}), opacity: busy && busy !== pkg.id ? 0.5 : 1 }}
              disabled={!!busy}
              onClick={() => handleBuy(pkg)}
            >
              {pkg.badge && <span style={S.badge}>{t(pkg.badge)}</span>}
              <span style={S.carrotIcon}>🥕</span>
              <span style={S.amount}>{fmt(pkg.carrots)}</span>
              <span style={S.priceBtn}>
                {busy === pkg.id ? '...' : getDisplayPrice(pkg)}
              </span>
            </button>
          ))}
        </div>

        {/* Reklamları Kaldır — paketlerin altında; tek seferlik, kalıcı */}
        {adsRemoved ? (
          <div style={S.adsDone}>✓ {t('Reklamlar kaldırıldı')}</div>
        ) : (
          <button
            className="hr-press"
            style={{ ...S.removeAds, opacity: busy ? 0.5 : 1 }}
            disabled={!!busy}
            onClick={() => handleBuy({ id: REMOVE_ADS_ID })}
          >
            <span style={{ fontSize: 18 }}>🚫</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <b style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{t('REKLAMLARI KALDIR')}</b>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>{t('Banner tamamen kapanır · ödüllü reklamlar isteğe bağlı kalır')}</div>
            </span>
            <span style={S.priceBtn}>{busy === REMOVE_ADS_ID ? '...' : getRemoveAdsPrice()}</span>
          </button>
        )}

        <button
          className="hr-press"
          style={S.restoreBtn}
          disabled={!!busy}
          onClick={async () => {
            setBusy('restore');
            const r = await restorePurchases();
            setBusy(null);
            setFlash(!r.ok ? `❌ ${t(r.reason)}` : r.restored ? '✓ ' + t('Satın alımların geri yüklendi') : t('Geri yüklenecek satın alım bulunamadı'));
            setTimeout(() => setFlash(''), 2800);
          }}
        >{busy === 'restore' ? '...' : '↺ ' + t('Satın Alımları Geri Yükle')}</button>

        <div style={S.note}>
          {t('Ödemeler Google Play üzerinden güvenle alınır. Havuçlar anında hesabınıza eklenir.')}
        </div>
      </div>
    </div>
  );
}

const S = {
  modal: {
    position: 'fixed', inset: 0, background: backdrop,
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, padding: 12,
    paddingTop: `calc(12px + ${SAFE_TOP})`, paddingBottom: `calc(12px + ${BOTTOM_SPACE})`, boxSizing: 'border-box',
  },
  box: { ...panel, width: '100%', maxWidth: 440, maxHeight: '100%', overflowY: 'auto', padding: '18px 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { ...titleText(24), textTransform: 'uppercase' },
  close: { ...btn.icon, width: 44, height: 44, fontSize: 18 },
  balance: { ...pill, display: 'table', margin: '0 auto 12px', fontFamily: DISPLAY, fontWeight: 400, fontSize: 16, letterSpacing: 1 },
  flash: {
    textAlign: 'center', fontSize: 13, fontWeight: 800, color: C.greenEdge,
    background: '#d8f0c8', border: `3px solid ${C.greenEdge}`,
    borderRadius: 12, padding: '8px', marginBottom: 10,
  },
  removeAds: {
    ...tile, display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: 16,
    border: `3px solid ${C.edge}`, boxShadow: `0 4px 0 ${C.edge}`, padding: '12px', color: C.ink,
    fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer', minHeight: 56,
  },
  adsDone: {
    textAlign: 'center', color: C.greenEdge, fontFamily: FONT, fontSize: 13,
    fontWeight: 800, marginTop: 16, padding: 8, background: '#d8f0c8',
    border: `3px solid ${C.greenEdge}`, borderRadius: 12,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 6 },
  pkg: {
    ...tile, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '14px 8px 12px', minHeight: 96, cursor: 'pointer',
    border: `3px solid ${C.edge}`, boxShadow: `0 4px 0 ${C.edge}`, '--hr-edge': C.edge,
    fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
  },
  pkgHot: { border: `3px solid ${C.goldLo}`, background: '#fbe7b8', boxShadow: `0 4px 0 ${C.edge}, 0 0 0 2px ${C.gold}` },
  badge: {
    position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
    background: C.red, color: '#fff', fontSize: 11, fontFamily: DISPLAY, letterSpacing: 1,
    padding: '2px 10px', borderRadius: 999, border: `2px solid ${C.redEdge}`, whiteSpace: 'nowrap',
  },
  carrotIcon: { fontSize: 24 },
  amount: { fontSize: 22, fontFamily: DISPLAY, color: C.ink, letterSpacing: 1 },
  priceBtn: {
    marginTop: 4, fontSize: 14, fontFamily: DISPLAY, letterSpacing: 1, color: '#fff',
    background: `linear-gradient(180deg, ${C.greenHi}, ${C.green})`, border: `2px solid ${C.greenEdge}`,
    boxShadow: `0 3px 0 ${C.greenEdge}`, borderRadius: 10,
    padding: '0 14px', minWidth: 70, minHeight: 44, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  restoreBtn: { ...btn.secondary, marginTop: 16, width: '100%', padding: '11px', minHeight: 48, fontSize: 14 },
  note: { marginTop: 14, fontSize: 12, fontWeight: 700, color: C.inkSoft, textAlign: 'center', lineHeight: 1.5 },
};
