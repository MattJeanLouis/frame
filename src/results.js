// La bande de résultats et la fiche film.
// Les cartes sont des affiches posées sur une table de montage : elles entrent
// en fondu et glissement échelonnés, et quand le tableau change elles se
// déplacent vers leur nouvelle place au lieu d'être détruites puis recréées.

import { explain } from './engine.js';
import { posterUrl, movieUrl } from './tmdb.js';

/** « évident » ne s'affiche jamais : c'est le cas par défaut. */
export const CATEGORY_LABELS = { evident: '', surprise: 'surprise', unexpected: 'pas de côté' };

export const EMPTY_MESSAGES = {
  'no-sticker': 'Pose un sticker, les films arrivent.',
  'no-key': 'Il manque ta clé TMDB pour aller chercher les films.',
  'no-results': 'Rien ne correspond à ce tableau, essaie d\'enlever un sticker.'
};

/** Retard supplémentaire du seul moment orchestré : le premier résultat. */
export const FIRST_RESULT_DELAY_MS = 120;

/** Glissement vers le bas au-delà duquel la fiche se ferme. */
export const SWIPE_CLOSE_PX = 80;

const NO_OVERVIEW = 'TMDB n\'a pas de résumé en français pour ce film.';
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
const NUMBER_FR = new Intl.NumberFormat('fr-FR');

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const yearOf = movie => String(movie.release_date || '').slice(0, 4);

/**
 * Explication d'une carte : les stickers de la toile, dans l'ordre de la toile,
 * honorés en pleine couleur et ignorés estompés. Aucun pourcentage.
 */
function whyParts(entry, placed) {
  const { honored, ignored, sentence } = explain(entry, placed);
  const known = new Map();
  for (const sticker of honored) known.set(sticker.id, { sticker, dim: false });
  for (const sticker of ignored) if (!known.has(sticker.id)) known.set(sticker.id, { sticker, dim: true });
  return { sentence, parts: placed.map(p => known.get(p.id)).filter(Boolean) };
}

function fillEmojis(el, parts) {
  el.replaceChildren(...parts.map(({ sticker, dim }) => {
    const span = document.createElement('span');
    span.className = dim ? 'card__emoji is-dim' : 'card__emoji';
    span.textContent = sticker.emoji;
    span.title = dim ? sticker.label + ', pas retenu' : sticker.label;
    return span;
  }));
}

function setTypographic(posterEl, title, className) {
  posterEl.classList.add('is-typographic');
  const span = document.createElement('span');
  span.className = className;
  span.textContent = title;
  posterEl.replaceChildren(span);
}

/* ── Bande de résultats ───────────────────────────────────────────────────── */

/**
 * Crée la bande de résultats dans rootEl.
 * @param {HTMLElement} rootEl
 * @param {{onOpen?: (entry: object) => void}} handlers
 * @returns {{setLoading: Function, setSelection: Function, setError: Function, setEmpty: Function}}
 */
