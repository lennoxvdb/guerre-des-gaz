# La Guerre des Gaz

Nouveau jeu, **séparé de Pokepetro** et de « La planète Prout ». C'est une **parodie de space
opera** à la Star Wars, version prout, avec Lucas en héros. Ce fichier sert à démarrer le projet
dans une nouvelle session : lis-le en entier avant de commencer, puis pose à l'utilisateur les
questions de la section « À décider ensemble » qui ne sont pas encore cochées.

## L'utilisateur et les règles de travail

- Il écrit en **français**, il **n'est pas développeur** : réponses courtes, simples, en français,
  sans jargon. Il veut voir le résultat, pas le code.
- **Toujours montrer un aperçu dans le navigateur** (images ou version jouable) avant de faire
  une version à installer. Il dit souvent « publie » directement quand ça lui plaît.
- **Outils gratuits uniquement**, aucun abonnement ni paiement sans son accord explicite.
- Ne jamais afficher ni enregistrer dans le code une clé ou un mot de passe (`../gemini-key.txt`,
  `../pokepetro-keys/`, le mot de passe admin du site Pokepetro).
- Ne pas toucher au port **3000** (c'est un autre projet de l'utilisateur, Orbilo). Pour les
  aperçus, prendre par exemple le port 8791.
- Ne jamais lancer de tests branchés sur son téléphone (ça efface les données des applis).
- Commits : terminer le message par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ne jamais effacer de fichiers qui ne viennent pas de toi sans demander.

## Attention : une parodie, pas une copie

Star Wars appartient à Disney / Lucasfilm. Pour pouvoir publier le jeu sans problème :

- **Aucun nom, logo, musique, son, image ou personnage officiel** de Star Wars. Pas de police
  d'écriture qui imite le logo, pas de texte jaune qui défile avec la vraie musique.
- Tout est **inventé** : on fait rire en rappelant l'ambiance (l'espace, le méchant masqué, le
  vieux maître, les sabres lumineux, les petits robots), avec nos propres noms et dessins.
- Le titre choisi par l'utilisateur est **« La Guerre des Gaz »** (et non « Star Prout », trop
  proche de la marque). Ne pas utiliser « Star Wars » ni « Star Prout » dans le jeu.

## L'histoire

Il y a longtemps, dans une galaxie très, très gazeuse…

**Lucas**, un jeune garçon d'une petite planète de sable, rit à chaque prout. Il ne sait pas que
son rire est relié au **Gaz**, l'énergie mystérieuse qui relie tous les êtres de la galaxie.
(« Que le Gaz soit avec toi ! »)

Le terrible **Dark Roteur**, chevalier noir au masque qui respire bruyamment… et qui **rote** à
chaque respiration, veut supprimer tous les rires de la galaxie. Son arme absolue : **l'Étoile
Puante**, une station spatiale géante en forme de cuvette de toilettes, capable de faire puer une
planète entière. (Dark Roteur peut être le **Grand Roteur** de Pokepetro passé du côté obscur.)

Lucas est aidé par :

- **Maître Gazou** : un tout petit vieux maître vert et ridé, qui parle à l'envers
  (« Fort en prout, tu es »). Il lui apprend à manier le **sabre-gaz**.
- **R2-WC** : un petit robot en forme de cuvette, qui bipe et lâche des prouts.
- **P-QR** : un robot doré et peureux fait de rouleaux de papier toilette, qui se plaint de tout.
- **Han Popo** et son vaisseau-épave, le **Faucon Pétulant**.

