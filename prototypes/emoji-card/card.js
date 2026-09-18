// FRAME v2 — carte-film. Prototype jetable.
//
// Trois rôles pour l'emoji, trois contenants distincts (spec v2 §2) :
//   chercher  → #palette, en bas, ambre, tactile
//   nommer    → .card__sig, posé sur l'image, jamais un bouton de recherche
//   commenter → .react, attaché au moment, avec un éclat en retour
//
// La signature d'un film est dérivée des données TMDB, puis remplacée par ce
// que Matt a réellement ressenti (spec v2 §4).

import { STICKERS, STICKER_BY_ID, DRAWERS, twemojiUrl } from '../../src/stickers.js';
import { createClient, detectAuth, API_BASE } from '../../src/tmdb.js';
import { createDemoClient, DEMO_POOLS } from '../../src/demo.js';
import { loadCredential } from '../../src/storage.js';
import { selectMovies } from '../../src/engine.js';

const STORE_KEY = 'frame.v2';
const SEEN = '👁️';
const WANT = '🎟️';
const SIGNATURE_MAX = 4;
const CHOICES = 12;

const el = id => document.getElementById(id);
const wallEl = el('wall');
const cardEl_ = el('card');
const mirrorEl = el('mirror');
const statusEl = el('status');

const state = {
  credential: '',
  client: null,
  live: false,
  films: new Map(),
  wall: [],
  picked: [],
  drawer: 'places',
  paletteOpen: false,
  reactions: {},
  marks: {}
};

/* ── Persistance ──────────────────────────────────────────────────────────── */

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.reactions = parsed.reactions && typeof parsed.reactions === 'object' ? parsed.reactions : {};
    state.marks = parsed.marks && typeof parsed.marks === 'object' ? parsed.marks : {};
  } catch { /* sans localStorage, on perd seulement la persistance */ }
}

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ reactions: state.reactions, marks: state.marks }));
  } catch { /* idem */ }
}

/* ── Dérivation de la signature (spec v2 §4) ──────────────────────────────── */

/** Étage 1 — les genres. Gratuit : tout film de `discover` les porte déjà. */
function byGenres(film) {
  const genres = new Set(film.genre_ids || []);
  if (!genres.size) return [];
  return STICKERS
    .filter(s => Array.isArray(s.genres) && s.genres.length)
    .map(s => {
      const overlap = s.genres.filter(g => genres.has(g)).length;
      // On divise par la racine du nombre de genres déclarés : un sticker
      // précis qui colle bat un sticker fourre-tout qui colle aussi.
      return { s, score: overlap / Math.sqrt(s.genres.length) };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.id.localeCompare(b.s.id))
    .map(x => x.s);
}

/** Étage 2 — les mots-clés réels du film. TMDB les rend avec leur nom, et ce
 *  sont exactement les nôtres : l'intersection se fait sur les chaînes. */
function byKeywords(names) {
  const set = new Set((names || []).map(n => String(n).toLowerCase()));
  if (!set.size) return [];
  return STICKERS
    .map(s => ({ s, hits: s.keywords.filter(k => set.has(k)).length }))
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.s.keywords.length - b.s.keywords.length || a.s.id.localeCompare(b.s.id))
    .map(x => x.s);
}

const idsOf = list => list.map(s => s.id);

/** La matière d'un film : ses mots-clés d'abord, ses genres pour compléter.
 *  C'est ce qu'on peut retenir de lui — pas seulement ce que TMDB prédit. */
function filmPalette(film) {
  const keywords = byKeywords(film.keywords);
  const taken = new Set(keywords.map(s => s.id));
  const genres = byGenres(film).filter(s => !taken.has(s.id));
  return [...keywords, ...genres];
}

/** Ce que TMDB propose pour ce film, avant toute intervention de Matt. */
function proposed(film) {
  if (Array.isArray(film.keywords) && film.keywords.length) {
    const k = byKeywords(film.keywords);
    if (k.length) return idsOf(k).slice(0, SIGNATURE_MAX);
  }
  return idsOf(byGenres(film)).slice(0, 3);
}

/** Le nom du film : ta réaction si tu en as une, sinon la proposition. */
function signatureOf(film) {
  const own = state.reactions[film.id];
  return own && own.length ? own : proposed(film);
}

/* ── Réseau ───────────────────────────────────────────────────────────────── */

async function api(path) {
  const url = new URL(API_BASE + path);
  url.searchParams.set('language', 'fr-FR');
  const options = { headers: { accept: 'application/json' } };
  const auth = detectAuth(state.credential);
  if (auth === 'bearer') options.headers.Authorization = 'Bearer ' + state.credential;
  else if (auth === 'apikey') url.searchParams.set('api_key', state.credential);
  else throw new Error('sans-clé');
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('TMDB ' + response.status);
  return response.json();
}

