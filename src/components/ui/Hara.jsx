import { useState, useEffect } from 'react';
import useGameStore from '@/store/useGameStore';
import { HORSES } from '@/constants/horses';
import { STAGE_CONFIG, BREED_COST, BREED_COOLDOWN_MS, SHOP_TIER1_COST, SHOP_TIER2_COST, EXTRA_SLOT_COST, TRAITS, GROOM_COOLDOWN_MS, TRAIN_COOLDOWN_MS, FEED_MAX_DAY } from '@/constants/foals';
import AdButton from '@/components/ui/AdButton';
import { t } from '@/i18n';
import { C, FONT, DISPLAY, btn, panel, tile, titleText, backdrop } from '@/ui/theme';
import useLang from '@/i18n/useLang';

const STAGE_LABELS = { TAY: 'TAY', YAVRU: 'YAVRU', GENC: 'GENÇ', YETISKIN: 'YETİŞKİN' };
const STAGE_COLORS = { TAY: '#81c784', YAVRU: '#64b5f6', GENC: '#ffb74d', YETISKIN: '#ffd700' };

const nameBtn = {
  ...btn.secondary, borderRadius: 10, fontSize: 14, fontFamily: FONT,
  minWidth: 44, minHeight: 44, padding: '2px 6px', lineHeight: 1, boxShadow: `0 3px 0 ${C.edge}`,
};

function MeterBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, fontWeight: 700, marginBottom: 2 }}>
        <span>{label}</span><span>{Math.floor(value)}%</span>
      </div>
      <div style={{ height: 10, background: C.edgeDk, border: `2px solid ${C.edge}`, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 999, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function BondDots({ value }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>{t('BAĞ')}</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < value ? C.goldLo : C.edgeDk, border: `2px solid ${C.edge}` }} />
      ))}
    </div>
  );
}

function StageTimeline({ stage }) {
  const order = ['TAY', 'YAVRU', 'GENC', 'YETISKIN'];
  const idx = order.indexOf(stage);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8 }}>
      {order.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i <= idx ? STAGE_COLORS[s] : C.creamDk,
            fontSize: 11, fontWeight: 700, color: C.ink,
            filter: i <= idx ? 'none' : 'saturate(0.4)',
            border: i === idx ? `3px solid ${C.edge}` : `2px solid ${C.inkSoft}`,
            flexShrink: 0,
          }}>
            {STAGE_LABELS[s].slice(0,3)}
          </div>
          {i < 3 && <div style={{ flex: 1, height: 4, background: i < idx ? C.goldLo : C.creamDk }} />}
        </div>
      ))}
    </div>
  );
}

function Countdown({ stageStartedAt, stage }) {
  if (stage === 'YETISKIN') return null;
  const cfg = STAGE_CONFIG[stage];
  const elapsed = Date.now() - stageStartedAt;
  const remaining = Math.max(0, cfg.minMs - elapsed);
  if (remaining === 0) return <div style={{ fontSize: 11, fontWeight: 800, color: C.greenEdge }}>⏰ {t('Süre tamamlandı!')}</div>;
  const h = Math.floor(remaining / 3600_000);
  const m = Math.floor((remaining % 3600_000) / 60_000);
  return <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>⏱ {t('{h}s {m}dk kaldı', { h, m })}</div>;
}

