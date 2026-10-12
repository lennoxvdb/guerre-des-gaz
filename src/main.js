// La Guerre des Gaz : démarrage, écrans, commandes, caméra, enchaînement des missions.
import * as THREE from 'three';
import { loadTextures, TEX, Particles, puffTex, glowTex, Words } from './engine/gfx.js';
import { unlock, sfx, playMusic, muted, setMuted } from './engine/audio.js';
import { loadKnight, Fighter, SaberTrail } from './entities/fighter.js';
import { World } from './world/world.js';
import { FootMode } from './game/foot.js';
import { FlightMode, FLIGHT_OFF } from './game/flight.js';
import { MISSIONS, DIFF, footSablon, flightSablon, duelPlateau } from './game/missions.js';

const $ = (id) => document.getElementById(id);
const touchDevice = matchMedia('(pointer: coarse)').matches;

// ---------------- sauvegarde ----------------
const save = { stars: {}, seen: {} };
try { Object.assign(save, JSON.parse(localStorage.getItem('gdg_save') || '{}')); } catch { /* rien */ }
const persist = () => { try { localStorage.setItem('gdg_save', JSON.stringify(save)); } catch { /* rien */ } };

// ---------------- 3D ----------------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 300);
const puffs = new Particles(scene, puffTex, 900);
const glows = new Particles(scene, glowTex, 600); // pas « additif » : les lueurs gardent leur couleur sur le sable
const words = new Words(scene);

// ---------------- aperçu navigateur / téléphone ----------------
const body = document.body, gameEl = $('game'), device = $('device'), stage = $('stage');
const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
  || (touchDevice && Math.min(screen.width, screen.height) < 820);
if (native) body.classList.add('native');
const view = { mode: 'browser', landscape: false };
try { Object.assign(view, JSON.parse(localStorage.getItem('gdg_view') || '{}')); } catch { /* rien */ }
let GW = 1, GH = 1;
function resize() {
  GW = gameEl.offsetWidth; GH = gameEl.offsetHeight;
  if (!GW || !GH) return;
  renderer.setSize(GW, GH, false);
  gameEl.classList.toggle('narrow', GW < 560);
}
function applyView() {
  const phone = view.mode === 'phone' && !native;
  body.classList.toggle('phone', phone);
  body.classList.toggle('landscape', phone && view.landscape);
  document.querySelectorAll('#devbar [data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === view.mode));
  $('rotateBtn').style.display = phone ? '' : 'none';
  if (phone) {
    const W = view.landscape ? 915 : 412, H = view.landscape ? 412 : 915;
    gameEl.style.width = W + 'px'; gameEl.style.height = H + 'px';
    const s = Math.min(1, (stage.clientWidth - 30) / (W + 24), (stage.clientHeight - 30) / (H + 24));
    device.style.transform = `scale(${s})`;
  } else { gameEl.style.width = ''; gameEl.style.height = ''; device.style.transform = ''; }
  resize();
  try { localStorage.setItem('gdg_view', JSON.stringify(view)); } catch { /* rien */ }
}
document.querySelectorAll('#devbar [data-mode]').forEach((b) => b.addEventListener('click', () => { view.mode = b.dataset.mode; applyView(); }));
$('rotateBtn').addEventListener('click', () => { view.landscape = !view.landscape; applyView(); });
addEventListener('resize', applyView);

// ---------------- caméra ----------------
const OFF_FOOT = new THREE.Vector3(16, 19, 16);
const cam = { target: new THREE.Vector3(0, 1, 0), elev: 0, zoom: 1 };
let shakeAmt = 0, stopT = 0, zoomNow = 1;
const aspect = () => GW / GH;
const footHalf = () => Math.max(7.4, 5.4 / aspect());
const flightHalf = () => Math.max(9.5, 6.3 / aspect());
function placeCamera(dt) {
  zoomNow += (cam.zoom - zoomNow) * Math.min(1, dt * 3);
  const off = OFF_FOOT.clone().normalize().lerp(FLIGHT_OFF.clone().normalize(), cam.elev).normalize().multiplyScalar(80);
  camera.position.copy(cam.target).add(off);
  if (shakeAmt > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(shakeAmt * 0.9));
  camera.lookAt(cam.target);
  const half = (footHalf() + (flightHalf() - footHalf()) * cam.elev) * zoomNow, a = aspect();
  camera.left = -half * a; camera.right = half * a; camera.top = half; camera.bottom = -half;
  camera.updateProjectionMatrix();
}

// ---------------- commandes ----------------
const input = { move: { x: 0, y: 0 }, drag: { x: 0, y: 0 }, attack: false, block: false, mega: false, action: false };
const keys = new Set();
const KEYS = { attack: ['Space', 'KeyJ'], block: ['ShiftLeft', 'ShiftRight', 'KeyK'], mega: ['KeyE', 'KeyL'], action: ['KeyF', 'Enter'] };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  unlock();
  if (KEYS.attack.includes(e.code)) input.attack = true;
  if (KEYS.mega.includes(e.code)) input.mega = true;
  if (KEYS.action.includes(e.code)) input.action = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'play') pause();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const joy = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
