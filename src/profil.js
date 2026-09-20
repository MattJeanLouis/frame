/**
 * Le profil, et la synchronisation entre appareils.
 *
 * Rien ici ne connaît le réseau ni le DOM : ce module décrit ce qu'est un
 * profil, comment on fabrique un code, et surtout comment on FUSIONNE deux
 * appareils qui ont divergé. C'est la partie qui peut silencieusement perdre des
 * données, donc c'est la partie qu'on éprouve.
 *
 * POURQUOI PAS DE MOT DE PASSE
 *
 * Un compte demanderait une base, du hachage, des sessions, un service d'e-mail
 * pour la vérification et la réinitialisation, et de la sécurité écrite à la
 * main. Pour un carnet de films personnel, le jeu n'en vaut pas la chandelle.
 *
 * Le profil est donc un simple document rangé sous un CODE LONG — douze signes
 * tirés dans un alphabet de 32, soit 32¹² ≈ 10¹⁸ combinaisons. Ce n'est pas un
 * mot de passe : c'est une clé de coffre, et on ne demande à personne de la
 * retenir — on la copie une fois, de l'autre côté.
 *
 * LA RÈGLE DE FUSION
 *
 * Le plus récent gagne, FILM PAR FILM, et non « l'appareil A écrase l'appareil
 * B ». Sans cela, marquer un film sur le téléphone puis un autre sur
 * l'ordinateur en perdrait un. On garde donc un horodatage par film ET par
 * nature, ce qui permet aussi d'enregistrer une SUPPRESSION : une clé
 * horodatée sans valeur veut dire « effacé, et plus récemment que l'autre ».
 */

export const VERSION = 1;

/** Ni I, ni O, ni 0, ni 1 : un code se lit à voix haute et se recopie à la main. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 12;
export const GROUPES = 4;

const NATURES = ['marque', 'avis', 'commentaire', 'film'];

/* ── Le code ──────────────────────────────────────────────────────────────── */

export function codeProfil(tirage = Math.random) {
  let brut = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) brut += ALPHABET[Math.floor(tirage() * ALPHABET.length)];
  return brut.replace(new RegExp('(.{' + GROUPES + '})', 'g'), '$1-').replace(/-$/, '');
}

/** Les signes utiles d'un code recopié : casse, espaces et tirets rangés,
 *  « O » pour zéro, « I » pour un. */
const signes = saisie => String(saisie || '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')
  .replace(/O/g, '0')
  .replace(/I/g, '1');

export const normaliserCode = saisie => signes(saisie).slice(0, LONGUEUR_CODE);

/**
 * Un code est valide quand il fait EXACTEMENT douze signes.
 *
 * On ne tronque pas : un code trop long est une faute de frappe, et la tronquer
 * en silence mènerait à un AUTRE profil valide — celui de quelqu'un d'autre. Un
 * refus vaut mieux qu'une synchronisation avec un inconnu.
 */
export const codeValide = saisie => signes(saisie).length === LONGUEUR_CODE;

/** La forme lisible : ABCD-EFGH-JKLM. */
export function codeLisible(saisie) {
  return normaliserCode(saisie).replace(new RegExp('(.{' + GROUPES + '})(?=.)', 'g'), '$1-');
}

/* ── Les clés ─────────────────────────────────────────────────────────────── */

export const cleHorodatage = (nature, film) => nature + ':' + film;
export const estNature = nature => NATURES.includes(nature);

/* ── Fabriquer un document à partir de l'état local ───────────────────────── */

/**
 * @param etat  { reactions, marks, comments, films, horodatages }
 * @param profil { nom, avatar, cree }
 */
export function documentDe(etat, profil = {}, maintenant = Date.now()) {
  return {
    version: VERSION,
    modifie: maintenant,
    profil: { nom: String(profil.nom || '').slice(0, 40), avatar: String(profil.avatar || '').slice(0, 8) },
    horodatages: { ...(etat.horodatages || {}) },
    marques: { ...(etat.marks || {}) },
    avis: { ...(etat.reactions || {}) },
    commentaires: { ...(etat.comments || {}) },
    films: { ...(etat.films || {}) }
  };
}

/* ── Fusionner deux documents ─────────────────────────────────────────────── */

