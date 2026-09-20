/** Parcours éditoriaux : chaque collection correspond à des critères visibles et modifiables.
 *
 * TROIS RÈGLES, et elles ont été vérifiées contre TMDB, pas supposées :
 *
 *   1. `topic` doit être le nom EXACT d'un mot-clé TMDB, ET ce mot-clé doit
 *      porter des titres. Les deux vont ensemble : « romantic comedy » existe
 *      (id 383992) et ne rend ZÉRO film ; « romcom » (9799) en rend 1 121.
 *      `verif-collections.mjs` ouvre chaque collection et compte ses
 *      résultats ; `sonde-mots-cles.mjs` vérifie les mots-clés un par un.
 *   2. `genres` sont des identifiants de FILM (le vocabulaire commun de
 *      l'application). En collection `type: 'tv'`, ils sont traduits.
 *   3. Une collection d'anime n'utilise pas `topic` : elle porte directement
 *      les identifiants de mots-clés de `anime.js`, déjà mesurés.
 *
 * LES FAMILLES SONT LA SOURCE, la liste à plat en découle. Recopier une
 * famille dans chaque collection aurait fini par diverger — et le panneau
 * range les tuiles par famille, donc une divergence se verrait.
 */

const FAMILLES = [
  {
    id: 'horreur', titre: 'Horreur', dit: 'Ce qui fait peur.',
    items: [
      { id: 'haunted', title: 'Présences invisibles', subtitle: 'Fantômes & maisons hantées', genres: [27], topic: 'ghost', tone: 'rust' },
      { id: 'exorcisme', title: 'Le mal en soi', subtitle: 'Possessions & exorcismes', genres: [27], topic: 'exorcism', tone: 'rust' },
      { id: 'slasher', title: 'La nuit du tueur', subtitle: 'Slashers & survie', genres: [27], topic: 'slasher', tone: 'rust' },
      { id: 'body', title: 'Le corps en crise', subtitle: 'Body horror & métamorphoses', genres: [27], topic: 'body horror', tone: 'rust' },
      { id: 'folk', title: 'Campagne inquiète', subtitle: 'Horreur folklorique', genres: [27], topic: 'folk horror', tone: 'rust' },
      { id: 'found', title: 'Images retrouvées', subtitle: 'Found footage', genres: [27], topic: 'found footage', tone: 'rust' },
      { id: 'creatures', title: 'Ça rôde', subtitle: 'Créatures & monstres', genres: [27], topic: 'monster', tone: 'rust' }
    ]
  },
  {
    id: 'sf', titre: 'Science-fiction', dit: 'Ailleurs, plus tard, autrement.',
    items: [
      { id: 'space', title: 'Loin de la Terre', subtitle: 'Voyages & exploration spatiale', genres: [878], topic: 'space travel', tone: 'blue' },
      { id: 'mind', title: 'Réalités parallèles', subtitle: 'Temps, boucles & paradoxes', genres: [878], topic: 'time travel', tone: 'blue' },
      { id: 'ia', title: 'Machines pensantes', subtitle: 'Intelligences artificielles', genres: [878], topic: 'artificial intelligence (a.i.)', tone: 'blue' },
      { id: 'postapo', title: 'Après la fin', subtitle: 'Post-apocalypse', genres: [878], topic: 'post-apocalyptic', tone: 'blue' },
      { id: 'alien', title: 'Premier contact', subtitle: 'Extraterrestres', genres: [878], topic: 'alien', tone: 'blue' },
      { id: 'cyber', title: 'Néons et pluie', subtitle: 'Cyberpunk', genres: [878], topic: 'cyberpunk', tone: 'blue' }
    ]
  },
  {
    id: 'polar', titre: 'Polar', dit: 'Le crime et ceux qui le poursuivent.',
    items: [
      { id: 'heist', title: 'Le casse parfait', subtitle: 'Braquages & plans impossibles', genres: [80], topic: 'heist', tone: 'gold' },
      { id: 'mafia', title: 'La famille', subtitle: 'Mafia & crime organisé', genres: [80], topic: 'mafia', tone: 'gold' },
      { id: 'serial', title: 'Profilage', subtitle: 'Tueurs en série', genres: [80], topic: 'serial killer', tone: 'gold' },
      { id: 'noir', title: 'Le film noir', subtitle: 'Détectives & nuits blanches', genres: [80], topic: 'film noir', tone: 'gold' },
      { id: 'prison', title: 'Derrière les barreaux', subtitle: 'Prison & évasion', genres: [80], topic: 'prison', tone: 'gold' },
      { id: 'espion', title: 'Agents secrets', subtitle: 'Espionnage', genres: [28], topic: 'spy', tone: 'gold' }
    ]
  },
  {
    id: 'action', titre: 'Action & aventure', dit: 'Le corps, l’espace, le danger.',
    items: [
      { id: 'kungfu', title: 'Poings et sabres', subtitle: 'Arts martiaux', genres: [28], topic: 'martial arts', tone: 'rust' },
      { id: 'chase', title: 'Poursuite', subtitle: 'Courses & cascades', genres: [28], topic: 'chase', tone: 'rust' },
      { id: 'hero', title: 'Justiciers', subtitle: 'Super-héros', genres: [28], topic: 'superhero', tone: 'rust' },
      { id: 'treasure', title: 'Chasse au trésor', subtitle: 'Cartes, pièges & ruines', genres: [12], topic: 'treasure hunt', tone: 'gold' },
      { id: 'sea', title: 'En pleine mer', subtitle: 'Naufrages & grands voyages', genres: [12], topic: 'shipwreck', tone: 'blue' },
      { id: 'mountain', title: 'L’appel du sommet', subtitle: 'Ascensions & survie', genres: [12], topic: 'mountain climbing', tone: 'blue' }
    ]
  },
  {
    id: 'drame', titre: 'Drame', dit: 'Vivre, perdre, tenir.',
    items: [
      { id: 'growing', title: 'L’âge des possibles', subtitle: 'Grandir, partir, se trouver', genres: [18], topic: 'coming of age', tone: 'gold' },
      { id: 'justice', title: 'La loi et le doute', subtitle: 'Procès & verdicts', genres: [18], topic: 'courtroom', tone: 'gold' },
      { id: 'grief', title: 'Faire son deuil', subtitle: 'Perdre, et continuer', genres: [18], topic: 'grief', tone: 'blue' },
      { id: 'illness', title: 'Corps malades', subtitle: 'Maladie & soins', genres: [18], topic: 'illness', tone: 'blue' },
      { id: 'travail', title: 'Le monde du travail', subtitle: 'Bureaux & ambitions', genres: [18], topic: 'workplace', tone: 'gold' },
      { id: 'partir', title: 'Partir', subtitle: 'Exil & immigration', genres: [18], topic: 'immigration', tone: 'blue' }
    ]
  },
  {
    id: 'comedie', titre: 'Comédie', dit: 'On rit, jaune ou franchement.',
    items: [
      { id: 'laugh', title: 'Rire un peu noir', subtitle: 'Comédies à l’humour grinçant', genres: [35], topic: 'dark comedy', tone: 'rust' },
      { id: 'buddy', title: 'Deux de trop', subtitle: 'Duos mal assortis', genres: [35], topic: 'buddy comedy', tone: 'gold' },
      { id: 'satire', title: 'La satire mord', subtitle: 'Comédies qui visent', genres: [35], topic: 'satire', tone: 'gold' },
      { id: 'parodie', title: 'On se moque', subtitle: 'Parodies', genres: [35], topic: 'parody', tone: 'gold' },
      { id: 'vacances', title: 'Vacances ratées', subtitle: 'Comédies de voyage', genres: [35], topic: 'vacation', tone: 'gold' }
    ]
  },
  {
    id: 'romance', titre: 'Romance', dit: 'Deux personnes, et ce qui arrive.',
    items: [
      { id: 'love', title: 'Les histoires à deux', subtitle: 'Comédies romantiques', genres: [35,10749], topic: 'romcom', tone: 'rust' },
      { id: 'premier', title: 'Premier amour', subtitle: 'Le tout début', genres: [10749], topic: 'first love', tone: 'rust' },
      { id: 'interdit', title: 'Amours interdites', subtitle: 'Ce qu’on ne devrait pas', genres: [10749], topic: 'forbidden love', tone: 'rust' },
      { id: 'horscadre', title: 'Hors du cadre', subtitle: 'Romances LGBTQ+', genres: [10749], topic: 'lgbt', tone: 'rust' }
    ]
  },
  {
    id: 'documentaire', titre: 'Documentaire', dit: 'Le réel, regardé en face.',
    items: [
      { id: 'nature', title: 'Le monde vivant', subtitle: 'Documentaires de nature', genres: [99], topic: 'nature', tone: 'gold' },
      { id: 'musicdoc', title: 'La musique en vrai', subtitle: 'Documentaires musicaux', genres: [99], topic: 'music documentary', tone: 'gold' },
      { id: 'vraiehistoire', title: 'L’histoire vraie', subtitle: 'Faits réels', genres: [99], topic: 'based on true story', tone: 'blue' },
      { id: 'faitdivers', title: 'Le fait divers', subtitle: 'True crime', genres: [99], topic: 'true crime', tone: 'rust' }
    ]
  },
  {
    id: 'famille', titre: 'À voir en famille', dit: 'Petits et grands ensemble.',
    items: [
      { id: 'betes', title: 'Nos amis les bêtes', subtitle: 'Chiens & compagnie', genres: [10751], topic: 'dog', tone: 'gold' },
      { id: 'contes', title: 'Contes et merveilles', subtitle: 'Féeries', genres: [14], topic: 'fairy tale', tone: 'blue' }
    ]
  },
  {
    id: 'epoques', titre: 'Époques', dit: 'Une décennie, un monde.',
    items: [
      { id: 'nineties', title: 'Retour aux années 90', subtitle: 'Une décennie de cinéma', genres: [], decade: '1990', tone: 'blue' },
      { id: 'eighties', title: 'Les années 80', subtitle: 'Néons, synthés & grosses épaules', genres: [], decade: '1980', tone: 'rust' },
      { id: 'seventies', title: 'Les années 70', subtitle: 'Le Nouvel Hollywood', genres: [], decade: '1970', tone: 'gold' },
      { id: 'sixties', title: 'Les années 60', subtitle: 'Nouvelle vague & modernité', genres: [], decade: '1960', tone: 'blue' },
      { id: 'fifties', title: 'Les années 50', subtitle: 'Le studio et le technicolor', genres: [], decade: '1950', tone: 'gold' }
    ]
  },
  {
    id: 'pays', titre: 'Pays', dit: 'Le cinéma, ailleurs.',
    items: [
      { id: 'korea', title: 'Regards de Corée', subtitle: 'Cinéma en langue coréenne', genres: [], language: 'ko', tone: 'rust' },
      /* Le Japon SANS l'anime : c'est exactement ce que l'univers permet, et le
         cinéma japonais en prises de vues réelles le mérite. */
      { id: 'japon', title: 'Le Japon filmé', subtitle: 'Prises de vues réelles', genres: [], language: 'ja', univers: 'sans-anime', tone: 'blue' },
      { id: 'france', title: 'Le cinéma français', subtitle: 'Chez nous', genres: [], language: 'fr', tone: 'blue' },
      { id: 'italie', title: 'Cinéma italien', subtitle: 'De Rome à Naples', genres: [], language: 'it', tone: 'gold' },
      { id: 'espagne', title: 'Cinéma espagnol', subtitle: 'D’Almodóvar à Amenábar', genres: [], language: 'es', tone: 'rust' },
      { id: 'inde', title: 'Bollywood & cie', subtitle: 'Cinéma indien', genres: [], language: 'hi', tone: 'gold' }
    ]
  },
  {
    id: 'format', titre: 'Format', dit: 'La question du temps qu’on a.',
    items: [
      { id: 'short', title: 'Ce soir, 90 minutes', subtitle: 'Une séance courte', genres: [], runtime: 90, tone: 'gold' }
    ]
  },
  {
    id: 'anime', titre: 'Anime', dit: 'L’animation japonaise, par ses catégories.',
    items: [
      /* Une collection d'anime traverse films ET séries : `type: 'all'`. La
         laisser sur « film » aurait caché la plus grande part du catalogue. */
      { id: 'anime-entrer', title: 'Entrer dans l’anime', subtitle: 'Par où commencer', genres: [], univers: 'anime', type: 'all', tone: 'blue' },
      { id: 'anime-shonen', title: 'Shōnen', subtitle: 'Le combat et l’amitié', genres: [], univers: 'anime', type: 'all', categoriesAnime: [207826], tone: 'rust' },
      { id: 'anime-shoujo', title: 'Shōjo', subtitle: 'Le cœur et les sentiments', genres: [], univers: 'anime', type: 'all', categoriesAnime: [206437], tone: 'rust' },
      { id: 'anime-seinen', title: 'Seinen', subtitle: 'Pour adultes', genres: [], univers: 'anime', type: 'all', categoriesAnime: [195668], tone: 'blue' },
      { id: 'anime-josei', title: 'Josei', subtitle: 'Vies de femmes adultes', genres: [], univers: 'anime', type: 'all', categoriesAnime: [229074], tone: 'rust' },
      { id: 'anime-isekai', title: 'Isekai', subtitle: 'Un autre monde', genres: [], univers: 'anime', type: 'all', categoriesAnime: [237451], tone: 'blue' },
      { id: 'anime-mecha', title: 'Mecha', subtitle: 'Les machines', genres: [], univers: 'anime', type: 'all', categoriesAnime: [10046], tone: 'blue' },
      { id: 'anime-magical', title: 'Magical girl', subtitle: 'Transformer, se battre', genres: [], univers: 'anime', type: 'all', categoriesAnime: [292887], tone: 'rust' },
      { id: 'anime-tranche', title: 'Tranche de vie', subtitle: 'Les jours ordinaires', genres: [], univers: 'anime', type: 'all', categoriesAnime: [9914], tone: 'gold' },
      { id: 'anime-sport', title: 'Anime de sport', subtitle: 'Se dépasser', genres: [], univers: 'anime', type: 'all', categoriesAnime: [6075], tone: 'gold' },
      { id: 'anime-ecole', title: 'Vie scolaire', subtitle: 'Clubs, examens, festivals', genres: [], univers: 'anime', type: 'all', categoriesAnime: [10873, 214532], tone: 'gold' },
      { id: 'anime-manga', title: 'Adapté d’un manga', subtitle: 'La page devient image', genres: [], univers: 'anime', type: 'all', categoriesAnime: [13141], tone: 'rust' },
      { id: 'anime-horreur', title: 'Anime qui fait peur', subtitle: 'Horreur, gore, psychologique', genres: [], univers: 'anime', type: 'all', categoriesAnime: [315058, 10292, 272553], tone: 'rust' },
      { id: 'anime-film', title: 'Films d’anime', subtitle: 'Une séance, pas une saison', genres: [], univers: 'anime', type: 'movie', tone: 'blue' }
    ]
  }
];

