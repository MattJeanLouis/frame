/**
 * Le profil, et la synchronisation entre appareils.
 *
 * Pas de compte : un nom, un avatar, et un CODE. Le code est la clé d'un coffre
 * où l'on range ce qu'on a dit des films qu'on a vus. On le recopie une fois sur
 * l'autre appareil, et les deux se rejoignent.
 *
 * Ce qui se synchronise : les états, les signatures, les commentaires et les
 * films de « Ma liste ». Ce qui ne se synchronise pas : la position dans le
 * catalogue, les filtres en cours, et l'historique de la soirée — ce sont des
 * choses du moment, pas de la mémoire.
 */
import {
  codeProfil, codeLisible, codeValide, normaliserCode,
  documentDe, documentVide, fusionner, etatDe, differences,
  listePublique, versFichier, depuisFichier
} from '../../src/profil.js';

const RELAIS = '/.netlify/functions/profil';
const RELAIS_LISTE = '/.netlify/functions/liste';
const CLE = 'frame.profil';

/* Une douzaine de figures : assez pour se reconnaître, pas une palette. */
const AVATARS = ['🦖', '🐉', '👽', '🦊', '🐙', '🌙', '🔥', '🧭', '🎬', '🍿', '🎧', '🕶️'];

let deps = { etat: () => ({}), appliquer: () => { }, annoncer: () => { } };
let racine = null;
let etat = { nom: '', avatar: '', code: '', occupe: false, erreur: '', message: '', dernier: null, saisie: false, partage: '' };

/* ── Le stockage local de l'identité ──────────────────────────────────────── */

const charger = () => {
  try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch { return {}; }
};
const retenir = patch => {
  try { localStorage.setItem(CLE, JSON.stringify({ ...charger(), ...patch })); } catch { /* sans stockage, on ressaisit */ }
};
const profilLocal = () => ({ nom: etat.nom, avatar: etat.avatar });

/* ── Le réseau ────────────────────────────────────────────────────────────── */

