// Le tiroir : sept onglets de familles et une grille de tuiles défilante.
// Un toucher sur une tuile remonte l'identifiant du sticker et le rectangle de
// la tuile, pour que la toile puisse animer l'arrivée depuis le tiroir.

import { DRAWERS, STICKERS, STICKER_BY_ID, twemojiUrl } from './stickers.js';

/** Le tiroir ouvert au lancement, le plus discriminant (spec §6.2). */
export const DEFAULT_DRAWER = 'places';

/** Durée d'affichage du message « toile pleine ». */
export const FULL_MESSAGE_MS = 2500;

const FULL_MESSAGE = 'Ta toile est pleine, 40 stickers au maximum.';

/**
 * Crée le tiroir dans rootEl.
 * @param {HTMLElement} rootEl
 * @param {{onPick?: (stickerId: string, sourceRect: DOMRect) => void}} handlers
 * @returns {{setActiveDrawer: Function, setFull: Function}}
 */
export function createDrawer(rootEl, { onPick } = {}) {
  const dom = buildDom(rootEl);
  let activeId = DEFAULT_DRAWER;
  let isFull = false;
  let fullTimer = 0;

  /* ── Rendu ──────────────────────────────────────────────────────────────── */

  /** Reconstruit la grille avec les stickers du tiroir demandé. */
  function setActiveDrawer(id) {
    const drawer = DRAWERS.find(d => d.id === id);
    if (!drawer) return;
    activeId = drawer.id;

    for (const tab of dom.tabs.children) {
      const selected = tab.dataset.drawer === activeId;
      tab.setAttribute('aria-selected', String(selected));
      // Tabulation itinérante : un seul onglet dans l'ordre de tabulation.
      tab.tabIndex = selected ? 0 : -1;
    }
    dom.grid.setAttribute('aria-labelledby', 'tab-' + activeId);

    const fragment = document.createDocumentFragment();
    for (const sticker of STICKERS) {
      if (sticker.drawer !== activeId) continue;
      fragment.append(createTile(sticker));
    }
    dom.grid.replaceChildren(fragment);
    dom.grid.scrollLeft = 0;
  }

  function createTile(sticker) {
    const tile = document.createElement('button');
    tile.className = 'drawer__tile';
    tile.type = 'button';
    tile.dataset.sticker = sticker.id;
    tile.title = sticker.label;

    const img = document.createElement('img');
    img.className = 'drawer__img';
    img.src = twemojiUrl(sticker.emoji);
    img.alt = '';
    img.draggable = false;
    img.loading = 'lazy';

    const name = document.createElement('span');
    name.className = 'sr-only';
    name.textContent = sticker.label;

    tile.append(img, name);
    return tile;
  }

  /* ── Toile pleine ───────────────────────────────────────────────────────── */

  /** Bascule l'état « plein » : tuiles inertes et message de refus. */
  function setFull(full) {
    isFull = Boolean(full);
    dom.drawer.classList.toggle('is-full', isFull);
    if (isFull) showFullMessage();
    else hideFullMessage();
  }

  function showFullMessage() {
    dom.full.hidden = false;
    clearTimeout(fullTimer);
    fullTimer = setTimeout(hideFullMessage, FULL_MESSAGE_MS);
  }

  function hideFullMessage() {
    clearTimeout(fullTimer);
    fullTimer = 0;
    dom.full.hidden = true;
  }

  /* ── Événements ─────────────────────────────────────────────────────────── */

  function onTabClick(event) {
    const tab = event.target.closest('.drawer__tab');
    if (!tab || !dom.tabs.contains(tab)) return;
    setActiveDrawer(tab.dataset.drawer);
  }

  function onTabKeys(event) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const current = DRAWERS.findIndex(d => d.id === activeId);
    let next = current;
    if (event.key === 'ArrowLeft') next = (current - 1 + DRAWERS.length) % DRAWERS.length;
    else if (event.key === 'ArrowRight') next = (current + 1) % DRAWERS.length;
    else if (event.key === 'Home') next = 0;
    else next = DRAWERS.length - 1;
    event.preventDefault();
    setActiveDrawer(DRAWERS[next].id);
    const tab = dom.tabs.querySelector('#tab-' + DRAWERS[next].id);
    if (tab) tab.focus();
  }

  function onTileClick(event) {
    // Quand le tiroir est plein les tuiles sont inertes : le clic arrive sur la
    // grille, il ne sert plus qu'à rappeler pourquoi rien ne se pose.
    if (isFull) {
      showFullMessage();
      return;
    }
    const tile = event.target.closest('.drawer__tile');
    if (!tile || !dom.grid.contains(tile)) return;
    const id = tile.dataset.sticker;
    if (!STICKER_BY_ID.has(id)) return;
    if (onPick) onPick(id, tile.getBoundingClientRect());
  }

  dom.tabs.addEventListener('click', onTabClick);
  dom.tabs.addEventListener('keydown', onTabKeys);
  dom.grid.addEventListener('click', onTileClick);

  setActiveDrawer(DEFAULT_DRAWER);

  return { setActiveDrawer, setFull };
}

/* ── Structure ────────────────────────────────────────────────────────────── */

function buildDom(rootEl) {
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'drawer';

  const tabs = document.createElement('div');
  tabs.className = 'drawer__tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Tiroirs de stickers');
  for (const entry of DRAWERS) {
    const tab = document.createElement('button');
    tab.className = 'drawer__tab';
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.id = 'tab-' + entry.id;
    tab.dataset.drawer = entry.id;
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-controls', 'drawer-grid');
    tab.tabIndex = -1;
    tab.textContent = entry.label;
    tabs.append(tab);
  }

  const grid = document.createElement('div');
  grid.className = 'drawer__grid';
  grid.id = 'drawer-grid';
  grid.setAttribute('role', 'tabpanel');

  const full = document.createElement('p');
  full.className = 'drawer__full';
  full.id = 'drawer-full';
  full.setAttribute('role', 'status');
  full.hidden = true;
  full.textContent = FULL_MESSAGE;

  drawer.append(tabs, grid, full);
  rootEl.replaceChildren(drawer);
  return { drawer, tabs, grid, full };
}
