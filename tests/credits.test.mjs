import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLES, roleValide, libelleRole, roleDe, creditsPourRole, comptePourRole,
  classerSocietes, libelleSociete, societeUtilisable, typeSocieteValide
} from '../src/credits.js';

/* --- Les rôles ----------------------------------------------------------- */

test('trois rôles, et trois seulement', () => {
  assert.deepEqual(ROLES.map(r => r.id), ['realisation', 'production', 'jeu']);
});

test('chaque rôle se nomme et s’explique', () => {
  for (const r of ROLES) {
    assert.ok(r.label, r.id + ' sans libellé');
    assert.ok(r.dit && r.dit.length > 5, r.id + ' ne dit pas ce qu’il fait');
  }
});

test('un rôle inconnu retombe sur la réalisation', () => {
  assert.equal(roleValide('production'), 'production');
  assert.equal(roleValide('n’importe quoi'), 'realisation');
  assert.equal(roleValide(undefined), 'realisation');
});

test('libelleRole rend le mot français, jamais l’identifiant', () => {
  assert.equal(libelleRole('realisation'), 'Réalisation');
  assert.equal(libelleRole('jeu'), 'Jeu');
  assert.equal(libelleRole('zzz'), 'zzz');
});

/* --- Le métier, et c'est le cœur du sujet -------------------------------- */

test('en film, « Director » est de la réalisation', () => {
  assert.equal(roleDe('Director', 'movie'), 'realisation');
});

test('en série, c’est « Creator » — une série a des créateurs, pas des réalisateurs', () => {
  /* Dire « réalisateur » d'une série serait faux : une série a des
     réalisateurs d'ÉPISODES. Celui qui la porte est le créateur. */
  assert.equal(roleDe('Creator', 'tv'), 'realisation');
  assert.equal(roleDe('Director', 'tv'), null);
});

test('tous les métiers de production sont reconnus', () => {
  for (const job of ['Producer', 'Executive Producer', 'Co-Producer', 'Associate Producer', 'Supervising Producer', 'Line Producer']) {
    assert.equal(roleDe(job, 'movie'), 'production', job + ' non reconnu');
  }
});

test('un métier qui n’est ni réalisation ni production est écarté', () => {
  for (const job of ['Writer', 'Screenplay', 'Original Music Composer', 'Thanks', 'Editor', 'Director of Photography']) {
    assert.equal(roleDe(job, 'movie'), null, job + ' ne devrait pas passer');
  }
});

test('roleDe ne casse pas sur une entrée vide', () => {
  assert.equal(roleDe(undefined, 'movie'), null);
  assert.equal(roleDe('', 'movie'), null);
  assert.equal(roleDe(null, 'tv'), null);
});

test('la casse du métier ne change rien', () => {
  assert.equal(roleDe('DIRECTOR', 'movie'), 'realisation');
  assert.equal(roleDe('producer', 'movie'), 'production');
});

/* --- Le filtrage des crédits --------------------------------------------- */

/* La forme réelle de `/person/525/movie_credits`, réduite à l'essentiel. */
const CREDITS_NOLAN = {
  cast: [{ id: 1, title: 'Un caméo' }, { id: 2, title: 'Un autre' }],
  crew: [
    { id: 10, title: 'Oppenheimer', job: 'Director', department: 'Directing' },
    { id: 11, title: 'Tenet', job: 'Director', department: 'Directing' },
    { id: 10, title: 'Oppenheimer', job: 'Producer', department: 'Production' },
    { id: 12, title: 'Man of Steel', job: 'Producer', department: 'Production' },
    { id: 13, title: 'Interstellar', job: 'Writer', department: 'Writing' }
  ]
};

test('la réalisation ne prend que les metteurs en scène', () => {
  const r = creditsPourRole(CREDITS_NOLAN, 'realisation', 'movie');
  assert.deepEqual(r.map(x => x.title), ['Oppenheimer', 'Tenet']);
});

test('la production ne prend que les producteurs', () => {
  const r = creditsPourRole(CREDITS_NOLAN, 'production', 'movie');
  assert.deepEqual(r.map(x => x.title), ['Oppenheimer', 'Man of Steel']);
});

test('le jeu prend le casting', () => {
  const r = creditsPourRole(CREDITS_NOLAN, 'jeu', 'movie');
  assert.equal(r.length, 2);
});

