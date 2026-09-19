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
import { loadCredential, getKeywordCache, setKeywordId } from '../../src/storage.js';
import { selectMovies } from '../../src/engine.js';

const STORE_KEY = 'frame.v2';
/* Les six états, sur un seul axe : ce que tu dis d'un film, en un mot, d'une
   seule touche. Depuis que le texte commande, ils portent enfin leur nom —
   une pastille étiquetée n'est plus un symbole à deviner. */
const MARKS = [
  { id: 'want', emoji: '🎟️', label: 'À voir' },
  { id: 'watching', emoji: '▶️', label: 'En cours' },
  { id: 'seen', emoji: '👁️', label: 'Vu' },
  { id: 'ok', emoji: '🙂', label: 'Ok' },
  { id: 'love', emoji: '❤️', label: 'J\'adore' },
  { id: 'nope', emoji: '🙁', label: 'Pas aimé' }
];

const markById = id => MARKS.find(m => m.id === id) || null;
const SIGNATURE_MAX = 4;
const CHOICES = 12;
const FEED_MAX = 24;

/* Trois présentations, une seule matière et une seule langue. Changer de mode
   ne change jamais ce que tu as dit d'un film. */
const MODES = [
  { id: 'film', emoji: '🖼️', label: 'Mur d\'affiches' },
  { id: 'reel', emoji: '📱', label: 'Moments, à la verticale' }
];

/* Quatre partis pris typographiques, comme les cartons d'une bande-annonce.
   Le commentaire est du texte d'auteur, pas du texte d'interface : l'interface
   reste en emoji, et ce que TU écris est monté. */
const PRESETS = [
  { id: 'carton', label: 'Carton plein écran', aa: 'Aa' },
  { id: 'critique', label: 'Citation de presse', aa: 'Aa' },
  { id: 'filets', label: 'Carton à filets', aa: 'ABC' },
  { id: 'generique', label: 'Carton de fin', aa: 'ABC' }
];
const COMMENT_MAX = 120;

/**
 * La taille du texte s'ajuste à sa longueur : un carton de bande-annonce fait
 * toujours tenir ce qu'il dit. Plus la phrase est longue, plus elle est petite.
 */
function fitFor(text) {
  const n = (text || '').length;
  if (n <= 42) return 1;
  if (n <= 78) return 0.78;
  return 0.6;
}

const el = id => document.getElementById(id);
const appEl = el('app');
const wallEl = el('wall');
const cardEl_ = el('card');
const mirrorEl = el('mirror');
const statusEl = el('status');
const progressEl = el('progress');
const progressBar = progressEl.firstElementChild;

const state = {
  credential: '',
  client: null,
  live: false,
  mode: 'film',
  films: new Map(),
  wall: [],
  items: [],
  picked: [],
  drawer: 'places',
  paletteOpen: false,
  composing: false,
  preset: 'carton',
  // Où on en était dans chaque présentation : changer de mode ne doit jamais
  // faire perdre sa place.
  scroll: { film: { top: 0, left: 0 }, video: { top: 0, left: 0 }, reel: { top: 0, left: 0 } },
  query: '',
  type: 'all',
  genres: [],
  sousGenre: null,
  tris: [],
  dejaVu: new Set(),
  page: 1,
  more: false,
  loadingMore: false,
  pageLoader: null,
  forYou: false,
  parce: new Map(),
  sources: [],
  reactions: {},
  marks: {},
  comments: {}
};

/* ── Persistance ──────────────────────────────────────────────────────────── */

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.reactions = parsed.reactions && typeof parsed.reactions === 'object' ? parsed.reactions : {};
    state.marks = parsed.marks && typeof parsed.marks === 'object' ? parsed.marks : {};
    state.comments = parsed.comments && typeof parsed.comments === 'object' ? parsed.comments : {};
  } catch { /* sans localStorage, on perd seulement la persistance */ }
}

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      reactions: state.reactions,
      marks: state.marks,
      comments: state.comments
    }));
  } catch { /* idem */ }
}

/* ── Dérivation de la signature (spec v2 §4) ──────────────────────────────── */

/** Un film et une série peuvent porter le même identifiant : le type fait
 *  donc partie de la clé de tout ce qu'on retient d'un titre. */
const keyOf = film => (film.kind || 'movie') + ':' + film.id;

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
  const own = state.reactions[keyOf(film)];
  return own && own.length ? own : proposed(film);
}

/* ── Réseau ───────────────────────────────────────────────────────────────── */

async function api(path, params) {
  const url = new URL(API_BASE + path);
  url.searchParams.set('language', 'fr-FR');
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const options = { headers: { accept: 'application/json' } };
  const auth = detectAuth(state.credential);
  if (auth === 'bearer') options.headers.Authorization = 'Bearer ' + state.credential;
  else if (auth === 'apikey') url.searchParams.set('api_key', state.credential);
  else throw new Error('sans-clé');
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('TMDB ' + response.status);
  return response.json();
}

/* ── Films et séries : une seule matière ──────────────────────────────────── */

/**
 * Une série n'a pas les mêmes champs qu'un film — `name` au lieu de `title`,
 * `first_air_date` au lieu de `release_date`. On ramène tout à une seule forme
 * pour que le reste de l'application n'ait jamais à le savoir.
 */
function normalize(raw, kind) {
  if (!raw) return null;
  return {
    ...raw,
    kind,
    title: raw.title || raw.name || '',
    date: raw.release_date || raw.first_air_date || '',
    genre_ids: raw.genre_ids || (raw.genres || []).map(g => g.id)
  };
}

