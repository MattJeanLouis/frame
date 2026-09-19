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

## 4. La suite : les rooms

**État : non commencées.** C'est la prochaine étape.

Le mot n'est défini nulle part dans le dépôt — ni dans les specs, ni dans le
README, ni dans `.impeccable.md`. L'intention retenue est celle-ci : des espaces
partagés, où plusieurs personnes explorent et gardent des films ensemble, là où
FRAME est aujourd'hui strictement personnel (aucun compte, aucune donnée
envoyée, tout en `localStorage`).

**Cette définition doit être arrêtée avec Matt avant d'écrire une ligne**, parce
que « rooms » peut vouloir dire au moins trois choses très différentes :

1. **Un salon de visionnage** — on décide à plusieurs ce qu'on regarde ce soir.
2. **Une liste partagée** — une watchlist commune, qui se remplit à plusieurs.
3. **Un espace de recommandation** — on découvre ce que des proches ont aimé.

Les questions à trancher, dans l'ordre :

- **Qui héberge ?** FRAME est un site statique sans serveur. Des rooms
  supposent un état partagé : soit un service, soit un encodage dans le lien
  (comme le partage de tableau du prototype 1), soit un stockage tiers.
  C'est la question qui décide de toutes les autres.
- **Y a-t-il des comptes ?** `CLAUDE.md` dit « pas d'inconnus, pas de
  modération, pas de compte ». Des rooms entre proches n'exigent pas de comptes ;
  des rooms publiques, si.
- **Que partage-t-on ?** Une liste, des avis, ou seulement un lien de recherche ?
  Le miroir est aujourd'hui intime — « il ne s'adresse qu'à une personne ».
- **Qu'est-ce qui reste privé ?** Les états et les commentaires sont
  l'équivalent d'un journal. Il faut décider ce qui sort et ce qui ne sort pas,
  et le dire dans l'interface, pas seulement dans le code.

Tant que ces quatre points ne sont pas tranchés, toute implémentation serait une
supposition.

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
```

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
