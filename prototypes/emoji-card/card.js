import { createDiscoverySession, resolveTopicIds, parseDiscoveryQuery, fold } from './discovery.js';
import { COLLECTIONS } from './collections.js';
import { SOUS_GENRES } from './topics.js';
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
import { initRoom, ouvrirRoom, fermerRoom } from './soiree.js';
import { initProfil, ouvrirProfil, fermerProfil } from './profil.js';

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

/* Les langues de vidéo qu'on accepte. `null` = les vidéos sans langue déclarée,
   que TMDB ne renvoie pas autrement. L'ordre est une préférence, pas un filtre :
   voir `bestVideo`. */
const LANGUES_VIDEO = 'fr,en,null';

/* Combien de films du mur on va nommer d'un coup. Les mots-clés coûtent une
   requête par film : on couvre les premiers écrans, l'approche du bas de page
   déclenche la suite (`loadMore`), et un survol fait le reste. */
const SIGNATURE_BATCH = 30;

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
const soireeEl = el('soiree');
const profilEl = el('profil');
const mirrorEl = el('mirror');
const statusEl = el('status');
const progressEl = el('progress');
const progressBar = progressEl.firstElementChild;

const state = {
  credential: '',
  client: null,
  live: false,
  /* Un relais serveur garde la clé TMDB hors du navigateur. */
  relais: false,
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
  /* `null` = on n'est pas dans sa liste. `'tout'` = toute la liste.
     Un état de MARKS = seulement ceux-là. */
  liste: null,
  sousGenre: null,
  collection: null,
  saga: null,
  decade: '', runtimeMax: '', language: '', minimumVotes: '0',
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
  comments: {},
  /* Ce qu'on garde des films marqués, pour pouvoir les remontrer sans réseau.
     Une marque sans le film derrière n'est qu'un identifiant : « Ma liste »
     aurait alors eu besoin d'une requête par film. */
  mesFilms: {},
  /* Quand chaque chose a été modifiée, film par film et nature par nature.
     C'est ce qui permet de FUSIONNER deux appareils sans rien perdre : sans
     horodatage, relier un téléphone et un ordinateur voudrait dire « l'un
     écrase l'autre », et le travail de la soirée disparaîtrait. */
  horodatages: {}
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
    state.mesFilms = parsed.films && typeof parsed.films === 'object' ? parsed.films : {};
    state.horodatages = parsed.horodatages && typeof parsed.horodatages === 'object' ? parsed.horodatages : {};
  } catch { /* sans localStorage, on perd seulement la persistance */ }
}

/**
 * Noter qu'on vient de toucher à quelque chose.
 *
 * La clé mêle la nature et le film — « marque:movie:1 », « avis:tv:42 » — pour
 * que la fusion compare ce qui est comparable. Une marque et une signature sur
 * le même film sont deux choses indépendantes : poser l'une ne doit pas faire
 * disparaître l'autre.
 */
function noter(nature, film) {
  state.horodatages[nature + ':' + keyOf(film)] = Date.now();
}

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      reactions: state.reactions,
      marks: state.marks,
      comments: state.comments,
      films: state.mesFilms,
      horodatages: state.horodatages
    }));
  } catch { /* idem */ }
}

/**
 * Ce qu'on garde d'un film qu'on marque.
 *
 * Assez pour redessiner sa carte SANS réseau : c'est ce qui rend « Ma liste »
 * consultable tout de suite, et lisible même hors ligne — c'est un outil
 * personnel, pas un service. Les mots-clés partent avec, sinon le film
 * perdrait son nom en chemin.
 */
function rememberFilm(film) {
  const k = keyOf(film);
  const ancien = state.mesFilms[k];
  state.mesFilms[k] = {
    id: film.id,
    kind: film.kind || 'movie',
    title: film.title || '',
    date: film.date || '',
    poster_path: film.poster_path || null,
    genre_ids: film.genre_ids || [],
    vote_average: film.vote_average || 0,
    vote_count: film.vote_count || 0,
    popularity: film.popularity || 0,
    overview: film.overview || '',
    keywords: Array.isArray(film.keywords) && film.keywords.length ? film.keywords : ancien?.keywords,
    // Quand il est entré dans la liste : c'est l'ordre naturel d'une liste.
    at: ancien?.at || Date.now()
  };
  state.horodatages['film:' + k] = state.mesFilms[k].at;
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

/* Le relais de production.
 *
 * Sur Netlify, la clé TMDB vit dans les variables d'environnement, et cette
 * fonction serveur relaie les requêtes : le navigateur ne la télécharge jamais.
 * En local, `config.local.js` fournit la clé et on parle à TMDB en direct.
 * Le chemin est celui que Netlify réserve aux fonctions. */
const RELAIS = '/.netlify/functions/tmdb';

/** La clé est-elle utilisable telle quelle ? */
const authDirecte = () => detectAuth(state.credential);

async function api(path, params, { signal } = {}) {
  const auth = authDirecte();
  /* Sans clé locale, on passe par le relais — mais seulement s'il existe : la
     même page doit marcher en local, sur Netlify, et en démonstration. */
  if (!auth && !state.relais) throw new Error('sans-clé');
  const url = auth ? new URL(API_BASE + path) : new URL(RELAIS, location.origin);
  if (!auth) url.searchParams.set('path', path);
  url.searchParams.set('language', 'fr-FR');
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const options = { headers: { accept: 'application/json' }, signal };
  if (auth === 'bearer') options.headers.Authorization = 'Bearer ' + state.credential;
  else if (auth === 'apikey') url.searchParams.set('api_key', state.credential);
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('TMDB ' + response.status);
  return response.json();
}

/**
 * Y a-t-il un relais en face ?
 *
 * On le DEMANDE plutôt que de le supposer : un drapeau inscrit dans le code
 * finirait par mentir dans l'un des trois cas — local, publié, démonstration.
 */
async function relaisDisponible() {
  if (location.protocol === 'file:') return false;
  try {
    const r = await fetch(RELAIS + '?path=/configuration', { headers: { accept: 'application/json' } });
    return r.ok;
  } catch { return false; }
}

/* ── Films et séries : une seule matière ──────────────────────────────────── */
/* ── Les deux vocabulaires de genres ─────────────────────────────────────── *
   TMDB tient DEUX listes de genres. « Action » vaut 28 pour un film et 10759
   pour une série ; « Horreur », « Musique », « Histoire », « Romance » et
   « Thriller » n'ont aucun équivalent en série ; « Kids », « Reality » ou
   « Talk » n'en ont aucun en film.

   Envoyer un identifiant de film à `/discover/tv` ne lève pas d'erreur : ça
   renvoie zéro résultat, en silence. Et comparer les genres d'une série à une
   table écrite en identifiants de film ne correspond jamais. Douze genres sur
   vingt-deux étaient donc vides d'un côté, et la dérivation du nom ne marchait
   pas pour les séries.

   On tient donc UNE table, et on traduit aux deux bords : à la requête (chaque
   type reçoit son identifiant) et à l'entrée (chaque titre est ramené au
   vocabulaire des films). Le reste de l'application n'a plus qu'une langue. */
const GENRES_TMDB = {
  28: { film: 28, serie: 10759 },      // Action
  12: { film: 12, serie: 10759 },      // Aventure
  16: { film: 16, serie: 16 },         // Animation
  35: { film: 35, serie: 35 },         // Comédie
  80: { film: 80, serie: 80 },         // Crime
  99: { film: 99, serie: 99 },         // Documentaire
  18: { film: 18, serie: 18 },         // Drame
  10751: { film: 10751, serie: 10751 },// Familial
  14: { film: 14, serie: 10765 },      // Fantastique
  36: { film: 36, serie: null },       // Histoire — rien côté série
  27: { film: 27, serie: null },       // Horreur — rien côté série
  10402: { film: 10402, serie: null }, // Musique — rien côté série
  9648: { film: 9648, serie: 9648 },   // Mystère
  10749: { film: 10749, serie: null }, // Romance — rien côté série
  878: { film: 878, serie: 10765 },    // Science-Fiction
  53: { film: 53, serie: null },       // Thriller — rien côté série
  10752: { film: 10752, serie: 10768 },// Guerre
  37: { film: 37, serie: 37 }          // Western
};

/** L'inverse : ce qu'une série renvoie, ramené au vocabulaire des films. */
const GENRES_SERIE_VERS_FILM = {};
for (const [film, paire] of Object.entries(GENRES_TMDB)) {
  if (!paire.serie) continue;
  const cle = String(paire.serie);
  (GENRES_SERIE_VERS_FILM[cle] = GENRES_SERIE_VERS_FILM[cle] || []).push(Number(film));
}
/* Les genres de série qui n'ont pas de case en face. Sans cela ils
   disparaîtraient purement et simplement du vocabulaire commun. */
Object.assign(GENRES_SERIE_VERS_FILM, {
  10763: [99],        // Actualités → Documentaire
  10764: [99],        // Téléréalité → Documentaire
  10766: [18],        // Feuilleton → Drame
  10767: [99]         // Talk-show → Documentaire
});

/** Un genre de série s'écrit parfois en deux genres de film (10759 = 28 + 12). */
const genresFilms = ids => [...new Set((ids || []).flatMap(id => GENRES_SERIE_VERS_FILM[id] || [id]))];



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
    // Traduits une fois ici : partout ailleurs, films et séries parlent la
    // même langue de genres.
    genre_ids: genresFilms(raw.genre_ids || (raw.genres || []).map(g => g.id))
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
    film.collection = detail.belongs_to_collection || null;
    film.original_title = detail.original_title || detail.original_name || film.title;
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
  film.providerRegions = providers?.results || {};
  film.availability = fr || null;
  film.providerError = !providers;
  film.providers = fr
    ? plateformesDe([...(fr.flatrate || []), ...(fr.rent || []), ...(fr.buy || [])])
    : [];

  return film;
}