/** Le corpus : des films et des animés, entrelacés — ni un mur, ni l'autre. */
async function discoverCorpus(page = 1) {
  const [films, anime] = await Promise.all([
    api('/discover/movie', { sort_by: 'popularity.desc', 'vote_count.gte': 300, page }),
    api('/discover/tv', {
      with_genres: 16, with_original_language: 'ja',
      sort_by: 'popularity.desc', 'vote_count.gte': 200, page
    })
  ]);
  const a = (films.results || []).map(f => normalize(f, 'movie'));
  const b = (anime.results || []).map(s => normalize(s, 'tv'));
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

/**
 * Tout ce qu'il faut pour comprendre un film — une seule fois par titre.
 * Les plateformes peuvent manquer : elles manquent presque toujours pour une
 * nouveauté, et ce n'est pas une erreur.
 */
async function fetchDetail(film) {
  if (film.__detail) return film;
  film.__detail = true;
  if (!state.live) return film;

  const base = '/' + film.kind + '/' + film.id;
  const [detail, credits, providers] = await Promise.all([
    api(base).catch(() => null),
    api(base + '/credits').catch(() => null),
    api(base + '/watch/providers').catch(() => null)
  ]);

  if (detail) {
    film.runtime = detail.runtime || (detail.episode_run_time || [])[0] || null;
    film.seasons = detail.number_of_seasons || null;
    film.episodes = detail.number_of_episodes || null;
    film.status = detail.status || '';
    film.budget = detail.budget || 0;
    film.revenue = detail.revenue || 0;
    film.countries = (detail.production_countries || []).map(c => c.name);
    film.companies = (detail.production_companies || []).map(c => c.name);
    film.genres = (detail.genres || []).map(g => g.name);
    film.overview = detail.overview || film.overview || '';

    // TMDB a souvent un résumé français squelettique sur les animés. Un
    // résumé anglais vaut mieux qu'une fiche muette.
    if (film.overview.trim().length < 40) {
      const anglais = await api(base, { language: 'en-US' }).catch(() => null);
      if (anglais?.overview && anglais.overview.trim().length > film.overview.trim().length) {
        film.overview = anglais.overview;
        film.overviewLang = 'en';
      }
    }
    film.vote_average = detail.vote_average ?? film.vote_average;
    film.vote_count = detail.vote_count ?? film.vote_count;
    if (!film.poster_path) film.poster_path = detail.poster_path || null;
  }

  if (credits) {
    film.director = (credits.crew || []).find(c => c.job === 'Director')?.name
      || (detail?.created_by || [])[0]?.name || '';
    film.cast = (credits.cast || []).slice(0, 5).map(c => c.name);
  }

  const fr = providers?.results?.FR;
  film.providers = fr
    ? [...new Set([...(fr.flatrate || []), ...(fr.rent || []), ...(fr.buy || [])].map(p => p.provider_name))]
    : [];

  return film;
}

/** Mots-clés et vidéos : une seule fois par film, puis gardés en mémoire. */
async function fetchExtras(film) {
  if (film.__extra || !state.live) return;
  try {
    const [kw, vids] = await Promise.all([
      api('/' + (film.kind || 'movie') + '/' + film.id + '/keywords'),
      api('/' + (film.kind || 'movie') + '/' + film.id + '/videos')
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
function bestVideo(list) {
  const videos = list || [];
  const pick = type => videos.find(v => v.type === type && v.official) || videos.find(v => v.type === type);
  return pick('Trailer') || pick('Teaser') || pick('Clip') || pick('Featurette') || null;
}

function momentOf(film) {
  return bestVideo(film.videos);
}

/** Quelques requêtes de front, jamais toutes à la fois. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const at = cursor++;
      out[at] = await fn(items[at], at);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Les vidéos d'un film, demandées une seule fois. */
async function fetchVideos(film) {
  if (film.__videos) return film.videos || [];
  film.__videos = true;
  if (!state.live) {
    film.videos = [];
    return film.videos;
  }
  try {
    const data = await api('/' + (film.kind || 'movie') + '/' + film.id + '/videos');
    film.videos = (data.results || []).filter(v => v.site === 'YouTube');
  } catch {
    film.videos = [];
  }
  return film.videos;
}

/** Affiche vivante : en boucle, muette, sans commandes — pas un lecteur.
 *  `enablejsapi` ouvre le dialogue : le lecteur annonce lui-même quand il joue. */
function momentUrl(key) {
  return 'https://www.youtube.com/embed/' + key +
    '?autoplay=1&mute=1&controls=0&loop=1&playlist=' + key +
    '&modestbranding=1&rel=0&playsinline=1&disablekb=1&iv_load_policy=3&fs=0' +
    '&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
}

const YOUTUBE_PLAYING = 1;

/**
 * N'affiche le lecteur que lorsqu'il joue vraiment.
 *
 * Un lecteur à l'arrêt montre ses propres commandes au centre du cadre — que
 * le recadrage ne peut pas enlever, puisqu'elles sont au milieu. On écoute donc
 * l'état du lecteur par `postMessage` : tant qu'il ne joue pas, c'est l'image
 * fixe qui reste à l'écran, et YouTube n'apparaît jamais.
 */
function watchPlayer(frame) {
  window.addEventListener('message', event => {
    if (typeof event.data !== 'string') return;
    if (event.source !== frame.contentWindow) return;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.event !== 'infoDelivery' || !data.info) return;
    if (data.info.playerState === YOUTUBE_PLAYING) {
      frame.classList.add('is-live');
      frame.closest('.reel__stage, .card-stage')?.querySelector('.reel__play')?.remove();
    }
  });

  frame.addEventListener('load', () => {
    // Le lecteur n'écoute qu'une fois ce message reçu.
    frame.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: frame.dataset.player, channel: 'widget' }), '*');
  });
}

/**
 * Si le moment ne démarre pas — mode économie d'énergie, économiseur de
 * données, lecture bloquée — on l'offre plutôt que de le subir : un geste réel
 * garantit la lecture, et un lecteur qui joue n'affiche plus ses commandes.
 */
function armPlayFallback(stage, key) {
  if (!stage || !key) return;
  setTimeout(() => {
    const frame = stage.querySelector('iframe');
    if (!frame || frame.classList.contains('is-live')) return;
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'reel__play';
    play.setAttribute('aria-label', 'Lancer le moment');
    play.append(emojiImg('▶️'));
    play.addEventListener('click', () => {
      play.remove();
      frame.src = momentUrl(key) + '&start=0';
      watchPlayer(frame);
    });
    stage.append(play);
  }, 4000);
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

/**
 * L'image fixe qui reste sous le moment.
 *
 * On prend une vraie image de la vidéo, pas l'affiche : si l'autoplay est
 * bloqué — mode économie d'énergie, économiseur de données — YouTube montre
 * son propre lecteur, et au moins l'image dessous est celle du moment et non
 * une autre. Quand la vidéo démarre, la transition est invisible.
 *
 * YouTube renvoie une vignette grise de 120 px au lieu d'une erreur quand la
 * grande définition n'existe pas : on la reconnaît à sa largeur.
 */
function stillEl(film, video, className) {
  const poster = film.poster_path ? state.client.posterUrl(film.poster_path, 'w780') : null;
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  img.loading = 'lazy';

  if (video) {
    img.src = 'https://img.youtube.com/vi/' + video.key + '/maxresdefault.jpg';
    img.addEventListener('load', () => {
      if (img.naturalWidth < 200 && poster) img.src = poster;
    });
    img.addEventListener('error', () => { if (poster) img.src = poster; });
  } else if (poster) {
    img.src = poster;
  }
  return img;
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

/** Le libellé accessible d'une carte du mur : le seul endroit où le vrai titre
 *  vit. C'est le même contenu pour qui ne voit pas l'écran. */
function wallLabel(film, signature, mark) {
  const labels = signature.map(id => STICKER_BY_ID.get(id)?.label).filter(Boolean).join(', ');
  const etat = markById(mark)?.label || 'Sans état';
  const quoi = film.kind === 'tv' ? 'Série' : 'Film';
  return quoi + ' ' + film.title + (film.date ? ', ' + film.date.slice(0, 4) : '') +
    '. ' + etat + '. Signature : ' + (labels || 'aucune');
}

function wallCard(film, index) {
  const signature = signatureOf(film);
  const mark = state.marks[keyOf(film)];
  const hero = index % 8 === 0;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card' + (hero ? ' card--hero' : '');
  card.dataset.id = keyOf(film);
  if (mark) card.dataset.mark = mark;
  card.style.setProperty('--delay', Math.min(index, 12) * 45 + 'ms');

  // Le libellé accessible est posé par wallLabel : une seule source.
  card.setAttribute('aria-label', wallLabel(film, signature, mark));

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

  const foot = document.createElement('span');
  foot.className = 'card__foot';

  const sig = document.createElement('span');
  sig.className = 'card__sig';
  for (const id of signature) {
    const sticker = STICKER_BY_ID.get(id);
    if (sticker) sig.append(emojiImg(sticker.emoji));
  }
  foot.append(sig);

  // Le titre : le renseignement le plus utile, et il manquait complètement.
  const caption = document.createElement('span');
  caption.className = 'card__caption';

  /* « Parce que vous avez aimé… » : une proposition sans raison est une
     proposition qu'on ne croit pas. */
  if (state.forYou && state.parce?.has(keyOf(film))) {
    const sources = state.parce.get(keyOf(film));
    const parce = document.createElement('span');
    parce.className = 'card__parce';
    parce.textContent = 'parce que ' + sources.slice(0, 2).map(x => x.title).join(', ');
    caption.append(parce);
    card.classList.add('card--parce');
  }
  const name = document.createElement('span');
  name.className = 'card__name';
  name.textContent = film.title;
  const sub = document.createElement('span');
  sub.className = 'card__sub';
  sub.textContent = (film.kind === 'tv' ? 'Série' : 'Film') +
    (film.date ? ' · ' + film.date.slice(0, 4) : '');
  caption.append(name, sub);
  foot.append(caption);
  card.append(foot);

  if (mark) {
    const badge = document.createElement('span');
    badge.className = 'card__state';
    badge.append(emojiImg(markById(mark)?.emoji || '👁️'));
    card.append(badge);
  }

  // La couche de survol, posée sur l'affiche.
  const layer = document.createElement('div');
  layer.className = 'card__peek';
  card.append(layer);

  card.addEventListener('click', () => openCard(film));
  bindPeek(card, film);
  return card;
}

/**
 * Corriger une seule carte du mur, sans le reconstruire.
 * Reconstruire faisait perdre la position de défilement à chaque retour de
 * fiche, et rejouait l'animation d'arrivée des vingt affiches.
 */
function refreshWallCard(film) {
  const signature = signatureOf(film);
  const mark = state.marks[keyOf(film)];

  for (const card of wallEl.querySelectorAll('.card[data-id="' + keyOf(film) + '"]')) {
    const sig = card.querySelector('.card__sig');
    if (sig) {
      sig.replaceChildren(...signature
        .map(id => STICKER_BY_ID.get(id))
        .filter(Boolean)
        .map(sticker => emojiImg(sticker.emoji)));
    }

    const badge = card.querySelector('.card__state');
    if (mark && badge) badge.replaceChildren(emojiImg(markById(mark)?.emoji || '👁️'));
    else if (mark) {
      const fresh = document.createElement('span');
      fresh.className = 'card__state';
      fresh.append(emojiImg(markById(mark)?.emoji || '👁️'));
      card.append(fresh);
    } else if (badge) {
      badge.remove();
    }

    if (mark) card.dataset.mark = mark;
    else delete card.dataset.mark;

    card.setAttribute('aria-label', wallLabel(film, signature, mark));
  }
}

/** Ajoute des affiches à la suite : le mur ne se reconstruit pas, il s'allonge. */
function appendWallCards(items) {
  wallEl.querySelector('.wall-more')?.remove();
  const depart = wallEl.children.length;
  const frag = document.createDocumentFragment();
  items.forEach((film, i) => frag.append(wallCard(film, depart + i)));
  wallEl.append(frag);
}

/** Le bas du mur : on charge la suite, indéfiniment. */
async function loadMore() {
  if (state.loadingMore || !state.more || !state.pageLoader) return;
  state.loadingMore = true;
  const more = document.createElement('span');
  more.className = 'wall-more';
  more.setAttribute('aria-hidden', 'true');
  wallEl.append(more);
  try {
    // On enchaîne jusqu'à trouver du neuf : une page entièrement déjà vue ne
    // doit pas donner l'impression que le mur est fini.
    const avant = () => state.wall.length + state.items.length;
    for (let essai = 0; essai < 5 && state.more; essai++) {
      const compte = avant();
      await state.pageLoader(state.page + 1, { append: true });
      if (avant() > compte) break;
    }
  } catch {
    state.more = false;
  }
  wallEl.querySelector('.wall-more')?.remove();
  state.loadingMore = false;
}

function renderWall() {
  if (!state.wall.length) {
    const empty = document.createElement('p');
    empty.className = 'sr-only';
    empty.textContent = 'Aucun film.';
    wallEl.replaceChildren(empty);
    return;
  }
  wallEl.replaceChildren(...state.wall.map((film, i) => wallCard(film, i)));
  restoreScroll('film');
}

/* ── Où on en est ─────────────────────────────────────────────────────────── */

function saveScroll() {
  state.scroll[state.mode] = { top: wallEl.scrollTop, left: wallEl.scrollLeft };
}

function restoreScroll(mode) {
  const at = state.scroll[mode] || { top: 0, left: 0 };
  wallEl.scrollTop = at.top;
  wallEl.scrollLeft = at.left;
  updateProgress();
}

/** La barre dit où tu en es dans le fil, sans un chiffre. */
function updateProgress() {
  const horizontal = state.mode === 'video';
  const max = horizontal
    ? wallEl.scrollWidth - wallEl.clientWidth
    : wallEl.scrollHeight - wallEl.clientHeight;
  const at = horizontal ? wallEl.scrollLeft : wallEl.scrollTop;
  const ratio = max > 8 ? Math.min(1, Math.max(0, at / max)) : 0;
  progressEl.classList.toggle('is-on', max > 8);
  progressBar.style.transform = 'scaleX(' + ratio + ')';
}

/* ── Les trois présentations ──────────────────────────────────────────────── */

function renderModes() {
  const frag = document.createDocumentFragment();
  for (const mode of MODES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode-btn';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(mode.id === state.mode));
    button.setAttribute('aria-label', mode.label);
    button.append(emojiImg(mode.emoji));
    button.addEventListener('click', () => setMode(mode.id));
    frag.append(button);
  }
  el('modes').replaceChildren(frag);
}

/** Changer de présentation ne change jamais ce que tu as dit d'un film. */
async function setMode(id) {
  if (state.mode === id) return;
  saveScroll();          // on retient où on en était
  state.mode = id;
  appEl.className = 'mode-' + id;
  renderModes();
  announce(MODES.find(m => m.id === id)?.label || '');
  await show();          // et on y retourne
  fadeIn();              // sans que la bascule ne fasse claquer l'écran
}

/** Une bascule de mode est un changement de point de vue, pas un saut. */
function fadeIn() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof wallEl.animate !== 'function') return;
  wallEl.animate([{ opacity: 0.25 }, { opacity: 1 }], {
    duration: 240,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
  });
}

/** Ce qu'on montre quand rien n'est cherché. */
function show() {
  if (state.forYou) return renderForYou();
  if (state.picked.length) return search();
  if (filtresActifs()) return runSearch();
  if (state.mode === 'film') return loadWall();
  state.pageLoader = loadFeed;
  return loadFeed();
}

/** Le fil : les vraies vidéos TMDB, mises bout à bout. */
async function loadFeed(page = 1, { append = false } = {}) {
  if (!append) renderFeedSkeleton();
  const films = [];
  try {
    if (state.live) {
      films.push(...await discoverCorpus(page));
    } else {
      const all = Object.values(DEMO_POOLS).flatMap(p => p.popular);
      films.push(...[...new Map(all.map(f => [f.id, f])).values()].map(f => normalize(f, 'movie')));
    }
  } catch (error) {
    announce('Les vidéos n\'ont pas pu être chargées : ' + error.message);
  }
  films.forEach(f => state.films.set(keyOf(f), f));

  const videos = await mapLimit(films, 6, film => fetchVideos(film));
  const tout = films.map((film, i) => ({ film, video: bestVideo(videos[i]) }));
  const avecMoment = tout.filter(x => x.video);
  // Un film sur quatre n'a aucun moment : si la matière manque, on garde
  // l'affiche plutôt que de montrer un fil vide.
  const items = interleave((avecMoment.length >= 6 ? avecMoment : tout).slice(0, FEED_MAX));
  if (append) {
    const gardes = neufs(items);
    if (!gardes.length) { state.page = page; state.more = page < 500; return; }
    state.items.push(...gardes);
    appendFeedCards(gardes);
  } else {
    state.items = items;
    renderFeed();
  }
  state.page = page;
  state.more = films.length > 0 && page < 500;
}

function renderFeedSkeleton() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < (state.mode === 'reel' ? 1 : 3); i++) {
    const s = document.createElement('span');
    s.className = 'reel reel--skeleton';
    const stage = document.createElement('span');
    stage.className = 'reel__stage';
    s.append(stage);
    frag.append(s);
  }
  wallEl.replaceChildren(frag);
}

