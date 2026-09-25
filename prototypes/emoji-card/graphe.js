/**
 * LA VUE GRAPHE.
 *
 * Un canvas, des points, des traits. Le calcul est dans `src/graphe.js` ; ici
 * on dessine, on écoute les doigts, et on ne décide de rien.
 *
 * Trois partis pris, et ils ont chacun une raison :
 *
 *   - **Les points sont des affiches**, pas des ronds de couleur. Un graphe de
 *     pastilles abstraites pourrait représenter n'importe quoi ; celui-ci
 *     montre des films, et on reconnaît une grappe avant de la lire.
 *   - **La taille d'un point dit son nombre de liens**, jamais sa qualité. La
 *     légende l'écrit, sinon la taille raconte une histoire qu'on a inventée.
 *   - **Le survol éteint le reste.** À quatre-vingt-dix points, tout voir ne
 *     veut rien dire ; c'est le voisinage d'un film qui apprend quelque chose.
 *
 * On ne lit JAMAIS les pixels du canvas (les affiches TMDB n'envoient pas
 * d'en-tête CORS, le canvas est « souillé ») : on n'en a pas besoin, le
 * graphe se dessine et ne s'analyse pas.
 */
import {
  LIENS, PLAFOND, MINIMUM, construireGraphe, etape, stabiliser,
  cadre, voisinage, rayon, lienValide
} from '../../src/graphe.js';
import { posterUrl } from '../../src/tmdb.js';

const FOND_TRAIT = 'rgba(241,237,228,0.10)';
const FOND_TRAIT_FORT = 'rgba(229,180,105,0.75)';
const ANNEAU = 'rgba(241,237,228,0.22)';
const ANNEAU_SURVOL = '#e5b469';
const ZOOM_MIN = 0.35, ZOOM_MAX = 3.2;

let deps = null;
let graphe = { noeuds: [], liens: [] };
let vue = { x: 0, y: 0, k: 1 };
let toile = null, ctx = null, racine = null;
let largeur = 0, hauteur = 0, dpr = 1;
let images = new Map();
let survol = -1, choisi = -1, glisse = null, panoramique = null;
let animation = 0, alpha = 1;
let reduit = false;
let dernierDoigt = null;
let enAttente = false;
/* Personne n'a touché à la caméra : tant que c'est vrai, on recadre tout seul. */
let vuTouche = false;

const el = id => document.getElementById(id);

/* --- Les affiches --------------------------------------------------------- */

/**
 * Une affiche prête à dessiner, ou rien.
 *
 * On rend la main tout de suite et on redessine quand elle arrive : attendre
 * l'image bloquerait la boucle, et un graphe qui se fige à chaque affiche est
 * un graphe qu'on n'utilise pas.
 */
function affiche(film) {
  const url = film.poster_path ? posterUrl(film.poster_path, 'w185') : null;
  if (!url) return null;
  if (images.has(url)) return images.get(url);
  const img = new Image();
  img.decoding = 'async';
  const entree = { img, prete: false, ratee: false };
  images.set(url, entree);
  img.addEventListener('load', () => { entree.prete = true; if (!animation) dessiner(); });
  img.addEventListener('error', () => { entree.ratee = true; });
  img.src = url;
  return entree;
}

/* --- Le cadre ------------------------------------------------------------- */

function mesurer() {
  if (!toile) return;
  const r = toile.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  largeur = Math.max(1, Math.round(r.width));
  hauteur = Math.max(1, Math.round(r.height));
  toile.width = Math.round(largeur * dpr);
  toile.height = Math.round(hauteur * dpr);
  ctx = toile.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Écran → graphe. Sans ça, on ne peut ni survoler ni saisir un point dès
    qu'on a zoomé ou déplacé la vue. */
const versMonde = (px, py) => ({ x: (px - vue.x) / vue.k, y: (py - vue.y) / vue.k });

function recentrer() {
  const c = cadre(graphe.noeuds, 34);
  const k = Math.min(largeur / c.largeur, hauteur / c.hauteur, 1.6);
  vue.k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k));
  vue.x = largeur / 2 - (c.x + c.largeur / 2) * vue.k;
  vue.y = hauteur / 2 - (c.y + c.hauteur / 2) * vue.k;
  vuTouche = false;
}

