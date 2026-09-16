// L'assemblage : c'est ici que les modules deviennent une application.
// Un seul état vit dans ce fichier — le tableau courant, ses piles d'annulation
// et la dernière sélection de films — et une seule fonction, commit(), le fait
// avancer : toile, URL, en-tête, tiroir et recherche en découlent.
//
// Les fonctions pures exportées (scopeLabel, defaultBoardName) restent
// importables hors navigateur : l'assemblage n'est lancé que si document existe.

import { createBoard, addSticker, clearBoard, boardSeedKey, MAX_STICKERS } from './board.js';
import { STICKER_BY_ID, twemojiUrl } from './stickers.js';
import { encodeBoard, decodeBoard, boardToUrl } from './url.js';
import { selectMovies } from './engine.js';
import { createClient, detectAuth, TmdbError } from './tmdb.js';
import { createDemoClient } from './demo.js';
import {
  loadCredential, saveCredential, clearCredential,
  loadBoards, saveBoard, deleteBoard, loadJournal, addJournalEntry,
  hasSeenIntro, markIntroSeen
} from './storage.js';
import { createCanvas } from './canvas.js';
import { createListPicker } from './list.js';
import { createDrawer, DEFAULT_DRAWER } from './drawer.js';
import { createResults, createSheet } from './results.js';
import { EXAMPLES } from './examples.js';

/** Attente après le dernier geste avant de chercher. Miroir du jeton --d-debounce. */
export const DEBOUNCE_MS = 400;
/** Profondeur de la pile d'annulation (spec §6.3). */
export const HISTORY_MAX = 50;

const CLEAR_TOAST_MS = 5000;
const COPY_TOAST_MS = 2000;
const LINK_TOAST_MS = 12000;
const JITTER = 0.18;                     // variation de position à la pose

const NOTICE_TEXT = 'Ce lien ne contient pas de tableau lisible.';
const KEY_SHAPE_ERROR = 'Cette clé n\'a pas la bonne forme. Une clé v3 fait 32 caractères, un jeton v4 commence par eyJ.';
const KEY_REFUSED = 'TMDB a refusé cette clé.';
const KEY_OFFLINE = 'Impossible de joindre TMDB. Vérifie ta connexion.';
const SAVE_HINT_EMPTY = 'Pose au moins un sticker avant de sauvegarder.';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
const DATE_TIME_FMT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/** Largeur de la recherche (spec §6.4) : une information, jamais une injonction. */
export function scopeLabel(count) {
  if (count >= 6) return 'Très précise';
  if (count >= 3) return 'Précise';
  return 'Large';
}

/** Nom proposé à la sauvegarde : les trois premiers stickers du tableau. */
export function defaultBoardName(board) {
  const names = board.items.slice(0, 3).map(i => STICKER_BY_ID.get(i.id)?.label).filter(Boolean);
  return names.length ? names.join(' + ') : 'Tableau vide';
}

/* ── Panneaux ─────────────────────────────────────────────────────────────── */

