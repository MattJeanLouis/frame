/**
 * Le miroir, à l'écran.
 *
 * Un miroir, pas un tableau de bord : ce qui est dessiné ici est fait de films.
 * Les barres d'un histogramme sont des affiches empilées, les territoires sont
 * des bandes d'affiches, les décennies sont un ciel d'affiches. Un graphique
 * qu'on pourrait mettre dans n'importe quelle application ne dit rien de cette
 * application-ci.
 *
 * DEUX RÈGLES DE CONDUITE
 *
 * 1. Un chiffre ne sort jamais seul. Chaque figure porte son effectif et sa
 *    phrase — sinon il devient un score, et FRAME ne note pas.
 * 2. Une section sans matière ne s'affiche pas. On ne montre pas un cadre vide
 *    avec « pas de données » : on ne montre rien. Ce qui manque est dit UNE
 *    fois, dans « ce qui manque », avec ce que le combler donnerait.
 *
 * Ce module ne calcule rien : tout vient de `src/miroir.js`, qui est éprouvé.
 * Il ne fait que dessiner, avec les moyens de l'application — les emoji Twemoji,
 * les affiches TMDB, et les trois typographies.
 */
import { portrait, ETATS, VUS, JUGES } from '../../src/miroir.js';

const POSTER = 'https://image.tmdb.org/t/p/';

const NOMS_ETATS = {
  want: 'À voir', watching: 'En cours', seen: 'Vu',
  ok: 'Ok', love: 'J’adore', nope: 'Pas aimé'
};
const SIGNES_ETATS = { want: '🎟️', watching: '▶️', seen: '👁️', ok: '🙂', love: '❤️', nope: '🙁' };

/* Les sections, dans l'ordre où on les lit. Elles servent aussi de sommaire :
   un miroir long sans repères est un miroir qu'on ne finit pas. */
const SECTIONS = [
  ['geste', 'Ton geste'],
  ['territoires', 'Tes territoires'],
  ['annees', 'Tes années'],
  ['monde', 'Toi et le public'],
  ['signature', 'Ta signature'],
  ['manque', 'Ce qui manque']
];

let deps = {};
let racine = null;
let dernier = null;
let occupe = false;
let moisChoisi = null;
let genreOuvert = null;

const h = (balise, classe, texte) => {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (texte != null) n.textContent = texte;
  return n;
};

const nombre = n => Number(n || 0).toLocaleString('fr-FR');

/* ── Les images ───────────────────────────────────────────────────────────── */

/**
 * Une affiche cliquable.
 *
 * Toutes les affiches du miroir sont des portes : c'est ce qui empêche le
 * miroir d'être un cul-de-sac. On voit un film dans une statistique, on ouvre sa
 * fiche, on le marque — et en revenant, le miroir a bougé.
 */
