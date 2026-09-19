# FRAME v2 — l'emoji comme langue (note de conception)

Date : 18 septembre 2026. Auteur : l'agent, sur les décisions de Matt.
Remplace la direction du prototype 1 (`2026-09-14-frame-design.md`), dont le socle
technique reste valable.

## 1. Le pivot

Le prototype 1 demandait de **dessiner** un tableau de stickers pour interroger
TMDB. Matt l'a construit, utilisé, puis conclu : ce qui l'intéresse n'est pas de
dessiner, c'est le **langage**. Le tableau était un moyen ; le vocabulaire était
la fin.

La spec v1 §11 prévoyait exactement ce verdict : « Si la toile ne donne pas une
expérience nettement plus engageante et des tableaux plus riches que la liste, la
règle absolue dit que le concept doit changer d'angle. » Il a changé d'angle.

**FRAME v2 est un moteur de films dont la langue est l'emoji.** On y cherche, on
y nomme, on y commente — tout en emoji, sans texte, sauf là où le texte est
inévitable.

Décisions de Matt qui encadrent tout le reste :

| Question | Décision |
|---|---|
| Destinataire | Matt seul : un miroir de son goût, un organiseur personnel |
| Personnalité | Ludique, crédible, intime |
| Esthétique | On garde la salle obscure ; les emoji sont les seules lumières |
| Zéro texte | Emoji partout, texte seulement pour l'attribution TMDB et les lecteurs d'écran |
| Nom des films | Dérivé des données TMDB par défaut, **réécrivable** par Matt |
| Premier objet | La **carte-film**, unité atomique des deux usages |
| Premier écran | Téléphone ; la télécommande ensuite |

Matt a ajouté une intuition qui structure la suite : les **moments** du film —
bande-annonce, extrait, scène — réagis en emoji, « pour scroller sur les
descriptions de film en mode où on peut tout le temps en parler, mais en
émotion ». C'est ce qui rend la signature **méritée** plutôt que devinée.

## 2. Les trois rôles de l'emoji, et leur séparation

C'est le risque principal du concept : le même symbole sert à trois choses.

| Rôle | Ce que ça fait | Contexte |
|---|---|---|
| **Chercher** | une combinaison interroge TMDB | une **palette**, en bas, éclairée, tactile |
| **Nommer** | la combinaison *est* le nom du film | la **signature**, posée sur la carte, plate, jamais cliquable pour chercher |
| **Commenter** | réagir à un moment remplace la signature | une **réaction**, attachée au moment, avec un retour immédiat |

**Le contenant est le signifiant** (Norman). Un emoji de palette est ambre,
soulevé, dans une barre ; un emoji de signature est nu, posé sur l'image ; un
emoji de réaction apparaît en éclatant à l'endroit touché. Aucune légende
n'explique lequel est lequel : la forme, la place et le mouvement le disent.

Règle qui en découle : **un emoji de signature n'est jamais un bouton de
recherche.** Si Matt veut chercher à partir d'un film, c'est une action distincte
et explicite, pas un tap sur le nom.

## 3. La carte-film, objet atomique

La même carte sert de résultat de recherche, d'entrée de bibliothèque et de
support d'avis. Elle a quatre couches, dans cet ordre de lecture :

1. **L'image** — l'affiche, ou le moment en mouvement s'il existe.
2. **La signature** — 2 à 4 emoji, c'est le nom du film.
3. **L'état** — vu, à voir, ou rien.
4. **La réaction** — ce que Matt vient d'ajouter, visible seulement quand il
   vient de le faire.

Aucun titre, aucune année, aucune note. Le texte du film vit dans le libellé
accessible et sur la fiche TMDB liée.

## 4. Le nom-emoji : dérivé, puis mérité

Trois étages. Chacun est plus juste et plus coûteux que le précédent ; chacun
remplace le précédent quand il est disponible.

**Étage 1 — les genres.** Gratuit, instantané, disponible pour tout film déjà
ramené par `discover`. On note chaque sticker par
`|genres du sticker ∩ genres du film| / √(nombre de genres déclarés)`, ce qui
favorise les stickers *spécifiques* plutôt que les stickers fourre-tout. On garde
les 3 meilleurs, sans répéter un emoji. C'est une signature grossière : deux
films du même genre reçoivent la même. Suffisant pour un mur qu'on balaie.

**Étage 2 — les mots-clés réels du film.** Une seule requête,
`GET /movie/{id}/keywords`. **Découverte qui simplifie tout** : cet endpoint
renvoie les mots-clés du film **avec leur nom**, et les mots-clés de nos stickers
sont exactement les noms TMDB. L'intersection se fait donc sur les chaînes, sans
résoudre un seul identifiant — là où l'étage 1 demandait 392 résolutions. On
croise, on garde les meilleurs. La signature devient fidèle.

