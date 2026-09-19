# FRAME — où en est le produit, et ce qui vient

État au 19 septembre 2026. Ce document est la référence de pilotage : ce qui est
fait, ce qui est prouvé, ce qui reste ouvert, et par quoi on continue.

Il ne remplace pas les spec : `specs/2026-09-14-frame-design.md` décrit le
concept, `specs/2026-09-18-frame-v2-emoji-language.md` le renversement du
18 septembre. Il ne remplace pas non plus `.impeccable.md`, qui porte la
direction artistique.

---

## 1. Ce qu'est FRAME aujourd'hui

Une **cinémathèque personnelle** : on explore un catalogue de films et de séries,
on garde ce qu'on a vu et aimé, et on retrouve ce qu'on veut voir. Le texte
commande ; les emoji restent un langage d'expression et de thème, plus une
décoration.

Deux présentations : **Explorer** (le catalogue) et **Moments** (le fil vertical).

Répartition des rôles entre les deux chantiers qui avancent en parallèle :

| Chantier | Périmètre | Fichiers |
|---|---|---|
| **Fonctionnel** | recherche, filtres, pagination, fiches, lecture, stockage | `card.js`, `discovery.js`, `topics.js`, `collections.js` |
| **Direction artistique** | mise en page, couleur, typographie, densité | `direction.css`, `catalogue.css` |

Règle de travail : **garder les évolutions métier indépendantes de la couche DA.**
Le fonctionnel ne doit pas dépendre d'une classe de présentation, et la DA ne doit
pas avoir à connaître une règle de recherche.

---

## 2. Fait, et vérifié en le pilotant

Chaque ligne ci-dessous a été éprouvée dans Chrome, pas seulement relue.

### Catalogue et recherche

- **Recherche élargie.** Le seuil caché de 100 votes a disparu : il ne s'applique
  plus que si on le demande (`vote_count.gte: filters.votes || undefined`). Une
  recherche rend désormais son vrai volume — « dune » annonce 1 205 titres.
- **Recherche par thème.** « films horreur de fantôme » est compris comme
  Horreur + Fantômes, sans accents ni mots de liaison : *« 40 titres chargés sur
  1 841 · Thèmes : Horreur · Fantômes »*. Un titre seul reste un titre.
- **218 thèmes distincts**, vérifiés auprès de TMDB.
- **Pagination par curseurs.** `discovery.js` tient un curseur par source, sans
  seuil implicite ; « Charger la suite » reprend là où on s'est arrêté.
- **12 collections thématiques**, chacune n'étant qu'un jeu de critères visibles
  et modifiables — et qui s'efface dès qu'on en touche un.
- **Filtres** : décennie, durée, langue, votes minimum, genres, sous-genres, tris.

### Fiches

- **Sagas** : depuis une fiche, « Explorer la saga : … » charge les films de la
  collection TMDB (vérifié : Spider-Man MCU, 4 films).
- **Disponibilités par pays**, séparées par mode. Vérifié sur *Dune, deuxième
  partie* : 12 fournisseurs en France, HBO Max aux États-Unis, Netflix au
  Royaume-Uni. Les modes qui partagent exactement la même liste sont regroupés
  (« Location et achat · … »). Une absence d'offre et une panne réseau sont deux
  messages différents.
- **Lecteur** : pause, ±10 s, vitesse 0,5× à 2×, barre de progression, lien
  YouTube. Vérifié par l'état que le lecteur renvoie lui-même (`playerState`,
  `currentTime`, `playbackRate`) : la pause passe bien en état 2, +10 s fait
  exactement +10 s, la vitesse demandée est la vitesse appliquée.

### Cohérence

- **Une recherche commencée n'écrase plus une recherche plus récente.** Vérifié :
  changer la requête en plein chargement laisse 0 résidu de la précédente.
- **Le nom d'une collection ne survit plus à ses critères.** La validité est
  *dérivée* des critères, plus rangée dans un drapeau : genre, type et tri
  l'oubliaient, ils ne peuvent plus.
- **Téléphone (390 × 844)** : aucun élément ne dépasse, aucune cible sous 32 px,
  en-tête et outils sur 174 px, panneau de filtres en dialogue modal qui tient
  dans l'écran.

### Tests

124 tests passent (`node --test "tests/**/*.test.mjs"`), dont huit sur le moteur
de pagination.

---

## 3. Reste ouvert

- **Le mode Moments n'a pas été audité** sur les sept dimensions de Norman ; il a
  seulement été vérifié non régressé.
- **Le coût réseau.** Un changement de filtre déclenche encore une trentaine de
  requêtes de mots-clés pour nommer les affiches. Invisible aujourd'hui, à
  surveiller si le catalogue grandit.
- **`src/` (l'application d'origine, composition de stickers sur toile) et
  `prototypes/emoji-card/` coexistent.** Le README décrit encore l'ancienne. Il
  faudra trancher laquelle est le produit.
- **Rien n'est vérifié sur un vrai téléphone.** Les cibles de 44 px ne sont
  mesurées qu'en émulation.

---

## 4. Le mode Soirée — les duels

On compose une table de films à plusieurs, puis ils s'affrontent deux par deux.

### Le jeu

1. **La table.** L'hôte crée la soirée et reçoit un code de six signes ; les autres
   entrent le code ou ouvrent le lien. **Chacun apporte jusqu'à trois films** :
   une recherche sur tout TMDB, pas seulement le catalogue affiché. L'hôte peut
   aussi piocher dans ce que le catalogue a sous les yeux. Douze films au maximum,
   quatre au minimum, deux joueurs au moins.
2. **Les duels.** Deux affiches s'affrontent, le groupe vote sur **ces deux-là**,
   et le résultat tombe tout de suite. On enchaîne jusqu'à ce qu'il n'en reste
   qu'un. Le tour suivant se construit tout seul, et les exempts (quand le nombre
   est impair) passent sans se jouer.
