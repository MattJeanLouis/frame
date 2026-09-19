/**
 * Les règles d'une soirée, sans réseau et sans horloge implicite.
 *
 * Rien ici ne connaît HTTP, ni le DOM, ni Node : ce module décrit seulement ce
 * qu'est une soirée, comment on y entre, comment on y joue, et comment on
 * départage. C'est ce qui permet de l'éprouver pour de bon — un jeu à plusieurs
 * dont les règles ne sont pas testables est un jeu dont on découvre les bugs en
 * soirée, devant les invités.
 *
 * LE JEU — « Les Duels »
 *
 * La première version faisait voter tout le monde en même temps, chacun dans son
 * coin, sur douze films ; le classement tombait à la fin. C'était un sondage, pas
 * un jeu : personne ne vivait rien ensemble. Ici, deux affiches s'affrontent, le
 * groupe vote sur CES deux-là, et le résultat s'affiche tout de suite. On avance
 * duel après duel jusqu'à ce qu'il n'en reste qu'un. Chaque film appartient à
 * quelqu'un — celui qui l'a apporté — et ce nom apparaît au moment du verdict.
 *
 * Le vocabulaire :
 *   - une SOIRÉE a un code, des joueurs, un deck et une phase ;
 *   - le DECK est ce que les joueurs ont apporté ;
 *   - un DUEL oppose deux films ; chaque joueur désigne 'a' ou 'b' ;
 *   - le BILAN raconte ce qui s'est passé, une fois le tournoi fini.
 */

export const PHASES = ['lobby', 'duels', 'verdict'];

/** Assez pour un tournoi, pas assez pour une soirée entière. */
export const DECK_MIN = 4;
export const DECK_MAX = 12;
/** Ce que l'hôte pioche dans le catalogue quand il ne veut pas choisir. */
export const PIOCHER_DEFAUT = 8;
/** Le temps qu'on laisse au résultat d'un duel avant d'enchaîner : le moment
 *  qu'on commente ne doit pas disparaître aussitôt. */
export const PAUSE_DUEL_MS = 3200;
/** Au-delà, on considère que plus personne n'est là. */
export const VIE_MS = 6 * 60 * 60 * 1000;

/* ── Les clés ─────────────────────────────────────────────────────────────── */

/** Un film et une série peuvent partager un identifiant : le type fait la clé. */
export const cleFilm = film => (film.kind || 'movie') + ':' + film.id;

/** Un code de soirée : ni I, ni O, ni 0, ni 1 — on le dicte à voix haute. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codeAleatoire(tirage = Math.random) {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(tirage() * ALPHABET.length)];
  return out;
}

/** Ce qu'on accepte d'un code dicté : casse, espaces, « O » pour zéro, « I » pour un. */
export function normaliserCode(saisie) {
  return String(saisie || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .slice(0, 6);
}

/* ── La soirée ────────────────────────────────────────────────────────────── */

export function createRoom(code, { now = Date.now() } = {}) {
  return {
    code,
    phase: 'lobby',
    joueurs: [],
    hote: null,
    deck: [],
    tournoi: null,
    resoluLe: 0,
    theme: '',
    partis: [],
    cree: now,
    activite: now
  };
}

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
  if (!room.hote) room.hote = joueur.id;
  toucher(room, now);
  return joueur;
}

export function partir(room, id, { now = Date.now() } = {}) {
  const at = room.joueurs.findIndex(j => j.id === id);
  if (at < 0) return false;
  const partant = room.joueurs[at];
  room.joueurs.splice(at, 1);
  /* L'hôte s'en va : on passe la main au plus ancien plutôt que de laisser la
     soirée sans personne qui puisse lancer quoi que ce soit. */
  if (room.hote === id) room.hote = room.joueurs[0]?.id || null;

  if (!room.joueurs.length) {
    /* Plus personne : on remet tout à plat pour que le code resserve. */
    room.phase = 'lobby';
    room.deck = [];
    room.tournoi = null;
    return true;
  }

  /* Les films qu'il avait apportés restent — on ne réécrit pas le passé — mais
     ils n'ont plus de parrain, et ses votes sortent des duels en cours. */
  for (const film of room.deck) {
    if (film.parrain === id) { film.parrain = null; film.parrainNom = null; }
  }
  for (const tour of room.tournoi?.tours || []) {
    for (const duel of tour) delete duel.votes[id];
  }
  room.partis.push({ nom: partant.nom, quand: now });
  toucher(room, now);
  return true;
}

