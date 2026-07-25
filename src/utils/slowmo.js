// ── Sinematik yavaş-çekim (slow-motion) controller ──────────────────────────
// Projenin modül-singleton desenine uygun (horseRef / obstacleRegistry gibi).
// GERÇEK zamanla ilerler (r3f delta) ve bir "timeScale" üretir. Oyun/dünya
// güncellemeleri bu timeScale ile çarpılır; HUD (DOM) ve parçacıklar DIŞARIDA
// tutulur (onlar gerçek zamanla akar).
//
// Zaman çizelgesi (istenen davranış):
//   çarpışma → ~300ms içinde %15'e düş (ease-out)
//            → ~1.2s öyle kal
//            → ~450ms içinde normale dön (ease-in)

const TARGET   = 0.15;   // hedef time scale (%15)
const IN_DUR   = 0.30;   // düşüş süresi (sn)
const HOLD_DUR = 1.20;   // tutma süresi (sn)
const OUT_DUR  = 0.45;   // dönüş süresi (sn)

const s = {
  active: false,
  phase: 'idle',   // 'in' | 'hold' | 'out'
  t: 0,
  timeScale: 1,
  intensity: 0,    // 0..1 — kamera zoom/shake ve desatürasyon için (1 = tam slow-mo)
};

// çarpışma anında çağrılır — yeniden tetiklenirse baştan başlar (art arda çarpma)
export function triggerSlowmo() {
  s.active = true;
  s.phase = 'in';
  s.t = 0;
}

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic  = (x) => x * x * x;

// GERÇEK (ölçeklenmemiş) delta ile her karede TAM BİR KEZ çağrılır → timeScale döner
export function updateSlowmo(realDt) {
  if (!s.active) { s.timeScale = 1; s.intensity = 0; return 1; }
  s.t += realDt;
  if (s.phase === 'in') {
    const k = Math.min(1, s.t / IN_DUR);
    s.intensity = easeOutCubic(k);           // hızlı, yumuşak düşüş
    if (k >= 1) { s.phase = 'hold'; s.t = 0; }
  } else if (s.phase === 'hold') {
    s.intensity = 1;
    if (s.t >= HOLD_DUR) { s.phase = 'out'; s.t = 0; }
  } else { // out
    const k = Math.min(1, s.t / OUT_DUR);
    s.intensity = 1 - easeInCubic(k);        // yumuşak dönüş
    if (k >= 1) { s.active = false; s.phase = 'idle'; s.intensity = 0; }
  }
  // timeScale = 1 (normal) .. TARGET (tam slow-mo)
  s.timeScale = 1 - (1 - TARGET) * s.intensity;
  return s.timeScale;
}

export function getTimeScale()       { return s.timeScale; }
export function getSlowmoIntensity() { return s.intensity; }
export function isSlowmoActive()     { return s.active; }

// koşu sıfırlanınca temizle (game over / yeni koşu)
export function resetSlowmo() {
  s.active = false; s.phase = 'idle'; s.t = 0; s.timeScale = 1; s.intensity = 0;
}
