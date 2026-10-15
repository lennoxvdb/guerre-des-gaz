// Les missions : l'histoire (bandes dessinées) et le déroulé de chaque mission.
import { dist2, pick } from './common.js';

// Réglages « Facile » (le jeu est pour les enfants)
export const DIFF = {
  hp: 6, soldierHp: 3, roteurHp: 56, aimTime: 0.85, boltSpeed: 6.5, shootCool: 2.6, windup: 0.75, chaseSpeed: 3.6,
  maxAimers: 2, blockAnyDir: true, roteurWindup: 0.8, stunTime: 3,
  rotHp: 3, turretHp: 5, cruiserHp: 300, flightFire: 1.15, flightBolt: 7, starHp: 110, bolideHp: 70, capitaineHp: 26, flightSpeed: 1,
};

const N = (text) => ({ who: null, text });
const S = (who, text) => ({ who, text });

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
  while (g.alive > 0) { const t0 = g.t; yield () => g.alive === 0 || g.t - t0 > 6.5; if (g.alive > 0) g.strafe(); }
  if (g.hero.mega >= 1) { g.say('gazou', 'Pleine, ta jauge de gaz est ! Appuie sur 💨 pour le Méga-Prout !', 4); hud.tip('mega'); }
  else g.say('pqr', 'Encore des soldats ! Nous sommes perdus, perdus, PERDUS !', 3.5);
  yield 2;
  g.dropGroup(['tireur', 'ventouse', 'tireur', 'ventouse', 'tireur'], null, 8);
  yield 2;
  while (g.alive > 0) { const t0 = g.t; yield () => g.alive === 0 || g.t - t0 > 6; if (g.alive > 0) g.strafe(); }
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
    const t0 = g.t; // il monte tout seul s'il reste un peu à côté du vaisseau
    yield () => !near() || g.ctx.input.action || g.t - t0 > 1.2;
    if (near()) break;
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
  if (f.from !== 'boss') {
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
  f.rotWave('v', 7); f.turrets(2); yield 2; f.rotWave('lowLeft', 4); yield 2; yield f.clear();
  f.say('gazou', 'Les canons au sol, vise ! Ils lâchent souvent des bonus.', 3.5);
  f.turrets(3); yield 2.5; f.rotWave('left', 4); yield 2; f.rotWave('right', 4); yield 2; f.rotWave('kami', 4); yield 3; yield f.clear();
  }
  f.checkpoint('boss');
  if (f.ship.mega >= 1) f.say('gazou', 'Pleine, ta jauge est. Le Méga-Prout 💨, garde-le pour la ventouse !', 4);
  yield 2;
  f.say('pqr', 'Une ventouse ! Une ÉNORME ventouse ! Elle va nous déboucher !', 3.5);
  hud.banner('ATTENTION : CROISEUR-VENTOUSE !', 2.5);
  yield 1;
  f.boss();
  hud.objective('Dégonfle le Croiseur-Ventouse ! Bouge quand la bande rouge clignote !');
}

