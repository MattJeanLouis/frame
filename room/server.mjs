/**
 * Le serveur de rooms.
 *
 * Node natif, aucune dépendance. Il fait deux choses : il sert l'application
 * (pour que les autres n'aient qu'une adresse à ouvrir), et il tient l'état
 * partagé des rooms.
 *
 * Pourquoi un serveur local plutôt qu'un service en ligne : FRAME est un site
 * statique sans compte et sans clé autre que TMDB. Une soirée se passe chez
 * quelqu'un, sur le même réseau — le serveur tourne sur la machine de l'hôte,
 * les téléphones s'y connectent, et rien ne sort de la maison. Le client ne
 * connaît que l'adresse de base de l'API : brancher un relais plus tard ne
 * demandera pas de réécrire le jeu.
 *
 *   node room/server.mjs [--port 8091]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import {
  createRoom, rejoindre, partir, lancerManche, voter, reveler, conclure,
  retourAuLobby, vuePour, empreinte, expirees, codeAleatoire, tousOntFini, DECK_DEFAUT
} from './rooms.js';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || Number(process.env.PORT) || 8092;

/** Le délai de battement : sans lui, un proxy ou un téléphone en veille coupe. */
const BATTEMENT_MS = 20000;
const MENAGE_MS = 10 * 60 * 1000;
/** Un plafond de rooms. Il protège la mémoire du serveur — et, puisque le CORS
 *  est ouvert, il borne aussi ce qu'une page tierce pourrait créer. */
const ROOM_MAX = 200;

const rooms = new Map();
/** code -> Set<{ res, joueurId, empreinte }> */
const abonnes = new Map();

/* ── Les réponses ─────────────────────────────────────────────────────────── */

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
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function json(res, code, corps) {
  const texte = JSON.stringify(corps);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texte),
    'Cache-Control': 'no-store',
    ...CORS
  });
  res.end(texte);
}

function lireCorps(req, limite = 512 * 1024) {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux = [];
    req.on('data', m => {
      taille += m.length;
      if (taille > limite) { ko(new Error('corps trop volumineux')); req.destroy(); return; }
      morceaux.push(m);
    });
    req.on('end', () => {
      if (!morceaux.length) return ok({});
      try { ok(JSON.parse(Buffer.concat(morceaux).toString('utf8'))); }
      catch { ko(new Error('JSON invalide')); }
    });
    req.on('error', ko);
  });
}

/* ── Le temps réel ────────────────────────────────────────────────────────── */

/**
 * Pousse à chaque abonné SA vue, et seulement si elle a changé.
 *
 * La vue est calculée par joueur : pendant la manche, personne ne reçoit les
 * votes des autres. Le serveur ne diffuse donc jamais l'état brut.
 */
function diffuser(room) {
  const lot = abonnes.get(room.code);
  if (!lot) return;
  for (const abonne of lot) {
    const vue = vuePour(room, abonne.joueurId);
    const e = empreinte(vue);
    if (e === abonne.empreinte) continue;
    abonne.empreinte = e;
    envoyer(abonne.res, { type: 'etat', vue });
  }
}

function envoyer(res, charge) {
  try { res.write('data: ' + JSON.stringify(charge) + '\n\n'); }
  catch { /* le client est parti, le nettoyage suit */ }
}

/**
 * La manche se révèle TOUTE SEULE quand plus personne n'a rien à voter.
 *
 * Sans cela, il faudrait que l'hôte soit encore là, connecté et attentif — et
 * une partie s'arrêterait parce que le téléphone de l'hôte s'est mis en veille.
 * On laisse deux secondes avant de révéler : le temps de changer d'avis sur le
 * dernier film, pas assez pour croire que rien ne se passe.
 */
const REVELATIONS = new Map();
function surveillerLaFin(room) {
  clearTimeout(REVELATIONS.get(room.code));
  REVELATIONS.delete(room.code);
  if (room.phase !== 'manche' || !tousOntFini(room)) return;
  const minuteur = setTimeout(() => {
    REVELATIONS.delete(room.code);
    if (room.phase === 'manche' && tousOntFini(room)) { reveler(room); diffuser(room); }
  }, 2000);
  minuteur.unref?.();
  REVELATIONS.set(room.code, minuteur);
}

/** Une erreur destinée à UN seul joueur, sans toucher aux autres. */
function prevenir(code, joueurId, message) {
  for (const abonne of abonnes.get(code) || []) {
    if (abonne.joueurId === joueurId) envoyer(abonne.res, { type: 'erreur', message });
  }
}