/**
 * Le nom d'une plateforme, débarrassé de sa variante.
 *
 * TMDB liste « Netflix », « Netflix Standard with Ads », « Crunchyroll » et
 * « Crunchyroll Amazon Channel » comme quatre fournisseurs distincts : sans
 * nettoyage, la ligne « Où le voir » annonçait deux fois la même plateforme.
 */
const plateforme = nom => String(nom)
  .replace(/\s+(Standard|Basic|Premium)?\s*with Ads$/i, '')
  .replace(/\s+(Amazon|Apple TV) Channel$/i, '')
  .trim();

/** Les plateformes, sans doublon, dans l'ordre où on les a reçues. */
const plateformesDe = liste => [...new Set((liste || []).map(p => plateforme(p.provider_name)))].filter(Boolean);

/**
 * Les mots-clés d'une réponse TMDB.
 *
 * Un FILM répond `{ keywords: [...] }`, une SÉRIE répond `{ results: [...] }`.
 * Le code ne lisait que `keywords` : toutes les séries recevaient donc une liste
 * vide, l'étage 2 de la dérivation ne servait à rien pour elles, et elles
 * retombaient sur leurs genres — d'où sept séries différentes nommées « Tokyo ».
 */
const motsClesDe = réponse => (réponse?.keywords || réponse?.results || []).map(k => k.name);

/** Mots-clés et vidéos : une seule fois par film, puis gardés en mémoire. */
async function fetchExtras(film) {
  if (film.__extra || !state.live) return;
  film.__extra = true;
  const base = '/' + (film.kind || 'movie') + '/' + film.id;
  try {
    const [kw, vids] = await Promise.all([
      api(base + '/keywords'),
      /* `language` filtre AUSSI les vidéos : demander fr-FR seul renvoie une
         liste VIDE pour un film dont les bandes-annonces sont anglais seulement
         (Coyote vs. Acme : 0 alors qu'il en a 23). On demande donc les langues
         utiles, et on choisit après. */
      api(base + '/videos', { include_video_language: LANGUES_VIDEO })
    ]);
    film.keywords = motsClesDe(kw);
    film.videos = (vids.results || []).filter(v => v.site === 'YouTube');
  } catch {
    film.__extra = false;   // une panne passagère ne condamne pas le film
    film.keywords = film.keywords || [];
    film.videos = film.videos || [];
  }
}

/** Les mots-clés seuls : une requête, la plus légère qui donne son nom à un film. */
async function fetchKeywords(film) {
  if (film.__motsCles || !state.live) return film.keywords;
  film.__motsCles = true;
  try {
    film.keywords = motsClesDe(await api('/' + (film.kind || 'movie') + '/' + film.id + '/keywords'));
  } catch {
    film.__motsCles = false;   // on pourra réessayer
  }
  return film.keywords;
}

/** Le moment : une bande-annonce d'abord, sinon un teaser, sinon un extrait.
 *
 *  On préfère le français quand il existe, mais on ne l'exige pas : beaucoup de
 *  films n'ont AUCUNE vidéo française, et une bande-annonce anglaise vaut mieux
 *  que pas de bande-annonce du tout. */
function bestVideo(list) {
  const videos = list || [];
  const pick = type => {
    const du = videos.filter(v => v.type === type);
    if (!du.length) return null;
    return du.find(v => v.iso_639_1 === 'fr' && v.official)
        || du.find(v => v.iso_639_1 === 'fr')
        || du.find(v => v.official)
        || du[0];
  };
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
    const data = await api('/' + (film.kind || 'movie') + '/' + film.id + '/videos',
      { include_video_language: LANGUES_VIDEO });
    film.videos = (data.results || []).filter(v => v.site === 'YouTube');
  } catch {
    film.__videos = false;   // on pourra réessayer
    film.videos = film.videos || [];
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
function playerCommand(frame, func, args = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
}
function watchPlayer(frame) {
  if (frame.dataset.watched) return;
  frame.dataset.watched = 'true';
  frame.addEventListener('load', () => {
    if (!frame.getAttribute('src')) return;
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: frame.dataset.key || 'frame', channel: 'widget' }), 'https://www.youtube.com');
  });
}
window.addEventListener('message', event => {
  if (event.origin !== 'https://www.youtube.com' || typeof event.data !== 'string') return;
  const frame = [...document.querySelectorAll('iframe[data-watched]')].find(f => f.contentWindow === event.source);
  if (!frame) return;
  let data;
  try { data = JSON.parse(event.data); } catch { return; }
  if (data.event === 'infoDelivery' && data.info) {
    frame.__playback = { ...frame.__playback, ...data.info };
    updatePlaybackControls(frame);
  }
  if (data.event === 'onError') {
    const status = frame.closest('.reel__stage, .card-stage')?.querySelector('.playback-status');
    if (status) status.textContent = 'Vidéo indisponible ici. Ouvre-la sur YouTube.';
  }
  if (data.event === 'onReady') {
    playerCommand(frame, frame.closest('.reel')?.dataset.sound === 'on' ? 'unMute' : 'mute');
  }
  if (data.event === 'infoDelivery' && data.info?.playerState === YOUTUBE_PLAYING) {
    frame.classList.add('is-live');
    frame.closest('.reel__stage, .card-stage')?.querySelector('.reel__play')?.remove();
  }
});

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

const ICON_PATHS = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  play: 'M8 4l12 8-12 8z',
  seen: 'M4 12l5 5L20 6',
  want: 'M6 3h12v18l-6-4-6 4z',
  love: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  similar: 'M4 4h12v12H4z M9 20h11V9',
  smile: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M8 9h.01 M16 9h.01 M8 14q4 5 8 0',
  nope: 'M6 6l12 12 M18 6L6 18'
};
function uiIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ui-icon');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', ICON_PATHS[name] || ICON_PATHS.smile);
  svg.append(path);
  return svg;
}

function emojiImg(emoji, className = '') {
  const img = document.createElement('img');
  img.src = twemojiUrl(emoji);
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  if (className) img.className = className;
  return img;
}

/** Une image qui n'apparaît qu'une fois prête : sinon elle saute dans la page.
 *
 *  On RETIRE `is-loading` au lieu d'ajouter un `is-loaded` : l'opacité retombe
 *  sur celle de la classe de base, donc un film vu garde son affiche assombrie
 *  (`.card[data-mark="seen"] .card__img`) sans qu'une seconde règle ne se
 *  bataille avec la première. */
function fondu(img) {
  img.classList.add('is-loading');
  const montre = () => img.classList.remove('is-loading');
  if (img.complete && img.naturalWidth) montre();
  else img.addEventListener('load', montre, { once: true });
  img.addEventListener('error', montre, { once: true });
  return img;
}

function posterEl(film, className) {
  if (film.poster_path) {
    const img = document.createElement('img');
    img.className = className;
    img.src = state.client.posterUrl(film.poster_path, 'w342');
    img.alt = '';
    img.loading = 'lazy';
    return fondu(img);
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
  return fondu(img);
}

/* ── Le mur ───────────────────────────────────────────────────────────────── */

function renderSkeletons(count = 8) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'card card--skeleton';
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
  const hero = false; // Le catalogue garde un rythme régulier, quelle que soit la recherche.

  const card = document.createElement('article');
  card.className = 'card' + (hero ? ' card--hero' : '');
  card.dataset.id = keyOf(film);
  if (mark) card.dataset.mark = mark;
  card.style.setProperty('--delay', Math.min(index, 6) * 25 + 'ms');

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
  const artwork = posterEl(film, 'card__img');
  if (hero && film.backdrop_path) {
    artwork.src = state.client.posterUrl(film.backdrop_path, 'w1280');
    card.classList.add('card--backdrop');
  }
  if (index < 6 && artwork.tagName === 'IMG') artwork.loading = 'eager';
  if (hero) artwork.setAttribute('fetchpriority', 'high');
  card.append(artwork);

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
  if (hero) {
    const kicker = document.createElement('span');
    kicker.className = 'card__kicker';
    kicker.textContent = state.forYou ? 'POUR TOI' : 'EN LUMIÈRE';
    caption.append(kicker);
  }
  caption.append(name, sub);
  if (hero) {
    const overview = document.createElement('span');
    overview.className = 'card__overview';
    overview.textContent = film.overview || 'Une nouvelle histoire à découvrir.';
    const cta = document.createElement('span');
    cta.className = 'card__cta';
    cta.textContent = 'Découvrir le film';
    if (film.kind === 'tv') cta.textContent = 'Découvrir la série';
    caption.append(overview, cta);
  }
  foot.append(caption);
  card.append(foot);

  if (mark) {
    const badge = document.createElement('span');
    badge.className = 'card__state';
    badge.append(uiIcon(mark));
    badge.title = markById(mark)?.label || '';
    card.append(badge);
  }

  // La couche de survol, posée sur l'affiche.
  const layer = document.createElement('div');
  layer.className = 'card__peek';
  card.append(layer);

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'card__open';
  open.setAttribute('aria-label', 'Ouvrir ' + film.title);
  open.addEventListener('click', () => { closeCataloguePreview(); openCard(film); });
  card.append(open);
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
    if (mark && badge) badge.replaceChildren(uiIcon(mark));
    else if (mark) {
      const fresh = document.createElement('span');
      fresh.className = 'card__state';
      fresh.append(uiIcon(mark));
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
  if (discovery) { if (!discoveryBusy && discovery.hasMore) await runSearch(0, { append: true }); return; }
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
  signerLeMur();
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
  doux(wallEl);
  restoreScroll('film');
  signerLeMur();
}

/**
 * Le nom d'un film se mérite — il vient de ses mots-clés TMDB.
 *
 * Ces mots-clés n'arrivent qu'à la demande. Sans eux, `proposed()` retombe sur
 * les genres, et **tous les films d'un même genre portaient alors le même nom** :
 * « Années 1980, École, Soleil » nommait sept séries différentes. Un langage qui
 * ne distingue pas n'est pas un langage.
 *
 * On va donc les chercher pour ce qui est à l'écran, par petits paquets. Chaque
 * carte prend son vrai nom dès qu'il arrive : le mur ne saute pas, il se précise.
 */
let signatureEnCours = false;
async function signerLeMur() {
  if (signatureEnCours || !state.live || state.mode !== 'film') return;
  const àSigner = state.wall
    .filter(f => !f.__motsCles && !(Array.isArray(f.keywords) && f.keywords.length))
    .slice(0, SIGNATURE_BATCH);
  if (!àSigner.length) return;
  signatureEnCours = true;
  try {
    await mapLimit(àSigner, 4, async film => {
      await fetchKeywords(film);
      if (state.mode === 'film') refreshWallCard(film);
    });
  } finally {
    signatureEnCours = false;
  }
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
/** Un fondu court sur un conteneur qu'on vient de remplir : ça évite le claquement. */
function doux(el) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof el.animate !== 'function') return;
  el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 240, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
}

