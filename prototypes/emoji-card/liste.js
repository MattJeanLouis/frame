/**
 * Ma liste, organisée.
 *
 * Une pastille de filtre ne suffit pas à organiser cent films : « Ma liste »
 * était un tri parmi d'autres sur le mur, pas un endroit. Ici c'est un endroit —
 * groupé par état, triable, cherchable, et fait pour être parcouru.
 *
 * Le même écran sert à deux choses :
 *   - chez soi, sur son appareil, avec ce qu'on a marqué ;
 *   - en lecture seule, quand quelqu'un ouvre un lien de partage.
 *
 * Ce qui change entre les deux n'est pas la mise en page mais la SOURCE : d'un
 * côté le stockage local, de l'autre un document public qui ne contient que des
 * affiches et des états. Les commentaires et les avis n'y sont pas — pas parce
 * qu'on les cache, parce qu'ils n'ont jamais été envoyés.
 */
import { listePublique, ranger, trierFilms, estListe, ORDRE_ETATS } from '../../src/profil.js';

const RELAIS = '/.netlify/functions/liste';
const POSTER = 'https://image.tmdb.org/t/p/';

const NOMS_ETATS = {
  want: 'À voir', watching: 'En cours', seen: 'Vu',
  ok: 'Ok', love: 'J’adore', nope: 'Pas aimé'
};
const SIGNES_ETATS = { want: '🎟️', watching: '▶️', seen: '👁️', ok: '🙂', love: '❤️', nope: '🙁' };

const TRIS = [
  ['recent', 'Ajoutés récemment'],
  ['ancien', 'Ajoutés il y a longtemps'],
  ['alpha', 'A → Z'],
  ['note', 'Les mieux notés'],
  ['date', 'Les plus récents']
];

let deps = { etat: () => ({}), profil: () => ({}), retirer: () => { }, annoncer: () => { }, completer: null };
let racine = null;
let etat = {
  public: null,      // la liste reçue par un lien de partage
  lecture: false,    // vrai quand on regarde la liste de quelqu'un d'autre
  nom: '', avatar: '',
  etatChoisi: null,
  recherche: '',
  tri: 'recent',
  occupe: false,
  erreur: '',
  /* Les clés dont on n'a pas la fiche : on va les rechercher. */
  manquants: [],
  completEnCours: false
};

/* ── D'où vient la liste ──────────────────────────────────────────────────── */

/** Chez soi : on fabrique la liste publique à partir de l'état local, et on
 *  l'affiche. Le même objet que celui qu'on publierait — donc ce qu'on voit est
 *  exactement ce que les autres verraient. */
/**
 * Les films marqués dont on n'a PAS la fiche.
 *
 * Une marque n'est qu'une clé ; pour dessiner une affiche il faut le titre et le
 * chemin de l'affiche. Or les marques peuvent dater d'avant qu'on garde les
 * fiches — et dans ce cas elles apparaissaient dans le catalogue mais PAS dans
 * la liste, comme perdues. On va donc les rechercher.
 */
function manquants() {
  const local = deps.etat();
  return Object.keys(local.marks || {}).filter(cle => !local.films?.[cle]);
}

async function completerLesManquants() {
  if (etat.completEnCours || !deps.completer) return;
  const cles = manquants();
  if (!cles.length) return;
  etat.completEnCours = true;
  etat.manquants = cles;
  dessiner();
  try {
    await deps.completer(cles);
  } catch { /* on redessine ce qu'on a, sans bloquer la liste */ }
  etat.completEnCours = false;
  etat.manquants = [];
  dessiner();
}

function maListe() {
  const local = deps.etat();
  return listePublique({
    version: 1, modifie: Date.now(), profil: deps.profil(),
    marques: local.marks || {}, films: local.films || {},
    avis: {}, commentaires: {}, horodatages: {}
  }, deps.profil());
}

const listeAffichee = () => etat.public || maListe();

/* ── Le réseau ────────────────────────────────────────────────────────────── */

async function chargerPublique(code) {
  etat.occupe = true; etat.erreur = '';
  dessiner();
  try {
    let r;
    try { r = await fetch(RELAIS + '?code=' + encodeURIComponent(code)); }
    catch { throw new Error('Le serveur ne répond pas. Un lien de partage a besoin d’Internet.'); }
    const données = await r.json().catch(() => null);
    if (!r.ok) throw new Error(données?.erreur || ('Le serveur a répondu ' + r.status));
    if (!données?.liste) throw new Error('Cette liste n’existe pas — ou n’a pas encore été publiée.');
    if (!estListe(données.liste)) throw new Error('Cette liste est illisible.');
    etat.public = données.liste;
    etat.lecture = true;
  } catch (e) { etat.erreur = e.message; }
  finally { etat.occupe = false; dessiner(); }
}

