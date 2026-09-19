/**
 * Les règles d'une room.
 *
 * Ce qui est éprouvé ici n'est pas du réseau mais du JEU : qui voit quoi, qui
 * gagne, et ce qui se passe quand quelqu'un s'en va au mauvais moment. Un jeu à
 * plusieurs dont les règles ne sont pas testables se découvre en soirée.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom, rejoindre, partir, lancerManche, voter, reveler, conclure,
  retourAuLobby, avancement, aFini, tousOntFini, score, classement, vuePour,
  cleFilm, codeAleatoire, normaliserCode, expirees, empreinte, joueurDe, DECK_DEFAUT
} from '../room/rooms.js';

/* ── Le code ──────────────────────────────────────────────────────────────── */

test('un code ne contient ni I, ni O, ni 0, ni 1 — on le dicte à voix haute', () => {
  for (let i = 0; i < 200; i++) {
    assert.match(codeAleatoire(), /^[A-HJ-NP-Z2-9]{6}$/);
  }
});

test('un code saisi à la main est rattrapé : casse, espaces, O pour zéro, I pour un', () => {
  assert.equal(normaliserCode('ab c-d12'), 'ABCD12');
  assert.equal(normaliserCode('AOB1'), 'A0B1');
  assert.equal(normaliserCode('io'), '10');
  assert.equal(normaliserCode(''), '');
  assert.equal(normaliserCode(null), '');
});

test('un code trop long est coupé à six signes', () => {
  assert.equal(normaliserCode('ABCDEFGHIJ').length, 6);
});

/* ── Entrer, sortir ───────────────────────────────────────────────────────── */

test('le premier arrivé est l’hôte', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  assert.equal(room.hote, a.id);
  assert.equal(room.joueurs.length, 2);
  assert.equal(b.hote, undefined);
});

test('revenir avec le même identifiant reprend sa place, sans créer de fantôme', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  rejoindre(room, 'Sam');
  const revenu = rejoindre(room, 'Matt', { id: a.id });
  assert.equal(room.joueurs.length, 2);
  assert.equal(revenu.id, a.id);
  assert.equal(joueurDe(room, a.id).nom, 'Matt');
});

test('un nom vide ne laisse pas un joueur sans nom', () => {
  const room = createRoom('AAAAAA');
  const j = rejoindre(room, '   ');
  assert.ok(j.nom.length > 0);
});

test('l’hôte qui part passe la main au plus ancien', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  partir(room, a.id);
  assert.equal(room.hote, b.id);
  assert.equal(room.joueurs.length, 1);
});

test('le dernier qui part laisse la room propre', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  lancerManche(room, [{ id: 1, title: 'Dune' }]);
  voter(room, a.id, 'movie:1', 'oui');
  partir(room, a.id);
  assert.equal(room.phase, 'lobby');
  assert.deepEqual(room.votes, {});
  assert.equal(room.deck.length, 0);
});

test('partir deux fois ne casse rien', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  assert.equal(partir(room, a.id), true);
  assert.equal(partir(room, a.id), false);
});

/* ── La manche ────────────────────────────────────────────────────────────── */

const DECK = [
  { id: 1, kind: 'movie', title: 'Dune', year: '2021', poster: '/a.jpg' },
  { id: 2, kind: 'movie', title: 'Alien', year: '1979', poster: '/b.jpg' },
  { id: 3, kind: 'tv', title: 'Andor', year: '2022', poster: '/c.jpg' }
];

test('un film et une série de même identifiant ne se confondent pas', () => {
  assert.equal(cleFilm({ id: 7, kind: 'movie' }), 'movie:7');
  assert.equal(cleFilm({ id: 7, kind: 'tv' }), 'tv:7');
});

test('lancer une manche vide les votes précédents', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:1', 'oui');
  lancerManche(room, DECK);
  assert.equal(avancement(room, a.id), 0);
  assert.equal(room.manche, 2);
});

test('un deck vide ne lance rien', () => {
  const room = createRoom('AAAAAA');
  rejoindre(room, 'Matt');
  assert.equal(lancerManche(room, []), false);
  assert.equal(lancerManche(room, null), false);
  assert.equal(room.phase, 'lobby');
});

test('un deck est nettoyé : titre gardé, année sur quatre signes, clé posée', () => {
  const room = createRoom('AAAAAA');
  lancerManche(room, [{ id: 9, kind: 'tv', title: 'X', date: '2019-05-01' }, { id: null, title: 'sans id' }]);
  assert.equal(room.deck.length, 1);
  assert.equal(room.deck[0].key, 'tv:9');
  assert.equal(room.deck[0].year, '2019');
});

