// Le sabre-gaz que le joueur fabrique lui-même dans l'atelier (écran « Mon sabre »).
// Couleur de la lame, manche, forme, effet et bruit ; certaines pièces se gagnent en finissant des missions.
import * as THREE from 'three';
import { outlineGeo, outlineMat, toonMat } from '../engine/gfx.js';

// need = nombre de missions gagnées pour débloquer la pièce
export const SABRE = {
  couleur: [
    { id: 'vert', nom: 'Vert prout', c: 0x8fff5a, core: 0xeaffd8 },
    { id: 'bleu', nom: 'Bleu', c: 0x4fb3ff, core: 0xe2f3ff },
    { id: 'jaune', nom: 'Jaune pipi', c: 0xffe03a, core: 0xfffbe0 },
    { id: 'rose', nom: 'Rose bonbon', c: 0xff6ad5, core: 0xffe6f8 },
    { id: 'orange', nom: 'Orange', c: 0xff8a2a, core: 0xfff0dc },
    { id: 'violet', nom: 'Violet', c: 0xb04cff, core: 0xf3dcff, need: 1 },
    { id: 'blanc', nom: 'Blanc neige', c: 0xd8f4ff, core: 0xffffff, need: 2 },
    { id: 'rouge', nom: 'Rouge', c: 0xff3a3a, core: 0xffe0dc, need: 3 },
    { id: 'arc', nom: 'Arc-en-ciel', c: 0xff6ad5, core: 0xffffff, need: 4 },
  ],
  manche: [
    { id: 'classique', nom: 'Classique', ico: '🔦' },
    { id: 'ventouse', nom: 'Ventouse', ico: '🪠' },
    { id: 'brosse', nom: 'Brosse à WC', ico: '🚽' },
    { id: 'pq', nom: 'Rouleau de PQ', ico: '🧻', need: 1 },
    { id: 'soda', nom: 'Bouteille de soda', ico: '🍾', need: 2 },
    { id: 'saucisse', nom: 'Saucisse', ico: '🌭', need: 3 },
    { id: 'or', nom: 'Manche en or', ico: '👑', need: 6 },
  ],
  forme: [
    { id: 'simple', nom: 'Une lame', ico: '🗡️' },
    { id: 'double', nom: 'Double lame', ico: '⚔️', need: 2 },
    { id: 'garde', nom: 'Avec garde', ico: '✝️', need: 3 },
    { id: 'geant', nom: 'Géant', ico: '📏', need: 5 },
  ],
  effet: [
    { id: 'rien', nom: 'Rien', ico: '✖️' },
    { id: 'prout', nom: 'Nuage de prout', ico: '💨' },
    { id: 'bulles', nom: 'Bulles', ico: '🫧' },
    { id: 'etincelles', nom: 'Étincelles', ico: '✨', need: 1 },
    { id: 'arc', nom: 'Paillettes arc-en-ciel', ico: '🌈', need: 4 },
  ],
  son: [
    { id: 'classique', nom: 'Vvvwoom', ico: '🔊' },
    { id: 'prout', nom: 'Prout', ico: '💨' },
    { id: 'rot', nom: 'Rot', ico: '😮' },
    { id: 'pouet', nom: 'Pouet', ico: '🎺' },
    { id: 'bulle', nom: 'Bloup', ico: '🫧' },
  ],
};
export const SABRE_DEFAUT = { couleur: 'vert', manche: 'classique', forme: 'simple', effet: 'rien', son: 'classique', nom: '' };

export function loadSabre() {
  const s = { ...SABRE_DEFAUT };
  try { Object.assign(s, JSON.parse(localStorage.getItem('gdg_sabre') || '{}')); } catch { /* rien */ }
  return s;
}
export function saveSabre(s) { try { localStorage.setItem('gdg_sabre', JSON.stringify(s)); } catch { /* rien */ } }
export const pick = (kind, id) => SABRE[kind].find((x) => x.id === id) || SABRE[kind][0];

// où vont les particules des effets (les fumées et lueurs du jeu, données par main.js)
let sink = null;
export function setSabreSink(s) { sink = s; }

function part(geo, color, x, y, z, { rx = 0, rz = 0, outline = 0.015, emissive = 0 } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, toonMat(color, emissive));
  m.castShadow = true;
  g.add(m);
  if (outline) g.add(new THREE.Mesh(outlineGeo(geo, outline), outlineMat));
  g.position.set(x, y, z); g.rotation.set(rx, 0, rz);
  return g;
}