function BPProgress({ bp, stage }) {
  if (stage === 'YETISKIN') return null;
  const cfg = STAGE_CONFIG[stage];
  const pct = Math.min(100, (bp / cfg.bp) * 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, fontWeight: 700, marginBottom: 2 }}>
        <span>{t('BÜYÜME PUANI')}</span><span>{bp}/{cfg.bp}</span>
      </div>
      <div style={{ height: 10, background: C.edgeDk, border: `2px solid ${C.edge}`, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})`, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function FoalCard({ foal, onFlash }) {
  useLang();
  const feedFoal = useGameStore(s => s.feedFoal);
  const groomFoal = useGameStore(s => s.groomFoal);
  const trainFoal = useGameStore(s => s.trainFoal);
  const advanceStageIfReady = useGameStore(s => s.advanceStageIfReady);
  const matureFoal = useGameStore(s => s.matureFoal);
  const rushFoalStage = useGameStore(s => s.rushFoalStage);
  const rushCost = useGameStore(s => s.rushCost);
  const renameFoal = useGameStore(s => s.renameFoal);
  const skipFoalCooldown = useGameStore(s => s.skipFoalCooldown);
  const carrots = useGameStore(s => s.carrots);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const saveName = () => {
    const res = renameFoal(foal.id, nameInput);
    if (res.ok) { setEditingName(false); onFlash('✏️ ' + t('İsim güncellendi')); }
    else onFlash(`❌ ${res.reason}`);
  };

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const groomReady  = now - foal.lastGroomedAt > GROOM_COOLDOWN_MS;
  const trainReady  = now - foal.lastTrainedAt > TRAIN_COOLDOWN_MS;
  const today = new Date().toDateString();
  const feedsToday = foal.feedDayKey === today ? foal.feedsToday : 0;
  const canFeed = feedsToday < FEED_MAX_DAY && carrots >= 15;

  const stageColor = STAGE_COLORS[foal.stage];

  // Check if ready to advance
  const cfg = STAGE_CONFIG[foal.stage];
  const elapsed = now - foal.stageStartedAt;
  const canAdvance = foal.stage !== 'YETISKIN' && elapsed >= cfg.minMs && foal.bp >= cfg.bp && foal.bag >= cfg.bondGate && foal.tokluk >= 20;
  const isMature = foal.stage === 'YETISKIN';

  return (
    <div style={SC.card}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                autoFocus
                value={nameInput}
                maxLength={20}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{
                  flex: 1, minWidth: 0, minHeight: 44, boxSizing: 'border-box', fontSize: 14, fontWeight: 800, padding: '3px 8px',
                  background: '#fffaf0', color: C.ink,
                  border: `3px solid ${C.edge}`, borderRadius: 10, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button className="hr-press" onClick={saveName} style={nameBtn}>✓</button>
              <button className="hr-press" onClick={() => setEditingName(false)} style={nameBtn}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontFamily: DISPLAY, letterSpacing: 1, color: C.ink }}>{foal.name}</div>
              <button
                onClick={() => { setNameInput(foal.name); setEditingName(true); }}
                className="hr-press"
                style={nameBtn}
                title={t('İsmi değiştir')}
              >✏️</button>
            </div>
          )}
          <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>
            {foal.source === 'breed' ? '🧬 ' + t('Çiftleştirme') : '🏪 ' + t('Mağaza')}
            {foal.genes.trait && <span style={{ marginLeft: 6, color: C.woodDk, fontWeight: 800 }}>{t(TRAITS[foal.genes.trait]?.label ?? '')}</span>}
          </div>
        </div>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: foal.genes.bodyColor, border: `3px solid ${foal.genes.maneColor}` }} />
      </div>

      <StageTimeline stage={foal.stage} />

      {!isMature && (
        <>
          <Countdown stageStartedAt={foal.stageStartedAt} stage={foal.stage} />
          <BPProgress bp={foal.bp} stage={foal.stage} />
          <div style={{ marginTop: 4 }}>
            <MeterBar label={t('TOKLUK')} value={foal.tokluk} color={foal.tokluk < 20 ? C.red : `linear-gradient(90deg, ${C.greenHi}, ${C.green})`} />
            <MeterBar label={t('MUTLULUK')} value={foal.mutluluk} color={`linear-gradient(90deg, ${C.goldHi}, ${C.goldLo})`} />
            <BondDots value={foal.bag} />
          </div>
          {foal.tokluk < 20 && <div style={{ fontSize: 11, fontWeight: 800, color: C.red, marginTop: 4 }}>⚠️ {t('Tokluk düşük – büyüme durdu!')}</div>}
        </>
      )}

      {isMature && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: C.greenEdge, fontWeight: 800, fontSize: 13 }}>
          🎉 {t('Olgunlaştı! Ahıra eklenmeye hazır.')}
          <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, marginTop: 4 }}>
            {t('Hız')} {foal.genes.speedMult.toFixed(2)}x · {t('Manevra')} {foal.genes.maneuvMult.toFixed(2)}x · {t('Zıplama')} {foal.genes.jumpMult.toFixed(2)}x
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {!isMature && (
          <>
            <button
              className="hr-press"
              style={{ ...SC.actionBtn, ...btn.success, ...(canFeed ? {} : { filter: 'saturate(0.3)', opacity: 0.6 }) }}
              onClick={() => {
                if (carrots < 15) { onFlash('❌ ' + t('Yetersiz havuç (15 gerekli)')); return; }
                if (feedsToday >= FEED_MAX_DAY) { onFlash('❌ ' + t('Günlük limit doldu ({a}/{b})', { a: FEED_MAX_DAY, b: FEED_MAX_DAY })); return; }
                const ok = feedFoal(foal.id);
                onFlash(ok ? '🥕 ' + t('Beslendi! ({a}/{b})', { a: feedsToday+1, b: FEED_MAX_DAY }) : '❌ ' + t('Beslenemedi'));
              }}
            >
              🥕 {t('BESLE')}<br /><span style={{ fontSize: 10 }}>{t('15 havuç')}</span>
            </button>
            <button
              className="hr-press"
              style={{ ...SC.actionBtn, ...btn.info, ...(groomReady ? {} : { filter: 'saturate(0.3)', opacity: 0.6 }) }}
              onClick={() => {
                if (!groomReady) { const h = Math.floor((GROOM_COOLDOWN_MS - (now - foal.lastGroomedAt)) / 3600_000); onFlash('❌ ' + t('{h}s sonra tımarlanabilir', { h })); return; }
                const ok = groomFoal(foal.id); onFlash(ok ? '✨ ' + t('Tımarlandı! +1 BAĞ') : t('Bekleme süresi devam ediyor'));
              }}
            >
              ✨ {t('TIMARLA')}<br /><span style={{ fontSize: 10 }}>{t('Ücretsiz')}</span>
            </button>
            <button
              className="hr-press"
              style={{ ...SC.actionBtn, ...btn.secondary, ...(trainReady ? {} : { filter: 'saturate(0.3)', opacity: 0.6 }) }}
              onClick={() => {
                if (!trainReady) { onFlash('❌ ' + t('Bugün antrenman yapıldı')); return; }
                const ok = trainFoal(foal.id); onFlash(ok ? '🏃 ' + t('Antrenman yapıldı! +20 BP +1 BAĞ') : t('Bekleme süresi devam ediyor'));
              }}
            >
              🏃 {t('ANTRENMAN')}<br /><span style={{ fontSize: 10 }}>{t('Günde 1')}</span>
            </button>
          </>
        )}
        {canAdvance && (
          <button
            className="hr-press"
              style={{ ...SC.actionBtn, ...btn.primary, flex: 1 }}
            onClick={() => { advanceStageIfReady(foal.id); onFlash('🌟 ' + t('Aşama geçildi!')); }}
          >
            🌟 {t('AŞAMA GEÇER')}
          </button>
        )}
        {isMature && (
          <button
            className="hr-press"
              style={{ ...SC.actionBtn, ...btn.primary, flex: 1 }}
            onClick={() => { const h = matureFoal(foal.id); onFlash(h ? '🐴 ' + t('{name} atlarına katıldı!', { name: h.name }) : t('Hata')); }}
          >
            🐴 {t('AHIRA EKLE')}
          </button>
        )}
      </div>

      {/* Hızlandır — süre kapısını havuç veya reklamla anında geç */}
      {!isMature && !canAdvance && elapsed < cfg.minMs && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            className="hr-press"
              style={{ ...SC.actionBtn, flex: 1, ...btn.primary, ...(carrots >= rushCost(foal.id) ? {} : { filter: 'saturate(0.3)', opacity: 0.6 }) }}
            disabled={carrots < rushCost(foal.id)}
            onClick={() => { if (rushFoalStage(foal.id, false)) onFlash('⏩ ' + t('Süre atlandı!')); }}
          >
            ⏩ {t('HIZLANDIR')}<br /><span style={{ fontSize: 10 }}>{rushCost(foal.id)} 🥕</span>
          </button>
          <div style={{ flex: 1 }}>
            <AdButton
              label={t('Ücretsiz hızlandır')}
              sub={t('Reklam izle → süre atlanır')}
              color="#00cfff"
              compact
              onReward={() => { if (rushFoalStage(foal.id, true)) onFlash('⏩ ' + t('Süre atlandı!')); }}
            />
          </div>
        </div>
      )}

      {/* Reklam izle → bekleme süresini atla (tımar / antrenman) */}
      {!isMature && (!groomReady || !trainReady) && (
        <div style={{ marginTop: 8 }}>
          <AdButton
            label={!groomReady && !trainReady ? t('Bekleme sürelerini atla') : !groomReady ? t('Tımar beklemesini atla') : t('Antrenman beklemesini atla')}
            sub={t('Reklam izle → hemen tekrar bakım yap')}
            color="#9ad0ff"
            compact
            onReward={() => {
              if (!groomReady) skipFoalCooldown(foal.id, 'groom');
              if (!trainReady) skipFoalCooldown(foal.id, 'train');
              onFlash('⏩ ' + t('Bekleme süresi atlandı'));
            }}
          />
        </div>
      )}
    </div>
  );
}

function BreedModal({ onClose, onDone }) {
  useLang();
  const ownedHorseIds = useGameStore(s => s.ownedHorseIds);
  const carrots = useGameStore(s => s.carrots);
  const breedFoal = useGameStore(s => s.breedFoal);
  const lastBreedAt = useGameStore(s => s.lastBreedAt);
  const skipFoalCooldown = useGameStore(s => s.skipFoalCooldown);
  const customHorses = useGameStore(s => s.customHorses ?? []);
  const breedCooldownActive = Date.now() - lastBreedAt < BREED_COOLDOWN_MS;

  const allHorses = [...HORSES, ...customHorses];
  const available = allHorses.filter(h => ownedHorseIds.includes(h.id));
  const [selA, setSelA] = useState(available[0]?.id ?? null);
  const [selB, setSelB] = useState(available[1]?.id ?? null);
  const [err,  setErr]  = useState('');

  const canBreed = selA && selB && selA !== selB && carrots >= BREED_COST;
  const horseA = available.find(h => h.id === selA);
  const horseB = available.find(h => h.id === selB);

  const previewGenes = horseA && horseB ? {
    speedMult:  ((horseA.baseSpeedMult??1) + (horseB.baseSpeedMult??1)) / 2,
    maneuvMult: ((horseA.baseManeuvMult??1) + (horseB.baseManeuvMult??1)) / 2,
    jumpMult:   ((horseA.baseJumpMult??1) + (horseB.baseJumpMult??1)) / 2,
    maxSpeed:   ((horseA.baseMaxSpeed??40) + (horseB.baseMaxSpeed??40)) / 2,
  } : null;

  return (
    <div style={{ ...SC.modal }}>
      <div style={{ ...SC.modalBox }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ ...titleText(22) }}>🧬 {t('ÇİFTLEŞTİRME')}</span>
          <button aria-label={t('Kapat')} className="hr-press" style={SC.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[[t('Ebeveyn A'), selA, setSelA, selB], [t('Ebeveyn B'), selB, setSelB, selA]].map(([lbl, sel, setSel, other]) => (
            <div key={lbl}>
              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>{lbl}</div>
              <select
                value={sel ?? ''}
                onChange={e => setSel(e.target.value)}
                style={{ width: '100%', minHeight: 44, background: '#fffaf0', color: C.ink, border: `3px solid ${C.edge}`, borderRadius: 12, padding: '6px 8px', fontFamily: FONT, fontWeight: 800, fontSize: 13 }}
              >
                {available.filter(h => h.id !== other).map(h => (
                  <option key={h.id} value={h.id}>{t(h.name)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {previewGenes && (
          <div style={{ ...tile, padding: '8px 12px', marginBottom: 12, fontSize: 12, fontWeight: 700, color: C.ink }}>
            <div style={{ color: C.ink, fontFamily: DISPLAY, letterSpacing: 1, marginBottom: 4 }}>{t('Tahmini Özellikler (±%10 varyasyon)')}</div>
            <div>{t('Hız')}: ~{previewGenes.speedMult.toFixed(2)}x &nbsp; {t('Manevra')}: ~{previewGenes.maneuvMult.toFixed(2)}x</div>
            <div>{t('Zıplama')}: ~{previewGenes.jumpMult.toFixed(2)}x &nbsp; {t('Max Hız')}: ~{previewGenes.maxSpeed.toFixed(0)}</div>
            <div style={{ color: C.woodDk, fontWeight: 800, marginTop: 4 }}>{t('%5 nadir özellik şansı')}</div>
          </div>
        )}

        {err && <div style={{ color: C.red, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>{err}</div>}

        {/* Reklam izle → çiftleştirme bekleme süresini atla */}
        {breedCooldownActive && (
          <div style={{ marginBottom: 10 }}>
            <AdButton
              label={t('Çiftleştirme beklemesini atla')}
              sub={t('Reklam izle → hemen çiftleştir')}
              color="#ce93d8"
              compact
              onReward={() => { skipFoalCooldown(null, 'breed'); setErr(''); }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: canBreed ? C.ink : C.red, fontFamily: DISPLAY, fontSize: 18 }}>🥕 {BREED_COST} {t('havuç')}</span>
          <button
            className="hr-press"
              style={{ ...SC.actionBtn, ...btn.primary, ...(canBreed ? {} : { filter: 'saturate(0.3)', opacity: 0.6 }), padding: '10px 24px' }}
            disabled={!canBreed}
            onClick={() => {
              const res = breedFoal(selA, selB);
              if (res.ok) { onDone(res.foal); }
              else setErr(t(res.reason));
            }}
          >
            🧬 {t('ÇİFTLEŞTİR')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopModal({ onClose, onDone }) {
  useLang();
  const carrots = useGameStore(s => s.carrots);
  const buyFoal = useGameStore(s => s.buyFoal);
  const [err, setErr] = useState('');

  return (
    <div style={SC.modal}>
      <div style={SC.modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ ...titleText(22) }}>🏪 {t('YAVRU SATIN AL')}</span>
          <button aria-label={t('Kapat')} className="hr-press" style={SC.closeBtn} onClick={onClose}>✕</button>
        </div>
        {err && <div style={{ color: C.red, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>{err}</div>}
        {[
          { tier: 1, cost: SHOP_TIER1_COST, label: t('Tier 1 Yavru'), desc: t('Temel genetik · Hız 0.8–1.3x'), color: '#66bb6a' },
          { tier: 2, cost: SHOP_TIER2_COST, label: t('Tier 2 Yavru'), desc: t('Gelişmiş genetik · Hız 1.2–1.8x'), color: '#42a5f5' },
        ].map(({ tier, cost, label, desc, color }) => (
          <div key={tier} style={{ ...SC.shopTier, borderColor: C.edge }}>
            <div>
              <div style={{ fontSize: 15, fontFamily: DISPLAY, letterSpacing: 1, color: C.ink }}>{label}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>{desc}</div>
            </div>
            <button
              className="hr-press"
              style={{ ...SC.actionBtn, ...btn.success, ...(carrots >= cost ? {} : { filter: 'saturate(0.3)', opacity: 0.6 }), padding: '8px 16px' }}
              disabled={carrots < cost}
              onClick={() => { const res = buyFoal(tier); if (res.ok) onDone(res.foal); else setErr(t(res.reason)); }}
            >
              🥕 {cost}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hara() {
  useLang();
  const foals = useGameStore(s => s.foals);
  const stableSlots = useGameStore(s => s.stableSlots);
  const bonusSlots = useGameStore(s => s.bonusSlots);
  const carrots = useGameStore(s => s.carrots);
  const buyStableSlot = useGameStore(s => s.buyStableSlot);
  const addTempStableSlot = useGameStore(s => s.addTempStableSlot);
  const buyFoalLucky = useGameStore(s => s.buyFoalLucky);

  const totalSlots = stableSlots + bonusSlots;

  const [flash, setFlash] = useState('');
  const [modal, setModal] = useState(null); // null | 'breed' | 'shop'

  const doFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 2000); };
  const closeModal = () => setModal(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Flash */}
      {flash && (
        <div style={{ background: '#d8f0c8', border: `3px solid ${C.greenEdge}`, borderRadius: 12, padding: '8px 16px', textAlign: 'center', fontSize: 13, color: C.greenEdge, fontWeight: 800 }}>
          {flash}
        </div>
      )}

      {/* Slot info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>
          {t('Ahır:')} {foals.length}/{totalSlots} {t('slot')}{bonusSlots > 0 ? ` (+${bonusSlots} ${t('geçici')})` : ''}
        </span>
        {foals.length >= totalSlots && (
          <button
            className="hr-press"
              style={{ ...SC.actionBtn, padding: '6px 14px', fontSize: 11, ...btn.primary, ...(carrots >= 1000 ? {} : { filter: 'saturate(0.3)', opacity: 0.6 }) }}
            disabled={carrots < 1000}
            onClick={() => { const ok = buyStableSlot(); doFlash(ok ? '🏠 ' + t('Yeni slot açıldı!') : t('Yetersiz havuç')); }}
          >
            🏠 +{t('Slot')} (🥕 1000)
          </button>
        )}
      </div>

      {/* Ahır dolu → reklamla geçici slot */}
      {foals.length >= totalSlots && (
        <AdButton
          label={t('Geçici +1 ahır slotu')}
          sub={t('Bu oturum için ekstra slot (1000 havuç değerinde)')}
          ads={5}
          color="#c8a0ff"
          compact
          onReward={() => { addTempStableSlot(); doFlash('🏠 ' + t('Geçici slot eklendi')); }}
        />
      )}

      {/* Foal cards */}
      {foals.map(foal => (
        <FoalCard key={foal.id} foal={foal} onFlash={doFlash} />
      ))}

      {/* Empty slots */}
      {foals.length < totalSlots && (
        <div style={SC.emptySlot}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🐣</div>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 700, marginBottom: 12 }}>{t('Ahır boş')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="hr-press"
              style={{ ...SC.actionBtn, ...btn.secondary, padding: '10px 20px' }} onClick={() => setModal('breed')}>
              🧬 {t('ÇİFTLEŞTİR')}
            </button>
            <button className="hr-press"
              style={{ ...SC.actionBtn, ...btn.success, padding: '10px 20px' }} onClick={() => setModal('shop')}>
              🏪 {t('SATIN AL')}
            </button>
          </div>
          {/* Reklam izle → bedava şanslı tay (yüksek istatistik) */}
          <div style={{ width: '100%', marginTop: 10 }}>
            <AdButton
              label={t('Şanslı tay (bedava)')}
              sub={t('Reklam izle → yüksek istatistikli tay')}
              color="#ffd700"
              compact
              onReward={() => { const r = buyFoalLucky(1); doFlash(r.ok ? '🍀 ' + t('{name} geldi!', { name: r.foal.name }) : `❌ ${t(r.reason)}`); }}
            />
          </div>
        </div>
      )}

      {modal === 'breed' && <BreedModal onClose={closeModal} onDone={foal => { closeModal(); doFlash('🐴 ' + t('{name} doğdu!', { name: foal.name })); }} />}
      {modal === 'shop'  && <ShopModal  onClose={closeModal} onDone={foal => { closeModal(); doFlash('🐴 ' + t('{name} geldi!', { name: foal.name })); }} />}
    </div>
  );
}

const SC = {
  card: { ...tile, border: `3px solid ${C.edge}`, padding: '14px 14px' },
  actionBtn: {
    padding: '8px 10px', minHeight: 48, fontSize: 13, borderRadius: 12,
    textAlign: 'center',
  },
  emptySlot: {
    ...tile, border: `3px dashed ${C.inkSoft}`, padding: '24px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    position: 'fixed', inset: 0, background: backdrop,
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
  },
  modalBox: { ...panel, padding: 20, width: 400, maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto', boxSizing: 'border-box' },
  closeBtn: { ...btn.icon, width: 44, height: 44, fontSize: 18 },
  shopTier: {
    ...tile, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    border: '3px solid', padding: '12px 14px', marginBottom: 10,
  },
};