test('hors manche, voter ne fait rien', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  assert.equal(voter(room, a.id, 'movie:1', 'oui'), false);
  lancerManche(room, DECK);
  reveler(room);
  assert.equal(voter(room, a.id, 'movie:1', 'oui'), false);
});

test('on ne vote pas sur un film qui n’est pas au deck', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  lancerManche(room, DECK);
  assert.equal(voter(room, a.id, 'movie:999', 'oui'), false);
  assert.equal(voter(room, a.id, 'movie:1', 'peut-être'), false);
});

test('changer d’avis remplace le vote, il ne s’ajoute pas', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:1', 'oui');
  voter(room, a.id, 'movie:1', 'non');
  assert.equal(avancement(room, a.id), 1);
  assert.equal(score(room, 'movie:1').non.length, 1);
  assert.equal(score(room, 'movie:1').oui.length, 0);
});

test('tout le monde a fini quand tout le monde s’est prononcé sur tout', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  for (const f of DECK) voter(room, a.id, cleFilm(f), 'oui');
  assert.equal(aFini(room, a.id), true);
  assert.equal(tousOntFini(room), false);
  for (const f of DECK) voter(room, b.id, cleFilm(f), 'peut');
  assert.equal(tousOntFini(room), true);
});

/* ── Le dépouillement ─────────────────────────────────────────────────────── */

test('l’unanimité passe avant le score', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  const c = rejoindre(room, 'Léa');
  lancerManche(room, DECK);
  /* Dune : tout le monde dit oui. Alien : deux oui, un non. */
  for (const j of [a, b, c]) voter(room, j.id, 'movie:1', 'oui');
  voter(room, a.id, 'movie:2', 'oui');
  voter(room, b.id, 'movie:2', 'oui');
  voter(room, c.id, 'movie:2', 'non');
  const haut = classement(room);
  assert.equal(haut[0].film.title, 'Dune');
  assert.equal(haut[0].unanime, true);
  assert.equal(score(room, 'movie:2').unanime, false);
  assert.equal(score(room, 'movie:2').sansRefus, false);
});

test('un « peut » vaut moins qu’un « oui », un « non » coûte plus que les deux', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:1', 'oui'); voter(room, b.id, 'movie:1', 'oui');
  voter(room, a.id, 'movie:2', 'oui'); voter(room, b.id, 'movie:2', 'peut');
  voter(room, a.id, 'movie:3', 'oui'); voter(room, b.id, 'movie:3', 'non');
  const s = k => score(room, k).score;
  assert.ok(s('movie:1') > s('movie:2'), 'deux oui battent un oui et un peut');
  assert.ok(s('movie:2') > s('movie:3'), 'un peut bat un non');
});

test('un film que personne n’a jugé tombe en dernier, sans être refusé', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:3', 'oui');
  voter(room, b.id, 'movie:3', 'oui');
  const bas = classement(room).at(-1);
  assert.equal(bas.film.title, 'Dune');
  assert.equal(bas.exprimes, 0);
  assert.equal(bas.non.length, 0);
});

test('un joueur parti ne compte plus dans les scores', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  for (const f of DECK) { voter(room, a.id, cleFilm(f), 'oui'); voter(room, b.id, cleFilm(f), 'non'); }
  partir(room, b.id);
  const s = score(room, 'movie:1');
  assert.equal(s.non.length, 0);
  assert.equal(s.unanime, false, 'seul restant, Matt n’est pas « unanime » : le mot suppose plusieurs');
});

test('seul, on n’est jamais « unanime » : le mot n’a pas de sens', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:1', 'oui');
  assert.equal(score(room, 'movie:1').unanime, false);
});

test('le classement est stable : à égalité parfaite, l’ordre alphabétique tranche', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  for (const j of [a, b]) for (const f of DECK) voter(room, j.id, cleFilm(f), 'oui');
  const titres = classement(room).map(l => l.film.title);
  assert.deepEqual(titres, ['Alien', 'Andor', 'Dune']);
});

/* ── Ce que chacun voit — la règle qui fait le jeu ────────────────────────── */

