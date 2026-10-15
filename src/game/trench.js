// L'attaque de la tranchée de l'Étoile Puante, en vraie 3D, la caméra derrière le chasseur-WC (comme au cinéma).
// Lucas file dans la grande rigole de porcelaine de la station-toilettes : tourelles, barres à éviter,
// chasseurs-rots au-dessus… puis Dark Roteur le prend en chasse, Han Popo arrive à la rescousse,
// et il faut tirer la torpille-prout pile dans le trou de la chasse d'eau.
// Repère : le vaisseau avance vers -z ; x = gauche/droite dans la tranchée, y = hauteur (le fond est à 0).
import * as THREE from 'three';
import { Fighter } from '../entities/fighter.js';
import { canvasTex, glowSprite, toon, toonMat, outlineGeo, outlineMat } from '../engine/gfx.js';
import { sfx } from '../engine/audio.js';
import { rand, clamp, pick, Script } from './common.js';

const W = 7, H = 10, SEG = 40; // demi-largeur et profondeur de la tranchée, longueur d'un morceau
const V = () => new THREE.Vector3();

// ---------- textures et matières ----------
const tileTex = (base, line) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(8, 8, 110, 30); g.fillRect(136, 136, 110, 30);
  g.strokeStyle = line; g.lineWidth = 6;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); }
}, true);
let MAT = null;
function mats() {
  if (MAT) return MAT;
  const floor = tileTex('#e9ece6', '#9aa3ad'); floor.repeat.set(3.5, SEG / 4);
  const wall = tileTex('#dfe3ea', '#8e98a6'); wall.repeat.set(SEG / 4, 2.5);
  const top = tileTex('#f1f2ee', '#a7aeb6'); top.repeat.set(12, SEG / 4);
  MAT = {
    floor: new THREE.MeshToonMaterial({ map: floor }),
    wall: new THREE.MeshToonMaterial({ map: wall }),
    top: new THREE.MeshToonMaterial({ map: top }),
  };
  return MAT;
}
function part(geo, color, x, y, z, o = {}) {
  const g = toon(geo, color, { outline: o.outline ?? 0.05, shadow: false, emissive: o.emissive || 0 });
  g.position.set(x, y, z);
  if (o.rx) g.rotation.x = o.rx; if (o.ry) g.rotation.y = o.ry; if (o.rz) g.rotation.z = o.rz;
  return g;
}

// une crotte de l'espace en 3D : trois boudins empilés et une pointe
export function makePoop(size = 2.6) {
  const g = new THREE.Group();
  const k = size / 2.6;
  for (const [y, r, t] of [[0, 1.05, 0.5], [0.62, 0.78, 0.42], [1.12, 0.5, 0.33]]) g.add(part(new THREE.TorusGeometry(r * k, t * k, 10, 22), 0x7a4a22, 0, y * k, 0, { rx: Math.PI / 2, outline: 0.04 }));
  g.add(part(new THREE.ConeGeometry(0.42 * k, 0.75 * k, 12), 0x7a4a22, 0, 1.6 * k, 0, { outline: 0.03 }));
  for (const s of [-1, 1]) g.add(part(new THREE.SphereGeometry(0.16 * k, 10, 8), 0xffffff, s * 0.3 * k, 0.75 * k, 0.85 * k, { outline: 0.02 }));
  return g;
}