function abonner(req, res, room, joueurId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...CORS
  });
  res.write(': bonjour\n\n');

  const abonne = { res, joueurId, empreinte: '' };
  if (!abonnes.has(room.code)) abonnes.set(room.code, new Set());
  abonnes.get(room.code).add(abonne);

  /* On envoie tout de suite l'état : un arrivant doit voir la partie en cours
     sans attendre le prochain mouvement. */
  const vue = vuePour(room, joueurId);
  abonne.empreinte = empreinte(vue);
  envoyer(res, { type: 'etat', vue });

  const battement = setInterval(() => { try { res.write(': battement\n\n'); } catch { /* parti */ } }, BATTEMENT_MS);

  const detacher = () => {
    clearInterval(battement);
    abonnes.get(room.code)?.delete(abonne);
    if (!abonnes.get(room.code)?.size) abonnes.delete(room.code);
  };
  req.on('close', detacher);
  req.on('error', detacher);
}

/* ── Les routes ───────────────────────────────────────────────────────────── */

function roomDe(code) {
  return rooms.get(String(code || '').toUpperCase()) || null;
}

/* Le CORS est ouvert, délibérément.
 *
 * Sans lui, une page servie par `npm run serve` (8090) ne peut pas parler au
 * serveur de soirée (8092) : deux ports, deux origines. Matt perdrait soit le
 * direct sur le catalogue, soit la soirée. Le serveur n'est de toute façon
 * joignable que sur le réseau local, et le seul secret est le code de la room —
 * c'est lui qui garde l'entrée, pas l'origine de la requête. Ce que le CORS
 * ouvert ouvre en plus est borné par ROOM_MAX. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '600'
};

async function api(req, res, url) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  const route = url.pathname.replace(/^\/api\/?/, '');
  const code = url.searchParams.get('code');
  const joueurId = url.searchParams.get('joueur');

  if (route === 'creer' && req.method === 'POST') {
    if (rooms.size >= ROOM_MAX) {
      return json(res, 503, { erreur: 'Trop de soirées ouvertes sur ce serveur. Réessaie dans un moment.' });
    }
    const corps = await lireCorps(req);
    let c = codeAleatoire();
    while (rooms.has(c)) c = codeAleatoire();
    const room = createRoom(c);
    rooms.set(c, room);
    const joueur = rejoindre(room, corps.nom || 'Hôte');
    return json(res, 200, { code: c, joueurId: joueur.id, deckDefaut: DECK_DEFAUT });
  }

  if (route === 'rejoindre' && req.method === 'POST') {
    const corps = await lireCorps(req);
    const room = roomDe(corps.code);
    if (!room) return json(res, 404, { erreur: 'Cette room n’existe pas. Vérifie le code.' });
    /* Une room pleine n'est pas un problème de place mais de bruit : au-delà de
       huit, on ne s'entend plus et le deck devient interminable. */
    const revient = corps.joueurId && room.joueurs.some(j => j.id === corps.joueurId);
    if (!revient && room.joueurs.length >= 8) {
      return json(res, 409, { erreur: 'Cette room est complète (8 personnes).' });
    }
    const joueur = rejoindre(room, corps.nom, { id: corps.joueurId || null });
    surveillerLaFin(room);
    diffuser(room);
    return json(res, 200, { code: room.code, joueurId: joueur.id, phase: room.phase });
  }

  if (route === 'etat' && req.method === 'GET') {
    const room = roomDe(code);
    if (!room) return json(res, 404, { erreur: 'Room inconnue.' });
    return json(res, 200, { vue: vuePour(room, joueurId) });
  }

  if (route === 'flux' && req.method === 'GET') {
    const room = roomDe(code);
    if (!room) return json(res, 404, { erreur: 'Room inconnue.' });
    return abonner(req, res, room, joueurId);
  }

  if (route === 'action' && req.method === 'POST') {
    const corps = await lireCorps(req);
    const room = roomDe(corps.code);
    if (!room) return json(res, 404, { erreur: 'Room inconnue.' });
    const joueur = room.joueurs.find(j => j.id === corps.joueurId);
    if (!joueur) return json(res, 403, { erreur: 'Tu n’es pas dans cette room.' });

    const hote = room.hote === joueur.id;
    const hoteSeul = () => {
      if (!hote) { prevenir(room.code, joueur.id, 'Seul l’hôte peut faire ça.'); return true; }
      return false;
    };

    switch (corps.type) {
      case 'partir':
        partir(room, joueur.id);
        break;
      case 'lancer':
        if (hoteSeul()) break;
        if (!lancerManche(room, corps.deck, { theme: corps.theme })) {
          prevenir(room.code, joueur.id, 'Aucun film à proposer : élargis la recherche.');
        }
        break;
      case 'voter':
        if (!voter(room, joueur.id, corps.filmKey, corps.choix)) {
          prevenir(room.code, joueur.id, 'Ce vote n’a pas pu être enregistré.');
        }
        break;
      case 'reveler':
        if (hoteSeul()) break;
        reveler(room);
        break;
      case 'conclure':
        if (hoteSeul()) break;
        conclure(room);
        break;
      case 'lobby':
        if (hoteSeul()) break;
        retourAuLobby(room);
        break;
      case 'nom':
        joueur.nom = String(corps.nom || joueur.nom).trim().slice(0, 24) || joueur.nom;
        room.activite = Date.now();
        break;
      default:
        return json(res, 400, { erreur: 'Action inconnue : ' + corps.type });
    }

    surveillerLaFin(room);
    diffuser(room);
    return json(res, 200, { ok: true, phase: room.phase });
  }

  return json(res, 404, { erreur: 'Route inconnue.' });
}

