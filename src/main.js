// La Guerre des Gaz : démarrage, écrans, commandes, caméra, enchaînement des missions.
import * as THREE from 'three';
import { loadTextures, TEX, Particles, puffTex, glowTex, Words } from './engine/gfx.js';
import { unlock, sfx, playMusic, muted, setMuted, setSaberVoice } from './engine/audio.js';
import { loadKnight, Fighter, SaberTrail } from './entities/fighter.js';
import { World } from './world/world.js';
import { FootMode } from './game/foot.js';
import { FlightMode, FLIGHT_OFF } from './game/flight.js';
import { MISSIONS, DIFF, DUEL } from './game/missions.js';
import { SpeederMode } from './game/speeder.js';
import { TrenchMode } from './game/trench.js';
import { VersusMode } from './game/versus.js';
import { autoUpdate, appReady } from './engine/update.js';
import { SABRE, loadSabre, saveSabre, makeCustomSaber, setSabreSink } from './entities/sabre.js';

// tout de suite : dire à l'outil de mise à jour que cette version démarre bien
appReady();

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
// les effets du sabre fabriqué (bulles, nuage de prout…) et son bruit
setSabreSink({ puffs, glows });
setSaberVoice(loadSabre().son);

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
  gameEl.classList.toggle('wide', GW / GH > 1.45 && GH < 620); // téléphone couché : écran large mais bas
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
const input = { move: { x: 0, y: 0 }, drag: { x: 0, y: 0 }, attack: false, block: false, mega: false, action: false, jump: false };
const keys = new Set();
const KEYS = { attack: ['Space', 'KeyJ'], block: ['ShiftLeft', 'ShiftRight', 'KeyK'], mega: ['KeyE', 'KeyL'], action: ['KeyF', 'Enter'], jump: ['KeyX', 'KeyC'] };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  unlock();
  if (KEYS.attack.includes(e.code)) input.attack = true;
  if (KEYS.mega.includes(e.code)) input.mega = true;
  if (KEYS.action.includes(e.code)) input.action = true;
  if (KEYS.jump.includes(e.code)) input.jump = true;
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
// À pied : toucher un soldat = Lucas court le frapper ; toucher le sol = il y court ;
// glisser le doigt = joystick (il apparaît là où le doigt a commencé).
let press = null;
const TAP_MOVE = 14, TAP_TIME = 380;
gameEl.addEventListener('pointerdown', (e) => {
  unlock();
  if (state !== 'play' || paused || e.target.closest('button')) return;
  const p = local(e);
  if (modeName === 'versus') return; // le duel a ses propres boutons
  if (modeName === 'flight' || modeName === 'speeder' || modeName === 'trench') { drag = { id: e.pointerId, x: p.x, y: p.y }; $('flightHelp').classList.add('hidden'); return; }
  if (joy.on || press) return;
  press = { id: e.pointerId, x: p.x, y: p.y, t: performance.now() };
});
function startJoy(x, y, id) {
  Object.assign(joy, { on: true, id, ox: x, oy: y, x: 0, y: 0 });
  const j = $('joy'); j.style.left = x + 'px'; j.style.top = y + 'px'; j.classList.remove('hidden');
  $('joyKnob').style.transform = '';
}
gameEl.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (drag && e.pointerId === drag.id) { input.drag.x += p.x - drag.x; input.drag.y -= p.y - drag.y; drag.x = p.x; drag.y = p.y; return; }
  if (press && e.pointerId === press.id && Math.hypot(p.x - press.x, p.y - press.y) > TAP_MOVE) {
    startJoy(press.x, press.y, press.id); press = null;
  }
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
  if (press && e.pointerId === press.id) {
    if (e.type === 'pointerup' && performance.now() - press.t < TAP_TIME && state === 'play' && !paused && modeName === 'foot') tapAt(press.x, press.y);
    press = null;
  }
  if (joy.on && e.pointerId === joy.id) { joy.on = false; joy.x = joy.y = 0; $('joy').classList.add('hidden'); }
};
// qu'y a-t-il sous le doigt ? un ennemi (le plus proche à l'écran), sinon un point du sol
const _ray = new THREE.Raycaster(), _ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _v = new THREE.Vector3();
function tapAt(x, y) {
  // zone de toucher large : un doigt d'enfant n'est pas précis
  let best = null, bestD = Math.max(70, GW * 0.14);
  for (const en of mode.enemies) {
    if (en.dead || en.state === 'drop') continue;
    _v.copy(en.pos).setY(en.kind === 'roteur' ? 1.6 : 0.9).project(viewCam());
    const d = Math.hypot((_v.x + 1) / 2 * GW - x, (1 - _v.y) / 2 * GH - y);
    const r = en.kind === 'roteur' ? bestD * 1.5 : bestD;
    if (d < r && (!best || d < best.d)) best = { en, d };
  }
  if (best) { mode.attackTarget(best.en); return; }
  _ray.setFromCamera(new THREE.Vector2(x / GW * 2 - 1, -(y / GH) * 2 + 1), viewCam());
  if (!_ray.ray.intersectPlane(_ground, _v)) return;
  // le sol juste à côté d'un soldat : c'est lui qu'on voulait
  for (const en of mode.enemies) {
    if (en.dead || en.state === 'drop') continue;
    if (Math.hypot(en.pos.x - _v.x, en.pos.z - _v.z) < 2.6 + en.r) { mode.attackTarget(en); return; }
  }
  mode.walkTo(_v.clone());
}
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
holdButton('btnJump', () => { input.jump = true; });
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
function clearEdges() { input.attack = input.mega = input.action = input.jump = false; input.drag.x = input.drag.y = 0; }

