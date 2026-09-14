# FRAME prototype 1 — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire FRAME, un site statique de découverte de films où l'utilisateur compose un tableau de stickers emoji sur une toile et où ce tableau devient la requête envoyée à TMDB.

**Architecture:** Un `index.html` qui charge des modules ES natifs depuis `src/` et des feuilles de style depuis `styles/`. Les modules purs (`stickers`, `board`, `url`, `engine`, `storage`, et la partie sans réseau de `tmdb`) sont testés avec `node --test`. Les modules d'interface (`canvas`, `drawer`, `results`, `list`, `app`) construisent le DOM à la main et sont vérifiés dans un vrai navigateur. Le flux est unidirectionnel : geste → `board.js` (état immuable) → `url.js` (fragment) → debounce 400 ms → `tmdb.js` (viviers par sticker, cache) → `engine.js` (score, sélection, explications) → `results.js`.

**Tech Stack:** HTML5, CSS3 (variables personnalisées, `grid`, `flex`), JavaScript modules ES natifs, `node --test` (Node 25), API TMDB v3, Twemoji via jsDelivr, Google Fonts (Syne, Instrument Sans). Aucun framework, aucun bundler, aucune dépendance npm.

**Spec:** docs/superpowers/specs/2026-09-14-frame-design.md

## Global Constraints

- Zéro dépendance npm à l'exécution : `package.json` ne contient ni `dependencies` ni `devDependencies`.
- Pas de framework, pas de bundler, pas d'étape de compilation : le dépôt tel quel se sert sur GitHub Pages.
- Modules ES natifs uniquement (`<script type="module">`, `import` / `export`), aucun `require`, aucun UMD.
- Tests avec `node --test "tests/**/*.test.mjs"`, sans bibliothèque d'assertion externe (`node:test` + `node:assert/strict`).
- Node 25 est disponible (vérifié : v25.8.1, npm 11.11.0).
- `btoa`, `atob` et `fetch` sont des globales disponibles dans Node 25 comme dans le navigateur : le même code d'encodage et de client sert des deux côtés.
- Thème sombre unique, sur toutes les plateformes ; aucun thème clair, aucun bascule de thème.
- Marges latérales d'au moins 16 px à toutes les largeurs.
- Aucun défilement horizontal de la page elle-même (`document.documentElement.scrollWidth <= window.innerWidth`) ; seuls le tiroir et la bande de résultats défilent horizontalement, dans leur propre conteneur.
- Interface en français.
- Tutoiement dans tous les textes d'interface (« Pose un sticker », « essaie d'enlever un sticker »).
- Aucun pourcentage de correspondance affiché nulle part.
- Aucun sticker-mot : tous les stickers sont des images de choses concrètes ; les mots abstraits sont interdits comme libellés.
- Identifiants de stickers stables et liste en ajout seul : on n'insère jamais au milieu, on ne supprime jamais, on ne renomme jamais un identifiant (l'encodage d'URL dépend de l'ordre).
- Ne jamais committer `config.local.js` (déjà dans `.gitignore`) et ne jamais recopier la valeur du jeton dans un fichier suivi par git, un message de commit, un test ou la documentation.

## Faits vérifiés le 14 septembre 2026

Ces mesures ont déjà été faites ; ne pas les refaire, s'appuyer dessus.

- `node --version` → `v25.8.1`, `npm --version` → `11.11.0`.
- **Correction vérifiée :** sur Node 25.8.1, `node --test tests/` échoue (`Cannot find module …/tests`) : un dossier n'est plus accepté comme argument positionnel. Les formes qui fonctionnent, testées : `node --test "tests/**/*.test.mjs"` (glob interprété par Node, insensible au shell) et `node --test tests/un-fichier.test.mjs`. Le script `npm test` utilise donc la première.
- Le dépôt existe déjà, avec un seul commit (`Spec de conception du prototype 1 de FRAME`), un `.gitignore` qui contient déjà `config.local.js`, et un `config.local.js` réel au format `window.FRAME_CONFIG = { tmdbToken: "eyJ..." }`.
- Twemoji : les 86 fichiers SVG du vocabulaire répondent `200` sur `https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/<codepoints>.svg`. Les versions `15.1.0` et `latest` répondent aussi.
- TMDB, authentification : en-tête `Authorization: Bearer <jeton>` pour un jeton v4 (commence par `eyJ`), paramètre `api_key=<clé>` pour une clé v3 (32 caractères hexadécimaux).
- TMDB, `GET /3/search/keyword?query=rain` → `results: [{ id: 2217, name: 'rain' }, { id: 330913, name: 'heavy rain' }, …]`.
- TMDB, `GET /3/discover/movie?language=fr-FR&include_adult=false&with_keywords=2217|9822|12190&vote_count.gte=100&sort_by=popularity.desc` → 128 résultats (Matrix, Blade Runner 2049…). La variante `sort_by=vote_average.desc&vote_count.gte=300` répond aussi.
- Forme des réponses `discover` : `{ page, results: [], total_pages, total_results }` ; chaque film porte `id, title, original_title, release_date, poster_path, vote_average, vote_count, genre_ids, overview, popularity`.
- Les 392 noms de mots-clés du vocabulaire de la tâche 2 ont été interrogés un par un sur `/3/search/keyword` : tous ont une correspondance exacte, insensible à la casse. Les 11 candidats qui échouaient ont déjà été remplacés dans le vocabulaire ci-dessous (`heroine`, `heir to the throne`, `wolves`, `deserted island`, `firearm`, `anti hero`, `tokyo, japan`, `retrofuturism`, `crusader`, `acrobats`, `saudi arabia`).
- Chaque sticker du vocabulaire donne au moins 60 films avec `vote_count.gte=100` (le plus maigre est `uniform` à 63, puis `octopus` à 76, `palace` à 80, `elder` à 83).

## Genres TMDB (constantes utilisées dans le vocabulaire)

Action 28, Aventure 12, Animation 16, Comédie 35, Crime 80, Documentaire 99, Drame 18, Familial 10751, Fantastique 14, Histoire 36, Horreur 27, Musique 10402, Mystère 9648, Romance 10749, Science-fiction 878, Thriller 53, Guerre 10752, Western 37.

## Structure des fichiers produite par ce plan

```
package.json              tâche 1
index.html                tâche 1 (structure), tâche 9 (aucune modification prévue)
config.example.js         tâche 1
README.md                 tâche 1 (amorce), tâche 10 (version finale)
styles/tokens.css         tâche 1   jetons de couleur, type, espacement, rayon, ombre, durée
styles/base.css           tâche 1   reset, typographie, en-tête, disposition, pied de page
styles/canvas.css         tâche 7   toile, stickers, atmosphères, barre d'outils
styles/drawer.css         tâche 8   onglets et grille de stickers
styles/results.css        tâche 8   cartes, explications, fiche film
styles/panels.css         tâche 9   Mes tableaux, fenêtre de clé, exemples, avis, mode liste
src/stickers.js           tâche 2   vocabulaire
src/board.js              tâche 3   modèle pur
src/url.js                tâche 4   encodage du fragment
src/engine.js             tâche 5   score, sélection, explications
src/storage.js            tâche 6   localStorage
src/tmdb.js               tâche 6   client TMDB
src/demo.js               tâche 6   client simulé
src/canvas.js             tâche 7   toile
src/drawer.js             tâche 8   tiroir
src/results.js            tâche 8   bande de résultats + fiche film
src/examples.js           tâche 9   trois tableaux d'exemple
src/list.js               tâche 9   mode liste
src/app.js                tâche 1 (vide), tâche 9 (assemblage)
tests/smoke.test.mjs      tâche 1
tests/stickers.test.mjs   tâche 2
tests/board.test.mjs      tâche 3
tests/url.test.mjs        tâche 4
tests/engine.test.mjs     tâche 5
tests/storage.test.mjs    tâche 6
tests/tmdb.test.mjs       tâche 6
tools/check-keywords.mjs  tâche 10
```

## Convention de commit

Tous les commits de ce plan s'écrivent ainsi, avec le message terminé par les deux lignes de signature :

```bash
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: titre du commit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 1 : Squelette du site, jetons de style, test de fumée

**Files:**
- Create: `/Users/matt/Documents/Frame/package.json`
- Create: `/Users/matt/Documents/Frame/index.html`
- Create: `/Users/matt/Documents/Frame/config.example.js`
- Create: `/Users/matt/Documents/Frame/README.md`
- Create: `/Users/matt/Documents/Frame/styles/tokens.css`
- Create: `/Users/matt/Documents/Frame/styles/base.css`
- Create: `/Users/matt/Documents/Frame/src/app.js`
- Test: `/Users/matt/Documents/Frame/tests/smoke.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces :
  - La constante de base Twemoji à recopier dans la tâche 2 : `TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/'` (à ajuster si l'étape 1 de vérification échoue).
  - Les identifiants DOM que toutes les tâches suivantes réutilisent, sans exception : `app`, `header`, `brand`, `btn-undo`, `btn-redo`, `btn-boards`, `btn-share`, `main`, `stage`, `canvas-host`, `stage-bar`, `btn-clear`, `scope`, `examples`, `drawer-host`, `results-host`, `sheet-host`, `panels-host`, `notice`, `toast`, `footer`.
  - Les jetons CSS de `styles/tokens.css`, réutilisés tels quels par `canvas.css`, `drawer.css`, `results.css` et `panels.css`.

- [ ] **Step 1 : Vérifier l'URL Twemoji et fixer la version**

```bash
for v in 16.0.1 15.1.0 latest; do
  printf '%s -> ' "$v"
  curl -sI -o /dev/null -w "%{http_code}\n" "https://cdn.jsdelivr.net/gh/jdecked/twemoji@$v/assets/svg/1f303.svg"
done
```

Attendu : `16.0.1 -> 200`. Retenir `16.0.1`. Si et seulement si `16.0.1` ne répond pas `200`, retenir la première version de la liste qui répond `200` et l'utiliser partout dans la tâche 2 à la place de `16.0.1`.

- [ ] **Step 2 : Écrire le test de fumée qui échoue**

```bash
cd /Users/matt/Documents/Frame && mkdir -p styles src tests tools
```

Créer `tests/smoke.test.mjs` :


```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const REQUIRED_IDS = [
  'app', 'header', 'brand', 'btn-undo', 'btn-redo', 'btn-boards', 'btn-share',
  'main', 'stage', 'canvas-host', 'stage-bar', 'btn-clear', 'scope', 'examples',
  'drawer-host', 'results-host', 'sheet-host', 'panels-host', 'notice', 'toast', 'footer'
];

test('index.html contient tous les identifiants attendus', () => {
  for (const id of REQUIRED_IDS) {
    assert.ok(html.includes(`id="${id}"`), `identifiant manquant : ${id}`);
  }
});

test('index.html charge les six feuilles de style dans l\'ordre', () => {
  const order = ['styles/tokens.css', 'styles/base.css', 'styles/canvas.css', 'styles/drawer.css', 'styles/results.css', 'styles/panels.css'];
  let cursor = -1;
  for (const href of order) {
    const at = html.indexOf(href);
    assert.ok(at > cursor, `feuille absente ou mal ordonnée : ${href}`);
    cursor = at;
  }
});

test('index.html tolère l\'absence de config.local.js', () => {
  assert.match(html, /<script src="config\.local\.js" onerror=/);
});

test('index.html charge src/app.js en module ES', () => {
  assert.ok(html.includes('<script type="module" src="src/app.js"></script>'));
});

test('index.html attribue TMDB et Twemoji dans le pied de page', () => {
  assert.ok(html.includes('themoviedb.org'));
  assert.ok(html.includes('twemoji'));
});

test('package.json est sans dépendance et en modules ES', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts.test, 'node --test "tests/**/*.test.mjs"');
  assert.equal(pkg.scripts.serve, 'python3 -m http.server 8080');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('config.example.js expose les deux champs vides', () => {
  const example = readFileSync(join(ROOT, 'config.example.js'), 'utf8');
  assert.ok(example.includes('window.FRAME_CONFIG'));
  assert.ok(example.includes('tmdbToken: ""'));
  assert.ok(example.includes('tmdbKey: ""'));
});
```

- [ ] **Step 3 : Lancer le test et vérifier qu'il échoue**

```bash
cd /Users/matt/Documents/Frame && node --test tests/smoke.test.mjs
```

Attendu : échec de tous les cas, `ENOENT: no such file or directory, open '…/index.html'`. Rien de ce que le test vérifie n'existe encore.

- [ ] **Step 4 : Créer `package.json`**

```json
{
  "name": "frame",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "FRAME — découverte de films par composition de stickers",
  "scripts": {
    "test": "node --test \"tests/**/*.test.mjs\"",
    "serve": "python3 -m http.server 8080"
  }
}
```

- [ ] **Step 5 : Créer `config.example.js`**

```js
// Copie ce fichier en config.local.js et colle ton identifiant TMDB.
// config.local.js est ignoré par git : il ne part jamais dans un commit.
// Un seul des deux champs suffit.
//   tmdbToken : jeton d'accès en lecture v4, une longue chaîne qui commence par "eyJ"
//   tmdbKey   : clé d'API v3, 32 caractères hexadécimaux
window.FRAME_CONFIG = { tmdbToken: "", tmdbKey: "" };
```

- [ ] **Step 6 : Créer `styles/tokens.css` en entier**

```css
:root {
  color-scheme: dark;

  /* Couleurs — spec §6.1 */
  --c-bg: #0B0E14;
  --c-surface: #141925;
  --c-raised: #1C2333;
  --c-text: #F2EEE6;
  --c-text-dim: #A9B0BF;
  --c-accent: #F2B544;
  --c-accent-ink: #1A1206;
  --c-error: #E4574B;
  --c-error-soft: rgba(228, 87, 75, 0.14);
  --c-success: #5FC08A;
  --c-success-soft: rgba(95, 192, 138, 0.14);
  --c-line: rgba(242, 238, 230, 0.10);
  --c-line-strong: rgba(242, 238, 230, 0.20);
  --c-overlay: rgba(6, 8, 13, 0.72);
  --c-focus: #F2B544;

  /* Typographie */
  --ff-display: "Syne", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --ff-text: "Instrument Sans", -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
  --fs-2xs: 0.6875rem;  /* 11px — badges, légendes */
  --fs-xs: 0.75rem;     /* 12px — étiquettes capitales */
  --fs-sm: 0.8125rem;   /* 13px — méta, année */
  --fs-md: 0.9375rem;   /* 15px — texte courant */
  --fs-lg: 1.125rem;    /* 18px — titres de carte, titres de panneau */
  --fs-xl: 1.5rem;      /* 24px — titre de fiche film */
  --fs-2xl: 2rem;       /* 32px — nom FRAME */
  --lh-tight: 1.15;
  --lh-normal: 1.45;
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semi: 600;
  --fw-bold: 700;
  --fw-black: 800;
  --ls-caps: 0.14em;
  --ls-brand: 0.22em;

  /* Espacement — base 4px */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-5: 1.5rem;
  --sp-6: 2rem;
  --sp-7: 3rem;
  --gutter: 1rem;          /* marge latérale minimale : 16px */

  /* Rayons */
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 16px;
  --r-full: 999px;

  /* Ombres */
  --sh-sticker: 0 6px 14px rgba(0, 0, 0, 0.55);
  --sh-card: 0 2px 10px rgba(0, 0, 0, 0.45);
  --sh-raised: 0 8px 24px rgba(0, 0, 0, 0.55);
  --sh-panel: 0 16px 48px rgba(0, 0, 0, 0.68);

  /* Durées et courbes */
  --d-instant: 80ms;
  --d-fast: 120ms;
  --d-base: 200ms;
  --d-slow: 360ms;
  --d-stagger: 40ms;       /* décalage entre cartes de résultats */
  --d-debounce: 400ms;     /* miroir JS : DEBOUNCE_MS dans app.js */
  --e-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --e-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --e-spring: cubic-bezier(0.34, 1.28, 0.64, 1);

  /* Dimensions de disposition */
  --bp-desk: 900px;
  --canvas-max-phone: 520px;
  --canvas-max-desk: 640px;
  --drawer-h: 96px;
  --drawer-tile: 56px;
  --card-w-phone: 140px;
  --card-w-desk: 180px;
  --header-h: 56px;
  --hit-min: 44px;         /* cible tactile minimale */
  --z-canvas-tool: 20;
  --z-drawer: 30;
  --z-sheet: 60;
  --z-panel: 70;
  --z-toast: 90;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --d-instant: 0ms;
    --d-fast: 0ms;
    --d-base: 0ms;
    --d-slow: 0ms;
    --d-stagger: 0ms;
  }
}
```

- [ ] **Step 7 : Créer `styles/base.css`**

Le fichier ne contient que ce qui suit, dans cet ordre. Aucune de ces valeurs n'est négociable ; le corps des règles est écrit par l'implémenteur en n'utilisant que les jetons de `tokens.css`.

1. Reset léger : `*, *::before, *::after { box-sizing: border-box; }` ; `body, h1, h2, h3, p, figure, ul, ol { margin: 0; padding: 0; }` ; `ul, ol { list-style: none; }` ; `img { display: block; max-width: 100%; }` ; `button, input, textarea { font: inherit; color: inherit; }`.
2. `html, body { background: var(--c-bg); color: var(--c-text); }` ; `body { font-family: var(--ff-text); font-size: var(--fs-md); line-height: var(--lh-normal); font-variant-numeric: tabular-nums; overflow-x: hidden; -webkit-text-size-adjust: 100%; }`.
3. `:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; border-radius: var(--r-sm); }` et `:focus:not(:focus-visible) { outline: none; }`.
4. Classe utilitaire `.sr-only` : `position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;`.
5. `#app` : `min-height: 100dvh; display: flex; flex-direction: column;`.
6. `#header` : `height: var(--header-h); display: flex; align-items: center; gap: var(--sp-2); padding-inline: var(--gutter); border-bottom: 1px solid var(--c-line); position: sticky; top: 0; z-index: var(--z-drawer); background: var(--c-bg);`.
7. `#brand` : `font-family: var(--ff-display); font-weight: var(--fw-black); font-size: var(--fs-lg); letter-spacing: var(--ls-brand); text-transform: uppercase; margin-right: auto;`.
8. Classe de bouton d'en-tête `.hbtn` : hauteur `var(--hit-min)`, `min-width: var(--hit-min)`, fond transparent, bordure `1px solid var(--c-line)`, rayon `var(--r-full)`, texte `var(--fs-sm)`, `padding-inline: var(--sp-3)`, survol `background: var(--c-raised)`, état `:disabled { opacity: 0.35; pointer-events: none; }`.
9. `#main` : `flex: 1; display: grid; gap: var(--sp-5); padding: var(--sp-4) var(--gutter) var(--sp-6);` ; une seule colonne par défaut.
10. À partir de `@media (min-width: 900px)` : `#main { grid-template-columns: minmax(0, var(--canvas-max-desk)) minmax(0, 1fr); align-items: start; }` ; `#stage { grid-column: 1; }` ; `#results-host { grid-column: 2; }`.
11. `#stage` : `display: grid; gap: var(--sp-3); justify-items: stretch; min-width: 0;`.
12. `#footer` : `padding: var(--sp-5) var(--gutter); border-top: 1px solid var(--c-line); color: var(--c-text-dim); font-size: var(--fs-sm);` ; les liens `color: var(--c-text-dim); text-decoration: underline; text-underline-offset: 3px;`.
13. `#notice` : bandeau discret pleine largeur, `background: var(--c-raised); color: var(--c-text-dim); font-size: var(--fs-sm); padding: var(--sp-2) var(--gutter); border-bottom: 1px solid var(--c-line);` ; masqué via l'attribut `hidden`.
14. `#toast` : `position: fixed; left: 50%; transform: translateX(-50%); bottom: var(--sp-5); z-index: var(--z-toast); background: var(--c-raised); border: 1px solid var(--c-line-strong); border-radius: var(--r-full); padding: var(--sp-2) var(--sp-4); box-shadow: var(--sh-raised); font-size: var(--fs-sm);` ; masqué via `hidden`.

- [ ] **Step 8 : Créer les quatre feuilles de style encore vides**

```bash
cd /Users/matt/Documents/Frame && \
  printf '/* Toile — rempli en tâche 7. */\n' > styles/canvas.css && \
  printf '/* Tiroir — rempli en tâche 8. */\n' > styles/drawer.css && \
  printf '/* Résultats et fiche film — rempli en tâche 8. */\n' > styles/results.css && \
  printf '/* Panneaux — rempli en tâche 9. */\n' > styles/panels.css
```

- [ ] **Step 9 : Créer `index.html` avec exactement cette structure**

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="description" content="FRAME — compose un tableau de stickers, découvre des films.">
<title>FRAME</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://image.tmdb.org" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="styles/tokens.css">
<link rel="stylesheet" href="styles/base.css">
<link rel="stylesheet" href="styles/canvas.css">
<link rel="stylesheet" href="styles/drawer.css">
<link rel="stylesheet" href="styles/results.css">
<link rel="stylesheet" href="styles/panels.css">
<script src="config.local.js" onerror="window.FRAME_CONFIG = window.FRAME_CONFIG || {};"></script>
</head>
<body>
<div id="app">
  <header id="header">
    <h1 id="brand">FRAME</h1>
    <button id="btn-undo" class="hbtn" type="button" title="Annuler" aria-label="Annuler" disabled>↶</button>
    <button id="btn-redo" class="hbtn" type="button" title="Rétablir" aria-label="Rétablir" disabled>↷</button>
    <button id="btn-boards" class="hbtn" type="button">Mes tableaux</button>
    <button id="btn-share" class="hbtn" type="button">Partager</button>
  </header>

  <div id="notice" role="status" hidden></div>

  <main id="main">
    <section id="stage" aria-label="Ta toile">
      <div id="canvas-host"></div>
      <div id="examples" class="examples" hidden></div>
      <div id="stage-bar" class="stage-bar">
        <button id="btn-clear" class="hbtn" type="button">Vider la toile</button>
        <p id="scope" class="scope" hidden></p>
      </div>
      <div id="drawer-host"></div>
    </section>

    <section id="results-host" aria-label="Films trouvés"></section>
  </main>

  <footer id="footer">
    <p>Données de films fournies par
      <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>.
      Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.</p>
    <p>Emoji par <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji</a>,
      sous licence CC-BY 4.0.</p>
  </footer>
</div>

<div id="sheet-host"></div>
<div id="panels-host"></div>
<div id="toast" role="status" hidden></div>

<script type="module" src="src/app.js"></script>
</body>
</html>
```

Note sur `config.local.js` : le fichier est ignoré par git, donc absent après un clone. Le `onerror` sur la balise `<script>` garantit que l'absence du fichier n'empêche jamais le reste de la page de se charger ; le navigateur journalise un 404 dans la console, ce qui est attendu et sans conséquence.

- [ ] **Step 10 : Créer `src/app.js` provisoire**

```js
// Assemblage complet en tâche 9. Pour l'instant, on prouve seulement que le module se charge.
console.log('FRAME');
```

- [ ] **Step 11 : Créer `README.md` d'amorce**

````markdown
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
````

- [ ] **Step 12 : Lancer la suite complète et vérifier qu'elle passe**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# pass 7`, `# fail 0`.

- [ ] **Step 13 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add package.json index.html config.example.js README.md styles src tests && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: squelette du site, jetons de style et test de fumée

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

Vérifier avec `git status --short` que `config.local.js` n'apparaît pas dans le commit.

---

## Tâche 2 : Vocabulaire de stickers

**Files:**
- Create: `/Users/matt/Documents/Frame/src/stickers.js`
- Test: `/Users/matt/Documents/Frame/tests/stickers.test.mjs`

**Interfaces:**
- Consumes: la constante `TWEMOJI_BASE` fixée à l'étape 1 de la tâche 1.
- Produces :
  - `TWEMOJI_BASE: string`
  - `DRAWERS: Array<{ id: string, label: string }>` — 7 entrées, ordre : `characters`, `creatures`, `places`, `objects`, `clothes`, `sky`, `world`
  - `STICKERS: Array<Sticker>` où `Sticker = { id: string, emoji: string, label: string, drawer: string, keywords: string[], genres?: number[], atmosphere?: { tint?: string, intensity?: number, light?: number, particles?: 'rain'|'snow'|'embers'|'fog' } }` — 86 entrées, ordre figé
  - `STICKER_BY_ID: Map<string, Sticker>`
  - `STICKER_INDEX: Map<string, number>` (identifiant → index dans `STICKERS`)
  - `FORBIDDEN_LABELS: string[]`
  - `twemojiUrl(emoji: string): string`

**Règles du vocabulaire, à ne jamais enfreindre par la suite :** la liste ne fait que croître, on ajoute uniquement à la fin, on ne renomme ni ne supprime jamais un identifiant, on ne change jamais l'ordre. `src/url.js` encode l'index dans `STICKERS` : toute réorganisation casse tous les liens partagés.

**Écart assumé par rapport à la liste indicative de la spec §3.2 :** la spec propose « 🗼 Paris ». L'emoji U+1F5FC est la tour de Tokyo, pas la tour Eiffel, et aucun emoji standard ne représente Paris. Le sticker garde donc l'emoji 🗼 mais devient `tokyo` / « Tokyo », ce qui est à la fois visuellement juste et bien plus riche côté données TMDB (765 films). La spec précise que sa liste est « à titre indicatif ».

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/stickers.test.mjs` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TWEMOJI_BASE, DRAWERS, STICKERS, STICKER_BY_ID, STICKER_INDEX,
  FORBIDDEN_LABELS, twemojiUrl
} from '../src/stickers.js';

const EXPECTED_IDS = [
  'silhouette', 'woman', 'man', 'child', 'elder', 'cop', 'detective', 'cowboy',
  'ninja', 'astronaut', 'royalty', 'musician',
  'robot', 'alien', 'wolf', 'vampire', 'zombie', 'dragon', 'dinosaur', 'shark',
  'octopus', 'ghost', 'horse', 'dog',
  'city_night', 'metropolis', 'forest', 'desert', 'ocean', 'mountain', 'island',
  'abandoned_house', 'castle', 'space', 'school', 'hospital', 'palace', 'countryside',
  'gun', 'knife', 'money', 'ring', 'camera', 'guitar', 'piano', 'book', 'car',
  'motorcycle', 'plane', 'ship', 'candle', 'champagne', 'pills', 'lab',
  'hat', 'sunglasses', 'leather_coat', 'evening_dress', 'suit', 'martial_arts',
  'mask', 'kimono', 'uniform',
  'rain', 'night', 'sun', 'snow', 'fire', 'storm', 'fog', 'red_light',
  'blue_light', 'violet_neon', 'dusk',
  'antiquity', 'medieval', 'black_white', 'eighties', 'future', 'wasteland',
  'circus', 'casino', 'science', 'orient', 'america', 'tokyo'
];

test('les sept tiroirs sont dans l\'ordre de la spec', () => {
  assert.deepEqual(DRAWERS.map(d => d.id), [
    'characters', 'creatures', 'places', 'objects', 'clothes', 'sky', 'world'
  ]);
  for (const d of DRAWERS) {
    assert.equal(typeof d.label, 'string');
    assert.ok(d.label.length > 0);
  }
});

test('instantané de l\'ordre des identifiants', () => {
  // Ce test échoue dès qu'un identifiant est inséré ailleurs qu'à la fin,
  // renommé ou supprimé. L'encodage d'URL dépend de cet ordre exact.
  assert.deepEqual(STICKERS.map(s => s.id), EXPECTED_IDS);
});

test('le vocabulaire compte environ 80 stickers', () => {
  assert.ok(STICKERS.length >= 78 && STICKERS.length <= 100, `taille inattendue : ${STICKERS.length}`);
});

test('les identifiants sont uniques et en ASCII minuscule', () => {
  const seen = new Set();
  for (const s of STICKERS) {
    assert.ok(!seen.has(s.id), `identifiant en double : ${s.id}`);
    seen.add(s.id);
    assert.match(s.id, /^[a-z][a-z0-9_]*$/, `identifiant non conforme : ${s.id}`);
  }
});

test('les emoji sont uniques', () => {
  const seen = new Set();
  for (const s of STICKERS) {
    assert.ok(!seen.has(s.emoji), `emoji en double : ${s.emoji} (${s.id})`);
    seen.add(s.emoji);
  }
});

test('chaque sticker appartient à un tiroir déclaré', () => {
  const ids = new Set(DRAWERS.map(d => d.id));
  for (const s of STICKERS) {
    assert.ok(ids.has(s.drawer), `tiroir inconnu pour ${s.id} : ${s.drawer}`);
  }
});

test('chaque tiroir contient entre 9 et 16 stickers', () => {
  for (const d of DRAWERS) {
    const n = STICKERS.filter(s => s.drawer === d.id).length;
    assert.ok(n >= 9 && n <= 16, `${d.id} contient ${n} stickers`);
  }
});

test('chaque sticker a 4 à 8 mots-clés TMDB en minuscules', () => {
  for (const s of STICKERS) {
    assert.ok(Array.isArray(s.keywords), `${s.id} : keywords absent`);
    assert.ok(s.keywords.length >= 4 && s.keywords.length <= 8,
      `${s.id} a ${s.keywords.length} mots-clés`);
    const seen = new Set();
    for (const k of s.keywords) {
      assert.equal(typeof k, 'string');
      assert.equal(k, k.toLowerCase(), `${s.id} : mot-clé non minuscule « ${k} »`);
      assert.ok(k.trim().length > 0, `${s.id} : mot-clé vide`);
      assert.ok(!seen.has(k), `${s.id} : mot-clé en double « ${k} »`);
      seen.add(k);
    }
  }
});

test('les libellés sont français, courts et jamais abstraits', () => {
  const forbidden = new Set(FORBIDDEN_LABELS.map(w => w.toLowerCase()));
  assert.ok(forbidden.size >= 10);
  for (const s of STICKERS) {
    assert.equal(typeof s.label, 'string');
    assert.ok(s.label.length > 0 && s.label.length <= 24, `libellé trop long : ${s.label}`);
    assert.ok(!forbidden.has(s.label.toLowerCase()), `libellé interdit : ${s.label}`);
  }
});

test('les genres déclarés sont des entiers TMDB connus', () => {
  const known = new Set([28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37]);
  for (const s of STICKERS) {
    if (s.genres === undefined) continue;
    assert.ok(Array.isArray(s.genres) && s.genres.length > 0, `${s.id} : genres vide`);
    for (const g of s.genres) assert.ok(known.has(g), `${s.id} : genre inconnu ${g}`);
  }
});

test('seul le tiroir « sky » porte des atmosphères, et toutes sont valides', () => {
  const particles = new Set(['rain', 'snow', 'embers', 'fog']);
  for (const s of STICKERS) {
    if (s.drawer !== 'sky') {
      assert.equal(s.atmosphere, undefined, `${s.id} ne devrait pas avoir d'atmosphère`);
      continue;
    }
    assert.ok(s.atmosphere, `${s.id} : atmosphère manquante`);
    const a = s.atmosphere;
    assert.match(a.tint, /^#[0-9A-Fa-f]{6}$/, `${s.id} : teinte invalide`);
    assert.ok(a.intensity > 0 && a.intensity <= 0.5, `${s.id} : intensité hors bornes`);
    assert.ok(a.light >= -1 && a.light <= 1, `${s.id} : lumière hors bornes`);
    if (a.particles !== undefined) {
      assert.ok(particles.has(a.particles), `${s.id} : particules inconnues ${a.particles}`);
    }
  }
});

