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

## 13. Questions ouvertes

- **Le mur ou le fil ?** Matt a évoqué un défilement vertical façon TikTok. Le
  mur donne de l'organisation, le fil donne de la découverte. Le prototype
  explore le mur et l'entrée par un moment ; l'arbitrage reste à faire.
- **Le geste « à voir ».** Un cycle à une touche suffit-il, ou faut-il un geste
  directionnel (vers le haut / vers le bas) plus proche de l'habitude du
  défilement ? À tester à la main.
- **Les memes.** Matt a parlé des « memes du moment ». Aucune source libre ne
  relie un meme à un film : ce serait de la curation manuelle ou une API tierce
  (Giphy, Tenor) avec une clé et de la modération. Reporté, et à ne pas confondre
  avec les réactions emoji, qui suffisent au concept.
- **La musique du moment.** Le son fait beaucoup dans un fil vertical ; ici le
  moment est muet par choix. À réévaluer.
