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
Trois écrans personnels : **Ma liste** (ce qu'on a marqué, organisé), **Mon
miroir** (ce que ces marques disent de tes goûts) et **Soirée** (choisir à
plusieurs).

Répartition des rôles entre les deux chantiers qui avancent en parallèle :

| Chantier | Périmètre | Fichiers |
|---|---|---|
| **Fonctionnel** | recherche, filtres, pagination, fiches, lecture, stockage, miroir, graphe | `card.js`, `discovery.js`, `topics.js`, `anime.js`, `collections.js`, `graphe.js`, `miroir.js`, `src/miroir.js`, `src/graphe.js`, `src/credits.js` |
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
- **72 collections thématiques**, rangées en 13 familles — chacune n'étant qu'un
  jeu de critères visibles et modifiables, et qui s'efface dès qu'on en touche un.
- **Trois univers** : `Tout · Anime · Sans anime`. L'univers anime impose
  l'animation japonaise et **remplace** la rangée des sous-genres par les
  **78 catégories d'anime** (Crunchyroll / Wakanim), rangées en 10 familles.
  « Sans anime » exclut l'animation japonaise sans toucher au reste — Pixar
  reste là. Voir la section 10.
- **Filtres** : décennie, durée, langue, votes minimum, genres, sous-genres,
  catégories d'anime, tris.
- **Trois affichages** : Grandes, Compactes, et **Graphe** — les mêmes films en
  points reliés par réalisateur, saga, casting ou genre. Voir la section 11.
- **Recherche avancée** : par personne (réalisation, production, jeu) et par
  société (studio, chaîne). Une filmographie arrive entière, d'un seul coup, avec
  son métier exact. Le réalisateur et la société sont **cliquables** dans une
  fiche. Voir la section 11.

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

### Le miroir

Un portrait calculé à partir des marques : figures de geste, rythme sur douze
mois, territoires par genre, ciel de décennies, écart au public, signature
d'emoji et mots employés — et une section « ce qui manque » qui dit ce que le
miroir ignore, combien, et ce que le combler donnerait. Voir la section 8.

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

## 5. Le profil synchronisé

### Ce que c'est

Un nom, un avatar, et un **code de douze signes** qui relie les appareils. Pas
d'inscription, pas de mot de passe, pas d'e-mail, pas d'identifiant de compte.

### Pourquoi pas de vrais comptes

Netlify Identity — l'authentification intégrée de Netlify — est **déprécié** :
Netlify renvoie vers Auth0. Un vrai système de comptes demanderait donc une base
Postgres (Netlify DB), du hachage de mot de passe, des sessions, du rate-limiting
et **un service d'e-mail** pour la vérification et la réinitialisation, plus de
la sécurité écrite à la main. Netlify déconseille d'ailleurs son propre stockage
clé-valeur pour des données par utilisateur.

Ruling: pour un carnet de films personnel, le jeu n'en vaut pas la chandelle. Un
code long est une clé de coffre, pas un mot de passe : on ne demande à personne
de le retenir, on le recopie une fois — coût si faux : un code perdu est un
profil perdu, il n'y a pas de récupération. C'est écrit dans le README.

### La règle de fusion

Le plus récent gagne, **film par film**, et non « l'appareil A écrase
l'appareil B ». Sans cela, marquer un film sur le téléphone puis un autre sur
l'ordinateur en perdrait un. On garde donc un horodatage par film ET par nature
— marque, avis, commentaire, film — ce qui permet aussi d'enregistrer une
SUPPRESSION : une clé horodatée sans valeur veut dire « effacé, et plus récemment
que l'autre ».

Ruling: une fusion par appareil est plus simple à écrire et perd le travail de
l'autre — coût si faux : des données disparues qu'on ne remarque que trop tard.

### Où c'est rangé

`netlify/functions/profil.mjs`, sur Netlify Blobs en cohérence forte — une
synchronisation qui relit aussitôt ce qu'elle vient d'écrire ne doit pas tomber
sur une copie en retard. En local, la fonction retombe sur des fichiers ignorés
par git, pour qu'on puisse l'éprouver avant de publier.

Ruling: `@netlify/blobs` est la SEULE dépendance du projet, et elle ne part
jamais dans le navigateur. Un test le vérifie désormais explicitement — le
client reste sans aucune dépendance — coût si faux : un paquet dans la page.

### Ce qui est vérifié

**Entre deux navigateurs distincts**, deux profils, deux stockages : le téléphone
marque un film, l'ordinateur en marque un autre, le téléphone se relie au code —
et **les deux marques survivent**. Puis l'ordinateur récupère celle du téléphone,
les deux sont identiques, et modifier un même film d'un côté l'emporte des deux
côtés. Un code inventé ne fait rien perdre, un code trop court est refusé sur
place. Zéro exception.

### Ce qui reste ouvert

- **Un code perdu est un profil perdu.** Il n'y a ni récupération ni transfert.
- **Pas de révocation** : on peut changer de code, mais l'ancien reste lisible
  par qui le connaît.
- **Pas de limite de débit** sur la fonction : douze signes rendent le
  tâtonnement impraticable, mais rien ne l'interdit explicitement.
- **Le profil ne partage rien** : pas de liste publique, pas d'ami, pas de
  comparaison. Ce serait l'étape suivante si elle est voulue.

---

## 6. Ma liste : ne rien perdre, et l'organiser

### Le problème, posé par Matt

« Je veux pas perdre ma watchlist. » La crainte était juste et concrète : la
watchlist vit dans le `localStorage` d'une adresse donnée, et le site publié est
une AUTRE adresse — donc un autre stockage, vide. Il n'y avait aucun pont.

### Trois filets

**Le fichier.** Exporter télécharge un JSON, importer le relit. C'est la seule
sauvegarde qui ne dépend de personne, et le seul pont entre deux adresses.
L'import ne remplace pas : il FUSIONNE, avec la même règle que la
synchronisation — le plus récent gagne, film par film.

**Le code de synchronisation.** Déjà là.

**Le lien de partage.** Une copie en lecture seule, sous un second code.

Ruling: une sauvegarde qui dépend d'un service n'est pas une sauvegarde — coût
si faux : le jour où le service disparaît, tout disparaît avec lui.

### L'écran

« Ma liste » était une pastille de filtre parmi d'autres sur le mur, pas un
endroit. C'est devenu un écran : groupé par état dans l'ordre où on veut lire
(à voir d'abord), triable, cherchable, avec le nombre par état. La pastille
d'en-tête remplace « Mon miroir », qui reste accessible depuis le profil — là où
sont déjà les choses personnelles.

Ruling: cinq blocs dans un en-tête, c'est le maximum — coût si faux : un sixième
bouton à ajouter, et plus rien qui tienne sur un téléphone.

### Le partage expose une liste blanche

Le document public est construit en ÉNUMÉRANT ce qui sort — affiche, titre,
année, type, état, note publique — et non en retirant ce qui ne doit pas sortir.
La différence compte : si j'écris « enlève les commentaires », le jour où
j'ajoute un champ au document privé, il part en ligne sans que personne ne s'en
aperçoive.

Ruling: une liste blanche reste sûre quand le modèle change, une liste noire non
— coût si faux : un commentaire intime publié à l'insu de tout le monde.

Vérifié sur le document réellement servi : 9 champs exposés, ni `overview`, ni
`keywords`, ni commentaires, ni avis — et le commentaire écrit pour le test
n'apparaît nulle part dans la réponse du serveur.

### Ce qui est vérifié

Export des quatre marques et du commentaire, **import sur un navigateur vierge**
(les quatre films arrivent), la liste groupée par état, le tri qui change l'ordre
d'un groupe, la recherche qui filtre, le lien de partage ouvert dans un troisième
navigateur qui n'a jamais vu l'application — la liste s'ouvre seule, nomme son
propriétaire, et n'expose aucun commentaire. Un code inventé le dit sans rien
montrer.

### Ce qui reste ouvert

- **Le partage est une COPIE.** Il faut republier après avoir changé sa liste.
- **« Arrêter le partage » n'oublie que le lien local** : le document reste
  lisible par qui connaît le code. Il n'y a pas de révocation côté serveur.
- **Pas de nom sur le lien** au-delà de celui du profil, et pas de description.
- **L'import ne se souvient pas** de ce qui vient d'où : on ne peut pas annuler.

---

## 7. Publication

Le dépôt est **public** : <https://github.com/MattJeanLouis/frame>, branche `main`.
Le site est prêt pour Netlify (`netlify.toml`), mais **pas encore déployé** : il
faut lier le dépôt dans Netlify et y ajouter la variable `TMDB_TOKEN`.

### La clé TMDB ne va pas dans la page

C'est la seule décision technique qui compte ici. Une clé recopiée dans un site
statique est lisible par n'importe qui, et épuisable par n'importe qui. Le site
publié passe donc par **une fonction Netlify** (`netlify/functions/tmdb.mjs`) qui
relaie l'API et garde la clé dans les variables d'environnement.

La fonction n'accepte qu'un **chemin d'API TMDB** — pas d'URL absolue, pas de
`..`, pas de schéma, pas de POST. Un relais ouvert à tout serait pire que pas de
relais : il ferait porter n'importe quelle requête à la clé. Vérifié : une URL
absolue et une remontée de chemin sont refusées.

Le client, lui, choisit sa route tout seul : clé locale (`config.local.js`) →
TMDB en direct ; pas de clé mais un relais qui répond → le relais ; ni l'un ni
l'autre → catalogue de démonstration. Il le **demande** au lieu de le supposer,
parce qu'un drapeau inscrit dans le code finirait par mentir dans l'un des trois
cas.

### La soirée ne tourne pas sur Netlify

Netlify ne sert que des fichiers : il n'y a nulle part où tenir l'état partagé
d'une partie. Le site publié sert d'interface, et l'hôte lance `npm run room` sur
son ordinateur ; les autres s'y connectent sur le même réseau. C'est écrit dans
le README et dit dans l'écran de soirée.

### Sans redirection attrape-tout

Le réflexe « application d'une seule page » veut que toute adresse serve
`index.html`. Ici ce serait nuisible : la page demande `config.local.js`, qui
n'existe pas en ligne ; servi en HTML, ce fichier fait échouer le chargement du
script avec « Unexpected token '<' ». L'application n'a pas de routeur — elle
passe par des paramètres d'adresse — donc une adresse inconnue doit être un 404.

### Vérifié sur la version construite

`npm run build` puis `npm run servir-dist` reproduisent exactement ce que Netlify
servira, fonction comprise. Éprouvé dans Chrome : `config.local.js` en 404 et non
en HTML, aucun jeton dans la page, 114 appels au relais tous en 200, catalogue en
direct (40 titres), fiche complète, **aucune exception** — puis sur téléphone :
aucun défilement horizontal, rien hors écran, aucune cible tactile sous 32 px,
grille à deux colonnes, fiche à 44 px par état.

### Reste ouvert

- **Le site n'est pas encore déployé** : il manque le lien Netlify et `TMDB_TOKEN`.
- **Pas de nom de domaine** : l'adresse sera `*.netlify.app`.
- **Le catalogue est cher en appels** : chaque visite charge des vignettes TMDB
  et interroge le relais une centaine de fois. Le relais met une heure en cache,
  mais il n'y a pas de limite de débit par visiteur.

---

## 8. Le miroir : ce que tes gestes disent de tes goûts

Matt : « concentre-toi sur la page Mon miroir pour véritablement montrer les
statistiques de tes films — de beaux graphes, des KPI, et des explications —
en prenant en compte que je n'ai pas complètement tout rempli. »

### Le problème, avant le dessin

Le miroir ne montrait que deux nuages d'emoji : ce que Matt ajoutait aux
propositions de TMDB, et ce qu'il en retirait. C'était juste, et c'était tout —
aucun moyen de voir sa culture, son rythme, ses territoires.

Mais la vraie difficulté n'était pas là. Elle était dans la deuxième moitié de
sa phrase : **son carnet est incomplet, et il le restera.** Sur un vrai carnet,
la plupart des films marqués n'ont ni avis ni commentaire, et une partie des
marques date d'avant qu'on garde les horodatages. Un miroir qui fait comme si
tout était rempli est un miroir qui ment — et un miroir qui se plaint d'être
incomplet est un miroir qui reproche.

### La règle qui gouverne tout

Chaque mesure sort avec **son effectif**, et rien ne conclut sous quatre films :
en dessous, deux films font une tendance et trois font une opinion. Une section
sans matière ne s'affiche pas du tout. Et ce qui manque est dit **une seule
fois**, dans « ce qui manque », avec ce que le combler donnerait.

C'est le cœur du travail : transformer l'incomplétude en contenu. « Je pourrais
te dire combien de jours tu as passés dans le noir — il me manque la durée de
34 films » est plus honnête, et plus intéressant, qu'un total calculé sur un
tiers des données.

### Les graphes sont faits de films

C'est la réponse à l'anti-référence « tableau de bord ». Un histogramme de
barres grises ne dit rien de cette application-ci ; ici :

- les **territoires** sont des bandes d'affiches, une par genre, avec une jauge
  d'amour qui se tait quand il n'y a pas assez de films jugés ;
- les **années** sont un ciel d'affiches : une tour par décennie, chaque tour
  proportionnelle au nombre réel et plafonnée, avec le compte écrit en clair ;
- le **rythme** est un graphe de douze mois, mois vides compris — un mois vide
  est une information, et un histogramme qui saute les mois vides invente une
  régularité ;
- les **figures** sont une planche-contact : des cellules séparées par un fil de
  1 px, pas des cartes arrondies à ombre.

Et partout, les affiches sont des portes : on ouvre une fiche par-dessus le
miroir, on marque, on revient — et les chiffres ont bougé.

### La ligne entre chiffre et jugement

Les chiffres comptent des **gestes** : films marqués, avis posés, mots écrits,
temps passé, coups de cœur. Jamais des films jugés. Il n'y a pas de pourcentage
de correspondance, pas de note de FRAME, pas de score. La seule comparaison de
la page porte sur Matt : l'écart entre la note **publique** de TMDB et ce qu'il
en a dit — ses secrets (des coups de cœur que presque personne n'a vus) et ses
dissidences (des films que le public porte haut et qu'il n'a pas aimés). Aucun
des deux n'est une faute, et la page le dit.

Le principe 5 de `CLAUDE.md` a été révisé en conséquence : la ligne n'est plus
« jamais de chiffres » mais « jamais de jugement ».

### Ce qui est vérifié

Un vrai carnet fabriqué à partir de **61 films TMDB réels**, volontairement à
trous : 40 films marqués sans avis, 20 jugés sans une ligne, 10 durées
manquantes, 42 films sans leurs mots-clés, 11 gestes sans date. Les effectifs
affichés sont comparés à un oracle calculé dans Node **avec le même module** que
l'application : si l'écran compte autre chose que le calcul, l'un des deux ment.

Éprouvés aussi : la fiche qui s'ouvre **au-dessus** du miroir et Échap qui la
ferme sans fermer le miroir, la place conservée au retour, l'action qui montre
son avancement (« 6 / 10 ») et le manque qui **disparaît** une fois comblé,
aucune classe CSS sans règle, aucune affiche invisible, le miroir vide qui se dit
vide, et sur téléphone : aucun débordement, aucune cible sous 32 px, douze mois
sur la largeur.

Trois défauts trouvés **en regardant les captures**, pas en lisant les mesures :
« 1 j 18 h » se coupait en deux, un genre s'affichait en identifiant brut
(« Ton territoire, c'est 12. » — la table est un `Map`, le module lisait un
objet), et deux titres de section restaient affichés au-dessus d'un nuage vide.

### Ce qui reste ouvert

- **Le temps passé n'est exact que si les durées sont connues.** Il ne s'affiche
  qu'au-delà de la moitié des films vus, et une durée que TMDB ne publie pas est
  notée comme telle pour ne pas rester un manque éternel.
- **Le rythme ne remonte qu'à douze mois.** Les gestes plus anciens comptent
  dans les totaux et disparaissent du graphe.
- **Les mots sont comptés, pas compris** : pas de thèmes, pas de sentiments, une
  liste de mots vides en français et rien de plus.
- **Les territoires reposent sur UN genre principal par film** — TMDB en donne
  plusieurs, un film à trois genres compte dans les trois.

---

## 9. Le lecteur : les mêmes commandes dans les deux modes

Matt : « j'ai pas de quoi activer le son ou voir l'affiche dans le player du mode
explorer alors que je les ai dans le player de l'autre mode. »

### Deux vrais manques

Le fil vertical proposait « Activer le son » et « Voir l'affiche ». La fiche
d'Explorer, elle, n'avait que pause, ±10 s, vitesse et position. Deux
conséquences, toutes les deux réelles :

- **la bande-annonce démarre MUETTE** (`mute=1` : sans cela, aucune ne démarre).
  Dans la fiche, on la regardait donc en silence sans aucun moyen de l'entendre ;
- **l'affiche est DESSOUS la vidéo**, floutée à 22 px : c'est le fond de la salle,
  pas une image. Dans la fiche, on ne pouvait pas la voir.

### Une seule implémentation, dans le lecteur partagé

Les deux commandes sont entrées dans `buildPlaybackControls`, que les deux modes
utilisent déjà. Le fil vertical ne les a plus en double dans son menu — il ne
garde que « Masquer les infos », qui n'a de sens que là.

Règle tenue : **un seul lecteur parle à la fois.** Lever le son quelque part le
baisse partout ailleurs, et chaque bouton redit l'état réel de SON lecteur.

### Le piège que la mise en page a failli refermer

`.moment-poster .playback { display: none }` cachait toute la barre quand
l'affiche était montrée. En y déplaçant le bouton d'affiche, il se serait caché
**avec ce qu'il venait de remplacer** : plus aucun moyen de revenir à la
bande-annonce. La règle ne cache donc plus que `.playback__moment` et
`.playback__seek` — ce qui n'a plus d'objet — et laisse le son et l'affiche.

### Vérifié en commandant vraiment

`verif-lecteur-commun.mjs` n'éprouve pas qu'un bouton existe : il espionne les
commandes réellement sérialisées vers YouTube et exige `unMute`, `setVolume`,
`mute`, `pauseVideo`. Un bouton qui changerait de libellé sans rien commander
serait pire que pas de bouton.

Et parce que l'espion lui-même peut mentir : la première version enveloppait
`contentWindow` dans un `Proxy`. L'application route les messages de YouTube en
comparant `frame.contentWindow === event.source` — un Proxy rend cette
comparaison fausse, le lecteur ne répondait plus, la vidéo ne jouait plus, et le
test accusait l'application d'une panne **qu'il avait fabriquée**. L'espion
enveloppe maintenant `JSON.stringify`, qui précède l'envoi : toutes les
commandes passent, aucune identité ne change.

### Reste ouvert

- **Le son ne survit pas à un rechargement** : chaque bande-annonce redémarre
  muette, par choix — c'est ce qui permet à onze aperçus de coexister.
- **La position n'est pas mémorisée** d'une ouverture à l'autre.
- **YouTube impose son cadre** : `controls=0` est ignoré, la barre native reste
  visible. Compromis déjà consigné, on garde le cadrage correct.

---

## 10. L'univers anime, et les collections

Matt : « je voudrais que dans les filtres on puisse facilement swapper entre
anime et film, et genre pour les anim japonais genre manga ; qu'y ait toutes les
catégories des anime manga qu'on trouve dans Crunchyroll / Wakanim, pour vraiment
aider les amateurs d'anime — et ceux qui aiment pas les anime, ils peuvent
facilement pas les inclure dans ce qu'ils veulent voir. »

Deux demandes en une, et la seconde n'est pas le négatif de la première :
**entrer** dans l'anime, et pouvoir **s'en exclure**.

### Ce que TMDB sait vraiment faire

Rien de tout cela n'était donné. Trois faits ont été mesurés avant d'écrire une
ligne, et deux ont changé le dessin :

- **TMDB n'a pas de genres d'anime.** Il a un genre « Animation » (16) et un
  vocabulaire de mots-clés. Toute la taxonomie vit donc dans les mots-clés — et
  chaque identifiant a été *mesuré*, pas deviné. `sonde-anime.mjs` a essayé
  65 concepts, plusieurs orthographes chacun, et n'a retenu qu'une
  correspondance exacte.
- **`without_original_language` N'EXISTE PAS.** TMDB ne renvoie pas d'erreur :
  il ignore le paramètre. Le total était rigoureusement identique avec et sans
  (11 392 dans les deux cas). Exclure l'anime par la langue était donc
  impossible — et un test qui aurait « vérifié » le paramètre aurait été vert
  pour rien.
- **`with_keywords` accepte plusieurs identifiants** : la virgule intersecte, la
  barre verticale réunit. Nos catégories se réunissent — choisir « Isekai » et
  « Mecha » veut dire l'un ou l'autre.

### La définition, assumée

`estAnime(film)` = **genre 16 ET langue originale japonaise**. C'est la
définition la plus large et la plus honnête qu'on puisse tenir sans jugement de
goût : un film d'animation japonais qui n'a pas le mot-clé `anime` reste un
anime. Les deux champs sont déjà dans chaque résultat de `discover` : le test ne
coûte **aucune requête**, et il est exact.

C'est lui qui rend « Sans anime » fiable. Le paramètre envoyé à TMDB
(`without_keywords=210024`, le mot-clé canonique, posé sur 2 441 films et
4 407 séries) ne sert qu'à densifier les pages.

### Trois positions, pas deux

`Tout · Anime · Sans anime`. « Sans anime » n'est pas l'inverse d'« Anime » :
c'est une position pour qui n'en veut pas, et elle se tient toute seule.

Le piège évité : exclure l'anime par `without_genres=16` aurait emporté **Pixar,
Ghibli et tout le cinéma d'animation mondial**. C'est l'animation *japonaise*
qu'on écarte, pas l'animation.

### Le swap

En univers anime, la rangée des **thèmes et sous-genres s'efface** au profit des
**catégories d'anime**. Ce n'est pas un ajout, c'est un remplacement, et il est
voulu : « Horreur » + « fantômes » ne dit rien à qui cherche un shōnen ; en
revanche « Horreur » + « Gore » ou « Psychologique » dit exactement ce qu'il
faut. Les deux rangées ne coexistent jamais — sinon on ne saurait plus laquelle
parle.

Les 78 catégories sont rangées en **10 familles** nommées et expliquées, avec un
champ de recherche qui traverse les familles (« shonen » trouve « Shōnen » sans
qu'on tape le macron). Elles couvrent la démographie manga (shōnen, shōjo,
seinen, josei, kodomo), les genres qui n'existent qu'en anime (isekai, mecha,
magical girl, tranche de vie, iyashikei, harem, idol, otome, méchante,
délinquant…), et la source (manga, light novel, visual novel, manhwa, boys'
love, yuri, ecchi).

**Une catégorie qui ne rend rien n'a pas sa place ici.** La table est vérifiée
contre TMDB dans l'intersection réelle de la requête — animation ET japonais —
et pas dans l'absolu.

### Ce qui a été trouvé en chemin, et qui n'était pas demandé

En vérifiant les collections, `verif-collections.mjs` a buté sur une collection
qui rendait zéro film. La cause n'était pas la collection : **`romantic comedy`
est un mot-clé TMDB qui existe (id 383992) et sur lequel aucun film n'est
posé.** Il était utilisé par le sous-genre « comédie romantique ».

`sonde-mots-cles.mjs` a alors passé au crible les **234 mots-clés déclarés par
l'application** :

- six étaient **morts** — la pastille s'allume, et il n'y a rien derrière :
  `romantic comedy`, `traditional animation`, `single location`,
  `found footage film`, `serial murder`, `based on a true story` ;
- huit étaient **agonisants** (moins de douze titres) : `car chase` (1),
  `true story` (1), `korean war` (1), `sentient robot` (2),
  `artificial intelligence` (3), `breakup` (4), `middle ages` (6),
  `animal` (10).

Le plus instructif : `artificial intelligence` existe en deux exemplaires.
`artificial intelligence (a.i.)` (id 310) porte **300 titres** ; la version sans
parenthèses en porte **3**. Le sous-genre pointait sur la mauvaise.

Tous remplacés par des mots-clés vivants et mesurés. Après correction :
**229 mots-clés, zéro mort, zéro agonisant.**

### Les collections : de 12 à 72

Matt : « j'aime beaucoup les collections, il m'en faut beaucoup plus. » Elles
passent de 12 à 72, rangées en **13 familles** — horreur, science-fiction,
polar, action & aventure, drame, comédie, romance, documentaire, famille,
époques, pays, format, anime.

Trois choses rendent l'élargissement tenable :

- **`verif-collections.mjs` ouvre chaque collection** en rejouant la requête
  exacte que construit l'application — genres traduits par type, mot-clé résolu
  par son nom exact, univers appliqué. Les 72 rendent des films.
- **Les familles sont la source**, la liste à plat en découle. Recopier une
  famille dans chaque collection aurait fini par diverger, et le panneau range
  les tuiles par famille : une divergence se verrait.
- **Le panneau n'est plus un défilement horizontal.** Soixante-douze tuiles à la
  queue leu leu faisaient seize mètres de tuiles ; on ne trouvait rien. Il se
  parcourt verticalement, par familles.

Deux défauts trouvés **en regardant les captures** : le premier jet avait un
défilement propre à la rangée des catégories, **imbriqué dans un panneau qui
défile déjà** — au doigt, on fait glisser l'un et c'est l'autre qui bouge ; et
la phrase d'explication de chaque famille était écrite dans `anime.js` sans être
affichée nulle part. Donnée morte : elle est maintenant rendue.

### Ce qui est vérifié

`verif-anime.mjs` travaille à deux niveaux, et le premier compte plus que le
second :

1. **ce que l'application DEMANDE à TMDB** — on lit les URL réellement envoyées.
   Chaque requête de l'univers anime porte `with_genres` contenant 16 et
   `with_original_language=ja` ; chaque requête de « Sans anime » porte
   `without_keywords=210024` et **pas** de retrait du genre animation.
2. **ce qui ARRIVE à l'écran** — rangées qui se remplacent, étiquettes actives,
   catégories réellement retirées quand on quitte l'univers (pas seulement
   cachées), titre et note, aucun débordement, cibles de 44 px sur téléphone,
   aucune exception.

Le contrôle décisif est ailleurs, et il a fallu le chercher : sur `discover`,
c'est `without_keywords` qui fait tout le travail côté serveur — le mur a l'air
propre **même si le filtre local ne servait à rien**. Mais `/search/` **ignore**
ce paramètre : TMDB ne sait pas filtrer une recherche par mot-clé. C'est donc
là, et seulement là, que `estAnime` est la seule défense. En cherchant
« vampire » :

> 80 titres reçus, **17 anime arrivés par la recherche** (Vampire Princesse
> Miyu, Blood: The Last Vampire, Rosario + Vampire…), **aucun à l'écran.**

### Reste ouvert

- **`with_keywords` ne permet pas d'exclure une catégorie** : on peut empiler
  des catégories, pas en retirer une. « Isekai sauf harem » n'est pas
  exprimable.
- **La définition par genre + langue attrape de l'animation japonaise qui n'est
  pas « un anime »** au sens des amateurs (un court métrage d'auteur, une
  publicité animée). C'est le prix de l'honnêteté : on ne juge pas le goût.
- **Soixante-douze collections, c'est déjà beaucoup pour un panneau.** Il n'y a
  pas de recherche dedans ; à cent, il en faudra une.
- **Les catégories d'anime ne se combinent qu'en OU.** Deux catégories très
  précises ensemble (« Josei » + « Iyashikei ») rendent peu, et on ne peut pas
  demander l'intersection.

---

## 11. Le graphe, et la recherche par qui l'a fait

Deux demandes de Matt, arrivées ensemble :

> « le mode d'affichage des affiches, on en a que 2, grandes ou compactes — je
> pense qu'on devrait setup une vue graphe de points comme Obsidian. Et aussi
> dans le moteur de recherche, pouvoir entrer et lister par réalisateur ou
> producteur ou partenaire, tu vois, genre en recherche avancée. C'est
> important. »

### La vue graphe

Un troisième choix dans « Affiches », à côté de Grandes et Compactes : **Graphe**.
Le mur s'efface, un canvas prend sa place, et les mêmes films deviennent des
points reliés par ce qu'ils partagent.

**Quatre façons de relier**, et elles se choisissent : Réalisateur, Saga,
Casting, Genre. Les points sont des affiches, pas des pastilles abstraites — un
graphe de ronds colorés pourrait représenter n'importe quoi, celui-ci montre des
films et on reconnaît une grappe avant de la lire.

**Le survol éteint le reste** : à quarante points, tout voir ne veut rien dire ;
c'est le voisinage d'un film qui apprend quelque chose. Le point survolé prend un
anneau ambre, ses liens s'allument, son titre et son nombre de liens s'affichent
à côté. On glisse un point pour le déplacer, le fond pour se déplacer, la
molette pour zoomer, et un clic ouvre la fiche.

**La taille d'un point dit son nombre de liens, jamais sa qualité** — et la
légende l'écrit, sinon la taille raconterait une histoire inventée.

#### Une seule règle de topologie

Dans un groupe — les films d'un même réalisateur — on ne relie pas tout le monde
à tout le monde : **chacun est relié au premier du groupe**. Dix films feraient
45 traits en clique et 9 en étoile. La clique est un plat de spaghettis ; l'étoile
est une grappe qu'on lit d'un coup d'œil.

La position de départ est **déterministe** (spirale d'or) : deux ouvertures du
même mur donnent la même image. Un graphe qui se réorganise au hasard à chaque
fois ne se reconnaît pas.

#### Trois défauts, tous trouvés à l'écran

1. **Le canvas était vide alors que la mesure annonçait « 2 films ».** La
   simulation rappelait les points vers le **milieu du canvas**, pendant que la
   caméra les cherchait autour de **l'origine**. Les nœuds se rangeaient autour
   de (720, 292) et la caméra regardait vers (0, 0). Le graphe vit maintenant
   dans son propre espace et se rappelle vers son **barycentre** ; la vue n'est
   qu'une caméra.
2. **Le graphe par genre s'effondrait en tas.** Quarante films, 93 liens, cinq
   affiches visibles. Deux causes : la longueur de repos était un facteur fixe
   (791 unités sur un canvas de 585 px de haut — les points ne pouvaient pas
   tenir à cette distance, donc les ressorts gagnaient), et un film à vingt liens
   subissait vingt fois le même ressort. Le repos se déduit maintenant de la
   **surface disponible par point**, et chaque nœud divise son ressort par la
   racine de son nombre de liens.
3. **Il débordait par le bas.** Le cadrage était calculé **avant** que la
   simulation n'écarte les points : on mesurait un graphe qui n'existait pas
   encore. Il suit maintenant le graphe qui grandit, tant que personne n'a
   touché à la caméra.

#### Sur un mur maigre, le graphe propose au lieu de se plaindre

Sur un mur de films populaires, personne ne partage de réalisateur : c'est
normal, et ce n'est pas une panne. Mais deux points n'apprennent rien. Le graphe
mesure donc les quatre critères, et **propose** les plus fournis sous forme de
boutons — « Relier par Genre (40) ».

Il ne bascule **jamais** tout seul : changer un critère sous les yeux est la
meilleure façon de faire croire que l'application fait n'importe quoi. Le bouton
est là, on décide.

#### Ce qui est vérifié

`verif-graphe.mjs` ne se contente pas des attributs de donnée. Les affiches TMDB
n'envoient pas d'en-tête CORS, donc le canvas est « souillé » et `getImageData`
est interdit : le test prend une **capture d'écran**, vide le canvas, en reprend
une, et exige que les deux diffèrent. Sans cela, « 2 films dans le graphe » et un
canvas vide passaient pour la même chose — c'est exactement ce qui est arrivé.

Éprouvés aussi : le mur s'efface et ne revient qu'au retour, quatre critères avec
un seul allumé à la fois, le survol qui réagit, le clic qui ouvre la bonne fiche,
aucun débordement, et sur téléphone le canvas qui est **réellement peint**.

#### Reste ouvert

- **Le nombre de points est plafonné à 26 sur téléphone** (90 sur ordinateur).
  Ce n'est pas une limite technique : à quarante affiches dans 390 px, les points
  font onze pixels, on ne peut ni les viser ni les lire. Le graphe dit combien il
  en a examinés sur combien.
- **La disposition n'est pas mémorisée** : revenir au graphe replace les points
  au même endroit, mais un déplacement à la main est perdu.
- **On ne peut pas filtrer depuis le graphe** : cliquer un point ouvre la fiche,
  ça ne restreint pas le mur à son voisinage. C'est la suite naturelle.

### La recherche avancée

Non pas *ce que le film est*, mais **qui l'a fait** : une personne (Réalisation,
Production, Jeu) ou une société (Studio, Chaîne).

#### Ce que TMDB sait vraiment faire, et c'est mesuré

- **`with_crew` ne distingue pas le métier.** Christopher Nolan a 19 crédits de
  réalisateur et 15 de producteur ; `with_crew=525` en renvoie **31**, les deux
  mélangés. Kathleen Kennedy, qui a produit 79 films et n'en a réalisé aucun,
  ressort exactement comme un réalisateur.
- **`with_crew` est purement ignoré sur `/discover/tv`.** Trois personnes
  différentes — Vince Gilligan, Christopher Nolan, et un identifiant qui n'existe
  pas — renvoient le même total : 20 001, c'est-à-dire tout.
- **La recherche de société classe sans rapport avec le contenu.** « a24 »
  renvoie **six** sociétés nommées A24 : 223, 9, 5, 1, 0 et 0 titres. Choisir la
  première rendait un mur vide sans que rien ne l'explique.

#### Une filmographie n'est pas une recherche

C'est une **liste finie, complète et datée**, et TMDB la donne d'un seul coup
dans `/person/{id}/movie_credits`. Une requête, toute l'œuvre — avec l'affiche,
les genres, la note et l'année de chaque titre. Le métier y est écrit noir sur
blanc, donc le filtrage est **exact** au lieu d'approché.

La personne remplace donc les **sources** de la recherche — exactement comme une
saga — et **le reste des filtres continue de s'appliquer par-dessus**, dans
`accept` : genre, décennie, univers, catégories d'anime. Sans cela, choisir un
réalisateur aurait effacé en silence tout ce qu'on venait de régler.

Et la recherche par texte **cherche dedans** : taper « dark » chez Nolan donne
ses films qui contiennent « dark », pas un nouveau départ dans tout le catalogue.

#### Les sociétés se classent par ce qu'elles contiennent

Chaque candidat est compté — films plus séries — avant d'être proposé, et la
liste est triée du plus fourni au moins fourni. Une société sans aucun titre
reste **visible**, grisée et non choisissable : la cacher ferait croire que la
recherche n'a rien trouvé.

#### On rebondit depuis une fiche

« Réalisation : Christopher Nolan » est **cliquable**. Voir un nom et ne pas
pouvoir demander ses autres films, c'est une information qu'on donne et qu'on
reprend aussitôt. Même chose pour la première société de production. Le clic
**quitte les lieux** — liste, « pour toi », collection, saga, recherche en cours —
mais **garde les filtres qui se composent** : genre, univers, décennie, langue.

#### Ce qui est vérifié

`verif-avance.mjs` ne se contente pas qu'un champ existe : il exige **la bonne
liste**. Chez Christopher Nolan, « Réalisation » doit rendre **19** films — ni
les 20 productions, ni les 47 rôles — et « Production » exactement 20, dont
*Man of Steel*, qu'il n'a pas réalisé. Vérifiés aussi : le comptage et le
classement des sociétés, la combinaison avec un genre, le retrait, et sur
téléphone l'absence de débordement et des cibles de 32 px minimum.

#### Reste ouvert

- **Une seule personne à la fois par rôle.** Le modèle accepte plusieurs
  personnes, l'interface n'en ajoute qu'une ; « Nolan ou Villeneuve » n'est pas
  encore demandable.
- **Les séries n'ont pas de réalisateur** : une série a des réalisateurs
  d'*épisodes*, celui qui la porte est le **créateur**. C'est ce qu'on cherche, et
  l'interface le dit — mais on ne peut pas demander « les épisodes réalisés par
  untel ».
- **Le jeu n'est pas vérifiable par métier** : `with_cast` est exact par
  définition, on ne peut pas distinguer un premier rôle d'un caméo.

### La régression que les tests ont attrapée

En câblant la recherche avancée, une ligne est devenue `const ids = []` au lieu
de `let ids = []` — et ce tableau est réaffecté juste en dessous. Résultat :
**toute recherche par thème levait une « Assignment to constant variable »**.
Donc toutes les collections, et tous les sous-genres.

Les tests unitaires passaient (323), `verif-anime.mjs` passait, `verif-avance.mjs`
passait — aucun ne passe par un thème. C'est `verif-coherence.mjs`, qui ouvre une
collection en plein chargement, qui l'a vu : 0 titre au lieu de 40.

Rappel : **un test qui passe ne dit que ce qu'il regarde.** C'est pour ça que la
suite de régression se relance en entier, même quand on croit avoir touché à
côté.

---

## 12. Comment on vérifie

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
node verif-publie.mjs             # la version construite, servie comme Netlify
node verif-profil.mjs             # la synchronisation, entre DEUX navigateurs
node verif-watchlist.mjs          # export, import, lien de partage à TROIS navigateurs
node graine-miroir.mjs            # fabrique un vrai carnet à trous (61 films TMDB)
node verif-miroir.mjs             # le miroir, chiffre par chiffre, contre un oracle Node
node verif-lecteur-commun.mjs     # son et affiche, dans le player des DEUX modes
node verif-anime.mjs              # l'univers anime, l'exclusion, les collections
node verif-anime-table.mjs        # les 78 catégories d'anime, contre TMDB
node verif-collections.mjs        # les 72 collections rendent-elles des films ?
node sonde-mots-cles.mjs          # aucun mot-clé déclaré n'est mort
node verif-avance.mjs             # réalisateur, producteur, studio — la bonne liste
node verif-graphe.mjs             # la vue graphe : ce qu'elle calcule ET ce qu'elle peint
```

Les quatre derniers interrogent TMDB avec la clé locale : ils ne testent pas du
code, ils testent **la vérité de la donnée**. Un identifiant de mot-clé inventé,
une collection vide ou une catégorie qui ne rend rien passent tous les tests
unitaires — et mentent à l'écran.

`verif-publie.mjs` a besoin de `npm run build` puis `npm run servir-dist` : il
éprouve `dist/`, pas les sources, et vérifie en particulier que la clé TMDB ne
part jamais dans la page.

`verif-miroir.mjs` vise les sources par défaut, et la version construite avec
`FRAME_BASE=http://127.0.0.1:8094/` — c'est le seul moyen de savoir si le miroir
survit au passage par le relais.

### Cinq scripts de vérification sont périmés

Constaté le 20 septembre 2026, et **vérifié contre le commit précédent** pour
être sûr que ce ne sont pas des régressions fraîches. `verif-signifiants.mjs`,
`verif-affordances.mjs`, `verif-reactif.mjs` et `verif-video.mjs` éprouvent le
**survol d'avant**.

- Ils attendent la classe `.card.is-peeking` et le diaporama `card.__deck`.
  Or `is-peeking` n'est **plus posée nulle part** dans `card.js` : le survol
  construit maintenant un `.catalogue-preview` (classe `has-preview`). Les six
  règles CSS `.card.is-peeking` de `card.css` sont donc **mortes**.
- Ils cliquent aussi `#wall .card`, alors que l'écouteur est sur le bouton
  enfant `.card__open` : un clic posé sur le parent ne déclenche pas l'enfant.
  C'est déjà corrigé dans `verif-liste.mjs`.

`verif-final.mjs` échoue sur trois points, **à l'identique avant et après** :
la vidéo du fil vertical ne couvre pas sa scène sur téléphone (390×574 de scène
pour 390×219 de vidéo), et la barre d'outils en 390 px ne fait que 260 px de
large avec ses rangées de pastilles à zéro de haut. Le premier point est le
compromis déjà consigné — YouTube impose son cadre, on a choisi le cadrage
correct plutôt que de masquer ses commandes — mais le script, lui, attend
l'inverse.

Ces cinq scripts sont à réécrire ou à supprimer. Les six règles CSS mortes
`.card.is-peeking` relèvent de la couche DA, pas du fonctionnel.

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
