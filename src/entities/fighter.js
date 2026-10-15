// Les combattants en 3D animée : Lucas (sabre-gaz vert), les soldats de Dark Roteur, Dark Roteur.
// Les soldats et Dark Roteur : le modèle « Knight » (KayKit Adventurers Pack, CC0) repeint et équipé dans le code.
// Lucas : NOTRE propre Lucas 3D (dessin Gemini → TRELLIS → squelette Mixamo, assets/3d/lucas.fbx).
// Il copie à chaque image les mouvements du Knight (caché) : toutes les animations du jeu marchent pour lui.
import * as THREE from 'three';
import { GLTFLoader } from '../../lib/GLTFLoader.js';
import { FBXLoader } from '../../lib/FBXLoader.js';
import { clone as skeletonClone } from '../../lib/SkeletonUtils.js';
import { gradMap, outlineGeo, outlineMat, toonMat } from '../engine/gfx.js';
import { makeCustomSaber } from './sabre.js';

let gltf = null, clips = null;
export async function loadKnight() {
  gltf = await new Promise((res, rej) => new GLTFLoader().load('assets/3d/trooper.glb', res, undefined, rej));
  clips = {};
  for (const c of gltf.animations) clips[c.name] = c;
  // nos propres personnages 3D (s'il en manque un, on garde l'ancien, fait avec le Knight)
  await Promise.all(Object.entries(MODELS).map(async ([kind, url]) => {
    try {
      const fbx = await new FBXLoader().loadAsync(url);
      let tex = null;
      fbx.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); // le fichier de Mixamo n'en a pas : sans elles, tout serait noir
        if (o.material && o.material.map) tex = o.material.map;
      });
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;
      SRC[kind] = { fbx, tex };
    } catch (e) { console.warn(kind + ' 3D introuvable, on garde l\'ancien', e); }
  }));
}
// nos personnages faits maison : dessin Gemini → TRELLIS → squelette Mixamo (voir CLAUDE.md)
// Pour en ajouter un : déposer son .fbx dans assets/3d/ et l'écrire ici.
const MODELS = { lucas: 'assets/3d/lucas.fbx' };
const SRC = {};

// les os du Knight → les os de Mixamo (et l'os « enfant » qui donne la direction de chaque os)
const BONES = [
  ['hips', 'Hips', 'spine', 'Spine'], ['spine', 'Spine', 'chest', 'Spine2'], ['chest', 'Spine2', 'head', 'Neck'], ['head', 'Head', null, null],
  ['upperarml', 'LeftArm', 'lowerarml', 'LeftForeArm'], ['lowerarml', 'LeftForeArm', 'wristl', 'LeftHand'], ['wristl', 'LeftHand', 'handl', 'LeftHandIndex1'],
  ['upperarmr', 'RightArm', 'lowerarmr', 'RightForeArm'], ['lowerarmr', 'RightForeArm', 'wristr', 'RightHand'], ['wristr', 'RightHand', 'handr', 'RightHandIndex1'],
  ['upperlegl', 'LeftUpLeg', 'lowerlegl', 'LeftLeg'], ['lowerlegl', 'LeftLeg', 'footl', 'LeftFoot'], ['footl', 'LeftFoot', 'toesl', 'LeftToeBase'],
  ['upperlegr', 'RightUpLeg', 'lowerlegr', 'RightLeg'], ['lowerlegr', 'RightLeg', 'footr', 'RightFoot'], ['footr', 'RightFoot', 'toesr', 'RightToeBase'],
];
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _rootQi = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _s = new THREE.Vector3();
// direction de la lame au repos (bras en A, paumes vers le bas) : vers l'avant, côté pouce
const GRIP_DIR = new THREE.Vector3(0, 0, 1);
const findBone = (o, name) => o.getObjectByName('mixamorig' + name) || o.getObjectByName('mixamorig:' + name);

// matière toon de nos personnages 3D, avec le flash blanc quand ils sont touchés
function heroMaterial(kind) {
  const m = new THREE.MeshToonMaterial({ map: SRC[kind].tex, gradientMap: gradMap });
  m.userData.uFlash = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = m.userData.uFlash;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uFlash);');
  };
  m.customProgramCacheKey = () => 'hero3d';
  return m;
}