/* ── Le deck : ce que chacun apporte ──────────────────────────────────────── */

/** Le nombre de films qu'un joueur peut apporter. */
export const APPORTS_MAX = 3;

export const apportsDe = (room, joueurId) => room.deck.filter(f => f.parrain === joueurId).length;

/**
 * Ajouter un film au deck.
 *
 * N'importe quel film de TMDB, pas seulement ceux du catalogue affiché : c'est
 * la première chose qui manquait — on ne pouvait jouer que sur les quarante
 * films déjà à l'écran. Le film garde le nom de qui l'a apporté.
 */
export function apporter(room, film, joueur, { now = Date.now() } = {}) {
  if (room.phase !== 'lobby') return { erreur: 'La partie est lancée.' };
  const cle = film?.key || (film?.id != null ? cleFilm(film) : null);
  if (!cle) return { erreur: 'Ce film n’a pas d’identifiant.' };
  if (room.deck.some(f => f.key === cle)) return { erreur: 'Il est déjà sur la table.' };
  if (room.deck.length >= DECK_MAX) return { erreur: 'La table est pleine (' + DECK_MAX + ' films).' };
  if (joueur && apportsDe(room, joueur.id) >= APPORTS_MAX) {
    return { erreur: 'Tu as déjà apporté ' + APPORTS_MAX + ' films.' };
  }
  room.deck.push({
    key: cle,
    id: film.id,
    kind: film.kind || 'movie',
    title: String(film.title || '').slice(0, 120),
    year: String(film.year || (film.date || '').slice(0, 4) || '').slice(0, 4),
    poster: film.poster || film.poster_path || null,
    parrain: joueur?.id || null,
    parrainNom: joueur?.nom || null
  });
  toucher(room, now);
  return { ok: true };
}

/** Retirer un film : son parrain, ou l'hôte. */
export function retirer(room, cle, joueur, { now = Date.now() } = {}) {
  if (room.phase !== 'lobby') return { erreur: 'La partie est lancée.' };
  const at = room.deck.findIndex(f => f.key === cle);
  if (at < 0) return { erreur: 'Ce film n’est pas sur la table.' };
  const film = room.deck[at];
  if (film.parrain && film.parrain !== joueur?.id && room.hote !== joueur?.id) {
    return { erreur: 'C’est le film de quelqu’un d’autre.' };
  }
  room.deck.splice(at, 1);
  toucher(room, now);
  return { ok: true };
}

/** L'hôte pioche dans ce que le catalogue a sous les yeux. */
export function piocher(room, films, joueur, { now = Date.now() } = {}) {
  if (room.phase !== 'lobby') return { erreur: 'La partie est lancée.' };
  if (room.hote !== joueur?.id) return { erreur: 'Seul l’hôte pioche dans le catalogue.' };
  let ajoutes = 0;
  for (const f of films || []) {
    if (room.deck.length >= DECK_MAX) break;
    if (apporter(room, f, null, { now }).ok) ajoutes++;
  }
  toucher(room, now);
  return { ok: true, ajoutes };
}

/* ── Le tournoi ───────────────────────────────────────────────────────────── */

/**
 * L'ordre du tableau.
 *
 * Deux films apportés par la même personne ne doivent pas s'affronter au premier
 * tour : son film serait éliminé par le sien, et apporter quelque chose n'aurait
 * plus d'intérêt. On alterne donc les parrains, puis on apparie le premier avec
 * le dernier — les mieux « semés » rencontrent les moins semés.
 */
