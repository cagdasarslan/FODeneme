import { useEffect, useState } from 'react';
import useGameStore from '@/store/useGameStore';
import { CARROT_PACKAGES } from '@/constants/iap';
import { initBilling, purchase, setGrantHandler, getDisplayPrice } from '@/services/BillingService';

// Gerçek para ile havuç satın alma mağazası (Google Play Billing).
export default function CarrotShop({ onClose }) {
  const carrots = useGameStore(s => s.carrots);
  const addCarrots = useGameStore(s => s.addCarrots);
  const [busy, setBusy] = useState(null);   // satın alınan productId
  const [flash, setFlash] = useState('');
  const [, force] = useState(0);

  useEffect(() => {
    setGrantHandler((productId, amount) => {
      addCarrots(amount);
      setFlash(`✅ ${amount.toLocaleString()} havuç hesabına eklendi!`);
      setTimeout(() => setFlash(''), 2500);
    });
    initBilling().then(() => force(n => n + 1)); // gerçek fiyatlar gelince yenile
  }, [addCarrots]);

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
  title: { fontSize: 16, fontWeight: 800, letterSpacing: 1, color: '#ffd700', fontFamily: 'monospace' },
  close: {
    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6,
    width: 30, height: 30, fontSize: 14, cursor: 'pointer',
  },
  balance: { textAlign: 'center', color: '#ffd700', fontWeight: 700, fontFamily: 'monospace', fontSize: 13, marginBottom: 10 },
  flash: {
    textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#33ff99',
    background: 'rgba(51,255,153,0.1)', border: '1px solid #33ff9955',
    borderRadius: 8, padding: '8px', marginBottom: 10,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  pkg: {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '14px 8px 10px', minHeight: 96, borderRadius: 12, cursor: 'pointer',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    fontFamily: 'monospace', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
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