const BAC = { marque: 'marques', avis: 'avis', commentaire: 'commentaires', film: 'films' };

/** Un document vide, prêt à recevoir une fusion. */
export function documentVide() {
  return { version: VERSION, modifie: 0, profil: {}, horodatages: {}, marques: {}, avis: {}, commentaires: {}, films: {} };
}

/** Le document est-il exploitable ? Un fichier venu du réseau n'est pas de confiance. */
export function estDocument(doc) {
  /* `Boolean(...)` autour de tout : une chaîne de `&&` renvoie le dernier terme
     truthy, pas `true` — donc `estDocument(doc) === true` était faux, et un test
     qui compare à `true` échouait pour une bonne raison. */
  return Boolean(
    doc && typeof doc === 'object' && doc.version === VERSION &&
    doc.horodatages && typeof doc.horodatages === 'object' &&
    doc.marques && doc.avis && doc.commentaires && doc.films
  );
}

/**
 * Fusionne deux documents. Le plus récent gagne, film par film et nature par
 * nature ; une clé horodatée sans valeur est une suppression, et elle gagne si
 * elle est la plus récente.
 */
export function fusionner(a, b) {
  const A = estDocument(a) ? a : documentVide();
  const B = estDocument(b) ? b : documentVide();
  const out = documentVide();

  const cles = new Set([...Object.keys(A.horodatages), ...Object.keys(B.horodatages)]);
  for (const cle of cles) {
    const ta = Number(A.horodatages[cle]) || 0;
    const tb = Number(B.horodatages[cle]) || 0;
    const gagnant = ta >= tb ? A : B;
    out.horodatages[cle] = Math.max(ta, tb);

    const coupe = cle.indexOf(':');
    const nature = cle.slice(0, coupe);
    const film = cle.slice(coupe + 1);
    if (!estNature(nature) || !film) continue;

    const bac = BAC[nature];
    const valeur = gagnant[bac]?.[film];
    if (valeur === undefined) continue;   // suppression : on ne remet rien
    out[bac][film] = valeur;
  }

  /* Les entrées sans horodatage — documents d'une version antérieure, ou
     fabriqués à la main — sont conservées plutôt que perdues. */
  for (const nature of NATURES) {
    const bac = BAC[nature];
    for (const [film, valeur] of Object.entries(A[bac] || {})) {
      if (out[bac][film] === undefined && !(cleHorodatage(nature, film) in out.horodatages)) out[bac][film] = valeur;
    }
    for (const [film, valeur] of Object.entries(B[bac] || {})) {
      if (out[bac][film] === undefined && !(cleHorodatage(nature, film) in out.horodatages)) out[bac][film] = valeur;
    }
  }

  /* Le profil : le plus récent des deux, champ par champ, sans écraser un nom
     par un vide. */
  out.profil = { ...A.profil, ...B.profil };
  for (const champ of ['nom', 'avatar']) {
    if (!out.profil[champ]) out.profil[champ] = A.profil?.[champ] || B.profil?.[champ] || '';
  }
  out.modifie = Math.max(Number(A.modifie) || 0, Number(B.modifie) || 0);
  return out;
}

/** Ce qu'il faut réécrire dans l'état local après une fusion. */
export function etatDe(doc) {
  const d = estDocument(doc) ? doc : documentVide();
  return {
    reactions: { ...d.avis },
    marks: { ...d.marques },
    comments: { ...d.commentaires },
    mesFilms: { ...d.films },
    horodatages: { ...d.horodatages }
  };
}

/* ── La liste publique ────────────────────────────────────────────────────── */

/**
 * Ce qu'on accepte de montrer, et RIEN d'autre.
 *
 * C'est une liste BLANCHE, pas un retrait. La différence compte : si j'écris
 * « enlève les commentaires », le jour où j'ajoute un champ au document privé il
 * part en ligne sans que personne ne s'en aperçoive. En énumérant ce qui SORT,
 * un champ nouveau reste privé par défaut.
 *
 * On ne garde donc que de quoi dessiner une affiche et la nommer : ni résumé, ni
 * mots-clés, ni commentaire, ni signature, ni le détail de ce qu'on a ressenti.
 */
const CHAMPS_PUBLICS = ['id', 'kind', 'title', 'date', 'poster_path', 'vote_average', 'genre_ids', 'at'];