test('un film où la personne a DEUX métiers n’apparaît qu’une fois', () => {
  /* Oppenheimer est ici réalisé ET produit. Sans dédoublonnage, il compterait
     deux fois dans une liste qui prétend compter des films. */
  const prod = creditsPourRole(CREDITS_NOLAN, 'production', 'movie');
  assert.equal(new Set(prod.map(x => x.id)).size, prod.length);
});

test('un crédit sans donnéees ne casse rien', () => {
  assert.deepEqual(creditsPourRole(null, 'realisation', 'movie'), []);
  assert.deepEqual(creditsPourRole({}, 'production', 'movie'), []);
  assert.deepEqual(creditsPourRole({ crew: null, cast: null }, 'jeu', 'movie'), []);
});

test('comptePourRole compte la même chose que creditsPourRole', () => {
  assert.equal(comptePourRole(CREDITS_NOLAN, 'realisation', 'movie'), 2);
  assert.equal(comptePourRole(CREDITS_NOLAN, 'production', 'movie'), 2);
});

test('en série, la réalisation cherche les créateurs, pas les réalisateurs', () => {
  const credits = { crew: [{ id: 20, name: 'Une série', job: 'Creator' }, { id: 21, name: 'Un épisode', job: 'Director' }] };
  const r = creditsPourRole(credits, 'realisation', 'tv');
  assert.deepEqual(r.map(x => x.name), ['Une série']);
});

/* --- Les sociétés -------------------------------------------------------- */

test('les sociétés se classent par ce qu’elles contiennent', () => {
  /* Le cas réel : la recherche « a24 » renvoie TROIS sociétés nommées A24 —
     0, 1 et 176 films. TMDB les classe sans rapport avec leur contenu. */
  const trouvees = [
    { id: 310912, nom: 'A24', compte: 0 },
    { id: 293354, nom: 'A24', compte: 1 },
    { id: 41077, nom: 'A24', compte: 176 }
  ];
  assert.deepEqual(classerSocietes(trouvees).map(s => s.id), [41077, 293354, 310912]);
});

test('classerSocietes ne modifie pas la liste reçue', () => {
  const trouvees = [{ id: 1, nom: 'B', compte: 1 }, { id: 2, nom: 'A', compte: 9 }];
  classerSocietes(trouvees);
  assert.equal(trouvees[0].id, 1, 'la liste d’origine a été réordonnée');
});

test('à compte égal, l’ordre alphabétique tranche', () => {
  const trouvees = [{ id: 1, nom: 'Zeta', compte: 5 }, { id: 2, nom: 'Alpha', compte: 5 }];
  assert.deepEqual(classerSocietes(trouvees).map(s => s.nom), ['Alpha', 'Zeta']);
});

test('une société sans compte connu passe en dernier, sans disparaître', () => {
  const trouvees = [{ id: 1, nom: 'Sans compte' }, { id: 2, nom: 'Avec', compte: 3 }];
  assert.equal(classerSocietes(trouvees)[0].id, 2);
  assert.equal(classerSocietes(trouvees).length, 2);
});

test('le libellé d’une société dit combien de titres, au singulier comme au pluriel', () => {
  assert.equal(libelleSociete({ nom: 'A24', compte: 176 }), 'A24 — 176 titres');
  assert.equal(libelleSociete({ nom: 'A24', compte: 1 }), 'A24 — 1 titre');
});

test('une société vide le dit au lieu d’afficher « 0 titres »', () => {
  assert.equal(libelleSociete({ nom: 'A24', compte: 0 }), 'A24 — aucun titre');
});

test('une société sans titre n’est pas utilisable', () => {
  /* Elle reste VISIBLE dans la liste — la cacher ferait croire que la
     recherche n'a rien trouvé — mais on ne peut pas la choisir. */
  assert.equal(societeUtilisable({ nom: 'A24', compte: 0 }), false);
  assert.equal(societeUtilisable({ nom: 'A24', compte: 1 }), true);
  assert.equal(societeUtilisable({ nom: 'A24' }), false);
  assert.equal(societeUtilisable(null), false);
});

test('le type de société se limite à studio ou chaîne', () => {
  assert.equal(typeSocieteValide('chaine'), 'chaine');
  assert.equal(typeSocieteValide('studio'), 'studio');
  assert.equal(typeSocieteValide('autre'), 'studio');
  assert.equal(typeSocieteValide(undefined), 'studio');
});

test('les rôles couvrent ce que Matt a demandé : réalisateur et producteur', () => {
  const ids = ROLES.map(r => r.id);
  assert.ok(ids.includes('realisation'), 'la réalisation manque');
  assert.ok(ids.includes('production'), 'la production manque');
});