**Étage 3 — la réaction de Matt.** Dès qu'il a réagi à un moment, sa réaction
*est* la signature. Les étages 1 et 2 restent stockés à côté, comme proposition
et comme point de comparaison — c'est ce qui alimente le miroir (§7).

L'ordre de la signature porte le sens : le premier emoji est l'impression la plus
forte. Pas de note, pas de pourcentage : **l'ordre est la hiérarchie.**

## 5. Le moment

`GET /movie/{id}/videos` donne des clés YouTube. Mesuré le 18 septembre 2026 sur
20 films populaires (≥ 500 votes) :

- au moins une vidéo YouTube : **15 / 20** ;
- une bande-annonce : **15 / 20** ;
- un teaser : **11 / 20** ;
- un **extrait** (`Clip`) : **7 / 20** — Matrix en a deux, The Batman a « les
  premières minutes du film » ;
- un film sur quatre n'a rien.

Conséquences de conception :

- **Un film sur quatre n'a aucun moment.** L'affiche reste le repli, et ce repli
  doit être beau, pas un état d'erreur.
- Le moment se joue **en boucle, sans son, sans commandes**, comme une affiche
  vivante. Ce n'est pas un lecteur : Matt ne regarde pas le film, il réagit à une
  image. Cela évite aussi le chrome textuel de YouTube, qui violerait le zéro-texte.
- Les extraits sont rares : ils sont donc précieux, et l'interface peut les
  distinguer des bandes-annonces.

## 6. Les états

Trois états, pas plus : **vu**, **à voir**, **rien**. Une seule touche cycle,
deux symboles seulement. Aucune note, aucun classement, aucune étoile — une
anti-référence explicite.

## 7. Le miroir

Ce que Matt est venu chercher : comprendre comment il perçoit les films.

- les emoji qu'il **ajoute** souvent, dessinés plus grands selon leur fréquence ;
- les emoji qu'il **retire** systématiquement de ce que TMDB proposait — le
  contraste entre le proposé et le retenu est le vrai signal ;
- les **genres** où il contredit le plus la proposition automatique.

Tout est montré en formes et en tailles, **jamais en chiffres**. Une information
qui ne se dessine pas en emoji n'a pas sa place ici (principe 5).

## 8. Où le texte reste

Exactement trois endroits, et nulle part ailleurs :

1. **L'attribution TMDB et Twemoji**, exigée par TMDB et par la licence CC-BY.
2. **Les libellés accessibles** (`aria-label`, `role="status"`) : invisibles, ils
   portent le titre réel, l'état et l'action. C'est le même contenu pour qui ne
   voit pas l'écran — pas une concession.
3. **Le lien vers la fiche TMDB**, sur le détail d'un film.

## 9. Norman, appliqué

- **Modèle conceptuel** : trois rôles, trois contenants (§2). Si Matt doit se
  demander ce qu'un emoji va faire, le design a échoué, pas lui.
- **Signifiants** : la palette, la signature et la réaction ne se ressemblent pas.
- **Retour immédiat** : toute réaction donne un éclat visible à l'endroit touché,
  et la signature se met à jour sous les yeux, sans attendre le réseau.
- **Contraintes** : on ne peut pas noter, on ne peut pas écrire, on ne peut pas
  chercher depuis un nom. Ces impossibilités sont des choix, pas des manques.
- **Golfes** : exécution — un seul geste par intention, jamais de menu caché ;
  évaluation — l'état de la carte est lisible d'un coup d'œil, à trois mètres.

## 10. Accessibilité

Le langage est coloré : le daltonisme est un risque réel, pas une case à cocher.

- **Aucune information par la teinte seule.** L'état est doublé par une forme
  (plein / vide) et une position ; les familles d'emoji se distinguent aussi par
  leur silhouette.
- `aria-label` français sur chaque emoji de commande, `aria-pressed` sur les
  états, `role="status"` pour annoncer un changement.
- `prefers-reduced-motion` : les déplacements disparaissent, les fondus restent.
- Cibles de 44 px minimum, y compris à la télécommande.

## 11. Téléphone d'abord, télécommande ensuite

Le téléphone valide le langage : c'est là que Matt est seul, le soir. La
télécommande viendra après, et ce sera **un autre écran, pas le même rétréci** :
cinq touches, un focus très visible, des cartes plus grandes, l'édition en masse.
Le prototype ne traite que le téléphone ; la grille et le focus sont dessinés dès
maintenant pour ne pas avoir à tout reprendre.

