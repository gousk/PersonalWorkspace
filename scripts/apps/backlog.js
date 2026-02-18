// BACKLOG APP (full port from v7)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const BL=(function(){
  const SK='ws_backlog';
  const DEFAULT_TAGS=['game','book','film','show','music','anime','podcast','task','idea','recipe','travel','learn','buy','errand','habit','project','feature','bug','chore','design'];
  const DEFAULT_COLS=[{id:'col_backlog',name:'Backlog'},{id:'col_inprogress',name:'In Progress'},{id:'col_done',name:'Done',isDone:true}];
  let data,curBoard=null,curTask=null,archiveOpen=false,draggedId=null;

  function load(){try{return JSON.parse(localStorage.getItem(SK))||null}catch{return null}}
  function save(){localStorage.setItem(SK,JSON.stringify(data));}
  function getTagOpts(sel){let t=[...DEFAULT_TAGS];if(sel&&!t.includes(sel))t.unshift(sel);if(data)data.boards.forEach(b=>{(b.tasks||[]).concat(b.archive||[]).forEach(x=>{if(x.tag&&!t.includes(x.tag))t.push(x.tag);});});return t;}
  function buildTagSel(el,sel){const t=getTagOpts(sel);el.innerHTML=t.map(x=>`<option value="${x}"${x===sel?' selected':''}>${x}</option>`).join('')+`<option value="__custom__">+ custom...</option>`;}
  function getTask(id){for(const b of data.boards){const t=b.tasks.find(x=>x.id===id);if(t)return t;}return null;}

  // Migrate old data
  function migrate(){
    if(data)return;
    for(const k of['backlog_v7','backlog_v6','backlog_v5']){
      try{const old=JSON.parse(localStorage.getItem(k));if(old&&old.boards){
        old.boards.forEach(b=>{if(!b.columns)b.columns=JSON.parse(JSON.stringify(DEFAULT_COLS));if(!b.archive)b.archive=[];
          b.tasks.forEach(t=>{if(!t.columnId){if(t.status==='todo')t.columnId='col_backlog';else if(t.status==='progress')t.columnId='col_inprogress';else if(t.status==='done')t.columnId='col_done';else t.columnId='col_backlog';}});
        });data=old;save();return;
      }}catch(e){}
    }
  }

  function seedData(){
    data={boards:[
      {id:uid(),name:'My Backlog',columns:JSON.parse(JSON.stringify(DEFAULT_COLS)),archive:[],tasks:[
        {id:uid(),title:'The Witcher 3',tag:'game',columnId:'col_backlog',notes:'Complete the Blood and Wine DLC.',checklist:[{id:uid(),text:'Main storyline',done:true},{id:uid(),text:'Blood and Wine DLC',done:false}],attachments:[]},
        {id:uid(),title:'Dune by Frank Herbert',tag:'book',columnId:'col_backlog',notes:'Recommended by a friend.',checklist:[],attachments:[]},
        {id:uid(),title:'Severance Season 2',tag:'show',columnId:'col_inprogress',notes:'',checklist:[],attachments:[]},
        {id:uid(),title:'Blade Runner 2049',tag:'film',columnId:'col_backlog',notes:'Watch the original first.',checklist:[],attachments:[]},
        {id:uid(),title:'Learn guitar basics',tag:'learn',columnId:'col_inprogress',notes:'',checklist:[{id:uid(),text:'Find a good tutorial',done:false},{id:uid(),text:'Practice chords 15min/day',done:false}],attachments:[]},
        {id:uid(),title:'Dark Souls III',tag:'game',columnId:'col_done',notes:'Finally beat it.',checklist:[],attachments:[]},
        {id:uid(),title:'1984 by George Orwell',tag:'book',columnId:'col_done',notes:'',checklist:[],attachments:[]},
      ]},
      {id:uid(),name:'Watchlist',columns:JSON.parse(JSON.stringify(DEFAULT_COLS)),archive:[],tasks:[
        {id:uid(),title:'Spirited Away',tag:'anime',columnId:'col_backlog',notes:'Studio Ghibli classic.',checklist:[],attachments:[]},
        {id:uid(),title:'True Detective S1',tag:'show',columnId:'col_backlog',notes:'',checklist:[],attachments:[]},
        {id:uid(),title:'Oppenheimer',tag:'film',columnId:'col_done',notes:'',checklist:[],attachments:[]},
      ]}
    ]};save();
  }

  function init(){
    data=load();migrate();
    if(!data||!data.boards)seedData();
    data.boards.forEach(b=>{if(!b.columns)b.columns=JSON.parse(JSON.stringify(DEFAULT_COLS));if(!b.archive)b.archive=[];
      b.tasks.forEach(t=>{if(!t.notes)t.notes='';if(!t.checklist)t.checklist=[];if(!t.attachments)t.attachments=[];
        if(!t.columnId){if(t.status==='todo')t.columnId='col_backlog';else if(t.status==='progress')t.columnId='col_inprogress';else if(t.status==='done')t.columnId='col_done';else t.columnId=b.columns[0]?.id||'col_backlog';}
      });});save();
    curBoard=null;archiveOpen=false;renderHub();
  }

  function renderHub(){
    curBoard=null;archiveOpen=false;
    const root=document.getElementById('page-backlog');
    let h=`<div class="bl-hub-bar"><span>Boards <strong>${data.boards.length}</strong></span><span>Items <strong>${data.boards.reduce((s,b)=>s+b.tasks.length,0)}</strong></span></div><div class="bl-hub" style="flex:1;overflow-y:auto;padding:32px;"><div class="bl-hub-title">All Boards</div><div class="bl-hub-grid">`;
    data.boards.forEach(b=>{
      const t=b.tasks.length,dc=b.columns.find(c=>c.isDone),d=dc?b.tasks.filter(x=>x.columnId===dc.id).length:0,p=t?Math.round(d/t*100):0;
      const cs=b.columns.slice(0,3).map(col=>`<span><span class="hi">${b.tasks.filter(x=>x.columnId===col.id).length}</span> ${esc(col.name)}</span>`).join('');
      h+=`<div class="bl-board-card" onclick="BL.goBoard('${b.id}')"><div class="bl-board-card-actions"><button class="be" onclick="event.stopPropagation();BL.renameBoard('${b.id}')">rename</button><button class="bd" onclick="event.stopPropagation();BL.deleteBoard('${b.id}')">delete</button></div><div class="bl-board-card-name">${esc(b.name)}</div><div class="bl-board-card-stats">${cs}<span>${p}%</span></div><div class="bl-board-card-bar"><div class="bl-board-card-bar-fill" style="width:${p}%"></div></div></div>`;
    });
    h+=`<button class="bl-new-board" onclick="BL.createBoard()">+ New Board</button></div></div>`;
    root.innerHTML=h;
  }

  function goBoard(id){
    curBoard=id;archiveOpen=false;renderBoard();
  }

  function renderBoard(){
    const board=data.boards.find(b=>b.id===curBoard);if(!board)return renderHub();
    const root=document.getElementById('page-backlog');
    const dh=`<svg viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/></svg>`;
    const total=board.tasks.length,dc=board.columns.find(c=>c.isDone),done=dc?board.tasks.filter(t=>t.columnId===dc.id).length:0,pct=total?Math.round(done/total*100):0;
    let sh=`<span>Total <strong>${total}</strong></span>`;
    board.columns.forEach(c=>{sh+=`<span>${esc(c.name)} <strong>${board.tasks.filter(t=>t.columnId===c.id).length}</strong></span>`;});

    let colsHtml='';
    board.columns.forEach(col=>{
      const items=board.tasks.filter(t=>t.columnId===col.id);
      let cards=items.map(t=>{
        const hasN=t.notes&&t.notes.trim(),cT=t.checklist.length,cD=t.checklist.filter(x=>x.done).length,hasA=t.attachments.length>0;
        let ind='';if(hasN)ind+=`<span class="bl-card-dot" title="Has notes"></span>`;if(cT>0)ind+=`<span title="Checklist">${cD}/${cT}</span>`;if(hasA)ind+=`<span title="Attachments">${t.attachments.length}f</span>`;
        const tc=DEFAULT_TAGS.includes(t.tag)?`tag-${t.tag}`:'tag-default';
        return`<div class="bl-card" data-id="${t.id}"><div class="bl-card-handle" title="Drag to move">${dh}</div><div class="bl-card-body"><div class="bl-card-top"><div class="bl-card-title" onclick="event.stopPropagation();BL.openPanel('${t.id}')">${esc(t.title)}</div>${ind?`<div class="bl-card-ind">${ind}</div>`:''}</div><div class="bl-card-meta"><span class="bl-card-tag ${tc}">${esc(t.tag)}</span><button class="bl-card-del" onclick="event.stopPropagation();BL.deleteTask('${t.id}')">&#215;</button></div></div></div>`;
      }).join('');
      colsHtml+=`<div class="bl-col${col.isDone?' bl-done-col':''}" data-colid="${col.id}"><div class="bl-col-head"><span class="bl-col-title" onclick="BL.renameCol('${col.id}')" title="Click to rename">${esc(col.name)}</span><span class="bl-col-count">${items.length}</span></div><div class="bl-col-body"><button class="bl-add-btn" onclick="BL.showAddForm('${col.id}')">+ Add</button><div id="bl-form-${col.id}"></div><div class="bl-cards" data-colid="${col.id}">${cards}</div></div></div>`;
    });

    root.innerHTML=`
      <div class="bl-board-nav"><button class="nav-btn" onclick="BL.goHub()">&#8592; Boards</button><span class="bl-sep">|</span><span class="bl-bnd">${esc(board.name)}</span><div class="bl-nav-right"><button class="nav-btn" onclick="BL.toggleArchive()">Archive <span class="bl-archive-badge" id="bl-arc-count">${board.archive.length}</span></button><button class="nav-btn" onclick="BL.openColMgr()">Columns</button></div></div>
      <div class="bl-stats-bar">${sh}</div>
      <div class="bl-prog-wrap"><span>${pct}%</span><div class="bl-prog-track"><div class="bl-prog-fill" style="width:${pct}%"></div></div></div>
      <div class="bl-columns" id="bl-columns">${colsHtml}</div>
      <div class="bl-archive-drawer${archiveOpen?' open':''}" id="bl-archive-drawer"><div class="bl-archive-head"><span>Archived Items</span><button class="nav-btn" onclick="BL.toggleArchive()" style="font-size:10px;padding:3px 10px;">Close</button></div><div class="bl-archive-list" id="bl-archive-list"></div></div>`;

    // Wire up drag
    root.querySelectorAll('.bl-card').forEach(card=>{
      const handle=card.querySelector('.bl-card-handle');
      card.setAttribute('draggable','false');
      handle.addEventListener('mousedown',()=>card.setAttribute('draggable','true'));
      handle.addEventListener('mouseup',()=>card.setAttribute('draggable','false'));
      card.addEventListener('dragstart',e=>{draggedId=card.dataset.id;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
      card.addEventListener('dragend',e=>{card.classList.remove('dragging');card.setAttribute('draggable','false');draggedId=null;root.querySelectorAll('.bl-col').forEach(c=>c.classList.remove('drag-over'));});
    });
    root.querySelectorAll('.bl-col').forEach(col=>{
      col.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('drag-over');});
      col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('drag-over');});
      col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');if(!draggedId)return;const task=board.tasks.find(t=>t.id===draggedId);if(task){task.columnId=col.dataset.colid;save();renderBoard();}});
    });
    if(archiveOpen)renderArchive();
  }

  function goHub(){renderHub();}
  function createBoard(){openModal('New Board','',n=>{if(!n.trim())return;data.boards.push({id:uid(),name:n.trim(),columns:JSON.parse(JSON.stringify(DEFAULT_COLS)),archive:[],tasks:[]});save();renderHub();});}
  function renameBoard(id){const b=data.boards.find(x=>x.id===id);openModal('Rename Board',b.name,n=>{if(!n.trim())return;b.name=n.trim();save();renderHub();});}
  function deleteBoard(id){if(confirm('Delete this board and all tasks?')){data.boards=data.boards.filter(b=>b.id!==id);save();renderHub();}}
  function deleteTask(id){const b=data.boards.find(x=>x.id===curBoard);b.tasks=b.tasks.filter(t=>t.id!==id);save();renderBoard();}

  function showAddForm(colId){
    document.querySelectorAll('.bl-add-form').forEach(f=>f.remove());
    const fc=document.getElementById(`bl-form-${colId}`);if(!fc)return;
    const tags=getTagOpts();let to=tags.map(t=>`<option value="${t}">${t}</option>`).join('')+`<option value="__custom__">+ custom...</option>`;
    fc.innerHTML=`<div class="bl-add-form"><div class="bl-form-label">New item</div><input class="ti" type="text" id="bl-input-${colId}" placeholder="What to add..." autofocus onkeydown="if(event.key==='Enter')BL.addTask('${colId}');if(event.key==='Escape')BL.closeForm('${colId}')"><div class="bl-form-actions"><div class="bl-tag-wrap"><select id="bl-tag-${colId}" onchange="BL.tagChange('${colId}')">${to}</select><input class="bl-custom-tag" id="bl-ctag-${colId}" placeholder="tag name..."></div><button class="fb btn-s" onclick="BL.addTask('${colId}')">Save</button><button class="fb btn-c" onclick="BL.closeForm('${colId}')">Cancel</button></div></div>`;
    document.getElementById(`bl-input-${colId}`).focus();
  }
  function tagChange(colId){const s=document.getElementById(`bl-tag-${colId}`),c=document.getElementById(`bl-ctag-${colId}`);if(s.value==='__custom__'){c.style.display='block';c.focus();}else c.style.display='none';}
  function closeForm(colId){const el=document.getElementById(`bl-form-${colId}`);if(el)el.innerHTML='';}
  function addTask(colId){
    const inp=document.getElementById(`bl-input-${colId}`),ts=document.getElementById(`bl-tag-${colId}`),ci=document.getElementById(`bl-ctag-${colId}`);
    let tag=ts.value;if(tag==='__custom__'){tag=ci.value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');if(!tag)tag='task';}
    const title=inp.value.trim();if(!title)return;
    data.boards.find(x=>x.id===curBoard).tasks.push({id:uid(),title,tag,columnId:colId,notes:'',checklist:[],attachments:[]});
    closeForm(colId);save();renderBoard();
  }

  // Panel
  function openPanel(taskId){
    curTask=taskId;const t=getTask(taskId);if(!t)return;
    const board=data.boards.find(b=>b.tasks.some(x=>x.id===taskId));
    const statusBtns=board?board.columns.map(c=>`<button class="bl-panel-sbtn ${t.columnId===c.id?'active':''}" onclick="BL.setPanelStatus('${c.id}')">${esc(c.name)}</button>`).join(''):'';
    document.getElementById('bl-panel').innerHTML=`
      <div class="bl-panel-header"><div class="bl-panel-title-wrap">
        <input class="bl-panel-title" id="bl-p-title" value="${esc(t.title)}" onchange="BL.savePTitle()">
        <div class="bl-panel-tag-row"><label>Tag</label><select class="bl-panel-tag-sel" id="bl-p-tag" onchange="BL.pTagChange()"></select><input class="bl-panel-custom" id="bl-p-ctag" placeholder="custom..." onchange="BL.savePCustomTag()" onkeydown="if(event.key==='Enter'){BL.savePCustomTag();this.blur();}"></div>
        <div class="bl-panel-status">${statusBtns}</div>
      </div><button class="bl-panel-close" onclick="BL.closePanel()">&#215;</button></div>
      <div class="bl-panel-body">
        <div><div class="section-title">Notes</div><textarea class="bl-notes-area" id="bl-p-notes" placeholder="Add notes, links, context..." onchange="BL.savePNotes()">${esc(t.notes||'')}</textarea></div>
        <div><div class="section-title">Checklist</div><div class="bl-checklist" id="bl-p-checklist"></div><button class="bl-add-check" onclick="BL.addCheckItem()">+ Add item</button></div>
        <div><div class="section-title">Attachments</div><div class="bl-att" id="bl-p-att"></div><input type="file" id="bl-file-input" multiple accept="image/*,.pdf,.txt,.md,.doc,.docx,.zip" style="display:none" onchange="BL.handleFiles(event)"></div>
        <button class="bl-panel-archive" onclick="BL.archiveCurrent()">Archive this item</button>
      </div>`;
    buildTagSel(document.getElementById('bl-p-tag'),t.tag);
    renderChecklist();renderAttachments();
    document.getElementById('bl-panel-overlay').classList.remove('hidden');
    document.getElementById('bl-panel').classList.remove('hidden');
  }
  function closePanel(){document.getElementById('bl-panel-overlay').classList.add('hidden');document.getElementById('bl-panel').classList.add('hidden');curTask=null;renderBoard();}
  function savePTitle(){const t=getTask(curTask);if(t){t.title=document.getElementById('bl-p-title').value;save();}}
  function pTagChange(){const sel=document.getElementById('bl-p-tag'),ci=document.getElementById('bl-p-ctag');if(sel.value==='__custom__'){ci.style.display='inline-block';ci.value='';ci.focus();}else{ci.style.display='none';const t=getTask(curTask);if(t){t.tag=sel.value;save();}}}
  function savePCustomTag(){const t=getTask(curTask);if(!t)return;const v=document.getElementById('bl-p-ctag').value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');if(!v)return;t.tag=v;save();buildTagSel(document.getElementById('bl-p-tag'),v);document.getElementById('bl-p-ctag').style.display='none';}
  function savePNotes(){const t=getTask(curTask);if(t){t.notes=document.getElementById('bl-p-notes').value;save();}}
  function setPanelStatus(colId){const t=getTask(curTask);if(t){t.columnId=colId;save();openPanel(curTask);}}

  function renderChecklist(){const t=getTask(curTask),el=document.getElementById('bl-p-checklist');if(!t||!el){if(el)el.innerHTML='';return;}
    el.innerHTML=t.checklist.map(c=>`<div class="bl-check-item"><button class="bl-check-box ${c.done?'checked':''}" onclick="BL.toggleCheck('${c.id}')">${c.done?'\u2713':''}</button><input class="bl-check-text ${c.done?'done':''}" value="${esc(c.text)}" onchange="BL.updateCheckText('${c.id}',this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();BL.addCheckItem();}"><button class="bl-check-del" onclick="BL.deleteCheck('${c.id}')">&#215;</button></div>`).join('');}
  function addCheckItem(){const t=getTask(curTask);if(!t)return;t.checklist.push({id:uid(),text:'',done:false});save();renderChecklist();const items=document.querySelectorAll('#bl-p-checklist .bl-check-text');if(items.length)items[items.length-1].focus();}
  function toggleCheck(cid){const t=getTask(curTask),c=t.checklist.find(x=>x.id===cid);if(c){c.done=!c.done;save();renderChecklist();}}
  function updateCheckText(cid,val){const t=getTask(curTask),c=t.checklist.find(x=>x.id===cid);if(c){c.text=val;save();}}
  function deleteCheck(cid){const t=getTask(curTask);t.checklist=t.checklist.filter(x=>x.id!==cid);save();renderChecklist();}

  function renderAttachments(){const t=getTask(curTask),el=document.getElementById('bl-p-att');if(!t||!el){if(el)el.innerHTML='';return;}let h='';
    t.attachments.forEach(a=>{if(a.type==='image'){h+=`<div class="bl-att-item"><img class="bl-att-img" src="${a.data}" onclick="document.getElementById('lb-img').src='${a.data}';document.getElementById('lightbox').classList.remove('hidden')"><button class="bl-att-del" onclick="BL.delAtt('${a.id}')">&#215;</button></div>`;}else{h+=`<div class="bl-att-item"><div class="bl-att-file" onclick="BL.downloadAtt('${a.id}')">${esc(a.name)}</div><button class="bl-att-del" onclick="BL.delAtt('${a.id}')">&#215;</button></div>`;}});
    h+=`<button class="bl-att-add" onclick="document.getElementById('bl-file-input').click()"><span>+</span>Add file</button>`;el.innerHTML=h;}
  function handleFiles(event){const t=getTask(curTask);if(!t)return;Array.from(event.target.files).forEach(file=>{const reader=new FileReader();reader.onload=e=>{t.attachments.push({id:uid(),name:file.name,type:file.type.startsWith('image/')?'image':'file',data:e.target.result,mime:file.type});save();renderAttachments();};reader.readAsDataURL(file);});event.target.value='';}
  function delAtt(aid){const t=getTask(curTask);t.attachments=t.attachments.filter(a=>a.id!==aid);save();renderAttachments();}
  function downloadAtt(aid){const t=getTask(curTask),a=t.attachments.find(x=>x.id===aid);if(!a)return;const l=document.createElement('a');l.href=a.data;l.download=a.name;l.click();}

  // Archive
  function toggleArchive(){archiveOpen=!archiveOpen;const d=document.getElementById('bl-archive-drawer');if(d){if(archiveOpen){d.classList.add('open');renderArchive();}else d.classList.remove('open');}}
  function renderArchive(){const board=data.boards.find(b=>b.id===curBoard);if(!board)return;const el=document.getElementById('bl-archive-list');if(!el)return;
    if(!board.archive.length){el.innerHTML='<div class="bl-archive-empty">No archived items</div>';return;}
    el.innerHTML=board.archive.map(t=>{const tc=DEFAULT_TAGS.includes(t.tag)?`tag-${t.tag}`:'tag-default';
      return`<div class="bl-archive-row"><span class="bl-archive-row-title">${esc(t.title)}</span><span class="bl-archive-row-tag ${tc}">${esc(t.tag)}</span><div class="bl-archive-row-actions"><button class="a-restore" onclick="BL.restoreArchive('${t.id}')">restore</button><button class="a-del" onclick="BL.delArchive('${t.id}')">delete</button></div></div>`;}).join('');}
  function archiveCurrent(){if(!curTask)return;const board=data.boards.find(b=>b.id===curBoard);if(!board)return;const idx=board.tasks.findIndex(t=>t.id===curTask);if(idx===-1)return;board.archive.push(board.tasks.splice(idx,1)[0]);save();closePanel();}
  function restoreArchive(id){const board=data.boards.find(b=>b.id===curBoard);if(!board)return;const idx=board.archive.findIndex(t=>t.id===id);if(idx===-1)return;const task=board.archive.splice(idx,1)[0];task.columnId=board.columns[0]?.id||'col_backlog';board.tasks.push(task);save();renderBoard();}
  function delArchive(id){const board=data.boards.find(b=>b.id===curBoard);if(!board)return;board.archive=board.archive.filter(t=>t.id!==id);save();renderArchive();const c=document.getElementById('bl-arc-count');if(c)c.textContent=board.archive.length;}

  // Column manager
  function openColMgr(){
    const board=data.boards.find(b=>b.id===curBoard);if(!board)return;
    document.getElementById('modal-title').textContent='Manage Columns';
    const body=document.getElementById('modal-body');
    function render(){
      let h='<div class="cm-list" id="cm-list">';
      board.columns.forEach((col,i)=>{h+=`<div class="cm-item"><div class="cm-arrows"><button onclick="BL.moveCol(${i},-1)"${i===0?' disabled':''}>&#9650;</button><button onclick="BL.moveCol(${i},1)"${i===board.columns.length-1?' disabled':''}>&#9660;</button></div><input class="cm-name" value="${esc(col.name)}" onchange="BL.renameColDirect(${i},this.value)" onkeydown="if(event.key==='Enter')this.blur();"><label class="cm-done"><input type="checkbox"${col.isDone?' checked':''} onchange="BL.toggleDoneCol(${i},this.checked)">done</label><button class="cm-del" onclick="BL.removeCol(${i})">&#215;</button></div>`;});
      h+='</div><button class="cm-add" onclick="BL.addCol()">+ Add Column</button><div class="cm-hint">Tip: check "done" on the column that represents completion</div>';
      body.innerHTML=h;
    }
    render();document.getElementById('modal-save-btn').style.display='none';
    document.getElementById('modal-overlay').classList.remove('hidden');window._cmRender=render;
  }
  function renameColDirect(i,name){const b=data.boards.find(x=>x.id===curBoard);if(!b||!name.trim())return;b.columns[i].name=name.trim();save();renderBoard();if(window._cmRender)window._cmRender();}
  function moveCol(i,dir){const b=data.boards.find(x=>x.id===curBoard);if(!b)return;const n=i+dir;if(n<0||n>=b.columns.length)return;[b.columns[i],b.columns[n]]=[b.columns[n],b.columns[i]];save();renderBoard();if(window._cmRender)window._cmRender();}
  function toggleDoneCol(i,checked){const b=data.boards.find(x=>x.id===curBoard);if(!b)return;b.columns.forEach((c,j)=>{c.isDone=(j===i&&checked);});save();renderBoard();if(window._cmRender)window._cmRender();}
  function addCol(){const b=data.boards.find(x=>x.id===curBoard);if(!b)return;b.columns.push({id:'col_'+uid(),name:'New Column'});save();renderBoard();if(window._cmRender)window._cmRender();setTimeout(()=>{const items=document.querySelectorAll('#cm-list .cm-name');if(items.length){items[items.length-1].focus();items[items.length-1].select();}},50);}
  function removeCol(i){const b=data.boards.find(x=>x.id===curBoard);if(!b)return;if(b.columns.length<=1){alert('Need at least one column.');return;}const col=b.columns[i],tasks=b.tasks.filter(t=>t.columnId===col.id);if(tasks.length>0){if(!confirm(`Move ${tasks.length} item(s) to first remaining column?`))return;const target=b.columns.find((c,j)=>j!==i);tasks.forEach(t=>{t.columnId=target.id;});}b.columns.splice(i,1);save();renderBoard();if(window._cmRender)window._cmRender();}
  function renameCol(colId){const b=data.boards.find(x=>x.id===curBoard);if(!b)return;const col=b.columns.find(c=>c.id===colId);if(!col)return;openModal('Rename Column',col.name,n=>{if(!n.trim())return;col.name=n.trim();save();renderBoard();});}

  return{init,goHub,goBoard,createBoard,renameBoard,deleteBoard,deleteTask,showAddForm,tagChange,closeForm,addTask,openPanel,closePanel,savePTitle,pTagChange,savePCustomTag,savePNotes,setPanelStatus,addCheckItem,toggleCheck,updateCheckText,deleteCheck,delAtt,downloadAtt,handleFiles,toggleArchive,archiveCurrent,restoreArchive,delArchive,openColMgr,renameColDirect,moveCol,toggleDoneCol,addCol,removeCol,renameCol};
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

window.BL = BL;

