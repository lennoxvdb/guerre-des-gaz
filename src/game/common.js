// Petits outils partagés par les modes de jeu.
import * as THREE from 'three';

// directions de l'écran posées sur le sol (la caméra regarde depuis +x +z)
export const SR = new THREE.Vector3(1, 0, -1).normalize(); // vers la droite de l'écran
export const SU = new THREE.Vector3(-1, 0, -1).normalize(); // vers le haut de l'écran

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// direction (dx, dz) au sol → angle pour tourner un combattant (le modèle regarde vers +z)
export const yawOf = (dx, dz) => Math.atan2(dx, dz);
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Les mots qui sautent quand on frappe
export const HIT_WORDS = ['PAF !', 'POUF !', 'BING !', 'BAM !', 'PROUT !'];

// Fait tourner un « scénario » écrit comme une suite d'étapes :
//   yield 2           → attendre 2 secondes
//   yield () => cond  → attendre que la condition soit vraie
export class Script {
  constructor(gen) { this.gen = gen; this.wait = 0; this.until = null; this.done = false; }
  update(dt) {
    if (this.done) return;
    if (this.wait > 0) { this.wait -= dt; return; }
    if (this.until) { if (!this.until()) return; this.until = null; }
    for (let guard = 0; guard < 50; guard++) {
      const r = this.gen.next();
      if (r.done) { this.done = true; return; }
      if (typeof r.value === 'number') { this.wait = r.value; return; }
      if (typeof r.value === 'function') { if (!r.value()) { this.until = r.value; return; } }
    }
  }
}