## 12. Ce qu'on garde de v1, ce qu'on abandonne

**On garde** — c'est le socle le plus coûteux et il est déjà vérifié :

- `src/stickers.js` : 86 stickers, 7 tiroirs, 392 mots-clés TMDB vérifiés un par
  un, l'ordre en ajout seul, et `twemojiUrl` ;
- la correspondance emoji → mots-clés TMDB, qui est *déjà* le pont emoji → films ;
- `src/engine.js` (score, sélection déterministe), `src/tmdb.js` (client, caches,
  détection de la clé), `src/storage.js`, `src/url.js` (partage par lien) ;
- `styles/tokens.css` : couleurs, échelle, durées, rayons ;
- les 116 tests.

**On abandonne** : la toile, les particules, le halo, les gestes de glissement,
le mode liste, l'accueil par exemples, `src/canvas.js`, `src/list.js`,
`src/particles.js`, `src/halo.js`, `src/drawer.js`, `src/results.js`,
`src/examples.js`. Aucun n'est jeté avant que v2 ne tienne debout.

**À ajouter à `src/tmdb.js`** quand v2 sera construite pour de vrai :
`movieKeywords(id)` et `movieVideos(id)`, avec cache mémoire, et le même soin que
le reste.

## 13. Les trois présentations (tranché le 18 septembre 2026)

Matt a demandé « une perspective YouTube » : un mode film, un mode YouTube, un
mode TikTok. Mesuré, puis tranché.

**YouTube est encadrable et propre.** `youtube.com/embed/<clé>` répond 200 sans
`frame-ancestors`. Avec `autoplay=1&mute=1&controls=0`, le chrome de Google
disparaît, et TMDB nous donne des milliers de vraies clés.

**TikTok s'encadre aussi** — `tiktok.com/embed/v2/<id>` répond 200 sans
`frame-ancestors`, et son oEmbed fonctionne même sans clé. Mais trois murs :

