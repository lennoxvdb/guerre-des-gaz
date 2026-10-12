// La Guerre des Gaz : prototype de la bataille spatiale.
import { unlock, sfx, muted, setMuted } from './audio.js';
import * as D from './draw.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 540;
let H = 960;
const FONT = (s, w = 900) => `${w} ${s}px "Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", sans-serif`;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- écran : largeur fixe, hauteur qui s'adapte au téléphone ----------
let scale = 1;
function resize() {
  const vw = innerWidth, vh = innerHeight;
  H = Math.round(clamp(W * vh / vw, 760, 1170));
  scale = Math.min(vw / W, vh / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = W * scale + 'px';
  cv.style.height = H * scale + 'px';
  cv.width = Math.round(W * scale * dpr);
  cv.height = Math.round(H * scale * dpr);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  if (player) { player.x = clamp(player.x, 30, W - 30); player.y = clamp(player.y, 90, H - 50); }
}
addEventListener('resize', resize);

// ---------- fond de l'espace : étoiles + nébuleuses vertes et violettes ----------
const TILE = 1200;
let seed = 7;
const srand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const stars = [0.25, 0.55, 1].map((depth, i) => Array.from({ length: [70, 40, 22][i] }, () => ({
  x: srand() * W, y: srand() * TILE, r: (0.6 + srand()) * depth * 1.6, depth,
})));
const neb = document.createElement('canvas');
neb.width = W; neb.height = TILE;
{
  const n = neb.getContext('2d');
  const cols = ['120,255,90', '170,80,255', '90,200,255', '200,90,220'];
  for (let i = 0; i < 9; i++) {
    const x = srand() * W, y = srand() * TILE, r = 140 + srand() * 220, c = cols[i % cols.length];
    for (const dy of [-TILE, 0, TILE]) {
      const g = n.createRadialGradient(x, y + dy, 0, x, y + dy, r);
      g.addColorStop(0, `rgba(${c},0.20)`); g.addColorStop(1, `rgba(${c},0)`);
      n.fillStyle = g; n.fillRect(0, 0, W, TILE);
    }
  }
}
let bgOff = 0;
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0820'); g.addColorStop(1, '#140a2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const ny = (bgOff * 0.15) % TILE;
  ctx.drawImage(neb, 0, ny - TILE); ctx.drawImage(neb, 0, ny);
  ctx.fillStyle = '#fff';
  for (const layer of stars) for (const s of layer) {
    const y = (s.y + bgOff * s.depth) % TILE;
    if (y > H + 4) continue;
    ctx.globalAlpha = 0.4 + s.depth * 0.6;
    ctx.fillRect(s.x, y, s.r, s.r * (1 + s.depth * 1.5));
  }
  ctx.globalAlpha = 1;
}

// ---------- état du jeu ----------
let state = 'title', stateT = 0, gameT = 0;
let player = null, shots = [], eshots = [], enemies = [], parts = [], pickups = [], texts = [];
let score = 0, wave = 0, waveQueue = [], waveWait = 0, banner = null, radio = null, shake = 0, newBest = false;
let best = 0;
try { best = Number(localStorage.getItem('gdg_record')) || 0; } catch {}

function say(who, text, color, dur = 3.6) { radio = { who, text, color, t: dur }; }
// qui parle à la radio : portrait + couleur du nom
const GAZOU = { p: 'gazou', c: '#4f9a2e' }, PQR = { p: 'pqr', c: '#d0588a' }, R2C = { p: 'r2wc', c: '#3f7fe0' },
  HAN = { p: 'hanpopo', c: '#b0602a' }, ROTEUR = { p: 'roteur', c: '#7b3fa0' };

function newGame() {
  player = { x: W / 2, y: H - 160, r: 15, lives: 3, inv: 1.5, fireT: 0, triple: 0, shield: 0, r2: 0, r2T: 0, tilt: 0, vx: 0 };
  shots = []; eshots = []; enemies = []; parts = []; pickups = []; texts = [];
  score = 0; wave = START_WAVE; waveQueue = []; waveWait = 0; gameT = 0; banner = null; shake = 0; newBest = false;
  say('Maître Gazou', '« Tirer tout seul, ton vaisseau fait. Bouger, toi tu dois. »', GAZOU, 4.5);
  startWave();
}

