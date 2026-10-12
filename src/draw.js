// Dessins PROVISOIRES (formes simples) en attendant les planches Gemini.
export const OUT = '#3b2414'; // contour marron foncé, comme les dessins de Pokepetro

// Vrais dessins (planche 2 découpée) : utilisés dès qu'ils sont chargés
const IMG = {};
for (const n of ['wc', 'rotfighter', 'crotte', 'ventouse', 'tir_vert', 'tir_violet', 'bonus', 'etoile', 'faucon']) {
  IMG[n] = new Image(); IMG[n].src = `assets/vaisseaux/${n}.webp`;
}
const ok = n => IMG[n].complete && IMG[n].naturalWidth > 0;

// Personnages (planche 1) et leurs portraits ronds pour la radio
export const PERSO = {}, PORTRAIT = {};
for (const n of ['lucas', 'lucas_rire', 'roteur', 'gazou', 'r2wc', 'pqr', 'soldat', 'hanpopo']) {
  PERSO[n] = new Image(); PERSO[n].src = `assets/persos/${n}.webp`;
}
for (const n of ['lucas', 'gazou', 'hanpopo', 'pqr', 'r2wc', 'roteur', 'soldat']) {
  PORTRAIT[n] = new Image(); PORTRAIT[n].src = `assets/portraits/${n}.webp`;
}
export const ready = im => !!im && im.complete && im.naturalWidth > 0;
// personnage debout : pieds en (x, y), haut de h, retourné si flip
export function figure(ctx, n, x, y, h, flip = false) {
  const im = PERSO[n];
  if (!ready(im)) return;
  const w = h * im.naturalWidth / im.naturalHeight;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h, w, h);
  ctx.restore();
}
// dessine l'image n centrée en (x, y), haute de h, décalée de dy une fois tournée
export function sprite(ctx, n, x, y, h, rot = 0, flash = 0, dy = 0) {
  const im = IMG[n], w = h * im.naturalWidth / im.naturalHeight;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.drawImage(im, -w / 2, -h / 2 + dy, w, h);
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
    ctx.drawImage(im, -w / 2, -h / 2 + dy, w, h);
  }
  ctx.restore();
}

function line(ctx, w = 4) { ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
function ell(ctx, x, y, rx, ry, fill, w = 4) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill(); if (w) { line(ctx, w); ctx.stroke(); }
}
function poly(ctx, pts, fill, w = 4) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (w) { line(ctx, w); ctx.stroke(); }
}
function rrect(ctx, x, y, w, h, r, fill, lw = 4) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill(); if (lw) { line(ctx, lw); ctx.stroke(); }
}

// Le chasseur-WC de Lucas, vu de dessus, le nez vers le haut
export function toilet(ctx, x, y, s, t, tilt = 0) {
  if (ok('wc')) return sprite(ctx, 'wc', x, y, 88 * s, tilt);
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  // flammes de gaz vertes à l'arrière
  for (const fx of [-9, 9]) {
    const L = 20 + Math.sin(t * 40 + fx) * 6;
    ctx.beginPath(); ctx.moveTo(fx - 7, 30); ctx.quadraticCurveTo(fx, 30 + L * 1.4, fx + 7, 30);
    ctx.fillStyle = 'rgba(120,255,80,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(fx - 4, 30); ctx.quadraticCurveTo(fx, 30 + L, fx + 4, 30);
    ctx.fillStyle = '#eaffc0'; ctx.fill();
  }
  // ailes
  poly(ctx, [-14, 2, -42, 16, -40, 27, -14, 21], '#9fc4e0');
  poly(ctx, [14, 2, 42, 16, 40, 27, 14, 21], '#9fc4e0');
  // réservoir (l'arrière)
  rrect(ctx, -19, 8, 38, 24, 7, '#f2f2f2');
  ctx.fillStyle = '#c9c9c9'; ctx.fillRect(-12, 17, 24, 4);
  // cuvette + lunette
  ell(ctx, 0, -10, 23, 27, '#fbfbfb');
  ell(ctx, 0, -12, 16, 19, '#e3e3e3', 3);
  ell(ctx, 0, -12, 10, 13, '#8fd3ff', 3);
  // Lucas vu de dessus (cheveux) dans le cockpit
  ell(ctx, 0, -11, 6, 6, '#7a4a22', 2);
  ctx.restore();
}

// Rot-fighter de Dark Roteur, le nez vers le bas
export function burpFighter(ctx, x, y, s, rot = 0, flash = 0) {
  if (ok('rotfighter')) return sprite(ctx, 'rotfighter', x, y, 64 * s, rot + Math.PI, flash);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  line(ctx, 5); ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.stroke();
  for (const sx of [-1, 1]) {
    poly(ctx, [sx * 24, -28, sx * 38, -18, sx * 38, 18, sx * 24, 28, sx * 20, 0], '#7b3fa0');
    line(ctx, 2); ctx.beginPath();
    ctx.moveTo(sx * 27, -16); ctx.lineTo(sx * 34, -10); ctx.moveTo(sx * 27, 16); ctx.lineTo(sx * 34, 10);
    ctx.stroke();
  }
  ell(ctx, 0, 0, 17, 17, '#5e5e6c');
  ell(ctx, 0, 4, 8, 8, '#2a1d3d', 3);
  ell(ctx, -2, 2, 2.5, 2.5, '#c78bff', 0);
  if (flash > 0) { ctx.globalAlpha = 0.7; ell(ctx, 0, 0, 38, 30, '#ffffff', 0); }
  ctx.restore();
}