1. une **muraille de consentement aux cookies** qui exige un clic, incompatible
   avec la couche par dessus (qui neutralise l'iframe) ; la rogner reviendrait à
   dissimuler un consentement obligatoire ;
2. TikTok affiche **ses propres compteurs** — likes, commentaires — donc des
   chiffres, ce que l'anti-référence interdit ;
3. **aucune découverte libre** : l'oEmbed exige une URL qu'on a déjà, il n'y a
   pas d'API de recherche.

**Décision : TikTok est écarté comme source, repris comme format.** Une seule
matière, les vidéos TMDB, et trois présentations :

| Mode | Forme | Matière |
|---|---|---|
| **Film** | mur d'affiches, défilement vertical | affiches |
| **Vidéo** | défilement horizontal à point d'accroche | bandes-annonces, teasers, extraits |
| **Vertical** | plein écran, une carte par écran | les mêmes moments |

La langue emoji et les réactions sont identiques dans les trois : changer de
présentation ne change jamais ce qu'on a dit d'un film.

Deux règles techniques que la vérification a imposées :

- **un lecteur par carte visible.** Quinze vidéos qui jouent ensemble vident la
  batterie et font ramer le défilement : l'iframe ne reçoit son adresse qu'en
  approchant du cadre, et la perd en s'éloignant. L'affiche reste dessous.
- **réagir ne relance jamais le moment.** Les morceaux concernés sont remplacés
  sur place ; redessiner la fiche ou le fil rechargerait la vidéo en cours.

**Les GIF de réaction.** Giphy répond 401 et Tenor 403 : les deux exigent une
clé. Décision de Matt : des GIF **locaux curatés**, sans API — on reste à une
seule clé dans le projet (TMDB). Reste à faire.

## 14. Le commentaire écrit, mis en scène (18 septembre 2026)

Matt veut pouvoir écrire sur un film, mais « comme les emoji, très visuel : le
texte mis en scène dans des présets de bande-annonce, en mode commentaires de
critiques — sauf que ce sont les utilisateurs qui écrivent ».

### La règle du zéro-texte, précisée et non contredite

Le principe 3 disait : « zéro texte, sauf là où il est inévitable ». Il faut le
lire précisément :

- **le texte d'interface reste interdit** — un bouton, un état, une navigation
  ne s'écrivent pas ; ils se montrent ;
- **le texte d'auteur est mis en scène** — ce que Matt écrit n'est pas du
  chrome, c'est une matière, et elle est montée.

La distinction n'est pas une échappatoire : c'est celle entre ce que l'appareil
dit et ce que la personne dit. Un carton de citation dans une bande-annonce
n'est pas une étiquette, c'est un plan.

### Quatre présets, quatre partis pris typographiques

| Préset | Traitement | Capacité |
|---|---|---|
| **Carton plein écran** | Syne 800, capitales serrées, coupure franche | une punchline courte |
| **Citation de presse** | Instrument Serif italique, entre guillemets français | la phrase qui juge |
| **Carton à filets** | capitales espacées entre deux traits ambre | l'accroche |
| **Carton de fin** | petites capitales très espacées, presque un souffle | le mot de la fin |

**La typographie s'adapte à la longueur.** Un carton de bande-annonce fait
toujours tenir ce qu'il dit : la taille est multipliée par un facteur qui
décroît avec le nombre de signes. Sans cela, un texte long se faisait couper —
défaut constaté à l'usage, et corrigé.

**Le champ est l'aperçu.** On écrit dans le carton qu'on est en train de
monter : le champ de saisie porte lui-même le style du préset choisi. Changer
de préset rejoue l'animation sur son propre texte.

**Écrire prend tout l'écran.** Le moment, la signature et les réactions
s'effacent le temps de l'écriture : on monte un carton, on ne le fait pas en
passant.

### Le commentaire signé

Le carton porte la **signature emoji** du film. Là où une citation de presse
affiche le nom du journal, le commentaire affiche les emoji de Matt : les deux
fonctionnalités parlent d'une seule voix, et le texte n'est jamais orphelin de
son auteur.

### Le battement dans le fil

Dans le mode vertical, le commentaire devient **un carton entre deux moments** —
exactement la place d'une citation de presse dans une bande-annonce. Le fil
alterne donc : carton, moment, carton, moment. C'est le seul endroit où le texte
apparaît sans avoir été demandé, et c'est précisément là qu'il fait sens.

### Les contraintes

- **120 signes**, et le budget se montre en **barre qui se vide**, jamais en
  chiffres (principe 5).
- **Aucun libellé de préset** : quatre pastilles montrent le rendu (`Aa`, `ABC`)
  dans la police du préset. On voit ce qu'on prend.
- Le texte est du vrai texte : un lecteur d'écran le lit, et le carton porte un
  libellé qui dit aussi par quoi il est signé.
- `prefers-reduced-motion` supprime les animations de carton.

## 15. Le renversement : le texte commande (18 septembre 2026)

Matt s'est ravisé : « il me faut du texte pour comprendre les films au maximum ».
Le zéro-texte du §1 est levé, et la hiérarchie s'inverse.

### Ce qui change

| Avant | Après |
|---|---|
| L'emoji est la langue, le texte est toléré | **Le texte commande**, l'emoji donne envie |
| L'emoji nomme, cherche et commente | L'emoji est **l'accroche** : ce qui rend un titre mémorable et partageable |
| Le mur est anonyme | Le mur **affiche les titres** |

Ce n'est pas un renoncement, c'est un partage des rôles : **le texte explique,
l'emoji retient.** Une signature d'emoji est un hook — elle ne renseigne pas,
elle fait envie. Un synopsis renseigne et ne fait pas envie. Les deux sont
nécessaires et aucun ne fait le travail de l'autre.

Le renversement ferme au passage trois tensions signalées plus tôt :
l'impossibilité de comprendre un film sans résumé, l'identité d'un film réduite à
des symboles, et les atmosphères de couleur (🟥 🟦 🟪) qui portaient une
information par la teinte seule — avec du texte, elles portent un nom.

### Films **et** séries

Matt veut des animés. Mesuré : **628 séries animées** contre 456 films dans le
même filtre — les animés sont surtout des séries. Il faut donc les deux, et le
modèle doit les unir : `name`/`first_air_date` au lieu de
`title`/`release_date`, saisons et épisodes au lieu de la durée, « Création » au
lieu de « Réalisation ».

**Un film et une série peuvent porter le même identifiant** : la clé de tout ce
qu'on retient d'un titre est donc `type:id`.

**Le moment ne porte pas les animés.** Mesuré sur 12 séries animées populaires :
**6 ont une vidéo, 4 une bande-annonce** (contre 15 et 15 sur 20 films). Pour la
moitié du catalogue animé, l'affiche et le texte doivent tenir seuls.

### Ce que la fiche montre

Résumé, ligne technique (type, année, durée ou saisons et épisodes, genres),
réalisation ou création, casting, production, pays, note publique, budget,
recettes, et plateformes quand il y en a.

**Les plateformes sont incomplètes** : 3 films sur 10 en France sur un échantillon
de films populaires — et les absents sont précisément les nouveautés, celles
qu'on veut mettre en avant. Une rubrique « où le voir » vide est pire que pas de
rubrique : on ne l'affiche que si elle a quelque chose à dire, sinon on affiche
la date de sortie.

**Le résumé français est souvent squelettique** sur les animés — Doraemon tenait
en six mots. Repli automatique sur l'anglais quand le résumé français fait moins
de 40 signes.

### La notation

L'anti-référence « pas d'appli de notation » visait la notation **de FRAME** :
étoiles, pourcentages de correspondance, moyenne calculée par l'appli. Afficher
la note publique TMDB dans une fiche, comme un renseignement parmi d'autres,
n'est pas la même chose : c'est du contexte, pas un jugement de FRAME.

### Ce qui reste à trancher

Les états. Matt a demandé : **vu / en cours / j'ai pas aimé / j'adore / ok**. Ces
cinq-là mélangent deux axes — la progression (vu, en cours) et l'avis (j'adore,
ok, pas aimé) — qui ne s'excluent pas : on peut avoir vu *et* adoré. Deux
modèles possibles, à décider :

