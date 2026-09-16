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
