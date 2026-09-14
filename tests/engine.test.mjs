import test from 'node:test';
import assert from 'node:assert/strict';
import { hashString, createRng, scoreMovies, selectMovies, explain } from '../src/engine.js';

const mv = (id, vote_average = 7, genre_ids = []) => ({
  id, title: 'Film ' + id, original_title: 'Film ' + id, release_date: '2001-01-01',
  vote_average, vote_count: 500, genre_ids, poster_path: null, overview: 'Résumé ' + id, popularity: 10
});
const seq = (from, count) => Array.from({ length: count }, (_, i) => mv(from + i));

const POOLS = {
  city_night: {
    popular: [mv(1, 8.0, [80]), mv(2, 7.8), mv(3, 7.6), mv(4, 5.0), ...seq(100, 20)],
    rated: [mv(1, 8.0, [80]), mv(2, 7.8), mv(3, 7.6), ...seq(500, 17)]
  },
  robot: {
    popular: [mv(2, 7.8), mv(1, 8.0, [80]), mv(6, 7.2), ...seq(300, 20)],
    rated: [mv(2, 7.8), mv(6, 7.2), ...seq(700, 18)]
  }
};
const PLACED_1 = [{ id: 'city_night', scale: 1 }];
const PLACED_2 = [{ id: 'city_night', scale: 1 }, { id: 'robot', scale: 1 }];
const KEY_1 = 'city_night:1.00';
const KEY_2 = 'city_night:1.00|robot:1.00';

test('hashString est FNV-1a 32 bits, stable et sensible', () => {
  assert.equal(hashString(''), 2166136261);
  assert.equal(hashString('a'), 3826002220);
  assert.equal(hashString('abc'), 440920331);
  assert.equal(hashString('robot:1.00'), hashString('robot:1.00'));
  assert.notEqual(hashString('robot:1.00'), hashString('robot:2.00'));
});

test('createRng est déterministe et reste dans [0,1)', () => {
  const a = createRng(12345); const b = createRng(12345);
  const first = [a(), a(), a(), a(), a()];
  assert.deepEqual(first, [b(), b(), b(), b(), b()]);
  for (const v of first) { assert.ok(v >= 0 && v < 1); }
  const other = createRng(999);
  assert.notDeepEqual(first, [other(), other(), other(), other(), other()]);
});

test('scoreMovies applique rang, poids et bonus de genre', () => {
  const scored = scoreMovies(PLACED_1, POOLS);
  assert.ok(Math.abs(scored.get(1).score - 1.15) < 1e-9);
  assert.ok(Math.abs(scored.get(2).score - (1 - 1 / 80)) < 1e-9);
  assert.ok(Math.abs(scored.get(3).score - (1 - 2 / 80)) < 1e-9);
  assert.deepEqual([...scored.get(1).matched], ['city_night']);
  assert.equal(scored.get(1).bestRank, 0);
});

test('scoreMovies double le score quand la taille double', () => {
  const small = scoreMovies([{ id: 'city_night', scale: 1 }], POOLS).get(3).score;
  const big = scoreMovies([{ id: 'city_night', scale: 2 }], POOLS).get(3).score;
  assert.ok(Math.abs(big - 2 * small) < 1e-9);
});

test('scoreMovies borne le poids entre 0,5 et 3', () => {
  const huge = scoreMovies([{ id: 'city_night', scale: 50 }], POOLS).get(3).score;
  const three = scoreMovies([{ id: 'city_night', scale: 3 }], POOLS).get(3).score;
  assert.equal(huge, three);
  const tiny = scoreMovies([{ id: 'city_night', scale: 0.01 }], POOLS).get(3).score;
  const half = scoreMovies([{ id: 'city_night', scale: 0.5 }], POOLS).get(3).score;
  assert.equal(tiny, half);
});

test('scoreMovies exclut les films sous 5,5 de moyenne', () => {
  assert.equal(scoreMovies(PLACED_1, POOLS).has(4), false);
});

test('scoreMovies additionne les stickers qui trouvent le même film', () => {
  const scored = scoreMovies(PLACED_2, POOLS);
  assert.deepEqual([...scored.get(1).matched].sort(), ['city_night', 'robot']);
  assert.ok(Math.abs(scored.get(1).score - (1.15 + (1 - 1 / 80))) < 1e-9);
  assert.ok(Math.abs(scored.get(2).score - ((1 - 1 / 80) + 1)) < 1e-9);
});

