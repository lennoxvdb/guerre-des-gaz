// Le combat à pied au sabre-gaz : Lucas contre les soldats de Dark Roteur (et Dark Roteur lui-même).
// Les vaisseaux ennemis passent au-dessus, bombardent (cercles rouges) et lâchent des soldats dans des bulles.
import * as THREE from 'three';
import { Fighter, SaberTrail, makeSaber, makeSlash, updateSlash } from '../entities/fighter.js';
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
    // mission au jetpack : tout le monde vole à cette hauteur, on survole ce qui est bas
    this.jet = !!opts.jet;
    this.indoor = !!opts.indoor; // dans la station : pas de vaisseau qui passe au-dessus
    this.lift = this.jet ? 2.4 : 0;

    // Lucas
    const f = new Fighter('lucas', 2.0);
    this.scene.add(f.root);
    const h = this.hero = {
      f, pos: opts.heroPos ? opts.heroPos.clone() : V(), vel: V(), knock: V(),
      hp: ctx.diff.hp, maxHp: ctx.diff.hp, inv: 0, mega: opts.mega ?? 0,
      stage: 0, atkT: 0, atkLen: 0, hitAt: 0, hitDone: true, queued: false, comboT: 0,
      blocking: false, special: 0, dead: false, deadT: 0, cheer: false,
      target: null, moveTo: null, // ce qu'on a touché du doigt
      jumpT: 0, jumpLen: 0.8, jumpCool: 0, jumpFrom: V(), jumpTo: V(), // le saut de chevalier
    };
    h.f.root.position.copy(h.pos);
    h.f.yaw = Math.PI * 1.25; // regarde vers le haut de l'écran
    h.f.setSaberOn(0);
    this.saberOn = 0;
    if (this.jet) {
      h.f.giveJetpack();
      h.shadow = shadowBlob(1.4); this.scene.add(h.shadow);
    }
    this.trail = new SaberTrail(this.scene, h.f.saber.userData.trailColor);
    this.camPos = h.pos.clone();
    // la vue « cinéma » : la caméra derrière Lucas, à hauteur d'enfant, comme sur l'écran d'accueil
    if (opts.cinema) {
      this.cam3 = new THREE.PerspectiveCamera(50, ctx.aspect(), 0.1, 400);
      this.oldFog = this.scene.fog;
      this.scene.fog = new THREE.Fog(this.world.T.sky, 40, 120);
      this.cineEye = null;
    }
    // cercle sous l'ennemi qu'on a touché, et petit cercle là où on a touché le sol
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.85, depthWrite: false }));
    this.marker.renderOrder = 3; this.marker.visible = false;
    this.dot = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x8fff5a, transparent: true, opacity: 0, depthWrite: false }));
    this.dot.renderOrder = 3;
    this.scene.add(this.marker, this.dot);
    this.script = opts.script ? new Script(opts.script(this)) : null;
    ctx.hud.hearts(h.hp, h.maxHp);
    ctx.hud.mega(h.mega);
  }

  // ---------- aides pour les scénarios ----------
  say(who, text, dur) { this.ctx.hud.radio(who, text, dur); }
  get alive() { return this.enemies.filter((e) => !e.dead && e.kind !== 'gen').length; }
  get gensLeft() { return this.enemies.filter((e) => !e.dead && e.kind === 'gen').length; }
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
    if (!this.indoor) this.flyover(c, false);
  }

  makeSoldier(kind, x, z) {
    const big = kind === 'gros';
    const f = new Fighter('soldat', big ? 3.1 : 2.3);
    if (kind === 'ventouse' || big) f.givePlunger();
    f.root.position.set(x, 0, z);
    f.yaw = yawOf(this.hero.pos.x - x, this.hero.pos.z - z);
    f.setBase(this.jet ? 'fly' : 'idle');
    if (this.jet) f.giveJetpack();
    this.scene.add(f.root);
    const e = {
      kind, f, pos: new THREE.Vector3(x, 0, z), knock: V(), y: 0, ph: rand(0, 6),
      hp: this.ctx.diff.soldierHp * (big ? 3 : 1), big, reach: big ? 1.35 : 1,
      state: 'idle', t: 0, cool: rand(1.2, 2.4), side: Math.random() < 0.5 ? -1 : 1, dead: false, r: big ? 1.0 : 0.7,
    };
    this.enemies.push(e);
    return e;
  }

  // un générateur à détruire (il garde Han Popo prisonnier dans une bulle)
  addGenerator(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 2.6, 14), new THREE.MeshToonMaterial({ color: 0x6a3a96, emissive: 0xffffff, emissiveIntensity: 0 }));
    base.position.y = 1.3; base.castShadow = true; g.add(base);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 12), new THREE.MeshBasicMaterial({ color: 0x8fff5a }));
    ball.position.y = 3.2; g.add(ball);
    const glow = glowSprite(0x8fff5a, 4, 0.7); glow.position.y = 3.2; g.add(glow);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.1, 6, 30), new THREE.MeshBasicMaterial({ color: 0xd38bff }));
    ring.position.y = 3.2; g.add(ring);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { kind: 'gen', g, ring, mat: base.material, pos: new THREE.Vector3(x, 0, z), knock: V(), hp: 24, maxHp: 24, r: 1.3, dead: false, state: 'idle', t: 0, flash: 0 };
    this.world.obstacles.push(e.obst = { x, z, r: 1.3, h: 9 });
    this.enemies.push(e);
    return e;
  }
  updateGen(e, dt) {
    e.t += dt;
    if (e.dead) { e.g.scale.multiplyScalar(Math.max(0, 1 - dt * 4)); if (e.g.scale.x < 0.05) { this.scene.remove(e.g); return false; } return true; }
    e.ring.rotation.x = e.t * 2; e.ring.rotation.y = e.t * 1.3;
    e.flash -= dt; e.mat.emissiveIntensity = e.flash > 0 ? 0.6 : 0;
    // un éclair vers la prison de temps en temps
    if (this.prison && Math.random() < dt * 3) this.ctx.glows.emit(e.pos.x + (this.prison.x - e.pos.x) * Math.random(), 3.2, e.pos.z + (this.prison.z - e.pos.z) * Math.random(), 0x8fff5a, { life: 0.3, s0: 0.6, s1: 0.1 });
    return true;
  }
  destroyGen(e) {
    if (e.dead) return;
    e.dead = true;
    this.world.obstacles.splice(this.world.obstacles.indexOf(e.obst), 1);
    sfx.boom(); this.ctx.shake(0.6);
    this.ctx.words.pop('BOUM !', e.pos.clone().setY(4), '#ffd23f', 1.8);
    for (let i = 0; i < 20; i++) this.ctx.puffs.emit(e.pos.x, 2, e.pos.z, i % 2 ? 0x9be36b : 0xc38be8, { vx: rand(-5, 5), vy: rand(1, 5), vz: rand(-5, 5), life: 1, s0: 1, s1: 2.5 });
  }
  // la prison de Han Popo : une grosse bulle
  addPrison(x, z) {
    const han = standee(TEX.hanpopo, 2.4);
    const bub = new THREE.Mesh(new THREE.SphereGeometry(2, 22, 16), new THREE.MeshBasicMaterial({ color: 0xd38bff, transparent: true, opacity: 0.3, depthWrite: false }));
    bub.position.y = 1.6;
    const g = new THREE.Group(); g.add(han, bub); g.position.set(x, 0, z);
    this.scene.add(g);
    this.prison = { x, z, g, bub, pos: new THREE.Vector3(x, 0, z) };
    this.world.obstacles.push(this.prison.obst = { x, z, r: 2, h: 9 });
    return this.prison;
  }
  freePrison() {
    const P = this.prison;
    P.g.remove(P.bub);
    this.world.obstacles.splice(this.world.obstacles.indexOf(P.obst), 1);
    sfx.pop(); this.ctx.shake(0.4);
    this.ctx.words.pop('LIBRE !', P.pos.clone().setY(4), '#8fff5a', 2);
    this.ctx.puffs.burst(P.x, 1.6, P.z, 0xe8d0ff, 20, 5, { life: 0.8, s0: 0.6, s1: 1.6 });
  }

  // un chevalier au sabre arrive pour le duel : Dark Roteur (à la fin) ou le Capitaine Burpo (mission 2)
  //   cfg : { who, name, voice, hp, height, saber, throwSaber, summon, rage }
  spawnRoteur(x, z, cfg = {}) {
    cfg = { who: 'roteur', name: 'DARK ROTEUR', voice: 'roteur', hp: this.ctx.diff.roteurHp, height: 3.4, saber: 0xb04cff,
      throwSaber: true, summon: true, rage: false, ...cfg };
    const f = new Fighter(cfg.who, cfg.height);
    f.root.position.set(x, 0, z);
    f.setBase('guard');
    this.scene.add(f.root);
    const e = {
      kind: 'roteur', f, pos: new THREE.Vector3(x, 0, z), knock: V(), y: 0,
      hp: cfg.hp, maxHp: cfg.hp, state: 'stalk', t: 0, cool: 1.5, cfg, name: cfg.name,
      dead: false, r: 1.1, combo: 0, parried: 0, phase: 1, boss: true, thrown: null,
    };
    e.trail = new SaberTrail(this.scene, cfg.saber);
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
    g.position.copy(from); g.position.y = this.lift + 1.2;
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

  // ---------- commandes au doigt ----------
  attackTarget(e) {
    const h = this.hero;
    if (h.dead || h.cheer) return;
    h.target = e; h.moveTo = null;
    this.ctx.hud.tip(null);
  }
  walkTo(p) {
    const h = this.hero;
    if (h.dead || h.cheer) return;
    h.target = null; h.moveTo = p.setY(0);
    this.dot.position.set(p.x, 0.06, p.z); this.dot.material.opacity = 0.9; this.dot.scale.setScalar(1.6);
  }

  // ---------- le saut de chevalier (propulsé au prout, avec une pirouette) ----------
  startJump(dir) {
    const h = this.hero;
    h.jumpT = h.jumpLen; h.jumpCool = 1.1; h.atkT = 0; h.queued = false;
    h.jumpFrom.copy(h.pos);
    if (h.target && !h.target.dead) { // bond sur la cible
      const d = dist2(h.target.pos, h.pos);
      const k = Math.max(0, d - 1.4 - h.target.r) / (d || 1);
      h.jumpTo.copy(h.pos).lerp(h.target.pos, Math.min(1, k)).setY(0);
      if (d - 1.4 - h.target.r > 7) h.jumpTo.copy(h.pos).addScaledVector(_a.copy(h.target.pos).sub(h.pos).setY(0).normalize(), 7);
    } else {
      const fwd = dir && dir.lengthSq() > 0.02 ? dir.clone().normalize() : this.heroFacing().clone();
      h.jumpTo.copy(h.pos).addScaledVector(fwd, 5.5);
    }
    this.collide(h.jumpTo, 0.6);
    h.f.yaw = yawOf(h.jumpTo.x - h.pos.x, h.jumpTo.z - h.pos.z) || h.f.yaw;
    h.f.play('jumpAir', 1, 1);
    sfx.jump();
    for (let i = 0; i < 12; i++) this.ctx.puffs.emit(h.pos.x, 0.4, h.pos.z, i % 2 ? 0x9be36b : 0xc8f59a, { vx: rand(-3, 3), vz: rand(-3, 3), vy: 1, life: 0.7, s0: 0.6, s1: 1.8 });
    this.ctx.words.pop('HOP !', h.pos.clone().setY(2.6), '#ffd23f', 1.1);
  }
  land() {
    const h = this.hero, f = h.f;
    f.model.rotation.x = 0; f.model.position.set(0, 0, 0); f.root.position.y = this.lift;
    f.play('jumpLand', 1.4, 0.7);
    sfx.land(); this.ctx.shake(0.35);
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      this.ctx.puffs.emit(h.pos.x, 0.3, h.pos.z, i % 2 ? 0x9be36b : 0xe8d6a8, { vx: Math.cos(a) * 7, vz: Math.sin(a) * 7, life: 0.6, s0: 0.6, s1: 1.6, drag: 3 });
    }
    // l'onde de gaz repousse ceux qui sont tout près
    for (const e of this.enemies) {
      if (e.dead || e.state === 'drop') continue;
      const d = dist2(e.pos, h.pos);
      if (d < 2.6 + e.r) this.damage(e, 1, _a.copy(e.pos).sub(h.pos).setY(0).normalize(), 9);
    }
    // si on a bondi sur quelqu'un : grand coup de sabre en arrivant
    if (h.target && !h.target.dead) { h.stage = 2; this.startSwing(); }
  }

  jetFlame(f, k) {
    if (!f.jetpack || Math.random() > 0.5 + k * 0.4) return;
    f.jetpack.getWorldPosition(_c);
    this.ctx.puffs.emit(_c.x + rand(-0.2, 0.2), _c.y - 0.5, _c.z + rand(-0.2, 0.2), Math.random() < 0.5 ? 0x9be36b : 0xc8f59a, { vy: -4, life: 0.4, s0: 0.35, s1: 0.9, drag: 2 });
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
    const tgt = h.target && !h.target.dead ? h.target : this.nearestEnemy(6.5);
    if (tgt) {
      h.f.yaw = yawOf(tgt.pos.x - h.pos.x, tgt.pos.z - h.pos.z);
      const d = dist2(tgt.pos, h.pos);
      if (d > 1.8) h.knock.addScaledVector(this.heroFacing(), Math.min(9, (d - 1.5) * 4));
    }
    sfx.swing(1 + h.stage * 0.15);
  }

  swingHits() {
    const h = this.hero, fwd = this.heroFacing().clone();
    // le grand arc de lumière, à plat devant Lucas (on le voit bien de dessus comme de derrière)
    const kind = ['diag', 'horiz', 'chop'][h.stage] || 'diag';
    const g = makeSlash(new THREE.Color(h.f.saber.userData.trailColor).getHex(), kind === 'chop' ? 'diag' : 'horiz');
    g.rotation.order = 'YXZ'; g.rotation.set(-Math.PI / 2, h.f.yaw - Math.PI / 2, 0);
    g.position.set(h.pos.x + fwd.x * 0.4, 1.1 + (this.jet ? this.lift : 0), h.pos.z + fwd.z * 0.4);
    g.scale.y = 1; g.userData.flat = false;
    this.scene.add(g); (this.slashes || (this.slashes = [])).push(g);
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
    if (e.kind === 'gen') {
      e.hp -= n; e.flash = 0.12;
      this.ctx.words.pop(pick(['BZZT !', 'CRAC !', 'PAF !']), e.pos.clone().setY(4), '#8fff5a', 1.2);
      this.ctx.glows.burst(e.pos.x, 2.5, e.pos.z, 0xeaffc0, 8, 6, { life: 0.25, s0: 0.3, s1: 0.05 });
      sfx.hit(); this.ctx.hitstop(0.04);
      this.hero.mega = Math.min(1, this.hero.mega + 0.04); this.ctx.hud.mega(this.hero.mega);
      if (e.hp <= 0) this.destroyGen(e);
      return;
    }
    // Dark Roteur pare les coups de face quand il est en garde
    if (e.kind === 'roteur' && e.state === 'stalk' && Math.random() < 0.55) {
      this.clash(e.pos.clone().lerp(this.hero.pos, 0.5));
      e.f.play('blockHit', 1.4);
      this.hero.knock.addScaledVector(dir, -5);
      return;
    }
    e.hp -= n;
    e.f.flash = 1;
    e.knock.addScaledVector(dir, e.kind === 'roteur' ? knock * 0.3 : e.big ? knock * 0.4 : knock);
    const p = e.pos.clone().setY(2.2);
    this.ctx.words.pop(pick(HIT_WORDS), p, pick(['#ffd23f', '#8fff5a', '#ff8a3d']), 1.3);
    this.ctx.puffs.burst(e.pos.x, 1.2, e.pos.z, 0x9be36b, 6, 3, { life: 0.6, s0: 0.5, s1: 1.4 });
    this.ctx.glows.burst(e.pos.x, 1.4, e.pos.z, 0xeaffc0, 6, 6, { life: 0.25, s0: 0.25, s1: 0.05 });
    sfx.hit();
    this.ctx.hitstop(0.05);
    this.hero.mega = Math.min(1, this.hero.mega + 0.07);
    this.ctx.hud.mega(this.hero.mega);
    if (e.kind === 'roteur') {
      this.ctx.hud.boss(e.name, Math.max(0, e.hp / e.maxHp));
      if (e.hp <= 0) this.defeatRoteur(e);
      else if (e.state !== 'stunned' && e.state !== 'throw') { e.f.play('hit', 1.2); }
      return;
    }
    if (e.hp <= 0) this.kill(e);
    else { e.state = 'hurt'; e.t = 0; e.f.play('hit', 1.4); }
  }

  kill(e) {
    if (e.kind === 'gen') return this.destroyGen(e);
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
    if (h.inv > 0 || h.dead || h.special > 0 || h.jumpT > 0) return;
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
        if (e.kind === 'roteur') { e.state = 'stunned'; e.t = 0; e.hp -= 2; e.f.flash = 1; this.ctx.hud.boss(e.name, Math.max(0, e.hp / e.maxHp)); if (e.hp <= 0) this.defeatRoteur(e); }
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
    h.inv -= dt; h.special -= dt; h.comboT -= dt; h.jumpCool -= dt;
    if (h.jumpT > 0) {
      h.jumpT -= dt;
      const k = Math.min(1, 1 - h.jumpT / h.jumpLen), e = k * (2 - k);
      h.pos.lerpVectors(h.jumpFrom, h.jumpTo, e);
      const y = this.lift + Math.sin(Math.PI * k) * 2.6;
      f.root.position.copy(h.pos); f.root.position.y = y;
      if (h.shadow) h.shadow.position.set(h.pos.x, 0.05, h.pos.z);
      // pirouette vers l'avant autour de la taille
      const th = Math.min(1, k * 1.15) * Math.PI * 2, c = 1.0;
      f.model.rotation.x = th; f.model.position.set(0, c - c * Math.cos(th), -c * Math.sin(th));
      if (Math.random() < 0.8) this.ctx.puffs.emit(h.pos.x, y + 0.3, h.pos.z, 0x9be36b, { vy: -2, life: 0.5, s0: 0.5, s1: 1.2 });
      f.root.visible = true;
      f.update(dt);
      f.saberEnds(_a, _b); this.trail.push(_a, _b, true);
      if (h.jumpT <= 0) this.land();
      return;
    }
    // allumer le sabre au début
    if (this.saberOn < 1) { if (this.saberOn === 0) sfx.ignite(); this.saberOn = Math.min(1, this.saberOn + dt * 3); f.setSaberOn(this.saberOn); }

    // déplacement (joystick ou flèches) : sur l'écran → sur le sol
    const mv = _b.set(0, 0, 0).addScaledVector(SR, inp.move.x).addScaledVector(SU, inp.move.y);
    let mag = Math.min(1, mv.length());
    // joystick ou flèches : on oublie ce qu'on avait touché du doigt
    if (mag > 0.15) { h.target = null; h.moveTo = null; }
    if (h.target && (h.target.dead || h.target.state === 'drop')) h.target = null;
    if (!h.target && !h.moveTo && mag < 0.15 && !inp.block) {
      for (const e of this.enemies) if (!e.dead && e.kind !== 'roteur' && e.kind !== 'gen' && e.state !== 'drop' && dist2(e.pos, h.pos) < 2.3 + e.r) { h.target = e; break; }
    }
    let autoAtk = false;
    if (h.target) {
      const dx = h.target.pos.x - h.pos.x, dz = h.target.pos.z - h.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.7 + h.target.r) { mv.set(dx / d, 0, dz / d); mag = 1; }
      else autoAtk = !inp.block;
      if (d < 4 + h.target.r) autoAtk = autoAtk || (!inp.block && h.atkT > 0);
    } else if (h.moveTo) {
      const dx = h.moveTo.x - h.pos.x, dz = h.moveTo.z - h.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.35) h.moveTo = null;
      else { mv.set(dx / d, 0, dz / d); mag = Math.min(1, d * 1.5); mv.multiplyScalar(mag); }
    }
    const wantAtk = inp.attack || autoAtk;
    if (inp.jump && h.jumpCool <= 0 && h.special <= 0 && !h.cheer) { this.startJump(mag > 0.15 ? mv : null); return; }
    h.blocking = inp.block && h.atkT <= 0 && h.special <= 0 && !h.cheer;
    f.guard = h.blocking; // le sabre bien droit devant lui
    let speed = this.jet ? 8.5 : 6.8;
    if (h.blocking) speed = 2.6;
    if (h.atkT > 0 || h.special > 0) speed = 1.2;
    if (h.cheer) speed = 0;
    h.vel.copy(mv).multiplyScalar(speed);

    // attaques
    if (h.atkT > 0) {
      h.atkT -= dt;
      if (!h.hitDone && h.atkT <= h.hitAt) { h.hitDone = true; this.swingHits(); }
      if (wantAtk && h.atkT < h.atkLen * 0.6) h.queued = true;
      if (h.atkT <= 0) {
        h.comboT = 0.45;
        if (h.queued) { h.stage = (h.stage + 1) % 3; this.startSwing(); }
        else h.stage = h.stage >= 2 ? 0 : h.stage + 1;
      }
    } else if (wantAtk && h.special <= 0 && !h.cheer) {
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
    f.setBase(h.cheer ? 'idle' : h.blocking ? 'block' : this.jet ? 'fly' : mag > 0.15 ? 'run' : 'idle', mag > 0.15 ? 0.6 + mag * 0.6 : 1);
    if (h.cheer && f.action !== 'cheer') f.play('cheer');

    // bouger (avec l'élan des coups) et ne pas traverser le décor
    h.pos.addScaledVector(h.vel, dt).addScaledVector(h.knock, dt);
    h.knock.multiplyScalar(Math.exp(-dt * 8));
    this.collide(h.pos, 0.6);
    f.root.position.copy(h.pos);
    if (this.jet) {
      f.root.position.y = this.lift + Math.sin(this.t * 3) * 0.2;
      this.jetFlame(f, mag > 0.15 ? 1 : 0.6);
      h.shadow.position.set(h.pos.x, 0.05, h.pos.z);
    }
    // clignote quand il est invincible
    f.root.visible = h.inv <= 0 || Math.floor(this.t * 14) % 2 === 0;
    // le grand geste du sabre pendant un coup
    if (h.atkT > 0) f.swingPose(['diag', 'horiz', 'chop'][h.stage] || 'diag', 1 - h.atkT / h.atkLen, 1 - h.hitAt / h.atkLen);
    else if (f.pose) f.pose = null;
    f.update(dt);
    f.saberEnds(_a, _b);
    this.trail.push(_a, _b, h.atkT > 0 || h.special > 0);
    if (this.slashes) this.slashes = this.slashes.filter((g) => { if (updateSlash(g, dt)) return true; this.scene.remove(g); return false; });
  }

  collide(p, r) {
    for (const o of this.world.obstacles) {
      if (this.jet && o.h < 3) continue;
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
      f.root.position.set(e.pos.x, Math.max(this.lift, e.y), e.pos.z);
      e.shadow.scale.setScalar(clamp(2.5 - e.y * 0.1, 0.8, 2.5));
      if (e.bubble) e.bubble.rotation.y += dt;
      if (e.y <= this.lift) {
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
        f.root.position.y = this.lift + k * k * 6;
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
        f.setBase(this.jet ? 'fly' : vel.lengthSq() > 0.1 ? 'run' : 'idle', 0.7);
        if (e.cool <= 0 && d < 14 && !this.busyShooters()) { e.state = 'aim'; e.t = 0; }
      }
      f.turnTo(yawOf(toH.x, toH.z), dt, 8);
    } else { // ventouse : il fonce et tape
      if (e.state === 'windup') {
        f.turnTo(yawOf(toH.x, toH.z), dt, 4);
        if (e.t > D.windup) {
          e.state = 'strike'; e.t = 0;
          f.play('atk3', 1.6, 0.8);
          sfx.swing(0.7, 'classique');
        }
      } else if (e.state === 'strike') {
        if (!e.struck && e.t > 0.18) {
          e.struck = true;
          const ang = Math.abs(wrapA(yawOf(toH.x, toH.z) - f.yaw));
          if (d < 2.6 * e.reach && ang < 1.3) {
            const facing = this.heroFacing();
            const guard = h.blocking && (facing.x * -toH.x + facing.z * -toH.z) > -0.2;
            if (guard) {
              this.clash(e.pos.clone().lerp(h.pos, 0.5));
              h.f.play('blockHit', 1.4);
              e.state = 'hurt'; e.t = -0.6; f.play('hit2', 1); e.knock.addScaledVector(toH, -6);
            } else this.hurtHero(e.big ? 2 : 1, e.pos);
          }
        }
        if (e.t > 0.6 && e.state === 'strike') { e.state = 'idle'; e.t = 0; e.cool = rand(1, 2); e.struck = false; }
      } else {
        e.cool -= dt;
        if (d > 1.9 * e.reach) vel.copy(toH).multiplyScalar(D.chaseSpeed * (e.big ? 0.7 : 1));
        f.setBase(this.jet ? 'fly' : d > 1.9 * e.reach ? 'run' : 'idle', e.big ? 0.6 : 0.8);
        f.turnTo(yawOf(toH.x, toH.z), dt, 8);
        if (d < 2.4 * e.reach && e.cool <= 0) { e.state = 'windup'; e.t = 0; f.play('interact', 0.9); e.struck = false; }
      }
    }
    e.pos.addScaledVector(vel, dt).addScaledVector(e.knock, dt);
    e.knock.multiplyScalar(Math.exp(-dt * 7));
    this.collide(e.pos, e.r);
    f.root.position.copy(e.pos);
    if (this.jet) { f.root.position.y = this.lift + Math.sin(this.t * 3 + e.ph) * 0.25; this.jetFlame(f, 0.5); }
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
    const C = e.cfg;
    if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
      e.phase = 2;
      if (C.summon) {
        this.say(C.voice, C.who === 'roteur' ? 'BUUURP ! Soldats, à moi ! Écrasez ce petit rigolo !' : 'Soldats ! À l\'aide !', 3.5);
        this.dropGroup(C.rage ? ['gros', 'tireur', 'ventouse'] : ['ventouse', 'tireur'], e.pos, 5);
      }
    }
    // la grande colère du duel final : plus rapide, il rote deux fois
    if (C.rage && e.hp < e.maxHp * 0.25 && e.phase === 2) {
      e.phase = 3;
      this.say(C.voice, 'GRRRR… BUUUUUUUURP ! Tu vas voir, petit rigolo !', 3);
      this.ctx.shake(0.8);
    }
    const wind = D.roteurWindup * (e.phase === 3 ? 0.75 : 1);
    switch (e.state) {
      case 'stalk': {
        f.setBase(d > 3.2 ? 'walk' : 'guard', 1);
        if (d > 3.2) vel.copy(toH).multiplyScalar(3.4);
        f.turnTo(yawOf(toH.x, toH.z), dt, 6);
        e.cool -= dt;
        if (e.cool <= 0) {
          const r = Math.random();
          if (C.throwSaber && e.phase >= 2 && r < 0.3) { e.state = 'throw'; e.t = 0; f.play('throw', 0.9); }
          else if (r < 0.62 && d < 6) { e.state = 'windup'; e.t = 0; e.combo = 0; e.parried = 0; }
          else if (d < 8) { e.state = 'burpUp'; e.t = 0; f.play('spell', 0.7); this.say(C.voice, C.who === 'roteur' ? 'BUUUUUURP !' : 'BRÔÔÔÔT !', 1.5); }
          else e.cool = 0.5;
        }
        break;
      }
      case 'windup': { // il lève son sabre : le sol devient rouge devant lui
        f.turnTo(yawOf(toH.x, toH.z), dt, 5);
        arcOn = Math.min(1, e.t / wind);
        if (e.t === dt || e.t < dt * 1.5) f.play(['atk1', 'atk2', 'heavy'][e.combo], 0.35, 0.5);
        if (e.t > wind) {
          e.state = 'strike'; e.t = 0;
          f.play(['atk1', 'atk2', 'heavy'][e.combo], 1.6, 0.85);
          sfx.swing(0.6, 'classique');
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
          if (e.phase === 3) this.fx.push({ kind: 'ring', pos: e.pos.clone(), r: -2.5, hit: false, mesh: this.makeRing() });
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
          sfx.swing(0.5, 'classique');
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
              e.hp -= 2; e.f.flash = 1; this.ctx.hud.boss(e.name, Math.max(0, e.hp / e.maxHp));
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
    this.enemies = this.enemies.filter((e) => (e.kind === 'roteur' ? this.updateRoteur(e, dt) : e.kind === 'gen' ? this.updateGen(e, dt) : this.updateSoldier(e, dt)));
    // les ennemis se poussent entre eux
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j];
      if (a.dead || b.dead || a.state === 'drop' || b.state === 'drop' || a.kind === 'gen' || b.kind === 'gen') continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.r + b.r;
      if (d < m && d > 0.001) { const k = (m - d) / d * 0.5; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
    }
    for (const e of E) {
      if (e.dead || e.state === 'drop' || e.kind === 'gen') continue;
      const dx = h.pos.x - e.pos.x, dz = h.pos.z - e.pos.z, d = Math.hypot(dx, dz), m = e.r + 0.6;
      if (d < m && d > 0.001) { h.pos.x = e.pos.x + dx / d * m; h.pos.z = e.pos.z + dz / d * m; }
    }

    // tirs
    this.bolts = this.bolts.filter((b) => {
      b.life -= dt;
      b.g.position.addScaledVector(b.vel, dt);
      b.glow.material.rotation += dt * 5;
      if (Math.random() < 0.5) this.ctx.glows.emit(b.g.position.x, b.g.position.y, b.g.position.z, b.reflected ? 0x8fff5a : 0xb04cff, { life: 0.25, s0: 0.5, s1: 0.1 });
      let gone = b.life <= 0;
      if (!gone && !b.reflected && !h.dead && h.jumpT <= 0) {
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
      if (!gone) for (const o of this.world.obstacles) if ((!this.jet || o.h >= 3) && Math.hypot(b.g.position.x - o.x, b.g.position.z - o.z) < o.r) { gone = true; break; }
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
        if (h.jumpT > 0) this.ctx.words.pop('RATÉ !', h.pos.clone().setY(3.4), '#8fff5a', 1.2);
        else if (h.blocking) { this.ctx.words.pop('PARÉ !', h.pos.clone().setY(2.8), '#8fff5a', 1.2); sfx.clash(); }
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

    // repères au sol
    const tg = h.target;
    this.marker.visible = !!tg;
    if (tg) {
      this.marker.position.set(tg.pos.x, 0.06, tg.pos.z);
      this.marker.scale.setScalar((tg.kind === 'roteur' ? 1.6 : 1.05) * (1 + Math.sin(this.t * 8) * 0.08));
    }
    if (this.dot.material.opacity > 0) {
      this.dot.material.opacity = Math.max(0, this.dot.material.opacity - dt * 1.6);
      this.dot.scale.setScalar(Math.max(0.6, this.dot.scale.x - dt * 2));
      if (!h.moveTo) this.dot.material.opacity = Math.min(this.dot.material.opacity, 0.3);
    }

    // caméra : suit Lucas en douceur
    this.camPos.lerp(h.pos, Math.min(1, dt * 5));
    this.ctx.cam.target.copy(this.camPos).setY(1);
    if (this.cam3) this.placeCinema(dt);
    this.world.follow(h.pos);
    return this.result;
  }

  // la caméra de la vue « cinéma » : derrière et un peu au-dessus de Lucas (même direction que la vue du dessus,
  // donc le joystick marche pareil : vers le haut = s'éloigner de la caméra)
  placeCinema(dt) {
    const a = this.ctx.aspect(), cam = this.cam3;
    const dist = a < 1 ? 9.5 : 7.5, high = (a < 1 ? 5.2 : 4.0) + (this.jet ? this.lift : 0);
    const back = _b.set(1, 0, 1).normalize();
    const eye = this.camPos.clone().addScaledVector(back, dist).setY(high);
    this.cineEye = this.cineEye ? this.cineEye.lerp(eye, Math.min(1, dt * 6)) : eye;
    cam.position.copy(this.cineEye);
    cam.lookAt(this.camPos.x - back.x * 2.5, 1.2 + (this.jet ? this.lift : 0), this.camPos.z - back.z * 2.5);
    cam.fov = a < 1 ? 62 : 50; cam.aspect = a; cam.updateProjectionMatrix();
  }

  dispose() {
    if (this.cam3) this.scene.fog = this.oldFog || null;
    for (const e of this.enemies) { if (e.g) this.scene.remove(e.g); if (e.f) this.scene.remove(e.f.root); if (e.arc) this.scene.remove(e.arc); if (e.trail) e.trail.dispose(this.scene); if (e.shadow) this.scene.remove(e.shadow); if (e.thrown) this.scene.remove(e.thrown.s); }
    for (const b of this.bolts) this.scene.remove(b.g);
    for (const s of this.strafes) { this.scene.remove(s.ship, s.shadow); for (const im of s.impacts) this.scene.remove(im.w); }
    for (const p of this.pickups) this.scene.remove(p.g);
    for (const x of this.fx) this.scene.remove(x.mesh);
    this.scene.remove(this.hero.f.root, this.marker, this.dot);
    if (this.hero.shadow) this.scene.remove(this.hero.shadow);
    if (this.prison) this.scene.remove(this.prison.g);
    this.trail.dispose(this.scene);
  }
}