/**
 * Recadrer pendant que le graphe se pose.
 *
 * Le recadrage une fois pour toutes ne marche pas : il mesure un graphe qui
 * n'existe pas encore. Les points commencent serrés en spirale et s'écartent
 * ensuite — mesuré au départ, le cadre est trop petit, et à l'arrivée la
 * moitié des affiches est coupée par le bas. On suit donc le graphe qui
 * grandit, doucement, tant que personne n'a touché à la caméra.
 */
function ajusterCadrage() {
  if (vuTouche || !graphe.noeuds.length) return;
  const c = cadre(graphe.noeuds, 34);
  const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(largeur / c.largeur, hauteur / c.hauteur, 1.6)));
  const cx = largeur / 2 - (c.x + c.largeur / 2) * k;
  const cy = hauteur / 2 - (c.y + c.hauteur / 2) * k;
  vue.k += (k - vue.k) * 0.14;
  vue.x += (cx - vue.x) * 0.14;
  vue.y += (cy - vue.y) * 0.14;
}

/* --- Le dessin ------------------------------------------------------------ */

function dessiner() {
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largeur, hauteur);
  ctx.translate(vue.x, vue.y);
  ctx.scale(vue.k, vue.k);

  const actif = survol >= 0 ? survol : choisi;
  const proches = actif >= 0 ? voisinage(actif, graphe.liens) : null;

  /* Les traits d'abord : ils passent sous les affiches. */
  ctx.lineWidth = 1 / vue.k;
  for (const l of graphe.liens) {
    const a = graphe.noeuds[l.a], b = graphe.noeuds[l.b];
    if (!a || !b) continue;
    const touche = proches ? (proches.has(l.a) && proches.has(l.b)) : true;
    ctx.strokeStyle = proches ? (touche ? FOND_TRAIT_FORT : 'rgba(241,237,228,0.03)') : FOND_TRAIT;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /* Puis les points. Ceux du voisinage par-dessus, pour qu'ils ne soient pas
     recouverts par un film sans rapport. */
  const ordre = [...graphe.noeuds].sort((p, q) => (proches ? (proches.has(p.i) ? 1 : 0) - (proches.has(q.i) ? 1 : 0) : 0));
  for (const nd of ordre) {
    const r = rayon(nd.degre);
    const dedans = !proches || proches.has(nd.i);
    const image = affiche(nd.film);

    ctx.globalAlpha = dedans ? 1 : 0.16;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
    if (image?.prete) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(image.img, nd.x - r, nd.y - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#1d242f';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
    ctx.lineWidth = (nd.i === actif ? 3 : 1.2) / vue.k;
    ctx.strokeStyle = nd.i === actif ? ANNEAU_SURVOL : ANNEAU;
    ctx.stroke();
  }
  ctx.restore();

  if (actif >= 0) etiquettes(actif);
}

/** Le nom du film et son groupe, posés à côté du point survolé. */
function etiquettes(i) {
  const nd = graphe.noeuds[i];
  if (!nd) return;
  const r = rayon(nd.degre);
  const x = vue.x + nd.x * vue.k;
  const y = vue.y + nd.y * vue.k;
  const titre = nd.film.title || '';
  const sous = sousTitre(nd);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '600 13px "Instrument Sans", system-ui, sans-serif';
  const l = Math.max(ctx.measureText(titre).width, ctx.measureText(sous).width);
  const bx = Math.min(Math.max(8, x - l / 2 - 10), largeur - l - 26);
  const by = y - r * vue.k - 44 < 8 ? y + r * vue.k + 10 : y - r * vue.k - 44;
  ctx.fillStyle = 'rgba(13,16,21,0.92)';
  ctx.strokeStyle = 'rgba(241,237,228,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, l + 20, 36, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2eee6';
  ctx.fillText(titre, bx + 10, by + 15);
  ctx.font = '11px "Instrument Sans", system-ui, sans-serif';
  ctx.fillStyle = '#a9b0bf';
  ctx.fillText(sous, bx + 10, by + 29);
  ctx.restore();
}

function sousTitre(nd) {
  const f = nd.film;
  const morceaux = [];
  const annee = (f.date || '').slice(0, 4);
  if (annee) morceaux.push(annee);
  if (nd.degre) morceaux.push(nd.degre + (nd.degre > 1 ? ' liens' : ' lien'));
  else morceaux.push('isolé');
  return morceaux.join(' · ');
}

/* --- La boucle ------------------------------------------------------------ */

function animer() {
  animation = requestAnimationFrame(animer);
  const r = etape(graphe.noeuds, graphe.liens, largeur, hauteur, alpha);
  alpha = r.alpha;
  ajusterCadrage();
  dessiner();
  if (r.refroidi && !glisse) arreter();
}

function lancer() {
  if (reduit) { stabiliser(graphe.noeuds, graphe.liens, largeur, hauteur); dessiner(); return; }
  alpha = 1;
  if (!animation) animation = requestAnimationFrame(animer);
}

function arreter() {
  if (animation) cancelAnimationFrame(animation);
  animation = 0;
}

/* --- Le graphe lui-même --------------------------------------------------- */

/**
 * Construire et afficher.
 *
 * `films` arrive déjà enrichi (réalisateur, saga, casting) — c'est `completer`
 * qui s'en charge avant, et c'est la seule partie chère.
 */
export function dessinerGraphe(films) {
  if (!toile) return { noeuds: 0, liens: 0 };
  mesurer();
  const lien = lienValide(deps.lien());
  /* Sur un téléphone, quarante affiches dans 390 px de large font des points
     de onze pixels : on ne peut ni les viser ni les lire. On en montre moins,
     donc plus gros — et le graphe dit combien, plutôt que de laisser croire
     qu'il montre tout. */
  const plafond = largeur < 620 ? 26 : PLAFOND;
  graphe = construireGraphe(films, { lien, max: plafond });
  survol = -1; choisi = -1;
  alpha = 1;
  recentrer();   // remet aussi vuTouche à faux
  /* L'état du graphe est écrit sur la section : c'est la convention du projet
     — identité par attribut de donnée — et c'est le seul moyen de vérifier le
     rendu sans exposer les entrailles du module. */
  racine.dataset.noeuds = String(graphe.noeuds.length);
  racine.dataset.liens = String(graphe.liens.length);
  racine.dataset.lien = lien;
  racine.dataset.vue = [Math.round(vue.x), Math.round(vue.y), vue.k.toFixed(2)].join(' ');
  majLegende();
  lancer();
  return { noeuds: graphe.noeuds.length, liens: graphe.liens.length };
}

/**
 * Ce que les AUTRES liens donneraient, sans rien simuler.
 *
 * Sur un mur de films populaires, personne ne partage de réalisateur : c'est
 * normal, et ce n'est pas une panne. Mais un graphe à deux points n'apprend
 * rien, et laisser quelqu'un devant sans lui dire que « Casting » en relierait
 * trente-huit serait l'abandonner. On mesure donc les quatre, et on le dit.
 *
 * On ne bascule PAS à sa place : le critère choisi reste le sien.
 */
function alternatives(films) {
  const ici = graphe.lien;
  return LIENS
    .filter(l => l.id !== ici)
    .map(l => ({ id: l.id, label: l.label, n: construireGraphe(films, { lien: l.id, max: PLAFOND }).noeuds.length }))
    .filter(l => l.n > graphe.noeuds.length + 2)
    .sort((a, b) => b.n - a.n);
}

function majLegende() {
  const n = graphe.noeuds.length, l = graphe.liens.length;
  const g = graphe.groupes;
  const el_ = el('graph-etat');
  if (!el_) return;
  const mot = (LIENS.find(x => x.id === graphe.lien)?.label || graphe.lien).toLowerCase();
  if (n < MINIMUM) {
    el_.textContent = 'Rien à relier ici : aucun film ne partage « ' + mot + ' » avec un autre.';
  } else {
    let texte = n + (n > 1 ? ' films reliés' : ' film relié') + ' · ' + l +
      (l > 1 ? ' liens' : ' lien') + (g ? ' · ' + g + (g > 1 ? ' groupes' : ' groupe') : '');
    /* Sur petit écran on n'a regardé qu'une partie du mur : le dire, sinon on
       croit que le mur ne contient que ça. */
    if (graphe.disponibles > graphe.examines) texte += ' · ' + graphe.examines + ' sur ' + graphe.disponibles + ' examinés';
    el_.textContent = texte;
  }

  /* Un graphe maigre n'est pas une erreur, mais il n'apprend rien. On ne
     bascule PAS à la place de celui qui regarde — changer un critère sous les
     yeux est la meilleure façon de lui faire croire que l'application fait
     n'importe quoi. On lui donne le bouton, il décide.
     Et on le fait AUSSI quand il n'y a rien du tout : c'est le cas où ce
     bouton sert le plus, celui où l'écran est vide et où il n'y a rien à
     comprendre. */
  const boite = el('graph-suggestions');
  if (!boite) return;
  const mieux = n < 12 ? alternatives(deps.films()) : [];
  boite.replaceChildren(...mieux.slice(0, 2).map(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'catalogue-control';
    b.textContent = 'Relier par ' + a.label + ' (' + a.n + ')';
    b.addEventListener('click', () => {
      deps.choisirLien(a.id);
      majBoutonsLiens();
      relancer();
    });
    return b;
  }));
}

