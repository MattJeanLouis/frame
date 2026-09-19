/**
 * Le relais TMDB.
 *
 * Netlify ne sert que des fichiers statiques : sans cette fonction, la clé TMDB
 * devrait être recopiée dans la page, où n'importe qui peut la lire et l'épuiser.
 * Ici, elle reste dans les variables d'environnement de Netlify, et le navigateur
 * ne voit que `/.netlify/functions/tmdb?path=/movie/123&language=fr-FR`.
 *
 * Ce que la fonction ne fait PAS : elle n'accepte que les chemins de l'API TMDB
 * (pas d'URL absolue), ne relaie que le GET, et ne renvoie que du JSON. Un
 * relais ouvert à tout serait pire que pas de relais du tout — il permettrait de
 * faire porter n'importe quelle requête à la clé.
 *
 * Réglage : dans Netlify, Site configuration → Environment variables, ajouter
 * `TMDB_TOKEN` avec le jeton de lecture TMDB (celui qui commence par « eyJ »).
 */

const BASE = 'https://api.themoviedb.org/3';
const TYPES = ['movie', 'tv', 'person', 'collection', 'keyword', 'company', 'network'];

/** Un chemin d'API TMDB, et rien d'autre. */
function cheminValide(chemin) {
  if (typeof chemin !== 'string' || !chemin.startsWith('/')) return false;
  /* Pas de « .. », pas de « // », pas de schéma : on ne veut qu'un chemin nu. */
  if (chemin.includes('..') || chemin.includes('//') || chemin.includes(':')) return false;
  const premier = chemin.split('/')[1];
  return premier === 'search' || premier === 'discover' || premier === 'configuration' ||
    premier === 'genre' || TYPES.includes(premier);
}

const json = (corps, statut = 200, extra = {}) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      /* Une heure de cache : ces réponses ne changent pas d'une minute à l'autre,
         et la clé TMDB a une limite d'appels. */
      'cache-control': statut === 200 ? 'public, max-age=3600' : 'no-store',
      ...extra
    }
  });

export default async request => {
  const url = new URL(request.url);
  const chemin = url.searchParams.get('path');

  if (!cheminValide(chemin)) {
    return json({ erreur: 'Chemin d’API TMDB attendu dans « path ».' }, 400);
  }

  const jeton = process.env.TMDB_TOKEN || process.env.TMDB_KEY;
  if (!jeton) {
    return json({
      erreur: 'Aucune clé TMDB côté serveur. Ajoute TMDB_TOKEN dans les variables ' +
        'd’environnement Netlify (Site configuration → Environment variables).'
    }, 503);
  }

  const cible = new URL(BASE + chemin);
  for (const [cle, valeur] of url.searchParams) {
    if (cle === 'path') continue;
    cible.searchParams.set(cle, valeur);
  }
  if (!cible.searchParams.has('language')) cible.searchParams.set('language', 'fr-FR');

  /* Les mêmes en-têtes qu'en direct : jeton en porteur, ou clé en paramètre
     selon la forme de ce qui a été fourni. */
  const entetes = { accept: 'application/json' };
  if (/^eyJ[A-Za-z0-9._-]{20,}$/.test(jeton)) entetes.Authorization = 'Bearer ' + jeton;
  else cible.searchParams.set('api_key', jeton);

  try {
    const reponse = await fetch(cible, { headers: entetes });
    const texte = await reponse.text();
    return new Response(texte, {
      status: reponse.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': reponse.ok ? 'public, max-age=3600' : 'no-store'
      }
    });
  } catch (error) {
    return json({ erreur: 'TMDB injoignable : ' + error.message }, 502);
  }
};
