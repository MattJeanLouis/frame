import test from 'node:test';
import assert from 'node:assert/strict';

import { scopeLabel, defaultBoardName, DEBOUNCE_MS, HISTORY_MAX } from '../src/app.js';
import { EXAMPLES } from '../src/examples.js';
import { STICKER_BY_ID } from '../src/stickers.js';
import { encodeBoard, decodeBoard } from '../src/url.js';

test('app.js s\'importe hors navigateur sans lancer l\'assemblage', () => {
  assert.equal(DEBOUNCE_MS, 400);
  assert.equal(HISTORY_MAX, 50);
});

test('scopeLabel suit les trois paliers de la spec §6.4', () => {
  assert.equal(scopeLabel(0), 'Large');
  assert.equal(scopeLabel(1), 'Large');
  assert.equal(scopeLabel(2), 'Large');
  assert.equal(scopeLabel(3), 'Précise');
  assert.equal(scopeLabel(5), 'Précise');
  assert.equal(scopeLabel(6), 'Très précise');
  assert.equal(scopeLabel(40), 'Très précise');
});

test('defaultBoardName joint les libellés des trois premiers stickers', () => {
  assert.equal(defaultBoardName(EXAMPLES[0].board), 'Ville la nuit + Pluie + Néon violet');
  assert.equal(defaultBoardName(EXAMPLES[1].board), 'Forêt + Brouillard + Loup');
});

test('defaultBoardName nomme le tableau vide', () => {
  assert.equal(defaultBoardName({ items: [] }), 'Tableau vide');
});

test('defaultBoardName ignore un sticker inconnu', () => {
  const board = { items: [{ id: 'inconnu', x: 0.5, y: 0.5, scale: 1, flip: false }, ...EXAMPLES[0].board.items] };
  assert.equal(defaultBoardName(board), 'Ville la nuit + Pluie');
});

test('les trois exemples sont valides et encodables', () => {
  assert.equal(EXAMPLES.length, 3);
  assert.deepEqual(EXAMPLES.map(e => e.id), ['night_city', 'strange_forest', 'society_drama']);
  for (const example of EXAMPLES) {
    assert.equal(example.board.items.length, 5, example.id);
    for (const item of example.board.items) {
      assert.ok(STICKER_BY_ID.has(item.id), example.id + ' : sticker inconnu ' + item.id);
    }
    const round = decodeBoard(encodeBoard(example.board));
    assert.equal(round.error, null, example.id);
    assert.deepEqual(round.board.items.map(i => i.id), example.board.items.map(i => i.id));
  }
});
