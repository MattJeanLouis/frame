/**
 * Le miroir.
 *
 * Ce qui est éprouvé ici, c'est la capacité du miroir à ne pas MENTIR. Un
 * portrait statistique se trompe de deux façons, et les deux sont graves :
 * il peut conclure sur trois films comme s'il en avait trois cents, et il peut
 * présenter un total partiel comme un total. Matt n'a pas tout rempli — c'est
 * le cas normal, pas l'exception — donc les tests portent autant sur les
 * effectifs et les silences que sur les valeurs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  corpus, rythme, profondeur, vocabulaire, territoires, decennies,
  ecartAuPublic, signature, trous, portrait, repere, motsDe,
  ETATS, VUS, JUGES, SEUIL
} from '../src/miroir.js';

/* ── De quoi fabriquer un état ────────────────────────────────────────────── */

const GENRES = {
  18: { label: 'Drame', emoji: '🎭' },
  35: { label: 'Comédie', emoji: '😂' },
  878: { label: 'Science-Fiction', emoji: '🤖' }
};

/**
 * Un état fabriqué à la main.
 *
 * `films` est une liste de [état, genre, année, note, votes] pour rester
 * lisible : les tests de ce fichier parlent de goûts, pas d'identifiants.
 */
function fabriquer(fiches = [], { avis = {}, commentaires = {}, quand = {}, avecCles = true } = {}) {
  const marks = {}; const films = {}; const horodatages = {};
  fiches.forEach((f, i) => {
    const [marque, genre, annee, note, voix, options = {}] = f;
    const cle = 'movie:' + (i + 1);
    if (marque) marks[cle] = marque;
    films[cle] = {
      id: i + 1, kind: 'movie', title: 'Film ' + (i + 1), date: annee + '-05-04',
      poster_path: '/a' + (i + 1) + '.jpg', genre_ids: [genre], vote_average: note,
      vote_count: voix, runtime: options.duree || 120,
      keywords: avecCles ? ['braquage'] : [], at: quand[cle] || 0
    };
    if (quand[cle]) horodatages['marque:' + cle] = quand[cle];
  });
  return { marks, films, reactions: avis, comments: commentaires, horodatages };
}

/* ── Le corpus ────────────────────────────────────────────────────────────── */

test('le corpus réunit marques, avis et commentaires — pas seulement les marques', () => {
  const etat = {
    marks: { 'movie:1': 'love' },
    reactions: { 'movie:2': ['braquage'] },
    comments: { 'movie:3': { text: 'un huis clos tendu', at: 1 } },
    films: { 'movie:1': { id: 1, title: 'A' }, 'movie:2': { id: 2, title: 'B' }, 'movie:3': { id: 3, title: 'C' } },
    horodatages: {}
  };
  const items = corpus(etat);
  assert.equal(items.length, 3);
  assert.equal(items.find(i => i.cle === 'movie:2').signe, true);
  assert.equal(items.find(i => i.cle === 'movie:2').marque, null);
  assert.equal(items.find(i => i.cle === 'movie:3').ecrit, true);
});

test('une entrée vide ne fabrique pas un film', () => {
  const items = corpus({ marks: {}, reactions: {}, comments: {}, films: {} });
  assert.equal(items.length, 0);
});

test('un état inconnu n\'est pas compté comme une marque', () => {
  const items = corpus({ marks: { 'movie:1': 'peut-etre' }, films: { 'movie:1': { id: 1, title: 'A' } } });
  assert.equal(items[0].marque, null);
  assert.equal(items[0].marquee, false);
});

test('la date d\'un geste se replie sur la fiche quand l\'horodatage manque', () => {
  const items = corpus({
    marks: { 'movie:1': 'seen' },
    films: { 'movie:1': { id: 1, title: 'A', at: 1700000000000 } }
  });
  assert.equal(items[0].quand, 1700000000000);
});

test('une marque horodatée passe avant la date d\'entrée dans la liste', () => {
  const items = corpus({
    marks: { 'movie:1': 'seen' },
    films: { 'movie:1': { id: 1, title: 'A', at: 1 } },
    horodatages: { 'marque:movie:1': 99 }
  });
  assert.equal(items[0].quand, 99);
});