test('PENDANT LA MANCHE, personne ne voit le vote des autres', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:1', 'oui');
  voter(room, b.id, 'movie:1', 'non');

  const vueA = vuePour(room, a.id);
  assert.equal(vueA.votes[a.id]['movie:1'], 'oui');
  assert.equal(vueA.votes[b.id], undefined, 'les votes de Sam ne doivent pas sortir');
  assert.equal(vueA.classement, null, 'le classement non plus');
  assert.deepEqual(Object.keys(vueA.votes), [a.id], 'la carte ne contient QUE mes votes');

  /* On ne cache pas que Sam a voté : seulement pour qui. */
  assert.equal(vueA.joueurs.find(j => j.id === b.id).avancement, 1);
});

test('APRÈS LA RÉVÉLATION, tout le monde voit tout', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:1', 'oui');
  voter(room, b.id, 'movie:1', 'non');
  reveler(room);
  const vue = vuePour(room, a.id);
  assert.equal(vue.votes[b.id]['movie:1'], 'non');
  assert.ok(Array.isArray(vue.classement));
  assert.equal(vue.classement.length, 3);
  assert.equal(vue.classement.find(l => l.film.key === 'movie:1').parJoueur[b.id], 'non');
});

test('la vue d’un inconnu ne donne aucun vote et ne plante pas', () => {
  const room = createRoom('AAAAAA');
  rejoindre(room, 'Matt');
  lancerManche(room, DECK);
  const vue = vuePour(room, 'inexistant');
  assert.equal(vue.moi, null);
  assert.deepEqual(vue.votes, {});
});

test('la vue porte l’avancement de chacun, sans le contenu', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  voter(room, a.id, 'movie:1', 'oui');
  const vue = vuePour(room, b.id);
  assert.equal(vue.moi.avancement, 0);
  assert.equal(vue.joueurs.find(j => j.id === a.id).avancement, 1);
  assert.equal(vue.joueurs.find(j => j.id === a.id).hote, true);
});

/* ── Les phases ───────────────────────────────────────────────────────────── */

test('les phases s’enchaînent dans l’ordre, et pas autrement', () => {
  const room = createRoom('AAAAAA');
  rejoindre(room, 'Matt');
  assert.equal(conclure(room), false, 'on ne conclut pas depuis le lobby');
  assert.equal(reveler(room), false, 'on ne révèle pas depuis le lobby');
  lancerManche(room, DECK);
  assert.equal(conclure(room), false, 'on ne conclut pas sans avoir révélé');
  reveler(room);
  assert.equal(reveler(room), false, 'on ne révèle pas deux fois');
  conclure(room);
  assert.equal(room.phase, 'verdict');
});

test('revenir au lobby remet tout à zéro', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  lancerManche(room, DECK, { theme: 'Horreur' });
  voter(room, a.id, 'movie:1', 'oui');
  reveler(room);
  retourAuLobby(room);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.deck.length, 0);
  assert.deepEqual(room.votes, {});
  assert.equal(room.theme, '');
});

/* ── Le ménage et l’empreinte ─────────────────────────────────────────────── */

test('une room sans activité depuis six heures est oubliée', () => {
  const rooms = new Map();
  const HEURE = 1000 * 60 * 60;
  const vieille = createRoom('VIEILL', { now: 0 });
  /* Créée il y a cinq secondes, au moment où on regarde. */
  const fraiche = createRoom('FRAICH', { now: 7 * HEURE - 5000 });
  rooms.set('VIEILL', vieille);
  rooms.set('FRAICH', fraiche);
  assert.deepEqual(expirees(rooms, { now: 7 * HEURE }), ['VIEILL']);
});

test('une room qu’on vient de toucher n’expire pas', () => {
  const rooms = new Map();
  const room = createRoom('AAAAAA', { now: 0 });
  rejoindre(room, 'Matt', { now: 1000 * 60 * 60 * 6 + 1 });
  rooms.set('AAAAAA', room);
  assert.deepEqual(expirees(rooms, { now: 1000 * 60 * 60 * 7 }), []);
});

test('l’empreinte change quand l’état change, et pas autrement', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  lancerManche(room, DECK);
  const e1 = empreinte(vuePour(room, a.id));
  const e2 = empreinte(vuePour(room, a.id));
  assert.equal(e1, e2, 'deux lectures du même état donnent la même empreinte');
  voter(room, b.id, 'movie:1', 'oui');
  const e3 = empreinte(vuePour(room, a.id));
  assert.notEqual(e1, e3, 'un vote des autres change l’avancement, donc l’empreinte');
  voter(room, a.id, 'movie:1', 'oui');
  assert.notEqual(e3, empreinte(vuePour(room, a.id)));
});

test('le deck par défaut est une partie, pas une corvée', () => {
  assert.ok(DECK_DEFAUT >= 8 && DECK_DEFAUT <= 20);
});
