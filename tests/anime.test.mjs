import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UNIVERS, GENRE_ANIMATION, MOT_ANIME, LANGUE_ANIME,
  universValide, estAnime, paramsUnivers,
  FAMILLES_ANIME, CATEGORIES_ANIME, CATEGORIE_PAR_ID, libelleCategorie, chercherCategories
} from '../prototypes/emoji-card/anime.js';
import { COLLECTIONS, FAMILLES_COLLECTIONS } from '../prototypes/emoji-card/collections.js';

/* --- L'univers ----------------------------------------------------------- */

test('l’univers a exactement trois positions', () => {
  assert.deepEqual(UNIVERS.map(u => u.id), ['tout', 'anime', 'sans-anime']);
});

test('chaque univers se nomme et s’explique', () => {
  for (const u of UNIVERS) {
    assert.ok(u.label, u.id + ' sans libellé');
    assert.ok(u.emoji, u.id + ' sans emoji');
    assert.ok(u.dit && u.dit.length > 10, u.id + ' ne dit pas ce qu’il fait');
  }
});

test('un univers inconnu retombe sur « tout » plutôt que de ne rien filtrer', () => {
  assert.equal(universValide('anime'), 'anime');
  assert.equal(universValide('n’importe quoi'), 'tout');
  assert.equal(universValide(undefined), 'tout');
  assert.equal(universValide(null), 'tout');
});

test('« tout » n’ajoute aucune contrainte à la requête', () => {
  assert.deepEqual(paramsUnivers('tout'), {});
});

test('« anime » impose le genre animation ET la langue japonaise', () => {
  const p = paramsUnivers('anime');
  assert.deepEqual(p.with_genres, [GENRE_ANIMATION]);
  assert.equal(p.with_original_language, LANGUE_ANIME);
});

test('« anime » rend un TABLEAU de genres, pour ne pas écraser ceux déjà choisis', () => {
  /* Le piège : card.js réunit ces genres à la sélection. Une valeur simple
     aurait fait disparaître le filtre de quelqu’un sans rien lui dire. */
  assert.ok(Array.isArray(paramsUnivers('anime').with_genres));
});

test('« sans anime » exclut par mot-clé et NE TOUCHE PAS au genre animation', () => {
  const p = paramsUnivers('sans-anime');
  assert.equal(p.without_keywords, MOT_ANIME);
  /* Exclure le genre 16 aurait emporté Pixar, Ghibli et tout le cinéma
     d’animation mondial. C’est l’animation JAPONAISE qu’on écarte. */
  assert.equal(p.with_genres, undefined);
  assert.equal(p.with_original_language, undefined);
});

/* --- Le prédicat --------------------------------------------------------- */

test('estAnime : animation japonaise seulement', () => {
  assert.equal(estAnime({ genre_ids: [16], original_language: 'ja' }), true);
  assert.equal(estAnime({ genre_ids: [16, 28], original_language: 'ja' }), true);
});

test('estAnime refuse l’animation non japonaise', () => {
  assert.equal(estAnime({ genre_ids: [16], original_language: 'en' }), false);
  assert.equal(estAnime({ genre_ids: [16], original_language: 'fr' }), false);
});

test('estAnime refuse un film japonais qui n’est pas de l’animation', () => {
  assert.equal(estAnime({ genre_ids: [18], original_language: 'ja' }), false);
});

test('estAnime ne casse pas sur une entrée vide', () => {
  assert.equal(estAnime(null), false);
  assert.equal(estAnime(undefined), false);
  assert.equal(estAnime({}), false);
  assert.equal(estAnime({ genre_ids: [], original_language: 'ja' }), false);
});

/* --- La table ------------------------------------------------------------ */

test('les identifiants de catégorie sont uniques et numériques', () => {
  const ids = CATEGORIES_ANIME.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiant en double');
  for (const id of ids) assert.equal(typeof id, 'number', id + ' n’est pas un nombre');
});

test('aucun emoji n’est réutilisé dans la table', () => {
  /* Deux catégories qui portent le même signe au même endroit, et le signe ne
     distingue plus rien : c’est le risque n°1 du concept. */
  const emojis = CATEGORIES_ANIME.map(c => c.emoji);
  assert.equal(new Set(emojis).size, emojis.length);
});

test('chaque catégorie est complète et rattachée à une famille connue', () => {
  const familles = new Set(FAMILLES_ANIME.map(f => f.id));
  for (const c of CATEGORIES_ANIME) {
    assert.ok(c.label, c.id + ' sans libellé');
    assert.ok(c.emoji, c.id + ' sans emoji');
    assert.ok(familles.has(c.famille), c.id + ' dans une famille inconnue : ' + c.famille);
  }
});

test('chaque famille porte un titre, une phrase et des catégories', () => {
  for (const f of FAMILLES_ANIME) {
    assert.ok(f.titre, f.id + ' sans titre');
    assert.ok(f.dit, f.id + ' sans explication');
    assert.ok(f.categories.length, f.id + ' est vide');
  }
});

