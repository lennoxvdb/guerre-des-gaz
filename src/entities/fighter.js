// Les combattants en 3D animée : Lucas (sabre-gaz vert), les soldats de Dark Roteur, Dark Roteur.
// Un seul modèle (« Knight » du KayKit Adventurers Pack, CC0) repeint et équipé dans le code.
import * as THREE from 'three';
import { GLTFLoader } from '../../lib/GLTFLoader.js';
import { clone as skeletonClone } from '../../lib/SkeletonUtils.js';
import { gradMap, outlineGeo, outlineMat, toonMat } from '../engine/gfx.js';

let gltf = null, clips = null;
export async function loadKnight() {
  gltf = await new Promise((res, rej) => new GLTFLoader().load('assets/3d/trooper.glb', res, undefined, rej));
  clips = {};
  for (const c of gltf.animations) clips[c.name] = c;
}

// ---------- peinture : chaque couleur du modèle d'origine est remplacée ----------
const lin = (hex) => new THREE.Color(hex); // Color() convertit déjà en couleurs linéaires
const PAINT = {
  // armure grise → combinaison blanche, tissu rouge → vert, doré → vert clair
  lucas: { grey: lin(0xf2f4ee), red: lin(0x2f9e35), gold: lin(0x8fdc3c), skin: null },
  soldat: { grey: lin(0x8a7aa3), red: lin(0x4b3466), gold: lin(0xc9b6e6), skin: lin(0x6a5c80) },
  roteur: { grey: lin(0x3a2d4d), red: lin(0x6a2f8f), gold: lin(0x8fdc3c), skin: lin(0x2e2a33) },
};
const RECOLOR = `
uniform vec3 uGrey; uniform vec3 uRed; uniform vec3 uGold; uniform vec3 uSkin; uniform float uSkinOn; uniform float uFlash;`;
// une peinture par combattant (même programme pour tous, mais chacun son flash blanc)
function paintMaterial(kind, map) {
  const P = PAINT[kind];
  const m = new THREE.MeshToonMaterial({ map, gradientMap: gradMap });
  m.userData.uFlash = { value: 0 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uGrey: { value: P.grey }, uRed: { value: P.red }, uGold: { value: P.gold },
      uSkin: { value: P.skin || new THREE.Color() }, uSkinOn: { value: P.skin ? 1 : 0 }, uFlash: m.userData.uFlash,
    });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RECOLOR)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
          float lum = dot(c, vec3(0.3, 0.59, 0.11));
          if (sat < 0.25) diffuseColor.rgb = uGrey * (0.45 + lum * 1.3);
          else if (c.r > c.g * 4.0 && c.r > c.b * 2.0) diffuseColor.rgb = uRed * (0.5 + mx * 0.8);
          else if (c.b < c.g * 0.35 && c.g > c.r * 0.45) diffuseColor.rgb = uGold * (0.55 + mx * 0.6);
          else if (uSkinOn > 0.5 && c.r > c.g && c.g > c.b && c.b > c.g * 0.4) diffuseColor.rgb = uSkin * (0.6 + lum * 1.2);
        }`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uFlash);');
  };
  m.customProgramCacheKey = () => 'paint_' + kind;
  return m;
}

function part(geo, color, x, y, z, { rx = 0, ry = 0, rz = 0, outline = 0.025, emissive = 0 } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, toonMat(color, emissive));
  m.castShadow = true;
  g.add(m);
  if (outline) g.add(new THREE.Mesh(outlineGeo(geo, outline), outlineMat));
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  return g;
}

// ---------- équipement ----------
function lucasHair() {
  const g = new THREE.Group();
  // calotte de cheveux assez grande pour couvrir tout le crâne (sinon la peau dépasse sur le dessus)
  g.add(part(new THREE.SphereGeometry(0.75, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.54), 0x7a4a22, 0, 0.36, -0.02, { rx: -0.32, outline: 0.03 }));
  // mèches en pointe qui dépassent de la calotte (devant, sur les côtés, derrière)
  for (const [x, y, z, rx, rz] of [[-0.36, 0.72, 0.5, 1.2, 0.5], [-0.05, 0.8, 0.58, 1.4, 0.1], [0.3, 0.74, 0.52, 1.3, -0.4],
    [0.62, 0.56, 0.18, 0.6, -1.1], [-0.64, 0.52, 0.12, 0.5, 1.1], [0.1, 0.92, -0.25, -0.7, -0.2], [-0.2, 0.86, -0.4, -1.0, 0.3]]) {
    g.add(part(new THREE.ConeGeometry(0.17, 0.46, 6), 0x7a4a22, x, y, z, { rx, rz, outline: 0.02 }));
  }
  return g;
}
function soldierHelmet() {
  const g = new THREE.Group();
  // gros casque rond de scaphandrier
  g.add(part(new THREE.SphereGeometry(0.78, 22, 16), 0x8f7fb0, 0, 0.42, 0, { outline: 0.035 }));
  // masque à gaz : deux gros yeux verts et un filtre
  for (const s of [-1, 1]) g.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), 0x6cff6a, s * 0.27, 0.5, 0.68, { rx: Math.PI / 2, emissive: 0x2a8a20 }));
  g.add(part(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 14), 0x4b4256, 0, 0.12, 0.72, { rx: Math.PI / 2 }));
  return g;
}
function roteurHelmet() {
  const g = new THREE.Group();
  g.add(part(new THREE.SphereGeometry(0.82, 22, 16), 0x5b3a86, 0, 0.42, 0, { outline: 0.04 }));
  // visière sombre et yeux jaunes en colère
  g.add(part(new THREE.SphereGeometry(0.62, 18, 12, -0.9, 1.8, 1.2, 0.9), 0x1d1426, 0, 0.42, 0.22, { outline: 0 }));
  for (const s of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.22, 0.09, 0.05), 0xffd23f, s * 0.22, 0.55, 0.8, { rz: s * 0.35, emissive: 0xb08a10, outline: 0.015 }));
  // piques
  for (const [x, y, z, rx, rz] of [[0, 1.25, 0, 0, 0], [-0.45, 1.05, 0.1, 0.1, 0.6], [0.45, 1.05, 0.1, 0.1, -0.6], [0, 1.0, -0.5, -0.7, 0], [-0.7, 0.6, -0.1, 0, 1.2], [0.7, 0.6, -0.1, 0, -1.2]]) {
    g.add(part(new THREE.ConeGeometry(0.16, 0.5, 8), 0x9b6ad0, x, y, z, { rx, rz, outline: 0.02 }));
  }
  // le tuba sur le côté
  g.add(part(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10), 0x9aa0a8, 0.62, 1.0, -0.2, { outline: 0.02 }));
  g.add(part(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), 0x9aa0a8, 0.52, 1.45, -0.2, { rz: Math.PI / 2, outline: 0.02 }));
  return g;
}
// pistolet à bulles des soldats
function bubbleGun() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 10), 0x3fa9f5, 0, 0.2, 0));
  g.add(part(new THREE.SphereGeometry(0.13, 12, 10), 0xff6ad5, 0, 0.05, -0.1));
  g.add(part(new THREE.ConeGeometry(0.13, 0.16, 12), 0xffd23f, 0, 0.5, 0, { rx: Math.PI }));
  const muzzle = new THREE.Object3D(); muzzle.position.y = 0.6; g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

// ---------- le sabre-gaz ----------
export function makeSaber(color = 0x8fff5a, core = 0xeaffd8) {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 12), 0x8d8f99, 0, 0, 0, { outline: 0.02 }));
  g.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), 0x3a3a44, 0, 0.17, 0, { outline: 0.015 }));
  g.add(part(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), 0x3a3a44, 0, -0.12, 0, { outline: 0.015 }));
  const blade = new THREE.Group();
  const L = 1.35;
  const coreM = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, L, 4, 10), new THREE.MeshBasicMaterial({ color: core }));
  // halo de couleur normale (pas « additif ») : la lame reste bien verte (ou violette) même sur le sable clair
  const glowM = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, L + 0.05, 4, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }));
  const glow2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, L + 0.1, 4, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false }));
  for (const m of [coreM, glowM, glow2]) { m.position.y = L / 2; blade.add(m); }
  blade.position.y = 0.2;
  g.add(blade);
  const tip = new THREE.Object3D(); tip.position.y = 0.2 + L + 0.05; g.add(tip);
  const base = new THREE.Object3D(); base.position.y = 0.3; g.add(base);
  g.userData = { blade, tip, base, color, glowM, glow2 };
  return g;
}

// traînée lumineuse derrière la lame quand elle bouge vite
export class SaberTrail {
  constructor(scene, color, n = 14) {
    this.n = n; this.samples = [];
    const pos = new Float32Array(n * 2 * 3), alpha = new Float32Array(n * 2);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    this.geo = geo;
    const c = new THREE.Color(color);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uCol: { value: c } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(mix(uCol, vec3(1.0), vA * 0.35), vA * 0.7); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.strength = 0;
  }
  push(base, tip, on) {
    this.strength += ((on ? 1 : 0) - this.strength) * 0.35;
    this.samples.unshift([base.clone(), tip.clone()]);
    if (this.samples.length > this.n) this.samples.pop();
    const P = this.geo.attributes.position, A = this.geo.attributes.alpha;
    for (let i = 0; i < this.n; i++) {
      const s = this.samples[Math.min(i, this.samples.length - 1)];
      P.setXYZ(i * 2, s[0].x, s[0].y, s[0].z); P.setXYZ(i * 2 + 1, s[1].x, s[1].y, s[1].z);
      const a = (1 - i / (this.n - 1)) * this.strength;
      A.setX(i * 2, a * 0.2); A.setX(i * 2 + 1, a);
    }
    P.needsUpdate = A.needsUpdate = true;
  }
  dispose(scene) { scene.remove(this.mesh); this.geo.dispose(); }
}

// ---------- un combattant ----------
const HIDE = ['Knight_Cape', 'Knight_Helmet', '1H_Sword', '2H_Sword', '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield'];
const ANIMS = {
  idle: 'Idle', run: 'Running_A', walk: 'Walking_B', guard: '2H_Melee_Idle', block: 'Blocking', blockHit: 'Block_Hit',
  atk1: '1H_Melee_Attack_Slice_Diagonal', atk2: '1H_Melee_Attack_Slice_Horizontal', atk3: '1H_Melee_Attack_Chop',
  stab: '1H_Melee_Attack_Stab', spin: '2H_Melee_Attack_Spin', heavy: '2H_Melee_Attack_Chop',
  hit: 'Hit_A', hit2: 'Hit_B', death: 'Death_A', cheer: 'Cheer', dodge: 'Dodge_Forward', jump: 'Jump_Full_Short', jumpAir: 'Jump_Idle', jumpLand: 'Jump_Land',
  aim: '1H_Ranged_Aiming', shoot: '1H_Ranged_Shoot', spell: 'Spellcast_Shoot', throw: 'Throw', interact: 'Interact',
};
const LOOPS = new Set(['idle', 'run', 'walk', 'guard', 'block', 'aim']);

export class Fighter {
  constructor(kind, height) {
    this.kind = kind;
    this.root = new THREE.Group();
    const model = skeletonClone(gltf.scene);
    model.scale.setScalar(height / 2.3);
    this.root.add(model);
    let tex = null;
    gltf.scene.traverse((o) => { if (o.isMesh && o.material.map) tex = o.material.map; });
    this.mat = paintMaterial(kind, tex);
    model.traverse((o) => {
      if (HIDE.includes(o.name) && !(kind === 'roteur' && o.name === 'Knight_Cape')) o.visible = false;
      if (o.isSkinnedMesh) { o.material = this.mat; o.castShadow = true; o.frustumCulled = false; }
    });
    const head = model.getObjectByName('head');
    const hand = model.getObjectByName('handslotr');
    if (kind === 'lucas') {
      const hair = lucasHair(); hair.position.set(0, 0.12, -0.05); head.add(hair);
      this.saber = makeSaber(0x8fff5a, 0xeaffd8);
      hand.add(this.saber);
    } else if (kind === 'soldat') {
      const h = soldierHelmet(); h.position.set(0, 0.12, 0); h.scale.setScalar(0.86); head.add(h);
      this.gun = bubbleGun(); hand.add(this.gun);
    } else if (kind === 'roteur') {
      const h = roteurHelmet(); h.position.set(0, 0.1, 0); h.scale.setScalar(0.84); head.add(h);
      this.saber = makeSaber(0xb04cff, 0xf3dcff);
      hand.add(this.saber);
    }
    this.model = model;
    this.hand = hand;
    this.mixer = new THREE.AnimationMixer(model);
    this.act = {}; this.w = {};
    for (const [n, cn] of Object.entries(ANIMS)) {
      const a = this.mixer.clipAction(clips[cn]);
      if (!LOOPS.has(n)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      a.setEffectiveWeight(0); a.play();
      this.act[n] = a; this.w[n] = 0;
    }
    this.base = 'idle'; this.action = null; this.actionT = 0;
    this.yaw = 0; this.flash = 0;
  }

  // durée d'une animation (en secondes, à la vitesse demandée)
  dur(n, speed = 1) { return this.act[n].getClip().duration / speed; }

  setBase(n, speed = 1) { this.base = n; this.act[n].timeScale = speed; }

  // une action qui se joue une fois (coup de sabre, touché, tombe…) ; renvoie sa durée
  play(n, speed = 1, cut = 1) {
    const a = this.act[n];
    a.reset(); a.timeScale = speed; a.play();
    this.action = n;
    this.actionT = this.dur(n, speed) * cut;
    return this.actionT;
  }

  stopAction() { this.action = null; this.actionT = 0; }

  update(dt) {
    if (this.action && this.action !== 'death') {
      this.actionT -= dt;
      if (this.actionT <= 0) this.action = null;
    }
    const k = Math.min(1, dt * 16);
    for (const n in this.w) {
      const t = this.action ? (n === this.action ? 1 : 0) : (n === this.base ? 1 : 0);
      this.w[n] += (t - this.w[n]) * (n === 'death' ? 1 : k);
      this.act[n].setEffectiveWeight(this.w[n]);
    }
    this.mixer.update(dt);
    this.root.rotation.y = this.yaw;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.mat.userData.uFlash.value = this.flash;
  }

  turnTo(yaw, dt, speed = 12) {
    const d = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.yaw += d * Math.min(1, dt * speed);
  }

  saberEnds(base, tip) {
    this.saber.userData.base.getWorldPosition(base);
    this.saber.userData.tip.getWorldPosition(tip);
  }
  muzzle(out) { return this.gun.userData.muzzle.getWorldPosition(out); }
  // le soldat à ventouse : il range son pistolet et sort une ventouse
  givePlunger() {
    this.gun.visible = false;
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), 0xb07a45, 0, 0.45, 0, { outline: 0.02 }));
    g.add(part(new THREE.SphereGeometry(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8343a, 0, 1.05, 0, { rx: Math.PI, outline: 0.025 }));
    this.hand.add(g);
  }
  setSaberOn(k) { if (this.saber) this.saber.userData.blade.scale.y = Math.max(0.001, k); }
}