// ---------- les manches (la lame sort en haut, vers +y ; la main tient autour de y = 0) ----------
function hilt(id) {
  const g = new THREE.Group();
  const C = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 12);
  if (id === 'ventouse') {
    g.add(part(C(0.05, 0.05, 0.42), 0xb07a45, 0, 0, 0));
    g.add(part(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8343a, 0, -0.2, 0, { rx: Math.PI, outline: 0.02 }));
    g.add(part(C(0.08, 0.08, 0.05), 0x8d8f99, 0, 0.19, 0));
  } else if (id === 'brosse') {
    g.add(part(C(0.045, 0.05, 0.4), 0xf4f4f0, 0, 0, 0));
    g.add(part(C(0.12, 0.12, 0.16), 0x5fc8ff, 0, -0.26, 0, { outline: 0.02 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(part(new THREE.ConeGeometry(0.035, 0.1, 5), 0x5fc8ff, Math.cos(a) * 0.13, -0.26, Math.sin(a) * 0.13, { rz: -Math.cos(a) * 1.5, rx: Math.sin(a) * 1.5, outline: 0 }));
    }
    g.add(part(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x5fc8ff, 0, -0.34, 0, { outline: 0.015 }));
    g.add(part(C(0.075, 0.075, 0.05), 0x8d8f99, 0, 0.19, 0));
  } else if (id === 'pq') {
    g.add(part(C(0.13, 0.13, 0.3), 0xfbfbf6, 0, -0.02, 0, { outline: 0.02 }));
    g.add(part(C(0.05, 0.05, 0.31), 0xb98a52, 0, -0.02, 0, { outline: 0 }));
    g.add(part(new THREE.BoxGeometry(0.2, 0.32, 0.012), 0xfbfbf6, 0.08, -0.25, 0.12, { rz: 0.2, outline: 0.01 }));
    g.add(part(C(0.08, 0.08, 0.06), 0x8d8f99, 0, 0.16, 0));
  } else if (id === 'soda') {
    g.add(part(C(0.1, 0.1, 0.3), 0x3fbf5a, 0, -0.05, 0, { outline: 0.02 }));
    g.add(part(C(0.102, 0.102, 0.1), 0xff4a3a, 0, -0.04, 0, { outline: 0 }));
    g.add(part(new THREE.ConeGeometry(0.1, 0.12, 12), 0x3fbf5a, 0, 0.16, 0));
    g.add(part(C(0.06, 0.06, 0.06), 0xffd23f, 0, 0.23, 0));
  } else if (id === 'saucisse') {
    g.add(part(new THREE.CapsuleGeometry(0.08, 0.32, 4, 10), 0xc8643a, 0, 0, 0, { outline: 0.02 }));
    for (const y of [-0.26, 0.26]) g.add(part(new THREE.SphereGeometry(0.03, 6, 5), 0xf4e1b0, 0, y, 0, { outline: 0 }));
    g.add(part(new THREE.BoxGeometry(0.03, 0.3, 0.03), 0xffd23f, 0.075, 0, 0, { outline: 0 }));
  } else {
    const gold = id === 'or';
    g.add(part(C(0.06, 0.07, 0.34), gold ? 0xffd23f : 0x8d8f99, 0, 0, 0, { emissive: gold ? 0x8a6a10 : 0 }));
    g.add(part(C(0.09, 0.09, 0.06), gold ? 0xb08a10 : 0x3a3a44, 0, 0.17, 0));
    g.add(part(C(0.075, 0.075, 0.05), gold ? 0xb08a10 : 0x3a3a44, 0, -0.12, 0));
    if (gold) g.add(part(new THREE.OctahedronGeometry(0.07), 0xb04cff, 0, -0.2, 0, { emissive: 0x6a2f8f }));
  }
  return g;
}

// une lame : coeur blanc + deux halos de couleur
function blade(L, r, mats) {
  const b = new THREE.Group();
  const coreM = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * r, L, 4, 10), mats.core);
  const glowM = new THREE.Mesh(new THREE.CapsuleGeometry(0.12 * r, L + 0.05, 4, 12), mats.glow);
  const glow2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.22 * r, L + 0.1, 4, 12), mats.glow2);
  for (const m of [coreM, glowM, glow2]) { m.position.y = L / 2; b.add(m); }
  return b;
}

