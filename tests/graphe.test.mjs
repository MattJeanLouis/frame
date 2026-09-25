import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIENS, PLAFOND, MINIMUM, lienValide, groupes, construireGraphe,
  etape, stabiliser, cadre, voisinage, rayon
} from '../src/graphe.js';

const film = (id, extra = {}) => ({
  kind: 'movie', id, title: 'Film ' + id, poster_path: '/p' + id + '.jpg',
  genre_ids: [], popularity: 100 - id, cast: [], collection: null, ...extra
});

/** Vingt films, dont douze d'un même réalisateur. */
const MUR = [
  ...Array.from({ length: 12 }, (_, i) => film(i, { director: 'Nolan', genre_ids: [18, 878], cast: ['A', 'B'] })),
  ...Array.from({ length: 8 }, (_, i) => film(100 + i, { director: 'Autre' + i, genre_ids: [35], cast: ['Z' + i] }))
];

/* --- La table ------------------------------------------------------------ */

test('quatre façons de relier, et une seule par défaut', () => {
  assert.deepEqual(LIENS.map(l => l.id), ['realisateur', 'saga', 'casting', 'genre']);
  for (const l of LIENS) assert.ok(l.label && l.dit, l.id + ' incomplet');
});

test('un lien inconnu retombe sur le réalisateur', () => {
  assert.equal(lienValide('genre'), 'genre');
  assert.equal(lienValide('n’importe quoi'), 'realisateur');
  assert.equal(lienValide(undefined), 'realisateur');
});

/* --- Les groupes --------------------------------------------------------- */

test('les groupes réunissent ce qui partage le critère', () => {
  const g = groupes(MUR, 'realisateur');
  const nolan = g.find(x => x.nom === 'Nolan');
  assert.equal(nolan.cles.length, 12);
});

test('un groupe d’un seul film n’est pas un groupe', () => {
  const g = groupes(MUR, 'realisateur');
  assert.equal(g.length, 1, 'seul Nolan a plus d’un film');
});

test('un film à trois genres appartient à trois groupes', () => {
  const mur = [film(1, { genre_ids: [18, 878, 53] }), film(2, { genre_ids: [18, 878, 53] })];
  assert.equal(groupes(mur, 'genre').length, 3);
});

test('un film sans réalisateur ne forme pas un groupe « undefined »', () => {
  const g = groupes([film(1), film(2)], 'realisateur');
  assert.equal(g.length, 0);
});

test('le casting relie deux films qui partagent une tête', () => {
  const mur = [film(1, { cast: ['Adjani'] }), film(2, { cast: ['Adjani'] }), film(3, { cast: ['Depardieu'] })];
  const g = groupes(mur, 'casting');
  assert.equal(g.length, 1);
  assert.equal(g[0].cles.length, 2);
});

test('la saga relie les films d’une même collection', () => {
  const mur = [film(1, { collection: { id: 9, name: 'Une saga' } }), film(2, { collection: { id: 9, name: 'Une saga' } })];
  assert.equal(groupes(mur, 'saga').length, 1);
  assert.equal(groupes(mur, 'saga')[0].nom, 'Une saga');
});

/* --- La construction ----------------------------------------------------- */

test('les films sans lien sont écartés du graphe', () => {
  const g = construireGraphe(MUR, { lien: 'realisateur' });
  assert.equal(g.noeuds.length, 12, 'les huit films isolés ne doivent pas être là');
  assert.equal(g.disponibles, 20, 'mais on dit sur combien on a regardé');
});

test('une étoile, pas une clique : n−1 liens pour n films d’un même réalisateur', () => {
  /* Douze films en clique feraient 66 traits illisibles ; en étoile, 11. */
  const g = construireGraphe(MUR, { lien: 'realisateur' });
  assert.equal(g.liens.length, 11);
});

test('deux films reliés deux fois ne donnent qu’un trait', () => {
  const mur = [
    film(1, { director: 'D', cast: ['X'] }),
    film(2, { director: 'D', cast: ['X'] })
  ];
  const parReal = construireGraphe(mur, { lien: 'realisateur' });
  assert.equal(parReal.liens.length, 1);
});

test('le plafond s’applique, et le nombre de titres examinés le dit', () => {
  const g = construireGraphe(MUR, { lien: 'realisateur', max: 5 });
  assert.ok(g.noeuds.length <= 5);
  assert.equal(g.disponibles, 20);
});

test('la position de départ est déterministe', () => {
  /* Deux ouvertures du même mur doivent donner la même image : un graphe qui
     se réorganise au hasard ne se reconnaît pas. */
  const a = construireGraphe(MUR, { lien: 'realisateur' });
  const b = construireGraphe(MUR, { lien: 'realisateur' });
  assert.deepEqual(a.noeuds.map(n => [n.x, n.y]), b.noeuds.map(n => [n.x, n.y]));
});

test('aucun lien ne pointe hors du tableau', () => {
  const g = construireGraphe(MUR, { lien: 'genre' });
  for (const l of g.liens) {
    assert.ok(l.a >= 0 && l.a < g.noeuds.length, 'lien a hors bornes');
    assert.ok(l.b >= 0 && l.b < g.noeuds.length, 'lien b hors bornes');
  }
});