function ordonner(films) {
  const par = new Map();
  for (const f of films) {
    const k = f.parrainNom || '·';
    if (!par.has(k)) par.set(k, []);
    par.get(k).push(f);
  }
  /* Les plus gros apporteurs d'abord, pour les répartir au mieux. */
  const files = [...par.values()].sort((a, b) => b.length - a.length);
  const ordre = [];
  for (let i = 0; ordre.length < films.length; i++) {
    for (const file of files) if (file[i]) ordre.push(file[i]);
  }
  const paires = [];
  for (let i = 0; i < Math.floor(ordre.length / 2); i++) {
    paires.push([ordre[i], ordre[ordre.length - 1 - i]]);
  }
  const exempt = ordre.length % 2 ? ordre[Math.floor(ordre.length / 2)] : null;
  return { paires, exempt };
}

const duelNeuf = (a, b, exempt = false) => ({
  a: a?.key || null,
  b: b?.key || null,
  votes: {},
  gagnant: exempt ? (a?.key || null) : null,
  exempt
});

/** Bâtit le tournoi. Le deck doit tenir entre DECK_MIN et DECK_MAX. */
export function lancerTournoi(room, { now = Date.now(), theme = '' } = {}) {
  if (room.phase !== 'lobby') return false;
  if (room.deck.length < DECK_MIN) return false;
  if (room.joueurs.length < 2) return false;
  const { paires, exempt } = ordonner(room.deck.slice(0, DECK_MAX));
  const tour = paires.map(([a, b]) => duelNeuf(a, b));
  if (exempt) tour.push(duelNeuf(exempt, null, true));
  room.tournoi = { tours: [tour], tour: 0, index: 0, finaliste: null };
  room.phase = 'duels';
  room.resoluLe = 0;
  room.theme = String(theme || '').slice(0, 80);
  toucher(room, now);
  return true;
}

const filmDe = (room, cle) => room.deck.find(f => f.key === cle) || null;

/** Le duel en cours. */
export function duelCourant(room) {
  if (!room.tournoi) return null;
  const tour = room.tournoi.tours[room.tournoi.tour];
  return tour ? tour[room.tournoi.index] || null : null;
}

/** Tout le monde s'est prononcé sur ce duel. */
export const duelPret = room => {
  const duel = duelCourant(room);
  if (!duel || duel.exempt) return false;
  return room.joueurs.length > 0 && room.joueurs.every(j => duel.votes[j.id]);
};

/** Combien ont voté, et pour qui — sans dire qui. */
export function depouiller(room, duel) {
  let a = 0, b = 0;
  for (const j of room.joueurs) {
    const v = duel?.votes?.[j.id];
    if (v === 'a') a++;
    else if (v === 'b') b++;
  }
  return { a, b, exprimes: a + b, restants: Math.max(0, room.joueurs.length - a - b) };
}

/** Toutes les voix qu'un film a reçues depuis le début du tournoi. */
function voixRecues(room, cle) {
  let n = 0;
  for (const tour of room.tournoi?.tours || []) {
    for (const duel of tour) {
      if (duel.exempt) continue;
      for (const v of Object.values(duel.votes)) {
        if (v === 'a' && duel.a === cle) n++;
        else if (v === 'b' && duel.b === cle) n++;
      }
    }
  }
  return n;
}

export function voterDuel(room, joueurId, choix, { now = Date.now() } = {}) {
  if (room.phase !== 'duels') return false;
  if (!joueurDe(room, joueurId)) return false;
  if (choix !== 'a' && choix !== 'b') return false;
  const duel = duelCourant(room);
  if (!duel || duel.exempt || duel.gagnant) return false;
  duel.votes[joueurId] = choix;
  toucher(room, now);
  return true;
}

/**
 * Clore le duel en cours.
 *
 * À égalité, on ne tire pas au sort : on garde le film qui a le plus convaincu
 * depuis le début du tournoi. Une égalité au premier tour se départage donc par
 * l'ordre du tableau, ce qui est la seule chose qu'on sache encore de lui — et
 * c'est une règle qu'on peut expliquer à voix haute.
 */
export function resoudreDuel(room, { now = Date.now() } = {}) {
  const duel = duelCourant(room);
  if (!duel || duel.exempt || duel.gagnant) return false;
  const { a, b } = depouiller(room, duel);
  if (!a && !b) return false;
  duel.score = { a, b };
  if (a === b) {
    duel.egalite = true;
    duel.gagnant = voixRecues(room, duel.a) >= voixRecues(room, duel.b) ? duel.a : duel.b;
  } else {
    duel.gagnant = a > b ? duel.a : duel.b;
  }
  room.resoluLe = now;
  toucher(room, now);
  return true;
}

