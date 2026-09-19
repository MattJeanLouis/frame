/**
 * Le profil synchronisé.
 *
 * Un document par code. On lit et on écrit, on ne liste jamais : le code est le
 * seul secret, et rien dans cette fonction ne permet de découvrir celui d'un
 * autre.
 *
 * CE QU'IL N'Y A PAS ICI, ET POURQUOI
 *
 * Pas d'e-mail, pas de mot de passe, pas d'identifiant de compte, pas de nom
 * d'utilisateur. Un code de douze signes tirés dans un alphabet de trente-deux
 * (32¹² ≈ 10¹⁸) sert de clé. Il n'y a donc rien à vérifier, rien à
 * réinitialiser, et aucune donnée personnelle à protéger si la base fuite — ce
 * qu'un carnet de films ne justifie pas de risquer.
 *
 * Le stockage passe par Netlify Blobs, en cohérence forte : une
 * synchronisation qui relit aussitôt ce qu'elle vient d'écrire ne doit pas
 * tomber sur une copie en retard.
 *
 * En local, `npm run servir-dist` n'a pas de Blobs : on range alors dans un
 * dossier ignoré par git, pour pouvoir éprouver la synchronisation avant de
 * publier — une fonction qu'on n'a jamais exécutée est une fonction qu'on
 * espère.
 *
 * `@netlify/blobs` est la SEULE dépendance déclarée du projet, et elle ne part
 * jamais dans le navigateur : le client reste sans aucune dépendance. Netlify
 * l'installe au moment de la construction.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const LOCAL = join(RACINE, '.profils');

const VERSION = 1;
const LONGUEUR = 12;
const TAILLE_MAX = 512 * 1024;   // un carnet de films, pas une médiathèque

const signes = saisie => String(saisie || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1');
const codeValide = saisie => signes(saisie).length === LONGUEUR;
const codePropre = saisie => signes(saisie);

const json = (corps, statut = 200) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

/* ── Le rangement ─────────────────────────────────────────────────────────── */

let memoire = null;

async function ouvrir() {
  if (memoire) return memoire;
  try {
    const { getStore } = await import('@netlify/blobs');
    /* Cohérence forte : on relit juste après avoir écrit. */
    memoire = { genre: 'blobs', store: getStore({ name: 'profils', consistency: 'strong' }) };
  } catch {
    await mkdir(LOCAL, { recursive: true });
    memoire = { genre: 'fichiers' };
  }
  return memoire;
}

async function lire(code) {
  const ou = await ouvrir();
  if (ou.genre === 'blobs') {
    const brut = await ou.store.get(code);
    if (brut === null) return null;
    try { return JSON.parse(brut); } catch { return null; }
  }
  try { return JSON.parse(await readFile(join(LOCAL, code + '.json'), 'utf8')); }
  catch { return null; }
}

async function ecrire(code, doc) {
  const ou = await ouvrir();
  const texte = JSON.stringify(doc);
  if (ou.genre === 'blobs') { await ou.store.set(code, texte); return; }
  await writeFile(join(LOCAL, code + '.json'), texte, 'utf8');
}

/* ── Les routes ───────────────────────────────────────────────────────────── */

export default async request => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!codeValide(code)) {
    return json({ erreur: 'Un code de profil fait exactement douze signes.' }, 400);
  }
  const cle = codePropre(code);

  try {
    if (request.method === 'GET') {
      const doc = await lire(cle);
      /* Un profil qui n'existe pas n'est pas une erreur : c'est une première
         synchronisation. On répond 200 avec `null`. */
      return json({ doc });
    }

    if (request.method === 'POST') {
      const corps = await request.json().catch(() => null);
      const doc = corps?.doc;
      if (!doc || typeof doc !== 'object' || doc.version !== VERSION) {
        return json({ erreur: 'Document absent ou de version inconnue.' }, 400);
      }
      const texte = JSON.stringify(doc);
      if (texte.length > TAILLE_MAX) {
        return json({ erreur: 'Profil trop volumineux (' + Math.round(texte.length / 1024) + ' Ko).' }, 413);
      }
      const existe = await lire(cle);
      await ecrire(cle, doc);
      return json({ ok: true, cree: !existe });
    }

    return json({ erreur: 'Méthode non permise.' }, 405);
  } catch (error) {
    /* On dit ce qui a échoué : une synchronisation silencieuse qui ne marche pas
       est pire qu'une synchronisation qui refuse. */
    return json({ erreur: 'Le profil n’a pas pu être ' + (request.method === 'GET' ? 'lu' : 'écrit') + ' : ' + error.message }, 502);
  }
};