test('les index sont cohérents avec l\'ordre de STICKERS', () => {
  assert.equal(STICKER_BY_ID.size, STICKERS.length);
  assert.equal(STICKER_INDEX.size, STICKERS.length);
  STICKERS.forEach((s, i) => {
    assert.equal(STICKER_INDEX.get(s.id), i);
    assert.equal(STICKER_BY_ID.get(s.id), s);
  });
});

test('les index tiennent sur un octet, contrainte de l\'encodage d\'URL', () => {
  assert.ok(STICKERS.length <= 256, 'plus de 256 stickers : l\'encodage sur 1 octet casse');
});

test('twemojiUrl : emoji simple', () => {
  assert.equal(twemojiUrl('🌃'), TWEMOJI_BASE + '1f303.svg');
});

test('twemojiUrl : U+FE0F retiré quand il n\'y a pas de U+200D', () => {
  assert.equal(twemojiUrl('🕶️'), TWEMOJI_BASE + '1f576.svg');
  assert.ok(!twemojiUrl('🕶️').includes('fe0f'));
  assert.equal(twemojiUrl('✈️'), TWEMOJI_BASE + '2708.svg');
});

test('twemojiUrl : U+200D conservé, et U+FE0F conservé avec lui', () => {
  assert.equal(twemojiUrl('🧑‍🚀'), TWEMOJI_BASE + '1f9d1-200d-1f680.svg');
  assert.ok(twemojiUrl('🧑‍🚀').includes('200d'));
  const detective = twemojiUrl('🕵️‍♀️');
  assert.equal(detective, TWEMOJI_BASE + '1f575-fe0f-200d-2640-fe0f.svg');
  assert.ok(detective.includes('200d'));
  assert.ok(detective.includes('fe0f'));
});

test('TWEMOJI_BASE pointe sur jsDelivr en SVG', () => {
  assert.match(TWEMOJI_BASE, /^https:\/\/cdn\.jsdelivr\.net\/gh\/jdecked\/twemoji@[^/]+\/assets\/svg\/$/);
});

test('chaque sticker produit une URL Twemoji plausible', () => {
  for (const s of STICKERS) {
    const url = twemojiUrl(s.emoji);
    assert.ok(url.startsWith(TWEMOJI_BASE), s.id);
    assert.match(url.slice(TWEMOJI_BASE.length), /^[0-9a-f]+(-[0-9a-f]+)*\.svg$/, `${s.id} : ${url}`);
  }
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

```bash
cd /Users/matt/Documents/Frame && node --test tests/stickers.test.mjs
```

Attendu : échec immédiat, `Cannot find module '../src/stickers.js'`.

- [ ] **Step 3 : Écrire `src/stickers.js` en entier**

Les 392 noms de mots-clés ci-dessous ont tous été vérifiés le 14 septembre 2026 sur `GET /3/search/keyword` : chacun a une correspondance exacte insensible à la casse sur TMDB.

```js
// Vocabulaire de FRAME.
// RÈGLE ABSOLUE : cette liste ne fait que croître. On ajoute uniquement à la fin.
// On ne renomme jamais un identifiant, on ne supprime jamais une entrée,
// on ne change jamais l'ordre : src/url.js encode l'index dans cette liste et
// tout déplacement casserait chaque lien déjà partagé.

export const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/';

export const DRAWERS = [
  { id: 'characters', label: 'Personnages' },
  { id: 'creatures', label: 'Créatures' },
  { id: 'places', label: 'Lieux' },
  { id: 'objects', label: 'Objets' },
  { id: 'clothes', label: 'Vêtements' },
  { id: 'sky', label: 'Ciel et lumière' },
  { id: 'world', label: 'Monde et époque' }
];

// Mots abstraits interdits comme libellés : un sticker est toujours une chose
// que l'on peut voir. L'abstrait doit émerger des combinaisons.
export const FORBIDDEN_LABELS = [
  'silence', 'romance', 'amour', 'peur', 'tristesse', 'joie', 'mystère',
  'nostalgie', 'tension', 'espoir', 'solitude', 'beauté', 'liberté',
  'vengeance', 'pouvoir', 'justice', 'destin', 'folie', 'mélancolie',
  'suspense', 'drame', 'comédie', '1920', '1980', 'années 80'
];

export const STICKERS = [
  // ── Personnages ───────────────────────────────────────────────────────────
  { id: 'silhouette', emoji: '👤', label: 'Silhouette', drawer: 'characters',
    keywords: ['stranger', 'loneliness', 'identity', 'amnesia', 'mysterious man'], genres: [9648] },
  { id: 'woman', emoji: '👩', label: 'Femme', drawer: 'characters',
    keywords: ['heroine', 'female protagonist', 'woman director', 'feminism', 'female friendship'], genres: [18] },
  { id: 'man', emoji: '👨', label: 'Homme', drawer: 'characters',
    keywords: ['father son relationship', 'male friendship', 'midlife crisis', 'masculinity', 'brothers'], genres: [18] },
  { id: 'child', emoji: '👧', label: 'Enfant', drawer: 'characters',
    keywords: ['child', 'childhood', 'coming of age', 'orphan', 'boy'], genres: [10751, 18] },
  { id: 'elder', emoji: '🧓', label: 'Personne âgée', drawer: 'characters',
    keywords: ['old age', 'grandfather', 'grandmother', 'elderly', 'nursing home'], genres: [18] },
  { id: 'cop', emoji: '👮', label: 'Policier', drawer: 'characters',
    keywords: ['police', 'police officer', 'corrupt cop', 'manhunt', 'police brutality'], genres: [80, 53] },
  { id: 'detective', emoji: '🕵️', label: 'Détective', drawer: 'characters',
    keywords: ['private detective', 'film noir', 'investigation', 'murder mystery', 'whodunit'], genres: [80, 9648] },
  { id: 'cowboy', emoji: '🤠', label: 'Cowboy', drawer: 'characters',
    keywords: ['cowboy', 'western', 'outlaw', 'gunslinger', 'wild west', 'sheriff'], genres: [37] },
  { id: 'ninja', emoji: '🥷', label: 'Ninja', drawer: 'characters',
    keywords: ['ninja', 'assassin', 'martial arts', 'samurai', 'revenge'], genres: [28] },
  { id: 'astronaut', emoji: '🧑‍🚀', label: 'Astronaute', drawer: 'characters',
    keywords: ['astronaut', 'space travel', 'space station', 'nasa', 'spacecraft'], genres: [878] },
  { id: 'royalty', emoji: '👑', label: 'Royauté', drawer: 'characters',
    keywords: ['king', 'queen', 'royalty', 'monarchy', 'prince', 'heir to the throne'], genres: [36, 18] },
  { id: 'musician', emoji: '🧑‍🎤', label: 'Musicien', drawer: 'characters',
    keywords: ['musician', 'rock band', 'singer', 'concert', 'music industry'], genres: [10402] },

  // ── Créatures ─────────────────────────────────────────────────────────────
  { id: 'robot', emoji: '🤖', label: 'Robot', drawer: 'creatures',
    keywords: ['robot', 'android', 'artificial intelligence', 'cyborg', 'cyberpunk'], genres: [878] },
  { id: 'alien', emoji: '👽', label: 'Alien', drawer: 'creatures',
    keywords: ['alien', 'extraterrestrial', 'ufo', 'alien invasion', 'first contact'], genres: [878] },
  { id: 'wolf', emoji: '🐺', label: 'Loup', drawer: 'creatures',
    keywords: ['wolf', 'werewolf', 'wilderness', 'wolves', 'predator'], genres: [27] },
  { id: 'vampire', emoji: '🧛', label: 'Vampire', drawer: 'creatures',
    keywords: ['vampire', 'blood', 'immortality', 'gothic', 'dracula'], genres: [27] },
  { id: 'zombie', emoji: '🧟', label: 'Zombie', drawer: 'creatures',
    keywords: ['zombie', 'undead', 'outbreak', 'survival horror', 'apocalypse'], genres: [27] },
  { id: 'dragon', emoji: '🐉', label: 'Dragon', drawer: 'creatures',
    keywords: ['dragon', 'fantasy world', 'magic', 'sword and sorcery', 'mythology'], genres: [14] },
  { id: 'dinosaur', emoji: '🦖', label: 'Dinosaure', drawer: 'creatures',
    keywords: ['dinosaur', 'prehistoric', 'jurassic', 'giant monster', 'evolution'], genres: [878, 12] },
  { id: 'shark', emoji: '🦈', label: 'Requin', drawer: 'creatures',
    keywords: ['shark', 'shark attack', 'ocean', 'sea', 'survival'], genres: [27, 53] },
  { id: 'octopus', emoji: '🐙', label: 'Pieuvre', drawer: 'creatures',
    keywords: ['octopus', 'sea monster', 'deep sea', 'tentacles', 'underwater'], genres: [27, 12] },
  { id: 'ghost', emoji: '👻', label: 'Fantôme', drawer: 'creatures',
    keywords: ['ghost', 'haunted house', 'supernatural', 'haunting', 'exorcism'], genres: [27] },
  { id: 'horse', emoji: '🐎', label: 'Cheval', drawer: 'creatures',
    keywords: ['horse', 'horse riding', 'ranch', 'rodeo', 'equestrian'], genres: [37] },
  { id: 'dog', emoji: '🐕', label: 'Chien', drawer: 'creatures',
    keywords: ['dog', 'pet', 'loyalty', 'puppy', 'animal'], genres: [10751] },

  // ── Lieux ─────────────────────────────────────────────────────────────────
  { id: 'city_night', emoji: '🌃', label: 'Ville la nuit', drawer: 'places',
    keywords: ['city at night', 'neon', 'nightclub', 'taxi', 'night', 'rain'], genres: [80, 53] },
  { id: 'metropolis', emoji: '🏙️', label: 'Métropole', drawer: 'places',
    keywords: ['skyscraper', 'new york city', 'metropolis', 'rooftop', 'urban decay'], genres: [28] },
  { id: 'forest', emoji: '🌲', label: 'Forêt', drawer: 'places',
    keywords: ['forest', 'woods', 'cabin in the woods', 'nature', 'survival'], genres: [27, 14] },
  { id: 'desert', emoji: '🏜️', label: 'Désert', drawer: 'places',
    keywords: ['desert', 'sand', 'oasis', 'caravan', 'sandstorm'], genres: [12, 37] },
  { id: 'ocean', emoji: '🌊', label: 'Océan', drawer: 'places',
    keywords: ['ocean', 'sea', 'shipwreck', 'sailing', 'underwater'], genres: [12] },
  { id: 'mountain', emoji: '🏔️', label: 'Montagne', drawer: 'places',
    keywords: ['mountain', 'mountain climbing', 'avalanche', 'alps', 'expedition'], genres: [12] },
  { id: 'island', emoji: '🏝️', label: 'Île', drawer: 'places',
    keywords: ['island', 'tropical island', 'castaway', 'deserted island', 'jungle'], genres: [12] },
  { id: 'abandoned_house', emoji: '🏚️', label: 'Maison abandonnée', drawer: 'places',
    keywords: ['abandoned house', 'haunted house', 'ruins', 'isolation', 'decay'], genres: [27] },
  { id: 'castle', emoji: '🏰', label: 'Château', drawer: 'places',
    keywords: ['castle', 'medieval', 'knight', 'kingdom', 'fortress'], genres: [14, 36] },
  { id: 'space', emoji: '🚀', label: 'Espace', drawer: 'places',
    keywords: ['space', 'spaceship', 'outer space', 'space travel', 'galaxy'], genres: [878] },
  { id: 'school', emoji: '🏫', label: 'École', drawer: 'places',
    keywords: ['high school', 'school', 'teacher', 'student', 'bullying'], genres: [18, 35] },
  { id: 'hospital', emoji: '🏥', label: 'Hôpital', drawer: 'places',
    keywords: ['hospital', 'doctor', 'nurse', 'surgery', 'illness'], genres: [18] },
  { id: 'palace', emoji: '🏛️', label: 'Palais', drawer: 'places',
    keywords: ['palace', 'aristocracy', 'royal court', 'ancient rome', 'senate'], genres: [36] },
  { id: 'countryside', emoji: '🌾', label: 'Campagne', drawer: 'places',
    keywords: ['countryside', 'farm', 'village', 'rural', 'harvest'], genres: [18] },

  // ── Objets ────────────────────────────────────────────────────────────────
  { id: 'gun', emoji: '🔫', label: 'Arme', drawer: 'objects',
    keywords: ['gun', 'shootout', 'gunfight', 'hitman', 'firearm'], genres: [28, 80] },
  { id: 'knife', emoji: '🔪', label: 'Couteau', drawer: 'objects',
    keywords: ['knife', 'stabbing', 'serial killer', 'slasher', 'murder'], genres: [27, 53] },
  { id: 'money', emoji: '💰', label: 'Argent', drawer: 'objects',
    keywords: ['money', 'heist', 'robbery', 'greed', 'bank robbery'], genres: [80] },
  { id: 'ring', emoji: '💍', label: 'Bague', drawer: 'objects',
    keywords: ['wedding', 'marriage proposal', 'engagement', 'love', 'bride'], genres: [10749] },
  { id: 'camera', emoji: '📷', label: 'Appareil photo', drawer: 'objects',
    keywords: ['photographer', 'photography', 'filmmaking', 'journalist', 'camera'], genres: [18] },
  { id: 'guitar', emoji: '🎸', label: 'Guitare', drawer: 'objects',
    keywords: ['guitar', 'rock band', 'rock music', 'band', 'garage band'], genres: [10402] },
  { id: 'piano', emoji: '🎹', label: 'Piano', drawer: 'objects',
    keywords: ['piano', 'pianist', 'classical music', 'composer', 'concert'], genres: [10402, 18] },
  { id: 'book', emoji: '📖', label: 'Livre', drawer: 'objects',
    keywords: ['book', 'writer', 'library', 'novel', 'literature'], genres: [18] },
  { id: 'car', emoji: '🚗', label: 'Voiture', drawer: 'objects',
    keywords: ['car', 'car chase', 'road trip', 'car race', 'driving'], genres: [28] },
  { id: 'motorcycle', emoji: '🏍️', label: 'Moto', drawer: 'objects',
    keywords: ['motorcycle', 'biker', 'motorcycle gang', 'chase', 'road'], genres: [28] },
  { id: 'plane', emoji: '✈️', label: 'Avion', drawer: 'objects',
    keywords: ['airplane', 'pilot', 'airport', 'plane crash', 'aviation'], genres: [28, 53] },
  { id: 'ship', emoji: '🚢', label: 'Bateau', drawer: 'objects',
    keywords: ['ship', 'sailing', 'pirate', 'navy', 'submarine'], genres: [12] },
  { id: 'candle', emoji: '🕯️', label: 'Bougie', drawer: 'objects',
    keywords: ['candle', 'ritual', 'cult', 'seance', 'darkness'], genres: [27] },
  { id: 'champagne', emoji: '🥂', label: 'Champagne', drawer: 'objects',
    keywords: ['party', 'high society', 'wealth', 'celebration', 'luxury'], genres: [18, 10749] },
  { id: 'pills', emoji: '💊', label: 'Pilules', drawer: 'objects',
    keywords: ['drugs', 'addiction', 'drug abuse', 'medication', 'overdose'], genres: [80, 18] },
  { id: 'lab', emoji: '🧪', label: 'Laboratoire', drawer: 'objects',
    keywords: ['scientist', 'laboratory', 'experiment', 'mad scientist', 'virus'], genres: [878, 27] },

  // ── Vêtements ─────────────────────────────────────────────────────────────
  { id: 'hat', emoji: '🎩', label: 'Chapeau', drawer: 'clothes',
    keywords: ['magician', 'gentleman', 'aristocracy', 'butler', '1930s'], genres: [14, 18] },
  { id: 'sunglasses', emoji: '🕶️', label: 'Lunettes noires', drawer: 'clothes',
    keywords: ['secret agent', 'spy', 'undercover', 'bodyguard', 'espionage'], genres: [53, 28] },
  { id: 'leather_coat', emoji: '🧥', label: 'Manteau de cuir', drawer: 'clothes',
    keywords: ['cyberpunk', 'dystopia', 'hacker', 'anti hero', 'neo-noir'], genres: [878, 53] },
  { id: 'evening_dress', emoji: '👗', label: 'Robe de soirée', drawer: 'clothes',
    keywords: ['ball', 'high society', 'gala', 'romance', 'fashion'], genres: [10749, 18] },
  { id: 'suit', emoji: '👔', label: 'Costume', drawer: 'clothes',
    keywords: ['businessman', 'office', 'corporation', 'wall street', 'lawyer'], genres: [18, 80] },
  { id: 'martial_arts', emoji: '🥋', label: 'Arts martiaux', drawer: 'clothes',
    keywords: ['martial arts', 'kung fu', 'karate', 'fight', 'dojo'], genres: [28] },
  { id: 'mask', emoji: '🎭', label: 'Masque', drawer: 'clothes',
    keywords: ['mask', 'masquerade ball', 'theatre', 'disguise', 'secret identity'], genres: [53, 27] },
  { id: 'kimono', emoji: '👘', label: 'Kimono', drawer: 'clothes',
    keywords: ['japan', 'geisha', 'samurai', 'tokyo, japan', 'tradition'], genres: [18, 36] },
  { id: 'uniform', emoji: '🦺', label: 'Uniforme', drawer: 'clothes',
    keywords: ['worker', 'factory', 'construction', 'blue collar', 'labor union'], genres: [18] },

  // ── Ciel et lumière (atmosphères) ─────────────────────────────────────────
  { id: 'rain', emoji: '🌧️', label: 'Pluie', drawer: 'sky',
    keywords: ['rain', 'storm', 'umbrella', 'melancholy', 'neo-noir'], genres: [18, 53],
    atmosphere: { tint: '#4A6FA5', intensity: 0.28, light: -0.10, particles: 'rain' } },
  { id: 'night', emoji: '🌙', label: 'Nuit', drawer: 'sky',
    keywords: ['night', 'insomnia', 'nocturnal', 'moon', 'darkness'], genres: [27, 53],
    atmosphere: { tint: '#1B2A4A', intensity: 0.35, light: -0.20 } },
  { id: 'sun', emoji: '☀️', label: 'Soleil', drawer: 'sky',
    keywords: ['summer', 'beach', 'heat', 'vacation', 'sunshine'], genres: [10751, 35],
    atmosphere: { tint: '#F2B544', intensity: 0.18, light: 0.25 } },
  { id: 'snow', emoji: '❄️', label: 'Neige', drawer: 'sky',
    keywords: ['snow', 'winter', 'blizzard', 'ice', 'cold'], genres: [12, 18],
    atmosphere: { tint: '#9FC7E8', intensity: 0.22, light: 0.12, particles: 'snow' } },
  { id: 'fire', emoji: '🔥', label: 'Feu', drawer: 'sky',
    keywords: ['fire', 'arson', 'firefighter', 'explosion', 'burning'], genres: [28],
    atmosphere: { tint: '#E2542B', intensity: 0.30, light: 0.15, particles: 'embers' } },
  { id: 'storm', emoji: '⛈️', label: 'Orage', drawer: 'sky',
    keywords: ['thunderstorm', 'lightning', 'hurricane', 'tornado', 'disaster'], genres: [28, 12],
    atmosphere: { tint: '#3A4A6B', intensity: 0.34, light: -0.15, particles: 'rain' } },
  { id: 'fog', emoji: '🌫️', label: 'Brouillard', drawer: 'sky',
    keywords: ['fog', 'mist', 'mystery', 'isolation', 'atmospheric'], genres: [27, 9648],
    atmosphere: { tint: '#8A93A6', intensity: 0.26, light: -0.05, particles: 'fog' } },
  { id: 'red_light', emoji: '🟥', label: 'Lumière rouge', drawer: 'sky',
    keywords: ['blood', 'giallo', 'nightmare', 'hell', 'obsession'], genres: [27],
    atmosphere: { tint: '#C8203A', intensity: 0.32, light: -0.05 } },
  { id: 'blue_light', emoji: '🟦', label: 'Lumière bleue', drawer: 'sky',
    keywords: ['neo-noir', 'melancholy', 'loneliness', 'cold war', 'dream'], genres: [18, 9648],
    atmosphere: { tint: '#2A6FC9', intensity: 0.32, light: -0.08 } },
  { id: 'violet_neon', emoji: '🟪', label: 'Néon violet', drawer: 'sky',
    keywords: ['neon', 'cyberpunk', 'synthwave', 'nightclub', 'retrofuturism'], genres: [878],
    atmosphere: { tint: '#8B3FD9', intensity: 0.34, light: 0.05 } },
  { id: 'dusk', emoji: '🌅', label: 'Crépuscule', drawer: 'sky',
    keywords: ['sunset', 'sunrise', 'horizon', 'farewell', 'road trip'], genres: [18, 10749],
    atmosphere: { tint: '#F2784B', intensity: 0.24, light: 0.10 } },

  // ── Monde et époque ───────────────────────────────────────────────────────
  { id: 'antiquity', emoji: '🏺', label: 'Antiquité', drawer: 'world',
    keywords: ['ancient greece', 'ancient rome', 'mythology', 'gladiator', 'egypt'], genres: [36, 12] },
  { id: 'medieval', emoji: '⚔️', label: 'Médiéval', drawer: 'world',
    keywords: ['medieval', 'sword', 'knight', 'battle', 'crusader'], genres: [36, 12] },
  { id: 'black_white', emoji: '🎞️', label: 'Noir et blanc', drawer: 'world',
    keywords: ['black and white', 'film noir', 'silent film', '1940s', 'classic'], genres: [18, 80] },
  { id: 'eighties', emoji: '📼', label: 'Années 1980', drawer: 'world',
    keywords: ['1980s', 'vhs', 'synthwave', 'nostalgia', 'arcade'], genres: [878, 35] },
  { id: 'future', emoji: '🛸', label: 'Futur', drawer: 'world',
    keywords: ['future', 'dystopia', 'science fiction', 'utopia', 'time travel'], genres: [878] },
  { id: 'wasteland', emoji: '☢️', label: 'Post-apocalyptique', drawer: 'world',
    keywords: ['post-apocalyptic future', 'nuclear war', 'radiation', 'survival', 'wasteland'], genres: [878, 28] },
  { id: 'circus', emoji: '🎪', label: 'Cirque', drawer: 'world',
    keywords: ['circus', 'clown', 'carnival', 'freak show', 'acrobats'], genres: [14, 18] },
  { id: 'casino', emoji: '🎰', label: 'Casino', drawer: 'world',
    keywords: ['casino', 'gambling', 'las vegas', 'poker', 'con artist'], genres: [80, 53] },
  { id: 'science', emoji: '🛰️', label: 'Science', drawer: 'world',
    keywords: ['satellite', 'space program', 'technology', 'experiment', 'research'], genres: [878, 99] },
  { id: 'orient', emoji: '🕌', label: 'Orient', drawer: 'world',
    keywords: ['middle east', 'desert', 'saudi arabia', 'istanbul', 'bazaar'], genres: [12, 36] },
  { id: 'america', emoji: '🗽', label: 'Amérique', drawer: 'world',
    keywords: ['new york city', 'american dream', 'immigrant', 'usa', 'statue of liberty'], genres: [18, 80] },
  { id: 'tokyo', emoji: '🗼', label: 'Tokyo', drawer: 'world',
    keywords: ['tokyo, japan', 'japan', 'yakuza', 'anime', 'neon'], genres: [16, 28] }
];

export const STICKER_BY_ID = new Map(STICKERS.map(s => [s.id, s]));
export const STICKER_INDEX = new Map(STICKERS.map((s, i) => [s.id, i]));

/**
 * URL du SVG Twemoji d'un emoji.
 * Convention Twemoji : les points de code en hexadécimal minuscule joints par « - »,
 * en retirant le sélecteur de variante U+FE0F sauf si la séquence contient U+200D.
 * @param {string} emoji
 * @returns {string}
 */
export function twemojiUrl(emoji) {
  let points = Array.from(emoji).map(ch => ch.codePointAt(0));
  if (!points.includes(0x200d)) points = points.filter(cp => cp !== 0xfe0f);
  return TWEMOJI_BASE + points.map(cp => cp.toString(16)).join('-') + '.svg';
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

```bash
cd /Users/matt/Documents/Frame && node --test tests/stickers.test.mjs
```

Attendu : `# pass 18`, `# fail 0`.

- [ ] **Step 5 : Vérifier que les 86 SVG Twemoji existent réellement**

```bash
cd /Users/matt/Documents/Frame && node --input-type=module -e "
import { STICKERS, twemojiUrl } from './src/stickers.js';
let bad = 0;
for (const s of STICKERS) {
  const r = await fetch(twemojiUrl(s.emoji), { method: 'HEAD' });
  if (!r.ok) { console.log('MANQUANT', s.id, s.emoji, r.status); bad++; }
}
console.log(bad === 0 ? 'les ' + STICKERS.length + ' SVG répondent 200' : bad + ' manquants');
"
```

Attendu : `les 86 SVG répondent 200`.

- [ ] **Step 6 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/stickers.js tests/stickers.test.mjs && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: vocabulaire de 86 stickers avec mots-clés TMDB vérifiés

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 3 : Modèle du tableau

**Files:**
- Create: `/Users/matt/Documents/Frame/src/board.js`
- Test: `/Users/matt/Documents/Frame/tests/board.test.mjs`

**Interfaces:**
- Consumes: `STICKER_BY_ID` de `src/stickers.js`.
- Produces :
  - `MAX_STICKERS = 40`, `SCALE_MIN = 0.5`, `SCALE_MAX = 3`
  - `createBoard(): Board` où `Board = { items: Item[] }` et `Item = { id: string, x: number, y: number, scale: number, flip: boolean }`
  - `addSticker(board, id, { x = 0.5, y = 0.5, scale = 1, flip = false } = {}): Board`
  - `moveSticker(board, index, x, y): Board`
  - `scaleSticker(board, index, scale): Board`
  - `flipSticker(board, index): Board`
  - `removeSticker(board, index): Board`
  - `bringToFront(board, index): Board`
  - `clearBoard(): Board`
  - `boardSeedKey(board): string`

**Contrat d'immuabilité :** aucune fonction ne modifie son argument. Chaque opération renvoie un nouvel objet `{ items: [...] }` avec de nouveaux objets d'item pour ceux qui changent. Une opération sans effet (index hors bornes, identifiant inconnu, tableau plein) renvoie **le même objet board**, par identité : `app.js` s'en sert pour savoir s'il doit empiler un état d'annulation.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/board.test.mjs` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STICKERS, SCALE_MIN, SCALE_MAX, createBoard, addSticker, moveSticker,
  scaleSticker, flipSticker, removeSticker, bringToFront, clearBoard, boardSeedKey
} from '../src/board.js';

test('les constantes valent celles de la spec', () => {
  assert.equal(MAX_STICKERS, 40);
  assert.equal(SCALE_MIN, 0.5);
  assert.equal(SCALE_MAX, 3);
});

test('createBoard donne un tableau vide', () => {
  const b = createBoard();
  assert.deepEqual(b, { items: [] });
});

test('addSticker pose au centre avec les valeurs par défaut', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.deepEqual(b.items, [{ id: 'robot', x: 0.5, y: 0.5, scale: 1, flip: false }]);
});

