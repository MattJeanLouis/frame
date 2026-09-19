/**
 * Le mode Soirée : on compose une table de films à plusieurs, puis on les
 * oppose deux par deux jusqu'à ce qu'il n'en reste qu'un.
 *
 * POURQUOI UN TOURNOI
 *
 * La première version faisait voter chacun dans son coin sur douze films, et le
 * classement tombait à la fin. C'était un sondage, pas un jeu : personne ne
 * vivait rien ensemble, et il fallait se prononcer douze fois sur des films
 * qu'on n'avait pas choisis. Ici, deux affiches s'affrontent, le groupe vote sur
 * CES deux-là, et le résultat s'affiche tout de suite. On commente, on râle, on
 * retourne sa veste au duel suivant — c'est ça, une soirée.
 *
 * Chaque film appartient à quelqu'un : on apporte ce qu'on veut défendre, et le
 * nom du parrain apparaît au verdict.
 *
 * La règle que porte tout ce fichier : pendant un duel, on ne montre JAMAIS le
 * vote des autres. Le serveur ne les envoie d'ailleurs pas — ce n'est pas une
 * politesse de l'interface, c'est une règle du serveur.
 */
import { normaliserCode, PIOCHER_DEFAUT } from '../../room/rooms.js';

const CLE = 'frame.soiree';
const POSTER = 'https://image.tmdb.org/t/p/';

let deps = { films: () => [], chercher: async () => [], annoncer: () => { } };
let racine = null;
let etat = {
  base: '', nom: '', code: '', joueurId: '',
  vue: null, flux: null, erreur: '', occupe: false, accueilCode: '',
  recherche: '', resultats: [], cherchant: false
};

/* ── Le stockage : revenir, c'est reprendre sa place ──────────────────────── */

const charger = () => {
  try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch { return {}; }
};
const retenir = patch => {
  try { localStorage.setItem(CLE, JSON.stringify({ ...charger(), ...patch })); } catch { /* sans stockage, on rejoint à la main */ }
};

/* ── Le réseau ────────────────────────────────────────────────────────────── */

/** L'adresse du serveur de soirée. Par défaut celui qui a servi la page : si on
 *  est arrivé par le lien de l'hôte, il n'y a rien à configurer. */
function baseParDefaut() {
  const garde = charger().base;
  if (garde) return garde;
  if (location.port === '8092') return location.origin;
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
    /* La panne la plus fréquente, de loin : le serveur ne tourne pas, ou
       l'adresse n'est pas la sienne. « Failed to fetch » ne dit rien à
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
  etat.flux = new EventSource(etat.base.replace(/\/$/, '') + '/api/flux?code=' +
    encodeURIComponent(etat.code) + '&joueur=' + encodeURIComponent(etat.joueurId));
  etat.flux.onmessage = event => {
    let charge;
    try { charge = JSON.parse(event.data); } catch { return; }
    if (charge.type === 'erreur') { aviser(charge.message); return; }
    if (charge.type === 'fermee') { quitter(false); aviser('La soirée a expiré.'); return; }
    if (charge.type !== 'etat') return;
    etat.vue = charge.vue;
    etat.erreur = '';
    dessiner();
  };
  etat.flux.onerror = () => {
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
  if (film?.poster) img.src = POSTER + taille + film.poster;
  else img.classList.add('soiree__affiche--vide');
  return img;
}

/* ── L'écran : accueil ────────────────────────────────────────────────────── */

function ecranAccueil() {
  const boite = h('div', 'soiree__accueil');
  boite.append(h('p', 'soiree__intro',
    'Chacun apporte des films, puis ils s’affrontent deux par deux. On vote à chaque duel, et le résultat tombe tout de suite.'));

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

  boite.append(bouton('soiree__bouton soiree__bouton--fort', 'Créer une soirée', async () => {
    if (etat.occupe) return;
    etat.occupe = true; etat.erreur = '';
    try {
      const r = await appel('/api/creer', { nom: etat.nom });
      etat.code = r.code; etat.joueurId = r.joueurId;
      retenir({ base: etat.base, nom: etat.nom, code: r.code, joueurId: r.joueurId });
      ecouter();
    } catch (e) { aviser('Impossible de créer la soirée : ' + e.message); }
    finally { etat.occupe = false; dessiner(); }
  }));

  boite.append(h('p', 'soiree__ou', 'ou'));

  const code = h('label', 'soiree__champ');
  code.append(h('span', null, 'Code de la soirée'));
  const champCode = h('input');
  champCode.type = 'text';
  champCode.maxLength = 8;
  champCode.placeholder = 'ABC123';
  champCode.className = 'soiree__code-champ';
  champCode.value = etat.accueilCode || '';
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
    'L’hôte lance « npm run room » et donne l’adresse affichée. Tout reste sur le réseau local.'));
  boite.append(details);
  return boite;
}

