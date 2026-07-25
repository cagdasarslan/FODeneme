import { useState, useEffect } from 'react';
import useGameStore from '@/store/useGameStore';
import { HORSES } from '@/constants/horses';
import { STAGE_CONFIG, BREED_COST, BREED_COOLDOWN_MS, SHOP_TIER1_COST, SHOP_TIER2_COST, EXTRA_SLOT_COST, TRAITS, GROOM_COOLDOWN_MS, TRAIN_COOLDOWN_MS, FEED_MAX_DAY } from '@/constants/foals';
import AdButton from '@/components/ui/AdButton';

const STAGE_LABELS = { TAY: 'TAY', YAVRU: 'YAVRU', GENC: 'GENÇ', YETISKIN: 'YETİŞKİN' };
const STAGE_COLORS = { TAY: '#81c784', YAVRU: '#64b5f6', GENC: '#ffb74d', YETISKIN: '#ffd700' };

const nameBtn = {
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 11,
  padding: '2px 6px', lineHeight: 1,
};

function MeterBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
        <span>{label}</span><span>{Math.floor(value)}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function BondDots({ value }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>BAĞ</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < value ? '#ffd700' : 'rgba(255,255,255,0.15)' }} />
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
            background: i <= idx ? STAGE_COLORS[s] : 'rgba(255,255,255,0.1)',
            fontSize: 8, fontWeight: 700, color: i <= idx ? '#000' : 'rgba(255,255,255,0.3)',
            border: i === idx ? `2px solid ${STAGE_COLORS[s]}` : '2px solid transparent',
            flexShrink: 0,
          }}>
            {STAGE_LABELS[s].slice(0,3)}
          </div>
          {i < 3 && <div style={{ flex: 1, height: 2, background: i < idx ? '#ffd700' : 'rgba(255,255,255,0.1)' }} />}
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
  if (remaining === 0) return <div style={{ fontSize: 10, color: '#4caf50' }}>⏰ Süre tamamlandı!</div>;
  const h = Math.floor(remaining / 3600_000);
  const m = Math.floor((remaining % 3600_000) / 60_000);
  return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>⏱ {h}s {m}dk kaldı</div>;
}

function BPProgress({ bp, stage }) {
  if (stage === 'YETISKIN') return null;
  const cfg = STAGE_CONFIG[stage];
  const pct = Math.min(100, (bp / cfg.bp) * 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
        <span>BÜYÜME PUANI</span><span>{bp}/{cfg.bp}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #ce93d8, #ab47bc)', borderRadius: 3 }} />
      </div>
    </div>
  );
}