/* --- Les gestes ----------------------------------------------------------- */

/**
 * Le point sous le doigt.
 *
 * Deux corrections par rapport au premier jet, et elles viennent toutes les
 * deux du téléphone :
 *
 *   - **La marge est en PIXELS D'ÉCRAN, pas en unités de graphe.** À k = 0,41
 *     sur un canvas de 390 px, une marge de 4 unités valait 1,6 px : les points
 *     étaient intouchables au doigt. Une marge fixe à l'écran, convertie par
 *     l'échelle, donne la même tolérance quelle que soit la vue.
 *   - **On prend le plus PROCHE, pas le dernier dessiné.** Avec quarante
 *     affiches et une marge généreuse, les zones se recouvrent ; rendre le
 *     dernier de la liste reviendrait à tirer au sort.
 */
const MARGE_DOIGT = 22;

function pointSous(px, py) {
  const { x, y } = versMonde(px, py);
  let meilleur = -1, meilleure = Infinity;
  for (let i = 0; i < graphe.noeuds.length; i++) {
    const nd = graphe.noeuds[i];
    const dx = x - nd.x, dy = y - nd.y;
    const d2 = dx * dx + dy * dy;
    const r = rayon(nd.degre) + MARGE_DOIGT / vue.k;
    if (d2 > r * r) continue;
    if (d2 < meilleure) { meilleure = d2; meilleur = i; }
  }
  return meilleur;
}