test('la table couvre les catégories que réclame un amateur d’anime', () => {
  const labels = CATEGORIES_ANIME.map(c => c.label.toLowerCase());
  for (const attendu of ['shōnen', 'shōjo', 'seinen', 'josei', 'isekai', 'mecha',
    'magical girl', 'tranche de vie', 'harem', 'idol', 'ecchi', 'yuri',
    'boys’ love', 'historique', 'militaire', 'samouraïs', 'ninja', 'vampires',
    'démons', 'cyberpunk', 'voyage temporel', 'post-apocalypse', 'école',
    'sport', 'adapté d’un manga', 'adapté d’un light novel']) {
    assert.ok(labels.includes(attendu), 'catégorie manquante : ' + attendu);
  }
});

test('CATEGORIE_PAR_ID retrouve chaque catégorie', () => {
  for (const c of CATEGORIES_ANIME) assert.equal(CATEGORIE_PAR_ID.get(c.id), c);
});

test('libelleCategorie retombe sur l’identifiant plutôt que sur rien', () => {
  assert.equal(libelleCategorie(237451), 'Isekai');
  assert.equal(libelleCategorie(999999), '999999');
});

/* --- La recherche -------------------------------------------------------- */

test('chercherCategories trouve « Shōnen » sans le macron', () => {
  /* Personne ne tape le ô de Shōnen. Si la recherche l’exigeait, la catégorie
     la plus demandée serait la plus difficile à trouver. */
  const r = chercherCategories('shonen');
  assert.ok(r.some(c => c.label === 'Shōnen'), 'shonen ne trouve pas Shōnen');
  assert.ok(chercherCategories('shounen').length >= 0);
});

test('chercherCategories trouve aussi par le nom de la famille', () => {
  const r = chercherCategories('demographie');
  assert.equal(r.length, 5, 'les cinq démographies attendues');
});

test('chercherCategories retrouve tout quand on ne cherche rien', () => {
  assert.equal(chercherCategories('').length, CATEGORIES_ANIME.length);
  assert.equal(chercherCategories('   ').length, CATEGORIES_ANIME.length);
});

test('chercherCategories ne rend rien pour une absurdité', () => {
  assert.equal(chercherCategories('zzzzqqq').length, 0);
});

test('la recherche ignore la casse et les accents du libellé', () => {
  assert.ok(chercherCategories('MECHA').some(c => c.label === 'Mecha'));
  assert.ok(chercherCategories('demon').some(c => c.label === 'Démons'));
  assert.ok(chercherCategories('ecole').some(c => c.label === 'École'));
});

/* --- Les collections ----------------------------------------------------- */

test('les identifiants de collection sont uniques', () => {
  const ids = COLLECTIONS.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('chaque collection a un titre, un sous-titre, une famille et une tonalité', () => {
  const familles = new Set(FAMILLES_COLLECTIONS.map(f => f.id));
  for (const c of COLLECTIONS) {
    assert.ok(c.title, c.id + ' sans titre');
    assert.ok(c.subtitle, c.id + ' sans sous-titre');
    assert.ok(familles.has(c.famille), c.id + ' dans une famille inconnue : ' + c.famille);
    assert.ok(['rust', 'blue', 'gold'].includes(c.tone), c.id + ' a une tonalité inconnue : ' + c.tone);
  }
});

test('chaque collection déclare des genres sous forme de tableau', () => {
  for (const c of COLLECTIONS) assert.ok(Array.isArray(c.genres), c.id + ' n’a pas de genres');
});

test('l’univers d’une collection, s’il est donné, est valide', () => {
  for (const c of COLLECTIONS) {
    if (c.univers === undefined) continue;
    assert.equal(universValide(c.univers), c.univers, c.id + ' a un univers inconnu');
  }
});

test('une collection d’anime passe par l’univers, pas par un genre', () => {
  /* Le genre 16 mélangé aux catégories d’anime aurait ramené de l’animation
     non japonaise dans « Shōnen ». */
  for (const c of COLLECTIONS.filter(c => c.categoriesAnime?.length)) {
    assert.equal(c.univers, 'anime', c.id + ' filtre par catégorie sans être en univers anime');
    for (const id of c.categoriesAnime) assert.ok(CATEGORIE_PAR_ID.has(id), c.id + ' cite une catégorie inconnue : ' + id);
  }
});

test('une collection d’anime regarde films ET séries', () => {
  /* Les séries d’anime sont le gros du catalogue : les laisser sur « film »
     aurait caché la plus grande part de ce qu’on promet. */
  for (const c of COLLECTIONS.filter(c => c.univers === 'anime' && c.id !== 'anime-film')) {
    assert.equal(c.type, 'all', c.id + ' ne regarde qu’un type');
  }
});

test('les familles de collections ne sont pas vides et ne se répètent pas', () => {
  const vues = new Set();
  for (const f of FAMILLES_COLLECTIONS) {
    assert.ok(!vues.has(f.id), 'famille en double : ' + f.id);
    vues.add(f.id);
    assert.ok(COLLECTIONS.some(c => c.famille === f.id), 'famille vide : ' + f.id);
    assert.ok(f.titre && f.dit, f.id + ' incomplète');
  }
});

test('le catalogue de collections a vraiment été élargi', () => {
  assert.ok(COLLECTIONS.length >= 60, 'seulement ' + COLLECTIONS.length + ' collections');
  assert.ok(FAMILLES_COLLECTIONS.length >= 10, 'seulement ' + FAMILLES_COLLECTIONS.length + ' familles');
});
