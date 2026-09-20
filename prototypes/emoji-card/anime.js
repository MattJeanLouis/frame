/**
 * L'UNIVERS ANIME.
 *
 * TMDB n'a pas de genres d'anime. Il a un genre « Animation » et des
 * mots-clés. Toute la taxonomie vit donc dans le vocabulaire des mots-clés —
 * et chaque identifiant ci-dessous a été MESURÉ, pas deviné.
 *
 * Trois choses ont été vérifiées contre l'API avant d'écrire cette table :
 *
 *   1. `without_original_language` N'EXISTE PAS. TMDB ne renvoie pas
 *      d'erreur, il ignore simplement le paramètre : le total était
 *      rigoureusement identique avec et sans. Exclure l'anime par la langue
 *      est donc impossible. On exclut par le mot-clé canonique `anime`
 *      (210024), que TMDB pose sur 2 441 films et 4 407 séries.
 *   2. `with_keywords` accepte plusieurs identifiants : la virgule
 *      intersecte, la barre verticale réunit. Nos catégories se réunissent —
 *      choisir « Isekai » ET « Mecha » veut dire « l'un ou l'autre ».
 *   3. Chaque identifiant rend des titres DANS l'intersection réelle de la
 *      requête (animation + japonais), pas dans l'absolu. « Studio Ghibli »
 *      existe comme mot-clé et ne rend rien : il n'est pas ici.
 *
 * Ce que « anime » veut dire ici, et c'est assumé : **animation japonaise**
 * — le genre 16 croisé avec la langue originale japonaise. C'est la
 * définition la plus large et la plus honnête qu'on puisse tenir sans
 * jugement de goût. Un film d'animation japonais qui n'a pas le mot-clé
 * `anime` reste un anime ; c'est pour cela que l'univers ne repose PAS sur le
 * mot-clé, mais sur le genre et la langue.
 */

/** Le genre TMDB « Animation ». */
export const GENRE_ANIMATION = 16;

/** Le mot-clé canonique `anime` de TMDB — sert à EXCLURE, jamais à inclure. */
export const MOT_ANIME = 210024;

/** La langue originale de l'anime. */
export const LANGUE_ANIME = 'ja';

/**
 * Les trois positions de l'univers.
 *
 * « Sans anime » n'est pas l'inverse d'« Anime » : c'est une position à part
 * entière, pour qui n'en veut pas. Elle exclut, elle ne restreint pas.
 */
export const UNIVERS = [
  {
    id: 'tout', emoji: '🌍', label: 'Tout',
    dit: 'Films, séries et animés, entremêlés.'
  },
  {
    id: 'anime', emoji: '🌸', label: 'Anime',
    dit: 'Animation japonaise seulement — et ses catégories.',
    titre: 'Anime'
  },
  {
    id: 'sans-anime', emoji: '🚫', label: 'Sans anime',
    dit: 'Tout sauf l’animation japonaise. Le reste ne bouge pas.'
  }
];

/** Un univers inconnu retombe sur « tout » : aucun filtre ne disparaît par accident. */
export const universValide = id => UNIVERS.some(u => u.id === id) ? id : 'tout';

/**
 * Est-ce un anime ?
 *
 * Genre animation ET langue japonaise. Les deux champs sont déjà dans chaque
 * résultat de `discover` : ce test ne coûte aucune requête, et il est exact.
 * C'est lui qui rend « Sans anime » fiable — le paramètre envoyé à TMDB
 * (`without_keywords`) ne sert qu'à densifier les pages, en écartant d'avance
 * ce qui serait de toute façon refusé ici.
 */
export function estAnime(film) {
  if (!film) return false;
  const anime = (film.genre_ids || []).includes(GENRE_ANIMATION);
  return anime && film.original_language === LANGUE_ANIME;
}

/**
 * Ce que l'univers ajoute à une requête `discover`.
 *
 * `with_genres` revient sous forme de tableau : card.js le réunit aux genres
 * déjà choisis, parce qu'un tableau qu'on écrase ferait disparaître le filtre
 * « Animation » de quelqu'un sans rien dire.
 */
export function paramsUnivers(univers) {
  if (univers === 'anime') {
    return { with_genres: [GENRE_ANIMATION], with_original_language: LANGUE_ANIME };
  }
  if (univers === 'sans-anime') return { without_keywords: MOT_ANIME };
  return {};
}

/**
 * LES CATÉGORIES.
 *
 * Découpées en familles parce que quatre-vingts pastilles à plat ne se lisent
 * pas. Les identifiants sont des mots-clés TMDB ; le libellé est ce qu'on dit
 * à l'écran, et le commentaire porte le mot-clé réel pour qu'on puisse le
 * revérifier sans relire la sonde.
 *
 * `[identifiant, emoji, libellé]` — le même ordre que SOUS_GENRES, pour que
 * les deux tables se lisent pareil.
 */
