/**
 * Le miroir — ce que tes gestes disent de tes goûts.
 *
 * Rien ici ne touche au DOM ni au réseau : ce module prend ce que Matt a marqué,
 * signé et écrit, et rend un PORTRAIT. C'est donc la partie qu'on peut éprouver,
 * et c'est là que les calculs doivent être justes.
 *
 * LA RÈGLE QUI GOUVERNE TOUT CE FICHIER
 *
 * Un miroir incomplet qui fait semblant d'être complet est un miroir qui ment.
 * Matt n'a pas tout rempli : beaucoup de ses films n'ont ni avis ni commentaire,
 * et une partie de ses marques date d'avant qu'on garde les horodatages. Chaque
 * mesure sort donc avec SON EFFECTIF, et rien ne conclut sous `SEUIL` — quatre,
 * parce qu'en dessous deux films font une tendance et trois font une opinion.
 * Une section sans matière ne s'affiche pas : un écran ne s'excuse pas, il se
 * tait. Et quand il y a de la matière mais pas assez pour conclure, il le dit.
 *
 * LES TROIS FAMILLES DE MESURES
 *
 *   le GESTE    — comment tu te sers de FRAME : ce que tu marques, à quel
 *                 rythme, jusqu'où tu vas (un avis ? une ligne ?) ;
 *   la MATIÈRE  — ce que tu regardes : territoires, années, mots ;
 *   l'ÉCART     — toi par rapport au public, qui est la seule comparaison qui
 *                 ne soit pas un jugement de FRAME sur les films.
 */

/* Les six états, dans l'ordre du plus tourné vers l'avenir au plus tranché. */
export const ETATS = ['want', 'watching', 'seen', 'ok', 'love', 'nope'];

/** Ce qu'on a réellement regardé — les seuls dont la durée compte. */
export const VUS = ['seen', 'ok', 'love', 'nope'];

/** Ce qu'on a jugé — les seuls qui disent quelque chose d'un goût. */
export const JUGES = ['ok', 'love', 'nope'];

/** En dessous, on ne conclut pas. On affiche quand même, en le disant. */
export const SEUIL = 4;

/* ── Les petits outils ────────────────────────────────────────────────────── */

const nombre = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const somme = liste => liste.reduce((a, b) => a + b, 0);
const moyenne = liste => (liste.length ? somme(liste) / liste.length : 0);

/** Une moyenne, arrondie au dixième : au-delà, on prétend à une précision qu'on
 *  n'a pas — une note TMDB est déjà une moyenne d'inconnus. */
const dixieme = v => Math.round(v * 10) / 10;

const anneeDe = date => {
  const m = /^(\d{4})/.exec(String(date || ''));
  return m ? Number(m[1]) : 0;
};

const decennieDe = annee => (annee ? Math.floor(annee / 10) * 10 : 0);

const sansAccent = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Le libellé d'un genre, que la table soit un objet ou une `Map`.
 *
 * L'application tient un `Map`, les tests un objet — et le module lisait
 * `genres[id]`. Résultat : « Ton territoire, c'est 12. » à l'écran. Un genre
 * sans nom ne se voit pas dans un test de structure : il faut regarder la
 * phrase. La frontière accepte donc les deux formes.
 */
const infoGenre = (genres, id) => {
  if (!genres) return {};
  if (typeof genres.get === 'function') return genres.get(id) || {};
  return genres[id] || {};
};

/**
 * Ce qui ne dit rien d'un film : les mots de tout le monde.
 *
 * Une liste courte et assumée vaut mieux qu'un dictionnaire : on ne cherche pas
 * à faire de l'analyse de texte, on cherche les mots QUE MATT EMPLOIE. Les mots
 * outils les plus fréquents du français écrit suffisent à faire apparaître les
 * autres.
 */
