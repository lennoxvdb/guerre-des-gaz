// Le duel contre Dark Roteur « à la Street Fighter » : vue de côté en 3D, barres de vie, rounds, K.O. !
// Lucas (notre Lucas 3D) : coups de sabre en combo, coup en avançant, coup sauté, parade, et la « Prout-ken ».
// Dark Roteur (joué par l'ordinateur) : combos, gros coup en fonçant, boule de rot, et la vague du Méga-Rot (il faut sauter !).
// Repère : les combattants sont sur l'axe x (z = 0), le sol est à y = 0, la caméra regarde depuis +z.
import * as THREE from 'three';
import { Fighter, SaberTrail } from '../entities/fighter.js';
import { glowSprite, toon } from '../engine/gfx.js';
import { sfx } from '../engine/audio.js';
import { rand, clamp, pick } from './common.js';

const EDGE = 8.5, GRAV = 24, ROUND_TIME = 60;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// les coups : animation, vitesse, moment où ça touche (0..1), portée, dégâts, recul
const MOVES = {
  atk1: { anim: 'atk1', speed: 1.7, hit: 0.42, reach: 2.3, dmg: 6, kb: 3 },
  atk2: { anim: 'atk2', speed: 1.7, hit: 0.42, reach: 2.3, dmg: 6, kb: 3 },
  atk3: { anim: 'atk3', speed: 1.5, hit: 0.45, reach: 2.4, dmg: 9, kb: 7 },
  lunge: { anim: 'stab', speed: 1.4, hit: 0.4, reach: 2.6, dmg: 10, kb: 6, dash: 6 },
  air: { anim: 'atk3', speed: 2.0, hit: 0.35, reach: 2.2, dmg: 8, kb: 5, air: true },
  rheavy: { anim: 'heavy', speed: 1.25, hit: 0.5, reach: 2.8, dmg: 11, kb: 8, dash: 4 },
};

function part(geo, color, x, y, z, o = {}) {
  const g = toon(geo, color, { outline: o.outline ?? 0.06, shadow: false, emissive: o.emissive || 0 });
  g.position.set(x, y, z);
  if (o.rx) g.rotation.x = o.rx; if (o.rz) g.rotation.z = o.rz;
  return g;
}

export class VersusMode {
  constructor(ctx, opts = {}) {
    this.ctx = ctx; this.scene = ctx.scene; this.world = ctx.world;
    this.t = 0; this.result = null;
    this.player = { hp: ctx.diff.hp, mega: 0 }; // pour les étoiles de fin de mission
    this.root = new THREE.Group(); this.scene.add(this.root);
    // le décor : on cache celui de la station et on construit la salle du trône
    this.hidden = [];
    if (this.world) for (const c of this.world.group.children) if (!c.isLight && c !== this.world.ground && c !== this.world.sun.target && c.visible) { c.visible = false; this.hidden.push(c); }
    this.buildArena();
    this.cam3 = new THREE.PerspectiveCamera(42, ctx.aspect(), 0.1, 300);
    this.camPos = new THREE.Vector3(0, 3, 12);
    this.shakeT = 0; this.slow = 0;
    // les deux combattants
    this.L = this.makeFighter('lucas', 2.0, -3, 1, 100);
    this.R = this.makeFighter('roteur', 2.6, 3, -1, 100);
    this.R.ai = { t: 0.8, plan: null, waveCool: 6, ballCool: 3 };
    this.L.other = this.R; this.R.other = this.L;
    this.shots = [];
    this.round = 1; this.winsL = 0; this.winsR = 0;
    this.buildHud();
    this.startRound();
  }