/**
 * Dans le fil vertical, un commentaire est un battement entre deux moments —
 * exactement la place d'une citation de presse dans une bande-annonce.
 */
function interleave(items) {
  const out = [];
  for (const item of items) {
    if (state.mode === 'reel' && state.comments[keyOf(item.film)]?.text) {
      out.push({ kind: 'comment', film: item.film });
    }
    out.push({ kind: 'moment', film: item.film, video: item.video });
  }
  return out;
}

/** Une carte du fil : le moment, ton nom dessus, et de quoi réagir dessous. */
function reelCard(item, index) {
  // Le carton de commentaire : plein écran, sans image dessous.
  if (item.kind === 'comment') {
    const card = document.createElement('article');
    card.className = 'reel reel--quote';
    card.dataset.id = keyOf(item.film);
    card.append(quoteCard(item.film));

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'reel__open';
    open.setAttribute('aria-label', item.film.title + '. Ouvrir la fiche.');
    open.addEventListener('click', () => openCard(item.film));
    card.append(open);
    return card;
  }

  const { film, video } = item;
  const signature = signatureOf(film);
  const mark = state.marks[keyOf(film)];

  const card = document.createElement('article');
  card.className = 'reel';
  card.dataset.id = keyOf(film);

  const stage = document.createElement('div');
  stage.className = 'reel__stage';

  if (film.poster_path || video) stage.append(stillEl(film, video, 'reel__still'));

  if (video) {
    const frame = document.createElement('iframe');
    // Pas d'adresse tout de suite : elle n'arrive qu'en approchant de l'écran.
    frame.dataset.key = video.key;
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('aria-hidden', 'true');
    frame.addEventListener('load', () => {
      // Retirer « src » déclenche aussi un load : sans ce garde-fou, une carte
      // libérée se croirait vivante et afficherait un cadre vide.
      if (frame.getAttribute('src')) frame.classList.add('is-live');
    });
    stage.append(frame);
  }

  const veil = document.createElement('span');
  veil.className = 'reel__veil';
  stage.append(veil);

  /* Le même pied que le mur : l'accroche emoji, puis le titre. Sans le titre,
     un mode ne se lisait pas et l'autre si. */
  const foot = document.createElement('div');
  foot.className = 'reel__foot';

  const sig = document.createElement('div');
  sig.className = 'reel__sig';
  for (const id of signature) {
    const sticker = STICKER_BY_ID.get(id);
    if (sticker) sig.append(emojiImg(sticker.emoji));
  }
  foot.append(sig);

  const nom = document.createElement('span');
  nom.className = 'reel__name';
  nom.textContent = film.title;
  foot.append(nom);

  stage.append(foot);

  if (mark) {
    const badge = document.createElement('span');
    badge.className = 'reel__state';
    badge.append(emojiImg(markById(mark)?.emoji || '👁️'));
    stage.append(badge);
  }

  // Toucher l'image ouvre la fiche ; réagir reste possible sans quitter le fil.
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'reel__open';
  open.setAttribute('aria-label', film.title + '. Ouvrir la fiche.');
  open.addEventListener('click', () => openCard(film));
  stage.append(open);

  card.append(stage);

  const react = document.createElement('div');
  react.className = 'reel__react';
  const offerts = byGenres(film).slice(0, state.mode === 'reel' ? 5 : 8);
  for (const sticker of offerts) {
    react.append(reactionButton(film, sticker, signature, signature.includes(sticker.id)));
  }
  card.append(react);

  /* Les mêmes actions que le survol, à la verticale : c'est la disposition de
     TikTok — l'action à droite, ce qu'on lit à gauche — et ça évite d'avoir
     deux vocabulaires selon le mode. */
  if (state.mode === 'reel') card.append(buildActions(card, film, 'rail'));

  return card;
}

/**
 * Un lecteur par carte visible, pas quinze.
 * Quinze vidéos qui jouent ensemble vident la batterie et font ramer le
 * défilement. L'iframe ne reçoit son adresse qu'en approchant, et la perd en
 * s'éloignant — l'affiche reste dessous, donc rien ne clignote.
 */
const momentObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const frame = entry.target.querySelector('iframe[data-key]');
    if (!frame) continue;
    if (entry.isIntersecting) {
      if (!frame.getAttribute('src')) {
        frame.src = momentUrl(frame.dataset.key);
        watchPlayer(frame);
        armPlayFallback(frame.closest('.reel__stage'), frame.dataset.key);
      }
    } else if (frame.getAttribute('src')) {
      frame.removeAttribute('src');
      frame.classList.remove('is-live');
    }
  }
}, { root: wallEl, rootMargin: '400px 400px' });

function observeMoments() {
  momentObserver.disconnect();
  for (const card of wallEl.querySelectorAll('.reel')) momentObserver.observe(card);
}

/** Ajoute des moments à la suite : le fil s'allonge, il ne se reconstruit pas. */
function appendFeedCards(items) {
  const frag = document.createDocumentFragment();
  items.forEach((item, i) => frag.append(reelCard(item, state.items.length - items.length + i)));
  wallEl.append(frag);
  observeMoments();
}

function renderFeed() {
  if (!state.items.length) {
    const empty = document.createElement('p');
    empty.className = 'sr-only';
    empty.textContent = 'Aucune vidéo.';
    wallEl.replaceChildren(empty);
    return;
  }
  wallEl.replaceChildren(...state.items.map((item, i) => reelCard(item, i)));
  observeMoments();
  restoreScroll(state.mode);
}

/* ── Passer d'un film à l'autre ───────────────────────────────────────────── */

/** La liste courante, dans l'ordre de la présentation, sans doublon. */
function currentList() {
  if (state.mode === 'film') return state.wall;
  return [...new Map(state.items.map(item => [keyOf(item.film), item.film])).values()];
}

function filmAt(index) {
  const list = currentList();
  return index >= 0 && index < list.length ? list[index] : null;
}

/** Sans ressortir de la fiche : c'est le geste qui manquait le plus. */
function stepFilm(direction) {
  const list = currentList();
  const at = list.findIndex(x => x === current);
  if (at < 0) return;
  const next = filmAt(at + direction);
  if (!next) return;
  openCard(next);
}