const MOTS_VIDES = new Set(('alors aussi autre avec avoir avait bien beaucoup car ce cela ces cet cette chaque comme comment dans des du dedans dehors depuis derriere devant doit donc dont elle elles encore est etait etre eux fait faire fois font hier ici il ils jamais je juste la le les leur lui mais meme mes moi mon ne nos notre nous on ont ou oui par parce pas peut peu plus pourquoi pour quand que quel quelle quelles quels qui rien sa se selon ses si son sont sur ta te tes toi ton tous tout toute toutes tres trop tu un une va vais vas vers voila vont vrai vraiment y a ai as au aux avais avais été etes suis es sera seraient serait deux trois quatre cinq six sept huit neuf dix cent mille premier premiere dernier derniere avant apres pendant toujours souvent parfois vraiment peu beaucoup mieux moins aussi ainsi donc puis enfin bref voila chose choses truc genre types type film films cinema scene scenes histoire histoire moment moments fois coup heure heures jour jours annee annees').split(/\s+/));

/** Les mots d'un commentaire, prêts à être comptés : minuscules, sans accents,
 *  sans ponctuation, sans les mots que tout le monde emploie. */
export function motsDe(texte) {
  return sansAccent(texte)
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/[\s'-]+/)
    .filter(m => m.length >= 4 && !MOTS_VIDES.has(m));
}

/* ── Le corpus ────────────────────────────────────────────────────────────── */

/**
 * Tout ce que Matt a touché, ramené à une seule liste.
 *
 * La liste est l'UNION de ce qu'il a marqué, signé et commenté — pas seulement
 * ce qu'il a marqué. Un film signé sans avoir été marqué fait partie de sa
 * culture : l'oublier parce qu'il manque une case serait exactement le travers
 * qu'on essaie d'éviter.
 *
 * `quand` est la date du geste le plus récent, avec trois replis successifs :
 * l'horodatage de la marque, la date d'entrée dans la liste (qui existe depuis
 * toujours, donc couvre les données anciennes), et la date de la fiche. Une
 * donnée sans date n'est pas rejetée : elle compte dans les totaux, et elle est
 * simplement exclue des mesures de rythme — qui le diront.
 */
export function corpus(etat = {}) {
  const marques = etat.marks || {};
  const avis = etat.reactions || {};
  const commentaires = etat.comments || {};
  const fiches = etat.films || {};
  const horodatages = etat.horodatages || {};

  const cles = new Set([
    ...Object.keys(marques), ...Object.keys(avis),
    ...Object.keys(commentaires), ...Object.keys(fiches)
  ]);

  const items = [];
  for (const cle of cles) {
    const fiche = fiches[cle] || null;
    const marque = ETATS.includes(marques[cle]) ? marques[cle] : null;
    const signes = Array.isArray(avis[cle]) ? avis[cle].filter(Boolean) : [];
    const texte = String(commentaires[cle]?.text || '').trim();
    if (!fiche && !marque && !signes.length && !texte) continue;

    const quand = nombre(horodatages['marque:' + cle])
      || nombre(fiche?.at)
      || nombre(horodatages['film:' + cle])
      || 0;
    const annee = anneeDe(fiche?.date);

    items.push({
      cle,
      kind: fiche?.kind || cle.slice(0, cle.indexOf(':')) || 'movie',
      titre: String(fiche?.title || ''),
      affiche: fiche?.poster_path || null,
      annee,
      decennie: decennieDe(annee),
      genres: Array.isArray(fiche?.genre_ids) ? fiche.genre_ids : [],
      note: nombre(fiche?.vote_average) || null,
      voix: nombre(fiche?.vote_count) || null,
      motsCles: Array.isArray(fiche?.keywords) ? fiche.keywords : null,
      duree: nombre(fiche?.runtime) || null,
      /* On a cherché la durée et TMDB n'en a pas : ce n'est plus un manque, et
         le miroir ne doit pas le réclamer indéfiniment. */
      dureeInconnue: fiche?.sansDuree === true,
      /* La fiche brute part avec l'entrée : c'est elle que `signature` donne à
         la dérivation du nom, et elle seule qui sait si des mots-clés existent.
         L'oublier ici rendait `signature` et `trous` silencieusement vides. */
      fiche,
      marque,
      signes,
      texte,
      quand,
      /* Trois degrés d'engagement, du plus faible au plus fort. Ils servent à
         mesurer la PROFONDEUR du geste, pas sa qualité. */
      marquee: Boolean(marque),
      signe: signes.length > 0,
      ecrit: texte.length > 0
    });
  }
  return items;
}

/* ── Le geste ─────────────────────────────────────────────────────────────── */

const MOIS_COURTS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

/**
 * Le rythme : combien de gestes par mois sur la fenêtre demandée.
 *
 * On rend TOUS les mois, même vides. Un trou dans un histogramme est une
 * information — « juillet, rien » se lit, alors qu'un histogramme qui saute les
 * mois vides invente une régularité qui n'existe pas.
 */
export function rythme(items, { mois = 12, maintenant = Date.now() } = {}) {
  const date = new Date(maintenant);
  const colonnes = [];
  for (let i = mois - 1; i >= 0; i--) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    colonnes.push({ annee: d.getFullYear(), mois: d.getMonth(), n: 0, items: [] });
  }
  const premier = new Date(colonnes[0].annee, colonnes[0].mois, 1).getTime();
  let sansDate = 0;
  for (const item of items) {
    if (!item.quand) { sansDate++; continue; }
    if (item.quand < premier) continue;
    const d = new Date(item.quand);
    const colonne = colonnes.find(c => c.annee === d.getFullYear() && c.mois === d.getMonth());
    if (!colonne) continue;
    colonne.n++;
    colonne.items.push(item);
  }
  for (const c of colonnes) c.etiquette = MOIS_COURTS[c.mois];
  const dates = items.filter(i => i.quand).map(i => i.quand);
  return {
    colonnes,
    sansDate,
    /* Le premier geste date d'avant la fenêtre : on le dit, sinon « 12 mois »
       se lirait comme « tu as commencé il y a douze mois ». */
    depuis: dates.length ? Math.min(...dates) : 0,
    plusRecent: dates.length ? Math.max(...dates) : 0,
    plein: colonnes.reduce((a, c) => a + c.n, 0),
    couverts: dates.length
  };
}

