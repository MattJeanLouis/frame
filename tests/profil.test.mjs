/**
 * Le profil et la synchronisation.
 *
 * Ce qui est éprouvé ici peut silencieusement perdre des données : une fusion
 * qui écrase le travail de l'autre appareil ne se voit qu'après coup, et à ce
 * moment-là c'est trop tard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  codeProfil, normaliserCode, codeValide, codeLisible,
  documentDe, documentVide, estDocument, fusionner, etatDe, differences,
  cleHorodatage, LONGUEUR_CODE
} from '../src/profil.js';

/* ── Le code ──────────────────────────────────────────────────────────────── */

test('un code fait douze signes en trois groupes de quatre', () => {
  const code = codeProfil();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});

test('un code ne contient ni I, ni O, ni 0, ni 1 — on le recopie à la main', () => {
  for (let i = 0; i < 300; i++) assert.doesNotMatch(codeProfil(), /[IO01]/);
});

test('deux cents codes ne se répètent pas', () => {
  const vus = new Set();
  for (let i = 0; i < 200; i++) vus.add(codeProfil());
  assert.equal(vus.size, 200);
});

test('un code recopié de travers est rattrapé', () => {
  assert.equal(normaliserCode('abcd-efgh-jklm'), 'ABCDEFGHJKLM');
  assert.equal(normaliserCode('ABCD EFGH JKLM'), 'ABCDEFGHJKLM');
  assert.equal(normaliserCode('A0B1C2D3E4F5'), 'A0B1C2D3E4F5');
  assert.equal(normaliserCode('IOIOIOIOIOIO'), '101010101010');
  assert.equal(normaliserCode(null), '');
});

test('la forme lisible regroupe sans perdre de signe', () => {
  const brut = normaliserCode(codeProfil());
  assert.equal(normaliserCode(codeLisible(brut)), brut);
  assert.match(codeLisible(brut), /-/);
});

test('un code trop court ou trop long est refusé', () => {
  assert.equal(codeValide('ABC'), false);
  assert.equal(codeValide('ABCDEFGHJKLM'), true);
  assert.equal(codeValide('ABCDEFGHJKLMNOP'), false, 'au-delà de douze, ce n’est pas un code');
});

/* ── Le document ──────────────────────────────────────────────────────────── */

const etatExemple = () => ({
  reactions: { 'movie:1': ['sun', 'rain'] },
  marks: { 'movie:1': 'love' },
  comments: { 'movie:1': { text: 'Formidable', preset: 'carton' } },
  films: { 'movie:1': { id: 1, kind: 'movie', title: 'Dune', at: 100 } },
  horodatages: { 'marque:movie:1': 100, 'avis:movie:1': 100, 'commentaire:movie:1': 100, 'film:movie:1': 100 }
});

test('un document porte l’état, le profil et les horodatages', () => {
  const doc = documentDe(etatExemple(), { nom: 'Matt', avatar: '🦖' }, 500);
  assert.equal(doc.version, 1);
  assert.equal(doc.modifie, 500);
  assert.equal(doc.profil.nom, 'Matt');
  assert.equal(doc.marques['movie:1'], 'love');
  assert.equal(doc.avis['movie:1'].length, 2);
  assert.equal(doc.horodatages['marque:movie:1'], 100);
});

test('un document venu du réseau n’est pas de confiance', () => {
  assert.equal(estDocument(null), false);
  assert.equal(estDocument('texte'), false);
  assert.equal(estDocument({}), false);
  assert.equal(estDocument({ version: 99 }), false);
  assert.equal(estDocument(documentVide()), true);
});

/* ── Fusionner ────────────────────────────────────────────────────────────── */

const doc = (modifie, horodatages, bacs = {}, profil = {}) => ({
  version: 1, modifie, profil, horodatages,
  marques: bacs.marques || {}, avis: bacs.avis || {}, commentaires: bacs.commentaires || {}, films: bacs.films || {}
});

test('deux films marqués sur deux appareils survivent tous les deux', () => {
  /* Le cas qui justifie toute la mécanique : le téléphone marque Dune, puis
     l'ordinateur marque Alien. Une fusion par appareil en perdrait un. */
  const telephone = doc(200, { 'marque:movie:1': 100 }, { marques: { 'movie:1': 'love' } });
  const ordinateur = doc(300, { 'marque:movie:2': 250 }, { marques: { 'movie:2': 'want' } });
  const fusion = fusionner(telephone, ordinateur);
  assert.deepEqual(fusion.marques, { 'movie:1': 'love', 'movie:2': 'want' });
});

test('sur le même film, le plus récent gagne', () => {
  const vieux = doc(100, { 'marque:movie:1': 100 }, { marques: { 'movie:1': 'want' } });
  const neuf = doc(300, { 'marque:movie:1': 300 }, { marques: { 'movie:1': 'love' } });
  assert.equal(fusionner(vieux, neuf).marques['movie:1'], 'love');
  assert.equal(fusionner(neuf, vieux).marques['movie:1'], 'love', 'l’ordre des arguments ne change rien');
});

