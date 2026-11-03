/*
 * Siatka Powiązań — dźwięk (Web Audio, bez plików).
 * Efekty: pinezka, szuranie sznurka, cięcie, papier, maszyna, pieczątka, dzwonek wygranej.
 * Muzyka: generowany na żywo wolny jazz noir w d-moll (pad, kontrabas, miotełki, sordyna z echem, trzask płyty).
 * API: SiatkaAudio.unlock(), .sfx(nazwa, arg), .setSfx(bool), .setMusic(bool), .pref
 */
(() => {
const KEY = "siatka-audio";
const pref = (() => { try { return Object.assign({ sfx: true, music: false }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { return { sfx: true, music: false }; } })();
const savePref = () => { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (_) {} };

let ctx = null, sfxBus, musBus, noiseBuf, echoIn;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    const master = ctx.createGain(); master.gain.value = 0.9;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.75;
    musBus = ctx.createGain(); musBus.gain.value = 0;
    sfxBus.connect(comp); musBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // echo dla melodii
    echoIn = ctx.createGain();
    const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = 0.42; fb.gain.value = 0.32; lp.type = "lowpass"; lp.frequency.value = 1800;
    echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musBus);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/* ---------- klocki ---------- */
function tone(type, f, t, dur, gain, dest, o = {}) {
  const os = ctx.createOscillator(), g = ctx.createGain();
  os.type = type; os.frequency.setValueAtTime(f, t);
  if (o.fEnd) os.frequency.exponentialRampToValueAtTime(o.fEnd, t + (o.fDur || dur));
  if (o.detune) os.detune.value = o.detune;
  const a = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + a);
  if (o.hold) g.gain.setValueAtTime(gain, t + a + o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = g;
  if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = o.lp; g.connect(f2); out = f2; }
  os.connect(g); out.connect(dest);
  if (o.send) out.connect(o.send);
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + 0.25); l.connect(lg); lg.connect(os.detune); l.start(t); l.stop(t + dur + 0.05); }
  os.start(t); os.stop(t + dur + 0.05);
}
function noise(t, dur, gain, dest, type, freq, o = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = o.rate || 1;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = o.Q ?? 1;
  if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
  const a = o.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}

