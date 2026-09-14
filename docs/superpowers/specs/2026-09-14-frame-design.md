# FRAME — spécification de conception (prototype 1)

Date : 14 septembre 2026. Auteur : Claude, validé par Matt en discussion.

## 1. Ce qu'on construit

FRAME est une application web de découverte de films. On ne cherche pas avec des mots : on compose un tableau de stickers sur une toile, et ce tableau devient la requête. Le prototype 1 couvre uniquement le cœur du concept : la toile, le vocabulaire de stickers, le moteur, les explications, le partage par lien et la sauvegarde locale.

Contraintes non négociables (décisions de Matt) :

- Utilisable sur téléphone et sur ordinateur, dans un navigateur.
- Zéro euro : aucune API payante, aucun hébergement payant, aucune dépendance à installer côté utilisateur.
- Stocker le moins possible : pas de base de films, pas de bibliothèque de stickers à entretenir, pas de serveur, pas de comptes.
- Qualité d'exécution très élevée : beau, fluide, ergonomique, pertinent. Le tableau doit être beau indépendamment des films.
- Règle absolue du concept : si enlever la toile rend l'appli aussi intéressante, le concept est mauvais. Le prototype embarque donc un mode de comparaison pour tester cette règle.

Reporté (hors périmètre, ne rien préparer pour) : social, votes, mode canapé, collection, séries, disponibilité streaming, relations spatiales interprétées, comptes, backend.

## 2. Architecture

Site statique : `index.html`, un dossier `src/` de modules ES natifs, un dossier `styles/`. Aucun framework, aucun bundler, aucune dépendance npm à l'exécution. Les tests utilisent le lanceur intégré de Node (`node --test`). Le site fonctionne en ouvrant `index.html` via un petit serveur local (`npx serve` ou `python3 -m http.server`) et se déploie tel quel sur GitHub Pages.

Sources externes, toutes gratuites :

- **TMDB API v3** pour les films : recherche de mots-clés, découverte, affiches. Clé personnelle gratuite.
- **Twemoji** via CDN jsDelivr pour rendre les emoji à l'identique sur toutes les plateformes (SVG, licence CC-BY 4.0, attribution dans le pied de page).
- **Google Fonts** pour deux polices.

Modules et responsabilités :

| Module | Rôle | Dépend de |
|---|---|---|
| `src/stickers.js` | Vocabulaire : liste ordonnée et stable des stickers, tiroirs, mots-clés TMDB, atmosphères | rien |
| `src/board.js` | Modèle du tableau : liste de stickers posés avec position, taille, retournement ; opérations pures | `stickers.js` |
| `src/url.js` | Encodage et décodage du tableau dans le fragment d'URL | `board.js` |
| `src/tmdb.js` | Client TMDB : gestion de la clé, résolution des mots-clés, découverte, URLs d'images, cache | rien |
| `src/engine.js` | Fusion des résultats par sticker, sélection des 6 films, explications ; fonctions pures testables | `stickers.js` |
| `src/canvas.js` | La toile : rendu des stickers, gestes pointeur, clavier, sélection, atmosphères | `board.js` |
| `src/drawer.js` | Le tiroir de stickers : onglets, grille, ajout à la toile | `stickers.js` |
| `src/results.js` | Bande de résultats : cartes, explications, états de chargement et d'erreur | `engine.js`, `tmdb.js` |
| `src/storage.js` | localStorage : clé TMDB, tableaux sauvegardés, journal, cache mots-clés | rien |
| `src/app.js` | Assemblage, flux de données, debounce, routage du fragment, mode liste | tous |
| `tools/check-keywords.mjs` | Script Node optionnel : vérifie que chaque mot-clé du vocabulaire existe sur TMDB | `stickers.js` |

Flux de données principal :

