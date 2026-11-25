import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ProcHorse from '@/components/horse/ProcHorse';
import useGameStore from '@/store/useGameStore';
import { CHARACTERS } from '@/constants/characters';
import { HORSES, upgradeCost } from '@/constants/horses';
import Hara from './Hara';
import AdButton from '@/components/ui/AdButton';
import { AD_UPGRADE_DISCOUNT } from '@/constants/game';
import { POWERUPS, POWERUP_MAX_LEVEL, powerupDuration, powerupUpgradeCost } from '@/constants/powerups';
import { t } from '@/i18n';
import { C, FONT, DISPLAY, btn, panel, tile, pill, titleText, backdrop } from '@/ui/theme';
import { SAFE_TOP, BOTTOM_SPACE } from '@/utils/safeArea';
import useLang from '@/i18n/useLang';

// ── 3D önizleme: prosedürel at + binici (idle) ───────────────────────────────
function PreviewCanvas({ variant, characterId, camera }) {
  return (
    <div style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(180deg, #f7e2b0, #d9b677)', border: `3px solid ${C.edge}`, boxSizing: 'border-box' }}>
      <Canvas camera={camera}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 6, 4]} intensity={1.8} castShadow />
        <hemisphereLight skyColor="#aaaaff" groundColor="#443322" intensity={0.5} />
        <group position={[0, -0.95, 0]} scale={0.66}>
          <ProcHorse variant={variant} characterId={characterId} />
        </group>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={2.5}
          target={[0, 0.1, 0]}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </div>
  );
}

function CharPreview3D({ characterId, variant }) {
  return <PreviewCanvas variant={variant} characterId={characterId} camera={{ position: [2.4, 0.9, 2.6], fov: 42 }} />;
}

function HorsePreview3D({ variant, characterId }) {
  return <PreviewCanvas variant={variant} characterId={characterId} camera={{ position: [2.6, 0.8, 2.8], fov: 42 }} />;
}

