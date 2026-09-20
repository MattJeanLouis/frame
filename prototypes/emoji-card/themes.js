/* Le thème appartient à l'appareil, indépendamment du profil et de son code. */
(() => {
  const key = 'frame.appearance.v1';
  const themes = [
    { id: 'premiere', name: 'Première', detail: 'Graphite, rouge vif. Le cinéma au premier plan.', sample: 'Press play.', tag: '01 / CINEMATIC', scheme: 'dark' },
    { id: 'studio', name: 'Studio', detail: 'Blanc minéral, encre. Précis et éditorial.', sample: 'Less, but better.', tag: '02 / EDITORIAL', scheme: 'light' },
    { id: 'afterhours', name: 'After Hours', detail: 'Prune profonde, rose poudré. Doux et nocturne.', sample: 'One more movie.', tag: '03 / AFTER DARK', scheme: 'dark' },
    { id: 'signal', name: 'Signal', detail: 'Bleu électrique, titrage XXL. Sans détour.', sample: 'MAKE IT BIG.', tag: '04 / BOLD', scheme: 'dark' },
    { id: 'horizon', name: 'Horizon', detail: 'Pierre, olive. De l’espace pour les images.', sample: 'Take your time.', tag: '05 / SLOW CINEMA', scheme: 'light' },
    {"id": "lagoon", "name": "Lagoon", "detail": "Pétrole et corail. Profond, frais, contrasté.", "sample": "Dive into cinema.", "tag": "06 / DEEP WATER", "scheme": "dark"},
    {"id": "velvet", "name": "Velvet", "detail": "Bordeaux et pêche. Une nuit en couleurs.", "sample": "Stay for the credits.", "tag": "07 / VELVET NIGHT", "scheme": "dark"},
    {"id": "espresso", "name": "Espresso", "detail": "Brun profond et cuivre. Chaleureux et précis.", "sample": "A taste for stories.", "tag": "08 / WARM CONTRAST", "scheme": "dark"},
    {"id": "glacier", "name": "Glacier", "detail": "Blanc bleuté et bleu glacier. Net et lumineux.", "sample": "A fresh perspective.", "tag": "09 / FRESH AIR", "scheme": "light"},
    {"id": "apricot", "name": "Apricot", "detail": "Abricot clair et prune. Doux, avec du caractère.", "sample": "Good company.", "tag": "10 / SOFT CONTRAST", "scheme": "light"},
    {"id": "iris", "name": "Iris", "detail": "Lilas clair et violet encre. Graphique et lumineux.", "sample": "A different angle.", "tag": "11 / NEW PERSPECTIVE", "scheme": "light"},
    {"id": "forest", "name": "Forest", "detail": "Vert sapin et citron vert. Vivant et immersif.", "sample": "Into the story.", "tag": "12 / GREEN ROOM", "scheme": "dark"}
  ];
  const previous = { minuit: 'premiere', cineclub: 'studio', popcorn: 'signal', videoclub: 'afterhours', drivein: 'horizon' };
  let selected = 'premiere';
  try { const saved = localStorage.getItem(key); if (themes.some(t => t.id === saved)) selected = saved; else if (previous[saved]) selected = previous[saved]; } catch { /* Navigation privée : le choix fonctionne pour cette visite. */ }
  document.documentElement.dataset.theme = selected;
  document.documentElement.style.colorScheme = themes.find(t => t.id === selected).scheme;
  window.addEventListener('DOMContentLoaded', () => {
    const dialog = document.getElementById('theme-dialog');
    const opener = document.getElementById('btn-theme');
    const choices = document.getElementById('theme-choices');
    const status = document.getElementById('theme-status');
    const filters = document.getElementById('theme-filters');
    const filterChoices = scheme => {
      filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scheme === scheme)));
      choices.querySelectorAll('button').forEach(b => { b.hidden = scheme !== 'all' && b.dataset.scheme !== scheme; });
    };
    filters.addEventListener('click', e => { const button = e.target.closest('button[data-scheme]'); if (button) filterChoices(button.dataset.scheme); });
    const sync = () => {
      const current = themes.find(t => t.id === selected);
      document.documentElement.dataset.theme = selected;
      document.documentElement.style.colorScheme = current.scheme;
      document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim();
      document.getElementById('theme-current').textContent = current.name;
      opener.setAttribute('aria-label', `Changer d’ambiance : ${current.name}`);
      choices.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === selected)));
    };
    for (const theme of themes) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'theme-choice'; button.dataset.theme = theme.id; button.dataset.scheme = theme.scheme;
      const sample = document.createElement('span'); sample.className = 'theme-sample'; sample.setAttribute('aria-hidden', 'true');
      const tag = document.createElement('small'); tag.textContent = theme.tag;
      const title = document.createElement('strong'); title.textContent = theme.sample;
      const posters = document.createElement('span'); posters.className = 'theme-sample__posters';
      for (let i = 0; i < 3; i++) { const poster = document.createElement('img'); poster.alt = ''; poster.loading = 'lazy'; posters.append(poster); }
      sample.append(tag, title, posters);
      const caption = document.createElement('span'); caption.className = 'theme-caption';
      const name = document.createElement('strong'); name.textContent = theme.name;
      const detail = document.createElement('span'); detail.textContent = theme.detail;
      const swatches = document.createElement('span'); swatches.className = 'theme-swatches'; swatches.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 4; i++) swatches.append(document.createElement('i'));
      caption.append(name, detail, swatches); button.append(sample, caption);
      button.addEventListener('click', () => {
        selected = theme.id; sync();
        try { localStorage.setItem(key, selected); status.textContent = `${theme.name} — enregistré sur cet appareil.`; }
        catch { status.textContent = `${theme.name} — actif pour cette visite. Le navigateur ne permet pas l’enregistrement.`; }
      });
      choices.append(button);
    }
    sync();
    opener.addEventListener('click', () => {
      const posters = [...document.querySelectorAll('.card__img')].slice(0, 3);
      choices.querySelectorAll('.theme-sample__posters').forEach(row => [...row.children].forEach((img, i) => { if (posters[i]?.src) img.src = posters[i].src; }));
      filterChoices('all');
      dialog.showModal(); opener.setAttribute('aria-expanded', 'true');
      const active = choices.querySelector('[aria-pressed="true"]');
      active.focus({ preventScroll: true });
      active.scrollIntoView({ block: 'nearest' });
    });
    document.getElementById('close-theme').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { opener.setAttribute('aria-expanded', 'false'); opener.focus({ preventScroll: true }); });
    // Ne pas laisser Échap fermer également une fiche ou les filtres derrière.
    dialog.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation(); });
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    window.addEventListener('storage', e => { if (e.key === key && themes.some(t => t.id === e.newValue)) { selected = e.newValue; sync(); } });
  });
})();