/**
 * Passer au duel suivant. Construit le tour suivant quand le tour est fini, et
 * le verdict quand il ne reste qu'un film.
 */
export function avancer(room, { now = Date.now() } = {}) {
  if (room.phase !== 'duels' || !room.tournoi) return false;
  const tour = room.tournoi.tours[room.tournoi.tour];
  /* On traverse les exempts : ils sont déjà résolus, ils ne se jouent pas. */
  while (room.tournoi.index < tour.length && tour[room.tournoi.index].gagnant) room.tournoi.index++;
  if (room.tournoi.index < tour.length) return true;

  const gagnants = tour.map(d => d.gagnant).filter(Boolean);
  if (gagnants.length <= 1) {
    room.tournoi.finaliste = gagnants[0] || null;
    room.phase = 'verdict';
    toucher(room, now);
    return true;
  }
  const films = gagnants.map(cle => filmDe(room, cle)).filter(Boolean);
  const { paires, exempt } = ordonner(films);
  const suivant = paires.map(([a, b]) => duelNeuf(a, b));
  if (exempt) suivant.push(duelNeuf(exempt, null, true));
  room.tournoi.tours.push(suivant);
  room.tournoi.tour++;
  room.tournoi.index = 0;
  room.resoluLe = 0;
  toucher(room, now);
  return true;
}

export function retourAuLobby(room, { now = Date.now() } = {}) {
  room.phase = 'lobby';
  room.tournoi = null;
  room.resoluLe = 0;
  room.theme = '';
  toucher(room, now);
  return true;
}

/** Une nouvelle partie avec le MÊME deck : on garde ce que chacun a apporté. */
export function rejouer(room, { now = Date.now() } = {}) {
  if (room.phase !== 'verdict') return false;
  /* Il faut repasser par le lobby : `lancerTournoi` refuse de s'ouvrir ailleurs
     qu'au lobby, et sans cette ligne « Rejouer » ne faisait rien du tout. */
  const theme = room.theme;
  retourAuLobby(room, { now });
  return lancerTournoi(room, { now, theme });
}

/* ── Le bilan ─────────────────────────────────────────────────────────────── */

/**
 * Ce que la soirée a raconté.
 *
 * Un gagnant seul ne dit rien du groupe. On garde donc aussi les deux extrêmes —
 * le duel qui a le plus divisé et celui qui a mis tout le monde d'accord — et
 * combien de duels se sont joués à une voix. C'est ce qu'on commente après coup.
 */
export function bilan(room) {
  const duels = [];
  for (const tour of room.tournoi?.tours || []) {
    for (const duel of tour) {
      if (duel.exempt || !duel.gagnant) continue;
      duels.push({
        a: duel.a, b: duel.b, gagnant: duel.gagnant,
        score: duel.score || { a: 0, b: 0 },
        ecart: Math.abs((duel.score?.a || 0) - (duel.score?.b || 0)),
        total: (duel.score?.a || 0) + (duel.score?.b || 0),
        egalite: Boolean(duel.egalite)
      });
    }
  }
  const avecEcart = duels.filter(d => d.total > 0);
  const plusDivisant = avecEcart.slice().sort((x, y) => (x.ecart - y.ecart) || (y.total - x.total))[0] || null;
  const plusNet = avecEcart.slice().sort((x, y) => (y.ecart - x.ecart) || (y.total - x.total))[0] || null;
  return {
    duels,
    joues: duels.length,
    serres: avecEcart.filter(d => d.ecart <= 1).length,
    plusDivisant,
    plusNet,
    gagnant: room.tournoi?.finaliste ? filmDe(room, room.tournoi.finaliste) : null,
    /* Le film qui a mené le plus longtemps : celui qui a reçu le plus de voix au
     * total, même s'il n'a pas gagné. Souvent le préféré de la soirée. */
    plusSoutenu: room.deck
      .map(f => ({ film: f, voix: voixRecues(room, f.key) }))
      .sort((a, b) => b.voix - a.voix)[0] || null
  };
}