const JR = 55;
let drag = null;
function local(e) {
  const r = gameEl.getBoundingClientRect();
  const s = r.width / gameEl.offsetWidth || 1;
  return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s, s };
}
gameEl.addEventListener('pointerdown', (e) => {
  unlock();
  if (state !== 'play' || paused || e.target.closest('button')) return;
  const p = local(e);
  if (modeName === 'flight') { drag = { id: e.pointerId, x: p.x, y: p.y }; $('flightHelp').classList.add('hidden'); return; }
  if (joy.on) return;
  Object.assign(joy, { on: true, id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0 });
  const j = $('joy'); j.style.left = p.x + 'px'; j.style.top = p.y + 'px'; j.classList.remove('hidden');
  $('joyKnob').style.transform = '';
});
gameEl.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (drag && e.pointerId === drag.id) { input.drag.x += p.x - drag.x; input.drag.y -= p.y - drag.y; drag.x = p.x; drag.y = p.y; return; }
  if (!joy.on || e.pointerId !== joy.id) return;
  let dx = p.x - joy.ox, dy = p.y - joy.oy;
  const len = Math.hypot(dx, dy);
  if (len > JR * 1.5) { // le joystick suit le doigt s'il va trop loin
    joy.ox += dx / len * (len - JR * 1.5); joy.oy += dy / len * (len - JR * 1.5);
    $('joy').style.left = joy.ox + 'px'; $('joy').style.top = joy.oy + 'px';
    dx = p.x - joy.ox; dy = p.y - joy.oy;
  }
  const k = Math.min(1, JR / (Math.hypot(dx, dy) || 1));
  joy.x = dx * k / JR; joy.y = -dy * k / JR;
  $('joyKnob').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
});
const pointerEnd = (e) => {
  if (drag && e.pointerId === drag.id) drag = null;
  if (joy.on && e.pointerId === joy.id) { joy.on = false; joy.x = joy.y = 0; $('joy').classList.add('hidden'); }
};
gameEl.addEventListener('pointerup', pointerEnd);
gameEl.addEventListener('pointercancel', pointerEnd);

function holdButton(id, onDown, onUp) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlock(); b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch { /* rien */ } onDown(); });
  const up = () => { b.classList.remove('down'); onUp && onUp(); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
}
let blockBtn = false;
holdButton('btnAtk', () => { input.attack = true; });
holdButton('btnBlock', () => { blockBtn = true; }, () => { blockBtn = false; });
holdButton('btnMega', () => { input.mega = true; });
holdButton('btnAct', () => { input.action = true; });
$('pauseBtn').addEventListener('click', () => { sfx.click(); pause(); });
const showMute = () => { $('muteBtn').textContent = muted ? '🔇' : '🔊'; };
$('muteBtn').addEventListener('click', () => { unlock(); setMuted(!muted); showMute(); });
showMute();