// ── Main Garage ───────────────────────────────────────────────────────────────
export default function Garage() {
  useLang();
  const showGarage          = useGameStore(s => s.showGarage);
  const closeGarage         = useGameStore(s => s.closeGarage);
  const garageOpenTab       = useGameStore(s => s.garageOpenTab);
  const carrots             = useGameStore(s => s.carrots);
  const selectedCharacterId = useGameStore(s => s.selectedCharacterId);
  const ownedCharacterIds   = useGameStore(s => s.ownedCharacterIds);
  const selectCharacter     = useGameStore(s => s.selectCharacter);
  const purchaseCharacter   = useGameStore(s => s.purchaseCharacter);
  const selectedHorseId     = useGameStore(s => s.selectedHorseId);
  const ownedHorseIds       = useGameStore(s => s.ownedHorseIds);
  const selectHorse         = useGameStore(s => s.selectHorse);
  const purchaseHorse       = useGameStore(s => s.purchaseHorse);
  const horseUpgrades       = useGameStore(s => s.horseUpgrades);
  const upgradeHorseStat    = useGameStore(s => s.upgradeHorseStat);
  const upgradeDiscount     = useGameStore(s => s.upgradeDiscount);
  const armUpgradeDiscount  = useGameStore(s => s.armUpgradeDiscount);
  const customHorses        = useGameStore(s => s.customHorses ?? []);
  const tickFoals           = useGameStore(s => s.tickFoals);
  const powerupLevels       = useGameStore(s => s.powerupLevels ?? {});
  const upgradePowerup      = useGameStore(s => s.upgradePowerup);

  const allHorses = [...HORSES, ...customHorses];

  const [tab,         setTab]         = useState('jockey'); // 'jockey' | 'horse' | 'hara'
  const [charPreview, setCharPreview] = useState(selectedCharacterId);
  const [horsePrev,   setHorsePrev]   = useState(selectedHorseId);
  const [flash,       setFlash]       = useState('');

  // Sync tab when garageOpenTab changes (e.g. AHIR button)
  useEffect(() => {
    if (garageOpenTab) setTab(garageOpenTab);
  }, [garageOpenTab]);

  // Tick foal meters on open and every 60s while open
  useEffect(() => {
    if (!showGarage) return;
    tickFoals(Date.now());
    const id = setInterval(() => tickFoals(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [showGarage, tickFoals]);

  if (!showGarage) return null;

  const doFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 1500); };
  const flashBad = flash.includes('YETERSİZ');

  // ── Jockey action ─────────────────────────────────────────────────────────
  const previewChar = CHARACTERS.find(c => c.id === charPreview) ?? CHARACTERS[0];
  const charOwned   = ownedCharacterIds.includes(charPreview);
  const charSel     = selectedCharacterId === charPreview;

  const handleCharAction = () => {
    if (charOwned) {
      selectCharacter(charPreview);
      doFlash('SEÇİLDİ!');
    } else {
      const ok = purchaseCharacter(charPreview, previewChar.price);
      if (ok) { selectCharacter(charPreview); doFlash('SATIN ALINDI!'); }
      else doFlash('YETERSİZ HAVUÇ!');
    }
  };

  // ── Horse action ──────────────────────────────────────────────────────────
  const previewHorse = allHorses.find(h => h.id === horsePrev) ?? allHorses[0];
  const horseOwned   = ownedHorseIds.includes(horsePrev);
  const horseSel     = selectedHorseId === horsePrev;

  const handleHorseAction = () => {
    if (horseOwned) {
      selectHorse(horsePrev);
      doFlash('SEÇİLDİ!');
    } else {
      const ok = purchaseHorse(horsePrev, previewHorse.price);
      if (ok) { selectHorse(horsePrev); doFlash('SATIN ALINDI!'); }
      else doFlash('YETERSİZ HAVUÇ!');
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.title}>🏇 {t('MAĞAZA')}</span>
          <span style={S.gold}>🥕 {carrots}</span>
          <button aria-label={t('Kapat')} className="hr-press" style={S.closeBtn} onClick={closeGarage}>✕</button>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {[['jockey','🥷 '+t('JOKEYLERİM')],['horse','🐴 '+t('ATLARIM')],['hara','🐣 '+t('HARA')],['powerups','⚡ '+t('YETENEKLER')]].map(([id, label]) => (
            <button
              key={id}
              className="hr-press"
              style={{ ...S.tab, ...(tab === id ? S.tabActive : {}) }}
              onClick={() => { setTab(id); setFlash(''); }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── JOCKEY TAB ── */}
        {tab === 'jockey' && (
          <>
            <div style={S.grid}>
              {CHARACTERS.map(c => {
                const owned    = ownedCharacterIds.includes(c.id);
                const selected = selectedCharacterId === c.id;
                const active   = charPreview === c.id;
                return (
                  <div key={c.id}
                    style={{ ...S.card,
                      borderColor: active ? C.goldLo : selected ? C.green : C.edge,
                      background:  active ? '#fbe7b8' : selected ? '#dcefc8' : C.creamDk,
                      boxShadow: active ? `0 0 0 3px ${C.gold}, 0 4px 0 ${C.edge}` : `0 4px 0 ${C.edge}`,
                      filter: owned ? 'none' : 'saturate(0.45)',
                    }}
                    onClick={() => setCharPreview(c.id)}
                  >
                    <div style={S.cardEmoji}>{c.emoji}</div>
                    <div style={S.cardName}>{t(c.name)}</div>
                    {selected && <div style={S.badge}>✓ {t('AKTİF')}</div>}
                    {!owned  && <div style={{ ...S.cardPrice, color: carrots >= c.price ? C.ink : C.red }}>🥕 {c.price}</div>}
                    {owned && !selected && <div style={{ ...S.cardPrice, color: C.inkSoft }}>{t('SAHİPSİN')}</div>}
                  </div>
                );
              })}
            </div>

            {/* 3D Preview */}
            <div style={{ ...S.preview, borderColor: previewChar.color }}>
              <CharPreview3D characterId={previewChar.id} variant={allHorses.find(h => h.id === selectedHorseId) ?? HORSES[0]} />
              <div style={{ ...S.previewName }}>{t(previewChar.name)}</div>
              <div style={S.previewDesc}>{t(previewChar.desc)}</div>
              {!charOwned && (
                <div style={S.priceRow}>
                  <span style={{ color: carrots >= previewChar.price ? C.ink : C.red, fontFamily: DISPLAY, fontSize: 22 }}>🥕 {previewChar.price}</span>
                  <span style={S.priceSub}>{t('havuç')}</span>
                </div>
              )}
              {flash ? (
                <div style={{ ...S.actionBtn, ...(flashBad ? btn.danger : btn.success), cursor: 'default' }}>{t(flash)}</div>
              ) : (
                <button
                  className="hr-press"
                  style={{ ...S.actionBtn,
                    ...(charSel ? { ...btn.secondary, opacity: 0.8 } : charOwned ? btn.success : carrots >= previewChar.price ? btn.primary : { ...btn.secondary, filter: 'saturate(0.4)' }),
                    cursor: charSel ? 'default' : 'pointer',
                  }}
                  onClick={handleCharAction}
                  disabled={charSel}
                >
                  {charSel ? '✓ ' + t('SEÇİLİ') : charOwned ? '🐴 ' + t('SEÇ') : '🥕 ' + t('SATIN AL')}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── HORSE TAB ── */}
        {tab === 'horse' && (
          <>
            <div style={{ ...S.grid, gridTemplateColumns: 'repeat(3,1fr)' }}>
              {allHorses.map(h => {
                const owned    = ownedHorseIds.includes(h.id);
                const selected = selectedHorseId === h.id;
                const active   = horsePrev === h.id;
                return (
                  <div key={h.id}
                    style={{ ...S.card,
                      borderColor: active ? C.goldLo : selected ? C.green : C.edge,
                      background:  active ? '#fbe7b8' : selected ? '#dcefc8' : C.creamDk,
                      boxShadow: active ? `0 0 0 3px ${C.gold}, 0 4px 0 ${C.edge}` : `0 4px 0 ${C.edge}`,
                      filter: owned ? 'none' : 'saturate(0.45)',
                    }}
                    onClick={() => setHorsePrev(h.id)}
                  >
                    {/* Color swatch */}
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: h.bodyColor, border: `3px solid ${h.maneColor}`, marginBottom: 4 }} />
                    <div style={S.cardName}>{t(h.name)}</div>
                    {selected && <div style={S.badge}>✓ {t('AKTİF')}</div>}
                    {!owned && <div style={{ ...S.cardPrice, color: carrots >= h.price ? C.ink : C.red }}>🥕 {h.price}</div>}
                    {owned && !selected && <div style={{ ...S.cardPrice, color: C.inkSoft }}>{t('SAHİPSİN')}</div>}
                  </div>
                );
              })}
            </div>

            {/* 3D Horse Preview */}
            <div style={{ ...S.preview, borderColor: previewHorse.accentColor }}>
              <HorsePreview3D variant={previewHorse} characterId={selectedCharacterId} />
              <div style={{ ...S.previewName }}>{t(previewHorse.name)}</div>
              <div style={S.previewDesc}>{t(previewHorse.desc)}</div>

              {/* 3-stat upgrade section */}
              {horseOwned && (() => {
                const ups = horseUpgrades?.[previewHorse.id] ?? { speedLevel: 0, maneuvLevel: 0, jumpLevel: 0 };
                const STATS = [
                  { key: 'speedLevel',  label: 'NAL ÇİVİLEME',      sub: 'Hız +5%/seviye',    icon: '⚡', color: '#ff9800' },
                  { key: 'maneuvLevel', label: 'EYER SEYİS AYARI',   sub: 'Manevra +10%/seviye', icon: '🎯', color: '#4fc3f7' },
                  { key: 'jumpLevel',   label: 'SIÇRAMA GÜCÜ',       sub: 'Zıplama +6%/seviye', icon: '🌙', color: '#ce93d8' },
                ];
                return (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Reklam izle → sonraki yükseltme %50 indirimli */}
                    {upgradeDiscount ? (
                      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, color: C.greenEdge, letterSpacing: 1, padding: '8px', background: '#d8f0c8', border: `3px solid ${C.greenEdge}`, borderRadius: 12 }}>
                        ✓ {t('İNDİRİM AKTİF — sonraki yükseltme %50')}
                      </div>
                    ) : (
                      <AdButton
                        label={t('Yükseltmede %50 indirim')}
                        sub={t('Reklam izle → sonraki yükseltme yarı fiyat')}
                        color="#33ff99"
                        compact
                        onReward={() => armUpgradeDiscount()}
                      />
                    )}
                    {STATS.map(({ key, label, sub, icon, color }) => {
                      const lvl = ups[key] ?? 0;
                      const maxed = lvl >= 5;
                      const baseCost = upgradeCost(lvl);
                      const cost = upgradeDiscount ? Math.ceil(baseCost * (1 - AD_UPGRADE_DISCOUNT)) : baseCost;
                      const canAfford = !maxed && carrots >= cost;
                      return (
                        <div key={key} style={{ ...S.statBox, borderColor: C.edge }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            <span style={{ fontSize: 18 }}>{icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontFamily: DISPLAY, letterSpacing: 1, color: C.ink }}>{t(label)}</div>
                              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>{t(sub)}</div>
                              {/* Progress bar */}
                              <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
                                {Array.from({ length: 5 }, (_, i) => (
                                  <div key={i} style={{
                                    flex: 1, height: 8, borderRadius: 4, border: `2px solid ${C.edge}`,
                                    background: i < lvl ? `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})` : C.edgeDk,
                                    transition: 'background 0.2s',
                                  }} />
                                ))}
                              </div>
                              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginTop: 3 }}>
                                {t('SEVİYE')} {lvl}/5
                              </div>
                            </div>
                          </div>
                          {maxed ? (
                            <div style={S.maxBadge}>{t('MAKSİMUM')}</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 80 }}>
                              <span style={{ fontSize: 15, fontFamily: DISPLAY, color: canAfford ? C.ink : C.red }}>🥕 {cost}</span>
                              <button
                                className="hr-press"
                                style={{ ...S.upgradeBtn, ...(canAfford ? btn.success : { ...btn.secondary, filter: 'saturate(0.4)' }), cursor: canAfford ? 'pointer' : 'not-allowed', opacity: canAfford ? 1 : 0.5 }}
                                onClick={() => {
                                  const ok = upgradeHorseStat(previewHorse.id, key);
                                  if (!ok) doFlash('YETERSİZ HAVUÇ!');
                                  else doFlash(`${t(label)} ${t('SEVİYE')} ${lvl + 1}!`);
                                }}
                                disabled={!canAfford}
                              >
                                ↑ {t('YÜKSELT')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {!horseOwned && (
                <div style={S.priceRow}>
                  <span style={{ color: carrots >= previewHorse.price ? C.ink : C.red, fontFamily: DISPLAY, fontSize: 22 }}>🥕 {previewHorse.price}</span>
                  <span style={S.priceSub}>{t('havuç')}</span>
                </div>
              )}
              {flash ? (
                <div style={{ ...S.actionBtn, ...(flashBad ? btn.danger : btn.success), cursor: 'default' }}>{t(flash)}</div>
              ) : (
                <button
                  className="hr-press"
                  style={{ ...S.actionBtn,
                    ...(horseSel ? { ...btn.secondary, opacity: 0.8 } : horseOwned ? btn.success : carrots >= previewHorse.price ? btn.primary : { ...btn.secondary, filter: 'saturate(0.4)' }),
                    cursor: horseSel ? 'default' : 'pointer',
                  }}
                  onClick={handleHorseAction}
                  disabled={horseSel}
                >
                  {horseSel ? '✓ ' + t('SEÇİLİ') : horseOwned ? '🐴 ' + t('SEÇ') : '🥕 ' + t('SATIN AL')}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── HARA TAB ── */}
        {tab === 'hara' && <Hara />}

        {/* ── YETENEKLER TAB ── */}
        {tab === 'powerups' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, textAlign: 'center' }}>
              {t('Koşuda yolda beliren yetenekleri topla. Havuçla geliştir → süreleri uzasın!')}
            </div>
            {flash && (
              <div style={{ ...S.actionBtn, ...(flashBad ? btn.danger : btn.success), cursor: 'default' }}>{t(flash)}</div>
            )}
            {POWERUPS.map(p => {
              const lvl    = powerupLevels[p.id] ?? 0;
              const maxed  = lvl >= POWERUP_MAX_LEVEL;
              const cost   = powerupUpgradeCost(lvl);
              const canAfford = !maxed && carrots >= cost;
              const curDur  = powerupDuration(p.id, lvl);
              const nextDur = powerupDuration(p.id, lvl + 1);
              return (
                <div key={p.id} style={{ ...S.statBox, borderColor: C.edge }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <span style={{ fontSize: 24 }}>{p.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: DISPLAY, letterSpacing: 1, color: C.ink }}>{t(p.name)}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>{t(p.desc)}</div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
                        {Array.from({ length: POWERUP_MAX_LEVEL }, (_, i) => (
                          <div key={i} style={{
                            flex: 1, height: 8, borderRadius: 4, border: `2px solid ${C.edge}`,
                            background: i < lvl ? `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})` : C.edgeDk,
                            transition: 'background 0.2s',
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginTop: 3 }}>
                        {t('SEVİYE')} {lvl}/{POWERUP_MAX_LEVEL} — {t('Süre:')} {curDur.toFixed(1)}s{!maxed && ` → ${nextDur.toFixed(1)}s`}
                      </div>
                    </div>
                  </div>
                  {maxed ? (
                    <div style={S.maxBadge}>{t('MAKSİMUM')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 80 }}>
                      <span style={{ fontSize: 15, fontFamily: DISPLAY, color: canAfford ? C.ink : C.red }}>🥕 {cost}</span>
                      <button
                        className="hr-press"
                        style={{ ...S.upgradeBtn, ...(canAfford ? btn.success : { ...btn.secondary, filter: 'saturate(0.4)' }), cursor: canAfford ? 'pointer' : 'not-allowed', opacity: canAfford ? 1 : 0.6 }}
                        onClick={() => {
                          const ok = upgradePowerup(p.id);
                          if (!ok) doFlash('YETERSİZ HAVUÇ!');
                          else doFlash(`${t(p.name)} ${t('SEVİYE')} ${lvl + 1}!`);
                        }}
                        disabled={!canAfford}
                      >
                        ↑ {t('YÜKSELT')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: backdrop,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, fontFamily: FONT, userSelect: 'none',
    // iOS çentiği paneli kesmesin
    paddingTop: SAFE_TOP, paddingBottom: BOTTOM_SPACE, boxSizing: 'border-box',
  },
  panel: {
    ...panel, padding: 20, width: 680, maxWidth: '96vw', maxHeight: '92vh',
    overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...titleText(28), textTransform: 'uppercase' },
  gold: { ...pill, fontFamily: DISPLAY, fontWeight: 400, fontSize: 18, letterSpacing: 1 },
  closeBtn: { ...btn.icon, width: 44, height: 44, fontSize: 18 },
  tabs: { display: 'flex', gap: 4, background: C.woodDk, border: `3px solid ${C.edge}`, borderRadius: 16, padding: 4 },
  tab: {
    flex: 1, padding: '8px 2px', minHeight: 44, fontSize: 13, letterSpacing: 1,
    fontFamily: DISPLAY, cursor: 'pointer', borderRadius: 12, border: 'none',
    background: 'transparent', color: C.textOnDark,
  },
  tabActive: { background: `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})`, color: C.ink, boxShadow: `0 3px 0 ${C.edge}` },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 },
  card: {
    ...tile, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '12px 6px', border: '3px solid', cursor: 'pointer', minHeight: 44,
  },
  cardEmoji: { fontSize: 28 },
  cardName: { fontSize: 12, color: C.ink, textAlign: 'center', fontWeight: 800 },
  badge: { fontSize: 11, color: C.greenEdge, fontWeight: 800, letterSpacing: 1 },
  cardPrice: { fontSize: 13, fontFamily: DISPLAY, letterSpacing: 1 },
  preview: {
    ...tile, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 8, border: '3px solid', padding: '14px 16px',
  },
  previewName: { ...titleText(24) },
  previewDesc: { fontSize: 13, color: C.inkSoft, fontWeight: 700, textAlign: 'center' },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 },
  priceSub: { color: C.inkSoft, fontWeight: 700, fontSize: 13 },
  actionBtn: {
    marginTop: 6, padding: '12px 24px', minHeight: 52, fontSize: 18,
    textTransform: 'uppercase', fontFamily: DISPLAY, width: '100%', textAlign: 'center', boxSizing: 'border-box',
  },
  levelBox: {
    ...tile, width: '100%', border: `3px solid ${C.edge}`,
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  levelBadge: { fontSize: 13, fontFamily: DISPLAY, color: C.ink, letterSpacing: 1 },
  levelInfo: { fontSize: 12, color: C.inkSoft, fontWeight: 700 },
  upgradeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  upgradeBtn: { padding: '8px 12px', minHeight: 44, fontSize: 13, borderRadius: 12 },
  statBox: {
    ...tile, display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    background: C.cream, border: '3px solid', padding: '10px 12px',
  },
  maxBadge: {
    fontSize: 13, fontFamily: DISPLAY, letterSpacing: 1, color: C.ink,
    background: `linear-gradient(180deg, ${C.goldHi}, ${C.goldLo})`, border: `3px solid ${C.edge}`,
    borderRadius: 999, padding: '6px 12px', whiteSpace: 'nowrap',
  },
};
