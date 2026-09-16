// Mode liste (spec §6.6) : les mêmes stickers, les mêmes tiroirs, mais des
// chips au lieu d'une toile. Aucune position n'est exposée ni modifiable ;
// seule l'importance distingue deux stickers. Même moteur, mêmes résultats que
// la toile pour la même sélection.
//
// La poignée rendue a exactement la forme de celle de createCanvas :
// app.js échange l'une pour l'autre sans rien changer d'autre.

import { DRAWERS, STICKERS, twemojiUrl } from './stickers.js';
import { addSticker, scaleSticker, removeSticker } from './board.js';

/** Taille d'un sticker marqué « important » : l'équivalent d'un gros sticker. */
const IMPORTANT_SCALE = 2.5;

/**
 * Crée la liste de chips dans rootEl.
 * @param {HTMLElement} rootEl
 * @param {{onChange?: (board: object, meta: {commit: boolean}) => void,
 *          onSelect?: (index: number) => void}} handlers
 *   `onSelect` est accepté et ignoré : le mode liste n'a pas de sélection
 *   persistante, une chip n'est jamais « l'élément courant ».
 * @returns {{setBoard: Function, getBoard: Function, select: Function, destroy: Function}}
 */
export function createListPicker(rootEl, { onChange } = {}) {
  const dom = buildDom(rootEl);
  let board = { items: [] };
  let destroyed = false;

  /* ── Rendu ──────────────────────────────────────────────────────────────── */

  /**
   * L'état des chips se déduit entièrement du tableau : annuler, rétablir et la
   * restauration depuis l'URL fonctionnent donc sans état parallèle à tenir.
   */
  function render() {
    for (const [id, chip] of dom.chips) {
      const item = board.items.find(it => it.id === id);
      const important = Boolean(item) && item.scale >= IMPORTANT_SCALE;
      chip.setAttribute('aria-pressed', item ? 'true' : 'false');
      chip.classList.toggle('is-important', important);
      chip.lastElementChild.textContent = important ? ', important' : '';
    }
  }

  /* ── Sélection ──────────────────────────────────────────────────────────── */

  /**
   * Un toucher sélectionne, deux marquent « important », trois désélectionnent.
   * Le sticker visé est le premier de son identifiant : un doublon posé depuis
   * le tiroir reste dans le tableau, la chip pilote celui qu'elle a trouvé.
   */
  function nextBoard(id) {
    const index = board.items.findIndex(item => item.id === id);
    if (index < 0) return addSticker(board, id, { x: 0.5, y: 0.5, scale: 1, flip: false });
    if (board.items[index].scale < IMPORTANT_SCALE) return scaleSticker(board, index, IMPORTANT_SCALE);
    return removeSticker(board, index);
  }

  function onClick(event) {
    const chip = event.target.closest('.list__chip');
    if (!chip || !dom.list.contains(chip)) return;
    const next = nextBoard(chip.dataset.sticker);
    // Tableau plein : addSticker rend le même tableau, rien ne doit bouger.
    if (next === board) return;
    setBoard(next);
    if (onChange) onChange(board, { commit: true });
  }

  dom.list.addEventListener('click', onClick);
  render();

  /* ── Poignée publique ───────────────────────────────────────────────────── */

  function setBoard(next) {
    if (destroyed) return;
    board = next && Array.isArray(next.items) ? next : { items: [] };
    render();
  }

  function getBoard() {
    return board;
  }

  /** Sans objet en mode liste : rien n'est jamais « sélectionné » durablement. */
  function select() {}

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    dom.list.removeEventListener('click', onClick);
    dom.list.remove();
  }

  return { setBoard, getBoard, select, destroy };
}

/* ── Structure ────────────────────────────────────────────────────────────── */

function buildDom(rootEl) {
  const list = document.createElement('div');
  list.className = 'list';
  list.id = 'list';

  const chips = new Map();
  for (const drawer of DRAWERS) {
    const group = document.createElement('section');
    group.className = 'list__group';

    const title = document.createElement('h2');
    title.className = 'list__title';
    title.id = 'list-' + drawer.id;
    title.textContent = drawer.label;

    const row = document.createElement('div');
    row.className = 'list__chips';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-labelledby', title.id);

    for (const sticker of STICKERS) {
      if (sticker.drawer !== drawer.id) continue;
      const chip = createChip(sticker);
      chips.set(sticker.id, chip);
      row.append(chip);
    }

    group.append(title, row);
    list.append(group);
  }

  rootEl.replaceChildren(list);
  return { list, chips };
}

function createChip(sticker) {
  const chip = document.createElement('button');
  chip.className = 'list__chip';
  chip.type = 'button';
  chip.dataset.sticker = sticker.id;
  chip.setAttribute('aria-pressed', 'false');

  const img = document.createElement('img');
  img.className = 'list__emoji';
  img.src = twemojiUrl(sticker.emoji);
  img.alt = '';
  img.draggable = false;
  img.loading = 'lazy';

  const label = document.createElement('span');
  label.className = 'list__label';
  label.textContent = sticker.label;

  // Le point ambre des chips importantes est décoratif : c'est ce dernier
  // élément, vide le reste du temps, qui annonce « important » à la voix.
  const mark = document.createElement('span');
  mark.className = 'sr-only';

  chip.append(img, label, mark);
  return chip;
}