// ---------- vagues d'ennemis ----------
const diff = () => 1 + wave * 0.07;
// pour tester : ?vague=6 commence au croiseur
const START_WAVE = Math.max(0, (Number(new URLSearchParams(location.search).get('vague')) || 1) - 1);

function startWave() {
  const k = wave % 6, loop = Math.floor(wave / 6);
  banner = { text: k === 5 ? 'Attention : Croiseur-Ventouse !' : `Vague ${wave + 1}`, t: 2.2 };
  waveQueue = [];
  const add = (delay, fn) => waveQueue.push({ at: gameT + delay, fn });
  switch (k) {
    case 0:
      for (let i = 0; i < 5 + loop; i++) add(i * 0.4, () => fighter(W * (0.18 + 0.16 * (i % 5)), 'dive', { wob: 40 }));
      break;
    case 1:
      for (let i = 0; i < 5 + loop; i++) add(i * 0.75, rock);
      break;
    case 2:
      for (let i = 0; i < 7; i++) { const o = i - 3; add(Math.abs(o) * 0.25, () => fighter(W / 2 + o * 62, 'dive', { wob: 0 })); }
      break;
    case 3:
      for (let i = 0; i < 5; i++) add(i * 0.32, () => fighter(-40, 'swoop', { dir: 1, y0: 110 }));
      for (let i = 0; i < 5; i++) add(2.4 + i * 0.32, () => fighter(W + 40, 'swoop', { dir: -1, y0: 190 }));
      break;
    case 4:
      for (let i = 0; i < 3; i++) add(i * 0.5, () => fighter(W * (0.25 + 0.25 * i), 'hover', { ty: 170 + (i % 2) * 80 }));
      for (let i = 0; i < 3 + loop; i++) add(2 + i * 1.1, rock);
      break;
    case 5:
      add(0.8, cruiserBoss);
      say('P-QR', '« Oh non, un croiseur ! Nous sommes perdus, perdus, PERDUS ! »', PQR);
      add(4.2, () => say('Dark Roteur', '« BUUURP… Plus personne ne rira dans cette galaxie ! »', ROTEUR));
      break;
  }
}

function fighter(x, mode, opt = {}) {
  const d = diff();
  enemies.push({
    kind: 'fighter', mode, ...opt, x, y: mode === 'swoop' ? opt.y0 - 60 : -40, x0: x, r: 26,
    hp: Math.round(2 * d), t: 0, ph: rand(0, 6), rot: 0, flash: 0,
    fireT: rand(1.2, 2.8), score: mode === 'hover' ? 150 : 100,
  });
}

function rock() {
  const d = Math.min(diff(), 1.6);
  enemies.push({
    kind: 'rock', x: rand(40, W - 40), y: -50, vx: rand(-35, 35), vy: rand(110, 165) * d,
    r: 30, hp: 4, t: 0, rot: rand(0, 6), spin: rand(-2, 2), flash: 0, score: 50,
  });
}

function cruiserBoss() {
  const hp = Math.round(70 * diff());
  enemies.push({
    kind: 'cruiser', x: W / 2, y: -80, r: 80, hp, maxHp: hp, t: 0, rot: 0, flash: 0,
    fanT: 2.5, spawnT: 6, score: 1000, boss: true,
  });
}

// zone touchable de chaque ennemi
function hits(e, x, y, r) {
  if (e.kind === 'cruiser') {
    const dx = x - e.x, dy = y - e.y;
    if (Math.abs(dx) < 16 + r && dy > -240 - r && dy < -30) return true;
    return (dx / (68 + r)) ** 2 + ((dy - 12) / (46 + r)) ** 2 < 1;
  }
  return Math.hypot(x - e.x, y - e.y) < e.r + r;
}

function enemyShot(x, y, ang, speed) {
  eshots.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed });
}