// ---------- les vaisseaux en 3D ----------
// le chasseur-WC : une cuvette volante avec son réservoir, sa lunette, et quatre ailes en X
export function makeWcFighter() {
  const g = new THREE.Group();
  const C = (a, b, h, n = 16) => new THREE.CylinderGeometry(a, b, h, n);
  g.add(part(new THREE.CapsuleGeometry(0.62, 2.6, 6, 16).rotateX(Math.PI / 2), 0xf6f7f2, 0, 0, 0));
  g.add(part(new THREE.ConeGeometry(0.62, 1.4, 16).rotateX(-Math.PI / 2), 0xf6f7f2, 0, 0, -2.4));
  g.add(part(new THREE.TorusGeometry(0.72, 0.16, 8, 22), 0x8fd3ff, 0, 0.05, -0.2)); // la lunette !
  g.add(part(new THREE.BoxGeometry(1.2, 0.55, 0.55), 0xf6f7f2, 0, 0.45, 1.6)); // le réservoir (bas, pour voir Lucas)
  g.add(part(C(0.06, 0.06, 0.5, 8).rotateZ(Math.PI / 2), 0xb8bec8, 0.7, 0.62, 1.45)); // la manette de chasse
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.25, depthWrite: false }));
  glass.position.set(0, 0.4, -0.5); g.add(glass);
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const wing = new THREE.Group();
    wing.add(part(new THREE.BoxGeometry(2.6, 0.12, 1.3), 0xe6e8e2, 1.5, 0, 0.6));
    wing.add(part(new THREE.BoxGeometry(2.0, 0.14, 0.22), 0x4fc23a, 1.6, 0.02, 0.15, { outline: 0 })); // bande verte
    wing.add(part(C(0.26, 0.3, 1.5).rotateX(Math.PI / 2), 0xb8bec8, 0.9, 0, 0.7)); // moteur
    wing.add(part(C(0.06, 0.06, 2.2, 8).rotateX(Math.PI / 2), 0x6a6e78, 2.85, 0, -0.3)); // canon au bout de l'aile
    const fire = glowSprite(0x7dff4a, 1.1, 0.9); fire.position.set(0.9, 0, 1.55); wing.add(fire);
    wing.rotation.z = sy * 0.32;
    wing.scale.x = sx;
    if (sx < 0) wing.rotation.z = -wing.rotation.z;
    g.add(wing);
  }
  // Lucas assis aux commandes
  const lucas = new Fighter('lucas', 1.0);
  lucas.setBase('sit'); lucas.setSaberOn(0);
  lucas.yaw = Math.PI; lucas.root.position.set(0, 0.25, -0.45);
  lucas.update(0.01);
  g.add(lucas.root);
  g.userData.lucas = lucas;
  return g;
}
// chasseur-rot de Dark Roteur : une boule violette à gros yeux et deux grands panneaux à six côtés
export function makeRotFighter(big = false) {
  const g = new THREE.Group();
  const col = big ? 0x3a2d4d : 0x6a3f8f;
  g.add(part(new THREE.SphereGeometry(0.9, 16, 12), col, 0, 0, 0));
  g.add(part(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 14).rotateX(Math.PI / 2), 0x1d1426, 0, 0, 0.85, { outline: 0.02 }));
  for (const s of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.22, 0.08, 0.05), 0xffd23f, s * 0.2, 0.08, 0.98, { outline: 0, emissive: 0xb08a10 }));
  g.add(part(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8).rotateZ(Math.PI / 2), 0x2a2232, 0, 0, 0));
  for (const s of [-1, 1]) {
    const p = part(new THREE.CylinderGeometry(big ? 2.1 : 1.6, big ? 2.1 : 1.6, 0.14, 6).rotateZ(Math.PI / 2), big ? 0x2a2232 : 0x4b3466, s * 1.35, 0, 0);
    if (big) p.scale.set(1, 1, 1.15);
    g.add(p);
  }
  if (big) for (const s of [-1, 1]) g.add(part(new THREE.ConeGeometry(0.2, 0.7, 8), 0x9b6ad0, s * 0.5, 0.85, 0, { rz: -s * 0.5 }));
  return g;
}
// le Faucon Pétulant de Han Popo : une grosse galette avec deux mandibules devant
export function makeFaucon() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(3, 3.2, 0.8, 24), 0xcfc6ae, 0, 0, 0, { outline: 0.08 }));
  g.add(part(new THREE.CylinderGeometry(1.2, 1.2, 0.4, 18), 0xa89f88, 0, 0.55, 0.2));
  for (const s of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.9, 0.5, 2.6), 0xcfc6ae, s * 0.8, 0, -3.3));
  g.add(part(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12).rotateX(Math.PI / 2), 0xcfc6ae, 3.0, 0.1, -1.6));
  g.add(part(new THREE.CylinderGeometry(0.6, 0.1, 0.25, 14), 0xb8bec8, -1.2, 0.75, -0.6));
  const fire = glowSprite(0x7fd6ff, 4, 0.9); fire.position.set(0, 0.1, 3.2); g.add(fire);
  return g;
}

export class TrenchMode {
  constructor(ctx, opts = {}) {
    this.ctx = ctx; this.scene = ctx.scene; this.world = ctx.world;
    this.t = 0; this.result = null;
    this.speed = 26;
    this.z = 0; // où en est le vaisseau (il avance vers -z)
    this.segs = []; this.obst = []; this.turrets = []; this.flyers = []; this.shots = []; this.eshots = [];
    this.genZ = 60; this.mode = 'calme';
    this.root = new THREE.Group(); this.scene.add(this.root);
    // l'espace : fond noir étoilé, brume au loin
    this.oldBg = this.scene.background; this.oldFog = this.scene.fog;
    this.scene.background = new THREE.Color(0x07040f);
    this.scene.fog = new THREE.Fog(0x120a22, 170, 430); // brume très loin : on voit la tranchée au loin
    if (this.world && this.world.ground) { this.oldGround = this.world.ground.visible; this.world.ground.visible = false; }
    this.stars = this.makeStars(); this.root.add(this.stars);
    // la caméra de cinéma
    this.cam3 = new THREE.PerspectiveCamera(62, ctx.aspect(), 0.1, 800);
    this.camPos = new THREE.Vector3(0, H + 12, 14);
    this.shakeT = 0;
    const p = this.ship = { x: 0, y: H + 8, hp: opts.hp ?? ctx.diff.hp, maxHp: ctx.diff.hp, inv: 0, fireT: 0, mega: opts.mega ?? 0, tilt: 0, roll: 0 };
    this.obj = makeWcFighter();
    this.scene.add(this.obj);
    this.lucas = this.obj.userData.lucas;
    for (let z = 40; z > -SEG * 5; z -= SEG) this.addSeg(z);
    // la visée de la fin (dessinée par-dessus le jeu)
    this.sight = document.createElement('div');
    this.sight.className = 'trenchSight hidden';
    this.sight.innerHTML = '<div class="ring"></div><b>---</b>';
    document.getElementById('hud').appendChild(this.sight);
    this.script = opts.script ? new Script(opts.script(this)) : new Script(trenchRun(this));
    ctx.hud.hearts(p.hp, p.maxHp); ctx.hud.mega(p.mega);
  }

  say(who, text, dur) { this.ctx.hud.radio(who, text, dur); }

  makeStars() {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.15, r = 300;
      pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
  }

