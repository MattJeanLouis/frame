/**
 * Les règles d'une soirée.
 *
 * Ce qui est éprouvé ici n'est pas du réseau mais du JEU : qui rencontre qui,
 * qui voit quoi, qui gagne à égalité, et ce qui se passe quand quelqu'un s'en va
 * au mauvais moment. Un jeu à plusieurs dont les règles ne sont pas testables se
 * découvre en soirée, devant les invités.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom, rejoindre, partir, apporter, retirer, piocher,
  lancerTournoi, duelCourant, duelPret, voterDuel, resoudreDuel, avancer,
  depouiller, bilan, retourAuLobby, rejouer, vuePour, codeAleatoire,
  normaliserCode, expirees, empreinte,
  DECK_MIN, DECK_MAX, APPORTS_MAX, PHASES
} from '../room/rooms.js';

/* ── De quoi jouer ────────────────────────────────────────────────────────── */

const film = (id, titre, kind = 'movie') => ({ id, kind, title: titre, year: '2024', poster: '/p' + id + '.jpg' });

/** Une soirée prête à jouer : des joueurs, et de quoi remplir la table. */
function soireePrete(noms, films) {
  const room = createRoom('AAAAAA');
  const joueurs = noms.map(n => rejoindre(room, n));
  const liste = films || [film(1, 'Dune'), film(2, 'Alien'), film(3, 'Andor', 'tv'), film(4, 'Heat')];
  liste.forEach((f, i) => apporter(room, f, joueurs[i % joueurs.length]));
  return { room, joueurs };
}

/* ── Le code ──────────────────────────────────────────────────────────────── */

test('un code ne contient ni I, ni O, ni 0, ni 1 — on le dicte à voix haute', () => {
  for (let i = 0; i < 200; i++) assert.match(codeAleatoire(), /^[A-HJ-NP-Z2-9]{6}$/);
});

test('un code saisi à la main est rattrapé', () => {
  assert.equal(normaliserCode('ab c-d12'), 'ABCD12');
  assert.equal(normaliserCode('AOB1'), 'A0B1');
  assert.equal(normaliserCode('io'), '10');
  assert.equal(normaliserCode(null), '');
});

/* ── Entrer, sortir ───────────────────────────────────────────────────────── */

test('le premier arrivé est l’hôte, et revenir ne crée pas de fantôme', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  rejoindre(room, 'Sam');
  assert.equal(room.hote, a.id);
  rejoindre(room, 'Matt', { id: a.id });
  assert.equal(room.joueurs.length, 2);
});

test('l’hôte qui part passe la main, et ses films perdent leur parrain', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  partir(room, joueurs[0].id);
  assert.equal(room.hote, joueurs[1].id);
  assert.equal(room.deck.filter(f => !f.parrain).length, 2, 'les films de Matt restent, sans parrain');
});

test('le dernier qui part remet la soirée à plat', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  partir(room, joueurs[0].id);
  partir(room, joueurs[1].id);
  assert.equal(room.phase, 'lobby');
  assert.deepEqual(room.deck, []);
  assert.equal(room.tournoi, null);
});

/* ── Le deck ──────────────────────────────────────────────────────────────── */

test('on apporte n’importe quel film de TMDB, pas seulement ceux du catalogue', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const r = apporter(room, film(9999, 'Un film que personne n’a affiché'), a);
  assert.equal(r.ok, true);
  assert.equal(room.deck[0].title, 'Un film que personne n’a affiché');
  assert.equal(room.deck[0].parrain, a.id);
  assert.equal(room.deck[0].parrainNom, 'Matt');
});

test('le même film ne rentre pas deux fois', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  apporter(room, film(1, 'Dune'), a);
  assert.match(apporter(room, film(1, 'Dune bis'), a).erreur, /déjà/);
});

test('un film et une série de même identifiant sont deux titres', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  apporter(room, film(7, 'Sept', 'movie'), a);
  assert.equal(apporter(room, film(7, 'Sept', 'tv'), a).ok, true);
  assert.equal(room.deck.length, 2);
});

test('chacun est plafonné à ce qu’il peut apporter', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  for (let i = 0; i < APPORTS_MAX; i++) assert.equal(apporter(room, film(i + 1, 'F' + i), a).ok, true);
  assert.match(apporter(room, film(90, 'De trop'), a).erreur, /déjà apporté/);
});

