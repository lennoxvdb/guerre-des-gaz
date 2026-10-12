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

## Le jeu (proposition)

### Idée 1 ⭐ conseillée : bataille spatiale (shoot'em up vertical)

- Lucas pilote un **chasseur-WC** (un petit vaisseau en forme de toilettes volantes).
- **Un seul pouce** : on glisse le doigt pour bouger le vaisseau, **il tire tout seul** des
  rayons-prout.
- Vagues de chasseurs ennemis (les **Rot-fighters** de Dark Roteur), astéroïdes en crotte,
  bonus à ramasser (tir triple, bouclier de gaz, R2-WC en renfort).
- Chaque niveau finit par un **boss** : un croiseur géant, puis l'Étoile Puante.
- Parties courtes, score à battre : parfait pour le téléphone et pour le partage.

### Idée 2 : duels au sabre-gaz

- Combats contre les chevaliers noirs et Dark Roteur : **glisser le doigt** dans la direction
  indiquée pour parer ou frapper (comme Fruit Ninja en duel).
- Peut servir de **combat de boss** entre les niveaux de l'idée 1 : on garde les deux.

### Idée 3 : la course de capsules-prout

- Course sur la planète de sable, à bord d'une capsule propulsée au prout : glisser à gauche et
  à droite, éviter les rochers, ramasser des haricots pour le turbo.

**Mon conseil** : un jeu qui suit l'histoire, avec les **batailles spatiales (idée 1)** comme
cœur du jeu, et un **duel au sabre-gaz (idée 2)** contre chaque grand méchant. La course (idée 3)
peut venir plus tard.

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

Technique retenue : JavaScript + Canvas 2D **sans bibliothèque** (rien à installer, léger, marche
hors ligne dans l'appli plus tard). Aperçu : `node tools/serve.mjs` → http://localhost:8791/
(`?vague=6` pour commencer directement au croiseur).

Fichiers : `src/main.js` (jeu : vagues, tirs, bonus, croiseur, écrans), `src/draw.js` (dessins :
images de `assets/` et formes de secours), `src/audio.js` (prouts et rots fabriqués dans le code).
Prototype fait (2026-10-12) : un doigt pour bouger, tir automatique, 5 vagues puis le
Croiseur-Ventouse, en boucle de plus en plus dur ; bonus tir triple / bouclier / R2-WC ;
3 cœurs ; record sauvegardé ; messages radio de Gazou, P-QR, R2-WC, Han Popo (portraits = ronds
de couleur en attendant la planche 1).

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