/* ── Le rythme ────────────────────────────────────────────────────────────── */

test('le rythme rend tous les mois de la fenêtre, même vides', () => {
  const maintenant = new Date(2026, 5, 15).getTime();
  const items = corpus(fabriquer([['seen', 18, 2000, 7, 900]], { quand: { 'movie:1': new Date(2026, 5, 2).getTime() } }));
  const r = rythme(items, { mois: 12, maintenant });
  assert.equal(r.colonnes.length, 12);
  assert.equal(r.colonnes[11].n, 1);
  assert.equal(r.colonnes[10].n, 0);
  assert.equal(r.colonnes[11].etiquette, 'juin');
  assert.equal(r.plein, 1);
});

test('un geste plus vieux que la fenêtre ne compte pas dans le rythme mais reste daté', () => {
  const maintenant = new Date(2026, 5, 15).getTime();
  const items = corpus(fabriquer([['seen', 18, 2000, 7, 900]], { quand: { 'movie:1': new Date(2020, 0, 2).getTime() } }));
  const r = rythme(items, { mois: 12, maintenant });
  assert.equal(r.plein, 0);
  assert.equal(r.couverts, 1);
  assert.equal(r.depuis, new Date(2020, 0, 2).getTime());
});

test('les gestes sans date sont comptés à part au lieu d\'être datés d\'aujourd\'hui', () => {
  const items = corpus(fabriquer([['seen', 18, 2000, 7, 900], ['love', 35, 2001, 8, 900]]));
  const r = rythme(items, { mois: 12, maintenant: Date.now() });
  assert.equal(r.sansDate, 2);
  assert.equal(r.plein, 0);
});

/* ── La profondeur ────────────────────────────────────────────────────────── */

test('la profondeur sépare marquer, signer et écrire', () => {
  const etat = fabriquer(
    [['love', 18, 2000, 8, 900], ['seen', 35, 2001, 7, 900], ['want', 878, 2002, 6, 900]],
    { avis: { 'movie:1': ['braquage'] }, commentaires: { 'movie:1': { text: 'un huis clos tendu et beau', at: 1 } } }
  );
  const p = profondeur(corpus(etat));
  assert.equal(p.total, 3);
  assert.equal(p.marques, 3);
  assert.equal(p.signes, 1);
  assert.equal(p.ecrits, 1);
  assert.equal(p.contre.signesSurMarques, 1);
  assert.equal(p.contre.ecritsSurJuges, 1);
});

test('un avis posé sans marque est signalé — la signature seule ne dit pas si on a aimé', () => {
  const etat = { reactions: { 'movie:9': ['x'] }, marks: {}, comments: {}, films: { 'movie:9': { id: 9 } } };
  const p = profondeur(corpus(etat));
  assert.equal(p.signes, 1);
  assert.equal(p.signesSansMarque, 1);
});

/* ── Les mots ─────────────────────────────────────────────────────────────── */

test('les mots vides et les mots courts ne polluent pas le vocabulaire', () => {
  assert.deepEqual(motsDe('Le film est très bien mais la fin tombe à l’eau'), ['tombe']);
});

test('un mot répété dans un même commentaire ne compte qu\'une fois', () => {
  const items = corpus({
    marks: { 'movie:1': 'love', 'movie:2': 'love' },
    comments: {
      'movie:1': { text: 'braquage braquage braquage', at: 1 },
      'movie:2': { text: 'braquage', at: 2 }
    },
    films: { 'movie:1': { id: 1 }, 'movie:2': { id: 2 } }
  });
  const v = vocabulaire(items);
  assert.equal(v.commentaires, 2);
  assert.equal(v.mots.find(m => m.mot === 'braquage').n, 2);
});

/* ── Les territoires ──────────────────────────────────────────────────────── */

