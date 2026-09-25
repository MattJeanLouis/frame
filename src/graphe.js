/**
 * LE GRAPHE DES FILMS.
 *
 * Une vue où les films sont des points et où un trait dit POURQUOI deux films
 * se ressemblent. Rien ici ne touche au DOM ni au réseau : ce module construit
 * des nœuds et des liens, puis les fait bouger. La vue s'occupe du reste.
 *
 * UNE SEULE RÈGLE DE TOPOLOGIE, et elle décide de tout : dans un groupe — les
 * films d'un même réalisateur, par exemple — on ne relie pas tout le monde à
 * tout le monde, on relie chacun au PREMIER du groupe. Un groupe de dix films
 * ferait 45 traits en clique et 9 en étoile ; la clique est un plat de
 * spaghettis illisible, l'étoile est une grappe qu'on lit d'un coup d'œil. Le
 * centre du groupe n'est pas « le meilleur film », c'est juste le premier
 * arrivé — et c'est pour ça que la vue écrit le nom du groupe au survol plutôt
 * que de faire croire à une hiérarchie.
 *
 * La position de départ est déterministe (spirale d'or) : deux ouvertures du
 * même mur donnent la même image. Un graphe qui se réorganise au hasard à
 * chaque fois ne se reconnaît pas.
 */

/** Par quoi on peut relier deux films. */
export const LIENS = [
  { id: 'realisateur', label: 'Réalisateur', dit: 'Les films d’une même personne.', emoji: '🎬' },
  { id: 'saga', label: 'Saga', dit: 'Les films d’une même collection.', emoji: '🧩' },
  { id: 'casting', label: 'Casting', dit: 'Deux têtes qui se retrouvent.', emoji: '🎭' },
  { id: 'genre', label: 'Genre', dit: 'Le même territoire.', emoji: '🎞️' }
];

export const lienValide = id => (LIENS.some(l => l.id === id) ? id : 'realisateur');

/** Combien de nœuds au maximum : au-delà, les points se marchent dessus. */
export const PLAFOND = 90;

/** En dessous, il n'y a pas de graphe — juste des points isolés. */
export const MINIMUM = 2;

const OR = 2.399963229728653; // angle d'or, en radians

/** La clé d'un film — la même que partout ailleurs dans l'application. */
const cleDe = film => (film.kind || 'movie') + ':' + film.id;

/**
 * Les groupes d'un type de lien : à quoi chaque film appartient.
 *
 * Renvoie une liste de groupes, chacun étant la liste des clés qu'il contient.
 * Un film peut appartenir à plusieurs groupes (plusieurs genres), et un groupe
 * d'un seul film n'est pas un groupe : on l'écarte.
 */
export function groupes(films, lien) {
  const parGroupe = new Map();
  const ajoute = (nom, cle) => {
    if (!nom) return;
    if (!parGroupe.has(nom)) parGroupe.set(nom, []);
    parGroupe.get(nom).push(cle);
  };
  for (const film of films) {
    const cle = cleDe(film);
    if (lien === 'realisateur') ajoute(film.director, cle);
    else if (lien === 'saga') ajoute(film.collection?.name, cle);
    else if (lien === 'casting') for (const nom of film.cast || []) ajoute(nom, cle);
    else if (lien === 'genre') for (const g of film.genre_ids || []) ajoute(String(g), cle);
  }
  return [...parGroupe.entries()]
    .map(([nom, cles]) => ({ nom, cles: [...new Set(cles)] }))
    .filter(g => g.cles.length > 1);
}

/**
 * Construire le graphe.
 *
 * `films` — ce qu'on a sous la main. On n'en garde que `max`, et seulement
 * ceux qui ont de quoi se relier : un point tout seul dans son coin n'apprend
 * rien et encombre l'écran. Si personne ne se relie à personne, on préfère le
 * dire — d'où `reliés: 0` — plutôt que d'afficher une poussière d'étoiles.
 */