/* ── Ce que chacun a le droit de voir ─────────────────────────────────────── */

/**
 * L'état d'une soirée, filtré pour un joueur.
 *
 * Pendant un duel, PERSONNE ne voit les votes des autres avant le dépouillement
 * — c'est tout l'intérêt du jeu : découvrir que le film qu'on croyait évident
 * était celui que son voisin détestait. On ne renvoie donc que le nombre de
 * votants. Le filtre est ici, dans la logique testée, et non dans l'interface :
 * c'est une règle, pas une politesse.
 */
export function vuePour(room, joueurId) {
  const moi = joueurDe(room, joueurId);
  const duel = duelCourant(room);
  const resolu = Boolean(duel?.gagnant);
  const fini = room.phase === 'verdict';

  const joueurs = room.joueurs.map(j => ({
    id: j.id,
    nom: j.nom,
    hote: j.id === room.hote,
    apports: apportsDe(room, j.id),
    aVote: Boolean(duel && !duel.exempt && duel.votes[j.id])
  }));

  /* Le détail nominatif n'existe qu'une fois le duel clos. Jamais avant. */
  const votesDuel = {};
  if (duel && !duel.exempt && resolu) for (const j of room.joueurs) votesDuel[j.id] = duel.votes[j.id] || null;

  return {
    code: room.code,
    phase: room.phase,
    theme: room.theme,
    hote: room.hote,
    joueurs,
    deck: room.deck,
    limites: { min: DECK_MIN, max: DECK_MAX, apports: APPORTS_MAX },
    moi: moi ? { id: moi.id, nom: moi.nom, hote: moi.id === room.hote, apports: apportsDe(room, moi.id) } : null,
    /* Le duel en cours : les deux films, mon vote, et le dépouillement seulement
       s'il est clos. */
    duel: duel && !duel.exempt ? {
      a: duel.a, b: duel.b,
      filmA: filmDe(room, duel.a), filmB: filmDe(room, duel.b),
      monVote: moi ? duel.votes[moi.id] || null : null,
      resolu,
      gagnant: duel.gagnant || null,
      egalite: Boolean(duel.egalite),
      score: resolu ? (duel.score || depouiller(room, duel)) : null,
      votants: depouiller(room, duel).exprimes,
      votes: resolu ? votesDuel : null
    } : null,
    avancement: room.tournoi ? {
      tour: room.tournoi.tour + 1,
      tours: room.tournoi.tours.length,
      index: room.tournoi.index + 1
    } : null,
    /* Le tableau : les duels déjà joués, pour voir le chemin parcouru. */
    tableau: room.tournoi ? room.tournoi.tours.map((t, i) => ({
      tour: i + 1,
      duels: t.filter(d => !d.exempt).map(d => ({
        a: d.a, b: d.b, gagnant: d.gagnant, score: d.score || null,
        titreA: filmDe(room, d.a)?.title || null, titreB: filmDe(room, d.b)?.title || null
      }))
    })) : [],
    pret: duelPret(room),
    bilan: fini ? bilan(room) : null
  };
}

/* ── Le ménage ────────────────────────────────────────────────────────────── */

export function expirees(rooms, { now = Date.now(), vie = VIE_MS } = {}) {
  const mortes = [];
  for (const [code, room] of rooms) if (now - room.activite > vie) mortes.push(code);
  return mortes;
}

/** Une empreinte stable de l'état, pour ne pousser aux clients que du neuf. */
export function empreinte(vue) {
  return JSON.stringify([
    vue.phase,
    vue.deck.map(f => f.key + (f.parrain || '')).join('|'),
    vue.joueurs.map(j => j.id + j.nom + j.apports + (j.hote ? 'H' : '') + (j.aVote ? 'V' : '')).join('|'),
    vue.duel ? [vue.duel.a, vue.duel.b, vue.duel.resolu, vue.duel.gagnant, vue.duel.votants, vue.duel.monVote].join(':') : '',
    vue.avancement ? vue.avancement.tour + '/' + vue.avancement.index : '',
    vue.pret
  ]);
}