/* ── Les petits outils ────────────────────────────────────────────────────── */

const h = (balise, classe, texte) => {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (texte != null) n.textContent = texte;
  return n;
};

function bouton(classe, texte, action, { desactive = false } = {}) {
  const b = h('button', classe, texte);
  b.type = 'button';
  b.disabled = desactive;
  if (action) b.addEventListener('click', action);
  return b;
}

const vignette = (film, taille = 'w185') => {
  const img = h('img', 'liste__affiche');
  img.alt = '';
  img.loading = 'lazy';
  if (film.poster_path) img.src = POSTER + taille + film.poster_path;
  else img.classList.add('liste__affiche--vide');
  return img;
};

/* ── Le dessin ────────────────────────────────────────────────────────────── */

function dessiner() {
  if (!racine || racine.hidden) return;
  const enveloppe = h('div', 'liste');
  const liste = listeAffichee();
  const total = Object.keys(liste?.titres || {}).length;

  /* ── La barre ── */
  const barre = h('div', 'liste__barre');
  barre.append(h('span', 'liste__marque', etat.lecture ? 'UNE LISTE' : 'MA LISTE'));
  const fermer = bouton('liste__fermer', '✕');
  fermer.setAttribute('aria-label', 'Fermer la liste');
  fermer.addEventListener('click', () => fermerListe());
  barre.append(fermer);
  enveloppe.append(barre);

  if (etat.erreur) {
    const a = h('p', 'liste__alerte', etat.erreur);
    a.setAttribute('role', 'alert');
    enveloppe.append(a);
    return void racine.replaceChildren(enveloppe);
  }

  /* ── Le titre ── */
  const tete = h('header', 'liste__tete');
  if (etat.lecture && liste?.profil) {
    const figure = h('span', 'liste__avatar', liste.profil.avatar || '🎬');
    figure.setAttribute('aria-hidden', 'true');
    tete.append(figure);
  }
  const titre = h('div');
  titre.append(h('h1', 'liste__titre', etat.lecture
    ? 'La liste de ' + (liste?.profil?.nom || 'quelqu’un')
    : 'Ma liste'));
  titre.append(h('p', 'liste__compte', total
    ? total + ' titre' + (total > 1 ? 's' : '')
    : 'Rien encore'));
  tete.append(titre);
  enveloppe.append(tete);

  /* Des marques sans fiche : on le dit, et on va les chercher. */
  if (!etat.lecture && etat.completEnCours) {
    enveloppe.append(h('p', 'liste__note', 'On retrouve ' + etat.manquants.length +
      ' film' + (etat.manquants.length > 1 ? 's' : '') + ' marqué' + (etat.manquants.length > 1 ? 's' : '') +
      ' dont on n’avait pas gardé la fiche…'));
  }

  if (!total) {
    enveloppe.append(h('p', 'liste__note', etat.lecture
      ? 'Cette liste est vide.'
      : 'Ta liste est vide. Ouvre un film et donne-lui un état — à voir, vu, aimé — il t’attendra ici.'));
  } else {
    /* ── Les commandes ── */
    enveloppe.append(barreCommandes(liste));
    /* ── Les groupes ── */
    const groupes = ranger(liste, { etat: etat.etatChoisi, recherche: etat.recherche, tri: etat.tri });
    if (!groupes.length) {
      enveloppe.append(h('p', 'liste__note', 'Rien avec ces mots. Essaie un autre titre, ou retire le filtre.'));
    }
    for (const groupe of groupes) enveloppe.append(blocGroupe(groupe));
  }

  racine.replaceChildren(enveloppe);
}