function affiche(item, taille = 'w92', { classe = '', titre = true } = {}) {
  const bouton = h('button', 'affiche ' + classe);
  bouton.type = 'button';
  bouton.dataset.cle = item.cle;
  const nom = item.titre || 'Film sans titre';
  bouton.setAttribute('aria-label', titre ? 'Ouvrir ' + nom + (item.annee ? ', ' + item.annee : '') : nom);
  if (item.affiche) {
    const img = h('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    /* L'écouteur est posé AVANT la source, et l'échec vaut chargement : une
       affiche qui ne se charge pas doit rester visible. Le prototype a déjà eu
       une classe `is-loaded` sans règle CSS — toutes les images étaient
       invisibles et la mesure, elle, était verte. */
    const prete = () => img.classList.add('is-prete');
    img.addEventListener('load', prete);
    img.addEventListener('error', prete);
    img.src = POSTER + taille + item.affiche;
    if (img.complete) prete();
    bouton.append(img);
  } else {
    /* Sans affiche, on ne laisse pas un trou : on écrit le titre. Un vide
       ressemble à une panne, un titre ressemble à un film. */
    bouton.append(h('span', 'affiche__titre', nom.slice(0, 40)));
  }
  if (titre) bouton.append(h('span', 'affiche__nom', nom));
  bouton.addEventListener('click', () => deps.ouvrirFiche?.(item.cle));
  return bouton;
}

const bande = (items, taille, max, classe = '') => {
  const wrap = h('div', 'bande ' + classe);
  for (const item of items.slice(0, max)) wrap.append(affiche(item, taille));
  if (items.length > max) {
    const plus = h('button', 'bande__plus', '+' + (items.length - max));
    plus.type = 'button';
    plus.setAttribute('aria-label', 'Voir les ' + (items.length - max) + ' autres films');
    plus.addEventListener('click', () => {
      wrap.replaceChildren(...items.map(i => affiche(i, taille)));
    });
    wrap.append(plus);
  }
  return wrap;
};

/* ── L'ouverture ──────────────────────────────────────────────────────────── */

/**
 * Le carton d'ouverture.
 *
 * Il porte la seule phrase que quelqu'un lira même s'il ne lit rien d'autre :
 * le repère le plus fort, calculé. Et il porte l'état du miroir — ce qui est
 * rempli, ce qui ne l'est pas — parce qu'un portrait doit dire sur quoi il
 * repose avant de dire quoi que ce soit.
 */
function ouverture(p) {
  const bloc = h('header', 'miroir__ouverture');
  bloc.append(h('p', 'miroir__eyebrow', 'Mon miroir'));

  if (!p.total) {
    bloc.append(h('h1', 'miroir__titre', 'Ton miroir est encore vide.'));
    bloc.append(h('p', 'miroir__chapeau',
      'Il n’a besoin que d’une chose : que tu dises ce que tu penses d’un film. Marque-en un, et le miroir commence à te ressembler.'));
    const aller = h('button', 'miroir__action', 'Aller au mur');
    aller.type = 'button';
    aller.addEventListener('click', fermerMiroir);
    bloc.append(aller);
    return bloc;
  }

  const premier = p.repere[0];
  bloc.append(h('h1', 'miroir__titre', nombre(p.total) + ' films, et ce qu’ils disent de toi.'));
  if (premier) {
    const phrase = h('p', 'miroir__chapeau');
    phrase.append(h('em', null, premier.texte));
    phrase.append(document.createTextNode(' ' + premier.detail));
    bloc.append(phrase);
  }

  /* La profondeur du geste : trois lignes, chacune mesurée sur le TOTAL.
     Trois parts qui se partageraient la largeur seraient un mensonge — 21 avis
     sur 61 films occuperaient un tiers de la barre et se liraient comme un
     tiers des films. Ici, chaque longueur se rapporte au même tout, et les
     trois se lisent comme un entonnoir : marqués, puis signés, puis écrits. */
  const g = p.geste;
  const barre = h('div', 'remplissage');
  const lignes = [
    ['marque', 'Films marqués', g.marques],
    ['avis', 'Avec un avis', g.signes],
    ['ecrit', 'Avec un commentaire', g.ecrits]
  ];
  for (const [cle, nom, n] of lignes) {
    const ligne = h('div', 'remplissage__ligne remplissage__ligne--' + cle);
    const rail = h('span', 'remplissage__rail');
    const part = h('i', 'remplissage__part');
    part.style.setProperty('--part', p.total ? n / p.total : 0);
    rail.append(part);
    ligne.append(h('span', 'remplissage__nom', nom), rail, h('span', 'remplissage__n', nombre(n)));
    barre.append(ligne);
  }
  bloc.append(barre);
  return bloc;
}

/* ── Le bandeau des figures ───────────────────────────────────────────────── */

/**
 * Le bandeau : six figures qui décrivent des GESTES, jamais des films.
 *
 * C'est la ligne de partage. « 43 films vus » parle de Matt ; « ce film vaut
 * 7,4 » parlerait de FRAME jugeant un film, ce que FRAME ne fait pas. Toutes les
 * figures d'ici comptent ce qu'il a fait, et chacune est suivie de ce que ça
 * veut dire.
 */
function bandeau(p) {
  const g = p.geste;
  const vus = p.items.filter(i => VUS.includes(i.marque)).length;
  const juges = p.items.filter(i => JUGES.includes(i.marque)).length;
  const amours = p.parEtat.find(e => e.id === 'love')?.n || 0;
  const figures = [];

  figures.push({ cle: 'films', etiquette: 'Films retenus', valeur: nombre(p.total), dit: 'Ce que tu as pris la peine de marquer.' });
  figures.push({
    cle: 'vus', etiquette: 'Films vus', valeur: nombre(vus),
    dit: vus && p.total ? 'Le reste, tu le veux encore.' : 'Rien de vu pour l’instant.'
  });

  /* Le temps passé : la seule figure qui fasse sentir une culture plutôt que la
     décrire. Elle ne sort que si assez de durées sont connues — sinon elle est
     une promesse, et elle vit dans « ce qui manque ». */
  if (p.duree.publiable) {
    const jours = Math.floor(p.duree.minutes / 1440);
    const heures = Math.round((p.duree.minutes % 1440) / 60);
    figures.push({
      cle: 'temps', etiquette: 'Temps passé', valeur: jours ? nombre(jours) + '\u00a0j ' + heures + '\u00a0h' : heures + '\u00a0h',
      dit: 'Sur ' + p.duree.connues + ' films dont la durée est connue.'
    });
  }

  figures.push({
    cle: 'avis', etiquette: 'Avis posés', valeur: nombre(g.signes),
    dit: g.marques ? 'Soit ' + (Math.round((g.signes / g.marques) * 100)) + ' films sur 100 que tu as signés.' : 'Aucune signature posée.'
  });
  figures.push({
    cle: 'mots', etiquette: 'Mots écrits', valeur: nombre(g.mots),
    dit: g.ecrits ? 'Dans ' + g.ecrits + ' commentaire' + (g.ecrits > 1 ? 's' : '') + '.' : 'Tu n’as encore rien écrit.'
  });
  figures.push({
    cle: 'coeur', etiquette: 'Coups de cœur', valeur: nombre(amours),
    dit: juges ? 'Sur ' + juges + ' films jugés.' : 'Aucun film jugé.'
  });

  const wrap = h('div', 'figures');
  for (const f of figures) {
    /* L'identité passe par un ATTRIBUT, pas par une classe : une classe est un
       crochet de style, et une classe sans règle CSS est du poids mort. Le
       prototype a déjà payé cette leçon. */
    const bloc = h('div', f.cle === 'temps' ? 'figure figure--temps' : 'figure');
    bloc.dataset.figure = f.cle;
    bloc.append(h('p', 'figure__etiquette', f.etiquette));
    bloc.append(h('p', 'figure__valeur', f.valeur));
    bloc.append(h('p', 'figure__dit', f.dit));
    wrap.append(bloc);
  }
  return wrap;
}

/* ── Les constats ─────────────────────────────────────────────────────────── */

/**
 * Ce que les chiffres veulent dire.
 *
 * Les phrases viennent du module de calcul, pas d'ici : elles sont éprouvées, et
 * une phrase qui décrit quelqu'un ne doit pas pouvoir dériver du calcul qu'elle
 * prétend résumer.
 */
function constats(p) {
  const bloc = h('section', 'miroir__bloc miroir__bloc--constats');
  bloc.append(titre('Ce que ça dit', 'Les phrases sont calculées à partir de tes films, pas écrites d’avance.'));
  const liste = h('ul', 'constats');
  for (const r of p.repere) {
    const li = h('li', 'constat');
    li.dataset.constat = r.id;
    const tete = h('p', 'constat__texte');
    if (r.emoji) tete.append(deps.emoji?.(r.emoji, 'constat__emoji') || h('span', null, r.emoji));
    tete.append(h('span', null, r.texte));
    li.append(tete, h('p', 'constat__detail', r.detail));
    liste.append(li);
  }
  bloc.append(liste);
  return bloc;
}

/* ── Le rythme ────────────────────────────────────────────────────────────── */

function geste(p) {
  const r = p.rythme;
  const bloc = h('section', 'miroir__bloc');
  bloc.id = 'miroir-geste';
  const max = Math.max(1, ...r.colonnes.map(c => c.n));
  bloc.append(titre('Ton geste', 'Douze mois de marques. Un mois vide est une information : il est dessiné.'));

  const graphe = h('div', 'rythme');
  const choix = moisChoisi ?? [...r.colonnes].reverse().find(c => c.n)?.mois ?? r.colonnes[r.colonnes.length - 1].mois;
  r.colonnes.forEach((c, i) => {
    const col = h('button', 'rythme__col');
    col.type = 'button';
    col.setAttribute('aria-pressed', String(c.mois === choix));
    col.setAttribute('aria-label', c.etiquette + ' ' + c.annee + ' : ' + c.n + ' film' + (c.n > 1 ? 's' : ''));
    const rail = h('span', 'rythme__rail');
    const barre = h('i', 'rythme__barre');
    barre.style.setProperty('--h', c.n / max);
    barre.style.setProperty('--i', i);
    rail.append(barre);
    col.append(h('span', 'rythme__n', c.n ? String(c.n) : ''), rail, h('span', 'rythme__mois', c.etiquette));
    col.addEventListener('click', () => { moisChoisi = c.mois; dessiner(); });
    graphe.append(col);
  });
  bloc.append(graphe);

  const colonne = r.colonnes.find(c => c.mois === choix);
  if (colonne && colonne.items.length) {
    const tiroir = h('div', 'rythme__tiroir');
    tiroir.append(h('p', 'rythme__entete', colonne.etiquette + ' ' + colonne.annee + ' — ' + colonne.items.length + ' film' + (colonne.items.length > 1 ? 's' : '')));
    tiroir.append(bande(colonne.items, 'w92', 12));
    bloc.append(tiroir);
  }
  if (r.sansDate) bloc.append(note(r.sansDate + ' geste' + (r.sansDate > 1 ? 's' : '') + ' sans date n’apparaisse' + (r.sansDate > 1 ? 'nt' : '') + ' pas ici — ils datent d’avant l’horodatage.'));
  return bloc;
}

/* ── Les territoires ──────────────────────────────────────────────────────── */

function territoires(p) {
  const bloc = h('section', 'miroir__bloc');
  bloc.id = 'miroir-territoires';
  bloc.append(titre('Tes territoires', 'Un genre à forte envie et faible amour est une promesse qui ne se réalise pas. C’est ce qu’un simple décompte cache.'));

  const liste = h('div', 'terres');
  const montres = p.territoires.slice(0, genreOuvert ? p.territoires.length : 8);
  for (const t of montres) {
    const ligne = h('div', 'terre');
    const tete = h('div', 'terre__tete');
    const nom = h('p', 'terre__nom');
    if (t.emoji) nom.append(deps.emoji?.(t.emoji, 'terre__emoji') || h('span', null, t.emoji));
    nom.append(h('span', null, t.label));
    tete.append(nom, h('p', 'terre__n', nombre(t.n) + (t.n > 1 ? ' films' : ' film')));
    ligne.append(tete);
    ligne.append(bande(t.items, 'w92', 8, 'bande--terre'));

    /* La jauge d'amour : une longueur, jamais un pourcentage affiché. Sous le
       seuil, elle reste vide et on écrit pourquoi — une jauge à moitié remplie
       sur deux films serait une conclusion inventée. */
    const jauge = h('div', 'jauge');
    const rail = h('div', 'jauge__rail');
    const plein = h('i', 'jauge__plein');
    plein.style.setProperty('--part', t.sur && t.taux !== null ? t.taux : 0);
    rail.append(plein);
    jauge.append(rail);
    if (t.sur && t.taux !== null) {
      jauge.append(h('p', 'jauge__dit', t.amour + ' coup' + (t.amour > 1 ? 's' : '') + ' de cœur sur ' + t.juges + ' jugés'));
    } else {
      jauge.classList.add('jauge--muette');
      jauge.append(h('p', 'jauge__dit', t.juges ? 'Trop peu jugés pour conclure' : 'Rien de jugé ici'));
    }
    ligne.append(jauge);
    liste.append(ligne);
  }
  bloc.append(liste);

  if (p.territoires.length > 8) {
    const plus = h('button', 'miroir__lien', genreOuvert ? 'Replier' : 'Voir les ' + (p.territoires.length - 8) + ' autres genres');
    plus.type = 'button';
    plus.addEventListener('click', () => { genreOuvert = !genreOuvert; dessiner(); });
    bloc.append(plus);
  }
  return bloc;
}

/* ── Le ciel d'affiches ───────────────────────────────────────────────────── */

/**
 * Les décennies en ciel : une tour d'affiches par décennie.
 *
 * C'est le seul graphique de la page qui ne pourrait pas exister ailleurs : la
 * hauteur dit le nombre, et ce qu'on voit en dessous, ce sont les films
 * eux-mêmes. Un histogramme de barres grises dirait la même chose sans rien
 * montrer.
 */
function ciel(p) {
  const bloc = h('section', 'miroir__bloc');
  bloc.id = 'miroir-annees';
  const d = p.decennies;
  const info = d.etendue
    ? 'De ' + d.etendue.de + ' à ' + d.etendue.a + ' — chaque tour est une décennie, et chaque affiche un film.'
    : 'Aucune date connue.';
  bloc.append(titre('Tes années', info));

  const max = Math.max(1, ...d.lignes.map(l => l.n));
  const PLAFOND = 6;
  const cielEl = h('div', 'ciel');
  for (const l of d.lignes) {
    const tour = h('div', 'ciel__tour');
    const pile = h('div', 'ciel__pile');
    /* Une tour haute ne montre pas trente affiches. Mais elle ne montre pas non
       plus « six » quand une autre en montre trois : la hauteur doit rester
       PROPORTIONNELLE au nombre, sinon le graphe ment. On dessine donc
       `PLAFOND × n / max` affiches — au moins une — et le compte réel est écrit
       au-dessus, en clair. */
    const combien = max <= PLAFOND ? l.n : Math.max(1, Math.round((PLAFOND * l.n) / max));
    const recentes = [...l.items].sort((a, b) => (b.quand || 0) - (a.quand || 0)).slice(0, combien);
    for (const item of recentes) pile.append(affiche(item, 'w92', { classe: 'affiche--pile', titre: false }));
    if (l.n > recentes.length) pile.append(h('span', 'ciel__reste', '+' + (l.n - recentes.length)));
    tour.append(h('p', 'ciel__n', String(l.n)), pile, h('p', 'ciel__decennie', String(l.decennie)));
    cielEl.append(tour);
  }
  bloc.append(cielEl);

  const pieds = [];
  if (d.anneeAimee && d.aimees) pieds.push('Tu adores surtout des films de ' + d.anneeAimee + ' en moyenne.');
  if (d.anneeAttendue && d.attendues) pieds.push('Tu veux voir des films de ' + d.anneeAttendue + ' en moyenne.');
  if (pieds.length) bloc.append(note(pieds.join(' ')));
  return bloc;
}

/* ── Toi et le public ─────────────────────────────────────────────────────── */

/**
 * La seule comparaison de la page — et elle porte sur Matt, pas sur les films.
 *
 * FRAME ne note pas. Mais TMDB publie une note publique, et l'écart entre cette
 * note et ce que Matt en a dit est un renseignement sur Matt : ses secrets, ses
 * dissidences. Aucun des deux n'est une faute, et la page le dit.
 */
function monde(p) {
  const m = p.public;
  const bloc = h('section', 'miroir__bloc');
  bloc.id = 'miroir-monde';
  bloc.append(titre('Toi et le public', 'What the Flick ne note pas les films. La note publique de TMDB sert ici à une seule chose : mesurer ton écart avec elle.'));

  if (m.surAimee && m.surRejetee) {
    const face = h('div', 'face');
    const duo = h('div', 'face__duo');
    const a = h('div', 'face__camp');
    a.append(h('p', 'face__etiquette', 'Ce que tu adores'), h('p', 'face__note', String(m.moyenneAimee).replace('.', ',')));
    const b = h('div', 'face__camp');
    b.append(h('p', 'face__etiquette', 'Ce que tu n’aimes pas'), h('p', 'face__note', String(m.moyenneRejetee).replace('.', ',')));
    duo.append(a, b);
    face.append(duo, h('p', 'face__dit', 'Notes publiques moyennes, sur ' + m.notes + ' films que tu as jugés.'));
    bloc.append(face);
  }

  const groupes = [
    ['secrets', '🔭', 'Tes secrets', 'Des films que tu adores et que presque personne n’a vus — moins de 400 votes sur TMDB.', m.secrets],
    ['dissidences', '🙅', 'Tes dissidences', 'Des films que le public porte haut et que tu n’as pas aimés. Ce n’est pas une erreur : c’est un goût.', m.dissidences],
    ['consensus', '🤝', 'Vos terrains communs', 'Des films que tu adores et que le public porte aussi.', m.consensus]
  ];
  for (const [cle, signe, nom, dit, liste] of groupes) {
    if (!liste.length) continue;
    const g = h('div', 'monde-groupe monde-groupe--' + cle);
    const tete = h('div', 'monde-groupe__tete');
    const t = h('p', 'monde-groupe__nom');
    t.append(deps.emoji?.(signe, 'monde-groupe__emoji') || h('span', null, signe));
    t.append(h('span', null, nom + ' · ' + liste.length));
    tete.append(t);
    g.append(tete, h('p', 'monde-groupe__dit', dit), bande(liste, 'w92', 10));
    bloc.append(g);
  }
  if (!m.secrets.length && !m.dissidences.length && !m.consensus.length) {
    bloc.append(note('Rien à comparer tant que tu n’as pas dit ce que tu penses de quelques films.'));
  }
  return bloc;
}

/* ── Ta signature et tes mots ─────────────────────────────────────────────── */

/**
 * Le nuage des signes — ou RIEN.
 *
 * Un signe dont l'identifiant n'existe plus dans le catalogue (un signe renommé,
 * une signature d'une version antérieure) ne se dessine pas. Mais le titre de la
 * section, lui, restait : deux en-têtes vides se suivaient à l'écran. On rend
 * donc `null` au lieu d'un cadre vide, et l'appelant ne montre pas la section.
 */
function nuage(entries) {
  const dessinables = entries.map(({ id, n }) => ({ sticker: deps.sticker?.(id), n })).filter(x => x.sticker);
  if (!dessinables.length) return null;
  const wrap = h('div', 'nuage');
  const max = dessinables[0].n;
  for (const { sticker, n } of dessinables) {
    const item = h('span', 'nuage__item');
    item.style.setProperty('--sz', Math.round(26 + (n / max) * 30) + 'px');
    item.append(deps.emoji?.(sticker.emoji, 'nuage__emoji') || h('span', null, sticker.emoji));
    item.append(h('span', 'nuage__n', String(n)));
    item.title = sticker.label + ' — ' + n + ' fois';
    wrap.append(item);
  }
  return wrap;
}

/** Un groupe de signes : le titre ne s'affiche que si le nuage existe. */
function groupeSignes(classe, nom, dit, entries) {
  const dessin = nuage(entries);
  if (!dessin) return null;
  const g = h('div', 'signe-groupe' + (classe ? ' ' + classe : ''));
  g.append(h('p', 'signe-groupe__nom', nom));
  if (dit) g.append(h('p', 'signe-groupe__dit', dit));
  g.append(dessin);
  return g;
}

function signature(p) {
  const s = p.signature;
  const bloc = h('section', 'miroir__bloc');
  bloc.id = 'miroir-signature';
  bloc.append(titre('Ta signature', 'Le nom d’un film se dérive de ses mots-clés. Ce que tu ajoutes à cette proposition est ce que tu cherches ; ce que tu retires est ce que la machine croit comprendre et qui ne te concerne pas.'));

  const groupes = [
    groupeSignes('', 'Les signes que tu poses le plus', null, s.poses.slice(0, 12)),
    groupeSignes('', 'Ce que tu ajoutes', 'Des signes que TMDB ne proposait pas pour ces films.', s.ajoutes.slice(0, 12)),
    groupeSignes('signe-groupe--retires', 'Ce que tu retires', 'Des signes que la dérivation proposait et que tu as écartés.', s.retires.slice(0, 12))
  ].filter(Boolean);
  for (const g of groupes) bloc.append(g);
  if (!groupes.length) {
    bloc.append(note('Aucun avis posé. Une signature est ce qui donne son nom à un film — commence par un.'));
  }

  /* Les mots. Ils ne sont pas des emoji : c'est du texte d'auteur, il se lit. */
  const m = p.mots;
  if (m.mots.length) {
    const g = h('div', 'signe-groupe signe-groupe--mots');
    g.append(h('p', 'signe-groupe__nom', 'Tes mots'));
    g.append(h('p', 'signe-groupe__dit', 'Les mots de plus de trois lettres que tu emploies dans tes commentaires, une fois par commentaire.'));
    const mots = h('div', 'mots');
    const max = m.mots[0].n;
    for (const { mot, n } of m.mots.slice(0, 28)) {
      const item = h('span', 'mots__mot');
      item.style.setProperty('--poids', (n / max).toFixed(2));
      item.append(h('span', null, mot), h('sup', 'mots__n', n > 1 ? String(n) : ''));
      mots.append(item);
    }
    g.append(mots);
    g.append(note('Apparus dans ' + m.commentaires + ' commentaire' + (m.commentaires > 1 ? 's' : '') + '.'));
    bloc.append(g);
  }
  return bloc;
}

/* ── Ce qui manque ────────────────────────────────────────────────────────── */

/**
 * Le miroir dit ce qu'il ignore.
 *
 * C'est la réponse à « je n'ai pas tout rempli » : pas une excuse, pas un
 * reproche — une liste. Ce qui manque, combien, ce que le combler donnerait, et
 * les affiches pour y aller. Quand une mesure coûte une requête, elle le dit et
 * demande la permission : personne n'a envie qu'une page se mette à télécharger
 * quarante films sans prévenir.
 */
function manque(p) {
  const bloc = h('section', 'miroir__bloc miroir__bloc--manque');
  bloc.id = 'miroir-manque';
  bloc.append(titre('Ce qui manque', 'Un miroir incomplet qui fait semblant d’être complet est un miroir qui ment. Voilà exactement ce qu’il ne sait pas encore.'));

  const liste = h('ul', 'manques');
  for (const t of p.trous) {
    const li = h('li', 'manque');
    li.dataset.manque = t.id;
    const tete = h('div', 'manque__tete');
    tete.append(h('p', 'manque__n', nombre(t.n)));
    const corps = h('div', 'manque__corps');
    corps.append(h('p', 'manque__titre', t.titre));
    corps.append(h('p', 'manque__dit', t.dit));
    corps.append(h('p', 'manque__promesse', t.deverrouille));
    tete.append(corps);
    li.append(tete);

    /* Les affiches concernées : le manque a un visage, sinon il reste abstrait. */
    if (t.items.length && t.action !== null) li.append(bande(t.items, 'w92', 8, 'bande--manque'));

    /* Une action qui ne peut pas aboutir ne s'affiche pas : sans réseau, ce
       bouton compterait jusqu'à dix sans rien rapporter, et l'échec serait
       attribué au miroir. */
    if (t.action === 'completer' && deps.completer && deps.reseau?.() !== false) {
      const bouton = h('button', 'manque__action', 'Aller les chercher');
      bouton.type = 'button';
      bouton.addEventListener('click', () => lancerCompletion(bouton, t));
      li.append(bouton);
    }
    liste.append(li);
  }
  bloc.append(liste);
  bloc.append(note('Tout ce que tu remplis ici reste sur cet appareil. Rien n’est envoyé nulle part.'));
  return bloc;
}

/**
 * La seule action du miroir qui touche au réseau.
 *
 * Elle montre son avancement parce qu'elle dure : un bouton qui ne dit rien
 * pendant vingt secondes est un bouton qu'on croit cassé.
 */
async function lancerCompletion(bouton, trou) {
  if (occupe || !deps.completer) return;
  if (deps.reseau?.() === false) { deps.annoncer?.('Sans connexion, ces films restent à compléter plus tard.'); return; }
  occupe = true;
  const cles = trou.items.map(i => i.cle);
  let faites = 0;
  bouton.disabled = true;
  bouton.textContent = '0 / ' + cles.length;
  try {
    await deps.completer(cles, () => {
      faites++;
      bouton.textContent = faites + ' / ' + cles.length;
    });
    deps.annoncer?.(faites + ' films complétés.');
  } catch {
    deps.annoncer?.('La recherche s’est interrompue.');
  } finally {
    occupe = false;
    bouton.disabled = false;
    bouton.textContent = 'Aller les chercher';
    if (racine && !racine.hidden) rafraichir();
  }
}

/* ── Le sommaire et les blocs ─────────────────────────────────────────────── */

const titre = (nom, dit) => {
  const t = h('div', 'bloc-titre');
  t.append(h('h2', 'bloc-titre__nom', nom));
  if (dit) t.append(h('p', 'bloc-titre__dit', dit));
  return t;
};

const note = texte => h('p', 'miroir__note', texte);

/**
 * Le sommaire.
 *
 * Il ne liste que les sections RÉELLEMENT dessinées : un sommaire qui propose
 * une section absente est un sommaire qui ment, et c'est le premier signe qu'une
 * page est générée plutôt que composée.
 */
function sommaire(p, presents) {
  const barre = h('nav', 'sommaire');
  const fermer = h('button', 'sommaire__fermer');
  fermer.type = 'button';
  fermer.setAttribute('aria-label', 'Fermer le miroir');
  fermer.append(h('span', 'croix'));
  fermer.addEventListener('click', fermerMiroir);
  barre.append(fermer, h('p', 'sommaire__marque', 'Miroir'));
  const liens = h('div', 'sommaire__liens');
  for (const [id, nom] of SECTIONS) {
    if (!presents.includes(id)) continue;
    const lien = h('button', 'sommaire__lien', nom);
    lien.type = 'button';
    lien.addEventListener('click', () => {
      racine.querySelector('#miroir-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    liens.append(lien);
  }
  barre.append(liens);
  return barre;
}

/* ── Le dessin ────────────────────────────────────────────────────────────── */

function calculer() {
  return portrait(deps.etat?.() || {}, {
    genres: deps.genres?.() || {},
    proposed: deps.proposed || null,
    maintenant: Date.now()
  });
}

function dessiner() {
  const p = dernier;
  /* On redessine sans perdre sa place : le miroir se recalcule quand on ferme
     une fiche, et être renvoyé en haut à chaque fois rendrait l'écran
     inutilisable dès qu'on ose cliquer sur une affiche. */
  const garde = racine.scrollTop;
  const sections = [];
  const presents = [];

  sections.push(ouverture(p));
  if (p.total) sections.push(bandeau(p));
  if (p.repere.length) sections.push(constats(p));
  if (p.rythme.couverts) { sections.push(geste(p)); presents.push('geste'); }
  if (p.territoires.length) { sections.push(territoires(p)); presents.push('territoires'); }
  if (p.decennies.lignes.length) { sections.push(ciel(p)); presents.push('annees'); }
  if (p.public.notes) { sections.push(monde(p)); presents.push('monde'); }
  if (p.total) { sections.push(signature(p)); presents.push('signature'); }
  if (p.trous.length) { sections.push(manque(p)); presents.push('manque'); }

  const contenu = h('div', 'miroir');
  contenu.append(sommaire(p, presents));
  sections.forEach((s, i) => {
    s.style.setProperty('--i', i);
    contenu.append(s);
  });
  contenu.append(note('Ce miroir ne quitte pas cet appareil.'));
  racine.replaceChildren(contenu);
  racine.scrollTop = garde;
}

export function initMiroir(d) {
  deps = d || {};
  racine = deps.racine;
}

export const miroirOuvert = () => Boolean(racine && !racine.hidden);

export function rafraichir() {
  if (!racine) return;
  dernier = calculer();
  if (!racine.hidden) dessiner();
}

export function ouvrirMiroir() {
  if (!racine) return;
  document.body.classList.add('miroir-ouvert');
  dernier = calculer();
  racine.hidden = false;
  racine.scrollTop = 0;
  dessiner();
  racine.querySelector('.sommaire__fermer')?.focus();
}

export function fermerMiroir() {
  if (!racine) return;
  racine.hidden = true;
  racine.replaceChildren();
  document.body.classList.remove('miroir-ouvert');
}

export { ETATS, NOMS_ETATS, SIGNES_ETATS };
