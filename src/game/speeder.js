// La course en motojet : Lucas file au ras du sol dans la forêt des marais sur sa moto-prout.
// Il évite les arbres, tire devant lui, et donne des coups de sabre aux soldats en motojet à côté de lui.
// Les positions sont « sur l'écran » : x à droite, y vers le haut ; le sol défile sous nos pieds.
import * as THREE from 'three';
import { Fighter, SaberTrail } from '../entities/fighter.js';
import { TEX, flatSprite, shadowBlob, glowSprite, toon, toonMat, rng, screenYaw } from '../engine/gfx.js';
import { sfx } from '../engine/audio.js';
import { SR, SU, rand, clamp, pick, yawOf, Script } from './common.js';
import { FLIGHT_OFF } from './flight.js';

const RIDE = 0.9; // hauteur des motojets
const V = () => new THREE.Vector3();
const _a = V(), _b = V();
const FWD_YAW = yawOf(SU.x, SU.z); // un pilote qui regarde vers le haut de l'écran
// les tirs : formes et couleurs partagées (on en tire des centaines)
const ESHOT_GEO = new THREE.SphereGeometry(0.22, 10, 8), ESHOT_MAT = new THREE.MeshBasicMaterial({ color: 0xf3dcff });
const SHOT_GEO = new THREE.CapsuleGeometry(0.1, 0.8, 4, 8).rotateX(Math.PI / 2), SHOT_MAT = new THREE.MeshBasicMaterial({ color: 0xf0ffd8 });
ESHOT_GEO.userData.keep = SHOT_GEO.userData.keep = true;

// une motojet : corps allongé, guidon, ailerons, réacteur qui brille à l'arrière (le nez vers -z)
export function makeSpeeder(color, glow) {
  const g = new THREE.Group();
  const body = toon(new THREE.CapsuleGeometry(0.42, 2.2, 6, 12).rotateX(Math.PI / 2), color, { outline: 0.05 });
  g.add(body);
  const nose = toon(new THREE.ConeGeometry(0.42, 1.0, 12).rotateX(-Math.PI / 2), 0x3a3a44, { outline: 0.04 });
  nose.position.z = -1.9; g.add(nose);
  const seat = toon(new THREE.BoxGeometry(0.6, 0.25, 1.0), 0x3a2414, { outline: 0.03 });
  seat.position.set(0, 0.45, 0.35); g.add(seat);
  const bar = toon(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6).rotateZ(Math.PI / 2), 0x8d8f99, { outline: 0.02 });
  bar.position.set(0, 0.75, -0.6); g.add(bar);
  for (const sx of [-1, 1]) {
    const fin = toon(new THREE.BoxGeometry(0.9, 0.1, 0.7), color, { outline: 0.03 });
    fin.position.set(sx * 0.6, 0.05, 0.9); fin.rotation.z = sx * 0.2; g.add(fin);
    const vane = toon(new THREE.BoxGeometry(0.08, 0.5, 0.9), 0x3a3a44, { outline: 0.02 });
    vane.position.set(sx * 0.35, -0.2, -1.6); g.add(vane);
  }
  const engine = toon(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 12).rotateX(Math.PI / 2), 0x3a3a44, { outline: 0.03 });
  engine.position.z = 1.55; g.add(engine);
  const fire = glowSprite(glow, 1.6, 0.9); fire.position.z = 2.0; g.add(fire);
  g.userData.fire = fire;
  return g;
}