/**
 * La profondeur du geste.
 *
 * C'est la mesure la plus directement utile à Matt : elle ne parle pas de ses
 * goûts mais de sa MÉTHODE. Marquer est un réflexe ; signer et écrire sont des
 * choix. Le rapport entre les deux dit s'il se sert de FRAME comme d'un
 * marque-page ou comme d'un carnet.
 */
export function profondeur(items) {
  const marques = items.filter(i => i.marquee);
  const signes = items.filter(i => i.signe);
  const ecrits = items.filter(i => i.ecrit);
  const mots = ecrits.flatMap(i => motsDe(i.texte));
  return {
    total: items.length,
    marques: marques.length,
    signes: signes.length,
    ecrits: ecrits.length,
    /* Signé ET marqué : la signature seule ne dit pas si le film est aimé. */
    signesSansMarque: signes.filter(i => !i.marquee).length,
    contre: {
      signesSurMarques: marques.filter(i => i.signe).length,
      ecritsSurJuges: marques.filter(i => JUGES.includes(i.marque) && i.ecrit).length
    },
    mots: mots.length,
    motsDistincts: new Set(mots).size,
    longueurMoyenne: ecrits.length ? Math.round(moyenne(ecrits.map(i => motsDe(i.texte).length))) : 0
  };
}

/** Les mots que Matt emploie vraiment, du plus fréquent au plus rare. */
export function vocabulaire(items, { max = 40 } = {}) {
  const compte = new Map();
  let commentaires = 0;
  for (const item of items) {
    if (!item.ecrit) continue;
    commentaires++;
    /* Un mot ne compte qu'UNE fois par commentaire : sans cela, un film dont on
       parle longuement pèserait plus lourd que dix films d'un mot, et le nuage
       parlerait d'un film au lieu de parler d'un goût. */
    for (const mot of new Set(motsDe(item.texte))) compte.set(mot, (compte.get(mot) || 0) + 1);
  }
  const mots = [...compte.entries()]
    .map(([mot, n]) => ({ mot, n }))
    .sort((a, b) => b.n - a.n || a.mot.localeCompare(b.mot, 'fr'))
    .slice(0, max);
  return { commentaires, mots };
}

/* ── La matière ───────────────────────────────────────────────────────────── */