  // ---------- la tranchée, morceau par morceau ----------
  addSeg(z0) {
    const M = mats(), g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, SEG).rotateX(-Math.PI / 2), M.floor);
    floor.position.set(0, 0, z0 - SEG / 2); g.add(floor);
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(SEG, H).rotateY(-s * Math.PI / 2), M.wall);
      wall.position.set(s * W, H / 2, z0 - SEG / 2); g.add(wall);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(70, SEG).rotateX(-Math.PI / 2), M.top);
      top.position.set(s * (W + 35), H, z0 - SEG / 2); g.add(top);
      // tuyaux le long des murs, lampes vertes, bouches d'aération
      g.add(part(new THREE.CylinderGeometry(0.35, 0.35, SEG, 10).rotateX(Math.PI / 2), 0xb8bec8, s * (W - 0.4), 2.2, z0 - SEG / 2, { outline: 0.04 }));
      g.add(part(new THREE.CylinderGeometry(0.22, 0.22, SEG, 8).rotateX(Math.PI / 2), 0x6a3f8f, s * (W - 0.3), 6.8, z0 - SEG / 2, { outline: 0.03 }));
      for (let k = 0; k < 2; k++) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 1.4), new THREE.MeshBasicMaterial({ color: 0x8fff5a }));
        lamp.position.set(s * (W - 0.1), 4.5, z0 - 10 - k * 20); g.add(lamp);
      }
      // bâtiments sur le dessus de la station (on les voit dépasser au bord)
      for (let k = 0; k < 2; k++) {
        const h = rand(1.5, 6), r = rand(1.5, 3.5);
        g.add(part(Math.random() < 0.5 ? new THREE.CylinderGeometry(r, r * 1.1, h, 12) : new THREE.BoxGeometry(r * 2, h, r * 2),
          pick([0xe9ece6, 0xd8dce4, 0xcfd6e0]), s * rand(W + 5, W + 26), H + h / 2, z0 - rand(4, SEG - 4), { outline: 0.06 }));
      }
    }
    // une flaque verte au fond de temps en temps
    if (Math.random() < 0.5) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(rand(1, 2), 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fdc3c, transparent: true, opacity: 0.6 }));
      puddle.position.set(rand(-W + 2, W - 2), 0.02, z0 - rand(5, SEG - 5)); g.add(puddle);
    }
    this.root.add(g);
    this.segs.push({ g, z0 });
  }

  // barres en travers : basse (passer dessus), haute (passer dessous), ou un pilier d'un côté
  addBar(z, type = pick(['low', 'high', 'left', 'right'])) {
    const g = new THREE.Group();
    const M = mats();
    if (!M.bar) M.bar = new THREE.MeshToonMaterial({ map: canvasTex(64, 16, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ff4a3a' : '#ffffff'; c.fillRect(i * 8, 0, 8, 16); } }) });
    const mat = M.bar;
    let box;
    if (type === 'low') box = { x0: -W, x1: W, y0: 0, y1: 4.2 };
    else if (type === 'high') box = { x0: -W, x1: W, y0: 5.4, y1: H };
    else if (type === 'left') box = { x0: -W, x1: 0.6, y0: 0, y1: H };
    else box = { x0: -0.6, x1: W, y0: 0, y1: H };
    const geo = new THREE.BoxGeometry(box.x1 - box.x0, box.y1 - box.y0, 1.2);
    const m = new THREE.Mesh(geo, mat); g.add(m);
    g.add(new THREE.Mesh(outlineGeo(geo, 0.08), outlineMat));
    g.position.set((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, z);
    this.root.add(g);
    this.obst.push({ g, z, box, hit: false });
  }

  // tourelle accrochée au mur de la tranchée (bien en face du joueur) : elle tire des bulles violettes
  addTurret(z, side = pick([-1, 1])) {
    const g = new THREE.Group();
    const y = rand(4.5, 8);
    g.add(part(new THREE.BoxGeometry(0.5, 2.2, 2.2), 0x5a3a66, side * 0.25, 0, 0)); // la plaque fixée au mur
    const head = new THREE.Group(); // la tête qui tourne vers le vaisseau
    head.add(part(new THREE.SphereGeometry(0.95, 14, 10), 0x8a5ab0, 0, 0, 0));
    head.add(part(new THREE.CylinderGeometry(0.2, 0.26, 1.8, 10).rotateX(Math.PI / 2), 0x3a2848, 0, 0, 1.1));
    const lamp = glowSprite(0xff3a3a, 1.4, 0.95); lamp.position.y = 0.9; head.add(lamp);
    head.position.x = -side * 0.7;
    g.add(head);
    g.scale.setScalar(1.35); // bien grosse, pour qu'on la voie arriver
    g.position.set(side * W, y, z);
    this.root.add(g);
    this.turrets.push({ g, head, z, x: side * (W - 0.7), y, hp: 3, fireT: rand(0.6, 1.6), dead: false, flash: 0 });
  }

  // chasseurs-rots qui volent au-dessus de la tranchée, un peu devant
  addFlyer(big = false) {
    const o = makeRotFighter(big);
    this.scene.add(o);
    const e = { o, big, x: rand(-W, W), y: H + rand(3, 6), dz: big ? 16 : -rand(10, 22), ph: rand(0, 6), fireT: rand(1, 2), t: 0, dead: false, hp: 3 };
    if (big) { e.x = 0; e.y = H + 6; }
    this.flyers.push(e);
    return e;
  }

  shoot(x, y, z, vx, vy, vz, enemy) {
    const g = new THREE.Group();
    if (enemy) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf3dcff })), glowSprite(0xb04cff, 1.8, 0.95));
    else g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.6, 4, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xeaffd8 })), glowSprite(0x6dff3a, 1.2, 0.7));
    g.position.set(x, y, z);
    this.scene.add(g);
    (enemy ? this.eshots : this.shots).push({ g, v: new THREE.Vector3(vx, vy, vz), life: enemy ? 4 : 1.4 });
    if (enemy) sfx.pew(); else sfx.laser();
  }

  hurt() {
    const p = this.ship;
    if (p.inv > 0 || this.result || this.won) return;
    p.hp -= 1; p.inv = 1.5;
    sfx.hurt(); this.shakeT = 0.4; this.ctx.flash(0.25);
    this.ctx.puffs.burst(this.obj.position.x, this.obj.position.y, this.obj.position.z, 0xc38be8, 12, 4, { life: 0.8, s0: 0.6, s1: 1.6 });
    this.ctx.hud.hearts(Math.max(0, p.hp), p.maxHp);
    if (p.hp <= 0) { this.crashT = 1.6; this.ctx.words.pop('OUPS !', this.obj.position.clone().setY(this.obj.position.y + 2), '#ff8a3d', 2); }
  }

  megaProut() {
    const p = this.ship;
    p.mega = 0; this.ctx.hud.mega(0);
    sfx.mega(); this.shakeT = 0.6;
    const P = this.obj.position;
    this.ctx.words.pop('MÉGA-PROUT !', P.clone().setY(P.y + 2.5), '#8fff5a', 2.2);
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; this.ctx.puffs.emit(P.x, P.y, P.z, i % 2 ? 0x9be36b : 0xc8f59a, { vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, vz: -10, life: 1, s0: 1.5, s1: 4.5, drag: 1.8 }); }
    for (const s of this.eshots) s.life = 0;
    for (const t of this.turrets) if (!t.dead && t.z < this.z + 5 && t.z > this.z - 120) this.killTurret(t);
    for (const e of this.flyers) if (!e.dead && !e.big) this.killFlyer(e);
  }

  killTurret(t) {
    t.dead = true;
    const P = t.g.position;
    this.ctx.puffs.burst(P.x, P.y + 0.5, P.z, 0x9be36b, 14, 6, { life: 0.9, s0: 0.8, s1: 2.4 });
    this.ctx.words.pop(pick(['POUF !', 'BAM !', 'PROUT !']), P.clone().setY(P.y + 2), '#ffd23f', 1.6);
    sfx.boom();
    t.g.visible = false;
    const p = this.ship; p.mega = Math.min(1, p.mega + 0.1); this.ctx.hud.mega(p.mega);
  }
  killFlyer(e) {
    e.dead = true; e.dying = 1.2; e.spin = rand(6, 10) * (Math.random() < 0.5 ? -1 : 1);
    sfx.boom();
    this.ctx.words.pop(pick(['POUF !', 'BAM !']), e.o.position.clone().setY(e.o.position.y + 2), '#ffd23f', 1.6);
  }

  // la cible la plus proche devant : une tourelle sur le bord, ou un chasseur-rot
  pickTarget() {
    let best = null, bd = 1e9;
    for (const t of this.turrets) {
      const d = this.z - t.z;
      if (!t.dead && d > 14 && d < 55 && d < bd) { bd = d; best = { x: t.x, y: t.y + 0.4, z: t.z, ref: t }; }
    }
    for (const e of this.flyers) {
      if (e.dead || e.big) continue;
      const P = e.o.position, d = this.z - P.z;
      if (d > 6 && d < 60 && d < bd) { bd = d; best = { x: P.x, y: P.y, z: P.z - this.speed * 0.15, ref: e }; }
    }
    return best;
  }
  // cercle rouge qui tourne autour de la cible visée
  showLock(tg, dt) {
    if (!this.lock) {
      this.lock = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.5, 4, 1), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.9, depthTest: false, fog: false }));
      ring.renderOrder = 15; this.lock.add(ring);
      this.lock.userData.ring = ring;
      this.scene.add(this.lock);
    }
    this.lock.visible = !!tg;
    if (!tg) return;
    this.lock.position.set(tg.x, tg.y, tg.z);
    this.lock.quaternion.copy(this.cam3.quaternion);
    this.lock.userData.ring.rotation.z += dt * 3;
    this.lock.scale.setScalar(1 + Math.sin(this.t * 10) * 0.08);
  }

  // ---------- la boucle ----------
  update(dt) {
    this.t += dt;
    const p = this.ship, inp = this.ctx.input, D = this.ctx.diff;
    const sp = this.won ? this.speed * 0.6 : this.speed;
    this.z -= sp * dt;
    this.script.update(dt);

    // pilotage
    if (this.crashT === undefined && !this.autopilot) {
      const k = (W * 2.4) / Math.max(1, this.ctx.gw());
      const px = p.x, py = p.y;
      p.x += inp.drag.x * k + inp.move.x * 12 * dt;
      p.y += inp.drag.y * k + inp.move.y * 10 * dt;
      p.x = clamp(p.x, -W + 1.3, W - 1.3);
      p.y = clamp(p.y, 1.0, this.free ? H + 6 : H - 0.8);
      p.tilt += (clamp((p.x - px) / Math.max(dt, 0.001) * 0.06, -0.7, 0.7) - p.tilt) * Math.min(1, dt * 8);
      p.roll += (clamp((p.y - py) / Math.max(dt, 0.001) * 0.04, -0.4, 0.4) - p.roll) * Math.min(1, dt * 8);
      if (inp.mega && p.mega >= 1) this.megaProut();
      p.fireT -= dt;
      const tg = this.guns ? this.pickTarget() : null;
      this.showLock(tg, dt);
      if (this.guns && p.fireT <= 0) {
        p.fireT = 0.2;
        for (const s of [-1, 1]) {
          const x = p.x + s * 2.6, y = p.y + 0.3, z = this.z - 1;
          if (tg) { // visée automatique : un enfant n'a pas à viser au millimètre
            const d = new THREE.Vector3(tg.x - x, tg.y - y, tg.z - z).normalize().multiplyScalar(110);
            this.shoot(x, y, z, d.x, d.y, d.z, false);
          } else this.shoot(x, y, z, 0, 0, -110, false);
        }
      }
    } else if (this.crashT !== undefined) {
      this.crashT -= dt; p.tilt += dt * 6; p.y = Math.max(0.5, p.y - dt * 4);
      if (this.crashT <= 0 && !this.result) this.result = { type: 'dead' };
    }
    p.inv -= dt;
    this.obj.position.set(p.x, p.y + Math.sin(this.t * 3) * 0.08, this.z);
    this.obj.rotation.set(-p.roll, 0, -p.tilt, 'YXZ');
    this.obj.visible = p.inv <= 0 || Math.floor(this.t * 14) % 2 === 0;
    this.lucas.update(dt);
    if (Math.random() < 0.7) this.ctx.puffs.emit(p.x + rand(-0.8, 0.8), p.y + rand(-0.6, 0.6), this.z + 2.6, 0x9be36b, { vz: 8, life: 0.4, s0: 0.4, s1: 1.2, alpha: 0.6 });

    // la tranchée défile : on ajoute des morceaux devant, on enlève ceux de derrière
    const front = this.segs.length ? this.segs[this.segs.length - 1].z0 - SEG : 0;
    if (front > this.z - 380) this.addSeg(front);
    this.segs = this.segs.filter((s) => { if (!this.free && s.z0 - SEG > this.z + 130) { this.root.remove(s.g); return false; } return true; });
    // ce que le scénario demande de placer devant
    if (this.mode !== 'calme' && this.mode !== 'fin') {
      while (this.genZ > this.z - 300) {
        this.genZ -= this.mode === 'barres' ? rand(48, 60) : rand(26, 36);
        if (this.mode === 'tourelles') this.addTurret(this.genZ);
        if (this.mode === 'barres') { this.addBar(this.genZ); if (Math.random() < 0.5) this.addTurret(this.genZ - 15); }
        if (this.mode === 'chasseurs' && Math.random() < 0.4) this.addTurret(this.genZ);
      }
    } else this.genZ = Math.min(this.genZ, this.z - 300);

    // les barres
    const S = { x: p.x, y: p.y };
    this.obst = this.obst.filter((o) => {
      if (o.z > this.z + 30) { this.root.remove(o.g); return false; }
      if (!o.hit && Math.abs(o.z - this.z) < 1.2) {
        const b = o.box;
        if (S.x + 0.5 > b.x0 && S.x - 0.5 < b.x1 && S.y + 0.4 > b.y0 && S.y - 0.4 < b.y1) { // un peu gentil : il faut vraiment rentrer dedans
          o.hit = true;
          if (p.inv <= 0) { this.ctx.words.pop('BONK !', this.obj.position.clone().setY(p.y + 2), '#ffd23f', 1.4); this.hurt(); }
        }
      }
      return true;
    });

    // les tourelles visent le vaisseau
    this.turrets = this.turrets.filter((t) => {
      if (t.z > this.z + 30) { this.root.remove(t.g); return false; }
      if (t.dead) return true;
      t.head.lookAt(p.x, p.y, this.z);
      const d = t.z - this.z;
      if (d < -12 && d > -80) {
        t.fireT -= dt;
        if (t.fireT <= 0) {
          t.fireT = rand(1.4, 2.4) / D.flightFire;
          const tz = this.z - this.speed * 0.9; // là où sera le vaisseau
          const dir = new THREE.Vector3(p.x - t.x, p.y - t.y, tz - t.z).normalize().multiplyScalar(22);
          this.shoot(t.x, t.y, t.z, dir.x, dir.y, dir.z, true);
        }
      }
      return true;
    });

    // les chasseurs-rots
    this.flyers = this.flyers.filter((e) => {
      e.t += dt;
      if (e.dead) {
        e.dying -= dt; e.o.rotation.z += e.spin * dt; e.o.rotation.x += e.spin * dt * 0.5;
        e.o.position.y += e.flyOff ? dt * 6 : -dt * 3; e.o.position.x += (e.flyOff || 0) * dt * 14;
        e.o.position.z -= sp * dt;
        if (Math.random() < 0.6) this.ctx.puffs.emit(e.o.position.x, e.o.position.y, e.o.position.z, 0x777777, { vy: 1, life: 0.7, s0: 0.6, s1: 1.6 });
        if (e.dying <= 0) { this.scene.remove(e.o); return false; }
        return true;
      }
      if (e.big) { // Dark Roteur : derrière nous, il se rapproche
        e.dz += ((this.roteurNear ? 9 : 16) - e.dz) * Math.min(1, dt * 0.8);
        e.x += (p.x - e.x) * Math.min(1, dt * 1.5); e.y = H + 3.5 + Math.sin(e.t * 2) * 0.5;
      } else {
        e.dz += ((-14 + Math.sin(e.t * 0.7 + e.ph) * 6) - e.dz) * Math.min(1, dt);
        e.x = Math.sin(e.t * 0.9 + e.ph) * (W + 2);
        e.y = H + 3 + Math.sin(e.t * 1.7 + e.ph) * 1.5;
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = rand(1.6, 2.6) / D.flightFire;
          const dir = new THREE.Vector3(p.x - e.x, p.y - e.y, -6).normalize().multiplyScalar(16);
          this.shoot(e.x, e.y - 0.8, this.z + e.dz, dir.x, dir.y, dir.z - sp, true);
        }
      }
      e.o.position.set(e.x, e.y, this.z + e.dz);
      e.o.rotation.set(0, Math.PI, Math.sin(e.t * 0.9 + e.ph) * 0.4);
      return true;
    });

    // tirs de Lucas
    this.shots = this.shots.filter((s) => {
      s.life -= dt; s.g.position.addScaledVector(s.v, dt);
      const P = s.g.position;
      let gone = s.life <= 0;
      if (!gone) for (const t of this.turrets) if (!t.dead && Math.abs(P.z - t.z) < 3 && Math.abs(P.x - t.x) < 3 && Math.abs(P.y - t.y) < 3.5) {
        t.hp -= 1; gone = true; sfx.hit();
        this.ctx.glows.burst(P.x, P.y, P.z, 0xeaffc0, 5, 5, { life: 0.25, s0: 0.4, s1: 0.1 });
        if (t.hp <= 0) this.killTurret(t);
        break;
      }
      if (!gone) for (const e of this.flyers) if (!e.dead && !e.big && e.o.position.distanceTo(P) < 3.4) {
        e.hp -= 1; gone = true; sfx.hit();
        if (e.hp <= 0) this.killFlyer(e);
        break;
      }
      if (!gone) for (const o of this.obst) if (Math.abs(P.z - o.z) < 1 && P.x > o.box.x0 && P.x < o.box.x1 && P.y > o.box.y0 && P.y < o.box.y1) { gone = true; break; }
      if (gone) this.scene.remove(s.g);
      return !gone;
    });

    // tirs ennemis
    this.eshots = this.eshots.filter((s) => {
      s.life -= dt; s.g.position.addScaledVector(s.v, dt);
      const P = s.g.position;
      let gone = s.life <= 0 || P.z > this.z + 20 || P.y < -1;
      if (!gone && Math.abs(P.z - this.z) < 1.4 && Math.hypot(P.x - p.x, P.y - p.y) < 1.1) { this.hurt(); gone = true; }
      if (gone) this.scene.remove(s.g);
      return !gone;
    });

    if (this.hole) this.updateHole(dt);
    this.placeCam(dt);
    return this.result;
  }

  placeCam(dt) {
    const p = this.ship;
    // caméra « de face » pendant que Dark Roteur nous poursuit : on le voit derrière Lucas
    const back = this.camBack;
    const want = back ? new THREE.Vector3(p.x + 4, p.y + (this.free ? 7 : 2.2), this.z - 12) : new THREE.Vector3(p.x * 0.55, p.y + 2.3, this.z + 8.5);
    this.camPos.lerp(want, Math.min(1, dt * (back ? 2.5 : 5)));
    this.camPos.z = Math.min(Math.max(this.camPos.z, want.z - 3), want.z + 3); // elle ne se laisse pas distancer
    this.cam3.position.copy(this.camPos);
    if (this.shakeT > 0) { this.shakeT -= dt; this.cam3.position.x += rand(-0.3, 0.3); this.cam3.position.y += rand(-0.3, 0.3); }
    if (back) this.cam3.lookAt(p.x, this.free ? p.y - 4 : p.y + 1.5, this.z + (this.free ? 14 : 6)); // en remontant : on regarde la station en bas
    else { this.cam3.lookAt(p.x * 0.8, p.y + 0.6, this.z - 14); this.cam3.rotation.z += -p.tilt * 0.25; }
    this.cam3.aspect = this.ctx.aspect();
    this.cam3.fov = this.ctx.aspect() < 1 ? 74 : 60;
    this.cam3.updateProjectionMatrix();
    this.stars.position.set(this.camPos.x, 0, this.camPos.z);
  }

  // la grande surface de la station-toilettes (on la voit en remontant vers les étoiles)
  buildSurface() {
    const M = mats(), g = new THREE.Group();
    // la tranchée continue loin derrière (sinon on voit une bande noire en remontant)
    let back = Math.max(...this.segs.map((s) => s.z0));
    while (back < this.z + 700) { back += SEG; this.addSeg(back); }
    this.segs.sort((a, b) => b.z0 - a.z0);
    const tex = M.top.map.clone(); tex.repeat.set(110, 220); tex.needsUpdate = true;
    const mat = new THREE.MeshToonMaterial({ map: tex });
    for (const s of [-1, 1]) { // deux grandes moitiés, en laissant la tranchée ouverte au milieu
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 1400).rotateX(-Math.PI / 2), mat);
      floor.position.set(s * (W + 350), H - 0.12, this.z + 100);
      g.add(floor);
    }
    // des tours, des dômes et des tuyaux partout sur la station
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() < 0.5 ? -1 : 1) * rand(W + 6, 220), z = this.z + rand(-200, 400), h = rand(2, 14), r = rand(2, 7);
      const kind = Math.random();
      const geo = kind < 0.4 ? new THREE.CylinderGeometry(r, r * 1.1, h, 14) : kind < 0.7 ? new THREE.BoxGeometry(r * 2, h, r * 2) : new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      g.add(part(geo, pick([0xe9ece6, 0xd8dce4, 0xcfd6e0, 0xb8a6d8]), x, kind < 0.7 ? H + h / 2 : H, z, { outline: 0.1 }));
    }
    this.root.add(g);
  }

  // ---------- la fin : le trou de la chasse d'eau ----------
  placeHole(dist = 230) {
    const g = new THREE.Group();
    const z = this.z - dist;
    g.add(part(new THREE.CylinderGeometry(3.4, 3.4, 0.3, 32), 0xb8bec8, 0, 0.1, 0));
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.8, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6fe04a }));
    water.position.y = 0.28; g.add(water);
    const swirl = new THREE.Mesh(new THREE.RingGeometry(0.6, 2.4, 32, 1, 0, Math.PI * 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2f9e35, side: THREE.DoubleSide }));
    swirl.position.y = 0.3; g.add(swirl);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0c2a10 }));
    hole.position.y = 0.32; g.add(hole);
    // des lumières qui clignotent vers le trou
    const lights = [];
    for (let i = 1; i <= 6; i++) for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 1), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
      l.position.set(s * 4.2, 0.1, i * 6); g.add(l); lights.push({ l, i });
    }
    g.position.set(0, 0, z);
    this.root.add(g);
    this.hole = { g, z, swirl, lights, shot: null, missed: false };
    this.sight.classList.remove('hidden');
  }

  updateHole(dt) {
    const h = this.hole;
    h.swirl.rotation.y += dt * 4;
    for (const L of h.lights) L.l.material.color.setHex(Math.floor(this.t * 6 - L.i) % 6 === 0 ? 0xff4a3a : 0xffd23f);
    const d = this.z - h.z; // distance avant le trou
    const good = d > 7 && d < 30;
    const el = this.sight;
    el.querySelector('b').textContent = d > 0 ? `${Math.round(d)} m` : '';
    el.classList.toggle('good', good && !h.shot);
    if (this.won) { el.classList.add('hidden'); return; }
    if (!h.shot) this.ctx.hud.action(d < 80 && d > 0 ? 'TIRE LA CHASSE !' : null);
    if (!h.shot && this.ctx.input.action && d > 0 && d < 80) {
      // la torpille-prout : une grosse bulle verte qui file vers le trou
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), new THREE.MeshBasicMaterial({ color: 0xeaffd8 })), glowSprite(0x7dff4a, 3, 0.95));
      g.position.copy(this.obj.position);
      this.scene.add(g);
      h.shot = { g, t: 0, from: this.obj.position.clone(), ok: good, land: new THREE.Vector3(0, 0.4, good ? h.z : this.z - 30) };
      this.ctx.hud.action(null);
      sfx.jump();
      this.say('lucas', good ? 'Que le Gaz soit avec moi !' : 'Oh non… trop tôt ?', 2);
    }
    if (h.shot) {
      const s = h.shot;
      s.t += dt / 0.9;
      const k = Math.min(1, s.t);
      const target = s.ok ? new THREE.Vector3(0, 0.4, h.z) : s.land;
      s.g.position.lerpVectors(s.from, target, k);
      s.g.position.y += Math.sin(k * Math.PI) * 2;
      if (k >= 1 && !s.done) {
        s.done = true; this.scene.remove(s.g);
        if (s.ok) this.flush();
        else {
          this.ctx.puffs.burst(target.x, 0.6, target.z, 0x9be36b, 16, 5, { life: 0.9, s0: 0.8, s1: 2.4 });
          this.ctx.words.pop('RATÉ !', target.clone().setY(3), '#ff8a3d', 2);
          sfx.boom();
          h.missed = true;
        }
      }
    }
    // raté, ou on est passé au-dessus sans tirer : on refait un tour
    if (!this.won && d < -10 && (!h.shot || h.missed)) {
      this.root.remove(h.g); this.hole = null; this.sight.classList.add('hidden'); this.ctx.hud.action(null);
      this.say('pqr', 'Raté ! On refait un tour… Tire quand le viseur devient VERT !', 4);
      this.placeHole(260);
    }
  }

  flush() {
    this.won = true; this.guns = false;
    sfx.mega(); sfx.boom(); this.ctx.flash(0.9); this.shakeT = 1.2;
    const z = this.hole.z;
    this.ctx.words.pop('PLOUF !', new THREE.Vector3(0, 5, z), '#8fff5a', 3);
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; this.ctx.puffs.emit(Math.cos(a) * 2, 1, z + Math.sin(a) * 2, i % 2 ? 0x9be36b : 0x6fe04a, { vx: Math.cos(a) * 10, vy: rand(6, 16), vz: Math.sin(a) * 10, life: 1.6, s0: 1.4, s1: 5 }); }
    for (const e of this.eshots) e.life = 0;
    this.sight.classList.add('hidden');
  }

  dispose() {
    this.scene.remove(this.root, this.obj);
    if (this.lock) this.scene.remove(this.lock);
    for (const e of this.flyers) this.scene.remove(e.o);
    for (const s of [...this.shots, ...this.eshots]) this.scene.remove(s.g);
    if (this.hole && this.hole.shot) this.scene.remove(this.hole.shot.g);
    this.scene.background = this.oldBg; this.scene.fog = this.oldFog || null;
    if (this.world && this.world.ground && this.oldGround !== undefined) this.world.ground.visible = this.oldGround;
    this.sight.remove();
    this.ctx.hud.action(null);
  }
}