function updateEnemy(e, dt) {
  e.t += dt;
  e.flash -= dt;
  if (e.dying !== undefined) {
    e.dying -= dt;
    e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.spin * dt;
    if (Math.random() < (e.boss ? 0.9 : 0.5)) puff(e.x, e.y, e.boss ? 'big' : 'trail');
    return e.dying > 0;
  }
  const d = diff();
  if (e.kind === 'fighter') {
    if (e.mode === 'dive') {
      e.y += 150 * Math.min(d, 1.5) * dt;
      e.x = e.x0 + e.wob * Math.sin(e.t * 2.5 + e.ph);
    } else if (e.mode === 'swoop') {
      const s = 240 * e.t;
      e.x = e.x0 + e.dir * s;
      e.y = e.y0 + 0.0011 * s * s;
      e.rot = -e.dir * Math.min(0.6, 0.0011 * 2 * s * 0.6);
    } else if (e.mode === 'hover') {
      if (e.t > 7.5) e.y += 230 * dt;
      else if (e.y < e.ty) e.y += 170 * dt;
      e.x += Math.sin(e.t * 1.3 + e.ph) * 60 * dt;
    }
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = rand(1.8, 3.2) / Math.sqrt(d) * (e.mode === 'hover' ? 0.6 : 1);
      if (e.y > 30 && e.y < H * 0.6 && (e.mode === 'hover' || Math.random() < 0.55)) {
        enemyShot(e.x, e.y + 20, Math.atan2(player.y - e.y, player.x - e.x), 200 + 25 * d);
      }
    }
  } else if (e.kind === 'rock') {
    e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.spin * dt;
    if (e.x < 30 || e.x > W - 30) e.vx *= -1;
  } else if (e.kind === 'cruiser') {
    if (e.y < 270) e.y += 90 * dt;
    else {
      e.x = W / 2 + (W / 2 - 90) * Math.sin((e.t - 3) * 0.55);
      e.fanT -= dt;
      if (e.fanT <= 0) {
        e.fanT = 2.2 / Math.sqrt(d);
        for (let i = -2; i <= 2; i++) enemyShot(e.x + i * 24, e.y + 50, Math.PI / 2 + i * 0.22, 210);
      }
      e.spawnT -= dt;
      if (e.spawnT <= 0) {
        e.spawnT = 6.5;
        for (const o of [-60, 60]) { fighter(e.x + o, 'dive', { wob: 30 }); enemies[enemies.length - 1].y = e.y; }
      }
    }
  }
  return e.y < H + 80 && e.x > -100 && e.x < W + 100;
}

function kill(e) {
  score += e.score;
  texts.push({ x: e.x, y: e.y, text: '+' + e.score, t: 0.9, color: '#eaffc0' });
  if (e.boss) {
    e.dying = 1.8; e.vx = 0; e.vy = 40; e.spin = rand(-1, 1) * 1.5;
    sfx.big(); shake = 0.8;
    for (let i = 0; i < 30; i++) puff(e.x + rand(-70, 70), e.y + rand(-220, 50), 'big');
    banner = { text: 'Croiseur dégonflé !', t: 2.2 };
    say('Han Popo', '« Pas mal, gamin ! Même mon Faucon Pétulant n\'aurait pas fait mieux. »', HAN);
    drop(e.x, e.y, true);
    for (const s of eshots) s.dead = true;
  } else {
    // l'ennemi se dégonfle comme un ballon et part en tourbillonnant
    e.dying = 0.7; const a = rand(0, Math.PI * 2);
    e.vx = Math.cos(a) * 280; e.vy = Math.sin(a) * 280 - 60; e.spin = rand(10, 16) * (Math.random() < 0.5 ? -1 : 1);
    sfx.pop();
    for (let i = 0; i < 6; i++) puff(e.x, e.y, 'pop');
    if (Math.random() < (e.kind === 'rock' ? 0.07 : 0.13)) drop(e.x, e.y);
  }
}

function drop(x, y, sure) {
  const kinds = ['triple', 'triple', 'shield', 'r2'];
  pickups.push({ x, y, kind: kinds[Math.floor(Math.random() * kinds.length)], t: 0 });
  if (sure) pickups.push({ x: x + 50, y, kind: 'r2', t: 0.5 });
}

