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

Campagne (2026-10-13), **6 missions** (le duel contre Dark Roteur seulement à la fin, demande de
l'utilisateur ; il a aussi demandé une mission au jetpack et une course de motojets) :
1. **Le désert de Sablon** (`sablon`) : à pied au sabre, puis MONTER dans le chasseur-WC → vol → Croiseur-Ventouse
   (vaisseau de guerre 3D en forme de ventouse, `src/entities/plunger.js` : plongeon avec bande rouge, aspiration).
2. **Les marais de Gazouland** (`marais`) : entraînement (saut), gros soldats (`gros`, 3× plus solides, tapent 2 cœurs),
   duel contre le **Capitaine Burpo** (chevalier rouge, `spawnRoteur(x, z, { who: 'capitaine', … })`).
3. **La course des motojets** (`marais`, `src/game/speeder.js`) : Lucas assis sur sa moto-prout, arbres à éviter,
   soldats en motojet (coup de sabre ⚔ = ils partent dans les arbres), boss **Gros Bolide** (mines + éventails).
4. **La cité des nuages** (`nuages`, `jet: true`) : **jetpack** (tout le monde vole à `lift` 2,4, on survole ce qui
   est bas `h < 3`), 3 générateurs à casser (`addGenerator`) gardés par des soldats, bulle-prison de Han Popo.
5. **L'attaque de l'Étoile Puante** (`espace`) : vol dans l'espace, astéroïdes-crottes qui se cassent en deux,
   boss **Étoile Puante** (`src/entities/etoile.js`, cuvette géante : on ne peut toucher que le trou de la chasse
   d'eau quand ses volets s'ouvrent, et les tourelles ; à mi-vie elle « tire la chasse » et aspire).
6. **Le cœur de l'Étoile Puante** (`station`, `indoor`) : vagues de soldats, puis le **duel final** contre Dark
   Roteur (`rage: true` : grande colère à 25 %, deux anneaux de rot). Fin : Dark Roteur se met à rire.
Missions = données dans `MISSIONS` (`src/game/missions.js`) : `parts` (`foot`, `flight`, `speeder`), scripts, histoire.
Pour tester : `?mission=N`, `?vol`, `?ventouse`, `?etoile`, `?bolide`. Robot : charger `tools/bot.js`, puis
`gdg.simulate(5)` fait avancer le jeu de 5 s d'un coup sans dessiner (utile quand la fenêtre de test est cachée).
Toucher un soldat = Lucas court le frapper (en plus du bouton ⚔) ; 🌀 SAUT = bond de chevalier avec pirouette.

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

## Publication (GitHub, Android)

- Dépôt public : https://github.com/lennoxvdb/guerre-des-gaz (branche `main`).
- Jeu en ligne (GitHub Pages, publié par `.github/workflows/publier.yml` à chaque envoi : `www/` + `version.json` + `update.zip`) :
  https://lennoxvdb.github.io/guerre-des-gaz/ — chaque envoi sur `main` met le site à jour.
- Appli : Capacitor 8 (`android/`, appId `com.lennoxvdb.guerredesgaz`, nom « La Guerre des Gaz »),
  plein écran + écran toujours allumé (`MainActivity.java`), icône et écran de démarrage faits par
  `python tools/make_icons.py` (visage de Lucas qui rit / Lucas et Dark Roteur).
- Fabriquer l'APK : commit d'abord, puis `powershell -ExecutionPolicy Bypass -File tools\build_apk.ps1`
  → `publication/guerre-des-gaz.apk` (pas dans git), version `1.0.<nombre de commits>`.
  Le script ne rend pas la main tant que Gradle tourne en fond : `android\gradlew.bat --stop`.
- Signature : **même clé que Starshiprout**, HORS du projet (`%USERPROFILE%\lucas-soldat-signature`,
  ne jamais afficher le mot de passe). Garder cette clé : sans elle, impossible de mettre à jour l'appli.
- Puis : `gh release create v1.0.N publication/guerre-des-gaz.apk --repo lennoxvdb/guerre-des-gaz …`
- Version 1.0.5 publiée le 2026-10-13 : https://github.com/lennoxvdb/guerre-des-gaz/releases/tag/v1.0.5
- Mises à jour automatiques (IMPORTANT 1 : `lib/capacitor.js` (copie de `@capacitor/core/dist/capacitor.js`) doit être chargé dans `index.html` et l outil s obtient par `capacitorExports.registerPlugin('CapacitorUpdater')` : sans ça `Capacitor.Plugins.CapacitorUpdater` est vide et rien ne se passe, bug des 1.0.8 à 1.0.10 ; IMPORTANT 2 : `appReady()` est appelé dès la 1re ligne de `src/main.js` ; s il arrive après le chargement, le téléphone dépasse les 10 s et l outil revient à l ancienne version — c était le bug 1.0.8 → 1.0.9). IMPORTANT 3 : `download()` exige `checksum` (SHA-256 hex de `update.zip`), sinon « Failed to download » (bug des APK 1.0.11 et avant, qui ne peuvent donc pas se mettre à jour seules) : le workflow l écrit dans le `version.json` en ligne. `src/engine/update.js` (`@capgo/capacitor-updater`) compare `version.json` local et celui du site, télécharge `update.zip` ; sur l écran titre il installe tout de suite, sinon au prochain lancement. Depuis la 1.0.8 (la 1.0.5 ne les avait pas).

## Ajouts (octobre 2026)
- **Atelier du sabre** (`src/entities/sabre.js`, écran « 🔧 Fabrique ton sabre » du titre) : couleur, manche (ventouse, brosse à WC, PQ, soda, saucisse, or), forme (double lame, garde, géant), effet, bruit, nom. Sauvegarde `gdg_sabre`, pièces débloquées par le nombre de missions gagnées (`need`). Lucas porte ce sabre partout (`makeCustomSaber` dans `Fighter`).
- **Musique** : vrais morceaux d'orchestre CC0 (OpenGameArt) dans `assets/musique/` (crédits `LICENCE.txt`), MP3 64 kb/s, joués par `playMusic` (`src/engine/audio.js`). Plus de musique électronique.
- **Mission 5 = espace puis tranchée en 3D** (`src/game/trench.js`, `TrenchMode`, caméra perspective `mode.cam3` utilisée par `main.js`) : tourelles, barrières, chasseurs-rots, poursuite de Dark Roteur sauvée par Han Popo, tir de la torpille quand le viseur est vert (sinon on refait un tour). Test : `?tranchee`. Résultat `{ type: 'next', part }` = enchaîner un morceau de mission en gardant les cœurs.
- **Lucas 3D maison** (dans le jeu) : dessin Gemini → TRELLIS (`planches/lucas3d/lucas_trellis.glb`) → `tools/glb_vers_obj.py` → Mixamo (squelette) → `assets/3d/lucas.fbx` (chargé par `lib/FBXLoader.js`, normales recalculées car absentes). Dans `Fighter` : le Knight reste caché et joue les animations ; `followKnight()` recopie chaque image sa pose sur les os Mixamo (table `BONES`, correction bras en A → T). Le sabre suit la main de Lucas (`replaceSaber` pour l'atelier), le jetpack est sur `Spine2`. Outils : `tools/voir_lucas.html` (toutes les animations de près), `tools/voir_squelette.html` (vérifier les ronds Mixamo), `tools/voir_modele.html`. Pour un autre personnage de nos jeux : même chemin, mêmes os Mixamo.

## Finitions « APK irréprochable » (2026-10-15)
- **Fluidité** (`src/main.js`) : qualité qui s'adapte toute seule (`adaptQuality` : résolution 1,5 → 1 sur téléphone, puis ombres 1024 si ça rame ; remonte si c'est fluide). `?fps` affiche images/s, résolution et nombre de dessins.
  Ombres du soleil coupées dans l'espace, la tranchée et le duel. Décor fixe collé par couleur (`mergeStatic` dans `gfx.js`, utilisé par `world.js` et les morceaux de la tranchée) : marais 263 → 101 dessins, tranchée 363 → ~230.
  Mémoire : tout ce qu'on enlève de la scène libère ses formes (`autoDispose`/`freeGeo` ; formes partagées marquées `geometry.userData.keep`). Tirs et bulles = formes partagées.
- **Pour les enfants** : une **2e chance** par morceau de mission (Maître Gazou remplit les cœurs, `revived`) ; **points de reprise** (`g.checkpoint('burpo' | 'boss' | 'bolide')`, le bouton « Réessayer contre le boss » passe `from`) ; duel plus lent après chaque défaite (`save.fails`, `VersusMode.easy`) ; torpille de la tranchée tirée trop tôt = elle attend le vert ; motojets : coup de sabre automatique, « ! » avant de foncer, plus de motojet coincée.
- **Sensations** : arrêt sur image et tremblement aux K.O., « ×N COMBO ! », bords rouges + cœurs qui battent quand on est touché, tremblement aussi en vue cinéma/derrière le vaisseau, cercle rouge sous le gros soldat avant son coup, tirs ennemis rose vif bien visibles, bonus qui clignotent avant de disparaître.
- **Écrans** : fin de mission = pièces de sabre gagnées (bouton « Essayer »), carte « ▶ À toi ! » sur la prochaine mission, téléphone couché : missions sur une ligne, radio en bas à gauche en vol, encoches respectées (`safe-area`), Échap reprend la pause.
- **Dark Roteur 3D** (2026-10-16) : `assets/3d/roteur.fbx` (TRELLIS → Mixamo, planches dans `planches/roteur3d/`), ajouté à `MODELS` ; sabre ×1,4. Voir de près : `tools/voir_lucas.html?k=roteur`. Le Capitaine Burpo reste le Knight repeint.
- **Chasseur-WC 3D** (2026-10-17) : `assets/3d/chasseur.glb` (TRELLIS, pas de squelette), chargé par `loadShip()` dans `trench.js`, utilisé par `makeWcFighter()` (tranchée + vol vue derrière) ; réservoir devant (-z), bulle + moteurs derrière ; la petite bulle peinte est retirée (`DOME`) ; à taille réelle (vaisseau `SHIP_K` 3, Lucas `PILOT_H` 2,4 : un vrai enfant sur de vraies toilettes, caméra de la tranchée rapprochée) Lucas est assis sur la lunette (`SEAT`), dos au réservoir, dans un champ de force vert (`shieldMat`, bords lumineux + vagues, s allume quand on est touché : `shieldHit()`). Sans le fichier : l ancien vaisseau en formes simples.
- Robot de test : `tools/bot.js` joue aussi la tranchée ; `gdg.start(n, { part, from })` lance une mission (0 = duel).