// ---------- peinture : chaque couleur du modèle d'origine est remplacée ----------
const lin = (hex) => new THREE.Color(hex); // Color() convertit déjà en couleurs linéaires
const PAINT = {
  // armure grise → combinaison blanche, tissu rouge → vert, doré → vert clair
  lucas: { grey: lin(0xf2f4ee), red: lin(0x2f9e35), gold: lin(0x8fdc3c), skin: null },
  soldat: { grey: lin(0x8a7aa3), red: lin(0x4b3466), gold: lin(0xc9b6e6), skin: lin(0x6a5c80) },
  roteur: { grey: lin(0x3a2d4d), red: lin(0x6a2f8f), gold: lin(0x8fdc3c), skin: lin(0x2e2a33) },
  capitaine: { grey: lin(0x7a2a36), red: lin(0x3a1a2a), gold: lin(0xffd23f), skin: lin(0x5a3040) },
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
// casque du Capitaine Burpo : gros casque rouge, visière noire, crête jaune, yeux rouges
function capitaineHelmet() {
  const g = new THREE.Group();
  g.add(part(new THREE.SphereGeometry(0.8, 22, 16), 0xa83240, 0, 0.42, 0, { outline: 0.04 }));
  g.add(part(new THREE.SphereGeometry(0.6, 18, 12, -0.9, 1.8, 1.25, 0.8), 0x1d1426, 0, 0.42, 0.24, { outline: 0 }));
  for (const s of [-1, 1]) g.add(part(new THREE.SphereGeometry(0.1, 10, 8), 0xff4a3a, s * 0.22, 0.5, 0.8, { emissive: 0xaa2010, outline: 0.01 }));
  g.add(part(new THREE.BoxGeometry(0.16, 0.5, 1.2), 0xffd23f, 0, 1.18, -0.05, { outline: 0.02 }));
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
    const c = color && color.isColor ? color : new THREE.Color(color); // une couleur partagée peut changer (arc-en-ciel)
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
  hit: 'Hit_A', hit2: 'Hit_B', death: 'Death_A', cheer: 'Cheer', dodge: 'Dodge_Forward', jump: 'Jump_Full_Short', jumpAir: 'Jump_Idle', jumpLand: 'Jump_Land', fly: 'Jump_Idle', sit: 'Sit_Chair_Idle',
  aim: '1H_Ranged_Aiming', shoot: '1H_Ranged_Shoot', spell: 'Spellcast_Shoot', throw: 'Throw', interact: 'Interact',
};
const LOOPS = new Set(['idle', 'run', 'walk', 'guard', 'block', 'aim', 'fly', 'sit']);

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
      if (HIDE.includes(o.name) && !((kind === 'roteur' || kind === 'capitaine') && o.name === 'Knight_Cape')) o.visible = false;
      if (o.isSkinnedMesh) { o.material = this.mat; o.castShadow = true; o.frustumCulled = false; }
    });
    const head = model.getObjectByName('head');
    const hand = model.getObjectByName('handslotr');
    if (SRC[kind] && (kind === 'lucas' || kind === 'roteur')) {
      this.setupLucas3D(model, height, hand, kind);
      this.saber = null;
      // Lucas : le sabre fabriqué dans l'atelier ; Dark Roteur : son sabre violet ; bien serrés dans la main
      this.replaceSaber(kind === 'lucas' ? makeCustomSaber() : makeSaber(0xb04cff, 0xf3dcff));
    } else if (kind === 'lucas') {
      const hair = lucasHair(); hair.position.set(0, 0.12, -0.05); head.add(hair);
      this.saber = makeCustomSaber(); // le sabre fabriqué dans l'atelier
      hand.add(this.saber);
    } else if (kind === 'soldat') {
      const h = soldierHelmet(); h.position.set(0, 0.12, 0); h.scale.setScalar(0.86); head.add(h);
      this.gun = bubbleGun(); hand.add(this.gun);
    } else if (kind === 'capitaine') {
      const h = capitaineHelmet(); h.position.set(0, 0.1, 0); h.scale.setScalar(0.84); head.add(h);
      this.saber = makeSaber(0xff6a3a, 0xffe2c8);
      hand.add(this.saber);
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
    if (this.L) this.followKnight();
    if (this.saber && this.saber.userData.anim) this.saber.userData.anim(dt);
    this.flash = Math.max(0, this.flash - dt * 5);
    this.mat.userData.uFlash.value = this.flash;
  }

  // ---------- notre Lucas 3D ----------
  setupLucas3D(model, height, knightSlot, kind = 'lucas') {
    // le Knight reste là, invisible : c'est lui qui joue les animations
    model.traverse((o) => { if (o.isMesh) o.visible = false; });
    const lucas = skeletonClone(SRC[kind].fbx);
    lucas.animations = [];
    const box = new THREE.Box3().setFromObject(SRC[kind].fbx);
    const k = height * 1.08 / (box.max.y - box.min.y); // un peu plus grand que l'ancien Lucas : on le voit bien de haut
    lucas.scale.setScalar(k);
    this.mat = heroMaterial(kind);
    lucas.traverse((o) => { if (o.isMesh) { o.material = this.mat; o.castShadow = true; o.frustumCulled = false; } });
    this.root.add(lucas);
    this.root.updateMatrixWorld(true);
    // au repos : orientation de chaque os (par rapport au personnage), et correction « bras en A » → « bras en T »
    const dir = (a, b) => b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();
    const pairs = [];
    for (const [kn, ln, kc, lc] of BONES) {
      const K = model.getObjectByName(kn), L = findBone(lucas, ln);
      if (!K || !L) continue;
      const qK0 = K.getWorldQuaternion(new THREE.Quaternion());
      const qL0 = L.getWorldQuaternion(new THREE.Quaternion());
      let corr = new THREE.Quaternion();
      const KC = kc && model.getObjectByName(kc), LC = lc && findBone(lucas, lc);
      if (KC && LC) corr.setFromUnitVectors(dir(L, LC), dir(K, KC));
      // pendant l'animation : Lucas = (mouvement du Knight depuis son repos) appliqué à Lucas « remis en T »
      const qLA = corr.multiply(qL0);
      // les pieds : on les gardera à plat (les pieds du Knight sont minuscules et tournés autrement)
      const flat = ln === 'LeftFoot' || ln === 'RightFoot' ? { qL0: qL0.clone(), knee: K.parent } : null;
      pairs.push({ K, L, qK0inv: qK0.invert(), qLA, flat });
    }
    const map = new Map(pairs.map((p) => [p.L, p]));
    const order = [];
    findBone(lucas, 'Hips').traverse((o) => { if (o.isBone) order.push(o); });
    const hipsK = model.getObjectByName('hips'), hipsL = findBone(lucas, 'Hips');
    const hK0 = hipsK.getWorldPosition(new THREE.Vector3()), hL0 = hipsL.getWorldPosition(new THREE.Vector3());
    this.L = { lucas, order, map, rest: new Map(order.map((b) => [b, b.quaternion.clone()])), hipsK, hipsL, hK0, hL0, ratio: hL0.y / hK0.y, scale: k };
    this.lucasHand = findBone(lucas, 'RightHand');
    this.lucasChest = findBone(lucas, 'Spine2');
    this.knightScale = height / 2.3;
    // la prise du sabre, calculée au repos : le manche au creux du poing, la lame qui sort côté pouce (vers l'avant)
    const hand = this.lucasHand, finger = findBone(lucas, 'RightHandIndex1');
    const hp = hand.getWorldPosition(new THREE.Vector3()), fp = finger.getWorldPosition(new THREE.Vector3());
    const along = fp.clone().sub(hp), len = along.length(); along.normalize();
    const blade = GRIP_DIR.clone().addScaledVector(along, -GRIP_DIR.dot(along)).normalize();
    const gripPos = hp.clone().addScaledVector(along, len * 0.9).add(new THREE.Vector3(0, -len * 0.25, 0));
    const gripQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), blade);
    const world = new THREE.Matrix4().compose(gripPos, gripQ, knightSlot.getWorldScale(new THREE.Vector3()));
    this.grip = new THREE.Matrix4().copy(hand.matrixWorld).invert().multiply(world);
  }

  // pied bien à plat quand la jambe est debout : on ne garde que sa rotation à gauche/droite (un peu)
  flatFoot(P, want) {
    const shin = P.K.getWorldPosition(_p).sub(P.flat.knee.getWorldPosition(_p2)).normalize().applyQuaternion(_rootQi);
    const w = THREE.MathUtils.smoothstep(-shin.y, 0.7, 0.92); // 1 = jambe bien verticale
    if (w <= 0) return want;
    const d = want.clone().multiply(P.qLA.clone().invert()); // rotation depuis le repos
    const twist = new THREE.Quaternion(0, d.y, 0, d.w).normalize(); // seulement autour de la verticale
    const ang = 2 * Math.atan2(twist.y, twist.w), lim = 0.35;
    if (Math.abs(ang) > lim) twist.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sign(ang) * lim);
    const flat = twist.multiply(P.flat.qL0);
    return want.slerp(flat, w);
  }

  // à chaque image : les os de Lucas prennent la pose du Knight caché
  followKnight() {
    const L = this.L;
    this.root.updateMatrixWorld(true);
    _rootQi.copy(this.root.getWorldQuaternion(_q)).invert();
    const world = new Map(); // orientation de chaque os de Lucas, par rapport au personnage
    for (const b of L.order) {
      const parentQ = world.get(b.parent) || _q2.copy(_rootQi).multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));
      const P = L.map.get(b);
      if (P) {
        const qK = P.K.getWorldQuaternion(new THREE.Quaternion()).premultiply(_rootQi);
        let want = qK.multiply(P.qK0inv).multiply(P.qLA);
        if (P.flat) want = this.flatFoot(P, want);
        b.quaternion.copy(parentQ.clone().invert().multiply(want));
        world.set(b, want);
      } else {
        b.quaternion.copy(L.rest.get(b));
        world.set(b, parentQ.clone().multiply(b.quaternion));
      }
    }
    // les hanches montent et descendent comme celles du Knight (sauts, chutes, assis)
    _m.copy(this.root.matrixWorld).invert();
    _p.copy(L.hipsK.getWorldPosition(_p)).applyMatrix4(_m).sub(L.hK0).multiplyScalar(L.ratio).add(L.hL0);
    _m2.copy(_m).multiply(L.hipsL.parent.matrixWorld).invert();
    L.hipsL.position.copy(_p.applyMatrix4(_m2));
    L.lucas.updateMatrixWorld(true);
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
  // un jetpack à prout dans le dos (deux réservoirs verts, deux tuyères, des flammes)
  giveJetpack() {
    const chest = this.lucasChest || this.model.getObjectByName('chest') || this.model.getObjectByName('spine');
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      g.add(part(new THREE.CapsuleGeometry(0.22, 0.5, 4, 10), 0x4fc23a, sx * 0.27, 0.15, 0, { outline: 0.025 }));
      g.add(part(new THREE.CylinderGeometry(0.15, 0.2, 0.22, 10), 0x3a3a44, sx * 0.27, -0.32, 0, { outline: 0.02 }));
    }
    g.add(part(new THREE.BoxGeometry(0.7, 0.4, 0.18), 0x8d8f99, 0, 0.2, 0.14, { outline: 0.02 }));
    g.position.set(0, 0.25, -0.45);
    if (this.lucasChest) { // os de Mixamo : unités en centimètres
      const f = this.knightScale / this.L.scale;
      g.scale.setScalar(f); g.position.set(0, -0.12, -0.32).multiplyScalar(f);
    }
    chest.add(g);
    this.jetpack = g;
    return g;
  }

  // le soldat à ventouse : il range son pistolet et sort une ventouse
  givePlunger() {
    this.gun.visible = false;
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), 0xb07a45, 0, 0.45, 0, { outline: 0.02 }));
    g.add(part(new THREE.SphereGeometry(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8343a, 0, 1.05, 0, { rx: Math.PI, outline: 0.025 }));
    this.hand.add(g);
  }
  // changer de sabre (l'atelier) : dans la main du Knight, ou qui suit la main de notre Lucas
  replaceSaber(s) {
    if (this.saber && this.saber.parent) this.saber.parent.remove(this.saber);
    this.saber = s;
    if (this.grip) { this.grip.decompose(s.position, s.quaternion, s.scale); this.lucasHand.add(s); } else this.hand.add(s);
  }
  setSaberOn(k) {
    if (!this.saber) return;
    const U = this.saber.userData;
    for (const b of U.blades || [U.blade]) b.scale.y = Math.max(0.001, k);
    if (U.setOn) U.setOn(k);
  }
}
