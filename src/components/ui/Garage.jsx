import { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei';
import useGameStore from '@/store/useGameStore';
import { CHARACTERS } from '@/constants/characters';
import { HORSES } from '@/constants/horses';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import Hara from './Hara';
import AdButton from '@/components/ui/AdButton';
import { AD_UPGRADE_DISCOUNT } from '@/constants/game';

const CHAR_BASE = '/assets/models/characters/';
const MODEL_PATH = '/assets/models/horse.glb';

// ── 3D character preview ──────────────────────────────────────────────────────
function CharModel3DInner({ file }) {
  const { scene } = useGLTF(CHAR_BASE + file);
  const cloned = useRef(null);
  if (!cloned.current) {
    cloned.current = scene.clone(true);
    cloned.current.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }
  return (
    <primitive
      object={cloned.current}
      scale={1}
      position={[0, -1.55, 0]}
    />
  );
}

function CharPreview3D({ charFile, accentColor }) {
  return (
    <div style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
      <Canvas camera={{ position: [0, 0.5, 3.2], fov: 42 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 6, 4]} intensity={1.8} castShadow />
        <hemisphereLight skyColor="#aaaaff" groundColor="#443322" intensity={0.5} />
        <Suspense fallback={null}>
          <CharModel3DInner key={charFile} file={charFile} />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={2.5}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </div>
  );
}

// ── 3D horse preview ──────────────────────────────────────────────────────────
function HorseModel3DInner({ variant }) {
  const path     = variant?.model ?? MODEL_PATH;
  const useScale = variant?.modelScale ?? 0.013;
  const useY     = variant?.modelY ?? -1.05;
  const clipName = variant?.animClip ?? 'horse_A_';
  const skeletal = !!variant?.skeletal;
  const noTint   = !!variant?.noTint;

  const { scene, animations } = useGLTF(path);
  const groupRef = useRef();
  const { actions, names } = useAnimations(animations, groupRef);
  const cloned = useRef(null);
  const clonedPath = useRef(null);
  const lastVariant = useRef(null);

  if (clonedPath.current !== path) {
    clonedPath.current = path;
    lastVariant.current = null;
    cloned.current = skeletal ? skeletonClone(scene) : scene.clone(true);
    cloned.current.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  if (!noTint && variant && variant.id !== lastVariant.current) {
    lastVariant.current = variant.id;
    let meshIdx = 0;
    cloned.current.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.color.set(meshIdx === 0 ? variant.bodyColor : variant.maneColor);
      if (variant.whiteWash) {
        o.material.map = null;
        o.material.roughness = 0.55;
        o.material.metalness = 0.0;
        o.material.needsUpdate = true;
      }
      meshIdx++;
    });
  }

  useState(() => {
    const action = actions[clipName] ?? actions['idle'] ?? actions[names[0]];
    if (action) { action.reset().play(); action.timeScale = 0.5; }
  });

  return (
    <group ref={groupRef} scale={useScale} rotation={[0, Math.PI, 0]} position={[0, useY, 0]}>
      <primitive object={cloned.current} />
    </group>
  );
}

function HorsePreview3D({ variant }) {
  return (
    <div style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
      <Canvas camera={{ position: [0, 0.8, 3.5], fov: 42 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 6, 4]} intensity={1.8} castShadow />
        <hemisphereLight skyColor="#aaaaff" groundColor="#443322" intensity={0.5} />
        <Suspense fallback={<mesh><boxGeometry args={[1,0.6,2]} /><meshStandardMaterial color={variant.bodyColor} /></mesh>}>
          <HorseModel3DInner variant={variant} />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={2.5}
          minPolarAngle={Math.PI / 2.5}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </div>
  );
}

