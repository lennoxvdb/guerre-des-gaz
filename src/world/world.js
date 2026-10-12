// Les décors en 3D : le désert de Sablon (mission 1, à pied puis en vol) et le plateau des Rots (duel).
import * as THREE from 'three';
import { canvasTex, rng, toon, toonMat, TEX, flatSprite, standee, shadowBlob, screenYaw, glowSprite } from '../engine/gfx.js';

export const THEMES = {
  sablon: {
    sky: 0xf0c27a, sand: '#e6b86a', light: '#f6d79a', dark: '#c48a45', dot: 'rgba(120,70,30,.28)',
    rock: 0xc0703a, rock2: 0x9a5530, dune: 0xe8b866, hemi: [0xfff2dd, 0x8a5a30, 1.7], sun: [0xfff0d0, 2.3],
  },
  plateau: {
    sky: 0x4a2a5a, sand: '#9a7a9e', light: '#c49aa8', dark: '#6a4f78', dot: 'rgba(30,10,40,.3)',
    rock: 0x6e4a7e, rock2: 0x4e3458, dune: 0x8a6a92, hemi: [0xfff0ec, 0x5a3a60, 1.9], sun: [0xffd2b0, 2.3],
  },
};

function groundTexture(T, seed) {
  const R = rng(seed);
  return canvasTex(1024, 1024, (g, W) => {
    g.fillStyle = T.sand; g.fillRect(0, 0, W, W);
    const wrapDraw = (x, y, r, fn) => {
      for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) {
        if (x + dx + r < 0 || x + dx - r > W || y + dy + r < 0 || y + dy - r > W) continue;
        fn(x + dx, y + dy);
      }
    };
    const blob = (x, y, r, col, a) => wrapDraw(x, y, r, (X, Y) => {
      const c = new THREE.Color(col);
      const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`);
      gr.addColorStop(1, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, Math.PI * 2); g.fill();
    });
    for (let i = 0; i < 160; i++) blob(R() * W, R() * W, 60 + R() * 140, R() < 0.5 ? T.light : T.dark, 0.35);
    // rides du sable (vagues)
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = R() * W, y = R() * W, L = 40 + R() * 90;
      wrapDraw(x, y, L, (X, Y) => {
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(X - L / 2, Y); g.quadraticCurveTo(X, Y - 10, X + L / 2, Y); g.stroke();
        g.strokeStyle = 'rgba(80,40,10,.12)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(X - L / 2, Y + 4); g.quadraticCurveTo(X, Y - 6, X + L / 2, Y + 4); g.stroke();
      });
    }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = R() < 0.6 ? T.dot : 'rgba(255,255,255,.22)';
      g.beginPath(); g.arc(R() * W, R() * W, 0.8 + R() * 2, 0, Math.PI * 2); g.fill();
    }
  }, true);
}

// ---------- éléments du décor ----------
function rock(T, R, s) {
  const g = toon(new THREE.DodecahedronGeometry(1, 0), R() < 0.5 ? T.rock : T.rock2, { outline: 0.07 });
  g.scale.set(s * (0.8 + R() * 0.5), s * (0.6 + R() * 0.5), s * (0.8 + R() * 0.5));
  g.rotation.set(R() * 0.5, R() * 6, R() * 0.5);
  return g;
}
function plant(R) {
  const g = new THREE.Group();
  const h = 1.2 + R() * 1.2;
  const body = toon(new THREE.CapsuleGeometry(0.28, h, 4, 10), 0x4fa83a, { outline: 0.05 });
  body.position.y = h / 2 + 0.2; g.add(body);
  for (const s of [-1, 1]) {
    if (R() < 0.3) continue;
    const arm = toon(new THREE.CapsuleGeometry(0.18, 0.6, 4, 8), 0x4fa83a, { outline: 0.04 });
    arm.position.set(s * 0.45, h * 0.6, 0); arm.rotation.z = -s * 0.5; g.add(arm);
  }
  const fl = toon(new THREE.SphereGeometry(0.22, 10, 8), 0xff6ad5, { outline: 0.03 });
  fl.position.y = h + 0.55; g.add(fl);
  return g;
}
function dome(T, R, s) {
  const g = new THREE.Group();
  const d = toon(new THREE.SphereGeometry(2, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xf1d9a8, { outline: 0.08 });
  g.add(d);
  const door = toon(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16, 1, false, 0, Math.PI), 0x6b4a2a, { outline: 0.04 });
  door.rotation.set(Math.PI / 2, 0, 0); door.position.set(0, 0, 1.95); g.add(door);
  const top = toon(new THREE.CylinderGeometry(0.5, 0.6, 0.5, 14), 0xd6b886, { outline: 0.05 });
  top.position.y = 1.95; g.add(top);
  g.scale.setScalar(s);
  g.rotation.y = R() * 6;
  return g;
}
function dune(T, s) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toonMat(T.dune));
  m.scale.set(s, s * 0.28, s * 0.7);
  m.receiveShadow = true;
  return m;
}
function pillar(T, R) {
  const g = new THREE.Group();
  const n = 3 + (R() * 3 | 0);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const s = 1.3 - i * 0.15;
    const b = toon(new THREE.CylinderGeometry(s * 0.85, s, 1.1, 7), i % 2 ? T.rock : T.rock2, { outline: 0.07 });
    b.position.y = y + 0.55; b.rotation.y = R() * 3; g.add(b);
    y += 1.05;
  }
  return g;
}

export class World {
  constructor(scene, themeName = 'sablon') {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.T = THEMES[themeName];
    this.theme = themeName;
    this.obstacles = [];
    this.anim = [];
    const T = this.T;
    scene.background = new THREE.Color(T.sky);

    this.hemi = new THREE.HemisphereLight(...T.hemi);
    this.sun = new THREE.DirectionalLight(...T.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    this.group.add(this.hemi, this.sun, this.sun.target);

    const tex = groundTexture(T, themeName === 'sablon' ? 3 : 9);
    tex.repeat.set(16, 16);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: tex, gradientMap: null }));
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    this.tile = 320 / 16;

    if (themeName === 'sablon') this.buildSablon();
    else this.buildPlateau();
  }

  add(obj, x, z, r = 0) {
    obj.position.x = x; obj.position.z = z;
    this.group.add(obj);
    if (r) this.obstacles.push({ x, z, r });
    return obj;
  }

  // Le village de Lucas, le camp de la Rébellion, le chasseur-WC posé
  buildSablon() {
    const T = this.T, R = rng(11);
    // dunes tout autour : la limite du terrain
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, d = 34 + R() * 6;
      const m = dune(T, 7 + R() * 6); m.rotation.y = -a; this.add(m, Math.cos(a) * d, Math.sin(a) * d);
    }
    // maisons-dômes du village (au sud-est du départ)
    for (const [x, z, s] of [[10, 8, 1.2], [15, 3, 0.9], [6, 14, 1], [16, 12, 0.8]]) this.add(dome(T, R, s), x, z, 2.2 * s);
    // rochers et plantes
    const spots = [[-8, 6], [-14, -4], [4, -12], [-4, -18], [12, -10], [-18, 10], [20, -4], [-20, -14], [0, 20], [-10, 18], [22, 16], [-24, 2]];
    for (const [x, z] of spots) {
      const s = 1 + R() * 1.4;
      this.add(rock(T, R, s), x, z, s * 0.95);
      if (R() < 0.6) this.add(rock(T, R, s * 0.5), x + 1.6 + R(), z + R() * 2 - 1);
    }
    for (let i = 0; i < 14; i++) {
      const a = R() * 6.28, d = 6 + R() * 24;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.5)) continue;
      this.add(plant(R), x, z, 0.4);
    }
    // le camp : le Faucon Pétulant de Han Popo, posé, et les amis
    this.faucon = this.add(this.parkedShip('faucon', 7.5, 0.9), -12, 12, 3.3);
    this.friends = {};
    this.friends.han = this.add(standee(TEX.hanpopo, 2.4), -8.2, 10.2, 0.6);
    this.friends.pqr = this.add(standee(TEX.pqr, 2.6), -15.6, 9, 0.6);
    this.friends.r2 = this.add(standee(TEX.r2wc, 1.6), -9.5, 15.4, 0.6);
    this.friends.gazou = this.add(standee(TEX.gazou, 1.4), 3, 5, 0.5);
    // le chasseur-WC de Maître Gazou, posé au nord : on monte dedans en fin de mission
    this.wcSpot = new THREE.Vector3(-6, 0, -24);
    this.wc = this.add(this.parkedShip('wc', 4.2, 1.0), this.wcSpot.x, this.wcSpot.z, 1.8);
    this.wcBeacon = glowSprite(0x8fff5a, 6, 0);
    this.wcBeacon.position.set(this.wcSpot.x, 0.5, this.wcSpot.z);
    this.group.add(this.wcBeacon);
  }

  // Le plateau des Rots : roches violettes, colonnes, geysers de gaz, le soleil couchant
  buildPlateau() {
    const T = this.T, R = rng(23);
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2, d = 20 + R() * 3;
      this.add(pillar(T, R), Math.cos(a) * d, Math.sin(a) * d, 1.3);
    }
    for (let i = 0; i < 18; i++) {
      const a = R() * 6.28, d = 24 + R() * 10;
      this.add(rock(T, R, 1.5 + R() * 2), Math.cos(a) * d, Math.sin(a) * d);
    }
    for (const [x, z] of [[-9, -6], [8, 7], [10, -9], [-7, 10]]) this.add(rock(T, R, 1.1), x, z, 1.1);
    // geysers de gaz (décor qui fume)
    this.geysers = [];
    for (const [x, z] of [[-14, 0], [14, 2], [0, -15], [2, 14]]) {
      const g = toon(new THREE.CylinderGeometry(0.9, 1.3, 0.5, 12), 0x3e2848, { outline: 0.06 });
      this.add(g, x, z, 1.1);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fff5a }));
      hole.position.set(x, 0.27, z); this.group.add(hole);
      this.geysers.push(new THREE.Vector3(x, 0.4, z));
    }
    // le vaisseau de Dark Roteur, posé au loin
    this.add(this.parkedShip('ventouse', 6, 1.2), -2, -26, 0);
  }

  parkedShip(key, width, alt) {
    const g = new THREE.Group();
    const s = flatSprite(TEX[key], width);
    s.position.y = alt; s.rotation.y = screenYaw(0);
    g.add(s);
    const sh = shadowBlob(width * 1.1); sh.position.y = 0.03; g.add(sh);
    g.userData.sprite = s;
    return g;
  }

  // les ombres suivent le héros (ou le vaisseau)
  follow(p) {
    this.sun.position.set(p.x - 18, 40, p.z - 8);
    this.sun.target.position.set(p.x, 0, p.z);
    // le sol infini : on le décale par carreaux entiers, le dessin ne bouge pas
    this.ground.position.x = Math.round(p.x / this.tile) * this.tile;
    this.ground.position.z = Math.round(p.z / this.tile) * this.tile;
  }

  update(dt, t) {
    if (this.wcBeacon) this.wcBeacon.material.opacity = this.beaconOn ? 0.35 + 0.25 * Math.sin(t * 5) : 0;
    if (this.wc && this.wc.userData.sprite) this.wc.userData.sprite.position.y = (this.wcLift ?? 1.0) + Math.sin(t * 2) * 0.08;
  }

  dispose() { this.scene.remove(this.group); }
}

// ---------- le décor qui défile pendant le vol (au-dessus du désert) ----------
export function flightDecor(T, R) {
  const k = R();
  if (k < 0.45) return rock(T, R, 1 + R() * 2);
  if (k < 0.7) return plant(R);
  if (k < 0.85) return dome(T, R, 0.8 + R() * 0.5);
  return dune(T, 5 + R() * 5);
}