/** Mots-clés et vidéos : une seule fois par film, puis gardés en mémoire. */
async function fetchExtras(film) {
  if (film.__extra || !state.live) return;
  try {
    const [kw, vids] = await Promise.all([
      api('/movie/' + film.id + '/keywords'),
      api('/movie/' + film.id + '/videos')
    ]);
    film.keywords = (kw.keywords || []).map(k => k.name);
    film.videos = (vids.results || []).filter(v => v.site === 'YouTube');
  } catch {
    film.keywords = [];
    film.videos = [];
  }
  film.__extra = true;
}

/** Le moment : une bande-annonce d'abord, sinon un teaser, sinon un extrait. */
function momentOf(film) {
  const list = film.videos || [];
  const pick = type => list.find(v => v.type === type && v.official) || list.find(v => v.type === type);
  return pick('Trailer') || pick('Teaser') || pick('Clip') || null;
}

/** Affiche vivante : en boucle, muette, sans commandes — pas un lecteur. */
function momentUrl(key) {
  return 'https://www.youtube.com/embed/' + key +
    '?autoplay=1&mute=1&controls=0&loop=1&playlist=' + key +
    '&modestbranding=1&rel=0&playsinline=1&disablekb=1&iv_load_policy=3';
}

/* ── Fabriques d'éléments ─────────────────────────────────────────────────── */

function emojiImg(emoji, className = '') {
  const img = document.createElement('img');
  img.src = twemojiUrl(emoji);
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  if (className) img.className = className;
  return img;
}

function posterEl(film, className) {
  if (film.poster_path) {
    const img = document.createElement('img');
    img.className = className;
    img.src = state.client.posterUrl(film.poster_path, 'w342');
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }
  const blank = document.createElement('span');
  blank.className = 'card__blank';
  blank.append(emojiImg('🎞️'));
  return blank;
}

/* ── Le mur ───────────────────────────────────────────────────────────────── */

function renderSkeletons(count = 8) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'card card--skeleton' + (i % 8 === 0 ? ' card--hero' : '');
    frag.append(s);
  }
  wallEl.replaceChildren(frag);
}

function wallCard(film, index) {
  const signature = signatureOf(film);
  const mark = state.marks[film.id];
  const hero = index % 8 === 0;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card' + (hero ? ' card--hero' : '');
  card.dataset.id = String(film.id);
  if (mark) card.dataset.mark = mark;
  card.style.setProperty('--delay', Math.min(index, 12) * 45 + 'ms');

  // Le libellé accessible : le seul endroit où le vrai titre vit. C'est le
  // même contenu pour qui ne voit pas l'écran, pas une concession.
  const labels = signature.map(id => STICKER_BY_ID.get(id)?.label).filter(Boolean).join(', ');
  const stateLabel = mark === 'seen' ? 'Vu' : mark === 'want' ? 'À voir' : 'Sans état';
  card.setAttribute('aria-label',
    film.title + (film.release_date ? ', ' + film.release_date.slice(0, 4) : '') +
    '. ' + stateLabel + '. Signature : ' + (labels || 'aucune'));

  if (hero && film.poster_path) {
    const blur = document.createElement('img');
    blur.className = 'card__blur';
    blur.src = state.client.posterUrl(film.poster_path, 'w342');
    blur.alt = '';
    blur.setAttribute('aria-hidden', 'true');
    card.append(blur);
  }
  card.append(posterEl(film, 'card__img'));

  const scrim = document.createElement('span');
  scrim.className = 'card__scrim';
  card.append(scrim);

  const sig = document.createElement('span');
  sig.className = 'card__sig';
  for (const id of signature) {
    const sticker = STICKER_BY_ID.get(id);
    if (sticker) sig.append(emojiImg(sticker.emoji));
  }
  card.append(sig);

  if (mark) {
    const badge = document.createElement('span');
    badge.className = 'card__state';
    badge.append(emojiImg(mark === 'seen' ? SEEN : WANT));
    card.append(badge);
  }

  card.addEventListener('click', () => openCard(film.id));
  return card;
}

function renderWall() {
  if (!state.wall.length) {
    const empty = document.createElement('p');
    empty.className = 'sr-only';
    empty.textContent = 'Aucun film.';
    wallEl.replaceChildren(empty);
    return;
  }
  wallEl.replaceChildren(...state.wall.map((id, i) => wallCard(state.films.get(id), i)));
}

