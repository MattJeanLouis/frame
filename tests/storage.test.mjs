import test from 'node:test';
import assert from 'node:assert/strict';
import {
  storage, setStorageBackend, JOURNAL_MAX,
  loadCredential, saveCredential, clearCredential,
  loadBoards, saveBoard, deleteBoard,
  loadJournal, addJournalEntry,
  getKeywordCache, setKeywordId,
  hasSeenIntro, markIntroSeen
} from '../src/storage.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

test('storage préfixe toutes les clés par « frame. » et sérialise en JSON', () => {
  const backend = fakeStorage();
  setStorageBackend(backend);
  storage.set('essai', { a: 1 });
  assert.equal(backend.map.get('frame.essai'), '{"a":1}');
  assert.deepEqual(storage.get('essai', null), { a: 1 });
});

test('storage.get renvoie la valeur de repli si la clé manque', () => {
  setStorageBackend(fakeStorage());
  assert.equal(storage.get('absente', 'repli'), 'repli');
});

test('storage.get renvoie la valeur de repli si le JSON est corrompu', () => {
  setStorageBackend(fakeStorage({ 'frame.casse': '{pas du json' }));
  assert.equal(storage.get('casse', 'repli'), 'repli');
});

test('storage.remove efface la clé', () => {
  const backend = fakeStorage();
  setStorageBackend(backend);
  storage.set('essai', 1);
  storage.remove('essai');
  assert.equal(backend.map.has('frame.essai'), false);
});

test('storage survit à un magasin qui lance', () => {
  setStorageBackend({
    getItem() { throw new Error('refusé'); },
    setItem() { throw new Error('refusé'); },
    removeItem() { throw new Error('refusé'); }
  });
  assert.equal(storage.get('x', 'repli'), 'repli');
  assert.equal(storage.set('x', 1), false);
  assert.equal(storage.remove('x'), false);
});

test('storage survit à l\'absence totale de localStorage', () => {
  setStorageBackend(null);
  assert.equal(storage.get('x', 'repli'), 'repli');
  assert.equal(storage.set('x', 1), false);
  assert.equal(loadBoards().length, 0);
  assert.equal(loadJournal().length, 0);
  assert.deepEqual(getKeywordCache(), {});
  assert.equal(hasSeenIntro(), false);
});

test('identifiant TMDB : enregistrement, lecture, effacement', () => {
  const backend = fakeStorage();
  setStorageBackend(backend);
  assert.equal(loadCredential(), '');
  saveCredential('  abc123  ');
  assert.equal(loadCredential(), 'abc123');
  assert.equal(backend.map.has('frame.tmdbKey'), true);
  clearCredential();
  assert.equal(loadCredential(), '');
});

test('saveBoard crée un identifiant et un horodatage, les plus récents d\'abord', () => {
  setStorageBackend(fakeStorage());
  const before = Date.now();
  const a = saveBoard({ name: 'Nuit urbaine', encoded: 't=1.AAAA' });
  const b = saveBoard({ name: 'Forêt étrange', encoded: 't=1.BBBB' });
  assert.equal(typeof a.id, 'string');
  assert.ok(a.id.length > 0);
  assert.notEqual(a.id, b.id);
  assert.ok(a.savedAt >= before);
  assert.deepEqual(loadBoards().map(x => x.name), ['Forêt étrange', 'Nuit urbaine']);
});

test('deleteBoard retire le bon tableau', () => {
  setStorageBackend(fakeStorage());
  const a = saveBoard({ name: 'A', encoded: 't=1.A' });
  saveBoard({ name: 'B', encoded: 't=1.B' });
  const rest = deleteBoard(a.id);
  assert.deepEqual(rest.map(x => x.name), ['B']);
  assert.deepEqual(loadBoards().map(x => x.name), ['B']);
});

test('le journal empile en tête et plafonne à 500', () => {
  setStorageBackend(fakeStorage());
  for (let i = 0; i < JOURNAL_MAX + 25; i++) {
    addJournalEntry({ encoded: 't=1.X', movieId: i, title: 'Film ' + i });
  }
  const journal = loadJournal();
  assert.equal(journal.length, JOURNAL_MAX);
  assert.equal(journal[0].movieId, JOURNAL_MAX + 24);
  assert.equal(typeof journal[0].at, 'number');
});

test('le cache de mots-clés accumule les résolutions', () => {
  setStorageBackend(fakeStorage());
  assert.deepEqual(getKeywordCache(), {});
  setKeywordId('rain', 2217);
  setKeywordId('neon', 9822);
  assert.deepEqual(getKeywordCache(), { rain: 2217, neon: 9822 });
});

test('le cache de mots-clés mémorise aussi les introuvables', () => {
  setStorageBackend(fakeStorage());
  setKeywordId('mot inexistant', null);
  assert.equal(Object.prototype.hasOwnProperty.call(getKeywordCache(), 'mot inexistant'), true);
  assert.equal(getKeywordCache()['mot inexistant'], null);
});

test('l\'accueil ne se montre qu\'une fois', () => {
  setStorageBackend(fakeStorage());
  assert.equal(hasSeenIntro(), false);
  markIntroSeen();
  assert.equal(hasSeenIntro(), true);
});