1. L'utilisateur modifie la toile (pose, déplace, redimensionne, retourne, supprime).
2. `board.js` produit un nouvel état immuable. `url.js` réécrit le fragment d'URL sans recharger.
3. 400 ms après la fin du dernier geste, `app.js` demande à `engine.js` une recherche.
4. `engine.js` demande à `tmdb.js` les résultats de chaque sticker posé (cache par sticker et par session), fusionne, sélectionne 6 films, produit les explications.
5. `results.js` affiche les 6 cartes avec une transition douce, en conservant l'ordre des films déjà présents.

## 3. Vocabulaire de stickers

### 3.1 Principes

- Environ 80 stickers, tous des emoji, tous des images de choses concrètes. Aucun sticker-mot (« silence », « romance », « 1920 » sont interdits). L'abstrait doit émerger des combinaisons.
- Chaque emoji apparaît dans un seul tiroir.
- Chaque sticker a un identifiant stable (chaîne ASCII, ex. `city_night`), un emoji, un libellé français court, 4 à 8 noms de mots-clés TMDB en anglais exactement tels qu'ils existent sur TMDB (vérifiables avec `tools/check-keywords.mjs`), et optionnellement des identifiants de genres TMDB qui renforcent le score (voir moteur).
- La liste est ordonnée et ne fait que croître : on n'insère jamais au milieu, on ne supprime jamais, on ne renomme jamais un identifiant. L'encodage d'URL dépend de cet ordre.
- Certains stickers sont des **atmosphères** : en plus de leurs mots-clés, ils modifient l'apparence de toute la toile (teinte, lumière, pluie). Ils se posent comme les autres mais rendent le tableau beau et lisible d'un coup d'œil.

### 3.2 Tiroirs

Sept tiroirs, dans cet ordre : Personnages, Créatures, Lieux, Objets, Vêtements, Ciel et lumière, Monde et époque. Environ 10 à 14 stickers par tiroir. Le premier tiroir affiché au lancement est « Lieux », le plus discriminant.

Exemples attendus, à titre indicatif, le vocabulaire complet étant défini dans `stickers.js` :

- Personnages : 👤 silhouette, 👩 femme, 👨 homme, 👧 enfant, 🧓 personne âgée, 👮 policier, 🕵️ détective, 🤠 cowboy, 🥷 ninja, 🧑‍🚀 astronaute, 👑 royauté, 🧑‍🎤 musicien.
- Créatures : 🤖 robot, 👽 alien, 🐺 loup, 🧛 vampire, 🧟 zombie, 🐉 dragon, 🦖 dinosaure, 🦈 requin, 🐙 pieuvre, 👻 fantôme, 🐎 cheval, 🐕 chien.
- Lieux : 🌃 ville la nuit, 🏙️ métropole, 🌲 forêt, 🏜️ désert, 🌊 océan, 🏔️ montagne, 🏝️ île, 🏚️ maison abandonnée, 🏰 château, 🚀 espace, 🏫 école, 🏥 hôpital, 🏛️ palais, 🌾 campagne.
- Objets : 🔫 arme, 🔪 couteau, 💰 argent, 💍 bague, 📷 appareil photo, 🎸 guitare, 🎹 piano, 📖 livre, 🚗 voiture, 🏍️ moto, ✈️ avion, 🚢 bateau, 🕯️ bougie, 🥂 champagne, 💊 pilules, 🧪 laboratoire.
- Vêtements : 🎩 chapeau, 🕶️ lunettes noires, 🧥 manteau de cuir, 👗 robe de soirée, 👔 costume, 🥋 arts martiaux, 🎭 masque, 👘 kimono, 🦺 uniforme.
- Ciel et lumière (atmosphères) : 🌧️ pluie, 🌙 nuit, ☀️ soleil, ❄️ neige, 🔥 feu, ⛈️ orage, 🌫️ brouillard, 🟥 lumière rouge, 🟦 lumière bleue, 🟪 néon violet, 🌅 crépuscule.
- Monde et époque : 🏺 antiquité, ⚔️ médiéval, 🎞️ noir et blanc, 📼 années 80, 🛸 futur, ☢️ post-apocalyptique, 🎪 cirque, 🎰 casino, 🛰️ science, 🕌 orient, 🗽 Amérique, 🗼 Paris.

