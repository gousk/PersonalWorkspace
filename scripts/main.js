document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openGlobalSearch();
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

navigateTo('home');
