# FRAME

Découverte de films par composition de stickers. Tu poses des stickers sur une toile,
le tableau devient la requête, six films arrivent avec l'explication de ce qui les a
trouvés. Pas de mots-clés à taper, pas de pourcentage de correspondance.

Site statique : pas de framework, pas de bundler, pas de dépendance npm, pas de serveur.

## Lancer en local

```bash
npm run serve
```

Puis ouvre http://localhost:8090.

L'application a besoin d'un serveur HTTP : ouvrir `index.html` depuis le disque ne
fonctionne pas, le navigateur bloque les modules ES sur `file://`.

Deux variantes utiles :

- http://localhost:8090/?demo=1 — client TMDB simulé, aucune clé nécessaire.
- http://localhost:8090/?mode=liste — la même application avec une grille de chips
  au lieu de la toile, pour comparer les deux à l'aveugle.

## Ne pas perdre sa liste

Trois filets, du plus simple au plus sûr :

**1. Le fichier.** Profil → *Exporter ma liste* télécharge un fichier JSON. C'est
la seule sauvegarde qui ne dépend de personne — ni d'un serveur, ni d'un
navigateur, ni d'un code. **C'est aussi le seul pont entre deux adresses** :
`localhost:8090` et le site publié sont deux stockages différents, et sans
fichier il n'y en a aucun. Sur l'autre adresse : *Importer un fichier*.

L'import ne remplace rien : il rejoint. Ce qui est dans le fichier s'ajoute à ce
que tu as, et sur un même film c'est la modification la plus récente qui gagne.

**2. Le code de synchronisation.** Voir juste en dessous.

**3. Le lien de partage.** Une copie de ta liste, en lecture seule, sous un
second code.

## Ma liste, organisée

**Ma liste** dans l'en-tête ouvre la liste entière : groupée par état — à voir,
en cours, vu, ok, j'adore, pas aimé — triable et cherchable. Chaque état porte
son nombre, chaque film son affiche.

Depuis le profil, **Montrer ma liste** crée un lien à envoyer. Ce lien ouvre la
liste en lecture seule, chez n'importe qui, sans compte.

Ce lien est un **second code**, distinct du code de synchronisation : le premier
ÉCRIT, le second ne fait que LIRE. Et le document qu'il ouvre ne contient que des
affiches et des états — ni commentaires, ni avis, ni résumé, ni mots-clés. Ce
n'est pas qu'on les cache : ils n'ont jamais été envoyés.

## Ton profil, et tes deux appareils

Pas d'inscription, pas de mot de passe, pas d'adresse e-mail. Un **code** de
douze signes relie ton téléphone et ton ordinateur :

1. **Profil → Créer mon code.** Ce que tu as déjà fait ici est rangé sous ce code.
2. Sur l'autre appareil : **Profil → J'ai déjà un code**, et saisis-le.

Les deux se rejoignent. La fusion est **film par film** : marquer *Dune* sur le
téléphone puis *Alien* sur l'ordinateur ne perd ni l'un ni l'autre, et sur un
même film c'est la modification la plus récente qui l'emporte — y compris quand
il s'agit d'une suppression.

Ce qui suit : tes états, tes signatures, tes commentaires, ta liste.
Ce qui ne suit pas : tes filtres en cours, ta position dans le catalogue, et
l'historique d'une soirée.

Le code est la seule clé. Douze signes tirés dans un alphabet de trente-deux,
soit environ 10¹⁸ combinaisons : personne ne le devinera, mais **garde-le** —
il n'y a pas de « mot de passe oublié », par construction.

## Publier sur Netlify

Le dépôt est prêt : `netlify.toml` décrit la construction, et une fonction serveur
garde la clé TMDB hors du navigateur.

1. Dans Netlify : **Add new site → Import an existing project**, puis choisis le
   dépôt `frame`. Netlify lit `netlify.toml` tout seul — commande
   `node tools/build-netlify.mjs`, dossier publié `dist/`.
2. **Site configuration → Environment variables** : ajoute

   ```
   TMDB_TOKEN = eyJ…        (ton jeton de lecture TMDB)
   ```

   Sans elle, le site s'ouvre sur le catalogue de démonstration. Avec elle, la
   clé reste sur le serveur : le navigateur ne la voit jamais, et personne ne
   peut l'extraire de la page pour épuiser ton quota.

Pour vérifier avant de publier, exactement ce que Netlify servira :

```bash
npm run build          # construit dist/
npm run servir-dist    # sert dist/ + la fonction, sur le port 8094
```

### Ce qui marche en ligne, et ce qui ne marche pas

Le site publié est **statique** : catalogue, recherche, thèmes, collections,
fiches, disponibilités, bandes-annonces. Tout cela fonctionne.

Le **profil synchronisé** fonctionne en ligne : il passe par une seconde
fonction Netlify, et le code est la seule clé.

