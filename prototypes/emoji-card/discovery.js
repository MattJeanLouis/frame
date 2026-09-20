/** Pagination indépendante du DOM : un curseur par source, aucun seuil de votes implicite. */
export function createDiscoverySession({ request, sources, normalize = x => x, accept = () => true, signal }) {
  const cursors = sources.map(source => ({ ...source, page: 0, pages: 1, total: 0 }));
  const seen = new Set();
  let pending = false;
  const hasMore = () => cursors.some(c => c.page < c.pages);
  return {
    get hasMore() { return hasMore(); },
    get total() { return cursors.reduce((n, c) => n + c.total, 0); },
    get loaded() { return seen.size; },
    get limited() { return cursors.some(c => c.total > 10000); },
    async next({ target = 40, maxRounds = 5 } = {}) {
      if (pending) return [];
      pending = true;
      const found = [];
      const snapshot = cursors.map(c => ({ page: c.page, pages: c.pages, total: c.total }));
      const previousSeen = new Set(seen);
      try {
        for (let round = 0; round < maxRounds && hasMore() && found.length < target; round++) {
          signal?.throwIfAborted();
          const active = cursors.filter(c => c.page < c.pages);
          const pages = await Promise.all(active.map(async c => ({ c, data: await request(c.path, { ...c.params, page: c.page + 1 }, { signal }) })));
          // Ne pas avancer les curseurs si un filtrage ou une requête échoue.
          const batches = await Promise.all(pages.map(async ({ c, data }) => {
            const raw = (data.results || []).map(x => normalize(x, c.kind));
            const flags = await Promise.all(raw.map(x => accept(x)));
            return { c, data, items: raw.filter((_, i) => flags[i]) };
          }));
          signal?.throwIfAborted();
          for (const { c, data, items } of batches) {
            c.page++;
            c.pages = Math.min(500, Math.max(0, data.total_pages ?? 1));
            c.total = data.total_results ?? data.results?.length ?? 0;
            for (const item of items) {
              const key = `${item.kind || c.kind}:${item.id}`;
              if (seen.has(key)) continue;
              seen.add(key); found.push(item);
            }
          }
        }
        return found;
      } catch (error) {
        cursors.forEach((c,i) => Object.assign(c,snapshot[i]));
        seen.clear(); previousSeen.forEach(key => seen.add(key));
        throw error;
      } finally { pending = false; }
    }
  };
}

export const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Un seul sujet rassemble des mots-clés proches en OU, jamais en intersection.
 *
 * Chaque synonyme doit EXISTER dans TMDB et porter des titres. Quatre noms
 * figuraient ici et n'existaient pas — `found footage film`, `serial murder`,
 * `based on a true story`, `sentient robot`. Ils ne gênaient pas, mais ils
 * donnaient l'illusion d'une couverture plus large. Et `artificial
 * intelligence` existait bel et bien (id 310, 300 titres) sous le nom
 * `artificial intelligence (a.i.)` : la version sans parenthèses, elle, est un
 * mot-clé quasi vide (id 272553-voisin, 3 titres).
 */
export const TOPIC_SYNONYMS = {
  ghost: ['ghost', 'haunting', 'haunted house'],
  'demonic possession': ['demonic possession', 'possession', 'exorcism'],
  zombie: ['zombie', 'zombie apocalypse'],
  vampire: ['vampire', 'vampirism'],
  'martial arts': ['martial arts', 'kung fu', 'karate'],
  heist: ['heist', 'bank robbery', 'robbery'],
  'space travel': ['space travel', 'space exploration'],
  'time travel': ['time travel', 'time loop'],
  'artificial intelligence (a.i.)': ['artificial intelligence (a.i.)', 'android'],
  'stop motion': ['stop motion', 'claymation'],
  claustrophobia: ['claustrophobia', 'claustrophobic'],
  'middle ages (476-1453)': ['middle ages (476-1453)', 'medieval times']
};

export async function resolveTopicIds(topic, request, signal) {
  const names = TOPIC_SYNONYMS[topic] || [topic];
  const matches = await Promise.all(names.map(async name => {
    const data = await request('/search/keyword', { query: name }, { signal });
    return (data.results || []).filter(k => fold(k.name) === fold(name)).map(k => k.id);
  }));
  return [...new Set(matches.flat())];
}

export function parseDiscoveryQuery(query, genres, topics) {
  const text = ' ' + fold(query) + ' ';
  const genreMatches = genres.filter(g => text.includes(' ' + fold(g.label) + ' '));
  // Un titre seul reste un titre. L'interprétation thématique est explicite dès qu'un genre est nommé.
  if (!genreMatches.length) return null;
  const topic = topics.find(t => {
    const words = fold(t[0]);
    return text.includes(' ' + words + ' ') || (words.endsWith('s') && text.includes(' ' + words.slice(0, -1) + ' '));
  });
  const remainder = fold(query).split(' ').filter(w => !['film','films','serie','series','de','des','du','d','la','le','les','avec','sur','un','une','et'].includes(w));
  const known = [...genreMatches.flatMap(g => fold(g.label).split(' ')), ...(topic ? fold(topic[0]).split(' ').flatMap(w => [w,w.replace(/s$/, '')]) : [])];
  if (remainder.some(w => !known.includes(w))) return null;
  return { genres: genreMatches.map(g => g.id), topic: topic?.[2] || null, label: [...genreMatches.map(g => g.label), ...(topic ? [topic[0]] : [])].join(' · ') };
}
