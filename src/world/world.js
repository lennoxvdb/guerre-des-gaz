// Les décors en 3D : désert de Sablon, plateau des Rots, marais de Gazouland, cité des nuages,
// intérieur de l'Étoile Puante, et l'espace (pour le vol).
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
  marais: {
    sky: 0x5f7f5a, sand: '#6f8a3e', light: '#93ad55', dark: '#4a6128', dot: 'rgba(20,40,10,.3)',
    rock: 0x6a7048, rock2: 0x4a5236, dune: 0x55702e, hemi: [0xf0ffe0, 0x3a4a2a, 1.7], sun: [0xfff0c0, 2.0],
  },
  nuages: {
    sky: 0x9fd6ff, sand: '#eef5ff', light: '#ffffff', dark: '#c9dcf2', dot: 'rgba(150,180,220,.22)',
    rock: 0xf2f2f6, rock2: 0xd88a4a, dune: 0xffffff, hemi: [0xffffff, 0xa8c4e4, 1.8], sun: [0xfff4e0, 2.1],
  },
  station: {
    sky: 0x1a1426, sand: '#56526a', light: '#6e6a84', dark: '#3c384e', dot: 'rgba(0,0,0,.2)',
    rock: 0x5a5070, rock2: 0x3a3248, dune: 0x4a4458, hemi: [0xe8eaff, 0x2a2238, 1.7], sun: [0xe0d4ff, 2.1],
  },
  espace: {
    sky: 0x0b0820, sand: '#0b0820', light: '#1a1440', dark: '#05040f', dot: 'rgba(255,255,255,.5)',
    rock: 0x7a5a3a, rock2: 0x5a4030, dune: 0x3a2a50, hemi: [0xe0e0ff, 0x302040, 1.8], sun: [0xffffff, 2.2],
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

// plaques de métal de la station (rivets, bandes jaunes et noires)
function metalTexture(T) {
  return canvasTex(512, 512, (g, W) => {
    g.fillStyle = T.sand; g.fillRect(0, 0, W, W);
    const n = 4, c = W / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? T.light : T.sand;
      g.fillRect(i * c + 3, j * c + 3, c - 6, c - 6);
      g.fillStyle = 'rgba(0,0,0,.35)';
      for (const [x, y] of [[10, 10], [c - 10, 10], [10, c - 10], [c - 10, c - 10]]) { g.beginPath(); g.arc(i * c + x, j * c + y, 3.5, 0, 6.3); g.fill(); }
    }
    g.strokeStyle = T.dark; g.lineWidth = 6;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, W); g.stroke(); g.beginPath(); g.moveTo(0, i * c); g.lineTo(W, i * c); g.stroke(); }
    // bande de sécurité
    for (let x = -W; x < W * 2; x += 40) { g.fillStyle = (x / 40) % 2 ? '#ffd23f' : '#2a2232'; g.beginPath(); g.moveTo(x, W / 2 - 14); g.lineTo(x + 40, W / 2 - 14); g.lineTo(x + 26, W / 2 + 14); g.lineTo(x - 14, W / 2 + 14); g.fill(); }
  }, true);
}
// l'espace : étoiles et nuages de gaz verts et violets (très loin sous le vaisseau)
function spaceTexture() {
  const R = rng(5);
  return canvasTex(1024, 1024, (g, W) => {
    g.fillStyle = '#0b0820'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 26; i++) {
      const x = R() * W, y = R() * W, r = 80 + R() * 200, col = ['120,255,90', '170,80,255', '90,200,255'][i % 3];
      for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, `rgba(${col},.22)`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, W, W);
      }
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; const s = R() < 0.92 ? 1.5 : 3; g.fillRect(R() * W, R() * W, s, s); }
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

