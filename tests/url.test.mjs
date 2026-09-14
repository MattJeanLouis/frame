import test from 'node:test';
import assert from 'node:assert/strict';
import { URL_VERSION, encodeBoard, decodeBoard, boardToUrl } from '../src/url.js';
import { createBoard, addSticker, MAX_STICKERS } from '../src/board.js';
import { STICKERS } from '../src/stickers.js';

const near = (a, b, tol = 1e-2) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('la version du schéma vaut 1', () => {
  assert.equal(URL_VERSION, 1);
});

test('un tableau vide s\'encode en chaîne vide', () => {
  assert.equal(encodeBoard(createBoard()), '');
});

test('l\'encodage porte le préfixe t=1.', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.match(encodeBoard(b), /^t=1\.[A-Za-z0-9_-]+$/);
});

test('aller-retour sur un sticker unique', () => {
  const b = addSticker(createBoard(), 'city_night', { x: 0.25, y: 0.75, scale: 1.5, flip: true });
  const { board, error } = decodeBoard(encodeBoard(b));
  assert.equal(error, null);
  assert.equal(board.items.length, 1);
  assert.equal(board.items[0].id, 'city_night');
  near(board.items[0].x, 0.25);
  near(board.items[0].y, 0.75);
  near(board.items[0].scale, 1.5);
  assert.equal(board.items[0].flip, true);
});

test('aller-retour sur un tableau varié, ordre compris', () => {
  let b = createBoard();
  b = addSticker(b, 'rain', { x: 0, y: 0, scale: 0.5, flip: false });
  b = addSticker(b, 'robot', { x: 1, y: 1, scale: 3, flip: true });
  b = addSticker(b, 'tokyo', { x: 0.5, y: 0.5, scale: 1, flip: false });
  b = addSticker(b, 'silhouette', { x: 0.33, y: 0.66, scale: 2.2, flip: true });
  const { board, error } = decodeBoard(encodeBoard(b));
  assert.equal(error, null);
  assert.deepEqual(board.items.map(i => i.id), ['rain', 'robot', 'tokyo', 'silhouette']);
  b.items.forEach((src, i) => {
    near(board.items[i].x, src.x);
    near(board.items[i].y, src.y);
    near(board.items[i].scale, src.scale);
    assert.equal(board.items[i].flip, src.flip);
  });
});

test('le premier et le dernier sticker du vocabulaire survivent à l\'aller-retour', () => {
  let b = createBoard();
  b = addSticker(b, STICKERS[0].id);
  b = addSticker(b, STICKERS[STICKERS.length - 1].id);
  const { board, error } = decodeBoard(encodeBoard(b));
  assert.equal(error, null);
  assert.deepEqual(board.items.map(i => i.id), [STICKERS[0].id, STICKERS[STICKERS.length - 1].id]);
});

test('40 stickers tiennent en 275 caractères au plus', () => {
  let b = createBoard();
  for (let i = 0; i < MAX_STICKERS; i++) {
    b = addSticker(b, STICKERS[i % STICKERS.length].id, { x: i / 40, y: 1 - i / 40, scale: 0.5 + (i % 6) * 0.5, flip: i % 2 === 0 });
  }
  const encoded = encodeBoard(b);
  assert.ok(encoded.length <= 275, `longueur ${encoded.length}`);
  const { board, error } = decodeBoard(encoded);
  assert.equal(error, null);
  assert.equal(board.items.length, 40);
  assert.deepEqual(board.items.map(i => i.id), b.items.map(i => i.id));
});

test('decodeBoard accepte le dièse initial', () => {
  const encoded = encodeBoard(addSticker(createBoard(), 'robot'));
  assert.deepEqual(decodeBoard('#' + encoded).board, decodeBoard(encoded).board);
});

test('decodeBoard ignore les autres paramètres du fragment', () => {
  const encoded = encodeBoard(addSticker(createBoard(), 'robot'));
  const { board, error } = decodeBoard('#mode=liste&' + encoded + '&x=1');
  assert.equal(error, null);
  assert.deepEqual(board.items.map(i => i.id), ['robot']);
});

test('un fragment vide donne un tableau vide et l\'erreur empty', () => {
  for (const frag of ['', '#', '#mode=liste', 't=']) {
    const { board, error } = decodeBoard(frag);
    assert.deepEqual(board, { items: [] });
    assert.equal(error, 'empty', `fragment ${JSON.stringify(frag)}`);
  }
});

test('une version inconnue donne un tableau vide et l\'erreur version', () => {
  const { board, error } = decodeBoard('t=9.AAAAAAA');
  assert.deepEqual(board, { items: [] });
  assert.equal(error, 'version');
});

test('un fragment malformé donne un tableau vide et l\'erreur malformed', () => {
  for (const frag of ['t=1', 't=1.', 't=1.!!!!', 't=1.AAAA', 't=abc.AAAAAAA']) {
    const { board, error } = decodeBoard(frag);
    assert.deepEqual(board, { items: [] }, `fragment ${frag}`);
    assert.equal(error, 'malformed', `fragment ${frag}`);
  }
});

test('un index de sticker inconnu donne un tableau vide et l\'erreur unknown-sticker', () => {
  // 5 octets : index 255 (aucun sticker), x 0, y 0, scale 0, flags 0
  const bytes = [255, 0, 0, 0, 0];
  const b64 = Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const { board, error } = decodeBoard('t=1.' + b64);
  assert.deepEqual(board, { items: [] });
  assert.equal(error, 'unknown-sticker');
});

test('boardToUrl remplace le fragment sans toucher au chemin', () => {
  const b = addSticker(createBoard(), 'robot');
  const url = boardToUrl(b, 'https://matt.example/frame/index.html#t=1.VIEUX');
  assert.equal(url, 'https://matt.example/frame/index.html#' + encodeBoard(b));
  assert.ok(!url.includes('VIEUX'));
});

test('boardToUrl sur un tableau vide enlève le fragment', () => {
  assert.equal(boardToUrl(createBoard(), 'https://matt.example/frame/#t=1.VIEUX'), 'https://matt.example/frame/');
});

test('l\'encodage est stable : deux appels donnent la même chaîne', () => {
  const b = addSticker(addSticker(createBoard(), 'rain', { scale: 2 }), 'robot');
  assert.equal(encodeBoard(b), encodeBoard(b));
});
