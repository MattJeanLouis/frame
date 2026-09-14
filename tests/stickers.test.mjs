import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TWEMOJI_BASE, DRAWERS, STICKERS, STICKER_BY_ID, STICKER_INDEX,
  FORBIDDEN_LABELS, twemojiUrl
} from '../src/stickers.js';

const EXPECTED_IDS = [
  'silhouette', 'woman', 'man', 'child', 'elder', 'cop', 'detective', 'cowboy',
  'ninja', 'astronaut', 'royalty', 'musician',
  'robot', 'alien', 'wolf', 'vampire', 'zombie', 'dragon', 'dinosaur', 'shark',
  'octopus', 'ghost', 'horse', 'dog',
  'city_night', 'metropolis', 'forest', 'desert', 'ocean', 'mountain', 'island',
  'abandoned_house', 'castle', 'space', 'school', 'hospital', 'palace', 'countryside',
  'gun', 'knife', 'money', 'ring', 'camera', 'guitar', 'piano', 'book', 'car',
  'motorcycle', 'plane', 'ship', 'candle', 'champagne', 'pills', 'lab',
  'hat', 'sunglasses', 'leather_coat', 'evening_dress', 'suit', 'martial_arts',
  'mask', 'kimono', 'uniform',
  'rain', 'night', 'sun', 'snow', 'fire', 'storm', 'fog', 'red_light',
  'blue_light', 'violet_neon', 'dusk',
  'antiquity', 'medieval', 'black_white', 'eighties', 'future', 'wasteland',
  'circus', 'casino', 'science', 'orient', 'america', 'tokyo'
];

test('les sept tiroirs sont dans l\'ordre de la spec', () => {
  assert.deepEqual(DRAWERS.map(d => d.id), [
    'characters', 'creatures', 'places', 'objects', 'clothes', 'sky', 'world'
  ]);
  for (const d of DRAWERS) {
    assert.equal(typeof d.label, 'string');
    assert.ok(d.label.length > 0);
  }
});

test('instantané de l\'ordre des identifiants', () => {
  // Ce test échoue dès qu'un identifiant est inséré ailleurs qu'à la fin,
  // renommé ou supprimé. L'encodage d'URL dépend de cet ordre exact.
  assert.deepEqual(STICKERS.map(s => s.id), EXPECTED_IDS);
});

test('le vocabulaire compte environ 80 stickers', () => {
  assert.ok(STICKERS.length >= 78 && STICKERS.length <= 100, `taille inattendue : ${STICKERS.length}`);
});

test('les identifiants sont uniques et en ASCII minuscule', () => {
  const seen = new Set();
  for (const s of STICKERS) {
    assert.ok(!seen.has(s.id), `identifiant en double : ${s.id}`);
    seen.add(s.id);
    assert.match(s.id, /^[a-z][a-z0-9_]*$/, `identifiant non conforme : ${s.id}`);
  }
});

test('les emoji sont uniques', () => {
  const seen = new Set();
  for (const s of STICKERS) {
    assert.ok(!seen.has(s.emoji), `emoji en double : ${s.emoji} (${s.id})`);
    seen.add(s.emoji);
  }
});

test('chaque sticker appartient à un tiroir déclaré', () => {
  const ids = new Set(DRAWERS.map(d => d.id));
  for (const s of STICKERS) {
    assert.ok(ids.has(s.drawer), `tiroir inconnu pour ${s.id} : ${s.drawer}`);
  }
});

test('chaque tiroir contient entre 9 et 16 stickers', () => {
  for (const d of DRAWERS) {
    const n = STICKERS.filter(s => s.drawer === d.id).length;
    assert.ok(n >= 9 && n <= 16, `${d.id} contient ${n} stickers`);
  }
});

test('chaque sticker a 4 à 8 mots-clés TMDB en minuscules', () => {
  for (const s of STICKERS) {
    assert.ok(Array.isArray(s.keywords), `${s.id} : keywords absent`);
    assert.ok(s.keywords.length >= 4 && s.keywords.length <= 8,
      `${s.id} a ${s.keywords.length} mots-clés`);
    const seen = new Set();
    for (const k of s.keywords) {
      assert.equal(typeof k, 'string');
      assert.equal(k, k.toLowerCase(), `${s.id} : mot-clé non minuscule « ${k} »`);
      assert.ok(k.trim().length > 0, `${s.id} : mot-clé vide`);
      assert.ok(!seen.has(k), `${s.id} : mot-clé en double « ${k} »`);
      seen.add(k);
    }
  }
});