async function loadWall() {
  renderSkeletons();
  try {
    if (state.live) {
      // Films et animés, entrelacés.
      state.pageLoader = async (page, options) => {
        const items = await discoverCorpus(page);
        if (options?.append) {
          const gardes = neufs(items);
          if (!gardes.length) { state.page = page; state.more = page < 500; return; }
          items.length = 0;
          items.push(...gardes);
          items.forEach(f => state.films.set(keyOf(f), f));
          state.wall.push(...items);
          appendWallCards(items);
          state.page = page;
          state.more = items.length > 0 && page < 500;
          return;
        }
        items.forEach(f => state.films.set(keyOf(f), f));
        state.wall = items;
        state.page = 1;
        state.more = items.length > 0;
      };
      await state.pageLoader(1);
    } else {
      const ids = Object.values(DEMO_POOLS).flatMap(p => p.popular);
      const unique = [...new Map(ids.map(f => [f.id, f])).values()];
      unique.forEach(f => state.films.set(keyOf(f), f));
      state.wall = unique.map(f => normalize(f, 'movie'));
      state.more = false;
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
  if (!placed.length) return show();

  const dansLeFil = state.mode !== 'film';
  // Une recherche neuve repart du début : on ne garde pas une position qui ne
  // veut plus rien dire.
  state.scroll[state.mode] = { top: 0, left: 0 };
  if (dansLeFil) renderFeedSkeleton();
  else renderSkeletons(6);

  const pools = {};
  try {
    for (const id of state.picked) {
      pools[id] = await state.client.stickerPools(STICKER_BY_ID.get(id));
    }
    const seed = placed.map(p => p.id + ':1.00').join('|');
    let films = selectMovies(placed, pools, [], seed).map(e => e.movie);

    // Le texte et les emoji ne sont pas deux recherches : le texte affine.
    const mot = state.query.trim().toLowerCase();
    if (mot) films = films.filter(f => f.title.toLowerCase().includes(mot));

    films.forEach(f => state.films.set(keyOf(f), f));
    announce(films.length + ' films trouvés.');

    if (dansLeFil) {
      const videos = await mapLimit(films, 6, film => fetchVideos(film));
      state.items = interleave(films.map((film, i) => ({ film, video: bestVideo(videos[i]) })));
    } else {
      state.wall = films;
    }
  } catch (error) {
    announce('La recherche a échoué : ' + error.message);
  }
  if (dansLeFil) renderFeed();
  else renderWall();
}


/* ── Les ordres de présentation ──────────────────────────────────────────── *
   TMDB n'accepte QU'UN tri. Les suivants s'appliquent donc ici, sur ce qu'on
   a déjà reçu — c'est une limite de la source, pas un choix. Le premier tri
   part au serveur : c'est lui qui décide de ce qu'on descend chercher.      */

const TRIS = [
  { id: 'populaire', emoji: '🔥', nom: 'Populaires', movie: 'popularity.desc', tv: 'popularity.desc' },
  { id: 'recent', emoji: '🆕', nom: 'Récents', movie: 'primary_release_date.desc', tv: 'first_air_date.desc' },
  { id: 'ancien', emoji: '⏳', nom: 'Anciens', movie: 'primary_release_date.asc', tv: 'first_air_date.asc' },
  { id: 'note', emoji: '⭐', nom: 'Mieux notés', movie: 'vote_average.desc', tv: 'vote_average.desc' },
  { id: 'votes', emoji: '🗳️', nom: 'Plus votés', movie: 'vote_count.desc', tv: 'vote_count.desc' },
  { id: 'recettes', emoji: '💰', nom: 'Plus rentables', movie: 'revenue.desc', tv: 'popularity.desc' },
  { id: 'court', emoji: '⏱️', nom: 'Les plus courts', movie: 'popularity.desc', tv: 'popularity.desc' },
  { id: 'obscur', emoji: '🕯️', nom: 'Moins connus', movie: 'popularity.asc', tv: 'popularity.asc' },
  { id: 'alpha', emoji: '🔤', nom: 'A → Z', movie: 'original_title.asc', tv: 'name.asc' },
  { id: 'hasard', emoji: '🎲', nom: 'Au hasard', movie: null, tv: null }
];

const triParId = id => TRIS.find(t => t.id === id) || null;

/** Comment comparer deux films pour un critère. Le signe porte le sens. */
const COMPARER = {
  populaire: f => -(f.popularity || 0),
  recent: f => -(Date.parse(f.date) || 0),
  ancien: f => (Date.parse(f.date) || 0),
  note: f => -(f.vote_average || 0),
  votes: f => -(f.vote_count || 0),
  recettes: f => -(f.revenue || 0),
  court: f => (f.runtime || 999),
  obscur: f => (f.popularity || 0),
  alpha: f => String(f.title || '').toLowerCase()
};

/** Le tri cumulé : les critères s'appliquent dans l'ordre où on les a posés. */
function trier(items) {
  let out = [...items];
  const criteres = state.tris.map(id => COMPARER[id]).filter(Boolean);
  if (criteres.length) {
    out.sort((a, b) => {
      for (const cle of criteres) {
        const va = cle(a);
        const vb = cle(b);
        if (va < vb) return -1;
        if (va > vb) return 1;
      }
      return 0;
    });
  }
  if (state.tris.includes('hasard')) {
    // Un vrai mélange : c'est la seule façon de ne pas revoir les mêmes.
    for (let i = out.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [out[i], out[k]] = [out[k], out[i]];
    }
  }
  return out;
}

/** Le tri qui part à TMDB : le premier posé, et lui seul. */
function triServeur(kind) {
  for (const id of state.tris) {
    const tri = triParId(id);
    if (tri && tri[kind]) return tri[kind];
  }
  return null;
}

/** Les tris disponibles, puis ceux qui sont actifs, dans leur ordre. */
function renderTris() {
  const host = el('tris');
  const frag = document.createDocumentFragment();

  // Les actifs d abord, dans l ordre ou on les a poses : le cumul se lit
  // dans la liste elle-meme, sans chiffre.
  const ordonnes = [...TRIS].sort((a, b) => {
    const ra = state.tris.indexOf(a.id);
    const rb = state.tris.indexOf(b.id);
    if (ra < 0 && rb < 0) return 0;
    if (ra < 0) return 1;
    if (rb < 0) return -1;
    return ra - rb;
  });

  for (const tri of ordonnes) {
    const rang = state.tris.indexOf(tri.id);
    const actif = rang >= 0;
    const chip = filterChip(tri.emoji, tri.nom, actif, () => {
      const at = state.tris.indexOf(tri.id);
      if (at >= 0) state.tris.splice(at, 1);
      else state.tris.push(tri.id);
      state.dejaVu = new Set();
      renderTris();
      scheduleFilter();
    });
    // Le rang se lit dans l'ordre des pastilles actives, pas dans un chiffre.
    chip.dataset.rang = String(rang);
    frag.append(chip);
  }
  host.replaceChildren(frag);
}

/* ── Les sous-genres ─────────────────────────────────────────────────────── *
   Un genre seul, c'est mille films et toujours les mêmes en tête. Les
   sous-genres sont des MOTS-CLÉS TMDB : ils découpent assez fin pour qu'on
   descende dans le catalogue au lieu de tourner en rond. Résolus à la demande
   et gardés en cache — l'identifiant d'un mot-clé ne change jamais.        */

const SOUS_GENRES = {
  28: [ // Action
    ['arts martiaux', '🥋', 'martial arts'], ['espionnage', '🕶️', 'spy'],
    ['poursuite', '🚗', 'car chase'], ['arts martiaux', '🥋', 'kung fu'],
    ['super-héros', '🦸', 'superhero'], ['arts martiaux', '🥋', 'samurai']
  ],
  12: [ // Aventure
    ['exploration', '🧭', 'exploration'], ['naufrage', '🌊', 'shipwreck'],
    ['trésor', '💎', 'treasure hunt'], ['jungle', '🌴', 'jungle'],
    ['montagne', '🏔️', 'mountain climbing'], ['désert', '🏜️', 'desert']
  ],
  16: [ // Animation
    ['anime', '🌸', 'anime'], ['pâte à modeler', '🧱', 'stop motion'],
    ['conte', '🧚', 'fairy tale'], ['musical', '🎵', 'musical'],
    ['enfance', '🧒', 'childhood'], ['adaptation manga', '📖', 'based on manga']
  ],
  35: [ // Comédie
    ['parodie', '🎭', 'parody'], ['comédie romantique', '💘', 'romantic comedy'],
    ['humour noir', '🖤', 'dark comedy'], ['buddy movie', '👯', 'buddy comedy'],
    ['satire', '📰', 'satire'], ['stand-up', '🎤', 'stand-up comedy']
  ],
  80: [ // Crime
    ['braquage', '💰', 'heist'], ['mafia', '🚬', 'mafia'],
    ['tueur en série', '🔪', 'serial killer'], ['drogue', '💊', 'drug trade'],
    ['braquage', '💰', 'robbery'], ['police corrompue', '🚔', 'corrupt cop']
  ],
  99: [ // Documentaire
    ['nature', '🌿', 'nature'], ['musique', '🎸', 'music documentary'],
    ['sport', '🏅', 'sport'], ['politique', '🏛️', 'politics'],
    ['science', '🔬', 'science'], ['histoire vraie', '📜', 'true story']
  ],
  18: [ // Drame
    ['famille', '👨‍👩‍👧', 'family drama'], ['deuil', '🕯️', 'grief'],
    ['maladie', '🏥', 'illness'], ['pauvreté', '🏚️', 'poverty'],
    ['adolescence', '🎒', 'coming of age'], ['justice', '⚖️', 'courtroom']
  ],
  10751: [ // Familial
    ['enfants', '🧸', 'children'], ['animaux', '🐕', 'animal'],
    ['magie', '🪄', 'magic'], ['Noël', '🎄', 'christmas'],
    ['amitié', '🤝', 'friendship'], ['école', '🏫', 'school']
  ],
  14: [ // Fantastique
    ['magie', '🪄', 'magic'], ['dragons', '🐉', 'dragon'],
    ['monde imaginaire', '🗺️', 'fantasy world'], ['malédiction', '🕯️', 'curse'],
    ['fées', '🧚', 'fairy'], ['mythe', '🏛️', 'mythology']
  ],
  36: [ // Histoire
    ['seconde guerre', '🪖', 'world war ii'], ['antiquité', '🏺', 'ancient rome'],
    ['moyen âge', '⚔️', 'middle ages'], ['biographie', '📜', 'biography'],
    ['révolution', '✊', 'revolution'], ['empire', '👑', 'empire']
  ],
  27: [ // Horreur
    ['zombies', '🧟', 'zombie'], ['vampires', '🧛', 'vampire'],
    ['fantômes', '👻', 'ghost'], ['possession', '😈', 'demonic possession'],
    ['tueur', '🔪', 'slasher'], ['loup-garou', '🐺', 'werewolf']
  ],
  10402: [ // Musique
    ['rock', '🎸', 'rock band'], ['jazz', '🎷', 'jazz'],
    ['classique', '🎻', 'classical music'], ['rap', '🎤', 'hip-hop'],
    ['danse', '💃', 'dance'], ['opéra', '🎭', 'opera']
  ],
  9648: [ // Mystère
    ['enquête', '🔍', 'investigation'], ['disparition', '🕳️', 'missing person'],
    ['whodunit', '🕵️', 'whodunit'], ['amnésie', '🧠', 'amnesia'],
    ['complot', '📎', 'conspiracy'], ['énigme', '🧩', 'puzzle']
  ],
  10749: [ // Romance
    ['coup de foudre', '💘', 'love at first sight'], ['mariage', '💍', 'wedding'],
    ['adultère', '💔', 'adultery'], ['lettres', '💌', 'love letter'],
    ['été', '☀️', 'summer romance'], ['rupture', '🥀', 'breakup']
  ],
  878: [ // Science-Fiction
    ['intelligence artificielle', '🤖', 'artificial intelligence'],
    ['voyage spatial', '🚀', 'space travel'], ['dystopie', '🏚️', 'dystopia'],
    ['voyage temporel', '⏳', 'time travel'], ['cyberpunk', '🌃', 'cyberpunk'],
    ['invasion', '👽', 'alien invasion'], ['clonage', '🧬', 'cloning']
  ],
  53: [ // Thriller
    ['enlèvement', '🪢', 'kidnapping'], ['trahison', '🎭', 'betrayal'],
    ['espionnage', '🕶️', 'spy'], ['vengeance', '🔥', 'revenge'],
    ['poursuite', '🏃', 'chase'], ['manipulation', '🪞', 'manipulation']
  ],
  10752: [ // Guerre
    ['seconde guerre', '🪖', 'world war ii'], ['viêtnam', '🌴', 'vietnam war'],
    ['tranchées', '⛏️', 'trench warfare'], ['résistance', '✊', 'resistance'],
    ['aviation', '✈️', 'fighter pilot'], ['débarquement', '🚢', 'd-day']
  ],
  37: [ // Western
    ['shérif', '⭐', 'sheriff'], ['hors-la-loi', '🤠', 'outlaw'],
    ['vengeance', '🔥', 'revenge'], ['frontière', '🌵', 'frontier'],
    ['duel', '🔫', 'gunfight'], ['ranch', '🐎', 'ranch']
  ]
};

/** L'identifiant d'un mot-clé, demandé une fois puis gardé. */
async function motCleId(nom) {
  const cache = getKeywordCache();
  if (Object.prototype.hasOwnProperty.call(cache, nom)) return cache[nom];
  try {
    const data = await api('/search/keyword', { query: nom });
    const exact = (data.results || []).find(k => String(k.name).toLowerCase() === nom.toLowerCase());
    const id = exact ? exact.id : ((data.results || [])[0]?.id ?? null);
    setKeywordId(nom, id);
    return id;
  } catch {
    return null;
  }
}

/* ── Chercher et filtrer ──────────────────────────────────────────────────── */

/* Le type, puis les genres. Chaque filtre a son pictogramme : le mot dit quoi,
   l'image le fait reconnaître. Ce sont les identifiants de genres TMDB. */
const TYPES = [
  { id: 'all', emoji: '🌍', label: 'Tout' },
  { id: 'movie', emoji: '🎬', label: 'Films' },
  { id: 'tv', emoji: '📺', label: 'Séries' }
];

const GENRES = [
  { id: 28, emoji: '🔫', label: 'Action' },
  { id: 12, emoji: '🧭', label: 'Aventure' },
  { id: 16, emoji: '🐉', label: 'Animation' },
  { id: 35, emoji: '😂', label: 'Comédie' },
  { id: 80, emoji: '🕵️', label: 'Crime' },
  { id: 99, emoji: '🎞️', label: 'Documentaire' },
  { id: 18, emoji: '🎭', label: 'Drame' },
  { id: 10751, emoji: '👧', label: 'Familial' },
  { id: 14, emoji: '🪄', label: 'Fantastique' },
  { id: 36, emoji: '🏺', label: 'Histoire' },
  { id: 27, emoji: '👻', label: 'Horreur' },
  { id: 10402, emoji: '🎸', label: 'Musique' },
  { id: 9648, emoji: '🕯️', label: 'Mystère' },
  { id: 10749, emoji: '💍', label: 'Romance' },
  { id: 878, emoji: '🤖', label: 'Science-Fiction' },
  { id: 53, emoji: '🔪', label: 'Thriller' },
  { id: 10752, emoji: '⚔️', label: 'Guerre' },
  { id: 37, emoji: '🤠', label: 'Western' },
  { id: 10759, emoji: '🧨', label: 'Action et aventure' },
  { id: 10762, emoji: '🧸', label: 'Jeunesse' },
  { id: 10765, emoji: '🛸', label: 'SF et fantastique' },
  { id: 10768, emoji: '🪖', label: 'Guerre et politique' }
];

/** Un filtre : pictogramme et mot, l'un ne va pas sans l'autre. */
function filterChip(emoji, label, on, onToggle) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter';
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', label);
  button.append(emojiImg(emoji));
  const word = document.createElement('span');
  word.textContent = label;
  button.append(word);
  button.addEventListener('click', onToggle);
  return button;
}

/**
 * Ce qu'on a déjà montré dans cette session.
 *
 * C'est la réponse à « on tourne en rond » : discover renvoie toujours les
 * mêmes vingt films en tête, donc changer de page ou de catégorie les ramenait
 * indéfiniment. On ne montre un film qu'une fois, et on enchaîne les pages
 * jusqu'à en trouver d'autres.
 */
function neufs(items) {
  const gardes = items.filter(film => !state.dejaVu.has(keyOf(film)));
  gardes.forEach(film => state.dejaVu.add(keyOf(film)));
  return gardes;
}

/** Les sous-genres du genre choisi, s'il en a. */
function renderSousFiltres() {
  const host = el('sous-filtres');
  const choisis = state.genres.filter(id => SOUS_GENRES[id]);
  if (choisis.length !== 1) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }

  const frag = document.createDocumentFragment();
  for (const [nom, emoji, mot] of SOUS_GENRES[choisis[0]]) {
    frag.append(filterChip(emoji, nom, state.sousGenre === mot, () => {
      state.sousGenre = state.sousGenre === mot ? null : mot;
      state.dejaVu = new Set();
      renderSousFiltres();
      scheduleFilter();
    }));
  }
  host.replaceChildren(frag);
  host.hidden = false;
}