3. **Le verdict.** Le film gagnant, **et de qui c'était le film** — puis le bilan :
   combien de duels, combien se sont joués à une voix près, lequel a le plus
   divisé, lequel a mis tout le monde d'accord, et le film le plus soutenu de la
   soirée même s'il n'a pas gagné.

**La règle qui fait le jeu : le secret.** Pendant un duel, le serveur n'envoie à
chaque joueur que son propre vote et le nombre de votants. Le détail nominatif et
le score ne sont calculés qu'une fois le duel clos. Vérifié côté protocole : un
joueur inconnu reçoit `votes: null` et `score: null`.

**La règle qui évite le pire : à égalité, on ne tire pas au sort.** Le film qui a
le plus convaincu depuis le début du tournoi l'emporte — une règle qu'on peut
expliquer à voix haute.

### Pourquoi un tournoi, et pas un vote

La première version faisait voter chacun dans son coin sur douze films, et le
classement tombait à la fin. C'était un sondage, pas un jeu : personne ne vivait
rien ensemble, et il fallait se prononcer douze fois sur des films qu'on n'avait
pas choisis. Un duel se joue à deux affiches, se commente à voix haute, et se
tranche en un geste. C'est aussi ce qui rend le secret intéressant : on découvre
en direct que le film qu'on croyait évident était celui que son voisin détestait.

### Comment ça tourne

```bash
npm run room            # port 8092, l'adresse réseau s'affiche
```

L'hôte lance le serveur ; les autres ouvrent l'adresse affichée sur leur téléphone,
sur le même Wi-Fi. **Rien ne sort de la maison** : pas de compte, pas de service
tiers, pas d'autre clé que TMDB. Le serveur est en Node natif, sans une seule
dépendance.

Le CORS est **ouvert délibérément** : sans lui, une page servie par `npm run serve`
(8090) ne pourrait pas parler au serveur de soirée (8092) — deux ports, deux
origines. Le serveur n'est joignable que sur le réseau local, et le seul secret
est le code de la soirée ; ce que l'ouverture ajoute est borné par un plafond de
200 soirées.

| Fichier | Rôle |
|---|---|
| `room/rooms.js` | les règles du jeu — pures, sans réseau ni horloge implicite |
| `room/server.mjs` | HTTP + SSE + service des fichiers |
| `prototypes/emoji-card/soiree.js` | l'interface |
| `tests/room.test.mjs` | 37 tests sur les règles |

### Ce qui est vérifié

Avec **deux navigateurs distincts**, deux profils, deux stockages : création,
code faux refusé et expliqué, code trop court refusé sur place, arrivée vue en
direct sans recharger, **recherche sur tout TMDB**, films portant le nom de leur
parrain, **les deux joueurs voient le même duel**, secret du vote tenu (interface
et protocole), **tous les duels enchaînés sans un seul clic**, verdict, bilan,
rejouer, retour à la table, reconnexion sans doublon, zéro exception. Plus le
téléphone 390 × 844 : les deux affiches côte à côte, aucun débordement, aucune
cible sous 44 px.

### Ce qui reste ouvert

- **Pas de relais en ligne.** Le jeu suppose le même réseau. Le client ne connaît
  que l'adresse de base de l'API : brancher un relais ne demandera pas de réécrire
  le jeu, mais ce relais n'existe pas.
- **Un seul jeu.** « Les Duels » est le jeu ; rien n'est prévu pour en changer.
- **Rien n'est conservé après la soirée.** Le gagnant ne peut pas être marqué
  « à voir » d'un geste, et le résultat ne rejoint pas le catalogue.
- **L'hôte est un joueur comme un autre** — s'il part, la main passe au plus
  ancien, mais personne n'est prévenu que le rôle a changé.
- **Pas de trace des partis** : le journal des départs existe dans l'état, mais le
  bilan ne le montre pas encore.

---

## 5. Comment on vérifie

Ce qui compte n'est pas qu'un test passe, c'est que l'application fasse ce qu'on
croit qu'elle fait. Les scripts de `.superpowers/verify/` pilotent Chrome en
headless par le protocole DevTools, sans dépendance npm :

```bash
npm run serve                     # http://127.0.0.1:8090
cd .superpowers/verify
node verif-lecteur.mjs            # pause, ±10 s, vitesse, position
node verif-coherence.mjs          # courses de recherche, nom de collection
node verif-dispo.mjs              # disponibilités par pays
node verif-sagas-dispo.mjs        # sagas, téléphone
node verif-soiree.mjs             # le mode Soirée, à DEUX navigateurs
```

`verif-soiree.mjs` a besoin de deux Chrome sur des ports de débogage différents (9222 et
9223) et de profils séparés : sans deux stockages distincts, on ne teste qu'un joueur qui
se parle à lui-même. Le serveur de soirée doit tourner (`npm run room`).

Deux pièges rencontrés, à garder en tête :

- **`Page.addScriptToEvaluateOnNewDocument` rejoue à chaque navigation.** Un
  script qui vide `localStorage` avant le premier chargement vide aussi celui du
  rechargement — un test de persistance qui ne prouve rien.
- **Un test peut échouer sur lui-même.** Trois « échecs » de cette session
  venaient du test, pas de l'application : un sélecteur périmé, une expression
  régulière trop stricte, une attente plus courte que le délai mesuré. Vérifier
  le test avant de « réparer » le code.

Et le rappel qui a coûté le plus cher : **une mesure peut être verte et l'écran
cassé.** Un mode entier est resté réduit à une bande de 219 px sous des tests
passants, parce que la scène et la vidéo étaient cohérentes entre elles. Regarder
la capture fait partie de la vérification.