function barreCommandes(liste) {
  const zone = h('div', 'liste__commandes');

  /* Les états, avec leur nombre : c'est ce qui organise. */
  const puces = h('div', 'liste__etats');
  puces.setAttribute('role', 'group');
  puces.setAttribute('aria-label', 'Filtrer par état');
  const compte = id => Object.values(liste.titres).filter(f => f.etat === id).length;
  puces.append(bouton('liste__puce' + (etat.etatChoisi === null ? ' est-choisi' : ''),
    'Tout · ' + Object.keys(liste.titres).length, () => { etat.etatChoisi = null; dessiner(); }));
  for (const id of ORDRE_ETATS) {
    const n = compte(id);
    if (!n) continue;
    const b = bouton('liste__puce' + (etat.etatChoisi === id ? ' est-choisi' : ''),
      SIGNES_ETATS[id] + ' ' + NOMS_ETATS[id] + ' · ' + n,
      () => { etat.etatChoisi = etat.etatChoisi === id ? null : id; dessiner(); });
    b.setAttribute('aria-pressed', String(etat.etatChoisi === id));
    puces.append(b);
  }
  zone.append(puces);

  const ligne = h('div', 'liste__ligne-commandes');

  const cherche = h('input');
  cherche.type = 'search';
  cherche.className = 'liste__recherche';
  cherche.placeholder = 'Chercher dans la liste…';
  cherche.value = etat.recherche;
  cherche.setAttribute('aria-label', 'Chercher dans la liste');
  cherche.addEventListener('input', () => {
    etat.recherche = cherche.value;
    dessiner();
    const neuf = racine.querySelector('.liste__recherche');
    if (neuf) { neuf.focus(); neuf.setSelectionRange(neuf.value.length, neuf.value.length); }
  });
  ligne.append(cherche);

  const tri = h('select');
  tri.className = 'liste__tri';
  tri.setAttribute('aria-label', 'Trier la liste');
  for (const [valeur, nom] of TRIS) {
    const option = h('option', null, nom);
    option.value = valeur;
    option.selected = etat.tri === valeur;
    tri.append(option);
  }
  tri.addEventListener('change', () => { etat.tri = tri.value; dessiner(); });
  ligne.append(tri);

  zone.append(ligne);
  return zone;
}

function blocGroupe(groupe) {
  const bloc = h('section', 'liste__groupe');
  const tete = h('h2', 'liste__groupe-titre');
  tete.append(h('span', 'liste__groupe-signe', SIGNES_ETATS[groupe.etat] || ''));
  tete.append(h('span', null, NOMS_ETATS[groupe.etat] || groupe.etat));
  tete.append(h('span', 'liste__groupe-compte', String(groupe.films.length)));
  bloc.append(tete);

  const grille = h('div', 'liste__grille');
  for (const film of groupe.films) {
    const carte = h('article', 'liste__film');
    carte.append(vignette(film));
    const texte = h('div', 'liste__film-texte');
    texte.append(h('strong', 'liste__film-titre', film.title || 'Sans titre'));
    texte.append(h('span', 'liste__film-meta',
      (film.kind === 'tv' ? 'Série' : 'Film') + (film.date ? ' · ' + film.date.slice(0, 4) : '')));
    carte.append(texte);

    if (!etat.lecture) {
      const retirer = bouton('liste__retirer', 'Retirer', () => {
        deps.retirer(film.cle);
        deps.annoncer?.((film.title || 'Le film') + ' retiré de ta liste.');
        dessiner();
      });
      retirer.setAttribute('aria-label', 'Retirer ' + (film.title || 'ce film') + ' de ta liste');
      carte.append(retirer);
    }
    grille.append(carte);
  }
  bloc.append(grille);
  return bloc;
}

/* ── Entrées et sorties ───────────────────────────────────────────────────── */

export function initListe(dependances = {}) {
  deps = { ...deps, ...dependances };
  racine = document.getElementById('liste-ecran');
  if (!racine) return;
  /* Un lien de partage : `?liste=CODE`. On l'ouvre au chargement, sans que
     personne n'ait à cliquer — c'est ce que reçoit celui à qui on l'envoie. */
  const code = new URLSearchParams(location.search).get('liste');
  if (code) {
    racine.hidden = false;
    document.body.classList.add('liste-ouverte');
    chargerPublique(code);
  }
}

export function ouvrirListe() {
  if (!racine) return;
  etat.lecture = false;
  etat.public = null;
  etat.erreur = '';
  racine.hidden = false;
  document.body.classList.add('liste-ouverte');
  deps.ouvrir?.();
  dessiner();
  completerLesManquants();
}

export function fermerListe() {
  if (!racine) return;
  racine.hidden = true;
  document.body.classList.remove('liste-ouverte');
  deps.fermer?.();
}

export const estOuverte = () => Boolean(racine && !racine.hidden);