export function construireGraphe(films, { lien = 'realisateur', max = PLAFOND } = {}) {
  const lienChoisi = lienValide(lien);
  const tous = (films || []).slice(0, Math.max(0, max));
  const parCle = new Map(tous.map(f => [cleDe(f), f]));
  const groupesTrouves = groupes(tous, lienChoisi);

  /* Les films qui participent à au moins un groupe. */
  const participants = new Set();
  for (const g of groupesTrouves) for (const cle of g.cles) participants.add(cle);

  const retenus = tous.filter(f => participants.has(cleDe(f)));
  const index = new Map(retenus.map((f, i) => [cleDe(f), i]));

  const liens = [];
  const degre = new Array(retenus.length).fill(0);
  const vus = new Set();
  for (const g of groupesTrouves) {
    const cles = g.cles.filter(c => index.has(c));
    if (cles.length < 2) continue;
    const centre = index.get(cles[0]);
    for (let i = 1; i < cles.length; i++) {
      const autre = index.get(cles[i]);
      const paire = centre < autre ? centre + ':' + autre : autre + ':' + centre;
      if (vus.has(paire)) continue;   // deux films reliés deux fois : un seul trait
      vus.add(paire);
      liens.push({ a: centre, b: autre, groupe: g.nom });
      degre[centre]++; degre[autre]++;
    }
  }

  /* Spirale d'or : une répartition régulière, sans amas, et toujours la même. */
  const noeuds = retenus.map((film, i) => {
    const angle = i * OR;
    const rayon = 26 * Math.sqrt(i + 1);
    return {
      cle: cleDe(film), film, i,
      x: Math.cos(angle) * rayon, y: Math.sin(angle) * rayon,
      vx: 0, vy: 0, degre: degre[i], fixe: false
    };
  });

  return {
    noeuds, liens, lien: lienChoisi,
    groupes: groupesTrouves.filter(g => g.cles.filter(c => index.has(c)).length > 1).length,
    reliés: noeuds.length,
    /* Ce qu'on a REGARDÉ, et sur combien il y avait à regarder. Un graphe qui
       n'examine que vingt-six films d'un mur de quarante doit le dire : sinon
       on croit que le mur n'en contient que vingt-six.
       Ne pas confondre avec `reliés` : sur quarante films examinés, deux
       peuvent être les seuls à se relier — « 2 sur 40 examinés » dirait le
       contraire de ce qui s'est passé. */
    examines: tous.length, disponibles: (films || []).length
  };
}

/**
 * Un pas de simulation.
 *
 * Trois forces, et pas une de plus : les nœuds se repoussent, les liens
 * tirent, et le centre rappelle. C'est le modèle le plus simple qui donne un
 * graphe lisible — ajouter une force ne rend pas le dessin plus juste, ça le
 * rend plus difficile à prévoir.
 *
 * `alpha` décroît au fil des images : le graphe se pose au lieu de trembler
 * indéfiniment. `refroidi` dit quand il peut s'arrêter.
 */