/**
 * Les territoires : les genres, avec leurs effectifs et ce qu'ils deviennent.
 *
 * Trois colonnes par genre, et c'est leur ÉCART qui est intéressant :
 *   `n`        ce que tu as marqué — l'intention ;
 *   `envie`    ce que tu veux voir — la promesse ;
 *   `vu`       ce que tu as regardé ;
 *   `amour`    ce que tu as aimé ;
 *   `taux`     amour / jugés — la seule colonne qui parle de goût.
 *
 * Un genre à fort `envie` et faible `taux` est une promesse qui ne se réalise
 * pas ; c'est exactement le genre de chose qu'un simple décompte cache.
 */
export function territoires(items, { genres = {}, seuil = SEUIL } = {}) {
  const table = new Map();
  for (const item of items) {
    for (const id of item.genres) {
      if (!table.has(id)) table.set(id, { id, items: [] });
      table.get(id).items.push(item);
    }
  }
  const lignes = [];
  for (const { id, items: dedans } of table.values()) {
    const info = infoGenre(genres, id);
    const juges = dedans.filter(i => JUGES.includes(i.marque));
    const amour = dedans.filter(i => i.marque === 'love').length;
    const vu = dedans.filter(i => VUS.includes(i.marque)).length;
    const envie = dedans.filter(i => i.marque === 'want').length;
    lignes.push({
      id,
      label: info.label || String(id),
      emoji: info.emoji || '',
      n: dedans.length,
      vu,
      envie,
      amour,
      juges: juges.length,
      taux: juges.length ? amour / juges.length : null,
      /* Le taux n'est publiable que s'il repose sur assez de films jugés. */
      sur: juges.length >= seuil,
      items: dedans
    });
  }
  lignes.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'fr'));
  return lignes;
}

/**
 * Les décennies : d'où viennent les films que tu regardes.
 *
 * On ne montre pas les décennies vides au milieu d'une série — un histogramme
 * avec des trous se lit mal — mais on ne les supprime pas non plus : elles
 * reviennent en creux dans `etendue`, qui dit de quelle année à quelle année va
 * ta culture.
 */
export function decennies(items, { seuil = SEUIL } = {}) {
  const table = new Map();
  for (const item of items) {
    if (!item.decennie) continue;
    if (!table.has(item.decennie)) table.set(item.decennie, []);
    table.get(item.decennie).push(item);
  }
  const lignes = [...table.entries()]
    .map(([decennie, dedans]) => ({
      decennie,
      n: dedans.length,
      amour: dedans.filter(i => i.marque === 'love').length,
      items: dedans,
      sur: dedans.length >= seuil
    }))
    .sort((a, b) => a.decennie - b.decennie);

  const avecDate = items.filter(i => i.annee);
  const aimees = avecDate.filter(i => i.marque === 'love').map(i => i.annee);
  const attendues = avecDate.filter(i => i.marque === 'want').map(i => i.annee);
  return {
    lignes,
    datees: avecDate.length,
    sansDate: items.length - avecDate.length,
    etendue: avecDate.length ? { de: Math.min(...avecDate.map(i => i.annee)), a: Math.max(...avecDate.map(i => i.annee)) } : null,
    anneeAimee: aimees.length ? Math.round(moyenne(aimees)) : null,
    anneeAttendue: attendues.length ? Math.round(moyenne(attendues)) : null,
    aimees: aimees.length,
    attendues: attendues.length
  };
}

/* ── L'écart : toi et le public ───────────────────────────────────────────── */

/**
 * La seule comparaison qui ne soit pas un jugement de FRAME.
 *
 * FRAME ne note pas les films et ne notera jamais. Mais TMDB publie une note
 * publique, et l'écart entre cette note et ce que Matt en a dit est une
 * INFORMATION SUR MATT : ses secrets sont les films que personne n'a vus et
 * qu'il adore ; ses dissidences sont les films que tout le monde adore et qu'il
 * n'a pas aimés. Les deux sont intéressants, aucun des deux n'est une faute.
 */
