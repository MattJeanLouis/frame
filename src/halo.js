// Halo des stickers (spec §6.1) : « un très léger halo qui suit leur couleur
// dominante ». On lit l'image déjà affichée dans un canevas de 16×16, une seule
// fois par emoji, et on en tire une moyenne pondérée par l'opacité et la
// saturation — sans quoi le gris des contours délave la couleur.
// L'image du sticker porte crossOrigin="anonymous" : rien n'est téléchargé deux
// fois et le canevas n'est pas teinté. Tout échec renvoie null : pas de halo.

const HALO_ALPHA = 0.32;
const SAMPLE = 16;

const cache = new Map();   // url -> Promise<string|null>

/**
 * @param {HTMLImageElement} img image du sticker, déjà dans le DOM
 * @returns {Promise<string|null>} couleur CSS du halo, ou null
 */
export function haloColor(img) {
  const url = img.currentSrc || img.src;
  if (!url) return Promise.resolve(null);
  const known = cache.get(url);
  if (known) return known;
  const pending = loaded(img).then(ok => (ok ? extract(img) : null));
  cache.set(url, pending);
  return pending;
}

function loaded(img) {
  if (img.complete) return Promise.resolve(img.naturalWidth > 0);
  return new Promise(resolve => {
    img.addEventListener('load', () => resolve(true), { once: true });
    img.addEventListener('error', () => resolve(false), { once: true });
  });
}

function extract(img) {
  try {
    const off = document.createElement('canvas');
    off.width = SAMPLE;
    off.height = SAMPLE;
    const g = off.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const data = g.getImageData(0, 0, SAMPLE, SAMPLE).data;
    let r = 0, gr = 0, b = 0, sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      if (a < 0.2) continue;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const w = a * (0.2 + saturation);
      r += data[i] * w; gr += data[i + 1] * w; b += data[i + 2] * w; sum += w;
    }
    if (sum <= 0) return null;
    return `rgba(${Math.round(r / sum)}, ${Math.round(gr / sum)}, ${Math.round(b / sum)}, ${HALO_ALPHA})`;
  } catch {
    return null;              // canevas teinté ou image illisible
  }
}
