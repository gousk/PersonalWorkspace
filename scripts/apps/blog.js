// BLOG APP â€” Block Editor
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const BG=(function(){
  const SK='ws_blog';
  const BTYPES=['text','h1','h2','h3','quote','callout','code','list','image','divider'];
  const BLABELS={text:'Text',h1:'H1',h2:'H2',h3:'H3',quote:'Quote',callout:'Callout',code:'Code',list:'List',image:'Image',divider:'Divider'};
  let data,curPost=null;

  function load(){try{return JSON.parse(localStorage.getItem(SK))||null}catch{return null}}
  function save(){localStorage.setItem(SK,JSON.stringify(data));}

  function init(){
    data=load();
    if(!data||!data.posts){
      data={posts:[
        {id:uid(),title:'Welcome to Blog',tags:'welcome, getting-started',blocks:[
          {id:uid(),type:'text',content:'This is your blog. Each post is made of blocks â€” text, headings, images, quotes, code, lists and dividers.'},
          {id:uid(),type:'h2',content:'How it works'},
          {id:uid(),type:'text',content:'Use the toolbar to insert blocks. Hover any block to see controls on the left â€” move up, move down, duplicate, or delete. The dropdown on the top-right of each block lets you convert between types.'},
          {id:uid(),type:'quote',content:'The best writing tools stay out of your way.'},
          {id:uid(),type:'callout',content:'Tip: Press Enter to create a new text block. Press Backspace on an empty block to remove it.'},
          {id:uid(),type:'divider',content:''},
          {id:uid(),type:'h3',content:'Block types'},
          {id:uid(),type:'list',content:'Text paragraphs\nHeadings (H1, H2, H3)\nBlockquotes\nCallout boxes\nCode blocks\nBullet lists\nImages with captions\nDividers'},
          {id:uid(),type:'text',content:'Try adding an image, changing a block type, or rearranging the order. Everything autosaves.'},
        ],status:'published',coverImg:'',created:Date.now()-86400000,updated:Date.now()},
        {id:uid(),title:'Draft: Ideas for the Year',tags:'personal',blocks:[
          {id:uid(),type:'text',content:'Things I want to explore this year:'},
          {id:uid(),type:'list',content:'Learn a new instrument\nRead more sci-fi\nBuild something creative\nTravel somewhere unexpected'},
        ],status:'draft',coverImg:'',created:Date.now(),updated:Date.now()},
      ]};save();
    }
    // Migrate old plain-body posts
    data.posts.forEach(p=>{
      if(!p.blocks){
        p.blocks=(p.body||'').split('\n\n').filter(Boolean).map(t=>({id:uid(),type:'text',content:t.replace(/\n/g,' ')}));
        if(!p.blocks.length)p.blocks=[{id:uid(),type:'text',content:''}];
        if(!p.coverImg)p.coverImg='';if(!p.tags)p.tags='';
        delete p.body;
      }
      if(p.tags===undefined)p.tags='';
    });save();
    curPost=null;renderList();
  }

  function getText(p){return p.blocks.filter(b=>b.type!=='divider'&&b.type!=='image').map(b=>b.content).join(' ');}
  function wordCount(p){return getText(p).split(/\s+/).filter(Boolean).length;}
  function excerpt(p){return getText(p).substring(0,180);}
  function firstImg(p){const i=p.blocks.find(b=>b.type==='image'&&b.content);return i?i.content:(p.coverImg||'');}
  function readTime(p){return Math.max(1,Math.round(wordCount(p)/200));}

  function renderList(){
    curPost=null;
    const root=document.getElementById('page-blog');
    const pub=data.posts.filter(p=>p.status==='published').length;
    const drf=data.posts.filter(p=>p.status==='draft').length;
    let h=data.posts.sort((a,b)=>b.updated-a.updated).map(p=>{
      const date=new Date(p.updated).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const w=wordCount(p);const sc=p.status==='published'?'bg-status-published':'bg-status-draft';
      const thumb=firstImg(p);const ti=thumb?`<img class="bg-post-card-thumb" src="${thumb}">`:'';
      return`<div class="bg-post-card" onclick="BG.edit('${p.id}')"><div class="bg-post-card-actions"><button class="be" onclick="event.stopPropagation();BG.renamePost('${p.id}')">rename</button><button class="bd" onclick="event.stopPropagation();BG.deletePost('${p.id}')">delete</button></div>${ti}<div class="bg-post-card-title">${esc(p.title||'Untitled')}</div><div class="bg-post-card-excerpt">${esc(excerpt(p))}</div><div class="bg-post-card-meta"><span class="bg-post-status ${sc}">${p.status}</span><span>${date}</span><span>${w} words</span><span>${readTime(p)} min read</span></div></div>`;
    }).join('');
    h+=`<button class="bg-new-post" onclick="BG.create()">+ New Post</button>`;
    root.innerHTML=`<div class="bg-wrap"><div class="bg-toolbar"><span style="font-size:11px;color:var(--g4)">Published <strong style="color:var(--g2)">${pub}</strong></span><span style="font-size:11px;color:var(--g4);margin-left:16px">Drafts <strong style="color:var(--g2)">${drf}</strong></span></div><div class="bg-list"><div class="bg-list-title">All Posts</div><div class="bg-grid">${h}</div></div></div>`;
  }

  function edit(id){curPost=id;renderEditor();}

  function renderEditor(){
    const p=data.posts.find(x=>x.id===curPost);if(!p)return renderList();
    const root=document.getElementById('page-blog');
    const bh=p.blocks.map((b,i)=>renderBlock(b,i,p.blocks.length)).join('');
    root.innerHTML=`<div class="bg-editor">
      <div class="bg-editor-head"><button class="nav-btn" onclick="BG.backToList()">&#8592; Posts</button><input class="bg-editor-title" value="${esc(p.title)}" placeholder="Post title..." onchange="BG.saveTitle(this.value)"></div>
      <div class="bg-editor-meta">
        <label>Status</label><select onchange="BG.saveStatus(this.value)"><option value="draft"${p.status==='draft'?' selected':''}>Draft</option><option value="published"${p.status==='published'?' selected':''}>Published</option></select>
        <label>Tags</label><input type="text" value="${esc(p.tags||'')}" placeholder="comma-separated..." onchange="BG.saveTags(this.value)" style="flex:1;max-width:200px;">
        <span style="margin-left:auto;font-family:var(--mono);font-size:10px">${new Date(p.created).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
      </div>
      <div class="bg-block-bar">
        <button class="bg-block-btn" onclick="BG.add('text')">Text</button>
        <button class="bg-block-btn" onclick="BG.add('h1')">H1</button>
        <button class="bg-block-btn" onclick="BG.add('h2')">H2</button>
        <button class="bg-block-btn" onclick="BG.add('h3')">H3</button>
        <div class="bg-block-sep"></div>
        <button class="bg-block-btn" onclick="BG.add('image')">Image</button>
        <button class="bg-block-btn" onclick="BG.add('quote')">Quote</button>
        <button class="bg-block-btn" onclick="BG.add('callout')">Callout</button>
        <button class="bg-block-btn" onclick="BG.add('code')">Code</button>
        <button class="bg-block-btn" onclick="BG.add('list')">List</button>
        <button class="bg-block-btn" onclick="BG.add('divider')">Divider</button>
      </div>
      <div class="bg-canvas"><div class="bg-canvas-center" id="bg-blocks">${bh}</div></div>
      <div class="bg-word-count"><span>${wordCount(p)} words</span><span>${p.blocks.length} blocks</span><span>${readTime(p)} min read</span></div>
    </div>`;
    document.querySelectorAll('#bg-blocks textarea').forEach(el=>{el.style.height='auto';el.style.height=el.scrollHeight+'px';});
  }

  function renderBlock(b,i,total){
    const id=b.id;
    // Left handle: move up, move down, duplicate, delete
    const canUp=i>0,canDn=i<total-1;
    const handle=`<div class="bg-block-handle">
      <button class="bg-block-hbtn" onclick="BG.move('${id}',-1)"${canUp?'':' disabled style="opacity:.12"'} title="Move up">&#9650;</button>
      <button class="bg-block-hbtn" onclick="BG.move('${id}',1)"${canDn?'':' disabled style="opacity:.12"'} title="Move down">&#9660;</button>
      <button class="bg-block-hbtn" onclick="BG.dup('${id}')" title="Duplicate">&#10697;</button>
      <button class="bg-block-hbtn bg-blk-del" onclick="BG.del('${id}')" title="Delete">&#215;</button>
    </div>`;
    // Type selector dropdown (top right)
    const canConvert=b.type!=='image'&&b.type!=='divider';
    const typeOpts=canConvert?BTYPES.filter(t=>t!=='image'&&t!=='divider').map(t=>`<option value="${t}"${t===b.type?' selected':''}>${BLABELS[t]}</option>`).join(''):'';
    const typeSel=canConvert?`<select class="bg-block-type-sel" onchange="BG.convert('${id}',this.value)" title="Change block type">${typeOpts}</select>`:'';

    if(b.type==='divider')return`<div class="bg-block bg-blk-divider" data-bid="${id}"><div class="bg-blk-divider-line"></div>${handle}</div>`;

    if(b.type==='image'){
      const fileInput=`<input type="file" id="bg-fi-${id}" accept="image/*" style="display:none" onchange="BG.handleImg('${id}',event)">`;
      if(b.content){
        return`<div class="bg-block bg-blk-image" data-bid="${id}"><img src="${b.content}"><div class="bg-blk-img-actions"><button onclick="BG.replaceImg('${id}')">Replace</button><button onclick="BG.removeImg('${id}')">Remove</button></div><input class="bg-blk-image-caption" value="${esc(b.caption||'')}" placeholder="Add a caption..." onchange="BG.saveCap('${id}',this.value)">${fileInput}${handle}</div>`;
      }
      return`<div class="bg-block bg-blk-image" data-bid="${id}"><div class="bg-blk-image-ph" onclick="BG.pickImg('${id}')"><span>+</span>Click to add image</div>${fileInput}${handle}</div>`;
    }

    const cls=({text:'bg-blk-text',h1:'bg-blk-text bg-blk-h1',h2:'bg-blk-text bg-blk-h2',h3:'bg-blk-text bg-blk-h3',quote:'bg-blk-quote',callout:'bg-blk-callout',code:'bg-blk-code',list:'bg-blk-list'})[b.type]||'bg-blk-text';
    const ph=({h1:'Heading 1',h2:'Heading 2',h3:'Heading 3',quote:'Write a quote...',callout:'Callout text...',code:'Paste or write code...',list:'List items (one per line)...'})[b.type]||'Start writing...';
    return`<div class="bg-block ${cls}" data-bid="${id}"><textarea placeholder="${ph}" oninput="BG.saveBlk('${id}',this.value);this.style.height='auto';this.style.height=this.scrollHeight+'px'" onkeydown="BG.onKey(event,'${id}')">${esc(b.content)}</textarea>${typeSel}${handle}</div>`;
  }

  function getPost(){return data.posts.find(x=>x.id===curPost);}
  function getBlk(bid){const p=getPost();return p?p.blocks.find(x=>x.id===bid):null;}
  function updWc(){const p=getPost();if(!p)return;const el=document.querySelector('.bg-word-count');if(el)el.innerHTML=`<span>${wordCount(p)} words</span><span>${p.blocks.length} blocks</span><span>${readTime(p)} min read</span>`;}

  function add(type,afterId){
    const p=getPost();if(!p)return;
    const nb={id:uid(),type,content:'',caption:''};
    if(afterId){const i=p.blocks.findIndex(b=>b.id===afterId);p.blocks.splice(i+1,0,nb);}
    else p.blocks.push(nb);
    p.updated=Date.now();save();renderEditor();
    if(type!=='divider'&&type!=='image')setTimeout(()=>{const el=document.querySelector(`[data-bid="${nb.id}"] textarea`);if(el)el.focus();},30);
  }

  function saveBlk(bid,val){const b=getBlk(bid);if(b){b.content=val;const p=getPost();p.updated=Date.now();save();updWc();}}
  function saveCap(bid,val){const b=getBlk(bid);if(b){b.caption=val;getPost().updated=Date.now();save();}}
  function saveTitle(v){const p=getPost();if(p){p.title=v;p.updated=Date.now();save();}}
  function saveStatus(v){const p=getPost();if(p){p.status=v;p.updated=Date.now();save();}}
  function saveTags(v){const p=getPost();if(p){p.tags=v;p.updated=Date.now();save();}}

  function del(bid){
    const p=getPost();if(!p||p.blocks.length<=1)return;
    const i=p.blocks.findIndex(b=>b.id===bid);
    p.blocks.splice(i,1);p.updated=Date.now();save();renderEditor();
    // Focus nearest block
    const fi=Math.min(i,p.blocks.length-1);
    setTimeout(()=>{const el=document.querySelector(`[data-bid="${p.blocks[fi].id}"] textarea`);if(el){el.focus();el.selectionStart=el.value.length;}},30);
  }

  function move(bid,dir){
    const p=getPost();if(!p)return;
    const i=p.blocks.findIndex(b=>b.id===bid);const n=i+dir;
    if(n<0||n>=p.blocks.length)return;
    [p.blocks[i],p.blocks[n]]=[p.blocks[n],p.blocks[i]];
    p.updated=Date.now();save();renderEditor();
    setTimeout(()=>{const el=document.querySelector(`[data-bid="${bid}"] textarea`);if(el)el.focus();},30);
  }

  function dup(bid){
    const p=getPost();if(!p)return;
    const i=p.blocks.findIndex(b=>b.id===bid);const ob=p.blocks[i];
    const nb={...JSON.parse(JSON.stringify(ob)),id:uid()};
    p.blocks.splice(i+1,0,nb);p.updated=Date.now();save();renderEditor();
    setTimeout(()=>{const el=document.querySelector(`[data-bid="${nb.id}"] textarea`);if(el)el.focus();},30);
  }

  function convert(bid,newType){
    const b=getBlk(bid);if(!b)return;b.type=newType;
    getPost().updated=Date.now();save();renderEditor();
    setTimeout(()=>{const el=document.querySelector(`[data-bid="${bid}"] textarea`);if(el){el.focus();el.selectionStart=el.value.length;}},30);
  }

  function onKey(e,bid){
    if(e.key==='Enter'&&!e.shiftKey){
      const b=getBlk(bid);
      if(b&&b.type!=='code'&&b.type!=='list'){e.preventDefault();add('text',bid);}
    }
    if(e.key==='Backspace'&&e.target.value===''&&e.target.selectionStart===0){
      const p=getPost();if(!p||p.blocks.length<=1)return;
      e.preventDefault();del(bid);
    }
  }

  function pickImg(bid){document.getElementById(`bg-fi-${bid}`).click();}
  function replaceImg(bid){document.getElementById(`bg-fi-${bid}`).click();}
  function removeImg(bid){const b=getBlk(bid);if(b){b.content='';b.caption='';getPost().updated=Date.now();save();renderEditor();}}
  function handleImg(bid,ev){
    const f=ev.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=e=>{const b=getBlk(bid);if(b){b.content=e.target.result;getPost().updated=Date.now();save();renderEditor();}};r.readAsDataURL(f);
  }

  function backToList(){renderList();}
  function create(){const p={id:uid(),title:'',tags:'',blocks:[{id:uid(),type:'text',content:''}],status:'draft',coverImg:'',created:Date.now(),updated:Date.now()};data.posts.unshift(p);save();edit(p.id);}
  function renamePost(id){const p=data.posts.find(x=>x.id===id);openModal('Rename Post',p.title,n=>{if(!n.trim())return;p.title=n.trim();p.updated=Date.now();save();renderList();});}
  function deletePost(id){if(!confirm('Delete this post?'))return;data.posts=data.posts.filter(p=>p.id!==id);save();renderList();}

  return{init,edit,backToList,create,saveTitle,saveBlk,saveCap,saveStatus,saveTags,renamePost,deletePost,add,del,move,dup,convert,onKey,pickImg,replaceImg,removeImg,handleImg};
})();

window.BG = BG;