function renderFilters() {
  const frag = document.createDocumentFragment();

  /* « Pour vous » n'existe qu'à partir du moment où on a aimé un film : avant,
     il n'aurait rien à dire. C'est la récompense d'avoir donné son avis. */
  const aAime = Object.values(state.marks).some(valeur => valeur === 'love');
  if (aAime) {
    frag.append(filterChip('❤️', 'Pour vous', state.forYou, () => {
      state.forYou = !state.forYou;
      renderFilters();
      show();
    }));
    const barre = document.createElement('span');
    barre.className = 'filter-sep';
    frag.append(barre);
  }

  for (const type of TYPES) {
    frag.append(filterChip(type.emoji, type.label, state.type === type.id, () => {
      state.type = type.id;
      state.dejaVu = new Set();
      renderFilters();
      scheduleFilter();
    }));
  }

  const sep = document.createElement('span');
  sep.className = 'filter-sep';
  frag.append(sep);

  for (const genre of GENRES) {
    const on = state.genres.includes(genre.id);
    frag.append(filterChip(genre.emoji, genre.label, on, () => {
      const at = state.genres.indexOf(genre.id);
      if (at >= 0) state.genres.splice(at, 1);
      else state.genres.push(genre.id);
      // Un autre genre, d'autres sous-genres, et une ardoise neuve.
      state.sousGenre = null;
      state.dejaVu = new Set();
      renderFilters();
      renderSousFiltres();
      scheduleFilter();
    }));
  }

  el('filters').replaceChildren(frag);
}

/** Les emoji choisis, affichés DANS la barre : une seule requête, deux
 *  écritures. C'est ce qui rend les deux moteurs cohérents. */
function renderQueryChips() {
  const host = el('query-chips');
  const frag = document.createDocumentFragment();
  for (const id of state.picked) {
    const sticker = STICKER_BY_ID.get(id);
    if (!sticker) continue;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'query-chip';
    chip.setAttribute('aria-label', sticker.label + '. Retirer de la recherche.');
    chip.append(emojiImg(sticker.emoji));
    chip.addEventListener('click', () => {
      const at = state.picked.indexOf(id);
      if (at >= 0) state.picked.splice(at, 1);
      renderPalette();
      renderQueryChips();
      show();
    });
    frag.append(chip);
  }
  host.replaceChildren(frag);
}

/** Une frappe, un filtre : on attend un peu, puis on cherche une fois. */
let filterTimer = 0;
function scheduleFilter() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(show, 340);
}

const filtresActifs = () =>
  Boolean(state.query.trim()) || state.type !== 'all' || state.genres.length > 0 ||
  state.tris.some(id => id !== 'populaire');

/**
 * La recherche. TMDB ne sait pas filtrer une recherche par texte : on filtre
 * donc nous-mêmes sur les genres que les résultats portent déjà.
 */
async function runSearch(page = 1, { append = false } = {}) {
  if (!append) renderSkeletons(12);
  state.pageLoader = runSearch;
  const q = state.query.trim();
  let trouves = [];

  try {
    if (q) {
      const data = await api('/search/multi', { query: q, include_adult: false, page });
      trouves = (data.results || [])
        .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
        .map(r => normalize(r, r.media_type));
    } else {
      const motCle = state.sousGenre ? await motCleId(state.sousGenre) : null;
      const kinds = state.type === 'all' ? ['movie', 'tv'] : [state.type];
      const paquets = await Promise.all(kinds.map(kind => api('/discover/' + kind, {
        sort_by: triServeur(kind) || 'popularity.desc',
        // Un tri par note sans plancher de votes remonte des films à trois
        // voix : le plancher monte avec le tri.
        'vote_count.gte': state.tris[0] === 'note' ? 1000 : 100,
        with_genres: state.genres.join(','),
        with_keywords: motCle || undefined,
        page
      }).catch(() => ({ results: [] }))));
      trouves = paquets.flatMap((paquet, i) => (paquet.results || []).map(r => normalize(r, kinds[i])));
      trouves = trier(trouves);
    }
  } catch (error) {
    announce('La recherche a échoué : ' + error.message);
  }

  if (state.type !== 'all') trouves = trouves.filter(f => f.kind === state.type);
  if (state.genres.length) {
    trouves = trouves.filter(f => (f.genre_ids || []).some(g => state.genres.includes(g)));
  }

  announce(trouves.length + (trouves.length > 1 ? ' résultats.' : ' résultat.'));

  if (state.mode === 'film') {
    trouves.forEach(f => state.films.set(keyOf(f), f));
    if (append) {
      const gardes = neufs(trouves);
      if (!gardes.length) { state.page = page; state.more = page < 500; return; }
      state.wall.push(...gardes);
      appendWallCards(gardes);
    } else {
      state.wall = trouves;
      state.scroll.film = { top: 0, left: 0 };
      renderWall();
    }
    state.page = page;
    state.more = trouves.length > 0 && page < 500;
  } else {
    // Dans un fil, on ne garde que ce dont on peut montrer un moment.
    const courts = trouves.slice(0, 12);
    const videos = await mapLimit(courts, 6, film => fetchVideos(film));
    state.items = interleave(courts.map((film, i) => ({ film, video: bestVideo(videos[i]) })));
    state.scroll[state.mode] = { top: 0, left: 0 };
    renderFeed();
  }
}

/* ── Pour vous : l'avis sert à découvrir ─────────────────────────────────── *
   On ne note pas pour noter. Chaque film aimé tire vers nous ce que TMDB lui
   associe, et le score dit pourquoi. Plus rien n'est proposé deux fois.    */

/** Ce que pèse un avis dans la recommandation. « J'adore » pèse trois fois
 *  plus que « vu » : c'est le goût qu'on cherche, pas l'historique. */
const POIDS_AVIS = { love: 3, ok: 1.6, seen: 0.6, nope: -1.5, watching: 0.4 };

let recsCache = new Map();

/** Les recommandations d'un film, demandées une seule fois. */
async function recommendationsOf(film) {
  const at = keyOf(film);
  if (recsCache.has(at)) return recsCache.get(at);
  const data = await api('/' + (film.kind || 'movie') + '/' + film.id + '/recommendations')
    .catch(() => ({ results: [] }));
  const items = (data.results || []).map(r => normalize(r, film.kind || 'movie'));
  recsCache.set(at, items);
  return items;
}

/**
 * Ce qu'on devrait aimer, d'après ce qu'on a aimé.
 * Le score additionne les poids des films qui le proposent : un titre conseillé
 * par trois films adorés passe devant un titre conseillé par un seul.
 */
async function buildRecommendations() {
  const sources = [...state.films.values()]
    .filter(film => POIDS_AVIS[state.marks[keyOf(film)]] !== undefined)
    .filter(film => POIDS_AVIS[state.marks[keyOf(film)]] > 0.5)
    .sort((a, b) => POIDS_AVIS[state.marks[keyOf(b)]] - POIDS_AVIS[state.marks[keyOf(a)]]);

  if (!sources.length) return { items: [], sources: [], parce: new Map() };

  const paquets = await mapLimit(sources.slice(0, 8), 4, film => recommendationsOf(film));

  const scores = new Map();
  const objets = new Map();
  const parce = new Map();
  paquets.forEach((items, i) => {
    const poids = POIDS_AVIS[state.marks[keyOf(sources[i])]];
    for (const item of items) {
      const at = keyOf(item);
      // On ne propose jamais ce qu'on a déjà jugé.
      if (state.marks[at]) continue;
      scores.set(at, (scores.get(at) || 0) + poids);
      objets.set(at, item);
      if (!parce.has(at)) parce.set(at, []);
      parce.get(at).push(sources[i]);
    }
  });

  const items = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([at]) => objets.get(at))
    .filter(Boolean);

  items.forEach(item => state.films.set(keyOf(item), item));
  state.parce = parce;
  state.sources = sources;
  return { items, sources, parce };
}

/** Le mur « Pour vous », avec la raison de chaque proposition. */
async function renderForYou() {
  renderSkeletons(12);
  const { items, sources } = await buildRecommendations();

  if (!sources.length) {
    const vide = document.createElement('p');
    vide.className = 'wall-vide';
    vide.textContent = 'Marque un film « j\'adore » et les propositions arrivent ici.';
    wallEl.replaceChildren(vide);
    return;
  }
  if (!items.length) {
    const vide = document.createElement('p');
    vide.className = 'wall-vide';
    vide.textContent = 'Rien de neuf à proposer pour l\'instant.';
    wallEl.replaceChildren(vide);
    return;
  }

  state.wall = items.slice(0, 60);
  state.more = false;
  state.pageLoader = null;
  state.scroll.film = { top: 0, left: 0 };
  renderWall();
  announce(state.wall.length + ' films proposés d\'après ' + sources.length + ' films aimés.');
}

/* ── Le survol : un diaporama par groupes ────────────────────────────────── *
   Le survol ne déverse plus tout d'un coup : il fait apparaître des flèches
   et déroule l'information par groupes qui tiennent dans la carte — jamais
   d'ascenseur. Le compte à rebours avance tout seul, et le dernier groupe est
   la bande-annonce.                                                        */

const canHover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
let peekTimer = 0;

const CHEVRON = () => Object.assign(document.createElement('span'), { className: 'chev' });

