// Sons fabriqués dans le code (aucun fichier, aucun droit d'auteur).
let ac = null, master = null, noiseBuf = null;
export let muted = false;
try { muted = localStorage.getItem('gdg_muet') === '1'; } catch {}

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('gdg_muet', m ? '1' : '0'); } catch {}
  if (master) master.gain.value = m ? 0 : 0.7;
}

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function noise(t, dur, freq, q, peak) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); env(g, t, 0.005, peak, dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  return f;
}

// Prout : un son grave qui « vibre » (la vibration fait tout le travail)
function fart(t, dur, f0, f1, peak, wobble = 28) {
  const o = ac.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = ac.createGain(); env(g, t, 0.01, peak, dur);
  const trem = ac.createGain(); trem.gain.value = 0.5;
  const lfo = ac.createOscillator(); lfo.frequency.value = wobble;
  const lfoG = ac.createGain(); lfoG.gain.value = 0.5;
  lfo.connect(lfoG); lfoG.connect(trem.gain);
  o.connect(lp); lp.connect(trem); trem.connect(g); g.connect(master);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

let lastShot = 0;
export const sfx = {
  shoot() {
    if (!ac || muted) return;
    const t = ac.currentTime;
    if (t - lastShot < 0.11) return;
    lastShot = t;
    noise(t, 0.05, 1400 + Math.random() * 400, 3, 0.05);
  },
  pop() { // ennemi qui se dégonfle
    if (!ac || muted) return;
    const t = ac.currentTime;
    fart(t, 0.35, 260 + Math.random() * 120, 70, 0.22, 30 + Math.random() * 15);
  },
  bonk() { // tir qui touche un caillou ou le croiseur
    if (!ac || muted) return;
    noise(ac.currentTime, 0.04, 500, 4, 0.08);
  },
  burp() { // Lucas touché : un gros rot
    if (!ac || muted) return;
    const t = ac.currentTime;
    fart(t, 0.55, 110, 60, 0.35, 14);
    noise(t, 0.4, 300, 2, 0.12);
  },
  pickup() {
    if (!ac || muted) return;
    const t = ac.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ac.createGain(); env(g, t + i * 0.06, 0.01, 0.15, 0.15);
      o.connect(g); g.connect(master); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.2);
    });
  },
  big() { // gros prout : croiseur dégonflé
    if (!ac || muted) return;
    const t = ac.currentTime;
    fart(t, 1.4, 180, 40, 0.4, 22);
    noise(t, 1.0, 250, 1.5, 0.15);
  },
  bip() { // R2-WC
    if (!ac || muted) return;
    const t = ac.currentTime;
    [1200, 1700, 1000, 1900].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = ac.createGain(); env(g, t + i * 0.07, 0.005, 0.05, 0.06);
      o.connect(g); g.connect(master); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.08);
    });
    fart(t + 0.32, 0.25, 200, 90, 0.15);
  },
};