/* ---------- efekty ---------- */
const SFX = {
  pin(t) { noise(t, 0.03, 0.1, sfxBus, "bandpass", 2600, { Q: 2 }); tone("sine", 230, t, 0.06, 0.1, sfxBus, { fEnd: 110 }); },
  tick(t) { noise(t, 0.012, 0.045, sfxBus, "highpass", 4500); },
  /* szuranie sznurka po korku w trakcie przeciągania; v = 0..1 (szybkość palca) */
  rub(t, v = 0.5) { noise(t, rnd(0.04, 0.07), 0.012 + 0.03 * v, sfxBus, "bandpass", rnd(1700, 2700), { Q: 0.9, attack: 0.012 }); },
  /* sznurek zaczepiony o pinezkę: krótkie, miękkie szurnięcie + ciche stuknięcie */
  attach(t) {
    noise(t, 0.12, 0.06, sfxBus, "bandpass", 2600, { Q: 1, fEnd: 1300, attack: 0.008 });
    tone("sine", 320, t + 0.02, 0.05, 0.035, sfxBus, { fEnd: 190 });
  },
  snip(t) { noise(t, 0.02, 0.28, sfxBus, "highpass", 5200); noise(t + 0.055, 0.025, 0.24, sfxBus, "highpass", 4600); tone("triangle", 1900, t, 0.06, 0.05, sfxBus, { fEnd: 900 }); },
  paper(t) { noise(t, 0.2, 0.1, sfxBus, "bandpass", 900, { Q: 0.7, fEnd: 3800, attack: 0.04 }); },
  type(t) { noise(t, 0.025, 0.22, sfxBus, "bandpass", 1900, { Q: 1.2 }); tone("square", 95, t, 0.03, 0.04, sfxBus, { lp: 900 }); },
  page(t) { [0, 0.07, 0.15].forEach((d, i) => SFX.type(t + d + i * rnd(0, 0.02))); },
  out(t) { tone("sine", 170, t, 0.14, 0.4, sfxBus, { fEnd: 70 }); noise(t, 0.07, 0.25, sfxBus, "lowpass", 900); },
  nope(t) { tone("square", 140, t, 0.07, 0.07, sfxBus, { lp: 700 }); tone("square", 132, t + 0.09, 0.08, 0.07, sfxBus, { lp: 700 }); },
  hint(t) { tone("sine", mtof(69), t, 0.9, 0.12, sfxBus, { attack: 0.01 }); tone("sine", mtof(74), t + 0.12, 1.2, 0.1, sfxBus, { attack: 0.01 }); },
  stamp(t) { tone("sine", 120, t, 0.3, 0.6, sfxBus, { fEnd: 42 }); noise(t, 0.14, 0.4, sfxBus, "lowpass", 500); tone("triangle", 98, t + 0.05, 0.6, 0.07, sfxBus); tone("triangle", 104, t + 0.05, 0.6, 0.07, sfxBus); },
  win(t) {
    tone("sine", 1760, t, 1.6, 0.16, sfxBus); tone("sine", 1760 * 2.76, t, 0.6, 0.04, sfxBus); // dzwonek maszyny
    [62, 65, 69, 72, 76].forEach((m, i) => tone("triangle", mtof(m), t + 0.25 + i * 0.09, 2.2 - i * 0.2, 0.07, sfxBus, { attack: 0.01, lp: 2400 }));
  },
  /* osiągnięcie: mosiężna fanfara w D-dur + iskry; tier 1–3 dokłada coraz wyższe dzwoneczki */
  medal(t, tier = 1) {
    [[62, 0], [66, 0.1], [69, 0.2], [74, 0.34]].forEach(([m, d], i) => {
      const len = i === 3 ? 1.5 : 0.32;
      tone("sawtooth", mtof(m), t + d, len, 0.045, sfxBus, { attack: 0.025, lp: 1700, vib: i === 3 ? 7 : 0 });
      tone("triangle", mtof(m - 12), t + d, len, 0.08, sfxBus, { attack: 0.01 });
    });
    noise(t + 0.34, 0.9, 0.05, sfxBus, "highpass", 6500, { attack: 0.02 }); // talerz
    const bells = [86, 90, 93, 98, 102].slice(0, 2 + tier);
    bells.forEach((m, i) => tone("sine", mtof(m), t + 0.5 + i * 0.07, 0.6, 0.04, sfxBus));
  },
  lose(t) { [62, 60, 58, 57].forEach((m, i) => tone("triangle", mtof(m - 12), t + i * 0.28, 1.1, 0.12, sfxBus, { lp: 900, attack: 0.02 })); }
};
function sfx(name, arg) {
  if (!pref.sfx || !SFX[name] || !ensure()) return;
  try { SFX[name](ctx.currentTime + 0.005, arg); } catch (_) {}
}

/* ---------- muzyka ---------- */
const BEAT = 60 / 62;
const PROG = [ // bas, akord (MIDI); każdy akord trwa 2 takty
  { bass: 38, chord: [53, 57, 60, 64] }, // Dm9
  { bass: 46, chord: [53, 57, 62, 65] }, // B♭maj7
  { bass: 43, chord: [53, 58, 62, 69] }, // Gm9
  { bass: 45, chord: [55, 61, 64, 70] }  // A7♭9
];
const BLUES = [62, 65, 67, 68, 69, 72, 74, 77];
const M = { timer: null, next: 0, step: 0, mel: 3, vinyl: null };