/** La colonne de la fiche s'éteint en bas tant qu'il reste quelque chose à
 *  voir. Sans cela, une barre de défilement invisible laissait la moitié des
 *  commandes hors de l'écran sans le moindre signe. */
function majFicheDefile() {
  const corps = cardEl_.querySelector('.card-body');
  if (!corps) return;
  const reste = corps.scrollHeight - corps.clientHeight - corps.scrollTop;
  corps.style.setProperty('--bas', reste > 12 ? '1' : '0');
}

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

/**
 * Ce qui reste à voir de chaque côté d'une rangée de pastilles.
 *
 * Une pastille coupée net se lisait comme un défaut de mise en page. On éteint
 * donc le bord qui continue et on rallume celui qui est fini : le dégradé suit
 * le doigt au lieu de mentir. `--l` et `--r` valent 0 ou 1, le CSS fait le
 * reste.
 */
function majDebordement() {
  for (const id of ['liste', 'filters', 'tris', 'sous-filtres']) {
    const rangée = el(id);
    if (!rangée || rangée.hidden) continue;
    const reste = rangée.scrollWidth - rangée.clientWidth;
    const déborde = reste > 2;
    const àGauche = rangée.scrollLeft > 2;
    const àDroite = rangée.scrollLeft < reste - 2;
    rangée.style.setProperty('--l', déborde && àGauche ? '1' : '0');
    rangée.style.setProperty('--r', déborde && àDroite ? '1' : '0');
  }
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
    button.append(uiIcon(mode.id === 'film' ? 'grid' : 'play'), document.createTextNode(mode.id === 'film' ? 'Explorer' : 'Moments'));
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
function updateCollectionHeading() {
  const title = state.liste ? 'Ma collection' : state.forYou ? 'Pour toi' : state.query ? 'Recherche'
    : state.saga ? 'La saga' : state.mode === 'reel' ? 'En mouvement' : 'Le catalogue';
  el('collection-title').textContent = title;
  el('collection-note').textContent = state.query ? '« ' + state.query + ' »' : state.liste ? (markById(state.liste)?.label || 'Tous tes titres') : '';
  const count = state.genres.length + state.tris.length + (state.type !== 'all' ? 1 : 0) + (state.sousGenre ? 1 : 0) + [state.decade, state.runtimeMax, state.language].filter(Boolean).length + (state.minimumVotes !== '0' ? 1 : 0);
  el('filter-count').textContent = count ? String(count) : '';
  const active = el('active-filters');
  const tags = [];
  const tag = (label, remove) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label + ' ×';
    button.setAttribute('aria-label', 'Retirer le filtre ' + label);
    button.addEventListener('click', () => {
      remove(); state.dejaVu = new Set(); renderFilters(); renderSousFiltres(); renderTris(); renderQueryChips(); renderPalette(); show();
    });
    tags.push(button);
  };
  if (state.type !== 'all') tag(state.type === 'tv' ? 'Séries' : 'Films', () => { state.type = 'all'; });
  for (const id of state.genres) tag(GENRE_PAR_ID.get(id)?.label || id, () => { state.genres = state.genres.filter(x => x !== id); state.sousGenre = null; });
  if (state.sousGenre) tag(topicLabel(state.sousGenre), () => { state.sousGenre = null; });
  for (const id of state.tris) tag(triParId(id)?.nom || id, () => { state.tris = state.tris.filter(x => x !== id); });
  for (const id of state.picked) tag(STICKER_BY_ID.get(id)?.label || id, () => { state.picked = state.picked.filter(x => x !== id); });
  if (state.decade) tag('Années ' + state.decade, () => { state.decade = ''; el('filter-decade').value = ''; });
  if (state.runtimeMax) tag('Moins de ' + state.runtimeMax + ' min', () => { state.runtimeMax = ''; el('filter-runtime').value = ''; });
  if (state.language) tag(el('filter-language').selectedOptions[0].textContent, () => { state.language = ''; el('filter-language').value = ''; });
  if (state.minimumVotes !== '0') tag(state.minimumVotes + ' votes minimum', () => { state.minimumVotes = '0'; el('filter-votes').value = '0'; });
  if (state.saga) tag(state.saga.name, () => { state.saga = null; });
  active.replaceChildren(...tags);
  active.hidden = !tags.length;
}

function setRefinements(open) {
  closeCataloguePreview();
  el('refinements').hidden = !open;
  el('btn-refine').setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('filters-open', open);
  const mobile = matchMedia('(max-width: 760px)').matches;
  el('filter-backdrop').hidden = !open || !mobile;
  if (mobile) {
    for (const id of ['bar', 'wall', 'active-filters']) el(id).inert = open;
    el('refinements').setAttribute('role', 'dialog');
    el('refinements').setAttribute('aria-modal', String(open));
  }
  if (open) el('close-refine').focus();
  else el('btn-refine').focus();
  majDebordement();
}