export function etape(noeuds, liens, largeur, hauteur, alpha = 1) {
  const n = noeuds.length;
  if (!n) return { alpha: 0, refroidi: true };

  /* LA LONGUEUR DE REPOS SE DÉDUIT DE LA PLACE, pas d'un facteur fixe.
   *
   * Le premier jet la calculait en `46 × min(largeur, hauteur) / 34` : sur un
   * canvas de 1440 × 585, cela donnait 791 unités de repos pour quarante
   * points — ils ne pouvaient pas tenir à cette distance, donc les ressorts
   * gagnaient, et tout s'effondrait en tas au centre. Quarante affiches
   * empilées ne font pas un graphe.
   *
   * Ici : chaque point a droit à sa part de la surface, et le repos est le
   * côté de cette part. Quarante points dans 1440 × 585 donnent ~145 unités de
   * côté, donc ~104 de repos — la place qu'il faut, ni plus ni moins. */
  const cote = Math.sqrt((largeur * hauteur) / n);
  const LONGUEUR = cote * 0.72;
  const REPULSION = LONGUEUR * LONGUEUR * 1.15;
  const RESSORT = 0.045;
  const RAPPEL = 0.0055;

  for (const nd of noeuds) { nd.fx = 0; nd.fy = 0; }

  /* Répulsion : O(n²), et c'est très bien à cette taille. Une approximation de
     Barnes-Hut trierait 90 points pour gagner un dixième de milliseconde. */
  for (let i = 0; i < n; i++) {
    const a = noeuds[i];
    for (let j = i + 1; j < n; j++) {
      const b = noeuds[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = (i % 7) - 3; dy = (j % 7) - 3; d2 = dx * dx + dy * dy || 0.01; }
      const d = Math.sqrt(d2);
      const f = REPULSION / d2;
      const ux = dx / d, uy = dy / d;
      a.fx -= ux * f; a.fy -= uy * f;
      b.fx += ux * f; b.fy += uy * f;
    }
  }

  /* Les liens tirent — mais un point qui a vingt liens ne doit pas subir vingt
     fois le même ressort. Sans cette normalisation, les « hubs » traversent
     tous les autres et se collent au centre ; c'est exactement ce qui arrivait
     au graphe par genre, où un film partage son genre avec trente-neuf autres.
     On divise donc par la racine du nombre de liens : un hub tire plus fort
     qu'une feuille, jamais vingt fois plus. */
  for (const l of liens) {
    const a = noeuds[l.a], b = noeuds[l.b];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const f = (d - LONGUEUR) * RESSORT;
    const ux = dx / d, uy = dy / d;
    const na = Math.max(1, Math.sqrt(a.degre || 1));
    const nb = Math.max(1, Math.sqrt(b.degre || 1));
    a.fx += ux * f / na; a.fy += uy * f / na;
    b.fx -= ux * f / nb; b.fy -= uy * f / nb;
  }

  /* Le rappel ramène vers le BARYCENTRE du graphe, jamais vers le milieu du
     canvas. Le graphe vit dans son propre espace ; la vue n'est qu'une caméra.
     Confondre les deux envoie tous les points hors de l'écran dès que la
     simulation démarre : les nœuds se rangent autour du milieu du canvas
     pendant que la caméra les cherche autour de l'origine. */
  let mx = 0, my = 0;
  for (const nd of noeuds) { mx += nd.x; my += nd.y; }
  mx /= n; my /= n;
  for (const nd of noeuds) {
    nd.fx += (mx - nd.x) * RAPPEL;
    nd.fy += (my - nd.y) * RAPPEL;
  }

  for (const nd of noeuds) {
    if (nd.fixe) { nd.vx = 0; nd.vy = 0; continue; }
    nd.vx = (nd.vx + nd.fx * alpha) * 0.82;
    nd.vy = (nd.vy + nd.fy * alpha) * 0.82;
    /* Un plafond de vitesse : sans lui, un nœud trop proche d'un autre est
       projeté hors du cadre et n'y revient jamais. */
    const v = Math.sqrt(nd.vx * nd.vx + nd.vy * nd.vy);
    const vmax = LONGUEUR * 0.42;
    if (v > vmax) { nd.vx = nd.vx / v * vmax; nd.vy = nd.vy / v * vmax; }
    nd.x += nd.vx; nd.y += nd.vy;
  }

  const suivant = alpha * 0.985;
  return { alpha: suivant, refroidi: suivant < 0.008 };
}

/** Laisser le graphe se poser d'un coup, sans animation. Sert aux tests, et
    à `prefers-reduced-motion` : on veut le résultat, pas le trajet. */
export function stabiliser(noeuds, liens, largeur, hauteur, tours = 320) {
  let alpha = 1;
  for (let i = 0; i < tours; i++) {
    const r = etape(noeuds, liens, largeur, hauteur, alpha);
    alpha = r.alpha;
    if (r.refroidi) break;
  }
  return noeuds;
}

/** Le cadre réel du graphe : sert à le recentrer quand il déborde. */
export function cadre(noeuds, marge = 40) {
  if (!noeuds.length) return { x: 0, y: 0, largeur: 1, hauteur: 1 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const nd of noeuds) {
    x0 = Math.min(x0, nd.x - marge); y0 = Math.min(y0, nd.y - marge);
    x1 = Math.max(x1, nd.x + marge); y1 = Math.max(y1, nd.y + marge);
  }
  return { x: x0, y: y0, largeur: Math.max(1, x1 - x0), hauteur: Math.max(1, y1 - y0) };
}

/** Le voisinage d'un nœud : lui, et tout ce à quoi il est relié. */
export function voisinage(indexNoeud, liens) {
  const proches = new Set([indexNoeud]);
  for (const l of liens) {
    if (l.a === indexNoeud) proches.add(l.b);
    else if (l.b === indexNoeud) proches.add(l.a);
  }
  return proches;
}

/**
 * Le rayon d'un point. Il dit le nombre de liens, pas la qualité du film :
 * un point gros est un film qui relie — et c'est tout ce que la taille
 * raconte. La vue l'écrit dans sa légende pour qu'on ne l'invente pas.
 */
export const rayon = (degre, base = 17) => base + Math.min(9, degre * 1.6);