/* ── L'écran : la table ───────────────────────────────────────────────────── */

function ecranLobby() {
  const vue = etat.vue;
  const boite = h('div', 'soiree__lobby');

  const entete = h('div', 'soiree__code-bloc');
  entete.append(h('span', 'soiree__etiquette', 'Code de la soirée'));
  entete.append(h('strong', 'soiree__code', vue.code));
  const lien = location.origin + location.pathname + '?soiree=' + vue.code;
  entete.append(bouton('soiree__bouton soiree__bouton--petit', 'Copier le lien', async () => {
    try {
      await navigator.clipboard.writeText(lien);
      aviser('Lien copié. Envoie-le, ils n’ont plus qu’à ouvrir.');
    } catch { aviser('Copie impossible. Le lien est : ' + lien); }
  }));
  boite.append(entete);

  boite.append(h('h3', 'soiree__titre-section', vue.joueurs.length > 1 ? 'Autour de la table' : 'Pour l’instant, toi'));
  const liste = h('ul', 'soiree__joueurs');
  for (const j of vue.joueurs) {
    const li = h('li');
    li.append(h('span', 'soiree__point'));
    li.append(h('span', 'soiree__qui', j.nom));
    if (j.hote) li.append(h('em', 'soiree__role', 'hôte'));
    if (j.id === vue.moi?.id) li.append(h('em', 'soiree__role', 'toi'));
    li.append(h('em', 'soiree__apports', j.apports ? j.apports + ' film' + (j.apports > 1 ? 's' : '') : 'rien apporté'));
    liste.append(li);
  }
  boite.append(liste);

  boite.append(buildChercheur());
  boite.append(buildTable());

  const pied = h('div', 'soiree__pied');
  const manque = vue.limites.min - vue.deck.length;
  const assezDeJoueurs = vue.joueurs.length >= 2;
  if (vue.moi?.hote) {
    pied.append(bouton('soiree__bouton soiree__bouton--fort', 'Lancer les duels', async () => {
      if (etat.occupe) return;
      etat.occupe = true;
      try {
        const theme = document.querySelector('#collection-note')?.textContent || '';
        await action('lancer', { theme });
      } catch (e) { aviser(e.message); }
      finally { etat.occupe = false; }
    }, { desactive: manque > 0 || !assezDeJoueurs }));
    if (!assezDeJoueurs) pied.append(h('p', 'soiree__note', 'Il faut être au moins deux.'));
    else if (manque > 0) pied.append(h('p', 'soiree__note',
      'Encore ' + manque + ' film' + (manque > 1 ? 's' : '') + ' et on peut commencer.'));
  } else {
    pied.append(h('p', 'soiree__note', 'C’est ' + (vue.joueurs.find(j => j.hote)?.nom || 'l’hôte') + ' qui lance les duels.'));
  }
  pied.append(bouton('soiree__lien', '← Retour au catalogue', () => fermerRoom()));
  boite.append(pied);
  return boite;
}

