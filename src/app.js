// Banc d'essai provisoire : la toile, le tiroir, la bande de résultats et la
// fiche film branchés sur le client de démonstration. L'assemblage définitif
// (clé TMDB, URL, panneaux, journal) arrive en tâche 9.
import { createBoard, addSticker, boardSeedKey, MAX_STICKERS } from './board.js';
import { STICKER_BY_ID } from './stickers.js';
import { createCanvas } from './canvas.js';
import { createDrawer } from './drawer.js';
import { createResults, createSheet } from './results.js';
import { createDemoClient } from './demo.js';
import { selectMovies } from './engine.js';

const client = createDemoClient();
let board = createBoard();
let entries = [];
let run = 0;

const placed = () => board.items.map(item => ({ id: item.id, scale: item.scale }));
// Le sticker se pose au centre, avec une petite variation de position.
const jitter = () => 0.5 + (Math.random() - 0.5) * 0.12;

const results = createResults(document.getElementById('results-host'), {
  onOpen: entry => sheet.open(entry, placed())
});

const sheet = createSheet(document.getElementById('sheet-host'), {
  client,
  onJournal: entry => console.log('journal', entry.movie.id)
});

const canvas = createCanvas(document.getElementById('canvas-host'), {
  onChange(next, { commit }) {
    board = next;
    // Un geste en cours remonte chaque image : on ne relance qu'une fois posé.
    if (commit) refresh();
  },
  onSelect() {}
});

const drawer = createDrawer(document.getElementById('drawer-host'), {
  onPick(id) {
    board = addSticker(board, id, { x: jitter(), y: jitter() });
    canvas.setBoard(board);
    drawer.setFull(board.items.length >= MAX_STICKERS);
    refresh();
  }
});

async function refresh() {
  if (!board.items.length) {
    entries = [];
    results.setEmpty('no-sticker');
    return;
  }
  const mine = ++run;
  const animateFirst = board.items.length === 1;
  results.setLoading();
  const pools = {};
  for (const item of placed()) pools[item.id] = await client.stickerPools(STICKER_BY_ID.get(item.id));
  if (mine !== run) return;
  const next = selectMovies(placed(), pools, entries, boardSeedKey(board));
  entries = next;
  if (!next.length) {
    results.setEmpty('no-results');
    return;
  }
  results.setSelection(next, placed(), { animateFirst });
}

canvas.setBoard(board);
refresh();

// Petites prises pour la vérification manuelle en navigateur.
window.FRAME_DEV = {
  canvas, drawer, results, sheet, client, refresh, placed,
  getBoard: () => board,
  setBoard(next) {
    board = next;
    canvas.setBoard(board);
    drawer.setFull(board.items.length >= MAX_STICKERS);
    refresh();
  }
};