// ---------------- HUD ----------------
const NAMES = { lucas: 'Lucas', lucas_rire: 'Lucas', roteur: 'Dark Roteur', gazou: 'Maître Gazou', hanpopo: 'Han Popo', pqr: 'P-QR', r2wc: 'R2-WC', soldat: 'Soldat', capitaine: 'Capitaine Burpo' };
const portrait = (who) => `assets/portraits/${({ lucas_rire: 'lucas', capitaine: 'soldat' })[who] || who}.webp`;
let radioT = 0, bannerT = 0, pointerTarget = null;
const TIPS = {
  atk: () => touchDevice ? 'Touche un soldat avec ton doigt (ou ⚔️) : Lucas le frappe au sabre-gaz !' : 'Clique sur un soldat (ou Espace, ou ⚔️) : Lucas le frappe au sabre-gaz !',
  block: () => touchDevice ? 'Garde 🛡️ appuyé pour parer et renvoyer les tirs !' : 'Garde Maj (ou 🛡️) appuyé pour parer et renvoyer les tirs !',
  mega: () => touchDevice ? 'Ta jauge est pleine : touche 💨 !' : 'Ta jauge est pleine : touche E (ou 💨) !',
  jump: () => touchDevice ? 'Touche 🌀 SAUT pour bondir comme un chevalier !' : 'Touche X (ou 🌀 SAUT) pour bondir comme un chevalier !',
};
const BTN = { atk: 'btnAtk', block: 'btnBlock', mega: 'btnMega', jump: 'btnJump' };
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
    if (modeName !== 'foot' && k >= 1) playMusic('boss');
  },
  banner(text, dur = 2) { const b = $('banner'); b.textContent = text; b.classList.remove('hidden'); bannerT = dur; },
  tip(which) {
    for (const id of Object.values(BTN)) if (id) $(id).classList.remove('hl');
    if (!which) { $('tip').classList.add('hidden'); return; }
    if (BTN[which]) $(BTN[which]).classList.add('hl');
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
  flash(a) { flash(a); },
  music(name) { playMusic(name); },
  aspect, flightHalf, gw: () => GW,
  dragScale: () => (camera.right - camera.left) / GW * 1.35,
};