// ---------- particules : petits nuages de gaz ----------
function puff(x, y, type) {
  if (parts.length > 400) parts.shift();
  const P = {
    pop: { c: ['#9be36b', '#c8f59a', '#b58bdc'], v: 120, r: [8, 16], life: 0.6 },
    trail: { c: ['#a8e57c', '#d8f5b8'], v: 30, r: [5, 10], life: 0.5 },
    big: { c: ['#9be36b', '#c38be8', '#e0d0f0', '#7fbf4d'], v: 160, r: [18, 36], life: 1.1 },
    hurt: { c: ['#c38be8', '#8a4fc0', '#f0d8ff'], v: 160, r: [10, 22], life: 0.8 },
    spark: { c: ['#eaffc0', '#ffffff'], v: 90, r: [3, 6], life: 0.25 },
    exhaust: { c: ['#8cff6a', '#d4ffb0'], v: 20, r: [4, 8], life: 0.35 },
  }[type];
  const a = rand(0, Math.PI * 2), v = rand(0.3, 1) * P.v;
  parts.push({
    x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + (type === 'exhaust' ? 160 : 0),
    r: rand(...P.r), c: P.c[Math.floor(Math.random() * P.c.length)], t: P.life, max: P.life,
  });
}

// ---------- Lucas touché ----------
function hurt() {
  if (player.inv > 0) return;
  if (player.shield > 0) {
    player.shield = 0; player.inv = 1; sfx.bonk();
    for (let i = 0; i < 10; i++) puff(player.x, player.y, 'pop');
    return;
  }
  player.lives--; player.inv = 2.2; shake = 0.45; sfx.burp();
  for (let i = 0; i < 14; i++) puff(player.x, player.y, 'hurt');
  for (const s of eshots) if (Math.hypot(s.x - player.x, s.y - player.y) < 220) s.dead = true;
  if (player.lives <= 0) {
    state = 'over'; stateT = 0;
    for (let i = 0; i < 30; i++) puff(player.x, player.y, 'big');
    if (score > best) { best = score; newBest = true; try { localStorage.setItem('gdg_record', String(best)); } catch {} }
  } else if (player.lives === 1) {
    say('Maître Gazou', '« Attention, jeune Lucas ! Le Gaz, sentir tu dois. »', GAZOU);
  }
}

// ---------- commandes : un seul doigt (ou la souris, ou les flèches) ----------
let drag = null;
const keys = new Set();
function toLocal(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}
cv.addEventListener('pointerdown', e => {
  unlock();
  if (state === 'title' || (state === 'over' && stateT > 1)) { newGame(); state = 'play'; stateT = 0; return; }
  if (state !== 'play') return;
  const p = toLocal(e);
  drag = { id: e.pointerId, fx: p.x, fy: p.y, sx: player.x, sy: player.y };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id || state !== 'play') return;
  const p = toLocal(e);
  // le vaisseau suit le doigt sans être caché dessous
  player.x = clamp(drag.sx + (p.x - drag.fx) * 1.2, 30, W - 30);
  player.y = clamp(drag.sy + (p.y - drag.fy) * 1.2, 90, H - 50);
});
const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
addEventListener('keydown', e => {
  keys.add(e.key);
  if ((e.key === ' ' || e.key === 'Enter') && (state === 'title' || (state === 'over' && stateT > 1))) {
    unlock(); newGame(); state = 'play'; stateT = 0;
  }
});
addEventListener('keyup', e => keys.delete(e.key));

const muteBtn = document.getElementById('mute');
const showMute = () => { muteBtn.textContent = muted ? '🔇' : '🔊'; };
muteBtn.addEventListener('click', () => { unlock(); setMuted(!muted); showMute(); });
showMute();

