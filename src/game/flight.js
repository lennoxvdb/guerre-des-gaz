// La bataille en vol : Lucas pilote le chasseur-WC en rase-mottes au-dessus du désert de Sablon.
// Les vaisseaux volent sur un « plafond » à hauteur ALT ; les canons sont au sol.
// Toutes les collisions se font comme on les voit sur l'écran.
import * as THREE from 'three';
import { TEX, flatSprite, shadowBlob, glowSprite, screenYaw, toon, rng } from '../engine/gfx.js';
import { flightDecor } from '../world/world.js';
import { sfx } from '../engine/audio.js';
import { SR, SU, rand, clamp, pick, Script } from './common.js';

export const ALT = 5;
const beamGeo = new THREE.CapsuleGeometry(0.11, 0.9, 4, 8).rotateX(Math.PI / 2);
const beamCore = new THREE.MeshBasicMaterial({ color: 0xf0ffd8 });
const beamGlowGeo = new THREE.CapsuleGeometry(0.24, 1.0, 4, 8).rotateX(Math.PI / 2);
const beamGlow = new THREE.MeshBasicMaterial({ color: 0x6dff3a, transparent: true, opacity: 0.6, depthWrite: false });
function beam() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(beamGeo, beamCore), new THREE.Mesh(beamGlowGeo, beamGlow));
  return g;
}
export const FLIGHT_OFF = new THREE.Vector3(8, 20, 8);
const VIEW = FLIGHT_OFF.clone().normalize().negate(); // la direction du regard de la caméra
const V = () => new THREE.Vector3();
const _a = V();

export class FlightMode {
  constructor(ctx, opts) {
    this.ctx = ctx; this.scene = ctx.scene; this.world = ctx.world;
    this.t = 0; this.result = null;
    this.speed = 8;
    this.enemies = []; this.shots = []; this.eshots = []; this.pickups = []; this.decor = [];
    this.R = rng(5);
    const p = this.ship = {
      x: 0, y: 0, hp: opts.hp, maxHp: ctx.diff.hp, inv: 0, power: 1, fireT: 0, mega: opts.mega ?? 0, tilt: 0,
    };
    this.obj = flatSprite(TEX.wc, 2.6);
    this.shadow = shadowBlob(2.4);
    this.scene.add(this.obj, this.shadow);
    // décollage : le vaisseau part de là où il était posé
    this.start = opts.startPos.clone();
    this.B = this.start.clone().setY(0);
    this.intro = opts.skipIntro ? 0 : 2.2;
    this.introMax = this.intro || 1;
    this.layout();
    p.y = -this.Yh * 0.5;
    this.B.addScaledVector(SU, -p.y); // le vaisseau finit pile au-dessus de son point de départ
    this.decorAt = 0;
    this.script = opts.script ? new Script(opts.script(this)) : null;
    ctx.hud.hearts(p.hp, p.maxHp);
    ctx.hud.mega(p.mega);
    if (!opts.skipIntro) sfx.takeoff();
  }

  // taille de la zone de jeu selon l'écran
  layout() {
    const half = this.ctx.flightHalf();
    this.Yh = half / Math.sin(Math.atan2(FLIGHT_OFF.y, Math.hypot(FLIGHT_OFF.x, FLIGHT_OFF.z)));
    this.Xw = Math.min(half * this.ctx.aspect(), 13);
  }

  // coordonnées « écran » (x à droite, y en haut, sur le plafond) ↔ monde
  wp(x, y, out = V()) { return out.copy(this.B).addScaledVector(SR, x).addScaledVector(SU, y).setY(ALT); }
  toPlane(w) {
    const s = (ALT - w.y) / VIEW.y;
    const px = w.x + VIEW.x * s - this.B.x, pz = w.z + VIEW.z * s - this.B.z;
    return { x: px * SR.x + pz * SR.z, y: px * SU.x + pz * SU.z };
  }
  // un point au sol qui apparaît en (x, y) sur l'écran
  groundAt(x, y) {
    const P = this.wp(x, y);
    const s = -ALT / VIEW.y;
    return P.addScaledVector(VIEW, s).setY(0);
  }

