const PREFIX = 'frame.';
const JOURNAL_MAX = 500;

function defaultBackend() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

let backend = defaultBackend();

/** Remplace le magasin sous-jacent. Sert aux tests ; passer null simule l'absence de localStorage. */
export function setStorageBackend(obj) {
  backend = obj;
}

export const storage = {
  get(key, fallback) {
    try {
      if (!backend) return fallback;
      const raw = backend.getItem(PREFIX + key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (!backend) return false;
      backend.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      if (!backend) return false;
      backend.removeItem(PREFIX + key);
      return true;
    } catch {
      return false;
    }
  }
};

// ── Identifiant TMDB ────────────────────────────────────────────────────────
export function loadCredential() {
  const value = storage.get('tmdbKey', '');
  return typeof value === 'string' ? value : '';
}
export function saveCredential(credential) {
  return storage.set('tmdbKey', String(credential || '').trim());
}
export function clearCredential() {
  return storage.remove('tmdbKey');
}

// ── Tableaux sauvegardés ────────────────────────────────────────────────────
export function loadBoards() {
  const value = storage.get('boards', []);
  return Array.isArray(value) ? value : [];
}
export function saveBoard({ name, encoded }) {
  const entry = {
    id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    name: String(name || 'Sans titre').slice(0, 60),
    encoded: String(encoded || ''),
    savedAt: Date.now()
  };
  storage.set('boards', [entry, ...loadBoards()]);
  return entry;
}
export function deleteBoard(id) {
  const next = loadBoards().filter(b => b.id !== id);
  storage.set('boards', next);
  return next;
}

// ── Journal des chemins ─────────────────────────────────────────────────────
export function loadJournal() {
  const value = storage.get('journal', []);
  return Array.isArray(value) ? value : [];
}
export function addJournalEntry({ encoded, movieId, title }) {
  const entry = { encoded: String(encoded || ''), movieId: Number(movieId), title: String(title || ''), at: Date.now() };
  const next = [entry, ...loadJournal()].slice(0, JOURNAL_MAX);
  storage.set('journal', next);
  return entry;
}

// ── Cache des mots-clés TMDB ────────────────────────────────────────────────
export function getKeywordCache() {
  const value = storage.get('kw', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function setKeywordId(name, id) {
  const cache = getKeywordCache();
  cache[name] = id;
  storage.set('kw', cache);
  return cache;
}

// ── Accueil ─────────────────────────────────────────────────────────────────
export function hasSeenIntro() {
  return storage.get('seenIntro', false) === true;
}
export function markIntroSeen() {
  return storage.set('seenIntro', true);
}

export { JOURNAL_MAX };