// ---------- mise à jour ----------
function update(dt) {
  stateT += dt;
  bgOff += dt * (state === 'play' ? 120 : 60);
  shake = Math.max(0, shake - dt);
  if (radio && (radio.t -= dt) <= 0) radio = null;
  if (banner && (banner.t -= dt) <= 0) banner = null;

  for (const p of parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
  parts = parts.filter(p => p.t > 0);
  for (const t of texts) { t.t -= dt; t.y -= 50 * dt; }
  texts = texts.filter(t => t.t > 0);
  if (state !== 'play') {
    if (state === 'over' && enemies) {
      for (const e of enemies) updateEnemy(e, dt * 0.3);
    }
    return;
  }
  gameT += dt;

  // Lucas
  const p = player;
  let kx = 0, ky = 0;
  if (keys.has('ArrowLeft') || keys.has('q') || keys.has('a')) kx--;
  if (keys.has('ArrowRight') || keys.has('d')) kx++;
  if (keys.has('ArrowUp') || keys.has('z') || keys.has('w')) ky--;
  if (keys.has('ArrowDown') || keys.has('s')) ky++;
  const px = p.x;
  p.x = clamp(p.x + kx * 480 * dt, 30, W - 30);
  p.y = clamp(p.y + ky * 480 * dt, 90, H - 50);
  p.vx = p.vx * 0.8 + ((p.x - px) / Math.max(dt, 0.001)) * 0.2;
  p.tilt = clamp(p.vx / 2500, -0.3, 0.3);
  p.inv -= dt; p.triple -= dt; p.shield -= dt; p.r2 -= dt;
  if (Math.random() < 0.6) puff(p.x + rand(-9, 9), p.y + 40, 'exhaust');

  // tir automatique
  p.fireT -= dt;
  if (p.fireT <= 0) {
    p.fireT = 0.13;
    shots.push({ x: p.x, y: p.y - 34, vx: 0, vy: -900 });
    if (p.triple > 0) {
      shots.push({ x: p.x - 12, y: p.y - 26, vx: -190, vy: -880 });
      shots.push({ x: p.x + 12, y: p.y - 26, vx: 190, vy: -880 });
    }
    sfx.shoot();
  }
  if (p.r2 > 0) {
    p.r2T -= dt;
    if (p.r2T <= 0) { p.r2T = 0.26; const r = r2Pos(); shots.push({ x: r.x, y: r.y - 14, vx: 0, vy: -850 }); }
  }

  for (const s of shots) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y < -30) { s.dead = true; continue; }
    for (const e of enemies) {
      if (e.dying !== undefined || !hits(e, s.x, s.y, 6)) continue;
      s.dead = true; e.flash = 0.08; e.hp--;
      puff(s.x, s.y, 'spark');
      if (e.kind !== 'fighter') sfx.bonk();
      if (e.hp <= 0) kill(e);
      break;
    }
  }
  shots = shots.filter(s => !s.dead);

  // vagues
  while (waveQueue.length && waveQueue[0].at <= gameT) waveQueue.shift().fn();
  enemies = enemies.filter(e => updateEnemy(e, dt));
  if (!waveQueue.length && !enemies.some(e => e.dying === undefined)) {
    waveWait += dt;
    if (waveWait > 1.4) { waveWait = 0; wave++; startWave(); }
  }

  // collisions avec Lucas
  for (const e of enemies) {
    if (e.dying !== undefined || !hits(e, p.x, p.y, p.r)) continue;
    if (p.inv <= 0 || p.shield > 0) { hurt(); if (e.kind !== 'cruiser') { e.hp = 0; kill(e); } }
  }
  for (const s of eshots) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y > H + 20 || s.y < -20 || s.x < -20 || s.x > W + 20) s.dead = true;
    else if (!s.dead && Math.hypot(s.x - p.x, s.y - p.y) < p.r + 7) { s.dead = true; hurt(); }
  }
  eshots = eshots.filter(s => !s.dead);

  // bonus
  for (const b of pickups) {
    b.t += dt;
    const dx = p.x - b.x, dy = p.y - b.y, dist = Math.hypot(dx, dy);
    if (dist < 140) { b.x += dx / dist * 300 * dt; b.y += dy / dist * 300 * dt; }
    else { b.y += 100 * dt; b.x += Math.sin(b.t * 2) * 30 * dt; }
    if (dist < 38) {
      b.dead = true;
      if (b.kind === 'triple') p.triple = 10;
      if (b.kind === 'shield') p.shield = 9;
      if (b.kind === 'r2') { p.r2 = 12; sfx.bip(); say('R2-WC', '« Bip bip bouuu… PROUT ! »', R2C, 2.5); }
      else sfx.pickup();
      texts.push({ x: p.x, y: p.y - 50, text: D.BONUS[b.kind].name, t: 1.3, color: D.BONUS[b.kind].color });
    }
    if (b.y > H + 40) b.dead = true;
  }
  pickups = pickups.filter(b => !b.dead);
}

