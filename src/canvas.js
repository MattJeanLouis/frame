// La toile : structure DOM, gestes pointeur, clavier et atmosphères.
// Le modèle reste immuable (src/board.js) ; ce module ne fait que le refléter
// dans le DOM et remonter chaque modification par onChange. Les particules sont
// dans src/particles.js, le halo des stickers dans src/halo.js.

import { STICKER_BY_ID, twemojiUrl } from './stickers.js';
import {
  moveSticker, scaleSticker, flipSticker, removeSticker, bringToFront,
  SCALE_MIN, SCALE_MAX
} from './board.js';
import { createParticles } from './particles.js';
import { haloColor } from './halo.js';

export const SCALE_STEP = 0.25;
export const MOVE_STEP = 0.02;
export const MOVE_STEP_BIG = 0.10;

const BASE_SIZE = 64;          // px, taille d'un sticker à scale 1
const DRAG_OUT_MARGIN = 0.12;  // fraction hors toile au-delà de laquelle on supprime
const CLICK_SLOP = 4;          // px, au-delà le clic est considéré comme un glissement
const TOOL_GAP = 10;           // px entre le sticker et la barre d'outils
const TOOL_EDGE = 6;           // px de marge minimale entre la barre et le bord
const ATMO_INTENSITY_MAX = 0.45;
const ATMO_LIGHT_MAX = 0.4;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const round3 = v => Math.round(v * 1000) / 1000;

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Crée la toile dans rootEl.
 * @param {HTMLElement} rootEl
 * @param {{onChange?: (board: object, meta: {commit: boolean}) => void,
 *          onSelect?: (index: number) => void}} handlers
 * @returns {{setBoard: Function, getBoard: Function, select: Function, destroy: Function}}
 */
