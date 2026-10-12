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
    const p = mode.ship, t = mode.t;
    input.move.x = Math.sin(t * 0.9) * 0.8 - p.x * 0.05; input.move.y = (-mode.Yh * 0.55 - p.y) * 0.3;
    if (p.mega >= 1 && mode.bossE) input.mega = true;
  }
};
