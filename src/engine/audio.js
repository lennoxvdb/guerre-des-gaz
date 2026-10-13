// Sons et musiques fabriqués dans le code (aucun fichier, aucun droit d'auteur).
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
export let muted = false;
try { muted = localStorage.getItem('gdg_muet') === '1'; } catch { /* rien */ }

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingSong) playMusic(pendingSong);
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('gdg_muet', m ? '1' : '0'); } catch { /* rien */ }
  if (master) master.gain.value = m ? 0 : 0.8;
}

const now = () => ac.currentTime;
function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function noise(t, dur, freq, q, peak, type = 'bandpass', bus = sfxBus, f1 = 0) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); env(g, t, 0.005, peak, dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function tone(t, dur, f0, f1, peak, type = 'square', bus = sfxBus, a = 0.005, lp = 0) {
  const o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); env(g, t, a, peak, dur);
  if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}
// prout ou rot : un son grave qui vibre
function fart(t, dur, f0, f1, peak, wobble = 28) {
  const o = ac.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = ac.createGain(); env(g, t, 0.01, peak, dur);
  const trem = ac.createGain(); trem.gain.value = 0.5;
  const lfo = ac.createOscillator(); lfo.frequency.value = wobble;
  const lfoG = ac.createGain(); lfoG.gain.value = 0.5;
  lfo.connect(lfoG); lfoG.connect(trem.gain);
  o.connect(lp); lp.connect(trem); trem.connect(g); g.connect(sfxBus);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

const last = {};
const ok = (n, gap) => {
  if (!ac || muted) return false;
  const t = now();
  if (last[n] && t - last[n] < gap) return false;
  last[n] = t; return true;
};

export const sfx = {
  swing(k = 1) { // « vvwoomm » du sabre
    if (!ok('swing', 0.06)) return;
    const t = now();
    noise(t, 0.28, 400 * k, 2, 0.22, 'bandpass', sfxBus, 2200 * k);
    tone(t, 0.28, 140 * k, 220 * k, 0.12, 'sawtooth', sfxBus, 0.02, 900);
  },
  ignite() {
    if (!ok('ignite', 0.3)) return;
    const t = now();
    tone(t, 0.5, 70, 240, 0.18, 'sawtooth', sfxBus, 0.02, 1200);
    noise(t, 0.4, 300, 2, 0.1, 'bandpass', sfxBus, 3000);
  },
  clash() { // les lames se croisent : CLANG
    if (!ok('clash', 0.05)) return;
    const t = now();
    for (const f of [523, 1187, 1801, 2650]) tone(t, 0.35, f, f * 0.98, 0.07, 'square', sfxBus, 0.002, 6000);
    noise(t, 0.12, 3000, 1, 0.25);
  },
  ping() { // tir renvoyé
    if (!ok('ping', 0.04)) return;
    const t = now();
    tone(t, 0.18, 1400, 2600, 0.12, 'triangle');
    tone(t, 0.12, 700, 1300, 0.06, 'square', sfxBus, 0.002, 4000);
  },
  pew() { // tir des soldats (pistolet à bulles)
    if (!ok('pew', 0.05)) return;
    const t = now();
    tone(t, 0.18, 900, 300, 0.08, 'square', sfxBus, 0.002, 3000);
  },
  laser() { // tir du chasseur-WC
    if (!ok('laser', 0.07)) return;
    const t = now();
    tone(t, 0.08, 1600, 600, 0.04, 'square', sfxBus, 0.002, 4000);
  },
  hit() { // un ennemi touché : PAF
    if (!ok('hit', 0.03)) return;
    const t = now();
    noise(t, 0.12, 900, 1.5, 0.3);
    tone(t, 0.1, 220, 90, 0.18, 'triangle');
  },
  deflate() { // il se dégonfle en partant : pfffiouuu
    if (!ok('deflate', 0.05)) return;
    const t = now();
    fart(t, 0.6, 320 + Math.random() * 120, 90, 0.2, 30 + Math.random() * 15);
    tone(t, 0.6, 900, 1900, 0.04, 'sine');
  },
  pop() { // la bulle éclate : BLOP
    if (!ok('pop', 0.04)) return;
    const t = now();
    tone(t, 0.08, 300, 900, 0.2, 'sine');
    noise(t, 0.06, 2000, 2, 0.12);
  },
  hurt() { // Lucas touché : un rot
    if (!ok('hurt', 0.2)) return;
    const t = now();
    fart(t, 0.45, 120, 60, 0.32, 14);
  },
  burp() { // le gros rot de Dark Roteur
    if (!ok('burp', 0.3)) return;
    const t = now();
    fart(t, 1.1, 95, 45, 0.5, 11);
    noise(t, 0.9, 280, 2, 0.15);
  },
  mega() { // le Méga-Prout
    if (!ok('mega', 0.3)) return;
    const t = now();
    fart(t, 1.4, 200, 40, 0.5, 22);
    noise(t, 1.2, 250, 1.2, 0.2);
    tone(t, 1.2, 60, 30, 0.3, 'sine');
  },
  boom() { // gros dégonflage (vaisseau, croiseur)
    if (!ok('boom', 0.08)) return;
    const t = now();
    noise(t, 0.7, 500, 0.8, 0.4, 'lowpass', sfxBus, 80);
    tone(t, 0.6, 120, 35, 0.35, 'sine');
  },
  suck() { // la ventouse aspire
    if (!ok('suck', 0.2)) return;
    const t = now();
    noise(t, 0.3, 2400, 2, 0.12, 'bandpass', sfxBus, 400);
  },
  jump() { // propulsé par un prout
    if (!ok('jump', 0.2)) return;
    const t = now();
    fart(t, 0.35, 260, 120, 0.3, 32);
    noise(t, 0.4, 500, 1.5, 0.15, 'bandpass', sfxBus, 2500);
  },
  land() {
    if (!ok('land', 0.2)) return;
    const t = now();
    tone(t, 0.25, 130, 45, 0.4, 'sine');
    noise(t, 0.25, 400, 1, 0.2, 'lowpass', sfxBus, 100);
  },
  pickup() {
    if (!ok('pickup', 0.05)) return;
    const t = now();
    [784, 988, 1319].forEach((f, i) => tone(t + i * 0.05, 0.12, f, f, 0.1, 'triangle'));
  },
  heal() {
    if (!ok('heal', 0.1)) return;
    const t = now();
    [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.06, 0.16, f, f, 0.1, 'triangle'));
  },
  alarm() {
    if (!ok('alarm', 0.5)) return;
    const t = now();
    for (let i = 0; i < 3; i++) { tone(t + i * 0.5, 0.22, 660, 660, 0.1, 'square', sfxBus, 0.01, 2500); tone(t + i * 0.5 + 0.25, 0.22, 440, 440, 0.1, 'square', sfxBus, 0.01, 2500); }
  },
  whoosh() { // un vaisseau passe au-dessus
    if (!ok('whoosh', 0.4)) return;
    const t = now();
    noise(t, 1.2, 200, 1, 0.22, 'bandpass', sfxBus, 1600);
  },
  takeoff() {
    if (!ok('takeoff', 1)) return;
    const t = now();
    noise(t, 2.2, 150, 0.8, 0.3, 'bandpass', sfxBus, 1800);
    fart(t, 1.8, 90, 220, 0.3, 26);
  },
  bip() { // R2-WC
    if (!ok('bip', 0.4)) return;
    const t = now();
    [1200, 1700, 1000, 1900].forEach((f, i) => tone(t + i * 0.07, 0.06, f, f, 0.05, 'square'));
  },
  win() {
    if (!ok('win', 1)) return;
    const t = now();
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.12, 0.25, f, f, 0.12, 'square', sfxBus, 0.005, 3000));
  },
  click() { if (ok('click', 0.05)) tone(now(), 0.05, 900, 1200, 0.06, 'triangle'); },
};