export function createCanvas(rootEl, { onChange, onSelect } = {}) {
  const dom = buildDom(rootEl);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = createParticles(dom.particles, { reducedMotion: () => motionQuery.matches });

  let board = { items: [] };
  let selected = -1;
  let landing = new Set();       // index des stickers qui viennent d'arriver
  let srText = '';               // dernière liste annoncée, pour ne pas la réécrire
  let destroyed = false;

  // Gestes en cours : un pointeur par doigt, plus l'état de pincement.
  const pointers = new Map();    // pointerId -> { index, startX, startY, startItemX, startItemY, curX, curY }
  let pinch = null;              // { index, startDist, startScale }
  let dragMoved = 0;             // plus grand déplacement du geste, en px
  let swallowClick = false;      // un glissement vient d'avoir lieu : le clic est ignoré
  let gestureChanged = false;    // le geste a réellement modifié le tableau
  let gestureBoard = null;       // tableau validé avant le geste, pour pointercancel

  const listeners = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  };

  /* ── Rendu ──────────────────────────────────────────────────────────────── */

  function render() {
    const items = board.items;
    const total = items.length;

    for (let i = 0; i < total; i++) {
      let el = dom.stickers.children[i];
      if (!el) {
        el = createStickerEl();
        dom.stickers.append(el);
      }
      applyItem(el, items[i], i, total);
    }
    while (dom.stickers.children.length > total) {
      const gone = dom.stickers.lastElementChild;
      if (gone.contains(document.activeElement)) dom.canvas.focus({ preventScroll: true });
      gone.remove();
    }

    dom.hint.hidden = total > 0;
    landing.clear();
    renderAtmosphere();
    renderToolbar();
    renderSr();
  }

  function createStickerEl() {
    const el = document.createElement('button');
    el.className = 'sticker';
    el.type = 'button';
    const img = document.createElement('img');
    img.className = 'sticker__img';
    img.alt = '';
    img.draggable = false;
    img.loading = 'lazy';
    img.crossOrigin = 'anonymous';    // une seule requête, et le halo peut la lire
    el.append(img);
    // La classe d'arrivée se retire d'elle-même pour pouvoir se rejouer.
    el.addEventListener('animationend', () => el.classList.remove('is-landing'));
    return el;
  }

  function applyItem(el, item, index, total) {
    const sticker = STICKER_BY_ID.get(item.id);
    const label = sticker ? sticker.label.toLowerCase() : item.id;

    if (el.dataset.stickerId !== item.id) {
      el.dataset.stickerId = item.id;
      const img = el.firstElementChild;
      img.src = sticker ? twemojiUrl(sticker.emoji) : '';
      el.style.removeProperty('--halo');
      if (sticker) {
        haloColor(img).then(color => {
          if (color && el.dataset.stickerId === item.id) el.style.setProperty('--halo', color);
        });
      }
    }

    el.dataset.index = String(index);
    el.style.setProperty('--x', round3(item.x * 100) + '%');
    el.style.setProperty('--y', round3(item.y * 100) + '%');
    el.style.setProperty('--scale', String(item.scale));
    el.style.setProperty('--flip', item.flip ? '-1' : '1');
    el.setAttribute('aria-label', `${label}, sticker ${index + 1} sur ${total}`);
    el.setAttribute('aria-pressed', index === selected ? 'true' : 'false');

    if (landing.has(index)) {
      el.classList.remove('is-landing');
      void el.offsetWidth;                 // force le redémarrage de l'animation
      el.classList.add('is-landing');
    }
  }

  function renderSr() {
    const next = board.items
      .map(item => {
        const sticker = STICKER_BY_ID.get(item.id);
        return sticker ? sticker.label.toLowerCase() : item.id;
      })
      .join(', ');
    if (next === srText) return;           // un glissement ne réannonce rien
    srText = next;
    dom.sr.textContent = next;
  }

  function renderToolbar() {
    const item = board.items[selected];
    if (!item) {
      dom.toolbar.hidden = true;
      return;
    }
    dom.toolbar.hidden = false;

    const rect = dom.canvas.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const tw = dom.toolbar.offsetWidth;
    const th = dom.toolbar.offsetHeight;
    const half = (BASE_SIZE * item.scale) / 2;
    const cx = item.x * w;
    const cy = item.y * h;

    let top = cy - half - TOOL_GAP - th / 2;
    if (top - th / 2 < TOOL_EDGE) top = cy + half + TOOL_GAP + th / 2;   // bascule dessous
    top = th + 2 * TOOL_EDGE >= h ? h / 2 : clamp(top, th / 2 + TOOL_EDGE, h - th / 2 - TOOL_EDGE);
    const left = tw + 2 * TOOL_EDGE >= w ? w / 2 : clamp(cx, tw / 2 + TOOL_EDGE, w - tw / 2 - TOOL_EDGE);

    dom.toolbar.style.left = round3((left / w) * 100) + '%';
    dom.toolbar.style.top = round3((top / h) * 100) + '%';
  }

  /* ── Atmosphères (spec §3.3) ────────────────────────────────────────────── */

  function renderAtmosphere() {
    let tr = 0, tg = 0, tb = 0, tintWeight = 0;
    let intensity = 0, light = 0;
    const plan = {};

    for (const item of board.items) {
      const sticker = STICKER_BY_ID.get(item.id);
      const atmo = sticker && sticker.atmosphere;
      if (!atmo) continue;
      const weight = (atmo.intensity || 0) * item.scale;
      const rgb = hexToRgb(atmo.tint);
      if (rgb && weight > 0) {
        tr += rgb[0] * weight; tg += rgb[1] * weight; tb += rgb[2] * weight;
        tintWeight += weight;
      }
      intensity += weight;
      light += (atmo.light || 0) * item.scale;
      if (atmo.particles) plan[atmo.particles] = (plan[atmo.particles] || 0) + weight;
    }

    const style = dom.canvas.style;
    if (tintWeight > 0) {
      const r = Math.round(tr / tintWeight);
      const g = Math.round(tg / tintWeight);
      const b = Math.round(tb / tintWeight);
      style.setProperty('--atmo-tint', `rgb(${r}, ${g}, ${b})`);
      style.setProperty('--atmo-intensity', String(round3(Math.min(ATMO_INTENSITY_MAX, intensity / 2))));
    } else {
      style.setProperty('--atmo-tint', 'transparent');
      style.setProperty('--atmo-intensity', '0');
    }
    style.setProperty('--atmo-light', String(round3(clamp(light, -ATMO_LIGHT_MAX, ATMO_LIGHT_MAX))));

    particles.setPlan(plan);
  }

  function resizeParticles() {
    const rect = dom.canvas.getBoundingClientRect();
    particles.resize(Math.round(rect.width), Math.round(rect.height),
      Math.min(window.devicePixelRatio || 1, 2));
  }

  /* ── Sélection et modifications ─────────────────────────────────────────── */

  function setSelected(index) {
    const next = Number.isInteger(index) && index >= 0 && index < board.items.length ? index : -1;
    if (next === selected) {
      renderToolbar();
      return;
    }
    const previous = selected;
    selected = next;
    const before = dom.stickers.children[previous];
    if (before) before.setAttribute('aria-pressed', 'false');
    const after = dom.stickers.children[selected];
    if (after) after.setAttribute('aria-pressed', 'true');
    renderToolbar();
    if (onSelect) onSelect(selected);
  }

  /** Applique un nouveau tableau venu d'une opération locale et prévient app.js. */
  function apply(next, commit) {
    if (next === board) return false;
    board = next;
    render();
    if (onChange) onChange(board, { commit });
    return true;
  }

  // Les opérations de board.js renvoient toujours un nouvel objet, même quand le
  // bornage ramène à la valeur d'avant : on compare avant d'appliquer, sinon on
  // empile des états d'annulation identiques au précédent.

  function applyMove(index, item, x, y, commit) {
    const nx = clamp(x, 0, 1);
    const ny = clamp(y, 0, 1);
    if (nx === item.x && ny === item.y) return false;
    return apply(moveSticker(board, index, nx, ny), commit);
  }

  function applyScale(index, item, scale, commit) {
    const next = clamp(scale, SCALE_MIN, SCALE_MAX);
    if (next === item.scale) return false;
    return apply(scaleSticker(board, index, next), commit);
  }

  function indexOfEvent(event) {
    const el = event.target.closest && event.target.closest('.sticker');
    if (!el || el.parentElement !== dom.stickers) return -1;
    const index = Number(el.dataset.index);
    return Number.isInteger(index) ? index : -1;
  }

  const stickerEl = index => dom.stickers.children[index] || null;

  /* ── 1. pointerdown sur un sticker ──────────────────────────────────────── */

  function onPointerDown(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    const item = board.items[index];
    if (!item) return;

    event.preventDefault();
    const el = stickerEl(index);
    try { el.setPointerCapture(event.pointerId); } catch { /* capture facultative */ }
    el.focus({ preventScroll: true });     // preventDefault a supprimé le focus natif

    // Deuxième doigt sur le même sticker : on bascule en pincement.
    const twin = [...pointers.values()].find(p => p.index === index);
    pointers.set(event.pointerId, {
      index,
      startX: event.clientX, startY: event.clientY,
      startItemX: item.x, startItemY: item.y,
      curX: event.clientX, curY: event.clientY
    });
    if (twin) {
      pinch = {
        index,
        startDist: Math.max(1, Math.hypot(event.clientX - twin.curX, event.clientY - twin.curY)),
        startScale: item.scale
      };
    } else {
      dragMoved = 0;
      swallowClick = false;
      gestureChanged = false;
      gestureBoard = board;                // point de retour si le geste est annulé
    }

    el.classList.add('is-dragging');
    dom.canvas.classList.add('is-gesturing');
    setSelected(index);
  }

  /* ── 2. pointermove ─────────────────────────────────────────────────────── */

  function onPointerMove(event) {
    const entry = pointers.get(event.pointerId);
    if (!entry) return;
    entry.curX = event.clientX;
    entry.curY = event.clientY;

    const rect = dom.canvas.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const item = board.items[entry.index];
    if (!item) return;

    if (pinch && pinch.index === entry.index && pointers.size >= 2) {
      const pair = [...pointers.values()].filter(p => p.index === pinch.index).slice(0, 2);
      if (pair.length === 2) {
        const dist = Math.max(1, Math.hypot(pair[0].curX - pair[1].curX, pair[0].curY - pair[1].curY));
        if (applyScale(pinch.index, item, pinch.startScale * (dist / pinch.startDist), false)) {
          gestureChanged = true;
        }
      }
      return;
    }

    dragMoved = Math.max(dragMoved, Math.hypot(event.clientX - entry.startX, event.clientY - entry.startY));
    if (dragMoved > CLICK_SLOP) swallowClick = true;

    const nx = entry.startItemX + (event.clientX - entry.startX) / w;
    const ny = entry.startItemY + (event.clientY - entry.startY) / h;
    if (applyMove(entry.index, item, nx, ny, false)) gestureChanged = true;

    // Retour visuel du geste de suppression : le doigt sort franchement.
    const px = (event.clientX - rect.left) / w;
    const py = (event.clientY - rect.top) / h;
    const out = px < -DRAG_OUT_MARGIN || px > 1 + DRAG_OUT_MARGIN ||
                py < -DRAG_OUT_MARGIN || py > 1 + DRAG_OUT_MARGIN;
    const el = stickerEl(entry.index);
    if (el) el.classList.toggle('is-leaving', out);
  }

  /* ── 3. pointerup ───────────────────────────────────────────────────────── */

  function onPointerUp(event) {
    const entry = pointers.get(event.pointerId);
    if (!entry) return;
    const el = stickerEl(entry.index);
    const leaving = el ? el.classList.contains('is-leaving') : false;
    releasePointer(event, entry);

    if (stillHolding(entry.index)) {
      rebaseRemaining(entry.index);           // le doigt restant reprend le glissement
      return;
    }

    if (el) el.classList.remove('is-dragging', 'is-leaving');
    if (leaving) {
      if (el && el.contains(document.activeElement)) dom.canvas.focus({ preventScroll: true });
      apply(removeSticker(board, entry.index), true);
      setSelected(-1);
      endGesture();
      return;
    }
    // Fin du geste : on valide, mais seulement si le tableau a bougé.
    if (gestureChanged && onChange) onChange(board, { commit: true });
    endGesture();
  }

  /* ── 4. pointercancel ───────────────────────────────────────────────────── */

  function onPointerCancel(event) {
    const entry = pointers.get(event.pointerId);
    if (!entry) return;
    releasePointer(event, entry);
    if (stillHolding(entry.index)) {
      rebaseRemaining(entry.index);
      return;
    }
    const el = stickerEl(entry.index);
    if (el) el.classList.remove('is-dragging', 'is-leaving');
    // Geste avorté : le sticker revient à sa dernière position validée, et on ne
    // laisse surtout pas app.js avec un état jamais confirmé.
    if (gestureChanged && gestureBoard) apply(gestureBoard, false);
    endGesture();
  }

  function endGesture() {
    gestureChanged = false;
    gestureBoard = null;
  }

  function stillHolding(index) {
    return [...pointers.values()].some(p => p.index === index);
  }

  /** Le doigt qui reste devient la nouvelle référence : le sticker ne saute pas. */
  function rebaseRemaining(index) {
    for (const other of pointers.values()) {
      if (other.index !== index) continue;
      const item = board.items[index];
      if (!item) continue;
      other.startX = other.curX;
      other.startY = other.curY;
      other.startItemX = item.x;
      other.startItemY = item.y;
    }
  }

  function releasePointer(event, entry) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) dom.canvas.classList.remove('is-gesturing');
    const el = stickerEl(entry.index);
    if (el && el.hasPointerCapture && el.hasPointerCapture(event.pointerId)) {
      try { el.releasePointerCapture(event.pointerId); } catch { /* déjà relâchée */ }
    }
  }

  /* ── 5. molette ─────────────────────────────────────────────────────────── */

  function onWheel(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    const item = board.items[index];
    if (!item) return;
    event.preventDefault();
    applyScale(index, item, item.scale - Math.sign(event.deltaY) * SCALE_STEP, true);
  }

  /* ── 6. double clic ─────────────────────────────────────────────────────── */

  function onDoubleClick(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    event.preventDefault();
    apply(flipSticker(board, index), true);
  }

  /* ── 7. clic simple ─────────────────────────────────────────────────────── */

  function onClick(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    setSelected(index);
  }

  /* ── 8. barre d'outils ──────────────────────────────────────────────────── */

  function onToolbarClick(event) {
    const button = event.target.closest('.canvas__tool');
    if (!button) return;
    const index = selected;
    const item = board.items[index];
    if (!item) return;

    switch (button.dataset.action) {
      case 'grow':
        applyScale(index, item, item.scale + SCALE_STEP, true);
        break;
      case 'shrink':
        applyScale(index, item, item.scale - SCALE_STEP, true);
        break;
      case 'flip':
        apply(flipSticker(board, index), true);
        break;
      case 'front':
        if (apply(bringToFront(board, index), true)) setSelected(board.items.length - 1);
        break;
      case 'remove':
        dom.canvas.focus({ preventScroll: true });
        apply(removeSticker(board, index), true);
        setSelected(-1);
        break;
    }
  }

  /* ── 9. clavier ─────────────────────────────────────────────────────────── */

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      if (selected < 0) return;
      event.preventDefault();
      setSelected(-1);
      return;
    }

    const index = selected;
    const item = board.items[index];
    if (!item) return;
    const step = event.shiftKey ? MOVE_STEP_BIG : MOVE_STEP;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        applyMove(index, item, item.x - step, item.y, true);
        break;
      case 'ArrowRight':
        event.preventDefault();
        applyMove(index, item, item.x + step, item.y, true);
        break;
      case 'ArrowUp':
        event.preventDefault();
        applyMove(index, item, item.x, item.y - step, true);
        break;
      case 'ArrowDown':
        event.preventDefault();
        applyMove(index, item, item.x, item.y + step, true);
        break;
      case '+':
      case '=':
        event.preventDefault();
        applyScale(index, item, item.scale + SCALE_STEP, true);
        break;
      case '-':
      case '_':
        event.preventDefault();
        applyScale(index, item, item.scale - SCALE_STEP, true);
        break;
      case 'r':
      case 'R':
        event.preventDefault();
        apply(flipSticker(board, index), true);
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        dom.canvas.focus({ preventScroll: true });
        apply(removeSticker(board, index), true);
        setSelected(-1);
        break;
    }
  }

  /* ── 10. focus clavier ──────────────────────────────────────────────────── */

  function onFocusIn(event) {
    const index = indexOfEvent(event);
    if (index >= 0) setSelected(index);
  }

  /* ── 11. appui sur le fond ──────────────────────────────────────────────── */

  function onBackdropDown(event) {
    if (event.target.closest && event.target.closest('.sticker, .canvas__toolbar')) return;
    setSelected(-1);
  }

  /* ── 12. redimensionnement ──────────────────────────────────────────────── */

  function onResize() {
    resizeParticles();
    renderToolbar();
  }

  // 13. Le réglage système peut changer en cours de route : on repasse le plan,
  // le moteur décide alors d'animer ou de figer.
  function onMotionChange() {
    renderAtmosphere();
  }

  on(dom.stickers, 'pointerdown', onPointerDown);
  on(dom.stickers, 'pointermove', onPointerMove);
  on(dom.stickers, 'pointerup', onPointerUp);
  on(dom.stickers, 'pointercancel', onPointerCancel);
  on(dom.stickers, 'wheel', onWheel, { passive: false });
  on(dom.stickers, 'dblclick', onDoubleClick);
  on(dom.stickers, 'click', onClick);
  on(dom.toolbar, 'click', onToolbarClick);
  on(dom.canvas, 'keydown', onKeyDown);
  on(dom.stickers, 'focusin', onFocusIn);
  on(dom.canvas, 'pointerdown', onBackdropDown);
  on(window, 'resize', onResize);
  on(motionQuery, 'change', onMotionChange);

  resizeParticles();
  render();

  /* ── Poignée publique ───────────────────────────────────────────────────── */

  function setBoard(next) {
    if (destroyed) return;
    const previous = board;
    board = next && Array.isArray(next.items) ? next : { items: [] };
    landing = computeLanding(previous.items, board.items, pointers);
    if (selected >= board.items.length) setSelected(-1);
    resizeParticles();
    render();
  }

  function getBoard() {
    return board;
  }

  function select(index) {
    if (destroyed) return;
    setSelected(index);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    particles.destroy();
    for (const [target, type, fn, opts] of listeners) target.removeEventListener(type, fn, opts);
    listeners.length = 0;
    pointers.clear();
    dom.canvas.remove();
  }

  return { setBoard, getBoard, select, destroy };
}