Le vocabulaire précis est produit par l'agent chargé de `stickers.js`, avec pour consigne d'utiliser des noms de mots-clés que TMDB connaît réellement (ex. `rain`, `neon`, `cyberpunk`, `dystopia`, `robot`, `android`, `desert`, `post-apocalyptic future`, `car chase`, `heist`, `vampire`, `werewolf`, `forest`, `haunted house`, `space travel`, `alien`, `castle`, `medieval`, `sword`, `samurai`, `cowboy`, `hitman`, `private detective`, `film noir`, `jazz`, `piano`, `wedding`). Les couleurs de lumière sont les stickers les plus faibles côté données ; on l'assume et on compense par leur effet visuel.

### 3.3 Atmosphères

Un sticker atmosphère déclare un effet : `tint` (une couleur et une intensité appliquées en superposition sur la toile), `light` (assombrit ou réchauffe), `particles` (`rain`, `snow`, `embers`, `fog`). Les effets se cumulent de façon douce et sont rendus en CSS pur ou avec un canvas 2D léger pour les particules. Ils respectent `prefers-reduced-motion` : sans mouvement, les particules deviennent une texture statique.

## 4. Le tableau et son encodage

### 4.1 Modèle

Un tableau est une liste ordonnée de stickers posés. Chaque sticker posé a : `id` (identifiant du vocabulaire), `x` et `y` (position du centre, de 0 à 1, relative à la toile carrée), `scale` (de 0,5 à 3, où 1 est la taille de base), `flip` (booléen). L'ordre de la liste est l'ordre de profondeur : le dernier est devant. Maximum 40 stickers.

La position est enregistrée et restituée fidèlement mais n'influence pas les résultats dans le prototype 1. La taille influence les résultats (poids).

### 4.2 Encodage dans l'URL

Fragment `#t=1.<base64url>`. Le `1` est la version du schéma. Chaque sticker est encodé sur 5 octets : index du sticker dans la liste ordonnée du vocabulaire (1 octet), `x` (1 octet, 0 à 255), `y` (1 octet), `scale` (1 octet, 0 à 255 mappé linéairement sur 0,5 à 3), drapeaux (1 octet, bit 0 = flip). 40 stickers font 200 octets, soit 268 caractères.

Le décodage d'un index inconnu, d'une version inconnue ou d'un fragment malformé produit un tableau vide et un avertissement discret, jamais une erreur bloquante.

Le fragment est mis à jour avec `history.replaceState` à chaque modification. Un fragment présent au chargement restaure le tableau et déclenche la recherche.

## 5. Le moteur

### 5.1 Client TMDB

