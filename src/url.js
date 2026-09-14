import { STICKERS, STICKER_INDEX } from './stickers.js';
import { createBoard, SCALE_MIN, SCALE_MAX } from './board.js';

export const URL_VERSION = 1;

const BYTES_PER_STICKER = 5;
const SCALE_SPAN = SCALE_MAX - SCALE_MIN; // 2.5

const toByte = unit => Math.max(0, Math.min(255, Math.round(unit * 255)));
const fromByte = byte => byte / 255;

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * @param {{items: Array}} board
 * @returns {string} 't=1.<base64url>' ou '' si le tableau est vide
 */
export function encodeBoard(board) {
  if (!board || !board.items.length) return '';
  const bytes = new Uint8Array(board.items.length * BYTES_PER_STICKER);
  board.items.forEach((item, i) => {
    const at = i * BYTES_PER_STICKER;
    bytes[at] = STICKER_INDEX.get(item.id) ?? 0;
    bytes[at + 1] = toByte(item.x);
    bytes[at + 2] = toByte(item.y);
    bytes[at + 3] = toByte((item.scale - SCALE_MIN) / SCALE_SPAN);
    bytes[at + 4] = item.flip ? 1 : 0;
  });
  return 't=' + URL_VERSION + '.' + toBase64Url(bytes);
}

/**
 * Ne lance jamais. Un fragment illisible donne un tableau vide et un code d'erreur
 * que app.js affiche comme un avertissement discret.
 * @param {string} fragment  avec ou sans « # » initial
 * @returns {{board: {items: Array}, error: null|'empty'|'version'|'malformed'|'unknown-sticker'}}
 */
export function decodeBoard(fragment) {
  const fail = error => ({ board: createBoard(), error });
  const raw = String(fragment ?? '').replace(/^#/, '');
  if (!raw) return fail('empty');

  let payload = null;
  for (const part of raw.split('&')) {
    if (part.startsWith('t=')) { payload = part.slice(2); break; }
  }
  if (payload === null || payload === '') return fail('empty');

  const dot = payload.indexOf('.');
  if (dot < 0) return fail('malformed');
  const version = payload.slice(0, dot);
  const data = payload.slice(dot + 1);
  if (!/^\d+$/.test(version)) return fail('malformed');
  if (Number(version) !== URL_VERSION) return fail('version');
  if (!data || !/^[A-Za-z0-9_-]+$/.test(data)) return fail('malformed');

  let bytes;
  try {
    bytes = fromBase64Url(data);
  } catch {
    return fail('malformed');
  }
  if (bytes.length === 0 || bytes.length % BYTES_PER_STICKER !== 0) return fail('malformed');

  const items = [];
  for (let at = 0; at < bytes.length; at += BYTES_PER_STICKER) {
    const sticker = STICKERS[bytes[at]];
    if (!sticker) return fail('unknown-sticker');
    items.push({
      id: sticker.id,
      x: fromByte(bytes[at + 1]),
      y: fromByte(bytes[at + 2]),
      scale: SCALE_MIN + fromByte(bytes[at + 3]) * SCALE_SPAN,
      flip: (bytes[at + 4] & 1) === 1
    });
  }
  return { board: { items }, error: null };
}

/**
 * @param {{items: Array}} board
 * @param {string} baseHref  typiquement location.href
 */
export function boardToUrl(board, baseHref) {
  const base = String(baseHref).split('#')[0];
  const encoded = encodeBoard(board);
  return encoded ? base + '#' + encoded : base;
}