/** Chercher n'importe quel film de TMDB et l'apporter à la table. */
function buildChercheur() {
  const vue = etat.vue;
  const bloc = h('div', 'soiree__chercheur');
  bloc.append(h('h3', 'soiree__titre-section', 'Apporte un film'));

  const reste = vue.limites.apports - (vue.moi?.apports || 0);
  const champ = h('input');
  champ.type = 'search';
  champ.className = 'soiree__recherche';
  champ.placeholder = 'Chercher un film, une série…';
  champ.value = etat.recherche;
  champ.setAttribute('aria-label', 'Chercher un film à apporter');
  champ.disabled = reste <= 0;
  champ.addEventListener('input', () => {
    etat.recherche = champ.value;
    clearTimeout(champ.__minuteur);
    if (champ.value.trim().length < 2) { etat.resultats = []; dessiner(); return; }
    champ.__minuteur = setTimeout(async () => {
      etat.cherchant = true; dessiner();
      try { etat.resultats = await deps.chercher(champ.value.trim()); }
      catch { etat.resultats = []; }
      etat.cherchant = false;
      dessiner();
      /* Le champ est reconstruit à chaque dessin : on lui rend le focus et le
         curseur, sinon écrire devient impossible dès la première lettre. */
      const neuf = document.querySelector('.soiree__recherche');
      if (neuf) { neuf.focus(); neuf.setSelectionRange(neuf.value.length, neuf.value.length); }
    }, 320);
  });
  bloc.append(champ);
  bloc.append(h('p', 'soiree__note', reste > 0
    ? 'Tu peux encore en apporter ' + reste + '.'
    : 'Tu as apporté tout ce que tu pouvais.'));

  if (etat.cherchant) bloc.append(h('p', 'soiree__note', 'Recherche…'));
  if (etat.resultats.length) {
    const grille = h('div', 'soiree__resultats');
    for (const f of etat.resultats) {
      const dejaLa = vue.deck.some(d => d.key === f.key);
      const carte = bouton('soiree__resultat' + (dejaLa ? ' est-prise' : ''), '', async () => {
        try { await action('apporter', { film: f }); etat.recherche = ''; etat.resultats = []; }
        catch (e) { aviser(e.message); }
      }, { desactive: dejaLa });
      carte.append(vignette(f, 'w185'));
      carte.append(h('span', 'soiree__resultat-titre', f.title));
      carte.append(h('span', 'soiree__resultat-meta',
        (f.kind === 'tv' ? 'Série' : 'Film') + (f.year ? ' · ' + f.year : '') + (dejaLa ? ' · déjà sur la table' : '')));
      grille.append(carte);
    }
    bloc.append(grille);
  }
  return bloc;
}

/** La table : ce que tout le monde a apporté. */
function buildTable() {
  const vue = etat.vue;
  const bloc = h('div', 'soiree__table');
  const tete = h('div', 'soiree__table-tete');
  tete.append(h('h3', 'soiree__titre-section', 'Sur la table'));
  tete.append(h('span', 'soiree__compte', vue.deck.length + ' / ' + vue.limites.max));

  const proposeables = deps.films() || [];
  if (vue.moi?.hote && proposeables.length && vue.deck.length < vue.limites.max) {
    tete.append(bouton('soiree__bouton soiree__bouton--petit', 'Piocher dans le catalogue', async () => {
      try {
        const r = await action('piocher', { films: proposeables.slice(0, PIOCHER_DEFAUT) });
        if (r && r.ajoutes === 0) aviser('Rien à piocher : la table est pleine.');
      } catch (e) { aviser(e.message); }
    }));
  }
  bloc.append(tete);

  if (!vue.deck.length) {
    bloc.append(h('p', 'soiree__note', 'La table est vide. Cherche un film ci-dessus, ou pioche dans le catalogue.'));
    return bloc;
  }
  const liste = h('ul', 'soiree__films');
  for (const f of vue.deck) {
    const li = h('li', 'soiree__film');
    li.append(vignette(f, 'w92'));
    const texte = h('div', 'soiree__film-texte');
    texte.append(h('strong', null, f.title));
    /* Le type et l'année sont une étiquette technique ; le nom de qui l'a
       apporté est une phrase. Les mettre dans le même span les passait tous les
       deux en capitales — et un nom de personne en capitales, dans une
       étiquette, ne se lit pas comme un nom. */
    texte.append(h('span', 'soiree__meta', (f.kind === 'tv' ? 'Série' : 'Film') + (f.year ? ' · ' + f.year : '')));
    texte.append(h('span', 'soiree__parrain', f.parrainNom
      ? 'apporté par ' + f.parrainNom
      : 'pioché dans le catalogue'));
    li.append(texte);
    if (!f.parrain || f.parrain === vue.moi?.id || vue.moi?.hote) {
      const croix = bouton('soiree__retirer', '✕', async () => {
        try { await action('retirer', { filmKey: f.key }); } catch (e) { aviser(e.message); }
      });
      croix.setAttribute('aria-label', 'Retirer ' + f.title);
      li.append(croix);
    }
    liste.append(li);
  }
  bloc.append(liste);
  return bloc;
}