async function appel(methode, code, doc) {
  let r;
  try {
    r = await fetch(RELAIS + '?code=' + encodeURIComponent(normaliserCode(code)), {
      method: methode,
      headers: doc ? { 'content-type': 'application/json' } : undefined,
      body: doc ? JSON.stringify({ doc }) : undefined
    });
  } catch {
    throw new Error('Le serveur ne répond pas. La synchronisation a besoin d’Internet.');
  }
  let données = null;
  try { données = await r.json(); } catch { /* réponse non-JSON */ }
  if (!r.ok) throw new Error(données?.erreur || ('Le serveur a répondu ' + r.status));
  if (données === null) throw new Error('Réponse inattendue du serveur.');
  return données;
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

function aviser(message, genre = 'erreur') {
  if (genre === 'erreur') { etat.erreur = message; etat.message = ''; }
  else { etat.message = message; etat.erreur = ''; }
  deps.annoncer?.(message);
  dessiner();
}

/* ── La synchronisation ───────────────────────────────────────────────────── */

/**
 * Le geste, dans cet ordre : lire ce que le serveur a, FUSIONNER avec ce qu'on a
 * ici, appliquer le résultat, puis renvoyer le tout.
 *
 * L'ordre compte. Renvoyer d'abord écraserait l'autre appareil ; fusionner
 * d'abord ne peut rien perdre, et renvoyer ensuite met les deux d'accord.
 */
async function synchroniser(code, { silencieux = false } = {}) {
  if (etat.occupe) return;
  etat.occupe = true; etat.erreur = ''; etat.message = '';
  dessiner();
  try {
    const avant = deps.etat();
    const local = documentDe(avant, profilLocal(), Date.now());
    const { doc: distant } = await appel('GET', code);
    const fusion = fusionner(local, distant || documentVide());
    const apres = etatDe(fusion);
    const change = differences(avant, apres);
    deps.appliquer(apres);
    await appel('POST', code, fusion);
    etat.dernier = { ...change, quand: Date.now(), premiere: !distant };
    if (!silencieux) aviser(phrase(change, !distant), 'ok');
    else dessiner();
  } catch (e) {
    aviser(e.message);
  } finally {
    etat.occupe = false;
    dessiner();
  }
}

function phrase(change, premiere) {
  const total = change.marques + change.avis + change.commentaires + change.films;
  if (premiere) return 'Profil synchronisé. Ce que tu avais ici est maintenant rangé sous ton code.';
  if (!total) return 'Déjà à jour — les deux appareils disent la même chose.';
  return 'Synchronisé : ' + total + ' titre' + (total > 1 ? 's' : '') + ' rejoint' + (total > 1 ? 's' : '') + ' depuis l’autre appareil.';
}

/* ── Le dessin ────────────────────────────────────────────────────────────── */

function dessiner() {
  if (!racine || racine.hidden) return;
  const enveloppe = h('div', 'profil');

  const barre = h('div', 'profil__barre');
  barre.append(h('span', 'profil__marque', 'PROFIL'));
  const fermer = bouton('profil__fermer', '✕');
  fermer.setAttribute('aria-label', 'Fermer le profil');
  fermer.addEventListener('click', () => fermerProfil());
  barre.append(fermer);
  enveloppe.append(barre);

  if (etat.erreur) {
    const a = h('p', 'profil__alerte', etat.erreur);
    a.setAttribute('role', 'alert');
    enveloppe.append(a);
  } else if (etat.message) {
    enveloppe.append(h('p', 'profil__succes', etat.message));
  }

  enveloppe.append(blocIdentite());
  enveloppe.append(blocSauvegarde());
  enveloppe.append(blocSynchronisation());
  /* Le partage est INDÉPENDANT de la synchronisation : on peut vouloir montrer
     sa liste sans relier d'appareil. L'enfermer dans le bloc de synchronisation
     le rendait invisible tant qu'on n'avait pas créé de code. */
  enveloppe.append(blocPartage());
  /* Le champ de saisie fait partie du dessin : sans cela, une erreur de code le
     faisait disparaître et il fallait tout recommencer. */
  if (etat.saisie) enveloppe.append(blocSaisie());

  /* Le miroir reste où il est : le profil montre qui tu es, le miroir montre ce
     que tu aimes. On ne refait pas l'un dans l'autre. */
  const lien = bouton('profil__lien', 'Voir mon miroir →', () => { fermerProfil(); deps.miroir?.(); });
  enveloppe.append(lien);

  racine.replaceChildren(enveloppe);
}

function blocIdentite() {
  const bloc = h('section', 'profil__bloc');
  bloc.append(h('h2', 'profil__titre', 'Qui tu es'));

  const tete = h('div', 'profil__tete');
  const figure = h('span', 'profil__avatar', etat.avatar || '🎬');
  figure.setAttribute('aria-hidden', 'true');
  tete.append(figure);

  const nom = h('label', 'profil__champ');
  nom.append(h('span', null, 'Ton nom'));
  const champ = h('input');
  champ.type = 'text';
  champ.maxLength = 40;
  champ.value = etat.nom;
  champ.placeholder = 'Matt';
  champ.setAttribute('autocomplete', 'nickname');
  champ.addEventListener('input', () => {
    etat.nom = champ.value;
    retenir({ nom: etat.nom });
    /* On ne redessine pas : le champ perdrait le curseur à chaque lettre. */
  });
  nom.append(champ);
  tete.append(nom);
  bloc.append(tete);

  const choix = h('div', 'profil__avatars');
  choix.setAttribute('role', 'group');
  choix.setAttribute('aria-label', 'Choisir une figure');
  for (const figure2 of AVATARS) {
    const b = bouton('profil__avatar-choix' + (etat.avatar === figure2 ? ' est-choisi' : ''), figure2, () => {
      etat.avatar = etat.avatar === figure2 ? '' : figure2;
      retenir({ avatar: etat.avatar });
      dessiner();
    });
    b.setAttribute('aria-pressed', String(etat.avatar === figure2));
    b.setAttribute('aria-label', 'Figure ' + figure2);
    choix.append(b);
  }
  bloc.append(choix);
  return bloc;
}

/**
 * Emporter, rapporter, montrer.
 *
 * L'export est la seule sauvegarde qui ne dépend de PERSONNE : ni d'un serveur,
 * ni d'un navigateur, ni d'un code. C'est aussi le seul pont entre deux adresses
 * — `localhost` et le site publié sont deux stockages différents, et sans
 * fichier il n'y en a aucun.
 */
function blocSauvegarde() {
  const bloc = h('section', 'profil__bloc');
  const total = Object.keys(deps.etat().marks || {}).length;
  bloc.append(h('h2', 'profil__titre', 'Ta liste'));
  bloc.append(h('p', 'profil__note', total
    ? total + ' titre' + (total > 1 ? 's' : '') + ' dans ta liste. Exporte-la avant de changer d’adresse : ' +
      'le site publié et cette page ne partagent pas le même rangement.'
    : 'Ta liste est vide pour l’instant.'));

  const actions = h('div', 'profil__actions');

  actions.append(bouton('profil__bouton', 'Exporter ma liste', () => {
    const texte = versFichier(documentDe(deps.etat(), profilLocal(), Date.now()));
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
    lien.download = 'frame-' + new Date().toISOString().slice(0, 10) + '.json';
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 4000);
    aviser('Fichier exporté. Garde-le : c’est ta sauvegarde.', 'ok');
  }));

  const champ = h('input');
  champ.type = 'file';
  champ.accept = 'application/json,.json';
  champ.className = 'profil__fichier';
  champ.addEventListener('change', async () => {
    const fichier = champ.files?.[0];
    if (!fichier) return;
    try {
      const lu = depuisFichier(await fichier.text());
      if (lu.erreur) { aviser(lu.erreur); return; }
      const avant = deps.etat();
      const fusion = fusionner(documentDe(avant, profilLocal(), 0), lu.doc);
      const apres = etatDe(fusion);
      const change = differences(avant, apres);
      deps.appliquer(apres);
      const n = change.marques + change.avis + change.commentaires + change.films;
      aviser(n ? 'Importé : ' + n + ' titre' + (n > 1 ? 's' : '') + ' rejoint' + (n > 1 ? 's' : '') + '.'
        : 'Rien de neuf dans ce fichier — tout y était déjà.', 'ok');
    } catch (e) { aviser('Lecture impossible : ' + e.message); }
    finally { champ.value = ''; }
  });
  actions.append(bouton('profil__bouton', 'Importer un fichier', () => champ.click()));
  actions.append(champ);
  bloc.append(actions);

  bloc.append(h('p', 'profil__note profil__note--fine',
    'L’import ne remplace rien : il rejoint. Ce qui est dans le fichier s’ajoute à ce que tu as ici, ' +
    'et sur un même film c’est la modification la plus récente qui l’emporte.'));
  return bloc;
}