- Identifiants : TMDB accepte soit un jeton d'accès en lecture v4 (chaîne longue commençant par `eyJ`, envoyée en en-tête `Authorization: Bearer`), soit une clé v3 (32 caractères hexadécimaux, envoyée en paramètre `api_key`). Le client accepte les deux et détecte la forme. Ils sont lus dans `window.FRAME_CONFIG.tmdbToken` ou `window.FRAME_CONFIG.tmdbKey` si `config.local.js` existe (fichier ignoré par git, modèle fourni dans `config.example.js`), sinon dans le localStorage. Si aucun identifiant : une fenêtre d'accueil explique en trois lignes comment obtenir une clé gratuite sur TMDB, avec un champ pour la coller et un lien direct vers la page des réglages API de TMDB. L'identifiant est validé par un appel léger (`GET /3/configuration`) avant d'être enregistré. Vérifié le 14 septembre 2026 avec le jeton de Matt : `/movie/11`, `/search/keyword` et `/discover/movie` répondent correctement.
- Toutes les requêtes portent `language=fr-FR`, `include_adult=false`.
- Résolution des mots-clés : `GET /3/search/keyword?query=<nom>`. On retient le résultat dont le nom est identique au nom demandé, en ignorant la casse ; à défaut le premier résultat ; à défaut le mot-clé est marqué introuvable et ignoré, avec un message dans la console. Le résultat est mis en cache dans le localStorage sans expiration.
- Découverte : `GET /3/discover/movie` avec `with_keywords=<ids séparés par |>`, `vote_count.gte=100`, `sort_by` selon la passe. Une page contient 20 films.
- Images : `https://image.tmdb.org/t/p/w342<poster_path>` pour les cartes, `w780` pour un éventuel agrandissement. Un film sans affiche reçoit une carte typographique générée localement avec le titre.
- Cache mémoire par session : clé = sticker + passe + page. Un sticker déjà interrogé ne coûte plus rien.
- Gestion des erreurs : clé invalide (401) ouvre la fenêtre de clé avec un message clair ; réseau indisponible ou 429 affiche un état d'erreur dans la bande de résultats avec un bouton « Réessayer » ; les résultats précédents restent visibles.

### 5.2 Requêtes par sticker

Pour chaque sticker posé, deux passes :

- **Passe populaire** : `sort_by=popularity.desc`, `vote_count.gte=100`, pages 1 à 3 (60 films). Si la page 1 annonce moins de 20 résultats au total, les pages suivantes ne sont pas demandées.
- **Passe estimée** : `sort_by=vote_average.desc`, `vote_count.gte=300`, page 1 (20 films).

Mesure du 14 septembre 2026 : un mot-clé seul comme `rain` ne donne que 40 films avec au moins 100 votes, alors que `rain|neon|cyberpunk` en donne 128. Chaque sticker doit donc porter 4 à 8 mots-clés proches pour avoir un vivier suffisant, et la fusion compte un film comme trouvé par un sticker dès qu'il figure dans l'un des viviers de ce sticker.

Les résultats de chaque passe sont mis en cache. Poser un nouveau sticker coûte donc au plus 4 requêtes plus la résolution de ses mots-clés la première fois.

### 5.3 Fusion et score

Pour chaque film rencontré, on note l'ensemble des stickers dont la requête le contient, et son rang dans chaque liste.

Poids d'un sticker posé : `w = scale` borné entre 0,5 et 3. Un sticker deux fois plus gros compte deux fois plus.

Score d'un film : somme, sur les stickers qui le contiennent, de `w × (1 − rang / 80)` où le rang est le meilleur rang du film dans les viviers de ce sticker, plus un bonus de 0,15 × `w` pour chaque sticker déclarant un genre présent dans les `genre_ids` du film. Les films dont la note moyenne est inférieure à 5,5 sont exclus.

### 5.4 Sélection des 6 films

Le tirage est déterministe : un générateur pseudo-aléatoire est initialisé avec un hachage du tableau (identifiants, tailles, ordre), de sorte qu'un même lien donne les mêmes films.

- **3 évidents** : les trois meilleurs scores parmi les films contenus par au moins deux stickers ; s'il n'y en a pas assez, on complète par les meilleurs scores tout court.
- **2 surprenants** : parmi les films contenus par exactement un sticker, celui de plus grand poids d'abord, choisis dans la passe estimée, en excluant les films déjà pris ; on tire au sort parmi les 8 meilleurs.
- **1 inattendu** : un film tiré au sort parmi les rangs 10 à 20 de la passe estimée d'un sticker choisi au hasard, exclu s'il est déjà présent.

Avec un seul sticker posé, il n'y a pas de film à deux stickers : les évidents sont les 3 premiers de la passe populaire. Avec zéro sticker, aucune requête n'est faite et la bande de résultats montre l'état d'accueil.

Si l'ensemble donne moins de 6 films, on affiche ce qu'on a, sans cases vides.

