// La toile : structure DOM, gestes pointeur, clavier, atmosphères et particules.
// Le modèle reste immuable (src/board.js) ; ce module ne fait que le refléter
// dans le DOM et remonter chaque modification par onChange.

import { STICKER_BY_ID, twemojiUrl } from './stickers.js';
import {
  moveSticker, scaleSticker, flipSticker, removeSticker, bringToFront,
  SCALE_MIN, SCALE_MAX
} from './board.js';

export const SCALE_STEP = 0.25;
export const MOVE_STEP = 0.02;
export const MOVE_STEP_BIG = 0.10;

const BASE_SIZE = 64;          // px, taille d'un sticker à scale 1
const DRAG_OUT_MARGIN = 0.12;  // fraction hors toile au-delà de laquelle on supprime
const CLICK_SLOP = 4;          // px, au-delà le clic est considéré comme un glissement
const TOOL_GAP = 10;           // px entre le sticker et la barre d'outils
const TOOL_EDGE = 6;           // px de marge minimale entre la barre et le bord
const ATMO_INTENSITY_MAX = 0.45;
const ATMO_LIGHT_MAX = 0.4;
const PARTICLE_CAP = 200;      // plafond dur, toutes atmosphères confondues
const PARTICLE_BASE = { rain: 78, snow: 58, embers: 44, fog: 7 };
const TAU = Math.PI * 2;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const round3 = v => Math.round(v * 1000) / 1000;

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ── Halo des stickers (spec §6.1) ───────────────────────────────────────────
   Le halo suit la couleur dominante du dessin : on lit une fois l'image
   Twemoji dans un canevas minuscule et on retient sa teinte moyenne, pondérée
   par l'opacité et la saturation pour que le gris ne délave pas la couleur.
   En cas d'échec (canevas teinté, réseau), on renvoie null : pas de halo. */
const haloCache = new Map();

function haloColor(url) {
  if (haloCache.has(url)) return haloCache.get(url);
  const promise = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const size = 16;
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const g = off.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, size, size);
        const data = g.getImageData(0, 0, size, size).data;
        let r = 0, gr = 0, b = 0, sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          if (a < 0.2) continue;
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          const sat = max === 0 ? 0 : (max - min) / max;
          const w = a * (0.2 + sat);
          r += data[i] * w; gr += data[i + 1] * w; b += data[i + 2] * w; sum += w;
        }
        if (sum <= 0) { resolve(null); return; }
        resolve(`rgba(${Math.round(r / sum)}, ${Math.round(gr / sum)}, ${Math.round(b / sum)}, 0.32)`);
      } catch {
        resolve(null);
      }
    };
    img.src = url;
  });
  haloCache.set(url, promise);
  return promise;
}

/**
 * Crée la toile dans rootEl.
 * @param {HTMLElement} rootEl
 * @param {{onChange?: (board: object, meta: {commit: boolean}) => void,
 *          onSelect?: (index: number) => void}} handlers
 * @returns {{setBoard: Function, getBoard: Function, select: Function, destroy: Function}}
 */