test('un mur vide ou absurde ne casse rien', () => {
  for (const entree of [[], null, undefined]) {
    const g = construireGraphe(entree, { lien: 'realisateur' });
    assert.equal(g.noeuds.length, 0);
    assert.equal(g.liens.length, 0);
  }
});

test('le degré de chaque nœud compte ses liens', () => {
  const g = construireGraphe(MUR, { lien: 'realisateur' });
  const parDegre = g.noeuds.map(n => n.degre);
  assert.equal(parDegre.reduce((a, b) => a + b, 0), g.liens.length * 2, 'chaque lien touche deux nœuds');
  assert.equal(parDegre.filter(d => d > 0).length, 12, 'les douze films sont reliés');
});

/* --- La simulation ------------------------------------------------------- */

test('la simulation écarte les points au lieu de les empiler', () => {
  /* C'était le défaut du premier jet : quarante points s'effondraient en tas
     au centre, et on ne voyait que les cinq du dessus. */
  const films = Array.from({ length: 40 }, (_, i) => film(i, { genre_ids: [18], director: 'D' + (i % 10) }));
  const g = construireGraphe(films, { lien: 'genre' });
  stabiliser(g.noeuds, g.liens, 1440, 585);
  let dmin = Infinity;
  for (let i = 0; i < g.noeuds.length; i++) {
    for (let j = i + 1; j < g.noeuds.length; j++) {
      const a = g.noeuds[i], b = g.noeuds[j];
      dmin = Math.min(dmin, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  assert.ok(dmin > 40, 'deux points se chevauchent encore : écart ' + dmin.toFixed(1));
});

test('la simulation se refroidit et s’arrête', () => {
  const g = construireGraphe(MUR, { lien: 'realisateur' });
  let alpha = 1, tours = 0;
  while (tours < 2000) {
    const r = etape(g.noeuds, g.liens, 1200, 600, alpha);
    alpha = r.alpha; tours++;
    if (r.refroidi) break;
  }
  assert.ok(tours < 2000, 'la simulation ne se refroidit jamais');
  assert.ok(tours > 20, 'elle s’arrête trop tôt');
});

test('un graphe vide se refroidit immédiatement', () => {
  const r = etape([], [], 800, 600, 1);
  assert.equal(r.refroidi, true);
});

test('un nœud fixé ne bouge plus', () => {
  const g = construireGraphe(MUR, { lien: 'realisateur' });
  const nd = g.noeuds[0];
  nd.fixe = true;
  const avant = { x: nd.x, y: nd.y };
  for (let i = 0; i < 40; i++) etape(g.noeuds, g.liens, 1200, 600, 1);
  assert.equal(nd.x, avant.x);
  assert.equal(nd.y, avant.y);
});

test('la simulation ne laisse pas dériver le graphe hors du cadre', () => {
  const g = construireGraphe(MUR, { lien: 'genre' });
  stabiliser(g.noeuds, g.liens, 1200, 600);
  const c = cadre(g.noeuds, 0);
  assert.ok(c.largeur < 20000 && c.hauteur < 20000, 'le graphe a explosé : ' + Math.round(c.largeur) + '×' + Math.round(c.hauteur));
});

/* --- Le voisinage et le rayon -------------------------------------------- */

test('le voisinage contient le nœud et ses voisins, rien de plus', () => {
  const g = construireGraphe(MUR, { lien: 'realisateur' });
  const v = voisinage(0, g.liens);
  assert.ok(v.has(0), 'le nœud lui-même doit y être');
  assert.equal(v.size, 1 + g.noeuds[0].degre);
});

test('un nœud isolé est seul dans son voisinage', () => {
  assert.equal(voisinage(0, []).size, 1);
});

test('le rayon grandit avec le nombre de liens, et reste borné', () => {
  assert.ok(rayon(0) < rayon(3), 'le rayon doit dire le degré');
  assert.ok(rayon(100) < rayon(0) + 10, 'le rayon ne doit pas exploser');
});

test('le cadre enferme tous les points', () => {
  const g = construireGraphe(MUR, { lien: 'realisateur' });
  stabiliser(g.noeuds, g.liens, 1200, 600);
  const c = cadre(g.noeuds, 34);
  for (const nd of g.noeuds) {
    assert.ok(nd.x >= c.x && nd.x <= c.x + c.largeur, 'point hors du cadre en x');
    assert.ok(nd.y >= c.y && nd.y <= c.y + c.hauteur, 'point hors du cadre en y');
  }
});

test('le cadre d’un graphe vide ne divise pas par zéro', () => {
  const c = cadre([], 34);
  assert.ok(c.largeur > 0 && c.hauteur > 0);
});

/* --- Les constantes ------------------------------------------------------ */

test('le plafond et le minimum ont du sens', () => {
  assert.ok(MINIMUM >= 2, 'sous deux films il n’y a pas de lien');
  assert.ok(PLAFOND >= 40 && PLAFOND <= 200, 'plafond invraisemblable : ' + PLAFOND);
});