test('un genre compte ses films, ses envies et ses amours séparément', () => {
  const etat = fabriquer([
    ['love', 18, 2000, 8, 900], ['love', 18, 2001, 8, 900], ['nope', 18, 2002, 8, 900],
    ['want', 18, 2003, 8, 900], ['love', 35, 2004, 7, 900]
  ]);
  const t = territoires(corpus(etat), { genres: GENRES });
  const drame = t.find(x => x.id === 18);
  assert.equal(drame.n, 4);
  assert.equal(drame.amour, 2);
  assert.equal(drame.envie, 1);
  assert.equal(drame.juges, 3);
  assert.equal(drame.taux, 2 / 3);
  assert.equal(drame.sur, false, 'trois films jugés ne suffisent pas à conclure');
  assert.equal(drame.label, 'Drame');
});

test('un genre sans assez de films jugés ne publie pas de taux', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900], ['want', 18, 2001, 8, 900]]);
  const t = territoires(corpus(etat), { genres: GENRES });
  assert.equal(t[0].juges, 1);
  assert.equal(t[0].taux, 1, 'le taux existe…');
  assert.equal(t[0].sur, false, '…mais il n\'est pas publiable');
});

test('un genre à quatre jugés devient publiable', () => {
  const etat = fabriquer([
    ['love', 18, 2000, 8, 900], ['love', 18, 2001, 8, 900],
    ['nope', 18, 2002, 8, 900], ['ok', 18, 2003, 8, 900]
  ]);
  const t = territoires(corpus(etat), { genres: GENRES });
  assert.equal(t[0].juges, SEUIL);
  assert.equal(t[0].sur, true);
});

test('un genre inconnu de la table garde son identifiant au lieu de disparaître', () => {
  const etat = fabriquer([['love', 99999, 2000, 8, 900]]);
  const t = territoires(corpus(etat), { genres: GENRES });
  assert.equal(t[0].label, '99999');
});

test('un film à plusieurs genres compte dans chacun', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900]]);
  etat.films['movie:1'].genre_ids = [18, 35];
  const t = territoires(corpus(etat), { genres: GENRES });
  assert.equal(t.length, 2);
  assert.equal(t.every(x => x.n === 1), true);
});

/* ── Les décennies ────────────────────────────────────────────────────────── */

test('les décennies rangent les films et retiennent l\'étendue', () => {
  const etat = fabriquer([
    ['love', 18, 1972, 8, 900], ['seen', 18, 1994, 8, 900],
    ['love', 18, 1999, 8, 900], ['want', 18, 2021, 8, 900]
  ]);
  const d = decennies(corpus(etat));
  assert.deepEqual(d.lignes.map(l => l.decennie), [1970, 1990, 2020]);
  assert.equal(d.lignes.find(l => l.decennie === 1990).n, 2);
  assert.deepEqual(d.etendue, { de: 1972, a: 2021 });
  assert.equal(d.anneeAimee, 1986, '1972 et 1999 font 1985,5 — arrondi au plus proche');
  assert.equal(d.anneeAttendue, 2021);
});

test('un film sans date ne fabrique pas une décennie zéro', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900]]);
  etat.films['movie:1'].date = '';
  const d = decennies(corpus(etat));
  assert.equal(d.lignes.length, 0);
  assert.equal(d.sansDate, 1);
  assert.equal(d.etendue, null);
});

/* ── L'écart au public ────────────────────────────────────────────────────── */

test('l\'écart sépare ce que le public note de ce que Matt en dit', () => {
  const etat = fabriquer([
    ['love', 18, 2000, 8.4, 50], ['love', 18, 2001, 7.6, 90],
    ['nope', 18, 2002, 6.2, 9000], ['nope', 18, 2003, 5.4, 9000],
    ['love', 35, 2004, 7.9, 9000]
  ]);
  const e = ecartAuPublic(corpus(etat));
  assert.equal(e.moyenneAimee, 8);
  assert.equal(e.moyenneRejetee, 5.8);
  assert.equal(e.secrets.length, 2, 'deux coups de cœur sous 400 votes');
  assert.equal(e.dissidences.length, 0);
  assert.equal(e.consensus.length, 3);
});

test('une dissidence est un film bien noté qu\'on n\'a pas aimé', () => {
  const etat = fabriquer([['nope', 18, 2002, 8.1, 9000]]);
  const e = ecartAuPublic(corpus(etat));
  assert.equal(e.dissidences.length, 1);
  assert.equal(e.dissidences[0].note, 8.1);
});

