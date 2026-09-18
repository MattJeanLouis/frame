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