/** Les familles, pour que le panneau puisse les nommer. */
export const FAMILLES_COLLECTIONS = FAMILLES.map(({ id, titre, dit }) => ({ id, titre, dit }));

/** La liste à plat, dans l'ordre des familles — c'est ce que lit le reste de l'application. */
export const COLLECTIONS = FAMILLES.flatMap(famille =>
  famille.items.map(item => ({ ...item, famille: famille.id })));

export const EXTRA_TOPICS = {
  27: [['Maisons hantées','haunted house'],['Exorcisme','exorcism'],['Folk horror','folk horror'],['Horreur cosmique','cosmic horror'],['Body horror','body horror'],['Found footage','found footage'],['Survie','survival'],['Créatures','monster'],['Sorcières','witch'],['Sectes','cult'],['Horreur psychologique','psychological horror'],['Démons','demon'],['Invasion de domicile','home invasion'],['Cannibalisme','cannibalism'],['Clowns','clown'],['Horreur aquatique','shark'],['Giallo','giallo']],
  28: [['Samouraïs','samurai'],['Kung-fu','kung fu'],['Arts martiaux mixtes','mixed martial arts (mma)'],['Mercenaires','mercenary'],['Vengeance','revenge'],['Prise d’otages','hostage'],['Catastrophes','disaster'],['Survie','survival'],['Tueur à gages','hitman']],
  12: [['Pirates','pirate'],['Voyage en mer','sea voyage'],['Expédition','expedition'],['Archéologie','archeology'],['Île déserte','deserted island'],['Survie','survival'],['Dinosaures','dinosaur']],
  16: [['Animation adulte','adult animation'],['Animation dessinée','hand drawn animation'],['Super-héros','superhero'],['Robots','robot'],['Voyage initiatique','coming of age'],['Animation 3D','computer animation'],['Amitié','friendship']],
  35: [['Absurde','absurdism'],['Comédie musicale','musical'],['Quiproquos','mistaken identity'],['Vacances','vacation'],['Famille','family'],['Travail','workplace'],['Adolescence','teenager'],['Road movie','road trip']],
  80: [['Gangsters','gangster'],['Prison','prison'],['Enquête','investigation'],['Crime organisé','organized crime'],['Kidnapping','kidnapping'],['Film noir','film noir'],['Procès','trial']],
  99: [['Écologie','environmentalism'],['Océans','ocean'],['Espace','space'],['Art','art'],['Cinéma','filmmaking'],['Société','society'],['True crime','true crime'],['Photographie','photography']],
  18: [['Relations père-fils','father son relationship'],['Relations mère-fille','mother daughter relationship'],['Solitude','loneliness'],['Addiction','addiction'],['Immigration','immigration'],['Handicap','disability'],['Sport','sport'],['Émancipation','self-discovery']],
  10751: [['Chiens','dog'],['Voyage','journey'],['Vacances','vacation'],['Contes','fairy tale'],['Super-héros','superhero'],['Famille recomposée','blended family']],
  14: [['Épée et sorcellerie','sword and sorcery'],['Mondes parallèles','parallel world'],['Immortalité','immortality'],['Chevaliers','knight'],['Fantômes','ghost'],['Voyage temporel','time travel']],
  36: [['Égypte antique','ancient egypt'],['Royauté','royalty'],['Guerre froide','cold war'],['Révolution française','french revolution'],['Esclavage','slavery'],['Renaissance','renaissance']],
  10402: [['Concert','concert'],['Biographie musicale','musician'],['Punk','punk rock'],['Blues','blues'],['Chorale','choir'],['Ballet','ballet']],
  9648: [['Détective privé','private detective'],['Secret de famille','family secrets'],['Meurtre','murder'],['Surnaturel','supernatural'],['Huis clos','claustrophobia'],['Double identité','double identity']],
  10749: [['Amour impossible','forbidden love'],['Seconde chance','second chance'],['Premier amour','first love'],['Relation à distance','long distance relationship'],['LGBTQ+','lgbt'],['Triangle amoureux','love triangle']],
  878: [['Post-apocalypse','post-apocalyptic future'],['Robots','robot'],['Extraterrestres','alien'],['Réalité virtuelle','virtual reality'],['Multivers','multiverse'],['Space opera','space opera'],['Planète inconnue','alien planet'],['Mutation','mutation']],
  53: [['Psychologique','psychological thriller'],['Huis clos','claustrophobia'],['Politique','political thriller'],['Surveillance','surveillance'],['Cybercriminalité','hacker'],['Prise d’otages','hostage'],['Survie','survival']],
  10752: [['Première Guerre mondiale','world war i'],['Guerre civile','civil war'],['Sous-marins','submarine'],['Prisonniers de guerre','prisoner of war'],['Pacifisme','anti war'],['Guerre de Corée','korean war (1950-53)']],
  37: [['Western spaghetti','spaghetti western'],['Chasseurs de primes','bounty hunter'],['Ruée vers l’or','gold rush'],['Train','train robbery'],['Cavalerie','cavalry'],['Néo-western','neo-western']]
};
