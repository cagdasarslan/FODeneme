// Hafif prosedürel ses (Web Audio API) — ses dosyası gerektirmez.
// İki kategori: "oyun sesleri" (SFX + nal sesi) ve "harita müziği".
// Her ikisi de ayarlardan ayrı ayrı açılıp kapatılabilir.

let ctx = null;
let sfxEnabled   = (typeof localStorage !== 'undefined') ? localStorage.getItem('soundOn')  !== '0' : true;
let musicEnabled = (typeof localStorage !== 'undefined') ? localStorage.getItem('musicOn')  !== '0' : true;

export function setSfxEnabled(on)   { sfxEnabled = on; if (!on) stopGallop(); }
export function setMusicEnabled(on) { musicEnabled = on; if (!on) stopMusic(); }
export function isSfxEnabled()   { return sfxEnabled; }
export function isMusicEnabled() { return musicEnabled; }

function ctxOrNull() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function acSfx()   { return sfxEnabled   ? ctxOrNull() : null; }
function acMusic() { return musicEnabled ? ctxOrNull() : null; }

// ── Tek atımlık efektler (oyun sesleri) ───────────────────────────────────────
function tone(freq, dur, { type = 'sine', gain = 0.18, slideTo = null, ctxIn = null } = {}) {
  const c = ctxIn || acSfx();
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
  osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
}
function noise(dur = 0.25, gain = 0.25) {
  const c = acSfx();
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
  src.onended = () => { try { src.disconnect(); lp.disconnect(); g.disconnect(); } catch (e) {} };
}

let lastCollect = 0;
export const sfx = {
  // havuçlar çok sık toplanabildiği için kıs (düğüm birikmesini önler)
  collect: () => {
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (now - lastCollect < 70) return;
    lastCollect = now;
    tone(880, 0.10, { type: 'triangle', gain: 0.15, slideTo: 1320 });
  },
  jump:    () => tone(330, 0.18, { type: 'sine', gain: 0.16, slideTo: 720 }),
  crash:   () => { noise(0.3, 0.3); tone(140, 0.3, { type: 'sawtooth', gain: 0.18, slideTo: 60 }); },
  click:   () => tone(440, 0.05, { type: 'square', gain: 0.10 }),
  powerup: () => { tone(523, 0.1, { type:'triangle', gain:0.14 }); setTimeout(()=>tone(784,0.14,{type:'triangle',gain:0.14}),90); },
};

// ── Nal sesi (dıgıdık dıgıdık) — oyun sesi, hıza göre tempo ───────────────────
let gallopRunning = false;
let gallopTimer = null;
let _speed = 14;

export function setGallopSpeed(s) { _speed = s; }

function clop(delay = 0) {
  const c = acSfx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, t0);
  osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.05);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + 0.12);
  osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
}

export function startGallop() {
  if (gallopRunning) return;
  gallopRunning = true;
  const loop = () => {
    if (!gallopRunning) return;
    if (sfxEnabled) { clop(0); clop(0.11); } // çift vuruş: dı-gı-dık
    // hız arttıkça tempo hızlanır
    const interval = Math.max(240, 680 - _speed * 7);
    gallopTimer = setTimeout(loop, interval);
  };
  loop();
}
export function stopGallop() {
  gallopRunning = false;
  if (gallopTimer) { clearTimeout(gallopTimer); gallopTimer = null; }
}

// ── Harita müziği (her haritaya özgü prosedürel döngü) ────────────────────────
// mapId: 1 çiftlik, 2 şehir, 3 çöl, 4 uzay, 5 ortaçağ
const N = (n) => 440 * Math.pow(2, (n - 9) / 12); // MIDI-ish nota → frekans
const MUSIC = {
  1: { tempo: 420, type: 'triangle', gain: 0.05, notes: [60,64,67,72,67,64, 62,65,69,65, 60,64,67,64] },
  2: { tempo: 300, type: 'square',   gain: 0.035, notes: [57,60,64,60,62,65,62,59, 57,60,64,67] },
  3: { tempo: 460, type: 'sawtooth', gain: 0.035, notes: [62,63,66,68,66,63, 61,63,66,63, 62,65,63] },
  4: { tempo: 1300,type: 'sine',     gain: 0.05, notes: [55,62,67,69, 60,64,71,67] }, // uzay: yavaş pad
  5: { tempo: 480, type: 'triangle', gain: 0.045, notes: [57,60,62,64,62,60, 55,59,62,59, 57,60,64,62] },
};

let musicTimer = null;
let musicStep = 0;
let musicMap = 0;

export function startMusic(mapId) {
  const cfg = MUSIC[mapId] || MUSIC[1];
  if (musicMap === mapId && musicTimer) return; // zaten çalıyor
  stopMusic();
  musicMap = mapId;
  musicStep = 0;
  const playStep = () => {
    const c = acMusic();
    if (c) {
      const midi = cfg.notes[musicStep % cfg.notes.length];
      const dur = (cfg.tempo / 1000) * 0.9;
      tone(N(midi), dur, { type: cfg.type, gain: cfg.gain, ctxIn: c });
      // her 4 notada bir bas
      if (musicStep % 4 === 0) tone(N(cfg.notes[0] - 12), dur * 1.4, { type: 'sine', gain: cfg.gain * 0.8, ctxIn: c });
    }
    musicStep++;
  };
  playStep();
  musicTimer = setInterval(playStep, cfg.tempo);
}
export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  musicMap = 0;
}