// ---------- les 6 missions ----------
// parts : les morceaux de la mission, dans l'ordre (foot = à pied, flight = en vol, speeder = en motojet)
export const MISSIONS = [
  {
    id: 1, name: 'Le désert de Sablon', desc: 'Sabre-gaz contre les soldats, puis bataille en vol au-dessus de la planète.',
    theme: 'sablon', icon: 'assets/persos/lucas.webp', parts: ['foot', 'flight'],
    foot: { script: footSablon, start: [0, 0, 9], radius: 30, music: 'foot' },
    flight: { script: flightSablon },
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
      S('gazou', 'Dark Roteur, trop fort pour toi il est encore. Chez moi, dans les marais de Gazouland, t\'entraîner tu vas.'),
    ],
  },
  {
    id: 2, name: 'Les marais de Gazouland', desc: 'Entraînement chez Maître Gazou, les gros soldats, et le duel contre le Capitaine Burpo.',
    theme: 'marais', icon: 'assets/persos/gazou.webp', parts: ['foot'],
    foot: { script: footMarais, start: [0, 0, 6], radius: 26, music: 'foot' },
    intro: [
      N('Les marais de Gazouland. Ici, tout est vert, mou… et ça sent très fort.'),
      S('gazou', 'Bienvenue chez moi, jeune Lucas. Sauter, parer, frapper : tout t\'apprendre je vais.'),
      S('lucas', 'Ça sent drôlement bon ici… enfin, drôlement FORT !'),
      S('r2wc', 'Bip bip ! (R2-WC garde les plans secrets de l\'Étoile Puante dans son réservoir.)'),
    ],
    outro: [
      S('capitaine', 'Aïe aïe aïe… Soldats ! Prenez le petit robot et filez en motojet !'),
      S('pqr', 'Oh non ! Ils ont enlevé R2-WC ! Avec les plans de l\'Étoile Puante dans son réservoir !'),
      S('gazou', 'Une motojet, derrière ma cabane, il y a. Vite, Lucas !'),
    ],
  },
  {
    id: 3, name: 'La course des motojets', desc: 'Poursuite en motojet dans la forêt : évite les arbres et sauve R2-WC !',
    theme: 'marais', icon: 'assets/persos/r2wc.webp', parts: ['speeder'],
    speeder: { script: speederRace, music: 'speeder' },
    intro: [
      N('La forêt des marais. Les soldats de Dark Roteur filent en motojet avec R2-WC…'),
      S('lucas', 'Accroche-toi, R2 ! J\'arrive !'),
      S('gazou', 'Glisse le doigt pour piloter. Les arbres, évite ! Les soldats à côté de toi, au sabre ⚔ tape-les.'),
    ],
    outro: [
      S('r2wc', 'Bip bip ! BIP BIP PROUT ! (merci Lucas !)'),
      S('pqr', 'Les plans ! Je les lis… Le point faible de l\'Étoile Puante est… le trou de la chasse d\'eau ! Évidemment.'),
      S('hanpopo', 'Allô gamin ? C\'est Han ! On m\'a capturé dans la cité des nuages ! Viens vite me sortir de là !'),
    ],
  },
  {
    id: 4, name: 'La cité des nuages', desc: 'Mission au jetpack : vole au-dessus de la ville et libère Han Popo !',
    theme: 'nuages', icon: 'assets/persos/hanpopo.webp', parts: ['foot'],
    foot: { script: footNuages, start: [0, 0, 4], radius: 32, jet: true, music: 'foot' },
    intro: [
      N('La cité des nuages flotte très haut dans le ciel. Han Popo y est prisonnier dans une bulle…'),
      S('gazou', 'Ce jetpack à prout, prends. Voler, tu vas !'),
      S('lucas_rire', 'Wouhou ! Je vole ! Hi hi hi, ça chatouille !'),
      S('hanpopo', 'Gamin ! Ma bulle-prison est gardée par 3 générateurs. Casse-les tous !'),
    ],
    outro: [
      S('hanpopo', 'Merci gamin ! Tu voles comme un vrai pilote. Le Faucon Pétulant est réparé…'),
      S('pqr', 'Et nous avons les plans. Je crains le pire : nous allons attaquer l\'Étoile Puante, c\'est ça ?'),
      S('hanpopo', 'Exactement, boîte de conserve ! Direction : l\'Étoile Puante !'),
    ],
  },
  {
    id: 5, name: 'L\'attaque de l\'Étoile Puante', desc: 'Bataille dans l\'espace, puis fonce dans la tranchée et tire dans le trou de la chasse d\'eau !',
    theme: 'espace', icon: 'assets/vaisseaux/etoile.webp', parts: ['flight', 'trench'],
    flight: { script: flightStar },
    intro: [
      N('Dans l\'espace, la Rébellion du Rire attaque l\'Étoile Puante…'),
      S('pqr', 'Il faut voler dans la tranchée de la station, jusqu\'au trou de la chasse d\'eau. Un seul bon tir, et PLOUF !'),
      S('hanpopo', 'Je te couvre, gamin ! Attention aux crottes de l\'espace !'),
    ],
    outro: [
      S('lucas_rire', 'Hi hi hi ! Je crois que quelqu\'un a tiré la chasse !'),
      S('roteur', 'Vous n\'avez pas encore gagné… Je t\'attends dans le cœur de l\'Étoile Puante, petit rigolo. BUUURP !'),
      S('gazou', 'Le moment est venu. Dark Roteur, affronter tu dois.'),
    ],
  },
  {
    id: 6, name: 'Le cœur de l\'Étoile Puante', desc: 'Dans la station, puis le grand duel final contre Dark Roteur !',
    theme: 'station', icon: 'assets/persos/roteur.webp', parts: ['foot', 'versus'],
    foot: { script: footStation, start: [0, 0, 10], radius: 22, indoor: true, music: 'foot' },
    intro: [
      N('À l\'intérieur de l\'Étoile Puante… ça sent TRÈS, TRÈS fort.'),
      S('lucas', 'Beurk ! Même moi, je trouve que ça pue !'),
      S('gazou', 'Très fort, Dark Roteur est. Mais seul, tu n\'es pas. Que le Gaz soit avec toi !'),
    ],
    outro: [
      S('roteur', 'Noooon… Battu par un enfant qui pète…'),
      S('lucas', 'Prrrrout ! Oups… pardon.'),
      S('roteur', '… Pfff… Ha… HA HA HA ! C\'est… c\'est drôle, en fait !'),
      S('gazou', 'Le rire, retrouvé il a. Du côté lumineux du Gaz, Dark Roteur revient.'),
      N('Pour la première fois, Dark Roteur rit. L\'Étoile Puante est vidée, et toute la galaxie rit de nouveau !'),
      S('hanpopo', 'Une fête, gamin ! Avec des haricots pour tout le monde !'),
      N('FIN. Que le Gaz soit avec toi !'),
    ],
  },
];