function readInput() {
  let x = joy.x, y = joy.y;
  if (keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('KeyQ')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyZ')) y += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y -= 1;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  input.move.x = x; input.move.y = y;
  input.block = blockBtn || KEYS.block.some((k) => keys.has(k));
}
function clearEdges() { input.attack = input.mega = input.action = false; input.drag.x = input.drag.y = 0; }

// ---------------- HUD ----------------
const NAMES = { lucas: 'Lucas', lucas_rire: 'Lucas', roteur: 'Dark Roteur', gazou: 'Maître Gazou', hanpopo: 'Han Popo', pqr: 'P-QR', r2wc: 'R2-WC', soldat: 'Soldat' };
const portrait = (who) => `assets/portraits/${who === 'lucas_rire' ? 'lucas' : who}.webp`;
let radioT = 0, bannerT = 0, pointerTarget = null;
const TIPS = {
  atk: () => touchDevice ? 'Touche ⚔️ pour frapper avec ton sabre-gaz !' : 'Espace (ou ⚔️) pour frapper avec ton sabre-gaz !',
  block: () => touchDevice ? 'Garde 🛡️ appuyé pour parer et renvoyer les tirs !' : 'Garde Maj (ou 🛡️) appuyé pour parer et renvoyer les tirs !',
  mega: () => touchDevice ? 'Ta jauge est pleine : touche 💨 !' : 'Ta jauge est pleine : touche E (ou 💨) !',
};
const BTN = { atk: 'btnAtk', block: 'btnBlock', mega: 'btnMega' };
const hud = {
  hearts(hp, max) { $('hearts').innerHTML = Array.from({ length: max }, (_, i) => `<span class="${i < hp ? '' : 'off'}">❤️</span>`).join(''); },
  mega(k) { $('megaFill').style.height = Math.round(Math.min(1, k) * 100) + '%'; $('btnMega').classList.toggle('full', k >= 1); },
  objective(t) { $('objective').textContent = t || ''; },
  radio(who, text, dur = 3.6) {
    $('radioImg').src = portrait(who); $('radioName').textContent = NAMES[who] || who; $('radioText').textContent = text;
    const r = $('radio'); r.classList.remove('hidden'); r.style.animation = 'none'; void r.offsetWidth; r.style.animation = '';
    radioT = dur + text.length * 0.02;
    if (who === 'r2wc') sfx.bip();
  },
  boss(name, k = 1) {
    if (!name) { $('bossbar').classList.add('hidden'); return; }
    $('bossbar').classList.remove('hidden'); $('bossName').textContent = name; $('bossFill').style.width = Math.round(k * 100) + '%';
    if (modeName === 'flight' && k >= 1) playMusic('boss');
  },
  banner(text, dur = 2) { const b = $('banner'); b.textContent = text; b.classList.remove('hidden'); bannerT = dur; },
  tip(which) {
    for (const id of Object.values(BTN)) $(id).classList.remove('hl');
    if (!which) { $('tip').classList.add('hidden'); return; }
    $(BTN[which]).classList.add('hl');
    $('tip').textContent = TIPS[which](); $('tip').classList.remove('hidden');
  },
  action(label) { $('btnAct').classList.toggle('hidden', !label); if (label) $('actLabel').textContent = label; },
  pointer(p) { pointerTarget = p ? p.clone() : null; },
};
function resetHud() {
  hud.objective(''); hud.boss(null); hud.tip(null); hud.action(null); hud.pointer(null);
  $('radio').classList.add('hidden'); $('banner').classList.add('hidden'); radioT = bannerT = 0;
}
function flash(a = 0.8) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; void f.offsetWidth; f.style.transition = 'opacity .5s'; f.style.opacity = 0; }

// ---------------- contexte partagé avec les modes de jeu ----------------
const ctx = {
  scene, camera, puffs, glows, words, hud, input, cam, diff: DIFF, world: null,
  shake(a) { shakeAmt = Math.max(shakeAmt, a); },
  hitstop(t) { stopT = Math.max(stopT, t); },
  aspect, flightHalf,
  dragScale: () => (camera.right - camera.left) / GW * 1.35,
};

// ---------------- écrans ----------------
let state = 'loading', paused = false, mode = null, modeName = null, mission = null, world = null;
let titleHero = null, titleTrail = null, storyCb = null;
function screen(html, cls = '') {
  $('screens').innerHTML = `<div class="screen ${cls}">${html}</div>`;
  return $('screens').firstElementChild;
}
function noScreen() { $('screens').innerHTML = ''; }
function clearScene() {
  if (mode) { mode.dispose(); mode = null; }
  if (titleHero) { scene.remove(titleHero.root); titleTrail.dispose(scene); titleHero = null; }
  if (world) { world.dispose(); world = null; }
  puffs.clear(); glows.clear(); words.clear();
  modeName = null;
}
function setWorld(theme) {
  world = new World(scene, theme);
  ctx.world = world;
}

