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
  cleHorodatage, LONGUEUR_CODE,
  listePublique, estListe, ranger, versFichier, depuisFichier, ORDRE_ETATS
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

/* ── La liste publique ────────────────────────────────────────────────────── */

test('la liste publique ne contient QUE ce qu’on accepte de montrer', () => {
  /* Le point qui compte : c'est une liste blanche. Un champ qu'on ajouterait
     demain au document privé ne doit pas se retrouver en ligne tout seul. */
  const prive = documentDe(etatExemple(), { nom: 'Matt', avatar: '🦖' }, 500);
  prive.films['movie:1'].overview = 'Un résumé confidentiel';
  prive.films['movie:1'].keywords = ['secret'];
  const publique = listePublique(prive, { nom: 'Matt', avatar: '🦖' });
  const fiche = publique.titres['movie:1'];
  assert.equal(fiche.title, 'Dune');
  assert.equal(fiche.etat, 'love');
  assert.equal(fiche.overview, undefined, 'le résumé ne sort pas');
  assert.equal(fiche.keywords, undefined, 'les mots-clés ne sortent pas');
  assert.equal(publique.commentaires, undefined, 'les commentaires ne sortent pas');
  assert.equal(publique.avis, undefined, 'les signatures ne sortent pas');
  assert.equal(publique.marques, undefined);
  assert.equal(publique.horodatages, undefined);
});

test('un film sans état n’entre pas dans la liste publique', () => {
  const doc = documentDe({
    reactions: {}, marks: {}, comments: {},
    films: { 'movie:1': { id: 1, title: 'Sans état' }, 'movie:2': { id: 2, title: 'Avec état' } },
    horodatages: {}
  }, {}, 1);
  doc.marques = { 'movie:2': 'want' };
  const publique = listePublique(doc);
  assert.equal(Object.keys(publique.titres).length, 1);
  assert.equal(publique.titres['movie:2'].title, 'Avec état');
});

test('une liste publique vide reste une liste valide', () => {
  const publique = listePublique(documentVide());
  assert.equal(estListe(publique), true);
  assert.deepEqual(publique.titres, {});
});

test('ce qui n’est pas une liste est refusé', () => {
  assert.equal(estListe(null), false);
  assert.equal(estListe({ version: 1 }), false);
  assert.equal(estListe(listePublique(documentVide())), true);
});

/* ── Ranger la liste ──────────────────────────────────────────────────────── */

const listeAvec = titres => ({ version: 1, modifie: 1, profil: { nom: 'Matt', avatar: '' }, titres });

test('la liste se range par état, dans l’ordre qu’on veut lire', () => {
  const liste = listeAvec({
    'movie:1': { id: 1, title: 'À voir un', etat: 'want', at: 10 },
    'movie:2': { id: 2, title: 'Aimé', etat: 'love', at: 20 },
    'movie:3': { id: 3, title: 'À voir deux', etat: 'want', at: 30 }
  });
  const groupes = ranger(liste);
  assert.deepEqual(groupes.map(g => g.etat), ['want', 'love'], '« à voir » avant « j’adore »');
  assert.deepEqual(groupes[0].films.map(f => f.title), ['À voir deux', 'À voir un'], 'le plus récent d’abord');
});

test('un état sans film ne fait pas un groupe vide', () => {
  const groupes = ranger(listeAvec({ 'movie:1': { id: 1, title: 'Seul', etat: 'seen', at: 1 } }));
  assert.equal(groupes.length, 1);
  assert.equal(groupes[0].etat, 'seen');
});

test('on peut ne regarder qu’un état', () => {
  const liste = listeAvec({
    'movie:1': { id: 1, title: 'A', etat: 'want', at: 1 },
    'movie:2': { id: 2, title: 'B', etat: 'love', at: 2 }
  });
  const groupes = ranger(liste, { etat: 'love' });
  assert.equal(groupes.length, 1);
  assert.equal(groupes[0].films[0].title, 'B');
});