export class SpeederMode {
  constructor(ctx, opts) {
    this.ctx = ctx; this.scene = ctx.scene; this.world = ctx.world;
    this.t = 0; this.result = null;
    this.speed = 12;
    this.from = opts.from || null; this.cp = null; // point de reprise (on recommence au boss si on perd contre lui)
    this.revived = false;
    this.enemies = []; this.shots = []; this.eshots = []; this.trees = []; this.pickups = []; this.mines = [];
    this.R = rng(77);
    const p = this.player = { x: 0, y: 0, hp: opts.hp ?? ctx.diff.hp, maxHp: ctx.diff.hp, inv: 0, fireT: 0.5, mega: opts.mega ?? 0, tilt: 0, slashT: 0, slashCool: 0 };
    this.B = new THREE.Vector3(0, 0, 4);
    this.layout();
    p.y = -this.Yh * 0.45;
    // la moto de Lucas, et Lucas assis dessus, sabre allumé
    this.bike = makeSpeeder(0xf2f4ee, 0x8fff5a);
    this.lucas = new Fighter('lucas', 2.0);
    this.lucas.setBase('sit'); this.lucas.setSaberOn(1);
    this.lucas.root.position.set(0, 0.15, 0.3);
    this.bike.add(this.lucas.root);
    this.shadow = shadowBlob(2.4);
    this.scene.add(this.bike, this.shadow);
    this.trail = new SaberTrail(this.scene, this.lucas.saber.userData.trailColor);
    this.rowAt = 0;
    this.script = opts.script ? new Script(opts.script(this)) : null;
    ctx.hud.hearts(p.hp, p.maxHp); ctx.hud.mega(p.mega);
  }

  layout() {
    const half = this.ctx.flightHalf();
    this.Yh = half / Math.sin(Math.atan2(FLIGHT_OFF.y, Math.hypot(FLIGHT_OFF.x, FLIGHT_OFF.z)));
    this.Xw = Math.min(half * this.ctx.aspect(), 11);
  }
  wp(x, y, out = V()) { return out.copy(this.B).addScaledVector(SR, x).addScaledVector(SU, y).setY(RIDE); }
  rel(w) { const dx = w.x - this.B.x, dz = w.z - this.B.z; return { x: dx * SR.x + dz * SR.z, y: dx * SU.x + dz * SU.z }; }
  say(who, text, dur) { this.ctx.hud.radio(who, text, dur); }
  checkpoint(name) { this.cp = name; }
  get alive() { return this.enemies.filter((e) => !e.dead).length; }
  clear() { return () => this.alive === 0; }

  // ---------- les soldats en motojet ----------
  addMoto(x, fromBehind = true, opts = {}) {
    const o = makeSpeeder(0x7b3fa0, 0xb04cff);
    const rider = new Fighter('soldat', 2.2);
    rider.setBase('sit'); rider.root.position.set(0, 0.15, 0.3);
    rider.yaw = Math.PI; o.add(rider.root);
    const sh = shadowBlob(2.2);
    this.scene.add(o, sh);
    const e = { kind: 'moto', o, sh, rider, x, y: fromBehind ? -this.Yh - 3 : this.Yh + 3, vy: fromBehind ? 4 : -3, ty: rand(-this.Yh * 0.5, this.Yh * 0.3),
      hp: 2, r: 1.0, t: 0, ph: rand(0, 6), fireT: rand(2, 4), dead: false, flash: 0, ramT: rand(4, 7), ...opts };
    this.enemies.push(e);
    return e;
  }
  motoWave(n, fromBehind = true) { for (let i = 0; i < n; i++) this.addMoto(rand(-this.Xw + 2, this.Xw - 2), fromBehind); }

  // le Gros Bolide : une grosse motojet blindée qui pose des mines et tire en éventail
  boss() {
    const o = new THREE.Group();
    const hull = makeSpeeder(0x5a3a86, 0xd38bff); hull.scale.setScalar(2.2); o.add(hull);
    for (const sx of [-1, 1]) { const r = new Fighter('soldat', 2.2); r.setBase('sit'); r.yaw = Math.PI; r.root.position.set(sx * 0.7, 1.0, 0.8); r.update(0.01); o.add(r.root); }
    const gun = toon(new THREE.CylinderGeometry(0.25, 0.3, 2.2, 10).rotateX(Math.PI / 2), 0x2a2232, { outline: 0.04 });
    gun.position.set(0, 1.4, -1.8); o.add(gun);
    const sh = shadowBlob(5);
    this.scene.add(o, sh);
    const hp = this.ctx.diff.bolideHp;
    const e = { kind: 'bolide', o, sh, x: 0, y: this.Yh + 6, hp, maxHp: hp, r: 2.4, t: 0, ph: 0, fireT: 2, mineT: 3, dead: false, flash: 0, boss: true };
    this.enemies.push(e);
    this.bossE = e;
    this.ctx.hud.boss('LE GROS BOLIDE', 1);
    sfx.alarm();
    return e;
  }

