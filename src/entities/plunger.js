// Le Croiseur-Ventouse : un vaisseau de guerre de Dark Roteur en forme de ventouse de toilettes.
// La cloche est une coque blindée (plaques rouges, bandes de métal, hublots, tourelles, anneau d'énergie,
// réacteur vert dedans) ; le manche est le corps du vaisseau (passerelle, antenne, ailes, gros réacteurs).
// Axe du vaisseau : la cloche vers +z, le manche vers -z.
import * as THREE from 'three';
import { outlineGeo, outlineMat, glowSprite } from '../engine/gfx.js';

export function makePlunger() {
  const g = new THREE.Group();
  const mats = [], blink = [], turrets = [], pulses = [];
  const M = (color, emissive = 0, ei = 0) => {
    const m = new THREE.MeshToonMaterial({ color, emissive: emissive || 0xffffff, emissiveIntensity: ei });
    m.userData.base = ei; mats.push(m); return m;
  };
  // une pièce et son contour foncé, ensemble
  const add = (geo, mat, outline = 0.06, parent = g) => {
    const part = new THREE.Group();
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; part.add(m);
    if (outline) part.add(new THREE.Mesh(outlineGeo(geo, outline), outlineMat));
    parent.add(part);
    return part;
  };
  const along = (geo) => geo.rotateX(Math.PI / 2); // cylindre couché dans l'axe du vaisseau

  // ---------- la cloche blindée ----------
  const prof = [[0.7, -0.3], [1.1, 0.0], [1.9, 0.5], [2.7, 1.3], [3.2, 2.2], [3.45, 2.9], [3.6, 3.3]].map(([r, y]) => new THREE.Vector2(r, y));
  add(along(new THREE.LatheGeometry(prof, 48)), M(0xc4121c), 0.1);
  // plaques de blindage plus foncées (un « anneau » sur deux)
  for (const [y0, y1, col] of [[0.55, 1.05, 0x7a0d16], [1.6, 2.1, 0x7a0d16], [2.6, 2.95, 0x6e6680]]) {
    const r0 = 0.04 + prof.reduce((a, v, i) => (v.y <= y0 ? v.x : a), 0.7), r1 = 0.04 + prof.reduce((a, v) => (v.y <= y1 ? v.x : a), 0.7);
    const band = along(new THREE.CylinderGeometry(r0 + 0.12, r1 + 0.12, y1 - y0, 48, 1, true));
    const b = add(band, M(col), 0.03);
    b.position.z = (y0 + y1) / 2;
  }
  // l'intérieur sombre et le réacteur vert qui aspire
  g.add(new THREE.Mesh(along(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(v.x * 0.94, v.y)), 48)),
    new THREE.MeshBasicMaterial({ color: 0x1d0d22, side: THREE.BackSide })));
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), new THREE.MeshBasicMaterial({ color: 0x8fff5a }));
  core.position.z = 1.9; g.add(core);
  const coreGlow = glowSprite(0x8fff5a, 5.5, 0.85); coreGlow.position.z = 2.4; g.add(coreGlow);
  pulses.push({ o: coreGlow, base: 5.5, speed: 4 }, { o: core, base: 1, speed: 4, mesh: true });
  // anneau d'énergie violet sur le bord
  const rim = add(new THREE.TorusGeometry(3.6, 0.3, 12, 56), M(0x3a2848), 0.05);
  rim.position.z = 3.3;
  const energy = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.14, 8, 56), new THREE.MeshBasicMaterial({ color: 0xd38bff }));
  energy.position.z = 3.42; g.add(energy);
  // rangées de hublots jaunes tout autour de la cloche
  const winGeo = new THREE.BoxGeometry(0.34, 0.2, 0.08);
  for (const [z, r, n] of [[0.8, 2.25, 10], [2.1, 3.2, 14]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const w = new THREE.Mesh(winGeo, new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      w.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
      w.lookAt(Math.cos(a) * r * 2, Math.sin(a) * r * 2, z + 0.6);
      g.add(w);
      if (i % 3 === 0) blink.push({ o: w, ph: i * 1.7 });
    }
  }
  // tourelles sur le bord de la cloche
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const t = new THREE.Group();
    t.position.set(Math.cos(a) * 3.05, Math.sin(a) * 3.05, 2.7);
    t.lookAt(Math.cos(a) * 6, Math.sin(a) * 6, 2.7);
    add(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), M(0x4a4058), 0.03, t);
    const barrel = add(new THREE.CylinderGeometry(0.09, 0.11, 0.9, 8).rotateX(Math.PI / 2), M(0x2a2232), 0.02, t);
    barrel.position.z = 0.5;
    g.add(t);
    turrets.push({ o: t, ph: i });
  }

  // ---------- le manche : le corps du vaisseau ----------
  const body = add(along(new THREE.CylinderGeometry(0.62, 0.72, 8.6, 18)), M(0x7a7690), 0.07);
  body.position.z = -4.5;
  // bagues violettes et lignes de lumière
  for (const z of [-1.4, -3.4, -5.4, -7.4]) {
    const ring = add(along(new THREE.CylinderGeometry(0.82, 0.82, 0.38, 18)), M(0x5a3a86), 0.04);
    ring.position.z = z;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a6a }));
    lamp.position.set(0, 0.86, z); g.add(lamp);
    blink.push({ o: lamp, ph: z });
  }
  // la passerelle de commande (où se tient Dark Roteur) avec sa visière jaune
  const bridge = add(new THREE.BoxGeometry(1.5, 1.0, 1.9), M(0x5a5070), 0.05);
  bridge.position.set(0, 0.95, -6.0);
  const dome = add(new THREE.SphereGeometry(0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x3a2d4d), 0.04);
  dome.position.set(0, 1.45, -6.0);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    eye.position.set(s * 0.25, 1.7, -5.33); eye.rotation.z = s * 0.35; g.add(eye);
  }
  const antenna = add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), M(0x9aa0a8), 0.02);
  antenna.position.set(0.3, 2.6, -6.3);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a6a }));
  tip.position.set(0.3, 3.45, -6.3); g.add(tip); blink.push({ o: tip, ph: 0 });
  // ailes et réacteurs au bout du manche
  for (const sx of [-1, 1]) {
    const wing = add(new THREE.BoxGeometry(2.6, 0.2, 2.0), M(0x8a5ab0), 0.04);
    wing.position.set(sx * 1.6, 0, -7.6); wing.rotation.z = sx * -0.15;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    stripe.position.set(sx * 1.6, 0.02, -7.0); stripe.rotation.z = sx * -0.15; g.add(stripe);
    const pod = add(along(new THREE.CylinderGeometry(0.5, 0.62, 2.2, 14)), M(0x6e6e80), 0.05);
    pod.position.set(sx * 2.8, -0.2, -8.0);
    const nozzle = add(along(new THREE.CylinderGeometry(0.62, 0.45, 0.4, 14)), M(0x2a2232), 0.03);
    nozzle.position.set(sx * 2.8, -0.2, -9.25);
    const fire = glowSprite(0xb04cff, 2.6, 0.95); fire.position.set(sx * 2.8, -0.2, -9.9); g.add(fire);
    pulses.push({ o: fire, base: 2.6, speed: 20 });
  }
  const mainNozzle = add(along(new THREE.CylinderGeometry(0.9, 0.6, 0.7, 16)), M(0x2a2232), 0.04);
  mainNozzle.position.z = -9.1;
  const mainFire = glowSprite(0xd38bff, 3.6, 0.95); mainFire.position.z = -9.9; g.add(mainFire);
  pulses.push({ o: mainFire, base: 3.6, speed: 24 });

  g.userData.mats = mats;
  // petites animations : lumières qui clignotent, tourelles qui pivotent, réacteurs qui pulsent
  g.userData.anim = (t) => {
    for (const b of blink) b.o.visible = Math.sin(t * 5 + b.ph) > -0.3;
    for (const tu of turrets) tu.o.rotation.z = Math.sin(t * 1.5 + tu.ph) * 0.6;
    for (const p of pulses) {
      const k = 1 + Math.sin(t * p.speed) * 0.12;
      if (p.mesh) p.o.scale.setScalar(p.base * k); else p.o.scale.setScalar(p.base * k);
    }
  };
  return g;
}
