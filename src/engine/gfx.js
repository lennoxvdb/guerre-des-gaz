// Outils graphiques 3D (repris de Starshiprout) : style cartoon, dessins, nuages de gaz, mots « POUF ! ».
import * as THREE from 'three';
import { mergeGeometries } from '../../lib/BufferGeometryUtils.js';

export const INK = 0x3a2312;

// ---------- dessins (planches Gemini) ----------
const texLoader = new THREE.TextureLoader();
export const TEX = {};
export function loadTextures(list, onProgress) {
  let done = 0;
  return Promise.all(Object.entries(list).map(([k, url]) => new Promise((res) => {
    texLoader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      TEX[k] = t; done++; onProgress && onProgress(done / Object.keys(list).length); res();
    }, undefined, () => { console.warn('image manquante', url); done++; res(); });
  })));
}

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- style cartoon (ombrage en aplats + contour marron) ----------
export const gradMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
export function toonMat(color, emissive = 0) {
  const k = color + ':' + emissive;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: gradMap, emissive, emissiveIntensity: emissive ? 0.5 : 0 }));
  return matCache.get(k);
}
export const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
export function outlineGeo(geo, thick) {
  const g = geo.clone();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * thick, p.getY(i) + n.getY(i) * thick, p.getZ(i) + n.getZ(i) * thick);
  return g;
}
const outlineCache = new WeakMap();
export function toon(geo, color, { outline = 0.06, shadow = true, emissive = 0 } = {}) {
  const grp = new THREE.Group();
  const m = new THREE.Mesh(geo, toonMat(color, emissive));
  m.castShadow = shadow; m.receiveShadow = true;
  grp.add(m);
  if (outline) {
    // une forme partagée garde un seul contour pour tous ses exemplaires
    let og;
    if (geo.userData.keep) {
      let byT = outlineCache.get(geo); if (!byT) outlineCache.set(geo, byT = new Map());
      og = byT.get(outline); if (!og) { og = outlineGeo(geo, outline); og.userData.keep = true; byT.set(outline, og); }
    } else og = outlineGeo(geo, outline);
    grp.add(new THREE.Mesh(og, outlineMat));
  }
  return grp;
}

// ---------- dessins dans la scène ----------
// dessin vu de dessus posé à plat (vaisseaux) : le haut du dessin regarde vers « le haut de l'écran »
export function flatSprite(tex, width) {
  const h = width * tex.image.height / tex.image.width;
  const geo = new THREE.PlaneGeometry(width, h);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, depthWrite: true });
  const mesh = new THREE.Mesh(geo, mat);
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.mat = mat; g.userData.len = h;
  return g;
}
// angle sur l'écran (0 = vers le haut, sens des aiguilles d'une montre) → rotation du dessin à plat
export const screenYaw = (a) => Math.PI / 4 - a;

// personnage dessiné debout, toujours face à la caméra (pieds en bas)
export function standee(tex, height) {
  const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.4 });
  const s = new THREE.Sprite(mat);
  s.center.set(0.5, 0.02);
  s.scale.set(height * tex.image.width / tex.image.height, height, 1);
  return s;
}

export const glowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
export function glowSprite(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

const blobTex = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
export function shadowBlob(size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.scale.set(size, 1, size);
  m.renderOrder = 1;
  return m;
}

// cercle rouge au sol : « attention, ça va taper ici »
const warnTex = canvasTex(128, 128, (g) => {
  g.fillStyle = 'rgba(255,60,60,.28)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ff3b30'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
});
export function warnDisc(size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: warnTex, transparent: true, depthWrite: false }));
  m.scale.set(size, 1, size);
  m.renderOrder = 2;
  return m;
}

