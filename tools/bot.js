// Robot de test : à coller dans la console du navigateur pendant une partie.
// À pied : il fonce vers l'ennemi le plus proche, frappe, pare quand un tir arrive, monte dans le vaisseau.
// En vol : il esquive en zigzag sous les ennemis.
window.gdgBot = (input, mode, name) => {
  if (name === 'foot') {
    const h = mode.hero;
    const SRx = Math.SQRT1_2, SRz = -Math.SQRT1_2, SUx = -Math.SQRT1_2, SUz = -Math.SQRT1_2;
    let tgt = null, best = 1e9;
    for (const e of mode.enemies) if (!e.dead && e.state !== 'drop') { const d = Math.hypot(e.pos.x - h.pos.x, e.pos.z - h.pos.z); if (d < best) { best = d; tgt = e; } }
    if (!tgt && mode.world.beaconOn) tgt = { pos: mode.world.wcSpot };
    const danger = mode.bolts.some((b) => !b.reflected && Math.hypot(b.g.position.x - h.pos.x, b.g.position.z - h.pos.z) < 3.5)
      || (mode.roteur && !mode.roteur.dead && ['windup', 'strike', 'burpUp', 'throw'].includes(mode.roteur.state));
    input.block = danger;
    if (tgt) {
      const dx = tgt.pos.x - h.pos.x, dz = tgt.pos.z - h.pos.z;
      const far = Math.hypot(dx, dz) > (tgt.f ? 2.2 : 1);
      if (far && !danger) { input.move.x = dx * SRx + dz * SRz; input.move.y = dx * SUx + dz * SUz; const l = Math.hypot(input.move.x, input.move.y) || 1; input.move.x /= l; input.move.y /= l; }
      if (!far && tgt.f && !danger) input.attack = Math.random() < 0.5;
    }
    if (h.mega >= 1) input.mega = true;
    input.action = true;
  } else if (name === 'flight') {
    // il se place sous l'ennemi le plus proche et s'écarte des tirs, des kamikazes et de la ventouse
    const p = mode.ship;
    let tx = 0, best = 1e9;
    for (const e of mode.enemies) if (!e.dead && e.kind !== 'turret' && e.dying === undefined) { const d = Math.abs(e.x - p.x) + Math.max(0, e.y - p.y) * 0.2; if (d < best) { best = d; tx = e.x; } }
    let mx = (tx - p.x) * 0.5, my = (-mode.Yh * 0.55 - p.y) * 0.4;
    const flee = (x, y, r, k) => { const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy); if (d < r && d > 0.01) { mx += dx / d * k * (r - d); my += dy / d * k * (r - d) * 0.5; } };
    for (const s of mode.eshots) flee(s.x, s.y, 3.2, 1.6);
    for (const e of mode.enemies) if (!e.dead && e.kind !== 'turret' && e.dying === undefined) flee(e.x, e.y, e.kind === 'boss' ? 6 : 3.5, 1.4);
    if (mode.bossE && ['aim', 'plunge'].includes(mode.bossE.phase)) mx += (p.x - mode.bossE.x > 0 ? 1 : -1) * 3;
    const l = Math.hypot(mx, my); input.move.x = l > 1 ? mx / l : mx; input.move.y = l > 1 ? my / l : my;
    if (p.mega >= 1 && mode.bossE) input.mega = true;
  }
};