test('zéro sticker ne produit aucun film', () => {
  assert.deepEqual(selectMovies([], POOLS, [], ''), []);
});

test('un seul sticker donne trois évidents issus de la passe populaire', () => {
  const sel = selectMovies(PLACED_1, POOLS, [], KEY_1);
  assert.equal(sel.length, 6);
  assert.deepEqual(sel.slice(0, 3).map(e => e.movie.id), [1, 2, 3]);
  assert.deepEqual(sel.map(e => e.category), ['evident', 'evident', 'evident', 'surprise', 'surprise', 'unexpected']);
  for (const e of sel) assert.deepEqual(e.matched, ['city_night']);
});

test('deux stickers : les films trouvés par les deux passent devant', () => {
  const sel = selectMovies(PLACED_2, POOLS, [], KEY_2);
  assert.deepEqual(sel[0].movie.id, 1);
  assert.deepEqual(sel[1].movie.id, 2);
  assert.deepEqual(sel[0].matched, ['city_night', 'robot']);
  assert.deepEqual(sel[1].matched, ['city_night', 'robot']);
  assert.deepEqual(sel[0].ignored, []);
  assert.equal(sel[2].matched.length, 1);
  assert.equal(sel[2].movie.id, 6);
});

test('aucun film exclu ne ressort, aucun doublon', () => {
  for (const [placed, key] of [[PLACED_1, KEY_1], [PLACED_2, KEY_2]]) {
    const sel = selectMovies(placed, POOLS, [], key);
    const ids = sel.map(e => e.movie.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes(4));
    assert.ok(sel.length <= 6);
  }
});

test('même clé de graine, même sélection', () => {
  const a = selectMovies(PLACED_2, POOLS, [], KEY_2).map(e => e.movie.id + ':' + e.category);
  const b = selectMovies(PLACED_2, POOLS, [], KEY_2).map(e => e.movie.id + ':' + e.category);
  assert.deepEqual(a, b);
});

test('une clé de graine différente change les surprises', () => {
  const a = selectMovies(PLACED_1, POOLS, [], 'city_night:1.00').map(e => e.movie.id);
  const b = selectMovies(PLACED_1, POOLS, [], 'city_night:2.75').map(e => e.movie.id);
  assert.notDeepEqual(a.slice(3), b.slice(3));
});

test('les films déjà affichés gardent leur place', () => {
  const first = selectMovies(PLACED_2, POOLS, [], KEY_2);
  const previous = [first[1], first[0], ...first.slice(2)];
  const second = selectMovies(PLACED_2, POOLS, previous, KEY_2);
  assert.deepEqual(second.map(e => e.movie.id), previous.map(e => e.movie.id));
});

test('le film inattendu vient des rangs 10 à 20 de la passe estimée', () => {
  const sel = selectMovies(PLACED_1, POOLS, [], KEY_1);
  const last = sel[sel.length - 1];
  assert.equal(last.category, 'unexpected');
  const deepIds = POOLS.city_night.rated.slice(9, 20).map(m => m.id);
  assert.ok(deepIds.includes(last.movie.id), `${last.movie.id} hors des rangs 10 à 20`);
  assert.deepEqual(last.ignored, []);
});

test('explain nomme les stickers honorés et ignorés', () => {
  const sel = selectMovies(PLACED_2, POOLS, [], KEY_2);
  const both = explain(sel[0], PLACED_2);
  assert.deepEqual(both.honored.map(s => s.id), ['city_night', 'robot']);
  assert.deepEqual(both.ignored, []);
  assert.equal(both.sentence, 'Trouvé par 🌃 🤖');

  const one = explain({ movie: { id: 6 }, category: 'surprise', matched: ['city_night'], ignored: ['robot'] }, PLACED_2);
  assert.equal(one.sentence, 'Trouvé par 🌃, pas par 🤖');

  const aside = explain({ movie: { id: 9 }, category: 'unexpected', matched: ['city_night'], ignored: [] }, PLACED_2);
  assert.equal(aside.sentence, 'Pas de côté, trouvé par 🌃');
});

test('explain suit l\'ordre de la toile, pas celui des correspondances', () => {
  const reversed = [{ id: 'robot', scale: 1 }, { id: 'city_night', scale: 1 }];
  const out = explain({ movie: { id: 1 }, category: 'evident', matched: ['city_night', 'robot'], ignored: [] }, reversed);
  assert.deepEqual(out.honored.map(s => s.id), ['robot', 'city_night']);
  assert.equal(out.sentence, 'Trouvé par 🤖 🌃');
});
