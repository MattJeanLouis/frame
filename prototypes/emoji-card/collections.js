/** Parcours éditoriaux : chaque collection correspond à des critères visibles et modifiables. */
export const COLLECTIONS = [
  { id: 'haunted', title: 'Présences invisibles', subtitle: 'Fantômes & maisons hantées', genres: [27], topic: 'ghost', tone: 'rust' },
  { id: 'space', title: 'Loin de la Terre', subtitle: 'Voyages & exploration spatiale', genres: [878], topic: 'space travel', tone: 'blue' },
  { id: 'heist', title: 'Le casse parfait', subtitle: 'Braquages & plans impossibles', genres: [80], topic: 'heist', tone: 'gold' },
  { id: 'mind', title: 'Réalités parallèles', subtitle: 'Temps, boucles & paradoxes', genres: [878], topic: 'time travel', tone: 'blue' },
  { id: 'laugh', title: 'Rire un peu noir', subtitle: 'Comédies à l’humour grinçant', genres: [35], topic: 'dark comedy', tone: 'rust' },
  { id: 'growing', title: 'L’âge des possibles', subtitle: 'Grandir, partir, se trouver', genres: [18], topic: 'coming of age', tone: 'gold' },
  { id: 'anime', title: 'Dessiner des mondes', subtitle: 'Animation japonaise', genres: [16], language: 'ja', tone: 'blue' },
  { id: 'short', title: 'Ce soir, 90 minutes', subtitle: 'Une séance courte', genres: [], runtime: 90, tone: 'gold' },
  { id: 'korea', title: 'Regards de Corée', subtitle: 'Cinéma en langue coréenne', genres: [], language: 'ko', tone: 'rust' },
  { id: 'nineties', title: 'Retour aux années 90', subtitle: 'Une décennie de cinéma', genres: [], decade: '1990', tone: 'blue' },
  { id: 'nature', title: 'Le monde vivant', subtitle: 'Documentaires de nature', genres: [99], topic: 'nature', tone: 'gold' },
  { id: 'love', title: 'Les histoires à deux', subtitle: 'Comédies romantiques', genres: [35,10749], topic: 'romantic comedy', tone: 'rust' }
];

export const EXTRA_TOPICS = {
  27: [['Maisons hantées','haunted house'],['Exorcisme','exorcism'],['Folk horror','folk horror'],['Horreur cosmique','cosmic horror'],['Body horror','body horror'],['Found footage','found footage'],['Survie','survival'],['Créatures','monster'],['Sorcières','witch'],['Sectes','cult'],['Horreur psychologique','psychological horror'],['Démons','demon'],['Invasion de domicile','home invasion'],['Cannibalisme','cannibalism'],['Clowns','clown'],['Horreur aquatique','shark'],['Giallo','giallo']],
  28: [['Samouraïs','samurai'],['Kung-fu','kung fu'],['Arts martiaux mixtes','mixed martial arts (mma)'],['Mercenaires','mercenary'],['Vengeance','revenge'],['Prise d’otages','hostage'],['Catastrophes','disaster'],['Survie','survival'],['Tueur à gages','hitman']],
  12: [['Pirates','pirate'],['Voyage en mer','sea voyage'],['Expédition','expedition'],['Archéologie','archeology'],['Île déserte','deserted island'],['Survie','survival'],['Dinosaures','dinosaur']],
  16: [['Animation adulte','adult animation'],['Super-héros','superhero'],['Robots','robot'],['Voyage initiatique','coming of age'],['Animation 3D','computer animation'],['Animation traditionnelle','traditional animation'],['Amitié','friendship']],
  35: [['Absurde','absurdism'],['Comédie musicale','musical'],['Quiproquos','mistaken identity'],['Vacances','vacation'],['Famille','family'],['Travail','workplace'],['Adolescence','teenager'],['Road movie','road trip']],
  80: [['Gangsters','gangster'],['Prison','prison'],['Enquête','investigation'],['Crime organisé','organized crime'],['Kidnapping','kidnapping'],['Film noir','film noir'],['Procès','trial']],
  99: [['Écologie','environmentalism'],['Océans','ocean'],['Espace','space'],['Art','art'],['Cinéma','filmmaking'],['Société','society'],['True crime','true crime'],['Photographie','photography']],
  18: [['Relations père-fils','father son relationship'],['Relations mère-fille','mother daughter relationship'],['Solitude','loneliness'],['Addiction','addiction'],['Immigration','immigration'],['Handicap','disability'],['Sport','sport'],['Émancipation','self-discovery']],
  10751: [['Chiens','dog'],['Voyage','journey'],['Vacances','vacation'],['Contes','fairy tale'],['Super-héros','superhero'],['Famille recomposée','blended family']],
  14: [['Épée et sorcellerie','sword and sorcery'],['Mondes parallèles','parallel world'],['Immortalité','immortality'],['Chevaliers','knight'],['Fantômes','ghost'],['Voyage temporel','time travel']],
  36: [['Égypte antique','ancient egypt'],['Royauté','royalty'],['Guerre froide','cold war'],['Révolution française','french revolution'],['Esclavage','slavery'],['Renaissance','renaissance']],
  10402: [['Concert','concert'],['Biographie musicale','musician'],['Punk','punk rock'],['Blues','blues'],['Chorale','choir'],['Ballet','ballet']],
  9648: [['Détective privé','private detective'],['Secret de famille','family secrets'],['Meurtre','murder'],['Surnaturel','supernatural'],['Huis clos','single location'],['Double identité','double identity']],
  10749: [['Amour impossible','forbidden love'],['Seconde chance','second chance'],['Premier amour','first love'],['Relation à distance','long distance relationship'],['LGBTQ+','lgbt'],['Triangle amoureux','love triangle']],
  878: [['Post-apocalypse','post-apocalyptic future'],['Robots','robot'],['Extraterrestres','alien'],['Réalité virtuelle','virtual reality'],['Multivers','multiverse'],['Space opera','space opera'],['Planète inconnue','alien planet'],['Mutation','mutation']],
  53: [['Psychologique','psychological thriller'],['Huis clos','single location'],['Politique','political thriller'],['Surveillance','surveillance'],['Cybercriminalité','hacker'],['Prise d’otages','hostage'],['Survie','survival']],
  10752: [['Première Guerre mondiale','world war i'],['Guerre civile','civil war'],['Sous-marins','submarine'],['Prisonniers de guerre','prisoner of war'],['Pacifisme','anti war'],['Guerre de Corée','korean war']],
  37: [['Western spaghetti','spaghetti western'],['Chasseurs de primes','bounty hunter'],['Ruée vers l’or','gold rush'],['Train','train robbery'],['Cavalerie','cavalry'],['Néo-western','neo-western']]
};