- **un seul axe, cinq étiquettes** : ce que tu dis d'un film, en un mot, une
  seule touche. Simple, mais « vu » et « ok » se recouvrent ;
- **deux axes** : progression (à voir / en cours / vu) × avis (j'adore / ok /
  pas aimé). Plus juste, deux touches.

## 16. Chercher, filtrer, survoler (18 septembre 2026)

Trois demandes de Matt, dans la ligne du renversement : « au survol de la souris
il faut présenter toutes ces informations et les catégories toujours, et le
moteur de recherche et filtre aussi doit être textuel illustré ».

### Chercher, en texte

Un champ de recherche interroge `/search/multi` — films **et** séries — et
retrouve un titre par son nom. Ce que le langage emoji ne savait pas faire :
retrouver un film qu'on a en tête.

**TMDB ne sait pas filtrer une recherche par texte.** Les filtres s'appliquent
donc côté client, sur les `genre_ids` que les résultats portent déjà. Une
recherche sans texte passe par `discover`, qui filtre côté serveur.

### Filtrer, avec des pictogrammes

Vingt-cinq filtres, toujours visibles, dans une rangée qui défile : le type
(tout / films / séries) puis les genres. **Chaque filtre porte un pictogramme et
son mot** — l'image le fait reconnaître, le mot dit ce que c'est. Aucun des deux
ne suffit seul, et c'est exactement la leçon du renversement.

### Survoler, à la souris

Sur un appareil à pointeur fin (`hover: hover`), survoler une affiche ouvre un
panneau qui montre **tout ce que la fiche montrerait** : affiche, signature,
titre, ligne technique, résumé, réalisation, casting, production, pays, note,
budget, recettes, plateformes — et les six états, applicables sans ouvrir.

Le panneau attend 280 ms avant d'apparaître (on ne le déclenche pas en traversant
la grille), il se replace de lui-même s'il sort de l'écran, il disparaît au
défilement, et **le résumé y est borné à cinq lignes** — sans quoi il poussait le
casting et les plateformes, ce qu'on vient chercher, sous la ligne de flottaison.

Le survol n'existe pas au doigt : sur téléphone, c'est la fiche qui s'ouvre. Le
panneau est donc un raccourci de bureau, pas un passage obligé.

### Écrans larges

Le prototype était pensé pour un téléphone. À la souris il fallait de la place,
sinon le survol n'avait rien à révéler : trois colonnes à 720 px, quatre à
1024 px, cinq à 1360 px, et une largeur maximale pour que le mur ne s'étire pas.

### Ce que ça laisse ouvert

**Le dock emoji prend 150 px sur un téléphone**, et la barre d'outils 96 px : le
mur n'a plus que 62 % de l'écran. Depuis que le texte commande, la palette emoji
est devenue secondaire — elle pourrait se replier derrière un bouton sur
téléphone. Décision à prendre, pas à subir.

## 17. Questions ouvertes

- **Le geste « à voir ».** Un cycle à une touche suffit-il, ou faut-il un geste
  directionnel, plus proche de l'habitude du défilement ? À tester à la main.
- **Le vide du mode vidéo.** Une vidéo 16:9 sur un téléphone en portrait laisse
  de la place au-dessus et au-dessous. Les réactions et les états la remplissent
  en partie ; la question d'y montrer les *autres* moments du film reste ouverte.
- **La musique du moment.** Le son fait beaucoup dans un fil vertical ; ici le
  moment est muet par choix. À réévaluer.
- **Les GIF.** Où les ranger, combien, et comment les choisir sans API.