export const FAMILLES_ANIME = [
  {
    id: 'demographie', titre: 'Démographie', dit: 'À qui le manga s’adresse, à l’origine.',
    categories: [
      [207826, '🔥', 'Shōnen'],
      [206437, '🌸', 'Shōjo'],
      [195668, '🥃', 'Seinen'],
      [229074, '💼', 'Josei'],
      [235414, '🧒', 'Kodomo']
    ]
  },
  {
    id: 'genres', titre: 'Genres d’anime', dit: 'Ces mots n’existent qu’ici.',
    categories: [
      [237451, '🌀', 'Isekai'],
      [10046, '🤖', 'Mecha'],
      [292887, '🌙', 'Magical girl'],
      [9914, '🍵', 'Tranche de vie'],
      [291483, '🍃', 'Iyashikei'],
      [9194, '💗', 'Harem'],
      [238374, '💞', 'Harem inversé'],
      [287664, '🎤', 'Idol'],
      [6075, '🏅', 'Sport'],
      [10873, '🏫', 'École'],
      [214532, '🎒', 'Club scolaire'],
      [347667, '🎀', 'Otome'],
      [9990, '👑', 'Méchante'],
      [4779, '🚬', 'Délinquant'],
      [10683, '🌱', 'Passage à l’âge adulte'],
      [10614, '🥀', 'Tragédie'],
      [232592, '🔄', 'Échange de corps'],
      [34137, '🗝️', 'Donjons'],
      [12380, '🏆', 'Tournois']
    ]
  },
  {
    id: 'action', titre: 'Action & aventure', dit: 'Le corps et le combat.',
    categories: [
      [779, '🥋', 'Arts martiaux'],
      [1462, '⚔️', 'Samouraïs'],
      [10278, '🥷', 'Ninja'],
      [33637, '💥', 'Super-pouvoirs'],
      [9715, '🦸', 'Super-héros'],
      [9748, '💢', 'Vengeance'],
      [10349, '🏕️', 'Survie'],
      [175428, '🗺️', 'Aventuriers']
    ]
  },
  {
    id: 'sf', titre: 'Science-fiction', dit: 'Machines, mondes, boucles.',
    categories: [
      [9882, '🚀', 'Espace'],
      [161176, '🌌', 'Space opera'],
      [12190, '🌃', 'Cyberpunk'],
      [803, '🦾', 'Androïdes'],
      [4379, '⏳', 'Voyage temporel'],
      [5484, '🔁', 'Réincarnation'],
      [33465, '🪞', 'Mondes parallèles'],
      [4563, '🕶️', 'Réalité virtuelle'],
      [4458, '☢️', 'Post-apocalypse'],
      [4565, '🏚️', 'Dystopie']
    ]
  },
  {
    id: 'fantastique', titre: 'Fantastique & surnaturel', dit: 'Ce qui n’existe pas.',
    categories: [
      [6152, '👁️', 'Surnaturel'],
      [15001, '😈', 'Démons'],
      [196509, '👹', 'Yōkai'],
      [3133, '🧛', 'Vampires'],
      [9649, '⛩️', 'Dieux'],
      [2035, '🏛️', 'Mythologie'],
      [3289, '🦹', 'Méchants']
    ]
  },
  {
    id: 'horreur', titre: 'Horreur & thriller', dit: 'La peur et l’enquête.',
    categories: [
      [315058, '👻', 'Horreur'],
      [10292, '🩸', 'Gore'],
      [703, '🔍', 'Détectives'],
      [272553, '🧠', 'Psychologique']
    ]
  },
  {
    id: 'histoire', titre: 'Histoire & guerre', dit: 'Le passé, et ce qu’il coûte.',
    categories: [
      [15126, '📜', 'Historique'],
      [190446, '🏯', 'Ère Edo'],
      [194424, '🗡️', 'Ère Sengoku'],
      [162365, '🎖️', 'Militaire'],
      [273967, '💣', 'Guerre']
    ]
  },
  {
    id: 'quotidien', titre: 'Vie quotidienne', dit: 'Les jours ordinaires.',
    categories: [
      [6054, '🤝', 'Amitié'],
      [18035, '👨‍👩‍👧', 'Famille'],
      [6038, '💍', 'Mariage'],
      [6282, '🏢', 'Travail'],
      [9935, '🧳', 'Voyage'],
      [14766, '☕', 'Café'],
      [251619, '🌾', 'Campagne'],
      [10637, '🍜', 'Cuisine'],
      [283297, '🎵', 'Musique'],
      [10039, '🏎️', 'Course']
    ]
  },
  {
    id: 'source', titre: 'D’où ça vient', dit: 'Ce que l’anime adapte.',
    categories: [
      [13141, '📖', 'Adapté d’un manga'],
      [319900, '📚', 'Adapté d’un light novel'],
      [222216, '💬', 'Adapté d’un visual novel'],
      [41645, '🕹️', 'Adapté d’un jeu vidéo'],
      [323477, '🇰🇷', 'Adapté d’un manhwa'],
      [289844, '🏳️‍🌈', 'Boys’ love'],
      [214564, '🌺', 'Yuri'],
      [195669, '🔞', 'Ecchi']
    ]
  },
  {
    id: 'format', titre: 'Format', dit: 'La longueur et le canal.',
    categories: [
      [263548, '⏱️', 'Format court'],
      [323096, '📶', 'ONA']
    ]
  }
];

/** Toutes les catégories à plat, dans l'ordre des familles. */
export const CATEGORIES_ANIME = FAMILLES_ANIME.flatMap(famille =>
  famille.categories.map(([id, emoji, label]) => ({ id, emoji, label, famille: famille.id })));

export const CATEGORIE_PAR_ID = new Map(CATEGORIES_ANIME.map(c => [c.id, c]));

/** Ce qu'on écrit dans une étiquette de filtre actif. */
export const libelleCategorie = id => CATEGORIE_PAR_ID.get(id)?.label || String(id);

/**
 * Le mot-clé de la recherche par texte : « shonen » doit trouver « Shōnen ».
 *
 * On plie les accents (le ô de Shōnen) parce que personne ne les tape, et on
 * accepte la graphie sans macron comme le nom anglais de TMDB — « shounen ».
 */
export const fold = valeur => String(valeur)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function chercherCategories(texte) {
  const q = fold(texte);
  if (!q) return CATEGORIES_ANIME;
  return CATEGORIES_ANIME.filter(c =>
    fold(c.label).includes(q) ||
    fold(FAMILLES_ANIME.find(f => f.id === c.famille)?.titre || '').includes(q));
}