/** Les groupes, dans l'ordre. Le moment vient toujours en dernier. */
function filmSlides(film) {
  // L'affiche d'abord : on ouvre sur le film, pas sur un paragraphe.
  const slides = [{ kind: 'affiche', nom: 'Affiche' }];

  // 1 — de quoi ça parle
  slides.push({
    kind: 'resume',
    nom: 'Résumé',
    title: film.title,
    meta: metaLine(film),
    text: film.overview || ''
  });

  // 2 — qui l'a fait
  const gens = [];
  if (film.director) gens.push([film.kind === 'tv' ? 'Création' : 'Réalisation', film.director]);
  if (film.cast?.length) gens.push(['Avec', film.cast.slice(0, 4).join(', ')]);
  if (film.companies?.length) gens.push(['Production', film.companies.slice(0, 2).join(', ')]);
  if (gens.length) slides.push({ kind: 'rows', nom: 'Équipe', rows: gens });

  // 3 — ce qu'on en sait
  const faits = [];
  if (film.countries?.length) faits.push(['Pays', film.countries.join(', ')]);
  if (film.vote_count) faits.push(['Note', film.vote_average.toFixed(1) + ' / 10']);
  if (film.budget) faits.push(['Budget', money(film.budget)]);
  if (film.revenue) faits.push(['Recettes', money(film.revenue)]);
  if (faits.length) slides.push({ kind: 'rows', nom: 'Chiffres', rows: faits });

  // 4 — où le voir
  if (film.providers?.length) slides.push({ kind: 'rows', nom: 'Où le voir', rows: [['', film.providers.join(', ')]] });

  // 5 — le moment, toujours en dernier
  const moment = momentOf(film);
  if (moment) slides.push({ kind: 'moment', nom: 'Bande-annonce', key: moment.key });

  return slides;
}

function slideBody(slide) {
  const wrap = document.createElement('div');
  wrap.className = 'peek__slide';

  // L'affiche ne pose rien : c'est l'image, et les actions par-dessus.
  if (slide.kind === 'affiche') return wrap;

  if (slide.kind === 'moment') {
    const stage = document.createElement('div');
    stage.className = 'peek__moment';
    const frame = document.createElement('iframe');
    frame.src = momentUrl(slide.key);
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('aria-hidden', 'true');
    stage.append(frame);
    watchPlayer(frame);
    wrap.append(stage);
    return wrap;
  }

  if (slide.title) {
    const title = document.createElement('p');
    title.className = 'text__title';
    title.textContent = slide.title;
    wrap.append(title);
  }
  if (slide.meta) {
    const meta = document.createElement('p');
    meta.className = 'text__meta';
    meta.textContent = slide.meta;
    wrap.append(meta);
  }
  if (slide.text) {
    const text = document.createElement('p');
    text.className = 'text__overview';
    text.textContent = slide.text;
    wrap.append(text);
  }
  for (const [label, value] of slide.rows || []) {
    const row = document.createElement('div');
    row.className = 'text__row';
    const name = document.createElement('span');
    name.className = 'text__label';
    name.textContent = label;
    const content = document.createElement('span');
    content.className = 'text__value';
    content.textContent = value;
    row.append(name, content);
    if (!label) row.classList.add('text__row--seul');
    wrap.append(row);
  }
  return wrap;
}

/** Affiche un groupe, et arme le compte à rebours du suivant. */
function showSlide(card, film, index) {
  const deck = card.__deck;
  if (!deck) return;
  deck.at = Math.max(0, Math.min(deck.slides.length - 1, index));

  const slide = deck.slides[deck.at];

  [...deck.bar.children].forEach((seg, i) => seg.classList.toggle('is-done', i < deck.at));

  // Le contenu, remplacé d'un bloc : jamais deux groupes à l'écran.
  deck.body.replaceChildren(slideBody(slide));

  // Le raccourci courant s'allume : on sait toujours où on est.
  deck.onglets.forEach((bouton, i) => {
    bouton.setAttribute('aria-current', String(i === deck.at));
  });

  // Plus de compte à rebours : on va où on veut, quand on veut.
  card.classList.toggle('is-affiche', slide.kind === 'affiche');
}

/** Un état qui bascule : c'est le geste le plus fréquent, il doit être immédiat. */
function toggleMark(film, value) {
  const at = keyOf(film);
  if (state.marks[at] === value) delete state.marks[at];
  else state.marks[at] = value;
  saveStore();
  renderFilters();
  refresh(film);
  return state.marks[at] === value;
}

/** Chercher des films comme celui-ci : sa signature devient la requête. */
function searchLike(film) {
  state.picked = signatureOf(film).slice();
  state.forYou = false;
  renderQueryChips();
  renderPalette();
  renderFilters();
  show();
  announce('Recherche par la signature de ' + film.title + '.');
}

/** Les films similaires, d'après TMDB. */
async function showSimilar(film) {
  renderSkeletons(12);
  const items = await recommendationsOf(film);
  state.wall = items;
  state.more = false;
  state.pageLoader = null;
  state.scroll.film = { top: 0, left: 0 };
  renderWall();
  announce(items.length + ' films similaires à ' + film.title + '.');
}

/**
 * En haut de la carte : ce qu'on veut faire d'un film, d'un seul geste.
 * Vue, j'aime, ma liste — puis chercher comme ça, et les films similaires.
 */
function buildActions(card, film, variante) {
  const row = document.createElement('div');
  row.className = variante === 'rail' ? 'reel__rail' : 'peek__actions';

  const actions = [
    ['seen', '👁️', 'Vu'],
    ["love", "❤️", "J'adore"],
    ['want', '🎟️', 'Dans ma liste'],
    [null, '🔍', 'Chercher des films comme celui-ci'],
    [null, '🎬', 'Films similaires']
  ];

  for (const [mark, emoji, label] of actions) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = variante === 'rail' ? 'reel__act' : 'peek__act';
    bouton.dataset.act = mark || (emoji === '🔍' ? 'search' : 'similar');
    bouton.setAttribute('aria-label', label);
    bouton.title = label;
    if (mark) bouton.setAttribute('aria-pressed', String(state.marks[keyOf(film)] === mark));
    bouton.append(emojiImg(emoji));
    bouton.addEventListener('click', event => {
      event.stopPropagation();
      if (mark) {
        const actif = toggleMark(film, mark);
        bouton.setAttribute('aria-pressed', String(actif));
        announce(label + (actif ? ' activé.' : ' désactivé.'));
        return;
      }
      if (emoji === '🔍') searchLike(film);
      else showSimilar(film);
    });
    row.append(bouton);
  }
  return row;
}

/** Monte le diaporama dans la carte. */
function buildDeck(card, film) {
  if (card.__deck) return card.__deck;

  const layer = card.querySelector('.card__peek');
  const bar = document.createElement('div');
  bar.className = 'peek__bar';
  const body = document.createElement('div');
  body.className = 'peek__body';

  const layer2 = document.createElement('div');
  layer2.className = 'peek__plate';

  const slides = filmSlides(film);

  // Le deck est déclaré AVANT ses boutons : ils le referencent dans showSlide.
  const deck = { slides, at: 0, timer: 0, bar, body, onglets: [], film };
  card.__deck = deck;
  /* Des raccourcis nommés plutôt que des flèches : on voit CE QU'ON PEUT voir,
     au lieu d'avancer à l'aveugle. Discrets, mais on sait où on va. */
  const jump = document.createElement('div');
  jump.className = 'peek__jump';
  const onglets = slides.map((slide, i) => {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'peek__tab';
    bouton.textContent = slide.nom || 'Détail';
    bouton.addEventListener('click', event => {
      event.stopPropagation();
      clearTimeout(peekTimer);
      showSlide(card, film, i);
    });
    jump.append(bouton);
    return bouton;
  });

  layer2.append(buildActions(card, film), bar, body, jump);
  layer.replaceChildren(layer2);
  deck.onglets = onglets;
  return deck;
}

