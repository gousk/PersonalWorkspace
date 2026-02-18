const MAIN_NAV_PAGES = ['home', 'backlog', 'notes', 'blog', 'gallery', 'calendar', 'health'];

function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openGlobalSearch();
    return;
  }

  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.altKey && /^[1-7]$/.test(e.key) && !isTypingTarget(document.activeElement)) {
    e.preventDefault();
    const idx = Number(e.key) - 1;
    const page = MAIN_NAV_PAGES[idx];
    if (page) navigateTo(page);
    return;
  }

  if (e.key === 'Escape') {
    if (!document.getElementById('gs-overlay').classList.contains('hidden')) {
      closeGlobalSearch();
      return;
    }
    if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
      closeModal();
      return;
    }
    if (!document.getElementById('lightbox').classList.contains('hidden')) {
      closeLightbox();
      return;
    }
    if (!document.getElementById('bl-panel').classList.contains('hidden')) {
      BL.closePanel();
      return;
    }
  }
});

let lastPage = null;
try {
  lastPage = localStorage.getItem('ws_last_page');
} catch {
  lastPage = null;
}
navigateTo(MAIN_NAV_PAGES.includes(lastPage) ? lastPage : 'home');