function positionEvenement(e) {
  const r = toile.getBoundingClientRect();
  return { px: e.clientX - r.left, py: e.clientY - r.top };
}

function initGestes() {
  toile.addEventListener('pointermove', e => {
    const { px, py } = positionEvenement(e);
    if (glisse) {
      const { x, y } = versMonde(px, py);
      const nd = graphe.noeuds[glisse.index];
      nd.x = x - glisse.dx; nd.y = y - glisse.dy;
      nd.vx = 0; nd.vy = 0;
      alpha = Math.max(alpha, 0.35);
      if (!animation) lancer();
      return;
    }
    if (panoramique) {
      vue.x = panoramique.vx + (px - panoramique.px);
      vue.y = panoramique.vy + (py - panoramique.py);
      vuTouche = true;
      dessiner();
      return;
    }
    const i = pointSous(px, py);
    if (i !== survol) {
      survol = i;
      toile.style.cursor = i >= 0 ? 'pointer' : 'grab';
      dessiner();
    }
  });

  toile.addEventListener('pointerdown', e => {
    const { px, py } = positionEvenement(e);
    const i = pointSous(px, py);
    toile.setPointerCapture(e.pointerId);
    if (i >= 0) {
      const { x, y } = versMonde(px, py);
      const nd = graphe.noeuds[i];
      glisse = { index: i, dx: x - nd.x, dy: y - nd.y, bouge: false, depart: { px, py } };
      nd.fixe = true;
    } else {
      panoramique = { px, py, vx: vue.x, vy: vue.y };
      vuTouche = true;
    }
  });

  const relacher = e => {
    if (glisse) {
      const { px, py } = positionEvenement(e);
      const loin = Math.hypot(px - glisse.depart.px, py - glisse.depart.py);
      const nd = graphe.noeuds[glisse.index];
      /* Un glisser qui n'a pas bougé est un clic : c'est le geste le plus
         naturel, et exiger un clic net sur une cible en mouvement serait
         pénible. */
      if (loin < 5 && nd) deps.ouvrirFiche(nd.film);
      else if (nd) { nd.fixe = false; vuTouche = true; alpha = Math.max(alpha, 0.5); if (!animation) lancer(); }
      glisse = null;
    }
    panoramique = null;
    if (toile.hasPointerCapture?.(e.pointerId)) toile.releasePointerCapture(e.pointerId);
  };
  toile.addEventListener('pointerup', relacher);
  toile.addEventListener('pointercancel', relacher);

  toile.addEventListener('pointerleave', () => {
    if (survol !== -1) { survol = -1; dessiner(); }
  });

  toile.addEventListener('wheel', e => {
    e.preventDefault();
    const { px, py } = positionEvenement(e);
    const avant = versMonde(px, py);
    const facteur = Math.exp(-e.deltaY * 0.0016);
    vue.k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vue.k * facteur));
    vuTouche = true;
    const apres = versMonde(px, py);
    vue.x += (apres.x - avant.x) * vue.k;
    vue.y += (apres.y - avant.y) * vue.k;
    dessiner();
  }, { passive: false });

  /* Le pincement à deux doigts, à la main : `wheel` ne le couvre pas sur
     téléphone, et un graphe qu'on ne peut pas écarter au doigt est illisible. */
  toile.addEventListener('touchmove', e => {
    if (e.touches.length !== 2) { dernierDoigt = null; return; }
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const r = toile.getBoundingClientRect();
    const cx = (a.clientX + b.clientX) / 2 - r.left;
    const cy = (a.clientY + b.clientY) / 2 - r.top;
    if (dernierDoigt) {
      const avant = versMonde(cx, cy);
      vue.k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vue.k * (d / dernierDoigt.d)));
      vuTouche = true;
      const apres = versMonde(cx, cy);
      vue.x += (apres.x - avant.x) * vue.k;
      vue.y += (apres.y - avant.y) * vue.k;
      dessiner();
    }
    dernierDoigt = { d };
  }, { passive: false });
  toile.addEventListener('touchend', () => { dernierDoigt = null; });

  toile.addEventListener('keydown', e => {
    if (e.key === 'Escape' && choisi >= 0) { choisi = -1; dessiner(); }
  });
}

