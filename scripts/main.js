const MAIN_NAV_PAGES = ['home', 'backlog', 'notes', 'blog', 'gallery', 'moodboard', 'calendar', 'health'];
let blackoutClosing = false;

function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

function enterBlackoutMode() {
  const btn = document.getElementById('blackout-fab');
  const overlay = document.getElementById('blackout-overlay');
  if (!overlay) return;
  const r = btn ? btn.getBoundingClientRect() : { left: window.innerWidth - 28, top: window.innerHeight - 28, width: 1, height: 1 };
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  overlay.style.setProperty('--blackout-x', x + 'px');
  overlay.style.setProperty('--blackout-y', y + 'px');
  overlay.classList.remove('closing');
  overlay.classList.add('active');
  document.body.classList.add('blackout-mode');
  const root = document.documentElement;
  if (root.requestFullscreen && !document.fullscreenElement) {
    root.requestFullscreen().catch(() => {});
  }
}

function exitBlackoutMode() {
  if (blackoutClosing) return;
  blackoutClosing = true;
  const btn = document.getElementById('blackout-fab');
  const overlay = document.getElementById('blackout-overlay');
  const r = btn ? btn.getBoundingClientRect() : { left: window.innerWidth - 28, top: window.innerHeight - 28, width: 1, height: 1 };
  if (overlay) {
    overlay.style.setProperty('--blackout-x', (r.left + r.width / 2) + 'px');
    overlay.style.setProperty('--blackout-y', (r.top + r.height / 2) + 'px');
    overlay.classList.add('closing');
    overlay.classList.remove('active');
    window.setTimeout(() => overlay.classList.remove('closing'), 520);
  }
  window.setTimeout(() => {
    document.body.classList.remove('blackout-mode');
    blackoutClosing = false;
  }, 480);
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('blackout-mode')) exitBlackoutMode();
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openGlobalSearch();
    return;
  }

  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.altKey && /^[1-8]$/.test(e.key) && !isTypingTarget(document.activeElement)) {
    e.preventDefault();
    const idx = Number(e.key) - 1;
    const page = MAIN_NAV_PAGES[idx];
    if (page) navigateTo(page);
    return;
  }

  if (e.key === 'Escape') {
    if (document.body.classList.contains('blackout-mode')) {
      e.preventDefault();
      exitBlackoutMode();
      return;
    }
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