/* ── Les fichiers ─────────────────────────────────────────────────────────── */

const APP = '/prototypes/emoji-card/';

async function fichier(req, res, url) {
  let chemin = decodeURIComponent(url.pathname);
  /* La racine REDIRIGE vers l'application au lieu de servir son `index.html` :
     servi à `/`, le document prendrait `/` pour base et réclamerait `/card.css`,
     `/card.js`… qui n'existent pas là. Une redirection garde les chemins
     relatifs justes, et l'adresse reste copiable telle quelle. */
  if (chemin === '/' || chemin === '') {
    res.writeHead(302, { Location: APP + (url.search || '') });
    res.end();
    return;
  }
  if (chemin.endsWith('/')) chemin += 'index.html';
  /* Aucune remontée hors de la racine : le serveur est sur un réseau local. */
  const cible = resolve(join(RACINE, normalize(chemin)));
  if (cible !== RACINE && !cible.startsWith(RACINE + sep)) {
    res.writeHead(403); res.end('Interdit'); return;
  }
  try {
    const infos = await stat(cible);
    if (infos.isDirectory()) { res.writeHead(404); res.end('Introuvable'); return; }
    const corps = await readFile(cible);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(cible).toLowerCase()] || 'application/octet-stream',
      'Content-Length': corps.length,
      'Cache-Control': 'no-cache'
    });
    res.end(corps);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable : ' + chemin);
  }
}

/* ── Le serveur ───────────────────────────────────────────────────────────── */

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return await fichier(req, res, url);
  } catch (error) {
    if (!res.headersSent) json(res, 500, { erreur: error.message });
    else try { res.end(); } catch { /* déjà fermé */ }
  }
});

setInterval(() => {
  for (const code of expirees(rooms)) {
    clearTimeout(REVELATIONS.get(code));
    REVELATIONS.delete(code);
    rooms.delete(code);
    for (const abonne of abonnes.get(code) || []) {
      envoyer(abonne.res, { type: 'fermee', message: 'La room a expiré.' });
      try { abonne.res.end(); } catch { /* déjà fermé */ }
    }
    abonnes.delete(code);
  }
}, MENAGE_MS).unref();

function adresseLocale() {
  for (const liste of Object.values(networkInterfaces())) {
    for (const i of liste || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}

/* Un port occupé est la première panne qu'on rencontre : elle doit dire quoi
   faire, pas afficher une pile d'appels. */
serveur.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error('\n  Le port ' + PORT + ' est déjà utilisé.\n' +
      '  Relance avec un autre :  npm run room -- --port 8093\n');
  } else {
    console.error('\n  Le serveur n’a pas pu démarrer : ' + error.message + '\n');
  }
  process.exit(1);
});

serveur.listen(PORT, '0.0.0.0', () => {
  const ip = adresseLocale();
  console.log('\n  FRAME — soirée');
  console.log('  ─────────────────────────────────────────────────');
  console.log('  Sur cette machine   http://localhost:' + PORT + APP);
  console.log('  Pour les autres     http://' + ip + ':' + PORT + APP);
  console.log('  (même réseau Wi-Fi — le code de room s’affiche dans l’app)');
  console.log('  ─────────────────────────────────────────────────');
  console.log('  Ctrl+C pour arrêter.\n');
});

export { serveur };