// ---------- mission 2 : les marais de Gazouland ----------
export function* footMarais(g) {
  const hud = g.ctx.hud;
  if (g.from !== 'burpo') {
  hud.objective('Entraîne-toi avec Maître Gazou');
  yield 1;
  g.say('gazou', 'Un saut de chevalier, fais. Touche 🌀 !', 4);
  hud.tip('jump');
  yield () => g.hero.jumpT > 0 || g.t > 14;
  hud.tip(null);
  g.say('gazou', 'Bien ! Maintenant, de vrais ennemis… Ils arrivent !', 3.5);
  yield 2;
  hud.objective('Chasse les soldats !');
  g.dropGroup(['ventouse', 'tireur', 'ventouse'], null, 7);
  yield 1.5; yield g.clear();
  g.say('pqr', 'Un ÉNORME soldat ! Il tape très fort, attention !', 3.5);
  yield 1;
  g.dropGroup(['gros', 'tireur'], null, 7);
  yield 2;
  g.say('gazou', 'Ses coups, pare-les 🛡. Ou sauter derrière lui tu peux.', 4);
  yield g.clear();
  g.dropGroup(['gros', 'ventouse', 'tireur', 'tireur'], null, 8);
  yield 2; yield g.clear();
  }
  g.checkpoint('burpo');
  yield 1;
  g.ctx.music('duel');
  hud.banner('LE CAPITAINE BURPO !', 2.5);
  const c = g.spawnRoteur(0, -9, { who: 'capitaine', name: 'CAPITAINE BURPO', voice: 'capitaine', hp: g.ctx.diff.capitaineHp, height: 3.0, saber: 0xff6a3a, throwSaber: false, summon: true });
  g.say('capitaine', 'Je suis le Capitaine Burpo, le meilleur chevalier de Dark Roteur ! BRÔÔÔT !', 4);
  hud.boss('CAPITAINE BURPO', 1);
  hud.objective('Bats le Capitaine Burpo en duel !');
  yield 1;
  hud.tip('block');
  yield 5;
  hud.tip(null);
  yield () => c.dead;
  g.hero.cheer = true;
  yield 3;
  g.result = { type: 'win' };
}