export function createResults(rootEl, { onOpen } = {}) {
  const dom = buildResultsDom(rootEl);
  let entries = [];
  let retryHandler = null;

  /* ── États ──────────────────────────────────────────────────────────────── */

  /** Chargement : les cartes précédentes restent, atténuées. Jamais de vide. */
  function setLoading() {
    dom.results.classList.add('is-loading');
    clearState();
  }

  function clearState() {
    dom.state.hidden = true;
    dom.state.textContent = '';
    dom.state.classList.remove('is-error');
    dom.retry.hidden = true;
    retryHandler = null;
  }

  /** Erreur : les cartes restent en place, « Réessayer » apparaît. */
  function setError(message, onRetry) {
    dom.results.classList.remove('is-loading');
    dom.state.textContent = message;
    dom.state.classList.add('is-error');
    dom.state.hidden = false;
    dom.retry.hidden = false;
    retryHandler = typeof onRetry === 'function' ? onRetry : null;
  }

  function setEmpty(kind) {
    dom.results.classList.remove('is-loading');
    entries = [];
    dom.strip.replaceChildren();
    clearState();
    dom.state.textContent = EMPTY_MESSAGES[kind] || EMPTY_MESSAGES['no-results'];
    dom.state.hidden = false;
  }

  /* ── Sélection ──────────────────────────────────────────────────────────── */

  function setSelection(list, placed = [], { animateFirst = false } = {}) {
    dom.results.classList.remove('is-loading');
    clearState();
    entries = (list || []).filter(entry => entry && entry.movie);

    const smooth = !reducedMotion();
    const before = smooth ? snapshot() : null;

    const spare = new Map();
    for (const card of dom.strip.children) spare.set(card.dataset.movie, card);

    const ordered = [];
    const kept = [];
    entries.forEach((entry, index) => {
      const key = String(entry.movie.id);
      const reused = spare.get(key);
      spare.delete(key);
      const card = reused || createCard(entry);
      fillCard(card, entry, placed, index, { isNew: !reused, animateFirst });
      ordered.push(card);
      if (reused) kept.push(card);
    });

    for (const card of spare.values()) card.remove();
    // Réordonnancement par appendChild : les cartes gardées sont déplacées,
    // jamais recréées, et le glissement FLIP ci-dessous les emmène à leur place.
    for (const card of ordered) dom.strip.append(card);

    if (before) slide(kept, before);
  }

  function snapshot() {
    const rects = new Map();
    for (const card of dom.strip.children) rects.set(card.dataset.movie, card.getBoundingClientRect());
    return rects;
  }

  /** FLIP : on repart de l'ancienne position et on laisse la transition faire. */
  function slide(cards, before) {
    const moved = [];
    for (const card of cards) {
      const first = before.get(card.dataset.movie);
      if (!first) continue;
      const last = card.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      card.classList.remove('is-sliding');
      card.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
      moved.push(card);
    }
    if (!moved.length) return;
    requestAnimationFrame(() => {
      for (const card of moved) {
        card.classList.add('is-sliding');
        card.style.transform = '';
      }
    });
  }

  /* ── Cartes ─────────────────────────────────────────────────────────────── */

  function createCard(entry) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.movie = String(entry.movie.id);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const poster = document.createElement('div');
    poster.className = 'card__poster';
    const title = document.createElement('h3');
    title.className = 'card__title';
    const meta = document.createElement('p');
    meta.className = 'card__meta';
    const why = document.createElement('p');
    why.className = 'card__why';

    card.append(poster, title, meta, why);
    card.addEventListener('animationend', () => card.classList.remove('is-entering'));
    card.addEventListener('transitionend', event => {
      if (event.propertyName === 'transform') card.classList.remove('is-sliding');
    });
    return card;
  }

  function fillCard(card, entry, placed, index, { isNew, animateFirst }) {
    const movie = entry.movie;
    fillPoster(card.querySelector('.card__poster'), movie);
    card.querySelector('.card__title').textContent = movie.title;

    const meta = card.querySelector('.card__meta');
    const year = document.createElement('span');
    year.className = 'card__year';
    year.textContent = yearOf(movie);
    meta.replaceChildren(year);
    const label = CATEGORY_LABELS[entry.category] || '';
    if (label) {
      const badge = document.createElement('span');
      badge.className = 'card__badge';
      badge.textContent = label;
      meta.append(badge);
    }

    fillEmojis(card.querySelector('.card__why'), whyParts(entry, placed).parts);

    if (!isNew) return;
    card.style.setProperty('--i', String(index));
    card.style.setProperty('--enter-delay', (animateFirst ? FIRST_RESULT_DELAY_MS : 0) + 'ms');
    card.classList.add('is-entering');
  }

  function fillPoster(posterEl, movie) {
    const url = posterUrl(movie.poster_path);
    if (posterEl.dataset.poster === String(url)) return;
    posterEl.dataset.poster = String(url);
    if (!url) {
      setTypographic(posterEl, movie.title, 'card__fallback');
      return;
    }
    posterEl.classList.remove('is-typographic');
    const img = document.createElement('img');
    img.className = 'card__img';
    img.alt = '';
    img.loading = 'lazy';
    // Affiche introuvable chez TMDB : la carte bascule en typographique.
    img.addEventListener('error', () => setTypographic(posterEl, movie.title, 'card__fallback'), { once: true });
    img.src = url;
    posterEl.replaceChildren(img);
  }

  /* ── Événements ─────────────────────────────────────────────────────────── */

  function openCard(card) {
    const entry = entries.find(e => String(e.movie.id) === card.dataset.movie);
    if (entry && onOpen) onOpen(entry);
  }

  function onCardClick(event) {
    const card = event.target.closest('.card');
    if (card && dom.strip.contains(card)) openCard(card);
  }

  function onCardKeys(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.card');
    if (!card || !dom.strip.contains(card)) return;
    // Espace : sans cela la page défile. Entrée : sans cela la touche encore
    // enfoncée actionne le bouton de fermeture qui vient de prendre le focus.
    event.preventDefault();
    openCard(card);
  }

  dom.strip.addEventListener('click', onCardClick);
  dom.strip.addEventListener('keydown', onCardKeys);
  dom.retry.addEventListener('click', () => { if (retryHandler) retryHandler(); });

  return { setLoading, setSelection, setError, setEmpty };
}