function initCatalogueLayout() {
  el('bar').insertBefore(el('tools'), el('btn-mirror'));
  el('collection-filters').append(el('row-liste'));
  appEl.append(el('filter-backdrop'), el('refinements'));
  const dock = el('dock');
  el('refinements').insertBefore(dock, el('refinements').querySelector('.refinements-foot'));
  el('btn-emoji').hidden = true; el('dock').hidden = true;
  const emojiToggle = el('btn-emoji');
  emojiToggle.addEventListener('click', () => { if (el('refinements').hidden) setRefinements(true); });
  initDiscoveryControls();
  el('close-refine').addEventListener('click', () => setRefinements(false));
  el('apply-filters').addEventListener('click', () => setRefinements(false));
  el('filter-backdrop').addEventListener('click', () => setRefinements(false));
  el('reset-filters').addEventListener('click', () => {
    state.collection = null; state.saga = null; state.decade = ''; state.runtimeMax = ''; state.language = ''; state.minimumVotes = '0'; syncDiscoveryControls();
    state.type = 'all'; state.genres = []; state.sousGenre = null; state.tris = []; state.picked = []; state.liste = null; state.forYou = false; state.dejaVu = new Set();
    renderFilters(); renderSousFiltres(); renderTris(); renderListe(); renderPalette(); renderQueryChips(); show();
  });
  el('catalogue-density').addEventListener('change', event => { appEl.dataset.density = event.target.value; closeCataloguePreview(); });
  const immersive = el('btn-immersive');
  immersive.addEventListener('click', () => {
    const on = document.body.classList.toggle('catalogue-immersive');
    immersive.setAttribute('aria-pressed', String(on));
    immersive.textContent = on ? 'Réduire' : 'Agrandir';
    closeCataloguePreview();
  });
  el('btn-fullscreen').hidden = !document.fullscreenEnabled;
  el('btn-fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { announce('Le plein écran n’est pas disponible dans ce navigateur.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    el('btn-fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Quitter le plein écran' : 'Activer le plein écran');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !el('refinements').hidden) { event.preventDefault(); event.stopImmediatePropagation(); setRefinements(false); }
    else if (event.key === 'Escape' && document.body.classList.contains('catalogue-immersive') && cardEl_.hidden && mirrorEl.hidden) { event.stopImmediatePropagation(); immersive.click(); }
    if (event.key === 'Tab' && !el('refinements').hidden && matchMedia('(max-width:760px)').matches) {
      const items = [...el('refinements').querySelectorAll('button, select, input')].filter(x => x.offsetParent !== null);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  addEventListener('resize', () => {
    const mobile = matchMedia('(max-width:760px)').matches;
    const open = !el('refinements').hidden;
    el('filter-backdrop').hidden = !mobile || !open;
    for (const id of ['bar', 'wall', 'active-filters']) el(id).inert = mobile && open;
    el('refinements').setAttribute('role', mobile ? 'dialog' : 'complementary');
    el('refinements').setAttribute('aria-modal', String(mobile && open));
  });
}

/**
 * Une collection EST un jeu de critères — ni plus, ni moins.
 *
 * Tant que les critères sont les siens, elle est active ; dès qu'on en touche
 * un, ce n'est plus elle. Le nettoyage du drapeau était recopié dans quatre
 * gestionnaires sur sept : les tris, le type et les genres l'oubliaient, et le
 * nom restait affiché au-dessus de résultats qui n'étaient plus les siens.
 *
 * On ne range donc plus un drapeau qu'il faut penser à effacer : on VÉRIFIE.
 * N'importe quel chemin qui change un critère — pastille, curseur, croix d'une
 * étiquette — se corrige tout seul au prochain rendu.
 */
function collectionEncoreValide() {
  if (!state.collection) return false;
  const c = COLLECTIONS.find(x => x.id === state.collection);
  if (!c) return false;
  const memesGenres = [...state.genres].sort((a, b) => a - b).join(',') === [...c.genres].sort((a, b) => a - b).join(',');
  return memesGenres
    && (state.sousGenre || null) === (c.topic || null)
    && (state.language || '') === (c.language || '')
    && (state.runtimeMax || '') === String(c.runtime || '')
    && (state.decade || '') === (c.decade || '')
    && state.type === 'movie'
    && state.minimumVotes === '0'
    && !state.tris.length
    && !state.query.trim();
}

function show() {
  if (state.collection && !collectionEncoreValide()) state.collection = null;
  invalidateDiscovery();
  updateCollectionHeading();
  el('search-pagination').hidden = true;
  if (state.live && !state.liste && !state.forYou) return runSearch();
  /* « Ma liste » d'abord : c'est un LIEU, pas un filtre de plus. Les genres, le
     type et les tris s'appliquent ensuite, par-dessus, sans réseau. */
  if (state.liste) return showListe(state.liste === 'tout' ? null : state.liste);
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
    frame.title = 'Bande-annonce : ' + film.title;
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
  const nom = document.createElement('span');
  nom.className = 'reel__name';
  nom.textContent = film.title;
  const meta = document.createElement('p');
  meta.className = 'moment-meta';
  meta.textContent = (video ? (video.type === 'Trailer' ? 'BANDE-ANNONCE' : video.type) : 'AFFICHE') + ' · ' + metaLine(film);
  const overview = document.createElement('p');
  overview.className = 'moment-overview';
  overview.textContent = film.overview || 'Découvre les informations de ce titre dans sa fiche.';
  const details = document.createElement('details');
  details.className = 'moment-details';
  const summary = document.createElement('summary');
  summary.textContent = 'Toutes les informations';
  const detailContent = document.createElement('div');
  details.append(summary, detailContent);
  details.addEventListener('toggle', async () => {
    if (!details.open) return;
    detailContent.textContent = 'Chargement des informations…';
    await fetchDetail(film);
    if (!details.isConnected) return;
    detailContent.replaceChildren(buildTextBlock(film, { sansTitre: true }));
  });
  const openDetail = document.createElement('button');
  openDetail.type = 'button'; openDetail.className = 'moment-open';
  openDetail.textContent = 'Ouvrir la fiche';
  openDetail.addEventListener('click', () => openCard(film));
  foot.append(meta, nom, overview, details, openDetail);
  stage.append(foot);

  if (mark) {
    const badge = document.createElement('span');
    badge.className = 'reel__state';
    badge.append(uiIcon(mark));
    badge.title = markById(mark)?.label || '';
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
  const controls = document.createElement('div');
  controls.className = 'moment-controls';
  const focus = document.createElement('button');
  focus.type = 'button'; focus.textContent = 'Masquer les infos';
  focus.setAttribute('aria-pressed', 'false');
  focus.addEventListener('click', () => {
    const hidden = card.classList.toggle('moment-focus');
    focus.textContent = hidden ? 'Afficher les infos' : 'Masquer les infos';
    focus.setAttribute('aria-pressed', String(hidden));
    foot.inert = hidden;
  });
  controls.append(focus);
  if (video) {
    const sound = document.createElement('button');
    sound.type = 'button'; sound.textContent = 'Activer le son';
    sound.setAttribute('aria-pressed', 'false');
    sound.addEventListener('click', () => {
      const on = card.dataset.sound !== 'on';
      for (const other of wallEl.querySelectorAll('.reel[data-sound="on"]')) {
        other.dataset.sound = 'off';
        playerCommand(other.querySelector('iframe'), 'mute');
        const control = other.querySelector('[data-sound-control]');
        if (control) { control.textContent = 'Activer le son'; control.setAttribute('aria-pressed', 'false'); }
      }
      card.dataset.sound = on ? 'on' : 'off';
      const frame = stage.querySelector('iframe');
      playerCommand(frame, on ? 'unMute' : 'mute');
      if (on) { playerCommand(frame, 'setVolume', [100]); playerCommand(frame, 'playVideo'); }
      sound.textContent = on ? 'Couper le son' : 'Activer le son';
      sound.setAttribute('aria-pressed', String(on));
    });
    sound.dataset.soundControl = '';
    controls.append(sound);
    if (film.poster_path) {
      const poster = document.createElement('button');
      poster.type = 'button'; poster.textContent = 'Voir l’affiche';
      poster.setAttribute('aria-pressed', 'false');
      const still = stage.querySelector('.reel__still');
      const originalStill = still?.src;
      poster.addEventListener('click', () => {
        const showingPoster = card.classList.toggle('moment-poster');
        poster.textContent = showingPoster ? 'Voir la bande-annonce' : 'Voir l’affiche';
        poster.setAttribute('aria-pressed', String(showingPoster));
        const frame = stage.querySelector('iframe');
        playerCommand(frame, 'mute');
        card.dataset.sound = 'off';
        sound.textContent = 'Activer le son';
        sound.setAttribute('aria-pressed', 'false');
        sound.disabled = showingPoster;
        if (still) still.src = showingPoster ? state.client.posterUrl(film.poster_path, 'w780') : originalStill;
        if (showingPoster) playerCommand(frame, 'pauseVideo');
        else if (!frame.getAttribute('src')) {
          frame.src = momentUrl(video.key); watchPlayer(frame); armPlayFallback(stage, video.key);
        } else playerCommand(frame, 'playVideo');
      });
      controls.append(poster);
    }
  }
  card.append(controls);
  if (video) stage.append(buildPlaybackControls(stage, film, video));

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
    if (entry.isIntersecting && entry.intersectionRatio >= 0.6 && !entry.target.classList.contains('moment-poster')) {
      if (!frame.getAttribute('src')) {
        frame.src = momentUrl(frame.dataset.key);
        watchPlayer(frame);
        armPlayFallback(frame.closest('.reel__stage'), frame.dataset.key);
      }
    } else if (frame.getAttribute('src')) {
      playerCommand(frame, 'mute');
      playerCommand(frame, 'pauseVideo');
      frame.removeAttribute('src');
      frame.classList.remove('is-live');
      entry.target.dataset.sound = 'off';
      const sound = entry.target.querySelector('[data-sound-control]');
      if (sound) { sound.textContent = 'Activer le son'; sound.setAttribute('aria-pressed', 'false'); }
    }
  }
}, { root: wallEl, threshold: [0, 0.6] });

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

  /* `sort_by` n'accepte qu'une valeur : seul le PREMIER tri part chez TMDB, les
     autres s'appliquent à ce qui est déjà chargé. On le dit — sans quoi la
     commande ne fait pas ce qu'on croit qu'elle fait. */
  if (state.tris.length > 1) {
    const note = document.createElement('span');
    note.className = 'row__note';
    note.textContent = 'Seul le premier tri interroge le serveur.';
    frag.append(note);
  }

  host.replaceChildren(frag);
  majDebordement();
}

/* ── Les sous-genres ─────────────────────────────────────────────────────── *
   Un genre seul, c'est mille films et toujours les mêmes en tête. Les
   sous-genres sont des MOTS-CLÉS TMDB : ils découpent assez fin pour qu'on
   descende dans le catalogue au lieu de tourner en rond. Résolus à la demande
   et gardés en cache — l'identifiant d'un mot-clé ne change jamais.        */

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
  { id: 37, emoji: '🤠', label: 'Western' }
];

const GENRE_PAR_ID = new Map(GENRES.map(g => [g.id, g]));

/**
 * Les identifiants TMDB d'un type pour les genres choisis.
 *
 * `null` veut dire « ce type ne peut pas répondre à la demande entière » : on
 * ne l'interroge alors pas du tout. Mieux vaut ne rien montrer que montrer à
 * côté — une série d'action pour une recherche Action + Horreur serait un
 * mensonge.
 */
function genresPourType(kind) {
  if (!state.genres.length) return null;
  const ids = state.genres.map(id => GENRES_TMDB[id]?.[kind]).filter(Boolean);
  return ids.length === state.genres.length ? ids.join(',') : null;
}

/** Ce qu'on peut dire à quelqu'un devant un mur vide — sans quoi il ne se
 *  répare pas. */