async function loadWall() {
  renderSkeletons();
  try {
    if (state.live) {
      // discover sans mot-clé : le mur des films populaires.
      const data = await state.client.discover({
        keywordIds: [], sortBy: 'popularity.desc', voteCountGte: 500, page: 1
      });
      const results = data.results || [];
      results.forEach(f => state.films.set(f.id, f));
      state.wall = results.map(f => f.id);
    } else {
      const ids = Object.values(DEMO_POOLS).flatMap(p => p.popular);
      const unique = [...new Map(ids.map(f => [f.id, f])).values()];
      unique.forEach(f => state.films.set(f.id, f));
      state.wall = unique.map(f => f.id);
    }
  } catch (error) {
    announce('Les films n\'ont pas pu être chargés : ' + error.message);
    state.wall = [];
  }
  renderWall();
}

/** Chercher : la palette interroge TMDB et le moteur choisit six films. */
async function search() {
  const placed = state.picked.map(id => ({ id, scale: 1 }));
  if (!placed.length) return loadWall();

  renderSkeletons(6);
  const pools = {};
  try {
    for (const id of state.picked) {
      pools[id] = await state.client.stickerPools(STICKER_BY_ID.get(id));
    }
    const seed = placed.map(p => p.id + ':1.00').join('|');
    const entries = selectMovies(placed, pools, [], seed);
    entries.forEach(e => state.films.set(e.movie.id, e.movie));
    state.wall = entries.map(e => e.movie.id);
    announce(entries.length + ' films trouvés.');
  } catch (error) {
    announce('La recherche a échoué : ' + error.message);
    state.wall = state.picked.length ? state.wall : [];
  }
  renderWall();
}

/* ── Le dock ──────────────────────────────────────────────────────────────── */

function renderDrawers() {
  const frag = document.createDocumentFragment();
  for (const drawer of DRAWERS) {
    const first = STICKERS.find(s => s.drawer === drawer.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'drawer-sym';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(drawer.id === state.drawer));
    button.setAttribute('aria-label', drawer.label);
    // Le symbole d'une famille est son premier sticker : aucune table à tenir.
    if (first) button.append(emojiImg(first.emoji));
    button.addEventListener('click', () => {
      state.drawer = drawer.id;
      renderDrawers();
      renderPalette();
    });
    frag.append(button);
  }
  el('drawers').replaceChildren(frag);
}

function renderPalette() {
  const frag = document.createDocumentFragment();
  for (const sticker of STICKERS.filter(s => s.drawer === state.drawer)) {
    const picked = state.picked.includes(sticker.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick';
    button.setAttribute('aria-pressed', String(picked));
    button.setAttribute('aria-label', sticker.label);
    button.append(emojiImg(sticker.emoji));
    button.addEventListener('click', () => {
      const at = state.picked.indexOf(sticker.id);
      if (at >= 0) state.picked.splice(at, 1);
      else state.picked.push(sticker.id);
      button.setAttribute('aria-pressed', String(at < 0));
      announce(sticker.label + (at < 0 ? ' ajouté à la recherche.' : ' retiré de la recherche.'));
      scheduleSearch();
    });
    frag.append(button);
  }
  el('palette').replaceChildren(frag);
}

let searchTimer = 0;
function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 420);
}

/* ── La carte-film en grand ───────────────────────────────────────────────── */

let current = null;

/** Un sticker qui réagit : il entre dans la signature, ou il en sort. */
function reactionButton(film, sticker, signature, on) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pick';
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label',
    sticker.label + (on ? ', déjà dans la signature. Retirer.' : ', ajouter à la signature.'));
  button.append(emojiImg(sticker.emoji));
  button.addEventListener('click', event => {
    const own = signatureOf(film).slice();
    const at = own.indexOf(sticker.id);
    if (at >= 0) own.splice(at, 1);
    else own.push(sticker.id);
    state.reactions[film.id] = own;
    saveStore();
    if (at < 0) spark(event, sticker.emoji);
    announce(sticker.label + (at < 0 ? ' ajouté. ' : ' retiré. ') + 'Signature : ' +
      own.map(id => STICKER_BY_ID.get(id)?.label).filter(Boolean).join(', '));
    renderCardView(film);
    renderWall();
  });
  return button;
}

