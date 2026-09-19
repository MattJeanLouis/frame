/**
 * La liste publique.
 *
 * Un SECOND code, distinct du code de synchronisation, et qui ne donne que la
 * LECTURE d'une chose : la liste des films et leur état. Ni commentaires, ni
 * avis, ni mots-clés, ni résumé.
 *
 * POURQUOI DEUX CODES
 *
 * Le code de synchronisation écrit. Le partager pour montrer sa liste
 * reviendrait à donner les clés de son carnet — n'importe qui pourrait y
 * écrire. Le code public, lui, ne sert qu'à lire ce qu'on a décidé de montrer,
 * et le document qu'il ouvre ne contient rien d'autre. Ce n'est pas une
 * politesse de l'interface : c'est un document SÉPARÉ, construit à partir d'une
 * liste blanche de champs.
 */
import { lire, ecrire, codeValide, codePropre, json } from '../lib/rangement.mjs';

const BAC = 'listes';
const TAILLE_MAX = 512 * 1024;

export default async request => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!codeValide(code)) {
    return json({ erreur: 'Un code de partage fait exactement douze signes.' }, 400);
  }
  const cle = codePropre(code);

  try {
    if (request.method === 'GET') {
      const liste = await lire(BAC, cle);
      /* Une liste qu'on n'a pas encore publiée n'est pas une erreur. */
      return json({ liste });
    }

    if (request.method === 'POST') {
      const corps = await request.json().catch(() => null);
      const liste = corps?.liste;
      if (!liste || typeof liste !== 'object' || !liste.titres || typeof liste.titres !== 'object') {
        return json({ erreur: 'Liste absente ou illisible.' }, 400);
      }
      const texte = JSON.stringify(liste);
      if (texte.length > TAILLE_MAX) {
        return json({ erreur: 'Liste trop volumineuse (' + Math.round(texte.length / 1024) + ' Ko).' }, 413);
      }
      const existe = await lire(BAC, cle);
      await ecrire(BAC, cle, liste);
      return json({ ok: true, cree: !existe, titres: Object.keys(liste.titres).length });
    }

    return json({ erreur: 'Méthode non permise.' }, 405);
  } catch (error) {
    return json({ erreur: 'La liste n’a pas pu être ' + (request.method === 'GET' ? 'lue' : 'publiée') + ' : ' + error.message }, 502);
  }
};