function raisonDuVide() {
  if (state.genres.length) {
    const impossible = state.genres
      .filter(id => GENRES_TMDB[id] && !GENRES_TMDB[id][state.type === 'tv' ? 'serie' : 'film'])
      .map(id => '« ' + (GENRE_PAR_ID.get(id)?.label || id) + ' »');
    if (impossible.length && state.type !== 'all') {
      return 'Les ' + (state.type === 'tv' ? 'séries ne connaissent pas' : 'films ne connaissent pas') +
        ' ' + impossible.join(' ni ') + '. Retire ce genre, ou passe à « Tout ».';
    }
    if (state.sousGenre) {
      return 'Aucun titre ne porte à la fois ce genre et « ' + state.sousGenre +' ». Élargis en retirant la précision.';
    }
    return 'Rien avec ces genres. Retires-en un pour élargir.';
  }
  if (state.query.trim()) return 'Rien ne correspond à « ' + state.query.trim() + ' ».';
  return 'Rien à montrer ici pour l’instant.';
}

/** Un filtre : pictogramme et mot, l'un ne va pas sans l'autre. */
function filterChip(emoji, label, on, onToggle) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter';
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', label);
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
function topicLabel(key) {
  return Object.values(SOUS_GENRES).flat().find(t => t[2] === key)?.[0] || key;
}
function renderSousFiltres() {
  const host = el('sous-filtres');
  el('row-sous-filtres').hidden = false;
  host.hidden = false;
  const query = fold(el('topic-search')?.value || '');
  const groups = state.genres.length ? state.genres.map(id => SOUS_GENRES[id] || []) : Object.values(SOUS_GENRES);
  const topics = [...new Map(groups.flat().map(t => [t[2], t])).values()];
  host.replaceChildren(...topics.filter(t => !query || fold(t[0]).includes(query)).map(([name, emoji, key]) =>
    filterChip(emoji, name, state.sousGenre === key, () => {
      state.sousGenre = state.sousGenre === key ? null : key;
      state.dejaVu = new Set(); renderSousFiltres(); scheduleFilter();
    })
  ));
  if (!host.children.length) {
    const empty = document.createElement('p'); empty.className = 'row__note'; empty.textContent = 'Aucun thème avec ce nom.'; host.append(empty);
  }
}

/**
 * La rangée « Ma liste ».
 *
 * Toujours là, même vide : c'est la SEULE porte vers ce qu'on a marqué, et une
 * porte qu'on ne voit pas n'existe pas. Tant qu'il n'y a rien elle explique
 * comment la remplir, au lieu d'offrir six boutons morts.
 */
function renderListe() {
  const host = el('liste');
  if (!host) return;
  const frag = document.createDocumentFragment();
  const combien = Object.keys(state.marks).length;

  if (!combien) {
    const vide = document.createElement('span');
    vide.className = 'liste-vide';
    vide.textContent = 'Marque un film — à voir, vu, aimé — et il t’attendra ici.';
    frag.append(vide);
    host.replaceChildren(frag);
    majDebordement();
    return;
  }

  frag.append(filterChip('🎞️', 'Tout', state.liste === 'tout', () => {
    state.liste = state.liste === 'tout' ? null : 'tout';
    renderListe();
    show();
  }));

  // Seulement les états qui contiennent quelque chose : une pastille qui ne
  // mène nulle part n'est pas une contrainte, c'est un piège.
  for (const option of MARKS) {
    if (!maListe(option.id).length) continue;
    frag.append(filterChip(option.emoji, option.label, state.liste === option.id, () => {
      state.liste = state.liste === option.id ? null : option.id;
      renderListe();
      show();
    }));
  }

  host.replaceChildren(frag);
  majDebordement();
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
  majDebordement();
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
/* Deux délais, parce que ce sont deux gestes différents.
 *
 * Taper est une hésitation : « action » se dit en sept frappes, on ne relance
 * donc pas une requête par lettre. Cliquer est une intention : la pastille est
 * une cible visée, et 340 ms après le clic l'écran paraissait ne pas répondre.
 * Mesuré : le mur changeait en 350 ms, dont 340 d'anti-rebond. Il change
 * maintenant en 120 ms — assez court pour paraître immédiat, assez long pour
 * qu'une rafale de clics ne lance pas six requêtes. */
const DELAI_FRAPPE = 340;
const DELAI_CLIC = 120;

function scheduleFilter(delai = DELAI_CLIC) {
  invalidateDiscovery();
  clearTimeout(filterTimer);
  filterTimer = setTimeout(show, delai);
}

const filtresActifs = () =>
  Boolean(state.query.trim()) || state.type !== 'all' || state.genres.length > 0 ||
  state.tris.some(id => id !== 'populaire');

/**
 * La recherche. TMDB ne sait pas filtrer une recherche par texte : on filtre
 * donc nous-mêmes sur les genres que les résultats portent déjà.
 */
let discovery = null;
let discoveryAbort = null;
let discoveryRevision = 0;
let discoveryBusy = false;
let discoveryError = '';
let discoveryFiltered = false;
let discoveryIntent = '';
const topicMemory = new Map();

function invalidateDiscovery() {
  discoveryRevision++;
  discoveryAbort?.abort();
  discovery = null; discoveryBusy = false; state.loadingMore = false;
}

function syncDiscoveryControls() {
  for (const [id, key] of [['filter-decade','decade'],['filter-runtime','runtimeMax'],['filter-language','language'],['filter-votes','minimumVotes']]) {
    if (el(id)) el(id).value = state[key];
  }
}

function initDiscoveryControls() {
  for (const [id, key] of [['filter-decade','decade'],['filter-runtime','runtimeMax'],['filter-language','language'],['filter-votes','minimumVotes']]) {
    el(id).addEventListener('change', event => { state[key] = event.target.value; scheduleFilter(); });
  }
  el('topic-search').addEventListener('input', renderSousFiltres);
  el('load-next').addEventListener('click', () => {
    if (discovery) loadMore(); else show();
  });
  el('btn-collections').addEventListener('click', () => {
    const open = el('collections').hidden;
    el('collections').hidden = !open;
    el('btn-collections').setAttribute('aria-expanded', String(open));
  });
  el('collections').replaceChildren(...COLLECTIONS.map(collection => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'collection-tile'; button.dataset.tone = collection.tone;
    const title = document.createElement('strong'); title.textContent = collection.title;
    const sub = document.createElement('span'); sub.textContent = collection.subtitle;
    button.append(title,sub);
    button.addEventListener('click', () => {
      state.collection = collection.id; state.saga = null; state.query = ''; el('search').value = ''; el('search-clear').hidden = true;
      state.genres = [...collection.genres]; state.sousGenre = collection.topic || null; state.type = 'movie';
      state.language = collection.language || ''; state.runtimeMax = String(collection.runtime || ''); state.decade = collection.decade || ''; state.minimumVotes = '0';
      state.tris = []; state.liste = null; state.forYou = false; state.picked = [];
      syncDiscoveryControls(); renderFilters(); renderSousFiltres(); renderTris(); renderListe();
      el('collections').hidden = true; el('btn-collections').setAttribute('aria-expanded','false'); show();
    }); return button;
  }));
}

function updateDiscoveryStatus() {
  const count = state.mode === 'film' ? state.wall.length : state.items.filter(i => i.kind !== 'comment').length;
  const total = discovery?.total;
  let label = discoveryBusy ? 'Chargement…' : count.toLocaleString('fr-FR') + ' titres chargés';
  if (total != null) label += discoveryFiltered ? ' · catalogue parcouru : ' + total.toLocaleString('fr-FR') + ' titres' : ' sur ' + total.toLocaleString('fr-FR');
  if (discoveryIntent) label += ' · ' + discoveryIntent;
  if (discoveryError) label = discoveryError;
  el('search-status').textContent = label;
  el('load-next').hidden = !discoveryError && !state.more;
  el('load-next').disabled = discoveryBusy;
  el('load-next').textContent = discoveryBusy ? 'Chargement…' : discoveryError ? 'Réessayer' : 'Charger la suite';
  el('search-pagination').hidden = false;
  el('collection-note').textContent = state.collection ? COLLECTIONS.find(c => c.id === state.collection)?.title || '' : state.saga?.name || (state.query ? '« ' + state.query + ' »' : '');
}

