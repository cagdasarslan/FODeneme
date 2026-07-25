import { useEffect, useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { CARROT_PACKAGES, REMOVE_ADS_ID } from '@/constants/iap';
import { initBilling, purchase, setGrantHandler, setRemoveAdsHandler, getDisplayPrice, getRemoveAdsPrice } from '@/services/BillingService';
import { hideBanner } from '@/services/AdService';

// Gerçek para ile havuç satın alma mağazası (Google Play Billing).
export default function CarrotShop({ onClose }) {
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
      setFlash(`✅ ${amount.toLocaleString()} havuç hesabına eklendi!`);
      setTimeout(() => setFlash(''), 2500);
    });
    setRemoveAdsHandler(() => {
      setAdsRemoved();
      hideBanner();
      setFlash('🎉 Reklamlar kaldırıldı — iyi koşular!');
      setTimeout(() => setFlash(''), 2500);
    });
    initBilling().then(() => force(n => n + 1)); // gerçek fiyatlar gelince yenile
  }, [addCarrots, setAdsRemoved]);

  const handleBuy = async (pkg) => {
    if (busy) return;
    setBusy(pkg.id);
    const res = await purchase(pkg.id);
    setBusy(null);
    if (!res.ok) setFlash(`❌ ${res.reason || 'Satın alma başarısız'}`), setTimeout(() => setFlash(''), 2500);
  };

  return (
    <div style={S.modal}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>💎 HAVUÇ MAĞAZASI</span>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        <div style={S.balance}>🥕 {carrots.toLocaleString()} havuç</div>

        {flash && <div style={S.flash}>{flash}</div>}

        {/* Reklamları Kaldır — tek seferlik, kalıcı */}
        {adsRemoved ? (
          <div style={S.adsDone}>✓ Reklamlar kaldırıldı</div>
        ) : (
          <button
            style={{ ...S.removeAds, opacity: busy ? 0.5 : 1 }}
            disabled={!!busy}
            onClick={() => handleBuy({ id: REMOVE_ADS_ID })}
          >
            <span style={{ fontSize: 18 }}>🚫</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <b>REKLAMLARI KALDIR</b>
              <div style={{ fontSize: 9, opacity: 0.75, marginTop: 2 }}>Banner tamamen kapanır · ödüllü reklamlar isteğe bağlı kalır</div>
            </span>
            <span style={S.priceBtn}>{busy === REMOVE_ADS_ID ? '...' : getRemoveAdsPrice()}</span>
          </button>
        )}

        <div style={S.grid}>
          {CARROT_PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              style={{ ...S.pkg, ...(pkg.badge ? S.pkgHot : {}), opacity: busy && busy !== pkg.id ? 0.5 : 1 }}
              disabled={!!busy}
              onClick={() => handleBuy(pkg)}
            >
              {pkg.badge && <span style={S.badge}>{pkg.badge}</span>}
              <span style={S.carrotIcon}>🥕</span>
              <span style={S.amount}>{pkg.carrots.toLocaleString()}</span>
              <span style={S.priceBtn}>
                {busy === pkg.id ? '...' : getDisplayPrice(pkg)}
              </span>
            </button>
          ))}
        </div>

        <div style={S.note}>
          Ödemeler Google Play üzerinden güvenle alınır. Havuçlar anında hesabınıza eklenir.
        </div>
      </div>
    </div>
  );
}

const S = {
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, padding: 12,
  },
  box: {
    width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
    background: 'linear-gradient(160deg, rgba(18,18,34,0.98), rgba(10,10,20,0.99))',
    border: '1px solid rgba(255,215,0,0.25)', borderRadius: 16, padding: '18px 16px',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: 800, letterSpacing: 1, color: '#ffd700', fontFamily: 'var(--game-font)' },
  close: {
    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6,
    width: 30, height: 30, fontSize: 14, cursor: 'pointer',
  },
  balance: { textAlign: 'center', color: '#ffd700', fontWeight: 700, fontFamily: 'var(--game-font)', fontSize: 13, marginBottom: 10 },
  flash: {
    textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#33ff99',
    background: 'rgba(51,255,153,0.1)', border: '1px solid #33ff9955',
    borderRadius: 8, padding: '8px', marginBottom: 10,
  },
  removeAds: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 12,
    background: 'rgba(120,80,255,0.12)', border: '1px solid rgba(150,110,255,0.5)',
    borderRadius: 12, padding: '12px 12px', color: '#c9b8ff', fontFamily: 'var(--game-font)',
    fontSize: 12, cursor: 'pointer',
  },
  adsDone: {
    textAlign: 'center', color: '#33ff99', fontFamily: 'var(--game-font)', fontSize: 12,
    fontWeight: 700, marginBottom: 12, padding: 8,
    border: '1px solid rgba(51,255,153,0.35)', borderRadius: 10,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  pkg: {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '14px 8px 10px', minHeight: 96, borderRadius: 12, cursor: 'pointer',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    fontFamily: 'var(--game-font)', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
  },
  pkgHot: { border: '1px solid rgba(255,215,0,0.55)', background: 'rgba(255,215,0,0.08)' },
  badge: {
    position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
    background: '#ffb300', color: '#000', fontSize: 8, fontWeight: 800, letterSpacing: 1,
    padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap',
  },
  carrotIcon: { fontSize: 22 },
  amount: { fontSize: 18, fontWeight: 800, color: '#fff' },
  priceBtn: {
    marginTop: 4, fontSize: 13, fontWeight: 700, color: '#0a0a14',
    background: 'linear-gradient(135deg,#ffd54a,#ff9f00)', borderRadius: 8,
    padding: '6px 14px', minWidth: 70, textAlign: 'center',
  },
  note: { marginTop: 14, fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.5 },
};