test('une suppression récente ne se fait pas ressusciter par un appareil en retard', () => {
  /* Le cas qu'on oublie toujours : si l'absence ne se transmet pas, le film
     retiré revient à la première synchronisation. */
  const apresSuppression = doc(400, { 'marque:movie:1': 400 }, { marques: {} });
  const enRetard = doc(200, { 'marque:movie:1': 200 }, { marques: { 'movie:1': 'seen' } });
  const fusion = fusionner(apresSuppression, enRetard);
  assert.equal(fusion.marques['movie:1'], undefined, 'la suppression gagne');
  assert.equal(fusion.horodatages['marque:movie:1'], 400, 'et son horodatage est conservé');
});

test('les quatre natures se fusionnent indépendamment', () => {
  const a = doc(100, { 'marque:movie:1': 100, 'avis:movie:1': 100 },
    { marques: { 'movie:1': 'love' }, avis: { 'movie:1': ['sun'] } });
  const b = doc(200, { 'avis:movie:1': 200, 'commentaire:movie:1': 200 },
    { avis: { 'movie:1': ['moon'] }, commentaires: { 'movie:1': { text: 'Bien' } } });
  const fusion = fusionner(a, b);
  assert.equal(fusion.marques['movie:1'], 'love', 'la marque de A, non touchée par B, survit');
  assert.deepEqual(fusion.avis['movie:1'], ['moon'], 'l’avis le plus récent gagne');
  assert.equal(fusion.commentaires['movie:1'].text, 'Bien');
});

test('le profil se complète au lieu de s’écraser', () => {
  const a = doc(100, {}, {}, { nom: 'Matt', avatar: '' });
  const b = doc(200, {}, {}, { nom: '', avatar: '🦖' });
  const fusion = fusionner(a, b);
  assert.equal(fusion.profil.nom, 'Matt');
  assert.equal(fusion.profil.avatar, '🦖');
});

test('un document vide des deux côtés ne casse rien', () => {
  const fusion = fusionner(documentVide(), documentVide());
  assert.deepEqual(fusion.marques, {});
  assert.equal(fusion.modifie, 0);
});

test('un document abîmé est traité comme vide, pas comme une erreur', () => {
  const propre = doc(100, { 'marque:movie:1': 100 }, { marques: { 'movie:1': 'love' } });
  assert.deepEqual(fusionner(propre, null).marques, { 'movie:1': 'love' });
  assert.deepEqual(fusionner(null, propre).marques, { 'movie:1': 'love' });
  assert.deepEqual(fusionner(propre, 'n’importe quoi').marques, { 'movie:1': 'love' });
});

test('une entrée sans horodatage est conservée plutôt que perdue', () => {
  const ancien = doc(50, {}, { marques: { 'movie:9': 'seen' } });
  const neuf = doc(100, { 'marque:movie:1': 100 }, { marques: { 'movie:1': 'love' } });
  const fusion = fusionner(ancien, neuf);
  assert.equal(fusion.marques['movie:9'], 'seen');
  assert.equal(fusion.marques['movie:1'], 'love');
});

test('une clé horodatée d’une nature inconnue ne pollue pas les bacs', () => {
  const bizarre = doc(100, { 'n’importe quoi:movie:1': 100, 'marque:movie:1': 100 }, { marques: { 'movie:1': 'ok' } });
  const fusion = fusionner(bizarre, documentVide());
  assert.equal(fusion.marques['movie:1'], 'ok');
  assert.deepEqual(Object.keys(fusion.avis), []);
});

test('fusionner deux fois donne le même résultat que fusionner une fois', () => {
  const a = doc(100, { 'marque:movie:1': 100 }, { marques: { 'movie:1': 'love' } });
  const b = doc(200, { 'marque:movie:2': 200 }, { marques: { 'movie:2': 'want' } });
  const une = fusionner(a, b);
  const deux = fusionner(une, b);
  assert.deepEqual(deux.marques, une.marques);
  assert.deepEqual(deux.horodatages, une.horodatages);
});

/* ── Revenir à l'état local ───────────────────────────────────────────────── */

test('l’état local se reconstruit depuis un document', () => {
  const doc1 = documentDe(etatExemple(), { nom: 'Matt' }, 500);
  const etat = etatDe(doc1);
  assert.deepEqual(etat.marks, { 'movie:1': 'love' });
  assert.deepEqual(etat.reactions, { 'movie:1': ['sun', 'rain'] });
  assert.equal(etat.mesFilms['movie:1'].title, 'Dune');
  assert.equal(etat.horodatages['marque:movie:1'], 100);
});

test('l’aller-retour ne perd rien', () => {
  const depart = etatExemple();
  const retour = etatDe(documentDe(depart, {}, 1));
  assert.deepEqual(retour.marks, depart.marks);
  assert.deepEqual(retour.reactions, depart.reactions);
  assert.deepEqual(retour.comments, depart.comments);
  assert.deepEqual(retour.horodatages, depart.horodatages);
});

test('les différences se comptent, pour pouvoir le dire à l’écran', () => {
  const avant = { marks: { a: 1 }, reactions: {}, comments: {}, mesFilms: {} };
  const apres = { marks: { a: 2, b: 3 }, reactions: {}, comments: {}, mesFilms: {} };
  const d = differences(avant, apres);
  assert.equal(d.marques, 2);
  assert.equal(d.avis, 0);
});

test('la clé d’horodatage sépare bien la nature du film', () => {
  assert.equal(cleHorodatage('marque', 'tv:42'), 'marque:tv:42');
  assert.equal(LONGUEUR_CODE, 12);
});