async function runSearch(_page = 1, { append = false } = {}) {
  if (append && discoveryBusy) return;
  const revision = discoveryRevision;
  discoveryBusy = true; discoveryError = '';
  if (!append) {
    discoveryAbort = new AbortController();
    state.wall = []; state.items = []; state.page = 0; state.more = false;
    state.scroll[state.mode] = { top: 0, left: 0 };
    renderSkeletons(12);
  }
  updateDiscoveryStatus();
  try {
    if (!append) {
      const signal = discoveryAbort.signal;
      const query = state.query.trim();
      const intent = parseDiscoveryQuery(query, GENRES, Object.values(SOUS_GENRES).flat());
      const genres = [...new Set([...state.genres, ...(intent?.genres || [])])];
      const topic = state.sousGenre || intent?.topic;
      discoveryIntent = intent ? 'Thèmes : ' + intent.label : '';
      const text = intent ? '' : query;
      const filters = { decade: state.decade, runtime: Number(state.runtimeMax), language: state.language, votes: Number(state.minimumVotes) };
      const movieKinds = state.type === 'all' ? ['movie','tv'] : [state.type];
      let ids = [];
      if (topic) {
        if (topicMemory.has(topic)) ids = topicMemory.get(topic);
        else { ids = await resolveTopicIds(topic, api, signal); topicMemory.set(topic, ids); }
        if (!ids.length) throw new Error('Ce thème n’a pas de mot-clé exact dans TMDB. Essaie un thème voisin.');
      }
      signal.throwIfAborted();
      const request = async (path, params, options) => {
        if (path.startsWith('/collection/')) {
          const data = await api(path, {}, options);
          return { results: data.parts || [], total_pages: 1, total_results: data.parts?.length || 0 };
        }
        return api(path, params, options);
      };
      let sources = movieKinds.flatMap(kind => {
        const mapped = genres.map(id => GENRES_TMDB[id]?.[kind === 'movie' ? 'film' : 'serie']).filter(Boolean);
        if (mapped.length !== genres.length) return [];
        const dateKey = kind === 'movie' ? 'primary_release_date' : 'first_air_date';
        return [{ kind, path: (text ? '/search/' : '/discover/') + kind, params: text ? { query: text, include_adult: false } : {
          include_adult: false, sort_by: triServeur(kind) || 'popularity.desc',
          with_genres: [...new Set(mapped)].join(',') || undefined,
          with_keywords: ids.join('|') || undefined,
          'vote_count.gte': filters.votes || undefined,
          with_original_language: filters.language || undefined,
          'with_runtime.lte': filters.runtime || undefined,
          [dateKey + '.gte']: filters.decade ? filters.decade + '-01-01' : undefined,
          [dateKey + '.lte']: filters.decade ? (Number(filters.decade) + 9) + '-12-31' : undefined
        } }];
      });
      if (state.saga) sources = [{ kind: 'movie', path: '/collection/' + state.saga.id, params: {} }];
      discoveryFiltered = Boolean(text && (genres.length || topic || Object.values(filters).some(Boolean)));
      const accept = async film => {
        if (!text) return true;
        if (genres.length && !genres.every(id => film.genre_ids.includes(id))) return false;
        if (filters.language && film.original_language !== filters.language) return false;
        if (filters.votes && film.vote_count < filters.votes) return false;
        if (filters.decade && !(Number(film.date?.slice(0,4)) >= Number(filters.decade) && Number(film.date?.slice(0,4)) <= Number(filters.decade) + 9)) return false;
        if (ids.length) {
          const kw = await api('/' + film.kind + '/' + film.id + '/keywords', {}, { signal });
          if (!(kw.keywords || kw.results || []).some(k => ids.includes(k.id))) return false;
        }
        if (filters.runtime) {
          const detail = await api('/' + film.kind + '/' + film.id, {}, { signal });
          const minutes = detail.runtime || detail.episode_run_time?.[0];
          if (!minutes || minutes > filters.runtime) return false;
        }
        return true;
      };
      discovery = createDiscoverySession({ request, sources, normalize, accept, signal });
    }
    const session = discovery;
    const films = trier(await session.next({ target: state.mode === 'film' ? 40 : 20 }));
    if (revision !== discoveryRevision) return;
    films.forEach(f => state.films.set(keyOf(f), f));
    state.more = session.hasMore;
    state.page++;
    state.pageLoader = runSearch;
    if (state.mode === 'film') {
      state.wall.push(...films);
      if (append) appendWallCards(films);
      else if (state.wall.length) renderWall();
      else {
        const empty = document.createElement('p'); empty.className = 'wall-vide';
        empty.textContent = session.hasMore ? 'Aucun résultat dans les premières pages. Continue la recherche avec « Charger la suite ».' : raisonDuVide();
        wallEl.replaceChildren(empty);
      }
    } else {
      const videos = await mapLimit(films, 4, film => fetchVideos(film));
      if (revision !== discoveryRevision) return;
      const items = interleave(films.map((film,i) => ({ film, video: bestVideo(videos[i]) })));
      state.items.push(...items);
      if (append) appendFeedCards(items); else renderFeed();
    }
    announce(state.wall.length + ' titres chargés.');
  } catch (error) {
    if (revision !== discoveryRevision || error.name === 'AbortError') return;
    discoveryError = error.message.startsWith('Ce thème') ? error.message : 'Chargement interrompu. Tu peux réessayer sans perdre les résultats.';
    if (!append) {
      const message = document.createElement('p'); message.className = 'wall-vide'; message.textContent = discoveryError; wallEl.replaceChildren(message);
    }
    state.more = Boolean(discovery?.hasMore);
  } finally {
    if (revision === discoveryRevision) { discoveryBusy = false; updateDiscoveryStatus(); }
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

  /* 2 — la fiche : qui l'a fait, ce qu'on en sait, où le voir.
     UN SEUL groupe, et non trois. Dans une carte de 250 px, chaque groupe
     supplémentaire ajoutait un raccourci de plus : cinq onglets ne tenaient pas
     sur une rangée, la bande passait à la ligne et les raccourcis se lisaient
     mal. Quatre groupes tiennent en deux rangées de deux. */
  const fiche = [];

  /* Le nom, en mots. C'est ici que le langage s'explique : les emoji du mur
     sont un nom, et ce nom se lit. */
  const noms = signatureOf(film)
    .map(id => STICKER_BY_ID.get(id)?.label)
    .filter(Boolean)
    .join(', ');
  if (noms) fiche.push(['Son nom', noms]);

  if (film.director) fiche.push([film.kind === 'tv' ? 'Création' : 'Réalisation', film.director]);
  if (film.cast?.length) fiche.push(['Avec', film.cast.slice(0, 3).join(', ')]);
  if (film.vote_count) fiche.push(['Note', film.vote_average.toFixed(1) + ' / 10']);
  if (film.countries?.length) fiche.push(['Pays', film.countries.join(', ')]);
  if (film.providers?.length) fiche.push(['Où le voir', film.providers.join(', ')]);
  if (film.companies?.length) fiche.push(['Production', film.companies.slice(0, 1).join(', ')]);
  if (film.budget) fiche.push(['Budget', money(film.budget)]);
  if (film.revenue) fiche.push(['Recettes', money(film.revenue)]);
  /* Six lignes au maximum : la carte du survol n'a pas d'ascenseur, et au-delà
     la dernière ligne était coupée en deux — un texte tranché net ne se lit pas
     comme « il y en a plus », il se lit comme un bug. La fiche, elle, garde
     tout. */
  if (fiche.length) slides.push({ kind: 'rows', nom: 'Fiche', rows: fiche.slice(0, 6) });

  // 3 — le moment, toujours en dernier
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

  /* La transition : le nouveau groupe arrive du côté où on va, l'ancien
     s'efface dessous. Un échange sec donnait un clignotement. */
  const nouveau = slideBody(slide);
  const ancien = deck.body.firstElementChild;
  nouveau.style.setProperty('--sens', String(deck.at >= (deck.prec ?? -1) ? 1 : -1));
  nouveau.classList.add('peek__slide--in');
  deck.body.append(nouveau);
  deck.prec = deck.at;
  if (ancien && ancien !== nouveau) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ancien.remove();
    else {
      ancien.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => ancien.remove()).catch(() => ancien.remove());
    }
  }

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
  noter('marque', film);
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
/**
 * Mes films marqués, les plus récemment ajoutés d'abord.
 *
 * Le type, les genres et les tris s'appliquent PAR-DESSUS : « mes films
 * d'animation, les plus récents » se demande sans quitter sa liste. Tout se
 * passe sur ce qu'on a déjà en local — aucune requête.
 */
