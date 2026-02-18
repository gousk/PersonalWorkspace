// â•â•â•â•â•â•â• UTILS â•â•â•â•â•â•â•
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function esc(s){const e=document.createElement('span');e.textContent=s;return e.innerHTML;}
let modalCb=null;
function openModal(title,val,cb){
  modalCb=cb;document.getElementById('modal-title').textContent=title;
  const body=document.getElementById('modal-body');
  body.innerHTML=`<input class="modal-input" type="text" id="modal-input" placeholder="Name..." onkeydown="if(event.key==='Enter')modalConfirm();if(event.key==='Escape')closeModal()">`;
  document.getElementById('modal-input').value=val;
  document.getElementById('modal-save-btn').style.display='';
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('modal-input').focus(),50);
}
function closeModal(){document.getElementById('modal-overlay').classList.add('hidden');modalCb=null;window._cmRender=null;document.getElementById('modal-save-btn').style.display='';}
function modalConfirm(){const inp=document.getElementById('modal-input');if(modalCb&&inp)modalCb(inp.value);closeModal();}
function closeLightbox(){
  const lb=document.getElementById('lightbox');
  const img=document.getElementById('lb-img');
  const vid=document.getElementById('lb-video');
  const meta=document.getElementById('lb-meta');
  if(vid){
    vid.pause();
    vid.removeAttribute('src');
    vid.classList.add('hidden');
    vid.load();
  }
  if(img){
    img.removeAttribute('src');
    img.classList.remove('hidden');
  }
  if(meta)meta.innerHTML='';
  if(lb)lb.classList.add('hidden');
  if(window.GL&&typeof window.GL.clearOpenState==='function')window.GL.clearOpenState();
}
function updateClock(){document.getElementById('g-clock').textContent=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
updateClock();setInterval(updateClock,1000);
function getGreeting(){const h=new Date().getHours();if(h<6)return'Good night';if(h<12)return'Good morning';if(h<18)return'Good afternoon';return'Good evening';}

// â•â•â•â•â•â•â• ASCII BG â•â•â•â•â•â•â•
const cvs=document.getElementById('ascii-bg'),cx=cvs.getContext('2d');let mX=-1,mY=-1;const CW=12,CH=20;
function initCanvas(){cvs.width=window.innerWidth;cvs.height=window.innerHeight;}
function noise(x,y,t){return Math.sin(x*.08+t)*.4+Math.sin(y*.06-t*.7)*.3+Math.sin((x+y)*.05+t*.5)*.2+Math.sin(x*.12-y*.1+t*.3)*.15;}
function drawBg(time){
  cx.clearRect(0,0,cvs.width,cvs.height);cx.font='13px JetBrains Mono';cx.textBaseline='top';
  const t=time*.00025,cols=Math.ceil(cvs.width/CW),rows=Math.ceil(cvs.height/CH),mCol=Math.floor(mX/CW),mRow=Math.floor(mY/CH),levels=[-0.3,-0.1,0.1,0.3,0.5];
  for(let i=0;i<rows;i++){for(let j=0;j<cols;j++){
    const val=noise(j,i,t);let near=false,str=0;
    for(const lv of levels){const d=Math.abs(val-lv);if(d<.06){near=true;str=Math.max(str,1-d/.06);}}
    let mb=0;if(mX>=0){const dx=j-mCol,dy=i-mRow,d=Math.sqrt(dx*dx+dy*dy);if(d<14)mb=(1-d/14)*.5;}
    if(!near&&mb<.1)continue;let gray,ch;
    if(near){const dx2=noise(j+.5,i,t)-noise(j-.5,i,t),dy2=noise(j,i+.5,t)-noise(j,i-.5,t),angle=Math.atan2(dy2,dx2),a=((angle+Math.PI)/(Math.PI*2))*8;
      if(a<1||a>=7)ch='\u2500';else if(a<2)ch='\u2572';else if(a<3)ch='\u2502';else if(a<4)ch='\u2571';else if(a<5)ch='\u2500';else if(a<6)ch='\u2572';else ch='\u2502';
      if(str>.85&&Math.sin(i*17.3+j*31.7)>.6)ch=['\u253C','\u25CB','\u2218','\u00B7'][Math.floor(Math.abs(Math.sin(j*7+i*11))*4)];
      gray=14+Math.floor(str*24+mb*32);}else{ch='\u00B7';gray=Math.floor(mb*40);}
    gray=Math.min(gray,58);cx.fillStyle=`rgb(${gray},${gray},${gray})`;cx.fillText(ch,j*CW,i*CH);
  }}requestAnimationFrame(drawBg);}
window.addEventListener('resize',initCanvas);window.addEventListener('mousemove',e=>{mX=e.clientX;mY=e.clientY;});window.addEventListener('mouseleave',()=>{mX=-1;mY=-1;});
initCanvas();requestAnimationFrame(drawBg);

// â•â•â•â•â•â•â• NAVIGATION â•â•â•â•â•â•â•
let currentPage='home';
function navigateTo(page){
  currentPage=page;
  ['home','backlog','notes','blog','gallery'].forEach(p=>{
    const el=document.getElementById('page-'+p);
    if(p===page){el.classList.remove('hidden');el.style.display='flex';}
    else{el.classList.add('hidden');}
  });
  document.querySelectorAll('.g-nav-btn').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);});
  if(page==='home')renderHome();
  if(page==='backlog')BL.init();
  if(page==='notes')NT.init();
  if(page==='blog')BG.init();
  if(page==='gallery')GL.init();
}