/** La palette entière, groupée par famille, ouverte depuis la signature. */
function buildCardPalette(film, signature) {
  const wrap = document.createElement('div');

  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Familles de stickers');
  for (const drawer of DRAWERS) {
    const first = STICKERS.find(s => s.drawer === drawer.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'drawer-sym';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(drawer.id === state.drawer));
    button.setAttribute('aria-label', drawer.label);
    if (first) button.append(emojiImg(first.emoji));
    button.addEventListener('click', () => {
      state.drawer = drawer.id;
      renderCardView(film);
    });
    tabs.append(button);
  }

  const grid = document.createElement('div');
  grid.className = 'card-grid';
  for (const sticker of STICKERS.filter(s => s.drawer === state.drawer)) {
    grid.append(reactionButton(film, sticker, signature, signature.includes(sticker.id)));
  }

  wrap.append(tabs, grid);
  return wrap;
}

async function openCard(id) {
  const film = state.films.get(id);
  if (!film) return;
  current = film;
  state.paletteOpen = false;

  if (!film.__extra && state.live) {
    renderCardView(film);          // premier rendu avec ce qu'on a
    await fetchExtras(film);       // puis on raffine, sur place
    if (current === film) renderCardView(film);
    return;
  }
  renderCardView(film);
}

function renderCardView(film) {
  const signature = signatureOf(film);
  const mark = state.marks[film.id];
  const moment = momentOf(film);

  const frag = document.createDocumentFragment();

  /* Le moment, ou l'affiche. */
  const top = document.createElement('div');
  top.className = 'card-top';

  const stage = document.createElement('div');
  stage.className = 'card-stage';

  // L'affiche reste dessous : si le moment ne vient pas, il n'y a pas de trou.
  if (film.poster_path) {
    const still = document.createElement('img');
    still.className = 'card-stage__still';
    still.src = state.client.posterUrl(film.poster_path, 'w780');
    still.alt = '';
    stage.append(still);
  }

  if (moment) {
    const frame = document.createElement('iframe');
    frame.src = momentUrl(moment.key);
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('aria-hidden', 'true');
    // Le moment n'apparaît que lorsqu'il est prêt : jamais de cadre noir.
    frame.addEventListener('load', () => frame.classList.add('is-live'));
    stage.append(frame);
  } else if (!film.poster_path) {
    stage.append(posterEl(film, ''));
  }
  top.append(stage);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back';
  back.setAttribute('aria-label', 'Retour au mur');
  back.append(Object.assign(document.createElement('span'), { className: 'chev' }));
  back.addEventListener('click', closeCard);
  top.append(back);

  frag.append(top);

  /* Le corps. */
  const body = document.createElement('div');
  body.className = 'card-body';

  /* Ta signature : le nom du film. Taper un emoji le retire. */
  const sig = document.createElement('div');
  sig.className = 'sig';
  signature.forEach((stickerId, index) => {
    const sticker = STICKER_BY_ID.get(stickerId);
    if (!sticker) return;
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'sig__slot';
    slot.setAttribute('aria-label',
      sticker.label + (index === 0 ? ', impression principale' : '') + '. Retirer de la signature.');
    slot.append(emojiImg(sticker.emoji));
    slot.addEventListener('click', event => {
      const own = signatureOf(film).filter(x => x !== stickerId);
      state.reactions[film.id] = own;
      saveStore();
      spark(event, sticker.emoji);
      announce(sticker.label + ' retiré de la signature.');
      renderCardView(film);
      renderWall();
    });
    sig.append(slot);
  });

  const empty = document.createElement('button');
  empty.type = 'button';
  empty.className = 'sig__slot sig__slot--empty';
  empty.setAttribute('aria-expanded', String(state.paletteOpen));
  empty.setAttribute('aria-label', state.paletteOpen ? 'Refermer la palette' : 'Ajouter un sticker à la signature');
  empty.addEventListener('click', () => {
    state.paletteOpen = !state.paletteOpen;
    renderCardView(film);
  });
  sig.append(empty);
  body.append(sig);

  const rule = document.createElement('div');
  rule.className = 'rule';
  body.append(rule);

  if (state.paletteOpen) {
    // La palette entière, dans la fiche : on y choisit ce que TMDB n'a pas vu.
    body.append(buildCardPalette(film, signature));
  } else {
    /* La matière du film : ce qu'il propose, que ce soit déjà dans ton nom ou
       non. La signature au-dessus est nue et grande — un nom ; ces tuiles-ci
       sont encadrées — de la matière disponible. Le contenant les distingue. */
    const palette = filmPalette(film).slice(0, CHOICES);
    if (palette.length) {
      const react = document.createElement('div');
      react.className = 'react';
      for (const sticker of palette) {
        react.append(reactionButton(film, sticker, signature, signature.includes(sticker.id)));
      }
      body.append(react);
    }
  }

  const rule2 = document.createElement('div');
  rule2.className = 'rule';
  body.append(rule2);

  frag.append(body);

  /* L'état, hors du corps : toujours au même endroit, toujours sous le pouce. */
  const foot = document.createElement('div');
  foot.className = 'card-foot';
  for (const [value, emoji, label] of [['seen', SEEN, 'Vu'], ['want', WANT, 'À voir']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'state';
    button.setAttribute('aria-pressed', String(mark === value));
    button.setAttribute('aria-label', label);
    button.append(emojiImg(emoji));
    button.addEventListener('click', () => {
      if (state.marks[film.id] === value) delete state.marks[film.id];
      else state.marks[film.id] = value;
      saveStore();
      announce(label + (state.marks[film.id] === value ? ' activé.' : ' désactivé.'));
      renderCardView(film);
      renderWall();
    });
    foot.append(button);
  }
  frag.append(foot);

  cardEl_.replaceChildren(frag);
  cardEl_.hidden = false;
  back.focus();
}

function closeCard() {
  cardEl_.hidden = true;
  cardEl_.replaceChildren();
  current = null;
  renderWall();
}

/* ── L'éclat : le retour immédiat, sans un mot ────────────────────────────── */

function spark(event, emoji) {
  const node = emojiImg(emoji, 'spark');
  const x = event.clientX || window.innerWidth / 2;
  const y = event.clientY || window.innerHeight / 2;
  node.style.left = x + 'px';
  node.style.top = y + 'px';
  node.addEventListener('animationend', () => node.remove());
  document.body.append(node);
}

/* ── Le miroir ────────────────────────────────────────────────────────────── */

/** Un nuage d'emoji dont la taille porte la fréquence. Aucun chiffre. */
function cloud(entries) {
  const wrap = document.createElement('div');
  wrap.className = 'mirror-cloud';
  const max = entries[0][1];
  for (const [stickerId, count] of entries) {
    const sticker = STICKER_BY_ID.get(stickerId);
    if (!sticker) continue;
    const img = emojiImg(sticker.emoji);
    img.style.setProperty('--sz', Math.round(28 + (count / max) * 34) + 'px');
    wrap.append(img);
  }
  return wrap;
}

function openMirror() {
  const added = new Map();
  const removed = new Map();

  for (const [id, own] of Object.entries(state.reactions)) {
    const film = state.films.get(Number(id));
    if (!film || !own.length) continue;
    const base = proposed(film);
    for (const stickerId of own) if (!base.includes(stickerId)) added.set(stickerId, (added.get(stickerId) || 0) + 1);
    for (const stickerId of base) if (!own.includes(stickerId)) removed.set(stickerId, (removed.get(stickerId) || 0) + 1);
  }

  const sort = map => [...map.entries()].sort((a, b) => b[1] - a[1]);
  const inner = document.createElement('div');
  inner.className = 'mirror-inner';

  const added_ = sort(added);
  const removed_ = sort(removed);

  if (!added_.length && !removed_.length) {
    // Rien à refléter : on le dit avec le miroir lui-même, pas avec une phrase.
    const none = document.createElement('div');
    none.className = 'mirror-empty';
    none.append(emojiImg('🪞'));
    inner.append(none);
  } else {
    const rows = [];
    if (added_.length) rows.push(['in', added_]);
    if (removed_.length) rows.push(['out', removed_]);
    // Une rangée sans rien se lirait comme un défaut : on ne la montre pas.
    for (const [direction, entries] of rows) {
      const wrap = document.createElement('div');
      wrap.className = 'mirror-row';
      const axis = document.createElement('div');
      axis.className = 'mirror-axis mirror-axis--' + direction;
      axis.append(document.createElement('i'), document.createElement('span'));
      wrap.append(axis, cloud(entries));
      inner.append(wrap);
    }
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.setAttribute('aria-label', 'Fermer le miroir');
  close.append(Object.assign(document.createElement('span'), { className: 'cross' }));
  close.addEventListener('click', closeMirror);

  mirrorEl.replaceChildren(close, inner);
  mirrorEl.hidden = false;
}

function closeMirror() {
  mirrorEl.hidden = true;
  mirrorEl.replaceChildren();
}

function announce(text) {
  statusEl.textContent = text;
}

/* ── Démarrage ────────────────────────────────────────────────────────────── */

function start() {
  loadStore();

  const config = window.FRAME_CONFIG || {};
  state.credential = config.tmdbToken || config.tmdbKey || loadCredential();
  state.live = detectAuth(state.credential) !== null;
  state.client = state.live ? createClient({ credential: state.credential }) : createDemoClient();

  el('btn-mirror').addEventListener('click', openMirror);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!mirrorEl.hidden) closeMirror();
    else if (!cardEl_.hidden) closeCard();
  });

  renderDrawers();
  renderPalette();
  loadWall();
}

start();