function buildResultsDom(rootEl) {
  const results = document.createElement('div');
  results.className = 'results';
  results.id = 'results';

  const title = document.createElement('h2');
  title.className = 'results__title';
  title.textContent = 'Films trouvés';

  const strip = document.createElement('div');
  strip.className = 'results__strip';
  strip.id = 'results-strip';

  const state = document.createElement('p');
  state.className = 'results__state';
  state.id = 'results-state';
  state.setAttribute('role', 'status');
  state.hidden = true;

  const retry = document.createElement('button');
  retry.className = 'results__retry';
  retry.id = 'results-retry';
  retry.type = 'button';
  retry.textContent = 'Réessayer';
  retry.hidden = true;

  results.append(title, strip, state, retry);
  rootEl.replaceChildren(results);
  return { results, strip, state, retry };
}

/* ── Fiche film ───────────────────────────────────────────────────────────── */

/**
 * Crée la fiche film dans rootEl.
 * @param {HTMLElement} rootEl
 * @param {{client: object, onJournal?: (entry: object) => void}} options
 * @returns {{open: Function, close: Function}}
 */
export function createSheet(rootEl, { client, onJournal } = {}) {
  const dom = buildSheetDom(rootEl);
  let lastFocused = null;
  let openToken = 0;
  let drag = null;

  async function open(entry, placed = []) {
    if (!entry || !entry.movie) return;
    const token = ++openToken;
    // Fiche déjà ouverte : on garde l'élément d'origine, pas le bouton de la fiche.
    if (dom.sheet.hidden) lastFocused = document.activeElement;
    fill(entry, placed);
    dom.sheet.hidden = false;
    dom.close.focus();
    if (onJournal) onJournal(entry);

    if (!client || typeof client.movieDetails !== 'function') return;
    try {
      const details = await client.movieDetails(entry.movie.id);
      if (token !== openToken) return;
      const overview = (details && details.overview) || entry.movie.overview || NO_OVERVIEW;
      dom.overview.textContent = overview;
    } catch {
      // Résumé de repli déjà en place : on n'alarme personne pour si peu.
    }
  }

  function fill(entry, placed) {
    const movie = entry.movie;
    const url = posterUrl(movie.poster_path, 'w780');
    if (url) {
      dom.poster.classList.remove('is-typographic');
      dom.poster.replaceChildren(dom.img);
      dom.img.src = url;
    } else {
      dom.img.removeAttribute('src');
      setTypographic(dom.poster, movie.title, 'sheet__fallback');
    }

    dom.title.textContent = movie.title;
    dom.meta.textContent = metaLine(movie);

    const { sentence, parts } = whyParts(entry, placed);
    const line = document.createElement('span');
    line.className = 'sheet__sentence';
    line.textContent = sentence;
    const row = document.createElement('span');
    row.className = 'sheet__emojis';
    fillEmojis(row, parts);
    dom.why.replaceChildren(line, row);

    dom.overview.textContent = movie.overview || NO_OVERVIEW;
    dom.link.href = movieUrl(movie.id);
  }

  /** Année, note sur 10 avec une décimale, nombre de votes. Aucun pourcentage. */
  function metaLine(movie) {
    const bits = [];
    const year = yearOf(movie);
    if (year) bits.push(year);
    if (Number.isFinite(Number(movie.vote_average)) && Number(movie.vote_average) > 0) {
      bits.push(Number(movie.vote_average).toFixed(1).replace('.', ',') + '/10');
    }
    const votes = Number(movie.vote_count);
    if (Number.isFinite(votes) && votes > 0) {
      bits.push(NUMBER_FR.format(votes) + (votes > 1 ? ' votes' : ' vote'));
    }
    return bits.join(' · ');
  }

  function close() {
    if (dom.sheet.hidden) return;
    openToken++;
    endDrag();
    dom.sheet.hidden = true;
    const target = lastFocused;
    lastFocused = null;
    if (target && typeof target.focus === 'function' && document.contains(target)) target.focus();
  }

  /* ── Événements ─────────────────────────────────────────────────────────── */

  function onEscape(event) {
    if (event.key !== 'Escape' || dom.sheet.hidden) return;
    event.preventDefault();
    close();
  }

  /** Le focus tourne en rond dans le panneau tant que la fiche est ouverte. */
  function onTabTrap(event) {
    if (event.key !== 'Tab') return;
    const items = [...dom.panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const outside = !dom.panel.contains(active);
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  }

  function onPointerDown(event) {
    if (dom.sheet.hidden || !event.isPrimary) return;
    // Tant que le contenu peut défiler vers le haut, le geste lui appartient.
    if (dom.panel.scrollTop > 0) return;
    drag = { id: event.pointerId, startY: event.clientY, dy: 0, captured: false };
    dom.panel.classList.remove('is-settling');
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const dy = event.clientY - drag.startY;
    drag.dy = Math.max(0, dy);
    if (drag.dy > 6 && !drag.captured) {
      // La capture échoue si le pointeur n'est plus actif : ce n'est pas grave,
      // le geste se poursuit sans elle.
      try { dom.panel.setPointerCapture(drag.id); } catch { /* pointeur déjà relâché */ }
      drag.captured = true;
    }
    dom.panel.style.transform = drag.dy ? 'translateY(' + drag.dy + 'px)' : '';
    dom.backdrop.style.opacity = String(Math.max(0.3, 1 - drag.dy / 400));
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const travelled = drag.dy;
    drag = null;
    if (travelled > SWIPE_CLOSE_PX) {
      close();
      return;
    }
    dom.panel.classList.add('is-settling');
    dom.panel.style.transform = '';
    dom.backdrop.style.opacity = '';
  }

  function endDrag() {
    drag = null;
    dom.panel.classList.remove('is-settling');
    dom.panel.style.transform = '';
    dom.backdrop.style.opacity = '';
  }

  dom.close.addEventListener('click', close);
  dom.backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onEscape);
  dom.panel.addEventListener('keydown', onTabTrap);
  dom.panel.addEventListener('pointerdown', onPointerDown);
  dom.panel.addEventListener('pointermove', onPointerMove);
  dom.panel.addEventListener('pointerup', onPointerUp);
  dom.panel.addEventListener('pointercancel', endDrag);
  // Sans cela, glisser depuis l'affiche ou le lien lance un glisser-déposer
  // natif et le geste de fermeture est avalé.
  dom.panel.addEventListener('dragstart', event => event.preventDefault());
  dom.panel.addEventListener('transitionend', event => {
    if (event.propertyName === 'transform') dom.panel.classList.remove('is-settling');
  });

  return { open, close };
}