  shoot(x, y, ang, speed, enemy) {
    const g = new THREE.Group();
    if (enemy) g.add(new THREE.Mesh(ESHOT_GEO, ESHOT_MAT), glowSprite(0xb04cff, 1.4, 0.95));
    else {
      const b = new THREE.Mesh(SHOT_GEO, SHOT_MAT);
      b.rotation.y = screenYaw(ang) + Math.PI; g.add(b, glowSprite(0x6dff3a, 1.2, 0.7));
    }
    this.scene.add(g);
    (enemy ? this.eshots : this.shots).push({ g, x, y, vx: Math.sin(ang) * speed, vy: Math.cos(ang) * speed, life: 3 });
    if (enemy) sfx.pew(); else sfx.laser();
  }

  // ---------- coups ----------
  hitEnemy(e, n, slash) {
    if (e.dead) return;
    e.hp -= n; e.flash = 0.1;
    const w = this.wp(e.x, e.y);
    this.ctx.glows.burst(w.x, w.y + 0.6, w.z, 0xeaffc0, 5, 5, { life: 0.25, s0: 0.4, s1: 0.1 });
    if (e.boss) this.ctx.hud.boss('LE GROS BOLIDE', Math.max(0, e.hp / e.maxHp));
    if (e.hp <= 0) this.crash(e, slash);
    else sfx.hit();
  }
  crash(e, why) {
    e.dead = true; e.dying = e.boss ? 2.2 : 0.8; e.spin = rand(8, 14) * (Math.random() < 0.5 ? -1 : 1);
    e.vx = (Math.random() < 0.5 ? -1 : 1) * rand(6, 10);
    const w = this.wp(e.x, e.y);
    this.ctx.words.pop(why === 'slash' ? pick(['PAF !', 'ZING !', 'SCHLAK !']) : why === 'tree' ? 'BONK !' : pick(['POUF !', 'BAM !']), w.clone().setY(2.6), pick(['#ffd23f', '#8fff5a']), 1.4);
    this.ctx.puffs.burst(w.x, 1, w.z, 0x9be36b, 10, 5, { life: 0.8, s0: 0.8, s1: 2 });
    sfx.boom();
    this.player.mega = Math.min(1, this.player.mega + 0.08); this.ctx.hud.mega(this.player.mega);
    if (e.boss) {
      this.ctx.hud.boss(null); sfx.mega(); this.ctx.shake(1.2);
      this.ctx.words.pop('GROS BOLIDE EN PANNE !', w.clone().setY(3.5), '#8fff5a', 2.2);
      for (const s of this.eshots) s.life = 0;
      for (const m of this.mines) this.scene.remove(m.o);
      this.mines = [];
    } else if (Math.random() < 0.2) this.dropPickup(e.x, e.y);
  }

  dropPickup(x, y) {
    const g = new THREE.Group();
    g.add(glowSprite(0xff6a8a, 2.4, 0.7), flatSprite(TEX.bonus, 1.1));
    this.scene.add(g);
    this.pickups.push({ g, x, y, t: 0 });
  }

  slash() {
    const p = this.player;
    if (p.slashCool > 0) return;
    p.slashCool = 0.45; p.slashT = 0.35;
    this.lucas.play(Math.random() < 0.5 ? 'atk2' : 'atk1', 1.8, 0.8);
    sfx.swing();
    for (const e of this.enemies) if (!e.dead && Math.abs(e.x - p.x) < 3.6 + e.r && Math.abs(e.y - p.y) < 2.6 + e.r) this.hitEnemy(e, e.boss ? 4 : 3, 'slash');
    for (const s of this.eshots) if (Math.hypot(s.x - p.x, s.y - p.y) < 2.6) { s.life = 0; this.ctx.words.pop('PING !', this.wp(s.x, s.y).setY(2), '#8fff5a', 1); sfx.ping(); }
  }