function FoalCard({ foal, onFlash }) {
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
    if (res.ok) { setEditingName(false); onFlash('✏️ İsim güncellendi'); }
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
                  flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, padding: '3px 6px',
                  background: 'rgba(0,0,0,0.4)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 5, fontFamily: 'inherit',
                }}
              />
              <button onClick={saveName} style={nameBtn}>✓</button>
              <button onClick={() => setEditingName(false)} style={nameBtn}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: stageColor }}>{foal.name}</div>
              <button
                onClick={() => { setNameInput(foal.name); setEditingName(true); }}
                style={{ ...nameBtn, opacity: 0.7 }}
                title="İsmi değiştir"
              >✏️</button>
            </div>
          )}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
            {foal.source === 'breed' ? '🧬 Çiftleştirme' : '🏪 Mağaza'}
            {foal.genes.trait && <span style={{ marginLeft: 6, color: '#ffd700' }}>{TRAITS[foal.genes.trait]?.label}</span>}
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
            <MeterBar label="TOKLUK" value={foal.tokluk} color={foal.tokluk < 20 ? '#ef5350' : '#66bb6a'} />
            <MeterBar label="MUTLULUK" value={foal.mutluluk} color="#42a5f5" />
            <BondDots value={foal.bag} />
          </div>
          {foal.tokluk < 20 && <div style={{ fontSize: 9, color: '#ef5350', marginTop: 4 }}>⚠️ Tokluk düşük – büyüme durdu!</div>}
        </>
      )}

      {isMature && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: '#ffd700', fontWeight: 700, fontSize: 12 }}>
          🎉 Olgunlaştı! Ahıra eklenmeye hazır.
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            Hız {foal.genes.speedMult.toFixed(2)}x · Manevra {foal.genes.maneuvMult.toFixed(2)}x · Zıplama {foal.genes.jumpMult.toFixed(2)}x
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {!isMature && (
          <>
            <button
              style={{ ...SC.actionBtn, background: canFeed ? '#388e3c' : '#2a2a2a', opacity: canFeed ? 1 : 0.5 }}
              onClick={() => {
                if (carrots < 15) { onFlash('❌ Yetersiz havuç (15 gerekli)'); return; }
                if (feedsToday >= FEED_MAX_DAY) { onFlash(`❌ Günlük limit doldu (${FEED_MAX_DAY}/${FEED_MAX_DAY})`); return; }
                const ok = feedFoal(foal.id);
                onFlash(ok ? `🥕 Beslendi! (${feedsToday+1}/${FEED_MAX_DAY})` : '❌ Beslenemedi');
              }}
            >
              🥕 BESLE<br /><span style={{ fontSize: 8 }}>15 havuç</span>
            </button>
            <button
              style={{ ...SC.actionBtn, background: groomReady ? '#1565c0' : '#2a2a2a', opacity: groomReady ? 1 : 0.5 }}
              onClick={() => {
                if (!groomReady) { const h = Math.floor((GROOM_COOLDOWN_MS - (now - foal.lastGroomedAt)) / 3600_000); onFlash(`❌ ${h}s sonra tımarlanabilir`); return; }
                const ok = groomFoal(foal.id); onFlash(ok ? '✨ Tımarlandı! +1BAĞ' : 'Cooldown devam ediyor');
              }}
            >
              ✨ TIMARLA<br /><span style={{ fontSize: 8 }}>Ücretsiz</span>
            </button>
            <button
              style={{ ...SC.actionBtn, background: trainReady ? '#6a1b9a' : '#2a2a2a', opacity: trainReady ? 1 : 0.5 }}
              onClick={() => {
                if (!trainReady) { onFlash('❌ Bugün antrenman yapıldı'); return; }
                const ok = trainFoal(foal.id); onFlash(ok ? '🏃 Antrenman yapıldı! +20BP +1BAĞ' : 'Cooldown devam ediyor');
              }}
            >
              🏃 ANTRENMAN<br /><span style={{ fontSize: 8 }}>Günde 1</span>
            </button>
          </>
        )}
        {canAdvance && (
          <button
            style={{ ...SC.actionBtn, background: 'linear-gradient(135deg,#f57f17,#e65100)', flex: 1 }}
            onClick={() => { advanceStageIfReady(foal.id); onFlash('🌟 Aşama geçildi!'); }}
          >
            🌟 AŞAMA GEÇER
          </button>
        )}
        {isMature && (
          <button
            style={{ ...SC.actionBtn, background: 'linear-gradient(135deg,#ffd700,#ff8f00)', flex: 1, color: '#000' }}
            onClick={() => { const h = matureFoal(foal.id); onFlash(h ? `🐴 ${h.name} atlarına katıldı!` : 'Hata'); }}
          >
            🐴 AHIRA EKLE
          </button>
        )}
      </div>

      {/* Hızlandır — süre kapısını havuç veya reklamla anında geç */}
      {!isMature && !canAdvance && elapsed < cfg.minMs && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            style={{ ...SC.actionBtn, flex: 1, background: carrots >= rushCost(foal.id) ? 'linear-gradient(135deg,#ff9f43,#e17055)' : 'rgba(255,255,255,0.1)', opacity: carrots >= rushCost(foal.id) ? 1 : 0.5 }}
            disabled={carrots < rushCost(foal.id)}
            onClick={() => { if (rushFoalStage(foal.id, false)) onFlash('⏩ Süre atlandı!'); }}
          >
            ⏩ HIZLANDIR<br /><span style={{ fontSize: 9 }}>{rushCost(foal.id)} 🥕</span>
          </button>
          <div style={{ flex: 1 }}>
            <AdButton
              label="Ücretsiz hızlandır"
              sub="Reklam izle → süre atlanır"
              color="#00cfff"
              compact
              onReward={() => { if (rushFoalStage(foal.id, true)) onFlash('⏩ Süre atlandı!'); }}
            />
          </div>
        </div>
      )}

      {/* Reklam izle → bekleme süresini atla (tımar / antrenman) */}
      {!isMature && (!groomReady || !trainReady) && (
        <div style={{ marginTop: 8 }}>
          <AdButton
            label={!groomReady && !trainReady ? 'Bekleme sürelerini atla' : !groomReady ? 'Tımar beklemesini atla' : 'Antrenman beklemesini atla'}
            sub="Reklam izle → hemen tekrar bakım yap"
            color="#9ad0ff"
            compact
            onReward={() => {
              if (!groomReady) skipFoalCooldown(foal.id, 'groom');
              if (!trainReady) skipFoalCooldown(foal.id, 'train');
              onFlash('⏩ Bekleme süresi atlandı');
            }}
          />
        </div>
      )}
    </div>
  );
}