/* ── L'écran : les duels ──────────────────────────────────────────────────── */

function ecranDuels() {
  const vue = etat.vue;
  const duel = vue.duel;
  const boite = h('div', 'soiree__duels');
  if (!duel) return boite;

  const tete = h('div', 'soiree__progression');
  tete.append(h('span', 'soiree__etiquette',
    'Tour ' + vue.avancement.tour + (vue.avancement.tours > 1 ? ' / ' + vue.avancement.tours : '')));
  tete.append(h('span', 'soiree__compte', duel.votants + ' / ' + vue.joueurs.length + ' ont voté'));
  boite.append(tete);

  /* Les deux affiches, côte à côte. C'est tout le jeu : deux films, un choix. */
  const arene = h('div', 'soiree__arene' + (duel.resolu ? ' est-resolue' : ''));
  const camp = (cote, film) => {
    const gagnant = duel.resolu && duel.gagnant === film?.key;
    const perdu = duel.resolu && !gagnant;
    const choisi = duel.monVote === cote;
    const b = bouton('soiree__camp' + (gagnant ? ' est-gagnant' : '') + (perdu ? ' est-perdu' : '') +
      (choisi && !duel.resolu ? ' est-choisi' : ''), '', async () => {
      if (duel.resolu) return;
      try { await action('voter', { choix: cote }); } catch (e) { aviser(e.message); }
    }, { desactive: duel.resolu });
    b.append(vignette(film, 'w500'));
    const bas = h('div', 'soiree__camp-texte');
    bas.append(h('strong', null, film?.title || 'Film retiré'));
    bas.append(h('span', 'soiree__meta', (film?.kind === 'tv' ? 'Série' : 'Film') + (film?.year ? ' · ' + film.year : '')));
    if (film?.parrainNom) bas.append(h('span', 'soiree__parrain', 'apporté par ' + film.parrainNom));
    b.append(bas);
    if (duel.resolu && duel.score) b.append(h('span', 'soiree__score', String(cote === 'a' ? duel.score.a : duel.score.b)));
    if (choisi && !duel.resolu) b.append(h('span', 'soiree__monvote', 'ton choix'));
    return b;
  };
  arene.append(camp('a', duel.filmA));
  arene.append(h('span', 'soiree__vs', 'ou'));
  arene.append(camp('b', duel.filmB));
  boite.append(arene);

  if (duel.resolu) {
    /* Ce qui vient de se passer — c'est le moment qu'on commente. */
    const verdict = h('div', 'soiree__verdict-duel');
    const gagnant = vue.deck.find(f => f.key === duel.gagnant);
    verdict.append(h('p', 'soiree__issue',
      (duel.egalite ? 'Égalité — ' : '') + (gagnant?.title || 'Le film') + ' passe.'));
    const voix = h('div', 'soiree__voix');
    for (const j of vue.joueurs) {
      const v = duel.votes?.[j.id];
      if (!v) continue;
      const item = h('span', 'soiree__voix-item');
      item.append(h('span', null, j.nom));
      item.append(h('em', null, v === 'a' ? (duel.filmA?.title || '') : (duel.filmB?.title || '')));
      voix.append(item);
    }
    verdict.append(voix);
    boite.append(verdict);
  } else {
    const attente = h('div', 'soiree__attente');
    for (const j of vue.joueurs) {
      const puce = h('span', 'soiree__puce' + (j.aVote ? ' est-prete' : ''));
      puce.append(h('span', null, j.nom));
      puce.append(h('em', null, j.aVote ? 'a voté' : 'réfléchit'));
      attente.append(puce);
    }
    boite.append(attente);
  }

  if (vue.moi?.hote) {
    const outils = h('div', 'soiree__outils');
    if (!duel.resolu) {
      outils.append(bouton('soiree__lien', 'Dépouiller maintenant', async () => {
        try { await action('depouiller'); } catch (e) { aviser(e.message); }
      }));
    } else {
      outils.append(bouton('soiree__lien', 'Duel suivant →', async () => {
        try { await action('passer'); } catch (e) { aviser(e.message); }
      }));
    }
    /* On peut toujours revenir à la table : « on a oublié un film » arrive tout
       le temps, et sans cette porte il fallait finir le tournoi pour ça. */
    outils.append(bouton('soiree__lien', 'Changer les films', async () => {
      try { await action('lobby'); } catch (e) { aviser(e.message); }
    }));
    boite.append(outils);
  }
  boite.append(buildTableau());
  return boite;
}