// ── Main Garage ───────────────────────────────────────────────────────────────
export default function Garage() {
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
          <span style={S.title}>🏇 MAĞAZA</span>
          <span style={S.gold}>🥕 {carrots}</span>
          <button style={S.closeBtn} onClick={closeGarage}>✕</button>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {[['jockey','🥷 JOKEYLERİM'],['horse','🐴 ATLARIM'],['hara','🐣 HARA']].map(([id, label]) => (
            <button
              key={id}
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
                      borderColor: active ? '#f5d060' : selected ? '#4aaa66' : 'rgba(255,255,255,0.1)',
                      background:  active ? 'rgba(245,208,96,0.12)' : selected ? 'rgba(74,170,102,0.10)' : 'rgba(255,255,255,0.04)',
                      opacity: owned ? 1 : 0.75,
                    }}
                    onClick={() => setCharPreview(c.id)}
                  >
                    <div style={S.cardEmoji}>{c.emoji}</div>
                    <div style={S.cardName}>{c.name}</div>
                    {selected && <div style={S.badge}>✓ AKTİF</div>}
                    {!owned  && <div style={{ ...S.cardPrice, color: carrots >= c.price ? '#ffd700' : '#ff6666' }}>🥕 {c.price}</div>}
                    {owned && !selected && <div style={{ ...S.cardPrice, color: '#aaa' }}>SAHİPSİN</div>}
                  </div>
                );
              })}
            </div>

            {/* 3D Preview */}
            <div style={{ ...S.preview, borderColor: previewChar.color }}>
              <CharPreview3D charFile={previewChar.file} accentColor={previewChar.color} />
              <div style={{ ...S.previewName, color: previewChar.color }}>{previewChar.name}</div>
              <div style={S.previewDesc}>{previewChar.desc}</div>
              {!charOwned && (
                <div style={S.priceRow}>
                  <span style={{ color: carrots >= previewChar.price ? '#ffd700' : '#ff6666', fontWeight: 700, fontSize: 18 }}>🥕 {previewChar.price}</span>
                  <span style={S.priceSub}>havuç</span>
                </div>
              )}
              {flash ? (
                <div style={{ ...S.actionBtn, background: flash.includes('YETERSİZ') ? '#8b1a1a' : '#1a5c2a', cursor: 'default' }}>{flash}</div>
              ) : (
                <button
                  style={{ ...S.actionBtn,
                    background: charSel ? '#2a4a2a' : charOwned ? 'linear-gradient(135deg,#2a8a4a,#1a6a30)' : carrots >= previewChar.price ? 'linear-gradient(135deg,#c8a000,#a07800)' : '#3a2a2a',
                    cursor: charSel ? 'default' : 'pointer',
                  }}
                  onClick={handleCharAction}
                  disabled={charSel}
                >
                  {charSel ? '✓ SEÇİLİ' : charOwned ? '🐴 SEÇ' : '🥕 SATIN AL'}
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
                      borderColor: active ? '#f5d060' : selected ? '#4aaa66' : 'rgba(255,255,255,0.1)',
                      background:  active ? 'rgba(245,208,96,0.12)' : selected ? 'rgba(74,170,102,0.10)' : 'rgba(255,255,255,0.04)',
                      opacity: owned ? 1 : 0.75,
                    }}
                    onClick={() => setHorsePrev(h.id)}
                  >
                    {/* Color swatch */}
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: h.bodyColor, border: `3px solid ${h.maneColor}`, marginBottom: 4 }} />
                    <div style={S.cardName}>{h.name}</div>
                    {selected && <div style={S.badge}>✓ AKTİF</div>}
                    {!owned && <div style={{ ...S.cardPrice, color: carrots >= h.price ? '#ffd700' : '#ff6666' }}>🥕 {h.price}</div>}
                    {owned && !selected && <div style={{ ...S.cardPrice, color: '#aaa' }}>SAHİPSİN</div>}
                  </div>
                );
              })}
            </div>

            {/* 3D Horse Preview */}
            <div style={{ ...S.preview, borderColor: previewHorse.accentColor }}>
              <HorsePreview3D variant={previewHorse} />
              <div style={{ ...S.previewName, color: previewHorse.accentColor }}>{previewHorse.name}</div>
              <div style={S.previewDesc}>{previewHorse.desc}</div>

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
                      <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#33ff99', letterSpacing: 1, padding: '6px', border: '1px solid #33ff9955', borderRadius: 8 }}>
                        ✓ İNDİRİM AKTİF — sonraki yükseltme %50
                      </div>
                    ) : (
                      <AdButton
                        label="Yükseltmede %50 indirim"
                        sub="Reklam izle → sonraki yükseltme yarı fiyat"
                        color="#33ff99"
                        compact
                        onReward={() => armUpgradeDiscount()}
                      />
                    )}
                    {STATS.map(({ key, label, sub, icon, color }) => {
                      const lvl = ups[key] ?? 0;
                      const maxed = lvl >= 5;
                      const baseCost = 750 * Math.pow(2, lvl);
                      const cost = upgradeDiscount ? Math.ceil(baseCost * (1 - AD_UPGRADE_DISCOUNT)) : baseCost;
                      const canAfford = !maxed && carrots >= cost;
                      return (
                        <div key={key} style={{ ...S.statBox, borderColor: `${color}44` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            <span style={{ fontSize: 18 }}>{icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color }}>{label}</div>
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sub}</div>
                              {/* Progress bar */}
                              <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
                                {Array.from({ length: 5 }, (_, i) => (
                                  <div key={i} style={{
                                    flex: 1, height: 4, borderRadius: 2,
                                    background: i < lvl ? color : 'rgba(255,255,255,0.15)',
                                    transition: 'background 0.2s',
                                  }} />
                                ))}
                              </div>
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                                SEVİYE {lvl}/5
                              </div>
                            </div>
                          </div>
                          {maxed ? (
                            <div style={S.maxBadge}>MAKSİMUM</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 80 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: canAfford ? '#ffd700' : '#ff6666' }}>🥕 {cost}</span>
                              <button
                                style={{ ...S.upgradeBtn, background: canAfford ? `linear-gradient(135deg, ${color}, ${color}99)` : '#3a2a2a', cursor: canAfford ? 'pointer' : 'not-allowed', opacity: canAfford ? 1 : 0.5 }}
                                onClick={() => {
                                  const ok = upgradeHorseStat(previewHorse.id, key);
                                  if (!ok) doFlash('YETERSİZ HAVUÇ!');
                                  else doFlash(`${label} SEVİYE ${lvl + 1}!`);
                                }}
                                disabled={!canAfford}
                              >
                                ↑ YÜKSELTİ
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
                  <span style={{ color: carrots >= previewHorse.price ? '#ffd700' : '#ff6666', fontWeight: 700, fontSize: 18 }}>🥕 {previewHorse.price}</span>
                  <span style={S.priceSub}>havuç</span>
                </div>
              )}
              {flash ? (
                <div style={{ ...S.actionBtn, background: flash.includes('YETERSİZ') ? '#8b1a1a' : '#1a5c2a', cursor: 'default' }}>{flash}</div>
              ) : (
                <button
                  style={{ ...S.actionBtn,
                    background: horseSel ? '#2a4a2a' : horseOwned ? 'linear-gradient(135deg,#2a8a4a,#1a6a30)' : carrots >= previewHorse.price ? 'linear-gradient(135deg,#c8a000,#a07800)' : '#3a2a2a',
                    cursor: horseSel ? 'default' : 'pointer',
                  }}
                  onClick={handleHorseAction}
                  disabled={horseSel}
                >
                  {horseSel ? '✓ SEÇİLİ' : horseOwned ? '🐴 SEÇ' : '🥕 SATIN AL'}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── HARA TAB ── */}
        {tab === 'hara' && <Hara />}
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    fontFamily: 'monospace',
    userSelect: 'none',
  },
  panel: {
    background: 'rgba(8,8,18,0.97)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 24,
    width: 680,
    maxWidth: '96vw',
    maxHeight: '92vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: '0 12px 60px rgba(0,0,0,0.8)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: 700, letterSpacing: 3, color: '#fff' },
  gold: {
    fontSize: 16, fontWeight: 700, color: '#ffd700',
    background: 'rgba(255,215,0,0.1)', padding: '4px 14px',
    borderRadius: 20, border: '1px solid rgba(255,215,0,0.3)',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: '#fff', fontSize: 16, padding: '4px 10px',
    cursor: 'pointer', fontFamily: 'monospace',
  },
  tabs: { display: 'flex', gap: 8 },
  tab: {
    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, letterSpacing: 2,
    fontFamily: 'monospace', cursor: 'pointer', borderRadius: 8,
    border: '2px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
    transition: 'all 0.15s',
  },
  tabActive: {
    border: '2px solid #f5d060',
    background: 'rgba(245,208,96,0.12)', color: '#f5d060',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 8,
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '12px 6px', border: '2px solid',
    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
  },
  cardEmoji: { fontSize: 28 },
  cardName: { fontSize: 9, letterSpacing: 1, color: '#fff', textAlign: 'center', fontWeight: 700 },
  badge: { fontSize: 9, color: '#4aaa66', letterSpacing: 1 },
  cardPrice: { fontSize: 10, fontWeight: 700, letterSpacing: 1 },
  preview: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 8, background: 'rgba(255,255,255,0.04)',
    border: '2px solid', borderRadius: 12, padding: '16px 24px',
  },
  previewName: { fontSize: 20, fontWeight: 700, letterSpacing: 3 },
  previewDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 },
  priceSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  actionBtn: {
    marginTop: 6, padding: '11px 44px', fontSize: 14,
    fontWeight: 700, letterSpacing: 3, color: '#fff',
    border: 'none', borderRadius: 8, fontFamily: 'monospace',
    transition: 'opacity 0.15s', width: '100%', textAlign: 'center',
  },
  levelBox: {
    width: '100%', background: 'rgba(255,215,0,0.06)',
    border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8,
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  levelBadge: {
    fontSize: 12, fontWeight: 700, color: '#ffd700', letterSpacing: 2,
  },
  levelInfo: {
    fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1,
  },
  upgradeRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  upgradeBtn: {
    padding: '6px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
    color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'monospace',
    transition: 'opacity 0.15s',
  },
  statBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid',
    borderRadius: 8, padding: '10px 12px',
  },
  maxBadge: {
    fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#ffd700',
    background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)',
    borderRadius: 4, padding: '4px 8px', whiteSpace: 'nowrap',
  },
};
