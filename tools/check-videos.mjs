/**
 * La bande-annonce existe-t-elle vraiment, et dans quelle langue ?
 *
 * L'application demande ses vidéos avec `language=fr-FR`. TMDB applique ce
 * filtre AUX VIDÉOS : un film dont les bandes-annonces ne sont qu'en anglais
 * revient vide. On compare donc ce que chaque variante de requête renvoie.
 *
 *   node tools/check-videos.mjs [id...]
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../config.local.js', import.meta.url), 'utf8');
const token = src.match(/eyJ[A-Za-z0-9_.-]{40,}/)?.[0];
if (!token) {
  console.error('Aucun jeton TMDB dans config.local.js');
  process.exit(1);
}

const ids = process.argv.slice(2);
if (!ids.length) ids.push('1204680', '969681', '1022789', '573435', '693134');

const VARIANTES = [
  ['language=fr-FR (ce que fait l’app)', '?language=fr-FR'],
  ['langue + include_video_language', '?language=fr-FR&include_video_language=fr,en,null'],
  ['include_video_language seul', '?include_video_language=fr,en,null'],
  ['aucun filtre (témoin)', '']
];

async function appel(path) {
  const r = await fetch('https://api.themoviedb.org/3' + path, {
    headers: { Authorization: 'Bearer ' + token, accept: 'application/json' }
  });
  if (!r.ok) return { statut: r.status, nb: 0, langues: '—', trailers: 0 };
  const j = await r.json();
  const res = j.results || [];
  return {
    statut: r.status,
    nb: res.length,
    langues: [...new Set(res.map(v => v.iso_639_1))].join(',') || '—',
    trailers: res.filter(v => v.type === 'Trailer').length
  };
}

let videAvecFiltre = 0;
let pleinSansFiltre = 0;

for (const id of ids) {
  const titre = await fetch('https://api.themoviedb.org/3/movie/' + id, {
    headers: { Authorization: 'Bearer ' + token }
  }).then(r => r.json()).then(j => j.title || j.name || '?').catch(() => '?');

  const resultats = [];
  for (const [nom, q] of VARIANTES) resultats.push([nom, await appel('/movie/' + id + '/videos' + q)]);

  const avec = resultats[0][1];
  const sans = resultats[3][1];
  if (avec.nb === 0 && sans.nb > 0) videAvecFiltre++;
  if (sans.nb > 0) pleinSansFiltre++;

  console.log('\n' + titre + '  (id ' + id + ')');
  for (const [nom, r] of resultats) {
    console.log('  ' + nom.padEnd(36) + r.nb + ' vidéo(s)  trailers ' + r.trailers + '  langues ' + r.langues);
  }
}

console.log('\n' + videAvecFiltre + ' / ' + ids.length + ' film(s) : vide avec le filtre, non vide sans.');
process.exit(0);