test('la table a un plafond, même quand l’hôte pioche', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  rejoindre(room, 'Sam');
  /* L'hôte pioche sans être soumis au plafond par personne : c'est le seul
     chemin qui peut remplir la table jusqu'au bout. */
  const beaucoup = Array.from({ length: DECK_MAX + 4 }, (_, i) => film(100 + i, 'F' + i));
  piocher(room, beaucoup, a);
  assert.equal(room.deck.length, DECK_MAX);
  assert.match(apporter(room, film(500, 'Plein'), a).erreur, /pleine/);
});

test('on ne retire pas le film de quelqu’un d’autre — sauf l’hôte', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');   // l'hôte
  const b = rejoindre(room, 'Sam');
  const c = rejoindre(room, 'Léa');    // ni hôte, ni propriétaire
  apporter(room, film(1, 'Dune'), a);
  apporter(room, film(2, 'Alien'), b);
  assert.match(retirer(room, 'movie:2', c).erreur, /quelqu’un d’autre/, 'un invité ne touche pas au film d’un autre');
  assert.equal(retirer(room, 'movie:2', b).ok, true, 'son parrain peut le retirer');
  assert.equal(retirer(room, 'movie:1', a).ok, true, 'l’hôte peut tout retirer');
});

test('l’hôte pioche dans le catalogue, et remplit la table', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  rejoindre(room, 'Sam');
  const r = piocher(room, [film(1, 'A'), film(2, 'B'), film(3, 'C'), film(4, 'D')], a);
  assert.equal(r.ajoutes, 4);
  assert.equal(room.deck.every(f => f.parrain === null), true, 'les films piochés n’ont pas de parrain');
});

test('un invité ne pioche pas dans le catalogue', () => {
  const room = createRoom('AAAAAA');
  rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  assert.match(piocher(room, [film(1, 'A')], b).erreur, /hôte/);
});

/* ── Le tournoi ───────────────────────────────────────────────────────────── */

test('il faut quatre films et deux joueurs pour lancer', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  apporter(room, film(1, 'A'), a);
  apporter(room, film(2, 'B'), b);
  apporter(room, film(3, 'C'), a);
  assert.equal(lancerTournoi(room), false, 'trois films ne suffisent pas');
  apporter(room, film(4, 'D'), b);
  assert.equal(lancerTournoi(room), true, 'quatre films suffisent');
});

test('seul, on ne lance pas : un duel a besoin de deux avis', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  for (let i = 1; i <= 4; i++) apporter(room, film(i, 'F' + i), a);
  assert.equal(lancerTournoi(room), false);
});

test('un deck impair donne un exempt, qui passe sans se jouer', () => {
  const { room } = soireePrete(['Matt', 'Sam'], [film(1, 'A'), film(2, 'B'), film(3, 'C'), film(4, 'D'), film(5, 'E')]);
  lancerTournoi(room);
  const tour = room.tournoi.tours[0];
  assert.equal(tour.length, 3, 'deux duels et un exempt');
  assert.equal(tour.filter(d => d.exempt).length, 1);
  assert.ok(tour.find(d => d.exempt).gagnant, 'l’exempt a déjà son gagnant');
});

test('deux films du même parrain ne s’affrontent pas au premier tour', () => {
  const room = createRoom('AAAAAA');
  const a = rejoindre(room, 'Matt');
  const b = rejoindre(room, 'Sam');
  for (let i = 1; i <= 3; i++) { apporter(room, film(i, 'M' + i), a); apporter(room, film(10 + i, 'S' + i), b); }
  lancerTournoi(room);
  const parrain = cle => room.deck.find(f => f.key === cle)?.parrain;
  for (const duel of room.tournoi.tours[0]) {
    if (duel.exempt) continue;
    assert.notEqual(parrain(duel.a), parrain(duel.b), 'un duel oppose deux parrains différents');
  }
});

/* ── Voter ────────────────────────────────────────────────────────────────── */

test('on vote pour l’un des deux, et pas autre chose', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  assert.equal(voterDuel(room, joueurs[0].id, 'a'), true);
  assert.equal(voterDuel(room, joueurs[1].id, 'c'), false);
  assert.equal(voterDuel(room, 'inconnu', 'a'), false);
});