test('addSticker accepte des options et borne position et taille', () => {
  const b = addSticker(createBoard(), 'rain', { x: 1.4, y: -0.3, scale: 9, flip: true });
  assert.deepEqual(b.items, [{ id: 'rain', x: 1, y: 0, scale: 3, flip: true }]);
});

test('addSticker ne modifie pas le tableau d\'origine', () => {
  const a = createBoard();
  const b = addSticker(a, 'robot');
  assert.equal(a.items.length, 0);
  assert.notEqual(a, b);
});

test('addSticker empile : le dernier posé est devant', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  assert.deepEqual(b.items.map(i => i.id), ['robot', 'rain']);
});

test('addSticker refuse un identifiant inconnu et renvoie le même objet', () => {
  const a = createBoard();
  assert.equal(addSticker(a, 'pas_un_sticker'), a);
});

test('addSticker refuse au-delà de 40 et renvoie le même objet', () => {
  let b = createBoard();
  for (let i = 0; i < MAX_STICKERS; i++) b = addSticker(b, 'robot');
  assert.equal(b.items.length, 40);
  assert.equal(addSticker(b, 'rain'), b);
});

test('moveSticker borne x et y entre 0 et 1', () => {
  let b = addSticker(createBoard(), 'robot');
  b = moveSticker(b, 0, 0.25, 0.75);
  assert.deepEqual([b.items[0].x, b.items[0].y], [0.25, 0.75]);
  b = moveSticker(b, 0, -5, 5);
  assert.deepEqual([b.items[0].x, b.items[0].y], [0, 1]);
});

test('moveSticker sur un index hors bornes renvoie le même objet', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.equal(moveSticker(b, 7, 0.1, 0.1), b);
  assert.equal(moveSticker(b, -1, 0.1, 0.1), b);
});

test('scaleSticker borne entre 0,5 et 3', () => {
  let b = addSticker(createBoard(), 'robot');
  b = scaleSticker(b, 0, 2.25);
  assert.equal(b.items[0].scale, 2.25);
  assert.equal(scaleSticker(b, 0, 0.1).items[0].scale, 0.5);
  assert.equal(scaleSticker(b, 0, 12).items[0].scale, 3);
});

test('flipSticker bascule le drapeau sans toucher au reste', () => {
  let b = addSticker(createBoard(), 'robot', { x: 0.2, y: 0.3, scale: 2 });
  b = flipSticker(b, 0);
  assert.deepEqual(b.items[0], { id: 'robot', x: 0.2, y: 0.3, scale: 2, flip: true });
  b = flipSticker(b, 0);
  assert.equal(b.items[0].flip, false);
});

test('removeSticker retire le bon item', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  b = addSticker(b, 'forest');
  b = removeSticker(b, 1);
  assert.deepEqual(b.items.map(i => i.id), ['robot', 'forest']);
});

test('removeSticker hors bornes renvoie le même objet', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.equal(removeSticker(b, 3), b);
});

test('bringToFront déplace l\'item à la fin de la liste', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  b = addSticker(b, 'forest');
  b = bringToFront(b, 0);
  assert.deepEqual(b.items.map(i => i.id), ['rain', 'forest', 'robot']);
});

test('bringToFront sur le dernier renvoie le même objet', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  assert.equal(bringToFront(b, 1), b);
});

test('clearBoard donne un tableau vide neuf', () => {
  const b = clearBoard();
  assert.deepEqual(b, { items: [] });
  assert.notEqual(b, clearBoard());
});

test('boardSeedKey décrit identifiants, tailles et ordre', () => {
  let b = createBoard();
  b = addSticker(b, 'robot', { scale: 1 });
  b = addSticker(b, 'rain', { scale: 2.5 });
  assert.equal(boardSeedKey(b), 'robot:1.00|rain:2.50');
  assert.equal(boardSeedKey(createBoard()), '');
});

