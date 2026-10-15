// Le duel contre Dark Roteur « à la Street Fighter » : vue de côté en 3D, barres de vie, rounds, K.O. !
// Lucas : combo de sabre (le 3e coup fait tomber), coup en avançant, coup sauté, coup de pied, parade (parfaite = contre-attaque),
//         saut périlleux arrière, la Force du Pet (repousse à distance), Prout-ken (demi-jauge) et MÉGA-PROUT (jauge pleine, petit film).
// Dark Roteur (joué par l'ordinateur) : combos, gros coup qui fait tomber, coup de pied, boule de rot, Force du Rot (il attire Lucas),
//         vague du Méga-Rot (à sauter !).
// L'arène : la salle du trône, avec le public (les amis de Lucas d'un côté, les soldats de l'autre).
// Repère : les combattants sont sur l'axe x (z = 0), le sol est à y = 0, la caméra regarde depuis +z.
import * as THREE from 'three';
import { Fighter, SaberTrail } from '../entities/fighter.js';
import { canvasTex, glowSprite, toon } from '../engine/gfx.js';
import { sfx } from '../engine/audio.js';
import { rand, clamp, pick } from './common.js';

const EDGE = 8.6, GRAV = 26, ROUND_TIME = 60, FORCE_COOL = 4;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// les coups : animation, vitesse, moment où ça touche (0..1), portée, dégâts, recul, « fait tomber », élan
const MOVES = {
  atk1: { anim: 'atk1', speed: 1.8, hit: 0.42, reach: 2.4, dmg: 6, kb: 2.5 },
  atk2: { anim: 'atk2', speed: 1.8, hit: 0.42, reach: 2.4, dmg: 6, kb: 2.5 },
  atk3: { anim: 'spinFast', speed: 1.05, hit: 0.55, reach: 2.7, dmg: 10, kb: 7, knock: true, heavy: true },
  lunge: { anim: 'stab', speed: 1.5, hit: 0.4, reach: 2.9, dmg: 9, kb: 5, dash: 8, heavy: true },
  air: { anim: 'atk3', speed: 2.0, hit: 0.33, reach: 2.4, dmg: 8, kb: 5 },
  kick: { anim: 'kick', speed: 1.7, hit: 0.42, reach: 2.0, dmg: 5, kb: 7 },
  counter: { anim: 'counter', speed: 1.6, hit: 0.35, reach: 2.6, dmg: 8, kb: 6, heavy: true },
  rheavy: { anim: 'bigChop', speed: 1.25, hit: 0.5, reach: 3.0, dmg: 11, kb: 8, dash: 4, knock: true, heavy: true },
};

const STAR_TEX = canvasTex(128, 128, (g) => {
  g.translate(64, 64); g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 16; i++) { const r = i % 2 ? 22 : 62, a = i / 16 * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill();
});

function part(geo, color, x, y, z, o = {}) {
  const g = toon(geo, color, { outline: o.outline ?? 0.06, shadow: !!o.shadow, emissive: o.emissive || 0 });
  g.position.set(x, y, z);
  if (o.rx) g.rotation.x = o.rx; if (o.ry) g.rotation.y = o.ry; if (o.rz) g.rotation.z = o.rz;
  return g;
}

export class VersusMode {
  constructor(ctx, opts = {}) {
    this.ctx = ctx; this.scene = ctx.scene; this.world = ctx.world;
    this.t = 0; this.result = null;
    this.player = { hp: ctx.diff.hp, mega: 0 }; // pour les étoiles de fin de mission
    this.root = new THREE.Group(); this.scene.add(this.root);
    // le décor de la station est caché : on construit la salle du trône (avec ses propres lumières)
    if (this.world) { this.oldWorldVis = this.world.group.visible; this.world.group.visible = false; }
    this.oldBg = this.scene.background; this.oldFog = this.scene.fog;
    this.scene.background = new THREE.Color(0x120a1c);
    this.scene.fog = new THREE.Fog(0x120a1c, 40, 90);
    this.fx = []; this.crowd = []; this.spots = []; this.waves = [];
    this.buildArena();
    this.cam3 = new THREE.PerspectiveCamera(40, ctx.aspect(), 0.1, 300);
    this.camPos = new THREE.Vector3(0, 9, 26);
    this.shakeT = 0; this.slow = 0; this.freeze = 0; this.zoomKick = 0;
    // les deux combattants
    this.L = this.makeFighter('lucas', 2.0, -3, 1, 100);
    this.R = this.makeFighter('roteur', 2.6, 3, -1, 100);
    this.R.ai = { t: 0.8, plan: null, ballCool: 3 };
    this.L.other = this.R; this.R.other = this.L;
    this.shots = [];
    this.round = 1; this.winsL = 0; this.winsR = 0;
    this.buildHud();
    this.startRound();
  }

