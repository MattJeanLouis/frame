/**
 * Les règles d'une room, sans réseau et sans horloge implicite.
 *
 * Rien ici ne connaît HTTP, ni le DOM, ni Node : ce module décrit seulement ce
 * qu'est une room, comment on y entre, comment on vote, et comment on départage.
 * C'est ce qui permet de l'éprouver pour de bon — un jeu à plusieurs dont les
 * règles ne sont pas testables est un jeu dont on découvre les bugs en soirée.
 *
 * Le vocabulaire :
 *   - une ROOM a un code, des joueurs, et une phase ;
 *   - un DECK est la liste de films sur laquelle tout le monde se prononce ;
 *   - un VOTE vaut 'oui', 'peut' ou 'non' — un joueur, un film, un vote.
 */

export const PHASES = ['lobby', 'manche', 'revelation', 'verdict'];
export const VOTES = ['oui', 'peut', 'non'];

/** Le nombre de films d'un deck par défaut : de quoi jouer, pas de quoi subir. */
export const DECK_DEFAUT = 12;
/** Au-delà, on considère que plus personne n'est là. */
export const VIE_MS = 6 * 60 * 60 * 1000;

const PROPRES = ['code', 'phase', 'joueurs', 'hote', 'deck', 'votes', 'manche', 'cree', 'activite', 'theme'];

/* ── Les clés ─────────────────────────────────────────────────────────────── */

/** Un film et une série peuvent partager un identifiant : le type fait la clé. */
export const cleFilm = film => (film.kind || 'movie') + ':' + film.id;

/** Un code de room : quatre lettres et deux chiffres, sans I ni O — on le dicte
 *  à voix haute, et « I » se confond avec « 1 ». */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codeAleatoire(tirage = Math.random) {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(tirage() * ALPHABET.length)];
  return out;
}