export function ecartAuPublic(items, { seuil = SEUIL } = {}) {
  const notes = items.filter(i => i.note !== null && i.marque && JUGES.includes(i.marque));
  const amours = items.filter(i => i.marque === 'love' && i.note !== null);
  const rejets = items.filter(i => i.marque === 'nope' && i.note !== null);
  const aimes = amours.map(i => i.note);
  const rejetes = rejets.map(i => i.note);
  return {
    notes: notes.length,
    moyenneAimee: aimes.length ? dixieme(moyenne(aimes)) : null,
    moyenneRejetee: rejetes.length ? dixieme(moyenne(rejetes)) : null,
    surAimee: aimes.length >= seuil,
    surRejetee: rejetes.length >= seuil,
    /* Adorés que le public connaît à peine : moins de 400 votes, c'est un film
       que presque personne n'a vu. Le seuil est grossier et assumé. */
    secrets: amours.filter(i => (i.voix || 0) < 400).sort((a, b) => (a.voix || 0) - (b.voix || 0)),
    /* Adorés par le public (7,5 et plus) et pas par lui. */
    dissidences: rejets.filter(i => i.note >= 7.5).sort((a, b) => b.note - a.note),
    /* Le consensus : ses coups de cœur que le public porte aussi. */
    consensus: amours.filter(i => i.note >= 7.5),
    raretes: amours.length
      ? Math.round(moyenne(amours.map(i => i.voix || 0)))
      : null
  };
}

/* ── La signature : les signes que tu poses ───────────────────────────────── */

/**
 * Ce que Matt ajoute et ce que Matt retire, par rapport à ce que la machine
 * proposait.
 *
 * C'est la lecture la plus directe de son goût : les signes qu'il AJOUTE sont ce
 * qu'il cherche dans un film, ceux qu'il RETIRE sont ce que la machine croit
 * comprendre et qui ne le concerne pas. `proposed` est fourni par l'appelant :
 * la dérivation vit dans l'application, et le miroir ne la réimplémente pas —
 * deux dérivations qui divergent donneraient deux vérités.
 */