test('boardSeedKey ignore la position mais suit l\'ordre', () => {
  let a = createBoard();
  a = addSticker(a, 'robot', { x: 0.1, y: 0.1 });
  a = addSticker(a, 'rain', { x: 0.9, y: 0.9 });
  let b = createBoard();
  b = addSticker(b, 'robot', { x: 0.7, y: 0.2 });
  b = addSticker(b, 'rain', { x: 0.3, y: 0.4 });
  assert.equal(boardSeedKey(a), boardSeedKey(b));
  assert.notEqual(boardSeedKey(a), boardSeedKey(bringToFront(a, 0)));
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

```bash
cd /Users/matt/Documents/Frame && node --test tests/board.test.mjs
```

Attendu : échec, `Cannot find module '../src/board.js'`.

- [ ] **Step 3 : Écrire `src/board.js`**

```js
import { STICKER_BY_ID } from './stickers.js';

export const MAX_STICKERS = 40;
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 3;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = v => clamp(Number(v), 0, 1);
const clampScale = v => clamp(Number(v), SCALE_MIN, SCALE_MAX);
const inRange = (board, index) => Number.isInteger(index) && index >= 0 && index < board.items.length;

/** @returns {{items: Array<{id: string, x: number, y: number, scale: number, flip: boolean}>}} */
export function createBoard() {
  return { items: [] };
}

export function addSticker(board, id, { x = 0.5, y = 0.5, scale = 1, flip = false } = {}) {
  if (!STICKER_BY_ID.has(id)) return board;
  if (board.items.length >= MAX_STICKERS) return board;
  return {
    items: [...board.items, {
      id,
      x: clamp01(x),
      y: clamp01(y),
      scale: clampScale(scale),
      flip: Boolean(flip)
    }]
  };
}

export function moveSticker(board, index, x, y) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items[index] = { ...items[index], x: clamp01(x), y: clamp01(y) };
  return { items };
}

export function scaleSticker(board, index, scale) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items[index] = { ...items[index], scale: clampScale(scale) };
  return { items };
}

export function flipSticker(board, index) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items[index] = { ...items[index], flip: !items[index].flip };
  return { items };
}

export function removeSticker(board, index) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items.splice(index, 1);
  return { items };
}

export function bringToFront(board, index) {
  if (!inRange(board, index)) return board;
  if (index === board.items.length - 1) return board;
  const items = board.items.slice();
  const [moved] = items.splice(index, 1);
  items.push(moved);
  return { items };
}

export function clearBoard() {
  return { items: [] };
}

/**
 * Clé de graine du tirage déterministe : identifiants, tailles et ordre.
 * La position est volontairement absente : elle n'influence pas les résultats.
 */
export function boardSeedKey(board) {
  return board.items.map(it => it.id + ':' + it.scale.toFixed(2)).join('|');
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

```bash
cd /Users/matt/Documents/Frame && node --test tests/board.test.mjs
```

Attendu : `# pass 19`, `# fail 0`.

- [ ] **Step 5 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/board.js tests/board.test.mjs && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: modèle immuable du tableau de stickers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 4 : Encodage du tableau dans l'URL

**Files:**
- Create: `/Users/matt/Documents/Frame/src/url.js`
- Test: `/Users/matt/Documents/Frame/tests/url.test.mjs`

**Interfaces:**
- Consumes: `STICKERS`, `STICKER_INDEX` de `src/stickers.js` ; `createBoard`, `SCALE_MIN`, `SCALE_MAX`, `MAX_STICKERS` de `src/board.js`.
- Produces :
  - `URL_VERSION = 1`
  - `encodeBoard(board): string` — renvoie `'t=1.<base64url>'`, ou `''` pour un tableau vide
  - `decodeBoard(fragment): { board: Board, error: null | 'empty' | 'version' | 'malformed' | 'unknown-sticker' }`
  - `boardToUrl(board, baseHref): string`

**Format binaire, 5 octets par sticker :** index dans `STICKERS` (0–255), `x` (0–255), `y` (0–255), `scale` mappé linéairement de 0,5–3 sur 0–255, drapeaux (bit 0 = `flip`). Encodage base64url sans remplissage : `+` → `-`, `/` → `_`, `=` retiré. 40 stickers = 200 octets = 267 caractères de base64url, plus `t=1.` = 271 caractères.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/url.test.mjs` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { URL_VERSION, encodeBoard, decodeBoard, boardToUrl } from '../src/url.js';
import { createBoard, addSticker, MAX_STICKERS } from '../src/board.js';
import { STICKERS } from '../src/stickers.js';

const near = (a, b, tol = 1e-2) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('la version du schéma vaut 1', () => {
  assert.equal(URL_VERSION, 1);
});

test('un tableau vide s\'encode en chaîne vide', () => {
  assert.equal(encodeBoard(createBoard()), '');
});

test('l\'encodage porte le préfixe t=1.', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.match(encodeBoard(b), /^t=1\.[A-Za-z0-9_-]+$/);
});

test('aller-retour sur un sticker unique', () => {
  const b = addSticker(createBoard(), 'city_night', { x: 0.25, y: 0.75, scale: 1.5, flip: true });
  const { board, error } = decodeBoard(encodeBoard(b));
  assert.equal(error, null);
  assert.equal(board.items.length, 1);
  assert.equal(board.items[0].id, 'city_night');
  near(board.items[0].x, 0.25);
  near(board.items[0].y, 0.75);
  near(board.items[0].scale, 1.5);
  assert.equal(board.items[0].flip, true);
});

test('aller-retour sur un tableau varié, ordre compris', () => {
  let b = createBoard();
  b = addSticker(b, 'rain', { x: 0, y: 0, scale: 0.5, flip: false });
  b = addSticker(b, 'robot', { x: 1, y: 1, scale: 3, flip: true });
  b = addSticker(b, 'tokyo', { x: 0.5, y: 0.5, scale: 1, flip: false });
  b = addSticker(b, 'silhouette', { x: 0.33, y: 0.66, scale: 2.2, flip: true });
  const { board, error } = decodeBoard(encodeBoard(b));
  assert.equal(error, null);
  assert.deepEqual(board.items.map(i => i.id), ['rain', 'robot', 'tokyo', 'silhouette']);
  b.items.forEach((src, i) => {
    near(board.items[i].x, src.x);
    near(board.items[i].y, src.y);
    near(board.items[i].scale, src.scale);
    assert.equal(board.items[i].flip, src.flip);
  });
});

test('le premier et le dernier sticker du vocabulaire survivent à l\'aller-retour', () => {
  let b = createBoard();
  b = addSticker(b, STICKERS[0].id);
  b = addSticker(b, STICKERS[STICKERS.length - 1].id);
  const { board, error } = decodeBoard(encodeBoard(b));
  assert.equal(error, null);
  assert.deepEqual(board.items.map(i => i.id), [STICKERS[0].id, STICKERS[STICKERS.length - 1].id]);
});

test('40 stickers tiennent en 275 caractères au plus', () => {
  let b = createBoard();
  for (let i = 0; i < MAX_STICKERS; i++) {
    b = addSticker(b, STICKERS[i % STICKERS.length].id, { x: i / 40, y: 1 - i / 40, scale: 0.5 + (i % 6) * 0.5, flip: i % 2 === 0 });
  }
  const encoded = encodeBoard(b);
  assert.ok(encoded.length <= 275, `longueur ${encoded.length}`);
  const { board, error } = decodeBoard(encoded);
  assert.equal(error, null);
  assert.equal(board.items.length, 40);
  assert.deepEqual(board.items.map(i => i.id), b.items.map(i => i.id));
});

test('decodeBoard accepte le dièse initial', () => {
  const encoded = encodeBoard(addSticker(createBoard(), 'robot'));
  assert.deepEqual(decodeBoard('#' + encoded).board, decodeBoard(encoded).board);
});

test('decodeBoard ignore les autres paramètres du fragment', () => {
  const encoded = encodeBoard(addSticker(createBoard(), 'robot'));
  const { board, error } = decodeBoard('#mode=liste&' + encoded + '&x=1');
  assert.equal(error, null);
  assert.deepEqual(board.items.map(i => i.id), ['robot']);
});

test('un fragment vide donne un tableau vide et l\'erreur empty', () => {
  for (const frag of ['', '#', '#mode=liste', 't=']) {
    const { board, error } = decodeBoard(frag);
    assert.deepEqual(board, { items: [] });
    assert.equal(error, 'empty', `fragment ${JSON.stringify(frag)}`);
  }
});

test('une version inconnue donne un tableau vide et l\'erreur version', () => {
  const { board, error } = decodeBoard('t=9.AAAAAAA');
  assert.deepEqual(board, { items: [] });
  assert.equal(error, 'version');
});

test('un fragment malformé donne un tableau vide et l\'erreur malformed', () => {
  for (const frag of ['t=1', 't=1.', 't=1.!!!!', 't=1.AAAA', 't=abc.AAAAAAA']) {
    const { board, error } = decodeBoard(frag);
    assert.deepEqual(board, { items: [] }, `fragment ${frag}`);
    assert.equal(error, 'malformed', `fragment ${frag}`);
  }
});

test('un index de sticker inconnu donne un tableau vide et l\'erreur unknown-sticker', () => {
  // 5 octets : index 255 (aucun sticker), x 0, y 0, scale 0, flags 0
  const bytes = [255, 0, 0, 0, 0];
  const b64 = Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const { board, error } = decodeBoard('t=1.' + b64);
  assert.deepEqual(board, { items: [] });
  assert.equal(error, 'unknown-sticker');
});

test('boardToUrl remplace le fragment sans toucher au chemin', () => {
  const b = addSticker(createBoard(), 'robot');
  const url = boardToUrl(b, 'https://matt.example/frame/index.html#t=1.VIEUX');
  assert.equal(url, 'https://matt.example/frame/index.html#' + encodeBoard(b));
  assert.ok(!url.includes('VIEUX'));
});

test('boardToUrl sur un tableau vide enlève le fragment', () => {
  assert.equal(boardToUrl(createBoard(), 'https://matt.example/frame/#t=1.VIEUX'), 'https://matt.example/frame/');
});

test('l\'encodage est stable : deux appels donnent la même chaîne', () => {
  const b = addSticker(addSticker(createBoard(), 'rain', { scale: 2 }), 'robot');
  assert.equal(encodeBoard(b), encodeBoard(b));
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

```bash
cd /Users/matt/Documents/Frame && node --test tests/url.test.mjs
```

Attendu : échec, `Cannot find module '../src/url.js'`.

- [ ] **Step 3 : Écrire `src/url.js`**

```js
import { STICKERS, STICKER_INDEX } from './stickers.js';
import { createBoard, SCALE_MIN, SCALE_MAX } from './board.js';

export const URL_VERSION = 1;

const BYTES_PER_STICKER = 5;
const SCALE_SPAN = SCALE_MAX - SCALE_MIN; // 2.5

const toByte = unit => Math.max(0, Math.min(255, Math.round(unit * 255)));
const fromByte = byte => byte / 255;

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * @param {{items: Array}} board
 * @returns {string} 't=1.<base64url>' ou '' si le tableau est vide
 */
export function encodeBoard(board) {
  if (!board || !board.items.length) return '';
  const bytes = new Uint8Array(board.items.length * BYTES_PER_STICKER);
  board.items.forEach((item, i) => {
    const at = i * BYTES_PER_STICKER;
    bytes[at] = STICKER_INDEX.get(item.id) ?? 0;
    bytes[at + 1] = toByte(item.x);
    bytes[at + 2] = toByte(item.y);
    bytes[at + 3] = toByte((item.scale - SCALE_MIN) / SCALE_SPAN);
    bytes[at + 4] = item.flip ? 1 : 0;
  });
  return 't=' + URL_VERSION + '.' + toBase64Url(bytes);
}

/**
 * Ne lance jamais. Un fragment illisible donne un tableau vide et un code d'erreur
 * que app.js affiche comme un avertissement discret.
 * @param {string} fragment  avec ou sans « # » initial
 * @returns {{board: {items: Array}, error: null|'empty'|'version'|'malformed'|'unknown-sticker'}}
 */
export function decodeBoard(fragment) {
  const fail = error => ({ board: createBoard(), error });
  const raw = String(fragment ?? '').replace(/^#/, '');
  if (!raw) return fail('empty');

  let payload = null;
  for (const part of raw.split('&')) {
    if (part.startsWith('t=')) { payload = part.slice(2); break; }
  }
  if (payload === null || payload === '') return fail('empty');

  const dot = payload.indexOf('.');
  if (dot < 0) return fail('malformed');
  const version = payload.slice(0, dot);
  const data = payload.slice(dot + 1);
  if (!/^\d+$/.test(version)) return fail('malformed');
  if (Number(version) !== URL_VERSION) return fail('version');
  if (!data || !/^[A-Za-z0-9_-]+$/.test(data)) return fail('malformed');

  let bytes;
  try {
    bytes = fromBase64Url(data);
  } catch {
    return fail('malformed');
  }
  if (bytes.length === 0 || bytes.length % BYTES_PER_STICKER !== 0) return fail('malformed');

  const items = [];
  for (let at = 0; at < bytes.length; at += BYTES_PER_STICKER) {
    const sticker = STICKERS[bytes[at]];
    if (!sticker) return fail('unknown-sticker');
    items.push({
      id: sticker.id,
      x: fromByte(bytes[at + 1]),
      y: fromByte(bytes[at + 2]),
      scale: SCALE_MIN + fromByte(bytes[at + 3]) * SCALE_SPAN,
      flip: (bytes[at + 4] & 1) === 1
    });
  }
  return { board: { items }, error: null };
}

/**
 * @param {{items: Array}} board
 * @param {string} baseHref  typiquement location.href
 */
export function boardToUrl(board, baseHref) {
  const base = String(baseHref).split('#')[0];
  const encoded = encodeBoard(board);
  return encoded ? base + '#' + encoded : base;
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

```bash
cd /Users/matt/Documents/Frame && node --test tests/url.test.mjs
```

Attendu : `# pass 16`, `# fail 0`.

- [ ] **Step 5 : Mesurer la longueur réelle d'un tableau plein**

```bash
cd /Users/matt/Documents/Frame && node --input-type=module -e "
import { createBoard, addSticker, MAX_STICKERS } from './src/board.js';
import { STICKERS } from './src/stickers.js';
import { encodeBoard } from './src/url.js';
let b = createBoard();
for (let i = 0; i < MAX_STICKERS; i++) b = addSticker(b, STICKERS[i].id, { scale: 2 });
console.log('longueur du fragment :', encodeBoard(b).length);
"
```

Attendu : `longueur du fragment : 271`.

- [ ] **Step 6 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/url.js tests/url.test.mjs && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: encodage et décodage du tableau dans le fragment d'URL

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 5 : Moteur de fusion, de sélection et d'explication

**Files:**
- Create: `/Users/matt/Documents/Frame/src/engine.js`
- Test: `/Users/matt/Documents/Frame/tests/engine.test.mjs`

**Interfaces:**
- Consumes: `STICKER_BY_ID` de `src/stickers.js`.
- Produces :
  - `SCORE_RANK_SPAN = 80`, `GENRE_BONUS = 0.15`, `MIN_VOTE_AVERAGE = 5.5`, `RESULT_COUNT = 6`
  - `hashString(str: string): number` — FNV-1a 32 bits, non signé
  - `createRng(seed: number): () => number` — mulberry32, valeurs dans [0, 1)
  - `scoreMovies(placed, pools): Map<number, ScoredEntry>` où `placed = Array<{ id: string, scale: number }>`, `pools = { [stickerId]: { popular: Movie[], rated: Movie[] } }`, `ScoredEntry = { movie: Movie, score: number, matched: Set<string>, bestRank: number }`
  - `selectMovies(placed, pools, previous = [], seedKey = placed.map(p => p.id + ':' + p.scale).join('|')): Selection[]` où `Selection = { movie: Movie, category: 'evident'|'surprise'|'unexpected', matched: string[], ignored: string[] }`, au plus 6 entrées
  - `explain(entry: Selection, placed): { honored: Sticker[], ignored: Sticker[], sentence: string }`
- `Movie` est un film TMDB brut : `{ id, title, original_title, release_date, poster_path, vote_average, vote_count, genre_ids, overview, popularity }`.
- `app.js` passe toujours `boardSeedKey(board)` en quatrième argument de `selectMovies`, c'est-à-dire `id:taille arrondie à 2 décimales` joints par `|`. La valeur par défaut de la signature n'existe que pour les appels directs dans les tests.

**Formule, spec §5.3 :** poids `w = scale` borné 0,5–3. Pour chaque sticker qui contient le film, on ajoute `w × (1 − rang / 80)` où `rang` est le **meilleur** (le plus petit) des rangs du film dans `popular` puis dans `rated` de ce sticker, plus `0,15 × w` si l'un des genres déclarés par le sticker figure dans `genre_ids` du film. Tout film dont `vote_average < 5,5` est exclu avant tout calcul.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/engine.test.mjs`. Les jeux de données sont fixes et construits pour que chaque assertion soit exacte, pas approximative.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashString, createRng, scoreMovies, selectMovies, explain } from '../src/engine.js';

const mv = (id, vote_average = 7, genre_ids = []) => ({
  id, title: 'Film ' + id, original_title: 'Film ' + id, release_date: '2001-01-01',
  vote_average, vote_count: 500, genre_ids, poster_path: null, overview: 'Résumé ' + id, popularity: 10
});
const seq = (from, count) => Array.from({ length: count }, (_, i) => mv(from + i));

const POOLS = {
  city_night: {
    popular: [mv(1, 8.0, [80]), mv(2, 7.8), mv(3, 7.6), mv(4, 5.0), ...seq(100, 20)],
    rated: [mv(1, 8.0, [80]), mv(2, 7.8), mv(3, 7.6), ...seq(500, 17)]
  },
  robot: {
    popular: [mv(2, 7.8), mv(1, 8.0, [80]), mv(6, 7.2), ...seq(300, 20)],
    rated: [mv(2, 7.8), mv(6, 7.2), ...seq(700, 18)]
  }
};
const PLACED_1 = [{ id: 'city_night', scale: 1 }];
const PLACED_2 = [{ id: 'city_night', scale: 1 }, { id: 'robot', scale: 1 }];
const KEY_1 = 'city_night:1.00';
const KEY_2 = 'city_night:1.00|robot:1.00';

test('hashString est FNV-1a 32 bits, stable et sensible', () => {
  assert.equal(hashString(''), 2166136261);
  assert.equal(hashString('a'), 3826002220);
  assert.equal(hashString('abc'), 440920331);
  assert.equal(hashString('robot:1.00'), hashString('robot:1.00'));
  assert.notEqual(hashString('robot:1.00'), hashString('robot:2.00'));
});

test('createRng est déterministe et reste dans [0,1)', () => {
  const a = createRng(12345); const b = createRng(12345);
  const first = [a(), a(), a(), a(), a()];
  assert.deepEqual(first, [b(), b(), b(), b(), b()]);
  for (const v of first) { assert.ok(v >= 0 && v < 1); }
  const other = createRng(999);
  assert.notDeepEqual(first, [other(), other(), other(), other(), other()]);
});

test('scoreMovies applique rang, poids et bonus de genre', () => {
  const scored = scoreMovies(PLACED_1, POOLS);
  assert.ok(Math.abs(scored.get(1).score - 1.15) < 1e-9);
  assert.ok(Math.abs(scored.get(2).score - (1 - 1 / 80)) < 1e-9);
  assert.ok(Math.abs(scored.get(3).score - (1 - 2 / 80)) < 1e-9);
  assert.deepEqual([...scored.get(1).matched], ['city_night']);
  assert.equal(scored.get(1).bestRank, 0);
});

test('scoreMovies double le score quand la taille double', () => {
  const small = scoreMovies([{ id: 'city_night', scale: 1 }], POOLS).get(3).score;
  const big = scoreMovies([{ id: 'city_night', scale: 2 }], POOLS).get(3).score;
  assert.ok(Math.abs(big - 2 * small) < 1e-9);
});

test('scoreMovies borne le poids entre 0,5 et 3', () => {
  const huge = scoreMovies([{ id: 'city_night', scale: 50 }], POOLS).get(3).score;
  const three = scoreMovies([{ id: 'city_night', scale: 3 }], POOLS).get(3).score;
  assert.equal(huge, three);
  const tiny = scoreMovies([{ id: 'city_night', scale: 0.01 }], POOLS).get(3).score;
  const half = scoreMovies([{ id: 'city_night', scale: 0.5 }], POOLS).get(3).score;
  assert.equal(tiny, half);
});

test('scoreMovies exclut les films sous 5,5 de moyenne', () => {
  assert.equal(scoreMovies(PLACED_1, POOLS).has(4), false);
});

test('scoreMovies additionne les stickers qui trouvent le même film', () => {
  const scored = scoreMovies(PLACED_2, POOLS);
  assert.deepEqual([...scored.get(1).matched].sort(), ['city_night', 'robot']);
  assert.ok(Math.abs(scored.get(1).score - (1.15 + (1 - 1 / 80))) < 1e-9);
  assert.ok(Math.abs(scored.get(2).score - ((1 - 1 / 80) + 1)) < 1e-9);
});

test('zéro sticker ne produit aucun film', () => {
  assert.deepEqual(selectMovies([], POOLS, [], ''), []);
});

test('un seul sticker donne trois évidents issus de la passe populaire', () => {
  const sel = selectMovies(PLACED_1, POOLS, [], KEY_1);
  assert.equal(sel.length, 6);
  assert.deepEqual(sel.slice(0, 3).map(e => e.movie.id), [1, 2, 3]);
  assert.deepEqual(sel.map(e => e.category), ['evident', 'evident', 'evident', 'surprise', 'surprise', 'unexpected']);
  for (const e of sel) assert.deepEqual(e.matched, ['city_night']);
});

test('deux stickers : les films trouvés par les deux passent devant', () => {
  const sel = selectMovies(PLACED_2, POOLS, [], KEY_2);
  assert.deepEqual(sel[0].movie.id, 1);
  assert.deepEqual(sel[1].movie.id, 2);
  assert.deepEqual(sel[0].matched, ['city_night', 'robot']);
  assert.deepEqual(sel[1].matched, ['city_night', 'robot']);
  assert.deepEqual(sel[0].ignored, []);
  assert.equal(sel[2].matched.length, 1);
  assert.equal(sel[2].movie.id, 6);
});

test('aucun film exclu ne ressort, aucun doublon', () => {
  for (const [placed, key] of [[PLACED_1, KEY_1], [PLACED_2, KEY_2]]) {
    const sel = selectMovies(placed, POOLS, [], key);
    const ids = sel.map(e => e.movie.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes(4));
    assert.ok(sel.length <= 6);
  }
});

test('même clé de graine, même sélection', () => {
  const a = selectMovies(PLACED_2, POOLS, [], KEY_2).map(e => e.movie.id + ':' + e.category);
  const b = selectMovies(PLACED_2, POOLS, [], KEY_2).map(e => e.movie.id + ':' + e.category);
  assert.deepEqual(a, b);
});

test('une clé de graine différente change les surprises', () => {
  const a = selectMovies(PLACED_1, POOLS, [], 'city_night:1.00').map(e => e.movie.id);
  const b = selectMovies(PLACED_1, POOLS, [], 'city_night:2.75').map(e => e.movie.id);
  assert.notDeepEqual(a.slice(3), b.slice(3));
});

test('les films déjà affichés gardent leur place', () => {
  const first = selectMovies(PLACED_2, POOLS, [], KEY_2);
  const previous = [first[1], first[0], ...first.slice(2)];
  const second = selectMovies(PLACED_2, POOLS, previous, KEY_2);
  assert.deepEqual(second.map(e => e.movie.id), previous.map(e => e.movie.id));
});

test('le film inattendu vient des rangs 10 à 20 de la passe estimée', () => {
  const sel = selectMovies(PLACED_1, POOLS, [], KEY_1);
  const last = sel[sel.length - 1];
  assert.equal(last.category, 'unexpected');
  const deepIds = POOLS.city_night.rated.slice(9, 20).map(m => m.id);
  assert.ok(deepIds.includes(last.movie.id), `${last.movie.id} hors des rangs 10 à 20`);
  assert.deepEqual(last.ignored, []);
});

test('explain nomme les stickers honorés et ignorés', () => {
  const sel = selectMovies(PLACED_2, POOLS, [], KEY_2);
  const both = explain(sel[0], PLACED_2);
  assert.deepEqual(both.honored.map(s => s.id), ['city_night', 'robot']);
  assert.deepEqual(both.ignored, []);
  assert.equal(both.sentence, 'Trouvé par 🌃 🤖');

  const one = explain({ movie: { id: 6 }, category: 'surprise', matched: ['city_night'], ignored: ['robot'] }, PLACED_2);
  assert.equal(one.sentence, 'Trouvé par 🌃, pas par 🤖');

  const aside = explain({ movie: { id: 9 }, category: 'unexpected', matched: ['city_night'], ignored: [] }, PLACED_2);
  assert.equal(aside.sentence, 'Pas de côté, trouvé par 🌃');
});

test('explain suit l\'ordre de la toile, pas celui des correspondances', () => {
  const reversed = [{ id: 'robot', scale: 1 }, { id: 'city_night', scale: 1 }];
  const out = explain({ movie: { id: 1 }, category: 'evident', matched: ['city_night', 'robot'], ignored: [] }, reversed);
  assert.deepEqual(out.honored.map(s => s.id), ['robot', 'city_night']);
  assert.equal(out.sentence, 'Trouvé par 🤖 🌃');
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

```bash
cd /Users/matt/Documents/Frame && node --test tests/engine.test.mjs
```

Attendu : échec, `Cannot find module '../src/engine.js'`.

- [ ] **Step 3 : Écrire `src/engine.js`**

```js
import { STICKER_BY_ID } from './stickers.js';

export const SCORE_RANK_SPAN = 80;
export const GENRE_BONUS = 0.15;
export const MIN_VOTE_AVERAGE = 5.5;
export const RESULT_COUNT = 6;

export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const weightOf = scale => Math.min(3, Math.max(0.5, Number(scale)));

export function scoreMovies(placed, pools) {
  const acc = new Map();
  for (const p of placed) {
    const pool = pools[p.id];
    if (!pool) continue;
    const w = weightOf(p.scale);
    const sticker = STICKER_BY_ID.get(p.id);
    const genres = (sticker && sticker.genres) || [];
    const best = new Map();
    for (const list of [pool.popular || [], pool.rated || []]) {
      list.forEach((movie, rank) => {
        const prev = best.get(movie.id);
        if (prev === undefined || rank < prev.rank) best.set(movie.id, { movie, rank });
      });
    }
    for (const { movie, rank } of best.values()) {
      if (Number(movie.vote_average) < MIN_VOTE_AVERAGE) continue;
      let entry = acc.get(movie.id);
      if (!entry) {
        entry = { movie, score: 0, matched: new Set(), bestRank: rank };
        acc.set(movie.id, entry);
      }
      entry.score += w * (1 - rank / SCORE_RANK_SPAN);
      if (genres.some(g => (movie.genre_ids || []).includes(g))) entry.score += GENRE_BONUS * w;
      entry.matched.add(p.id);
      if (rank < entry.bestRank) entry.bestRank = rank;
    }
  }
  return acc;
}

export function selectMovies(placed, pools, previous = [], seedKey = placed.map(p => p.id + ':' + p.scale).join('|')) {
  if (!placed.length) return [];
  const scored = scoreMovies(placed, pools);
  if (scored.size === 0) return [];
  const rng = createRng(hashString(seedKey));
  const order = placed.map(p => p.id);
  const taken = new Set();
  const picked = [];

  const makeEntry = (scoredEntry, category) => ({
    movie: scoredEntry.movie,
    category,
    matched: order.filter(id => scoredEntry.matched.has(id)),
    ignored: category === 'unexpected' ? [] : order.filter(id => !scoredEntry.matched.has(id))
  });
  const take = (scoredEntry, category) => {
    picked.push(makeEntry(scoredEntry, category));
    taken.add(scoredEntry.movie.id);
  };

  const byScore = [...scored.values()].sort((a, b) => b.score - a.score || a.movie.id - b.movie.id);

  for (const e of byScore) {
    if (picked.length >= 3) break;
    if (e.matched.size >= 2) take(e, 'evident');
  }
  for (const e of byScore) {
    if (picked.length >= 3) break;
    if (!taken.has(e.movie.id)) take(e, 'evident');
  }

  const byWeight = placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => weightOf(b.p.scale) - weightOf(a.p.scale) || a.i - b.i)
    .map(x => x.p);

  const pickRandom = list => list[Math.floor(rng() * list.length)];

  for (const p of byWeight) {
    if (picked.length >= 5) break;
    const pool = pools[p.id];
    if (!pool) continue;
    const candidates = (pool.rated || [])
      .map(m => scored.get(m.id))
      .filter(e => e && e.matched.size === 1 && !taken.has(e.movie.id))
      .sort((a, b) => b.score - a.score || a.movie.id - b.movie.id)
      .slice(0, 8);
    if (!candidates.length) continue;
    take(pickRandom(candidates), 'surprise');
    if (picked.length < 5) {
      const more = candidates.filter(e => !taken.has(e.movie.id));
      if (more.length) take(pickRandom(more), 'surprise');
    }
  }

  const rotation = [];
  const start = Math.floor(rng() * placed.length);
  for (let i = 0; i < placed.length; i++) rotation.push(placed[(start + i) % placed.length]);
  for (const p of rotation) {
    if (picked.length >= RESULT_COUNT) break;
    const pool = pools[p.id];
    if (!pool) continue;
    const deep = (pool.rated || []).slice(9, 20)
      .map(m => scored.get(m.id))
      .filter(e => e && !taken.has(e.movie.id));
    if (!deep.length) continue;
    take(pickRandom(deep), 'unexpected');
  }

  const slots = new Array(picked.length).fill(null);
  const leftovers = [];
  for (const entry of picked) {
    const at = previous.findIndex(prev => prev && prev.movie.id === entry.movie.id && prev.category === entry.category);
    if (at >= 0 && at < slots.length && slots[at] === null) slots[at] = entry;
    else leftovers.push(entry);
  }
  let cursor = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) slots[i] = leftovers[cursor++];
  }
  return slots;
}

export function explain(entry, placed) {
  const order = placed.map(p => p.id);
  const honored = order.filter(id => entry.matched.includes(id)).map(id => STICKER_BY_ID.get(id)).filter(Boolean);
  const ignored = order.filter(id => entry.ignored.includes(id)).map(id => STICKER_BY_ID.get(id)).filter(Boolean);
  const list = stickers => stickers.map(s => s.emoji).join(' ');
  let sentence;
  if (entry.category === 'unexpected') sentence = 'Pas de côté, trouvé par ' + list(honored);
  else if (!ignored.length) sentence = 'Trouvé par ' + list(honored);
  else sentence = 'Trouvé par ' + list(honored) + ', pas par ' + list(ignored);
  return { honored, ignored, sentence };
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

```bash
cd /Users/matt/Documents/Frame && node --test tests/engine.test.mjs
```

Attendu : `# pass 17`, `# fail 0`. Ces 17 cas ont été exécutés contre cette implémentation exacte le 14 septembre 2026 : ils passent tous.

- [ ] **Step 5 : Lancer la suite complète**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# fail 0` sur les cinq fichiers de test.

- [ ] **Step 6 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/engine.js tests/engine.test.mjs && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: moteur de score, sélection déterministe et explications

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 6 : Stockage local, client TMDB, client de démonstration

**Files:**
- Create: `/Users/matt/Documents/Frame/src/storage.js`
- Create: `/Users/matt/Documents/Frame/src/tmdb.js`
- Create: `/Users/matt/Documents/Frame/src/demo.js`
- Test: `/Users/matt/Documents/Frame/tests/storage.test.mjs`
- Test: `/Users/matt/Documents/Frame/tests/tmdb.test.mjs`

**Interfaces:**
- Consumes: `hashString` de `src/engine.js` (utilisé par `demo.js` seulement).
- Produces, `src/storage.js` :
  - `storage: { get(key, fallback), set(key, value): boolean, remove(key): boolean }` — préfixe `frame.`, sérialisation JSON, tout est enveloppé dans `try/catch`
  - `setStorageBackend(obj | null): void` — injection pour les tests ; `null` simule un navigateur sans `localStorage`
  - `loadCredential(): string`, `saveCredential(c): boolean`, `clearCredential(): boolean`
  - `loadBoards(): SavedBoard[]`, `saveBoard({ name, encoded }): SavedBoard` où `SavedBoard = { id: string, name: string, encoded: string, savedAt: number }`, `deleteBoard(id): SavedBoard[]`
  - `loadJournal(): JournalEntry[]`, `addJournalEntry({ encoded, movieId, title }): JournalEntry` où `JournalEntry = { encoded, movieId, title, at }`, plafonné à `JOURNAL_MAX = 500`
  - `getKeywordCache(): Record<string, number|null>`, `setKeywordId(name, id): Record<string, number|null>`
  - `hasSeenIntro(): boolean`, `markIntroSeen(): boolean`
  - `JOURNAL_MAX = 500`
- Produces, `src/tmdb.js` :
  - `API_BASE`, `IMAGE_BASE`, `POPULAR_PAGES = 3`, `POPULAR_MIN_VOTES = 100`, `RATED_MIN_VOTES = 300`, `PAGE_SIZE = 20`
  - `class TmdbError extends Error { status: number }` — `401` clé refusée, `429` quota, `0` réseau
  - `detectAuth(credential): 'bearer' | 'apikey' | null`
  - `createClient({ credential, fetchImpl = fetch })` → `{ auth, validate(), resolveKeyword(name), resolveSticker(sticker), discover({ keywordIds, sortBy, voteCountGte, page }), stickerPools(sticker), movieDetails(id), posterUrl, movieUrl }`
  - `posterUrl(path, size = 'w342'): string | null`, `movieUrl(id): string`
- Produces, `src/demo.js` :
  - `createDemoClient()` → objet de la même forme que `createClient(...)`, avec `auth: 'demo'`
  - `DEMO_POOLS: { city_night, robot, rain }`, chacun `{ popular: Movie[12], rated: Movie[12] }`

**Clés de localStorage, spec §7 :** `frame.tmdbKey`, `frame.kw`, `frame.boards`, `frame.journal`, `frame.seenIntro`.

- [ ] **Step 1 : Écrire `tests/storage.test.mjs`, qui échoue**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  storage, setStorageBackend, JOURNAL_MAX,
  loadCredential, saveCredential, clearCredential,
  loadBoards, saveBoard, deleteBoard,
  loadJournal, addJournalEntry,
  getKeywordCache, setKeywordId,
  hasSeenIntro, markIntroSeen
} from '../src/storage.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

test('storage préfixe toutes les clés par « frame. » et sérialise en JSON', () => {
  const backend = fakeStorage();
  setStorageBackend(backend);
  storage.set('essai', { a: 1 });
  assert.equal(backend.map.get('frame.essai'), '{"a":1}');
  assert.deepEqual(storage.get('essai', null), { a: 1 });
});

test('storage.get renvoie la valeur de repli si la clé manque', () => {
  setStorageBackend(fakeStorage());
  assert.equal(storage.get('absente', 'repli'), 'repli');
});

test('storage.get renvoie la valeur de repli si le JSON est corrompu', () => {
  setStorageBackend(fakeStorage({ 'frame.casse': '{pas du json' }));
  assert.equal(storage.get('casse', 'repli'), 'repli');
});

test('storage.remove efface la clé', () => {
  const backend = fakeStorage();
  setStorageBackend(backend);
  storage.set('essai', 1);
  storage.remove('essai');
  assert.equal(backend.map.has('frame.essai'), false);
});

test('storage survit à un magasin qui lance', () => {
  setStorageBackend({
    getItem() { throw new Error('refusé'); },
    setItem() { throw new Error('refusé'); },
    removeItem() { throw new Error('refusé'); }
  });
  assert.equal(storage.get('x', 'repli'), 'repli');
  assert.equal(storage.set('x', 1), false);
  assert.equal(storage.remove('x'), false);
});

test('storage survit à l\'absence totale de localStorage', () => {
  setStorageBackend(null);
  assert.equal(storage.get('x', 'repli'), 'repli');
  assert.equal(storage.set('x', 1), false);
  assert.equal(loadBoards().length, 0);
  assert.equal(loadJournal().length, 0);
  assert.deepEqual(getKeywordCache(), {});
  assert.equal(hasSeenIntro(), false);
});

test('identifiant TMDB : enregistrement, lecture, effacement', () => {
  const backend = fakeStorage();
  setStorageBackend(backend);
  assert.equal(loadCredential(), '');
  saveCredential('  abc123  ');
  assert.equal(loadCredential(), 'abc123');
  assert.equal(backend.map.has('frame.tmdbKey'), true);
  clearCredential();
  assert.equal(loadCredential(), '');
});

test('saveBoard crée un identifiant et un horodatage, les plus récents d\'abord', () => {
  setStorageBackend(fakeStorage());
  const before = Date.now();
  const a = saveBoard({ name: 'Nuit urbaine', encoded: 't=1.AAAA' });
  const b = saveBoard({ name: 'Forêt étrange', encoded: 't=1.BBBB' });
  assert.equal(typeof a.id, 'string');
  assert.ok(a.id.length > 0);
  assert.notEqual(a.id, b.id);
  assert.ok(a.savedAt >= before);
  assert.deepEqual(loadBoards().map(x => x.name), ['Forêt étrange', 'Nuit urbaine']);
});

test('deleteBoard retire le bon tableau', () => {
  setStorageBackend(fakeStorage());
  const a = saveBoard({ name: 'A', encoded: 't=1.A' });
  saveBoard({ name: 'B', encoded: 't=1.B' });
  const rest = deleteBoard(a.id);
  assert.deepEqual(rest.map(x => x.name), ['B']);
  assert.deepEqual(loadBoards().map(x => x.name), ['B']);
});

test('le journal empile en tête et plafonne à 500', () => {
  setStorageBackend(fakeStorage());
  for (let i = 0; i < JOURNAL_MAX + 25; i++) {
    addJournalEntry({ encoded: 't=1.X', movieId: i, title: 'Film ' + i });
  }
  const journal = loadJournal();
  assert.equal(journal.length, JOURNAL_MAX);
  assert.equal(journal[0].movieId, JOURNAL_MAX + 24);
  assert.equal(typeof journal[0].at, 'number');
});

test('le cache de mots-clés accumule les résolutions', () => {
  setStorageBackend(fakeStorage());
  assert.deepEqual(getKeywordCache(), {});
  setKeywordId('rain', 2217);
  setKeywordId('neon', 9822);
  assert.deepEqual(getKeywordCache(), { rain: 2217, neon: 9822 });
});

test('le cache de mots-clés mémorise aussi les introuvables', () => {
  setStorageBackend(fakeStorage());
  setKeywordId('mot inexistant', null);
  assert.equal(Object.prototype.hasOwnProperty.call(getKeywordCache(), 'mot inexistant'), true);
  assert.equal(getKeywordCache()['mot inexistant'], null);
});

test('l\'accueil ne se montre qu\'une fois', () => {
  setStorageBackend(fakeStorage());
  assert.equal(hasSeenIntro(), false);
  markIntroSeen();
  assert.equal(hasSeenIntro(), true);
});
```

- [ ] **Step 2 : Lancer et vérifier l'échec**

```bash
cd /Users/matt/Documents/Frame && node --test tests/storage.test.mjs
```

Attendu : échec, `Cannot find module '../src/storage.js'`.

- [ ] **Step 3 : Écrire `src/storage.js`**

```js
const PREFIX = 'frame.';
const JOURNAL_MAX = 500;

function defaultBackend() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

let backend = defaultBackend();

/** Remplace le magasin sous-jacent. Sert aux tests ; passer null simule l'absence de localStorage. */
export function setStorageBackend(obj) {
  backend = obj;
}

export const storage = {
  get(key, fallback) {
    try {
      if (!backend) return fallback;
      const raw = backend.getItem(PREFIX + key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (!backend) return false;
      backend.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      if (!backend) return false;
      backend.removeItem(PREFIX + key);
      return true;
    } catch {
      return false;
    }
  }
};

// ── Identifiant TMDB ────────────────────────────────────────────────────────
export function loadCredential() {
  const value = storage.get('tmdbKey', '');
  return typeof value === 'string' ? value : '';
}
export function saveCredential(credential) {
  return storage.set('tmdbKey', String(credential || '').trim());
}
export function clearCredential() {
  return storage.remove('tmdbKey');
}

// ── Tableaux sauvegardés ────────────────────────────────────────────────────
export function loadBoards() {
  const value = storage.get('boards', []);
  return Array.isArray(value) ? value : [];
}
export function saveBoard({ name, encoded }) {
  const entry = {
    id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    name: String(name || 'Sans titre').slice(0, 60),
    encoded: String(encoded || ''),
    savedAt: Date.now()
  };
  storage.set('boards', [entry, ...loadBoards()]);
  return entry;
}
export function deleteBoard(id) {
  const next = loadBoards().filter(b => b.id !== id);
  storage.set('boards', next);
  return next;
}

// ── Journal des chemins ─────────────────────────────────────────────────────
export function loadJournal() {
  const value = storage.get('journal', []);
  return Array.isArray(value) ? value : [];
}
export function addJournalEntry({ encoded, movieId, title }) {
  const entry = { encoded: String(encoded || ''), movieId: Number(movieId), title: String(title || ''), at: Date.now() };
  const next = [entry, ...loadJournal()].slice(0, JOURNAL_MAX);
  storage.set('journal', next);
  return entry;
}

// ── Cache des mots-clés TMDB ────────────────────────────────────────────────
export function getKeywordCache() {
  const value = storage.get('kw', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function setKeywordId(name, id) {
  const cache = getKeywordCache();
  cache[name] = id;
  storage.set('kw', cache);
  return cache;
}

// ── Accueil ─────────────────────────────────────────────────────────────────
export function hasSeenIntro() {
  return storage.get('seenIntro', false) === true;
}
export function markIntroSeen() {
  return storage.set('seenIntro', true);
}

export { JOURNAL_MAX };
```

- [ ] **Step 4 : Lancer et vérifier le succès**

```bash
cd /Users/matt/Documents/Frame && node --test tests/storage.test.mjs
```

Attendu : `# pass 13`, `# fail 0`. Ces 13 cas ont été exécutés contre cette implémentation exacte le 14 septembre 2026.

- [ ] **Step 5 : Écrire `tests/tmdb.test.mjs`, qui échoue**

Le faux `fetchImpl` enregistre chaque appel : c'est lui qui prouve la forme des URL, la présence ou l'absence de l'en-tête, l'arrêt anticipé des pages et l'efficacité du cache. Aucun appel réseau réel.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { setStorageBackend } from '../src/storage.js';
import {
  API_BASE, IMAGE_BASE, POPULAR_PAGES, POPULAR_MIN_VOTES, RATED_MIN_VOTES,
  TmdbError, detectAuth, createClient, posterUrl, movieUrl
} from '../src/tmdb.js';

const BEARER = 'eyJhbGciOiJIUzI1NiJ9.CeJetonEstFactice.0123456789abcdef';
const APIKEY = '0123456789abcdef0123456789abcdef';

function emptyStorage() {
  const map = new Map();
  setStorageBackend({
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); }
  });
  return map;
}

const movie = id => ({
  id, title: 'Film ' + id, original_title: 'Film ' + id, release_date: '2010-01-01',
  poster_path: '/p' + id + '.jpg', vote_average: 7, vote_count: 900,
  genre_ids: [18], overview: 'Résumé', popularity: 5
});

/** Faux fetch : enregistre chaque appel et répond selon le chemin. */
function makeFetch(routes) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const parsed = new URL(url);
    for (const [fragment, handler] of Object.entries(routes)) {
      if (parsed.pathname.includes(fragment)) {
        const body = typeof handler === 'function' ? handler(parsed, calls.length) : handler;
        return { ok: true, status: 200, json: async () => body };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  impl.calls = calls;
  impl.urls = () => calls.map(c => c.url);
  return impl;
}

const STICKER = { id: 'rain', emoji: '🌧️', label: 'Pluie', drawer: 'sky', keywords: ['rain', 'storm'] };

test('detectAuth reconnaît un jeton v4, une clé v3, et rien d\'autre', () => {
  assert.equal(detectAuth(BEARER), 'bearer');
  assert.equal(detectAuth(APIKEY), 'apikey');
  assert.equal(detectAuth(APIKEY.toUpperCase()), 'apikey');
  assert.equal(detectAuth('  ' + APIKEY + '  '), 'apikey');
  assert.equal(detectAuth(''), null);
  assert.equal(detectAuth('bonjour'), null);
  assert.equal(detectAuth(undefined), null);
  assert.equal(detectAuth('0123456789abcdef'), null);
});

test('un jeton v4 passe par l\'en-tête Authorization, jamais par l\'URL', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/configuration': { images: {} } });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.equal(client.auth, 'bearer');
  assert.equal(await client.validate(), true);
  const { url, options } = fetchImpl.calls[0];
  assert.ok(url.startsWith(API_BASE + '/configuration'));
  assert.equal(options.headers.Authorization, 'Bearer ' + BEARER);
  assert.ok(!url.includes('api_key'));
  const params = new URL(url).searchParams;
  assert.equal(params.get('language'), 'fr-FR');
  assert.equal(params.get('include_adult'), 'false');
});

test('une clé v3 passe par le paramètre api_key, sans en-tête Authorization', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/configuration': { images: {} } });
  const client = createClient({ credential: APIKEY, fetchImpl });
  assert.equal(client.auth, 'apikey');
  await client.validate();
  const { url, options } = fetchImpl.calls[0];
  assert.equal(new URL(url).searchParams.get('api_key'), APIKEY);
  assert.equal(options.headers.Authorization, undefined);
});

test('sans identifiant utilisable, toute requête lance un TmdbError 401', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({});
  const client = createClient({ credential: 'bonjour', fetchImpl });
  await assert.rejects(() => client.validate(), err => {
    assert.ok(err instanceof TmdbError);
    assert.equal(err.status, 401);
    return true;
  });
  assert.equal(fetchImpl.calls.length, 0);
});

test('une réponse 401 devient un TmdbError 401', async () => {
  emptyStorage();
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const client = createClient({ credential: BEARER, fetchImpl });
  await assert.rejects(() => client.validate(), err => err instanceof TmdbError && err.status === 401);
});

test('une réponse 429 devient un TmdbError 429', async () => {
  emptyStorage();
  const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const client = createClient({ credential: BEARER, fetchImpl });
  await assert.rejects(() => client.validate(), err => err instanceof TmdbError && err.status === 429);
});

test('une panne réseau devient un TmdbError de statut 0', async () => {
  emptyStorage();
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  const client = createClient({ credential: BEARER, fetchImpl });
  await assert.rejects(() => client.validate(), err => err instanceof TmdbError && err.status === 0);
});

test('resolveKeyword retient le nom exact, pas le premier résultat', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({
    '/search/keyword': { results: [{ id: 330913, name: 'heavy rain' }, { id: 2217, name: 'Rain' }] }
  });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.equal(await client.resolveKeyword('rain'), 2217);
  assert.equal(new URL(fetchImpl.urls()[0]).searchParams.get('query'), 'rain');
});

test('resolveKeyword se rabat sur le premier résultat', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/search/keyword': { results: [{ id: 42, name: 'rainy season' }] } });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.equal(await client.resolveKeyword('rain'), 42);
});

test('resolveKeyword renvoie null quand TMDB ne connaît pas le mot', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/search/keyword': { results: [] } });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.equal(await client.resolveKeyword('mot inexistant'), null);
});

test('resolveKeyword n\'interroge TMDB qu\'une fois par nom', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/search/keyword': { results: [{ id: 2217, name: 'rain' }] } });
  const client = createClient({ credential: BEARER, fetchImpl });
  await client.resolveKeyword('rain');
  await client.resolveKeyword('rain');
  assert.equal(fetchImpl.calls.length, 1);
});

test('resolveKeyword lit le cache du localStorage sans requête', async () => {
  const map = emptyStorage();
  map.set('frame.kw', JSON.stringify({ rain: 2217 }));
  const fetchImpl = makeFetch({ '/search/keyword': { results: [] } });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.equal(await client.resolveKeyword('rain'), 2217);
  assert.equal(fetchImpl.calls.length, 0);
});

test('resolveSticker écarte les mots-clés introuvables', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({
    '/search/keyword': parsed => parsed.searchParams.get('query') === 'rain'
      ? { results: [{ id: 2217, name: 'rain' }] }
      : { results: [] }
  });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.deepEqual(await client.resolveSticker(STICKER), [2217]);
});

test('discover construit l\'URL attendue', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/discover/movie': { page: 1, results: [], total_pages: 1, total_results: 0 } });
  const client = createClient({ credential: BEARER, fetchImpl });
  await client.discover({ keywordIds: [2217, 9822], sortBy: 'popularity.desc', voteCountGte: 100, page: 2 });
  const params = new URL(fetchImpl.urls()[0]).searchParams;
  assert.equal(params.get('with_keywords'), '2217|9822');
  assert.equal(params.get('sort_by'), 'popularity.desc');
  assert.equal(params.get('vote_count.gte'), '100');
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('language'), 'fr-FR');
  assert.equal(params.get('include_adult'), 'false');
});