function blocSynchronisation() {
  const bloc = h('section', 'profil__bloc');
  bloc.append(h('h2', 'profil__titre', 'Tes deux appareils'));

  if (!etat.code) {
    bloc.append(h('p', 'profil__note',
      'Un code relie ton téléphone et ton ordinateur. Il n’y a ni inscription, ni mot de passe, ' +
      'ni adresse e-mail : le code EST la clé, et il n’ouvre que ton profil.'));
    bloc.append(bouton('profil__bouton profil__bouton--fort', 'Créer mon code', async () => {
      /* On RANGE la forme normalisée et on n'AFFICHE que la forme groupée.
         Ranger la forme groupée marchait par chance — `normaliserCode` la
         rattrapait à chaque appel — mais laissait deux formes du même code
         circuler, et c'est le genre d'écart qui finit par en casser une. */
      etat.code = normaliserCode(codeProfil());
      retenir({ code: etat.code });
      await synchroniser(etat.code);
    }, { desactive: etat.occupe }));
    bloc.append(bouton('profil__lien', 'J’ai déjà un code', () => { etat.saisie = true; etat.erreur = ''; dessiner(); }));
    return bloc;
  }

  const entete = h('div', 'profil__code-bloc');
  entete.append(h('span', 'profil__etiquette', 'Ton code'));
  entete.append(h('strong', 'profil__code', codeLisible(etat.code)));
  entete.append(bouton('profil__bouton profil__bouton--petit', 'Copier', async () => {
    try {
      await navigator.clipboard.writeText(codeLisible(etat.code));
      aviser('Code copié. Saisis-le sur ton autre appareil.', 'ok');
    } catch { aviser('Copie impossible. Le code est ' + codeLisible(etat.code), 'ok'); }
  }));
  bloc.append(entete);

  bloc.append(h('p', 'profil__note',
    'Sur ton autre appareil : Profil → « J’ai déjà un code », et saisis celui-ci. ' +
    'Ce que tu y as fait rejoindra ce que tu as fait ici — film par film, le plus récent gagnant.'));

  const actions = h('div', 'profil__actions');
  actions.append(bouton('profil__bouton', etat.occupe ? 'Synchronisation…' : 'Synchroniser maintenant',
    () => synchroniser(etat.code), { desactive: etat.occupe }));
  actions.append(bouton('profil__lien', 'Utiliser un autre code', () => {
    etat.code = ''; etat.dernier = null; retenir({ code: '' });
    etat.saisie = true; etat.erreur = ''; etat.message = '';
    dessiner();
  }));
  bloc.append(actions);

  if (etat.dernier) {
    const quand = new Date(etat.dernier.quand);
    bloc.append(h('p', 'profil__note',
      'Dernière synchronisation à ' + String(quand.getHours()).padStart(2, '0') + ':' +
      String(quand.getMinutes()).padStart(2, '0') + '.'));
  }

  bloc.append(h('p', 'profil__note profil__note--fine',
    'Ce qui suit : tes états, tes signatures, tes commentaires et ta liste. ' +
    'Ce qui ne suit pas : tes filtres en cours, ta position dans le catalogue, et l’historique d’une soirée.'));

  return bloc;
}