// ---------------- écrans ----------------
let state = 'loading', paused = false, mode = null, modeName = null, mission = null, world = null;
let titleHero = null, titleTrail = null, storyCb = null;
// la caméra qu'on voit : celle du mode de jeu (tranchée, duel, vue cinéma), celle de l'écran titre, ou la vue du dessus
const viewCam = () => (mode && mode.cam3) || (titleHero ? titleCam : camera);
// l'écran titre : une vraie caméra de cinéma, Lucas en grand et vu de face
const titleCam = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
let titleShot = 'title'; // 'title' (au milieu, entre le titre et les boutons) ou 'atelier' (en haut, au-dessus des choix)
const _look = new THREE.Vector3(), _camWant = new THREE.Vector3();
function placeTitleCam(dt, T) {
  const a = aspect(), atelierShot = titleShot === 'atelier';
  const wide = gameEl.classList.contains('wide'); // téléphone couché : Lucas à gauche, le titre et les boutons à droite
  // hauteur de monde visible : assez pour que les coups de sabre restent dans l'écran (téléphone en hauteur)
  const H = wide ? 4.0 : atelierShot ? Math.max(4.4, 2.7 / a) : Math.max(4.6, 2.9 / a);
  const d = H / 2 / Math.tan(THREE.MathUtils.degToRad(titleCam.fov / 2));
  const lookY = wide ? 1.15 : atelierShot ? 1.05 - H * 0.2 : 1.05 + H * (a < 1 ? 0.02 : 0.06);
  const sx = wide ? H / 2 * a * 0.45 : 0; // décalage : Lucas apparaît vers la gauche
  _look.set(sx, lookY, 0);
  _camWant.set(sx + Math.sin(T * 0.25) * 0.6, lookY + 0.25, d);
  titleCam.position.lerp(_camWant, Math.min(1, dt * 3));
  titleCam.lookAt(_look);
  titleCam.aspect = a; titleCam.updateProjectionMatrix();
}
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

let gameVersion = '';
function toast(text, dur = 5) {
  const t = $('toast'); t.textContent = text; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), dur * 1000);
}

function title() {
  clearScene();
  state = 'title'; paused = false;
  $('hud').classList.add('hidden');
  setWorld('sablon');
  titleHero = new Fighter('lucas', 2.0);
  titleHero.yaw = 0; // face à nous
  scene.add(titleHero.root);
  titleTrail = new SaberTrail(scene, titleHero.saber.userData.trailColor);
  titleShot = 'title'; placeTitleCam(1, 0); // caméra tout de suite à sa place
  cam.target.set(0, 1.4, 0); cam.elev = 0; cam.zoom = 0.42; zoomNow = 0.42;
  world.follow(cam.target);
  playMusic('menu');
  const el = screen(`
    <div class="logo">La Guerre<br>des Gaz</div>
    <div></div>
    <div class="row" style="flex-direction:column;align-items:center;gap:12px">
      <div class="tag">${loadSabre().nom ? '⚔️ ' + esc(loadSabre().nom) : 'Que le Gaz soit avec toi !'}</div>
      <button class="btn big" id="playBtn">▶ JOUER</button>
      <div class="row" style="gap:10px"><button class="btn alt" id="sabreBtn">🔧 Ton sabre</button><button class="btn alt duelBtn" id="duelBtn">🥊 Duel</button></div>
    </div>
    <div class="ver">${gameVersion ? 'Version ' + gameVersion : ''}</div>`);
  el.id = 'title';
  $('playBtn').onclick = () => { unlock(); sfx.click(); missionsScreen(); };
  titleShot = 'title';
  $('sabreBtn').onclick = () => { unlock(); sfx.click(); atelier(); };
  $('duelBtn').onclick = () => { unlock(); sfx.click(); startMission(DUEL); };
}