test('stickerPools demande trois pages populaires et une page estimée', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({
    '/search/keyword': parsed => ({ results: [{ id: 1, name: parsed.searchParams.get('query') }] }),
    '/discover/movie': parsed => {
      const page = Number(parsed.searchParams.get('page'));
      const rated = parsed.searchParams.get('sort_by') === 'vote_average.desc';
      return {
        page,
        results: Array.from({ length: 20 }, (_, i) => movie((rated ? 9000 : 0) + page * 100 + i)),
        total_pages: 10,
        total_results: 200
      };
    }
  });
  const client = createClient({ credential: BEARER, fetchImpl });
  const pools = await client.stickerPools(STICKER);
  assert.equal(pools.popular.length, POPULAR_PAGES * 20);
  assert.equal(pools.rated.length, 20);
  const discoverUrls = fetchImpl.urls().filter(u => u.includes('/discover/movie'));
  assert.equal(discoverUrls.length, POPULAR_PAGES + 1);
  const votes = discoverUrls.map(u => new URL(u).searchParams.get('vote_count.gte'));
  assert.deepEqual(votes, [
    String(POPULAR_MIN_VOTES), String(POPULAR_MIN_VOTES), String(POPULAR_MIN_VOTES), String(RATED_MIN_VOTES)
  ]);
});

test('stickerPools s\'arrête après la page 1 si le vivier est maigre', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({
    '/search/keyword': parsed => ({ results: [{ id: 1, name: parsed.searchParams.get('query') }] }),
    '/discover/movie': parsed => {
      const rated = parsed.searchParams.get('sort_by') === 'vote_average.desc';
      return {
        page: 1,
        results: Array.from({ length: rated ? 4 : 12 }, (_, i) => movie((rated ? 9000 : 0) + i)),
        total_pages: 1,
        total_results: rated ? 4 : 12
      };
    }
  });
  const client = createClient({ credential: BEARER, fetchImpl });
  const pools = await client.stickerPools(STICKER);
  assert.equal(pools.popular.length, 12);
  assert.equal(pools.rated.length, 4);
  const discoverUrls = fetchImpl.urls().filter(u => u.includes('/discover/movie'));
  assert.equal(discoverUrls.length, 2);
});

test('stickerPools sans aucun mot-clé résolu renvoie des viviers vides sans discover', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/search/keyword': { results: [] } });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.deepEqual(await client.stickerPools(STICKER), { popular: [], rated: [] });
  assert.equal(fetchImpl.urls().filter(u => u.includes('/discover/movie')).length, 0);
});

test('stickerPools met en cache : un sticker déjà interrogé ne coûte plus rien', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({
    '/search/keyword': parsed => ({ results: [{ id: 1, name: parsed.searchParams.get('query') }] }),
    '/discover/movie': { page: 1, results: [movie(1)], total_pages: 1, total_results: 1 }
  });
  const client = createClient({ credential: BEARER, fetchImpl });
  await client.stickerPools(STICKER);
  const after = fetchImpl.calls.length;
  await client.stickerPools(STICKER);
  assert.equal(fetchImpl.calls.length, after);
});

test('movieDetails interroge /movie/<id> et met en cache', async () => {
  emptyStorage();
  const fetchImpl = makeFetch({ '/movie/': { id: 603, title: 'Matrix' } });
  const client = createClient({ credential: BEARER, fetchImpl });
  assert.equal((await client.movieDetails(603)).title, 'Matrix');
  await client.movieDetails(603);
  assert.equal(fetchImpl.calls.length, 1);
  assert.ok(fetchImpl.urls()[0].startsWith(API_BASE + '/movie/603'));
});

test('posterUrl et movieUrl', () => {
  assert.equal(posterUrl('/abc.jpg'), IMAGE_BASE + 'w342/abc.jpg');
  assert.equal(posterUrl('/abc.jpg', 'w780'), IMAGE_BASE + 'w780/abc.jpg');
  assert.equal(posterUrl(null), null);
  assert.equal(posterUrl(''), null);
  assert.equal(movieUrl(603), 'https://www.themoviedb.org/movie/603');
});
```

- [ ] **Step 6 : Lancer et vérifier l'échec**

```bash
cd /Users/matt/Documents/Frame && node --test tests/tmdb.test.mjs
```

Attendu : échec, `Cannot find module '../src/tmdb.js'`.

- [ ] **Step 7 : Écrire `src/tmdb.js`**

```js
import { getKeywordCache, setKeywordId } from './storage.js';

export const API_BASE = 'https://api.themoviedb.org/3';
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const POPULAR_PAGES = 3;
export const POPULAR_MIN_VOTES = 100;
export const RATED_MIN_VOTES = 300;
export const PAGE_SIZE = 20;

export class TmdbError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
  }
}

/** @returns {'bearer'|'apikey'|null} */
export function detectAuth(credential) {
  const value = String(credential || '').trim();
  if (/^eyJ[A-Za-z0-9._-]{20,}$/.test(value)) return 'bearer';
  if (/^[0-9a-fA-F]{32}$/.test(value)) return 'apikey';
  return null;
}

export function posterUrl(path, size = 'w342') {
  return path ? IMAGE_BASE + size + path : null;
}

export function movieUrl(id) {
  return 'https://www.themoviedb.org/movie/' + id;
}

export function createClient({ credential, fetchImpl = fetch }) {
  const auth = detectAuth(credential);
  const keywordMemory = new Map();
  const stickerKeywordMemory = new Map();
  const discoverMemory = new Map();
  const poolMemory = new Map();
  const detailsMemory = new Map();

  async function request(path, params = {}) {
    const url = new URL(API_BASE + path);
    url.searchParams.set('language', 'fr-FR');
    url.searchParams.set('include_adult', 'false');
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    const options = { headers: { accept: 'application/json' } };
    if (auth === 'bearer') options.headers.Authorization = 'Bearer ' + credential;
    else if (auth === 'apikey') url.searchParams.set('api_key', credential);
    else throw new TmdbError('Aucun identifiant TMDB utilisable', 401);

    let response;
    try {
      response = await fetchImpl(url.toString(), options);
    } catch (cause) {
      throw new TmdbError('Réseau indisponible', 0);
    }
    if (!response.ok) {
      throw new TmdbError('TMDB a répondu ' + response.status, response.status);
    }
    return response.json();
  }

  async function validate() {
    await request('/configuration');
    return true;
  }

  async function resolveKeyword(name) {
    if (keywordMemory.has(name)) return keywordMemory.get(name);
    const cached = getKeywordCache();
    if (Object.prototype.hasOwnProperty.call(cached, name)) {
      keywordMemory.set(name, cached[name]);
      return cached[name];
    }
    const data = await request('/search/keyword', { query: name, page: 1 });
    const results = Array.isArray(data.results) ? data.results : [];
    const exact = results.find(k => String(k.name).toLowerCase() === name.toLowerCase());
    const chosen = exact || results[0] || null;
    const id = chosen ? chosen.id : null;
    if (!chosen) console.warn('[FRAME] mot-clé TMDB introuvable :', name);
    keywordMemory.set(name, id);
    setKeywordId(name, id);
    return id;
  }

  async function resolveSticker(sticker) {
    if (stickerKeywordMemory.has(sticker.id)) return stickerKeywordMemory.get(sticker.id);
    const ids = [];
    for (const name of sticker.keywords) {
      const id = await resolveKeyword(name);
      if (typeof id === 'number') ids.push(id);
    }
    stickerKeywordMemory.set(sticker.id, ids);
    return ids;
  }

  async function discover({ keywordIds, sortBy, voteCountGte, page = 1 }) {
    const key = keywordIds.join('|') + '#' + sortBy + '#' + voteCountGte + '#' + page;
    if (discoverMemory.has(key)) return discoverMemory.get(key);
    const data = await request('/discover/movie', {
      with_keywords: keywordIds.join('|'),
      sort_by: sortBy,
      'vote_count.gte': voteCountGte,
      page
    });
    discoverMemory.set(key, data);
    return data;
  }

  async function stickerPools(sticker) {
    if (poolMemory.has(sticker.id)) return poolMemory.get(sticker.id);
    const keywordIds = await resolveSticker(sticker);
    if (!keywordIds.length) {
      const empty = { popular: [], rated: [] };
      poolMemory.set(sticker.id, empty);
      return empty;
    }
    const popular = [];
    const firstPage = await discover({ keywordIds, sortBy: 'popularity.desc', voteCountGte: POPULAR_MIN_VOTES, page: 1 });
    popular.push(...(firstPage.results || []));
    if ((firstPage.total_results || 0) >= PAGE_SIZE) {
      for (let page = 2; page <= POPULAR_PAGES; page++) {
        if (page > (firstPage.total_pages || 1)) break;
        const next = await discover({ keywordIds, sortBy: 'popularity.desc', voteCountGte: POPULAR_MIN_VOTES, page });
        const results = next.results || [];
        popular.push(...results);
        if (results.length < PAGE_SIZE) break;
      }
    }
    const ratedPage = await discover({ keywordIds, sortBy: 'vote_average.desc', voteCountGte: RATED_MIN_VOTES, page: 1 });
    const pools = { popular, rated: ratedPage.results || [] };
    poolMemory.set(sticker.id, pools);
    return pools;
  }

  async function movieDetails(id) {
    if (detailsMemory.has(id)) return detailsMemory.get(id);
    const data = await request('/movie/' + id);
    detailsMemory.set(id, data);
    return data;
  }

  return { auth, validate, resolveKeyword, resolveSticker, discover, stickerPools, movieDetails, posterUrl, movieUrl };
}
```

- [ ] **Step 8 : Lancer et vérifier le succès**

```bash
cd /Users/matt/Documents/Frame && node --test tests/tmdb.test.mjs
```

Attendu : `# pass 20`, `# fail 0`. Ces 20 cas ont été exécutés contre cette implémentation exacte le 14 septembre 2026.

- [ ] **Step 9 : Écrire `src/demo.js`**

Les films ci-dessous sont de vrais résultats TMDB relevés le 14 septembre 2026 pour les viviers de `city_night`, `robot` et `rain`. `Du rififi chez les hommes` a volontairement `poster_path: null` afin que la carte typographique soit exercée dès le mode démonstration.

```js
// Client TMDB simulé, branché par ?demo=1.
// Films réels relevés sur TMDB le 14 septembre 2026, puis figés : ce module
// ne fait aucune requête réseau et n'a besoin d'aucun identifiant.
import { hashString } from './engine.js';
import { posterUrl, movieUrl } from './tmdb.js';

const OVERVIEW = 'Mode démonstration : les données de ce film sont figées dans l\'application.';

// [id, titre, date de sortie, note, votes, genres, affiche]
const mk = ([id, title, release_date, vote_average, vote_count, genre_ids, poster_path]) => ({
  id, title, original_title: title, release_date, vote_average, vote_count,
  genre_ids, poster_path, popularity: 10, overview: OVERVIEW
});

const CITY_NIGHT_POPULAR = [
  [414906, 'The Batman', '2022-03-01', 7.7, 12495, [80, 9648, 53], '/t9JGg10CW1DzXEdWL54ewkUko6N.jpg'],
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [103, 'Taxi Driver', '1976-02-09', 8.1, 13778, [80, 18], '/iyHQrfNsjZlfHJ8hyhNi0yAFnZa.jpg'],
  [18, 'Le Cinquième Élément', '1997-05-02', 7.6, 12133, [878, 28, 12], '/8nx8sttha1Zidt73SbNncVfSwqk.jpg'],
  [4982, 'American Gangster', '2007-11-02', 7.6, 6225, [18, 80], '/bHyjYV26VTHQwzl8QiZ5IbuI7Qz.jpg'],
  [495764, 'Birds of Prey', '2020-02-05', 6.9, 10988, [28, 80], '/14DRJrjIzUE1ZtExRwTP0wOhPwG.jpg'],
  [2832, 'Identity', '2003-04-25', 7.2, 4523, [9648, 53], '/jSSgqRcLaDLh56t5ko1ywAKq0q9.jpg'],
  [627, 'Trainspotting', '1996-02-23', 8.0, 10651, [18, 80], '/wSjSdfnVjD6r8Fnn0K8FXz3JciM.jpg'],
  [1538, 'Collatéral', '2004-08-04', 7.2, 6479, [18, 80, 53], '/x6OIJWkwe6Kj4pQXTkhhBb7gluA.jpg'],
  [6075, 'L\'Impasse', '1993-11-10', 7.8, 3578, [80, 18, 53], '/cjki1jkGhrDhs9ir1dV7qsCqeXz.jpg'],
  [934, 'Du rififi chez les hommes', '1955-04-13', 7.8, 656, [80, 53, 18], null],
  [12153, 'F.B.I. Fausses Blondes Infiltrées', '2004-06-23', 7.0, 4742, [35, 80], '/PedA5zKb8Y3nZEHPGx9LwGlfPx.jpg']
].map(mk);

const CITY_NIGHT_RATED = [
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [103, 'Taxi Driver', '1976-02-09', 8.1, 13778, [80, 18], '/iyHQrfNsjZlfHJ8hyhNi0yAFnZa.jpg'],
  [548, 'Rashōmon', '1950-08-26', 8.0, 2602, [80, 18, 9648], '/zqc86MkNP2382tiXtBE1jn0XW7V.jpg'],
  [437068, 'A Taxi Driver', '2017-08-02', 8.0, 1220, [28, 18, 36], '/5n7sbyS3QTIIZ1epq7QiNxUwWpK.jpg'],
  [568160, 'Les Enfants du temps', '2019-07-19', 8.0, 2709, [16, 18, 14, 10749], '/aaA9BMG4fvq9KCLz3W4iVcAWRcU.jpg'],
  [627, 'Trainspotting', '1996-02-23', 8.0, 10651, [18, 80], '/wSjSdfnVjD6r8Fnn0K8FXz3JciM.jpg'],
  [31414, 'Le Tango de Satan', '1994-04-28', 8.0, 321, [18], '/hySy5g6xncM3U1iRsdPgYyahXM0.jpg'],
  [6075, 'L\'Impasse', '1993-11-10', 7.8, 3578, [80, 18, 53], '/cjki1jkGhrDhs9ir1dV7qsCqeXz.jpg'],
  [934, 'Du rififi chez les hommes', '1955-04-13', 7.8, 656, [80, 53, 18], null],
  [277216, 'N.W.A : Straight Outta Compton', '2015-08-11', 7.8, 4293, [18, 10402, 36], '/kyBVUPrCM2QSCZw6paGs0MLAufL.jpg'],
  [5991, 'Le Dernier des hommes', '1924-12-23', 7.8, 364, [18], '/wmUD851eeiRE0QMUUgYuko1wun1.jpg'],
  [779047, 'Nous, toujours', '2021-03-03', 7.8, 356, [16, 18, 10751, 10749], '/gnbbSTsltQZdq61tDVyqFAJXs6N.jpg']
].map(mk);

const ROBOT_POPULAR = [
  [218, 'Terminator', '1984-10-26', 7.7, 15102, [28, 53, 878], '/oShNrYScpLBi4pyOjytPy9BerRr.jpg'],
  [1184918, 'Le Robot sauvage', '2024-09-12', 8.3, 6583, [10751, 16, 878, 12], '/2IUCa73cvvIgZSiJcNtPBf4L5iF.jpg'],
  [603, 'Matrix', '1999-03-31', 8.3, 28707, [28, 878], '/pEoqbqtLc4CcwDUDqxmEDSWpWTZ.jpg'],
  [99861, 'Avengers : L\'Ère d\'Ultron', '2015-04-22', 7.3, 25011, [28, 12, 878], '/A0tw88n1byyR2vodhJMlFPQGQgF.jpg'],
  [11, 'La Guerre des étoiles', '1977-05-25', 8.2, 22854, [12, 28, 878], '/qelTNHrBSYjPvwdzsDBPVsqnNzc.jpg'],
  [280, 'Terminator 2 : Le Jugement dernier', '1991-07-03', 8.2, 14826, [28, 53, 878], '/mRtFOHF93zW4kTp4JOYrH71vxBh.jpg'],
  [335984, 'Blade Runner 2049', '2017-10-04', 7.6, 15657, [878, 18], '/qWD9E0Wgn8w6nMMutCNFAUiSHrX.jpg'],
  [177572, 'Les Nouveaux Héros', '2014-10-24', 7.7, 16909, [12, 10751, 16, 28, 35], '/wu361kPckigxzW19qtUbpCDzg0f.jpg'],
  [10681, 'WALL·E', '2008-06-26', 8.1, 20851, [16, 10751, 878], '/4ImYwxnu4bOitzS9TDLnantF8mn.jpg'],
  [348, 'Alien, le huitième passager', '1979-05-25', 8.2, 16832, [27, 878], '/l8CES84JndFlNfBNMxdLRYaLvI6.jpg'],
  [39254, 'Real Steel', '2011-09-28', 7.1, 9536, [28, 878, 18], '/ebV1lxTaLBS1Vk1ihHCVhhdg03X.jpg'],
  [1307118, 'Soulm8te', '2026-07-31', 7.4, 323, [27, 878, 53], '/bNErActDctl6cdUGw9pnjSCmyhQ.jpg']
].map(mk);

const ROBOT_RATED = [
  [1891, 'L\'Empire contre-attaque', '1980-05-20', 8.4, 18839, [12, 28, 878], '/qDvctAykmNWAmi9G2GrVrwWx3pr.jpg'],
  [1184918, 'Le Robot sauvage', '2024-09-12', 8.3, 6583, [10751, 16, 878, 12], '/2IUCa73cvvIgZSiJcNtPBf4L5iF.jpg'],
  [603, 'Matrix', '1999-03-31', 8.3, 28707, [28, 878], '/pEoqbqtLc4CcwDUDqxmEDSWpWTZ.jpg'],
  [11, 'La Guerre des étoiles', '1977-05-25', 8.2, 22854, [12, 28, 878], '/qelTNHrBSYjPvwdzsDBPVsqnNzc.jpg'],
  [348, 'Alien, le huitième passager', '1979-05-25', 8.2, 16832, [27, 878], '/l8CES84JndFlNfBNMxdLRYaLvI6.jpg'],
  [280, 'Terminator 2 : Le Jugement dernier', '1991-07-03', 8.2, 14826, [28, 53, 878], '/mRtFOHF93zW4kTp4JOYrH71vxBh.jpg'],
  [10681, 'WALL·E', '2008-06-26', 8.1, 20851, [16, 10751, 878], '/4ImYwxnu4bOitzS9TDLnantF8mn.jpg'],
  [19, 'Metropolis', '1927-01-10', 8.1, 3195, [18, 878], '/vHDWZOpupmKB7iNuiWFqnUSjfmN.jpg'],
  [679, 'Aliens, le retour', '1986-07-18', 8.0, 11171, [28, 53, 878], '/3eHFrdmBENZMbutlNMguqTAl3bf.jpg'],
  [10386, 'Le Géant de fer', '1999-08-06', 8.0, 6361, [16, 18, 10751, 878, 12], '/yNN7ViuLLEtobKpbVKhiKmu8FNg.jpg'],
  [838240, 'Mon ami robot', '2023-12-06', 8.0, 844, [16, 18, 35, 878], '/52a74RxIaYgdZxUoe0SxcUa2Vy7.jpg'],
  [755812, 'Miraculous World : New York', '2020-09-25', 8.1, 1135, [16, 10751, 28, 12], '/kIHgjAkuzvKBnmdstpBOo4AfZah.jpg']
].map(mk);

const RAIN_POPULAR = [
  [155, 'The Dark Knight : Le Chevalier noir', '2008-07-16', 8.5, 36686, [28, 53], '/pyNXnq8QBWoK3b37RS6C3axwUOy.jpg'],
  [414906, 'The Batman', '2022-03-01', 7.7, 12495, [80, 9648, 53], '/t9JGg10CW1DzXEdWL54ewkUko6N.jpg'],
  [680, 'Pulp Fiction', '1994-09-10', 8.5, 30854, [53, 80, 35], '/4TBdF7nFw2aKNM0gPOlDNq3v3se.jpg'],
  [807, 'Seven', '1995-09-22', 8.4, 23758, [80, 9648, 53], '/to6jUaLJonMuKW2YovtWfQKtLYP.jpg'],
  [11324, 'Shutter Island', '2010-02-14', 8.2, 26410, [18, 53, 9648], '/fQ0vGVTtxjCdAJnxwPZ88O3Wzrh.jpg'],
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [127585, 'X-Men : Days of Future Past', '2014-05-15', 7.5, 16644, [28, 12, 878], '/zGSi4NG7SfyILp3SOfBgVo4VoWG.jpg'],
  [603692, 'John Wick : Chapitre 4', '2023-03-21', 7.7, 8283, [28, 53, 80], '/n1YTIyhAqqqFyDGFTzV7WaU1JfK.jpg'],
  [101, 'Léon', '1994-09-14', 8.3, 16500, [80, 18, 28], '/efqJtlo5J1hBNFmbwyjyAR9Mpr2.jpg'],
  [546554, 'À couteaux tirés', '2019-11-27', 7.8, 14473, [35, 80, 9648], '/4kxVUW4hMurLs7ascwahF7blEUs.jpg'],
  [414419, 'Kill Bill : The Whole Bloody Affair', '2011-03-27', 8.1, 1418, [28, 80, 18, 53], '/nSOJfWJCdVFZQwXQA7RXn7FIIiY.jpg'],
  [105864, 'Le Voyage d\'Arlo', '2015-11-14', 6.8, 6147, [12, 16, 10751], '/vvYCGP9ePgSlNXy4lyJSBMClKbA.jpg']
].map(mk);

const RAIN_RATED = [
  [155, 'The Dark Knight : Le Chevalier noir', '2008-07-16', 8.5, 36686, [28, 53], '/pyNXnq8QBWoK3b37RS6C3axwUOy.jpg'],
  [680, 'Pulp Fiction', '1994-09-10', 8.5, 30854, [53, 80, 35], '/4TBdF7nFw2aKNM0gPOlDNq3v3se.jpg'],
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [807, 'Seven', '1995-09-22', 8.4, 23758, [80, 9648, 53], '/to6jUaLJonMuKW2YovtWfQKtLYP.jpg'],
  [274, 'Le Silence des agneaux', '1991-02-14', 8.3, 18491, [80, 53, 18], '/sSQDxwm4r28YpJSQVyVOtpYVs0E.jpg'],
  [101, 'Léon', '1994-09-14', 8.3, 16500, [80, 18, 28], '/efqJtlo5J1hBNFmbwyjyAR9Mpr2.jpg'],
  [670, 'Old Boy', '2003-11-21', 8.2, 10190, [53, 9648], '/u0Ct3708zXaoJCkF65bLfenQmhM.jpg'],
  [11324, 'Shutter Island', '2010-02-14', 8.2, 26410, [18, 53, 9648], '/fQ0vGVTtxjCdAJnxwPZ88O3Wzrh.jpg'],
  [77, 'Memento', '2000-10-11', 8.2, 16742, [9648, 53], '/nK3cJaUWx1iaQ9Cs08JPtZqVzQ6.jpg'],
  [629, 'Usual Suspects', '1995-07-19', 8.2, 11727, [18, 80, 53], '/h06jDZB4Y9YQJiSGTcUwbhuiUrB.jpg'],
  [29259, 'Le Trou', '1960-03-18', 8.2, 599, [18, 53, 80], '/pyCMEIAtMPpWTVwZTajcbCIBI3u.jpg'],
  [426, 'Sueurs froides', '1958-05-28', 8.1, 6495, [9648, 10749, 53], '/hkhbbSQdsV3U0HtuPugHfx2wOi9.jpg']
].map(mk);

const DEMO_POOLS = {
  city_night: { popular: CITY_NIGHT_POPULAR, rated: CITY_NIGHT_RATED },
  robot: { popular: ROBOT_POPULAR, rated: ROBOT_RATED },
  rain: { popular: RAIN_POPULAR, rated: RAIN_RATED }
};

const ALL_MOVIES = [...new Map(
  [...CITY_NIGHT_POPULAR, ...CITY_NIGHT_RATED, ...ROBOT_POPULAR, ...ROBOT_RATED, ...RAIN_POPULAR, ...RAIN_RATED]
    .map(m => [m.id, m])
).values()];

/** Tout sticker hors des trois viviers figés reçoit une rotation déterministe du catalogue. */
function fallbackPool(stickerId) {
  const offset = hashString(stickerId) % ALL_MOVIES.length;
  const rotated = [...ALL_MOVIES.slice(offset), ...ALL_MOVIES.slice(0, offset)];
  return { popular: rotated.slice(0, 12), rated: [...rotated].reverse().slice(0, 12) };
}

export function createDemoClient() {
  return {
    auth: 'demo',
    async validate() { return true; },
    async resolveKeyword() { return 1; },
    async resolveSticker() { return [1]; },
    async discover() { return { page: 1, results: [], total_pages: 1, total_results: 0 }; },
    async stickerPools(sticker) { return DEMO_POOLS[sticker.id] || fallbackPool(sticker.id); },
    async movieDetails(id) {
      return ALL_MOVIES.find(m => m.id === Number(id)) || { id: Number(id), title: 'Film inconnu', overview: OVERVIEW, genres: [] };
    },
    posterUrl,
    movieUrl
  };
}

export { DEMO_POOLS };
```

- [ ] **Step 10 : Vérifier le client de démonstration de bout en bout**

```bash
cd /Users/matt/Documents/Frame && node --input-type=module -e "
import { createDemoClient } from './src/demo.js';
import { STICKERS } from './src/stickers.js';
import { selectMovies, explain } from './src/engine.js';
const client = createDemoClient();
const placed = [{ id: 'city_night', scale: 1 }, { id: 'rain', scale: 2 }, { id: 'robot', scale: 1 }];
const pools = {};
for (const p of placed) pools[p.id] = await client.stickerPools(STICKERS.find(s => s.id === p.id));
const sel = selectMovies(placed, pools, [], placed.map(p => p.id + ':' + p.scale.toFixed(2)).join('|'));
for (const e of sel) console.log(e.category.padEnd(11), e.movie.title, '—', explain(e, placed).sentence);
const fb = await client.stickerPools({ id: 'forest' });
console.log('repli forest :', fb.popular.length, fb.rated.length);
"
```

Attendu, exactement (sortie relevée le 14 septembre 2026) :

```
evident     The Batman — Trouvé par 🌃 🌧️, pas par 🤖
evident     Le Château ambulant — Trouvé par 🌃 🌧️, pas par 🤖
evident     The Dark Knight : Le Chevalier noir — Trouvé par 🌧️, pas par 🌃 🤖
surprise    Seven — Trouvé par 🌧️, pas par 🌃 🤖
surprise    Shutter Island — Trouvé par 🌧️, pas par 🌃 🤖
unexpected  Le Dernier des hommes — Pas de côté, trouvé par 🌃
repli forest : 12 12
```

- [ ] **Step 11 : Lancer la suite complète**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# fail 0` sur les sept fichiers de test.

- [ ] **Step 12 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/storage.js src/tmdb.js src/demo.js tests/storage.test.mjs tests/tmdb.test.mjs && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: stockage local, client TMDB et client de démonstration

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 7 : La toile

Tâche d'interface. Le plan fixe la structure DOM, les noms de classes, les dimensions, les signatures et la liste exhaustive des gestionnaires d'événements. Le corps des fonctions et le détail des règles CSS sont écrits par l'implémenteur, avec les jetons de `styles/tokens.css` et rien d'autre.

