import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STICKERS, SCALE_MIN, SCALE_MAX, createBoard, addSticker, moveSticker,
  scaleSticker, flipSticker, removeSticker, bringToFront, clearBoard, boardSeedKey
} from '../src/board.js';

test('les constantes valent celles de la spec', () => {
  assert.equal(MAX_STICKERS, 40);
  assert.equal(SCALE_MIN, 0.5);
  assert.equal(SCALE_MAX, 3);
});

test('createBoard donne un tableau vide', () => {
  const b = createBoard();
  assert.deepEqual(b, { items: [] });
});

test('addSticker pose au centre avec les valeurs par défaut', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.deepEqual(b.items, [{ id: 'robot', x: 0.5, y: 0.5, scale: 1, flip: false }]);
});

test('addSticker accepte des options et borne position et taille', () => {
  const b = addSticker(createBoard(), 'rain', { x: 1.4, y: -0.3, scale: 9, flip: true });
  assert.deepEqual(b.items, [{ id: 'rain', x: 1, y: 0, scale: 3, flip: true }]);
});

test('addSticker ne modifie pas le tableau d\'origine', () => {
  const a = createBoard();
  const b = addSticker(a, 'robot');
  assert.equal(a.items.length, 0);
  assert.notEqual(a, b);
});

test('addSticker empile : le dernier posé est devant', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  assert.deepEqual(b.items.map(i => i.id), ['robot', 'rain']);
});

test('addSticker refuse un identifiant inconnu et renvoie le même objet', () => {
  const a = createBoard();
  assert.equal(addSticker(a, 'pas_un_sticker'), a);
});

test('addSticker refuse au-delà de 40 et renvoie le même objet', () => {
  let b = createBoard();
  for (let i = 0; i < MAX_STICKERS; i++) b = addSticker(b, 'robot');
  assert.equal(b.items.length, 40);
  assert.equal(addSticker(b, 'rain'), b);
});

test('moveSticker borne x et y entre 0 et 1', () => {
  let b = addSticker(createBoard(), 'robot');
  b = moveSticker(b, 0, 0.25, 0.75);
  assert.deepEqual([b.items[0].x, b.items[0].y], [0.25, 0.75]);
  b = moveSticker(b, 0, -5, 5);
  assert.deepEqual([b.items[0].x, b.items[0].y], [0, 1]);
});

test('moveSticker sur un index hors bornes renvoie le même objet', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.equal(moveSticker(b, 7, 0.1, 0.1), b);
  assert.equal(moveSticker(b, -1, 0.1, 0.1), b);
});

test('scaleSticker borne entre 0,5 et 3', () => {
  let b = addSticker(createBoard(), 'robot');
  b = scaleSticker(b, 0, 2.25);
  assert.equal(b.items[0].scale, 2.25);
  assert.equal(scaleSticker(b, 0, 0.1).items[0].scale, 0.5);
  assert.equal(scaleSticker(b, 0, 12).items[0].scale, 3);
});

test('flipSticker bascule le drapeau sans toucher au reste', () => {
  let b = addSticker(createBoard(), 'robot', { x: 0.2, y: 0.3, scale: 2 });
  b = flipSticker(b, 0);
  assert.deepEqual(b.items[0], { id: 'robot', x: 0.2, y: 0.3, scale: 2, flip: true });
  b = flipSticker(b, 0);
  assert.equal(b.items[0].flip, false);
});

test('removeSticker retire le bon item', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  b = addSticker(b, 'forest');
  b = removeSticker(b, 1);
  assert.deepEqual(b.items.map(i => i.id), ['robot', 'forest']);
});

test('removeSticker hors bornes renvoie le même objet', () => {
  const b = addSticker(createBoard(), 'robot');
  assert.equal(removeSticker(b, 3), b);
});

test('bringToFront déplace l\'item à la fin de la liste', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  b = addSticker(b, 'forest');
  b = bringToFront(b, 0);
  assert.deepEqual(b.items.map(i => i.id), ['rain', 'forest', 'robot']);
});

test('bringToFront sur le dernier renvoie le même objet', () => {
  let b = createBoard();
  b = addSticker(b, 'robot');
  b = addSticker(b, 'rain');
  assert.equal(bringToFront(b, 1), b);
});

test('clearBoard donne un tableau vide neuf', () => {
  const b = clearBoard();
  assert.deepEqual(b, { items: [] });
  assert.notEqual(b, clearBoard());
});

test('boardSeedKey décrit identifiants, tailles et ordre', () => {
  let b = createBoard();
  b = addSticker(b, 'robot', { scale: 1 });
  b = addSticker(b, 'rain', { scale: 2.5 });
  assert.equal(boardSeedKey(b), 'robot:1.00|rain:2.50');
  assert.equal(boardSeedKey(createBoard()), '');
});

test('boardSeedKey ignore la position mais suit l\'ordre', () => {
  let a = createBoard();
  a = addSticker(a, 'robot', { x: 0.1, y: 0.1 });
  a = addSticker(a, 'rain', { x: 0.9, y: 0.9 });
  let b = createBoard();
  b = addSticker(b, 'robot', { x: 0.7, y: 0.2 });
  b = addSticker(b, 'rain', { x: 0.3, y: 0.4 });
  assert.equal(boardSeedKey(a), boardSeedKey(b));
  assert.notEqual(boardSeedKey(a), boardSeedKey(bringToFront(a, 0)));
});
