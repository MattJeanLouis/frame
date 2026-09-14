# FRAME

Découverte de films par composition de stickers. Tu poses des stickers sur une toile,
le tableau devient la requête, six films arrivent.

## Lancer en local

```bash
npm run serve
```

Puis ouvre http://localhost:8080. L'application a besoin d'un serveur : ouvrir
`index.html` directement depuis le disque ne fonctionne pas, les modules ES sont bloqués.

## Clé TMDB

Copie `config.example.js` en `config.local.js` et colle ton identifiant TMDB.
`config.local.js` est ignoré par git. Sans identifiant, l'application affiche
une fenêtre qui explique où en obtenir un gratuitement.

## Tests

```bash
npm test
```

Documentation complète du déploiement et des attributions : voir la fin de ce fichier
après la tâche 10.
