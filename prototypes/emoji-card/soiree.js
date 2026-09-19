/**
 * Le mode Soirée : on crée une room, on la rejoint avec un code, et on choisit
 * un film ensemble.
 *
 * Le jeu tient en trois temps. Une fois que tout le monde est là, chacun se
 * prononce EN PRIVÉ sur la même liste de films ; quand plus personne n'a rien à
 * voter, les votes se retournent d'un coup et le classement apparaît. Ce qui
 * rend le jeu intéressant n'est pas le vote, c'est la seconde où l'on découvre
 * que le film qu'on croyait évident était celui que son voisin détestait.
 *
 * D'où la règle que porte tout ce fichier : pendant la manche, on ne montre
 * JAMAIS le vote des autres. Le serveur ne les envoie d'ailleurs pas — ce n'est
 * pas une politesse de l'interface, c'est une règle du serveur.
 */
import { normaliserCode, cleFilm, DECK_DEFAUT } from '../../room/rooms.js';

const CLE = 'frame.soiree';
const POSTER = 'https://image.tmdb.org/t/p/w342';

let deps = { films: () => [], annoncer: () => { } };
let racine = null;
let etat = {
  base: '',
  nom: '',
  code: '',
  joueurId: '',
  vue: null,
  flux: null,
  index: 0,
  attente: false,
  erreur: '',
  occupe: false,
  accueilCode: ''
};

/* ── Le stockage : revenir, c'est reprendre sa place ──────────────────────── */

function charger() {
  try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch { return {}; }
}
function retenir(patch) {
  try { localStorage.setItem(CLE, JSON.stringify({ ...charger(), ...patch })); } catch { /* sans stockage, on rejoint à la main */ }
}

/* ── Le réseau ────────────────────────────────────────────────────────────── */

/** L'adresse du serveur de soirée. Par défaut celui qui a servi la page : si on
 *  est arrivé par le lien de l'hôte, il n'y a rien à configurer. */
function baseParDefaut() {
  const garde = charger().base;
  if (garde) return garde;
  /* La page est déjà servie par le serveur de soirée : son origine EST l'adresse
     de l'API, port compris. C'est le cas normal — on est arrivé par le lien de
     l'hôte — et c'est celui qu'un port oublié cassait. */
  if (location.port === '8092') return location.origin;
  /* Sinon la page vient de `npm run serve` (8090), et les soirées tournent à
     côté : on propose le bon port d'emblée. */
  return location.protocol + '//' + (location.hostname || 'localhost') + ':8092';
}