// â•â•â•â•â•â•â• HOME â•â•â•â•â•â•â•
function renderHome(){
  const blData=JSON.parse(localStorage.getItem('ws_backlog')||'null');
  const ntData=JSON.parse(localStorage.getItem('ws_notes')||'null');
  const bgData=JSON.parse(localStorage.getItem('ws_blog')||'null');
  const glData=JSON.parse(localStorage.getItem('ws_gallery')||'null');
  const blCount=blData?blData.boards.reduce((s,b)=>s+b.tasks.length,0):0;
  const ntCount=ntData?ntData.notes.length:0;
  const bgCount=bgData?bgData.posts.length:0;
  const glCount=glData&&Array.isArray(glData.items)?glData.items.length:0;
  document.getElementById('page-home').innerHTML=`
    <div class="home-greeting">${getGreeting()}</div>
    <div class="home-sub">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>
    <div class="home-grid">
      <div class="home-tile" onclick="navigateTo('backlog')">
        <div class="home-tile-stat">${blCount} items</div>
        <div class="home-tile-name">Backlog</div>
        <div class="home-tile-desc">Track games, books, shows, tasks and everything in between with boards and columns.</div>
      </div>
      <div class="home-tile" onclick="navigateTo('notes')">
        <div class="home-tile-stat">${ntCount} notes</div>
        <div class="home-tile-name">Notes</div>
        <div class="home-tile-desc">Quick capture for thoughts, ideas, snippets and anything on your mind.</div>
      </div>
      <div class="home-tile" onclick="navigateTo('blog')">
        <div class="home-tile-stat">${bgCount} posts</div>
        <div class="home-tile-name">Blog</div>
        <div class="home-tile-desc">Write rich posts with headings, images, quotes and code blocks in a block-based editor.</div>
      </div>
      <div class="home-tile" onclick="navigateTo('gallery')">
        <div class="home-tile-stat">${glCount} images</div>
        <div class="home-tile-name">Gallery</div>
        <div class="home-tile-desc">Collect photos, star favorites, and open any image in fullscreen view.</div>
      </div>
    </div>`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

window.uid = uid;
window.esc = esc;
window.openModal = openModal;
window.closeModal = closeModal;
window.modalConfirm = modalConfirm;
window.closeLightbox = closeLightbox;
window.navigateTo = navigateTo;
window.renderHome = renderHome;