  say(who, text, dur) { this.ctx.hud.radio(who, text, dur); }
  get alive() { return this.enemies.filter((e) => !e.dead).length; }
  clear() { return () => this.alive === 0; }

  // ---------- ennemis ----------
  addFlyer(kind, x, y, move, opts = {}) {
    const o = flatSprite(TEX[kind === 'boss' ? 'ventouse' : 'rot'], kind === 'boss' ? 5 : 2.2);
    const sh = shadowBlob(kind === 'boss' ? 6 : 2);
    this.scene.add(o, sh);
    const e = { kind, x, y, move, o, sh, t: 0, ph: rand(0, 6), hp: opts.hp ?? this.ctx.diff.rotHp, r: opts.r ?? 1.1, fireT: rand(1.5, 3), dead: false, flash: 0, ...opts };
    this.enemies.push(e);
    return e;
  }
  rotWave(pattern, n = 5) {
    const X = this.Xw - 1.5, top = this.Yh + 2;
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0.5;
      if (pattern === 'line') this.addFlyer('rot', -X + 2 * X * k, top + i * 0.8, 'dive', { wob: 1.5 });
      if (pattern === 'v') this.addFlyer('rot', (k - 0.5) * 2 * X * 0.8, top + Math.abs(k - 0.5) * 6, 'dive', { wob: 0 });
      if (pattern === 'left') this.addFlyer('rot', -X - 3 - i * 2.2, this.Yh * 0.6, 'swoop', { dir: 1, y0: this.Yh * 0.6 });
      if (pattern === 'right') this.addFlyer('rot', X + 3 + i * 2.2, this.Yh * 0.4, 'swoop', { dir: -1, y0: this.Yh * 0.4 });
      if (pattern === 'hover') this.addFlyer('rot', -X + 2 * X * k, top + i, 'hover', { ty: this.Yh * (0.35 + 0.25 * (i % 2)), hp: this.ctx.diff.rotHp + 2 });
    }
  }
  // canons au sol, plus haut que l'écran : ils arrivent avec le décor
  turrets(n = 2) {
    for (let i = 0; i < n; i++) {
      const G = this.groundAt(rand(-this.Xw + 2, this.Xw - 2), this.Yh + 4 + i * 5);
      const g = new THREE.Group();
      g.add(toon(new THREE.CylinderGeometry(1, 1.2, 0.6, 12), 0x5a3a66, { outline: 0.06 }));
      const dome = toon(new THREE.SphereGeometry(0.8, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a5ab0, { outline: 0.05 });
      dome.position.y = 0.3; g.add(dome);
      const barrel = toon(new THREE.CylinderGeometry(0.18, 0.22, 1.3, 10), 0x3a2848, { outline: 0.04 });
      barrel.position.set(0, 1.0, 0.3); barrel.rotation.x = 0.7; g.add(barrel);
      g.position.copy(G);
      this.scene.add(g);
      this.enemies.push({ kind: 'turret', g, G: G.clone(), hp: this.ctx.diff.turretHp, r: 1.3, t: 0, fireT: rand(1, 2.5), dead: false, flash: 0 });
    }
  }
  boss() {
    const b = this.addFlyer('boss', 0, this.Yh + 7, 'boss', { hp: this.ctx.diff.cruiserHp, maxHp: this.ctx.diff.cruiserHp, r: 2.4, fanT: 2.5, spawnT: 6, spiralT: 0 });
    b.o.rotation.y = screenYaw(Math.PI);
    this.bossE = b;
    this.ctx.hud.boss('CROISEUR-VENTOUSE', 1);
    sfx.alarm();
    return b;
  }
  // les zones touchables du croiseur (en forme de ventouse)
  bossCircles(e) {
    const L = 10.7;
    return [[e.x, e.y - L * 0.3, 2.4], [e.x, e.y, 0.8], [e.x, e.y + L * 0.22, 0.8]];
  }
  hitTest(e, x, y, r) {
    if (e.kind === 'boss') return this.bossCircles(e).some(([cx, cy, cr]) => Math.hypot(x - cx, y - cy) < cr + r);
    const p = e.kind === 'turret' ? this.toPlane(e.G) : e;
    return Math.hypot(x - p.x, y - p.y) < e.r + r;
  }

  eshot(x, y, ang, speed, fromGround) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf3dcff })), glowSprite(0xb04cff, 1.4, 0.95));
    this.scene.add(g);
    const s = { g, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 5 };
    if (fromGround) { s.from = fromGround.clone(); s.rise = 0; }
    this.eshots.push(s);
    sfx.pew();
  }

  kill(e) {
    e.dead = true;
    const w = e.kind === 'turret' ? e.G.clone().setY(1) : this.wp(e.x, e.y);
    this.ctx.words.pop(pick(['POUF !', 'PFIOU !', 'BAM !']), w.clone().setY(w.y + 1.5), pick(['#ffd23f', '#8fff5a']), 1.4);
    this.ctx.puffs.burst(w.x, w.y, w.z, 0x9be36b, 10, 5, { life: 0.8, s0: 0.8, s1: 2 });
    this.ctx.glows.burst(w.x, w.y, w.z, 0xffb04a, 8, 7, { life: 0.3, s0: 0.6, s1: 0.1 });
    sfx.boom();
    this.ship.mega = Math.min(1, this.ship.mega + 0.06); this.ctx.hud.mega(this.ship.mega);
    if (e.kind === 'turret') { this.scene.remove(e.g); if (Math.random() < 0.3) this.dropPickup(this.toPlane(e.G)); return; }
    if (e.kind === 'boss') return this.killBoss(e);
    // le vaisseau se dégonfle en tourbillonnant
    e.dying = 0.7; e.spin = rand(10, 16) * (Math.random() < 0.5 ? -1 : 1);
    const a = rand(0, 6.28); e.vx = Math.cos(a) * 9; e.vy = Math.sin(a) * 9;
    if (Math.random() < 0.09) this.dropPickup(e);
  }
  killBoss(e) {
    e.dying = 2.4; e.spin = 1.5; e.vx = 0; e.vy = -1;
    this.ctx.hud.boss(null);
    sfx.mega(); this.ctx.shake(1.2);
    this.ctx.words.pop('CROISEUR DÉGONFLÉ !', this.wp(e.x, e.y).setY(ALT + 2), '#8fff5a', 2.2);
    for (const s of this.eshots) s.life = 0;
    this.say('han', 'Yahouuu ! Bien joué, gamin ! Le Gaz est avec toi !', 3);
    this.bossDown = true;
  }

  dropPickup(at) {
    const kind = this.ship.power < 4 && Math.random() < 0.5 ? 'power' : 'heal';
    const o = flatSprite(TEX.bonus, 1.1);
    const glow = glowSprite(kind === 'power' ? 0x8fff5a : 0xff6a8a, 2.6, 0.7);
    const g = new THREE.Group(); g.add(glow, o);
    this.scene.add(g);
    this.pickups.push({ g, kind, x: at.x, y: at.y, t: 0 });
  }

  megaProut() {
    const p = this.ship;
    p.mega = 0; this.ctx.hud.mega(0);
    sfx.mega(); this.ctx.shake(0.9);
    const w = this.wp(p.x, p.y);
    this.ctx.words.pop('MÉGA-PROUT !', w.clone().setY(ALT + 2.5), '#8fff5a', 2.2);
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      this.ctx.puffs.emit(w.x, ALT, w.z, i % 2 ? 0x9be36b : 0xc8f59a, { vx: Math.cos(a) * 22, vz: Math.sin(a) * 22, life: 1, s0: 1.5, s1: 5, drag: 1.8 });
    }
    for (const s of this.eshots) s.life = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hp -= e.kind === 'boss' ? 8 : 99; e.flash = 1;
      if (e.kind === 'boss') this.ctx.hud.boss('CROISEUR-VENTOUSE', Math.max(0, e.hp / e.maxHp));
      if (e.hp <= 0) this.kill(e);
    }
  }

  hurt() {
    const p = this.ship;
    if (p.inv > 0 || this.result) return;
    p.hp -= 1; p.inv = 1.6;
    sfx.hurt(); this.ctx.shake(0.5);
    const w = this.wp(p.x, p.y);
    this.ctx.puffs.burst(w.x, w.y, w.z, 0xc38be8, 12, 4, { life: 0.8, s0: 0.6, s1: 1.6 });
    this.ctx.hud.hearts(Math.max(0, p.hp), p.maxHp);
    if (p.power > 1) p.power--;
    if (p.hp <= 0) {
      this.crashT = 1.5;
      this.ctx.words.pop('OUPS !', w.clone().setY(ALT + 2), '#ff8a3d', 2);
    }
  }

  // ---------- la boucle ----------
  update(dt) {
    this.t += dt;
    this.layout();
    const p = this.ship, inp = this.ctx.input, cam = this.ctx.cam;

    // décollage
    if (this.intro > 0) {
      this.intro -= dt;
      const k = 1 - Math.max(0, this.intro) / this.introMax, e = k * k * (3 - 2 * k);
      const end = this.wp(p.x, p.y);
      this.obj.position.lerpVectors(this.start.clone().setY(1), end, e);
      this.obj.rotation.y = screenYaw(0);
      this.shadow.position.set(this.obj.position.x, 0.04, this.obj.position.z);
      cam.elev = e;
      cam.target.lerpVectors(this.start.clone().setY(1), this.wp(0, 0), e);
      if (Math.random() < 0.8) this.ctx.puffs.emit(this.obj.position.x, this.obj.position.y - 0.3, this.obj.position.z, 0x9be36b, { vy: -3, vx: rand(-2, 2), vz: rand(-2, 2), life: 0.8, s0: 0.8, s1: 2 });
      this.world.follow(this.obj.position);
      return null;
    }
    cam.elev = 1;
    if (!this.bossDown || this.bossE.dying > 1.6) this.B.addScaledVector(SU, this.speed * dt);
    this.script && this.script.update(dt);

    // pilotage : glisser le doigt (déplacement relatif) ou flèches
    if (this.crashT === undefined) {
      const k = this.ctx.dragScale();
      p.x += inp.drag.x * k + inp.move.x * 14 * dt;
      p.y += inp.drag.y * k + inp.move.y * 14 * dt;
      p.tilt += (clamp(inp.drag.x * 0.4 + inp.move.x * 0.4, -0.45, 0.45) - p.tilt) * Math.min(1, dt * 8);
      p.x = clamp(p.x, -this.Xw + 1.2, this.Xw - 1.2);
      p.y = clamp(p.y, -this.Yh + 1.6, this.Yh - 2);
      p.inv -= dt;
      // tir automatique
      p.fireT -= dt;
      if (p.fireT <= 0) {
        p.fireT = 0.14;
        const add = (dx, ang) => {
          const o = beam();
          o.rotation.y = screenYaw(ang) + Math.PI;
          this.scene.add(o);
          this.shots.push({ o, x: p.x + dx, y: p.y + 1.3, vx: Math.sin(ang) * 26, vy: Math.cos(ang) * 26 });
        };
        if (p.power === 1) add(0, 0);
        else if (p.power === 2) { add(-0.4, 0); add(0.4, 0); }
        else { add(0, 0); add(-0.5, -0.18); add(0.5, 0.18); if (p.power >= 4) { add(-0.9, -0.4); add(0.9, 0.4); } }
        sfx.laser();
      }
      if (inp.mega && p.mega >= 1) this.megaProut();
    } else {
      this.crashT -= dt;
      p.y -= dt * 3; p.tilt += dt * 6;
      if (Math.random() < 0.8) { const w = this.wp(p.x, p.y); this.ctx.puffs.emit(w.x, w.y, w.z, 0x777777, { vy: 1, life: 0.8, s0: 0.6, s1: 1.8 }); }
      if (this.crashT <= 0 && !this.result) this.result = { type: 'dead' };
    }
    const w = this.wp(p.x, p.y);
    this.obj.position.copy(w);
    this.obj.rotation.y = screenYaw(0) - p.tilt * 0.5;
    this.obj.visible = p.inv <= 0 || Math.floor(this.t * 14) % 2 === 0;
    this.shadow.position.set(w.x, 0.04, w.z);
    if (Math.random() < 0.7) this.ctx.glows.emit(w.x - SU.x * 1.4, ALT - 0.1, w.z - SU.z * 1.4, 0x8fff5a, { vx: -SU.x * 4, vz: -SU.z * 4, life: 0.3, s0: 0.7, s1: 0.2 });

    // tirs de Lucas
    this.shots = this.shots.filter((s) => {
      s.x += s.vx * dt; s.y += s.vy * dt;
      this.wp(s.x, s.y, s.o.position);
      let gone = s.y > this.Yh + 2 || Math.abs(s.x) > this.Xw + 2;
      if (!gone) for (const e of this.enemies) {
        if (e.dead || e.dying !== undefined || !this.hitTest(e, s.x, s.y, 0.3)) continue;
        e.hp--; e.flash = 0.08; gone = true;
        const hw = this.wp(s.x, s.y);
        this.ctx.glows.burst(hw.x, hw.y, hw.z, 0xeaffc0, 3, 4, { life: 0.2, s0: 0.4, s1: 0.1 });
        if (e.kind === 'boss') this.ctx.hud.boss('CROISEUR-VENTOUSE', Math.max(0, e.hp / e.maxHp));
        if (e.hp <= 0) this.kill(e); else if (e.kind !== 'rot') sfx.hit();
        break;
      }
      if (gone) this.scene.remove(s.o);
      return !gone;
    });

    // ennemis
    const D = this.ctx.diff;
    this.enemies = this.enemies.filter((e) => {
      e.t += dt; e.flash -= dt;
      if (e.kind === 'turret') {
        const q = this.toPlane(e.G);
        if (q.y < -this.Yh - 6) { this.scene.remove(e.g); return false; }
        if (e.dead) return false;
        e.g.children[2].rotation.y = 0;
        e.g.rotation.y = Math.atan2(w.x - e.G.x, w.z - e.G.z);
        e.fireT -= dt;
        if (e.fireT <= 0 && q.y < this.Yh - 1 && q.y > -this.Yh * 0.3) {
          e.fireT = rand(2.2, 3.2) / D.flightFire;
          this.eshot(q.x, q.y, Math.atan2(p.y - q.y, p.x - q.x), 6.5, e.G.clone().setY(1.2));
        }
        e.g.scale.setScalar(e.flash > 0 ? 1.15 : 1);
        return true;
      }
      if (e.dying !== undefined) {
        e.dying -= dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.o.rotation.y += e.spin * dt;
        const k = Math.max(0.05, e.dying / (e.kind === 'boss' ? 2.4 : 0.7));
        e.o.scale.setScalar(e.kind === 'boss' ? 0.4 + k * 0.6 : k);
        this.wp(e.x, e.y, e.o.position);
        e.sh.position.set(e.o.position.x, 0.04, e.o.position.z);
        if (Math.random() < (e.kind === 'boss' ? 1 : 0.5)) this.ctx.puffs.emit(e.o.position.x + rand(-1, 1), ALT, e.o.position.z + rand(-1, 1), e.kind === 'boss' ? pick([0x9be36b, 0xc38be8, 0xffffff]) : 0xb7e68f, { vy: 1, life: 0.7, s0: e.kind === 'boss' ? 2 : 0.6, s1: e.kind === 'boss' ? 4 : 1.4 });
        if (e.kind === 'boss' && Math.random() < dt * 6) { sfx.boom(); this.ctx.shake(0.3); }
        if (e.dying <= 0) {
          this.scene.remove(e.o, e.sh);
          if (e.kind === 'boss' && !this.result) { this.result = { type: 'win' }; }
          return false;
        }
        return true;
      }
      if (e.move === 'dive') { e.y -= 5.5 * Math.min(1.4, D.flightSpeed) * dt; e.x += Math.cos(e.t * 2.4 + e.ph) * e.wob * dt * 2; e.ang = Math.PI; }
      else if (e.move === 'swoop') { e.x += e.dir * 7 * dt; e.y = e.y0 - 0.06 * Math.pow(e.t * 7, 2) * 0.5; e.ang = Math.PI - e.dir * 0.7; }
      else if (e.move === 'hover') { if (e.t > 7) e.y -= 7 * dt; else if (e.y > e.ty) e.y -= 6 * dt; e.x += Math.sin(e.t * 1.3 + e.ph) * 2 * dt; e.ang = Math.PI; }
      else if (e.move === 'boss') this.updateBoss(e, dt);
      // tirs
      if (e.move !== 'boss') {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = rand(2, 3.4) / D.flightFire * (e.move === 'hover' ? 0.6 : 1);
          if (e.y < this.Yh - 1 && e.y > -this.Yh * 0.2 && (e.move === 'hover' || Math.random() < 0.6)) this.eshot(e.x, e.y - 1, Math.atan2(p.y - e.y, p.x - e.x), D.flightBolt);
        }
      }
      this.wp(e.x, e.y, e.o.position);
      if (e.move !== 'boss') e.o.rotation.y = screenYaw(e.ang ?? Math.PI);
      e.o.userData.mat.color.setScalar(e.flash > 0 ? 3 : 1);
      e.sh.position.set(e.o.position.x, 0.04, e.o.position.z);
      // touche Lucas en fonçant dedans
      if (this.hitTest(e, p.x, p.y, 0.8)) { this.hurt(); if (e.kind !== 'boss') { e.hp = 0; this.kill(e); } }
      const out = e.y < -this.Yh - 4 || e.x < -this.Xw - 12 || e.x > this.Xw + 12;
      if (out) { this.scene.remove(e.o, e.sh); return false; }
      return true;
    });

    // tirs ennemis
    this.eshots = this.eshots.filter((s) => {
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const sw = this.wp(s.x, s.y);
      if (s.from) { s.rise = Math.min(1, s.rise + dt * 2); s.g.position.lerpVectors(s.from, sw, s.rise); }
      else s.g.position.copy(sw);
      let gone = s.life <= 0 || Math.abs(s.y) > this.Yh + 4 || Math.abs(s.x) > this.Xw + 4;
      if (!gone && (!s.from || s.rise > 0.6) && Math.hypot(s.x - p.x, s.y - p.y) < 0.85) { this.hurt(); gone = true; }
      if (gone) this.scene.remove(s.g);
      return !gone;
    });

    // bonus
    this.pickups = this.pickups.filter((b) => {
      b.t += dt;
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
      if (d < 4) { b.x += dx / d * 12 * dt; b.y += dy / d * 12 * dt; } else b.y -= 2.5 * dt;
      this.wp(b.x, b.y, b.g.position);
      b.g.children[1].rotation.y = screenYaw(Math.sin(b.t * 3) * 0.3);
      if (d < 1.3) {
        if (b.kind === 'power') { p.power = Math.min(4, p.power + 1); sfx.pickup(); this.ctx.words.pop('TIR + !', this.wp(p.x, p.y).setY(ALT + 1.5), '#8fff5a', 1.2); }
        else { p.hp = Math.min(p.maxHp, p.hp + 1); sfx.heal(); this.ctx.hud.hearts(p.hp, p.maxHp); this.ctx.words.pop('+1 ❤', this.wp(p.x, p.y).setY(ALT + 1.5), '#ff6a8a', 1.2); }
        this.scene.remove(b.g); return false;
      }
      if (b.y < -this.Yh - 2) { this.scene.remove(b.g); return false; }
      return true;
    });

    // Han Popo vole à côté de Lucas au début
    if (this.han) this.updateHan(dt);

    // décor qui défile
    const travelled = this.B.dot(SU);
    while (this.decorAt < travelled + 60) {
      this.decorAt += 3;
      if (this.R() < 0.75) {
        const G = this.B.clone().addScaledVector(SU, this.decorAt - travelled + 10).addScaledVector(SR, (this.R() - 0.5) * 50).setY(0);
        const d = flightDecor(this.world.T, this.R);
        d.position.copy(G);
        this.scene.add(d);
        this.decor.push(d);
      }
    }
    this.decor = this.decor.filter((d) => {
      if (_a.copy(d.position).sub(this.B).dot(SU) < -40) { this.scene.remove(d); return false; }
      return true;
    });

    cam.target.copy(this.wp(0, 0));
    this.world.follow(this.wp(0, 0).setY(0));
    return this.result;
  }

  updateBoss(e, dt) {
    const p = this.ship, D = this.ctx.diff;
    if (e.y > this.Yh - 5.5) { e.y -= 3 * dt; return; }
    e.x = Math.sin(e.t * 0.5) * (this.Xw - 3);
    e.fanT -= dt;
    if (e.fanT <= 0) {
      e.fanT = 2.4 / D.flightFire;
      const cy = e.y - 10.7 * 0.36;
      const a = Math.atan2(p.y - cy, p.x - e.x);
      for (let i = -2; i <= 2; i++) this.eshot(e.x + i * 0.5, cy, a + i * 0.22, D.flightBolt);
    }
    e.spawnT -= dt;
    if (e.spawnT <= 0) {
      e.spawnT = 7;
      for (const o of [-3, 3]) this.addFlyer('rot', e.x + o, e.y, 'dive', { wob: 1 });
    }
    if (e.hp < e.maxHp * 0.5) {
      e.spiralT -= dt;
      if (e.spiralT <= 0) {
        e.spiralT = 0.16;
        e.spa = (e.spa || 0) + 0.5;
        if (Math.floor(e.t / 3) % 2 === 0) for (let k = 0; k < 3; k++) this.eshot(e.x, e.y - 3.5, e.spa + k * 2.094, D.flightBolt * 0.8);
      }
    }
  }

  // le Faucon Pétulant de Han Popo aide au début du vol
  addHan() {
    const o = flatSprite(TEX.faucon, 3.6);
    const sh = shadowBlob(3.4);
    this.scene.add(o, sh);
    this.han = { o, sh, x: this.Xw + 6, y: -this.Yh * 0.3, t: 0, fireT: 1, leave: false };
  }
  updateHan(dt) {
    const h = this.han; h.t += dt;
    const tx = h.leave ? this.Xw + 10 : Math.min(this.Xw - 2, 5), ty = h.leave ? this.Yh + 6 : -this.Yh * 0.3 + Math.sin(h.t) * 1.2;
    h.x += (tx - h.x) * Math.min(1, dt * 1.5); h.y += (ty - h.y) * Math.min(1, dt * 1.5);
    this.wp(h.x, h.y, h.o.position);
    h.o.rotation.y = screenYaw(-0.3 + Math.sin(h.t * 2) * 0.1);
    h.sh.position.set(h.o.position.x, 0.04, h.o.position.z);
    h.fireT -= dt;
    if (!h.leave && h.fireT <= 0) {
      h.fireT = 0.5;
      const o = beam(); o.rotation.y = screenYaw(0) + Math.PI; this.scene.add(o);
      this.shots.push({ o, x: h.x, y: h.y + 1.6, vx: 0, vy: 24 });
    }
    if (h.leave && h.y > this.Yh + 4) { this.scene.remove(h.o, h.sh); this.han = null; }
  }

  dispose() {
    for (const e of this.enemies) { if (e.o) this.scene.remove(e.o, e.sh); if (e.g) this.scene.remove(e.g); }
    for (const s of [...this.shots, ...this.pickups]) this.scene.remove(s.o || s.g);
    for (const s of this.eshots) this.scene.remove(s.g);
    for (const d of this.decor) this.scene.remove(d);
    if (this.han) this.scene.remove(this.han.o, this.han.sh);
    this.scene.remove(this.obj, this.shadow);
  }
}