test('sans assez de rejets, la moyenne rejetée n\'est pas publiable', () => {
  const etat = fabriquer([['nope', 18, 2002, 5, 900], ['love', 18, 2000, 8, 900]]);
  const e = ecartAuPublic(corpus(etat));
  assert.equal(e.surRejetee, false);
  assert.equal(e.surAimee, false);
});

/* ── La signature ─────────────────────────────────────────────────────────── */

test('la signature compte ce qu\'on ajoute et ce qu\'on retire à la proposition', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900], ['love', 18, 2001, 8, 900]], {
    avis: { 'movie:1': ['braquage', 'huis-clos'], 'movie:2': ['braquage'] }
  });
  const s = signature(corpus(etat), { proposed: () => ['huis-clos', 'nature'] });
  assert.equal(s.comparables, 2);
  assert.equal(s.gardes, 1, 'huis-clos n\'est gardé que sur le premier film');
  assert.equal(s.ajoutes.find(a => a.id === 'braquage').n, 2);
  assert.equal(s.retires.find(r => r.id === 'nature').n, 2);
  assert.equal(s.poses[0].id, 'braquage');
});

test('sans dérivation fournie, la signature se tait au lieu d\'inventer', () => {
  const s = signature(corpus(fabriquer([['love', 18, 2000, 8, 900]], { avis: { 'movie:1': ['x'] } })));
  assert.equal(s.ajoutes.length, 0);
  assert.equal(s.comparables, 0);
  assert.equal(s.poses.length, 1);
});

/* ── Les trous ────────────────────────────────────────────────────────────── */

test('les trous nomment ce qui manque et ce que le combler donnerait', () => {
  const etat = fabriquer([
    ['love', 18, 2000, 8, 900], ['seen', 18, 2001, 8, 900], ['want', 18, 2002, 8, 900]
  ]);
  const liste = trous(corpus(etat));
  const avis = liste.find(t => t.id === 'avis-manquant');
  assert.equal(avis.n, 3);
  assert.match(avis.deverrouille, /territoires/i);
  /* « Vu » n'est pas un jugement : seul « j'adore » réclame une ligne. */
  assert.equal(liste.find(t => t.id === 'mot-manquant').n, 1, 'seuls les films jugés comptent');
});

test('un trou déjà comblé disparaît de la liste', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900]], {
    avis: { 'movie:1': ['braquage'] },
    commentaires: { 'movie:1': { text: 'braquage', at: 1 } }
  });
  etat.films['movie:1'].runtime = 120;
  const ids = trous(corpus(etat)).map(t => t.id);
  assert.equal(ids.includes('avis-manquant'), false);
  assert.equal(ids.includes('mot-manquant'), false);
  assert.equal(ids.includes('duree-manquante'), false);
  assert.equal(ids.includes('mots-cles-manquants'), false);
});

test('les gestes sans date sont déclarés irréparables, sans promesse', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900]]);
  const trou = trous(corpus(etat)).find(t => t.id === 'date-manquante');
  assert.equal(trou.action, null);
  assert.match(trou.deverrouille, /irréparable/i);
});

test('seuls les trous qui coûtent une requête portent l\'action « compléter »', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900]], { avecCles: false });
  delete etat.films['movie:1'].runtime;
  const liste = trous(corpus(etat));
  assert.equal(liste.find(t => t.id === 'duree-manquante').action, 'completer');
  assert.equal(liste.find(t => t.id === 'avis-manquant').action, undefined);
});

/* ── Le portrait ──────────────────────────────────────────────────────────── */

test('le portrait d\'un état vide ne plante pas et ne raconte rien', () => {
  const p = portrait({});
  assert.equal(p.total, 0);
  assert.equal(p.repere.length, 0);
  assert.deepEqual(p.parEtat.map(e => e.n), ETATS.map(() => 0));
  assert.equal(p.duree.publiable, false);
});

test('les six états sortent dans l\'ordre, même à zéro', () => {
  const p = portrait(fabriquer([['love', 18, 2000, 8, 900]]));
  assert.deepEqual(p.parEtat.map(e => e.id), ETATS);
  assert.equal(p.parEtat.find(e => e.id === 'love').n, 1);
  assert.equal(p.parEtat.find(e => e.id === 'want').n, 0);
});

