// â•â•â•â•â•â•â• KEYBOARD â•â•â•â•â•â•â•
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(!document.getElementById('lightbox').classList.contains('hidden')){closeLightbox();return;}
    if(!document.getElementById('bl-panel').classList.contains('hidden')){BL.closePanel();return;}
    if(!document.getElementById('modal-overlay').classList.contains('hidden')){closeModal();return;}
  }
});

// â•â•â•â•â•â•â• INIT â•â•â•â•â•â•â•
navigateTo('home');