function swampTree(R, s) {
  const g = new THREE.Group();
  const trunk = toon(new THREE.CylinderGeometry(0.45, 0.8, 4, 9), 0x5a4030, { outline: 0.06 });
  trunk.position.y = 2; trunk.rotation.z = (R() - 0.5) * 0.3; g.add(trunk);
  for (const [x, y, z, r] of [[0, 4.4, 0, 1.8], [1.2, 3.9, 0.4, 1.3], [-1.1, 4.0, -0.3, 1.4], [0.2, 5.2, 0.3, 1.2]]) {
    const c = toon(new THREE.SphereGeometry(r, 12, 9), R() < 0.5 ? 0x4f8a32 : 0x3f7a2a, { outline: 0.06 });
    c.position.set(x, y, z); g.add(c);
  }
  // racines et lianes
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + R();
    const r = toon(new THREE.CylinderGeometry(0.12, 0.22, 1.4, 6), 0x5a4030, { outline: 0.03 });
    r.position.set(Math.cos(a) * 0.8, 0.4, Math.sin(a) * 0.8); r.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); g.add(r);
  }
  g.scale.setScalar(s); g.rotation.y = R() * 6;
  return g;
}
function mushroom(R, s) {
  const g = new THREE.Group();
  const stem = toon(new THREE.CylinderGeometry(0.35, 0.5, 2, 10), 0xf2e8d0, { outline: 0.05 }); stem.position.y = 1; g.add(stem);
  const cap = toon(new THREE.SphereGeometry(1.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8343a, { outline: 0.06 }); cap.position.y = 1.9; g.add(cap);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + R();
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toonMat(0xffffff));
    d.position.set(Math.cos(a) * 0.9, 2.65, Math.sin(a) * 0.9); g.add(d);
  }
  g.scale.setScalar(s);
  return g;
}
function reeds(R) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const h = 0.9 + R();
    const r = toon(new THREE.CylinderGeometry(0.05, 0.07, h, 5), 0x6a8a3a, { outline: 0.02 });
    r.position.set((R() - 0.5) * 0.8, h / 2, (R() - 0.5) * 0.8); r.rotation.z = (R() - 0.5) * 0.4; g.add(r);
    const top = toon(new THREE.CapsuleGeometry(0.1, 0.3, 3, 6), 0x7a4a22, { outline: 0.02 }); top.position.set(r.position.x, h, r.position.z); g.add(top);
  }
  return g;
}
function hut() {
  const g = new THREE.Group();
  const d = toon(new THREE.SphereGeometry(2.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a6a3a, { outline: 0.07 }); g.add(d);
  const roof = toon(new THREE.ConeGeometry(1.2, 1.4, 10), 0x5a7a2a, { outline: 0.05 }); roof.position.y = 2.6; g.add(roof);
  const door = toon(new THREE.CircleGeometry(0.7, 16), 0x3a2414, { outline: 0 }); door.position.set(0, 0.7, 2.18); g.add(door);
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f })); win.position.set(1.2, 1.3, 1.75); win.rotation.y = 0.6; g.add(win);
  return g;
}
function cloudTower(h) {
  const g = new THREE.Group();
  const t = toon(new THREE.CylinderGeometry(1.1, 1.4, h, 14), 0xf4f0ea, { outline: 0.07 }); t.position.y = h / 2; g.add(t);
  const top = toon(new THREE.SphereGeometry(1.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xff9a3a, { outline: 0.06 }); top.position.y = h; g.add(top);
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0x5ab0ff }));
    w.position.set(0, h * (0.35 + i * 0.2), 1.25); g.add(w);
  }
  return g;
}
function cloudDome(R) {
  const g = toon(new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), R() < 0.5 ? 0xffffff : 0xffe8c8, { outline: 0.06 });
  return g;
}
function cloudPuff(R, s) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), toonMat(0xffffff));
    b.position.set((R() - 0.5) * 2.5, (R() - 0.5) * 0.6, (R() - 0.5) * 1.5); b.scale.setScalar(0.7 + R() * 0.6); g.add(b);
  }
  g.scale.setScalar(s); g.position.y = -1;
  return g;
}
function gasVat() {
  const g = new THREE.Group();
  const c = toon(new THREE.CylinderGeometry(1.2, 1.3, 3, 14), 0x6e6680, { outline: 0.07 }); c.position.y = 1.5; g.add(c);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.2, 14), new THREE.MeshBasicMaterial({ color: 0x8fff5a, transparent: true, opacity: 0.8 }));
  glass.position.y = 1.7; g.add(glass);
  const top = toon(new THREE.CylinderGeometry(0.6, 1.25, 0.5, 14), 0x4a4458, { outline: 0.05 }); top.position.y = 3.2; g.add(top);
  return g;
}
function pipeColumn() {
  const g = new THREE.Group();
  const p = toon(new THREE.CylinderGeometry(0.8, 0.8, 6, 12), 0x8a7aa8, { outline: 0.07 }); p.position.y = 3; g.add(p);
  for (const y of [1, 3, 5]) { const r = toon(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 12), 0x5a3a86, { outline: 0.04 }); r.position.y = y; g.add(r); }
  return g;
}
function toilet3d() {
  const g = new THREE.Group();
  const bowl = toon(new THREE.CylinderGeometry(1.4, 0.9, 1.4, 18), 0xf4f4f8, { outline: 0.07 }); bowl.position.y = 0.7; g.add(bowl);
  const seat = toon(new THREE.TorusGeometry(1.25, 0.22, 8, 24).rotateX(Math.PI / 2), 0xe8e4f0, { outline: 0.04 }); seat.position.y = 1.45; g.add(seat);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fff5a })); water.position.y = 1.35; g.add(water);
  const tank = toon(new THREE.BoxGeometry(2.2, 2.2, 0.9), 0xf4f4f8, { outline: 0.07 }); tank.position.set(0, 1.8, -1.4); g.add(tank);
  const btn = toon(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), 0xd8343a, { outline: 0.03 }); btn.position.set(0, 2.95, -1.4); g.add(btn);
  return g;
}
function crate(R) {
  const g = toon(new THREE.BoxGeometry(1.5, 1.5, 1.5), R() < 0.5 ? 0x8a5ab0 : 0x6e6680, { outline: 0.06 });
  g.position.y = 0.75; g.rotation.y = R() * 3;
  const w = new THREE.Group(); w.add(g);
  return w;
}
function throne() {
  const g = new THREE.Group();
  const base = toon(new THREE.CylinderGeometry(2.6, 3, 0.8, 20), 0x3a2848, { outline: 0.07 }); base.position.y = 0.4; g.add(base);
  const seat = toon(new THREE.BoxGeometry(2.2, 1.2, 1.8), 0x5a3a86, { outline: 0.06 }); seat.position.y = 1.4; g.add(seat);
  const back = toon(new THREE.BoxGeometry(2.4, 3.6, 0.6), 0x5a3a86, { outline: 0.06 }); back.position.set(0, 2.6, -0.9); g.add(back);
  for (const s of [-1, 1]) { const sp = toon(new THREE.ConeGeometry(0.3, 1, 8), 0xffd23f, { outline: 0.03 }); sp.position.set(s * 1, 4.8, -0.9); g.add(sp); }
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

    this.space = themeName === 'espace';
    const tex = themeName === 'station' ? metalTexture(T) : this.space ? spaceTexture() : groundTexture(T, { sablon: 3, plateau: 9, marais: 13, nuages: 17 }[themeName]);
    const reps = themeName === 'station' ? 40 : this.space ? 6 : 16;
    tex.repeat.set(reps, reps);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2),
      this.space ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshToonMaterial({ map: tex, gradientMap: null }));
    this.ground.receiveShadow = !this.space;
    if (this.space) this.ground.position.y = -40; // l'espace est loin en dessous
    this.group.add(this.ground);
    this.tile = 320 / reps;

    ({ sablon: () => this.buildSablon(), plateau: () => this.buildPlateau(), marais: () => this.buildMarais(),
      nuages: () => this.buildNuages(), station: () => this.buildStation(), espace: () => {} })[themeName]();
  }

  // h : hauteur de l'obstacle (avec le jetpack, Lucas vole au-dessus de ce qui est bas)
  add(obj, x, z, r = 0, h = 9) {
    obj.position.x = x; obj.position.z = z;
    this.group.add(obj);
    if (r) this.obstacles.push({ x, z, r, h });
    return obj;
  }

  // ---------- les marais de Gazouland (chez Maître Gazou) ----------
  buildMarais() {
    const T = this.T, R = rng(31);
    // arbres tordus tout autour : la limite du terrain
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * Math.PI * 2, d = 27 + R() * 5;
      this.add(swampTree(R, 1.2 + R() * 0.6), Math.cos(a) * d, Math.sin(a) * d, 1.4);
    }
    for (const [x, z, s] of [[-10, -6, 1], [9, -12, 1.1], [14, 6, 0.9], [-15, 9, 1], [4, 15, 0.8], [-4, -17, 1]]) this.add(swampTree(R, s), x, z, 1.1 * s);
    // mares d'eau verte (on peut marcher autour)
    for (const [x, z, r] of [[-6, 4, 2.6], [7, -4, 2], [-12, -12, 3], [12, 13, 2.4], [0, -9, 1.8]]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3f6a4a, transparent: true, opacity: 0.85 }));
      m.position.set(x, 0.03, z); this.group.add(m);
      const shine = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r * 0.62, 28, 1, 0.5, 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfe8c8 }));
      shine.position.set(x, 0.05, z); this.group.add(shine);
    }
    // champignons géants, rochers moussus, roseaux
    for (const [x, z, s] of [[-17, -2, 1.3], [16, -6, 1], [2, 20, 1.2], [-20, 14, 0.9], [10, 21, 1], [19, 16, 1.1]]) this.add(mushroom(R, s), x, z, 0.9 * s);
    for (let i = 0; i < 12; i++) {
      const a = R() * 6.28, d = 8 + R() * 16, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2)) continue;
      const k = R() < 0.5;
      this.add(k ? rock(T, R, 0.8 + R()) : reeds(R), x, z, k ? 0.8 : 0, k ? 1.2 : 0);
    }
    // la cabane de Maître Gazou et ses amis
    this.add(hut(), -3, 13, 2.4);
    this.friends = { gazou: this.add(standee(TEX.gazou, 1.4), 0.5, 10.5, 0.5), r2: this.add(standee(TEX.r2wc, 1.6), -6, 10, 0.6) };
    this.add(this.parkedShip('wc', 4.2, 1.0), 9, 9, 1.8);
  }

  // ---------- la cité des nuages (mission au jetpack) ----------
  buildNuages() {
    const T = this.T, R = rng(41);
    // plateformes de la ville, posées sur les nuages
    for (const [x, z, r] of [[0, 0, 9], [-16, -10, 6], [15, -12, 6.5], [-14, 14, 6], [16, 13, 5.5], [0, -24, 6], [-26, 2, 5], [26, 0, 5]]) {
      const pf = toon(new THREE.CylinderGeometry(r, r * 0.8, 1.2, 36), 0xf4f0ea, { outline: 0.08 });
      pf.position.y = -0.4; this.add(pf, x, z);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, 40).rotateX(Math.PI / 2), toonMat(0xff9a3a));
      trim.position.set(x, 0.2, z); this.group.add(trim);
    }
    // tours (hautes : on ne passe pas au-dessus) et petits dômes (on les survole)
    for (const [x, z, h] of [[-5, -5, 7], [6, 4, 8], [-18, -14, 6], [18, -9, 7], [-11, 18, 6], [19, 16, 5], [3, -26, 7]]) this.add(cloudTower(h), x, z, 1.5, h);
    for (const [x, z] of [[4, -4], [-6, 5], [-14, -7], [13, -15], [-17, 12], [14, 11], [-3, -22], [-24, 4], [24, -3]]) this.add(cloudDome(R), x, z, 1.6, 1.5);
    // nuages qui flottent autour (décor)
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2, d = 34 + R() * 8;
      this.add(cloudPuff(R, 3 + R() * 3), Math.cos(a) * d, Math.sin(a) * d, 0);
    }
    // le Faucon de Han Popo, posé (il a été capturé)
    this.add(this.parkedShip('faucon', 7, 0.9), 22, 22, 0);
  }

  // ---------- l'intérieur de l'Étoile Puante ----------
  buildStation() {
    const T = this.T, R = rng(51);
    // grands tuyaux et piliers tout autour : la limite de la salle
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2, d = 24;
      this.add(i % 2 ? pipeColumn() : gasVat(), Math.cos(a) * d, Math.sin(a) * d, 1.6);
    }
    // cuves de gaz vert, caisses, et des toilettes géantes (c'est l'Étoile Puante !)
    for (const [x, z] of [[-9, -8], [9, -9], [-10, 8], [10, 9]]) this.add(gasVat(), x, z, 1.4);
    for (const [x, z, ry] of [[-15, 0, 1.5], [15, 1, -1.5], [0, 15, 3.1]]) { const t = toilet3d(); t.rotation.y = ry; this.add(t, x, z, 1.8); }
    for (let i = 0; i < 8; i++) {
      const a = R() * 6.28, d = 12 + R() * 8, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2)) continue;
      this.add(crate(R), x, z, 0.9);
    }
    // le trône de Dark Roteur, au nord
    this.add(throne(), 0, -19, 2.2);
    // lumières de la salle
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const l = glowSprite(i % 2 ? 0x8fff5a : 0xb04cff, 5, 0.35); l.position.set(Math.cos(a) * 21, 0.2, Math.sin(a) * 21); this.group.add(l);
    }
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
