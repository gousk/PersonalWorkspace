// NOTES APP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const NT=(function(){
  const SK='ws_notes';
  let data,curNote=null,searchTerm='';

  function load(){try{return JSON.parse(localStorage.getItem(SK))||null}catch{return null}}
  function save(){localStorage.setItem(SK,JSON.stringify(data));}

  function init(){
    data=load();
    if(!data||!data.notes)data={notes:[
      {id:uid(),title:'Welcome to Notes',body:'This is your personal space for quick thoughts, ideas, and anything on your mind.\n\nJust start typing.',updated:Date.now()},
      {id:uid(),title:'Shopping list',body:'Milk\nEggs\nBread\nCoffee',updated:Date.now()-86400000},
    ]};save();
    curNote=null;searchTerm='';render();
  }

  function render(){
    const root=document.getElementById('page-notes');
    let filtered=data.notes.filter(n=>{
      if(!searchTerm)return true;
      const s=searchTerm.toLowerCase();
      return n.title.toLowerCase().includes(s)||n.body.toLowerCase().includes(s);
    }).sort((a,b)=>b.updated-a.updated);

    let listHtml=filtered.map(n=>{
      const preview=n.body.split('\n')[0]||'';
      const date=new Date(n.updated).toLocaleDateString('en-US',{month:'short',day:'numeric'});
      return`<div class="nt-item${curNote===n.id?' active':''}" onclick="NT.select('${n.id}')"><div class="nt-item-title">${esc(n.title||'Untitled')}</div><div class="nt-item-preview">${esc(preview)}</div><div class="nt-item-date">${date}</div></div>`;
    }).join('');

    const note=curNote?data.notes.find(n=>n.id===curNote):null;
    let editorHtml='';
    if(note){
      editorHtml=`<div class="nt-editor"><div class="nt-editor-head"><input class="nt-editor-title" value="${esc(note.title)}" placeholder="Untitled" onchange="NT.saveTitle(this.value)" onkeydown="if(event.key==='Enter')this.blur();"><button class="nt-editor-del" onclick="NT.deleteNote()">Delete</button></div><div class="nt-editor-body"><textarea placeholder="Start writing..." onchange="NT.saveBody(this.value)" oninput="NT.saveBody(this.value)">${esc(note.body)}</textarea></div></div>`;
    }else{
      editorHtml=`<div class="nt-empty">Select a note or create a new one</div>`;
    }

    root.innerHTML=`<div class="nt-wrap"><div class="nt-sidebar"><div class="nt-sidebar-head"><span class="nt-sidebar-title">Notes</span><button class="nt-sidebar-add" onclick="NT.create()">+</button></div><div class="nt-search"><input placeholder="Search..." value="${esc(searchTerm)}" oninput="NT.search(this.value)"></div><div class="nt-list">${listHtml}</div></div>${editorHtml}</div>`;
  }

  function select(id){curNote=id;render();}
  function create(){const n={id:uid(),title:'',body:'',updated:Date.now()};data.notes.unshift(n);curNote=n.id;save();render();setTimeout(()=>{const el=document.querySelector('.nt-editor-title');if(el)el.focus();},50);}
  function saveTitle(val){const n=data.notes.find(x=>x.id===curNote);if(n){n.title=val;n.updated=Date.now();save();render();}}
  function saveBody(val){const n=data.notes.find(x=>x.id===curNote);if(n){n.body=val;n.updated=Date.now();save();/* Don't re-render list while typing to preserve focus â€” just save */}}
  function deleteNote(){if(!curNote)return;if(!confirm('Delete this note?'))return;data.notes=data.notes.filter(n=>n.id!==curNote);curNote=null;save();render();}
  function search(val){searchTerm=val;render();}

  return{init,select,create,saveTitle,saveBody,deleteNote,search};
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

window.NT = NT;