// le sabre complet, avec la même « poignée » d'infos que makeSaber (blade, tip, base) pour le reste du jeu
export function makeCustomSaber(cfg = loadSabre()) {
  const col = pick('couleur', cfg.couleur), forme = pick('forme', cfg.forme).id;
  const g = new THREE.Group();
  g.add(hilt(pick('manche', cfg.manche).id));
  const colorNow = new THREE.Color(col.c);
  const mats = {
    core: new THREE.MeshBasicMaterial({ color: col.core }),
    glow: new THREE.MeshBasicMaterial({ color: col.c, transparent: true, opacity: 0.75, depthWrite: false }),
    glow2: new THREE.MeshBasicMaterial({ color: col.c, transparent: true, opacity: 0.25, depthWrite: false }),
  };
  const geant = forme === 'geant';
  const L = geant ? 2.0 : 1.35, top = pick('manche', cfg.manche).id === 'soda' ? 0.26 : 0.2;
  const main = blade(L, geant ? 1.25 : 1, mats);
  main.position.y = top;
  g.add(main);
  const blades = [main];
  if (forme === 'double') {
    const b2 = blade(L, 1, mats); b2.rotation.x = Math.PI; b2.position.y = -0.22; g.add(b2); blades.push(b2);
  } else if (forme === 'garde') {
    for (const s of [-1, 1]) { const b = blade(0.32, 0.7, mats); b.rotation.z = -s * Math.PI / 2; b.position.set(s * 0.06, 0.12, 0); g.add(b); blades.push(b); }
  }
  const tip = new THREE.Object3D(); tip.position.y = top + L + 0.05; g.add(tip);
  const base = new THREE.Object3D(); base.position.y = 0.3; g.add(base);
  const fx = pick('effet', cfg.effet).id, rainbow = col.id === 'arc';
  let t = 0, on = 0;
  const last = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3(), tmp = new THREE.Color();
  let ready = false;
  // à chaque image : arc-en-ciel qui défile, et les particules quand la lame bouge vite
  const anim = (dt) => {
    t += dt;
    if (rainbow) {
      colorNow.setHSL((t * 0.35) % 1, 1, 0.62);
      mats.glow.color.copy(colorNow); mats.glow2.color.copy(colorNow);
    }
    if (fx === 'rien' || !sink || on < 0.9 || dt <= 0) return;
    tip.getWorldPosition(p);
    if (!ready) { last.copy(p); ready = true; return; }
    const speed = p.distanceTo(last) / dt;
    last.copy(p);
    if (speed < 7) return;
    base.getWorldPosition(q);
    const n = Math.min(3, Math.floor(speed / 8));
    for (let i = 0; i < n; i++) {
      const k = 0.35 + Math.random() * 0.65;
      const x = q.x + (p.x - q.x) * k, y = q.y + (p.y - q.y) * k, z = q.z + (p.z - q.z) * k;
      if (fx === 'prout') sink.puffs.emit(x, y, z, Math.random() < 0.5 ? 0x9be36b : 0xc8f59a, { vy: 0.6, life: 0.6, s0: 0.25, s1: 0.9, alpha: 0.7 });
      else if (fx === 'bulles') sink.glows.emit(x, y, z, 0xcff4ff, { vx: (Math.random() - 0.5), vy: 1.2 + Math.random(), vz: (Math.random() - 0.5), life: 0.9, s0: 0.22, s1: 0.32, alpha: 0.75, drag: 0.5 });
      else if (fx === 'etincelles') sink.glows.emit(x, y, z, rainbow ? colorNow.getHex() : col.c, { vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 6, life: 0.35, s0: 0.25, s1: 0.05, grav: 9 });
      else if (fx === 'arc') sink.glows.emit(x, y, z, tmp.setHSL(Math.random(), 1, 0.6).getHex(), { vx: (Math.random() - 0.5) * 2, vy: 0.5 + Math.random(), vz: (Math.random() - 0.5) * 2, life: 0.7, s0: 0.3, s1: 0.08 });
    }
  };
  g.userData = {
    blade: main, blades, tip, base, color: col.c, glowM: main.children[1], glow2: main.children[2],
    trailColor: colorNow, anim, setOn: (k) => { on = k; },
  };
  return g;
}