/**
 * Montrer sa liste — avec un AUTRE code.
 *
 * Le code de synchronisation ÉCRIT : le donner pour montrer sa liste
 * reviendrait à donner les clés de son carnet. Le code de partage ne fait que
 * LIRE un document séparé, qui ne contient que des affiches et des états. Ni
 * commentaires, ni avis, ni mots-clés : ils n'ont jamais été envoyés.
 */
function blocPartage() {
  const zone = h('section', 'profil__bloc profil__partage');
  zone.append(h('h2', 'profil__titre', 'Montrer ma liste'));
  const code = etat.partage || '';

  if (!code) {
    zone.append(h('p', 'profil__note',
      'Un lien que tu peux envoyer : il montre ta liste — les affiches et les états — ' +
      'et rien d’autre. Ce n’est pas ton code de synchronisation, et il ne permet pas d’y écrire.'));
    zone.append(bouton('profil__bouton', 'Créer un lien de partage', async () => {
      if (etat.occupe) return;
      etat.occupe = true; etat.erreur = '';
      try {
        const nouveau = codeProfil();
        await publierListe(nouveau);
        etat.partage = nouveau;
        retenir({ partage: nouveau });
        const lien = lienPartage(nouveau);
        try { await navigator.clipboard.writeText(lien); aviser('Lien copié : ' + lien, 'ok'); }
        catch { aviser('Lien créé : ' + lien, 'ok'); }
      } catch (e) { aviser(e.message); }
      finally { etat.occupe = false; dessiner(); }
    }, { desactive: etat.occupe }));
    return zone;
  }

  const lien = lienPartage(code);
  const bloc = h('div', 'profil__code-bloc');
  bloc.append(h('span', 'profil__etiquette', 'Ton lien de partage'));
  const champ = h('input');
  champ.type = 'text';
  champ.readOnly = true;
  champ.value = lien;
  champ.className = 'profil__lien-champ';
  champ.setAttribute('aria-label', 'Lien de partage de ta liste');
  champ.addEventListener('focus', () => champ.select());
  bloc.append(champ);
  bloc.append(bouton('profil__bouton profil__bouton--petit', 'Copier', async () => {
    try { await navigator.clipboard.writeText(lien); aviser('Lien copié.', 'ok'); }
    catch { aviser('Copie impossible. Le lien est ' + lien, 'ok'); }
  }));
  zone.append(bloc);

  const actions = h('div', 'profil__actions');
  actions.append(bouton('profil__bouton', etat.occupe ? 'Publication…' : 'Republier ma liste',
    async () => {
      if (etat.occupe) return;
      etat.occupe = true;
      try {
        const n = await publierListe(code);
        aviser('Liste republiée : ' + n + ' titre' + (n > 1 ? 's' : '') + ' en ligne.', 'ok');
      } catch (e) { aviser(e.message); }
      finally { etat.occupe = false; dessiner(); }
    }, { desactive: etat.occupe }));
  actions.append(bouton('profil__lien', 'Arrêter le partage', () => {
    etat.partage = ''; retenir({ partage: '' }); dessiner();
  }));
  zone.append(actions);
  zone.append(h('p', 'profil__note profil__note--fine',
    'Le lien publie une copie de ta liste au moment où tu le crées. Republie-le quand tu l’as changée. ' +
    '« Arrêter le partage » oublie le lien ici — préviens ceux à qui tu l’as donné.'));
  return zone;
}