// Astéroïde en forme de crotte (vu de dessus : spirale)
export function poop(ctx, x, y, s, rot = 0, flash = 0) {
  if (ok('crotte')) return sprite(ctx, 'crotte', x, y, 70 * s, rot, flash);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ell(ctx, 0, 0, 31, 29, '#6e4220');
  ell(ctx, 3, -2, 22, 21, '#875329', 3);
  ell(ctx, 5, -4, 13, 12, '#a06636', 3);
  ell(ctx, 7, -6, 4, 4, '#b97a45', 2);
  for (const [cx, cy, r] of [[-18, 10, 4], [-8, 20, 3], [16, 16, 3.5], [-20, -8, 3]]) ell(ctx, cx, cy, r, r, '#4e2e15', 0);
  if (flash > 0) { ctx.globalAlpha = 0.6; ell(ctx, 0, 0, 31, 29, '#ffffff', 0); }
  ctx.restore();
}

// Croiseur-Ventouse (en forme de ventouse de toilettes), la ventouse vers le bas
export function cruiser(ctx, x, y, s, rot = 0, flash = 0, t = 0) {
  // la ventouse (en bas du dessin) est en (x, y + 10), le manche monte vers le haut
  if (ok('ventouse')) return sprite(ctx, 'ventouse', x, y, 300 * s, rot, flash, -90);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  // réacteurs violets en haut
  for (const ex of [-9, 9]) {
    const L = 16 + Math.sin(t * 30 + ex) * 5;
    ctx.beginPath(); ctx.moveTo(ex - 6, -168); ctx.quadraticCurveTo(ex, -168 - L, ex + 6, -168);
    ctx.fillStyle = 'rgba(200,110,255,0.7)'; ctx.fill();
  }
  // manche
  rrect(ctx, -20, -170, 40, 190, 12, '#4d4d5c');
  ctx.fillStyle = '#6b6b7d'; ctx.fillRect(-12, -160, 6, 170);
  for (let i = 0; i < 5; i++) ell(ctx, 0, -140 + i * 30, 5, 4, '#ffd76a', 2);
  // ventouse
  ctx.beginPath(); ctx.moveTo(-88, 30);
  ctx.bezierCurveTo(-88, -30, 88, -30, 88, 30);
  ctx.quadraticCurveTo(0, 62, -88, 30); ctx.closePath();
  ctx.fillStyle = '#7a2c3e'; ctx.fill(); line(ctx, 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-70, 18); ctx.bezierCurveTo(-60, -12, 60, -12, 70, 18);
  line(ctx, 3); ctx.stroke();
  ell(ctx, 0, 6, 26, 12, '#3a1420', 3);
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6); ell(ctx, 0, 6, 16, 7, '#b34cff', 0); ctx.globalAlpha = 1;
  // canons
  for (const cx of [-70, 70]) { ell(ctx, cx, 34, 9, 9, '#4d4d5c', 3); ell(ctx, cx, 40, 4, 4, '#2a1d3d', 0); }
  if (flash > 0) {
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff';
    ctx.fillRect(-20, -170, 40, 190); ctx.beginPath(); ctx.ellipse(0, 18, 88, 40, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export const BONUS = {
  triple: { color: '#7dff5a', name: 'Tir triple !' },
  shield: { color: '#5ee0ff', name: 'Bouclier de gaz !' },
  r2: { color: '#ffb84a', name: 'R2-WC en renfort !' },
};

// Capsule bonus avec un haricot dedans
export function capsule(ctx, x, y, kind, t) {
  const c = BONUS[kind].color;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 3) * 0.25);
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 8);
  ell(ctx, 0, 0, 34, 34, c, 0); ctx.globalAlpha = 1;
  if (ok('bonus')) { sprite(ctx, 'bonus', 0, 0, 50, Math.PI / 2); ctx.restore(); return; }
  rrect(ctx, -24, -14, 48, 28, 14, '#ffffffcc');
  ctx.save(); ctx.globalAlpha = 0.55; rrect(ctx, -24, -14, 48, 28, 14, c, 0); ctx.restore();
  // haricot
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#a5402a'; ctx.fill(); line(ctx, 3); ctx.stroke();
  ell(ctx, -3, -2, 3, 1.6, '#e0866a', 0);
  rrect(ctx, -24, -14, 48, 28, 14, 'rgba(0,0,0,0)', 4);
  ctx.restore();
}

// R2-WC vu de dessus : un petit WC rond avec un dôme bleu
export function r2(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ell(ctx, 0, 0, 14, 14, '#f4f4f4', 3);
  ell(ctx, 0, -1, 9, 9, '#3f7fe0', 3);
  ell(ctx, 3, -4, 2.5, 2.5, Math.sin(t * 12) > 0 ? '#ff4040' : '#ffe0e0', 0);
  ctx.restore();
}

export function shotGreen(ctx, x, y, ang = 0) {
  if (ok('tir_vert')) return sprite(ctx, 'tir_vert', x, y, 42, ang);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(110,255,80,0.35)'; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke();
  ctx.strokeStyle = '#e4ffc4'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
}

export function shotPurple(ctx, x, y, t, ang = Math.PI) {
  if (ok('tir_violet')) return sprite(ctx, 'tir_violet', x, y, 40, ang);
  const r = 9 + Math.sin(t * 20) * 1.5;
  ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(190,90,255,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fillStyle = '#f3dcff'; ctx.fill();
}

export function heart(ctx, x, y, s, fill = '#ff5a6e') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-14, -4, -8, -14, 0, -6);
  ctx.bezierCurveTo(8, -14, 14, -4, 0, 6);
  ctx.fillStyle = fill; ctx.fill(); line(ctx, 2.5); ctx.stroke();
  ctx.restore();
}