Stabilité : quand le tableau change, un film déjà affiché qui reste sélectionné conserve sa place s'il reste dans la même catégorie ; les nouveaux prennent les places libérées. Les cartes se déplacent avec une transition, elles ne sautent pas.

### 5.5 Explications

Pour chaque film : la liste des stickers posés qui l'ont trouvé (« honorés ») et la liste de ceux qui ne l'ont pas trouvé (« ignorés »). L'affichage montre les emoji honorés en pleine couleur et les ignorés estompés, dans l'ordre de la toile. Aucun pourcentage. Pour le film inattendu, une mention « pas de côté » remplace la liste des ignorés. Une phrase courte accompagne chaque carte, produite par un gabarit : « Trouvé par 🌃 🌧️, pas par 🤖 ».

## 6. Interface

### 6.1 Direction artistique

Le tableau doit être beau en soi. La toile est une salle obscure : fond très sombre à dominante bleu nuit, jamais noir pur, avec un léger vignettage et un grain fin. Les stickers Twemoji y flottent avec une ombre portée douce et un très léger halo qui suit leur couleur dominante. Les atmosphères teintent la salle entière : 🟦 la fait basculer dans un bleu nocturne, 🔥 la réchauffe, 🌧️ fait tomber une pluie fine. Les résultats sont des affiches sur un fond à peine plus clair, comme des photos posées sur une table de montage.

Palette : fond `#0B0E14`, surface `#141925`, surface relevée `#1C2333`, texte `#F2EEE6` et `#A9B0BF`, accent unique ambre projecteur `#F2B544`. Le thème est sombre par choix, en accord avec le sujet, sur toutes les plateformes. Les états sémantiques (erreur, succès) ont leurs propres couleurs, distinctes de l'accent.

Typographie : `Syne` pour le nom FRAME, les titres et les étiquettes en capitales espacées ; `Instrument Sans` pour tout le reste, chiffres tabulaires. Google Fonts avec pile de secours système. Échelle de type fixée en `rem` et tenue partout.

Mouvement : les stickers suivent le doigt sans latence perceptible ; au relâchement, un léger amortissement. Les cartes de résultats entrent en fondu et glissement de 8 px, échelonnés de 40 ms. Un seul moment orchestré : le premier résultat qui apparaît après le premier sticker posé. `prefers-reduced-motion` supprime les déplacements et garde les fondus.

Ce qui est banni : gradients violet-bleu, cartes arrondies partout avec ombre uniforme, emoji comme puces de section, texte centré partout, pourcentages de correspondance.

### 6.2 Disposition

Téléphone, en portrait, de haut en bas :

1. Barre d'en-tête compacte : nom FRAME, bouton « Mes tableaux », bouton « Partager ».
2. Toile carrée, largeur pleine moins les marges, maximum 520 px.
3. Tiroir : rangée d'onglets de tiroirs défilante, puis grille de stickers défilante horizontalement, hauteur fixe d'environ 96 px. Un sticker du tiroir se pose par simple toucher : il apparaît au centre de la toile avec une petite variation aléatoire de position, en s'animant depuis le tiroir.
4. Bande de résultats : défilement horizontal, cartes d'affiche au ratio 2:3, largeur d'environ 140 px, avec titre, année, emoji d'explication.
5. Pied de page : attributions TMDB et Twemoji.

Ordinateur, à partir de 900 px de large : deux colonnes. Colonne gauche : toile (maximum 640 px) et tiroir en dessous. Colonne droite : résultats en grille de 2 ou 3 colonnes, cartes plus grandes, explications complètes. L'en-tête reste commun.

Marges latérales d'au moins 16 px à toutes les largeurs. Aucun défilement horizontal de la page elle-même.

### 6.3 Gestes et clavier sur la toile