/**
 * Stickers à animer à l'arrivée : ceux qui n'étaient pas dans le tableau
 * précédent. Un sticker seulement déplacé, redimensionné ou retourné garde son
 * index et son identifiant : ce n'est pas une arrivée, il ne rejoue rien.
 */
function computeLanding(previousItems, nextItems, pointers) {
  const known = new Set(previousItems);
  const held = new Set([...pointers.values()].map(p => p.index));
  const landing = new Set();
  for (let i = 0; i < nextItems.length; i++) {
    const item = nextItems[i];
    if (known.has(item) || held.has(i)) continue;
    const before = previousItems[i];
    if (before && before.id === item.id) continue;
    landing.add(i);
  }
  return landing;
}

function buildDom(rootEl) {
  const canvas = document.createElement('div');
  canvas.className = 'canvas';
  canvas.id = 'canvas';
  canvas.tabIndex = -1;

  const atmosphere = layer('div', 'canvas__atmosphere');
  const particles = layer('canvas', 'canvas__particles');
  const grain = layer('div', 'canvas__grain');
  const vignette = layer('div', 'canvas__vignette');

  const stickers = document.createElement('div');
  stickers.className = 'canvas__stickers';

  const toolbar = document.createElement('div');
  toolbar.className = 'canvas__toolbar';
  toolbar.id = 'canvas-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Actions du sticker');
  toolbar.hidden = true;
  for (const [action, label, glyph] of [
    ['grow', 'Agrandir', '+'],
    ['shrink', 'Réduire', '−'],
    ['flip', 'Retourner', '⇄'],
    ['front', 'Mettre devant', '▲'],
    ['remove', 'Supprimer', '✕']
  ]) {
    const button = document.createElement('button');
    button.className = 'canvas__tool';
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    button.textContent = glyph;
    toolbar.append(button);
  }

  const hint = document.createElement('p');
  hint.className = 'canvas__hint';
  hint.id = 'canvas-hint';
  hint.textContent = 'Pose un sticker, les films arrivent.';

  const sr = document.createElement('p');
  sr.className = 'canvas__sr sr-only';
  sr.id = 'canvas-sr';
  sr.setAttribute('aria-live', 'polite');

  canvas.append(atmosphere, particles, grain, vignette, stickers, toolbar, hint, sr);
  rootEl.append(canvas);
  return { canvas, atmosphere, particles, stickers, toolbar, hint, sr };
}

function layer(tag, className) {
  const el = document.createElement(tag);
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  return el;
}
