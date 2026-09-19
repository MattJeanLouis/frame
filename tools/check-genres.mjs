/**
 * Chaque genre de FRAME a-t-il vraiment des films, et des séries ?
 *
 * TMDB n'utilise PAS les mêmes identifiants de genre pour les films et pour les
 * séries : « Action » vaut 28 côté film et 10759 côté série, « Horreur » vaut 27
 * et n'existe pas côté série, « SF et fantastique » vaut 10765 et n'existe pas
 * côté film. Envoyer un identifiant de film à `/discover/tv` ne renvoie pas une
 * erreur : ça renvoie zéro résultat, en silence.
 *
 *   node tools/check-genres.mjs
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../config.local.js', import.meta.url), 'utf8');
const token = src.match(/eyJ[A-Za-z0-9_.-]{40,}/)?.[0];
if (!token) {
  console.error('Aucun jeton TMDB dans config.local.js');
  process.exit(1);
}

/* La table de l'application, recopiée telle quelle. */
const GENRES = [
  { id: 28, label: 'Action' }, { id: 12, label: 'Aventure' }, { id: 16, label: 'Animation' },
  { id: 35, label: 'Comédie' }, { id: 80, label: 'Crime' }, { id: 99, label: 'Documentaire' },
  { id: 18, label: 'Drame' }, { id: 10751, label: 'Familial' }, { id: 14, label: 'Fantastique' },
  { id: 36, label: 'Histoire' }, { id: 27, label: 'Horreur' }, { id: 10402, label: 'Musique' },
  { id: 9648, label: 'Mystère' }, { id: 10749, label: 'Romance' }, { id: 878, label: 'Science-Fiction' },
  { id: 53, label: 'Thriller' }, { id: 10752, label: 'Guerre' }, { id: 37, label: 'Western' },
  { id: 10759, label: 'Action et aventure' }, { id: 10762, label: 'Jeunesse' },
  { id: 10765, label: 'SF et fantastique' }, { id: 10768, label: 'Guerre et politique' }
];

const appel = async (chemin, params) => {
  const url = new URL('https://api.themoviedb.org/3' + chemin);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token, accept: 'application/json' } });
  if (!r.ok) return { total: 'HTTP ' + r.status };
  const j = await r.json();
  return { total: j.total_results, pages: j.total_pages };
};

/* Les genres officiels, par type — c'est la référence, pas ma table. */
const justes = {};
for (const kind of ['movie', 'tv']) {
  const j = await fetch('https://api.themoviedb.org/3/genre/' + kind + '/list?language=fr-FR', {
    headers: { Authorization: 'Bearer ' + token }
  }).then(r => r.json());
  justes[kind] = new Map((j.genres || []).map(g => [g.id, g.name]));
}

let vides = 0;
console.log('genre'.padEnd(24) + 'film'.padStart(10) + 'série'.padStart(10) + '   verdict');
console.log('─'.repeat(66));

for (const g of GENRES) {
  const [film, serie] = await Promise.all([
    appel('/discover/movie', { with_genres: g.id, 'vote_count.gte': 100 }),
    appel('/discover/tv', { with_genres: g.id, 'vote_count.gte': 100 })
  ]);
  const f = typeof film.total === 'number' ? film.total : 0;
  const s = typeof serie.total === 'number' ? serie.total : 0;
  const verdict = [];
  if (f === 0) verdict.push(justes.movie.has(g.id) ? 'FILM VIDE' : 'pas un genre de film');
  if (s === 0) verdict.push(justes.tv.has(g.id) ? 'SÉRIE VIDE' : 'pas un genre de série');
  if (f === 0 || s === 0) vides++;
  console.log(
    (g.label + ' (' + g.id + ')').padEnd(24) +
    String(f).padStart(10) + String(s).padStart(10) + '   ' + (verdict.join(' · ') || 'ok')
  );
}

console.log('\n' + vides + ' / ' + GENRES.length + ' genres n’ont pas de résultat des deux côtés.');
console.log('\nCorrespondances officielles :');
for (const g of GENRES) {
  const f = justes.movie.get(g.id), s = justes.tv.get(g.id);
  if (!f || !s) console.log('  ' + (g.label + ' (' + g.id + ')').padEnd(26) + 'film: ' + (f || '—') + '   série: ' + (s || '—'));
}
process.exit(0);
