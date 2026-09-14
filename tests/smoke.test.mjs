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