**Files:**
- Create: `/Users/matt/Documents/Frame/src/canvas.js`
- Modify: `/Users/matt/Documents/Frame/styles/canvas.css` (remplace le fichier d'attente de la tâche 1)

**Interfaces:**
- Consumes: `STICKER_BY_ID`, `twemojiUrl` de `src/stickers.js` ; `moveSticker`, `scaleSticker`, `flipSticker`, `removeSticker`, `bringToFront`, `SCALE_MIN`, `SCALE_MAX` de `src/board.js`.
- Produces :
  - `createCanvas(rootEl, { onChange, onSelect }): CanvasHandle`
    - `onChange(board, { commit })` — appelé à chaque modification. `commit: false` pendant un geste continu (glissement, pincement, molette) ; `commit: true` quand le geste se termine ou pour une action discrète (retourner, supprimer, mettre devant, pas clavier). `app.js` n'empile un état d'annulation que sur `commit: true`.
    - `onSelect(index)` — index du sticker sélectionné, ou `-1` pour aucune sélection.
    - `CanvasHandle = { setBoard(board): void, getBoard(): Board, select(index): void, destroy(): void }`
  - `SCALE_STEP = 0.25` — pas des boutons d'agrandissement et des touches `+` / `-`
  - `MOVE_STEP = 0.02`, `MOVE_STEP_BIG = 0.10` — pas des flèches, avec et sans `Maj`

**Structure DOM construite par `createCanvas` dans `rootEl` (`#canvas-host`) :**

```html
<div class="canvas" id="canvas" tabindex="-1">
  <div class="canvas__atmosphere" aria-hidden="true"></div>
  <canvas class="canvas__particles" aria-hidden="true"></canvas>
  <div class="canvas__grain" aria-hidden="true"></div>
  <div class="canvas__vignette" aria-hidden="true"></div>
  <div class="canvas__stickers">
    <!-- un bouton par sticker posé, dans l'ordre de profondeur -->
    <button class="sticker" type="button"
            data-index="0"
            style="--x:50%; --y:50%; --scale:1; --flip:1;"
            aria-label="ville la nuit, sticker 1 sur 3"
            aria-pressed="false">
      <img class="sticker__img" src="…1f303.svg" alt="" draggable="false" loading="lazy">
    </button>
  </div>
  <div class="canvas__toolbar" id="canvas-toolbar" role="toolbar" aria-label="Actions du sticker" hidden>
    <button class="canvas__tool" type="button" data-action="grow"   aria-label="Agrandir">+</button>
    <button class="canvas__tool" type="button" data-action="shrink" aria-label="Réduire">−</button>
    <button class="canvas__tool" type="button" data-action="flip"   aria-label="Retourner">⇄</button>
    <button class="canvas__tool" type="button" data-action="front"  aria-label="Mettre devant">▲</button>
    <button class="canvas__tool" type="button" data-action="remove" aria-label="Supprimer">✕</button>
  </div>
  <p class="canvas__hint" id="canvas-hint">Pose un sticker, les films arrivent.</p>
  <p class="canvas__sr sr-only" id="canvas-sr" aria-live="polite"></p>
</div>
```

Règles non négociables sur cette structure :
- `.canvas__sr` contient la liste textuelle des stickers posés, dans l'ordre de la toile, séparés par « , » : par exemple `pluie, ville la nuit, robot`. Vide quand la toile est vide.
- Le libellé accessible d'un sticker est exactement `` `${label en minuscules}, sticker ${index + 1} sur ${total}` ``.
- L'ordre des `<button class="sticker">` dans le DOM est l'ordre de profondeur du modèle : le dernier est devant. Aucun `z-index` par sticker.
- `.canvas__hint` n'est visible que lorsque la toile est vide.
- Les variables d'instance `--x`, `--y`, `--scale`, `--flip` portent la position : `--flip` vaut `1` ou `-1` et alimente `scaleX()`.

**`styles/canvas.css` — ce qui est fixé :**

- `.canvas` : `position: relative; aspect-ratio: 1 / 1; width: 100%; max-width: var(--canvas-max-phone); margin-inline: auto; border-radius: var(--r-lg); overflow: hidden; background: var(--c-surface); touch-action: none; user-select: none; -webkit-user-select: none; isolation: isolate;`. À partir de `@media (min-width: 900px)` : `max-width: var(--canvas-max-desk);`.
- `.canvas__atmosphere`, `.canvas__particles`, `.canvas__grain`, `.canvas__vignette` : `position: absolute; inset: 0; pointer-events: none;`. Ordre de superposition par l'ordre du DOM : atmosphère, particules, grain, vignettage, puis stickers.
- `.canvas__atmosphere` : `background: var(--atmo-tint, transparent); opacity: var(--atmo-intensity, 0); mix-blend-mode: soft-light; transition: opacity var(--d-slow) var(--e-out), background-color var(--d-slow) var(--e-out);`. `--atmo-tint` et `--atmo-intensity` sont posées en JS sur `.canvas`.
- `.canvas__vignette` : dégradé radial du transparent vers `rgba(0,0,0,0.55)` aux bords ; `.canvas__grain` : motif SVG de bruit inline en `background-image`, `opacity: 0.04`.
- `.canvas__stickers` : `position: absolute; inset: 0;`.
- `.sticker` : `position: absolute; left: var(--x); top: var(--y); width: calc(64px * var(--scale)); height: calc(64px * var(--scale)); transform: translate(-50%, -50%) scaleX(var(--flip)); padding: 0; border: 0; background: none; cursor: grab; touch-action: none; filter: drop-shadow(var(--sh-sticker)); transition: filter var(--d-fast) var(--e-out);`. La taille de base est **64 px** : un sticker à `scale: 3` fait 192 px, un sticker à `scale: 0.5` fait 32 px.
- `.sticker[aria-pressed="true"]` : halo de sélection par `outline: 2px solid var(--c-accent); outline-offset: 4px; border-radius: var(--r-full);`.
- `.sticker.is-dragging` : `cursor: grabbing; filter: drop-shadow(var(--sh-raised));` et aucune transition de position.
- `.sticker.is-leaving` : `opacity: 0.35; filter: grayscale(1) drop-shadow(var(--sh-sticker));` — retour visuel du geste de suppression par glissement hors de la toile.
- `.sticker.is-landing` : animation d'entrée depuis le tiroir, `220ms` avec `var(--e-spring)`, opacité 0 → 1 et échelle 0,6 → 1.
- `.canvas__toolbar` : `position: absolute; display: flex; gap: var(--sp-1); padding: var(--sp-1); background: var(--c-raised); border: 1px solid var(--c-line-strong); border-radius: var(--r-full); box-shadow: var(--sh-raised); z-index: var(--z-canvas-tool);` ; positionnée en JS par `left`/`top` en pourcentage, en restant dans la toile.
- `.canvas__tool` : `width: var(--hit-min); height: var(--hit-min); border: 0; border-radius: var(--r-full); background: transparent; color: var(--c-text);` ; survol `background: var(--c-surface)` ; l'action `remove` prend `color: var(--c-error)`.
- `.canvas__hint` : centrée, `color: var(--c-text-dim); font-size: var(--fs-md); text-align: center; padding-inline: var(--gutter);`.
- `@media (prefers-reduced-motion: reduce)` : `.sticker.is-landing { animation: none; }` et aucune transition de position ; les particules deviennent une texture statique (voir ci-dessous).

**Squelette de `src/canvas.js` :**

```js
import { STICKER_BY_ID, twemojiUrl } from './stickers.js';
import {
  moveSticker, scaleSticker, flipSticker, removeSticker, bringToFront,
  SCALE_MIN, SCALE_MAX
} from './board.js';

export const SCALE_STEP = 0.25;
export const MOVE_STEP = 0.02;
export const MOVE_STEP_BIG = 0.10;
const BASE_SIZE = 64;          // px, taille d'un sticker à scale 1
const DRAG_OUT_MARGIN = 0.12;  // fraction hors toile au-delà de laquelle on supprime

export function createCanvas(rootEl, { onChange, onSelect }) {
  // état interne : board courant, index sélectionné, pointeurs actifs, id d'animation
  // 1. buildDom(rootEl) → références { canvas, atmosphere, particles, stickers, toolbar, hint, sr }
  // 2. render() → synchronise le DOM avec le board (réutilise les boutons existants, n'en recrée pas à chaque image)
  // 3. renderAtmosphere() → cumule les atmosphères des stickers posés (voir plus bas)
  // 4. renderToolbar() → place la barre près du sticker sélectionné, ou la masque
  // 5. renderSr() → met à jour la liste textuelle
  // 6. particules → boucle requestAnimationFrame sur le <canvas>, arrêtée dès qu'aucune atmosphère n'a de particules
  return { setBoard, getBoard, select, destroy };
}
```

**Gestionnaires d'événements, un par un.** Chacun est enregistré dans `createCanvas` et retiré dans `destroy()`.

1. `stickersEl.addEventListener('pointerdown', onPointerDown)` — sur un `.sticker` : `event.preventDefault()`, `target.setPointerCapture(event.pointerId)`, enregistre le pointeur dans une `Map<pointerId, { index, startX, startY, startItemX, startItemY }>`, sélectionne l'index, ajoute `is-dragging`. Si c'est le **deuxième** pointeur sur le même sticker, bascule en mode pincement et mémorise la distance initiale et l'échelle initiale.
2. `stickersEl.addEventListener('pointermove', onPointerMove)` — un pointeur : convertit la position en coordonnées 0–1 relatives au rectangle de `.canvas`, appelle `moveSticker`, `onChange(board, { commit: false })`. Deux pointeurs : calcule le rapport des distances, appelle `scaleSticker(board, index, startScale * ratio)`, `onChange(board, { commit: false })`. Si le pointeur sort du rectangle de plus de `DRAG_OUT_MARGIN`, ajoute `is-leaving` sur le sticker ; sinon retire la classe.
3. `stickersEl.addEventListener('pointerup', onPointerUp)` — libère la capture, retire `is-dragging`. Si `is-leaving` est présent : `removeSticker` puis `onChange(board, { commit: true })` et `select(-1)`. Sinon `onChange(board, { commit: true })`.
4. `stickersEl.addEventListener('pointercancel', onPointerCancel)` — même nettoyage que `pointerup`, mais sans suppression : le sticker revient à sa dernière position validée.
5. `stickersEl.addEventListener('wheel', onWheel, { passive: false })` — sur un `.sticker` : `event.preventDefault()`, `scaleSticker(board, index, item.scale - Math.sign(event.deltaY) * SCALE_STEP)`, `onChange(board, { commit: true })`.
6. `stickersEl.addEventListener('dblclick', onDoubleClick)` — sur un `.sticker` : `flipSticker`, `onChange(board, { commit: true })`.
7. `stickersEl.addEventListener('click', onClick)` — sur un `.sticker` : sélectionne l'index sans rien modifier (chemin sans glissement, exigé pour l'accessibilité) ; si un glissement vient d'avoir lieu (déplacement supérieur à 4 px), ignore le clic.
8. `toolbarEl.addEventListener('click', onToolbarClick)` — lit `data-action` : `grow` → `scaleSticker(+SCALE_STEP)` ; `shrink` → `scaleSticker(-SCALE_STEP)` ; `flip` → `flipSticker` ; `front` → `bringToFront` puis la sélection suit le sticker déplacé en fin de liste ; `remove` → `removeSticker` puis `select(-1)`. Chaque action appelle `onChange(board, { commit: true })`.
9. `canvasEl.addEventListener('keydown', onKeyDown)` — sticker sélectionné :
   - `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` : `moveSticker` d'un pas `MOVE_STEP`, ou `MOVE_STEP_BIG` si `event.shiftKey`. `commit: true`.
   - `+`, `=` : agrandir de `SCALE_STEP`. `-`, `_` : réduire de `SCALE_STEP`. `commit: true`.
   - `r`, `R` : `flipSticker`. `commit: true`.
   - `Delete`, `Backspace` : `removeSticker`, puis `select(-1)`. `commit: true`.
   - `Escape` : `select(-1)`, ne modifie pas le tableau.
   - Ne jamais intercepter `Tab` : la navigation entre stickers se fait par l'ordre de tabulation naturel des `<button class="sticker">`.
   - Appeler `event.preventDefault()` uniquement sur les touches traitées.
10. `stickersEl.addEventListener('focusin', onFocusIn)` — met `select(index)` en accord avec le sticker qui reçoit le focus, pour que la barre d'outils suive le clavier.
11. `canvasEl.addEventListener('pointerdown', onBackdropDown)` — un appui sur le fond, hors d'un `.sticker` et hors de la barre, appelle `select(-1)`.
12. `window.addEventListener('resize', onResize)` — redimensionne le `<canvas class="canvas__particles">` à la taille réelle de la toile, multipliée par `devicePixelRatio`, et repositionne la barre d'outils.

**Atmosphères, spec §3.3.** `renderAtmosphere()` parcourt les stickers posés, garde ceux qui ont `sticker.atmosphere`, et cumule :
- Teinte : moyenne des `tint` pondérée par `intensity × scale`, posée sur `--atmo-tint`.
- Intensité : `Math.min(0.45, somme des intensity × scale / 2)`, posée sur `--atmo-intensity`. Le plafond de 0,45 garantit que la toile reste lisible même avec huit atmosphères.
- Lumière : somme des `light × scale`, bornée à −0,4…+0,4, posée sur `.canvas` en `filter: brightness(calc(1 + var(--atmo-light)))`.
- Particules : l'ensemble des `particles` présentes. Le `<canvas>` dessine `rain` (traits fins obliques), `snow` (points lents qui dérivent), `embers` (points chauds qui montent), `fog` (nappes de bruit qui glissent). Plusieurs types peuvent coexister ; au-delà de 200 particules au total, on ne dépasse jamais ce plafond.
- `window.matchMedia('(prefers-reduced-motion: reduce)')` : la boucle d'animation n'est jamais démarrée ; on dessine une seule image fixe, et on la redessine seulement au redimensionnement.
- Aucune atmosphère posée : `--atmo-intensity: 0`, `--atmo-light: 0`, le `<canvas>` est effacé et la boucle est arrêtée.

**Checklist de vérification manuelle de la tâche 7** (dans un navigateur, `npm run serve`, avec un `app.js` provisoire qui pose trois stickers dans la toile) :

- [ ] La toile est carrée à 390 px de large comme à 1280 px, avec au moins 16 px de marge de chaque côté.
- [ ] Un sticker se déplace au doigt ou à la souris sans latence perceptible et sans faire défiler la page.
- [ ] Le pincement à deux doigts change la taille ; la taille reste entre 0,5 et 3.
- [ ] La molette sur un sticker survolé change sa taille.
- [ ] Un simple clic sélectionne et fait apparaître la barre d'outils près du sticker, sans jamais la laisser dépasser de la toile.
- [ ] Les cinq boutons de la barre font bien : agrandir, réduire, retourner, mettre devant, supprimer.
- [ ] Un double-clic retourne le sticker.
- [ ] Glisser un sticker hors de la toile l'estompe pendant le geste, puis le supprime au relâchement.
- [ ] `Tab` parcourt les stickers dans l'ordre de profondeur ; chaque sticker annonce « ville la nuit, sticker 1 sur 3 ».
- [ ] Sur un sticker sélectionné : flèches, `Maj` + flèches, `+`, `-`, `R`, `Suppr` et `Échap` font ce qui est décrit.
- [ ] `#canvas-sr` contient la liste des stickers posés, dans l'ordre, et se met à jour.
- [ ] Poser 🌧️ fait tomber une pluie fine et bleuit la toile ; poser 🔥 la réchauffe ; les deux ensemble se cumulent sans écraser l'image.
- [ ] Avec « réduire les animations » activé dans le système, les particules deviennent une image fixe et les stickers ne s'animent plus à la pose.
- [ ] La toile vide affiche l'amorce « Pose un sticker, les films arrivent. » et la masque dès le premier sticker.
- [ ] `document.documentElement.scrollWidth <= window.innerWidth` reste vrai pendant tous les gestes.

- [ ] **Step 1 : Écrire `styles/canvas.css` selon les règles ci-dessus**

- [ ] **Step 2 : Écrire `src/canvas.js` selon le squelette et la liste des gestionnaires**

- [ ] **Step 3 : Brancher un banc d'essai provisoire dans `src/app.js`**

```js
import { createBoard, addSticker } from './board.js';
import { createCanvas } from './canvas.js';

let board = addSticker(addSticker(addSticker(createBoard(), 'city_night', { x: 0.35, y: 0.4 }), 'rain', { x: 0.7, y: 0.3, scale: 1.6 }), 'robot', { x: 0.5, y: 0.7 });
const canvas = createCanvas(document.getElementById('canvas-host'), {
  onChange(next, { commit }) { board = next; console.log('change', commit, board.items.length); },
  onSelect(index) { console.log('select', index); }
});
canvas.setBoard(board);
```

- [ ] **Step 4 : Lancer le serveur et dérouler la checklist ci-dessus**

```bash
cd /Users/matt/Documents/Frame && npm run serve
```

Ouvrir http://localhost:8080, cocher chaque ligne de la checklist, corriger ce qui ne passe pas avant de continuer.

- [ ] **Step 5 : Vérifier que les tests automatiques passent toujours**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# fail 0`.

- [ ] **Step 6 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/canvas.js styles/canvas.css src/app.js && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: toile avec gestes pointeur, clavier et atmosphères

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 8 : Tiroir de stickers, bande de résultats, fiche film

Tâche d'interface. Mêmes règles qu'à la tâche 7 : le plan fixe les noms, les dimensions et les comportements ; l'implémenteur écrit le corps.

