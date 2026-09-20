import { EXTRA_TOPICS } from './collections.js';

export const SOUS_GENRES = {
  28: [ // Action
    ['arts martiaux', '🥋', 'martial arts'], ['espionnage', '🕶️', 'spy'],
    ['poursuite', '🚗', 'chase'], ['arts martiaux', '🥋', 'kung fu'],
    ['super-héros', '🦸', 'superhero'], ['arts martiaux', '🥋', 'samurai']
  ],
  12: [ // Aventure
    ['exploration', '🧭', 'exploration'], ['naufrage', '🌊', 'shipwreck'],
    ['trésor', '💎', 'treasure hunt'], ['jungle', '🌴', 'jungle'],
    ['montagne', '🏔️', 'mountain climbing'], ['désert', '🏜️', 'desert']
  ],
  16: [ // Animation
    ['anime', '🌸', 'anime'], ['pâte à modeler', '🧱', 'stop motion'],
    ['conte', '🧚', 'fairy tale'], ['musical', '🎵', 'musical'],
    ['enfance', '🧒', 'childhood'], ['adaptation manga', '📖', 'based on manga']
  ],
  35: [ // Comédie
    ['parodie', '🎭', 'parody'], ['comédie romantique', '💘', 'romcom'],
    ['humour noir', '🖤', 'dark comedy'], ['buddy movie', '👯', 'buddy comedy'],
    ['satire', '📰', 'satire'], ['stand-up', '🎤', 'stand-up comedy']
  ],
  80: [ // Crime
    ['braquage', '💰', 'heist'], ['mafia', '🚬', 'mafia'],
    ['tueur en série', '🔪', 'serial killer'], ['drogue', '💊', 'drug trade'],
    ['braquage', '💰', 'robbery'], ['police corrompue', '🚔', 'corrupt cop']
  ],
  99: [ // Documentaire
    ['nature', '🌿', 'nature'], ['musique', '🎸', 'music documentary'],
    ['sport', '🏅', 'sport'], ['politique', '🏛️', 'politics'],
    ['science', '🔬', 'science'], ['histoire vraie', '📜', 'based on true story']
  ],
  18: [ // Drame
    ['famille', '👨‍👩‍👧', 'family drama'], ['deuil', '🕯️', 'grief'],
    ['maladie', '🏥', 'illness'], ['pauvreté', '🏚️', 'poverty'],
    ['adolescence', '🎒', 'coming of age'], ['justice', '⚖️', 'courtroom']
  ],
  10751: [ // Familial
    ['enfants', '🧸', 'children'], ['animaux', '🐕', 'animals'],
    ['magie', '🪄', 'magic'], ['Noël', '🎄', 'christmas'],
    ['amitié', '🤝', 'friendship'], ['école', '🏫', 'school']
  ],
  14: [ // Fantastique
    ['magie', '🪄', 'magic'], ['dragons', '🐉', 'dragon'],
    ['monde imaginaire', '🗺️', 'fantasy world'], ['malédiction', '🕯️', 'curse'],
    ['fées', '🧚', 'fairy'], ['mythe', '🏛️', 'mythology']
  ],
  36: [ // Histoire
    ['seconde guerre', '🪖', 'world war ii'], ['antiquité', '🏺', 'ancient rome'],
    ['moyen âge', '⚔️', 'middle ages (476-1453)'], ['biographie', '📜', 'biography'],
    ['révolution', '✊', 'revolution'], ['empire', '👑', 'empire']
  ],
  27: [ // Horreur
    ['zombies', '🧟', 'zombie'], ['vampires', '🧛', 'vampire'],
    ['fantômes', '👻', 'ghost'], ['possession', '😈', 'demonic possession'],
    ['tueur', '🔪', 'slasher'], ['loup-garou', '🐺', 'werewolf']
  ],
  10402: [ // Musique
    ['rock', '🎸', 'rock band'], ['jazz', '🎷', 'jazz'],
    ['classique', '🎻', 'classical music'], ['rap', '🎤', 'hip-hop'],
    ['danse', '💃', 'dance'], ['opéra', '🎭', 'opera']
  ],
  9648: [ // Mystère
    ['enquête', '🔍', 'investigation'], ['disparition', '🕳️', 'missing person'],
    ['whodunit', '🕵️', 'whodunit'], ['amnésie', '🧠', 'amnesia'],
    ['complot', '📎', 'conspiracy'], ['énigme', '🧩', 'puzzle']
  ],
  10749: [ // Romance
    ['coup de foudre', '💘', 'love at first sight'], ['mariage', '💍', 'wedding'],
    ['adultère', '💔', 'adultery'], ['lettres', '💌', 'love letter'],
    ['été', '☀️', 'summer romance'], ['rupture', '🥀', 'break-up']
  ],
  878: [ // Science-Fiction
    ['intelligence artificielle', '🤖', 'artificial intelligence (a.i.)'],
    ['voyage spatial', '🚀', 'space travel'], ['dystopie', '🏚️', 'dystopia'],
    ['voyage temporel', '⏳', 'time travel'], ['cyberpunk', '🌃', 'cyberpunk'],
    ['invasion', '👽', 'alien invasion'], ['clonage', '🧬', 'cloning']
  ],
  53: [ // Thriller
    ['enlèvement', '🪢', 'kidnapping'], ['trahison', '🎭', 'betrayal'],
    ['espionnage', '🕶️', 'spy'], ['vengeance', '🔥', 'revenge'],
    ['poursuite', '🏃', 'chase'], ['manipulation', '🪞', 'manipulation']
  ],
  10752: [ // Guerre
    ['seconde guerre', '🪖', 'world war ii'], ['viêtnam', '🌴', 'vietnam war'],
    ['tranchées', '⛏️', 'trench warfare'], ['résistance', '✊', 'resistance'],
    ['aviation', '✈️', 'fighter pilot'], ['débarquement', '🚢', 'd-day']
  ],
  37: [ // Western
    ['shérif', '⭐', 'sheriff'], ['hors-la-loi', '🤠', 'outlaw'],
    ['vengeance', '🔥', 'revenge'], ['frontière', '🌵', 'frontier'],
    ['duel', '🔫', 'gunfight'], ['ranch', '🐎', 'ranch']
  ]
};

for (const [id, entries] of Object.entries(EXTRA_TOPICS)) {
  const original = SOUS_GENRES[id] || [];
  const cleaned = original.map(([label, emoji, key]) => [key === 'kung fu' ? 'Kung-fu' : key === 'samurai' ? 'Samouraïs' : label, emoji, key]);
  SOUS_GENRES[id] = [...new Map([...cleaned, ...entries.map(([label,key]) => [label, '', key])].map(t => [t[2], t])).values()];
}