Le but : rejoindre la **Rébellion du Rire**, apprendre le sabre-gaz, puis détruire l'Étoile
Puante en visant son unique point faible (le trou de la chasse d'eau !).

**Le ton** : drôle, pour les enfants, comme Pokepetro. Pas de sang : les ennemis touchés se
dégonflent ou partent en tourbillonnant.

## Le jeu (version 2, en 3D comme Starshiprout)

**Le prototype 2D (bataille spatiale seule, en Canvas) a été jugé « pourri » par l'utilisateur**
(2026-10-12) : « tu m'as déjà fait 10 fois mieux » (= Starshiprout, en 3D). Il voulait **des
combats au sabre-gaz** et **des vaisseaux sur la planète**. Ses choix :
- Sabre-gaz **en 3D vue de dessus comme Starshiprout** (Lucas court, tape, renvoie les tirs, duel
  contre Dark Roteur).
- Vaisseaux : **les trois** : bataille en vol au-dessus du sol de la planète, vaisseaux qui
  attaquent pendant les combats à pied, et **monter dans son vaisseau** en pleine mission.

Ce qui est fait (version 2) :
- **Mission 1 « Le désert de Sablon »** : à pied au sabre (soldats à ventouse qui tapent, soldats
  tireurs dont on **renvoie les bulles** avec 🛡, soldats qui tombent du ciel dans des bulles,
  Rot-fighters qui bombardent avec des **cercles rouges** au sol), puis on **monte dans le
  chasseur-WC** posé au nord (bouton MONTER) → décollage → **vol au-dessus du désert** (le Faucon
  de Han Popo aide au début, canons au sol, bonus TIR+ et ❤) → **Croiseur-Ventouse**.
- **Mission 2 « Le duel du plateau des Rots »** : duel contre Dark Roteur (zone rouge au sol avant
  chaque coup ; 2 coups parés sur 3 = il est **SONNÉ** ; anneau de rot à parer ; à mi-vie il lance
  son sabre en boomerang, à renvoyer avec 🛡, et appelle 2 soldats).
- Mission 3 « L'Étoile Puante » : carte « Bientôt » (station `assets/vaisseaux/etoile.webp` prête).
- Histoire en **bandes dessinées** avant/après chaque mission (dessins de la planche 1).
- Méga-Prout (jauge qui se remplit en frappant), mots « POUF ! CLANG ! PING ! », musiques et sons
  fabriqués dans le code, 3 étoiles par mission, sauvegarde `gdg_save`.
- Barre du haut « Navigateur / Téléphone Android / Tourner » comme Starshiprout.

Commandes : joystick (doigt n'importe où sur la gauche) + boutons ⚔ SABRE, 🛡 PARER (garder
appuyé), 💨 MÉGA-PROUT, 🚀 MONTER. En vol : glisser le doigt. Clavier : flèches/ZQSD/WASD,
Espace ou J = sabre, Maj ou K = parer, E ou L = Méga-Prout, F ou Entrée = monter, P/Échap = pause.

## Les dessins

**Le style** : exactement celui des monstres de Pokepetro (cartoon, gros contours marron foncé,
ombrage doux, couleurs vives, **sans contour blanc** autour).

**Ce qui existe déjà et peut servir :**

- Référence de style à joindre à Gemini : `../releases/consignes/reference-style-monstres.png`.
- Lucas enfant (6 poses) : `../releases/consignes/minijeux/planche_Q.jpg`.
- Le Grand Roteur (en colère et K.O.) : `../releases/consignes/minijeux/planche_M.jpg`.
- Les monstres de Pokepetro (pour les ennemis ou les passagers) :
  `../Pfft/app/src/main/res/drawable-nodpi/monster_*.webp`. Les dessins regardent vers la gauche.
- Outils pour découper une planche Gemini (fond blanc → PNG transparent) :
  `../.claude/skills/game-art-director/scripts/cut_sheet.py` (et les compétences
  game-art-director / game-art-pipeline). Découper à la **résolution d'origine** de la planche
  (cut_sheet réduit à 250 px).

**Les planches à demander à Gemini** (l'utilisateur les fait lui-même et envoie l'image). Ne pas
écrire « Star Wars » dans la consigne : Gemini refuse ou copie. Joindre la planche Q pour garder
le même Lucas.

Planche 1 : les personnages. **La 1re version a été refusée par Gemini** (« intérêts de tiers ») :
les noms (Dark Burper, R2-WC, P-QR…) et les descriptions trop proches des films (armure noire +
masque respirant, petit vieux vert aux grandes oreilles, robot doré, dôme bleu, armure blanche)
font penser à Star Wars. Nouvelle consigne **sans aucun nom** et avec des looks vraiment à nous
(c'est aussi plus sûr pour publier). Joindre : la référence de style, la planche Q (Lucas) et la
planche M (Grand Roteur). Si Gemini refuse encore : demander les dessins 1 à 4, puis 5 à 8.

```text
Character sheet, same style as the attached drawings (detailed cartoon, thick dark brown
outlines, soft painterly shading, rich colours, funny). Original characters for a silly kids'
cartoon about a boy travelling in space. 8 drawings in 2 rows of 4, well apart, each whole and
not cut off, feet at the bottom:
1. The boy from the attached sheet as a young space explorer: green and white space jumpsuit,
   a belt with little pockets, holding a magic stick made of glowing swirly GREEN smoke, brave
   smile.
2. The same boy laughing out loud, the green smoke stick glowing brighter, little green clouds
   around him.
3. The big burping monster from the attached sheet, now a funny villain: dark purple armour
   plates, a spiky purple helmet with a big snorkel tube, a short torn purple cape, a huge
   purple-green burp cloud coming out of his mouth, holding a stick of glowing swirly PURPLE
   smoke.
4. A tiny old wise hermit shaped like a big green bean, with a very long white beard, small round
   glasses, a straw hat and a walking stick, a little smelly cloud around him, sleepy and funny.
5. A small cute robot made from a white toilet on two little wheels, a periscope eye on top,
   blinking lights, a plunger for an arm.
6. A tall skinny nervous robot made of stacked pink toilet paper rolls, big round worried eyes,
   arms up in panic.
7. A clumsy enemy soldier in a puffy purple-grey suit, a big round helmet with a gas mask,
   holding a toy bubble gun, tripping over his own feet.
8. A cool space pilot with a brown leather aviator jacket, a long red scarf and messy hair, a big
   grin, thumbs up.
BACKGROUND: plain pure white (#FFFFFF), no ground, no shadow, no white sticker border.
NO text, NO letters, NO numbers, NO logos.
```

**Faite** (2026-10-12, acceptée par Gemini) : `planches/planche1_personnages.jpg` →
`assets/persos/` (lucas, lucas_rire, roteur, gazou, r2wc, pqr, soldat, hanpopo) ; portraits ronds
de la radio : `python tools/portraits.py` → `assets/portraits/` (cadrage du visage dans `FACES`).
Utilisés : radio, écran titre (Lucas face à Dark Roteur), écran de défaite (Dark Roteur).

Correspondance : 1-2 Lucas · 3 Dark Roteur · 4 Maître Gazou · 5 R2-WC · 6 P-QR ·
7 soldat de Dark Roteur · 8 Han Popo.

Planche 2 : les vaisseaux (vus de dessus, pour la bataille spatiale). **Faite** (2026-10-12) :
`planches/planche2_vaisseaux.jpg` → `assets/vaisseaux/` (wc, rotfighter, ventouse, etoile,
faucon, crotte, tir_vert, tir_violet, bonus) avec
`python tools/cut_planche.py planches/planche2_vaisseaux.jpg assets/vaisseaux nom=x0,y0,x1,y1 … --glow tir_vert tir_violet --max 600`.

```text
Game asset sheet, same style as the attached drawings (detailed cartoon, thick dark brown
outlines, soft painterly shading, rich colours, funny). ORIGINAL spaceship designs for a funny
space shooter for kids, not from any existing movie. ALL SEEN EXACTLY FROM ABOVE (top view),
nose pointing UP. 8 drawings well apart, each whole and not cut off:
1. The hero's TOILET FIGHTER: a small white flying toilet with two little wings and green gas
   flames coming out of the back.
2. An enemy BURP FIGHTER: a dark grey round cockpit between two big flat purple panels.
3. A big enemy CRUISER: a long dark grey ship shaped like a plunger.
4. The STINK STAR: a huge round space station shaped like a giant toilet bowl seen from above,
   grey metal, green glow in the middle.
5. HAN POPO's old patched-up cargo ship, round with a cockpit on the side, funny and dented.
6. An ASTEROID shaped like a brown poop with craters.
7. A glowing GREEN FART LASER shot, and a PURPLE BURP LASER shot, side by side.
8. A shiny POWER-UP capsule with a bean inside.
BACKGROUND: plain pure white (#FFFFFF), no shadow, no white sticker border.
NO text, NO letters, NO numbers, NO logos.
```

Le **fond de l'espace** (étoiles, nébuleuses vertes et violettes qui défilent) peut être dessiné
dans le code.

## La technique (proposition)

- **Un jeu web d'abord** (HTML/JavaScript, par exemple avec la bibliothèque gratuite
  **Phaser 3**) : il se joue sur n'importe quel téléphone, iPhone compris, **avec un simple
  lien**, sans rien installer. C'est le mieux pour qu'il se partage.
- Hébergement gratuit : **GitHub Pages** (dépôt séparé sur le compte GitHub de l'utilisateur,
  `lennoxvdb`).
- **Ensuite**, une appli Android à installer, avec un outil gratuit (Capacitor), publiée sur
  GitHub comme Pokepetro.
- Les sons : prouts et rots (on peut reprendre ceux de Pokepetro qui sont libres de droits), une
  **musique originale** libre de droits (jamais la vraie musique de Star Wars).
- Sauvegarde de la progression dans le téléphone (stockage du navigateur).

## À décider ensemble

Réponses de l'utilisateur (2026-10-12) :

- [x] Le jeu : **bataille spatiale + un duel au sabre-gaz** contre chaque grand méchant.
- [x] Lucas **enfant** (planche Q).
- [x] Dark Roteur = le **Grand Roteur** de Pokepetro passé du côté obscur.
- [x] Le titre : **La Guerre des Gaz**.
- [x] Les noms : on **garde** ceux proposés plus haut.
- [x] **Web d'abord** (choix par défaut, conseillé), l'appli Android ensuite.

Technique (version 2) : **Three.js en local** (`lib/`, copié de Starshiprout), caméra
orthographique vue de dessus. Aperçu : `node tools/serve.mjs` → http://localhost:8791/
(dans Claude : configuration « guerre-des-gaz » du `.claude/launch.json` de lucas_soldat).
Pour tester : `?mission=1`, `?mission=2`, `?vol` (directement le vol) ; robot qui joue tout seul :
charger `tools/bot.js` dans la console (crochet `window.gdgBot` dans `src/main.js`).

Fichiers :
- `src/main.js` : démarrage, aperçu téléphone, commandes, HUD, écrans, caméra, enchaînement.
- `src/engine/gfx.js` (style cartoon, particules, mots BD, dessins à plat/debout), `audio.js`.
- `src/entities/fighter.js` : **un seul modèle 3D** (KayKit « Knight », CC0, `assets/3d/trooper.glb`)
  repeint par shader : Lucas (combinaison blanche/verte, cheveux, sabre vert), soldats (violet-gris,
  casque de scaphandrier à masque à gaz, pistolet à bulles ou ventouse), Dark Roteur (violet foncé,
  cape, casque à piques et tuba, sabre violet). Animations du modèle : coups d'épée, parade, etc.
- `src/world/world.js` : désert de Sablon (dunes, dômes, rochers, plantes, Faucon posé, amis en
  dessins debout, chasseur-WC posé) et plateau des Rots (colonnes, geysers).
- `src/game/foot.js` (combat à pied + Dark Roteur), `flight.js` (vol : les vaisseaux sont des
  dessins vus de dessus posés à plat à hauteur ALT, collisions « comme sur l'écran »),
  `missions.js` (histoire, réglages `DIFF`, déroulé des missions), `common.js`.

## Les premières étapes

1. Poser les questions ci-dessus et noter les réponses dans ce fichier.
2. Faire un **prototype jouable dans le navigateur** de la bataille spatiale avec des formes
   provisoires : le vaisseau se déplace au doigt, tire tout seul, une vague d'ennemis arrive,
   un fond étoilé défile. Le montrer à l'utilisateur (capture d'écran + lien d'aperçu).
3. Pendant ce temps, l'utilisateur fait les planches Gemini 1 et 2.
4. Découper les planches, remplacer les formes provisoires par les vrais dessins.
5. Ajouter les niveaux, les bonus, les boss, le duel au sabre-gaz et l'histoire entre les
   niveaux.
6. Mettre en ligne la version web, puis l'appli Android.