function title() {
  clearScene();
  state = 'title'; paused = false;
  $('hud').classList.add('hidden');
  setWorld('sablon');
  titleHero = new Fighter('lucas', 2.0);
  titleHero.yaw = Math.PI * 0.25;
  scene.add(titleHero.root);
  titleTrail = new SaberTrail(scene, 0x8fff5a);
  cam.target.set(0, 1.4, 0); cam.elev = 0; cam.zoom = 0.42; zoomNow = 0.42;
  world.follow(cam.target);
  playMusic('menu');
  const el = screen(`
    <div class="logo">La Guerre<br>des Gaz</div>
    <div></div>
    <div class="row" style="flex-direction:column;align-items:center;gap:12px">
      <div class="tag">Que le Gaz soit avec toi !</div>
      <button class="btn big" id="playBtn">▶ JOUER</button>
    </div>
    <div class="ver">Version 2 — dessins Gemini, modèle 3D KayKit (CC0)</div>`);
  el.id = 'title';
  $('playBtn').onclick = () => { unlock(); sfx.click(); missionsScreen(); };
}

function missionsScreen() {
  state = 'menu';
  const cards = MISSIONS.map((m) => {
    const st = save.stars[m.id] || 0;
    const img = m.icon === 'lucas' ? 'assets/persos/lucas.webp' : m.icon === 'roteur' ? 'assets/persos/roteur.webp' : 'assets/persos/pqr.webp';
    return `<button class="card ${m.soon ? 'soon' : ''}" data-id="${m.id}">
      <img src="${img}" alt=""><b>${m.id}. ${m.name}</b><p>${m.desc}</p>
      <div class="stars">${m.soon ? 'Bientôt' : [1, 2, 3].map((i) => (i <= st ? '⭐' : '☆')).join('')}</div></button>`;
  }).join('');
  screen(`<h2>Choisis ta mission</h2><div class="cards">${cards}</div><button class="btn grey" id="backBtn">◀ Retour</button>`, 'dim');
  document.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => {
    const m = MISSIONS.find((x) => x.id === Number(c.dataset.id));
    if (m.soon) return;
    sfx.click(); startMission(m);
  }));
  $('backBtn').onclick = () => { sfx.click(); title(); };
}

// une page de bande dessinée après l'autre ; on touche pour avancer
function story(lines, done) {
  state = 'story';
  let i = 0, typing = null;
  const el = screen('', '');
  el.id = 'story';
  const show = () => {
    const L = lines[i];
    const side = L.who && L.who.startsWith('lucas') ? 'left' : 'right';
    const img = L.who ? `<img class="who ${side}" src="assets/persos/${L.who}.webp" alt="">` : '';
    el.innerHTML = `${img}<div class="bubble ${L.who ? '' : 'narr'}">${L.who ? `<b style="color:${L.who === 'roteur' ? '#7b3fa0' : '#2f7a2a'}">${NAMES[L.who]}</b>` : ''}<p></p><span class="next">▶</span></div>
      <button class="btn grey skip">Passer ⏩</button>`;
    const p = el.querySelector('p');
    let n = 0;
    clearInterval(typing);
    typing = setInterval(() => { n += 2; p.textContent = L.text.slice(0, n); if (n >= L.text.length) { clearInterval(typing); typing = null; } }, 22);
    el.querySelector('.skip').onclick = (e) => { e.stopPropagation(); clearInterval(typing); sfx.click(); done(); };
    if (L.who === 'roteur') sfx.burp(); else if (L.who === 'r2wc') sfx.bip(); else sfx.click();
  };
  el.onclick = () => {
    if (typing) { clearInterval(typing); typing = null; el.querySelector('p').textContent = lines[i].text; return; }
    i++;
    if (i >= lines.length) done(); else show();
  };
  show();
}

function startMission(m, opts = {}) {
  clearScene();
  mission = m;
  setWorld(m.theme);
  cam.zoom = 1; zoomNow = 1; cam.elev = 0;
  const start = m.id === 1 ? new THREE.Vector3(0, 0, 9) : new THREE.Vector3(0, 0, 7);
  cam.target.copy(start).setY(1);
  world.follow(start);
  $('hud').classList.add('hidden');
  const go = () => { noScreen(); opts.flight ? startFlight({ startPos: world.wcSpot.clone(), hp: DIFF.hp, mega: 0, skipIntro: true }) : startFoot(start); };
  if (opts.retry) go();
  else { playMusic('menu'); story(m.intro, go); }
}

