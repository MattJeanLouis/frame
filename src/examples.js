// Trois tableaux d'accueil, proposés au premier lancement (spec §6.4).
// Les positions sont choisies pour que la miniature soit lisible et jolie.
export const EXAMPLES = [
  {
    id: 'night_city',
    name: 'Nuit urbaine',
    board: { items: [
      { id: 'city_night',    x: 0.34, y: 0.42, scale: 1.8, flip: false },
      { id: 'rain',          x: 0.72, y: 0.24, scale: 1.2, flip: false },
      { id: 'violet_neon',   x: 0.18, y: 0.74, scale: 0.9, flip: false },
      { id: 'leather_coat',  x: 0.62, y: 0.64, scale: 1.1, flip: true  },
      { id: 'car',           x: 0.84, y: 0.78, scale: 0.8, flip: false }
    ] }
  },
  {
    id: 'strange_forest',
    name: 'Forêt étrange',
    board: { items: [
      { id: 'forest',  x: 0.40, y: 0.46, scale: 2.0, flip: false },
      { id: 'fog',     x: 0.70, y: 0.30, scale: 1.3, flip: false },
      { id: 'wolf',    x: 0.22, y: 0.72, scale: 1.0, flip: true  },
      { id: 'candle',  x: 0.60, y: 0.76, scale: 0.7, flip: false },
      { id: 'child',   x: 0.82, y: 0.58, scale: 0.9, flip: false }
    ] }
  },
  {
    id: 'society_drama',
    name: 'Drame mondain',
    board: { items: [
      { id: 'palace',         x: 0.36, y: 0.40, scale: 1.9, flip: false },
      { id: 'evening_dress',  x: 0.68, y: 0.56, scale: 1.2, flip: false },
      { id: 'champagne',      x: 0.24, y: 0.74, scale: 0.9, flip: false },
      { id: 'ring',           x: 0.80, y: 0.26, scale: 0.7, flip: false },
      { id: 'piano',          x: 0.52, y: 0.80, scale: 1.0, flip: true  }
    ] }
  }
];
