/**
 * Sert `dist/` comme le ferait Netlify : les fichiers, plus la fonction.
 *
 * Sans cela, on ne peut pas vérifier la version publiée avant de la publier —
 * et une construction qu'on n'a jamais servie est une construction qu'on espère.
 *
 * Le jeton est lu dans `config.local.js` et posé dans l'environnement, comme
 * Netlify le fera depuis ses variables. Il n'est jamais envoyé au navigateur :
 * c'est tout l'intérêt du relais.
 *
 *   node tools/serve-dist.mjs [--port 8094]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DIST = resolve(RACINE, 'dist');
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 8094;

/* Le jeton : d'abord l'environnement (comme sur Netlify), sinon le fichier local
   que le navigateur, lui, ne recevra jamais. */
if (!process.env.TMDB_TOKEN && existsSync(join(RACINE, 'config.local.js'))) {
  const source = await readFile(join(RACINE, 'config.local.js'), 'utf8');
  const jeton = source.match(/eyJ[A-Za-z0-9_.-]{40,}/)?.[0];
  if (jeton) {
    process.env.TMDB_TOKEN = jeton;
    console.log('  jeton TMDB lu dans config.local.js (jamais servi au navigateur)');
  }
}
if (!process.env.TMDB_TOKEN) {
  console.log('  ⚠ aucun jeton : le site s’ouvrira sur le catalogue de démonstration');
}

const { default: relais } = await import('../netlify/functions/tmdb.mjs');
const { default: profil } = await import('../netlify/functions/profil.mjs');
const { default: liste } = await import('../netlify/functions/liste.mjs');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  /* Les fonctions, exactement aux chemins que Netlify leur donne. */
  const FONCTIONS = {
    '/.netlify/functions/tmdb': relais,
    '/.netlify/functions/profil': profil,
    '/.netlify/functions/liste': liste
  };
  if (FONCTIONS[url.pathname]) {
    try {
      const entrant = req.method === 'POST' || req.method === 'PUT'
        ? await new Promise((ok, ko) => { const m = []; req.on('data', x => m.push(x)); req.on('end', () => ok(Buffer.concat(m))); req.on('error', ko); })
        : undefined;
      const reponse = await FONCTIONS[url.pathname](new Request(url.href, {
        method: req.method,
        headers: req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : undefined,
        body: entrant?.length ? entrant : undefined
      }));
      const sortant = await reponse.text();
      const entetes = {};
      reponse.headers.forEach((v, k) => { entetes[k] = v; });
      res.writeHead(reponse.status, entetes);
      res.end(sortant);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ erreur: error.message }));
    }
    return;
  }

  let chemin = decodeURIComponent(url.pathname);
  if (chemin.endsWith('/')) chemin += 'index.html';
  const cible = resolve(join(DIST, normalize(chemin)));
  if (cible !== DIST && !cible.startsWith(DIST + sep)) { res.writeHead(403); res.end('Interdit'); return; }

  try {
    const infos = await stat(cible);
    if (infos.isDirectory()) throw new Error('dossier');
    const corps = await readFile(cible);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(cible).toLowerCase()] || 'application/octet-stream',
      'Content-Length': corps.length,
      'Cache-Control': 'no-store'
    });
    res.end(corps);
  } catch {
    /* Un vrai 404, comme Netlify sans redirection attrape-tout : servir la page
       à la place d'un script manquant le fait échouer en « Unexpected token
       '<' », ce qui ne dit rien à personne. */
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable : ' + chemin);
  }
});

serveur.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? '\n  Le port ' + PORT + ' est déjà utilisé. Relance avec --port 8095\n'
    : '\n  ' + error.message + '\n');
  process.exit(1);
});

serveur.listen(PORT, () => {
  console.log('\n  FRAME — version publiée, servie localement');
  console.log('  ─────────────────────────────────────────────');
  console.log('  http://localhost:' + PORT + '/');
  console.log('  fonctions  tmdb · profil · liste');
  console.log('  ─────────────────────────────────────────────\n');
});