function startFoot(start) {
  resetHud();
  $('hud').classList.remove('hidden', 'flight');
  state = 'play'; paused = false;
  modeName = 'foot';
  const m = mission;
  mode = new FootMode(ctx, m.id === 1
    ? { script: footSablon, heroPos: start, radius: 30 }
    : { script: duelPlateau, heroPos: start, radius: 18 });
  playMusic(m.music);
}

function startFlight(o) {
  if (mode) { mode.dispose(); mode = null; }
  if (world.wc) world.wc.visible = false;
  resetHud();
  $('hud').classList.remove('hidden'); $('hud').classList.add('flight');
  $('flightHelp').classList.toggle('hidden', !touchDevice);
  state = 'play'; paused = false;
  modeName = 'flight';
  mode = new FlightMode(ctx, { script: flightSablon, ...o });
  playMusic('flight');
}

function onResult(r) {
  if (r.type === 'board') {
    const hp = mode.hero.hp, mega = mode.hero.mega;
    startFlight({ startPos: world.wcSpot.clone(), hp, mega });
    return;
  }
  if (r.type === 'dead') return gameOver();
  if (r.type === 'win') return win();
}

function win() {
  const hp = modeName === 'flight' ? mode.ship.hp : mode.hero.hp;
  const stars = hp >= DIFF.hp * 0.66 ? 3 : hp >= DIFF.hp * 0.33 ? 2 : 1;
  save.stars[mission.id] = Math.max(save.stars[mission.id] || 0, stars);
  persist();
  state = 'outro';
  $('hud').classList.add('hidden');
  playMusic('win'); sfx.win();
  story(mission.outro, () => {
    state = 'result';
    const next = MISSIONS.find((x) => x.id === mission.id + 1 && !x.soon);
    screen(`<h2>Mission réussie !</h2>
      <div class="bigstars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">⭐</span>`).join('')}</div>
      <img class="portrait" src="assets/persos/lucas_rire.webp" alt="">
      <div class="row">${next ? '<button class="btn" id="nextBtn">Mission suivante ▶</button>' : ''}<button class="btn alt" id="menuBtn">Missions</button></div>
      ${next ? '' : '<p class="sub">La suite (l\'attaque de l\'Étoile Puante) arrive bientôt !</p>'}`, 'dim');
    if (next) $('nextBtn').onclick = () => { sfx.click(); startMission(next); };
    $('menuBtn').onclick = () => { sfx.click(); clearScene(); title(); missionsScreen(); };
  });
}

function gameOver() {
  state = 'over';
  const inFlight = modeName === 'flight';
  $('hud').classList.add('hidden');
  playMusic(null);
  screen(`<h2>Lucas est K.O. !</h2>
    <img class="portrait" src="assets/persos/roteur.webp" alt="">
    <p class="sub">Dark Roteur rigole… mais le Gaz est encore avec toi !</p>
    <div class="row"><button class="btn" id="retryBtn">${inFlight ? 'Recommencer le vol' : 'Réessayer'}</button><button class="btn grey" id="menuBtn">Missions</button></div>`, 'dim');
  $('retryBtn').onclick = () => { sfx.click(); startMission(mission, { retry: true, flight: inFlight }); };
  $('menuBtn').onclick = () => { sfx.click(); clearScene(); title(); missionsScreen(); };
}

function pause() {
  if (state !== 'play' || paused) return;
  paused = true;
  screen(`<h2>Pause</h2><div class="row" style="flex-direction:column">
    <button class="btn" id="resumeBtn">▶ Continuer</button>
    <button class="btn alt" id="restartBtn">↻ Recommencer</button>
    <button class="btn grey" id="quitBtn">Missions</button></div>`, 'dim');
  $('resumeBtn').onclick = () => { sfx.click(); paused = false; noScreen(); };
  $('restartBtn').onclick = () => { sfx.click(); startMission(mission, { retry: true, flight: modeName === 'flight' }); };
  $('quitBtn').onclick = () => { sfx.click(); clearScene(); title(); missionsScreen(); };
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------- boucle ----------------
let last = performance.now(), T = 0, kataT = 0, kataI = 0;
const _p = new THREE.Vector3(), _q = new THREE.Vector3();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const real = dt;
  if (stopT > 0) { stopT -= real; dt *= 0.08; }
  if (paused) dt = 0;
  T += dt;
  shakeAmt = Math.max(0, shakeAmt - real * 1.6);

  if (state === 'play' && mode && !paused) {
    readInput();
    if (window.gdgBot) window.gdgBot(input, mode, modeName); // robot de test (tools/bot.js)
    const r = mode.update(dt);
    clearEdges();
    if (r) onResult(r);
  } else clearEdges();

  // l'écran titre : Lucas s'entraîne au sabre
  if (titleHero) {
    kataT -= dt;
    if (kataT <= 0) {
      const seq = ['atk1', 'atk2', 'atk3', 'idle', 'spin', 'idle', 'block'];
      const n = seq[kataI++ % seq.length];
      if (n === 'idle' || n === 'block') { titleHero.setBase(n); titleHero.stopAction(); kataT = 1.2; }
      else { titleHero.setBase('idle'); kataT = titleHero.play(n, 1.3, 0.85) + 0.15; sfx.swing(); }
    }
    titleHero.update(dt);
    titleHero.setSaberOn(1);
    titleHero.saberEnds(_p, _q); titleTrail.push(_p, _q, !!titleHero.action);
    titleHero.yaw = Math.PI * 0.25 + Math.sin(T * 0.4) * 0.3;
  }

  if (world) world.update(dt, T);
  puffs.update(dt); glows.update(dt); words.update(dt);
  placeCamera(real);

  // HUD : radio, bannière, flèche vers l'objectif
  if (radioT > 0 && !paused) { radioT -= real; if (radioT <= 0) $('radio').classList.add('hidden'); }
  if (bannerT > 0 && !paused) { bannerT -= real; if (bannerT <= 0) $('banner').classList.add('hidden'); }
  const ptr = $('pointer');
  if (pointerTarget && modeName === 'foot' && mode && mode.hero && Math.hypot(mode.hero.pos.x - pointerTarget.x, mode.hero.pos.z - pointerTarget.z) > 5) {
    _p.copy(mode.hero.pos).setY(1).project(camera); _q.copy(pointerTarget).project(camera);
    const ang = Math.atan2(-(_q.y - _p.y) * GH, (_q.x - _p.x) * GW);
    const cx = (_p.x + 1) / 2 * GW + Math.cos(ang) * 90, cy = (1 - _p.y) / 2 * GH + Math.sin(ang) * 90;
    ptr.style.left = cx + 'px'; ptr.style.top = cy + 'px'; ptr.style.transform = `rotate(${ang}rad)`;
    ptr.classList.remove('hidden');
  } else ptr.classList.add('hidden');

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------- démarrage ----------------
const IMAGES = {};
for (const n of ['wc', 'rotfighter', 'ventouse', 'etoile', 'faucon', 'crotte', 'tir_vert', 'tir_violet', 'bonus']) IMAGES[n === 'rotfighter' ? 'rot' : n] = `assets/vaisseaux/${n}.webp`;
for (const n of ['lucas', 'lucas_rire', 'roteur', 'gazou', 'r2wc', 'pqr', 'soldat', 'hanpopo']) IMAGES[n] = `assets/persos/${n}.webp`;

applyView();
requestAnimationFrame(frame);
(async () => {
  let a = 0, b = 0;
  const prog = () => { $('loadFill').style.width = Math.round((a * 0.6 + b * 0.4) * 100) + '%'; };
  await Promise.all([
    loadTextures(IMAGES, (k) => { a = k; prog(); }),
    loadKnight().then(() => { b = 1; prog(); }),
    document.fonts ? document.fonts.load('40px "Luckiest Guy"') : null,
  ]);
  $('loading').classList.add('hidden');
  title();
  // ?mission=2 ou ?vol pour tester directement
  const q = new URLSearchParams(location.search);
  if (q.has('mission')) startMission(MISSIONS[Number(q.get('mission')) - 1], { retry: true });
  if (q.has('vol')) { mission = MISSIONS[0]; startMission(mission, { retry: true, flight: true }); }
})();

window.gdg = { get mode() { return mode; }, get state() { return state; }, input, ctx };
