// Vocabulaire de FRAME.
// RÈGLE ABSOLUE : cette liste ne fait que croître. On ajoute uniquement à la fin.
// On ne renomme jamais un identifiant, on ne supprime jamais une entrée,
// on ne change jamais l'ordre : src/url.js encode l'index dans cette liste et
// tout déplacement casserait chaque lien déjà partagé.

export const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/';

export const DRAWERS = [
  { id: 'characters', label: 'Personnages' },
  { id: 'creatures', label: 'Créatures' },
  { id: 'places', label: 'Lieux' },
  { id: 'objects', label: 'Objets' },
  { id: 'clothes', label: 'Vêtements' },
  { id: 'sky', label: 'Ciel et lumière' },
  { id: 'world', label: 'Monde et époque' }
];

// Aucun sticker ne porte son information par la teinte seule : un aplat de
// couleur est illisible pour un daltonien et se lit comme une image cassée.
// Les trois atmosphères de lumière ont donc une FORME (🚨 🌌 🔮) et non plus
// un carré (🟥 🟦 🟪) — remplacé le 18 septembre 2026.

// Mots abstraits interdits comme libellés : un sticker est toujours une chose
// que l'on peut voir. L'abstrait doit émerger des combinaisons.
export const FORBIDDEN_LABELS = [
  'silence', 'romance', 'amour', 'peur', 'tristesse', 'joie', 'mystère',
  'nostalgie', 'tension', 'espoir', 'solitude', 'beauté', 'liberté',
  'vengeance', 'pouvoir', 'justice', 'destin', 'folie', 'mélancolie',
  'suspense', 'drame', 'comédie', '1920', '1980', 'années 80'
];

