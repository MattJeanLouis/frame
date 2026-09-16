// Moteur de particules des atmosphères : pluie, neige, braises, brouillard.
// Le module ignore tout du tableau et des stickers : il reçoit un plan, c'est
// à dire un poids par type d'atmosphère, et se charge du budget, du dessin et
// de la boucle. Le plafond de 200 particules est tenu ici.

const PARTICLE_CAP = 200;
const PARTICLE_BASE = { rain: 78, snow: 58, embers: 44, fog: 7 };
const WEIGHT_REF = 0.3;      // poids d'une atmosphère à taille 1, sert de référence
const SIZE_REF = 420;        // px, toile de référence pour la densité
const TAU = Math.PI * 2;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * @param {HTMLCanvasElement} canvasEl
 * @param {{reducedMotion?: (() => boolean) | boolean}} options
 *   `reducedMotion` est relue à chaque décision : une fonction suit le réglage
 *   système sans qu'on ait à recréer le moteur.
 * @returns {{setPlan: (plan: object) => void,
 *            resize: (w: number, h: number, dpr?: number) => void,
 *            destroy: () => void}}
 */
export function createParticles(canvasEl, { reducedMotion } = {}) {
  const ctx = canvasEl.getContext('2d');
  const still = typeof reducedMotion === 'function' ? reducedMotion : () => Boolean(reducedMotion);

  let weights = {};          // type -> poids cumulé des atmosphères posées
  let counts = {};           // type -> nombre de particules vivantes
  let planKey = '';          // signature du dernier budget appliqué
  let particles = [];
  let viewW = 0, viewH = 0;  // taille de la toile en px CSS
  let rafId = 0;
  let lastFrame = 0;
  let fogSprite = null;

  /** Plan d'atmosphère : `{ rain: 0.28, embers: 0.3 }`. Objet vide = plus rien. */
  function setPlan(plan) {
    weights = plan || {};
    sync();
  }

  /**
   * La toile repasse son plan à chaque rendu, donc à chaque mouvement de doigt.
   * Tant que le budget et le réglage de mouvement ne changent pas, il n'y a rien
   * à faire : sans ce garde-fou, l'image fixe du mode « mouvement réduit » serait
   * redessinée à chaque geste.
   */
  function sync() {
    const target = budget();
    const key = (still() ? 'fixe|' : 'anime|') +
      Object.keys(target).map(type => type + ':' + target[type]).join(',');
    if (key === planKey) return;
    planKey = key;
    applyCounts(target);
    schedule();
  }

  function resize(w, h, dpr = 1) {
    if (!w || !h) return;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (w === viewW && h === viewH && canvasEl.width === pw && canvasEl.height === ph) return;
    viewW = w;
    viewH = h;
    canvasEl.width = pw;                       // remet le canevas à zéro
    canvasEl.height = ph;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = [];                            // les positions dépendent de la taille
    counts = {};
    planKey = '';                              // le champ est à refaire, clé ou pas
    sync();
  }

  function destroy() {
    stop();
    particles = [];
    counts = {};
    weights = {};
  }

  /* ── Budget ─────────────────────────────────────────────────────────────── */

  /** Nombre visé par type : poids de l'atmosphère × densité de la toile, plafonné. */
  function budget() {
    const density = viewW ? clamp(Math.sqrt(viewW * viewH) / SIZE_REF, 0.75, 1.4) : 1;
    const target = {};
    let total = 0;
    for (const type of Object.keys(PARTICLE_BASE)) {
      const weight = weights[type];
      if (!weight) continue;
      const count = Math.max(4, Math.round(
        PARTICLE_BASE[type] * clamp(weight / WEIGHT_REF, 0.5, 1.6) * density
      ));
      target[type] = count;
      total += count;
    }
    if (total > PARTICLE_CAP) {
      const k = PARTICLE_CAP / total;
      for (const type of Object.keys(target)) target[type] = Math.max(3, Math.floor(target[type] * k));
    }
    return target;
  }

  /**
   * Ajuste le champ existant au budget visé : on complète ou on retire, jamais
   * on ne redistribue. Sans quoi la pluie se réorganiserait au hasard à chaque
   * cran d'agrandissement d'un sticker d'atmosphère.
   */
  function applyCounts(target) {
    for (const type of Object.keys(counts)) {
      const want = target[type] || 0;
      let have = counts[type];
      for (let i = particles.length - 1; i >= 0 && have > want; i--) {
        if (particles[i].type === type) {
          particles.splice(i, 1);
          have--;
        }
      }
      counts[type] = have;
    }
    for (const type of Object.keys(target)) {
      let have = counts[type] || 0;
      while (have < target[type]) {
        particles.push(spawn(type, true));
        have++;
      }
      counts[type] = have;
    }
    for (const type of Object.keys(counts)) {
      if (!counts[type]) delete counts[type];
    }
  }

  /* ── Vie des particules ─────────────────────────────────────────────────── */

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

  function step(dt) {
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

  /* ── Dessin ─────────────────────────────────────────────────────────────── */

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

  function clear() {
    if (ctx) ctx.clearRect(0, 0, viewW, viewH);
  }

  function draw() {
    if (!ctx || !viewW || !viewH) return;
    ctx.clearRect(0, 0, viewW, viewH);
    if (!particles.length) return;

    if (counts.fog) {                     // le brouillard d'abord : c'est la nappe de fond
      const sprite = getFogSprite();
      for (const p of particles) {
        if (p.type !== 'fog') continue;
        ctx.globalAlpha = p.a;
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }

    if (counts.rain) {
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
    }

    if (counts.snow) {
      ctx.fillStyle = 'rgb(231, 240, 252)';
      for (const p of particles) {
        if (p.type !== 'snow') continue;
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
    }

    if (counts.embers) {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        if (p.type !== 'embers') continue;
        ctx.globalAlpha = p.a * (0.55 + 0.45 * Math.sin(p.t * 5 + p.ph));
        ctx.fillStyle = `rgb(${p.hue})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.globalAlpha = 1;
  }

  /* ── Boucle ─────────────────────────────────────────────────────────────── */

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    step(dt);
    draw();
  }

  function start() {
    if (rafId || !particles.length) return;
    lastFrame = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /** Décide, après tout changement, s'il faut animer, figer ou effacer. */
  function schedule() {
    if (!particles.length) {
      stop();
      clear();
    } else if (still()) {
      stop();
      draw();                 // sans mouvement : une seule image, une texture
    } else {
      start();
    }
  }

  return { setPlan, resize, destroy };
}