- Toucher un sticker du tiroir : pose au centre.
- Glisser un sticker posé : déplacement, avec `Pointer Events` et `setPointerCapture`, sans conflit avec le défilement de la page (la toile a `touch-action: none`).
- Pincer à deux doigts sur un sticker : redimensionner. Molette sur un sticker survolé : redimensionner.
- Toucher un sticker posé : le sélectionner ; une petite barre d'outils apparaît près de lui avec agrandir, réduire, retourner, mettre devant, supprimer. C'est l'alternative sans glisser exigée pour l'accessibilité.
- Double toucher : retourner.
- Glisser un sticker hors de la toile : supprimer, avec un retour visuel pendant le geste.
- Clavier, sticker sélectionné : flèches pour déplacer (Maj pour un pas plus grand), `+` et `-` pour la taille, `R` pour retourner, `Suppr` pour supprimer, `Tab` pour passer au sticker suivant, `Échap` pour désélectionner.
- Chaque sticker posé est un élément focusable avec un libellé accessible (« chapeau, sticker 3 sur 5 »). La toile expose en parallèle une liste textuelle masquée visuellement et lue par les lecteurs d'écran : « pluie, ville la nuit, robot ».
- Bouton « Vider la toile » avec confirmation légère (annulable pendant 5 secondes).
- Annuler et rétablir : `Ctrl/Cmd+Z` et `Ctrl/Cmd+Maj+Z`, boutons discrets dans l'en-tête, pile de 50 états.

### 6.4 Premier lancement et états vides

Jamais de toile vide et muette. Au premier lancement, sans fragment d'URL : la toile affiche trois miniatures de tableaux d'exemple à remixer, nommés « Nuit urbaine », « Forêt étrange », « Drame mondain », et un bouton « Toile vierge ». Toucher une miniature charge le tableau et lance la recherche. Sous la toile vide, la bande de résultats affiche une phrase d'amorce : « Pose un sticker, les films arrivent. »

Après le premier sticker, un résultat apparaît. Après le troisième, une indication discrète de largeur de recherche : « Large » jusqu'à 2 stickers, « Précise » à partir de 3, « Très précise » à partir de 6. Aucune injonction, seulement une information.

### 6.5 Partage, Mes tableaux, journal

- **Partager** : copie l'URL courante dans le presse-papiers avec confirmation « Lien copié ». Sur mobile, utilise l'API de partage native si disponible. Le lien ouvert par quelqu'un d'autre restaure le tableau et affiche ses résultats à lui : c'est « Essayer ce tableau ».
- **Mes tableaux** : un panneau latéral liste les tableaux sauvegardés (miniature rendue à partir du modèle, nom, date). « Sauvegarder » demande un nom, proposé par défaut à partir des 3 premiers stickers. Suppression possible. Stockage local uniquement.
- **Journal** : à chaque clic sur une carte de film, on enregistre localement le tableau encodé, l'identifiant du film et l'horodatage. Le panneau « Mes tableaux » a un onglet « Chemins » qui liste ces couples, les plus récents d'abord. Ce journal est la trace « voici comment tu es arrivé à ce film ».
- Un clic sur une carte ouvre une fiche compacte : affiche en grand, titre, année, résumé TMDB, explication complète, lien vers la page TMDB. Fermeture par geste ou bouton.

### 6.6 Mode liste (test de la règle absolue)