// ---------------- l'atelier : on fabrique son propre sabre-gaz ----------------
const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const wonCount = () => MISSIONS.filter((m) => (save.stars[m.id] || 0) > 0).length;
// Lucas de l'écran titre prend le nouveau sabre tout de suite
function refitTitleSaber() {
  if (!titleHero) return;
  titleHero.replaceSaber(makeCustomSaber());
  titleTrail.dispose(scene);
  titleTrail = new SaberTrail(scene, titleHero.saber.userData.trailColor);
  setSaberVoice(loadSabre().son);
}
let sabreTab = 'couleur';
function atelier() {
  state = 'menu';
  const cfg = loadSabre(), won = wonCount();
  // on s'approche de Lucas (il reste en haut de l'écran, au-dessus des choix)
  titleShot = 'atelier';
  const TABS = [['couleur', '🎨 Lame'], ['manche', '🔧 Manche'], ['forme', '⚔️ Forme'], ['effet', '✨ Effet'], ['son', '🔊 Bruit']];
  const el = screen('', '');
  el.id = 'atelier';
  const changed = (showOff) => {
    saveSabre(cfg); refitTitleSaber();
    if (showOff) { sfx.ignite(cfg.son); kataT = 0.3; }
    draw();
  };
  const draw = () => {
    const chips = SABRE[sabreTab].map((it) => {
      const locked = (it.need || 0) > won;
      const ico = locked ? '🔒' : sabreTab === 'couleur'
        ? `<i class="dot ${it.id === 'arc' ? 'arc' : ''}" style="background:#${it.c.toString(16).padStart(6, '0')}"></i>` : it.ico;
      return `<button class="chip ${cfg[sabreTab] === it.id ? 'sel' : ''} ${locked ? 'lock' : ''}" data-id="${it.id}">
        <span class="ico">${ico}</span><span>${it.nom}</span>${locked ? `<small>${it.need} mission${it.need > 1 ? 's' : ''}</small>` : ''}</button>`;
    }).join('');
    el.innerHTML = `<h2>Ton sabre-gaz</h2>
      <div class="panel">
        <input id="sabreNom" maxlength="22" placeholder="✏️ Donne un nom à ton sabre" value="${esc(cfg.nom)}">
        <div class="tabs">${TABS.map(([k, n]) => `<button class="tab ${k === sabreTab ? 'sel' : ''}" data-k="${k}">${n}</button>`).join('')}</div>
        <div class="chips">${chips}</div>
        <div class="row"><button class="btn grey" id="randBtn">🎲 Au hasard</button><button class="btn" id="okBtn">✔ C'est mon sabre !</button></div>
      </div>`;
    el.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { sfx.click(); sabreTab = b.dataset.k; draw(); }; });
    el.querySelectorAll('.chip').forEach((b) => {
      b.onclick = () => {
        const it = SABRE[sabreTab].find((x) => x.id === b.dataset.id);
        if ((it.need || 0) > won) {
          const left = it.need - won;
          sfx.click(); toast(`🔒 Gagne encore ${left} mission${left > 1 ? 's' : ''} pour débloquer « ${it.nom} » !`, 3);
          return;
        }
        cfg[sabreTab] = it.id;
        changed(true);
      };
    });
    $('sabreNom').oninput = (e) => { cfg.nom = e.target.value; saveSabre(cfg); };
    $('randBtn').onclick = () => {
      for (const k of Object.keys(SABRE)) {
        const ok = SABRE[k].filter((x) => (x.need || 0) <= won);
        cfg[k] = ok[Math.floor(Math.random() * ok.length)].id;
      }
      changed(true);
    };
    $('okBtn').onclick = () => { sfx.click(); saveSabre(cfg); title(); };
  };
  draw();
}

function missionsScreen() {
  state = 'menu';
  const cards = MISSIONS.map((m) => {
    const st = save.stars[m.id] || 0;
    const img = m.icon;
    return `<button class="card ${m.soon ? 'soon' : ''}" data-id="${m.id}">
      <img src="${img}" alt=""><b>${m.id}. ${m.name}</b><p>${m.desc}</p>
      <div class="stars">${m.soon ? 'Bientôt' : [1, 2, 3].map((i) => (i <= st ? '⭐' : '☆')).join('')}</div></button>`;
  }).join('');
  const cine = save.vue === 'cinema';
  screen(`<h2>Choisis ta mission</h2>
    <button class="btn alt vueBtn" id="vueBtn">🎥 Vue : ${cine ? 'derrière Lucas (cinéma)' : 'du dessus'}</button>
    <div class="cards">${cards}</div><button class="btn grey" id="backBtn">◀ Retour</button>`, 'dim');
  $('vueBtn').onclick = () => { sfx.click(); save.vue = cine ? 'dessus' : 'cinema'; persist(); missionsScreen(); };
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
    const img = L.who ? `<img class="who ${side}" src="assets/persos/${({ capitaine: 'soldat' })[L.who] || L.who}.webp" alt="">` : '';
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
  const part = opts.part || m.parts[0];
  const start = m.foot ? new THREE.Vector3(...m.foot.start) : new THREE.Vector3();
  cam.target.copy(start).setY(1);
  world.follow(start);
  $('hud').classList.add('hidden');
  const go = () => { noScreen(); startPart(part, { retry: !!opts.retry || part !== m.parts[0] }); };
  if (opts.retry) go();
  else { playMusic('menu'); story(m.intro, go); }
}