async function appel(chemin, corps) {
  let r;
  try {
    r = await fetch(etat.base.replace(/\/$/, '') + chemin, {
      method: corps ? 'POST' : 'GET',
      headers: corps ? { 'content-type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : undefined
    });
  } catch {
    /* La panne la plus fréquente, de loin : le serveur de soirée ne tourne pas,
       ou l'adresse n'est pas la sienne. « Failed to fetch » ne dit rien à
       personne ; on dit quoi faire. */
    throw new Error('Le serveur de soirée ne répond pas à ' + etat.base +
      '. Vérifie qu’il tourne (« npm run room ») et que l’adresse est la bonne.');
  }
  let données = null;
  try { données = await r.json(); } catch { /* réponse non-JSON */ }
  if (!r.ok) throw new Error(données?.erreur || ('Le serveur a répondu ' + r.status));
  return données;
}

const action = (type, suite = {}) =>
  appel('/api/action', { code: etat.code, joueurId: etat.joueurId, type, ...suite });

/** On écoute l'état poussé par le serveur. `EventSource` se reconnecte seul. */
function ecouter() {
  etat.flux?.close();
  const url = etat.base.replace(/\/$/, '') + '/api/flux?code=' + encodeURIComponent(etat.code) +
    '&joueur=' + encodeURIComponent(etat.joueurId);
  const flux = new EventSource(url);
  etat.flux = flux;
  flux.onmessage = event => {
    let charge;
    try { charge = JSON.parse(event.data); } catch { return; }
    if (charge.type === 'erreur') { aviser(charge.message); return; }
    if (charge.type === 'fermee') { quitter(false); aviser('La soirée a expiré.'); return; }
    if (charge.type !== 'etat') return;
    const avant = etat.vue;
    etat.vue = charge.vue;
    etat.erreur = '';
    /* Un film de plus, ou un changement de phase : on replace le curseur du deck
       sans jamais faire reculer quelqu'un qui a déjà voté. */
    if (!avant || avant.manche !== charge.vue.manche) etat.index = 0;
    etat.index = Math.min(etat.index, Math.max(0, charge.vue.deck.length - 1));
    dessiner();
  };
  flux.onerror = () => {
    /* `EventSource` retente tout seul ; on le dit seulement si ça dure. */
    if (!etat.vue) aviser('Connexion à la soirée perdue. Nouvelle tentative…');
  };
}

/* ── Les petits outils ────────────────────────────────────────────────────── */

const h = (balise, classe, texte) => {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (texte != null) n.textContent = texte;
  return n;
};

function bouton(classe, texte, action_, { desactive = false } = {}) {
  const b = h('button', classe, texte);
  b.type = 'button';
  b.disabled = desactive;
  if (action_) b.addEventListener('click', action_);
  return b;
}

function aviser(message) {
  etat.erreur = message;
  deps.annoncer?.(message);
  dessiner();
}

function vignette(film, taille = 'w342') {
  const img = h('img', 'soiree__affiche');
  img.alt = '';
  img.loading = 'lazy';
  img.src = film.poster ? POSTER + film.poster : '';
  if (!film.poster) img.classList.add('soiree__affiche--vide');
  return img;
}

/* ── L'écran : accueil ────────────────────────────────────────────────────── */

function ecranAccueil() {
  const boite = h('div', 'soiree__accueil');

  boite.append(h('p', 'soiree__intro',
    'On choisit un film à plusieurs. Chacun se prononce en privé sur la même liste, puis les votes se retournent d’un coup.'));

  const nom = h('label', 'soiree__champ');
  nom.append(h('span', null, 'Ton nom'));
  const champNom = h('input');
  champNom.type = 'text';
  champNom.maxLength = 24;
  champNom.value = etat.nom;
  champNom.placeholder = 'Matt';
  champNom.autocomplete = 'nickname';
  champNom.addEventListener('input', () => { etat.nom = champNom.value; });
  nom.append(champNom);
  boite.append(nom);

  const creer = bouton('soiree__bouton soiree__bouton--fort', 'Créer une soirée', async () => {
    if (etat.occupe) return;
    etat.occupe = true; etat.erreur = '';
    try {
      const r = await appel('/api/creer', { nom: etat.nom });
      etat.code = r.code; etat.joueurId = r.joueurId;
      retenir({ base: etat.base, nom: etat.nom, code: r.code, joueurId: r.joueurId });
      ecouter();
    } catch (e) { aviser('Impossible de créer la soirée : ' + e.message); }
    finally { etat.occupe = false; dessiner(); }
  });
  boite.append(creer);

  const ou = h('p', 'soiree__ou', 'ou');
  boite.append(ou);

  const code = h('label', 'soiree__champ');
  code.append(h('span', null, 'Code de la soirée'));
  const champCode = h('input');
  champCode.type = 'text';
  champCode.inputMode = 'text';
  champCode.autocapitalize = 'characters';
  champCode.maxLength = 8;
  champCode.placeholder = 'ABC123';
  champCode.value = etat.accueilCode || '';
  champCode.className = 'soiree__code-champ';
  code.append(champCode);
  boite.append(code);

  const rejoindre = bouton('soiree__bouton', 'Rejoindre', async () => {
    if (etat.occupe) return;
    const propre = normaliserCode(champCode.value);
    if (propre.length !== 6) { aviser('Un code fait six signes.'); return; }
    etat.occupe = true; etat.erreur = '';
    try {
      const r = await appel('/api/rejoindre', { code: propre, nom: etat.nom, joueurId: etat.joueurId || null });
      etat.code = r.code; etat.joueurId = r.joueurId;
      retenir({ base: etat.base, nom: etat.nom, code: r.code, joueurId: r.joueurId });
      ecouter();
    } catch (e) { aviser(e.message); }
    finally { etat.occupe = false; dessiner(); }
  });
  boite.append(rejoindre);

  champCode.addEventListener('keydown', e => { if (e.key === 'Enter') rejoindre.click(); });
  champNom.addEventListener('keydown', e => { if (e.key === 'Enter') champCode.focus(); });

  /* L'adresse du serveur ne se voit que si elle ne va pas de soi. */
  const details = h('details', 'soiree__reglages');
  details.append(h('summary', null, 'Serveur de soirée'));
  const adresse = h('label', 'soiree__champ');
  adresse.append(h('span', null, 'Adresse'));
  const champBase = h('input');
  champBase.type = 'url';
  champBase.value = etat.base;
  champBase.addEventListener('change', () => {
    etat.base = champBase.value.trim() || baseParDefaut();
    retenir({ base: etat.base });
  });
  adresse.append(champBase);
  details.append(adresse);
  details.append(h('p', 'soiree__note',
    'L’hôte lance « npm run room » sur son ordinateur et donne l’adresse affichée. Tout reste sur le réseau local.'));
  boite.append(details);

  return boite;
}

/* ── L'écran : salon d'attente ────────────────────────────────────────────── */

function ecranLobby() {
  const vue = etat.vue;
  const boite = h('div', 'soiree__lobby');

  const entete = h('div', 'soiree__code-bloc');
  entete.append(h('span', 'soiree__etiquette', 'Code de la soirée'));
  entete.append(h('strong', 'soiree__code', vue.code));
  const lien = location.origin + location.pathname + '?soiree=' + vue.code;
  const partager = bouton('soiree__bouton soiree__bouton--petit', 'Copier le lien', async () => {
    try {
      await navigator.clipboard.writeText(lien);
      aviser('Lien copié. Envoie-le, ils n’ont plus qu’à ouvrir.');
    } catch { aviser('Copie impossible. Le lien est : ' + lien); }
  });
  entete.append(partager);
  boite.append(entete);

  const liste = h('ul', 'soiree__joueurs');
  for (const j of vue.joueurs) {
    const li = h('li');
    li.append(h('span', 'soiree__point'));
    li.append(h('span', null, j.nom));
    if (j.hote) li.append(h('em', 'soiree__role', 'hôte'));
    if (j.id === vue.moi?.id) li.append(h('em', 'soiree__role', 'toi'));
    liste.append(li);
  }
  boite.append(h('h3', 'soiree__titre-section', vue.joueurs.length > 1 ? 'Ils sont là' : 'Pour l’instant, toi'));
  boite.append(liste);

  /* Le deck se compose depuis le catalogue : ce qu'on a sous les yeux au moment
   * d'ouvrir la soirée est ce qu'on propose. */
  const proposables = deps.films() || [];
  const nombre = Math.min(DECK_DEFAUT, proposables.length);
  const bloc = h('div', 'soiree__deck');
  bloc.append(h('h3', 'soiree__titre-section', 'Les films'));
  bloc.append(h('p', 'soiree__note', proposables.length
    ? nombre + ' film' + (nombre > 1 ? 's' : '') + ' pris dans le catalogue, tels qu’il est filtré en ce moment.'
    : 'Le catalogue est vide : va chercher des films, puis reviens. Ils seront proposés ici.'));

  if (vue.moi?.hote) {
    bloc.append(bouton('soiree__bouton soiree__bouton--fort', 'Lancer la manche',
      async () => {
        if (etat.occupe) return;
        etat.occupe = true;
        try {
          const theme = document.querySelector('#collection-note')?.textContent || '';
          await action('lancer', { deck: proposables.slice(0, DECK_DEFAUT), theme });
        } catch (e) { aviser(e.message); }
        finally { etat.occupe = false; }
      }, { desactive: !proposables.length || vue.joueurs.length < 2 }));
    if (vue.joueurs.length < 2) bloc.append(h('p', 'soiree__note', 'Il faut être au moins deux.'));
  } else {
    bloc.append(h('p', 'soiree__note', 'C’est ' + (vue.joueurs.find(j => j.hote)?.nom || 'l’hôte') + ' qui lance la manche.'));
  }
  boite.append(bloc);

  const lienCatalogue = bouton('soiree__lien', '← Retour au catalogue', () => fermerRoom());
  boite.append(lienCatalogue);
  return boite;
}

/* ── L'écran : la manche ──────────────────────────────────────────────────── */

function ecranManche() {
  const vue = etat.vue;
  const boite = h('div', 'soiree__manche');
  const film = vue.deck[etat.index];
  if (!film) return boite;

  const miens = vue.votes[vue.moi?.id] || {};
  const fait = Object.keys(miens).length;

  const tete = h('div', 'soiree__progression');
  const barre = h('div', 'soiree__barre');
  const jauge = h('i');
  jauge.style.transform = 'scaleX(' + (vue.deck.length ? fait / vue.deck.length : 0) + ')';
  barre.append(jauge);
  tete.append(h('span', 'soiree__compte', fait + ' / ' + vue.deck.length));
  tete.append(barre);
  boite.append(tete);

  const carte = h('div', 'soiree__carte');
  carte.append(vignette(film));
  const infos = h('div', 'soiree__infos');
  infos.append(h('strong', 'soiree__nom', film.title));
  infos.append(h('span', 'soiree__meta', (film.kind === 'tv' ? 'Série' : 'Film') + (film.year ? ' · ' + film.year : '')));
  carte.append(infos);
  boite.append(carte);

  const choix = miens[film.key] || null;
  const rang = h('div', 'soiree__choix');
  const option = (valeur, texte, classe) => {
    const b = bouton('soiree__vote ' + classe + (choix === valeur ? ' est-choisi' : ''), texte, async () => {
      await voter(film.key, valeur);
      /* On avance tout seul : voter est un geste, pas une décision à confirmer. */
      if (etat.index < vue.deck.length - 1) { etat.index++; dessiner(); }
    });
    b.setAttribute('aria-pressed', String(choix === valeur));
    return b;
  };
  rang.append(option('non', 'Non', 'soiree__vote--non'));
  rang.append(option('peut', 'Peut-être', 'soiree__vote--peut'));
  rang.append(option('oui', 'Oui', 'soiree__vote--oui'));
  boite.append(rang);

  const nav = h('div', 'soiree__nav');
  nav.append(bouton('soiree__lien', '← Précédent', () => { if (etat.index > 0) { etat.index--; dessiner(); } }, { desactive: etat.index === 0 }));
  nav.append(h('span', 'soiree__compte', (etat.index + 1) + ' / ' + vue.deck.length));
  nav.append(bouton('soiree__lien', 'Suivant →', () => { if (etat.index < vue.deck.length - 1) { etat.index++; dessiner(); } }, { desactive: etat.index >= vue.deck.length - 1 }));
  boite.append(nav);

  /* Où en sont les autres — le nombre seulement, jamais le contenu. */
  const autres = h('div', 'soiree__autres');
  for (const j of vue.joueurs) {
    if (j.id === vue.moi?.id) continue;
    const puce = h('span', 'soiree__puce' + (j.aFini ? ' est-prete' : ''));
    puce.append(h('span', null, j.nom));
    puce.append(h('em', null, j.aFini ? 'a fini' : j.avancement + '/' + vue.deck.length));
    autres.append(puce);
  }
  boite.append(autres);

  if (vue.moi?.hote) {
    boite.append(bouton('soiree__lien', 'Tout le monde a fini — révéler maintenant', () => reveler()));
  }
  return boite;
}

async function voter(filmKey, choix) {
  const avant = etat.vue;
  /* On répond tout de suite à l'écran, et on corrige si le serveur refuse : sur
     un téléphone, attendre l'aller-retour rend le jeu poussif. */
  if (avant?.votes?.[avant.moi.id]) avant.votes[avant.moi.id][filmKey] = choix;
  try { await action('voter', { filmKey, choix }); }
  catch (e) { aviser(e.message); ecouter(); }
}

async function reveler() {
  try { await action('reveler'); } catch (e) { aviser(e.message); }
}

/* ── L'écran : la révélation ──────────────────────────────────────────────── */

function ecranRevelation() {
  const vue = etat.vue;
  const boite = h('div', 'soiree__revelation');
  const gagnant = vue.classement?.[0];

  boite.append(h('p', 'soiree__etiquette', vue.manche > 1 ? 'Manche ' + vue.manche : 'Le verdict'));
  if (!gagnant) return boite;

  const tete = h('div', 'soiree__gagnant');
  tete.append(vignette(gagnant.film));
  const bloc = h('div', 'soiree__gagnant-texte');
  bloc.append(h('strong', 'soiree__nom soiree__nom--grand', gagnant.film.title));
  bloc.append(h('span', 'soiree__meta', (gagnant.film.kind === 'tv' ? 'Série' : 'Film') + (gagnant.film.year ? ' · ' + gagnant.film.year : '')));
  bloc.append(h('p', 'soiree__raison', raison(gagnant, vue)));
  tete.append(bloc);
  boite.append(tete);

  const liste = h('ol', 'soiree__classement');
  for (const [i, ligne] of vue.classement.entries()) {
    const li = h('li', 'soiree__ligne' + (i === 0 ? ' est-gagnante' : ''));
    li.append(h('span', 'soiree__rang', String(i + 1)));
    li.append(vignette(ligne.film, 'w92'));
    const milieu = h('div', 'soiree__ligne-texte');
    milieu.append(h('strong', null, ligne.film.title));
    /* Qui a dit quoi : c'est le moment qu'on attend, on le montre en clair. */
    const voix = h('div', 'soiree__voix');
    for (const j of vue.joueurs) {
      const v = ligne.parJoueur[j.id];
      if (!v) continue;
      const marque = h('span', 'soiree__voix-item soiree__voix--' + v);
      marque.append(h('i', null, v === 'oui' ? '✓' : v === 'peut' ? '~' : '✕'));
      marque.append(h('span', null, j.nom));
      marque.title = j.nom + ' : ' + (v === 'oui' ? 'oui' : v === 'peut' ? 'peut-être' : 'non');
      voix.append(marque);
    }
    milieu.append(voix);
    li.append(milieu);
    liste.append(li);
  }
  boite.append(liste);

  const pied = h('div', 'soiree__pied');
  if (vue.moi?.hote) {
    pied.append(bouton('soiree__bouton soiree__bouton--fort', 'Nouvelle manche', async () => {
      try { await action('lobby'); } catch (e) { aviser(e.message); }
    }));
  } else {
    pied.append(h('p', 'soiree__note', 'L’hôte peut relancer une manche.'));
  }
  pied.append(bouton('soiree__lien', 'Quitter la soirée', () => quitter(true)));
  boite.append(pied);
  return boite;
}

function raison(ligne, vue) {
  const total = vue.joueurs.length;
  if (ligne.unanime) return 'Tout le monde est d’accord — ' + total + ' sur ' + total + '.';
  if (ligne.sansRefus) return 'Personne n’a dit non, et ' + ligne.oui + ' sur ' + total + ' en ont envie.';
  if (ligne.non === total) return 'Personne n’en veut. À oublier.';
  return ligne.oui + ' pour, ' + ligne.non + ' contre, ' + ligne.peut + ' hésitant' + (ligne.peut > 1 ? 's' : '') + '.';
}

/* ── Le dessin ────────────────────────────────────────────────────────────── */

function dessiner() {
  if (!racine || racine.hidden) return;
  const vue = etat.vue;

  const enveloppe = h('div', 'soiree');
  const barre = h('div', 'soiree__barre-haute');
  const fermer = bouton('soiree__fermer', '✕');
  fermer.setAttribute('aria-label', 'Fermer la soirée');
  fermer.addEventListener('click', () => fermerRoom());
  barre.append(h('span', 'soiree__marque', 'SOIRÉE'));
  if (vue) {
    const sortir = bouton('soiree__lien soiree__lien--discret', 'Quitter', () => quitter(true));
    barre.append(sortir);
  }
  barre.append(fermer);
  enveloppe.append(barre);

  if (etat.erreur) {
    const alerte = h('p', 'soiree__alerte', etat.erreur);
    alerte.setAttribute('role', 'alert');
    enveloppe.append(alerte);
  }

  if (!vue) enveloppe.append(ecranAccueil());
  else if (vue.phase === 'lobby') enveloppe.append(ecranLobby());
  else if (vue.phase === 'manche') enveloppe.append(ecranManche());
  else enveloppe.append(ecranRevelation());

  racine.replaceChildren(enveloppe);
}

/* ── Entrées et sorties ───────────────────────────────────────────────────── */

export function initRoom(dependances = {}) {
  deps = { ...deps, ...dependances };
  racine = document.getElementById('soiree');
  if (!racine) return;

  const garde = charger();
  etat.base = deps.base || baseParDefaut();
  etat.nom = garde.nom || '';
  if (garde.base) etat.base = garde.base;

  /* Le lien d'invitation : `?soiree=CODE`. On rejoint directement, sans rien
     taper — c'est ce que reçoit celui à qui l'hôte a envoyé l'adresse. */
  const voulu = normaliserCode(new URLSearchParams(location.search).get('soiree') || '');
  if (voulu.length === 6) {
    etat.code = voulu;
    etat.joueurId = garde.code === voulu ? (garde.joueurId || '') : '';
    /* Le lien DOIT ouvrir la soirée : sans cela, l'invité arrive sur le
       catalogue et ne comprend pas pourquoi on lui a envoyé ça. */
    racine.hidden = false;
    document.body.classList.add('soiree-ouverte');
    if (etat.nom) {
      rejoindreDepuisLien(voulu);
    } else {
      /* On ne connaît pas encore son nom : on le demande, le code déjà rempli.
         Rejoindre sous « Invité » puis le renommer serait plus court pour nous
         et plus confus pour lui. */
      etat.accueilCode = voulu;
      dessiner();
    }
  }
}

async function rejoindreDepuisLien(code) {
  dessiner();
  try {
    const r = await appel('/api/rejoindre', { code, nom: etat.nom || 'Invité', joueurId: etat.joueurId || null });
    etat.code = r.code; etat.joueurId = r.joueurId;
    retenir({ base: etat.base, nom: etat.nom, code: r.code, joueurId: r.joueurId });
    ecouter();
  } catch (e) { aviser(e.message); }
}

export function ouvrirRoom() {
  if (!racine) return;
  racine.hidden = false;
  document.body.classList.add('soiree-ouverte');
  deps.ouvrir?.();
  /* Si on avait déjà une place, on la reprend sans repasser par l'accueil. */
  const garde = charger();
  if (!etat.vue && garde.code && garde.joueurId && garde.base === etat.base) {
    etat.code = garde.code;
    etat.joueurId = garde.joueurId;
    rejoindreDepuisLien(garde.code);
  }
  dessiner();
}

export function fermerRoom() {
  racine.hidden = true;
  document.body.classList.remove('soiree-ouverte');
  deps.fermer?.();
}

function quitter(prevenir) {
  if (prevenir && etat.code && etat.joueurId) action('partir').catch(() => { });
  etat.flux?.close();
  etat.flux = null;
  etat.vue = null;
  etat.code = '';
  etat.joueurId = '';
  retenir({ code: '', joueurId: '' });
  dessiner();
}