// Structure figée, sans aucune donnée extérieure : elle s'écrit ici en un bloc
// lisible. Tout ce qui porte une donnée (listes, miniatures) est construit
// élément par élément plus bas.
const PANELS_HTML = `
<div class="panel" id="panel-boards" role="dialog" aria-modal="true" aria-labelledby="panel-boards-title" hidden>
  <div class="panel__backdrop" data-close="boards"></div>
  <div class="panel__body">
    <h2 class="panel__title" id="panel-boards-title">Mes tableaux</h2>
    <button class="panel__close hbtn" type="button" data-close="boards" aria-label="Fermer">✕</button>
    <div class="panel__tabs" role="tablist">
      <button class="panel__tab" type="button" role="tab" id="tab-saved" data-tab="saved" aria-selected="true">Tableaux</button>
      <button class="panel__tab" type="button" role="tab" id="tab-paths" data-tab="paths" aria-selected="false">Chemins</button>
    </div>
    <div class="panel__pane" id="pane-saved" role="tabpanel" aria-labelledby="tab-saved">
      <label class="panel__label" for="board-name">Nom du tableau</label>
      <input class="panel__input" id="board-name" type="text" maxlength="40">
      <button class="panel__action hbtn" type="button" id="btn-save-board">Sauvegarder ce tableau</button>
      <ul class="panel__list" id="saved-list"></ul>
      <p class="panel__empty" id="saved-empty">Aucun tableau sauvegardé pour l'instant.</p>
    </div>
    <div class="panel__pane" id="pane-paths" role="tabpanel" aria-labelledby="tab-paths" hidden>
      <ul class="panel__list" id="paths-list"></ul>
      <p class="panel__empty" id="paths-empty">Ouvre une fiche film et ton chemin s'inscrira ici.</p>
    </div>
  </div>
</div>

<div class="panel" id="panel-key" role="dialog" aria-modal="true" aria-labelledby="panel-key-title" hidden>
  <div class="panel__backdrop" data-close="key"></div>
  <div class="panel__body">
    <h2 class="panel__title" id="panel-key-title">Ta clé TMDB</h2>
    <button class="panel__close hbtn" type="button" data-close="key" aria-label="Fermer">✕</button>
    <p class="panel__lead">FRAME va chercher les films chez TMDB. Il te faut une clé gratuite.</p>
    <ol class="panel__steps">
      <li>Crée un compte sur themoviedb.org.</li>
      <li>Ouvre Réglages, puis API, et demande une clé.</li>
      <li>Colle ici la clé v3 ou le jeton de lecture v4.</li>
    </ol>
    <a class="panel__link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Ouvrir la page API de TMDB</a>
    <label class="panel__label" for="key-input">Clé ou jeton</label>
    <input class="panel__input" id="key-input" type="password" autocomplete="off" spellcheck="false" placeholder="eyJ… ou 32 caractères">
    <p class="panel__error" id="key-error" role="alert" hidden></p>
    <button class="panel__action hbtn" type="button" id="btn-key-save">Valider et enregistrer</button>
  </div>
</div>`;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Le focus tourne en rond dans le panneau ouvert, comme dans la fiche film. */
function trapTab(event, container) {
  const items = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = !container.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

/** Miniature d'un tableau : les stickers à leur place, en petit. */
function fillThumb(el, board) {
  const imgs = [];
  for (const item of board.items) {
    const sticker = STICKER_BY_ID.get(item.id);
    if (!sticker) continue;
    const img = document.createElement('img');
    img.className = 'thumb__sticker';
    img.src = twemojiUrl(sticker.emoji);
    img.alt = '';
    img.draggable = false;
    img.loading = 'lazy';
    img.style.left = Math.round(item.x * 1000) / 10 + '%';
    img.style.top = Math.round(item.y * 1000) / 10 + '%';
    img.style.setProperty('--scale', String(item.scale));
    img.style.setProperty('--flip', item.flip ? '-1' : '1');
    imgs.push(img);
  }
  el.replaceChildren(...imgs);
}

/** Copie profonde d'un tableau d'exemple : les constantes restent intactes. */
function cloneBoard(board) {
  return { items: board.items.map(item => ({ ...item })) };
}

/* ── Assemblage ───────────────────────────────────────────────────────────── */

function start() {
  const params = new URLSearchParams(location.search);
  const isList = params.get('mode') === 'liste';
  const isDemo = params.get('demo') === '1';

  const el = id => document.getElementById(id);
  const headerEl = {
    undo: el('btn-undo'), redo: el('btn-redo'), boards: el('btn-boards'), share: el('btn-share')
  };
  const noticeEl = el('notice');
  const toastEl = el('toast');
  const scopeEl = el('scope');
  const examplesEl = el('examples');

  el('panels-host').innerHTML = PANELS_HTML;
  const panels = {
    boards: el('panel-boards'),
    key: el('panel-key'),
    savedList: el('saved-list'),
    savedEmpty: el('saved-empty'),
    pathsList: el('paths-list'),
    pathsEmpty: el('paths-empty'),
    paneSaved: el('pane-saved'),
    panePaths: el('pane-paths'),
    tabSaved: el('tab-saved'),
    tabPaths: el('tab-paths'),
    boardName: el('board-name'),
    saveBoard: el('btn-save-board'),
    keyInput: el('key-input'),
    keyError: el('key-error'),
    keySave: el('btn-key-save')
  };

  /* ── État ─────────────────────────────────────────────────────────────── */

  let board = createBoard();
  // Le tableau d'avant le geste en cours : c'est lui qui entrera dans la pile
  // d'annulation. Hors geste, il est toujours égal à board.
  let base = board;
  let past = [];
  let future = [];
  let lastSelection = [];
  let timer = 0;
  let run = 0;                 // numéro de la recherche en cours
  let ownHash = location.hash; // dernier fragment écrit par nous
  let toastTimer = 0;
  let openedPanel = null;
  let lastFocused = null;

  let credential = isDemo
    ? ''
    : (window.FRAME_CONFIG?.tmdbToken || window.FRAME_CONFIG?.tmdbKey || loadCredential());
  let client = isDemo ? createDemoClient() : createClient({ credential });

  const placedNow = () => board.items.map(item => ({ id: item.id, scale: item.scale }));
  const hasKey = () => isDemo || detectAuth(credential) !== null;

  /* ── Vues ─────────────────────────────────────────────────────────────── */

  // La fiche film garde cette façade : le client change quand une clé est
  // saisie, la fiche continue d'interroger le bon.
  const sheet = createSheet(el('sheet-host'), {
    client: { movieDetails: id => client.movieDetails(id) },
    onJournal: entry => addJournalEntry({
      encoded: encodeBoard(board),
      movieId: entry.movie.id,
      title: entry.movie.title
    })
  });

  const results = createResults(el('results-host'), {
    onOpen: entry => sheet.open(entry, placedNow())
  });

  const makePicker = isList ? createListPicker : createCanvas;
  const picker = makePicker(el('canvas-host'), {
    // Un geste en cours n'est qu'un aperçu ; la toile le valide en relâchant,
    // avec le même tableau, et c'est là que la pile d'annulation se remplit.
    onChange: (next, { commit: isCommit }) => (isCommit ? commit(next) : preview(next)),
    onSelect: () => {}
  });

  // Le sticker se pose au centre, avec une petite variation de position.
  const jitter = () => 0.5 + (Math.random() - 0.5) * JITTER;

  const drawer = createDrawer(el('drawer-host'), {
    // sourceRect est ignoré : la toile anime l'arrivée toute seule, à partir
    // des stickers que setBoard découvre.
    onPick(id) {
      if (board.items.length >= MAX_STICKERS) {
        drawer.setFull(true);
        return;
      }
      commit(addSticker(board, id, { x: jitter(), y: jitter() }));
    }
  });

  /* ── Cœur : une seule porte d'entrée pour changer de tableau ───────────── */

  function commit(next, { push = true } = {}) {
    if (next === board && next === base) return;
    if (push && next !== base) {
      past.push(base);
      if (past.length > HISTORY_MAX) past.shift();
      future = [];
    }
    base = next;
    if (next !== board) {
      board = next;
      // Le tableau vient souvent du sélecteur lui-même, qui s'est déjà
      // redessiné : le lui repasser ferait un rendu de plus pour rien.
      if (picker.getBoard() !== board) picker.setBoard(board);
    }
    settle();
  }

  /**
   * Image intermédiaire d'un geste : l'écran, le fragment et le debounce
   * suivent le doigt, la pile d'annulation attend le relâchement.
   */
  function preview(next) {
    if (next === board) return;
    board = next;
    settle();
  }

  /** Ce que toute modification du tableau entraîne, geste en cours ou non. */
  function settle() {
    writeHash();
    renderChrome();
    hideExamples();
    hideNotice();
    schedule();
  }

  function writeHash() {
    const url = boardToUrl(board, location.href);
    const at = url.indexOf('#');
    ownHash = at < 0 ? '' : url.slice(at);
    history.replaceState(null, '', url);
  }

  function renderChrome() {
    const count = board.items.length;
    scopeEl.hidden = count < 3;
    scopeEl.textContent = count < 3 ? '' : scopeLabel(count);
    headerEl.undo.disabled = past.length === 0;
    headerEl.redo.disabled = future.length === 0;
    drawer.setFull(count >= MAX_STICKERS);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(search, DEBOUNCE_MS);
  }

  /* ── Recherche ────────────────────────────────────────────────────────── */

  async function search() {
    clearTimeout(timer);
    const mine = ++run;
    const placed = placedNow();

    if (!placed.length) {
      lastSelection = [];
      results.setEmpty('no-sticker');
      return;
    }
    if (!hasKey()) {
      results.setEmpty('no-key');
      return;
    }

    results.setLoading();
    const pools = {};
    try {
      // En séquence : le cache du client rend les répétitions gratuites et
      // TMDB n'a pas à encaisser six requêtes simultanées.
      for (const id of new Set(placed.map(p => p.id))) {
        pools[id] = await client.stickerPools(STICKER_BY_ID.get(id));
        if (mine !== run) return;
      }
    } catch (error) {
      if (mine !== run) return;
      handleSearchError(error);
      return;
    }

    const entries = selectMovies(placed, pools, lastSelection, boardSeedKey(board));
    if (mine !== run) return;
    if (!entries.length) {
      results.setEmpty('no-results');
      return;
    }
    // Seul moment orchestré : le premier résultat après le premier sticker.
    results.setSelection(entries, placed, { animateFirst: lastSelection.length === 0 });
    lastSelection = entries;
  }

  /** Les cartes déjà affichées restent en place, quelle que soit l'erreur. */
  function handleSearchError(error) {
    const status = error instanceof TmdbError ? error.status : null;
    if (status === 401) {
      clearCredential();
      credential = '';
      openKey(KEY_REFUSED);
      return;
    }
    if (status === 429) {
      results.setError('TMDB a reçu trop de requêtes. Réessaie dans un instant.', search);
      return;
    }
    if (status === 0) {
      results.setError('Pas de réseau. Tes films précédents restent affichés.', search);
      return;
    }
    console.warn('[FRAME] recherche impossible :', error);
    results.setError('TMDB n\'a pas répondu (' + status + ').', search);
  }

  /* ── Annuler, rétablir, vider ─────────────────────────────────────────── */

  function undo() {
    if (!past.length) return;
    const previous = past.pop();
    future.push(base);
    commit(previous, { push: false });
  }

  function redo() {
    if (!future.length) return;
    const next = future.pop();
    past.push(base);
    commit(next, { push: false });
  }

  function onShortcut(event) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  }

  function clearAll() {
    if (!board.items.length) return;
    const previous = board;
    commit(clearBoard());
    showToast('Toile vidée', {
      action: 'Annuler',
      duration: CLEAR_TOAST_MS,
      onAction() {
        // Rien d'autre n'a bougé entre-temps : c'est une annulation ordinaire.
        if (past[past.length - 1] === previous) undo();
        else commit(previous);
      }
    });
  }

  /* ── Partage ──────────────────────────────────────────────────────────── */

  async function share() {
    const url = boardToUrl(board, location.href);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FRAME', url });
        return;
      } catch (error) {
        // Partage refusé par la personne : on n'insiste pas.
        if (error && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Lien copié', { duration: COPY_TOAST_MS });
    } catch {
      // Ni partage natif ni presse-papiers : le lien s'affiche, à copier à la main.
      showToast(url, { duration: LINK_TOAST_MS });
    }
  }

  /* ── Avis et toast ────────────────────────────────────────────────────── */

  function showNotice(text) {
    noticeEl.textContent = text;
    noticeEl.hidden = false;
  }

  function hideNotice() {
    if (noticeEl.hidden) return;
    noticeEl.hidden = true;
    noticeEl.textContent = '';
  }

  function showToast(message, { action, onAction, duration = CLEAR_TOAST_MS } = {}) {
    clearTimeout(toastTimer);
    const text = document.createElement('span');
    text.className = 'toast__text';
    text.textContent = message;
    toastEl.replaceChildren(text);
    if (action) {
      const button = document.createElement('button');
      button.className = 'toast__action';
      button.type = 'button';
      button.textContent = action;
      button.addEventListener('click', () => {
        hideToast();
        if (onAction) onAction();
      });
      toastEl.append(button);
    }
    toastEl.hidden = false;
    toastTimer = setTimeout(hideToast, duration);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toastTimer = 0;
    toastEl.hidden = true;
    toastEl.replaceChildren();
  }

  /* ── Accueil ──────────────────────────────────────────────────────────── */

  function buildExamples() {
    const inner = document.createElement('div');
    inner.className = 'examples__inner';

    const lead = document.createElement('p');
    lead.className = 'examples__lead';
    lead.textContent = 'Trois tableaux pour commencer. Touche-en un, ou pars d\'une toile vierge.';

    const list = document.createElement('ul');
    list.className = 'examples__list';
    for (const example of EXAMPLES) {
      const item = document.createElement('li');
      const card = document.createElement('button');
      card.className = 'examples__card';
      card.type = 'button';
      card.dataset.example = example.id;

      const thumb = document.createElement('span');
      thumb.className = 'examples__thumb';
      thumb.setAttribute('aria-hidden', 'true');
      fillThumb(thumb, example.board);

      const name = document.createElement('span');
      name.className = 'examples__name';
      name.textContent = example.name;

      card.append(thumb, name);
      item.append(card);
      list.append(item);
    }

    const blank = document.createElement('button');
    blank.className = 'examples__blank hbtn';
    blank.type = 'button';
    blank.id = 'btn-blank';
    blank.textContent = 'Toile vierge';

    inner.append(lead, list, blank);
    examplesEl.replaceChildren(inner);
    examplesEl.hidden = false;
  }

  /** L'accueil ne se montre qu'une fois : le masquer, c'est l'avoir vu. */
  function hideExamples() {
    if (examplesEl.hidden) return;
    examplesEl.hidden = true;
    markIntroSeen();
  }

  function onExamplesClick(event) {
    if (event.target.closest('#btn-blank')) {
      hideExamples();
      return;
    }
    const card = event.target.closest('.examples__card');
    if (!card) return;
    const example = EXAMPLES.find(e => e.id === card.dataset.example);
    if (!example) return;
    commit(cloneBoard(example.board));
    search();
  }

  /* ── Panneaux ─────────────────────────────────────────────────────────── */

  function openPanel(panel, focusEl) {
    if (openedPanel === panel) return;
    if (openedPanel) closePanel();
    lastFocused = document.activeElement;
    openedPanel = panel;
    panel.hidden = false;
    const target = focusEl || panel.querySelector('.panel__close');
    if (target) target.focus();
  }

  function closePanel() {
    if (!openedPanel) return;
    openedPanel.hidden = true;
    openedPanel = null;
    const target = lastFocused;
    lastFocused = null;
    if (target && typeof target.focus === 'function' && document.contains(target)) target.focus();
  }

  function onPanelKeys(event) {
    if (!openedPanel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key === 'Tab') trapTab(event, openedPanel.querySelector('.panel__body'));
  }

  function openBoards() {
    showTab('saved');
    refreshSaved();
    refreshPaths();
    panels.boardName.value = defaultBoardName(board);
    const empty = board.items.length === 0;
    panels.saveBoard.disabled = empty;
    panels.saveBoard.title = empty ? SAVE_HINT_EMPTY : '';
    openPanel(panels.boards);
  }

  function showTab(name) {
    const saved = name === 'saved';
    panels.tabSaved.setAttribute('aria-selected', String(saved));
    panels.tabPaths.setAttribute('aria-selected', String(!saved));
    panels.paneSaved.hidden = !saved;
    panels.panePaths.hidden = saved;
  }

  function refreshSaved() {
    const entries = loadBoards();
    panels.savedList.replaceChildren(...entries.map(savedItem));
    panels.savedEmpty.hidden = entries.length > 0;
  }

  function savedItem(entry) {
    const item = document.createElement('li');
    item.className = 'panel__item';

    const load = document.createElement('button');
    load.className = 'panel__load';
    load.type = 'button';
    load.dataset.boardId = entry.id;

    const thumb = document.createElement('span');
    thumb.className = 'panel__thumb';
    fillThumb(thumb, decodeBoard(entry.encoded).board);

    const name = document.createElement('span');
    name.className = 'panel__item-name';
    name.textContent = entry.name;

    const date = document.createElement('span');
    date.className = 'panel__item-date';
    date.textContent = DATE_FMT.format(new Date(entry.savedAt));

    load.append(thumb, name, date);

    const remove = document.createElement('button');
    remove.className = 'panel__delete';
    remove.type = 'button';
    remove.dataset.deleteId = entry.id;
    remove.setAttribute('aria-label', 'Supprimer');
    remove.title = 'Supprimer ' + entry.name;
    remove.textContent = '✕';

    item.append(load, remove);
    return item;
  }

  function refreshPaths() {
    const entries = loadJournal();
    panels.pathsList.replaceChildren(...entries.map(pathItem));
    panels.pathsEmpty.hidden = entries.length > 0;
  }

  function pathItem(entry) {
    const item = document.createElement('li');
    item.className = 'panel__item';

    const link = document.createElement('a');
    link.className = 'panel__load';
    link.href = entry.encoded ? '#' + entry.encoded : '#';

    const name = document.createElement('span');
    name.className = 'panel__item-name';
    name.textContent = entry.title;

    const date = document.createElement('span');
    date.className = 'panel__item-date';
    date.textContent = DATE_TIME_FMT.format(new Date(entry.at));

    link.append(name, date);
    item.append(link);
    return item;
  }

  function onSavedClick(event) {
    const remove = event.target.closest('.panel__delete');
    if (remove) {
      deleteBoard(remove.dataset.deleteId);
      refreshSaved();
      return;
    }
    const load = event.target.closest('.panel__load');
    if (!load) return;
    const entry = loadBoards().find(saved => saved.id === load.dataset.boardId);
    if (!entry) return;
    commit(decodeBoard(entry.encoded).board);
    closePanel();
  }

  function onSaveBoard() {
    if (!board.items.length) return;
    const name = panels.boardName.value.trim() || defaultBoardName(board);
    saveBoard({ name, encoded: encodeBoard(board) });
    refreshSaved();
    showToast('Tableau sauvegardé', { duration: COPY_TOAST_MS });
  }

  /* ── Fenêtre de clé ───────────────────────────────────────────────────── */

  function openKey(message) {
    if (message) showKeyError(message);
    else hideKeyError();
    openPanel(panels.key, panels.keyInput);
  }

  function showKeyError(message) {
    panels.keyError.textContent = message;
    panels.keyError.hidden = false;
  }

  function hideKeyError() {
    panels.keyError.hidden = true;
    panels.keyError.textContent = '';
  }

  async function saveKey() {
    // La saisie n'est jamais effacée, quoi qu'il arrive.
    const value = panels.keyInput.value.trim();
    if (!detectAuth(value)) {
      showKeyError(KEY_SHAPE_ERROR);
      return;
    }
    hideKeyError();
    panels.keySave.disabled = true;
    panels.keySave.textContent = 'Vérification…';
    try {
      await createClient({ credential: value }).validate();
      saveCredential(value);
      credential = value;
      client = createClient({ credential });
      closePanel();
      search();
    } catch (error) {
      const status = error instanceof TmdbError ? error.status : null;
      if (status === 401) showKeyError(KEY_REFUSED);
      else if (status === 0) showKeyError(KEY_OFFLINE);
      else showKeyError('TMDB n\'a pas répondu (' + status + ').');
    } finally {
      panels.keySave.disabled = false;
      panels.keySave.textContent = 'Valider et enregistrer';
    }
  }

  /* ── Fragment d'URL ───────────────────────────────────────────────────── */

  function onHashChange() {
    if (location.hash === ownHash) return;
    const { board: next, error } = decodeBoard(location.hash);
    ownHash = location.hash;
    commit(next, { push: false });
    if (error && error !== 'empty') showNotice(NOTICE_TEXT);
  }

  /* ── Branchements ─────────────────────────────────────────────────────── */

  headerEl.undo.addEventListener('click', undo);
  headerEl.redo.addEventListener('click', redo);
  headerEl.boards.addEventListener('click', openBoards);
  headerEl.share.addEventListener('click', share);
  el('btn-clear').addEventListener('click', clearAll);
  examplesEl.addEventListener('click', onExamplesClick);
  document.addEventListener('keydown', onShortcut);
  document.addEventListener('keydown', onPanelKeys);
  window.addEventListener('hashchange', onHashChange);

  el('panels-host').addEventListener('click', event => {
    if (event.target.closest('[data-close]')) closePanel();
  });
  panels.tabSaved.addEventListener('click', () => showTab('saved'));
  panels.tabPaths.addEventListener('click', () => showTab('paths'));
  panels.savedList.addEventListener('click', onSavedClick);
  panels.pathsList.addEventListener('click', event => {
    // Le lien change le fragment tout seul : il ne reste qu'à s'effacer.
    if (event.target.closest('.panel__load')) closePanel();
  });
  panels.saveBoard.addEventListener('click', onSaveBoard);
  panels.keySave.addEventListener('click', saveKey);
  panels.keyInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') saveKey();
  });

  /* ── Premier affichage ────────────────────────────────────────────────── */

  drawer.setActiveDrawer(DEFAULT_DRAWER);

  const restored = decodeBoard(location.hash);
  if (restored.error === null) {
    // Adoption directe : le fragment est déjà à jour et rien n'est à annuler.
    board = restored.board;
    base = board;
    picker.setBoard(board);
  } else if (restored.error !== 'empty') {
    showNotice(NOTICE_TEXT);
  } else if (!isList && !hasSeenIntro()) {
    buildExamples();
  }
  renderChrome();

  if (!hasKey()) {
    openKey();
    results.setEmpty('no-key');
  } else {
    // Un lien partagé cherche ses films tout de suite, sans attendre le debounce.
    search();
  }
}

if (typeof document !== 'undefined') start();
