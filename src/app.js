// Banc d'essai provisoire de la toile. L'assemblage complet arrive en tâche 9.
import { createBoard, addSticker } from './board.js';
import { createCanvas } from './canvas.js';

let board = addSticker(
  addSticker(
    addSticker(createBoard(), 'city_night', { x: 0.35, y: 0.4 }),
    'rain', { x: 0.7, y: 0.3, scale: 1.6 }
  ),
  'robot', { x: 0.5, y: 0.7 }
);

const canvas = createCanvas(document.getElementById('canvas-host'), {
  onChange(next, { commit }) {
    board = next;
    console.log('change', commit, board.items.length);
  },
  onSelect(index) {
    console.log('select', index);
  }
});

canvas.setBoard(board);

// Petites prises pour la vérification manuelle en navigateur.
window.FRAME_DEV = {
  canvas,
  getBoard: () => board,
  setBoard(next) { board = next; canvas.setBoard(board); }
};
