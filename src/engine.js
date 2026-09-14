import { STICKER_BY_ID } from './stickers.js';

export const SCORE_RANK_SPAN = 80;
export const GENRE_BONUS = 0.15;
export const MIN_VOTE_AVERAGE = 5.5;
export const RESULT_COUNT = 6;

export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const weightOf = scale => Math.min(3, Math.max(0.5, Number(scale)));

export function scoreMovies(placed, pools) {
  const acc = new Map();
  for (const p of placed) {
    const pool = pools[p.id];
    if (!pool) continue;
    const w = weightOf(p.scale);
    const sticker = STICKER_BY_ID.get(p.id);
    const genres = (sticker && sticker.genres) || [];
    const best = new Map();
    for (const list of [pool.popular || [], pool.rated || []]) {
      list.forEach((movie, rank) => {
        const prev = best.get(movie.id);
        if (prev === undefined || rank < prev.rank) best.set(movie.id, { movie, rank });
      });
    }
    for (const { movie, rank } of best.values()) {
      if (Number(movie.vote_average) < MIN_VOTE_AVERAGE) continue;
      let entry = acc.get(movie.id);
      if (!entry) {
        entry = { movie, score: 0, matched: new Set(), bestRank: rank };
        acc.set(movie.id, entry);
      }
      entry.score += w * (1 - rank / SCORE_RANK_SPAN);
      if (genres.some(g => (movie.genre_ids || []).includes(g))) entry.score += GENRE_BONUS * w;
      entry.matched.add(p.id);
      if (rank < entry.bestRank) entry.bestRank = rank;
    }
  }
  return acc;
}

export function selectMovies(placed, pools, previous = [], seedKey = placed.map(p => p.id + ':' + p.scale).join('|')) {
  if (!placed.length) return [];
  const scored = scoreMovies(placed, pools);
  if (scored.size === 0) return [];
  const rng = createRng(hashString(seedKey));
  const order = placed.map(p => p.id);
  const taken = new Set();
  const picked = [];

  const makeEntry = (scoredEntry, category) => ({
    movie: scoredEntry.movie,
    category,
    matched: order.filter(id => scoredEntry.matched.has(id)),
    ignored: category === 'unexpected' ? [] : order.filter(id => !scoredEntry.matched.has(id))
  });
  const take = (scoredEntry, category) => {
    picked.push(makeEntry(scoredEntry, category));
    taken.add(scoredEntry.movie.id);
  };

  const byScore = [...scored.values()].sort((a, b) => b.score - a.score || a.movie.id - b.movie.id);

  for (const e of byScore) {
    if (picked.length >= 3) break;
    if (e.matched.size >= 2) take(e, 'evident');
  }
  for (const e of byScore) {
    if (picked.length >= 3) break;
    if (!taken.has(e.movie.id)) take(e, 'evident');
  }

  const byWeight = placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => weightOf(b.p.scale) - weightOf(a.p.scale) || a.i - b.i)
    .map(x => x.p);

  const pickRandom = list => list[Math.floor(rng() * list.length)];

  for (const p of byWeight) {
    if (picked.length >= 5) break;
    const pool = pools[p.id];
    if (!pool) continue;
    const candidates = (pool.rated || [])
      .map(m => scored.get(m.id))
      .filter(e => e && e.matched.size === 1 && !taken.has(e.movie.id))
      .sort((a, b) => b.score - a.score || a.movie.id - b.movie.id)
      .slice(0, 8);
    if (!candidates.length) continue;
    take(pickRandom(candidates), 'surprise');
    if (picked.length < 5) {
      const more = candidates.filter(e => !taken.has(e.movie.id));
      if (more.length) take(pickRandom(more), 'surprise');
    }
  }

  const rotation = [];
  const start = Math.floor(rng() * placed.length);
  for (let i = 0; i < placed.length; i++) rotation.push(placed[(start + i) % placed.length]);
  for (const p of rotation) {
    if (picked.length >= RESULT_COUNT) break;
    const pool = pools[p.id];
    if (!pool) continue;
    const deep = (pool.rated || []).slice(9, 20)
      .map(m => scored.get(m.id))
      .filter(e => e && !taken.has(e.movie.id));
    if (!deep.length) continue;
    take(pickRandom(deep), 'unexpected');
  }

  const slots = new Array(picked.length).fill(null);
  const leftovers = [];
  for (const entry of picked) {
    const at = previous.findIndex(prev => prev && prev.movie.id === entry.movie.id && prev.category === entry.category);
    if (at >= 0 && at < slots.length && slots[at] === null) slots[at] = entry;
    else leftovers.push(entry);
  }
  let cursor = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) slots[i] = leftovers[cursor++];
  }
  return slots;
}

export function explain(entry, placed) {
  const order = placed.map(p => p.id);
  const honored = order.filter(id => entry.matched.includes(id)).map(id => STICKER_BY_ID.get(id)).filter(Boolean);
  const ignored = order.filter(id => entry.ignored.includes(id)).map(id => STICKER_BY_ID.get(id)).filter(Boolean);
  const list = stickers => stickers.map(s => s.emoji).join(' ');
  let sentence;
  if (entry.category === 'unexpected') sentence = 'Pas de côté, trouvé par ' + list(honored);
  else if (!ignored.length) sentence = 'Trouvé par ' + list(honored);
  else sentence = 'Trouvé par ' + list(honored) + ', pas par ' + list(ignored);
  return { honored, ignored, sentence };
}