test('le temps passé ne sort que si la moitié des films vus ont une durée connue', () => {
  const fiches = [['seen', 18, 2000, 8, 900], ['seen', 18, 2001, 8, 900]];
  const etat = fabriquer(fiches);
  delete etat.films['movie:2'].runtime;
  const p = portrait(etat);
  assert.equal(p.duree.connues, 1);
  assert.equal(p.duree.vus, 2);
  assert.equal(p.duree.publiable, true, 'une durée sur deux suffit');
  assert.equal(p.repere.some(r => r.id === 'temps'), true);

  delete etat.films['movie:1'].runtime;
  const q = portrait(etat);
  assert.equal(q.duree.publiable, false, 'zéro sur deux ne suffit pas');
  assert.equal(q.repere.some(r => r.id === 'temps'), false);
  assert.equal(q.trous.some(t => t.id === 'duree-manquante'), true);
});

test('le temps passé s\'écrit en jours et en heures', () => {
  const etat = fabriquer([['seen', 18, 2000, 8, 900, { duree: 1500 }]]);
  const r = repere({
    items: corpus(etat), terres: [], ans: { lignes: [], datees: 0, etendue: null },
    public: { secrets: [], surAimee: false, surRejetee: false }, juges: [], geste: { marques: 0, signes: 0 },
    rythme: { colonnes: [], plein: 0 }, dureeMinutes: 1500, dureesConnues: 1, dureeSur: 1, dureePubliable: true
  });
  assert.match(r.find(x => x.id === 'temps').texte, /1 jour et 1 heure/);
});

test('un vocabulaire à un seul état est signalé comme un aveuglement du miroir', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900], ['love', 35, 2001, 8, 900], ['love', 878, 2002, 8, 900], ['love', 18, 2003, 8, 900]]);
  const p = portrait(etat, { genres: GENRES });
  const plat = p.repere.find(r => r.id === 'plat');
  assert.ok(plat, 'le miroir doit dire qu\'il ne peut rien séparer');
  assert.match(plat.detail, /un seul sert/);
});

test('une promesse non tenue est repérée : beaucoup d\'envie, peu d\'amour', () => {
  const etat = fabriquer([
    ['want', 878, 2000, 8, 900], ['want', 878, 2001, 8, 900], ['want', 878, 2002, 8, 900],
    ['nope', 878, 2003, 8, 900], ['nope', 878, 2004, 8, 900], ['ok', 878, 2005, 8, 900], ['ok', 878, 2006, 8, 900]
  ]);
  const p = portrait(etat, { genres: GENRES });
  const promesse = p.repere.find(r => r.id === 'promesse');
  assert.ok(promesse);
  assert.match(promesse.texte, /science-fiction/i);
});

test('le portrait n\'invente pas de territoire sous le seuil', () => {
  const etat = fabriquer([['love', 18, 2000, 8, 900], ['love', 35, 2001, 8, 900]]);
  const p = portrait(etat, { genres: GENRES });
  assert.equal(p.repere.some(r => r.id === 'territoire'), false);
});

test('chaque repère porte un identifiant unique — aucun doublon à l\'écran', () => {
  const etat = fabriquer([
    ['love', 18, 1972, 8.4, 50], ['love', 18, 1994, 7.6, 90], ['nope', 18, 1999, 6.2, 9000],
    ['nope', 35, 2001, 5.4, 9000], ['want', 878, 2021, 7.9, 9000], ['ok', 878, 2022, 8.1, 9000]
  ]);
  const p = portrait(etat, { genres: GENRES, maintenant: new Date(2026, 5, 1).getTime() });
  const ids = p.repere.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of p.repere) {
    assert.ok(r.texte.length > 0, 'un repère sans texte ne s\'affiche pas');
    assert.equal(typeof r.detail, 'string');
  }
});

