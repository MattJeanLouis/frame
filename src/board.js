import { STICKER_BY_ID } from './stickers.js';

export const MAX_STICKERS = 40;
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 3;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = v => clamp(Number(v), 0, 1);
const clampScale = v => clamp(Number(v), SCALE_MIN, SCALE_MAX);
const inRange = (board, index) => Number.isInteger(index) && index >= 0 && index < board.items.length;

/** @returns {{items: Array<{id: string, x: number, y: number, scale: number, flip: boolean}>}} */
export function createBoard() {
  return { items: [] };
}

export function addSticker(board, id, { x = 0.5, y = 0.5, scale = 1, flip = false } = {}) {
  if (!STICKER_BY_ID.has(id)) return board;
  if (board.items.length >= MAX_STICKERS) return board;
  return {
    items: [...board.items, {
      id,
      x: clamp01(x),
      y: clamp01(y),
      scale: clampScale(scale),
      flip: Boolean(flip)
    }]
  };
}

export function moveSticker(board, index, x, y) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items[index] = { ...items[index], x: clamp01(x), y: clamp01(y) };
  return { items };
}

export function scaleSticker(board, index, scale) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items[index] = { ...items[index], scale: clampScale(scale) };
  return { items };
}

export function flipSticker(board, index) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items[index] = { ...items[index], flip: !items[index].flip };
  return { items };
}

export function removeSticker(board, index) {
  if (!inRange(board, index)) return board;
  const items = board.items.slice();
  items.splice(index, 1);
  return { items };
}

export function bringToFront(board, index) {
  if (!inRange(board, index)) return board;
  if (index === board.items.length - 1) return board;
  const items = board.items.slice();
  const [moved] = items.splice(index, 1);
  items.push(moved);
  return { items };
}

export function clearBoard() {
  return { items: [] };
}

/**
 * Clé de graine du tirage déterministe : identifiants, tailles et ordre.
 * La position est volontairement absente : elle n'influence pas les résultats.
 */
export function boardSeedKey(board) {
  return board.items.map(it => it.id + ':' + it.scale.toFixed(2)).join('|');
}