Le paramètre `?mode=liste` remplace la toile par une grille de chips : les mêmes stickers, les mêmes tiroirs, sélection par toucher, une chip sélectionnée peut être marquée « important » (équivalent d'un gros sticker). Même moteur, mêmes résultats pour la même sélection. Aucune position. L'en-tête n'indique pas quel mode est actif pour permettre un test à l'aveugle. Ce mode n'est accessible que par l'URL.

## 7. Stockage local

Clés du localStorage, toutes préfixées `frame.` :

- `frame.tmdbKey` : la clé ou le jeton TMDB saisi dans la fenêtre d'accueil.
- `frame.kw` : cache des mots-clés résolus, objet `{ nom: id }`.
- `frame.boards` : tableaux sauvegardés, tableau d'objets `{ id, name, encoded, savedAt }`.
- `frame.journal` : chemins, tableau d'objets `{ encoded, movieId, title, at }`, plafonné aux 500 derniers.
- `frame.seenIntro` : booléen, pour ne montrer l'accueil qu'une fois.

Toute lecture et écriture est protégée par `try/catch` ; l'application fonctionne sans localStorage, en perdant seulement la persistance.

## 8. Gestion des erreurs et cas limites

- Sans clé : fenêtre d'accueil, la toile reste utilisable, la bande de résultats explique qu'il manque la clé.
- Clé refusée : message dans la fenêtre de clé, sans perdre la saisie.
- Mot-clé introuvable sur TMDB : ignoré, message console, le sticker garde ses autres mots-clés ; si un sticker n'a plus aucun mot-clé résolu, il est compté comme « ignoré » dans toutes les explications.
- Réseau absent ou 429 : état d'erreur avec « Réessayer », résultats précédents conservés.
- Fragment d'URL invalide : tableau vide, message discret « Ce lien ne contient pas de tableau lisible ».
- Plus de 40 stickers : le tiroir refuse la pose avec un message court.
- Film sans affiche : carte typographique.
- Aucun résultat : message « Rien ne correspond à ce tableau, essaie d'enlever un sticker », jamais une bande vide silencieuse.

## 9. Tests

Tests automatiques avec `node --test`, sans dépendance, dans `tests/` :

- `stickers.test.mjs` : identifiants uniques, emoji uniques, chaque sticker dans un seul tiroir, au moins 2 mots-clés, aucun libellé qui soit un mot abstrait de la liste interdite, ordre stable vérifié par un instantané des identifiants.
- `url.test.mjs` : aller-retour encodage et décodage sur des tableaux variés, robustesse aux fragments malformés, taille maximale.
- `board.test.mjs` : opérations pures (poser, déplacer, redimensionner avec bornes, retourner, supprimer, mettre devant, plafond de 40).
- `engine.test.mjs` : fusion et sélection sur des jeux de données fixes, déterminisme du tirage, comportement à 0, 1, 2 et 6 stickers, exclusion des doublons, stabilité des places.

Vérification manuelle dans un vrai navigateur avant livraison, aux largeurs 390 px et 1280 px : gestes, clavier, absence de défilement horizontal, transitions, mode liste, partage, sauvegarde, et un parcours complet avec une clé TMDB réelle si disponible, sinon avec un client TMDB simulé branché par `?demo=1` qui sert des réponses fixes.

`tools/check-keywords.mjs` se lance avec une clé en variable d'environnement et liste les mots-clés introuvables sur TMDB, pour corriger le vocabulaire.

## 10. Structure des fichiers

```
index.html
config.example.js
styles/
  tokens.css        variables de couleur, type, espacement
  base.css          reset léger, typographie, layout
  canvas.css        toile, stickers, atmosphères
  drawer.css        tiroir
  results.css       cartes et fiche
  panels.css        Mes tableaux, fenêtre de clé, partage
src/
  stickers.js  board.js  url.js  tmdb.js  engine.js
  canvas.js  drawer.js  results.js  storage.js  app.js
  demo.js           client TMDB simulé pour ?demo=1
tests/
  stickers.test.mjs  url.test.mjs  board.test.mjs  engine.test.mjs
tools/
  check-keywords.mjs
docs/superpowers/specs/2026-09-14-frame-design.md
README.md          lancement, clé TMDB, déploiement GitHub Pages, attributions
```

## 11. Ce que le prototype doit prouver

À la fin, Matt fait tester à quelques personnes, à l'aveugle, la toile et le mode liste avec les mêmes stickers. Si la toile ne donne pas une expérience nettement plus engageante et des tableaux plus riches que la liste, la règle absolue dit que le concept doit changer d'angle. Le prototype existe pour rendre ce test possible, pas pour le trancher.