  megaProut() {
    const p = this.player;
    p.mega = 0; this.ctx.hud.mega(0);
    sfx.mega(); this.ctx.shake(0.9);
    const w = this.wp(p.x, p.y);
    this.ctx.words.pop('MÉGA-PROUT !', w.clone().setY(3), '#8fff5a', 2.2);
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; this.ctx.puffs.emit(w.x, 1, w.z, i % 2 ? 0x9be36b : 0xc8f59a, { vx: Math.cos(a) * 20, vz: Math.sin(a) * 20, life: 1, s0: 1.5, s1: 4.5, drag: 1.8 }); }
    for (const s of this.eshots) s.life = 0;
    for (const m of this.mines) m.boom = true;
    for (const e of this.enemies) if (!e.dead) this.hitEnemy(e, e.boss ? 10 : 99);
  }

  hurt(dir = 0) {
    const p = this.player;
    if (p.inv > 0 || this.result) return;
    p.hp -= 1; p.inv = 1.5;
    sfx.hurt(); this.ctx.shake(0.6);
    this.lucas.flash = 1;
    p.x += dir * 1.5;
    const w = this.wp(p.x, p.y);
    this.ctx.puffs.burst(w.x, 1, w.z, 0xc38be8, 12, 4, { life: 0.8, s0: 0.6, s1: 1.6 });
    this.ctx.hud.hearts(Math.max(0, p.hp), p.maxHp);
    if (p.hp <= 0 && !this.revived) { // une deuxième chance, une seule fois : Maître Gazou remplit les cœurs
      this.revived = true; p.hp = p.maxHp; p.inv = 3;
      this.ctx.hud.hearts(p.hp, p.maxHp); sfx.heal();
      this.ctx.words.pop('2e CHANCE !', w.clone().setY(3), '#8fff5a', 2.2);
      this.say('gazou', 'Abandonner, jamais ! Le Gaz, une deuxième chance te donne.', 3.5);
      for (const s of this.eshots) s.life = 0;
      return;
    }
    if (p.hp <= 0) { this.crashT = 1.4; this.ctx.words.pop('OUPS !', w.clone().setY(3), '#ff8a3d', 2); }
  }

  // ---------- la forêt qui défile : une rangée d'arbres de temps en temps, avec un passage libre ----------
  spawnRow(ahead) {
    const n = 1 + Math.floor(this.R() * 3);
    const gap = rand(-this.Xw + 2.5, this.Xw - 2.5);
    for (let i = 0; i < n; i++) {
      let x = rand(-this.Xw - 2, this.Xw + 2);
      if (Math.abs(x - gap) < 2.6) x = gap + (x < gap ? -2.8 : 2.8);
      const big = this.R() < 0.75;
      const o = big ? swampTreeLite(this.R) : rockLite(this.R);
      const G = this.wp(x, ahead).setY(0);
      o.position.copy(G);
      this.scene.add(o);
      this.trees.push({ o, G, r: big ? 1.0 : 0.8 });
    }
  }

  // ---------- la boucle ----------
  update(dt) {
    this.t += dt;
    this.layout();
    const p = this.player, inp = this.ctx.input, cam = this.ctx.cam;
    cam.elev = 1;
    if (!this.bossE || !this.bossE.dead) this.B.addScaledVector(SU, this.speed * dt);
    this.script && this.script.update(dt);

    // pilotage
    if (this.crashT === undefined) {
      const k = this.ctx.dragScale();
      const px = p.x;
      p.x += inp.drag.x * k + inp.move.x * 13 * dt;
      p.y += inp.drag.y * k + inp.move.y * 10 * dt;
      p.x = clamp(p.x, -this.Xw + 1, this.Xw - 1);
      p.y = clamp(p.y, -this.Yh * 0.75, this.Yh * 0.25);
      p.tilt += (clamp((p.x - px) / Math.max(dt, 0.001) * 0.05, -0.5, 0.5) - p.tilt) * Math.min(1, dt * 8);
      p.inv -= dt; p.slashCool -= dt; p.slashT -= dt;
      // coup de sabre tout seul quand une motojet est juste à côté (le doigt est occupé à piloter)
      let near = false;
      for (const e of this.enemies) if (!e.dead && !e.boss && Math.abs(e.x - p.x) < 3.2 + e.r && Math.abs(e.y - p.y) < 2.2 + e.r) { near = true; break; }
      if (inp.attack || near) this.slash();
      if (inp.mega && p.mega >= 1) this.megaProut();
      p.fireT -= dt;
      if (p.fireT <= 0) { p.fireT = 0.28; this.shoot(p.x, p.y + 2, 0, 26, false); }
    } else {
      this.crashT -= dt; p.tilt += dt * 8;
      if (this.crashT <= 0 && !this.result) this.result = { type: 'dead' };
    }
    const w = this.wp(p.x, p.y);
    this.bike.position.copy(w).setY(RIDE + Math.sin(this.t * 9) * 0.06);
    this.bike.rotation.set(0, FWD_YAW + Math.PI, -p.tilt, 'YXZ');
    this.bike.visible = p.inv <= 0 || Math.floor(this.t * 14) % 2 === 0;
    this.shadow.position.set(w.x, 0.05, w.z);
    this.lucas.update(dt);
    this.lucas.yaw = Math.PI; // il regarde vers le nez de la moto
    this.lucas.saberEnds(_a, _b); this.trail.push(_a, _b, p.slashT > 0);
    if (Math.random() < 0.8) this.ctx.puffs.emit(w.x - SU.x * 2, 0.5, w.z - SU.z * 2, 0x9be36b, { vx: -SU.x * 6 + rand(-1, 1), vz: -SU.z * 6 + rand(-1, 1), vy: 1, life: 0.5, s0: 0.5, s1: 1.4 });

    // la forêt
    const travelled = this.B.dot(SU);
    while (this.rowAt < travelled + this.Yh + 30) {
      this.rowAt += this.treeGap || 10;
      if (this.trees.length < 60 && !this.noTrees) this.spawnRow(this.rowAt - travelled);
    }
    this.trees = this.trees.filter((t) => {
      const q = this.rel(t.G);
      if (q.y < -this.Yh - 8) { this.scene.remove(t.o); return false; }
      if (Math.abs(q.y - p.y) < 1.0 && Math.abs(q.x - p.x) < t.r + 0.35 && this.crashT === undefined) {
        if (p.inv <= 0) { this.ctx.words.pop('BONK !', w.clone().setY(2.5), '#ffd23f', 1.3); this.hurt(p.x > q.x ? 1 : -1); }
      }
      for (const e of this.enemies) if (!e.dead && !e.boss && Math.abs(q.y - e.y) < 1.2 && Math.abs(q.x - e.x) < t.r + 0.6) this.crash(e, 'tree');
      return true;
    });

    // tirs de Lucas
    this.shots = this.shots.filter((s) => {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      this.wp(s.x, s.y, s.g.position).setY(RIDE + 0.6);
      let gone = s.life <= 0 || s.y > this.Yh + 3;
      if (!gone) for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 0.4) { this.hitEnemy(e, 1); gone = true; break; }
      if (!gone) for (const t of this.trees) { const q = this.rel(t.G); if (Math.hypot(q.x - s.x, q.y - s.y) < t.r) { gone = true; break; } }
      if (gone) this.scene.remove(s.g);
      return !gone;
    });

    // ennemis
    const D = this.ctx.diff;
    this.enemies = this.enemies.filter((e) => {
      e.t += dt; e.flash -= dt;
      if (e.dead) { // il part en vrille et s'écrase
        e.dying -= dt; e.x += e.vx * dt; e.y -= this.speed * 0.5 * dt;
        e.o.rotation.z += e.spin * dt * 0.5; e.o.rotation.y += e.spin * dt * 0.3;
        this.wp(e.x, e.y, e.o.position).setY(RIDE * Math.max(0, e.dying));
        if (Math.random() < 0.6) this.ctx.puffs.emit(e.o.position.x, 1, e.o.position.z, 0x777777, { vy: 1.5, life: 0.7, s0: 0.6, s1: 1.6 });
        if (e.dying <= 0) {
          this.scene.remove(e.o, e.sh);
          if (e.boss && !this.result) this.result = { type: 'win' };
          return false;
        }
        return true;
      }
      if (e.kind === 'moto') {
        e.y += (e.ty - e.y) * Math.min(1, dt * 0.8) + Math.sin(e.t * 0.7 + e.ph) * 0.6 * dt;
        e.ramT -= dt;
        if (e.ramT < 0.7 && e.ramT > 0 && !e.warned) { e.warned = true; this.ctx.words.pop('!', this.wp(e.x, e.y).setY(3), '#ff4a3a', 1.6); }
        if (e.ramT > 0 && e.ramT < 0.7) e.flash = Math.sin(e.t * 24) > 0 ? 0.05 : 0; // il clignote : il va foncer !
        if (e.ramT <= 0) e.warned = false;
        if (e.t > 12 && !e.leaving && e.y < p.y + 1) { e.leaving = true; e.ty = this.Yh + 12; } // il ne reste pas coincé derrière Lucas : il double et s'en va
        if (e.ramT < 0 && e.ramT > -1.1) { e.x += Math.sign(p.x - e.x) * 7 * dt; e.flash = Math.sin(e.t * 30) > 0 ? 0.05 : 0; } // il fonce sur le côté vers Lucas !
        else { if (e.ramT <= -1.1) e.ramT = rand(4, 7); e.x += Math.sin(e.t * 1.2 + e.ph) * 2.5 * dt; }
        e.x = clamp(e.x, -this.Xw - 1, this.Xw + 1);
        e.fireT -= dt;
        if (e.fireT <= 0) { e.fireT = rand(2.5, 4) / D.flightFire; if (e.y > p.y - 1) this.shoot(e.x, e.y - 1, Math.atan2(p.x - e.x, p.y - e.y), D.flightBolt * 0.9, true); }
        if (Math.abs(e.x - p.x) < 1.6 && Math.abs(e.y - p.y) < 1.6) { this.hurt(p.x > e.x ? 1 : -1); e.x += (e.x > p.x ? 1 : -1) * 1.5; }
      } else { // le Gros Bolide
        e.y += ((this.Yh * 0.45) - e.y) * Math.min(1, dt * 0.7);
        e.x = Math.sin(e.t * 0.6) * (this.Xw - 3);
        e.fireT -= dt;
        if (e.fireT <= 0) { e.fireT = 2.4 / D.flightFire; const a = Math.atan2(p.x - e.x, p.y - e.y); for (const da of [-0.4, -0.2, 0, 0.2, 0.4]) this.shoot(e.x, e.y - 2, a + da, D.flightBolt, true); }
        e.mineT -= dt;
        if (e.mineT <= 0) { e.mineT = e.hp < e.maxHp * 0.5 ? 1.2 : 2; this.dropMine(e.x, e.y - 2.5); }
        if (Math.abs(e.x - p.x) < 2.6 && Math.abs(e.y - p.y) < 2.4) this.hurt(p.x > e.x ? 1 : -1);
      }
      this.wp(e.x, e.y, e.o.position).setY(RIDE + Math.sin(this.t * 8 + (e.ph || 0)) * 0.06);
      e.o.rotation.set(0, FWD_YAW + Math.PI, Math.sin(e.t * 1.2 + (e.ph || 0)) * 0.25, 'YXZ');
      if (e.rider && e.flash > 0) e.rider.flash = 1;
      e.sh.position.set(e.o.position.x, 0.05, e.o.position.z);
      if (e.rider) e.rider.update(dt);
      if (e.y < -this.Yh - 6 || e.y > this.Yh + 8) { this.scene.remove(e.o, e.sh); return false; }
      return true;
    });

    // tirs ennemis
    this.eshots = this.eshots.filter((s) => {
      s.life -= dt; s.x += s.vx * dt; s.y += (s.vy - this.speed * 0.15) * dt;
      this.wp(s.x, s.y, s.g.position).setY(RIDE + 0.6);
      let gone = s.life <= 0 || Math.abs(s.y) > this.Yh + 4;
      if (!gone && Math.hypot(s.x - p.x, s.y - p.y) < 0.9) { this.hurt(); gone = true; }
      if (gone) this.scene.remove(s.g);
      return !gone;
    });

    // mines du Gros Bolide (elles restent au sol, donc elles « reculent » vers Lucas)
    this.mines = this.mines.filter((m) => {
      m.t += dt;
      const q = this.rel(m.G);
      m.o.children[1].material.opacity = 0.4 + 0.4 * Math.sin(m.t * 14);
      if (!m.boom && Math.hypot(q.x - p.x, q.y - p.y) < 1.5) { m.boom = true; this.hurt(); }
      if (m.boom || q.y < -this.Yh - 4) {
        if (m.boom) { this.ctx.puffs.burst(m.G.x, 0.6, m.G.z, 0xb58be0, 10, 4, { life: 0.8, s0: 0.8, s1: 2 }); sfx.boom(); }
        this.scene.remove(m.o); return false;
      }
      return true;
    });

    // bonus
    this.pickups = this.pickups.filter((b) => {
      b.t += dt;
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
      if (d < 4) { b.x += dx / d * 12 * dt; b.y += dy / d * 12 * dt; } else b.y -= this.speed * 0.4 * dt;
      this.wp(b.x, b.y, b.g.position).setY(1.2);
      if (d < 1.3) { p.hp = Math.min(p.maxHp, p.hp + 1); sfx.heal(); this.ctx.hud.hearts(p.hp, p.maxHp); this.ctx.words.pop('+1 ❤', w.clone().setY(2.5), '#ff6a8a', 1.2); this.scene.remove(b.g); return false; }
      if (b.y < -this.Yh - 2) { this.scene.remove(b.g); return false; }
      return true;
    });

    cam.target.copy(this.wp(0, 0)).setY(0);
    this.world.follow(cam.target);
    return this.result;
  }

  dropMine(x, y) {
    const g = new THREE.Group();
    g.add(toon(new THREE.SphereGeometry(0.55, 12, 9), 0x3a2848, { outline: 0.04 }));
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true }));
    light.position.y = 0.5; g.add(light);
    const G = this.wp(x, y).setY(0.4);
    g.position.copy(G);
    this.scene.add(g);
    this.mines.push({ o: g, G, t: 0, boom: false });
  }

  dispose() {
    for (const e of this.enemies) this.scene.remove(e.o, e.sh);
    for (const s of [...this.shots, ...this.eshots]) this.scene.remove(s.g);
    for (const t of this.trees) this.scene.remove(t.o);
    for (const b of this.pickups) this.scene.remove(b.g);
    for (const m of this.mines) this.scene.remove(m.o);
    this.scene.remove(this.bike, this.shadow);
    this.trail.dispose(this.scene);
  }
}