  // ---------- la salle du trône de Dark Roteur ----------
  buildArena() {
    const g = this.root;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x3a2d4d }));
    floor.position.y = 0.01; g.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(9.2, 9.6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fff5a }));
    ring.position.y = 0.02; g.add(ring);
    // le mur du fond, avec une grande fenêtre ronde sur l'espace
    g.add(part(new THREE.BoxGeometry(40, 16, 1), 0x2a2238, 0, 8, -9));
    const win = new THREE.Mesh(new THREE.CircleGeometry(5, 48), new THREE.MeshBasicMaterial({ color: 0x0a0618 }));
    win.position.set(0, 7.5, -8.45); g.add(win);
    g.add(part(new THREE.TorusGeometry(5, 0.45, 10, 48), 0x8d8f99, 0, 7.5, -8.4));
    const planet = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: 0x6fe04a }));
    planet.position.set(2, 8.6, -8.4); g.add(planet);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 4.6;
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.05, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      s.position.set(Math.cos(a) * r, 7.5 + Math.sin(a) * r, -8.42); g.add(s);
    }
    // le trône-toilettes, des tuyaux, des bannières violettes, des lampes vertes
    g.add(part(new THREE.CylinderGeometry(1.4, 1.1, 1.4, 20), 0xe9ece6, 0, 0.7, -6.5));
    g.add(part(new THREE.TorusGeometry(1.25, 0.25, 10, 24), 0x6a2f8f, 0, 1.45, -6.5, { rx: Math.PI / 2 }));
    g.add(part(new THREE.BoxGeometry(2.6, 3.2, 0.7), 0x6a2f8f, 0, 2.4, -7.5));
    for (const s of [-1, 1]) {
      g.add(part(new THREE.CylinderGeometry(0.9, 0.9, 16, 16), 0x8d8f99, s * 12, 8, -6));
      g.add(part(new THREE.CylinderGeometry(0.5, 0.5, 16, 12), 0x6a3f8f, s * 10, 8, -8));
      g.add(part(new THREE.BoxGeometry(2.4, 5, 0.15), 0x7b3fa0, s * 6.5, 9.5, -8.4, { outline: 0.03 }));
      const lamp = glowSprite(0x8fff5a, 2.4, 0.8); lamp.position.set(s * 6.5, 5.6, -8.2); g.add(lamp);
      g.add(part(new THREE.CylinderGeometry(1.2, 1.4, 2.2, 16), 0x5a3a66, s * 9.5, 1.1, -4));
      const goo = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fdc3c }));
      goo.position.set(s * 9.5, 2.22, -4); g.add(goo);
    }
    this.oldBg = this.scene.background;
    this.scene.background = new THREE.Color(0x140d1e);
  }

  makeFighter(kind, height, x, face, hp) {
    const f = new Fighter(kind, height);
    f.setSaberOn(1); f.setBase('guard');
    this.scene.add(f.root);
    const trail = new SaberTrail(this.scene, kind === 'lucas' ? f.saber.userData.trailColor : 0xb04cff);
    return { kind, f, trail, x, y: 0, vx: 0, vy: 0, face, hp, maxHp: hp, state: 'idle', move: null, mt: 0, combo: 0, comboT: 0, stun: 0, blocking: false, gauge: 0, startX: x, inv: 0 };
  }

  // ---------- l'affichage : barres de vie, chrono, boutons ----------
  buildHud() {
    const el = this.hud = document.createElement('div');
    el.id = 'vs';
    el.innerHTML = `
      <div class="vsTop">
        <div class="vsSide L"><img src="assets/portraits/lucas.webp" alt=""><div><b>LUCAS</b><div class="vsBar"><i></i></div><div class="vsGauge"><i></i></div><span class="pips"></span></div></div>
        <div class="vsTime">60</div>
        <div class="vsSide R"><div><b>DARK ROTEUR</b><div class="vsBar"><i></i></div><span class="pips"></span></div><img src="assets/portraits/roteur.webp" alt=""></div>
      </div>
      <div class="vsBanner hidden"></div>
      <div class="vsPad left">
        <button data-k="left">◀</button><button data-k="jump">▲</button><button data-k="right">▶</button>
      </div>
      <div class="vsPad right">
        <button data-k="special" class="sp"><span>💨</span><b>PROUT-KEN</b></button>
        <button data-k="block" class="bl"><span>🛡️</span><b>PARER</b></button>
        <button data-k="attack" class="at"><span>⚔️</span><b>SABRE</b></button>
      </div>`;
    document.getElementById('game').appendChild(el);
    this.keys = { left: false, right: false, block: false };
    this.taps = { jump: false, attack: false, special: false };
    el.querySelectorAll('.vsPad button').forEach((b) => {
      const k = b.dataset.k;
      const down = (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch { /* rien */ } b.classList.add('down'); if (k in this.keys) this.keys[k] = true; else this.taps[k] = true; };
      const up = () => { b.classList.remove('down'); if (k in this.keys) this.keys[k] = false; };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    document.getElementById('hud').classList.add('versus');
  }
  updateHud() {
    const q = (s) => this.hud.querySelector(s);
    q('.L .vsBar i').style.width = Math.max(0, this.L.hp / this.L.maxHp * 100) + '%';
    q('.R .vsBar i').style.width = Math.max(0, this.R.hp / this.R.maxHp * 100) + '%';
    q('.L .vsGauge i').style.width = Math.min(1, this.L.gauge) * 100 + '%';
    q('.L .vsGauge').classList.toggle('full', this.L.gauge >= 1);
    q('[data-k=special]').classList.toggle('ready', this.L.gauge >= 1);
    q('.vsTime').textContent = Math.max(0, Math.ceil(this.timeLeft));
    q('.L .pips').textContent = '★'.repeat(this.winsL);
    q('.R .pips').textContent = '★'.repeat(this.winsR);
  }
  banner(text, dur = 1.5) {
    const b = this.hud.querySelector('.vsBanner');
    b.textContent = text; b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bannerH);
    this.bannerH = setTimeout(() => b.classList.add('hidden'), dur * 1000);
  }

  // ---------- les rounds ----------
  startRound() {
    for (const P of [this.L, this.R]) {
      Object.assign(P, { x: P.startX, y: 0, vx: 0, vy: 0, hp: P.maxHp, state: 'idle', move: null, stun: 0, blocking: false, combo: 0, inv: 0 });
      P.face = P === this.L ? 1 : -1;
      P.f.stopAction(); P.f.setBase('guard');
      P.f.model.rotation.set(0, 0, 0);
    }
    for (const s of this.shots) this.root.remove(s.o);
    this.shots = [];
    this.timeLeft = ROUND_TIME;
    this.phase = 'intro'; this.phaseT = 2.2;
    this.banner(this.winsL === 1 && this.winsR === 1 ? 'DERNIER ROUND !' : `ROUND ${this.round}`, 1.2);
    setTimeout(() => { if (this.phase === 'intro') { this.banner('COMBAT !', 0.9); sfx.alarm(); } }, 1200);
    if (this.round === 1) this.ctx.hud.radio('roteur', 'En garde, petit rigolo ! Je vais te faire roter de peur ! BUUURP !', 3.5);
    this.updateHud();
  }

  endRound(winner, why) {
    this.phase = 'ko'; this.phaseT = 3.2;
    const loser = winner.other;
    if (winner === this.L) this.winsL++; else this.winsR++;
    this.banner(why === 'time' ? 'TEMPS !' : 'K.O. !', 2);
    if (why !== 'time') { this.slow = 1.2; sfx.boom(); this.ctx.flash(0.5); this.shakeT = 0.5; }
    loser.state = 'ko'; loser.f.play('death', 1); loser.f.setBase('guard');
    winner.state = 'win';
    setTimeout(() => { if (winner.state === 'win') { winner.f.play('cheer', 1); sfx.win(); } }, 1200);
    if (winner === this.L) this.ctx.hud.radio('lucas_rire', pick(['Ha ha ! Pris dans le gaz !', 'Prrrout ! Gagné !', 'Que le Gaz soit avec moi !']), 2.5);
    else this.ctx.hud.radio('roteur', pick(['BUUURP ! Trop facile !', 'Ha ha ha ! Le côté obscur du rot !']), 2.5);
    this.updateHud();
  }

  // ---------- un coup ----------
  startMove(P, name) {
    const M = MOVES[name];
    P.move = { ...M, name, done: false };
    P.mt = P.f.play(M.anim, M.speed, 0.85);
    P.move.len = P.mt;
    P.state = 'attack';
    if (P === this.L) sfx.swing(1 + P.combo * 0.12); else sfx.swing(0.8, 'classique');
    if (M.dash) P.vx = P.face * M.dash;
  }
  special(P) {
    P.state = 'attack'; P.move = { name: 'special', done: false };
    P.mt = P.f.play('spell', 1.4, 0.7); P.move.len = P.mt;
    const lucas = P === this.L;
    if (lucas) { P.gauge = 0; this.banner('PROUT-KEN !', 1); }
    setTimeout(() => {
      if (P.state !== 'attack' || this.phase !== 'fight') return;
      this.throwBall(P, lucas ? 'prout' : 'rot');
    }, 280);
  }
  throwBall(P, kind) {
    const o = new THREE.Group();
    const col = kind === 'prout' ? 0x7dff4a : kind === 'wave' ? 0xd38bff : 0xb04cff;
    if (kind === 'wave') {
      o.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 })));
      o.add(glowSprite(col, 3, 0.8));
    } else {
      o.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: kind === 'prout' ? 0xeaffd8 : 0xf3dcff })));
      o.add(glowSprite(col, 2.6, 0.95));
    }
    const y = kind === 'wave' ? 0.1 : P.y + 1.3;
    o.position.set(P.x + P.face * 1.2, y, 0);
    this.root.add(o);
    this.shots.push({ o, kind, owner: P, x: o.position.x, y, vx: P.face * (kind === 'wave' ? 8 : 10), dmg: kind === 'prout' ? 14 : kind === 'wave' ? 12 : 9, life: 3 });
    if (kind === 'prout') sfx.mega(); else sfx.burp();
  }

  // P se fait toucher par A
  hitBy(P, A, dmg, kb, fromShot = false) {
    if (P.state === 'ko' || this.phase !== 'fight' || P.inv > 0) return false;
    const facing = P.face === (fromShot ? -Math.sign(fromShot) : -A.face);
    const pos = _a.set(P.x, P.y + 1.4, 0.3);
    if (P.blocking && facing && P.y < 0.2) {
      P.hp -= Math.round(dmg * 0.1); P.vx = -P.face * kb * 0.5; P.stun = 0.15;
      P.f.play('blockHit', 1.4, 0.8);
      sfx.clash(); this.ctx.words.pop('CLANG !', pos, '#ffd23f', 1.1);
      this.ctx.glows.burst(pos.x, pos.y, 0.3, 0xfff2a0, 8, 6, { life: 0.25, s0: 0.4, s1: 0.1 });
      P.gauge = Math.min(1, P.gauge + 0.05);
      return true;
    }
    const mult = P === this.R ? 1.35 : 1; // Lucas tape un peu plus fort (c'est un jeu pour enfants)
    P.hp -= Math.round(dmg * mult);
    P.vx = (fromShot ? Math.sign(fromShot) : A.face) * kb; P.vy = P.y > 0.1 ? 4 : 0;
    P.stun = 0.38; P.state = 'hit'; P.move = null; P.blocking = false;
    P.f.play(Math.random() < 0.5 ? 'hit' : 'hit2', 1.3, 0.9); P.f.flash = 1;
    if (P === this.L) sfx.hurt(); else sfx.hit();
    this.ctx.words.pop(pick(['PAF !', 'BAM !', 'POUF !', 'PROUT !']), pos, P === this.R ? '#8fff5a' : '#ff8a3d', 1.4);
    this.ctx.puffs.burst(pos.x, pos.y, 0.3, P === this.R ? 0xc38be8 : 0x9be36b, 8, 4, { life: 0.5, s0: 0.4, s1: 1.2 });
    this.shakeT = 0.18; this.slow = Math.max(this.slow, 0.06);
    if (A) A.gauge = Math.min(1, A.gauge + 0.13);
    P.gauge = Math.min(1, P.gauge + 0.08);
    if (P.hp <= 0) { P.hp = 0; this.endRound(P.other, 'ko'); }
    return true;
  }

  // ---------- un combattant à chaque image ----------
  step(P, dt, ctl) {
    const O = P.other;
    P.inv -= dt; P.comboT -= dt;
    const onGround = P.y <= 0.001;
    if (P.state === 'ko' || P.state === 'win') {
      P.vx *= Math.exp(-dt * 5);
    } else if (P.state === 'hit') {
      P.stun -= dt; P.vx *= Math.exp(-dt * 6);
      if (P.stun <= 0 && onGround) P.state = 'idle';
    } else if (P.state === 'attack') {
      P.mt -= dt;
      if (P.move && P.move.reach && !P.move.done && P.mt <= P.move.len * (1 - P.move.hit)) {
        P.move.done = true;
        const dx = (O.x - P.x) * P.face;
        if (dx > -0.4 && dx < P.move.reach && Math.abs(O.y - P.y) < 1.8) this.hitBy(O, P, P.move.dmg, P.move.kb);
      }
      if (onGround) P.vx *= Math.exp(-dt * 7);
      if (P.mt <= 0) { P.state = 'idle'; P.move = null; }
      // on peut enchaîner : un nouveau coup pendant la fin du coup = combo
      if (ctl.attack && P.move && P.move.done && P.mt < P.move.len * 0.35 && ['atk1', 'atk2'].includes(P.move.name)) {
        P.combo = P.move.name === 'atk1' ? 1 : 2;
        this.startMove(P, P.combo === 1 ? 'atk2' : 'atk3');
      }
    } else {
      // libre : bouger, sauter, parer, attaquer
      P.blocking = ctl.block && onGround;
      const toward = Math.sign(O.x - P.x) || P.face;
      if (onGround) {
        P.face = toward;
        if (P.blocking) P.vx = 0;
        else P.vx = ctl.move * (P === this.R ? 3.8 : 4.4);
        if (ctl.jump && !P.blocking) { P.vy = 10; P.vx = ctl.move * 5; P.y = 0.01; sfx.jump(); P.f.play('jumpAir', 1, 9); }
      }
      if (ctl.special && P.state !== 'attack') {
        if (P === this.L ? P.gauge >= 1 : true) this.special(P);
      } else if (ctl.attack) {
        if (!onGround) this.startMove(P, 'air');
        else if (ctl.move * P.face > 0.5) this.startMove(P, 'lunge');
        else { P.combo = 0; this.startMove(P, 'atk1'); }
      } else if (ctl.heavy && onGround) this.startMove(P, 'rheavy');
      // la pose
      if (onGround) {
        if (P.blocking) P.f.setBase('block');
        else if (Math.abs(P.vx) > 0.3) P.f.setBase('walk', (P.vx * P.face > 0 ? 1.3 : -1.1));
        else P.f.setBase('guard');
      }
    }
    // déplacement, gravité, bords
    P.x += P.vx * dt;
    if (P.y > 0 || P.vy > 0) {
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      if (P.y <= 0) {
        P.y = 0; P.vy = 0;
        if (P.state !== 'ko') { P.f.play('jumpLand', 1.6, 0.6); sfx.land(); if (P.state === 'attack') { P.state = 'idle'; P.move = null; } }
      }
    }
    P.x = clamp(P.x, -EDGE, EDGE);
    // l'apparence
    P.f.root.position.set(P.x, P.y, 0);
    const yaw = P.face > 0 ? Math.PI / 2 - 0.45 : -Math.PI / 2 + 0.45; // de profil, un peu tourné vers nous
    P.f.yaw += (yaw - P.f.yaw) * Math.min(1, dt * 14);
    P.f.update(dt);
    P.f.saberEnds(_a, _b); P.trail.push(_a, _b, P.state === 'attack');
  }

  // ---------- l'ordinateur joue Dark Roteur ----------
  think(dt) {
    const R = this.R, L = this.L, A = R.ai;
    const ctl = { move: 0, attack: false, block: false, jump: false, special: false, heavy: false };
    if (this.phase !== 'fight' || R.state === 'ko') return ctl;
    const d = Math.abs(L.x - R.x), toward = Math.sign(L.x - R.x);
    const rage = R.hp < R.maxHp * 0.35;
    A.t -= dt; A.waveCool -= dt; A.ballCool -= dt;
    // parer quand Lucas attaque tout près (pas à tous les coups !)
    if (L.state === 'attack' && d < 3 && R.state !== 'attack') {
      if (A.blockRoll === undefined) A.blockRoll = Math.random() < (rage ? 0.45 : 0.32);
      if (A.blockRoll) { ctl.block = true; return ctl; }
    } else A.blockRoll = undefined;
    // la vague du Méga-Rot : quand il est en colère (il faut sauter par-dessus)
    if (rage && A.waveCool <= 0 && R.state === 'idle' && d > 2.5) {
      A.waveCool = rand(5, 7);
      this.banner('MÉGA-ROT ! SAUTE !', 1.4);
      this.ctx.hud.radio('roteur', 'MÉGA-ROOOOOT !', 2);
      R.state = 'attack'; R.move = { name: 'wave', done: false };
      R.mt = R.f.play('spell', 1.0, 0.8); R.move.len = R.mt;
      setTimeout(() => { if (R.state === 'attack' && this.phase === 'fight') this.throwBall(R, 'wave'); }, 650);
      return ctl;
    }
    if (A.plan && A.plan.t > 0) {
      A.plan.t -= dt;
      Object.assign(ctl, A.plan.ctl);
      if (A.plan.once) { A.plan.ctl = { ...A.plan.ctl, attack: false, jump: false, special: false, heavy: false }; }
      return ctl;
    }
    if (A.t > 0) return ctl;
    A.t = rand(0.25, 0.55) * (rage ? 0.7 : 1);
    const r = Math.random();
    let plan;
    if (d > 4.5) {
      if (r < 0.25 && A.ballCool <= 0) { A.ballCool = rand(3, 5); plan = { t: 0.1, ctl: { special: true }, once: true }; }
      else if (r < 0.75) plan = { t: rand(0.4, 0.9), ctl: { move: toward } };
      else if (r < 0.88) plan = { t: 0.5, ctl: { move: toward, jump: true }, once: true };
      else plan = { t: 0.4, ctl: {} };
    } else if (d > 2.4) {
      if (r < 0.35) plan = { t: 0.1, ctl: { heavy: true }, once: true };
      else if (r < 0.8) plan = { t: rand(0.3, 0.6), ctl: { move: toward } };
      else plan = { t: 0.5, ctl: { move: -toward } };
    } else if (r < 0.6) {
      plan = { t: 0.1, ctl: { attack: true }, once: true };
      // parfois un combo de 2 ou 3 coups
      if (Math.random() < (rage ? 0.7 : 0.4)) setTimeout(() => { if (R.state === 'attack') this.startMoveAI(R); }, 380);
    } else if (r < 0.8) plan = { t: rand(0.4, 0.8), ctl: { block: true } };
    else plan = { t: rand(0.3, 0.5), ctl: { move: -toward } };
    A.plan = plan;
    Object.assign(ctl, plan.ctl);
    if (plan.once) plan.ctl = { ...plan.ctl, attack: false, jump: false, special: false, heavy: false };
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
    this.t += dt;
    const inp = this.ctx.input;
    // les commandes de Lucas : boutons à l'écran ou clavier
    const move = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0) || Math.round(inp.move.x);
    const ctlL = {
      move: this.phase === 'fight' ? move : 0,
      jump: this.phase === 'fight' && (this.taps.jump || inp.jump || (inp.move.y > 0.6 && !this.upHeld)),
      attack: this.phase === 'fight' && (this.taps.attack || inp.attack),
      block: this.phase === 'fight' && (this.keys.block || inp.block),
      special: this.phase === 'fight' && (this.taps.special || inp.mega) && this.L.gauge >= 1,
    };
    this.upHeld = inp.move.y > 0.6;
    this.taps.jump = this.taps.attack = this.taps.special = false;
    const ctlR = this.think(dt);

    if (this.phase === 'intro') { this.phaseT -= dt; if (this.phaseT <= 0) this.phase = 'fight'; }
    if (this.phase === 'fight') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.endRound(this.L.hp / this.L.maxHp >= this.R.hp / this.R.maxHp ? this.L : this.R, 'time');
    }
    this.step(this.L, dt, ctlL);
    this.step(this.R, dt, ctlR);
    // ils ne se traversent pas
    if (this.L.y < 1 && this.R.y < 1) {
      const dx = this.R.x - this.L.x, min = 1.7;
      if (Math.abs(dx) < min) { const push = (min - Math.abs(dx)) / 2 * (Math.sign(dx) || 1); this.L.x -= push; this.R.x += push; }
    }

    // les boules (prout, rot, vague)
    this.shots = this.shots.filter((s) => {
      s.life -= dt; s.x += s.vx * dt;
      s.o.position.x = s.x;
      s.o.rotation.z += dt * 8;
      if (s.kind === 'wave') s.o.scale.set(1.2 + Math.sin(this.t * 20) * 0.1, 1 + Math.sin(this.t * 14) * 0.15, 1);
      if (Math.random() < 0.7) this.ctx.puffs.emit(s.x - Math.sign(s.vx) * 0.5, s.y + rand(-0.2, 0.3), 0, s.kind === 'prout' ? 0x9be36b : 0xc38be8, { vy: 0.6, life: 0.5, s0: 0.4, s1: 1.2 });
      let gone = s.life <= 0 || Math.abs(s.x) > EDGE + 3;
      const T = s.owner.other;
      const hitY = s.kind === 'wave' ? T.y < 0.9 : Math.abs(T.y + 1.2 - s.y) < 1.5;
      if (!gone && Math.abs(T.x - s.x) < 0.9 && hitY) { this.hitBy(T, s.owner, s.dmg, 6, s.vx); gone = true; }
      // deux boules qui se rencontrent : POUF
      if (!gone) for (const o of this.shots) if (o !== s && o.owner !== s.owner && o.life > 0 && Math.abs(o.x - s.x) < 0.8 && Math.abs(o.y - s.y) < 1.2) {
        o.life = 0; gone = true;
        this.ctx.words.pop('POUF !', s.o.position.clone().setY(s.y + 1), '#ffffff', 1.4);
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

    this.placeCam(dtReal);
    this.updateHud();
    return this.result;
  }

  placeCam(dt) {
    const mid = (this.L.x + this.R.x) / 2, gap = Math.abs(this.L.x - this.R.x);
    const a = this.ctx.aspect(), fov = a < 1 ? 50 : 40;
    const halfW = (gap + 5.5) / 2; // largeur à voir
    const d = Math.max(8.5, halfW / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * a));
    const want = _a.set(mid * 0.85, 2.4 + d * 0.06, d);
    this.camPos.lerp(want, Math.min(1, dt * 4));
    this.cam3.position.copy(this.camPos);
    if (this.shakeT > 0) { this.shakeT -= dt; this.cam3.position.x += rand(-0.15, 0.15); this.cam3.position.y += rand(-0.15, 0.15); }
    this.cam3.lookAt(mid * 0.85, 1.5 + (a < 1 ? -0.6 : 0), 0);
    this.cam3.fov = fov; this.cam3.aspect = a; this.cam3.updateProjectionMatrix();
  }

  dispose() {
    for (const P of [this.L, this.R]) { this.scene.remove(P.f.root); P.trail.dispose(this.scene); }
    for (const s of this.shots) this.root.remove(s.o);
    this.scene.remove(this.root);
    for (const c of this.hidden) c.visible = true;
    this.scene.background = this.oldBg;
    clearTimeout(this.bannerH);
    this.hud.remove();
    document.getElementById('hud').classList.remove('versus');
  }
}