// ---------- le scénario de la tranchée ----------
function* trenchRun(m) {
  const hud = m.ctx.hud, p = m.ship;
  hud.banner('LA TRANCHÉE !', 2.5);
  hud.objective('Plonge dans la tranchée de l\'Étoile Puante !');
  m.say('gazou', 'Dans la tranchée, descendre tu dois. Glisse ton doigt pour piloter.', 4);
  m.autopilot = true;
  // le vaisseau plonge du ciel dans la tranchée
  for (let k = 0; k < 1; k += 1 / 60) { p.y = H + 8 - (H + 8 - 5) * (k * (2 - k)); yield 1 / 30; }
  p.y = 5; m.autopilot = false; m.guns = true;
  sfx.whoosh();
  yield 2;
  hud.objective('Détruis les tourelles sur les bords !');
  m.mode = 'tourelles';
  m.say('hanpopo', 'Des tourelles sur les bords, gamin ! Ton vaisseau vise tout seul : passe près d\'elles !', 4);
  yield 14;
  m.mode = 'barres';
  hud.objective('Évite les barrières : passe dessous ou dessus !');
  m.say('pqr', 'Attention aux barrières rayées ! Monte ou descends pour passer !', 4);
  yield 16;
  m.mode = 'chasseurs';
  hud.objective('Les chasseurs-rots arrivent ! Évite leurs bulles !');
  m.say('r2wc', 'Bip bip bouuuup ! (Trois chasseurs au-dessus de nous !)', 3);
  for (let i = 0; i < 3; i++) { m.addFlyer(); yield 1.2; }
  yield 12;
  m.mode = 'calme';
  for (const e of m.flyers) if (!e.dead && !e.big) { e.dead = true; e.dying = 1.5; e.spin = 2; e.flyOff = Math.random() < 0.5 ? -1 : 1; }
  yield 1.5;
  // Dark Roteur nous prend en chasse… et Han Popo arrive !
  const rot = m.addFlyer(true);
  m.autopilot = true; m.guns = false; m.camBack = true; // petit film : on se retourne
  for (const s of m.eshots) s.life = 0;
  sfx.alarm();
  hud.objective('Dark Roteur est derrière toi !');
  m.say('roteur', 'Je te tiens, petit rigolo… BUUURP !', 3.5);
  hud.boss('DARK ROTEUR', 1);
  yield 2.5;
  m.roteurNear = true;
  hud.banner('IL TE VISE !', 2);
  yield 2.5;
  const faucon = makeFaucon();
  m.scene.add(faucon);
  sfx.takeoff();
  for (let k = 0; k < 1; k += 1 / 45) {
    faucon.position.set(-14 + 14 * k, H + 18 - 12 * k, m.z + 30 - 20 * k);
    faucon.rotation.set(0.2, Math.PI, -0.4 + k * 0.4);
    if (k > 0.5 && Math.random() < 0.5) m.shoot(faucon.position.x, faucon.position.y, faucon.position.z, (rot.x - faucon.position.x) * 3, (rot.y - faucon.position.y) * 3, (rot.o.position.z - faucon.position.z) * 3 - m.speed, false);
    yield 1 / 30;
  }
  m.say('hanpopo', 'YAHOUUU ! La voie est libre, gamin ! Tire et rentrons à la maison !', 4);
  rot.dead = true; rot.dying = 2.5; rot.spin = 9; rot.flyOff = 1;
  hud.boss(null);
  sfx.boom(); m.ctx.flash(0.4);
  for (let k = 0; k < 1; k += 1 / 60) {
    faucon.position.set(0 + 10 * k, H + 6 + 14 * k, m.z + 10 - 70 * k);
    yield 1 / 30;
  }
  m.scene.remove(faucon);
  m.camBack = false; m.autopilot = false;
  // le trou de la chasse d'eau
  m.guns = false;
  m.ctx.music('boss');
  hud.objective('Tire dans le trou de la chasse d\'eau quand le viseur est VERT !');
  m.say('gazou', 'Utilise le Gaz, Lucas. Le Gaz, sens-le…', 4);
  m.placeHole(230);
  yield () => m.won;
  hud.objective('');
  yield 0.8;
  hud.banner('CHASSE D\'EAU TIRÉE !', 3);
  // on remonte vers les étoiles pendant que la station se vide
  m.free = true; m.autopilot = true; m.camBack = true; // on se retourne pour voir la station se vider
  m.buildSurface();
  for (let k = 0; k < 1; k += 1 / 90) {
    p.y += 0.35; p.roll = -0.4;
    for (let i = 0; i < 3; i++) m.ctx.puffs.emit(rand(-90, 90), H, m.z + rand(-40, 160), pick([0x6fe04a, 0x9be36b, 0xc8f59a]), { vy: rand(10, 24), life: 1.6, s0: 2.5, s1: 8 });
    yield 1 / 30;
  }
  sfx.win();
  yield 1.5;
  m.result = { type: 'win' };
}
