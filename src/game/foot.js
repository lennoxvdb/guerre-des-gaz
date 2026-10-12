// Le combat à pied au sabre-gaz : Lucas contre les soldats de Dark Roteur (et Dark Roteur lui-même).
// Les vaisseaux ennemis passent au-dessus, bombardent (cercles rouges) et lâchent des soldats dans des bulles.
import * as THREE from 'three';
import { Fighter, SaberTrail, makeSaber } from '../entities/fighter.js';
import { TEX, flatSprite, shadowBlob, warnDisc, glowSprite, standee } from '../engine/gfx.js';
import { sfx } from '../engine/audio.js';
import { SR, SU, rand, clamp, pick, wrapA, yawOf, dist2, HIT_WORDS, Script } from './common.js';

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V();

export class FootMode {
  constructor(ctx, opts) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.world = ctx.world;
    this.radius = opts.radius ?? 30;
    this.t = 0;
    this.enemies = []; this.bolts = []; this.strafes = []; this.pickups = []; this.fx = [];
    this.result = null;
    this.megaName = opts.megaName || 'MÉGA-PROUT';

    // Lucas
    const f = new Fighter('lucas', 2.0);
    this.scene.add(f.root);
    const h = this.hero = {
      f, pos: opts.heroPos ? opts.heroPos.clone() : V(), vel: V(), knock: V(),
      hp: ctx.diff.hp, maxHp: ctx.diff.hp, inv: 0, mega: opts.mega ?? 0,
      stage: 0, atkT: 0, atkLen: 0, hitAt: 0, hitDone: true, queued: false, comboT: 0,
      blocking: false, special: 0, dead: false, deadT: 0, cheer: false,
    };
    h.f.root.position.copy(h.pos);
    h.f.yaw = Math.PI * 1.25; // regarde vers le haut de l'écran
    h.f.setSaberOn(0);
    this.saberOn = 0;
    this.trail = new SaberTrail(this.scene, 0x8fff5a);
    this.camPos = h.pos.clone();
    this.script = opts.script ? new Script(opts.script(this)) : null;
    ctx.hud.hearts(h.hp, h.maxHp);
    ctx.hud.mega(h.mega);
  }

  // ---------- aides pour les scénarios ----------
  say(who, text, dur) { this.ctx.hud.radio(who, text, dur); }
  get alive() { return this.enemies.filter((e) => !e.dead).length; }
  clear() { return () => this.alive === 0 && !this.strafes.some((s) => s.drops); }

  // un soldat qui tombe du ciel dans une bulle
  drop(kind, x, z, delay = 0) {
    const e = this.makeSoldier(kind, x, z);
    e.state = 'drop'; e.y = 14 + delay * 7; e.t = 0;
    const bub = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28, depthWrite: false }));
    const rim = new THREE.Mesh(new THREE.SphereGeometry(1.62, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.BackSide, depthWrite: false }));
    bub.add(rim); bub.position.y = 1.2;
    e.f.root.add(bub); e.bubble = bub;
    e.shadow = shadowBlob(1.6); e.shadow.position.set(x, 0.04, z); this.scene.add(e.shadow);
    return e;
  }
  // plusieurs soldats autour d'un point (ou autour de Lucas)
  dropGroup(kinds, around, spread = 5) {
    const c = around || this.hero.pos;
    kinds.forEach((k, i) => {
      const a = rand(0, Math.PI * 2), d = rand(spread * 0.6, spread);
      let x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      const r = Math.hypot(x, z);
      if (r > this.radius - 3) { x *= (this.radius - 3) / r; z *= (this.radius - 3) / r; }
      this.drop(k, x, z, i * 0.25);
    });
    // un vaisseau-transport passe au-dessus pendant la chute
    this.flyover(c, false);
  }

  makeSoldier(kind, x, z) {
    const f = new Fighter('soldat', 2.3);
    if (kind === 'ventouse') f.givePlunger();
    f.root.position.set(x, 0, z);
    f.yaw = yawOf(this.hero.pos.x - x, this.hero.pos.z - z);
    f.setBase('idle');
    this.scene.add(f.root);
    const e = {
      kind, f, pos: new THREE.Vector3(x, 0, z), knock: V(), y: 0,
      hp: kind === 'ventouse' ? this.ctx.diff.soldierHp : this.ctx.diff.soldierHp,
      state: 'idle', t: 0, cool: rand(1.2, 2.4), side: Math.random() < 0.5 ? -1 : 1, dead: false, r: 0.7,
    };
    this.enemies.push(e);
    return e;
  }

  // Dark Roteur arrive pour le duel
  spawnRoteur(x, z) {
    const f = new Fighter('roteur', 3.4);
    f.root.position.set(x, 0, z);
    f.setBase('guard');
    this.scene.add(f.root);
    const e = {
      kind: 'roteur', f, pos: new THREE.Vector3(x, 0, z), knock: V(), y: 0,
      hp: this.ctx.diff.roteurHp, maxHp: this.ctx.diff.roteurHp, state: 'stalk', t: 0, cool: 1.5,
      dead: false, r: 1.1, combo: 0, parried: 0, phase: 1, boss: true, thrown: null,
    };
    e.trail = new SaberTrail(this.scene, 0xb04cff);
    e.arc = this.makeArc();
    this.enemies.push(e);
    this.roteur = e;
    return e;
  }

  // part de disque rouge au sol devant Dark Roteur : « son coup va taper ici »
  makeArc() {
    const geo = new THREE.CircleGeometry(1, 24, -0.8, 1.6).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false }));
    m.position.y = 0.05; m.renderOrder = 2;
    this.scene.add(m);
    return m;
  }

  // ---------- vaisseaux ennemis au-dessus de la planète ----------
  flyover(target, bombs) {
    const a = rand(0, Math.PI * 2);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const start = target.clone().addScaledVector(dir, -32);
    const ship = flatSprite(TEX.rot, 3.4);
    ship.rotation.y = Math.atan2(-dir.x, -dir.z) + Math.PI; // le dessin a le nez vers le bas
    ship.position.copy(start); ship.position.y = 7.5;
    const shadow = shadowBlob(3.2);
    this.scene.add(ship, shadow);
    const s = { ship, shadow, dir, pos: start.clone(), speed: 17, t: 0, impacts: [], drops: false };
    if (bombs) {
      for (let i = -2; i <= 3; i++) {
        const p = target.clone().addScaledVector(dir, i * 2.4);
        if (Math.hypot(p.x, p.z) > this.radius) continue;
        const w = warnDisc(2.8); w.position.set(p.x, 0.06, p.z); this.scene.add(w);
        s.impacts.push({ p, w, at: (32 + i * 2.4) / s.speed });
      }
    }
    this.strafes.push(s);
    sfx.whoosh();
    return s;
  }
  strafe() { this.flyover(this.hero.pos.clone().add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2))), true); }

  // ---------- tirs ----------
  shoot(from, to, owner, speed) {
    const dir = _a.copy(to).sub(from); dir.y = 0; dir.normalize();
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf3dcff }));
    const glow = glowSprite(0xb04cff, 1.5, 0.95);
    g.add(core, glow);
    g.position.copy(from); g.position.y = 1.2;
    this.scene.add(g);
    this.bolts.push({ g, glow, core, vel: dir.clone().multiplyScalar(speed), owner, reflected: false, life: 4 });
    sfx.pew();
  }

  reflect(b) {
    // vers le tireur s'il est encore là, sinon vers l'ennemi le plus proche
    let tgt = b.owner && !b.owner.dead ? b.owner : null;
    if (!tgt) {
      let best = 1e9;
      for (const e of this.enemies) if (!e.dead) { const d = dist2(e.pos, b.g.position); if (d < best) { best = d; tgt = e; } }
    }
    const dir = tgt ? _a.copy(tgt.pos).sub(b.g.position) : b.vel.clone().negate();
    dir.y = 0; dir.normalize();
    b.vel.copy(dir).multiplyScalar(17);
    b.reflected = true; b.target = tgt; b.life = 2;
    b.glow.material.color.set(0x8fff5a); b.core.material.color.set(0xeaffd8);
    sfx.ping();
    this.ctx.words.pop('PING !', b.g.position.clone().setY(2.4), '#8fff5a', 1.1);
    this.ctx.glows.burst(b.g.position.x, 1.2, b.g.position.z, 0x8fff5a, 8, 4, { life: 0.3, s0: 0.3, s1: 0.1 });
  }

  // ---------- Lucas ----------
  heroFacing() { return _c.set(Math.sin(this.hero.f.yaw), 0, Math.cos(this.hero.f.yaw)); }

  nearestEnemy(maxD) {
    let best = maxD, tgt = null;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'drop') continue;
      const d = dist2(e.pos, this.hero.pos);
      if (d < best) { best = d; tgt = e; }
    }
    return tgt;
  }

  startSwing() {
    const h = this.hero;
    const names = ['atk1', 'atk2', 'atk3'];
    const n = names[h.stage];
    h.atkLen = h.f.play(n, 1.7, 0.78);
    h.atkT = h.atkLen; h.hitAt = h.atkLen * 0.62; h.hitDone = false; h.queued = false;
    const tgt = this.nearestEnemy(6.5);
    if (tgt) {
      h.f.yaw = yawOf(tgt.pos.x - h.pos.x, tgt.pos.z - h.pos.z);
      const d = dist2(tgt.pos, h.pos);
      if (d > 1.8) h.knock.addScaledVector(this.heroFacing(), Math.min(9, (d - 1.5) * 4));
    }
    sfx.swing(1 + h.stage * 0.15);
  }

  swingHits() {
    const h = this.hero, fwd = this.heroFacing().clone();
    const dmg = h.stage === 2 ? 2 : 1;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'drop') continue;
      const dx = e.pos.x - h.pos.x, dz = e.pos.z - h.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.6 + e.r) continue;
      const ang = Math.acos(clamp((dx * fwd.x + dz * fwd.z) / (d || 1), -1, 1));
      if (ang > 1.35 && d > 1.2) continue;
      this.damage(e, dmg, _a.set(dx, 0, dz).normalize(), h.stage === 2 ? 9 : 6);
    }
    // les tirs ennemis tout près sont renvoyés par la lame
    for (const b of this.bolts) if (!b.reflected && dist2(b.g.position, h.pos) < 2.3) this.reflect(b);
  }

  damage(e, n, dir, knock) {
    if (e.dead) return;
    // Dark Roteur pare les coups de face quand il est en garde
    if (e.kind === 'roteur' && e.state === 'stalk' && Math.random() < 0.55) {
      this.clash(e.pos.clone().lerp(this.hero.pos, 0.5));
      e.f.play('blockHit', 1.4);
      this.hero.knock.addScaledVector(dir, -5);
      return;
    }
    e.hp -= n;
    e.f.flash = 1;
    e.knock.addScaledVector(dir, e.kind === 'roteur' ? knock * 0.3 : knock);
    const p = e.pos.clone().setY(2.2);
    this.ctx.words.pop(pick(HIT_WORDS), p, pick(['#ffd23f', '#8fff5a', '#ff8a3d']), 1.3);
    this.ctx.puffs.burst(e.pos.x, 1.2, e.pos.z, 0x9be36b, 6, 3, { life: 0.6, s0: 0.5, s1: 1.4 });
    this.ctx.glows.burst(e.pos.x, 1.4, e.pos.z, 0xeaffc0, 6, 6, { life: 0.25, s0: 0.25, s1: 0.05 });
    sfx.hit();
    this.ctx.hitstop(0.05);
    this.hero.mega = Math.min(1, this.hero.mega + 0.07);
    this.ctx.hud.mega(this.hero.mega);
    if (e.kind === 'roteur') {
      this.ctx.hud.boss('DARK ROTEUR', Math.max(0, e.hp / e.maxHp));
      if (e.hp <= 0) this.defeatRoteur(e);
      else if (e.state !== 'stunned' && e.state !== 'throw') { e.f.play('hit', 1.2); }
      return;
    }
    if (e.hp <= 0) this.kill(e);
    else { e.state = 'hurt'; e.t = 0; e.f.play('hit', 1.4); }
  }

  kill(e) {
    e.dead = true; e.state = 'dead'; e.t = 0;
    e.f.play('death', 1.3);
    if (Math.random() < 0.5) this.spawnPickup(e.pos, Math.random() < 0.6 ? 'heal' : 'mega');
  }

  clash(p) {
    sfx.clash();
    this.ctx.words.pop('CLANG !', p.clone().setY(2.6), '#ffffff', 1.3);
    this.ctx.glows.burst(p.x, 1.5, p.z, 0xfff3b0, 14, 7, { life: 0.35, s0: 0.3, s1: 0.05 });
    this.ctx.shake(0.25);
  }

  hurtHero(n, from) {
    const h = this.hero;
    if (h.inv > 0 || h.dead || h.special > 0) return;
    h.hp -= n; h.inv = 1.3;
    h.f.flash = 1; h.f.play('hit', 1.4);
    if (from) h.knock.add(_a.copy(h.pos).sub(from).setY(0).normalize().multiplyScalar(7));
    sfx.hurt();
    this.ctx.shake(0.45);
    this.ctx.puffs.burst(h.pos.x, 1.2, h.pos.z, 0xc38be8, 10, 3, { life: 0.8 });
    this.ctx.hud.hearts(Math.max(0, h.hp), h.maxHp);
    if (h.hp <= 0) { h.dead = true; h.deadT = 0; h.f.play('death', 1); h.f.setSaberOn(0); }
  }

  megaProut() {
    const h = this.hero;
    h.mega = 0; this.ctx.hud.mega(0);
    h.special = 1.1; h.atkT = 0;
    h.f.play('spin', 1.1, 0.9);
    sfx.mega();
    this.ctx.shake(0.8);
    this.ctx.words.pop(this.megaName + ' !', h.pos.clone().setY(3.2), '#8fff5a', 2.2);
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2;
      this.ctx.puffs.emit(h.pos.x, 0.8, h.pos.z, i % 2 ? 0x9be36b : 0xc8f59a, { vx: Math.cos(a) * 14, vz: Math.sin(a) * 14, vy: 1, life: 0.9, s0: 1, s1: 3.5, drag: 2.2 });
    }
    for (const e of this.enemies) {
      if (e.dead || e.state === 'drop') continue;
      const d = dist2(e.pos, h.pos);
      if (d < 7.5) {
        if (e.kind === 'roteur') { e.state = 'stunned'; e.t = 0; e.hp -= 2; e.f.flash = 1; this.ctx.hud.boss('DARK ROTEUR', Math.max(0, e.hp / e.maxHp)); if (e.hp <= 0) this.defeatRoteur(e); }
        else this.damage(e, 5, _a.copy(e.pos).sub(h.pos).normalize(), 14);
      }
    }
    for (const b of this.bolts) b.life = 0;
  }

  spawnPickup(at, kind) {
    const s = standee(TEX.bonus, 1.0);
    const glow = glowSprite(kind === 'heal' ? 0xff6a8a : 0x8fff5a, 2.2, 0.6);
    glow.position.y = 0.5;
    const g = new THREE.Group(); g.add(glow, s);
    g.position.set(at.x, 0, at.z);
    this.scene.add(g);
    this.pickups.push({ g, kind, t: 0 });
  }

  updateHero(dt) {
    const h = this.hero, f = h.f, inp = this.ctx.input;
    if (h.dead) {
      h.deadT += dt; f.update(dt);
      if (h.deadT > 2.2 && !this.result) this.result = { type: 'dead' };
      return;
    }
    h.inv -= dt; h.special -= dt; h.comboT -= dt;
    // allumer le sabre au début
    if (this.saberOn < 1) { if (this.saberOn === 0) sfx.ignite(); this.saberOn = Math.min(1, this.saberOn + dt * 3); f.setSaberOn(this.saberOn); }

    // déplacement (joystick ou flèches) : sur l'écran → sur le sol
    const mv = _b.set(0, 0, 0).addScaledVector(SR, inp.move.x).addScaledVector(SU, inp.move.y);
    const mag = Math.min(1, mv.length());
    h.blocking = inp.block && h.atkT <= 0 && h.special <= 0 && !h.cheer;
    let speed = 6.8;
    if (h.blocking) speed = 2.6;
    if (h.atkT > 0 || h.special > 0) speed = 1.2;
    if (h.cheer) speed = 0;
    h.vel.copy(mv).multiplyScalar(speed);

    // attaques
    if (h.atkT > 0) {
      h.atkT -= dt;
      if (!h.hitDone && h.atkT <= h.hitAt) { h.hitDone = true; this.swingHits(); }
      if (inp.attack && h.atkT < h.atkLen * 0.6) h.queued = true;
      if (h.atkT <= 0) {
        h.comboT = 0.45;
        if (h.queued && h.stage < 2) { h.stage++; this.startSwing(); }
        else h.stage = h.stage >= 2 ? 0 : h.stage + 1;
      }
    } else if (inp.attack && h.special <= 0 && !h.cheer) {
      if (h.comboT <= 0) h.stage = 0;
      this.startSwing();
    }
    if (h.comboT <= 0 && h.atkT <= 0) h.stage = 0;
    if (inp.mega && h.mega >= 1 && h.special <= 0 && !h.cheer) this.megaProut();

    // se tourner
    if (h.atkT <= 0 && h.special <= 0 && mag > 0.15) f.turnTo(yawOf(mv.x, mv.z), dt, h.blocking ? 6 : 14);
    if (h.blocking) {
      const tgt = this.nearestEnemy(12);
      if (tgt && mag < 0.15) f.turnTo(yawOf(tgt.pos.x - h.pos.x, tgt.pos.z - h.pos.z), dt, 10);
    }
    f.setBase(h.cheer ? 'idle' : h.blocking ? 'block' : mag > 0.15 ? 'run' : 'idle', mag > 0.15 ? 0.6 + mag * 0.6 : 1);
    if (h.cheer && f.action !== 'cheer') f.play('cheer');

    // bouger (avec l'élan des coups) et ne pas traverser le décor
    h.pos.addScaledVector(h.vel, dt).addScaledVector(h.knock, dt);
    h.knock.multiplyScalar(Math.exp(-dt * 8));
    this.collide(h.pos, 0.6);
    f.root.position.copy(h.pos);
    // clignote quand il est invincible
    f.root.visible = h.inv <= 0 || Math.floor(this.t * 14) % 2 === 0;
    f.update(dt);
    f.saberEnds(_a, _b);
    this.trail.push(_a, _b, h.atkT > 0 || h.special > 0);
  }

  collide(p, r) {
    for (const o of this.world.obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
      if (d < m && d > 0.001) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; }
    }
    const d = Math.hypot(p.x, p.z);
    if (d > this.radius) { p.x *= this.radius / d; p.z *= this.radius / d; }
  }

  // ---------- soldats ----------
  updateSoldier(e, dt) {
    const h = this.hero, f = e.f;
    e.t += dt;
    if (e.state === 'drop') {
      e.y -= dt * 7;
      f.root.position.set(e.pos.x, Math.max(0, e.y), e.pos.z);
      e.shadow.scale.setScalar(clamp(2.5 - e.y * 0.1, 0.8, 2.5));
      if (e.bubble) e.bubble.rotation.y += dt;
      if (e.y <= 0) {
        e.state = 'idle'; e.t = 0;
        f.root.remove(e.bubble); e.bubble = null;
        this.scene.remove(e.shadow);
        sfx.pop();
        this.ctx.words.pop('BLOP !', e.pos.clone().setY(2.5), '#bfe8ff', 1.1);
        this.ctx.puffs.burst(e.pos.x, 1.2, e.pos.z, 0xdff4ff, 10, 4, { life: 0.5, s0: 0.4, s1: 1 });
      }
      f.update(dt);
      return true;
    }
    if (e.state === 'dead') {
      // il se dégonfle et s'envole en tourbillonnant
      if (e.t > 0.6) {
        if (!e.deflating) { e.deflating = true; sfx.deflate(); }
        const k = e.t - 0.6;
        f.root.position.y = k * k * 6;
        f.yaw += dt * 14;
        f.root.scale.setScalar(Math.max(0.01, 1 - k / 0.9));
        if (Math.random() < 0.7) this.ctx.puffs.emit(e.pos.x, f.root.position.y + 0.8, e.pos.z, 0xb7e68f, { vy: -1, life: 0.6, s0: 0.4, s1: 1.1 });
        if (k > 0.9) { this.scene.remove(f.root); return false; }
      }
      f.update(dt);
      return true;
    }
    const toH = _a.copy(h.pos).sub(e.pos); toH.y = 0;
    const d = toH.length(); toH.normalize();
    const vel = _b.set(0, 0, 0);
    const D = this.ctx.diff;
    if (e.state === 'hurt') {
      if (e.t > 0.35) { e.state = 'idle'; e.t = 0; }
    } else if (e.kind === 'tireur') {
      if (e.state === 'aim') {
        f.setBase('aim');
        if (!e.warn) { e.warn = glowSprite(0xff4a6a, 0.1, 0.9); f.gun.add(e.warn); e.warn.position.y = 0.6; }
        e.warn.scale.setScalar(0.4 + e.t * 1.6);
        if (e.t > D.aimTime) {
          f.gun.remove(e.warn); e.warn = null;
          f.play('shoot', 1.5);
          f.muzzle(_c);
          this.shoot(_c, h.pos, e, D.boltSpeed);
          e.state = 'idle'; e.t = 0; e.cool = rand(D.shootCool, D.shootCool + 1.2);
        }
      } else {
        e.cool -= dt;
        if (d > 9) vel.copy(toH).multiplyScalar(3);
        else if (d < 5) vel.copy(toH).multiplyScalar(-2.6);
        else vel.set(-toH.z * e.side, 0, toH.x * e.side).multiplyScalar(1.6);
        if (Math.random() < dt * 0.3) e.side *= -1;
        f.setBase(vel.lengthSq() > 0.1 ? 'run' : 'idle', 0.7);
        if (e.cool <= 0 && d < 14 && !this.busyShooters()) { e.state = 'aim'; e.t = 0; }
      }
      f.turnTo(yawOf(toH.x, toH.z), dt, 8);
    } else { // ventouse : il fonce et tape
      if (e.state === 'windup') {
        f.turnTo(yawOf(toH.x, toH.z), dt, 4);
        if (e.t > D.windup) {
          e.state = 'strike'; e.t = 0;
          f.play('atk3', 1.6, 0.8);
          sfx.swing(0.7);
        }
      } else if (e.state === 'strike') {
        if (!e.struck && e.t > 0.18) {
          e.struck = true;
          const ang = Math.abs(wrapA(yawOf(toH.x, toH.z) - f.yaw));
          if (d < 2.6 && ang < 1.3) {
            const facing = this.heroFacing();
            const guard = h.blocking && (facing.x * -toH.x + facing.z * -toH.z) > -0.2;
            if (guard) {
              this.clash(e.pos.clone().lerp(h.pos, 0.5));
              h.f.play('blockHit', 1.4);
              e.state = 'hurt'; e.t = -0.6; f.play('hit2', 1); e.knock.addScaledVector(toH, -6);
            } else this.hurtHero(1, e.pos);
          }
        }
        if (e.t > 0.6 && e.state === 'strike') { e.state = 'idle'; e.t = 0; e.cool = rand(1, 2); e.struck = false; }
      } else {
        e.cool -= dt;
        if (d > 1.9) vel.copy(toH).multiplyScalar(D.chaseSpeed);
        f.setBase(d > 1.9 ? 'run' : 'idle', 0.8);
        f.turnTo(yawOf(toH.x, toH.z), dt, 8);
        if (d < 2.4 && e.cool <= 0) { e.state = 'windup'; e.t = 0; f.play('interact', 0.9); e.struck = false; }
      }
    }
    e.pos.addScaledVector(vel, dt).addScaledVector(e.knock, dt);
    e.knock.multiplyScalar(Math.exp(-dt * 7));
    this.collide(e.pos, e.r);
    f.root.position.copy(e.pos);
    f.update(dt);
    return true;
  }
  busyShooters() { return this.enemies.filter((e) => e.state === 'aim').length >= this.ctx.diff.maxAimers; }

  // ---------- Dark Roteur ----------
  updateRoteur(e, dt) {
    const h = this.hero, f = e.f, D = this.ctx.diff;
    e.t += dt;
    const toH = _a.copy(h.pos).sub(e.pos); toH.y = 0;
    const d = toH.length(); toH.normalize();
    const vel = _b.set(0, 0, 0);
    e.arc.position.set(e.pos.x, 0.05, e.pos.z);
    e.arc.rotation.y = f.yaw;
    let arcOn = 0;
    if (e.dead) {
      f.update(dt);
      f.saberEnds(_a, _b); e.trail.push(_a, _b, false);
      e.arc.material.opacity = 0;
      return true;
    }
    if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
      e.phase = 2;
      this.say('roteur', 'BUUURP ! Soldats, à moi ! Écrasez ce petit rigolo !', 3.5);
      this.dropGroup(['ventouse', 'tireur'], e.pos, 5);
    }
    switch (e.state) {
      case 'stalk': {
        f.setBase(d > 3.2 ? 'walk' : 'guard', 1);
        if (d > 3.2) vel.copy(toH).multiplyScalar(3.4);
        f.turnTo(yawOf(toH.x, toH.z), dt, 6);
        e.cool -= dt;
        if (e.cool <= 0) {
          const r = Math.random();
          if (e.phase === 2 && r < 0.3) { e.state = 'throw'; e.t = 0; f.play('throw', 0.9); }
          else if (r < 0.62 && d < 6) { e.state = 'windup'; e.t = 0; e.combo = 0; e.parried = 0; }
          else if (d < 8) { e.state = 'burpUp'; e.t = 0; f.play('spell', 0.7); this.say('roteur', 'BUUUUUURP !', 1.5); }
          else e.cool = 0.5;
        }
        break;
      }
      case 'windup': { // il lève son sabre : le sol devient rouge devant lui
        f.turnTo(yawOf(toH.x, toH.z), dt, 5);
        arcOn = Math.min(1, e.t / D.roteurWindup);
        if (e.t === dt || e.t < dt * 1.5) f.play(['atk1', 'atk2', 'heavy'][e.combo], 0.35, 0.5);
        if (e.t > D.roteurWindup) {
          e.state = 'strike'; e.t = 0;
          f.play(['atk1', 'atk2', 'heavy'][e.combo], 1.6, 0.85);
          sfx.swing(0.6);
          e.knock.addScaledVector(toH, 6);
        }
        break;
      }
      case 'strike': {
        if (!e.struck && e.t > 0.15) {
          e.struck = true;
          const ang = Math.abs(wrapA(yawOf(toH.x, toH.z) - f.yaw));
          if (d < 3.6 && ang < 0.9) {
            const facing = this.heroFacing();
            const guard = h.blocking && (facing.x * -toH.x + facing.z * -toH.z) > -0.3;
            if (guard) { this.clash(e.pos.clone().lerp(h.pos, 0.6)); h.f.play('blockHit', 1.3); h.knock.addScaledVector(toH, 5); e.parried++; }
            else this.hurtHero(1, e.pos);
          }
        }
        if (e.t > 0.55) {
          e.struck = false; e.combo++;
          if (e.combo < 3) { e.state = 'windup'; e.t = 0; }
          else if (e.parried >= 2) { // tous ses coups parés : il est sonné !
            e.state = 'stunned'; e.t = 0; f.play('hit2', 0.6);
            this.ctx.words.pop('SONNÉ !', e.pos.clone().setY(4), '#ffd23f', 1.6);
            this.say('gazou', 'Sonné il est ! Frappe, maintenant !', 2.2);
          } else { e.state = 'stalk'; e.cool = rand(1.2, 2); }
        }
        break;
      }
      case 'stunned': {
        f.setBase('idle');
        if (Math.random() < dt * 8) this.ctx.glows.emit(e.pos.x + rand(-0.6, 0.6), 3.9, e.pos.z + rand(-0.6, 0.6), 0xffe66a, { vy: 0.5, life: 0.5, s0: 0.5, s1: 0.1 });
        if (e.t > D.stunTime) { e.state = 'stalk'; e.cool = 1; }
        break;
      }
      case 'burpUp': { // il gonfle… puis un anneau de rot part de lui
        if (Math.random() < dt * 30) this.ctx.puffs.emit(e.pos.x, 3, e.pos.z, Math.random() < 0.5 ? 0xb58be0 : 0x9be36b, { vx: rand(-1, 1), vy: 1, vz: rand(-1, 1), life: 0.6, s0: 0.6, s1: 1.4 });
        if (e.t > 1.0) {
          e.state = 'stalk'; e.cool = rand(1.6, 2.4);
          sfx.burp(); this.ctx.shake(0.5);
          this.fx.push({ kind: 'ring', pos: e.pos.clone(), r: 0.5, hit: false, mesh: this.makeRing() });
        }
        break;
      }
      case 'throw': { // il lance son sabre comme un boomerang
        f.turnTo(yawOf(toH.x, toH.z), dt, 6);
        if (e.t > 0.45 && !e.thrown) {
          e.f.saber.visible = false;
          const s = makeSaber(0xb04cff, 0xf3dcff);
          s.position.copy(e.pos).setY(1.6);
          s.rotation.z = Math.PI / 2;
          this.scene.add(s);
          e.thrown = { s, vel: toH.clone().multiplyScalar(11), back: false, t: 0 };
          sfx.swing(0.5);
        }
        if (e.thrown) {
          const th = e.thrown; th.t += dt;
          th.s.rotation.y += dt * 18;
          th.s.position.addScaledVector(th.vel, dt);
          if (!th.back && th.t > 1.2) { th.back = true; }
          if (th.back) th.vel.copy(e.pos).sub(th.s.position).setY(0).normalize().multiplyScalar(th.reflected ? 16 : 12);
          if (Math.random() < 0.5) this.ctx.glows.emit(th.s.position.x, 1.6, th.s.position.z, 0xb04cff, { life: 0.3, s0: 0.8, s1: 0.2 });
          const dh = dist2(th.s.position, h.pos);
          if (!th.back && !th.hit && dh < 1.4) {
            th.hit = true;
            const facing = this.heroFacing();
            const tv = th.vel.clone().normalize();
            const guard = (h.blocking && (facing.x * -tv.x + facing.z * -tv.z) > -0.3) || h.atkT > 0;
            if (guard) { // renvoyé ! il revient sur Dark Roteur et le sonne
              this.clash(th.s.position.clone()); th.back = true; th.reflected = true;
            } else this.hurtHero(1, th.s.position);
          }
          if (th.back && dist2(th.s.position, e.pos) < 1.2) {
            this.scene.remove(th.s); e.f.saber.visible = true; e.thrown = null;
            if (th.reflected) {
              e.hp -= 2; e.f.flash = 1; this.ctx.hud.boss('DARK ROTEUR', Math.max(0, e.hp / e.maxHp));
              this.ctx.words.pop('AÏE !', e.pos.clone().setY(4), '#ff8a3d', 1.6);
              if (e.hp <= 0) { this.defeatRoteur(e); break; }
              e.state = 'stunned'; e.t = 0; f.play('hit2', 0.6);
            } else { e.state = 'stalk'; e.cool = rand(1, 1.8); }
          }
        }
        break;
      }
    }
    e.arc.material.opacity = arcOn * (0.35 + 0.2 * Math.sin(this.t * 20));
    e.arc.scale.setScalar(3.6);
    e.pos.addScaledVector(vel, dt).addScaledVector(e.knock, dt);
    e.knock.multiplyScalar(Math.exp(-dt * 6));
    this.collide(e.pos, e.r);
    f.root.position.copy(e.pos);
    f.update(dt);
    f.saberEnds(_a, _b);
    e.trail.push(_a, _b, e.state === 'strike');
    return true;
  }

  makeRing() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xb58be0, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.position.y = 0.3; this.scene.add(m);
    return m;
  }

  defeatRoteur(e) {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    e.f.play('death', 0.7);
    e.arc.material.opacity = 0;
    if (e.thrown) { this.scene.remove(e.thrown.s); e.thrown = null; }
    this.ctx.hud.boss(null);
    sfx.mega(); this.ctx.shake(1);
    this.ctx.words.pop('VICTOIRE !', e.pos.clone().setY(4.5), '#8fff5a', 2.4);
    for (let i = 0; i < 30; i++) this.ctx.puffs.emit(e.pos.x, 1.5, e.pos.z, i % 2 ? 0xb58be0 : 0x9be36b, { vx: rand(-6, 6), vy: rand(1, 5), vz: rand(-6, 6), life: 1.4, s0: 1, s1: 3 });
    for (const x of this.enemies) if (!x.dead && x !== e) this.kill(x);
  }

  // ---------- la boucle ----------
  update(dt) {
    this.t += dt;
    const h = this.hero;
    this.script && this.script.update(dt);
    this.updateHero(dt);
    this.enemies = this.enemies.filter((e) => (e.kind === 'roteur' ? this.updateRoteur(e, dt) : this.updateSoldier(e, dt)));
    // les ennemis se poussent entre eux
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j];
      if (a.dead || b.dead || a.state === 'drop' || b.state === 'drop') continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.r + b.r;
      if (d < m && d > 0.001) { const k = (m - d) / d * 0.5; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
    }
    for (const e of E) {
      if (e.dead || e.state === 'drop') continue;
      const dx = h.pos.x - e.pos.x, dz = h.pos.z - e.pos.z, d = Math.hypot(dx, dz), m = e.r + 0.6;
      if (d < m && d > 0.001) { h.pos.x = e.pos.x + dx / d * m; h.pos.z = e.pos.z + dz / d * m; }
    }

    // tirs
    this.bolts = this.bolts.filter((b) => {
      b.life -= dt;
      b.g.position.addScaledVector(b.vel, dt);
      b.glow.material.rotation += dt * 5;
      if (Math.random() < 0.5) this.ctx.glows.emit(b.g.position.x, 1.2, b.g.position.z, b.reflected ? 0x8fff5a : 0xb04cff, { life: 0.25, s0: 0.5, s1: 0.1 });
      let gone = b.life <= 0;
      if (!gone && !b.reflected && !h.dead) {
        const d = dist2(b.g.position, h.pos);
        if (d < 1.1) {
          const facing = this.heroFacing();
          const dir = _a.copy(b.vel).normalize();
          const front = (facing.x * -dir.x + facing.z * -dir.z) > (this.ctx.diff.blockAnyDir ? -2 : -0.1);
          if ((h.blocking && front) || h.atkT > 0 || h.special > 0) { this.reflect(b); if (h.blocking) h.f.play('blockHit', 1.6); }
          else { this.hurtHero(1, b.g.position); gone = true; }
        }
      } else if (!gone && b.reflected) {
        for (const e of this.enemies) {
          if (e.dead || e.state === 'drop' || dist2(e.pos, b.g.position) > e.r + 0.6) continue;
          if (e.kind === 'roteur') { this.clash(b.g.position.clone()); gone = true; break; }
          this.damage(e, 3, _a.copy(b.vel).normalize(), 8); gone = true; break;
        }
      }
      if (!gone) for (const o of this.world.obstacles) if (Math.hypot(b.g.position.x - o.x, b.g.position.z - o.z) < o.r) { gone = true; break; }
      if (gone) { this.scene.remove(b.g); this.ctx.puffs.burst(b.g.position.x, 1.2, b.g.position.z, b.reflected ? 0x9be36b : 0xc38be8, 4, 2, { life: 0.4, s0: 0.3, s1: 0.8 }); }
      return !gone;
    });

    // vaisseaux qui passent au-dessus
    this.strafes = this.strafes.filter((s) => {
      s.t += dt;
      s.pos.addScaledVector(s.dir, s.speed * dt);
      s.ship.position.set(s.pos.x, 7.5, s.pos.z);
      s.shadow.position.set(s.pos.x, 0.04, s.pos.z);
      s.impacts = s.impacts.filter((im) => {
        im.w.material.opacity = 0.5 + 0.5 * Math.sin(this.t * 18);
        if (s.t < im.at) return true;
        this.scene.remove(im.w);
        sfx.boom();
        this.ctx.puffs.burst(im.p.x, 0.6, im.p.z, 0xb58be0, 10, 4, { life: 0.8, s0: 0.8, s1: 2.2 });
        this.ctx.glows.burst(im.p.x, 0.8, im.p.z, 0xff8a3d, 6, 5, { life: 0.3, s0: 0.6, s1: 0.1 });
        this.ctx.shake(0.2);
        if (dist2(im.p, h.pos) < 1.6) this.hurtHero(1, im.p);
        for (const e of this.enemies) if (!e.dead && e.kind !== 'roteur' && e.state !== 'drop' && dist2(im.p, e.pos) < 1.6) this.damage(e, 2, _a.copy(e.pos).sub(im.p).normalize(), 6);
        return false;
      });
      if (s.t > 64 / s.speed) { this.scene.remove(s.ship, s.shadow); return false; }
      return true;
    });

    // anneaux de rot de Dark Roteur
    this.fx = this.fx.filter((x) => {
      if (x.kind !== 'ring') return false;
      x.r += dt * 8;
      x.mesh.scale.setScalar(x.r); x.mesh.position.set(x.pos.x, 0.3, x.pos.z);
      x.mesh.material.opacity = Math.max(0, 0.9 - x.r / 12);
      if (Math.random() < 0.8) { const a = rand(0, 6.28); this.ctx.puffs.emit(x.pos.x + Math.cos(a) * x.r, 0.6, x.pos.z + Math.sin(a) * x.r, Math.random() < 0.5 ? 0xb58be0 : 0x9be36b, { life: 0.5, s0: 0.8, s1: 1.6 }); }
      const d = dist2(x.pos, h.pos);
      if (!x.hit && Math.abs(d - x.r) < 0.8) {
        x.hit = true;
        if (h.blocking) { this.ctx.words.pop('PARÉ !', h.pos.clone().setY(2.8), '#8fff5a', 1.2); sfx.clash(); }
        else this.hurtHero(1, x.pos);
      }
      if (x.r > 11) { this.scene.remove(x.mesh); return false; }
      return true;
    });

    // bonus au sol
    this.pickups = this.pickups.filter((p) => {
      p.t += dt;
      p.g.children[1].position.y = 0.3 + Math.sin(p.t * 4) * 0.15;
      const d = dist2(p.g.position, h.pos);
      if (d < 3.5) p.g.position.lerp(_a.copy(h.pos), Math.min(1, dt * 6));
      if (d < 0.9 && !h.dead) {
        if (p.kind === 'heal') { h.hp = Math.min(h.maxHp, h.hp + 1); sfx.heal(); this.ctx.words.pop('+1 ❤', h.pos.clone().setY(2.6), '#ff6a8a', 1); }
        else { h.mega = Math.min(1, h.mega + 0.34); sfx.pickup(); this.ctx.words.pop('GAZ !', h.pos.clone().setY(2.6), '#8fff5a', 1); }
        this.ctx.hud.hearts(h.hp, h.maxHp); this.ctx.hud.mega(h.mega);
        this.scene.remove(p.g); return false;
      }
      if (p.t > 14) { this.scene.remove(p.g); return false; }
      return true;
    });

    // caméra : suit Lucas en douceur
    this.camPos.lerp(h.pos, Math.min(1, dt * 5));
    this.ctx.cam.target.copy(this.camPos).setY(1);
    this.world.follow(h.pos);
    return this.result;
  }

  dispose() {
    for (const e of this.enemies) { this.scene.remove(e.f.root); if (e.arc) this.scene.remove(e.arc); if (e.trail) e.trail.dispose(this.scene); if (e.shadow) this.scene.remove(e.shadow); if (e.thrown) this.scene.remove(e.thrown.s); }
    for (const b of this.bolts) this.scene.remove(b.g);
    for (const s of this.strafes) { this.scene.remove(s.ship, s.shadow); for (const im of s.impacts) this.scene.remove(im.w); }
    for (const p of this.pickups) this.scene.remove(p.g);
    for (const x of this.fx) this.scene.remove(x.mesh);
    this.scene.remove(this.hero.f.root);
    this.trail.dispose(this.scene);
  }
}