Le **mode Soirée** a besoin d'un serveur qui tient l'état partagé, et Netlify
n'en fait pas tourner. En ligne, l'écran de soirée le dit et propose de saisir
l'adresse d'un serveur : l'hôte lance `npm run room` sur son ordinateur, et tout
le monde s'y connecte sur le même réseau Wi-Fi. Le site publié sert alors
d'interface ; c'est le serveur de l'hôte qui tient la partie.

## Une soirée à plusieurs

Pour choisir un film à plusieurs : l'hôte lance le serveur, les autres ouvrent
l'adresse affichée sur leur téléphone, et **chacun apporte jusqu'à trois films**
— une recherche sur tout TMDB. Puis les films s'affrontent deux par deux : à
chaque duel, le groupe vote sur ces deux-là, et le résultat tombe tout de suite.
Le dernier film debout est celui qu'on regarde.

```bash
npm run room
```

Le serveur affiche deux adresses : la locale, et celle du réseau Wi-Fi à donner
aux autres. Rien ne sort de la maison — pas de compte, pas de service tiers. Les
autres entrent le code à six signes affiché dans l'app, ou ouvrent directement le
lien d'invitation.

Le serveur est en Node natif : aucune dépendance à installer.

## Obtenir une clé TMDB

FRAME va chercher les films chez [TMDB](https://www.themoviedb.org/). La clé est
gratuite.

1. Crée un compte sur themoviedb.org.
2. Ouvre **Réglages → API** : https://www.themoviedb.org/settings/api
3. Demande une clé pour un usage personnel.
4. Récupère soit la **clé API v3** (32 caractères hexadécimaux), soit le
   **jeton d'accès en lecture v4** (une longue chaîne qui commence par `eyJ`).
   FRAME accepte les deux et détecte la forme tout seul.

Deux façons de la donner à FRAME :

- **En local :** copie `config.example.js` en `config.local.js` et colle ta clé.
  `config.local.js` est dans `.gitignore` : il ne part jamais dans un commit.
- **Dans le navigateur :** lance FRAME sans clé, la fenêtre d'accueil te demande de
  la coller. Elle est validée par un appel à TMDB puis rangée dans le `localStorage`
  de ton navigateur. Elle ne quitte jamais ta machine.

## Tests

```bash
npm test
```

Huit fichiers de test, lancés par le lanceur intégré de Node, sans aucune dépendance.

Vérifier que tous les mots-clés du vocabulaire existent bien sur TMDB :

```bash
node tools/check-keywords.mjs
# ou, sans config.local.js :
TMDB_TOKEN=eyJ… node tools/check-keywords.mjs
```

L'outil n'écrit rien : il liste les mots-clés introuvables ou sans correspondance
exacte, à corriger à la main dans `src/stickers.js`.

## Déployer sur GitHub Pages

Le dépôt se sert tel quel, aucune étape de compilation.

1. Pousse la branche sur GitHub.
2. Dépôt → **Settings → Pages**.
3. **Source** : « Deploy from a branch ». **Branch** : `main`, dossier `/ (root)`.
4. Enregistre. Le site est publié sur `https://<compte>.github.io/<dépôt>/`.

`config.local.js` n'est pas publié, puisqu'il n'est pas dans le dépôt : le site
déployé demande sa clé à chaque visiteur, dans son propre navigateur. C'est
volontaire — la clé de Matt ne doit jamais se retrouver dans une page publique.

## Comment ça marche

- `src/stickers.js` — le vocabulaire : 86 stickers, 7 tiroirs, 392 mots-clés TMDB
  vérifiés. Liste ordonnée en ajout seul : l'encodage des liens partagés dépend de
  l'ordre, on n'insère jamais au milieu.
- `src/board.js` — le modèle du tableau, purement immuable.
- `src/url.js` — le tableau tient dans le fragment d'URL, 5 octets par sticker.
  Partager un tableau, c'est partager un lien ; rien n'est stocké côté serveur.
- `src/tmdb.js` — le client TMDB, avec cache par sticker et par session.
- `src/engine.js` — le score, la sélection des six films et les explications.
  Le tirage est déterministe : le même lien donne les mêmes films.
- `src/canvas.js`, `src/particles.js`, `src/halo.js` — la toile, ses gestes, son
  clavier et ses atmosphères.
- `src/drawer.js`, `src/results.js`, `src/list.js`, `src/examples.js`,
  `src/demo.js` — le tiroir, la bande de résultats et la fiche film, le mode liste,
  les tableaux d'accueil, le client simulé.
- `src/storage.js`, `src/app.js` — la persistance locale et l'assemblage.

## Vie privée

Aucun compte, aucun serveur, aucune analyse d'audience. Ta clé TMDB, tes tableaux
sauvegardés et ton journal restent dans le `localStorage` de ton navigateur.

## Attributions

Les données et les images de films viennent de **TMDB**.
Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
https://www.themoviedb.org/

Les emoji viennent de **Twemoji**, sous licence CC-BY 4.0, servis par jsDelivr.
https://github.com/jdecked/twemoji

Les polices **Syne** et **Instrument Sans** viennent de Google Fonts, sous
licence SIL Open Font License.