export function signature(items, { proposed = null } = {}) {
  const compte = filtre => {
    const table = new Map();
    for (const item of items) for (const id of filtre(item)) table.set(id, (table.get(id) || 0) + 1);
    return [...table.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  };

  const poses = compte(i => i.signes);
  if (!proposed) return { poses, ajoutes: [], retires: [], comparables: 0, gardes: 0 };

  let comparables = 0;
  let gardes = 0;
  const ajoutes = new Map();
  const retires = new Map();
  for (const item of items) {
    if (!item.fiche) continue;
    const base = proposed(item.fiche) || [];
    if (!base.length) continue;
    comparables++;
    for (const id of item.signes) {
      if (base.includes(id)) gardes++;
      else ajoutes.set(id, (ajoutes.get(id) || 0) + 1);
    }
    for (const id of base) if (!item.signes.includes(id)) retires.set(id, (retires.get(id) || 0) + 1);
  }
  const vers = table => [...table.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  return { poses, ajoutes: vers(ajoutes), retires: vers(retires), comparables, gardes };
}

/* ── Ce qui manque ────────────────────────────────────────────────────────── */

/**
 * Les trous, nommés, comptés, et cliquables.
 *
 * C'est la réponse directe à « je n'ai pas tout rempli ». Un miroir qui se
 * contente de constater le vide est un miroir qui reproche ; un miroir qui dit
 * CE QUI MANQUE, COMBIEN, ET CE QUE ÇA DÉBLOQUERAIT est un miroir qui propose.
 *
 * Chaque trou porte sa promesse : ce que la mesure donnera quand il sera comblé.
 * Une promesse qu'on ne tient pas est pire qu'un silence, donc chaque promesse
 * est vérifiée par un test.
 */
export function trous(items) {
  const marques = items.filter(i => i.marquee);
  const juges = items.filter(i => JUGES.includes(i.marque));
  const vus = items.filter(i => VUS.includes(i.marque));
  const sansAvis = marques.filter(i => !i.signe && i.fiche);
  const sansMot = juges.filter(i => !i.ecrit && i.fiche);
  const sansDuree = vus.filter(i => !i.duree && i.fiche && !i.dureeInconnue);
  const sansMotsCles = items.filter(i => i.fiche && (!i.motsCles || !i.motsCles.length));
  const sansDate = items.filter(i => !i.quand);

  const liste = [];
  if (sansAvis.length) liste.push({
    id: 'avis-manquant',
    titre: sansAvis.length + (sansAvis.length > 1 ? ' films marqués sans avis' : ' film marqué sans avis'),
    dit: 'Une marque dit si tu as aimé. Une signature dit ce que tu y as vu — c\'est elle qui nomme le film dans le mur.',
    deverrouille: 'Tes territoires, recalculés sur ton vocabulaire à toi et non sur celui de TMDB.',
    n: sansAvis.length, sur: marques.length, items: sansAvis
  });
  if (sansMot.length) liste.push({
    id: 'mot-manquant',
    titre: sansMot.length + (sansMot.length > 1 ? ' films jugés sans une ligne' : ' film jugé sans une ligne'),
    dit: 'Tu as tranché, mais tu n\'as rien écrit. C\'est ce que tu écriras qui restera dans deux ans.',
    deverrouille: 'Le nuage de tes mots — ceux que tu emploies vraiment pour parler de films.',
    n: sansMot.length, sur: juges.length, items: sansMot
  });
  if (sansDuree.length) liste.push({
    id: 'duree-manquante',
    titre: sansDuree.length + (sansDuree.length > 1 ? ' durées inconnues' : ' durée inconnue'),
    dit: 'What the Flick ne garde pas la durée d\'un film tant qu\'il ne l\'a pas ouvert en grand.',
    deverrouille: 'Le temps total que tu as passé devant ces films, en jours et en heures.',
    n: sansDuree.length, sur: vus.length, items: sansDuree, action: 'completer'
  });
  if (sansMotsCles.length) liste.push({
    id: 'mots-cles-manquants',
    titre: sansMotsCles.length + (sansMotsCles.length > 1 ? ' films sans leurs mots-clés' : ' film sans ses mots-clés'),
    dit: 'Les mots-clés de TMDB sont la matière première du nom d\'un film. Sans eux, il retombe sur son genre.',
    deverrouille: 'Ce que tu cherches vraiment — braquages, huis clos, voyages dans le temps — et pas seulement « Thriller ».',
    n: sansMotsCles.length, sur: items.length, items: sansMotsCles, action: 'completer'
  });
  if (sansDate.length) liste.push({
    id: 'date-manquante',
    titre: sansDate.length + (sansDate.length > 1 ? ' gestes sans date' : ' geste sans date'),
    dit: 'Ces marques datent d\'avant que What the Flick garde l\'horodatage. Impossible de les replacer dans le temps.',
    deverrouille: 'Rien — c\'est irréparable. Elles comptent dans les totaux, et elles sont absentes du rythme.',
    n: sansDate.length, sur: items.length, items: sansDate, action: null
  });
  return liste;
}

/* ── Le portrait ──────────────────────────────────────────────────────────── */

/**
 * Tout le portrait en un appel.
 *
 * `genres` est une table id → { label, emoji } fournie par l'application ;
 * `proposed` est la fonction qui dérive le nom d'un film. Le module reste pur :
 * il ne connaît ni TMDB, ni les stickers, ni le DOM.
 */
export function portrait(etat = {}, {
  genres = {}, proposed = null, maintenant = Date.now(), mois = 12, seuil = SEUIL
} = {}) {
  const items = corpus(etat);
  const parEtat = ETATS.map(id => ({ id, n: items.filter(i => i.marque === id).length }));
  const geste = profondeur(items);
  const terres = territoires(items, { genres, seuil });
  const ans = decennies(items, { seuil });
  const public_ = ecartAuPublic(items, { seuil });
  const mots = vocabulaire(items);
  const lignesRythme = rythme(items, { mois, maintenant });

  /* Le temps passé : seulement sur ce qu'on a VU, et seulement sur les films
     dont on connaît la durée. Une estimation partielle est présentée comme
     telle, jamais comme un total. */
  const vus = items.filter(i => VUS.includes(i.marque));
  /* Le temps passé se mesure sur les films dont la durée est CONNAISSABLE : un
     film dont TMDB ne publie pas la durée ne doit ni empêcher la mesure, ni
     rester pour toujours dans « ce qui manque ». */
  const mesurables = vus.filter(i => !i.dureeInconnue);
  const dureesConnues = mesurables.filter(i => i.duree);
  const minutes = somme(dureesConnues.map(i => i.duree));

  const juges = items.filter(i => JUGES.includes(i.marque));

  return {
    items,
    total: items.length,
    parEtat,
    geste,
    rythme: lignesRythme,
    territoires: terres,
    decennies: ans,
    public: public_,
    mots,
    signature: signature(items, { proposed }),
    duree: {
      minutes,
      connues: dureesConnues.length,
      vus: mesurables.length,
      indisponibles: vus.length - mesurables.length,
      /* En dessous de la moitié, on ne montre pas de total : il serait si
         partiel qu'il se lirait comme un fait. */
      publiable: mesurables.length > 0 && dureesConnues.length / mesurables.length >= 0.5
    },
    /* Les faits saillants, calculés ici et pas dans la vue : ce qu'on affiche en
       tête doit être vrai, donc ça se teste. */
    repere: repere({ items, terres, ans, public: public_, juges, geste, rythme: lignesRythme, dureeMinutes: minutes, dureesConnues: dureesConnues.length, dureeSur: mesurables.length, dureePubliable: mesurables.length > 0 && dureesConnues.length / mesurables.length >= 0.5 }),
    trous: trous(items)
  };
}

/**
 * Les phrases du portrait.
 *
 * Elles sont calculées, pas écrites à la main dans la vue : une phrase qui
 * décrit Matt doit pouvoir être éprouvée, sinon elle dérivera du calcul qu'elle
 * prétend résumer. Chaque repère porte son effectif quand il en a un.
 */
export function repere({ items, terres, ans, public: pub, juges, geste, rythme: ryt, dureeMinutes, dureesConnues, dureeSur, dureePubliable }) {
  const out = [];

  /* Le territoire principal : le genre le plus représenté. */
  const premier = terres.find(t => t.n >= SEUIL);
  if (premier) out.push({
    id: 'territoire',
    texte: 'Ton territoire, c\'est ' + premier.label.toLowerCase() + '.',
    detail: premier.n + ' films sur ' + items.length + ' en portent la marque' + (premier.taux !== null && premier.sur
      ? ', et tu en aimes ' + Math.round(premier.taux * 100) + ' sur 100.'
      : '.'),
    emoji: premier.emoji
  });

  /* La promesse non tenue : beaucoup d'envie, peu d'amour. */
  const promesse = terres
    .filter(t => t.sur && t.envie >= 2 && t.taux !== null && t.taux <= 0.34 && t.n >= SEUIL)
    .sort((a, b) => b.envie - a.envie)[0];
  if (promesse) out.push({
    id: 'promesse',
    texte: 'Tu attends beaucoup de ' + promesse.label.toLowerCase() + ', et il te le rend mal.',
    detail: promesse.envie + ' films que tu veux voir, et ' + promesse.juges + ' jugés dont ' + promesse.amour + ' seulement que tu adores.',
    emoji: promesse.emoji
  });

  /* Le territoire sûr : le meilleur taux parmi ceux qui ont assez de matière. */
  const sur = terres.filter(t => t.sur && t.taux !== null).sort((a, b) => b.taux - a.taux || b.n - a.n)[0];
  if (sur && sur.taux >= 0.6) out.push({
    id: 'sur',
    texte: 'Là où tu ne te trompes pas : ' + sur.label.toLowerCase() + '.',
    detail: sur.amour + ' coups de cœur sur ' + sur.juges + ' jugés.',
    emoji: sur.emoji
  });

  /* Le rythme : le mois le plus chargé de la fenêtre. */
  if (ryt.plein >= SEUIL) {
    const fort = [...ryt.colonnes].sort((a, b) => b.n - a.n)[0];
    const actifs = ryt.colonnes.filter(c => c.n > 0).length;
    out.push({
      id: 'rythme',
      texte: 'Tu marques par vagues : ' + actifs + (actifs > 1 ? ' mois actifs' : ' mois actif') + ' sur ' + ryt.colonnes.length + '.',
      detail: 'Le plus chargé fut ' + fort.etiquette + ' ' + fort.annee + ', avec ' + fort.n + ' films.',
      emoji: '🌊'
    });
  }

  /* La profondeur : signer et écrire, ou seulement marquer. */
  if (geste.marques >= SEUIL) {
    if (geste.signes === 0) out.push({
      id: 'profondeur',
      texte: 'Tu marques, mais tu ne signes pas encore.',
      detail: geste.marques + ' films marqués, aucun avis posé. La signature est ce qui donne son nom à un film dans le mur.',
      emoji: '✍️'
    });
    else if (geste.signes < geste.marques / 2) out.push({
      id: 'profondeur',
      texte: 'Tu marques vite, tu signes rarement.',
      detail: geste.signes + ' avis pour ' + geste.marques + ' films marqués.',
      emoji: '✍️'
    });
    else out.push({
      id: 'profondeur',
      texte: 'Tu vas jusqu\'au bout : tu signes presque tout ce que tu marques.',
      detail: geste.signes + ' avis sur ' + geste.marques + ' films marqués.',
      emoji: '✍️'
    });
  }

  /* L'écart au public : les deux sens. */
  if (pub.surAimee && pub.surRejetee && pub.moyenneAimee !== null && pub.moyenneRejetee !== null) {
    const ecart = dixieme(pub.moyenneAimee - pub.moyenneRejetee);
    out.push({
      id: 'ecart',
      texte: ecart >= 0.8
        ? 'Tu aimes ce que le public aime — mais tu choisis mieux que lui.'
        : ecart <= 0.2
          ? 'Ta note ne suit pas celle du public : tu ne rejettes pas les films mal notés, tu rejettes autre chose.'
          : 'Tes coups de cœur sont un peu mieux notés que tes rejets, sans plus.',
      detail: 'Le public donne ' + pub.moyenneAimee.toString().replace('.', ',') + ' à ce que tu adores et '
        + pub.moyenneRejetee.toString().replace('.', ',') + ' à ce que tu n\'aimes pas.',
      emoji: '🌍'
    });
  }

  /* La rareté : ce que tu adores est-il vu par beaucoup de monde ? */
  if (pub.secrets.length >= 2 && pub.raretes !== null) {
    out.push({
      id: 'rarete',
      texte: 'Tu adores des films que presque personne n\'a vus.',
      detail: pub.secrets.length + ' de tes coups de cœur ont moins de 400 votes sur TMDB.',
      emoji: '🔭'
    });
  }

  /* Les années : ce que tu regardes vient d'où. */
  if (ans.etendue && ans.datees >= SEUIL) {
    const forte = [...ans.lignes].sort((a, b) => b.n - a.n)[0];
    out.push({
      id: 'annees',
      texte: 'Ta culture va de ' + ans.etendue.de + ' à ' + ans.etendue.a + ', et penche vers les années ' + forte.decennie + '.',
      detail: forte.n + ' films sur ' + ans.datees + ' datés viennent des années ' + forte.decennie + '.',
      emoji: '🗓️'
    });
  }

  /* Le temps passé — seulement s'il est publiable, sinon on se tait et le trou
     s'en charge. */
  if (dureePubliable && dureeMinutes && dureesConnues) {
    const jours = Math.floor(dureeMinutes / 1440);
    const heures = Math.round((dureeMinutes % 1440) / 60);
    out.push({
      id: 'temps',
      texte: 'Tu as passé ' + (jours ? jours + (jours > 1 ? ' jours' : ' jour') + ' et ' : '') + heures + (heures > 1 ? ' heures' : ' heure') + ' devant ces films.',
      detail: dureesConnues >= dureeSur
        ? 'Calculé sur les ' + dureeSur + ' films que tu as vus.'
        : 'Calculé sur ' + dureesConnues + ' des ' + dureeSur + ' films que tu as vus dont la durée est connue.',
      emoji: '⏳'
    });
  }

  /* Le vocabulaire plat : le miroir doit le dire, c'est son rôle. */
  if (juges.length >= SEUIL && new Set(juges.map(i => i.marque)).size === 1) out.push({
    id: 'plat',
    texte: 'Tes ' + juges.length + ' jugements disent tous la même chose.',
    detail: 'Six états existent ; un seul sert. Le miroir ne peut pas séparer ce que tu adores de ce que tu tolères.',
    emoji: '🪞'
  });

  return out;
}
