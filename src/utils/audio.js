// Hafif prosedürel ses efektleri (Web Audio API) — ses dosyası gerektirmez.
// Ayarlardan açıp kapatılabilir; kapalıyken hiç ses üretmez.

let ctx = null;
let enabled = (typeof localStorage !== 'undefined') ? localStorage.getItem('soundOn') !== '0' : true;

export function setSoundEnabled(on) { enabled = on; }
export function isSoundEnabled() { return enabled; }

function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Tek ton (zarf ile)
function tone(freq, dur, { type = 'sine', gain = 0.18, slideTo = null } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// Kısa gürültü patlaması (çarpışma için)
function noise(dur = 0.25, gain = 0.25) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  src.connect(lp); lp.connect(g); g.connect(c.destination);
  src.start(t0);
}

export const sfx = {
  collect: () => tone(880, 0.10, { type: 'triangle', gain: 0.15, slideTo: 1320 }),
  coinBig: () => { tone(660, 0.08, { type: 'square', gain: 0.12 }); setTimeout(() => tone(990, 0.12, { type: 'square', gain: 0.12 }), 70); },
  jump:    () => tone(330, 0.18, { type: 'sine', gain: 0.16, slideTo: 720 }),
  crash:   () => { noise(0.3, 0.3); tone(140, 0.3, { type: 'sawtooth', gain: 0.18, slideTo: 60 }); },
  click:   () => tone(440, 0.05, { type: 'square', gain: 0.10 }),
  powerup: () => { tone(523, 0.1, { type:'triangle', gain:0.14 }); setTimeout(()=>tone(784,0.14,{type:'triangle',gain:0.14}),90); },
};
