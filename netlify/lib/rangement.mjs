/**
 * Le rangement commun aux deux fonctions.
 *
 * Deux documents, deux bacs : le PROFIL (privé, sous le code de synchronisation)
 * et la LISTE PUBLIQUE (ce qu'on accepte de montrer, sous un second code). Le
 * code est la seule clé des deux côtés : il n'y a ni compte, ni session, ni
 * identifiant.
 *
 * Sur Netlify, on range dans Blobs en cohérence forte — une synchronisation qui
 * relit aussitôt ce qu'elle vient d'écrire ne doit pas tomber sur une copie en
 * retard. En local, il n'y a pas de Blobs : on écrit des fichiers dans un dossier
 * ignoré par git, pour pouvoir éprouver tout ça avant de publier.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const LOCAL = join(RACINE, '.profils');

const bacs = new Map();

export async function ouvrir(nom) {
  if (bacs.has(nom)) return bacs.get(nom);
  let bac;
  try {
    const { getStore } = await import('@netlify/blobs');
    bac = { genre: 'blobs', store: getStore({ name: nom, consistency: 'strong' }) };
  } catch {
    await mkdir(LOCAL, { recursive: true });
    bac = { genre: 'fichiers', dossier: join(LOCAL, nom) };
    await mkdir(bac.dossier, { recursive: true });
  }
  bacs.set(nom, bac);
  return bac;
}

export async function lire(nom, cle) {
  const bac = await ouvrir(nom);
  if (bac.genre === 'blobs') {
    const brut = await bac.store.get(cle);
    if (brut === null) return null;
    try { return JSON.parse(brut); } catch { return null; }
  }
  try { return JSON.parse(await readFile(join(bac.dossier, cle + '.json'), 'utf8')); }
  catch { return null; }
}

export async function ecrire(nom, cle, doc) {
  const bac = await ouvrir(nom);
  const texte = JSON.stringify(doc);
  if (bac.genre === 'blobs') { await bac.store.set(cle, texte); return; }
  await writeFile(join(bac.dossier, cle + '.json'), texte, 'utf8');
}

/* ── Le code ──────────────────────────────────────────────────────────────── */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 12;

/** Les signes utiles : casse rangée, « O » pour zéro, « I » pour un. */
export const signes = saisie => String(saisie || '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')
  .replace(/O/g, '0')
  .replace(/I/g, '1');

/**
 * Un code est valide quand il fait EXACTEMENT douze signes.
 *
 * On ne tronque jamais : un code trop long est une faute de frappe, et le
 * tronquer mènerait à un AUTRE document valide — celui de quelqu'un d'autre.
 */
export const codeValide = saisie => signes(saisie).length === LONGUEUR_CODE;
export const codePropre = saisie => signes(saisie);

/* ── Les réponses ─────────────────────────────────────────────────────────── */

export const json = (corps, statut = 200) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