// ---------- nuages de gaz (particules) ----------
export const puffTex = canvasTex(128, 128, (g) => {
  const lumps = [[64, 70, 40], [44, 60, 28], [84, 58, 30], [64, 46, 30], [50, 82, 24], [80, 82, 24]];
  for (const [x, y, r] of lumps) {
    const gr = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(225,225,225,.95)'); gr.addColorStop(1, 'rgba(200,200,200,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
});

const _c = new THREE.Color();
export class Particles {
  constructor(scene, tex, cap = 700, additive = false) {
    this.cap = cap;
    this.list = [];
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos); geo.setAttribute('iSize', this.aSize);
    geo.setAttribute('iRot', this.aRot); geo.setAttribute('iCol', this.aCol);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex } },
      vertexShader: `
        attribute vec3 iPos; attribute float iSize; attribute float iRot; attribute vec4 iCol;
        varying vec2 vUv; varying vec4 vCol;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float c = cos(iRot), s = sin(iRot);
          mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iSize;
          gl_Position = projectionMatrix * mv;
          vUv = uv; vCol = iCol;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
        void main() {
          vec4 t = texture2D(map, vUv);
          float a = t.a * vCol.a;
          if (a < 0.02) discard;
          gl_FragColor = vec4(vCol.rgb * mix(0.78, 1.0, t.r), a);
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  emit(x, y, z, color, { vx = 0, vy = 0, vz = 0, life = 0.8, s0 = 0.5, s1 = 1.4, alpha = 0.9, grav = 0, drag = 1.5 } = {}) {
    if (this.list.length >= this.cap) this.list.shift();
    const c = _c.setHex(color, THREE.LinearSRGBColorSpace);
    this.list.push({ x, y, z, vx, vy, vz, life, max: life, s0, s1, a: alpha, r: c.r, g: c.g, b: c.b, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, grav, drag });
  }

  burst(x, y, z, color, n, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, color, { vx: Math.cos(a) * s, vy: (opts.up ?? 1) * (0.5 + Math.random()) * speed * 0.5, vz: Math.sin(a) * s, ...opts });
    }
  }

  update(dt) {
    const L = this.list;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.vr * dt;
      L[j++] = p;
    }
    L.length = j;
    for (let i = 0; i < j; i++) {
      const p = L[i], t = 1 - p.life / p.max;
      this.aPos.setXYZ(i, p.x, p.y, p.z);
      this.aSize.setX(i, p.s0 + (p.s1 - p.s0) * t);
      this.aRot.setX(i, p.rot);
      this.aCol.setXYZW(i, p.r, p.g, p.b, p.a * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85));
    }
    this.geo.instanceCount = j;
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aRot.needsUpdate = this.aCol.needsUpdate = true;
  }

  clear() { this.list.length = 0; this.geo.instanceCount = 0; }
}

// ---------- mots de bande dessinée qui sautent (POUF ! CLANG ! PING !) ----------
const wordCache = new Map();
function wordTex(text, color) {
  const k = text + color;
  if (!wordCache.has(k)) {
    wordCache.set(k, canvasTex(320, 120, (g) => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '72px "Luckiest Guy", "Arial Rounded MT Bold", sans-serif';
      g.lineJoin = 'round';
      g.lineWidth = 16; g.strokeStyle = '#3a2312'; g.strokeText(text, 160, 66);
      g.fillStyle = color; g.fillText(text, 160, 66);
    }));
  }
  return wordCache.get(k);
}
export class Words {
  constructor(scene) { this.scene = scene; this.list = []; }
  pop(text, pos, color = '#ffd23f', size = 1.6) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordTex(text, color), transparent: true, depthTest: false }));
    s.position.copy(pos); s.renderOrder = 20;
    s.userData = { t: 0, size, rot: (Math.random() - 0.5) * 0.4 };
    s.material.rotation = s.userData.rot;
    this.scene.add(s);
    this.list.push(s);
  }
  update(dt) {
    this.list = this.list.filter((s) => {
      const u = s.userData; u.t += dt;
      const t = u.t, k = t < 0.12 ? t / 0.12 * 1.3 : t < 0.22 ? 1.3 - (t - 0.12) * 3 : 1;
      s.scale.set(u.size * k * 2.66, u.size * k, 1);
      s.position.y += dt * 1.2;
      s.material.opacity = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
      if (t > 1) { this.scene.remove(s); s.material.dispose(); return false; }
      return true;
    });
  }
  clear() { for (const s of this.list) this.scene.remove(s); this.list = []; }
}

// enlever un objet libère aussi ses formes dans la carte graphique (sinon le jeu ralentit au fil des parties).
// Les formes partagées (userData.keep), les personnages animés et les sprites ne sont pas touchés.
export function freeGeo(o) {
  if (o && o.traverse) o.traverse((c) => { if (c.geometry && !c.isSkinnedMesh && !c.isInstancedMesh && !c.isSprite && !c.geometry.userData.keep) c.geometry.dispose(); });
}
export function autoDispose(parent) {
  const rm = parent.remove.bind(parent);
  parent.remove = (...objs) => { rm(...objs); for (const o of objs) freeGeo(o); return parent; };
  return parent;
}

// Décor qui ne bouge pas : on colle ensemble tous les morceaux qui ont la même couleur (un seul dessin au lieu de dizaines).
// Beaucoup plus léger pour le téléphone (la tranchée passe de ~360 à ~60 dessins par image).
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4();
export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  _inv.copy(group.matrixWorld).invert();
  const byMat = new Map(), olds = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(_mm.multiplyMatrices(_inv, o.matrixWorld));
    if (!byMat.has(o.material)) byMat.set(o.material, { geos: [], shadow: false, order: o.renderOrder });
    const e = byMat.get(o.material); e.geos.push(g); e.shadow = e.shadow || o.castShadow;
    olds.push(o);
  });
  for (const o of olds) { if (!o.geometry.userData.keep) o.geometry.dispose(); o.parent.remove(o); }
  for (const c of [...group.children]) if (c.type === 'Group' && !c.children.length) group.remove(c);
  for (const [mat, e] of byMat) {
    const m = new THREE.Mesh(e.geos.length > 1 ? mergeGeometries(e.geos) : e.geos[0], mat);
    for (const g of e.geos) if (e.geos.length > 1) g.dispose();
    m.castShadow = e.shadow; m.receiveShadow = true; m.renderOrder = e.order;
    group.add(m);
  }
  return group;
}