export function createCanvas(rootEl, { onChange, onSelect } = {}) {
  const dom = buildDom(rootEl);
  const ctx = dom.particles.getContext('2d');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let board = { items: [] };
  let selected = -1;
  let landing = new Set();       // index des stickers qui viennent d'arriver
  let destroyed = false;

  // Gestes en cours : un pointeur par doigt, plus l'état de pincement.
  const pointers = new Map();    // pointerId -> { index, startX, startY, startItemX, startItemY, curX, curY }
  let pinch = null;              // { index, startDist, startScale }
  let dragMoved = 0;             // plus grand déplacement du geste, en px
  let swallowClick = false;      // un glissement vient d'avoir lieu : le clic est ignoré
  let gestureChanged = false;    // le geste a réellement modifié le tableau

  // Particules.
  let plan = [];                 // [[type, count], …]
  let planKey = '';
  let particles = [];
  let rafId = 0;
  let lastFrame = 0;
  let viewW = 0, viewH = 0;      // taille de la toile en px CSS
  let fogSprite = null;

  const listeners = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  };

  /* ── Rendu ──────────────────────────────────────────────────────────────── */

  function render() {
    const items = board.items;
    const total = items.length;

    for (let i = 0; i < total; i++) {
      let el = dom.stickers.children[i];
      if (!el) {
        el = createStickerEl();
        dom.stickers.append(el);
      }
      applyItem(el, items[i], i, total);
    }
    while (dom.stickers.children.length > total) {
      const gone = dom.stickers.lastElementChild;
      if (gone.contains(document.activeElement)) dom.canvas.focus({ preventScroll: true });
      gone.remove();
    }

    dom.hint.hidden = total > 0;
    landing.clear();
    renderAtmosphere();
    renderToolbar();
    renderSr();
  }

  function createStickerEl() {
    const el = document.createElement('button');
    el.className = 'sticker';
    el.type = 'button';
    const img = document.createElement('img');
    img.className = 'sticker__img';
    img.alt = '';
    img.draggable = false;
    img.loading = 'lazy';
    el.append(img);
    // La classe d'arrivée se retire d'elle-même pour pouvoir se rejouer.
    el.addEventListener('animationend', () => el.classList.remove('is-landing'));
    return el;
  }

  function applyItem(el, item, index, total) {
    const sticker = STICKER_BY_ID.get(item.id);
    const label = sticker ? sticker.label.toLowerCase() : item.id;

    if (el.dataset.stickerId !== item.id) {
      el.dataset.stickerId = item.id;
      const url = sticker ? twemojiUrl(sticker.emoji) : '';
      el.firstElementChild.src = url;
      el.style.removeProperty('--halo');
      if (url) {
        haloColor(url).then(color => {
          if (color && el.dataset.stickerId === item.id) el.style.setProperty('--halo', color);
        });
      }
    }

    el.dataset.index = String(index);
    el.style.setProperty('--x', round3(item.x * 100) + '%');
    el.style.setProperty('--y', round3(item.y * 100) + '%');
    el.style.setProperty('--scale', String(item.scale));
    el.style.setProperty('--flip', item.flip ? '-1' : '1');
    el.setAttribute('aria-label', `${label}, sticker ${index + 1} sur ${total}`);
    el.setAttribute('aria-pressed', index === selected ? 'true' : 'false');

    // Sans mouvement, rien à jouer : on n'accroche même pas la classe.
    if (landing.has(index) && !motionQuery.matches) {
      el.classList.remove('is-landing');
      void el.offsetWidth;                 // force le redémarrage de l'animation
      el.classList.add('is-landing');
    }
  }

  function renderSr() {
    dom.sr.textContent = board.items
      .map(item => {
        const sticker = STICKER_BY_ID.get(item.id);
        return sticker ? sticker.label.toLowerCase() : item.id;
      })
      .join(', ');
  }

  function renderToolbar() {
    const item = board.items[selected];
    if (!item) {
      dom.toolbar.hidden = true;
      return;
    }
    dom.toolbar.hidden = false;

    const rect = dom.canvas.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const tw = dom.toolbar.offsetWidth || 244;
    const th = dom.toolbar.offsetHeight || 52;
    const half = (BASE_SIZE * item.scale) / 2;
    const cx = item.x * w;
    const cy = item.y * h;

    let top = cy - half - TOOL_GAP - th / 2;
    if (top - th / 2 < TOOL_EDGE) top = cy + half + TOOL_GAP + th / 2;   // bascule dessous
    top = th + 2 * TOOL_EDGE >= h ? h / 2 : clamp(top, th / 2 + TOOL_EDGE, h - th / 2 - TOOL_EDGE);
    const left = tw + 2 * TOOL_EDGE >= w ? w / 2 : clamp(cx, tw / 2 + TOOL_EDGE, w - tw / 2 - TOOL_EDGE);

    dom.toolbar.style.left = round3((left / w) * 100) + '%';
    dom.toolbar.style.top = round3((top / h) * 100) + '%';
  }

  /* ── Atmosphères (spec §3.3) ────────────────────────────────────────────── */

  function renderAtmosphere() {
    let tr = 0, tg = 0, tb = 0, tintWeight = 0;
    let intensity = 0, light = 0;
    const byType = new Map();

    for (const item of board.items) {
      const sticker = STICKER_BY_ID.get(item.id);
      const atmo = sticker && sticker.atmosphere;
      if (!atmo) continue;
      const weight = (atmo.intensity || 0) * item.scale;
      const rgb = hexToRgb(atmo.tint);
      if (rgb && weight > 0) {
        tr += rgb[0] * weight; tg += rgb[1] * weight; tb += rgb[2] * weight;
        tintWeight += weight;
      }
      intensity += weight;
      light += (atmo.light || 0) * item.scale;
      if (atmo.particles) byType.set(atmo.particles, (byType.get(atmo.particles) || 0) + weight);
    }

    const style = dom.canvas.style;
    if (tintWeight > 0) {
      const r = Math.round(tr / tintWeight);
      const g = Math.round(tg / tintWeight);
      const b = Math.round(tb / tintWeight);
      style.setProperty('--atmo-tint', `rgb(${r}, ${g}, ${b})`);
      style.setProperty('--atmo-intensity', String(round3(Math.min(ATMO_INTENSITY_MAX, intensity / 2))));
    } else {
      style.setProperty('--atmo-tint', 'transparent');
      style.setProperty('--atmo-intensity', '0');
    }
    style.setProperty('--atmo-light', String(round3(clamp(light, -ATMO_LIGHT_MAX, ATMO_LIGHT_MAX))));

    syncParticles(byType);
  }

  /* ── Particules ─────────────────────────────────────────────────────────── */

  function syncParticles(byType) {
    // La densité suit la taille de la toile : même pluie sur 358 px et sur 640 px.
    const density = viewW ? clamp(Math.sqrt(viewW * viewH) / 420, 0.75, 1.4) : 1;
    const next = [];
    let total = 0;
    for (const type of Object.keys(PARTICLE_BASE)) {
      const weight = byType.get(type);
      if (!weight) continue;
      const count = Math.max(4, Math.round(PARTICLE_BASE[type] * clamp(weight / 0.3, 0.5, 1.6) * density));
      next.push([type, count]);
      total += count;
    }
    if (total > PARTICLE_CAP) {
      const k = PARTICLE_CAP / total;
      for (const entry of next) entry[1] = Math.max(3, Math.floor(entry[1] * k));
    }

    const key = next.map(entry => entry[0] + ':' + entry[1]).join('|');
    if (key === planKey) return;
    planKey = key;
    plan = next;
    spawnParticles();

    if (!plan.length) {
      stopLoop();
      clearParticles();
    } else if (motionQuery.matches) {
      stopLoop();
      drawParticles();
    } else {
      startLoop();
    }
  }

  function spawnParticles() {
    particles = [];
    if (!plan.length || !viewW || !viewH) return;
    for (const [type, count] of plan) {
      for (let i = 0; i < count; i++) particles.push(spawn(type, true));
    }
  }

  function spawn(type, scattered) {
    const x = Math.random() * viewW;
    const y = Math.random() * viewH;
    switch (type) {
      case 'rain': {
        const speed = rand(620, 1080);
        return { type, x, y: scattered ? y : -20, vx: speed * 0.22, vy: speed,
          w: rand(0.7, 1.4), a: rand(0.18, 0.42) };
      }
      case 'snow':
        return { type, x, y: scattered ? y : -8, vy: rand(22, 56), amp: rand(6, 20),
          sw: rand(0.4, 1.1), ph: Math.random() * TAU, r: rand(0.9, 2.4),
          a: rand(0.3, 0.8), t: Math.random() * 10 };
      case 'embers':
        return { type, x, y: scattered ? y : viewH + 6, vy: rand(26, 78), amp: rand(4, 16),
          sw: rand(0.6, 1.6), ph: Math.random() * TAU, r: rand(0.7, 2),
          a: rand(0.3, 0.75), t: Math.random() * 10,
          hue: Math.random() < 0.3 ? '255, 196, 120' : '242, 122, 60' };
      case 'fog':
      default:
        return { type, x, y: rand(viewH * 0.2, viewH * 0.95), vx: rand(-16, 16) || 8,
          r: rand(viewW * 0.18, viewW * 0.42), a: rand(0.03, 0.08), t: Math.random() * 10,
          sw: rand(0.1, 0.3), ph: Math.random() * TAU };
    }
  }

  function stepParticles(dt) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.t = (p.t || 0) + dt;
      switch (p.type) {
        case 'rain':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > viewH + 24 || p.x > viewW + 24) particles[i] = spawn('rain', false);
          break;
        case 'snow':
          p.y += p.vy * dt;
          p.x += Math.sin(p.t * p.sw + p.ph) * p.amp * dt;
          if (p.y > viewH + 8) particles[i] = spawn('snow', false);
          break;
        case 'embers':
          p.y -= p.vy * dt;
          p.x += Math.sin(p.t * p.sw + p.ph) * p.amp * dt;
          if (p.y < -8) particles[i] = spawn('embers', false);
          break;
        case 'fog':
          p.x += p.vx * dt;
          p.y += Math.sin(p.t * p.sw + p.ph) * 4 * dt;
          if (p.x - p.r > viewW) p.x = -p.r;
          if (p.x + p.r < 0) p.x = viewW + p.r;
          break;
      }
    }
  }

  function getFogSprite() {
    if (fogSprite) return fogSprite;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(206, 214, 228, 0.9)');
    grad.addColorStop(0.55, 'rgba(206, 214, 228, 0.35)');
    grad.addColorStop(1, 'rgba(206, 214, 228, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    fogSprite = c;
    return c;
  }

  function clearParticles() {
    if (ctx) ctx.clearRect(0, 0, viewW, viewH);
  }

  function drawParticles() {
    if (!ctx || !viewW || !viewH) return;
    ctx.clearRect(0, 0, viewW, viewH);
    if (!particles.length) return;

    // Brouillard d'abord : c'est la nappe de fond.
    const sprite = particles.some(p => p.type === 'fog') ? getFogSprite() : null;
    if (sprite) {
      for (const p of particles) {
        if (p.type !== 'fog') continue;
        ctx.globalAlpha = p.a;
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgb(186, 210, 240)';
    for (const p of particles) {
      if (p.type !== 'rain') continue;
      ctx.globalAlpha = p.a;
      ctx.lineWidth = p.w;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgb(231, 240, 252)';
    for (const p of particles) {
      if (p.type !== 'snow') continue;
      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      if (p.type !== 'embers') continue;
      const flicker = 0.55 + 0.45 * Math.sin(p.t * 5 + p.ph);
      ctx.globalAlpha = p.a * flicker;
      ctx.fillStyle = `rgb(${p.hue})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    stepParticles(dt);
    drawParticles();
  }

  function startLoop() {
    if (rafId || motionQuery.matches || !particles.length) return;
    lastFrame = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function resizeParticles() {
    const rect = dom.canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    const resized = w !== viewW || h !== viewH ||
                    dom.particles.width !== pw || dom.particles.height !== ph;
    if (!resized && particles.length) return;         // rien à refaire
    viewW = w;
    viewH = h;
    if (resized) {
      dom.particles.width = pw;                       // remet le canevas à zéro
      dom.particles.height = ph;
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (plan.length) spawnParticles();
    if (!motionQuery.matches && particles.length) startLoop();
    else drawParticles();
  }

  /* ── Sélection et modifications ─────────────────────────────────────────── */

  function setSelected(index) {
    const next = Number.isInteger(index) && index >= 0 && index < board.items.length ? index : -1;
    if (next === selected) {
      renderToolbar();
      return;
    }
    const previous = selected;
    selected = next;
    const before = dom.stickers.children[previous];
    if (before) before.setAttribute('aria-pressed', 'false');
    const after = dom.stickers.children[selected];
    if (after) after.setAttribute('aria-pressed', 'true');
    renderToolbar();
    if (onSelect) onSelect(selected);
  }

  /** Applique un nouveau tableau venu d'une opération locale et prévient app.js. */
  function apply(next, commit) {
    if (next === board) return false;
    board = next;
    render();
    if (onChange) onChange(board, { commit });
    return true;
  }

  function indexOfEvent(event) {
    const el = event.target.closest && event.target.closest('.sticker');
    if (!el || el.parentElement !== dom.stickers) return -1;
    const index = Number(el.dataset.index);
    return Number.isInteger(index) ? index : -1;
  }

  const stickerEl = index => dom.stickers.children[index] || null;

  /* ── 1. pointerdown sur un sticker ──────────────────────────────────────── */

  function onPointerDown(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    const item = board.items[index];
    if (!item) return;

    event.preventDefault();
    const el = stickerEl(index);
    try { el.setPointerCapture(event.pointerId); } catch { /* capture facultative */ }

    // Deuxième doigt sur le même sticker : on bascule en pincement.
    const twin = [...pointers.values()].find(p => p.index === index);
    pointers.set(event.pointerId, {
      index,
      startX: event.clientX, startY: event.clientY,
      startItemX: item.x, startItemY: item.y,
      curX: event.clientX, curY: event.clientY
    });
    if (twin) {
      pinch = {
        index,
        startDist: Math.max(1, Math.hypot(event.clientX - twin.curX, event.clientY - twin.curY)),
        startScale: item.scale
      };
    } else {
      dragMoved = 0;
      swallowClick = false;
      gestureChanged = false;
    }

    el.classList.add('is-dragging');
    dom.canvas.classList.add('is-gesturing');
    setSelected(index);
  }

  /* ── 2. pointermove ─────────────────────────────────────────────────────── */

  function onPointerMove(event) {
    const entry = pointers.get(event.pointerId);
    if (!entry) return;
    entry.curX = event.clientX;
    entry.curY = event.clientY;

    const rect = dom.canvas.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const item = board.items[entry.index];
    if (!item) return;

    if (pinch && pinch.index === entry.index && pointers.size >= 2) {
      const pair = [...pointers.values()].filter(p => p.index === pinch.index).slice(0, 2);
      if (pair.length === 2) {
        const dist = Math.max(1, Math.hypot(pair[0].curX - pair[1].curX, pair[0].curY - pair[1].curY));
        const ratio = dist / pinch.startDist;
        const scale = clamp(pinch.startScale * ratio, SCALE_MIN, SCALE_MAX);
        if (scale !== item.scale && apply(scaleSticker(board, pinch.index, scale), false)) {
          gestureChanged = true;
        }
      }
      return;
    }

    dragMoved = Math.max(dragMoved, Math.hypot(event.clientX - entry.startX, event.clientY - entry.startY));
    if (dragMoved > CLICK_SLOP) swallowClick = true;

    const nx = clamp(entry.startItemX + (event.clientX - entry.startX) / w, 0, 1);
    const ny = clamp(entry.startItemY + (event.clientY - entry.startY) / h, 0, 1);
    if ((nx !== item.x || ny !== item.y) && apply(moveSticker(board, entry.index, nx, ny), false)) {
      gestureChanged = true;
    }

    // Retour visuel du geste de suppression : le doigt sort franchement.
    const px = (event.clientX - rect.left) / w;
    const py = (event.clientY - rect.top) / h;
    const out = px < -DRAG_OUT_MARGIN || px > 1 + DRAG_OUT_MARGIN ||
                py < -DRAG_OUT_MARGIN || py > 1 + DRAG_OUT_MARGIN;
    const el = stickerEl(entry.index);
    if (el) el.classList.toggle('is-leaving', out);
  }

  /* ── 3. pointerup ───────────────────────────────────────────────────────── */

  function onPointerUp(event) {
    const entry = pointers.get(event.pointerId);
    if (!entry) return;
    const el = stickerEl(entry.index);
    const leaving = el ? el.classList.contains('is-leaving') : false;
    releasePointer(event, entry);

    if (stillHolding(entry.index)) {
      rebaseRemaining(entry.index);           // le doigt restant reprend le glissement
      return;
    }

    if (el) el.classList.remove('is-dragging', 'is-leaving');
    if (leaving) {
      if (el && el.contains(document.activeElement)) dom.canvas.focus({ preventScroll: true });
      apply(removeSticker(board, entry.index), true);
      setSelected(-1);
      return;
    }
    // Fin du geste : on valide, mais seulement si le tableau a bougé.
    if (gestureChanged && onChange) onChange(board, { commit: true });
    gestureChanged = false;
  }

  /* ── 4. pointercancel ───────────────────────────────────────────────────── */

  function onPointerCancel(event) {
    const entry = pointers.get(event.pointerId);
    if (!entry) return;
    releasePointer(event, entry);
    if (stillHolding(entry.index)) {
      rebaseRemaining(entry.index);
      return;
    }
    const el = stickerEl(entry.index);
    if (el) el.classList.remove('is-dragging', 'is-leaving');
    gestureChanged = false;
  }

  function stillHolding(index) {
    return [...pointers.values()].some(p => p.index === index);
  }

  /** Le doigt qui reste devient la nouvelle référence : le sticker ne saute pas. */
  function rebaseRemaining(index) {
    for (const other of pointers.values()) {
      if (other.index !== index) continue;
      const item = board.items[index];
      if (!item) continue;
      other.startX = other.curX;
      other.startY = other.curY;
      other.startItemX = item.x;
      other.startItemY = item.y;
    }
  }

  function releasePointer(event, entry) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) dom.canvas.classList.remove('is-gesturing');
    const el = stickerEl(entry.index);
    if (el && el.hasPointerCapture && el.hasPointerCapture(event.pointerId)) {
      try { el.releasePointerCapture(event.pointerId); } catch { /* déjà relâchée */ }
    }
  }

  /* ── 5. molette ─────────────────────────────────────────────────────────── */

  function onWheel(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    const item = board.items[index];
    if (!item) return;
    event.preventDefault();
    apply(scaleSticker(board, index, item.scale - Math.sign(event.deltaY) * SCALE_STEP), true);
  }

  /* ── 6. double clic ─────────────────────────────────────────────────────── */

  function onDoubleClick(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    event.preventDefault();
    apply(flipSticker(board, index), true);
  }

  /* ── 7. clic simple ─────────────────────────────────────────────────────── */

  function onClick(event) {
    const index = indexOfEvent(event);
    if (index < 0) return;
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    setSelected(index);
  }

  /* ── 8. barre d'outils ──────────────────────────────────────────────────── */

  function onToolbarClick(event) {
    const button = event.target.closest('.canvas__tool');
    if (!button) return;
    const index = selected;
    const item = board.items[index];
    if (!item) return;

    switch (button.dataset.action) {
      case 'grow':
        apply(scaleSticker(board, index, item.scale + SCALE_STEP), true);
        break;
      case 'shrink':
        apply(scaleSticker(board, index, item.scale - SCALE_STEP), true);
        break;
      case 'flip':
        apply(flipSticker(board, index), true);
        break;
      case 'front': {
        const changed = apply(bringToFront(board, index), true);
        if (changed) setSelected(board.items.length - 1);
        break;
      }
      case 'remove':
        dom.canvas.focus({ preventScroll: true });
        apply(removeSticker(board, index), true);
        setSelected(-1);
        break;
    }
  }

  /* ── 9. clavier ─────────────────────────────────────────────────────────── */

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      if (selected < 0) return;
      event.preventDefault();
      setSelected(-1);
      return;
    }

    const index = selected;
    const item = board.items[index];
    if (!item) return;
    const step = event.shiftKey ? MOVE_STEP_BIG : MOVE_STEP;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        apply(moveSticker(board, index, item.x - step, item.y), true);
        break;
      case 'ArrowRight':
        event.preventDefault();
        apply(moveSticker(board, index, item.x + step, item.y), true);
        break;
      case 'ArrowUp':
        event.preventDefault();
        apply(moveSticker(board, index, item.x, item.y - step), true);
        break;
      case 'ArrowDown':
        event.preventDefault();
        apply(moveSticker(board, index, item.x, item.y + step), true);
        break;
      case '+':
      case '=':
        event.preventDefault();
        apply(scaleSticker(board, index, item.scale + SCALE_STEP), true);
        break;
      case '-':
      case '_':
        event.preventDefault();
        apply(scaleSticker(board, index, item.scale - SCALE_STEP), true);
        break;
      case 'r':
      case 'R':
        event.preventDefault();
        apply(flipSticker(board, index), true);
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        dom.canvas.focus({ preventScroll: true });
        apply(removeSticker(board, index), true);
        setSelected(-1);
        break;
    }
  }

  /* ── 10. focus clavier ──────────────────────────────────────────────────── */

  function onFocusIn(event) {
    const index = indexOfEvent(event);
    if (index >= 0) setSelected(index);
  }

  /* ── 11. appui sur le fond ──────────────────────────────────────────────── */

  function onBackdropDown(event) {
    if (event.target.closest && event.target.closest('.sticker, .canvas__toolbar')) return;
    setSelected(-1);
  }

  /* ── 12. redimensionnement ──────────────────────────────────────────────── */

  function onResize() {
    resizeParticles();
    renderAtmosphere();      // la densité de particules dépend de la taille
    renderToolbar();
  }

  function onMotionChange() {
    if (motionQuery.matches) {
      stopLoop();
      drawParticles();
    } else if (particles.length) {
      startLoop();
    }
  }

  on(dom.stickers, 'pointerdown', onPointerDown);
  on(dom.stickers, 'pointermove', onPointerMove);
  on(dom.stickers, 'pointerup', onPointerUp);
  on(dom.stickers, 'pointercancel', onPointerCancel);
  on(dom.stickers, 'wheel', onWheel, { passive: false });
  on(dom.stickers, 'dblclick', onDoubleClick);
  on(dom.stickers, 'click', onClick);
  on(dom.toolbar, 'click', onToolbarClick);
  on(dom.canvas, 'keydown', onKeyDown);
  on(dom.stickers, 'focusin', onFocusIn);
  on(dom.canvas, 'pointerdown', onBackdropDown);
  on(window, 'resize', onResize);
  on(motionQuery, 'change', onMotionChange);

  resizeParticles();
  render();

  /* ── Poignée publique ───────────────────────────────────────────────────── */

  function setBoard(next) {
    const previous = board;
    board = next && Array.isArray(next.items) ? next : { items: [] };
    landing = computeLanding(previous.items, board.items, pointers);
    if (selected >= board.items.length) setSelected(-1);
    resizeParticles();
    render();
  }

  function getBoard() {
    return board;
  }

  function select(index) {
    setSelected(index);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    for (const [target, type, fn, opts] of listeners) target.removeEventListener(type, fn, opts);
    listeners.length = 0;
    pointers.clear();
    dom.canvas.remove();
  }

  return { setBoard, getBoard, select, destroy };
}

/**
 * Stickers à animer à l'arrivée : ceux qui n'étaient pas dans le tableau
 * précédent. Un sticker seulement déplacé, redimensionné ou retourné garde son
 * index et son identifiant : ce n'est pas une arrivée, il ne rejoue rien.
 */
function computeLanding(previousItems, nextItems, pointers) {
  const known = new Set(previousItems);
  const held = new Set([...pointers.values()].map(p => p.index));
  const landing = new Set();
  for (let i = 0; i < nextItems.length; i++) {
    const item = nextItems[i];
    if (known.has(item) || held.has(i)) continue;
    const before = previousItems[i];
    if (before && before.id === item.id) continue;
    landing.add(i);
  }
  return landing;
}

function buildDom(rootEl) {
  const canvas = document.createElement('div');
  canvas.className = 'canvas';
  canvas.id = 'canvas';
  canvas.tabIndex = -1;

  const atmosphere = layer('div', 'canvas__atmosphere');
  const particles = layer('canvas', 'canvas__particles');
  const grain = layer('div', 'canvas__grain');
  const vignette = layer('div', 'canvas__vignette');

  const stickers = document.createElement('div');
  stickers.className = 'canvas__stickers';

  const toolbar = document.createElement('div');
  toolbar.className = 'canvas__toolbar';
  toolbar.id = 'canvas-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Actions du sticker');
  toolbar.hidden = true;
  for (const [action, label, glyph] of [
    ['grow', 'Agrandir', '+'],
    ['shrink', 'Réduire', '−'],
    ['flip', 'Retourner', '⇄'],
    ['front', 'Mettre devant', '▲'],
    ['remove', 'Supprimer', '✕']
  ]) {
    const button = document.createElement('button');
    button.className = 'canvas__tool';
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    button.textContent = glyph;
    toolbar.append(button);
  }

  const hint = document.createElement('p');
  hint.className = 'canvas__hint';
  hint.id = 'canvas-hint';
  hint.textContent = 'Pose un sticker, les films arrivent.';

  const sr = document.createElement('p');
  sr.className = 'canvas__sr sr-only';
  sr.id = 'canvas-sr';
  sr.setAttribute('aria-live', 'polite');

  canvas.append(atmosphere, particles, grain, vignette, stickers, toolbar, hint, sr);
  rootEl.append(canvas);
  return { canvas, atmosphere, particles, stickers, toolbar, hint, sr };
}

function layer(tag, className) {
  const el = document.createElement(tag);
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  return el;
}