function maListe(mark) {
  return Object.keys(state.marks)
    .map(k => state.mesFilms[k])
    .filter(Boolean)
    .filter(f => !mark || state.marks[keyOf(f)] === mark)
    .filter(f => state.type === 'all' || (f.kind || 'movie') === state.type)
    .filter(f => !state.genres.length || state.genres.some(g => (f.genre_ids || []).includes(g)))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

/**
 * Écrire une recherche rend la main au catalogue.
 *
 * « Ma liste » et « Pour vous » sont des LIEUX : tant qu'ils sont ouverts,
 * `show()` s'arrête sur eux — la barre de recherche et le moteur par emoji ne
 * faisaient donc plus rien du tout. Une commande visible qui ne répond pas est
 * pire qu'une commande absente : on quitte le lieu, et on le montre, plutôt que
 * d'ignorer la demande.
 */
function quitterLesLieux() {
  if (!state.liste && !state.forYou) return;
  state.liste = null;
  state.forYou = false;
  renderListe();
  renderFilters();
}

/** Ma liste à l'écran. Un vide qui explique vaut mieux qu'un vide muet. */
function showListe(mark) {
  /* « Aucune marque » et « ces filtres ne laissent rien passer » sont deux vides
     différents, et ils ne se réparent pas pareil : l'un demande de marquer un
     film, l'autre de relâcher un filtre. On compte donc les marques telles
     quelles, avant tout filtre. */
  const marques = Object.keys(state.marks).length;
  const films = trier(maListe(mark));
  state.wall = films;
  state.more = false;
  state.pageLoader = null;
  state.scroll.film = { top: 0, left: 0 };

  const nom = mark ? (markById(mark)?.label || 'Ma liste') : 'Ma liste';

  if (!films.length) {
    const vide = document.createElement('p');
    vide.className = 'wall-vide';
    vide.textContent = marques
      ? 'Rien dans « ' + nom + ' » avec ces filtres. Enlèves-en un pour revoir tes films.'
      : 'Ta liste est vide pour l’instant. Marque un film — à voir, vu, aimé — et il t’attendra ici.';
    wallEl.replaceChildren(vide);
  } else {
    renderWall();
  }
  announce(films.length + ' film' + (films.length > 1 ? 's' : '') + ' dans « ' + nom + ' ».');
}

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
    bouton.append(uiIcon(mark || (emoji === '🔍' ? 'search' : 'similar')));
    bouton.addEventListener('click', event => {
      event.stopPropagation();
      // L'éclat dit « c'est pris en compte » avant même que l'écran change.
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const r = bouton.getBoundingClientRect();
        spark({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, emoji);
      }
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

/** La position du pointeur, tenue à jour globalement : l'intention de survol
 *  se juge au mouvement, pas à un délai fixe. */
const pointeur = { x: -1, y: -1 };
addEventListener('pointermove', e => { pointeur.x = e.clientX; pointeur.y = e.clientY; }, { passive: true });

/** Le survol n'existe qu'à la souris ; au doigt, c'est la fiche qui s'ouvre. */
let activePreview = null;
function closeCataloguePreview() {
  clearTimeout(peekTimer);
  if (activePreview) {
    activePreview.classList.remove('has-preview');
    activePreview.querySelector('.catalogue-preview')?.setAttribute('inert', '');
    activePreview = null;
  }
}
wallEl.addEventListener('scroll', closeCataloguePreview, { passive: true });
addEventListener('resize', closeCataloguePreview, { passive: true });

function bindPeek(card, film) {
  if (!canHover()) return;
  const build = () => {
    if (card.querySelector('.catalogue-preview')) return;
    const preview = document.createElement('div');
    preview.className = 'catalogue-preview';
    const meta = document.createElement('p');
    meta.className = 'preview-meta';
    meta.textContent = (film.kind === 'tv' ? 'SÉRIE' : 'FILM') + (film.date ? ' · ' + film.date.slice(0, 4) : '');
    const title = document.createElement('h2');
    title.textContent = film.title;
    const overview = document.createElement('p');
    overview.className = 'preview-overview';
    overview.textContent = film.overview || 'Ouvre la fiche pour découvrir ce titre.';
    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    const more = document.createElement('button');
    more.type = 'button'; more.textContent = 'Voir la fiche';
    more.addEventListener('click', () => { closeCataloguePreview(); openCard(film); });
    const save = document.createElement('button');
    save.type = 'button'; save.className = 'preview-save';
    save.setAttribute('aria-label', 'À voir : ' + film.title);
    save.setAttribute('aria-pressed', String(state.marks[keyOf(film)] === 'want'));
    save.append(uiIcon('want'));
    save.addEventListener('click', () => {
      const marked = toggleMark(film, 'want');
      save.setAttribute('aria-pressed', String(marked));
      announce(marked ? 'Ajouté à ta liste.' : 'Retiré de ta liste.');
    });
    actions.append(more, save);
    preview.append(meta, title, overview, actions);
    preview.setAttribute('inert', '');
    card.append(preview);
  };
  const reveal = () => {
    closeCataloguePreview();
    build();
    activePreview = card;
    card.querySelector('.catalogue-preview').removeAttribute('inert');
    card.classList.add('has-preview');
  };
  card.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { if (card.matches(':hover') && card.isConnected) reveal(); }, 220);
  });
  card.addEventListener('pointerleave', () => {
    clearTimeout(peekTimer);
    if (activePreview === card && !card.contains(document.activeElement)) closeCataloguePreview();
  });
  card.addEventListener('focusin', event => { if (event.target.matches(':focus-visible')) reveal(); });
  card.addEventListener('focusout', event => { if (!card.contains(event.relatedTarget)) closeCataloguePreview(); });
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); closeCataloguePreview(); }
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
      quitterLesLieux();
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
    noter('avis', film);
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
  for (const frame of wallEl.querySelectorAll('iframe')) playerCommand(frame, 'pauseVideo');
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
    noter('avis', film);
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
    noter('commentaire', film);
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
    noter('commentaire', film);
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

  wrap.append(buildFilmLinks(film));
  return wrap;
}

function externalLink(label, url) {
  const a = document.createElement('a'); a.textContent = label; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
function youtubeSearch(film, suffix) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(film.title + ' ' + (film.date || '').slice(0,4) + ' ' + suffix);
}
function buildFilmLinks(film) {
  const host = document.createElement('section'); host.className = 'film-links'; host.setAttribute('aria-label', 'Vidéos et disponibilité');
  const links = document.createElement('div'); links.className = 'film-links__videos';
  links.append(externalLink('Bandes-annonces sur YouTube ↗', youtubeSearch(film, 'bande annonce officielle')),
    externalLink('Chercher des critiques vidéo ↗', youtubeSearch(film, 'critique film avis')),
    externalLink('Analyses du film ↗', youtubeSearch(film, 'analyse cinéma')));
  host.append(links);
  if (film.collection) {
    const saga = document.createElement('button'); saga.type = 'button'; saga.className = 'saga-link'; saga.textContent = 'Explorer la saga : ' + film.collection.name;
    saga.addEventListener('click', () => {
      closeCard(); state.saga = film.collection; state.collection = null; state.query = ''; el('search').value = ''; el('search-clear').hidden = true;
      state.genres = []; state.sousGenre = null; state.decade = ''; state.runtimeMax = ''; state.language = ''; state.minimumVotes = '0'; state.type = 'movie'; state.tris = []; state.liste = null; state.forYou = false;
      syncDiscoveryControls(); renderFilters(); renderSousFiltres(); renderTris(); state.mode = 'film'; appEl.className = 'mode-film'; renderModes(); show();
    }); host.append(saga);
  }
  const availability = document.createElement('div'); availability.className = 'availability';
  const label = document.createElement('label'); label.textContent = 'Où le regarder ? ';
  const region = document.createElement('select'); region.setAttribute('aria-label', 'Pays de visionnage');
  for (const [id,name] of [['FR','France'],['BE','Belgique'],['CH','Suisse'],['CA','Canada'],['US','États-Unis'],['GB','Royaume-Uni']]) {
    const option = document.createElement('option'); option.value = id; option.textContent = name; region.append(option);
  }
  label.append(region); const offers = document.createElement('div'); offers.className = 'availability__offers';
  const render = () => {
    offers.replaceChildren();
    const data = film.providerRegions?.[region.value];
    let present = false;
    /* Les mêmes plateformes proposent souvent la location ET l'achat : TMDB
       renvoie alors deux listes identiques, affichées deux fois. On regroupe les
       modes qui partagent exactement la même liste — « Location et achat » se lit
       d'un coup, là où la répétition se saute. */
    const modes = [];
    for (const [key,title] of [['flatrate','Abonnement'],['free','Gratuit'],['ads','Avec publicité'],['rent','Location'],['buy','Achat']]) {
      const noms = plateformesDe(data?.[key]);
      if (!noms.length) continue;
      const meme = modes.find(m => m.noms.join('|') === noms.join('|'));
      if (meme) meme.titres.push(title);
      else modes.push({ titres: [title], noms });
    }
    for (const mode of modes) {
      present = true;
      const row = document.createElement('p');
      const heading = document.createElement('strong');
      heading.textContent = mode.titres.join(' et ') + ' · ';
      row.append(heading, document.createTextNode(mode.noms.join(', ')));
      offers.append(row);
    }
    if (!present) {
      const empty = document.createElement('p'); empty.textContent = film.providerError ? 'Disponibilité momentanément inaccessible.' : 'Aucune offre renseignée dans ce pays. Cela ne signifie pas que le film est introuvable.'; offers.append(empty);
    }
    if (data?.link?.startsWith('https://')) offers.append(externalLink('Voir les offres disponibles ↗', data.link));
    const attribution = document.createElement('small'); attribution.textContent = 'Disponibilités : JustWatch via TMDB. Les offres peuvent changer.'; offers.append(attribution);
  };
  region.addEventListener('change', render); render(); availability.append(label,offers); host.append(availability);
  return host;
}

