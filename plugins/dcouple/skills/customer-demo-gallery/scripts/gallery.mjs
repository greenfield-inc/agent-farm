// Embedded alongside the player into the standalone gallery.
export function enhanceGallery(root = document) {
  const tabs = [...root.querySelectorAll('[data-view]')];
  const pauseInside = element => element.querySelectorAll('video').forEach(video => video.pause());
  const selectTab = selected => {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = root.querySelector(`#${tab.dataset.view}`);
      panel.hidden = !active;
      if (!active) pauseInside(panel);
    }
  };
  const tablist = root.querySelector('[role=tablist]');
  if (tablist && tabs.length) {
    tablist.hidden = false;
    selectTab(tabs[0]);
    tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab)));
    tablist.addEventListener('keydown', event => {
      const index = tabs.indexOf(event.target);
      if (index < 0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[next]);
      tabs[next].focus();
    });
  }
  const filters = [...root.querySelectorAll('[data-filter]')];
  if (filters.length) root.querySelector('.filters').hidden = false;
  for (const button of filters) button.addEventListener('click', () => {
    filters.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    root.querySelectorAll('#library .card').forEach(card => {
      card.hidden = button.dataset.filter !== '' && !JSON.parse(card.dataset.tags).includes(button.dataset.filter);
      if (card.hidden) pauseInside(card);
    });
  });
  root.querySelectorAll('.requirement').forEach(details => details.addEventListener('toggle', () => {
    if (!details.open) pauseInside(details);
  }));
  const videos = [...root.querySelectorAll('video')];
  videos.forEach(video => video.addEventListener('play', () => {
    videos.forEach(other => { if (other !== video) other.pause(); });
  }));
}
