// L'Étoile Puante : la station de Dark Roteur, une cuvette de toilettes géante dans l'espace.
// Vue de dessus : la cuvette (eau verte), la lunette avec des tourelles, le couvercle relevé couvert de hublots.
// Son point faible : le trou de la chasse d'eau, au fond, protégé par des volets qui s'ouvrent de temps en temps.
// Le dos de la station (couvercle) est vers -z.
import * as THREE from 'three';
import { outlineGeo, outlineMat, glowSprite } from '../engine/gfx.js';

export function makeStinkStar() {
  const g = new THREE.Group();
  const mats = [], blink = [];
  const M = (color, extra = {}) => { const m = new THREE.MeshToonMaterial({ color, emissive: 0xffffff, emissiveIntensity: 0, ...extra }); mats.push(m); return m; };
  const add = (geo, mat, outline = 0.08, parent = g) => {
    const part = new THREE.Group();
    const m = new THREE.Mesh(geo, mat); part.add(m);
    if (outline) part.add(new THREE.Mesh(outlineGeo(geo, outline), outlineMat));
    parent.add(part);
    return part;
  };

  // la cuvette (on voit dedans depuis le dessus)
  const prof = [[0.6, -3.2], [2.6, -2.9], [4.6, -2.1], [6.1, -1.0], [6.9, 0.1], [7.1, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 56), M(0xd8d4e6, { side: THREE.DoubleSide }), 0.12);
  // bandes de métal et hublots tout autour de la cuvette
  const band = add(new THREE.CylinderGeometry(6.55, 5.7, 0.5, 56, 1, true), M(0x6e6680, { side: THREE.DoubleSide }), 0.04);
  band.position.y = -0.9;
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2;
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    w.position.set(Math.cos(a) * 6.62, -0.5, Math.sin(a) * 6.62);
    w.lookAt(Math.cos(a) * 20, -0.5, Math.sin(a) * 20);
    g.add(w);
    if (i % 4 === 0) blink.push({ o: w, ph: i });
  }
  // l'eau verte qui brille
  const water = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fd83a }));
  water.position.y = -1.3; g.add(water);
  // tourbillons sur l'eau
  const swirls = new THREE.Group(); swirls.position.y = -1.25; g.add(swirls);
  for (let i = 0; i < 3; i++) {
    const r = 1.6 + i * 1.2;
    const arc = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.18, 32, 1, i * 2, 3.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc8ff9a }));
    swirls.add(arc);
  }
  // le trou de la chasse d'eau, au centre, et son cœur vert
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14081c }));
  hole.position.y = -1.2; g.add(hole);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xb6ff7a }));
  core.position.y = -1.5; g.add(core);
  const coreGlow = glowSprite(0x8fff5a, 5, 0); coreGlow.position.y = -0.6; g.add(coreGlow);
  // les volets qui ferment le trou (6 parts de tarte en métal)
  const shutters = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const sh = add(new THREE.CircleGeometry(2.05, 10, a, Math.PI / 3).rotateX(-Math.PI / 2), M(0x7a7690, { side: THREE.DoubleSide }), 0.02);
    sh.position.y = -1.1;
    shutters.push({ o: sh, a: a + Math.PI / 6 });
  }
  // la lunette (grosse bouée blanche) et ses tourelles
  const seat = add(new THREE.TorusGeometry(6.3, 0.75, 14, 64).rotateX(Math.PI / 2), M(0xf2eff8), 0.08);
  seat.position.y = 0.75;
  const turrets = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    const t = new THREE.Group();
    t.position.set(Math.cos(a) * 6.3, 1.4, Math.sin(a) * 6.3);
    add(new THREE.SphereGeometry(0.6, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x5a3a86), 0.04, t);
    const barrel = add(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 8).rotateX(Math.PI / 2), M(0x2a2232), 0.03, t);
    barrel.position.set(0, 0.35, 0.5);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a6a }));
    lamp.position.y = 0.62; t.add(lamp);
    t.lookAt(Math.cos(a) * 20, 1.4, Math.sin(a) * 20);
    g.add(t);
    turrets.push({ o: t, local: t.position.clone(), alive: true, hp: 10, lamp });
  }
  // le couvercle relevé, au dos, couvert de hublots (c'est là qu'habitent les soldats)
  const lid = new THREE.Group();
  lid.position.set(0, 0.8, -6.4); lid.rotation.x = -1.25;
  add(new THREE.CylinderGeometry(6.8, 6.8, 0.6, 56).rotateX(0), M(0xe6e2ee), 0.1, lid);
  const lidBand = add(new THREE.CylinderGeometry(5.6, 5.6, 0.65, 56), M(0x6e6680), 0.03, lid);
  lidBand.scale.set(1, 1, 1);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 7 - row; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.32), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    w.position.set((i - (6 - row) / 2) * 1.2, -0.36, -1.2 - row * 1.15 + 3.2); // face tournée vers la caméra
    lid.add(w);
    if ((i + row) % 3 === 0) blink.push({ o: w, ph: i + row * 2 });
  }
  const ant = add(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), M(0x9aa0a8), 0.02, lid);
  ant.position.set(0, 1.3, -5.6); ant.rotation.x = Math.PI / 2;
  g.add(lid);
  // charnières
  for (const sx of [-1, 1]) { const h = add(new THREE.BoxGeometry(1.2, 0.8, 1.2), M(0x6e6680), 0.04); h.position.set(sx * 2.4, 0.8, -6.4); }

  g.userData = {
    mats, turrets,
    coreLocal: new THREE.Vector3(0, -1.2, 0),
    open: 0,
    // k = 0 fermé … 1 ouvert : les volets glissent vers l'extérieur, le cœur s'allume
    setOpen(k) {
      g.userData.open = k;
      for (const s of shutters) s.o.position.set(Math.cos(s.a) * 2.2 * k, -1.1, -Math.sin(s.a) * 2.2 * k);
      coreGlow.material.opacity = 0.2 + 0.75 * k;
      core.scale.setScalar(0.6 + 0.5 * k);
    },
    anim(t, spin = 0) {
      for (const b of blink) b.o.visible = Math.sin(t * 4 + b.ph) > -0.4;
      swirls.rotation.y = -t * (0.8 + spin * 6);
      for (const tu of turrets) tu.lamp.visible = tu.alive && Math.sin(t * 6 + tu.local.x) > 0;
    },
  };
  g.userData.setOpen(0);
  return g;
}