function scheduleBeat(step, t) {
  const bar = Math.floor(step / 4), beat = step % 4, ch = PROG[Math.floor(bar / 2) % PROG.length], first = bar % 2 === 0;
  if (first && beat === 0) ch.chord.forEach((m, i) => tone("triangle", mtof(m), t, BEAT * 8 + 1.6, 0.03, musBus, { attack: 1.1, hold: BEAT * 8 - 1.2, lp: 1000, detune: i % 2 ? 5 : -5 }));
  // kontrabas
  const nextRoot = PROG[Math.floor((bar + 1) / 2) % PROG.length].bass;
  let b = null;
  if (beat === 0) b = ch.bass;
  else if (beat === 2) b = Math.random() < 0.65 ? ch.bass + 7 : ch.bass + 12;
  else if (beat === 3 && !first && Math.random() < 0.5) b = nextRoot + (Math.random() < 0.5 ? 1 : -1);
  if (b !== null) { tone("sine", mtof(b), t, BEAT * 1.2, 0.2, musBus, { attack: 0.01 }); tone("triangle", mtof(b), t, 0.25, 0.06, musBus, { lp: 500 }); }
  // miotełki i talerz z „swingiem”
  noise(t, 0.2, beat % 2 ? 0.035 : 0.02, musBus, "bandpass", 3000, { Q: 0.5, attack: 0.03 });
  if (Math.random() < 0.65) noise(t + BEAT * 2 / 3, 0.09, 0.012, musBus, "highpass", 7000);
  // sordyna: rzadkie frazy, raczej w drugim takcie akordu
  if (Math.random() < (first ? 0.15 : 0.38)) {
    M.mel = Math.max(0, Math.min(BLUES.length - 1, M.mel + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    const swing = Math.random() < 0.5 ? 0 : BEAT * 2 / 3, len = BEAT * rnd(0.7, 1.8);
    tone("sine", mtof(BLUES[M.mel]), t + swing, len, 0.045, musBus, { attack: 0.06, vib: 9, send: echoIn });
    tone("triangle", mtof(BLUES[M.mel]), t + swing, len, 0.012, musBus, { attack: 0.06, lp: 1400 });
  }
}
function vinylStart() {
  const sr = ctx.sampleRate, len = sr * 4, b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.015 + (Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.6 : 0);
  const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; s.loop = true; lp.type = "lowpass"; lp.frequency.value = 3500; g.gain.value = 0.5;
  s.connect(lp); lp.connect(g); g.connect(musBus); s.start();
  M.vinyl = s;
}
function musicOn() {
  if (M.timer || !ensure()) return;
  M.next = ctx.currentTime + 0.1; M.step = 0;
  vinylStart();
  musBus.gain.cancelScheduledValues(ctx.currentTime);
  musBus.gain.setValueAtTime(musBus.gain.value, ctx.currentTime);
  musBus.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2);
  M.timer = setInterval(() => {
    while (M.next < ctx.currentTime + 0.3) { scheduleBeat(M.step, M.next); M.next += BEAT; M.step++; }
  }, 60);
}
function musicOff() {
  if (!M.timer) return;
  clearInterval(M.timer); M.timer = null;
  const now = ctx.currentTime;
  musBus.gain.cancelScheduledValues(now); musBus.gain.setValueAtTime(musBus.gain.value, now); musBus.gain.linearRampToValueAtTime(0, now + 0.8);
  const v = M.vinyl; M.vinyl = null; if (v) v.stop(now + 0.9);
}

/* ---------- start po pierwszym dotknięciu, pauza w tle ---------- */
let unlocked = false;
function unlock() {
  if (!ensure()) return;
  if (!unlocked) { unlocked = true; if (pref.music) musicOn(); }
}
["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume();
});

window.SiatkaAudio = {
  pref, unlock, sfx,
  setSfx(on) { pref.sfx = !!on; savePref(); },
  setMusic(on) { pref.music = !!on; savePref(); if (on) { unlocked = true; musicOn(); } else musicOff(); }
};
})();