export const STICKERS = [
  // ── Personnages ───────────────────────────────────────────────────────────
  { id: 'silhouette', emoji: '👤', label: 'Silhouette', drawer: 'characters',
    keywords: ['stranger', 'loneliness', 'identity', 'amnesia', 'mysterious man'], genres: [9648] },
  { id: 'woman', emoji: '👩', label: 'Femme', drawer: 'characters',
    keywords: ['heroine', 'female protagonist', 'woman director', 'feminism', 'female friendship'], genres: [18] },
  { id: 'man', emoji: '👨', label: 'Homme', drawer: 'characters',
    keywords: ['father son relationship', 'male friendship', 'midlife crisis', 'masculinity', 'brothers'], genres: [18] },
  { id: 'child', emoji: '👧', label: 'Enfant', drawer: 'characters',
    keywords: ['child', 'childhood', 'coming of age', 'orphan', 'boy'], genres: [10751, 18] },
  { id: 'elder', emoji: '🧓', label: 'Personne âgée', drawer: 'characters',
    keywords: ['old age', 'grandfather', 'grandmother', 'elderly', 'nursing home'], genres: [18] },
  { id: 'cop', emoji: '👮', label: 'Policier', drawer: 'characters',
    keywords: ['police', 'police officer', 'corrupt cop', 'manhunt', 'police brutality'], genres: [80, 53] },
  { id: 'detective', emoji: '🕵️', label: 'Détective', drawer: 'characters',
    keywords: ['private detective', 'film noir', 'investigation', 'murder mystery', 'whodunit'], genres: [80, 9648] },
  { id: 'cowboy', emoji: '🤠', label: 'Cowboy', drawer: 'characters',
    keywords: ['cowboy', 'western', 'outlaw', 'gunslinger', 'wild west', 'sheriff'], genres: [37] },
  { id: 'ninja', emoji: '🥷', label: 'Ninja', drawer: 'characters',
    keywords: ['ninja', 'assassin', 'martial arts', 'samurai', 'revenge'], genres: [28] },
  { id: 'astronaut', emoji: '🧑‍🚀', label: 'Astronaute', drawer: 'characters',
    keywords: ['astronaut', 'space travel', 'space station', 'nasa', 'spacecraft'], genres: [878] },
  { id: 'royalty', emoji: '👑', label: 'Royauté', drawer: 'characters',
    keywords: ['king', 'queen', 'royalty', 'monarchy', 'prince', 'heir to the throne'], genres: [36, 18] },
  { id: 'musician', emoji: '🧑‍🎤', label: 'Musicien', drawer: 'characters',
    keywords: ['musician', 'rock band', 'singer', 'concert', 'music industry'], genres: [10402] },

  // ── Créatures ─────────────────────────────────────────────────────────────
  { id: 'robot', emoji: '🤖', label: 'Robot', drawer: 'creatures',
    keywords: ['robot', 'android', 'artificial intelligence', 'cyborg', 'cyberpunk'], genres: [878] },
  { id: 'alien', emoji: '👽', label: 'Alien', drawer: 'creatures',
    keywords: ['alien', 'extraterrestrial', 'ufo', 'alien invasion', 'first contact'], genres: [878] },
  { id: 'wolf', emoji: '🐺', label: 'Loup', drawer: 'creatures',
    keywords: ['wolf', 'werewolf', 'wilderness', 'wolves', 'predator'], genres: [27] },
  { id: 'vampire', emoji: '🧛', label: 'Vampire', drawer: 'creatures',
    keywords: ['vampire', 'blood', 'immortality', 'gothic', 'dracula'], genres: [27] },
  { id: 'zombie', emoji: '🧟', label: 'Zombie', drawer: 'creatures',
    keywords: ['zombie', 'undead', 'outbreak', 'survival horror', 'apocalypse'], genres: [27] },
  { id: 'dragon', emoji: '🐉', label: 'Dragon', drawer: 'creatures',
    keywords: ['dragon', 'fantasy world', 'magic', 'sword and sorcery', 'mythology'], genres: [14] },
  { id: 'dinosaur', emoji: '🦖', label: 'Dinosaure', drawer: 'creatures',
    keywords: ['dinosaur', 'prehistoric', 'jurassic', 'giant monster', 'evolution'], genres: [878, 12] },
  { id: 'shark', emoji: '🦈', label: 'Requin', drawer: 'creatures',
    keywords: ['shark', 'shark attack', 'ocean', 'sea', 'survival'], genres: [27, 53] },
  { id: 'octopus', emoji: '🐙', label: 'Pieuvre', drawer: 'creatures',
    keywords: ['octopus', 'sea monster', 'deep sea', 'tentacles', 'underwater'], genres: [27, 12] },
  { id: 'ghost', emoji: '👻', label: 'Fantôme', drawer: 'creatures',
    keywords: ['ghost', 'haunted house', 'supernatural', 'haunting', 'exorcism'], genres: [27] },
  { id: 'horse', emoji: '🐎', label: 'Cheval', drawer: 'creatures',
    keywords: ['horse', 'horse riding', 'ranch', 'rodeo', 'equestrian'], genres: [37] },
  { id: 'dog', emoji: '🐕', label: 'Chien', drawer: 'creatures',
    keywords: ['dog', 'pet', 'loyalty', 'puppy', 'animal'], genres: [10751] },

  // ── Lieux ─────────────────────────────────────────────────────────────────
  { id: 'city_night', emoji: '🌃', label: 'Ville la nuit', drawer: 'places',
    keywords: ['city at night', 'neon', 'nightclub', 'taxi', 'night', 'rain'], genres: [80, 53] },
  { id: 'metropolis', emoji: '🏙️', label: 'Métropole', drawer: 'places',
    keywords: ['skyscraper', 'new york city', 'metropolis', 'rooftop', 'urban decay'], genres: [28] },
  { id: 'forest', emoji: '🌲', label: 'Forêt', drawer: 'places',
    keywords: ['forest', 'woods', 'cabin in the woods', 'nature', 'survival'], genres: [27, 14] },
  { id: 'desert', emoji: '🏜️', label: 'Désert', drawer: 'places',
    keywords: ['desert', 'sand', 'oasis', 'caravan', 'sandstorm'], genres: [12, 37] },
  { id: 'ocean', emoji: '🌊', label: 'Océan', drawer: 'places',
    keywords: ['ocean', 'sea', 'shipwreck', 'sailing', 'underwater'], genres: [12] },
  { id: 'mountain', emoji: '🏔️', label: 'Montagne', drawer: 'places',
    keywords: ['mountain', 'mountain climbing', 'avalanche', 'alps', 'expedition'], genres: [12] },
  { id: 'island', emoji: '🏝️', label: 'Île', drawer: 'places',
    keywords: ['island', 'tropical island', 'castaway', 'deserted island', 'jungle'], genres: [12] },
  { id: 'abandoned_house', emoji: '🏚️', label: 'Maison abandonnée', drawer: 'places',
    keywords: ['abandoned house', 'haunted house', 'ruins', 'isolation', 'decay'], genres: [27] },
  { id: 'castle', emoji: '🏰', label: 'Château', drawer: 'places',
    keywords: ['castle', 'medieval', 'knight', 'kingdom', 'fortress'], genres: [14, 36] },
  { id: 'space', emoji: '🚀', label: 'Espace', drawer: 'places',
    keywords: ['space', 'spaceship', 'outer space', 'space travel', 'galaxy'], genres: [878] },
  { id: 'school', emoji: '🏫', label: 'École', drawer: 'places',
    keywords: ['high school', 'school', 'teacher', 'student', 'bullying'], genres: [18, 35] },
  { id: 'hospital', emoji: '🏥', label: 'Hôpital', drawer: 'places',
    keywords: ['hospital', 'doctor', 'nurse', 'surgery', 'illness'], genres: [18] },
  { id: 'palace', emoji: '🏛️', label: 'Palais', drawer: 'places',
    keywords: ['palace', 'aristocracy', 'royal court', 'ancient rome', 'senate'], genres: [36] },
  { id: 'countryside', emoji: '🌾', label: 'Campagne', drawer: 'places',
    keywords: ['countryside', 'farm', 'village', 'rural', 'harvest'], genres: [18] },

  // ── Objets ────────────────────────────────────────────────────────────────
  { id: 'gun', emoji: '🔫', label: 'Arme', drawer: 'objects',
    keywords: ['gun', 'shootout', 'gunfight', 'hitman', 'firearm'], genres: [28, 80] },
  { id: 'knife', emoji: '🔪', label: 'Couteau', drawer: 'objects',
    keywords: ['knife', 'stabbing', 'serial killer', 'slasher', 'murder'], genres: [27, 53] },
  { id: 'money', emoji: '💰', label: 'Argent', drawer: 'objects',
    keywords: ['money', 'heist', 'robbery', 'greed', 'bank robbery'], genres: [80] },
  { id: 'ring', emoji: '💍', label: 'Bague', drawer: 'objects',
    keywords: ['wedding', 'marriage proposal', 'engagement', 'love', 'bride'], genres: [10749] },
  { id: 'camera', emoji: '📷', label: 'Appareil photo', drawer: 'objects',
    keywords: ['photographer', 'photography', 'filmmaking', 'journalist', 'camera'], genres: [18] },
  { id: 'guitar', emoji: '🎸', label: 'Guitare', drawer: 'objects',
    keywords: ['guitar', 'rock band', 'rock music', 'band', 'garage band'], genres: [10402] },
  { id: 'piano', emoji: '🎹', label: 'Piano', drawer: 'objects',
    keywords: ['piano', 'pianist', 'classical music', 'composer', 'concert'], genres: [10402, 18] },
  { id: 'book', emoji: '📖', label: 'Livre', drawer: 'objects',
    keywords: ['book', 'writer', 'library', 'novel', 'literature'], genres: [18] },
  { id: 'car', emoji: '🚗', label: 'Voiture', drawer: 'objects',
    keywords: ['car', 'car chase', 'road trip', 'car race', 'driving'], genres: [28] },
  { id: 'motorcycle', emoji: '🏍️', label: 'Moto', drawer: 'objects',
    keywords: ['motorcycle', 'biker', 'motorcycle gang', 'chase', 'road'], genres: [28] },
  { id: 'plane', emoji: '✈️', label: 'Avion', drawer: 'objects',
    keywords: ['airplane', 'pilot', 'airport', 'plane crash', 'aviation'], genres: [28, 53] },
  { id: 'ship', emoji: '🚢', label: 'Bateau', drawer: 'objects',
    keywords: ['ship', 'sailing', 'pirate', 'navy', 'submarine'], genres: [12] },
  { id: 'candle', emoji: '🕯️', label: 'Bougie', drawer: 'objects',
    keywords: ['candle', 'ritual', 'cult', 'seance', 'darkness'], genres: [27] },
  { id: 'champagne', emoji: '🥂', label: 'Champagne', drawer: 'objects',
    keywords: ['party', 'high society', 'wealth', 'celebration', 'luxury'], genres: [18, 10749] },
  { id: 'pills', emoji: '💊', label: 'Pilules', drawer: 'objects',
    keywords: ['drugs', 'addiction', 'drug abuse', 'medication', 'overdose'], genres: [80, 18] },
  { id: 'lab', emoji: '🧪', label: 'Laboratoire', drawer: 'objects',
    keywords: ['scientist', 'laboratory', 'experiment', 'mad scientist', 'virus'], genres: [878, 27] },

  // ── Vêtements ─────────────────────────────────────────────────────────────
  { id: 'hat', emoji: '🎩', label: 'Chapeau', drawer: 'clothes',
    keywords: ['magician', 'gentleman', 'aristocracy', 'butler', '1930s'], genres: [14, 18] },
  { id: 'sunglasses', emoji: '🕶️', label: 'Lunettes noires', drawer: 'clothes',
    keywords: ['secret agent', 'spy', 'undercover', 'bodyguard', 'espionage'], genres: [53, 28] },
  { id: 'leather_coat', emoji: '🧥', label: 'Manteau de cuir', drawer: 'clothes',
    keywords: ['cyberpunk', 'dystopia', 'hacker', 'anti hero', 'neo-noir'], genres: [878, 53] },
  { id: 'evening_dress', emoji: '👗', label: 'Robe de soirée', drawer: 'clothes',
    keywords: ['ball', 'high society', 'gala', 'romance', 'fashion'], genres: [10749, 18] },
  { id: 'suit', emoji: '👔', label: 'Costume', drawer: 'clothes',
    keywords: ['businessman', 'office', 'corporation', 'wall street', 'lawyer'], genres: [18, 80] },
  { id: 'martial_arts', emoji: '🥋', label: 'Arts martiaux', drawer: 'clothes',
    keywords: ['martial arts', 'kung fu', 'karate', 'fight', 'dojo'], genres: [28] },
  { id: 'mask', emoji: '🎭', label: 'Masque', drawer: 'clothes',
    keywords: ['mask', 'masquerade ball', 'theatre', 'disguise', 'secret identity'], genres: [53, 27] },
  { id: 'kimono', emoji: '👘', label: 'Kimono', drawer: 'clothes',
    keywords: ['japan', 'geisha', 'samurai', 'tokyo, japan', 'tradition'], genres: [18, 36] },
  { id: 'uniform', emoji: '🦺', label: 'Uniforme', drawer: 'clothes',
    keywords: ['worker', 'factory', 'construction', 'blue collar', 'labor union'], genres: [18] },

  // ── Ciel et lumière (atmosphères) ─────────────────────────────────────────
  { id: 'rain', emoji: '🌧️', label: 'Pluie', drawer: 'sky',
    keywords: ['rain', 'storm', 'umbrella', 'melancholy', 'neo-noir'], genres: [18, 53],
    atmosphere: { tint: '#4A6FA5', intensity: 0.28, light: -0.10, particles: 'rain' } },
  { id: 'night', emoji: '🌙', label: 'Nuit', drawer: 'sky',
    keywords: ['night', 'insomnia', 'nocturnal', 'moon', 'darkness'], genres: [27, 53],
    atmosphere: { tint: '#1B2A4A', intensity: 0.35, light: -0.20 } },
  { id: 'sun', emoji: '☀️', label: 'Soleil', drawer: 'sky',
    keywords: ['summer', 'beach', 'heat', 'vacation', 'sunshine'], genres: [10751, 35],
    atmosphere: { tint: '#F2B544', intensity: 0.18, light: 0.25 } },
  { id: 'snow', emoji: '❄️', label: 'Neige', drawer: 'sky',
    keywords: ['snow', 'winter', 'blizzard', 'ice', 'cold'], genres: [12, 18],
    atmosphere: { tint: '#9FC7E8', intensity: 0.22, light: 0.12, particles: 'snow' } },
  { id: 'fire', emoji: '🔥', label: 'Feu', drawer: 'sky',
    keywords: ['fire', 'arson', 'firefighter', 'explosion', 'burning'], genres: [28],
    atmosphere: { tint: '#E2542B', intensity: 0.30, light: 0.15, particles: 'embers' } },
  { id: 'storm', emoji: '⛈️', label: 'Orage', drawer: 'sky',
    keywords: ['thunderstorm', 'lightning', 'hurricane', 'tornado', 'disaster'], genres: [28, 12],
    atmosphere: { tint: '#3A4A6B', intensity: 0.34, light: -0.15, particles: 'rain' } },
  { id: 'fog', emoji: '🌫️', label: 'Brouillard', drawer: 'sky',
    keywords: ['fog', 'mist', 'mystery', 'isolation', 'atmospheric'], genres: [27, 9648],
    atmosphere: { tint: '#8A93A6', intensity: 0.26, light: -0.05, particles: 'fog' } },
  { id: 'red_light', emoji: '🚨', label: 'Lumière rouge', drawer: 'sky',
    keywords: ['blood', 'giallo', 'nightmare', 'hell', 'obsession'], genres: [27],
    atmosphere: { tint: '#C8203A', intensity: 0.32, light: -0.05 } },
  { id: 'blue_light', emoji: '🌌', label: 'Lumière bleue', drawer: 'sky',
    keywords: ['neo-noir', 'melancholy', 'loneliness', 'cold war', 'dream'], genres: [18, 9648],
    atmosphere: { tint: '#2A6FC9', intensity: 0.32, light: -0.08 } },
  { id: 'violet_neon', emoji: '🔮', label: 'Néon violet', drawer: 'sky',
    keywords: ['neon', 'cyberpunk', 'synthwave', 'nightclub', 'retrofuturism'], genres: [878],
    atmosphere: { tint: '#8B3FD9', intensity: 0.34, light: 0.05 } },
  { id: 'dusk', emoji: '🌅', label: 'Crépuscule', drawer: 'sky',
    keywords: ['sunset', 'sunrise', 'horizon', 'farewell', 'road trip'], genres: [18, 10749],
    atmosphere: { tint: '#F2784B', intensity: 0.24, light: 0.10 } },

  // ── Monde et époque ───────────────────────────────────────────────────────
  { id: 'antiquity', emoji: '🏺', label: 'Antiquité', drawer: 'world',
    keywords: ['ancient greece', 'ancient rome', 'mythology', 'gladiator', 'egypt'], genres: [36, 12] },
  { id: 'medieval', emoji: '⚔️', label: 'Médiéval', drawer: 'world',
    keywords: ['medieval', 'sword', 'knight', 'battle', 'crusader'], genres: [36, 12] },
  { id: 'black_white', emoji: '🎞️', label: 'Noir et blanc', drawer: 'world',
    keywords: ['black and white', 'film noir', 'silent film', '1940s', 'classic'], genres: [18, 80] },
  { id: 'eighties', emoji: '📼', label: 'Années 1980', drawer: 'world',
    keywords: ['1980s', 'vhs', 'synthwave', 'nostalgia', 'arcade'], genres: [878, 35] },
  { id: 'future', emoji: '🛸', label: 'Futur', drawer: 'world',
    keywords: ['future', 'dystopia', 'science fiction', 'utopia', 'time travel'], genres: [878] },
  { id: 'wasteland', emoji: '☢️', label: 'Post-apocalyptique', drawer: 'world',
    keywords: ['post-apocalyptic future', 'nuclear war', 'radiation', 'survival', 'wasteland'], genres: [878, 28] },
  { id: 'circus', emoji: '🎪', label: 'Cirque', drawer: 'world',
    keywords: ['circus', 'clown', 'carnival', 'freak show', 'acrobats'], genres: [14, 18] },
  { id: 'casino', emoji: '🎰', label: 'Casino', drawer: 'world',
    keywords: ['casino', 'gambling', 'las vegas', 'poker', 'con artist'], genres: [80, 53] },
  { id: 'science', emoji: '🛰️', label: 'Science', drawer: 'world',
    keywords: ['satellite', 'space program', 'technology', 'experiment', 'research'], genres: [878, 99] },
  { id: 'orient', emoji: '🕌', label: 'Orient', drawer: 'world',
    keywords: ['middle east', 'desert', 'saudi arabia', 'istanbul', 'bazaar'], genres: [12, 36] },
  { id: 'america', emoji: '🗽', label: 'Amérique', drawer: 'world',
    keywords: ['new york city', 'american dream', 'immigrant', 'usa', 'statue of liberty'], genres: [18, 80] },
  { id: 'tokyo', emoji: '🗼', label: 'Tokyo', drawer: 'world',
    keywords: ['tokyo, japan', 'japan', 'yakuza', 'anime', 'neon'], genres: [16, 28] }
];

export const STICKER_BY_ID = new Map(STICKERS.map(s => [s.id, s]));
export const STICKER_INDEX = new Map(STICKERS.map((s, i) => [s.id, i]));

/**
 * URL du SVG Twemoji d'un emoji.
 * Convention Twemoji : les points de code en hexadécimal minuscule joints par « - »,
 * en retirant le sélecteur de variante U+FE0F sauf si la séquence contient U+200D.
 * @param {string} emoji
 * @returns {string}
 */
export function twemojiUrl(emoji) {
  let points = Array.from(emoji).map(ch => ch.codePointAt(0));
  if (!points.includes(0x200d)) points = points.filter(cp => cp !== 0xfe0f);
  return TWEMOJI_BASE + points.map(cp => cp.toString(16)).join('-') + '.svg';
}