function BreedModal({ onClose, onDone }) {
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
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>🧬 ÇİFTLEŞTİRME</span>
          <button style={SC.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[['Ebeveyn A', selA, setSelA, selB], ['Ebeveyn B', selB, setSelB, selA]].map(([lbl, sel, setSel, other]) => (
            <div key={lbl}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{lbl}</div>
              <select
                value={sel ?? ''}
                onChange={e => setSel(e.target.value)}
                style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '6px 8px', fontFamily: 'var(--game-font)', fontSize: 11 }}
              >
                {available.filter(h => h.id !== other).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {previewGenes && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <div style={{ color: '#ffd700', fontWeight: 700, marginBottom: 4 }}>Tahmini Özellikler (±%10 varyasyon)</div>
            <div>Hız: ~{previewGenes.speedMult.toFixed(2)}x &nbsp; Manevra: ~{previewGenes.maneuvMult.toFixed(2)}x</div>
            <div>Zıplama: ~{previewGenes.jumpMult.toFixed(2)}x &nbsp; Max Hız: ~{previewGenes.maxSpeed.toFixed(0)}</div>
            <div style={{ color: '#ce93d8', marginTop: 4 }}>%5 nadir özellik şansı</div>
          </div>
        )}

        {err && <div style={{ color: '#ef5350', fontSize: 11, marginBottom: 8 }}>{err}</div>}

        {/* Reklam izle → çiftleştirme bekleme süresini atla */}
        {breedCooldownActive && (
          <div style={{ marginBottom: 10 }}>
            <AdButton
              label="Çiftleştirme beklemesini atla"
              sub="Reklam izle → hemen çiftleştir"
              color="#ce93d8"
              compact
              onReward={() => { skipFoalCooldown(null, 'breed'); setErr(''); }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: canBreed ? '#ffd700' : '#ff6666', fontWeight: 700 }}>🥕 {BREED_COST} havuç</span>
          <button
            style={{ ...SC.actionBtn, background: canBreed ? 'linear-gradient(135deg,#c8a000,#a07800)' : '#3a2a2a', opacity: canBreed ? 1 : 0.5, padding: '10px 24px' }}
            disabled={!canBreed}
            onClick={() => {
              const res = breedFoal(selA, selB);
              if (res.ok) { onDone(res.foal); }
              else setErr(res.reason);
            }}
          >
            🧬 ÇİFTLEŞTİR
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopModal({ onClose, onDone }) {
  const carrots = useGameStore(s => s.carrots);
  const buyFoal = useGameStore(s => s.buyFoal);
  const [err, setErr] = useState('');

  return (
    <div style={SC.modal}>
      <div style={SC.modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>🏪 YAVRU SATIN AL</span>
          <button style={SC.closeBtn} onClick={onClose}>✕</button>
        </div>
        {err && <div style={{ color: '#ef5350', fontSize: 11, marginBottom: 8 }}>{err}</div>}
        {[
          { tier: 1, cost: SHOP_TIER1_COST, label: 'Tier 1 Yavru', desc: 'Temel genetik · Hız 0.8–1.3x', color: '#66bb6a' },
          { tier: 2, cost: SHOP_TIER2_COST, label: 'Tier 2 Yavru', desc: 'Gelişmiş genetik · Hız 1.2–1.8x', color: '#42a5f5' },
        ].map(({ tier, cost, label, desc, color }) => (
          <div key={tier} style={{ ...SC.shopTier, borderColor: `${color}44` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{desc}</div>
            </div>
            <button
              style={{ ...SC.actionBtn, background: carrots >= cost ? `linear-gradient(135deg,${color},${color}99)` : '#3a2a2a', opacity: carrots >= cost ? 1 : 0.5, padding: '8px 16px' }}
              disabled={carrots < cost}
              onClick={() => { const res = buyFoal(tier); if (res.ok) onDone(res.foal); else setErr(res.reason); }}
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
        <div style={{ background: 'rgba(76,175,80,0.2)', border: '1px solid #4caf50', borderRadius: 8, padding: '8px 16px', textAlign: 'center', fontSize: 12, color: '#4caf50', fontWeight: 700 }}>
          {flash}
        </div>
      )}

      {/* Slot info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          Ahır: {foals.length}/{totalSlots} slot{bonusSlots > 0 ? ` (+${bonusSlots} geçici)` : ''}
        </span>
        {foals.length >= totalSlots && (
          <button
            style={{ ...SC.actionBtn, padding: '6px 14px', fontSize: 10, background: carrots >= 1000 ? 'linear-gradient(135deg,#c8a000,#a07800)' : '#3a2a2a', opacity: carrots >= 1000 ? 1 : 0.5 }}
            disabled={carrots < 1000}
            onClick={() => { const ok = buyStableSlot(); doFlash(ok ? '🏠 Yeni slot açıldı!' : 'Yetersiz havuç'); }}
          >
            🏠 +Slot (🥕 1000)
          </button>
        )}
      </div>

      {/* Ahır dolu → reklamla geçici slot */}
      {foals.length >= totalSlots && (
        <AdButton
          label="Geçici +1 ahır slotu"
          sub="Bu oturum için ekstra slot (1000 havuç değerinde)"
          ads={5}
          color="#c8a0ff"
          compact
          onReward={() => { addTempStableSlot(); doFlash('🏠 Geçici slot eklendi'); }}
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
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Ahır boş</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...SC.actionBtn, background: 'linear-gradient(135deg,#7b1fa2,#4a148c)', padding: '10px 20px' }} onClick={() => setModal('breed')}>
              🧬 ÇİFTLEŞTİR
            </button>
            <button style={{ ...SC.actionBtn, background: 'linear-gradient(135deg,#1565c0,#0d47a1)', padding: '10px 20px' }} onClick={() => setModal('shop')}>
              🏪 SATIN AL
            </button>
          </div>
          {/* Reklam izle → bedava şanslı tay (yüksek istatistik) */}
          <div style={{ width: '100%', marginTop: 10 }}>
            <AdButton
              label="Şanslı tay (bedava)"
              sub="Reklam izle → yüksek istatistikli tay"
              color="#ffd700"
              compact
              onReward={() => { const r = buyFoalLucky(1); doFlash(r.ok ? `🍀 ${r.foal.name} geldi!` : `❌ ${r.reason}`); }}
            />
          </div>
        </div>
      )}

      {modal === 'breed' && <BreedModal onClose={closeModal} onDone={foal => { closeModal(); doFlash(`🐴 ${foal.name} doğdu!`); }} />}
      {modal === 'shop'  && <ShopModal  onClose={closeModal} onDone={foal => { closeModal(); doFlash(`🐴 ${foal.name} geldi!`); }} />}
    </div>
  );
}

const SC = {
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, padding: '14px 16px',
  },
  actionBtn: {
    padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
    color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'var(--game-font)',
    cursor: 'pointer', transition: 'opacity 0.15s', textAlign: 'center',
  },
  emptySlot: {
    border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: '24px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
  },
  modalBox: {
    background: 'rgba(8,8,18,0.98)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 16, padding: 24, width: 400, maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: '#fff', fontSize: 14, padding: '4px 10px', cursor: 'pointer',
  },
  shopTier: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    border: '1px solid', borderRadius: 8, padding: '12px 16px', marginBottom: 8,
  },
};