/** Le chemin parcouru : le tableau des duels déjà joués. */
function buildTableau() {
  const tours = etat.vue?.tableau || [];
  if (!tours.some(t => t.duels.some(d => d.gagnant))) return h('div');
  const bloc = h('details', 'soiree__tableau');
  bloc.append(h('summary', null, 'Le tableau'));
  for (const t of tours) {
    const ligne = h('div', 'soiree__tableau-tour');
    ligne.append(h('span', 'soiree__etiquette', 'Tour ' + t.tour));
    for (const d of t.duels) {
      const item = h('span', 'soiree__tableau-duel' + (d.gagnant ? '' : ' est-en-cours'));
      item.append(h('span', d.gagnant === d.a ? 'est-passe' : 'est-sorti', d.titreA || '?'));
      item.append(h('em', null, d.score ? d.score.a + '–' + d.score.b : 'à venir'));
      item.append(h('span', d.gagnant === d.b ? 'est-passe' : 'est-sorti', d.titreB || '?'));
      ligne.append(item);
    }
    bloc.append(ligne);
  }
  return bloc;
}

/* ── L'écran : le verdict ─────────────────────────────────────────────────── */

function ecranVerdict() {
  const vue = etat.vue;
  const b = vue.bilan;
  const boite = h('div', 'soiree__verdict');
  boite.append(h('p', 'soiree__etiquette', 'Le verdict'));
  if (!b?.gagnant) return boite;

  const tete = h('div', 'soiree__gagnant');
  tete.append(vignette(b.gagnant, 'w342'));
  const texte = h('div', 'soiree__gagnant-texte');
  texte.append(h('strong', 'soiree__nom soiree__nom--grand', b.gagnant.title));
  texte.append(h('span', 'soiree__meta',
    (b.gagnant.kind === 'tv' ? 'Série' : 'Film') + (b.gagnant.year ? ' · ' + b.gagnant.year : '')));
  texte.append(h('p', 'soiree__raison', b.gagnant.parrainNom
    ? 'C’est le film de ' + b.gagnant.parrainNom + '.'
    : 'Personne ne l’avait apporté : il vient du catalogue.'));
  tete.append(texte);
  boite.append(tete);

  /* Le bilan : ce que la soirée a raconté, au-delà du gagnant. */
  const faits = h('ul', 'soiree__faits');
  const fait = (titre, detail) => {
    const li = h('li');
    li.append(h('strong', null, titre));
    li.append(h('span', null, detail));
    faits.append(li);
  };
  const nom = cle => vue.deck.find(f => f.key === cle)?.title || '?';
  fait(b.joues + ' duel' + (b.joues > 1 ? 's' : ''), b.serres
    ? 'dont ' + b.serres + ' joué' + (b.serres > 1 ? 's' : '') + ' à une voix près'
    : 'aucun ne s’est joué à une voix près');
  if (b.plusDivisant?.total) {
    fait('Le plus clivant', nom(b.plusDivisant.a) + ' contre ' + nom(b.plusDivisant.b) +
      ' — ' + b.plusDivisant.score.a + '–' + b.plusDivisant.score.b);
  }
  /* On ne répète pas « le plus net » quand c'est le même duel que le plus
     clivant : deux lignes identiques se lisent comme un bug. */
  if (b.plusNet?.total && b.plusNet.ecart > (b.plusDivisant?.ecart ?? -1)) {
    fait('Le plus net', nom(b.plusNet.a) + ' contre ' + nom(b.plusNet.b) +
      ' — ' + b.plusNet.score.a + '–' + b.plusNet.score.b);
  }
  if (b.plusSoutenu?.voix > 0) {
    fait('Le plus soutenu', b.plusSoutenu.film.title + ', ' + b.plusSoutenu.voix + ' voix au total' +
      (b.plusSoutenu.film.key === b.gagnant.key ? ' — et il a gagné' : ' — mais il n’a pas gagné'));
  }
  boite.append(faits);

  boite.append(buildTableau());

  const pied = h('div', 'soiree__pied');
  if (vue.moi?.hote) {
    pied.append(bouton('soiree__bouton soiree__bouton--fort', 'Rejouer avec les mêmes films', async () => {
      try { await action('rejouer'); } catch (e) { aviser(e.message); }
    }));
    pied.append(bouton('soiree__bouton', 'Changer les films', async () => {
      try { await action('lobby'); } catch (e) { aviser(e.message); }
    }));
  } else {
    pied.append(h('p', 'soiree__note', 'L’hôte peut relancer une partie.'));
  }
  pied.append(bouton('soiree__lien', 'Quitter la soirée', () => quitter(true)));
  boite.append(pied);
  return boite;
}