export function listePublique(doc, profil = {}) {
  const d = estDocument(doc) ? doc : documentVide();
  const titres = {};
  for (const [cle, film] of Object.entries(d.films)) {
    const etat = d.marques[cle];
    /* Sans état, un film n'est pas dans la liste : il n'y a rien à montrer. */
    if (!etat || !film) continue;
    const public_ = { etat };
    for (const champ of CHAMPS_PUBLICS) if (film[champ] !== undefined) public_[champ] = film[champ];
    titres[cle] = public_;
  }
  return {
    version: VERSION,
    modifie: Number(d.modifie) || 0,
    profil: {
      nom: String(profil.nom || d.profil?.nom || '').slice(0, 40),
      avatar: String(profil.avatar || d.profil?.avatar || '').slice(0, 8)
    },
    titres
  };
}

export const estListe = doc => Boolean(
  doc && typeof doc === 'object' && doc.version === VERSION &&
  doc.titres && typeof doc.titres === 'object' && doc.profil
);

/** Les six états, dans l'ordre où on veut les lire : ce qu'on veut voir d'abord. */
export const ORDRE_ETATS = ['want', 'watching', 'seen', 'ok', 'love', 'nope'];

/**
 * La liste rangée : un groupe par état, et dans chaque groupe le plus récent
 * d'abord. C'est ce que « organiser » veut dire — pas une soupe alphabétique.
 */
export function ranger(liste, { etat = null, recherche = '', tri = 'recent' } = {}) {
  const titres = liste?.titres || {};
  const mot = fold(recherche);
  const groupes = [];
  for (const id of ORDRE_ETATS) {
    if (etat && id !== etat) continue;
    const films = Object.entries(titres)
      .filter(([, f]) => f.etat === id)
      .map(([cle, f]) => ({ cle, ...f }))
      .filter(f => !mot || fold(f.title).includes(mot));
    if (!films.length) continue;
    groupes.push({ etat: id, films: trierFilms(films, tri) });
  }
  return groupes;
}

const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const COMPARER = {
  recent: (a, b) => (b.at || 0) - (a.at || 0),
  ancien: (a, b) => (a.at || 0) - (b.at || 0),
  alpha: (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr'),
  note: (a, b) => (b.vote_average || 0) - (a.vote_average || 0),
  date: (a, b) => String(b.date || '').localeCompare(String(a.date || ''))
};

export const trierFilms = (films, tri = 'recent') => [...films].sort(COMPARER[tri] || COMPARER.recent);

/* ── Emporter et rapporter ────────────────────────────────────────────────── */

/**
 * Le fichier qu'on télécharge.
 *
 * C'est la seule sauvegarde qui ne dépend de personne : ni d'un serveur, ni d'un
 * navigateur, ni d'un code. C'est aussi ce qui permet de passer d'une adresse à
 * une autre — `localhost` et le site publié sont deux stockages DIFFÉRENTS, et
 * sans fichier il n'y a aucun pont entre les deux.
 */
export function versFichier(doc) {
  const d = estDocument(doc) ? doc : documentVide();
  return JSON.stringify({ application: 'FRAME', version: VERSION, exporte: new Date().toISOString(), doc: d }, null, 2);
}

/** Relire un fichier emporté. On refuse poliment ce qui n'en est pas un. */
export function depuisFichier(texte) {
  let brut;
  try { brut = JSON.parse(texte); } catch { return { erreur: 'Ce fichier n’est pas du JSON.' }; }
  const doc = brut?.doc && estDocument(brut.doc) ? brut.doc : (estDocument(brut) ? brut : null);
  if (!doc) return { erreur: 'Ce fichier ne vient pas de What the Flick (anciennement FRAME), ou vient d’une version inconnue.' };
  return { doc };
}

/** Ce que la fusion a apporté — pour pouvoir le dire à l'écran. */
export function differences(avant, apres) {
  const compte = (a, b) => Object.keys(b).filter(cle => JSON.stringify(a?.[cle]) !== JSON.stringify(b?.[cle])).length;
  return {
    marques: compte(avant.marks, apres.marks),
    avis: compte(avant.reactions, apres.reactions),
    commentaires: compte(avant.comments, apres.comments),
    films: compte(avant.mesFilms, apres.mesFilms)
  };
}
