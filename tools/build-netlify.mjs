/**
 * La construction pour Netlify.
 *
 * L'application vit dans `prototypes/emoji-card/` et importe `../../src/…`,
 * `../../room/…` et `../../styles/…`. Sur Netlify, on veut qu'elle soit servie
 * à la RACINE — une adresse propre, qu'on partage et qu'on épingle. On recopie
 * donc l'arborescence en gardant les chemins relatifs : `src/`, `room/` et
 * `styles/` se retrouvent à côté, et les `../../` se résolvent naturellement.
 *
 * Aucune dépendance, aucune transformation : on copie, et on vérifie que tout ce
 * dont la page a besoin est bien là. Une construction qui copie en silence est
 * une construction qui produit un site cassé en silence.
 *
 *   node tools/build-netlify.mjs
 */
import { cp, mkdir, rm, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(RACINE, 'dist');

/* Ce que l'application importe, en plus de son propre dossier. */
const A_COPIER = [
  ['prototypes/emoji-card', ''],
  ['src', 'src'],
  ['room', 'room'],
  ['styles', 'styles']
];

/** Ce qui ne doit JAMAIS partir en ligne. */
const EXCLUS = ['config.local.js', '.DS_Store', 'node_modules'];

async function compter(dossier) {
  let n = 0;
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    if (EXCLUS.includes(entree.name)) continue;
    n += entree.isDirectory() ? await compter(join(dossier, entree.name)) : 1;
  }
  return n;
}

async function copier(source, cible) {
  await cp(source, cible, {
    recursive: true,
    filter: chemin => !EXCLUS.some(x => chemin.includes('/' + x) || chemin.endsWith('/' + x))
  });
}

console.log('\n  Construction pour Netlify');
console.log('  ─────────────────────────────────────────────');

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

for (const [source, cible] of A_COPIER) {
  const depuis = join(RACINE, source);
  if (!existsSync(depuis)) {
    console.error('  ✗ source absente : ' + source);
    process.exit(1);
  }
  await copier(depuis, cible ? join(DIST, cible) : DIST);
  console.log('  ✓ ' + source.padEnd(24) + '→ ' + (cible || '(racine)'));
}

/* Une page d'accueil lisible pour les robots, et un favicon. */
await writeFile(join(DIST, '_headers'), [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '',
  '/.netlify/functions/*',
  '  Cache-Control: no-store',
  ''
].join('\n'));

const total = await compter(DIST);
console.log('  ─────────────────────────────────────────────');
console.log('  ' + total + ' fichiers dans dist/');
console.log('  clé TMDB dans le paquet : ' +
  (existsSync(join(DIST, 'config.local.js')) ? '⚠ PRÉSENTE — à retirer !' : 'non (le relais s’en charge)'));

/* Les fichiers sans lesquels la page ne démarre pas — ou ne ressemble à rien :
   une feuille oubliée à la construction ne casse pas le build, elle casse
   l'écran, et seulement une fois en ligne. */
const INDISPENSABLES = [
  'brand/wtf-mark.svg', 'brand/favicon.svg', 'brand/apple-touch-icon.png', 'index.html', 'themes.js', 'themes.css',
  'anime.js', 'collections.js', 'topics.js', 'discovery.js', 'graphe.js', 'catalogue.css',
  'card.js', 'card.css', 'soiree.js', 'miroir.js', 'miroir.css', 'liste.js', 'liste.css',
  'src/tmdb.js', 'src/miroir.js', 'src/profil.js', 'src/credits.js', 'src/graphe.js', 'room/rooms.js', 'styles/tokens.css'
];
const manquants = INDISPENSABLES.filter(f => !existsSync(join(DIST, f)));
if (manquants.length) {
  console.error('  ✗ manquants : ' + manquants.join(', '));
  process.exit(1);
}
console.log('  ✓ les fichiers indispensables sont là\n');