test('les effectifs affichés correspondent aux films réellement comptés', () => {
  const fiches = [];
  for (let i = 0; i < 7; i++) fiches.push(['love', 18, 1990 + i, 8, 900]);
  for (let i = 0; i < 5; i++) fiches.push(['want', 35, 2000 + i, 7, 900]);
  const p = portrait(fabriquer(fiches), { genres: GENRES });
  assert.equal(p.total, 12);
  assert.equal(p.territoires.find(t => t.id === 18).n, 7);
  assert.equal(p.territoires.reduce((a, t) => a + t.n, 0), 12);
  assert.equal(p.parEtat.reduce((a, e) => a + e.n, 0), 12);
});

test('les listes d\'états ne se chevauchent pas : jugé, vu et voulu sont distincts', () => {
  assert.equal(VUS.some(v => v === 'want'), false);
  assert.equal(JUGES.some(j => j === 'love' && !VUS.includes('love')), false);
  assert.equal(JUGES.every(j => VUS.includes(j)), true, 'juger suppose avoir vu');
});

/* ── Les frontières : ce que le module doit accepter et ce qu'il doit taire ── */

test('une table de genres en Map est lue comme un objet', () => {
  /* L'application tient un `Map`. Le module lisait `genres[id]` : l'écran
     affichait « Ton territoire, c'est 12. » — un identifiant à la place d'un
     nom, invisible pour un test de structure. */
  const table = new Map(Object.entries(GENRES).map(([id, v]) => [Number(id), v]));
  const etat = fabriquer([['love', 18, 2000, 8, 900], ['love', 18, 2001, 8, 900]]);
  const t = territoires(corpus(etat), { genres: table });
  assert.equal(t[0].label, 'Drame');
  assert.equal(t[0].emoji, '🎭');

  const p = portrait(fabriquer([
    ['love', 18, 2000, 8, 900], ['love', 18, 2001, 8, 900],
    ['love', 18, 2002, 8, 900], ['ok', 18, 2003, 8, 900]
  ]), { genres: table });
  const territoire = p.repere.find(r => r.id === 'territoire');
  assert.match(territoire.texte, /drame/);
  assert.doesNotMatch(territoire.texte, /\d/, 'un nom de genre n’est jamais un identifiant');
});

test('une durée cherchée et introuvable cesse d’être un manque', () => {
  /* Sans cela, le miroir réclamerait indéfiniment quelque chose que TMDB ne
     publie pas : « 1 durée inconnue » pour toujours, et un bouton qui ne peut
     rien combler. */
  const etat = fabriquer([['seen', 18, 2000, 8, 900], ['seen', 18, 2001, 8, 900]]);
  delete etat.films['movie:1'].runtime;
  delete etat.films['movie:2'].runtime;
  assert.equal(trous(corpus(etat)).some(t => t.id === 'duree-manquante'), true, 'avant la recherche, c’est un manque');

  etat.films['movie:1'].sansDuree = true;
  etat.films['movie:2'].sansDuree = true;
  assert.equal(trous(corpus(etat)).some(t => t.id === 'duree-manquante'), false, 'après, ce n’en est plus un');
  const p = portrait(etat);
  assert.equal(p.duree.indisponibles, 2);
  assert.equal(p.duree.publiable, false, 'zéro durée mesurable ne fait pas une mesure');
});

test('un film sans durée connue ne dilue pas la mesure du temps passé', () => {
  const etat = fabriquer([
    ['seen', 18, 2000, 8, 900, { duree: 120 }],
    ['seen', 18, 2001, 8, 900, { duree: 120 }],
    ['seen', 18, 2002, 8, 900], ['seen', 18, 2003, 8, 900]
  ]);
  /* Trois films sur quatre sans durée : sans la distinction, la mesure serait
     « 2 sur 4 » — à moitié aveugle — alors qu'elle porte sur deux films dont la
     durée est la seule chose qu'on puisse connaître. */
  delete etat.films['movie:3'].runtime;
  delete etat.films['movie:4'].runtime;
  etat.films['movie:3'].sansDuree = true;
  etat.films['movie:4'].sansDuree = true;
  const p = portrait(etat);
  assert.equal(p.duree.vus, 2);
  assert.equal(p.duree.connues, 2);
  assert.equal(p.duree.publiable, true);
  assert.equal(p.repere.find(r => r.id === 'temps').detail, 'Calculé sur les 2 films que tu as vus.');
});
