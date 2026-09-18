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