// ---------- musique : petites boucles originales ----------
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// accords : [basse, notes de l'arpège]
const C = [48, [60, 64, 67, 72]], Am = [45, [57, 60, 64, 69]], F = [41, [53, 57, 60, 65]], G = [43, [55, 59, 62, 67]];
const Dm = [38, [50, 53, 57, 62]], E = [40, [52, 56, 59, 64]], Bb = [46, [58, 62, 65, 70]], Em = [40, [52, 55, 59, 64]];
const SONGS = {
  menu: { bpm: 96, chords: [C, Am, F, G], arp: [0, 2, 1, 2, 0, 2, 1, 3], drums: 'soft' },
  foot: { bpm: 128, chords: [Am, F, C, G], arp: [0, 1, 2, 1, 3, 2, 1, 2], drums: 'rock' },
  flight: { bpm: 140, chords: [C, G, Am, F], arp: [0, 2, 3, 2, 1, 2, 3, 1], drums: 'fast' },
  boss: { bpm: 146, chords: [Am, F, Dm, E], arp: [0, 3, 1, 3, 2, 3, 1, 3], drums: 'fast' },
  duel: { bpm: 120, chords: [Dm, Bb, F, E], arp: [0, 1, 2, 3, 2, 1, 2, 1], drums: 'duel' },
  win: { bpm: 112, chords: [C, F, G, C], arp: [0, 1, 2, 3, 3, 2, 1, 0], drums: 'soft' },
};
let song = null, pendingSong = null;
export function playMusic(name) {
  pendingSong = name;
  if (!ac) return;
  if (song && song.name === name) return;
  song = name ? { name, def: SONGS[name], step: 0, next: now() + 0.08 } : null;
}
function kick(t) { tone(t, 0.14, 150, 45, 0.5, 'sine', musicBus); }
function snare(t) { noise(t, 0.12, 1800, 0.8, 0.22, 'bandpass', musicBus); tone(t, 0.06, 200, 160, 0.1, 'triangle', musicBus); }
function hat(t, v = 0.05) { noise(t, 0.035, 8000, 0.7, v, 'highpass', musicBus); }
function playStep(s, t) {
  const d = s.def, step = s.step % 16, bar = Math.floor(s.step / 16) % d.chords.length;
  const [bass, notes] = d.chords[bar];
  const sd = 60 / d.bpm / 4;
  // basse qui rebondit
  if (step % 2 === 0) tone(t, sd * 1.6, mtof(bass + (step % 4 === 2 ? 12 : 0)), mtof(bass + (step % 4 === 2 ? 12 : 0)), 0.14, 'square', musicBus, 0.005, 700);
  // arpège
  const n = notes[d.arp[step % 8]];
  if (d.drums !== 'duel' || step % 2 === 0) tone(t, sd * 0.9, mtof(n + 12), mtof(n + 12), 0.045, 'square', musicBus, 0.004, 2600);
  // batterie
  const dr = d.drums;
  if (dr === 'soft') { if (step === 0 || step === 8) kick(t); if (step % 4 === 2) hat(t, 0.03); }
  if (dr === 'rock') { if (step === 0 || step === 6 || step === 8) kick(t); if (step === 4 || step === 12) snare(t); if (step % 2 === 0) hat(t); }
  if (dr === 'fast') { if (step % 4 === 0) kick(t); if (step === 4 || step === 12) snare(t); hat(t, step % 2 ? 0.03 : 0.05); }
  if (dr === 'duel') { if (step === 0 || step === 10) kick(t); if (step === 4 || step === 12) snare(t); if (step % 4 === 2) hat(t); }
}
setInterval(() => {
  if (!ac || !song) return;
  while (song.next < now() + 0.15) {
    playStep(song, song.next);
    song.next += 60 / song.def.bpm / 4;
    song.step++;
  }
}, 30);