/* --- L'extérieur ---------------------------------------------------------- */

/** L'état des boutons de critère, redit depuis la source de vérité : une
    pastille allumée qui ne filtre plus rien est pire qu'une pastille absente. */
function majBoutonsLiens() {
  const liens = el('graph-liens');
  if (!liens) return;
  for (const b of liens.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.lien === deps.lien()));
  }
}

export function initGraphe(dependances) {
  deps = dependances;
  racine = deps.racine;
  toile = deps.toile;
  reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  mesurer();
  initGestes();

  const liens = el('graph-liens');
  for (const l of LIENS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter';
    b.dataset.lien = l.id;
    b.textContent = l.label;
    b.title = l.dit;
    b.setAttribute('aria-pressed', String(deps.lien() === l.id));
    b.addEventListener('click', () => {
      deps.choisirLien(l.id);
      majBoutonsLiens();
      relancer();
    });
    liens.append(b);
  }
  majBoutonsLiens();

  el('graph-recentrer')?.addEventListener('click', () => { recentrer(); dessiner(); });

  /* Le canvas ne se redimensionne pas tout seul : une fenêtre qu'on étire
     laisserait le graphe dessiné pour l'ancienne taille. */
  let minuteur = 0;
  window.addEventListener('resize', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      if (racine.hidden) return;
      mesurer(); recentrer(); dessiner();
    }, 160);
  });
}

/** Reconstruire le graphe à partir du mur courant. */
export async function relancer() {
  if (!deps || enAttente) return;
  if (racine.hidden) return;
  enAttente = true;
  const films = deps.films();
  progres('Lecture des liens…');
  try {
    if (deps.completer) await deps.completer(films, n => progres('Lecture des liens… ' + n));
    const r = dessinerGraphe(films);
    /* On annonce, mais on n'écrit PAS dans #graph-etat : la légende vient d'y
       mettre le compte et la suggestion de meilleur lien, et une annonce de
       fin plus pauvre l'écraserait. Deux rôles, deux endroits. */
    deps.annoncer?.(r.noeuds >= MINIMUM
      ? r.noeuds + ' films dans le graphe.'
      : 'Aucun lien trouvé pour ce critère.');
  } finally { enAttente = false; }
}

/** L'avancement, à l'écran seulement — pas dans la zone d'annonce, qui
    répéterait « 12 sur 40 » à chaque pas. */
function progres(texte) {
  const e = el('graph-etat');
  if (e) e.textContent = texte;
}

export function montrerGraphe() {
  if (!racine) return;
  racine.hidden = false;
  /* Le canvas vient d'apparaître : il n'avait pas de taille avant. */
  requestAnimationFrame(() => { mesurer(); relancer(); });
}

export function cacherGraphe() {
  if (!racine) return;
  arreter();
  racine.hidden = true;
}

export const grapheVisible = () => Boolean(racine && !racine.hidden);