test('le duel est prêt quand tout le monde a voté', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  voterDuel(room, joueurs[0].id, 'a');
  assert.equal(duelPret(room), false);
  voterDuel(room, joueurs[1].id, 'b');
  assert.equal(duelPret(room), true);
});

test('changer d’avis remplace le vote', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  const duel = duelCourant(room);
  voterDuel(room, joueurs[0].id, 'a');
  voterDuel(room, joueurs[0].id, 'b');
  assert.equal(depouiller(room, duel).a, 0);
  assert.equal(depouiller(room, duel).b, 1);
});

/* ── Départager ───────────────────────────────────────────────────────────── */

test('la majorité l’emporte', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam', 'Léa']);
  lancerTournoi(room);
  const duel = duelCourant(room);
  voterDuel(room, joueurs[0].id, 'a');
  voterDuel(room, joueurs[1].id, 'a');
  voterDuel(room, joueurs[2].id, 'b');
  resoudreDuel(room);
  assert.equal(duel.gagnant, duel.a);
  assert.deepEqual(duel.score, { a: 2, b: 1 });
});

test('à égalité, on ne tire pas au sort : le film garde son gagnant', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  const d1 = duelCourant(room);
  voterDuel(room, joueurs[0].id, 'a');
  voterDuel(room, joueurs[1].id, 'b');
  resoudreDuel(room);
  assert.equal(d1.egalite, true);
  assert.ok(d1.gagnant, 'une égalité donne quand même un gagnant');
});

test('un duel sans aucune voix ne se résout pas', () => {
  const { room } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  assert.equal(resoudreDuel(room), false);
  assert.equal(duelCourant(room).gagnant, null);
});

/* ── Le déroulé ───────────────────────────────────────────────────────────── */

test('le tournoi va jusqu’au bout et désigne un seul film', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam'], [film(1, 'A'), film(2, 'B'), film(3, 'C'), film(4, 'D')]);
  lancerTournoi(room);
  let garde = 0;
  while (room.phase === 'duels' && garde++ < 40) {
    for (const j of joueurs) voterDuel(room, j.id, 'a');
    resoudreDuel(room);
    avancer(room);
  }
  assert.equal(room.phase, 'verdict');
  assert.equal(garde, 3, 'quatre films : deux demies et une finale');
  assert.equal(bilan(room).gagnant.key, 'movie:1');
});

test('un deck impair traverse ses exempts sans s’arrêter', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam'], [film(1, 'A'), film(2, 'B'), film(3, 'C'), film(4, 'D'), film(5, 'E')]);
  lancerTournoi(room);
  let garde = 0;
  while (room.phase === 'duels' && garde++ < 40) {
    const duel = duelCourant(room);
    assert.ok(duel && !duel.exempt, 'on ne s’arrête jamais sur un exempt');
    for (const j of joueurs) voterDuel(room, j.id, 'b');
    resoudreDuel(room);
    avancer(room);
  }
  assert.equal(room.phase, 'verdict');
  assert.equal(bilan(room).joues, 4, 'cinq films : quatre duels joués');
});

test('le tableau garde la trace de tous les duels', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  let garde = 0;
  while (room.phase === 'duels' && garde++ < 40) {
    for (const j of joueurs) voterDuel(room, j.id, 'a');
    resoudreDuel(room); avancer(room);
  }
  const tableau = vuePour(room, joueurs[0].id).tableau;
  assert.ok(tableau.length >= 2, 'au moins deux tours');
  const joues = tableau.flatMap(t => t.duels);
  assert.equal(joues.length, 3);
  assert.ok(joues.every(d => d.gagnant && d.titreA && d.titreB));
});

/* ── Le bilan ─────────────────────────────────────────────────────────────── */

test('le bilan raconte les extrêmes, pas seulement le gagnant', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam', 'Léa'], [film(1, 'A'), film(2, 'B'), film(3, 'C'), film(4, 'D')]);
  lancerTournoi(room);
  /* Premier duel serré (2–1), second net (3–0). */
  voterDuel(room, joueurs[0].id, 'a'); voterDuel(room, joueurs[1].id, 'a'); voterDuel(room, joueurs[2].id, 'b');
  resoudreDuel(room); avancer(room);
  for (const j of joueurs) voterDuel(room, j.id, 'a');
  resoudreDuel(room); avancer(room);
  for (const j of joueurs) voterDuel(room, j.id, 'a');
  resoudreDuel(room); avancer(room);

  const b = bilan(room);
  assert.equal(b.joues, 3);
  assert.equal(b.serres, 1, 'un seul duel à une voix d’écart');
  assert.ok(b.plusDivisant, 'le plus divisant est nommé');
  assert.ok(b.plusNet, 'le plus net aussi');
  assert.ok(b.plusSoutenu.voix > 0);
  assert.ok(b.gagnant);
});