test('les libellés sont français, courts et jamais abstraits', () => {
  const forbidden = new Set(FORBIDDEN_LABELS.map(w => w.toLowerCase()));
  assert.ok(forbidden.size >= 10);
  for (const s of STICKERS) {
    assert.equal(typeof s.label, 'string');
    assert.ok(s.label.length > 0 && s.label.length <= 24, `libellé trop long : ${s.label}`);
    assert.ok(!forbidden.has(s.label.toLowerCase()), `libellé interdit : ${s.label}`);
  }
});

test('les genres déclarés sont des entiers TMDB connus', () => {
  const known = new Set([28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37]);
  for (const s of STICKERS) {
    if (s.genres === undefined) continue;
    assert.ok(Array.isArray(s.genres) && s.genres.length > 0, `${s.id} : genres vide`);
    for (const g of s.genres) assert.ok(known.has(g), `${s.id} : genre inconnu ${g}`);
  }
});

test('seul le tiroir « sky » porte des atmosphères, et toutes sont valides', () => {
  const particles = new Set(['rain', 'snow', 'embers', 'fog']);
  for (const s of STICKERS) {
    if (s.drawer !== 'sky') {
      assert.equal(s.atmosphere, undefined, `${s.id} ne devrait pas avoir d'atmosphère`);
      continue;
    }
    assert.ok(s.atmosphere, `${s.id} : atmosphère manquante`);
    const a = s.atmosphere;
    assert.match(a.tint, /^#[0-9A-Fa-f]{6}$/, `${s.id} : teinte invalide`);
    assert.ok(a.intensity > 0 && a.intensity <= 0.5, `${s.id} : intensité hors bornes`);
    assert.ok(a.light >= -1 && a.light <= 1, `${s.id} : lumière hors bornes`);
    if (a.particles !== undefined) {
      assert.ok(particles.has(a.particles), `${s.id} : particules inconnues ${a.particles}`);
    }
  }
});

test('les index sont cohérents avec l\'ordre de STICKERS', () => {
  assert.equal(STICKER_BY_ID.size, STICKERS.length);
  assert.equal(STICKER_INDEX.size, STICKERS.length);
  STICKERS.forEach((s, i) => {
    assert.equal(STICKER_INDEX.get(s.id), i);
    assert.equal(STICKER_BY_ID.get(s.id), s);
  });
});

test('les index tiennent sur un octet, contrainte de l\'encodage d\'URL', () => {
  assert.ok(STICKERS.length <= 256, 'plus de 256 stickers : l\'encodage sur 1 octet casse');
});

test('twemojiUrl : emoji simple', () => {
  assert.equal(twemojiUrl('🌃'), TWEMOJI_BASE + '1f303.svg');
});

test('twemojiUrl : U+FE0F retiré quand il n\'y a pas de U+200D', () => {
  assert.equal(twemojiUrl('🕶️'), TWEMOJI_BASE + '1f576.svg');
  assert.ok(!twemojiUrl('🕶️').includes('fe0f'));
  assert.equal(twemojiUrl('✈️'), TWEMOJI_BASE + '2708.svg');
});

test('twemojiUrl : U+200D conservé, et U+FE0F conservé avec lui', () => {
  assert.equal(twemojiUrl('🧑‍🚀'), TWEMOJI_BASE + '1f9d1-200d-1f680.svg');
  assert.ok(twemojiUrl('🧑‍🚀').includes('200d'));
  const detective = twemojiUrl('🕵️‍♀️');
  assert.equal(detective, TWEMOJI_BASE + '1f575-fe0f-200d-2640-fe0f.svg');
  assert.ok(detective.includes('200d'));
  assert.ok(detective.includes('fe0f'));
});

test('TWEMOJI_BASE pointe sur jsDelivr en SVG', () => {
  assert.match(TWEMOJI_BASE, /^https:\/\/cdn\.jsdelivr\.net\/gh\/jdecked\/twemoji@[^/]+\/assets\/svg\/$/);
});

test('chaque sticker produit une URL Twemoji plausible', () => {
  for (const s of STICKERS) {
    const url = twemojiUrl(s.emoji);
    assert.ok(url.startsWith(TWEMOJI_BASE), s.id);
    assert.match(url.slice(TWEMOJI_BASE.length), /^[0-9a-f]+(-[0-9a-f]+)*\.svg$/, `${s.id} : ${url}`);
  }
});