function r2Pos() {
  return { x: player.x + Math.cos(gameT * 2.4) * 52, y: player.y + 14 + Math.sin(gameT * 2.4) * 18 };
}

// ---------- affichage ----------
function textOut(text, x, y, size, fill, align = 'center', lw = 6) {
  ctx.font = FONT(size); ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = D.OUT;
  ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

function wrap(text, maxW, size) {
  ctx.font = FONT(size, 700);
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawRadio() {
  if (!radio) return;
  const a = Math.min(1, radio.t * 3);
  const lines = wrap(radio.text, W - 150, 19);
  const h = 44 + lines.length * 24, y = 92;
  ctx.save(); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.roundRect(14, y, W - 28, h, 16);
  ctx.fillStyle = 'rgba(255,247,224,0.94)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = D.OUT; ctx.stroke();
  // portrait rond
  const cy = y + h / 2, im = D.PORTRAIT[radio.color.p];
  ctx.save(); ctx.beginPath(); ctx.arc(52, cy, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#d8f0ff'; ctx.fill(); ctx.clip();
  if (D.ready(im)) ctx.drawImage(im, 52 - 30, cy - 30, 60, 60);
  ctx.restore();
  ctx.beginPath(); ctx.arc(52, cy, 28, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = D.OUT; ctx.stroke();
  ctx.font = FONT(16); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = radio.color.c;
  ctx.fillText(radio.who, 92, y + 12);
  ctx.font = FONT(19, 700); ctx.fillStyle = '#3b2414';
  lines.forEach((l, i) => ctx.fillText(l, 92, y + 34 + i * 24));
  ctx.restore();
}

function drawHUD() {
  textOut(String(score), 18, 34, 30, '#ffffff', 'left', 6);
  for (let i = 0; i < 3; i++) D.heart(ctx, 30 + i * 30, 70, 1.3, i < player.lives ? '#ff5a6e' : '#4a3a55');
  // bonus en cours : petite jauge
  let bx = 120;
  for (const k of ['triple', 'shield', 'r2']) {
    const left = player[k], max = { triple: 10, shield: 9, r2: 12 }[k];
    if (left <= 0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx, 64, 70, 10);
    ctx.fillStyle = D.BONUS[k].color; ctx.fillRect(bx, 64, 70 * left / max, 10);
    ctx.strokeStyle = D.OUT; ctx.lineWidth = 2; ctx.strokeRect(bx, 64, 70, 10);
    bx += 80;
  }
  const boss = enemies.find(e => e.boss && e.dying === undefined && e.y > 0);
  if (boss) {
    const y = H - 26;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(40, y, W - 80, 14);
    ctx.fillStyle = '#c38be8'; ctx.fillRect(40, y, (W - 80) * boss.hp / boss.maxHp, 14);
    ctx.strokeStyle = D.OUT; ctx.lineWidth = 3; ctx.strokeRect(40, y, W - 80, 14);
  }
}

function drawWorld(t) {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.t / p.max) * 0.85;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - p.t / p.max * 0.6), 0, Math.PI * 2);
    ctx.fillStyle = p.c; ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const b of pickups) D.capsule(ctx, b.x, b.y, b.kind, b.t);
  for (const s of shots) D.shotGreen(ctx, s.x, s.y, Math.atan2(s.vx, -s.vy));
  for (const e of enemies) {
    const sc = e.dying !== undefined ? Math.max(0.05, e.dying / (e.boss ? 1.8 : 0.7)) : 1;
    const fl = e.flash > 0 ? 1 : 0;
    if (e.kind === 'fighter') D.burpFighter(ctx, e.x, e.y, sc, e.rot, fl);
    else if (e.kind === 'rock') D.poop(ctx, e.x, e.y, sc, e.rot, fl);
    else D.cruiser(ctx, e.x, e.y, 0.4 + sc * 0.6, e.rot, fl, t);
  }
  if (player && state === 'play') {
    if (player.r2 > 0) { const r = r2Pos(); D.r2(ctx, r.x, r.y, t); }
    if (player.inv <= 0 || Math.floor(t * 12) % 2) D.toilet(ctx, player.x, player.y, 1, t, player.tilt);
    if (player.shield > 0) {
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 8) * (player.shield < 2 ? 3 : 1);
      ctx.beginPath(); ctx.arc(player.x, player.y, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#5ee0ff'; ctx.fill(); ctx.globalAlpha = 0.8;
      ctx.lineWidth = 3; ctx.strokeStyle = '#bff4ff'; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  for (const s of eshots) D.shotPurple(ctx, s.x, s.y, t, Math.atan2(-s.vx, s.vy) + Math.PI);
  for (const x of texts) {
    ctx.globalAlpha = Math.min(1, x.t * 2);
    textOut(x.text, x.x, x.y, 22, x.color, 'center', 5);
  }
  ctx.globalAlpha = 1;
}

function drawTitle(t) {
  const cy = H * 0.3;
  textOut('La Guerre', W / 2, cy - 40, 66, '#b6ff7a', 'center', 10);
  textOut('des Gaz', W / 2, cy + 34, 66, '#b6ff7a', 'center', 10);
  ctx.font = 'italic ' + FONT(19, 700); ctx.textAlign = 'center'; ctx.fillStyle = '#d9c9ff';
  ctx.fillText('Il y a longtemps, dans une galaxie', W / 2, cy + 104);
  ctx.fillText('très, très gazeuse…', W / 2, cy + 130);
  // Lucas face à Dark Roteur, en bas
  const fh = Math.min(290, H * 0.27), fy = H - 40, tapY = fy - fh - 50;
  D.figure(ctx, 'lucas_rire', 125, fy - Math.abs(Math.sin(t * 3)) * 6, fh);
  D.figure(ctx, 'roteur', W - 150, fy, fh * 0.95);
  // le chasseur-WC entre le sous-titre et « Touche l'écran »
  const top = cy + 145, gap = tapY - 30 - top;
  D.toilet(ctx, W / 2, top + gap / 2 + Math.sin(t * 2) * 6, Math.min(1.4, gap / 100), t, Math.sin(t * 1.3) * 0.12);
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 4);
  textOut('Touche l\'écran pour décoller !', W / 2, tapY, 28, '#ffffff', 'center', 6);
  ctx.globalAlpha = 1;
  if (best) textOut('Record : ' + best, W / 2, tapY + 36, 22, '#ffe08a', 'center', 5);
}

function drawOver() {
  ctx.fillStyle = 'rgba(10,6,25,0.55)'; ctx.fillRect(0, 0, W, H);
  const rh = Math.min(260, H * 0.24);
  D.figure(ctx, 'roteur', W / 2, H - 20 + Math.sin(stateT * 5) * 4, rh);
  textOut('Dark Roteur a gagné…', W / 2, H * 0.32, 38, '#c38be8', 'center', 8);
  textOut('…pour cette fois !', W / 2, H * 0.32 + 48, 30, '#ffffff', 'center', 6);
  textOut('Score : ' + score, W / 2, H * 0.48, 40, '#ffffff', 'center', 7);
  textOut(newBest ? 'Nouveau record !' : 'Record : ' + best, W / 2, H * 0.55, 28, '#ffe08a', 'center', 6);
  if (stateT > 1) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(stateT * 4);
    textOut('Touche pour rejouer', W / 2, H * 0.72, 30, '#b6ff7a', 'center', 6);
    ctx.globalAlpha = 1;
  }
}

function draw(t) {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 14);
  drawBackground();
  if (state !== 'title') drawWorld(t);
  ctx.restore();
  if (state === 'title') drawTitle(t);
  if (state === 'play') {
    drawHUD();
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.t * 2);
      textOut(banner.text, W / 2, H * 0.42, banner.text.length > 14 ? 32 : 46, '#ffffff', 'center', 8);
      ctx.globalAlpha = 1;
    }
    drawRadio();
  }
  if (state === 'over') drawOver();
}

// ---------- boucle ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);

// pour les tests dans la console
window.gdg = { get state() { return state; }, get player() { return player; }, get enemies() { return enemies; }, get wave() { return wave; } };