/** Le survol n'existe qu'à la souris ; au doigt, c'est la fiche qui s'ouvre. */
function bindPeek(card, film) {
  if (!canHover()) return;

  let fermeture = 0;
  const fermer = () => {
    clearTimeout(peekTimer);
    card.classList.remove('is-peeking');
    card.classList.remove('is-affiche');
    if (card.__deck) clearTimeout(card.__deck.timer);
  };
  /* Un délai avant de fermer : le moindre écart de souris emportait la
     bande-annonce en cours. Elle ne doit pas disparaître si facilement. */
  const fermerBientot = () => {
    clearTimeout(fermeture);
    fermeture = setTimeout(fermer, 420);
  };

  card.addEventListener('pointerenter', () => {
    clearTimeout(peekTimer);
    // Un délai : on ne déploie pas une fiche en traversant la grille.
    peekTimer = setTimeout(async () => {
      buildDeck(card, film);
      card.classList.add('is-peeking');
      showSlide(card, film, 0);
      // Le détail ET les vidéos : sans elles, le dernier groupe n'existe pas.
      if ((!film.__detail || !film.__videos) && state.live) {
        await Promise.all([fetchDetail(film), fetchExtras(film)]);
        /* Le détail arrive et les groupes changent. On refait le diaporama,
           mais on retrouve le groupe où on était PAR SON NOM : la
           bande-annonce qu'on vient d'ouvrir ne doit pas s'évaporer parce que
           les données sont arrivées après. */
        if (card.classList.contains('is-peeking')) {
          const voulu = card.__deck.slides[card.__deck.at]?.nom;
          card.classList.remove('is-affiche');
          card.__deck = null;
          buildDeck(card, film);
          const ou = card.__deck.slides.findIndex(s => s.nom === voulu);
          showSlide(card, film, ou >= 0 ? ou : 0);
        }
      }
    }, 240);
  });
  card.addEventListener('pointerleave', fermerBientot);
  card.addEventListener('pointerenter', () => clearTimeout(fermeture));
  card.addEventListener('focus', () => {
    buildDeck(card, film);
    card.classList.add('is-peeking');
    showSlide(card, film, 0);
  });
  card.addEventListener('blur', fermerBientot);
  card.addEventListener('keydown', event => {
    if (card.__deck && event.key === 'ArrowRight') { event.preventDefault(); showSlide(card, film, card.__deck.at + 1); }
    if (card.__deck && event.key === 'ArrowLeft') { event.preventDefault(); showSlide(card, film, card.__deck.at - 1); }
    if (event.key === 'Escape') fermer();
  });
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
      renderQueryChips();
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
  button.dataset.sticker = sticker.id;   // pour la mise à jour en place
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label',
    sticker.label + (on ? ', déjà dans la signature. Retirer.' : ', ajouter à la signature.'));
  button.append(emojiImg(sticker.emoji));
  button.addEventListener('click', event => {
    const own = signatureOf(film).slice();
    const at = own.indexOf(sticker.id);
    if (at >= 0) own.splice(at, 1);
    else own.push(sticker.id);
    state.reactions[keyOf(film)] = own;
    saveStore();
    if (at < 0) spark(event, sticker.emoji);
    announce(sticker.label + (at < 0 ? ' ajouté. ' : ' retiré. ') + 'Signature : ' +
      own.map(id => STICKER_BY_ID.get(id)?.label).filter(Boolean).join(', '));
    refresh(film);
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
      // On remplace la seule zone concernée : le moment ne repart pas de zéro.
      const host = cardEl_.querySelector('.react-host');
      if (host) host.replaceWith(buildReactHost(film, signature));
      else renderCardView(film);
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

async function openCard(film) {
  if (!film) return;
  current = film;
  state.paletteOpen = false;

  if (!film.__detail && state.live) {
    renderCardView(film);                       // premier rendu avec ce qu'on a
    await Promise.all([fetchDetail(film), fetchExtras(film)]);
    if (current === film) renderCardView(film);  // puis on complète
    return;
  }
  renderCardView(film);
}

/** Une case de la signature : nue, grande. Un nom, pas un bouton de recherche. */
function sigSlot(film, stickerId, index) {
  const sticker = STICKER_BY_ID.get(stickerId);
  if (!sticker) return null;
  const slot = document.createElement('button');
  slot.type = 'button';
  slot.className = 'sig__slot';
  slot.setAttribute('aria-label',
    sticker.label + (index === 0 ? ', impression principale' : '') + '. Retirer de la signature.');
  slot.append(emojiImg(sticker.emoji));
  slot.addEventListener('click', event => {
    state.reactions[keyOf(film)] = signatureOf(film).filter(x => x !== stickerId);
    saveStore();
    spark(event, sticker.emoji);
    announce(sticker.label + ' retiré de la signature.');
    refresh(film);
  });
  return slot;
}

function buildSigRow(film, signature) {
  const sig = document.createElement('div');
  sig.className = 'sig';
  signature.forEach((stickerId, index) => {
    const slot = sigSlot(film, stickerId, index);
    if (slot) sig.append(slot);
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
  return sig;
}

/**
 * La matière du film — ou la palette entière si on l'a ouverte.
 * La signature au-dessus est nue et grande : un nom. Ces tuiles-ci sont
 * encadrées : de la matière disponible. Le contenant les distingue.
 */
function buildReactHost(film, signature) {
  const host = document.createElement('div');
  host.className = 'react-host';

  if (state.paletteOpen) {
    host.append(buildCardPalette(film, signature));
    return host;
  }

  const palette = filmPalette(film).slice(0, CHOICES);
  if (palette.length) {
    const react = document.createElement('div');
    react.className = 'react';
    for (const sticker of palette) {
      react.append(reactionButton(film, sticker, signature, signature.includes(sticker.id)));
    }
    host.append(react);
  }
  return host;
}

/**
 * Le commentaire, monté comme un carton de bande-annonce.
 * C'est du texte d'auteur : un lecteur d'écran le lit tel quel, et le libellé
 * dit aussi par quoi il est signé.
 */
function quoteCard(film) {
  const comment = state.comments[keyOf(film)] || {};
  const preset = comment.preset || 'carton';
  const signature = signatureOf(film);

  const figure = document.createElement('figure');
  figure.className = 'quote quote--' + preset;
  figure.style.setProperty('--fit', String(fitFor(comment.text)));

  const text = document.createElement('p');
  text.className = 'quote__text';
  text.textContent = comment.text || '';
  figure.append(text);

  // Le carton à filets a besoin de son second trait, sous le texte.
  if (preset === 'filets') {
    const rule = document.createElement('span');
    rule.className = 'quote__rule';
    figure.append(rule);
  }

  if (signature.length) {
    const sig = document.createElement('div');
    sig.className = 'quote__sig';
    for (const id of signature) {
      const sticker = STICKER_BY_ID.get(id);
      if (sticker) sig.append(emojiImg(sticker.emoji));
    }
    figure.append(sig);
  }

  figure.setAttribute('aria-label',
    (comment.text || '') + ' — signé ' +
    signature.map(id => STICKER_BY_ID.get(id)?.label).filter(Boolean).join(', '));
  return figure;
}

/** Écrire : le champ EST l'aperçu du carton qu'on est en train de monter. */
function buildComposer(film) {
  const wrap = document.createElement('div');
  wrap.className = 'composer';

  // Les présets montrent le rendu au lieu de le nommer : on voit ce qu'on prend.
  const presets = document.createElement('div');
  presets.className = 'presets';
  for (const preset of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.setAttribute('aria-pressed', String(preset.id === state.preset));
    button.setAttribute('aria-label', preset.label);
    const aa = document.createElement('span');
    aa.className = 'preset__aa preset__aa--' + preset.id;
    aa.textContent = preset.aa;
    button.append(aa);
    button.addEventListener('click', () => {
      state.preset = preset.id;
      renderCardView(film);
      // Changer de preset change le rendu : on rend le curseur à l'écriture.
      const field = cardEl_.querySelector('.composer__input');
      if (field) {
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
      }
    });
    presets.append(button);
  }
  wrap.append(presets);

  const field = document.createElement('div');
  field.className = 'composer__field quote quote--' + state.preset;

  const input = document.createElement('textarea');
  input.className = 'composer__input';
  input.rows = 3;
  input.maxLength = COMMENT_MAX;
  input.value = state.comments[keyOf(film)]?.text || '';
  input.placeholder = '✍️';
  input.setAttribute('aria-label', 'Ton commentaire sur ' + film.title);
  field.append(input);

  // Le budget de signes, en forme : une barre qui se vide, jamais un chiffre.
  const budget = document.createElement('div');
  budget.className = 'composer__budget';
  const bar = document.createElement('i');
  budget.append(bar);
  field.append(budget);

  const scale = () => {
    const n = input.value.length;
    bar.style.transform = 'scaleX(' + Math.max(0, 1 - n / COMMENT_MAX) + ')';
    // La taille suit la longueur et le champ grandit : rien n'est jamais coupé.
    field.style.setProperty('--fit', String(fitFor(input.value)));
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  };
  scale();

  input.addEventListener('input', () => {
    scale();
    state.comments[keyOf(film)] = { text: input.value, preset: state.preset, at: Date.now() };
    saveStore();
  });

  wrap.append(field);

  const actions = document.createElement('div');
  actions.className = 'composer__actions';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'state';
  done.setAttribute('aria-label', 'Terminer');
  done.append(emojiImg('✅'));
  done.addEventListener('click', () => {
    const value = input.value.trim();
    if (value) state.comments[keyOf(film)] = { text: value, preset: state.preset, at: Date.now() };
    else delete state.comments[keyOf(film)];
    saveStore();
    state.composing = false;
    renderCardView(film);
    updateBackground(film);
    announce(value ? 'Commentaire enregistré.' : 'Commentaire effacé.');
  });
  actions.append(done);
  wrap.append(actions);

  return wrap;
}

/** Un montant lisible : les recettes de Spider-Man ne se lisent pas en chiffres bruts. */
function money(value) {
  if (!value) return '';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(value);
}

/** Les lignes de détail : le casting, la production, la note, les recettes, les
 *  plateformes. La fiche et le survol montrent exactement les mêmes. */
function detailRows(film) {
  const rows = [];
  if (film.director) rows.push([film.kind === 'tv' ? 'Création' : 'Réalisation', film.director]);
  if (film.cast?.length) rows.push(['Avec', film.cast.join(', ')]);
  if (film.companies?.length) rows.push(['Production', film.companies.slice(0, 2).join(', ')]);
  if (film.countries?.length) rows.push(['Pays', film.countries.join(', ')]);
  if (film.vote_count) {
    rows.push(['Note', film.vote_average.toFixed(1) + ' / 10 sur ' +
      new Intl.NumberFormat('fr-FR').format(film.vote_count) + ' votes']);
  }
  if (film.budget) rows.push(['Budget', money(film.budget)]);
  if (film.revenue) rows.push(['Recettes', money(film.revenue)]);

  // Une rubrique « où le voir » vide serait pire que pas de rubrique : on ne
  // l'affiche que quand il y a quelque chose à dire, et sinon on dit la sortie.
  if (film.providers?.length) rows.push(['Où le voir', film.providers.join(', ')]);
  else if (film.date && new Date(film.date) > new Date()) {
    rows.push(['Sortie', new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(film.date))]);
  }
  return rows;
}

/** La ligne technique : type, année, durée ou saisons, genres. La fiche et le
 *  survol doivent dire exactement la même chose, donc une seule source. */
function metaLine(film) {
  const meta = [film.kind === 'tv' ? 'Série' : 'Film'];
  if (film.date) meta.push(film.date.slice(0, 4));
  if (film.kind === 'tv') {
    if (film.seasons) meta.push(film.seasons + (film.seasons > 1 ? ' saisons' : ' saison'));
    if (film.episodes) meta.push(film.episodes + ' épisodes');
  } else if (film.runtime) {
    meta.push(film.runtime + ' min');
  }
  if (film.genres?.length) meta.push(film.genres.slice(0, 3).join(', '));
  return meta.join(' · ');
}

/**
 * Le texte : comprendre le film.
 *
 * C'est ici que le texte commande. Il répond à « qu'est-ce que c'est » —
 * ce que la signature emoji ne saura jamais dire. Elle reste au-dessus, comme
 * l'affiche : elle fait envie, elle ne renseigne pas.
 */
function buildTextBlock(film, { sansTitre = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'text';


  // Le titre d'abord : une fiche qui ne nomme pas ce qu'elle décrit est
  // inutilisable, même avec un beau résumé.
  if (!sansTitre) {
    const title = document.createElement('h2');
    title.className = 'text__title';
    title.textContent = film.title;
    wrap.append(title);
  }

  const head = document.createElement('p');
  head.className = 'text__meta';
  head.textContent = metaLine(film);
  wrap.append(head);

  if (film.overview) {
    const overview = document.createElement('p');
    overview.className = 'text__overview';
    overview.textContent = film.overview;
    wrap.append(overview);
  }

  for (const [label, value] of detailRows(film)) {
    const row = document.createElement('div');
    row.className = 'text__row';
    const name = document.createElement('span');
    name.className = 'text__label';
    name.textContent = label;
    const content = document.createElement('span');
    content.className = 'text__value';
    content.textContent = value;
    row.append(name, content);
    wrap.append(row);
  }

  return wrap;
}

/** Ce qui se montre à la place du commentaire : le carton, ou l'invitation. */
function buildCommentSlot(film) {
  const wrap = document.createElement('div');
  wrap.className = 'comment-slot';

  const comment = state.comments[keyOf(film)];
  if (comment && comment.text) wrap.append(quoteCard(film));

  const write = document.createElement('button');
  write.type = 'button';
  write.className = 'reel__write';
  write.setAttribute('aria-label',
    comment && comment.text ? 'Modifier ton commentaire' : 'Écrire un commentaire');
  write.append(emojiImg('✍️'));
  write.addEventListener('click', () => {
    state.composing = true;
    if (comment?.preset) state.preset = comment.preset;
    renderCardView(film);
  });
  wrap.append(write);
  return wrap;
}

/**
 * Une pastille d'état : l'emoji ET le mot. Depuis que le texte commande, on
 * n'a plus à deviner ce que fait un symbole.
 */
function markChip(film, option, on, compact) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = compact ? 'mark mark--sm' : 'mark';
  button.dataset.value = option.id;
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', option.label);
  button.append(emojiImg(option.emoji));
  const word = document.createElement('span');
  word.textContent = option.label;
  button.append(word);
  button.addEventListener('click', () => {
    const at = keyOf(film);
    if (state.marks[at] === option.id) delete state.marks[at];
    else state.marks[at] = option.id;
    saveStore();
    announce(option.label + (state.marks[at] === option.id ? ' activé.' : ' désactivé.'));
    // Un avis peut faire naître l'espace « Pour vous » : les filtres suivent.
    renderFilters();
    refresh(film);
  });
  return button;
}

/** L'état, hors du corps : toujours au même endroit, toujours sous le pouce. */
function buildFoot(film, mark) {
  const foot = document.createElement('div');
  foot.className = 'card-foot';
  for (const option of MARKS) {
    foot.append(markChip(film, option, mark === option.id, false));
  }
  return foot;
}

function renderCardView(film) {
  // Écrire prend tout l'écran : on monte un carton, on ne le fait pas en
  // passant. Le moment et les réactions reviennent ensuite.
  if (state.composing) return renderComposer(film);

  const signature = signatureOf(film);
  const mark = state.marks[keyOf(film)];
  const moment = momentOf(film);

  const frag = document.createDocumentFragment();

  /* Le moment, ou l'affiche. */
  const top = document.createElement('div');
  top.className = 'card-top';

  const stage = document.createElement('div');
  stage.className = 'card-stage';

  // L'affiche reste dessous : si le moment ne vient pas, il n'y a pas de trou.
  if (film.poster_path || moment) stage.append(stillEl(film, moment, 'card-stage__still'));

  if (moment) {
    const frame = document.createElement('iframe');
    frame.src = momentUrl(moment.key);
    frame.dataset.player = 'fiche';
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('aria-hidden', 'true');
    stage.append(frame);
    watchPlayer(frame);
    armPlayFallback(stage, moment.key);
  } else if (!film.poster_path) {
    stage.append(posterEl(film, ''));
  }
  top.append(stage);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back';
  back.setAttribute('aria-label', 'Retour');
  back.append(Object.assign(document.createElement('span'), { className: 'chev' }));
  back.addEventListener('click', closeCard);
  top.append(back);

  /* Où on en est dans la liste : sans cela, on est perdu au douzième film. */
  const liste = currentList();
  const rang = liste.findIndex(x => keyOf(x) === keyOf(film));
  if (liste.length > 1 && rang >= 0) {
    const position = document.createElement('span');
    position.className = 'card-pos';
    position.textContent = (rang + 1) + ' / ' + liste.length;
    top.append(position);
  }

  /* Passer au film suivant sans ressortir. Le geste a un signifiant visible :
     un glissement qu'on ne voit pas n'en est pas un. */
  const at = currentList().findIndex(x => keyOf(x) === keyOf(film));
  for (const [direction, suffix, label] of [[-1, 'prev', 'Film précédent'], [1, 'next', 'Film suivant']]) {
    if (!filmAt(at + direction)) continue;
    const nav = document.createElement('button');
    nav.type = 'button';
    nav.className = 'card-nav card-nav--' + suffix;
    nav.setAttribute('aria-label', label);
    nav.append(Object.assign(document.createElement('span'), { className: 'chev' }));
    nav.addEventListener('click', () => stepFilm(direction));
    top.append(nav);
  }

  // Et le glissement, pour le pouce : horizontal sur le moment seulement, pour
  // ne pas entrer en conflit avec le défilement vertical du corps.
  let fromX = 0;
  let fromY = 0;
  let tracking = false;
  stage.addEventListener('pointerdown', event => {
    tracking = true;
    fromX = event.clientX;
    fromY = event.clientY;
  });
  stage.addEventListener('pointerup', event => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - fromX;
    const dy = event.clientY - fromY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepFilm(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });

  frag.append(top);

  /* Le corps. */
  const body = document.createElement('div');
  body.className = 'card-body';
  body.append(buildSigRow(film, signature));
  body.append(buildTextBlock(film));

  const rule = document.createElement('div');
  rule.className = 'rule';
  body.append(rule, buildCommentSlot(film), buildReactHost(film, signature));

  const rule2 = document.createElement('div');
  rule2.className = 'rule';
  body.append(rule2);

  frag.append(body, buildFoot(film, mark));

  cardEl_.replaceChildren(frag);
  cardEl_.hidden = false;
  back.focus();
}

/**
 * Met à jour ce qui a changé, et rien d'autre.
 *
 * Redessiner la fiche relancerait le moment depuis le début à chaque emoji
 * touché ; redessiner le fil rechargerait toutes ses vidéos. On remplace donc
 * les morceaux concernés, sur place.
 */
function updateBackground(film) {
  if (state.mode === 'film') refreshWallCard(film);
  else refreshReels(film);
}

function refresh(film) {
  updateBackground(film);

  // Pendant l'écriture, il n'y a ni signature ni réactions à l'écran.
  if (cardEl_.hidden || current !== film || state.composing) return;
  const signature = signatureOf(film);
  const mark = state.marks[keyOf(film)];

  const sig = cardEl_.querySelector('.sig');
  if (sig) sig.replaceWith(buildSigRow(film, signature));

  const host = cardEl_.querySelector('.react-host');
  if (host) host.replaceWith(buildReactHost(film, signature));

  const slot = cardEl_.querySelector('.comment-slot');
  if (slot) slot.replaceWith(buildCommentSlot(film));

  const foot = cardEl_.querySelector('.card-foot');
  if (foot) foot.replaceWith(buildFoot(film, mark));
}

/** Dans le fil, on ne recharge pas les vidéos : on corrige les cartes visées. */
function refreshReels(film) {
  const signature = signatureOf(film);
  const mark = state.marks[keyOf(film)];

  for (const card of wallEl.querySelectorAll('.reel[data-id="' + keyOf(film) + '"]')) {
    const sig = card.querySelector('.reel__sig');
    if (sig) {
      sig.replaceChildren(...signature
        .map(id => STICKER_BY_ID.get(id))
        .filter(Boolean)
        .map(sticker => emojiImg(sticker.emoji)));
    }

    for (const pick of card.querySelectorAll('.reel__react .pick')) {
      const on = signature.includes(pick.dataset.sticker);
      pick.setAttribute('aria-pressed', String(on));
      const sticker = STICKER_BY_ID.get(pick.dataset.sticker);
      if (sticker) {
        pick.setAttribute('aria-label',
          sticker.label + (on ? ', déjà dans la signature. Retirer.' : ', ajouter à la signature.'));
      }
    }

    const badge = card.querySelector('.reel__state');
    if (mark && badge) badge.replaceChildren(emojiImg(markById(mark)?.emoji || '👁️'));
    else if (mark) {
      const fresh = document.createElement('span');
      fresh.className = 'reel__state';
      fresh.append(emojiImg(markById(mark)?.emoji || '👁️'));
      card.querySelector('.reel__stage')?.append(fresh);
    } else if (badge) {
      badge.remove();
    }

    for (const button of card.querySelectorAll('.reel__marks .state')) {
      button.setAttribute('aria-pressed', String(mark === button.dataset.value));
    }
  }
}

/** L'écran d'écriture : le carton au centre, rien autour. */
function renderComposer(film) {
  const frag = document.createDocumentFragment();

  const top = document.createElement('div');
  top.className = 'card-top card-top--thin';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back';
  back.setAttribute('aria-label', 'Laisser tomber');
  back.append(Object.assign(document.createElement('span'), { className: 'chev' }));
  back.addEventListener('click', () => {
    state.composing = false;
    renderCardView(film);
  });
  top.append(back);
  frag.append(top);

  const body = document.createElement('div');
  body.className = 'card-body card-body--compose';
  body.append(buildComposer(film));
  frag.append(body);

  cardEl_.replaceChildren(frag);
  cardEl_.hidden = false;

  const field = cardEl_.querySelector('.composer__input');
  if (field) {
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }
}

/** Une couche plein écran doit garder le clavier : sinon on tabule derrière
 *  elle, dans des éléments qu'on ne voit pas. */
function trapFiche(event) {
  if (cardEl_.hidden || event.key !== 'Tab') return;
  const items = [...cardEl_.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(node => node.offsetParent !== null);
  if (!items.length) return;
  const premier = items[0];
  const dernier = items[items.length - 1];
  const actif = document.activeElement;
  const dehors = !cardEl_.contains(actif);
  if (event.shiftKey && (actif === premier || dehors)) {
    event.preventDefault();
    dernier.focus();
  } else if (!event.shiftKey && (actif === dernier || dehors)) {
    event.preventDefault();
    premier.focus();
  }
}

function closeCard() {
  const film = current;
  cardEl_.hidden = true;
  cardEl_.replaceChildren();
  current = null;
  // L'état a pu changer dans la fiche : on remet la présentation à jour.
  if (film) refresh(film);
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
    const film = state.films.get(id);
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
  wallEl.addEventListener('scroll', () => {
    updateProgress();
    // À 900 px du bas, on prépare la suite avant qu'on l'atteigne.
    // Le seuil vaut pour les deux : le mur descend, le fil vertical aussi.
    if (wallEl.scrollHeight - wallEl.scrollTop - wallEl.clientHeight < 900) {
      loadMore();
    }
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!mirrorEl.hidden) { closeMirror(); return; }
      if (!cardEl_.hidden) { closeCard(); return; }
      if (state.query) {
        state.query = '';
        el('search').value = '';
        el('search-clear').hidden = true;
        show();
      }
      return;
    }
    // Les flèches passent d'un film à l'autre — la télécommande viendra par là.
    if (cardEl_.hidden) return;
    trapFiche(event);
    if (state.composing) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); stepFilm(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); stepFilm(-1); }
  });

  // Le mode peut venir de l'URL : un lien partage aussi une présentation.
  const voulu = new URLSearchParams(location.search).get('mode');
  state.mode = MODES.some(m => m.id === voulu) ? voulu : 'film';
  appEl.className = 'mode-' + state.mode;

  renderModes();
  renderFilters();
  renderSousFiltres();
  renderTris();
  renderDrawers();
  renderPalette();
  renderQueryChips();

  /* La recherche : une frappe, puis on cherche une fois. */
  const searchInput = el('search');
  const clearButton = el('search-clear');
  const cross = document.createElement('span');
  cross.className = 'cross';
  clearButton.append(cross);

  /* Le moteur par emoji et le moteur texte sont le même : les emoji choisis
     s'affichent dans la barre, à côté du texte. */
  const emojiButton = el('btn-emoji');
  const emojiIcon = emojiImg('😀');
  emojiButton.append(emojiIcon);

  emojiButton.addEventListener('click', () => {
    const ouvert = appEl.classList.toggle('has-picker');
    emojiButton.setAttribute('aria-expanded', String(ouvert));
    if (ouvert) el('drawers').scrollIntoView({ block: 'nearest' });
  });

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    state.dejaVu = new Set();
    clearButton.hidden = !state.query;
    scheduleFilter();
  });
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    state.query = '';
    clearButton.hidden = true;
    show();
    searchInput.focus();
  });
  show();
}

start();