/** Ce qu'on accepte d'un code dicté : minuscules, espaces, tirets, « O » pour zéro. */
export function normaliserCode(saisie) {
  return String(saisie || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .slice(0, 6);
}

/* ── La room ──────────────────────────────────────────────────────────────── */

export function createRoom(code, { now = Date.now } = {}) {
  return {
    code,
    phase: 'lobby',
    joueurs: [],
    hote: null,
    deck: [],
    votes: {},
    manche: 0,
    theme: '',
    cree: now,
    activite: now
  };
}

/** Le joueur visé, ou null. */
export const joueurDe = (room, id) => room.joueurs.find(j => j.id === id) || null;

function toucher(room, now) {
  room.activite = now;
}

export function rejoindre(room, nom, { now = Date.now(), id = null } = {}) {
  const propre = String(nom || '').trim().slice(0, 24) || 'Quelqu’un';
  /* Revenir, c'est reprendre sa place — pas en créer une deuxième. Sans cela,
     un téléphone qui se met en veille laissait un fantôme dans la liste, et le
     joueur ne pouvait plus voter sous son nom. */
  if (id) {
    const connu = joueurDe(room, id);
    if (connu) { connu.nom = propre; connu.vu = now; toucher(room, now); return connu; }
  }
  const joueur = {
    id: id || 'j' + Math.random().toString(36).slice(2, 10),
    nom: propre,
    arrive: now,
    vu: now
  };
  room.joueurs.push(joueur);
  room.votes[joueur.id] = {};
  if (!room.hote) room.hote = joueur.id;
  toucher(room, now);
  return joueur;
}

export function partir(room, id, { now = Date.now() } = {}) {
  const at = room.joueurs.findIndex(j => j.id === id);
  if (at < 0) return false;
  room.joueurs.splice(at, 1);
  delete room.votes[id];
  /* L'hôte s'en va : on passe la main au plus ancien plutôt que de laisser la
     room sans personne qui puisse lancer la manche. */
  if (room.hote === id) room.hote = room.joueurs[0]?.id || null;
  if (room.phase !== 'lobby' && !room.joueurs.length) {
    room.phase = 'lobby';
    room.deck = [];
    room.votes = {};
  }
  toucher(room, now);
  return true;
}

/* ── La manche ────────────────────────────────────────────────────────────── */

/** Lance une manche sur un deck. Un deck vide ne lance rien. */
export function lancerManche(room, deck, { now = Date.now(), theme = '' } = {}) {
  const propre = (deck || [])
    .filter(f => f && f.id != null && f.title)
    .map(f => ({
      key: cleFilm(f),
      id: f.id,
      kind: f.kind || 'movie',
      title: String(f.title).slice(0, 120),
      year: String(f.year || (f.date || '').slice(0, 4) || '').slice(0, 4),
      poster: f.poster || f.poster_path || null
    }));
  if (!propre.length) return false;
  room.deck = propre;
  room.votes = {};
  for (const j of room.joueurs) room.votes[j.id] = {};
  room.manche++;
  room.phase = 'manche';
  room.theme = String(theme || '').slice(0, 80);
  toucher(room, now);
  return true;
}

/** Un vote. Re-voter remplace — on a le droit de changer d'avis. */
export function voter(room, joueurId, filmKey, choix, { now = Date.now() } = {}) {
  if (room.phase !== 'manche') return false;
  if (!joueurDe(room, joueurId)) return false;
  if (!VOTES.includes(choix)) return false;
  if (!room.deck.some(f => f.key === filmKey)) return false;
  room.votes[joueurId] = room.votes[joueurId] || {};
  room.votes[joueurId][filmKey] = choix;
  toucher(room, now);
  return true;
}

/** Combien de films ce joueur a vus. */
export const avancement = (room, joueurId) => Object.keys(room.votes[joueurId] || {}).length;

/** Un joueur a fini quand il s'est prononcé sur tout le deck. */
export const aFini = (room, joueurId) => avancement(room, joueurId) >= room.deck.length && room.deck.length > 0;

export const tousOntFini = room =>
  room.deck.length > 0 && room.joueurs.length > 0 && room.joueurs.every(j => aFini(room, j.id));

export function reveler(room, { now = Date.now() } = {}) {
  if (room.phase !== 'manche') return false;
  room.phase = 'revelation';
  toucher(room, now);
  return true;
}

export function conclure(room, { now = Date.now() } = {}) {
  if (room.phase !== 'revelation') return false;
  room.phase = 'verdict';
  toucher(room, now);
  return true;
}

export function retourAuLobby(room, { now = Date.now() } = {}) {
  room.phase = 'lobby';
  room.deck = [];
  room.votes = {};
  room.theme = '';
  toucher(room, now);
  return true;
}

/* ── Le dépouillement ─────────────────────────────────────────────────────── */

/**
 * Le score d'un film.
 *
 * L'unanimité passe avant tout : un film que tout le monde veut voir bat un film
 * que trois personnes adorent et qu'une refuse. C'est la règle qui rend le jeu
 * utilisable — on cherche ce qu'on regarde ENSEMBLE, pas ce qui divise.
 */
export function score(room, filmKey) {
  const oui = [], peut = [], non = [];
  for (const j of room.joueurs) {
    const v = room.votes[j.id]?.[filmKey];
    if (v === 'oui') oui.push(j.id);
    else if (v === 'peut') peut.push(j.id);
    else if (v === 'non') non.push(j.id);
  }
  const exprimes = oui.length + peut.length + non.length;
  return {
    oui, peut, non, exprimes,
    /* Unanime veut dire : tout le monde s'est prononcé, et personne n'a refusé. */
    unanime: room.joueurs.length >= 2 && oui.length === room.joueurs.length,
    sansRefus: non.length === 0 && oui.length > 0,
    score: oui.length * 2 + peut.length - non.length * 2
  };
}

/**
 * Le classement complet, du plus consensuel au plus clivant.
 *
 * Les films sur lesquels personne ne s'est prononcé tombent en dernier : ils
 * n'ont pas été refusés, ils n'ont simplement pas été vus.
 */
export function classement(room) {
  return room.deck
    .map(film => ({ film, ...score(room, film.key) }))
    .sort((a, b) =>
      (b.unanime - a.unanime) ||
      (b.sansRefus - a.sansRefus) ||
      (b.score - a.score) ||
      (a.non.length - b.non.length) ||
      (b.oui.length - a.oui.length) ||
      String(a.film.title).localeCompare(String(b.film.title), 'fr'));
}

/* ── Ce que chacun a le droit de voir ─────────────────────────────────────── */

/**
 * L'état d'une room, filtré pour un joueur.
 *
 * Pendant la manche, PERSONNE ne voit les votes des autres — c'est tout l'intérêt
 * du jeu : découvrir ensuite que le film qu'on croyait consensuel était celui que
 * son voisin détestait. On ne renvoie donc que l'avancement des autres, jamais
 * leur contenu. Le filtre est ici, dans la logique testée, et non dans
 * l'interface : c'est une règle, pas une politesse.
 */
export function vuePour(room, joueurId) {
  const moi = joueurDe(room, joueurId);
  const enManche = room.phase === 'manche';
  const revele = room.phase === 'revelation' || room.phase === 'verdict';

  const joueurs = room.joueurs.map(j => ({
    id: j.id,
    nom: j.nom,
    hote: j.id === room.hote,
    /* Son propre avancement est toujours visible ; celui des autres aussi, mais
       seulement en nombre. */
    avancement: avancement(room, j.id),
    aFini: aFini(room, j.id)
  }));

  /* Les votes sont TOUJOURS rangés par joueur, jamais à la racine : une forme
     unique ne se confond pas, et une fuite se voit tout de suite. Pendant la
     manche, la carte ne contient que la mienne. */
  const votes = {};
  if (moi) votes[moi.id] = { ...(room.votes[moi.id] || {}) };
  if (revele) for (const j of room.joueurs) votes[j.id] = { ...(room.votes[j.id] || {}) };

  return {
    code: room.code,
    phase: room.phase,
    manche: room.manche,
    theme: room.theme,
    hote: room.hote,
    joueurs,
    deck: room.deck,
    votes,
    moi: moi ? { id: moi.id, nom: moi.nom, hote: moi.id === room.hote, avancement: avancement(room, moi.id) } : null,
    /* Le classement n'est calculé qu'une fois les votes révélés : l'envoyer plus
       tôt, même à part, serait une fuite. */
    classement: revele ? classement(room).map(l => ({
      film: l.film, oui: l.oui.length, peut: l.peut.length, non: l.non.length,
      unanime: l.unanime, sansRefus: l.sansRefus, score: l.score,
      parJoueur: Object.fromEntries(room.joueurs.map(j => [j.id, room.votes[j.id]?.[l.film.key] || null]))
    })) : null,
    tousOntFini: tousOntFini(room)
  };
}

/* ── Le ménage ────────────────────────────────────────────────────────────── */

/** Les codes des rooms sans activité depuis trop longtemps. */
export function expirees(rooms, { now = Date.now(), vie = VIE_MS } = {}) {
  const mortes = [];
  for (const [code, room] of rooms) if (now - room.activite > vie) mortes.push(code);
  return mortes;
}

/** Une empreinte stable de l'état, pour ne pousser aux clients que du neuf. */
export function empreinte(vue) {
  return JSON.stringify([vue.phase, vue.manche, vue.deck.length,
    vue.joueurs.map(j => j.id + j.nom + j.avancement + (j.hote ? 'H' : '')).join('|'),
    Object.entries(vue.votes).map(([k, v]) => k + ':' + Object.entries(v || {}).map(([f, c]) => f + c).join(',')).join(';'),
    vue.tousOntFini]);
}

export { PROPRES };