test('la recherche ignore la casse et les accents', () => {
  const liste = listeAvec({
    'movie:1': { id: 1, title: 'Le Fabuleux Destin', etat: 'love', at: 1 },
    'movie:2': { id: 2, title: 'Dune', etat: 'want', at: 2 }
  });
  assert.equal(ranger(liste, { recherche: 'fabuleux' })[0].films[0].title, 'Le Fabuleux Destin');
  assert.equal(ranger(liste, { recherche: 'FABULEUX' })[0].films.length, 1);
  assert.equal(ranger(liste, { recherche: 'dun' })[0].films[0].title, 'Dune');
  assert.equal(ranger(liste, { recherche: 'zzz' }).length, 0);
});

test('les tris changent l’ordre sans changer les groupes', () => {
  const liste = listeAvec({
    'movie:1': { id: 1, title: 'Zèbre', etat: 'want', at: 10, vote_average: 5 },
    'movie:2': { id: 2, title: 'Abeille', etat: 'want', at: 20, vote_average: 9 }
  });
  assert.equal(ranger(liste, { tri: 'alpha' })[0].films[0].title, 'Abeille');
  assert.equal(ranger(liste, { tri: 'note' })[0].films[0].title, 'Abeille');
  assert.equal(ranger(liste, { tri: 'ancien' })[0].films[0].title, 'Zèbre');
  assert.equal(ranger(liste, { tri: 'recent' })[0].films[0].title, 'Abeille');
});

test('ranger une liste absente ne plante pas', () => {
  assert.deepEqual(ranger(null), []);
  assert.deepEqual(ranger({}), []);
});

/* ── Emporter et rapporter ────────────────────────────────────────────────── */

test('un fichier exporté se relit à l’identique', () => {
  const depart = documentDe(etatExemple(), { nom: 'Matt', avatar: '🦖' }, 500);
  const texte = versFichier(depart);
  assert.match(texte, /"application": "FRAME"/);
  const relu = depuisFichier(texte);
  assert.equal(relu.erreur, undefined);
  assert.deepEqual(relu.doc.marques, depart.marques);
  assert.deepEqual(relu.doc.avis, depart.avis);
  assert.deepEqual(relu.doc.films, depart.films);
  assert.deepEqual(relu.doc.horodatages, depart.horodatages);
});

test('un fichier étranger est refusé avec une phrase, pas par une exception', () => {
  assert.match(depuisFichier('pas du json').erreur, /JSON/);
  assert.match(depuisFichier('{"nourriture":"pizza"}').erreur, /FRAME/);
  assert.match(depuisFichier('null').erreur, /FRAME/);
  assert.match(depuisFichier('{"doc":{"version":42}}').erreur, /FRAME/);
});

test('un fichier exporté puis fusionné ne perd rien', () => {
  /* Le vrai scénario : le portable exporte, le nouveau appareil importe, et
     fusionne avec ce qu'il avait déjà. */
  const ancien = documentDe(etatExemple(), {}, 100);
  const nouveau = documentDe({
    reactions: {}, marks: { 'movie:9': 'want' }, comments: {},
    films: { 'movie:9': { id: 9, title: 'Autre' } }, horodatages: { 'marque:movie:9': 50 }
  }, {}, 200);
  const relu = depuisFichier(versFichier(ancien)).doc;
  const fusion = fusionner(nouveau, relu);
  assert.equal(fusion.marques['movie:1'], 'love', 'ce qui vient du fichier est là');
  assert.equal(fusion.marques['movie:9'], 'want', 'ce qui était déjà là reste');
});

test('la liste publique d’un document exporté se reconstruit', () => {
  const doc = depuisFichier(versFichier(documentDe(etatExemple(), { nom: 'Matt' }, 1))).doc;
  const publique = listePublique(doc);
  assert.equal(publique.titres['movie:1'].title, 'Dune');
  assert.equal(publique.profil.nom, 'Matt');
});