/* ── Le dessin ────────────────────────────────────────────────────────────── */

function dessiner() {
  if (!racine || racine.hidden) return;
  const vue = etat.vue;

  const enveloppe = h('div', 'soiree');
  const barre = h('div', 'soiree__barre-haute');
  barre.append(h('span', 'soiree__marque', 'SOIRÉE'));
  if (vue) barre.append(bouton('soiree__lien soiree__lien--discret', 'Quitter', () => quitter(true)));
  const fermer = bouton('soiree__fermer', '✕');
  fermer.setAttribute('aria-label', 'Fermer la soirée');
  fermer.addEventListener('click', () => fermerRoom());
  barre.append(fermer);
  enveloppe.append(barre);

  if (etat.erreur) {
    const alerte = h('p', 'soiree__alerte', etat.erreur);
    alerte.setAttribute('role', 'alert');
    enveloppe.append(alerte);
  }

  if (!vue) enveloppe.append(ecranAccueil());
  else if (vue.phase === 'lobby') enveloppe.append(ecranLobby());
  else if (vue.phase === 'duels') enveloppe.append(ecranDuels());
  else enveloppe.append(ecranVerdict());

  racine.replaceChildren(enveloppe);
}

/* ── Entrées et sorties ───────────────────────────────────────────────────── */

export function initRoom(dependances = {}) {
  deps = { ...deps, ...dependances };
  racine = document.getElementById('soiree');
  if (!racine) return;

  const garde = charger();
  etat.base = garde.base || baseParDefaut();
  etat.nom = garde.nom || '';

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
    if (etat.nom) rejoindreDepuisLien(voulu);
    else { etat.accueilCode = voulu; dessiner(); }
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
  etat.recherche = '';
  etat.resultats = [];
  retenir({ code: '', joueurId: '' });
  dessiner();
}
