/**
 * LES GENS ET LES SOCIÉTÉS.
 *
 * Une filmographie n'est PAS une recherche : c'est une liste finie, complète,
 * et déjà datée. TMDB la donne d'un seul coup, dans `/person/{id}/movie_credits`
 * et `/person/{id}/tv_credits`, avec pour chaque titre son affiche, ses genres,
 * sa note et son année. Une requête, toute l'œuvre.
 *
 * POURQUOI ON NE PASSE PAS PAR `discover`, et c'est mesuré :
 *
 *   - `with_crew` **ne distingue pas le métier**. Christophe Nolan a 19 credits
 *     de réalisateur et 15 de producteur ; `with_crew=525` en renvoie 31 — les
 *     deux mélangés. Un producteur comme Kathleen Kennedy (79 films produits,
 *     zéro réalisé) ressort exactement comme un réalisateur.
 *   - `with_crew` est **purement ignoré sur `/discover/tv`**. Trois personnes
 *     différentes — Vince Gilligan, Christopher Nolan, un identifiant qui
 *     n'existe pas — renvoient le même total : 20 001, c'est-à-dire tout.
 *
 * Le métier vient donc des crédits eux-mêmes, où `job` est écrit noir sur
 * blanc. C'est exact, et ça ne coûte qu'une requête par personne.
 *
 * POURQUOI LES SOCIÉTÉS SONT TRIÉES, et c'est mesuré aussi : la recherche
 * « a24 » renvoie TROIS sociétés nommées A24 — 0 film, 1 film, et 176 films.
 * TMDB les classe sans rapport avec ce qu'elles contiennent. Choisir la
 * première donnerait un mur vide sans que rien ne l'explique.
 */

/** Les rôles qu'on peut demander à une personne. */
export const ROLES = [
  { id: 'realisation', label: 'Réalisation', dit: 'Films réalisés, séries créées.', emoji: '🎬' },
  { id: 'production', label: 'Production', dit: 'Films et séries produits.', emoji: '💼' },
  { id: 'jeu', label: 'Jeu', dit: 'Rôles à l’écran.', emoji: '🎭' }
];

export const roleValide = id => ROLES.some(r => r.id === id) ? id : 'realisation';
export const libelleRole = id => ROLES.find(r => r.id === id)?.label || id;

/**
 * Le métier d'une entrée de crédit, ramené à nos trois rôles. `null` si
 * l'entrée ne nous intéresse pas.
 *
 * En série, « réalisateur » n'existe pas vraiment : une série a des réalisateurs
 * d'épisodes, mais celui qui la porte s'appelle le créateur. C'est ce que
 * l'application affiche déjà dans une fiche — « Création » — et on garde le
 * même mot ici.
 */
export function roleDe(job, kind) {
  const metier = String(job || '').toLowerCase();
  if (!metier) return null;
  if (kind === 'tv') {
    if (metier === 'creator') return 'realisation';
  } else if (metier === 'director') return 'realisation';
  /* « Producer », « Executive Producer », « Co-Producer », « Associate
     Producer », « Supervising Producer » : tous des métiers de production. */
  if (metier.includes('producer')) return 'production';
  return null;
}

/**
 * Les crédits d'une personne, filtrés sur un rôle, dans la forme que
 * l'application sait déjà lire.
 *
 * On garde les entrées telles quelles : elles portent déjà `id`, `title` ou
 * `name`, `release_date` ou `first_air_date`, `genre_ids`, `poster_path`,
 * `vote_average`, `popularity` — exactement ce que `normalize()` attend.
 */
export function creditsPourRole(donnees, role, kind) {
  const liste = role === 'jeu'
    ? (donnees?.cast || [])
    : (donnees?.crew || []).filter(c => roleDe(c.job, kind) === role);
  /* Un même film peut porter deux fois la même personne dans l'équipe
     (réalisateur ET producteur) : on ne le montre qu'une fois. */
  const vus = new Set();
  return liste.filter(x => {
    const cle = x.id;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/** Le nombre de titres qu'une personne a vraiment dans un rôle donné. */
export function comptePourRole(donnees, role, kind) {
  return creditsPourRole(donnees, role, kind).length;
}

/* --- Les sociétés --------------------------------------------------------- */

/**
 * Classer les sociétés trouvées par ce qu'elles CONTIENNENT.
 *
 * `compte` est le nombre de titres mesuré pour chacune. Une société sans titre
 * n'est pas forcément fausse — c'est souvent une coquille créée par TMDB — mais
 * elle ne doit jamais passer devant celle qui en a 176.
 */
export function classerSocietes(societes) {
  return [...(societes || [])].sort((a, b) => {
    const n = (b.compte ?? -1) - (a.compte ?? -1);
    if (n) return n;
    return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
  });
}

/** Ce qu'on écrit sur une pastille de société. */
export function libelleSociete(s) {
  const n = s?.compte;
  if (n === undefined || n === null) return s?.nom || '';
  if (n === 0) return s.nom + ' — aucun titre';
  return s.nom + ' — ' + n.toLocaleString('fr-FR') + (n > 1 ? ' titres' : ' titre');
}

/**
 * Une société sans aucun titre ne peut pas être choisie : elle ne remplirait
 * pas la promesse de la pastille. On les garde visibles, rayées, parce que
 * les cacher ferait croire que la recherche n'a rien trouvé.
 */
export const societeUtilisable = s => (s?.compte ?? 0) > 0;

/** Une chaîne de télévision ne diffuse pas des films : `with_networks` est un
    filtre de série, et l'annoncer autrement serait un mensonge. */
export const TYPE_SOCIETE = [
  { id: 'studio', label: 'Studio', dit: 'Société de production.', emoji: '🏢' },
  { id: 'chaine', label: 'Chaîne', dit: 'Diffuseur — séries seulement.', emoji: '📡' }
];

export const typeSocieteValide = id => (id === 'chaine' ? 'chaine' : 'studio');