// un morceau de mission : à pied, en vol ou en motojet (on garde les cœurs et le gaz d'un morceau à l'autre)
function startPart(part, carry = {}) {
  if (mode) { mode.dispose(); mode = null; }
  resetHud();
  const hud = $('hud');
  hud.classList.remove('hidden', 'flight', 'speeder');
  state = 'play'; paused = false;
  modeName = part;
  const m = mission;
  if (part === 'foot') {
    const F = m.foot;
    mode = new FootMode(ctx, { script: F.script, heroPos: new THREE.Vector3(...F.start), radius: F.radius, jet: F.jet, indoor: F.indoor, cinema: save.vue === 'cinema' });
    playMusic(F.music || 'foot');
  } else if (part === 'flight') {
    if (world.wc) world.wc.visible = false;
    hud.classList.add('flight');
    $('flightHelp').classList.toggle('hidden', !touchDevice);
    const startPos = carry.startPos || (world.wcSpot ? world.wcSpot.clone() : new THREE.Vector3());
    mode = new FlightMode(ctx, { script: m.flight.script, startPos, hp: carry.hp ?? DIFF.hp, mega: carry.mega ?? 0, skipIntro: carry.retry || !world.wcSpot });
    playMusic('flight');
  } else if (part === 'versus') {
    mode = new VersusMode(ctx, {});
    playMusic('duel');
  } else if (part === 'trench') {
    hud.classList.add('flight');
    $('flightHelp').classList.toggle('hidden', !touchDevice);
    mode = new TrenchMode(ctx, { hp: carry.hp ?? DIFF.hp, mega: carry.mega ?? 0 });
    playMusic('flight');
  } else if (part === 'speeder') {
    hud.classList.add('flight', 'speeder');
    $('flightHelp').classList.toggle('hidden', !touchDevice);
    mode = new SpeederMode(ctx, { script: m.speeder.script, hp: carry.hp ?? DIFF.hp });
    playMusic(m.speeder.music || 'flight');
  }
}

function onResult(r) {
  if (r.type === 'board') {
    const hp = mode.hero.hp, mega = mode.hero.mega;
    startPart('flight', { startPos: world.wcSpot.clone(), hp, mega });
    return;
  }
  if (r.type === 'next') { // la suite de la mission (ex. : de l'espace à la tranchée), avec les mêmes cœurs
    const who = mode.ship || mode.hero || mode.player;
    startPart(r.part, { hp: who.hp, mega: who.mega });
    return;
  }
  if (r.type === 'dead') return gameOver();
  if (r.type === 'win') return win();
}

