// GALLERY APP
const GL=(function(){
  const SK='ws_gallery';
  let data,resizeBound=false,reflowTimer=null,openMediaId=null;

  function load(){try{return JSON.parse(localStorage.getItem(SK))||null}catch{return null}}
  function save(){localStorage.setItem(SK,JSON.stringify(data));}
  function ensure(){if(!data||!Array.isArray(data.items)){data={items:[]};save();}}
  function getItem(id){return data.items.find(x=>x.id===id);}
  function nameFromFile(n){return n.replace(/\.[^.]+$/,'').trim();}
  function mediaKind(item){
    if(item.kind==='video')return'video';
    if(item.kind==='image')return'image';
    if((item.mime||'').startsWith('video/'))return'video';
    if((item.src||'').startsWith('data:video/'))return'video';
    return'image';
  }
  function ratioOf(item){return(item.width&&item.height)?(item.width/item.height):1;}
  function legoClass(item){
    const r=ratioOf(item);
    if(r>=1.45)return'lego-wide';
    if(r<=0.78)return'lego-tall';
    return'';
  }

  function init(){
    data=load();ensure();
    if(!resizeBound){window.addEventListener('resize',scheduleReflow);resizeBound=true;}
    render();
  }

  function render(){
    const root=document.getElementById('page-gallery');
    const total=data.items.length;
    const favorites=data.items.filter(x=>x.favorite).length;
    const cards=data.items.slice().sort((a,b)=>(b.updated||b.created)-(a.updated||a.created)).map(item=>{
      const title=esc(item.title||'Untitled');
      const lego=legoClass(item);
      const kind=mediaKind(item);
      const media=kind==='video'
        ? `<video class="gl-card-video" src="${item.src}" muted playsinline preload="metadata" onloadedmetadata="GL.captureMeta('${item.id}',this.videoWidth,this.videoHeight);GL.reflow()"></video>`
        : `<img class="gl-card-img" src="${item.src}" alt="${title}" loading="lazy" onload="GL.captureMeta('${item.id}',this.naturalWidth,this.naturalHeight);GL.reflow()">`;
      return`<div class="gl-card ${lego}" onclick="GL.open('${item.id}')"><div class="gl-photo-frame">${media}</div></div>`;
    }).join('');

    root.innerHTML=`<div class="gl-wrap"><div class="gl-toolbar"><span style="font-size:11px;color:var(--g4)">Media <strong style="color:var(--g2)">${total}</strong></span><span style="font-size:11px;color:var(--g4);margin-left:16px">Favorites <strong style="color:var(--g2)">${favorites}</strong></span><label class="gl-upload">+ Add Media<input type="file" accept="image/*,video/*,.gif" multiple onchange="GL.handleFiles(event)"></label></div><div class="gl-list"><div class="gl-list-title">Gallery</div><div class="gl-grid">${cards||'<div class="gl-empty">Upload your first media file to start this gallery.</div>'}</div></div></div>`;
    requestAnimationFrame(reflow);
    setTimeout(reflow,120);
  }

  function scheduleReflow(){
    clearTimeout(reflowTimer);
    reflowTimer=setTimeout(reflow,40);
  }

  function reflow(){
    const grid=document.querySelector('#page-gallery .gl-grid');
    if(!grid)return;
    const row=parseFloat(getComputedStyle(grid).getPropertyValue('grid-auto-rows'))||1;
    const gap=parseFloat(getComputedStyle(grid).getPropertyValue('row-gap'))||0;
    grid.querySelectorAll('.gl-card').forEach(card=>{
      card.style.gridRowEnd='span 1';
      const h=card.getBoundingClientRect().height;
      const span=Math.max(16,Math.ceil((h+gap)/(row+gap)));
      card.style.gridRowEnd=`span ${span}`;
    });
  }

  function captureMeta(id,w,h){
    const item=getItem(id);if(!item||!w||!h)return;
    if(item.width===w&&item.height===h)return;
    item.width=w;item.height=h;save();
    scheduleReflow();
  }

  function addMediaItemFromSource(file,src,done){
    const base={id:uid(),title:nameFromFile(file.name)||'Untitled',caption:'',src,favorite:false,mime:file.type||'',kind:file.type.startsWith('video/')?'video':'image',created:Date.now(),updated:Date.now()};
    if(base.kind==='video'){
      const v=document.createElement('video');
      v.preload='metadata';
      v.onloadedmetadata=()=>{data.items.unshift({...base,width:v.videoWidth,height:v.videoHeight});done();};
      v.onerror=()=>{data.items.unshift(base);done();};
      v.src=src;
      return;
    }
    const img=new Image();
    img.onload=()=>{data.items.unshift({...base,width:img.naturalWidth,height:img.naturalHeight});done();};
    img.onerror=()=>{data.items.unshift(base);done();};
    img.src=src;
  }

  function handleFiles(ev){
    const files=[...(ev.target.files||[])].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
    if(!files.length)return;
    let pending=files.length;
    const done=()=>{pending--;if(pending===0){save();render();}};
    files.forEach(file=>{
      const r=new FileReader();
      r.onload=e=>{addMediaItemFromSource(file,e.target.result,done);};
      r.readAsDataURL(file);
    });
    ev.target.value='';
  }

  function open(id){
    const item=getItem(id);if(!item)return;
    openMediaId=id;
    const kind=mediaKind(item);
    const date=new Date(item.updated||item.created).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    const meta=document.getElementById('lb-meta');
    const img=document.getElementById('lb-img');
    const vid=document.getElementById('lb-video');
    if(meta){
      meta.innerHTML=`<div class="lb-meta-title">${esc(item.title||'Untitled')}</div><div class="lb-meta-sub">${date} | ${kind}</div><div class="lb-actions"><button class="lb-btn" onclick="GL.rename('${id}')">Rename</button><button class="lb-btn lb-btn-danger" onclick="GL.deleteFromViewer('${id}')">Delete</button></div>`;
    }
    if(kind==='video'){
      if(img){img.classList.add('hidden');img.removeAttribute('src');}
      if(vid){
        vid.classList.remove('hidden');
        vid.src=item.src;
        vid.currentTime=0;
        vid.play().catch(()=>{});
      }
    }else{
      if(vid){
        vid.pause();
        vid.removeAttribute('src');
        vid.classList.add('hidden');
        vid.load();
      }
      if(img){
        img.classList.remove('hidden');
        img.src=item.src;
      }
    }
    document.getElementById('lightbox').classList.remove('hidden');
  }

  function toggleFav(id){
    const item=getItem(id);if(!item)return;
    item.favorite=!item.favorite;item.updated=Date.now();save();render();
    if(openMediaId===id)open(id);
  }

  function rename(id){
    const item=getItem(id);if(!item)return;
    openModal('Rename Media',item.title||'',n=>{
      const v=n.trim();if(!v)return;
      item.title=v;item.updated=Date.now();save();render();
      if(openMediaId===id)open(id);
    });
  }

  function deleteItem(id){
    const item=getItem(id);if(!item)return;
    const label=mediaKind(item)==='video'?'video':'media';
    if(!confirm(`Delete this ${label}?`))return;
    data.items=data.items.filter(x=>x.id!==id);save();render();
    if(openMediaId===id){
      openMediaId=null;
      closeLightbox();
    }
  }

  function deleteFromViewer(id){deleteItem(id);}
  function clearOpenState(){openMediaId=null;}

  return{init,handleFiles,open,toggleFav,rename,deleteItem,deleteFromViewer,reflow,captureMeta,clearOpenState};
})();

window.GL = GL;