  // ---------- la salle du trône de Dark Roteur ----------
  buildArena() {
    const g = this.root;
    // lumières de spectacle
    const hemi = new THREE.HemisphereLight(0xd8ccff, 0x2a1a3a, 1.25);
    const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
    key.position.set(6, 14, 12); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -6, near: 1, far: 50 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
    const rimG = new THREE.PointLight(0x7dff4a, 40, 30, 1.6); rimG.position.set(-10, 5, -4);
    const rimP = new THREE.PointLight(0xc070ff, 40, 30, 1.6); rimP.position.set(10, 5, -4);
    g.add(hemi, key, key.target, rimG, rimP);
    // le sol : une grande estrade ronde à damier, avec un tourbillon de gaz au milieu
    const floorTex = canvasTex(1024, 1024, (c, w) => {
      const cx = w / 2;
      c.fillStyle = '#3b2a52'; c.fillRect(0, 0, w, w);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { if ((i + j) % 2) { c.fillStyle = '#4a3666'; c.fillRect(i * 64, j * 64, 64, 64); } }
      c.strokeStyle = 'rgba(20,10,30,.6)'; c.lineWidth = 3;
      for (let i = 0; i <= 16; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, w); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); }
      for (const [r, col, lw] of [[480, '#8fff5a', 14], [440, '#2a1f3a', 8], [220, '#b04cff', 10]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(cx, cx, r, 0, Math.PI * 2); c.stroke(); }
      c.strokeStyle = 'rgba(143,255,90,.75)'; c.lineWidth = 16; c.lineCap = 'round';
      for (let k = 0; k < 3; k++) { c.beginPath(); for (let a = 0; a < 5.2; a += 0.05) { const r = 20 + a * 32; const t = a + k * Math.PI * 2 / 3; c.lineTo(cx + Math.cos(t) * r, cx + Math.sin(t) * r); } c.stroke(); }
    });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(13, 13.6, 0.8, 64), [
      new THREE.MeshToonMaterial({ color: 0x2a1f3a }), new THREE.MeshToonMaterial({ map: floorTex }), new THREE.MeshToonMaterial({ color: 0x2a1f3a })]);
    floor.position.y = -0.4; floor.receiveShadow = true; g.add(floor);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(13.3, 0.18, 8, 80).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fff5a }));
    edge.position.y = 0.02; g.add(edge);
    const below = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0c0714 }));
    below.position.y = -1.5; g.add(below);
    // le grand mur courbe du fond, avec sa fenêtre sur l'espace
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 22, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      new THREE.MeshToonMaterial({ color: 0x2c2140, side: THREE.BackSide }));
    wall.position.set(0, 10, 6); g.add(wall);
    for (let i = 0; i < 9; i++) { // nervures métalliques
      const a = Math.PI * 0.62 + Math.PI * 0.76 * (i / 8);
      g.add(part(new THREE.BoxGeometry(0.8, 22, 0.8), 0x4b3a66, Math.sin(a) * 23.4, 10, 6 + Math.cos(a) * 23.4, { ry: a }));
    }
    const spaceTex = canvasTex(1024, 1024, (c, w) => {
      const gr = c.createRadialGradient(w / 2, w / 2, 50, w / 2, w / 2, w / 2);
      gr.addColorStop(0, '#2a1450'); gr.addColorStop(1, '#07040f'); c.fillStyle = gr; c.fillRect(0, 0, w, w);
      for (const [x, y, r, col] of [[300, 380, 260, 'rgba(176,76,255,.35)'], [720, 620, 300, 'rgba(111,224,74,.22)'], [620, 260, 180, 'rgba(255,106,213,.18)']]) {
        const n = c.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = n; c.fillRect(0, 0, w, w);
      }
      for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.9 + 0.1})`; const s = Math.random() < 0.1 ? 3 : 1.5; c.fillRect(Math.random() * w, Math.random() * w, s, s); }
      const p = c.createRadialGradient(610, 470, 20, 650, 520, 190); p.addColorStop(0, '#c8ff9a'); p.addColorStop(0.6, '#4fc23a'); p.addColorStop(1, '#1c5a20');
      c.fillStyle = p; c.beginPath(); c.arc(650, 520, 180, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(230,255,200,.7)'; c.lineWidth = 14; c.beginPath(); c.ellipse(650, 520, 300, 70, -0.3, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#d8d0e8'; c.beginPath(); c.arc(300, 300, 60, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(320, 290, 50, 0, Math.PI * 2); c.fill();
    });
    const win = new THREE.Mesh(new THREE.CircleGeometry(8.5, 64), new THREE.MeshBasicMaterial({ map: spaceTex, fog: false }));
    win.position.set(0, 11.5, -17.2); g.add(win);
    g.add(part(new THREE.TorusGeometry(8.6, 0.6, 12, 64), 0x8d8f99, 0, 11.5, -17.1, { outline: 0.1 }));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(part(new THREE.BoxGeometry(0.4, 1.4, 0.5), 0x5a4a6e, Math.cos(a) * 8.6, 11.5 + Math.sin(a) * 8.6, -17, { rz: a + Math.PI / 2, outline: 0.04 })); }
    // le trône-toilettes de Dark Roteur (à droite, derrière)
    const throne = new THREE.Group();
    throne.add(part(new THREE.CylinderGeometry(1.6, 1.25, 1.6, 24), 0xe9ece6, 0, 0.8, 0));
    throne.add(part(new THREE.TorusGeometry(1.45, 0.28, 10, 28), 0x6a2f8f, 0, 1.65, 0, { rx: Math.PI / 2 }));
    throne.add(part(new THREE.BoxGeometry(3, 3.8, 0.8), 0x6a2f8f, 0, 2.6, -1.2));
    for (const s of [-1, 1]) throne.add(part(new THREE.ConeGeometry(0.3, 1, 8), 0xffd23f, s * 1.1, 4.9, -1.2));
    throne.position.set(10.5, 0, -9); throne.rotation.y = -0.4; g.add(throne);
    // les cuves de gaz vert qui fument (côtés)
    this.vents = [];
    for (const [x, z] of [[-14, -4], [14, -2], [-11, -11]]) {
      const v = new THREE.Group();
      v.add(part(new THREE.CylinderGeometry(1.3, 1.5, 3, 18), 0x5a3a66, 0, 1.5, 0));
      for (const y of [0.6, 2.4]) v.add(part(new THREE.TorusGeometry(1.42, 0.12, 6, 24), 0x8d8f99, 0, y, 0, { rx: Math.PI / 2, outline: 0.03 }));
      const goo = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fdc3c }));
      goo.position.y = 3.02; v.add(goo);
      v.position.set(x, 0, z); g.add(v);
      this.vents.push({ x, z, t: rand(0, 2) });
    }
    // les gradins du public
    for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
      g.add(part(new THREE.BoxGeometry(9, 1 + row * 1.4, 2.4), row ? 0x3a2b52 : 0x46355f, side * 9.5, (1 + row * 1.4) / 2, -12 - row * 2.6, { ry: -side * 0.35 }));
    }
    const loader = new THREE.TextureLoader();
    const addFan = (name, x, y, z, h, phase) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.4 }));
      const tex = loader.load(`assets/persos/${name}.webp`, (t) => { s.scale.set(h * t.image.width / t.image.height, h, 1); });
      tex.colorSpace = THREE.SRGBColorSpace;
      s.material.map = tex; s.material.needsUpdate = true;
      s.scale.set(h * 0.8, h, 1);
      s.center.set(0.5, 0);
      s.position.set(x, y, z); g.add(s);
      this.crowd.push({ s, y0: y, ph: phase, vy: 0, dy: 0, fan: name });
    };
    // les amis de Lucas à gauche, les soldats de Dark Roteur à droite
    addFan('gazou', -12.2, 1, -11.4, 2.2, 0); addFan('hanpopo', -9.6, 1, -12.4, 2.7, 1);
    addFan('pqr', -7.4, 1, -13, 2.6, 2); addFan('r2wc', -11.2, 2.4, -14.2, 1.9, 3);
    addFan('lucas_rire', -8.6, 2.4, -15, 1.9, 4);
    for (let i = 0; i < 6; i++) addFan('soldat', 7 + (i % 3) * 2.2 + (i > 2 ? 1 : 0), 1 + (i > 2 ? 1.4 : 0), -12 - (i > 2 ? 2.6 : 0) + (i % 3) * -0.6, 2.4, i);
    // deux projecteurs qui balayent la scène
    for (const s of [-1, 1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 16, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: s < 0 ? 0xb8ff9a : 0xe2b8ff, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      cone.geometry.translate(0, -8, 0);
      const pivot = new THREE.Group(); pivot.position.set(s * 6, 16, -2); pivot.add(cone); g.add(pivot);
      this.spots.push({ pivot, s });
    }
  }

  makeFighter(kind, height, x, face, hp) {
    const f = new Fighter(kind, height);
    f.setSaberOn(1); f.setBase('guard');
    f.root.traverse((o) => { if (o.isMesh && o.visible) o.castShadow = true; });
    this.scene.add(f.root);
    const trail = new SaberTrail(this.scene, kind === 'lucas' ? f.saber.userData.trailColor : 0xb04cff, 18);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(kind === 'lucas' ? 1.35 : 1.7, 24, 16),
      new THREE.MeshBasicMaterial({ color: kind === 'lucas' ? 0x6fd3ff : 0xc38bff, transparent: true, opacity: 0, depthWrite: false }));
    shield.renderOrder = 4;
    this.root.add(shield);
    return { kind, f, trail, shield, shieldGlow: 0, x, y: 0, vx: 0, vy: 0, face, hp, maxHp: hp, shown: hp, state: 'idle', move: null, mt: 0,
      combo: 0, hits: 0, hitsT: 0, stun: 0, blocking: false, blockAge: 9, gauge: 0, startX: x, inv: 0, downT: 0, flip: null, forceCool: 1.5 };
  }

  // ---------- l'affichage : barres de vie, chrono, boutons ----------
  buildHud() {
    const el = this.hud = document.createElement('div');
    el.id = 'vs';
    el.innerHTML = `
      <div class="vsTop">
        <div class="vsSide L"><img src="assets/portraits/lucas.webp" alt=""><div><b>LUCAS</b><div class="vsBar"><u></u><i></i></div><div class="vsGauge"><i></i><em></em></div><span class="pips"></span></div></div>
        <div class="vsTime">60</div>
        <div class="vsSide R"><div><b>DARK ROTEUR</b><div class="vsBar"><u></u><i></i></div><div class="vsGauge"><i></i><em></em></div><span class="pips"></span></div><img src="assets/portraits/roteur.webp" alt=""></div>
      </div>
      <div class="vsCombo L hidden"></div><div class="vsCombo R hidden"></div>
      <div class="vsSplash hidden"><img class="a" src="assets/persos/lucas.webp" alt=""><b>VS</b><img class="b" src="assets/persos/roteur.webp" alt=""></div>
      <div class="vsBanner hidden"></div>
      <div class="vsPad left">
        <button data-k="left">◀</button><button data-k="jump">▲</button><button data-k="right">▶</button>
      </div>
      <div class="vsPad right">
        <button data-k="special" class="sp"><span>💨</span><b>PROUT</b></button>
        <button data-k="force" class="fo"><i></i><span>✋</span><b>FORCE</b></button>
        <button data-k="kick" class="ki"><span>🦶</span><b>PIED</b></button>
        <button data-k="block" class="bl"><span>🛡️</span><b>PARER</b></button>
        <button data-k="attack" class="at"><span>⚔️</span><b>SABRE</b></button>
      </div>`;
    document.getElementById('game').appendChild(el);
    this.keys = { left: false, right: false, block: false };
    this.taps = { jump: false, attack: false, special: false, kick: false, force: false };
    el.querySelectorAll('.vsPad button').forEach((b) => {
      const k = b.dataset.k;
      const down = (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch { /* rien */ } b.classList.add('down'); if (k in this.keys) this.keys[k] = true; else this.taps[k] = true; };
      const up = () => { b.classList.remove('down'); if (k in this.keys) this.keys[k] = false; };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    // au clavier : R = la Force du Pet
    this.onKey = (e) => { if (e.code === 'KeyR' && !e.repeat) this.taps.force = true; };
    addEventListener('keydown', this.onKey);
    document.getElementById('hud').classList.add('versus');
  }
  updateHud(dt) {
    const q = (s) => this.hud.querySelector(s);
    for (const [P, s] of [[this.L, '.L'], [this.R, '.R']]) {
      P.shown += (P.hp - P.shown) * Math.min(1, dt * (P.shown > P.hp ? 2.2 : 10)); // la barre rouge qui descend doucement
      q(s + ' .vsBar i').style.width = Math.max(0, P.hp / P.maxHp * 100) + '%';
      q(s + ' .vsBar u').style.width = Math.max(0, P.shown / P.maxHp * 100) + '%';
      q(s + ' .vsGauge i').style.width = Math.min(1, P.gauge) * 100 + '%';
      q(s + ' .vsGauge').classList.toggle('full', P.gauge >= 1);
      q(s + ' .pips').textContent = '★'.repeat(P === this.L ? this.winsL : this.winsR);
    }
    const sp = q('[data-k=special]');
    sp.classList.toggle('ready', this.L.gauge >= 0.5);
    sp.classList.toggle('mega', this.L.gauge >= 1);
    sp.querySelector('b').textContent = this.L.gauge >= 1 ? 'MÉGA !' : 'PROUT';
    const fo = q('[data-k=force]');
    fo.classList.toggle('ready', this.L.forceCool <= 0);
    fo.querySelector('i').style.height = Math.max(0, this.L.forceCool / FORCE_COOL) * 100 + '%';
    q('.vsTime').textContent = Math.max(0, Math.ceil(this.timeLeft));
  }
  banner(text, dur = 1.5, cls = '') {
    const b = this.hud.querySelector('.vsBanner');
    b.textContent = text; b.className = 'vsBanner ' + cls;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bannerH);
    this.bannerH = setTimeout(() => b.classList.add('hidden'), dur * 1000);
  }
  showCombo(P) {
    const el = this.hud.querySelector(P === this.L ? '.vsCombo.L' : '.vsCombo.R');
    if (P.hits < 2) { el.classList.add('hidden'); return; }
    el.innerHTML = `<b>${P.hits}</b> COUPS !`;
    el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }

  // ---------- les rounds ----------
  startRound() {
    for (const P of [this.L, this.R]) {
      Object.assign(P, { x: P.startX, y: 0, vx: 0, vy: 0, hp: P.maxHp, shown: P.maxHp, state: 'idle', move: null, stun: 0, blocking: false, combo: 0, inv: 0, hits: 0, flip: null, rising: false, forceCool: 1.5 });
      P.face = P === this.L ? 1 : -1;
      P.f.stopAction(); P.f.setBase('guard'); P.f.guard = false;
      P.f.model.rotation.set(0, 0, 0); P.f.model.position.set(0, 0, 0);
    }
    for (const s of this.shots) this.root.remove(s.o);
    this.shots = [];
    this.timeLeft = ROUND_TIME;
    this.phase = 'intro'; this.phaseT = this.round === 1 ? 3.6 : 2.2;
    this.camPos.set(0, 7, 22);
    const go = () => {
      this.banner(this.winsL === 1 && this.winsR === 1 ? 'DERNIER ROUND !' : `ROUND ${this.round}`, 1.2);
      setTimeout(() => { if (this.phase === 'intro') { this.banner('COMBAT !', 0.9, 'fight'); sfx.alarm(); } }, 1200);
    };
    if (this.round === 1) {
      const sp = this.hud.querySelector('.vsSplash');
      sp.classList.remove('hidden');
      setTimeout(() => sp.classList.add('hidden'), 1400);
      setTimeout(go, 1400);
      this.R.f.play('cheer', 1.2); // il se moque de Lucas
      this.ctx.hud.radio('roteur', 'En garde, petit rigolo ! Je vais te faire roter de peur ! BUUURP !', 3.5);
      sfx.burp();
    } else go();
    this.updateHud(1);
  }

  endRound(winner, why) {
    this.phase = 'ko'; this.phaseT = 3.4;
    const loser = winner.other;
    if (winner === this.L) this.winsL++; else this.winsR++;
    this.banner(why === 'time' ? 'TEMPS !' : 'K.O. !', 2.2, 'ko');
    if (why !== 'time') { this.slow = 1.4; sfx.boom(); this.ctx.flash(0.6); this.shakeT = 0.5; this.cheer(winner === this.L ? -1 : 1, 1); }
    loser.state = 'ko'; loser.flip = null; loser.f.model.rotation.set(0, 0, 0); loser.f.model.position.set(0, 0, 0); loser.f.play('death2', 1.1); loser.f.guard = false;
    winner.state = 'win'; winner.f.guard = false;
    setTimeout(() => { if (winner.state === 'win') { winner.f.play('cheer', 1); sfx.win(); } }, 1300);
    if (winner === this.L) this.ctx.hud.radio('lucas_rire', pick(['Ha ha ! Pris dans le gaz !', 'Prrrout ! Gagné !', 'Que le Gaz soit avec moi !']), 2.5);
    else this.ctx.hud.radio('roteur', pick(['BUUURP ! Trop facile !', 'Ha ha ha ! Le côté obscur du rot !']), 2.5);
  }

  // le public saute de joie (side : -1 les amis de Lucas, +1 les soldats)
  cheer(side, k = 0.6) {
    for (const c of this.crowd) if ((c.fan === 'soldat') === (side > 0) && Math.random() < k + 0.3) c.vy = rand(3, 6) * k;
    if (k > 0.5) sfx.crowd();
  }

  // les mots (PAF !, CLANG !) : plus petits ici, la caméra est tout près
  pop(text, pos, color, size) { this.ctx.words.pop(text, pos, color, size * 0.55); }

  // ---------- des effets qui claquent ----------
  spark(pos, color, big) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: STAR_TEX, color, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
    s.position.copy(pos); s.renderOrder = 15; s.material.rotation = rand(0, 3);
    this.root.add(s);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, side: THREE.DoubleSide }));
    ring.position.copy(pos); ring.renderOrder = 15; ring.lookAt(this.cam3.position);
    this.root.add(ring);
    this.fx.push({ s, ring, t: 0, big });
    this.ctx.glows.burst(pos.x, pos.y, pos.z, color, big ? 14 : 8, big ? 9 : 6, { life: 0.35, s0: 0.5, s1: 0.1, grav: 10 });
  }

  // ---------- la Force du Pet (Lucas) / la Force du Rot (Dark Roteur) ----------
  force(P) {
    const lucas = P === this.L, O = P.other;
    P.forceCool = FORCE_COOL;
    P.state = 'attack'; P.move = { name: 'force', done: true }; P.f.guard = false;
    P.mt = P.f.play('spell', 1.5, 0.75); P.move.len = P.mt;
    sfx.deflate(); sfx.whoosh();
    this.banner(lucas ? 'LA FORCE DU PET !' : 'LA FORCE DU ROT !', 1.1, 'small');
    // des ondes de gaz qui partent de la main
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 8, 28), new THREE.MeshBasicMaterial({ color: lucas ? 0x9bff6a : 0xc38bff, transparent: true, opacity: 0.8, depthWrite: false }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(P.x + P.face * 1, P.y + 1.3, 0);
      this.root.add(ring);
      this.waves.push({ o: ring, x: P.x + P.face * 1, vx: P.face * (lucas ? 16 : -16), t: -i * 0.07, dir: P.face });
    }
    setTimeout(() => {
      if (this.phase !== 'fight' || P.state === 'ko') return;
      // les boules en face sont renvoyées
      for (const s of this.shots) if (s.owner === O && (s.x - P.x) * P.face > 0 && Math.abs(s.x - P.x) < 8 && s.kind !== 'mega') { s.vx = -s.vx * 1.2; s.owner = P; }
      const dx = (O.x - P.x) * P.face;
      if (lucas) { // Lucas repousse Dark Roteur
        if (dx > 0 && dx < 7.5 && O.state !== 'ko' && O.state !== 'down') {
          if (O.blocking && O.face === -P.face) { O.vx = P.face * 6; O.shieldGlow = 1; this.pop('IL RÉSISTE !', _a.set(O.x, O.y + 3, 0.5).clone(), '#c38bff', 1.3); }
          else {
            O.hp -= 5; O.state = 'down'; O.downT = 1.9; O.vx = P.face * 15; O.vy = 7; O.move = null; O.blocking = false; O.f.guard = false;
            O.f.play('death', 1.3); O.f.flash = 1;
            this.pop('WOUUUSH !', _a.set(O.x, O.y + 3, 0.5).clone(), '#8fff5a', 1.8);
            this.shakeT = 0.3; this.cheer(-1, 0.8);
            if (O.hp <= 0) { O.hp = 0; this.endRound(P, 'ko'); }
          }
        }
      } else if (dx > 2.5 && dx < 11 && O.state !== 'ko' && O.state !== 'down') { // Dark Roteur attire Lucas vers lui
        if (O.blocking && O.face === -P.face) { O.shieldGlow = 1; this.pop('TIENS BON !', _a.set(O.x, O.y + 3, 0.5).clone(), '#6fd3ff', 1.3); }
        else { O.vx = -P.face * 13; O.vy = 4; O.y = 0.01; O.state = 'hit'; O.stun = 0.5; O.f.play('hit', 1); this.pop('ATTIRÉ !', _a.set(O.x, O.y + 3, 0.5).clone(), '#c38bff', 1.4); }
      }
    }, 200);
  }

  // ---------- un coup ----------
  startMove(P, name) {
    const M = MOVES[name];
    P.move = { ...M, name, done: false };
    P.mt = P.f.play(M.anim, M.speed, 0.85);
    P.move.len = P.mt;
    P.state = 'attack'; P.f.guard = false;
    if (P === this.L) sfx.swing(1 + P.combo * 0.12); else sfx.swing(0.8, 'classique');
    if (M.dash) P.vx = P.face * M.dash;
  }
  special(P, mega) {
    P.state = 'attack'; P.move = { name: 'special', done: false }; P.f.guard = false;
    const lucas = P === this.L;
    if (mega) {
      // le super coup : un petit film (tout s'arrête, la caméra s'approche)
      P.gauge = 0;
      this.phase = 'super'; this.phaseT = 1.3; this.superBy = P;
      P.mt = P.f.play('raise', 1.6, 0.62); P.move.len = P.mt;
      this.hud.classList.add('dark');
      this.banner(lucas ? 'MÉGA-PROUT !' : 'MÉGA-ROT !', 1.3, 'super');
      if (lucas) { sfx.mega(); this.ctx.hud.radio('lucas', 'Que le Gaz soit avec moi… MÉGA-PROUUUT !', 2); } else { sfx.burp(); this.ctx.hud.radio('roteur', 'Goûte à mon MÉGA-ROOOT !', 2); }
      return;
    }
    if (lucas) { P.gauge -= 0.5; this.banner('PROUT-KEN !', 0.9, 'small'); }
    P.mt = P.f.play('spell', 1.4, 0.7); P.move.len = P.mt;
    setTimeout(() => { if (P.state === 'attack' && this.phase === 'fight') this.throwBall(P, lucas ? 'prout' : 'rot'); }, 280);
  }
  throwBall(P, kind) {
    const o = new THREE.Group();
    const col = { prout: 0x7dff4a, rot: 0xb04cff, wave: 0xd38bff, mega: 0x7dff4a }[kind];
    if (kind === 'wave') {
      o.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 })));
      o.add(glowSprite(col, 3, 0.8));
    } else {
      const r = kind === 'mega' ? 1.3 : 0.45;
      o.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshBasicMaterial({ color: kind === 'rot' ? 0xf3dcff : 0xeaffd8 })));
      o.add(glowSprite(col, kind === 'mega' ? 7 : 2.6, 0.95));
    }
    const y = kind === 'wave' ? 0.1 : P.y + 1.3;
    o.position.set(P.x + P.face * 1.2, y, 0);
    this.root.add(o);
    const S = { prout: [11, 13], rot: [10, 9], wave: [8, 12], mega: [13, 24] }[kind];
    this.shots.push({ o, kind, owner: P, x: o.position.x, y, vx: P.face * S[0], dmg: S[1], life: 3, r: kind === 'mega' ? 1.6 : 0.9 });
    if (kind === 'prout' || kind === 'mega') sfx.mega(); else sfx.burp();
  }

  // P se fait toucher par A
  hitBy(P, A, dmg, kb, opt = {}) {
    if (P.state === 'ko' || P.state === 'down' || this.phase !== 'fight' || P.inv > 0) return false;
    const dirHit = opt.dir || A.face;
    const facing = P.face === -dirHit;
    const pos = _a.set(P.x - dirHit * 0.3, P.y + 1.4, 0.4).clone();
    const guarding = P.y < 0.2 && (P.blocking || (P.wantBlock && !(P.state === 'attack' && P.move && !P.move.done)));
    if (guarding && facing) {
      P.state = 'idle'; P.move = null; P.blocking = true; P.shieldGlow = 1;
      P.hp -= Math.round(dmg * (opt.mega ? 0.3 : 0.1)); P.vx = -P.face * kb * 0.5; P.stun = 0.15;
      sfx.clash(); this.spark(pos, 0xfff2a0, false);
      this.freeze = 0.05;
      P.gauge = Math.min(1, P.gauge + 0.06);
      // parade parfaite (bouton appuyé juste avant le coup) : contre-attaque automatique !
      if (P.blockAge < 0.25 && !opt.shot && A) {
        this.pop('PARADE PARFAITE !', pos.clone().setY(pos.y + 1), '#6fd3ff', 1.6);
        P.gauge = Math.min(1, P.gauge + 0.1);
        setTimeout(() => { if (this.phase === 'fight' && P.state === 'idle') { P.blocking = false; this.startMove(P, 'counter'); } }, 120);
      } else this.pop('CLANG !', pos, '#ffd23f', 1.1);
      if (P.hp <= 0) { P.hp = 0; this.endRound(P.other, 'ko'); }
      return true;
    }
    const mult = P === this.R ? 1.35 : 1; // Lucas tape un peu plus fort (c'est un jeu pour enfants)
    P.hp -= Math.round(dmg * mult);
    P.vx = dirHit * kb; P.vy = P.y > 0.1 ? 5 : 0;
    P.move = null; P.blocking = false; P.f.guard = false;
    if (P.flip) { P.flip = null; P.f.model.rotation.set(0, 0, 0); P.f.model.position.set(0, 0, 0); }
    const heavy = opt.heavy || opt.knock;
    if (opt.knock || P.y > 0.5) { // il tombe par terre
      P.state = 'down'; P.downT = 1.9; P.vy = Math.max(P.vy, 4); P.vx = dirHit * kb * 1.2;
      P.f.play('death', 1.4); this.ctx.puffs.burst(P.x, 0.3, 0, 0xb8a6d8, 10, 4, { life: 0.7, s0: 0.6, s1: 1.8 });
    } else { P.stun = 0.38; P.state = 'hit'; P.f.play(Math.random() < 0.5 ? 'hit' : 'hit2', 1.3, 0.9); }
    P.f.flash = 1;
    if (P === this.L) sfx.hurt(); else sfx.hit();
    if (heavy) sfx.boom();
    this.pop(pick(heavy ? ['BAAAM !', 'BOUM !', 'PROUUUT !'] : ['PAF !', 'BAM !', 'POUF !']), pos.clone().setY(pos.y + 0.6), P === this.R ? '#8fff5a' : '#ff8a3d', heavy ? 1.9 : 1.3);
    this.spark(pos, P === this.R ? 0xb8ff7a : 0xffa060, heavy);
    this.ctx.puffs.burst(pos.x, pos.y, 0.3, P === this.R ? 0xc38be8 : 0x9be36b, 8, 4, { life: 0.5, s0: 0.4, s1: 1.2 });
    this.freeze = heavy ? 0.13 : 0.07; this.shakeT = heavy ? 0.3 : 0.15; this.zoomKick = heavy ? 1 : 0.4;
    if (A) {
      A.gauge = Math.min(1, A.gauge + (A === this.L ? 0.12 : 0.08));
      A.hits = A.hitsT > 0 ? A.hits + 1 : 1; A.hitsT = 1.3; this.showCombo(A);
    }
    P.gauge = Math.min(1, P.gauge + 0.07);
    this.cheer(P === this.R ? -1 : 1, heavy ? 0.8 : 0.4);
    if (P.hp <= 0) { P.hp = 0; this.endRound(P.other, 'ko'); }
    return true;
  }

  // ---------- un combattant à chaque image ----------
  step(P, dt, ctl) {
    const O = P.other;
    P.wantBlock = ctl.block;
    P.blockAge = ctl.block ? P.blockAge + dt : 0;
    P.inv -= dt; P.hitsT -= dt; P.forceCool -= dt;
    if (P.hitsT <= 0 && P.hits) { P.hits = 0; this.showCombo(P); }
    const onGround = P.y <= 0.001;
    if (P.state === 'ko' || P.state === 'win') {
      P.vx *= Math.exp(-dt * 5);
    } else if (P.state === 'down') { // par terre… puis il se relève
      P.downT -= dt; P.vx *= Math.exp(-dt * 4);
      if (P.downT < 1.0 && !P.rising) { P.rising = true; P.f.play('standUp', 2.3); }
      if (P.downT <= 0) { P.state = 'idle'; P.rising = false; P.inv = 0.5; }
    } else if (P.state === 'hit') {
      P.stun -= dt; P.vx *= Math.exp(-dt * 6);
      if ((P.stun <= 0 || (ctl.block && P.stun < 0.25)) && onGround) P.state = 'idle'; // « parer » fait se reprendre plus vite
    } else if (P.state === 'attack') {
      P.mt -= dt;
      if (P.move && P.move.reach && !P.move.done && P.mt <= P.move.len * (1 - P.move.hit)) {
        P.move.done = true;
        const dx = (O.x - P.x) * P.face;
        if (dx > -0.4 && dx < P.move.reach && Math.abs(O.y - P.y) < 1.9) this.hitBy(O, P, P.move.dmg, P.move.kb, { knock: P.move.knock, heavy: P.move.heavy });
      }
      if (onGround) P.vx *= Math.exp(-dt * 7);
      if (P.mt <= 0 || (ctl.block && P.move && P.move.done && onGround)) { P.state = 'idle'; P.move = null; }
      // on peut enchaîner : un nouveau coup pendant la fin du coup = combo
      if (ctl.attack && P.move && P.move.done && P.mt < P.move.len * 0.4 && ['atk1', 'atk2'].includes(P.move.name)) {
        P.combo = P.move.name === 'atk1' ? 1 : 2;
        this.startMove(P, P.combo === 1 ? 'atk2' : 'atk3');
      }
    } else {
      // libre : bouger, sauter, parer, attaquer
      P.blocking = ctl.block && onGround;
      P.f.guard = P.blocking; // le sabre bien droit devant lui
      const toward = Math.sign(O.x - P.x) || P.face;
      if (onGround) {
        P.face = toward;
        if (P.blocking) P.vx = 0;
        else P.vx = ctl.move * (P === this.R ? 3.8 : 4.6);
        if (ctl.jump && !P.blocking) {
          P.vy = 10.5; P.y = 0.01; sfx.jump();
          if (ctl.move * P.face < -0.3) { // saut périlleux arrière : il s'enroule en boule
            P.vx = -P.face * 5.5; P.flip = { t: 0, dur: 0.78 };
            P.f.stopAction(); P.f.setBase('sit');
            this.pop('HOP !', _a.set(P.x, 3.2, 0.5).clone(), '#6fd3ff', 1);
          } else { P.vx = ctl.move * 5.2; P.f.play('jumpAir', 1, 9); }
        }
      }
      if (ctl.force && P.forceCool <= 0) { P.blocking = false; this.force(P); }
      else if (ctl.special) {
        if (P === this.R) this.special(P, false);
        else if (P.gauge >= 1) this.special(P, true);
        else if (P.gauge >= 0.5) this.special(P, false);
      } else if (ctl.attack) {
        P.blocking = false;
        if (!onGround) this.startMove(P, 'air');
        else if (ctl.move * P.face > 0.5) this.startMove(P, 'lunge');
        else { P.combo = 0; this.startMove(P, 'atk1'); }
      } else if (ctl.kick) { P.blocking = false; this.startMove(P, 'kick'); }
      else if (ctl.heavy && onGround) this.startMove(P, 'rheavy');
      // la pose
      if (onGround && P.state !== 'attack') {
        if (P.blocking) P.f.setBase('block');
        else if (Math.abs(P.vx) > 0.3) P.f.setBase(P.vx * P.face > 0 ? 'walk' : 'walkBack', 1.3);
        else P.f.setBase('guard');
      }
    }
    // déplacement, gravité, bords
    P.x += P.vx * dt;
    if (P.y > 0 || P.vy > 0) {
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      if (P.y <= 0) {
        P.y = 0; P.vy = 0;
        if (P.flip) { P.flip = null; P.f.model.rotation.set(0, 0, 0); P.f.model.position.set(0, 0, 0); P.f.setBase('guard'); }
        if (P.state !== 'ko' && P.state !== 'down') { P.f.play('jumpLand', 1.6, 0.6); sfx.land(); if (P.state === 'attack' && P.move && P.move.name === 'air') { P.state = 'idle'; P.move = null; } }
        else if (P.state === 'down') { this.ctx.puffs.burst(P.x, 0.2, 0, 0xb8a6d8, 12, 5, { life: 0.8, s0: 0.7, s1: 2 }); this.shakeT = 0.2; sfx.land(); }
      }
    }
    // la pirouette : il tourne sur lui-même en arrière, roulé en boule
    if (P.flip) {
      P.flip.t += dt;
      const k = Math.min(1, P.flip.t / P.flip.dur), th = -k * Math.PI * 2, c = 0.9;
      P.f.model.rotation.x = th;
      P.f.model.position.set(0, c - c * Math.cos(th), -c * Math.sin(th));
      if (Math.random() < 0.6) this.ctx.puffs.emit(P.x, P.y + 1, 0, 0x9be36b, { vy: -1, life: 0.4, s0: 0.4, s1: 1 });
    }
    P.x = clamp(P.x, -EDGE, EDGE);
    // l'apparence
    P.f.root.position.set(P.x, P.y, 0);
    const yaw = P.face > 0 ? Math.PI / 2 - 0.45 : -Math.PI / 2 + 0.45; // de profil, un peu tourné vers nous
    P.f.yaw += (yaw - P.f.yaw) * Math.min(1, dt * 14);
    P.f.update(dt);
    P.f.saberEnds(_a, _b); P.trail.push(_a, _b, P.state === 'attack');
    P.shieldGlow = Math.max(0, P.shieldGlow - dt * 3);
    const want = P.blocking ? 0.22 + P.shieldGlow * 0.5 : P.shieldGlow * 0.5;
    P.shield.material.opacity += (want - P.shield.material.opacity) * Math.min(1, dt * 14);
    P.shield.visible = P.shield.material.opacity > 0.01;
    P.shield.position.set(P.x, P.y + (P.kind === 'lucas' ? 1.15 : 1.4), 0);
    P.shield.scale.setScalar(1 + P.shieldGlow * 0.15);
  }

  // ---------- l'ordinateur joue Dark Roteur ----------
  think(dt) {
    const R = this.R, L = this.L, A = R.ai;
    const ctl = { move: 0, attack: false, block: false, jump: false, special: false, heavy: false, kick: false, force: false };
    if (this.phase !== 'fight' || R.state === 'ko') return ctl;
    const d = Math.abs(L.x - R.x), toward = Math.sign(L.x - R.x);
    const rage = R.hp < R.maxHp * 0.35;
    A.t -= dt; A.ballCool -= dt;
    // parer quand Lucas attaque tout près (pas à tous les coups !)
    if (L.state === 'attack' && d < 3.2 && R.state !== 'attack') {
      if (A.blockRoll === undefined) A.blockRoll = Math.random() < (rage ? 0.42 : 0.3);
      if (A.blockRoll) { ctl.block = true; return ctl; }
    } else A.blockRoll = undefined;
    // son super coup quand sa jauge est pleine : la vague du Méga-Rot (il faut sauter !)
    if (R.gauge >= 1 && R.state === 'idle' && d > 2.5) {
      R.gauge = 0;
      this.banner('MÉGA-ROT ! SAUTE !', 1.4, 'super');
      this.ctx.hud.radio('roteur', 'MÉGA-ROOOOOT !', 2);
      R.state = 'attack'; R.move = { name: 'wave', done: false };
      R.mt = R.f.play('raise', 1.5, 0.6); R.move.len = R.mt;
      setTimeout(() => { if (R.state === 'attack' && this.phase === 'fight') this.throwBall(R, 'wave'); }, 700);
      return ctl;
    }
    if (A.plan && A.plan.t > 0) {
      A.plan.t -= dt;
      Object.assign(ctl, A.plan.ctl);
      if (A.plan.once) A.plan.ctl = { ...A.plan.ctl, attack: false, jump: false, special: false, heavy: false, kick: false, force: false };
      return ctl;
    }
    if (A.t > 0) return ctl;
    A.t = rand(0.25, 0.55) * (rage ? 0.7 : 1);
    const r = Math.random();
    let plan;
    if (d > 4.5) {
      if (r < 0.12 && R.forceCool <= 0) plan = { t: 0.1, ctl: { force: true }, once: true }; // la Force du Rot : il attire Lucas
      else if (r < 0.32 && A.ballCool <= 0) { A.ballCool = rand(3, 5); plan = { t: 0.1, ctl: { special: true }, once: true }; }
      else if (r < 0.78) plan = { t: rand(0.4, 0.9), ctl: { move: toward } };
      else if (r < 0.9) plan = { t: 0.5, ctl: { move: toward, jump: true }, once: true };
      else plan = { t: 0.4, ctl: {} };
    } else if (d > 2.4) {
      if (r < 0.35) plan = { t: 0.1, ctl: { heavy: true }, once: true };
      else if (r < 0.8) plan = { t: rand(0.3, 0.6), ctl: { move: toward } };
      else plan = { t: 0.5, ctl: { move: -toward } };
    } else if (r < 0.5) {
      plan = { t: 0.1, ctl: { attack: true }, once: true };
      // parfois un combo de 2 ou 3 coups
      if (Math.random() < (rage ? 0.7 : 0.4)) setTimeout(() => { if (R.state === 'attack') this.startMoveAI(R); }, 380);
    } else if (r < 0.62) plan = { t: 0.1, ctl: { kick: true }, once: true };
    else if (r < 0.8) plan = { t: rand(0.4, 0.8), ctl: { block: true } };
    else plan = { t: rand(0.3, 0.5), ctl: { move: -toward } };
    A.plan = plan;
    Object.assign(ctl, plan.ctl);
    if (plan.once) plan.ctl = { ...plan.ctl, attack: false, jump: false, special: false, heavy: false, kick: false, force: false };
    return ctl;
  }
  startMoveAI(R) {
    if (R.state !== 'attack' || !R.move || this.phase !== 'fight') return;
    const next = R.move.name === 'atk1' ? 'atk2' : R.move.name === 'atk2' ? 'atk3' : null;
    if (next) { R.combo++; this.startMove(R, next); }
  }

  // ---------- la boucle ----------
  update(dtReal) {
    let dt = dtReal;
    if (this.slow > 0) { this.slow -= dtReal; dt *= 0.25; }
    const frozen = this.freeze > 0; // l'arrêt sur image quand un coup touche
    this.freeze -= dtReal;
    const fdt = frozen ? 0 : dt;
    this.t += dt;
    const inp = this.ctx.input;
    // les commandes de Lucas : boutons à l'écran ou clavier
    const fight = this.phase === 'fight';
    const move = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0) || Math.round(inp.move.x);
    const ctlL = {
      move: fight ? move : 0,
      jump: fight && (this.taps.jump || inp.jump || (inp.move.y > 0.6 && !this.upHeld)),
      attack: fight && (this.taps.attack || inp.attack),
      kick: fight && (this.taps.kick || inp.action),
      force: fight && this.taps.force,
      block: fight && (this.keys.block || inp.block),
      special: fight && (this.taps.special || inp.mega),
    };
    this.upHeld = inp.move.y > 0.6;
    if (!frozen) this.taps.jump = this.taps.attack = this.taps.special = this.taps.kick = this.taps.force = false;
    const ctlR = this.think(fdt);

    if (this.phase === 'intro') { this.phaseT -= dt; if (this.phaseT <= 0) this.phase = 'fight'; }
    if (this.phase === 'fight') {
      this.timeLeft -= fdt;
      if (this.timeLeft <= 0) this.endRound(this.L.hp / this.L.maxHp >= this.R.hp / this.R.maxHp ? this.L : this.R, 'time');
    }
    // le super coup : tout est arrêté sauf celui qui le lance
    if (this.phase === 'super') {
      this.phaseT -= dtReal;
      const P = this.superBy;
      P.f.update(dtReal); P.f.saberEnds(_a, _b); P.trail.push(_a, _b, false);
      if (Math.random() < 0.9) this.ctx.glows.emit(P.x + rand(-1.5, 1.5), rand(0, 3), rand(-1, 1), P === this.L ? 0x8fff5a : 0xc070ff, { vy: 3, life: 0.6, s0: 0.5, s1: 0.1 });
      if (this.phaseT <= 0) {
        this.phase = 'fight'; this.hud.classList.remove('dark');
        this.throwBall(P, P === this.L ? 'mega' : 'wave');
        this.shakeT = 0.4; this.ctx.flash(0.35);
      }
    } else {
      this.step(this.L, fdt, ctlL);
      this.step(this.R, fdt, ctlR);
    }
    // ils ne se traversent pas
    if (this.L.y < 1 && this.R.y < 1) {
      const dx = this.R.x - this.L.x, min = 1.7;
      if (Math.abs(dx) < min) { const push = (min - Math.abs(dx)) / 2 * (Math.sign(dx) || 1); this.L.x -= push; this.R.x += push; }
    }

    // les boules (prout, rot, vague, méga-prout)
    if (this.phase !== 'super') this.shots = this.shots.filter((s) => {
      s.life -= fdt; s.x += s.vx * fdt;
      s.o.position.x = s.x;
      s.o.rotation.z += fdt * 8;
      if (s.kind === 'wave') s.o.scale.set(1.2 + Math.sin(this.t * 20) * 0.1, 1 + Math.sin(this.t * 14) * 0.15, 1);
      if (s.kind === 'mega') s.o.scale.setScalar(1 + Math.sin(this.t * 18) * 0.08);
      if (Math.random() < 0.8) this.ctx.puffs.emit(s.x - Math.sign(s.vx) * 0.5, s.y + rand(-0.3, 0.4), 0, s.kind === 'prout' || s.kind === 'mega' ? 0x9be36b : 0xc38be8, { vy: 0.6, life: 0.5, s0: s.kind === 'mega' ? 1.2 : 0.4, s1: s.kind === 'mega' ? 3 : 1.2 });
      let gone = s.life <= 0 || Math.abs(s.x) > EDGE + 4;
      const T = s.owner.other;
      const hitY = s.kind === 'wave' ? T.y < 0.9 : Math.abs(T.y + 1.2 - s.y) < 1.5 + (s.r - 0.9);
      if (!gone && Math.abs(T.x - s.x) < s.r && hitY) {
        this.hitBy(T, s.owner, s.dmg, s.kind === 'mega' ? 9 : 6, { dir: Math.sign(s.vx), shot: true, knock: s.kind === 'mega', heavy: s.kind === 'mega', mega: s.kind === 'mega' });
        gone = true;
      }
      // deux boules qui se rencontrent : POUF (le méga-prout gagne toujours)
      if (!gone) for (const o of this.shots) if (o !== s && o.owner !== s.owner && o.life > 0 && Math.abs(o.x - s.x) < 0.9 && Math.abs(o.y - s.y) < 1.4) {
        o.life = 0; if (s.kind !== 'mega') gone = true;
        this.pop('POUF !', s.o.position.clone().setY(s.y + 1), '#ffffff', 1.4);
        this.ctx.puffs.burst(s.x, s.y, 0, 0xd8f5c0, 14, 5, { life: 0.7, s0: 0.6, s1: 1.8 });
        sfx.pop(); break;
      }
      if (gone) this.root.remove(s.o);
      return !gone;
    });

    // fin d'un round
    if (this.phase === 'ko') {
      this.phaseT -= dtReal;
      if (this.phaseT <= 0) {
        if (this.winsL >= 2) { this.player.hp = this.winsR ? Math.ceil(this.ctx.diff.hp * 0.5) : this.ctx.diff.hp; this.result = { type: 'win' }; }
        else if (this.winsR >= 2) this.result = { type: 'dead' };
        else { this.round++; this.startRound(); }
      }
    }

    this.updateArena(dtReal);
    this.placeCam(dtReal);
    this.updateHud(dtReal);
    return this.result;
  }

  updateArena(dt) {
    for (const c of this.crowd) { // le public bouge, saute quand il y a un beau coup
      c.vy -= 18 * dt; c.dy = Math.max(0, c.dy + c.vy * dt); if (c.dy === 0 && c.vy < 0) c.vy = 0;
      c.s.position.y = c.y0 + c.dy + Math.abs(Math.sin(this.t * 3 + c.ph)) * 0.12;
    }
    for (const s of this.spots) { s.pivot.rotation.z = Math.sin(this.t * 0.6 + (s.s > 0 ? 1.5 : 0)) * 0.45 + s.s * 0.25; s.pivot.rotation.x = Math.sin(this.t * 0.45 + s.s) * 0.15; }
    for (const v of this.vents) { // les cuves crachent du gaz vert
      v.t -= dt;
      if (v.t <= 0) { v.t = rand(1.5, 3); for (let i = 0; i < 6; i++) this.ctx.puffs.emit(v.x + rand(-0.6, 0.6), 3.2, v.z + rand(-0.6, 0.6), pick([0x9be36b, 0xc8f59a]), { vy: rand(3, 5), life: 1.6, s0: 0.8, s1: 2.6, alpha: 0.6 }); }
    }
    this.fx = this.fx.filter((e) => {
      e.t += dt;
      const k = e.t / (e.big ? 0.32 : 0.22);
      const sz = (e.big ? 3.4 : 2.0) * (0.4 + k);
      e.s.scale.set(sz, sz, 1); e.s.material.opacity = Math.max(0, 1 - k);
      e.ring.scale.setScalar(1 + k * (e.big ? 5 : 3)); e.ring.material.opacity = Math.max(0, 0.9 - k);
      if (k >= 1) { this.root.remove(e.s, e.ring); return false; }
      return true;
    });
    this.waves = this.waves.filter((w) => { // les ondes de la Force
      w.t += dt;
      if (w.t < 0) { w.o.visible = false; return true; }
      w.o.visible = true;
      w.x += w.vx * dt; w.o.position.x = w.x;
      const s = 1 + w.t * 7; w.o.scale.set(s, s, s);
      w.o.material.opacity = Math.max(0, 0.8 - w.t * 1.6);
      if (w.t > 0.5) { this.root.remove(w.o); return false; }
      return true;
    });
  }

  placeCam(dt) {
    const a = this.ctx.aspect(), fov = a < 1 ? 52 : 38;
    let mid = (this.L.x + this.R.x) / 2, lookY = 1.5;
    const gap = Math.abs(this.L.x - this.R.x);
    const halfW = (gap + 5) / 2; // largeur à voir
    let d = Math.max(8, halfW / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * a));
    this.zoomKick = Math.max(0, this.zoomKick - dt * 3);
    d *= 1 - this.zoomKick * 0.08;
    let want = _b.set(mid * 0.85, 1.9 + d * 0.05, d);
    if (this.phase === 'super') { const P = this.superBy; want = _b.set(P.x + P.face * 2.2, P.y + 1.8, 4.6); mid = P.x; lookY = P.y + 1.3; }
    if (this.phase === 'ko') want.x += Math.sin(this.t * 0.6) * 2.5; // la caméra tourne un peu pendant le K.O.
    const speed = this.phase === 'intro' ? 1.6 : this.phase === 'super' ? 6 : 4;
    this.camPos.lerp(want, Math.min(1, dt * speed));
    this.cam3.position.copy(this.camPos);
    if (this.shakeT > 0) { this.shakeT -= dt; this.cam3.position.x += rand(-0.18, 0.18); this.cam3.position.y += rand(-0.18, 0.18); }
    this.cam3.lookAt(this.phase === 'super' ? mid : mid * 0.85, lookY + (a < 1 && this.phase !== 'super' ? -0.5 : 0), 0);
    this.cam3.fov = fov; this.cam3.aspect = a; this.cam3.updateProjectionMatrix();
  }

  dispose() {
    for (const P of [this.L, this.R]) { this.scene.remove(P.f.root); P.trail.dispose(this.scene); }
    this.scene.remove(this.root);
    if (this.world) this.world.group.visible = this.oldWorldVis;
    this.scene.background = this.oldBg; this.scene.fog = this.oldFog || null;
    clearTimeout(this.bannerH);
    removeEventListener('keydown', this.onKey);
    this.hud.remove();
    document.getElementById('hud').classList.remove('versus');
  }
}
