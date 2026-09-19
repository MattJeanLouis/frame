import { getKeywordCache, setKeywordId } from './storage.js';

export const API_BASE = 'https://api.themoviedb.org/3';
export const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const POPULAR_PAGES = 3;
export const POPULAR_MIN_VOTES = 100;
export const RATED_MIN_VOTES = 300;
export const PAGE_SIZE = 20;

export class TmdbError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
  }
}

/** @returns {'bearer'|'apikey'|null} */
export function detectAuth(credential) {
  const value = String(credential || '').trim();
  if (/^eyJ[A-Za-z0-9._-]{20,}$/.test(value)) return 'bearer';
  if (/^[0-9a-fA-F]{32}$/.test(value)) return 'apikey';
  return null;
}

export function posterUrl(path, size = 'w342') {
  return path ? IMAGE_BASE + size + path : null;
}

export function movieUrl(id) {
  return 'https://www.themoviedb.org/movie/' + id;
}

/**
 * `proxy` est le chemin d'une fonction serveur qui relaie TMDB en gardant la
 * clé chez elle. Quand il est fourni et qu'aucune clé n'est disponible côté
 * navigateur, toutes les requêtes passent par lui : la clé n'est alors jamais
 * téléchargée par le client.
 */
export function createClient({ credential, fetchImpl = fetch, proxy = null }) {
  const auth = detectAuth(credential);
  const keywordMemory = new Map();
  const stickerKeywordMemory = new Map();
  const discoverMemory = new Map();
  const poolMemory = new Map();
  const detailsMemory = new Map();

  async function request(path, params = {}) {
    /* Sans clé mais avec un relais, on passe par le relais. Sans l'un ni
       l'autre, il n'y a rien à faire — et on le dit. */
    if (!auth && !proxy) throw new TmdbError('Aucun identifiant TMDB utilisable', 401);
    const url = auth ? new URL(API_BASE + path) : new URL(proxy, location.origin);
    if (!auth) url.searchParams.set('path', path);
    url.searchParams.set('language', 'fr-FR');
    url.searchParams.set('include_adult', 'false');
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    const options = { headers: { accept: 'application/json' } };
    if (auth === 'bearer') options.headers.Authorization = 'Bearer ' + credential;
    else if (auth === 'apikey') url.searchParams.set('api_key', credential);

    let response;
    try {
      response = await fetchImpl(url.toString(), options);
    } catch (cause) {
      throw new TmdbError('Réseau indisponible', 0);
    }
    if (!response.ok) {
      throw new TmdbError('TMDB a répondu ' + response.status, response.status);
    }
    return response.json();
  }

  async function validate() {
    await request('/configuration');
    return true;
  }

  async function resolveKeyword(name) {
    if (keywordMemory.has(name)) return keywordMemory.get(name);
    const cached = getKeywordCache();
    if (Object.prototype.hasOwnProperty.call(cached, name)) {
      keywordMemory.set(name, cached[name]);
      return cached[name];
    }
    const data = await request('/search/keyword', { query: name, page: 1 });
    const results = Array.isArray(data.results) ? data.results : [];
    const exact = results.find(k => String(k.name).toLowerCase() === name.toLowerCase());
    const chosen = exact || results[0] || null;
    const id = chosen ? chosen.id : null;
    if (!chosen) console.warn('[FRAME] mot-clé TMDB introuvable :', name);
    keywordMemory.set(name, id);
    setKeywordId(name, id);
    return id;
  }

  async function resolveSticker(sticker) {
    if (stickerKeywordMemory.has(sticker.id)) return stickerKeywordMemory.get(sticker.id);
    const ids = [];
    for (const name of sticker.keywords) {
      const id = await resolveKeyword(name);
      if (typeof id === 'number') ids.push(id);
    }
    stickerKeywordMemory.set(sticker.id, ids);
    return ids;
  }

  async function discover({ keywordIds, sortBy, voteCountGte, page = 1 }) {
    const key = keywordIds.join('|') + '#' + sortBy + '#' + voteCountGte + '#' + page;
    if (discoverMemory.has(key)) return discoverMemory.get(key);
    const data = await request('/discover/movie', {
      with_keywords: keywordIds.join('|'),
      sort_by: sortBy,
      'vote_count.gte': voteCountGte,
      page
    });
    discoverMemory.set(key, data);
    return data;
  }

  async function stickerPools(sticker) {
    if (poolMemory.has(sticker.id)) return poolMemory.get(sticker.id);
    const keywordIds = await resolveSticker(sticker);
    if (!keywordIds.length) {
      const empty = { popular: [], rated: [] };
      poolMemory.set(sticker.id, empty);
      return empty;
    }
    const popular = [];
    const firstPage = await discover({ keywordIds, sortBy: 'popularity.desc', voteCountGte: POPULAR_MIN_VOTES, page: 1 });
    popular.push(...(firstPage.results || []));
    if ((firstPage.total_results || 0) >= PAGE_SIZE) {
      for (let page = 2; page <= POPULAR_PAGES; page++) {
        if (page > (firstPage.total_pages || 1)) break;
        const next = await discover({ keywordIds, sortBy: 'popularity.desc', voteCountGte: POPULAR_MIN_VOTES, page });
        const results = next.results || [];
        popular.push(...results);
        if (results.length < PAGE_SIZE) break;
      }
    }
    const ratedPage = await discover({ keywordIds, sortBy: 'vote_average.desc', voteCountGte: RATED_MIN_VOTES, page: 1 });
    const pools = { popular, rated: ratedPage.results || [] };
    poolMemory.set(sticker.id, pools);
    return pools;
  }

  async function movieDetails(id) {
    if (detailsMemory.has(id)) return detailsMemory.get(id);
    const data = await request('/movie/' + id);
    detailsMemory.set(id, data);
    return data;
  }

  return { auth, validate, resolveKeyword, resolveSticker, discover, stickerPools, movieDetails, posterUrl, movieUrl };
}