const timeLabel = seconds => Math.floor(Math.max(0, seconds || 0) / 60) + ':' + String(Math.floor(Math.max(0, seconds || 0) % 60)).padStart(2,'0');
function updatePlaybackControls(frame) {
  const bar = frame.closest('.reel__stage, .card-stage')?.querySelector('.playback');
  if (!bar) return;
  const info = frame.__playback || {};
  const seek = bar.querySelector('input[type="range"]');
  const pause = bar.querySelector('[data-pause]');
  const playing = info.playerState === 1;
  pause.textContent = playing ? 'Pause' : 'Lecture';
  pause.setAttribute('aria-label', playing ? 'Mettre en pause' : 'Reprendre la lecture');
  if (info.duration > 0) {
    seek.disabled = false; seek.max = String(info.duration);
    if (seek.dataset.seeking !== 'true') seek.value = String(info.currentTime || 0);
    seek.setAttribute('aria-valuetext', timeLabel(Number(seek.value)) + ' sur ' + timeLabel(info.duration));
    bar.querySelector('output').textContent = timeLabel(info.currentTime) + ' / ' + timeLabel(info.duration);
  }
}
function buildPlaybackControls(stage, film, video) {
  const bar = document.createElement('div'); bar.className = 'playback';
  const row = document.createElement('div'); row.className = 'playback__buttons';
  const frame = () => stage.querySelector('iframe');
  const make = (label, action) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', action); row.append(button); return button; };
  const pause = make('Pause', () => playerCommand(frame(), frame()?.__playback?.playerState === 1 ? 'pauseVideo' : 'playVideo')); pause.dataset.pause = '';
  for (const [label, delta] of [['−10 s',-10],['+10 s',10]]) make(label, () => {
    const info = frame()?.__playback || {};
    playerCommand(frame(), 'seekTo', [Math.min(info.duration || Infinity, Math.max(0,(info.currentTime || 0) + delta)),true]);
  });
  const speed = document.createElement('select'); speed.setAttribute('aria-label','Vitesse de lecture');
  for (const rate of [0.5,1,1.25,1.5,2]) { const option = document.createElement('option'); option.value = rate; option.textContent = rate + '×'; option.selected = rate === 1; speed.append(option); }
  speed.addEventListener('change', () => playerCommand(frame(),'setPlaybackRate',[Number(speed.value)])); row.append(speed);
  row.append(externalLink('YouTube ↗','https://www.youtube.com/watch?v=' + encodeURIComponent(video.key)));
  const seekRow = document.createElement('div'); seekRow.className = 'playback__seek';
  const seek = document.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.max = '1'; seek.step = '1'; seek.value = '0'; seek.disabled = true; seek.setAttribute('aria-label','Position dans la bande-annonce');
  seek.addEventListener('input', () => { seek.dataset.seeking = 'true'; });
  seek.addEventListener('change', () => { playerCommand(frame(),'seekTo',[Number(seek.value),true]); seek.dataset.seeking = 'false'; });
  const output = document.createElement('output'); output.textContent = '0:00 / —'; seekRow.append(seek,output);
  const status = document.createElement('span'); status.className = 'playback-status'; status.setAttribute('role','status');
  bar.append(row,seekRow,status); return bar;
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
  button.append(uiIcon(option.id === 'watching' ? 'play' : option.id));
  const word = document.createElement('span');
  word.textContent = option.label;
  button.append(word);
  button.addEventListener('click', () => {
    const at = keyOf(film);
    if (state.marks[at] === option.id) delete state.marks[at];
    else { state.marks[at] = option.id; rememberFilm(film); }
    noter('marque', film);
    saveStore();
    announce(option.label + (state.marks[at] === option.id ? ' activé.' : ' désactivé.'));
    // Un avis peut faire naître « Pour vous » ET « Ma liste » : les rangées suivent.
    renderFilters();
    renderListe();
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
  if (moment) stage.append(buildPlaybackControls(stage, film, moment));
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
  body.append(buildTextBlock(film));

  const rule = document.createElement('div');
  rule.className = 'rule';
  const feelings = document.createElement('details');
  feelings.className = 'feelings';
  feelings.open = state.paletteOpen;
  const summary = document.createElement('summary');
  summary.textContent = 'Ton ressenti';
  feelings.append(summary, buildSigRow(film, signature), buildCommentSlot(film), buildReactHost(film, signature));
  body.append(rule, feelings);

  const rule2 = document.createElement('div');
  rule2.className = 'rule';
  body.append(rule2);

  frag.append(body, buildFoot(film, mark));

  cardEl_.replaceChildren(frag);
  cardEl_.hidden = false;

  /* La colonne vient d'être remplie : on regarde s'il reste quelque chose en
     bas, et on le regardera à chaque fois qu'on y descendra. */
  const corps = cardEl_.querySelector('.card-body');
  if (corps && !corps.__suit) {
    corps.__suit = true;
    corps.addEventListener('scroll', majFicheDefile, { passive: true });
  }
  majFicheDefile();

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
    if (mark && badge) badge.replaceChildren(uiIcon(mark));
    else if (mark) {
      const fresh = document.createElement('span');
      fresh.className = 'reel__state';
      fresh.append(uiIcon(mark));
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
  majFicheDefile();

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
  if (state.mode === 'reel') {
    const viewport = wallEl.getBoundingClientRect();
    for (const frame of wallEl.querySelectorAll('iframe[src]')) {
      const bounds = frame.closest('.reel').getBoundingClientRect();
      if (Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top) > viewport.height * 0.6) playerCommand(frame, 'playVideo');
    }
  }
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

/* `start` est asynchrone : sans clé locale, il interroge le relais avant de
   décider si l'application est en direct ou en démonstration. */
async function start() {
  loadStore();
  initCatalogueLayout();
  el('btn-refine').addEventListener('click', () => setRefinements(el('refinements').hidden));

  const config = window.FRAME_CONFIG || {};
  state.credential = config.tmdbToken || config.tmdbKey || loadCredential();
  const demonstration = new URLSearchParams(location.search).get('demo') === '1';
  /* Sans clé locale, on cherche un relais avant de renoncer : c'est le cas
     normal de la version publiée. */
  if (!demonstration && detectAuth(state.credential) === null) {
    state.relais = await relaisDisponible();
  }
  state.live = !demonstration && (detectAuth(state.credential) !== null || state.relais);
  state.client = state.live
    ? createClient({ credential: state.credential, proxy: state.relais ? RELAIS : null })
    : createDemoClient();

  el('btn-mirror').addEventListener('click', openMirror);

  /* Le mode Soirée. Il ne connaît du catalogue que ce qu'on lui donne : les
     films affichés au moment où on ouvre la soirée deviennent le deck proposé.
     Le jeu ne dépend donc d'aucune règle de recherche, et la recherche n'a rien
     à savoir du jeu. */
  initRoom({
    films: () => state.wall.filter(f => f && f.poster_path),
    /* Chacun apporte ce qu'il veut : la recherche porte sur TOUT TMDB, pas sur
       ce que le catalogue a sous les yeux. C'est la différence entre jouer avec
       quarante films et jouer avec tous. */
    chercher: async q => {
      const data = await api('/search/multi', { query: q, include_adult: false });
      return (data.results || [])
        .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
        .slice(0, 8)
        .map(r => normalize(r, r.media_type))
        .filter(f => f.poster_path)
        .map(f => ({
          key: keyOf(f), id: f.id, kind: f.kind, title: f.title,
          year: (f.date || '').slice(0, 4), poster: f.poster_path
        }));
    },
    annoncer: message => announce(message),
    ouvrir: () => { if (!cardEl_.hidden) closeCard(); if (!mirrorEl.hidden) closeMirror(); },
    fermer: () => el('btn-soiree')?.focus()
  });
  el('btn-soiree').addEventListener('click', () => {
    if (soireeEl.hidden) ouvrirRoom(); else fermerRoom();
  });

  /* Le profil. Il ne connaît du catalogue que deux choses : l'état à ranger, et
     quoi refaire quand une fusion l'a changé. Le reste — les codes, la fusion —
     vit dans son module. */
  initProfil({
    etat: () => ({
      reactions: state.reactions, marks: state.marks, comments: state.comments,
      films: state.mesFilms, horodatages: state.horodatages
    }),
    appliquer: fusion => {
      state.reactions = fusion.reactions;
      state.marks = fusion.marks;
      state.comments = fusion.comments;
      state.mesFilms = fusion.mesFilms;
      state.horodatages = fusion.horodatages;
      saveStore();
      renderFilters(); renderListe(); renderTris();
      show();
    },
    annoncer: message => announce(message),
    miroir: () => openMirror(),
    ouvrir: () => { if (!cardEl_.hidden) closeCard(); if (!soireeEl.hidden) fermerRoom(); },
    fermer: () => el('btn-profil')?.focus()
  });
  el('btn-profil').addEventListener('click', () => {
    if (profilEl.hidden) ouvrirProfil(); else fermerProfil();
  });
  wallEl.addEventListener('scroll', () => {
    updateProgress();
    // À 900 px du bas, on prépare la suite avant qu'on l'atteigne.
    // Le seuil vaut pour les deux : le mur descend, le fil vertical aussi.
    if (wallEl.scrollHeight - wallEl.scrollTop - wallEl.clientHeight < 900) {
      loadMore();
    }
  }, { passive: true });

  /* Les bords des rangées de pastilles s'éteignent au fur et à mesure qu'on les
     fait défiler. Sur `scroll` la rangée elle-même, et sur redimensionnement :
     c'est la largeur qui décide de ce qui déborde. */
  for (const id of ['liste', 'filters', 'tris', 'sous-filtres']) {
    const rangée = el(id);
    if (rangée) rangée.addEventListener('scroll', majDebordement, { passive: true });
  }
  addEventListener('resize', () => { majDebordement(); majFicheDefile(); }, { passive: true });

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
  renderListe();
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
  const emojiIcon = uiIcon('smile');
  emojiButton.append(emojiIcon);

  emojiButton.addEventListener('click', () => {
    const ouvert = appEl.classList.toggle('has-picker');
    emojiButton.setAttribute('aria-expanded', String(ouvert));
    if (ouvert) el('drawers').scrollIntoView({ block: 'nearest' });
  });

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    quitterLesLieux();
    state.dejaVu = new Set();
    clearButton.hidden = !state.query;
    scheduleFilter(DELAI_FRAPPE);
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

/* Une panne au démarrage ne doit pas laisser une page blanche et muette. */
start().catch(error => {
  const avis = document.getElementById('wall');
  if (avis) {
    const p = document.createElement('p');
    p.className = 'wall-vide';
    p.textContent = 'L’application n’a pas pu démarrer : ' + error.message;
    avis.replaceChildren(p);
  }
  console.error(error);
});