const lienPartage = code =>
  location.origin + location.pathname + '?liste=' + codeLisible(code).replace(/-/g, '');

async function publierListe(code) {
  const doc = documentDe(deps.etat(), profilLocal(), Date.now());
  const liste = listePublique(doc, profilLocal());
  const n = Object.keys(liste.titres).length;
  if (!n) throw new Error('Ta liste est vide : il n’y a rien à publier.');
  let r;
  try {
    r = await fetch(RELAIS_LISTE + '?code=' + encodeURIComponent(code), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liste })
    });
  } catch { throw new Error('Le serveur ne répond pas. Le partage a besoin d’Internet.'); }
  const données = await r.json().catch(() => null);
  if (!r.ok) throw new Error(données?.erreur || ('Le serveur a répondu ' + r.status));
  return n;
}

/* ── Entrées et sorties ───────────────────────────────────────────────────── */

export function initProfil(dependances = {}) {
  deps = { ...deps, ...dependances };
  racine = document.getElementById('profil');
  if (!racine) return;
  const garde = charger();
  etat.nom = garde.nom || '';
  etat.avatar = garde.avatar || '';
  etat.code = garde.code || '';
  etat.partage = garde.partage || '';
}

export function ouvrirProfil() {
  if (!racine) return;
  racine.hidden = false;
  document.body.classList.add('profil-ouvert');
  deps.ouvrir?.();
  dessiner();
}

export function fermerProfil() {
  if (!racine) return;
  racine.hidden = true;
  document.body.classList.remove('profil-ouvert');
  deps.fermer?.();
}

/** Saisir un code reçu : une invite, plutôt qu'un champ de plus à l'écran. */
function blocSaisie() {
  const boite = h('div', 'profil__saisie');
  boite.append(h('p', 'profil__note', 'Saisis le code de ton autre appareil — douze signes.'));
  const champ = h('input');
  champ.type = 'text';
  champ.className = 'profil__code-champ';
  champ.placeholder = 'ABCD-EFGH-JKLM';
  champ.value = etat.saisieValeur || '';
  champ.setAttribute('aria-label', 'Code de ton autre appareil');
  champ.addEventListener('input', () => { etat.saisieValeur = champ.value; });
  boite.append(champ);
  const aller = bouton('profil__bouton profil__bouton--fort', 'Relier', async () => {
    if (!codeValide(champ.value)) { aviser('Un code fait exactement douze signes.'); return; }
    etat.code = normaliserCode(champ.value);
    etat.saisie = false; etat.saisieValeur = '';
    retenir({ code: etat.code });
    await synchroniser(etat.code);
  });
  champ.addEventListener('keydown', e => { if (e.key === 'Enter') aller.click(); });
  boite.append(aller);
  setTimeout(() => champ.focus(), 0);
  return boite;
}

export const codeCourant = () => etat.code;

/** Le nom et l'avatar, pour que la liste sache à qui elle est. */
export const profilCourant = () => ({ nom: etat.nom, avatar: etat.avatar });