function buildSheetDom(rootEl) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'sheet-title');
  sheet.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet__backdrop';
  backdrop.id = 'sheet-backdrop';

  const panel = document.createElement('div');
  panel.className = 'sheet__panel';

  const close = document.createElement('button');
  close.className = 'sheet__close';
  close.id = 'sheet-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer');
  close.textContent = '✕';

  const poster = document.createElement('div');
  poster.className = 'sheet__poster';
  const img = document.createElement('img');
  img.id = 'sheet-img';
  img.alt = '';
  img.src = '';
  poster.append(img);

  const title = document.createElement('h2');
  title.className = 'sheet__title';
  title.id = 'sheet-title';

  const meta = document.createElement('p');
  meta.className = 'sheet__meta';
  meta.id = 'sheet-meta';

  const why = document.createElement('p');
  why.className = 'sheet__why';
  why.id = 'sheet-why';

  const overview = document.createElement('p');
  overview.className = 'sheet__overview';
  overview.id = 'sheet-overview';

  const link = document.createElement('a');
  link.className = 'sheet__link';
  link.id = 'sheet-link';
  link.href = '';
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Voir sur TMDB';

  panel.append(close, poster, title, meta, why, overview, link);
  sheet.append(backdrop, panel);
  rootEl.replaceChildren(sheet);
  return { sheet, backdrop, panel, close, poster, img, title, meta, why, overview, link };
}
