// Les missions : l'histoire (bandes dessinées) et le déroulé de chaque mission.
import { dist2 } from './common.js';

// Réglages « Facile » (le jeu est pour les enfants)
export const DIFF = {
  hp: 6, soldierHp: 3, roteurHp: 34, aimTime: 0.85, boltSpeed: 6.5, shootCool: 2.6, windup: 0.75, chaseSpeed: 3.6,
  maxAimers: 2, blockAnyDir: true, roteurWindup: 0.8, stunTime: 3,
  rotHp: 3, turretHp: 5, cruiserHp: 300, flightFire: 1.15, flightBolt: 7, flightSpeed: 1,
};

const N = (text) => ({ who: null, text });
const S = (who, text) => ({ who, text });

export const MISSIONS = [
  {
    id: 1, name: 'Le désert de Sablon', desc: 'Sabre-gaz contre les soldats, puis bataille en vol au-dessus de la planète.',
    theme: 'sablon', music: 'foot', icon: 'lucas',
    intro: [
      N('Il y a longtemps, dans une galaxie très, très gazeuse…'),
      N('Sur Sablon, une petite planète de sable, vit Lucas : un garçon qui rit à chaque prout.'),
      S('roteur', 'BUUURP ! Je suis Dark Roteur ! Avec mon Étoile Puante, je vais faire puer toute la galaxie… et plus personne ne rira !'),
      S('lucas_rire', 'Hi hi hi ! Pardon… j\'ai pété.'),
      S('gazou', 'Ce rire… Le Gaz, en toi il est très fort. Ce sabre-gaz, prends-le, jeune Lucas.'),
      S('lucas', 'Un sabre qui sent le prout ? Trop bien !'),
      S('hanpopo', 'Hé, gamin ! Les soldats de Dark Roteur débarquent. Montre-leur ce que tu sais faire !'),
    ],
    outro: [
      S('hanpopo', 'Le croiseur est en miettes ! Tu pilotes comme un chef, gamin.'),
      S('pqr', 'Nous sommes vivants ? Nous sommes VIVANTS ! Je n\'y croyais plus du tout.'),
      S('r2wc', 'Bip bip bouuu… PROUT !'),
      S('gazou', 'Mais Dark Roteur t\'attend, sur le plateau des Rots. Prêt, tu dois être.'),
    ],
  },
  {
    id: 2, name: 'Le duel du plateau des Rots', desc: 'Duel au sabre-gaz contre Dark Roteur en personne !',
    theme: 'plateau', music: 'duel', icon: 'roteur',
    intro: [
      N('Le plateau des Rots, au coucher du soleil…'),
      S('roteur', 'Alors c\'est toi, le petit rigolo ? Personne ne rit devant Dark Roteur ! BUUURP !'),
      S('lucas', 'Que le Gaz soit avec moi !'),
      S('gazou', 'Ses coups, pare-les avec le bouclier 🛡. Tous ses coups parés, sonné il sera. Alors, frappe !'),
    ],
    outro: [
      S('roteur', 'Noooon… Battu par un enfant qui pète… Ce n\'est pas fini, Lucas ! Mon Étoile Puante t\'attend !'),
      S('lucas_rire', 'Hi hi hi ! Le Gaz était avec moi !'),
      S('gazou', 'Un vrai chevalier du Gaz, tu es devenu.'),
      N('Mais l\'Étoile Puante flotte toujours dans l\'espace… À suivre !'),
    ],
  },
  { id: 3, name: 'L\'Étoile Puante', desc: 'Bientôt : l\'attaque de la station de Dark Roteur.', soon: true, icon: 'pqr' },
];