/* ── Le secret — la règle qui fait le jeu ─────────────────────────────────── */

test('PENDANT UN DUEL, personne ne voit le vote des autres', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  voterDuel(room, joueurs[0].id, 'a');
  voterDuel(room, joueurs[1].id, 'b');

  const vue = vuePour(room, joueurs[0].id);
  assert.equal(vue.duel.monVote, 'a');
  assert.equal(vue.duel.resolu, false);
  assert.equal(vue.duel.votes, null, 'aucun détail nominatif avant le dépouillement');
  assert.equal(vue.duel.score, null, 'ni le score');
  assert.equal(vue.duel.votants, 2, 'mais on sait combien ont voté');
  assert.equal(vue.bilan, null, 'et le bilan n’existe pas encore');
});

test('APRÈS le duel, tout le monde voit tout', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  voterDuel(room, joueurs[0].id, 'a');
  voterDuel(room, joueurs[1].id, 'b');
  resoudreDuel(room);
  const vue = vuePour(room, joueurs[0].id);
  assert.equal(vue.duel.resolu, true);
  assert.equal(vue.duel.votes[joueurs[1].id], 'b');
  assert.deepEqual(vue.duel.score, { a: 1, b: 1 });
  assert.ok(vue.duel.gagnant);
});

test('la vue d’un inconnu ne donne aucun vote et ne plante pas', () => {
  const { room } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  const vue = vuePour(room, 'inexistant');
  assert.equal(vue.moi, null);
  assert.equal(vue.duel.monVote, null);
  assert.equal(vue.duel.votes, null);
});

test('la vue porte qui a voté, sans dire pour qui', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  voterDuel(room, joueurs[0].id, 'a');
  const vue = vuePour(room, joueurs[1].id);
  assert.equal(vue.joueurs.find(j => j.id === joueurs[0].id).aVote, true);
  assert.equal(vue.joueurs.find(j => j.id === joueurs[1].id).aVote, false);
});

/* ── Les phases et le ménage ──────────────────────────────────────────────── */

test('les phases sont celles du jeu', () => {
  assert.deepEqual(PHASES, ['lobby', 'duels', 'verdict']);
});

test('revenir au lobby garde le deck, mais efface le tournoi', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  voterDuel(room, joueurs[0].id, 'a');
  retourAuLobby(room);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.tournoi, null);
  assert.equal(room.deck.length, 4, 'les films apportés restent');
});

test('rejouer refait un tournoi avec le même deck', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  let garde = 0;
  while (room.phase === 'duels' && garde++ < 40) {
    for (const j of joueurs) voterDuel(room, j.id, 'a');
    resoudreDuel(room); avancer(room);
  }
  assert.equal(rejouer(room), true);
  assert.equal(room.phase, 'duels');
  assert.equal(room.deck.length, 4);
});

test('on ne lance pas un tournoi depuis un tournoi', () => {
  const { room } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  assert.equal(lancerTournoi(room), false);
});

test('une soirée sans activité depuis six heures est oubliée', () => {
  const HEURE = 1000 * 60 * 60;
  const rooms = new Map();
  rooms.set('VIEILL', createRoom('VIEILL', { now: 0 }));
  rooms.set('FRAICH', createRoom('FRAICH', { now: 7 * HEURE - 5000 }));
  assert.deepEqual(expirees(rooms, { now: 7 * HEURE }), ['VIEILL']);
});

test('l’empreinte change quand l’état change, et pas autrement', () => {
  const { room, joueurs } = soireePrete(['Matt', 'Sam']);
  lancerTournoi(room);
  const e1 = empreinte(vuePour(room, joueurs[0].id));
  assert.equal(e1, empreinte(vuePour(room, joueurs[0].id)));
  voterDuel(room, joueurs[1].id, 'a');
  assert.notEqual(e1, empreinte(vuePour(room, joueurs[0].id)));
});