**Files:**
- Create: `/Users/matt/Documents/Frame/src/drawer.js`
- Create: `/Users/matt/Documents/Frame/src/results.js`
- Modify: `/Users/matt/Documents/Frame/styles/drawer.css` (remplace le fichier d'attente)
- Modify: `/Users/matt/Documents/Frame/styles/results.css` (remplace le fichier d'attente)

**Interfaces:**
- Consumes: `DRAWERS`, `STICKERS`, `STICKER_BY_ID`, `twemojiUrl` de `src/stickers.js` ; `explain` de `src/engine.js` ; `posterUrl`, `movieUrl` de `src/tmdb.js`.
- Produces, `src/drawer.js` :
  - `createDrawer(rootEl, { onPick }): DrawerHandle`
    - `onPick(stickerId: string, sourceRect: DOMRect)` — `sourceRect` est le rectangle de la tuile touchée, pour que `canvas.js` puisse animer l'arrivée depuis le tiroir.
    - `DrawerHandle = { setActiveDrawer(id: string): void, setFull(full: boolean): void }`
  - `DEFAULT_DRAWER = 'places'` — le tiroir ouvert au lancement, le plus discriminant (spec §6.2)
- Produces, `src/results.js` :
  - `createResults(rootEl, { onOpen }): ResultsHandle`
    - `onOpen(entry: Selection)` — clic sur une carte.
    - `ResultsHandle = { setLoading(): void, setSelection(entries: Selection[], placed: Array<{id, scale}>, { animateFirst: boolean }): void, setError(message: string, onRetry: () => void): void, setEmpty(kind: 'no-sticker' | 'no-key' | 'no-results'): void }`
  - `createSheet(rootEl, { client, onJournal }): SheetHandle`
    - `client` : un objet rendu par `createClient(...)` ou `createDemoClient()` ; la fiche appelle `client.movieDetails(id)` pour le résumé complet.
    - `onJournal(entry: Selection)` — appelé une fois à chaque ouverture, pour que `app.js` écrive dans le journal.
    - `SheetHandle = { open(entry: Selection, placed): Promise<void>, close(): void }`
  - `CATEGORY_LABELS = { evident: '', surprise: 'surprise', unexpected: 'pas de côté' }` — « évident » ne s'affiche jamais.
  - `EMPTY_MESSAGES = { 'no-sticker': 'Pose un sticker, les films arrivent.', 'no-key': 'Il manque ta clé TMDB pour aller chercher les films.', 'no-results': 'Rien ne correspond à ce tableau, essaie d\'enlever un sticker.' }`

**Structure DOM de `createDrawer` dans `#drawer-host` :**

```html
<div class="drawer" id="drawer">
  <div class="drawer__tabs" role="tablist" aria-label="Tiroirs de stickers">
    <button class="drawer__tab" type="button" role="tab" id="tab-places"
            data-drawer="places" aria-selected="true" aria-controls="drawer-grid">Lieux</button>
    <!-- les sept tiroirs, dans l'ordre de DRAWERS -->
  </div>
  <div class="drawer__grid" id="drawer-grid" role="tabpanel" aria-labelledby="tab-places">
    <button class="drawer__tile" type="button" data-sticker="city_night" title="Ville la nuit">
      <img class="drawer__img" src="…1f303.svg" alt="" draggable="false" loading="lazy">
      <span class="sr-only">Ville la nuit</span>
    </button>
    <!-- toutes les tuiles du tiroir actif -->
  </div>
  <p class="drawer__full" id="drawer-full" role="status" hidden>Ta toile est pleine, 40 stickers au maximum.</p>
</div>
```

**`styles/drawer.css` — ce qui est fixé :**

- `.drawer` : `display: grid; gap: var(--sp-2); min-width: 0;`.
- `.drawer__tabs` : `display: flex; gap: var(--sp-1); overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-block: var(--sp-1);` et `::-webkit-scrollbar { display: none; }`.
- `.drawer__tab` : `flex: 0 0 auto; height: var(--hit-min); padding-inline: var(--sp-3); border: 1px solid var(--c-line); border-radius: var(--r-full); background: transparent; color: var(--c-text-dim); font-family: var(--ff-display); font-size: var(--fs-xs); font-weight: var(--fw-semi); letter-spacing: var(--ls-caps); text-transform: uppercase; white-space: nowrap;`.
- `.drawer__tab[aria-selected="true"]` : `color: var(--c-accent-ink); background: var(--c-accent); border-color: var(--c-accent);`.
- `.drawer__grid` : `display: flex; gap: var(--sp-2); height: var(--drawer-h); align-items: center; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x proximity; padding-inline: var(--sp-1);` ; barre de défilement masquée comme les onglets.
- `.drawer__tile` : `flex: 0 0 auto; width: var(--drawer-tile); height: var(--drawer-tile); display: grid; place-items: center; border: 1px solid var(--c-line); border-radius: var(--r-md); background: var(--c-surface); scroll-snap-align: start; transition: transform var(--d-fast) var(--e-spring), border-color var(--d-fast) var(--e-out);` ; `:hover, :focus-visible { transform: translateY(-2px); border-color: var(--c-line-strong); }` ; `:active { transform: scale(0.92); }`.
- `.drawer__img` : `width: 36px; height: 36px;`.
- `.drawer.is-full .drawer__tile` : `opacity: 0.4; pointer-events: none;`.
- `.drawer__full` : `color: var(--c-error); font-size: var(--fs-sm);`.
- Le tiroir ne dépasse jamais la largeur de son conteneur : `min-width: 0` sur `.drawer` et sur `#stage`, jamais de largeur fixe.

**Gestionnaires d'événements de `drawer.js`, un par un :**

1. `tabsEl.addEventListener('click', onTabClick)` — lit `data-drawer`, appelle `setActiveDrawer(id)`, replace le défilement de la grille à zéro.
2. `tabsEl.addEventListener('keydown', onTabKeys)` — `ArrowLeft` et `ArrowRight` déplacent la sélection d'onglet et donnent le focus au nouvel onglet ; `Home` et `End` vont au premier et au dernier.
3. `gridEl.addEventListener('click', onTileClick)` — si le tiroir est marqué plein, ne rien faire d'autre qu'afficher `#drawer-full` pendant 2 500 ms ; sinon appeler `onPick(stickerId, tile.getBoundingClientRect())`.
4. `setActiveDrawer(id)` — reconstruit `.drawer__grid` avec les stickers du tiroir demandé, met `aria-selected` sur le bon onglet, met à jour `aria-labelledby` du panneau.
5. `setFull(full)` — bascule la classe `is-full` sur `.drawer` et l'attribut `hidden` de `#drawer-full`.

**Structure DOM de `createResults` dans `#results-host` :**

```html
<div class="results" id="results">
  <h2 class="results__title">Films trouvés</h2>
  <div class="results__strip" id="results-strip">
    <article class="card" data-movie="414906" tabindex="0" role="button">
      <div class="card__poster">
        <img class="card__img" src="https://image.tmdb.org/t/p/w342/….jpg" alt="" loading="lazy">
      </div>
      <h3 class="card__title">The Batman</h3>
      <p class="card__meta"><span class="card__year">2022</span><span class="card__badge">surprise</span></p>
      <p class="card__why">
        <span class="card__emoji">🌃</span><span class="card__emoji is-dim">🤖</span>
      </p>
    </article>
    <!-- jusqu'à six cartes -->
  </div>
  <p class="results__state" id="results-state" role="status" hidden></p>
  <button class="results__retry" id="results-retry" type="button" hidden>Réessayer</button>
</div>
```

Carte sans affiche : `.card__poster` reçoit la classe `is-typographic` et contient, à la place de l'`<img>`, `<span class="card__fallback">Titre du film</span>` — fond `var(--c-raised)`, titre en `var(--ff-display)`, `var(--fs-lg)`, aligné en bas à gauche, avec une fine barre `var(--c-accent)` en haut.

**`styles/results.css` — ce qui est fixé :**

- `.results` : `display: grid; gap: var(--sp-3); min-width: 0;`.
- `.results__title` : `font-family: var(--ff-display); font-size: var(--fs-xs); font-weight: var(--fw-semi); letter-spacing: var(--ls-caps); text-transform: uppercase; color: var(--c-text-dim);`.
- `.results__strip` sur téléphone : `display: flex; gap: var(--sp-3); overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: var(--sp-2);` ; chaque `.card` fait `flex: 0 0 var(--card-w-phone); scroll-snap-align: start;`.
- `.results__strip` à partir de `@media (min-width: 900px)` : `display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--card-w-desk), 1fr)); gap: var(--sp-4); overflow: visible;` ; `.card { flex: none; }`.
- `.card` : `display: grid; gap: var(--sp-1); min-width: 0; cursor: pointer; background: none; border: 0; text-align: left;`.
- `.card__poster` : `aspect-ratio: 2 / 3; border-radius: var(--r-md); overflow: hidden; background: var(--c-raised); box-shadow: var(--sh-card);`.
- `.card__img` : `width: 100%; height: 100%; object-fit: cover;`.
- `.card__title` : `font-size: var(--fs-md); font-weight: var(--fw-medium); line-height: var(--lh-tight); overflow-wrap: anywhere;` ; jamais tronqué à une seule ligne, deux lignes maximum via `-webkit-line-clamp: 2`.
- `.card__meta` : `display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-text-dim);`.
- `.card__badge` : `font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: var(--ls-caps); color: var(--c-text-dim); border: 1px solid var(--c-line); border-radius: var(--r-full); padding: 0 var(--sp-2);` ; absent du DOM quand la catégorie est `evident`.
- `.card__why` : `display: flex; gap: var(--sp-1); font-size: var(--fs-md);`.
- `.card__emoji.is-dim` : `opacity: 0.32; filter: grayscale(1);`.
- Animation d'entrée : `.card` entre en `opacity 0 → 1` et `translateY(8px) → 0` sur `var(--d-base)`, avec un décalage de `calc(var(--d-stagger) * var(--i))` où `--i` est l'indice de la carte, posé en JS. Sous `prefers-reduced-motion`, le fondu reste, le déplacement disparaît.
- `.results__state` : `color: var(--c-text-dim); font-size: var(--fs-md);` ; en cas d'erreur, `color: var(--c-error);`.
- `.results.is-loading .card` : `opacity: 0.45;` — les résultats précédents restent visibles pendant le chargement, jamais de squelette vide.

**Comportements de `results.js`, un par un :**

1. `setLoading()` — ajoute `is-loading` sur `.results`, masque `#results-state` et `#results-retry`, **ne vide jamais** la bande.
2. `setSelection(entries, placed, { animateFirst })` — retire `is-loading`, masque les états. Pour chaque entrée : réutilise la carte existante si `data-movie` correspond déjà, sinon en crée une. Réordonne les cartes par `appendChild` dans l'ordre de `entries` : les cartes qui restent se déplacent par transition, elles ne sont pas détruites puis recréées. La ligne d'explication vient de `explain(entry, placed)` : emoji honorés en pleine couleur, emoji ignorés avec `is-dim`, dans l'ordre de la toile. `animateFirst: true` ajoute un délai supplémentaire de 120 ms avant le premier échelonnement — c'est le seul moment orchestré de l'application, le premier résultat après le premier sticker posé.
3. `setError(message, onRetry)` — garde les cartes en place, affiche `#results-state` avec `message` et `#results-retry` ; le clic sur le bouton appelle `onRetry()`.
4. `setEmpty(kind)` — vide la bande, affiche `#results-state` avec `EMPTY_MESSAGES[kind]`, masque le bouton de reprise.
5. `stripEl.addEventListener('click', onCardClick)` — remonte jusqu'au `.card`, retrouve l'entrée par `data-movie`, appelle `onOpen(entry)`.
6. `stripEl.addEventListener('keydown', onCardKeys)` — `Enter` et `Espace` sur une carte focalisée font la même chose que le clic, avec `event.preventDefault()` sur `Espace`.
7. `imgEl.addEventListener('error', …)` posé sur chaque affiche — si l'image de TMDB échoue, la carte bascule sur la variante typographique.

**Structure DOM de `createSheet` dans `#sheet-host` :**

```html
<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" hidden>
  <div class="sheet__backdrop" id="sheet-backdrop"></div>
  <div class="sheet__panel">
    <button class="sheet__close" id="sheet-close" type="button" aria-label="Fermer">✕</button>
    <div class="sheet__poster"><img id="sheet-img" alt="" src=""></div>
    <h2 class="sheet__title" id="sheet-title"></h2>
    <p class="sheet__meta" id="sheet-meta"></p>
    <p class="sheet__why" id="sheet-why"></p>
    <p class="sheet__overview" id="sheet-overview"></p>
    <a class="sheet__link" id="sheet-link" href="" target="_blank" rel="noopener">Voir sur TMDB</a>
  </div>
</div>
```

- `.sheet` : `position: fixed; inset: 0; z-index: var(--z-sheet); display: grid; place-items: end stretch;` ; à partir de 900 px, `place-items: center;`.
- `.sheet__backdrop` : `position: absolute; inset: 0; background: var(--c-overlay); backdrop-filter: blur(6px);`.
- `.sheet__panel` : `position: relative; background: var(--c-surface); border-radius: var(--r-lg) var(--r-lg) 0 0; padding: var(--sp-5) var(--gutter) var(--sp-6); max-height: 90dvh; overflow-y: auto; box-shadow: var(--sh-panel); display: grid; gap: var(--sp-3);` ; à partir de 900 px, `max-width: 560px; border-radius: var(--r-lg);`.
- `#sheet-img` utilise `posterUrl(path, 'w780')`.
- `#sheet-meta` : année, note TMDB sur 10 avec une décimale, nombre de votes. **Aucun pourcentage de correspondance.**
- `#sheet-why` : la phrase de `explain(entry, placed).sentence`, suivie de la ligne d'emoji honorés et estompés.
- `#sheet-overview` : `overview` de `client.movieDetails(id)`, avec repli sur `entry.movie.overview` puis sur « TMDB n'a pas de résumé en français pour ce film. ».
- `#sheet-link` pointe sur `movieUrl(entry.movie.id)`.

**Gestionnaires d'événements de `createSheet`, un par un :**

1. `open(entry, placed)` — remplit le panneau avec ce qu'on a déjà, retire `hidden`, met le focus sur `#sheet-close`, mémorise l'élément qui avait le focus, appelle `onJournal(entry)`, puis `await client.movieDetails(entry.movie.id)` et complète le résumé. Si l'appel échoue, garde le résumé de repli, sans message d'erreur.
2. `closeBtn.addEventListener('click', close)`.
3. `backdropEl.addEventListener('click', close)`.
4. `document.addEventListener('keydown', onEscape)` — `Escape` ferme la fiche quand elle est ouverte.
5. `panelEl.addEventListener('keydown', onTabTrap)` — `Tab` et `Maj+Tab` bouclent à l'intérieur du panneau tant qu'il est ouvert.
6. `panelEl.addEventListener('pointerdown' / 'pointermove' / 'pointerup', …)` — sur téléphone, un glissement vers le bas de plus de 80 px ferme la fiche (« fermeture par geste », spec §6.5).
7. `close()` — remet `hidden`, rend le focus à l'élément mémorisé.

**Checklist de vérification manuelle de la tâche 8** (banc d'essai : un `app.js` provisoire qui branche le tiroir sur la toile et alimente `setSelection` avec le résultat du client de démonstration) :

- [ ] Les sept onglets sont visibles ou atteignables par défilement horizontal du tiroir seul, jamais de la page.
- [ ] « Lieux » est l'onglet actif au chargement.
- [ ] Les flèches gauche et droite déplacent la sélection d'onglet au clavier.
- [ ] Toucher une tuile pose le sticker au centre de la toile avec une petite variation de position.
- [ ] Après 40 stickers, les tuiles sont estompées, inertes, et le message « Ta toile est pleine, 40 stickers au maximum. » apparaît puis disparaît.
- [ ] La bande de résultats défile horizontalement sur téléphone, passe en grille de 2 ou 3 colonnes à 1 280 px.
- [ ] Les cartes montrent affiche 2:3, titre, année, emoji honorés en couleur et ignorés estompés.
- [ ] Aucun badge sur les trois premières cartes ; « surprise » sur les deux suivantes ; « pas de côté » sur la dernière.
- [ ] Aucun pourcentage nulle part.
- [ ] Un film sans affiche (« Du rififi chez les hommes » en mode démonstration) reçoit la carte typographique.
- [ ] Modifier la toile conserve les films déjà présents à leur place et fait glisser les cartes au lieu de les faire sauter.
- [ ] `setError` garde les cartes visibles et affiche « Réessayer ».
- [ ] `setEmpty('no-sticker')`, `setEmpty('no-key')` et `setEmpty('no-results')` affichent chacun leur phrase.
- [ ] Un clic sur une carte ouvre la fiche ; `Échap`, le bouton de fermeture, le fond et le glissement vers le bas la ferment ; le focus revient sur la carte.
- [ ] `Tab` reste enfermé dans la fiche tant qu'elle est ouverte.
- [ ] `document.documentElement.scrollWidth <= window.innerWidth` reste vrai à 390 px comme à 1 280 px.

- [ ] **Step 1 : Écrire `styles/drawer.css` puis `src/drawer.js`**

- [ ] **Step 2 : Écrire `styles/results.css` puis `src/results.js`**

- [ ] **Step 3 : Étendre le banc d'essai de `src/app.js`**

```js
import { createBoard, addSticker, boardSeedKey } from './board.js';
import { STICKER_BY_ID } from './stickers.js';
import { createCanvas } from './canvas.js';
import { createDrawer } from './drawer.js';
import { createResults, createSheet } from './results.js';
import { createDemoClient } from './demo.js';
import { selectMovies } from './engine.js';

const client = createDemoClient();
let board = createBoard();

const results = createResults(document.getElementById('results-host'), { onOpen: entry => sheet.open(entry, placed()) });
const sheet = createSheet(document.getElementById('sheet-host'), { client, onJournal: e => console.log('journal', e.movie.id) });
const canvas = createCanvas(document.getElementById('canvas-host'), { onChange: next => { board = next; refresh(); }, onSelect: () => {} });
const drawer = createDrawer(document.getElementById('drawer-host'), {
  onPick(id) { board = addSticker(board, id); canvas.setBoard(board); drawer.setFull(board.items.length >= 40); refresh(); }
});

const placed = () => board.items.map(i => ({ id: i.id, scale: i.scale }));

async function refresh() {
  if (!board.items.length) return results.setEmpty('no-sticker');
  results.setLoading();
  const pools = {};
  for (const p of placed()) pools[p.id] = await client.stickerPools(STICKER_BY_ID.get(p.id));
  results.setSelection(selectMovies(placed(), pools, [], boardSeedKey(board)), placed(), { animateFirst: board.items.length === 1 });
}

canvas.setBoard(board);
refresh();
```

- [ ] **Step 4 : Lancer le serveur et dérouler la checklist ci-dessus**

```bash
cd /Users/matt/Documents/Frame && npm run serve
```

- [ ] **Step 5 : Vérifier que les tests automatiques passent toujours**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# fail 0`.

- [ ] **Step 6 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/drawer.js src/results.js styles/drawer.css styles/results.css src/app.js && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: tiroir de stickers, bande de résultats et fiche film

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 9 : Assemblage, panneaux, exemples, mode liste

Tâche d'interface et de câblage. Le plan fixe les noms, les valeurs et les comportements ; l'implémenteur écrit le corps.

**Files:**
- Create: `/Users/matt/Documents/Frame/src/examples.js`
- Create: `/Users/matt/Documents/Frame/src/list.js`
- Modify: `/Users/matt/Documents/Frame/src/app.js` (remplace le banc d'essai de la tâche 8 par l'assemblage définitif)
- Modify: `/Users/matt/Documents/Frame/styles/panels.css` (remplace le fichier d'attente)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces, `src/examples.js` :
  - `EXAMPLES: Array<{ id: string, name: string, board: Board }>` — exactement trois entrées, `id` valant `night_city`, `strange_forest`, `society_drama`
- Produces, `src/list.js` :
  - `createListPicker(rootEl, { onChange, onSelect })` → `{ setBoard(board), getBoard(), select(index), destroy() }` — exactement la même forme de poignée que `createCanvas`, pour que `app.js` puisse échanger l'une pour l'autre sans autre changement. `onSelect` est accepté et ignoré : le mode liste n'a pas de sélection persistante.
- Produces, `src/app.js` :
  - `DEBOUNCE_MS = 400`, `HISTORY_MAX = 50`
  - `scopeLabel(count: number): 'Large' | 'Précise' | 'Très précise'` — `count <= 2` → `'Large'`, `3 <= count <= 5` → `'Précise'`, `count >= 6` → `'Très précise'`
  - `defaultBoardName(board): string` — les libellés des trois premiers stickers joints par « + », ou `'Tableau vide'`

**Contenu exact de `src/examples.js` :**

```js
// Trois tableaux d'accueil, proposés au premier lancement (spec §6.4).
// Les positions sont choisies pour que la miniature soit lisible et jolie.
export const EXAMPLES = [
  {
    id: 'night_city',
    name: 'Nuit urbaine',
    board: { items: [
      { id: 'city_night',    x: 0.34, y: 0.42, scale: 1.8, flip: false },
      { id: 'rain',          x: 0.72, y: 0.24, scale: 1.2, flip: false },
      { id: 'violet_neon',   x: 0.18, y: 0.74, scale: 0.9, flip: false },
      { id: 'leather_coat',  x: 0.62, y: 0.64, scale: 1.1, flip: true  },
      { id: 'car',           x: 0.84, y: 0.78, scale: 0.8, flip: false }
    ] }
  },
  {
    id: 'strange_forest',
    name: 'Forêt étrange',
    board: { items: [
      { id: 'forest',  x: 0.40, y: 0.46, scale: 2.0, flip: false },
      { id: 'fog',     x: 0.70, y: 0.30, scale: 1.3, flip: false },
      { id: 'wolf',    x: 0.22, y: 0.72, scale: 1.0, flip: true  },
      { id: 'candle',  x: 0.60, y: 0.76, scale: 0.7, flip: false },
      { id: 'child',   x: 0.82, y: 0.58, scale: 0.9, flip: false }
    ] }
  },
  {
    id: 'society_drama',
    name: 'Drame mondain',
    board: { items: [
      { id: 'palace',         x: 0.36, y: 0.40, scale: 1.9, flip: false },
      { id: 'evening_dress',  x: 0.68, y: 0.56, scale: 1.2, flip: false },
      { id: 'champagne',      x: 0.24, y: 0.74, scale: 0.9, flip: false },
      { id: 'ring',           x: 0.80, y: 0.26, scale: 0.7, flip: false },
      { id: 'piano',          x: 0.52, y: 0.80, scale: 1.0, flip: true  }
    ] }
  }
];
```

**Structure DOM de l'accueil, construite par `app.js` dans `#examples` :**

```html
<div class="examples__inner">
  <p class="examples__lead">Trois tableaux pour commencer. Touche-en un, ou pars d'une toile vierge.</p>
  <ul class="examples__list">
    <li><button class="examples__card" type="button" data-example="night_city">
      <span class="examples__thumb" aria-hidden="true"><!-- 5 <img> Twemoji placés en pourcentage --></span>
      <span class="examples__name">Nuit urbaine</span>
    </button></li>
    <!-- les trois exemples -->
  </ul>
  <button class="examples__blank hbtn" type="button" id="btn-blank">Toile vierge</button>
</div>
```

`#examples` recouvre `#canvas-host` en `position: absolute` par-dessus la toile vide ; il disparaît dès qu'un exemple est choisi, que « Toile vierge » est touché, ou qu'un sticker est posé.

**Structure DOM des panneaux, construite par `app.js` dans `#panels-host` :**

```html
<!-- Panneau « Mes tableaux » -->
<div class="panel" id="panel-boards" role="dialog" aria-modal="true" aria-labelledby="panel-boards-title" hidden>
  <div class="panel__backdrop" data-close="boards"></div>
  <div class="panel__body">
    <h2 class="panel__title" id="panel-boards-title">Mes tableaux</h2>
    <button class="panel__close hbtn" type="button" data-close="boards" aria-label="Fermer">✕</button>
    <div class="panel__tabs" role="tablist">
      <button class="panel__tab" type="button" role="tab" id="tab-saved" data-tab="saved" aria-selected="true">Tableaux</button>
      <button class="panel__tab" type="button" role="tab" id="tab-paths" data-tab="paths" aria-selected="false">Chemins</button>
    </div>
    <div class="panel__pane" id="pane-saved" role="tabpanel" aria-labelledby="tab-saved">
      <button class="panel__action hbtn" type="button" id="btn-save-board">Sauvegarder ce tableau</button>
      <ul class="panel__list" id="saved-list"></ul>
      <p class="panel__empty" id="saved-empty">Aucun tableau sauvegardé pour l'instant.</p>
    </div>
    <div class="panel__pane" id="pane-paths" role="tabpanel" aria-labelledby="tab-paths" hidden>
      <ul class="panel__list" id="paths-list"></ul>
      <p class="panel__empty" id="paths-empty">Ouvre une fiche film et ton chemin s'inscrira ici.</p>
    </div>
  </div>
</div>

<!-- Fenêtre de clé TMDB -->
<div class="panel" id="panel-key" role="dialog" aria-modal="true" aria-labelledby="panel-key-title" hidden>
  <div class="panel__backdrop" data-close="key"></div>
  <div class="panel__body">
    <h2 class="panel__title" id="panel-key-title">Ta clé TMDB</h2>
    <button class="panel__close hbtn" type="button" data-close="key" aria-label="Fermer">✕</button>
    <p class="panel__lead">FRAME va chercher les films chez TMDB. Il te faut une clé gratuite.</p>
    <ol class="panel__steps">
      <li>Crée un compte sur themoviedb.org.</li>
      <li>Ouvre Réglages, puis API, et demande une clé.</li>
      <li>Colle ici la clé v3 ou le jeton de lecture v4.</li>
    </ol>
    <a class="panel__link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Ouvrir la page API de TMDB</a>
    <label class="panel__label" for="key-input">Clé ou jeton</label>
    <input class="panel__input" id="key-input" type="password" autocomplete="off" spellcheck="false" placeholder="eyJ… ou 32 caractères">
    <p class="panel__error" id="key-error" role="alert" hidden></p>
    <button class="panel__action hbtn" type="button" id="btn-key-save">Valider et enregistrer</button>
  </div>
</div>
```

Chaque élément de `#saved-list` : `<li class="panel__item"><button class="panel__load" data-board-id="…"><span class="panel__thumb"></span><span class="panel__item-name">Nuit urbaine</span><span class="panel__item-date">14 sept. 2026</span></button><button class="panel__delete" data-delete-id="…" aria-label="Supprimer">✕</button></li>`.
Chaque élément de `#paths-list` : `<li class="panel__item"><a class="panel__load" href="#t=1.…"><span class="panel__item-name">Blade Runner 2049</span><span class="panel__item-date">14 sept. 2026, 21:05</span></a></li>`, les plus récents d'abord.

**`styles/panels.css` — ce qui est fixé :**

- `.panel` : `position: fixed; inset: 0; z-index: var(--z-panel); display: grid;` ; sur téléphone `place-items: end stretch;`, à partir de 900 px `place-items: center;`.
- `.panel__backdrop` : comme `.sheet__backdrop`.
- `.panel__body` : `position: relative; background: var(--c-surface); padding: var(--sp-5) var(--gutter) var(--sp-6); max-height: 90dvh; overflow-y: auto; box-shadow: var(--sh-panel); display: grid; gap: var(--sp-3); border-radius: var(--r-lg) var(--r-lg) 0 0;` ; à partir de 900 px `max-width: 480px; border-radius: var(--r-lg);`.
- `.panel__title` : `font-family: var(--ff-display); font-size: var(--fs-lg); font-weight: var(--fw-bold);`.
- `.panel__close` : `position: absolute; top: var(--sp-3); right: var(--gutter);`.
- `.panel__tab[aria-selected="true"]` : soulignement `2px` en `var(--c-accent)`, texte `var(--c-text)` ; sinon `var(--c-text-dim)`.
- `.panel__input` : `width: 100%; height: var(--hit-min); padding-inline: var(--sp-3); background: var(--c-bg); border: 1px solid var(--c-line-strong); border-radius: var(--r-md); color: var(--c-text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--fs-sm);`.
- `.panel__error` : `color: var(--c-error); font-size: var(--fs-sm);`.
- `.panel__item` : `display: flex; align-items: center; gap: var(--sp-2); padding-block: var(--sp-2); border-bottom: 1px solid var(--c-line);`.
- `.panel__thumb` : `width: 56px; height: 56px; flex: 0 0 auto; position: relative; background: var(--c-bg); border-radius: var(--r-sm); overflow: hidden;` ; les stickers du tableau y sont rendus en miniature, en `position: absolute` avec `left`/`top` en pourcentage et `width: calc(18px * var(--scale))`.
- `.examples` : `position: absolute; inset: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--c-bg) 82%, transparent); backdrop-filter: blur(2px); border-radius: var(--r-lg);`.
- `.examples__list` : `display: flex; gap: var(--sp-3); flex-wrap: wrap; justify-content: center;`.
- `.examples__card` : `display: grid; gap: var(--sp-1); justify-items: center; background: none; border: 0;`.
- `.examples__thumb` : `width: 88px; height: 88px; position: relative; background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); overflow: hidden;`.
- `.list` (mode liste) : `display: grid; gap: var(--sp-3);` ; `.list__group` : un titre de tiroir puis `.list__chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }`.
- `.list__chip` : `min-height: var(--hit-min); display: inline-flex; align-items: center; gap: var(--sp-2); padding-inline: var(--sp-3); border: 1px solid var(--c-line); border-radius: var(--r-full); background: var(--c-surface); color: var(--c-text); font-size: var(--fs-sm);`.
- `.list__chip[aria-pressed="true"]` : `border-color: var(--c-accent); background: color-mix(in srgb, var(--c-accent) 14%, var(--c-surface));`.
- `.list__chip.is-important` : `border-width: 2px; font-weight: var(--fw-semi);` avec un point `var(--c-accent)` avant le libellé.
- `.scope` : `font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: var(--ls-caps); color: var(--c-text-dim); margin-left: auto;`.
- `.stage-bar` : `display: flex; align-items: center; gap: var(--sp-2); min-width: 0;`.

**`src/list.js` — comportement exact (spec §6.6) :**

- Rend un groupe par tiroir, dans l'ordre de `DRAWERS`, chaque groupe listant toutes les chips de ses stickers : emoji Twemoji plus libellé français.
- Un premier toucher sélectionne la chip → ajoute le sticker au tableau avec `x: 0.5, y: 0.5, scale: 1, flip: false`.
- Un deuxième toucher sur une chip déjà sélectionnée la marque « important » → passe le `scale` de ce sticker à `2.5`, équivalent d'un gros sticker.
- Un troisième toucher la désélectionne → retire le sticker du tableau.
- `aria-pressed` reflète la sélection ; la classe `is-important` reflète l'importance ; un `<span class="sr-only">` annonce « important » pour les lecteurs d'écran.
- Aucune position n'est exposée ni modifiable. Même moteur, mêmes résultats que la toile pour la même sélection.
- L'en-tête n'indique jamais quel mode est actif : rien n'est ajouté ni retiré de `#header` en mode liste, pour permettre un test à l'aveugle.
- `setBoard(board)` synchronise l'état des chips à partir des items du tableau, ce qui fait fonctionner l'annulation, le rétablissement et la restauration depuis l'URL exactement comme sur la toile.

**`src/app.js` — squelette :**

```js
import { createBoard, addSticker, clearBoard, boardSeedKey, MAX_STICKERS } from './board.js';
import { STICKER_BY_ID } from './stickers.js';
import { encodeBoard, decodeBoard, boardToUrl } from './url.js';
import { selectMovies } from './engine.js';
import { createClient, detectAuth, TmdbError } from './tmdb.js';
import { createDemoClient } from './demo.js';
import {
  loadCredential, saveCredential, clearCredential,
  loadBoards, saveBoard, deleteBoard, loadJournal, addJournalEntry,
  hasSeenIntro, markIntroSeen
} from './storage.js';
import { createCanvas } from './canvas.js';
import { createListPicker } from './list.js';
import { createDrawer, DEFAULT_DRAWER } from './drawer.js';
import { createResults, createSheet } from './results.js';
import { EXAMPLES } from './examples.js';

export const DEBOUNCE_MS = 400;
export const HISTORY_MAX = 50;

export function scopeLabel(count) {
  if (count >= 6) return 'Très précise';
  if (count >= 3) return 'Précise';
  return 'Large';
}

export function defaultBoardName(board) {
  const names = board.items.slice(0, 3).map(i => STICKER_BY_ID.get(i.id)?.label).filter(Boolean);
  return names.length ? names.join(' + ') : 'Tableau vide';
}

// état : board, past[], future[], lastSelection[], client, picker, timer
```

**Câblage de `app.js`, point par point :**

1. **Lecture des paramètres.** `const params = new URLSearchParams(location.search);` — `params.get('mode') === 'liste'` choisit `createListPicker` au lieu de `createCanvas`, sur le même `#canvas-host` et avec exactement les mêmes rappels ; `params.get('demo') === '1'` remplace le client par `createDemoClient()`.
2. **Résolution de l'identifiant.** `const credential = window.FRAME_CONFIG?.tmdbToken || window.FRAME_CONFIG?.tmdbKey || loadCredential();` En mode démonstration, on n'en cherche aucun. Si `detectAuth(credential)` est `null` et qu'on n'est pas en démonstration : ouvrir `#panel-key` et appeler `results.setEmpty('no-key')`. La toile reste entièrement utilisable.
3. **Restauration du fragment.** Au chargement, `decodeBoard(location.hash)`. `error === null` → on adopte le tableau et on lance une recherche immédiate, sans attendre le debounce. `error === 'empty'` → premier lancement. `error` valant `'version'`, `'malformed'` ou `'unknown-sticker'` → tableau vide plus `#notice` affiché avec « Ce lien ne contient pas de tableau lisible. », masqué au premier geste.
4. **Premier lancement.** Si `!hasSeenIntro()` et qu'aucun tableau n'a été restauré du fragment : afficher `#examples`. Un clic sur `.examples__card` charge `EXAMPLES[i].board`, appelle `markIntroSeen()`, masque `#examples` et lance la recherche. `#btn-blank` appelle `markIntroSeen()` et masque `#examples`.
5. **Tiroir par défaut et pose.** Au démarrage, `drawer.setActiveDrawer(DEFAULT_DRAWER)` ouvre « Lieux », le tiroir le plus discriminant. Ensuite, `onPick(id, sourceRect)` : si `board.items.length >= MAX_STICKERS`, appeler `drawer.setFull(true)` et ne rien faire d'autre. Sinon `addSticker(board, id, { x: 0.5 + (Math.random() - 0.5) * 0.18, y: 0.5 + (Math.random() - 0.5) * 0.18 })`, `commit(next)`, et passer `sourceRect` à la toile pour l'animation d'arrivée.
6. **`commit(next, { push = true })`** — fonction centrale. Si `next === board`, ne rien faire. Sinon : si `push`, empiler l'ancien `board` dans `past` en gardant au plus `HISTORY_MAX` états et vider `future` ; poser `board = next` ; `picker.setBoard(board)` ; `history.replaceState(null, '', boardToUrl(board, location.href))` ; mettre à jour `#scope`, `#btn-undo`, `#btn-redo`, `drawer.setFull(...)` ; masquer `#examples` et `#notice` ; relancer le debounce.
7. **`onChange(next, { commit: isCommit })` de la toile** — appelle `commit(next, { push: isCommit })`. Un glissement en cours ne remplit donc pas la pile d'annulation, mais réécrit quand même le fragment et relance le debounce.
8. **Debounce.** `clearTimeout(timer); timer = setTimeout(search, DEBOUNCE_MS);` — `DEBOUNCE_MS = 400`, en miroir du jeton CSS `--d-debounce`.
9. **`search()`** — `placed = board.items.map(i => ({ id: i.id, scale: i.scale }))`. Zéro sticker → `results.setEmpty('no-sticker')` et `lastSelection = []`. Pas d'identifiant et pas de démonstration → `results.setEmpty('no-key')`. Sinon : `results.setLoading()`, puis pour chaque sticker distinct `await client.stickerPools(STICKER_BY_ID.get(id))` en séquence (le cache du client rend les répétitions gratuites). Puis `const entries = selectMovies(placed, pools, lastSelection, boardSeedKey(board))`. `entries.length === 0` → `results.setEmpty('no-results')`. Sinon `results.setSelection(entries, placed, { animateFirst: lastSelection.length === 0 })`, puis `lastSelection = entries`.
10. **Requête obsolète.** Chaque appel à `search()` incrémente un compteur ; à la fin, si le compteur a changé, on abandonne le résultat sans rien afficher. Une recherche lente ne doit jamais écraser une recherche plus récente.
11. **Erreurs de `search()`.** `TmdbError` de statut `401` → `clearCredential()`, ouverture de `#panel-key` avec le message « TMDB a refusé cette clé. » et la saisie conservée. Statut `429` → `results.setError('TMDB a reçu trop de requêtes. Réessaie dans un instant.', search)`. Statut `0` → `results.setError('Pas de réseau. Tes films précédents restent affichés.', search)`. Tout autre statut → `results.setError('TMDB n\'a pas répondu (' + err.status + ').', search)`. Dans tous les cas les cartes précédentes restent à l'écran.
12. **`#btn-undo`** — dépile `past`, empile le `board` courant dans `future`, applique avec `commit(previous, { push: false })`. Désactivé quand `past` est vide. **`#btn-redo`** — symétrique. Raccourcis : `Ctrl+Z` et `Cmd+Z` pour annuler, `Ctrl+Maj+Z` et `Cmd+Maj+Z` pour rétablir, écoutés sur `document` et ignorés quand le focus est dans un `<input>`.
13. **`#btn-clear`** — vide la toile par `commit(clearBoard())` et affiche `#toast` « Toile vidée — Annuler » pendant 5 000 ms ; un clic sur « Annuler » dans le toast rétablit le tableau précédent. C'est la confirmation légère annulable exigée par la spec §6.3.
14. **`#btn-share`** — construit `boardToUrl(board, location.href)`. Si `navigator.share` existe, `await navigator.share({ title: 'FRAME', url })` ; sinon `await navigator.clipboard.writeText(url)` puis `#toast` « Lien copié » pendant 2 000 ms. Si les deux échouent, afficher le lien dans `#toast` pour une copie manuelle.
15. **`#btn-boards`** — ouvre `#panel-boards` sur l'onglet « Tableaux », reconstruit `#saved-list` depuis `loadBoards()` et `#paths-list` depuis `loadJournal()`.
16. **`#btn-save-board`** — `prompt` remplacé par un champ dans le panneau, prérempli avec `defaultBoardName(board)` ; validation → `saveBoard({ name, encoded: encodeBoard(board) })`, la liste se recharge.
17. **`.panel__load`** dans `#saved-list` — `decodeBoard(entry.encoded)`, `commit(board)`, fermeture du panneau. **`.panel__delete`** — `deleteBoard(id)` et rechargement de la liste.
18. **Onglets `#tab-saved` et `#tab-paths`** — bascule `aria-selected` et l'attribut `hidden` des deux panneaux.
19. **`#btn-key-save`** — lit `#key-input`, `detectAuth` ; si `null`, affiche « Cette clé n'a pas la bonne forme. Une clé v3 fait 32 caractères, un jeton v4 commence par eyJ. » sans effacer la saisie. Sinon crée un client temporaire, appelle `validate()` ; succès → `saveCredential`, fermeture du panneau, `search()` ; échec 401 → « TMDB a refusé cette clé. » ; échec 0 → « Impossible de joindre TMDB. Vérifie ta connexion. ». La saisie n'est jamais effacée.
20. **Ouverture d'une fiche** — `results` appelle `onOpen(entry)` → `sheet.open(entry, placed)` ; `onJournal(entry)` appelle `addJournalEntry({ encoded: encodeBoard(board), movieId: entry.movie.id, title: entry.movie.title })`.
21. **`#scope`** — masqué tant que `board.items.length < 3` ; au-delà, affiche `scopeLabel(board.items.length)`. Aucune injonction, seulement l'information.
22. **`window.addEventListener('hashchange', …)`** — un fragment changé de l'extérieur (lien ouvert, retour arrière) recharge le tableau par `decodeBoard` puis `commit(board, { push: false })` ; ignoré si le fragment est celui qu'on vient d'écrire soi-même.
23. **Pied de page** — déjà écrit en dur dans `index.html` à la tâche 1, avec les attributions TMDB et Twemoji. Ne rien y ajouter en JS.

**Checklist de vérification manuelle de la tâche 9 :**

- [ ] Au tout premier chargement, sans fragment, les trois exemples s'affichent par-dessus la toile avec leurs miniatures.
- [ ] Un clic sur « Nuit urbaine » charge cinq stickers aux bonnes positions et lance la recherche.
- [ ] « Toile vierge » ferme l'accueil ; l'accueil ne revient plus aux chargements suivants.
- [ ] Poser un sticker met à jour le fragment d'URL immédiatement, sans recharger la page.
- [ ] Les résultats arrivent environ 400 ms après le dernier geste, pas avant.
- [ ] Recharger la page avec ce fragment restaure exactement le même tableau et les mêmes films.
- [ ] `Ctrl/Cmd+Z` et `Ctrl/Cmd+Maj+Z` fonctionnent, comme les deux boutons d'en-tête, qui se désactivent aux extrémités de la pile.
- [ ] « Vider la toile » vide et propose d'annuler pendant cinq secondes.
- [ ] « Partager » copie le lien et affiche « Lien copié » ; sur téléphone, la feuille de partage native s'ouvre.
- [ ] « Mes tableaux » sauvegarde sous un nom prérempli, liste, recharge et supprime.
- [ ] L'onglet « Chemins » liste les films ouverts, les plus récents d'abord.
- [ ] `#scope` reste masqué à 1 et 2 stickers, affiche « Précise » à 3, « Très précise » à 6.
- [ ] Un fragment volontairement cassé (`#t=1.ZZZZ`) donne une toile vide et le message « Ce lien ne contient pas de tableau lisible. », jamais une erreur bloquante.
- [ ] `?mode=liste` remplace la toile par les chips ; un toucher sélectionne, deux marquent « important », trois désélectionnent ; l'en-tête est identique au mode toile.
- [ ] La même sélection en mode liste et en mode toile donne exactement les mêmes six films.
- [ ] `?demo=1` fonctionne sans aucune clé et affiche des films.
- [ ] Sans clé et sans `?demo=1`, la fenêtre de clé s'ouvre, la bande de résultats explique qu'il manque la clé, et la toile reste utilisable.
- [ ] Le pied de page cite TMDB et Twemoji, avec des liens qui fonctionnent.
- [ ] Marges d'au moins 16 px et aucun défilement horizontal, à 390 px comme à 1 280 px.

- [ ] **Step 1 : Écrire `src/examples.js` avec exactement le contenu donné ci-dessus**

- [ ] **Step 2 : Écrire `src/list.js` selon le comportement décrit**

- [ ] **Step 3 : Écrire `styles/panels.css` selon les règles ci-dessus**

- [ ] **Step 4 : Réécrire `src/app.js` selon le squelette et les 23 points de câblage**

- [ ] **Step 5 : Vérifier les fonctions pures d'`app.js` en ligne de commande**

```bash
cd /Users/matt/Documents/Frame && node --input-type=module -e "
import { scopeLabel, defaultBoardName, DEBOUNCE_MS, HISTORY_MAX } from './src/app.js';
import { EXAMPLES } from './src/examples.js';
import { STICKER_BY_ID } from './src/stickers.js';
import { encodeBoard, decodeBoard } from './src/url.js';
console.assert(DEBOUNCE_MS === 400 && HISTORY_MAX === 50, 'constantes');
console.assert(scopeLabel(0) === 'Large' && scopeLabel(2) === 'Large', 'Large');
console.assert(scopeLabel(3) === 'Précise' && scopeLabel(5) === 'Précise', 'Précise');
console.assert(scopeLabel(6) === 'Très précise' && scopeLabel(40) === 'Très précise', 'Très précise');
console.assert(EXAMPLES.length === 3, 'trois exemples');
for (const ex of EXAMPLES) {
  console.assert(ex.board.items.length === 5, ex.id + ' : cinq stickers');
  for (const it of ex.board.items) console.assert(STICKER_BY_ID.has(it.id), ex.id + ' : sticker inconnu ' + it.id);
  console.assert(decodeBoard(encodeBoard(ex.board)).error === null, ex.id + ' : encodage');
}
console.log(defaultBoardName(EXAMPLES[0].board));
console.log('ok');
"
```

Attendu :

```
Ville la nuit + Pluie + Néon violet
ok
```

Si `app.js` ne peut pas être importé hors navigateur (accès direct à `document` au chargement du module), envelopper l'assemblage dans une fonction `start()` appelée par `if (typeof document !== 'undefined') start();` en bas du fichier, pour garder les fonctions pures importables et testables.

- [ ] **Step 6 : Lancer le serveur et dérouler la checklist de la tâche 9**

```bash
cd /Users/matt/Documents/Frame && npm run serve
```

Vérifier à http://localhost:8080, http://localhost:8080/?demo=1 et http://localhost:8080/?mode=liste.

- [ ] **Step 7 : Vérifier que les tests automatiques passent toujours**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# fail 0`.

- [ ] **Step 8 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add src/app.js src/list.js src/examples.js styles/panels.css && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: assemblage, panneaux, exemples d'accueil et mode liste

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 10 : Outil de vérification des mots-clés, exécution réelle, README final

**Files:**
- Create: `/Users/matt/Documents/Frame/tools/check-keywords.mjs`
- Modify: `/Users/matt/Documents/Frame/src/stickers.js` (uniquement si l'outil signale quelque chose)
- Modify: `/Users/matt/Documents/Frame/tests/stickers.test.mjs` (uniquement si l'instantané doit suivre)
- Modify: `/Users/matt/Documents/Frame/README.md` (version finale)

**Interfaces:**
- Consumes: `STICKERS` de `src/stickers.js`.
- Produces: un script exécutable, pas d'export consommé par l'application. Code de sortie `0` si tout est exact, `1` s'il manque des mots-clés ou si une requête a échoué, `2` s'il n'y a aucun identifiant.

- [ ] **Step 1 : Écrire `tools/check-keywords.mjs`**

```js
#!/usr/bin/env node
// Vérifie que chaque mot-clé du vocabulaire existe réellement sur TMDB.
//
//   TMDB_TOKEN=eyJ… node tools/check-keywords.mjs
//   TMDB_KEY=<32 hex> node tools/check-keywords.mjs
//
// Sans variable d'environnement, le script lit config.local.js.
// Il n'écrit rien : il affiche ce qu'il faut corriger à la main dans src/stickers.js.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STICKERS } from '../src/stickers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAUSE_MS = 50;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readCredential() {
  if (process.env.TMDB_TOKEN) return { kind: 'bearer', value: process.env.TMDB_TOKEN.trim() };
  if (process.env.TMDB_KEY) return { kind: 'apikey', value: process.env.TMDB_KEY.trim() };
  try {
    const local = readFileSync(join(ROOT, 'config.local.js'), 'utf8');
    const token = local.match(/tmdbToken\s*:\s*["']([^"']+)["']/);
    if (token && token[1]) return { kind: 'bearer', value: token[1] };
    const key = local.match(/tmdbKey\s*:\s*["']([^"']+)["']/);
    if (key && key[1]) return { kind: 'apikey', value: key[1] };
  } catch {
    // config.local.js absent : on tombe sur le message ci-dessous
  }
  return null;
}

const credential = readCredential();
if (!credential) {
  console.error('Aucun identifiant TMDB. Renseigne TMDB_TOKEN ou TMDB_KEY, ou crée config.local.js.');
  process.exit(2);
}

async function searchKeyword(name) {
  const url = new URL('https://api.themoviedb.org/3/search/keyword');
  url.searchParams.set('query', name);
  url.searchParams.set('page', '1');
  const options = { headers: { accept: 'application/json' } };
  if (credential.kind === 'bearer') options.headers.Authorization = 'Bearer ' + credential.value;
  else url.searchParams.set('api_key', credential.value);
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('TMDB ' + response.status);
  const data = await response.json();
  return Array.isArray(data.results) ? data.results : [];
}

const names = [...new Set(STICKERS.flatMap(s => s.keywords))];
const owners = new Map();
for (const sticker of STICKERS) {
  for (const name of sticker.keywords) {
    if (!owners.has(name)) owners.set(name, []);
    owners.get(name).push(sticker.id);
  }
}

const missing = [];
const inexact = [];
const failed = [];
let done = 0;

for (const name of names) {
  try {
    const results = await searchKeyword(name);
    const exact = results.find(k => String(k.name).toLowerCase() === name.toLowerCase());
    if (exact) {
      // correspondance exacte : rien à signaler
    } else if (results.length) {
      inexact.push({ name, suggestions: results.slice(0, 3).map(k => k.name), stickers: owners.get(name) });
    } else {
      missing.push({ name, stickers: owners.get(name) });
    }
  } catch (error) {
    failed.push({ name, message: error.message });
  }
  done++;
  if (done % 25 === 0) process.stderr.write(done + '/' + names.length + '\n');
  await sleep(PAUSE_MS);
}

console.log('Mots-clés vérifiés : ' + names.length + ' sur ' + STICKERS.length + ' stickers.');

if (missing.length) {
  console.log('\nIntrouvables sur TMDB (' + missing.length + ') — à remplacer :');
  for (const m of missing) console.log('  ✗ ' + m.name + '   [' + m.stickers.join(', ') + ']');
}

if (inexact.length) {
  console.log('\nSans correspondance exacte (' + inexact.length + ') — TMDB propose :');
  for (const i of inexact) {
    console.log('  ~ ' + i.name + '   [' + i.stickers.join(', ') + ']');
    console.log('      → ' + i.suggestions.join(' / '));
  }
}

if (failed.length) {
  console.log('\nRequêtes en échec (' + failed.length + ') :');
  for (const f of failed) console.log('  ! ' + f.name + ' : ' + f.message);
}

if (!missing.length && !inexact.length && !failed.length) {
  console.log('\nTous les mots-clés ont une correspondance exacte sur TMDB.');
}

process.exit(missing.length || failed.length ? 1 : 0);
```

- [ ] **Step 2 : Lancer l'outil pour de vrai**

```bash
cd /Users/matt/Documents/Frame && node tools/check-keywords.mjs
```

L'outil lit `config.local.js` tout seul, qui existe déjà chez Matt. Attendu, tel que mesuré le 14 septembre 2026 contre exactement le vocabulaire de la tâche 2 :

```
Mots-clés vérifiés : 392 sur 86 stickers.

Tous les mots-clés ont une correspondance exacte sur TMDB.
```

- [ ] **Step 3 : Corriger le vocabulaire si l'outil signale quoi que ce soit**

Si la section « Introuvables sur TMDB » ou « Sans correspondance exacte » n'est pas vide, remplacer chaque mot-clé fautif dans `src/stickers.js` par une suggestion que l'outil propose, ou par un autre nom, puis relancer l'outil jusqu'à obtenir `Tous les mots-clés ont une correspondance exacte sur TMDB.` Règles à respecter pendant la correction :

- On change uniquement le contenu du tableau `keywords` d'un sticker.
- On ne change ni `id`, ni `emoji`, ni l'ordre des entrées de `STICKERS` : l'instantané du test et l'encodage d'URL en dépendent.
- Chaque sticker garde entre 4 et 8 mots-clés, tous en minuscules, sans doublon interne.
- Relancer `node --test tests/stickers.test.mjs` après chaque correction.

L'instantané des identifiants dans `tests/stickers.test.mjs` n'a besoin d'être touché que si un sticker a été ajouté **à la fin** de la liste, jamais autrement.

- [ ] **Step 4 : Relancer la suite de tests**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# fail 0`.

- [ ] **Step 5 : Écrire le `README.md` final**

````markdown
# FRAME

Découverte de films par composition de stickers. Tu poses des stickers sur une toile,
le tableau devient la requête, six films arrivent avec l'explication de ce qui les a
trouvés. Pas de mots-clés à taper, pas de pourcentage de correspondance.

Site statique : pas de framework, pas de bundler, pas de dépendance npm, pas de serveur.

## Lancer en local

```bash
npm run serve
```

Puis ouvre http://localhost:8080.

L'application a besoin d'un serveur HTTP : ouvrir `index.html` depuis le disque ne
fonctionne pas, le navigateur bloque les modules ES sur `file://`.

Deux variantes utiles :

- http://localhost:8080/?demo=1 — client TMDB simulé, aucune clé nécessaire.
- http://localhost:8080/?mode=liste — la même application avec une grille de chips
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

Sept fichiers de test, lancés par le lanceur intégré de Node, sans aucune dépendance.

Vérifier que tous les mots-clés du vocabulaire existent bien sur TMDB :

```bash
node tools/check-keywords.mjs
# ou, sans config.local.js :
TMDB_TOKEN=eyJ… node tools/check-keywords.mjs
```

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
- `src/canvas.js`, `src/drawer.js`, `src/results.js`, `src/list.js`, `src/app.js` —
  l'interface.

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
````

- [ ] **Step 6 : Vérifier que `config.local.js` n'est toujours pas suivi par git**

```bash
cd /Users/matt/Documents/Frame && git check-ignore -v config.local.js && git status --short
```

Attendu : `.gitignore:1:config.local.js	config.local.js`, et `config.local.js` absent de la sortie de `git status`.

- [ ] **Step 7 : Committer**

```bash
cd /Users/matt/Documents/Frame && git add tools/check-keywords.mjs README.md src/stickers.js tests/stickers.test.mjs && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "feat: outil de vérification des mots-clés TMDB et README complet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

---

## Tâche 11 : Vérification dans un vrai navigateur et finition

C'est la vérification manuelle exigée par la spec §9, conduite avec les outils Playwright MCP. Chaque bloc se termine par une décision : passe, ou bien on corrige puis on refait le bloc.

**Files:**
- Modify: tout fichier que la vérification révèle cassé.

**Interfaces:**
- Consumes: l'application complète des tâches 1 à 10.
- Produces: une application vérifiée à 390 × 844 et à 1280 × 800, et un commit final.

- [ ] **Step 1 : Lancer le serveur en arrière-plan**

```bash
cd /Users/matt/Documents/Frame && python3 -m http.server 8080
```

Lancer cette commande avec `run_in_background: true`, puis vérifier qu'elle répond :

```bash
curl -sI http://localhost:8080/index.html | head -1
```

Attendu : `HTTP/1.0 200 OK`.

- [ ] **Step 2 : Ouvrir en format téléphone et faire l'inventaire de l'accueil**

- `mcp__playwright__browser_navigate` sur `http://localhost:8080/`
- `mcp__playwright__browser_resize` en `390` × `844`
- `mcp__playwright__browser_evaluate` : `() => { localStorage.clear(); location.reload(); }` puis renavigation, pour retrouver l'état de tout premier lancement
- `mcp__playwright__browser_snapshot`
- `mcp__playwright__browser_take_screenshot`

Vérifier sur l'instantané : l'en-tête avec FRAME, les quatre boutons, la toile carrée, les trois exemples « Nuit urbaine », « Forêt étrange », « Drame mondain », le bouton « Toile vierge », le tiroir avec l'onglet « Lieux » actif, la bande de résultats avec « Pose un sticker, les films arrivent. », le pied de page avec TMDB et Twemoji.

- [ ] **Step 3 : Vérifier l'absence de défilement horizontal en format téléphone**

- `mcp__playwright__browser_evaluate` :

```js
() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  ok: document.documentElement.scrollWidth <= window.innerWidth,
  gutters: (() => { const r = document.getElementById('main').getBoundingClientRect(); return { left: r.left, right: window.innerWidth - r.right }; })()
})
```

Attendu : `ok: true`, et des gouttières d'au moins 16 px de chaque côté.

- [ ] **Step 4 : Charger un exemple et vérifier le fragment d'URL**

- `mcp__playwright__browser_click` sur le bouton « Nuit urbaine »
- `mcp__playwright__browser_evaluate` : `() => ({ hash: location.hash, stickers: document.querySelectorAll('#canvas .sticker').length, sr: document.getElementById('canvas-sr').textContent })`

Attendu : un `hash` qui commence par `#t=1.`, `stickers: 5`, et `sr` valant `ville la nuit, pluie, néon violet, manteau de cuir, voiture`.

- [ ] **Step 5 : Vérifier que les résultats réels arrivent avec le jeton de Matt**

`config.local.js` est présent en local, donc l'application a déjà son jeton.

- `mcp__playwright__browser_wait_for` sur le texte du titre du premier film, ou un délai de 3 secondes
- `mcp__playwright__browser_evaluate` :

```js
() => [...document.querySelectorAll('#results-strip .card')].map(c => ({
  title: c.querySelector('.card__title').textContent,
  year: c.querySelector('.card__year').textContent,
  badge: c.querySelector('.card__badge')?.textContent || '',
  why: c.querySelector('.card__why').textContent,
  typographic: !!c.querySelector('.card__poster.is-typographic')
}))
```

Attendu : 6 cartes ; badge vide sur les trois premières, `surprise` sur les deux suivantes, `pas de côté` sur la dernière ; aucun `%` dans aucun champ.

- `mcp__playwright__browser_network_requests` : vérifier qu'il n'y a aucune requête en 401 et aucune vers un hôte autre que `api.themoviedb.org`, `image.tmdb.org`, `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com` et `localhost`.

- [ ] **Step 6 : Vérifier les gestes de la toile**

- `mcp__playwright__browser_drag` d'un sticker vers un autre point de la toile, puis `browser_evaluate` sur `location.hash` : le fragment doit avoir changé.
- `mcp__playwright__browser_drag` d'un sticker largement hors de la toile, puis compter les `.sticker` : il doit y en avoir un de moins.
- `mcp__playwright__browser_click` sur un sticker, puis `browser_snapshot` : la barre d'outils `#canvas-toolbar` doit être visible avec ses cinq boutons.
- `mcp__playwright__browser_click` sur le bouton « Agrandir », puis `browser_evaluate` sur `getComputedStyle(sticker).width` : la largeur doit avoir augmenté.

- [ ] **Step 7 : Vérifier le clavier**

- `mcp__playwright__browser_press_key` `Tab` plusieurs fois jusqu'à atteindre un `.sticker`, en contrôlant avec `browser_evaluate` sur `document.activeElement.getAttribute('aria-label')` : le libellé doit ressembler à `pluie, sticker 2 sur 5`.
- `browser_press_key` `ArrowRight`, puis `Shift+ArrowRight`, puis `+`, puis `-`, puis `r`, puis `Escape`, puis `Delete`. Après chaque touche, un `browser_evaluate` sur `location.hash` confirme que le tableau a bougé, sauf pour `Escape`.
- `browser_press_key` `Control+z` puis vérifier que le sticker supprimé est revenu.

- [ ] **Step 8 : Vérifier le partage et la sauvegarde**

- `mcp__playwright__browser_click` sur `#btn-share`, puis `browser_snapshot` : le toast « Lien copié » doit apparaître. Si le navigateur refuse l'accès au presse-papiers en contexte non sécurisé, vérifier que le repli affiche le lien dans le toast, sans erreur en console.
- `mcp__playwright__browser_click` sur `#btn-boards`, puis sur « Sauvegarder ce tableau », valider le nom prérempli, puis `browser_evaluate` : `() => JSON.parse(localStorage.getItem('frame.boards')).length` doit valoir `1`.
- Recharger un tableau sauvegardé et vérifier que le fragment redevient celui du tableau enregistré.

- [ ] **Step 9 : Vérifier la fiche film et le journal**

- `mcp__playwright__browser_click` sur la première carte, puis `browser_snapshot` : la fiche doit montrer affiche, titre, année, note, phrase d'explication, résumé et lien « Voir sur TMDB ».
- `mcp__playwright__browser_evaluate` : `() => JSON.parse(localStorage.getItem('frame.journal')).length` doit valoir `1`.
- `mcp__playwright__browser_press_key` `Escape` : la fiche doit se fermer et le focus revenir sur la carte.
- Rouvrir `#btn-boards`, onglet « Chemins » : le film ouvert doit y figurer.

- [ ] **Step 10 : Vérifier les erreurs**

- `mcp__playwright__browser_evaluate` : `() => { localStorage.setItem('frame.tmdbKey', JSON.stringify('0000000000000000000000000000dead')); }`, puis retirer temporairement `config.local.js` pour que le jeton valide ne prenne pas le dessus :

```bash
cd /Users/matt/Documents/Frame && mv config.local.js config.local.js.off
```

- Recharger, poser un sticker, attendre : la fenêtre `#panel-key` doit s'ouvrir avec « TMDB a refusé cette clé. » et la saisie conservée ; les cartes précédentes doivent rester à l'écran.
- Remettre le fichier :

```bash
cd /Users/matt/Documents/Frame && mv config.local.js.off config.local.js
```

- Fragment cassé : naviguer sur `http://localhost:8080/#t=1.ZZZZ`, vérifier que `#notice` affiche « Ce lien ne contient pas de tableau lisible. » et que la toile est vide et utilisable.

- [ ] **Step 11 : Vérifier le mode démonstration**

- `mcp__playwright__browser_navigate` sur `http://localhost:8080/?demo=1`
- `mcp__playwright__browser_evaluate` : `() => { localStorage.clear(); }`, recharger, cliquer sur « Toile vierge », poser trois stickers par le tiroir.
- Vérifier que six cartes apparaissent, qu'aucune requête réseau ne part vers `api.themoviedb.org` (`browser_network_requests`), et que la carte de « Du rififi chez les hommes » est bien typographique quand elle sort.

- [ ] **Step 12 : Vérifier le mode liste**

- `mcp__playwright__browser_navigate` sur `http://localhost:8080/?mode=liste&demo=1`
- `mcp__playwright__browser_snapshot` : l'en-tête doit être strictement identique à celui du mode toile, sans aucune mention du mode.
- Cliquer une chip, vérifier `aria-pressed="true"` ; cliquer à nouveau, vérifier la classe `is-important` et un `scale` de 2,5 dans le fragment ; cliquer une troisième fois, vérifier la désélection.
- Sélectionner exactement les mêmes stickers qu'en mode toile, avec les mêmes tailles, et comparer les six titres : ils doivent être identiques.

- [ ] **Step 13 : Refaire les blocs clés en format ordinateur**

- `mcp__playwright__browser_resize` en `1280` × `800`
- `mcp__playwright__browser_snapshot` et `browser_take_screenshot` : deux colonnes, toile à gauche jusqu'à 640 px, résultats à droite en grille.
- `mcp__playwright__browser_evaluate` sur le test de défilement horizontal du step 3 : `ok: true`.
- Refaire rapidement les steps 6, 7 et 9 à cette largeur.

- [ ] **Step 14 : Relever la console**

- `mcp__playwright__browser_console_messages` : aucune erreur JavaScript. Les seules entrées tolérées sont le 404 de `config.local.js` quand le fichier est absent, et les avertissements `[FRAME] mot-clé TMDB introuvable :` s'il en reste.

- [ ] **Step 15 : Corriger tout ce qui a échoué, puis refaire le bloc concerné**

Reprendre chaque case non cochée des steps 2 à 14, corriger le fichier en cause, recharger, revérifier. Ne pas passer au step suivant tant qu'une case reste ouverte.

- [ ] **Step 16 : Arrêter le serveur et relancer la suite complète**

```bash
cd /Users/matt/Documents/Frame && npm test
```

Attendu : `# fail 0` sur les sept fichiers de test.

- [ ] **Step 17 : Vérifier une dernière fois que `config.local.js` n'est pas dans le dépôt**

```bash
cd /Users/matt/Documents/Frame && git status --short && git log --all --name-only --pretty=format: | sort -u | grep -c '^config\.local\.js$' || echo "config.local.js jamais committé"
```

Attendu : `config.local.js jamais committé`.

- [ ] **Step 18 : Commit final**

```bash
cd /Users/matt/Documents/Frame && git add -A && \
git -c user.name="Matt" -c user.email="matt@jhmh.com" commit -m "fix: corrections issues de la vérification navigateur du prototype 1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VLCVcsNuJ2rWhjqrjN3uHV"
```

Si la vérification n'a rien révélé à corriger, sauter le commit et le dire explicitement plutôt que de créer un commit vide.

---

## Couverture de la spec

| Section de la spec | Où c'est traité |
|---|---|
| §1 contraintes non négociables | Global Constraints, tâches 1 à 11 |
| §2 architecture, modules, flux | Structure des fichiers, tâches 1 à 9 |
| §3.1 principes du vocabulaire | Tâche 2 |
| §3.2 sept tiroirs, ordre, « Lieux » par défaut | Tâche 2 (`DRAWERS`), tâche 8 (`DEFAULT_DRAWER`) |
| §3.3 atmosphères | Tâche 2 (champ `atmosphere`), tâche 7 (rendu, `prefers-reduced-motion`) |
| §4.1 modèle du tableau, plafond de 40 | Tâche 3 |
| §4.2 encodage du fragment, erreurs de décodage | Tâche 4, tâche 9 point 3 |
| §5.1 client TMDB, identifiants, cache, erreurs | Tâche 6, tâche 9 points 2, 11 et 19 |
| §5.2 deux passes, arrêt anticipé, cache | Tâche 6 (`stickerPools`) |
| §5.3 fusion et score | Tâche 5 (`scoreMovies`) |
| §5.4 sélection des six, déterminisme, stabilité | Tâche 5 (`selectMovies`) |
| §5.5 explications, pas de pourcentage | Tâche 5 (`explain`), tâche 8 (cartes et fiche) |
| §6.1 direction artistique, palette, typographie, mouvement | Tâche 1 (`tokens.css`), tâches 7 à 9 |
| §6.2 disposition téléphone et ordinateur | Tâche 1 (`base.css`), tâches 7 à 9 |
| §6.3 gestes et clavier | Tâche 7, tâche 9 points 12 et 13 |
| §6.4 premier lancement, états vides, indicateur de largeur | Tâche 9 points 4 et 21, tâche 8 (`EMPTY_MESSAGES`) |
| §6.5 partager, Mes tableaux, journal, fiche | Tâche 8 (`createSheet`), tâche 9 points 14 à 20 |
| §6.6 mode liste | Tâche 9 (`src/list.js`) |
| §7 stockage local | Tâche 6 (`storage.js`) |
| §8 erreurs et cas limites | Tâche 4, tâche 6, tâche 8, tâche 9 points 5, 11 et 19 |
| §9 tests automatiques et vérification navigateur | Tâches 2 à 6, tâche 11 |
| §10 structure des fichiers | Structure des fichiers en tête de plan |
| §11 ce que le prototype doit prouver | Tâche 9 (mode liste comparable à l'aveugle), tâche 11 step 12 |