// ---------- mission 1, à pied ----------
export function* footSablon(g) {
  const hud = g.ctx.hud;
  hud.objective('Écoute Maître Gazou');
  yield 1;
  g.say('gazou', 'Ton sabre-gaz, essaie ! Touche un soldat avec ton doigt, et Lucas le frappera.', 4.5);
  hud.tip('atk');
  yield 2;
  hud.objective('Chasse les soldats !');
  g.dropGroup(['ventouse', 'ventouse'], null, 6);
  yield 1.5; yield g.clear();
  hud.tip(null);
  g.say('gazou', 'Bien ! Leurs bulles, renvoie-les : garde le bouclier 🛡 appuyé !', 4.5);
  hud.tip('block');
  yield 2;
  g.dropGroup(['tireur', 'tireur', 'tireur'], null, 8);
  yield 1.5; yield g.clear();
  hud.tip(null);
  g.say('hanpopo', 'Des Rot-fighters arrivent ! Sors des cercles rouges… ou saute par-dessus avec 🌀, comme un chevalier !', 4.5);
  hud.tip('jump');
  hud.objective('Évite les bombes !');
  yield 1.5;
  g.strafe(); yield 3.5; g.strafe(); yield 3;
  hud.tip(null);
  hud.objective('Chasse les soldats !');
  g.dropGroup(['ventouse', 'tireur', 'ventouse', 'tireur'], null, 7);
  yield 2;
  while (g.alive > 0) { yield 6.5; if (g.alive > 0) g.strafe(); }
  if (g.hero.mega >= 1) { g.say('gazou', 'Pleine, ta jauge de gaz est ! Appuie sur 💨 pour le Méga-Prout !', 4); hud.tip('mega'); }
  else g.say('pqr', 'Encore des soldats ! Nous sommes perdus, perdus, PERDUS !', 3.5);
  yield 2;
  g.dropGroup(['tireur', 'ventouse', 'tireur', 'ventouse', 'tireur'], null, 8);
  yield 2;
  while (g.alive > 0) { yield 6; if (g.alive > 0) g.strafe(); }
  hud.tip(null);
  yield 1;
  g.say('gazou', 'Ton vaisseau, rejoins ! Au nord, il est. Ah, et R2-WC le répare encore…', 4.5);
  hud.objective('Monte dans le chasseur-WC !');
  g.world.beaconOn = true;
  hud.pointer(g.world.wcSpot);
  const near = () => dist2(g.hero.pos, g.world.wcSpot) < 3.4;
  for (;;) {
    yield near;
    hud.action('MONTER');
    yield () => !near() || g.ctx.input.action;
    if (near() && g.ctx.input.action) break;
    hud.action(null);
  }
  hud.action(null); hud.pointer(null);
  g.world.beaconOn = false;
  g.result = { type: 'board' };
}

// ---------- mission 1, en vol ----------
export function* flightSablon(f) {
  const hud = f.ctx.hud;
  f.addHan();
  f.say('hanpopo', 'Décollage ! Je te couvre, gamin. Glisse le doigt pour piloter, ton vaisseau tire tout seul !', 4.5);
  hud.objective('Dégonfle les vaisseaux de Dark Roteur');
  yield 3;
  f.rotWave('line', 5); yield 4;
  f.turrets(2); yield 3;
  f.rotWave('v', 7); yield 2; yield f.clear();
  if (f.han) f.han.leave = true;
  f.say('hanpopo', 'Mon Faucon a besoin d\'une réparation. Attention aux kamikazes qui clignotent : bouge !', 4);
  f.rotWave('kami', 3); yield 3.5;
  f.rotWave('left', 5); yield 2.5; f.rotWave('right', 5); yield 2;
  f.rotWave('lowLeft', 4); yield 3;
  f.turrets(3); yield 2;
  f.rotWave('hover', 3); yield 2; yield f.clear();
  f.say('r2wc', 'Bip bip ! Bip bouuu ! (traduction : ils arrivent par en bas, attention !)', 3.5);
  f.rotWave('lowRight', 5); yield 2; f.rotWave('kami', 4); yield 3;
  f.rotWave('line', 6); f.turrets(2); yield 4;
  f.rotWave('v', 7); yield 2; f.rotWave('lowLeft', 4); yield 2; yield f.clear();
  f.say('gazou', 'Les canons au sol, vise ! Ils lâchent souvent des bonus.', 3.5);
  f.turrets(3); yield 2.5; f.rotWave('left', 4); yield 2; f.rotWave('right', 4); yield 2; f.rotWave('kami', 4); yield 3;
  f.rotWave('hover', 4); yield 2; yield f.clear();
  f.rotWave('lowRight', 5); f.rotWave('lowLeft', 5); yield 3; f.turrets(2); f.rotWave('kami', 5); yield 2; yield f.clear();
  if (f.ship.mega >= 1) f.say('gazou', 'Pleine, ta jauge est. Le Méga-Prout 💨, garde-le pour la ventouse !', 4);
  yield 2;
  f.say('pqr', 'Une ventouse ! Une ÉNORME ventouse ! Elle va nous déboucher !', 3.5);
  hud.banner('ATTENTION : CROISEUR-VENTOUSE !', 2.5);
  yield 1;
  f.boss();
  hud.objective('Dégonfle le Croiseur-Ventouse ! Bouge quand la bande rouge clignote !');
}

// ---------- mission 2, le duel ----------
export function* duelPlateau(g) {
  const hud = g.ctx.hud;
  const r = g.spawnRoteur(0, -7);
  hud.boss('DARK ROTEUR', 1);
  hud.objective('Bats Dark Roteur en duel !');
  yield 1;
  hud.tip('block');
  yield 5;
  hud.tip(null);
  yield () => r.dead;
  g.hero.cheer = true;
  yield 3.5;
  g.result = { type: 'win' };
}