// arbres et rochers légers pour la forêt qui défile
const trunkGeo = new THREE.CylinderGeometry(0.4, 0.7, 4, 8);
const crownGeo = new THREE.SphereGeometry(1, 10, 8), rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
trunkGeo.userData.keep = crownGeo.userData.keep = rockGeo.userData.keep = true; // partagées par tous les arbres
function swampTreeLite(R) {
  const g = new THREE.Group();
  const t = toon(trunkGeo, 0x5a4030, { outline: 0.06 }); t.position.y = 2; g.add(t);
  for (const [x, y, z, r] of [[0, 4.3, 0, 1.7], [1, 3.8, 0.3, 1.2], [-1, 3.9, -0.3, 1.3]]) {
    const c = new THREE.Mesh(crownGeo, toonMat(R() < 0.5 ? 0x4f8a32 : 0x3f7a2a));
    c.scale.setScalar(r);
    c.position.set(x, y, z); g.add(c);
  }
  g.rotation.y = R() * 6;
  return g;
}
function rockLite(R) {
  const g = toon(rockGeo, R() < 0.5 ? 0x6a7048 : 0x4a5236, { outline: 0.06 });
  g.position.y = 0.5; g.rotation.set(R(), R() * 6, R());
  const w = new THREE.Group(); w.add(g);
  return w;
}