// ---------- mission 3 : la course des motojets ----------
export function* speederRace(sp) {
  const hud = sp.ctx.hud;
  hud.objective('Rattrape les motojets !');
  yield 3;
  if (sp.from !== 'bolide') {
  sp.motoWave(2, true); yield 6;
  sp.motoWave(2, false); yield 2; yield sp.clear();
  sp.say('pqr', 'Plus vite, Lucas ! Ils emportent R2-WC !', 3);
  sp.treeGap = 8;
  sp.motoWave(3, true); yield 4; sp.motoWave(2, false); yield 2; yield sp.clear();
  sp.say('gazou', 'Pousse-les dans les arbres avec ton sabre ⚔, tu peux !', 3.5);
  sp.motoWave(4, true); yield 5; sp.motoWave(3, false); yield 2; yield sp.clear();
  sp.treeGap = 7;
  sp.motoWave(3, false); yield 3; sp.motoWave(3, true); yield 2; yield sp.clear();
  }
  sp.checkpoint('bolide');
  sp.treeGap = 12;
  yield 1.5;
  hud.banner('LE GROS BOLIDE !', 2.5);
  sp.say('r2wc', 'BIIIP ! BIP BIP ! (au secours, je suis dans le gros bolide !)', 3.5);
  sp.boss();
  hud.objective('Arrête le Gros Bolide ! Évite ses mines !');
}

// ---------- mission 4 : la cité des nuages (jetpack) ----------
export function* footNuages(g) {
  const hud = g.ctx.hud;
  const P = g.addPrison(0, -24);
  for (const [x, z] of [[-16, -10], [15, -12], [-14, 14]]) g.addGenerator(x, z);
  hud.objective('Détruis les 3 générateurs (0/3)');
  yield 1;
  g.say('gazou', 'Au-dessus des petites maisons, voler tu peux. Les tours, contourne-les.', 4);
  yield 2;
  g.dropGroup(['tireur', 'ventouse'], null, 8);
  let waveT = 0;
  while (g.gensLeft > 0) {
    // la flèche montre le générateur le plus proche
    let best = null;
    for (const e of g.enemies) if (e.kind === 'gen' && !e.dead && (!best || dist2(e.pos, g.hero.pos) < dist2(best.pos, g.hero.pos))) best = e;
    hud.pointer(best && best.pos);
    hud.objective(`Détruis les 3 générateurs (${3 - g.gensLeft}/3)`);
    // des gardes arrivent quand Lucas s'approche d'un générateur
    for (const e of g.enemies) if (e.kind === 'gen' && !e.dead && !e.guarded && dist2(e.pos, g.hero.pos) < 14) {
      e.guarded = true;
      g.dropGroup(['tireur', 'ventouse', 'tireur'], e.pos, 4);
      g.say(pick(['pqr', 'hanpopo']), pick(['Des gardes ! Attention !', 'Ils protègent le générateur, gamin !']), 2.5);
    }
    waveT += 1;
    if (waveT > 7 && g.alive < 4) { waveT = 0; g.dropGroup(pick(['tireur', 'ventouse']) === 'tireur' ? ['tireur', 'tireur'] : ['ventouse', 'tireur', 'ventouse'], null, 8); }
    yield 1;
  }
  hud.pointer(null);
  g.freePrison();
  g.say('hanpopo', 'La bulle a éclaté ! Des soldats arrivent… Couvre-moi, gamin !', 3.5);
  hud.objective('Chasse les gardes de Han Popo !');
  g.dropGroup(['gros', 'tireur', 'ventouse', 'tireur'], P.pos, 7);
  yield 2; yield g.clear();
  g.say('hanpopo', 'Bien joué ! Viens me chercher, on file !', 3);
  hud.objective('Rejoins Han Popo !');
  hud.pointer(P.pos);
  yield () => dist2(g.hero.pos, P.pos) < 4;
  hud.pointer(null);
  g.hero.cheer = true;
  yield 2.5;
  g.result = { type: 'win' };
}