function win() {
  const hp = mode.hero ? mode.hero.hp : mode.ship ? mode.ship.hp : mode.player.hp;
  const stars = hp >= DIFF.hp * 0.66 ? 3 : hp >= DIFF.hp * 0.33 ? 2 : 1;
  save.stars[mission.id] = Math.max(save.stars[mission.id] || 0, stars);
  persist();
  state = 'outro';
  $('hud').classList.add('hidden');
  playMusic('win'); sfx.win();
  story(mission.outro, () => {
    state = 'result';
    const duel = mission === DUEL;
    const next = duel ? null : MISSIONS.find((x) => x.id === mission.id + 1 && !x.soon);
    screen(`<h2>Mission réussie !</h2>
      <div class="bigstars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">⭐</span>`).join('')}</div>
      <img class="portrait" src="assets/persos/lucas_rire.webp" alt="">
      <div class="row">${next ? '<button class="btn" id="nextBtn">Mission suivante ▶</button>' : ''}${duel ? '<button class="btn" id="againBtn">🥊 Revanche</button>' : ''}<button class="btn alt" id="menuBtn">${duel ? 'Accueil' : 'Missions'}</button></div>
      ${mission.id === 6 ? '<p class="sub">Bravo ! Tu as sauvé toute la galaxie. Que le Gaz soit avec toi !</p>' : ''}`, 'dim');
    if (duel) $('againBtn').onclick = () => { sfx.click(); startMission(DUEL, { retry: true }); };
    if (next) $('nextBtn').onclick = () => { sfx.click(); startMission(next); };
    $('menuBtn').onclick = () => { sfx.click(); clearScene(); title(); if (!duel) missionsScreen(); };
  });
}

function gameOver() {
  state = 'over';
  const failedPart = modeName;
  const inFlight = modeName !== 'foot';
  $('hud').classList.add('hidden');
  playMusic(null);
  screen(`<h2>Lucas est K.O. !</h2>
    <img class="portrait" src="assets/persos/roteur.webp" alt="">
    <p class="sub">Dark Roteur rigole… mais le Gaz est encore avec toi !</p>
    <div class="row"><button class="btn" id="retryBtn">${failedPart === 'versus' ? '🥊 Revanche' : inFlight ? 'Recommencer le vol' : 'Réessayer'}</button><button class="btn grey" id="menuBtn">Missions</button></div>`, 'dim');
  $('retryBtn').onclick = () => { sfx.click(); startMission(mission, { retry: true, part: failedPart }); };
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
  $('restartBtn').onclick = () => { sfx.click(); startMission(mission, { retry: true, part: modeName }); };
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
    titleHero.yaw = Math.sin(T * 0.4) * 0.35; // il nous fait face en se tournant un peu
    placeTitleCam(dt, T);
  }

  if (world) world.update(dt, T);
  puffs.update(dt); glows.update(dt); words.update(dt);
  placeCamera(real);

  // HUD : radio, bannière, flèche vers l'objectif
  if (radioT > 0 && !paused) { radioT -= real; if (radioT <= 0) $('radio').classList.add('hidden'); }
  if (bannerT > 0 && !paused) { bannerT -= real; if (bannerT <= 0) $('banner').classList.add('hidden'); }
  const ptr = $('pointer');
  if (pointerTarget && modeName === 'foot' && mode && mode.hero && Math.hypot(mode.hero.pos.x - pointerTarget.x, mode.hero.pos.z - pointerTarget.z) > 5) {
    _p.copy(mode.hero.pos).setY(1).project(viewCam()); _q.copy(pointerTarget).project(viewCam());
    const ang = Math.atan2(-(_q.y - _p.y) * GH, (_q.x - _p.x) * GW);
    const cx = (_p.x + 1) / 2 * GW + Math.cos(ang) * 90, cy = (1 - _p.y) / 2 * GH + Math.sin(ang) * 90;
    ptr.style.left = cx + 'px'; ptr.style.top = cy + 'px'; ptr.style.transform = `rotate(${ang}rad)`;
    ptr.classList.remove('hidden');
  } else ptr.classList.add('hidden');

  // la tranchée et l'écran titre ont leur caméra de cinéma
  renderer.render(scene, viewCam());
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
  try { gameVersion = (await fetch('version.json', { cache: 'no-store' }).then((r) => r.json())).version; } catch { /* pas de numéro en aperçu */ }
  title();
  // mises à jour automatiques de l'appli (sur l'écran titre : tout de suite ; en partie : au prochain lancement)
  autoUpdate(toast, () => state === 'title' || state === 'menu');
  // ?mission=2, ?vol ou ?ventouse pour tester directement
  const q = new URLSearchParams(location.search);
  if (q.has('mission')) startMission(MISSIONS[Number(q.get('mission')) - 1], { retry: true });
  if (q.has('vol')) startMission(MISSIONS[0], { retry: true, part: 'flight' });
  if (q.has('ventouse')) { startMission(MISSIONS[0], { retry: true, part: 'flight' }); mode.script = null; mode.boss(); }
  if (q.has('etoile')) { startMission(MISSIONS[4], { retry: true }); mode.script = null; mode.starBoss(); }
  if (q.has('tranchee')) startMission(MISSIONS[4], { retry: true, part: 'trench' });
  if (q.has('duel')) startMission(DUEL, { retry: true });
  if (q.has('bolide')) { startMission(MISSIONS[2], { retry: true }); mode.script = null; mode.boss(); }
})();

// pour les tests : faire avancer le jeu de « sec » secondes d'un coup, sans dessiner (avec le robot de tools/bot.js)
function simulate(sec) {
  const n = Math.round(sec * 30);
  for (let i = 0; i < n && state === 'play' && mode && !paused; i++) {
    const dt = 1 / 30;
    T += dt;
    readInput();
    if (window.gdgBot) window.gdgBot(input, mode, modeName);
    const r = mode.update(dt);
    clearEdges();
    if (world) world.update(dt, T);
    puffs.update(dt); glows.update(dt); words.update(dt);
    placeCamera(dt);
    if (r) onResult(r);
  }
}
window.gdg = { get mode() { return mode; }, get state() { return state; }, input, ctx, simulate };