// ---------- mission 5 : l'attaque de l'Étoile Puante (dans l'espace) ----------
export function* flightStar(f) {
  const hud = f.ctx.hud;
  f.addHan();
  hud.objective('Fonce vers l\'Étoile Puante !');
  yield 3;
  f.asteroids(3); yield 4;
  f.rotWave('line', 5); yield 3;
  f.asteroids(4); yield 3; yield f.clear();
  if (f.han) f.han.leave = true;
  f.rotWave('kami', 3); f.asteroids(3); yield 4;
  f.rotWave('v', 7); yield 2; f.rotWave('lowLeft', 4); yield 3; yield f.clear();
  f.say('pqr', 'Encore des crottes ! Pourquoi faut-il TOUJOURS qu\'il y ait des crottes ?!', 3.5);
  f.asteroids(5); yield 3; f.rotWave('hover', 4); yield 3; f.rotWave('lowRight', 5); yield 2; yield f.clear();
  f.rotWave('kami', 4); f.asteroids(3); yield 3; f.rotWave('left', 5); yield 2; f.rotWave('right', 5); yield 3; yield f.clear();
  yield 1.5;
  hud.banner('L\'ÉTOILE PUANTE !', 2.5);
  f.say('hanpopo', 'Vas-y gamin, plonge dans la tranchée ! Moi, je m\'occupe des autres.', 4);
  yield 3;
  f.result = { type: 'next', part: 'trench' }; // la suite en 3D, derrière le vaisseau
}

// ---------- mission 6 : le cœur de l'Étoile Puante, et le duel final ----------
export function* footStation(g) {
  const hud = g.ctx.hud;
  hud.objective('Avance dans l\'Étoile Puante');
  yield 2;
  g.dropGroup(['ventouse', 'tireur', 'ventouse'], null, 7);
  yield 1.5; yield g.clear();
  g.say('pqr', 'Des soldats partout ! Et ça pue ! Je déteste cette station !', 3.5);
  g.dropGroup(['gros', 'tireur', 'tireur'], null, 8);
  yield 2; yield g.clear();
  g.dropGroup(['gros', 'gros', 'ventouse', 'tireur'], null, 8);
  yield 2; yield g.clear();
  g.say('hanpopo', 'Gamin, ils arrivent de partout ! Tiens bon !', 3);
  g.dropGroup(['tireur', 'tireur', 'ventouse', 'gros', 'ventouse'], null, 9);
  yield 2; yield g.clear();
  yield 1;
  g.say('roteur', 'Alors, petit rigolo… On se retrouve enfin. BUUUURP !', 4);
  g.ctx.music('duel');
  hud.banner('DARK ROTEUR !', 2.5);
  yield 2.5;
  g.result = { type: 'next', part: 'versus' }; // le duel final, à la Street Fighter
}

// le duel libre (bouton « 🥊 Duel » de l'accueil)
export const DUEL = {
  id: 'duel', name: 'Duel contre Dark Roteur', theme: 'station', parts: ['versus'],
  intro: [S('roteur', 'Encore toi, petit rigolo ? En garde ! BUUURP !'), S('lucas', 'Que le Gaz soit avec moi !')],
  outro: [S('lucas_rire', 'Ha ha ! Encore gagné !'), S('roteur', 'Grrr… La prochaine fois, je t\'aurai… BURP.')],
};
