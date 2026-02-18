const BL = (function () {
  const SK = 'ws_backlog';
  const DEFAULT_TAGS = ['game', 'book', 'film', 'show', 'music', 'anime', 'podcast', 'task', 'idea', 'recipe', 'travel', 'learn', 'buy', 'errand', 'habit', 'project', 'feature', 'bug', 'chore', 'design'];
  const DEFAULT_COLS = [{ id: 'col_backlog', name: 'Backlog' }, { id: 'col_inprogress', name: 'In Progress' }, { id: 'col_done', name: 'Done', isDone: true }];
  const PRIORITIES = ['low', 'medium', 'high'];
  let data;
  let curBoard = null;
  let curTask = null;
  let archiveOpen = false;
  let draggedId = null;

  function load() { try { return JSON.parse(localStorage.getItem(SK)) || null; } catch { return null; } }
  function save() {
    if (window.WSStorage) return WSStorage.setJSON(SK, data);
    try {
      localStorage.setItem(SK, JSON.stringify(data));
      return true;
    } catch {
      alert('Could not save backlog data. Storage may be full.');
      return false;
    }
  }

  function ensureTaskDefaults(task, fallbackColId) {
    if (!task.notes) task.notes = '';
    if (!Array.isArray(task.checklist)) task.checklist = [];
    if (!Array.isArray(task.attachments)) task.attachments = [];
    if (!task.priority || !PRIORITIES.includes(task.priority)) task.priority = 'medium';
    if (!task.due) task.due = '';
    if (!task.columnId) {
      if (task.status === 'todo') task.columnId = 'col_backlog';
      else if (task.status === 'progress') task.columnId = 'col_inprogress';
      else if (task.status === 'done') task.columnId = 'col_done';
      else task.columnId = fallbackColId || 'col_backlog';
    }
  }

  function getTagOpts(sel) {
    let tags = [...DEFAULT_TAGS];
    if (sel && !tags.includes(sel)) tags.unshift(sel);
    if (data) {
      data.boards.forEach(b => {
        (b.tasks || []).concat(b.archive || []).forEach(x => {
          if (x.tag && !tags.includes(x.tag)) tags.push(x.tag);
        });
      });
    }
    return tags;
  }
  function buildTagSel(el, sel) {
    const tags = getTagOpts(sel);
    el.innerHTML = tags.map(x => `<option value="${x}"${x === sel ? ' selected' : ''}>${x}</option>`).join('') + '<option value="__custom__">+ custom...</option>';
  }
  function getTask(id) {
    for (const b of data.boards) {
      const t = b.tasks.find(x => x.id === id);
      if (t) return t;
    }
    return null;
  }

  function migrate() {
    if (data) return;
    for (const key of ['backlog_v7', 'backlog_v6', 'backlog_v5']) {
      try {
        const old = JSON.parse(localStorage.getItem(key));
        if (old && old.boards) {
          old.boards.forEach(b => {
            if (!b.columns) b.columns = JSON.parse(JSON.stringify(DEFAULT_COLS));
            if (!b.archive) b.archive = [];
            b.tasks.forEach(t => ensureTaskDefaults(t, b.columns[0] ? b.columns[0].id : 'col_backlog'));
            b.archive.forEach(t => ensureTaskDefaults(t, b.columns[0] ? b.columns[0].id : 'col_backlog'));
          });
          data = old;
          save();
          return;
        }
      } catch {
      }
    }
  }

  function seedData() {
    data = {
      boards: [
        {
          id: uid(),
          name: 'My Backlog',
          columns: JSON.parse(JSON.stringify(DEFAULT_COLS)),
          archive: [],
          tasks: [
            { id: uid(), title: 'The Witcher 3', tag: 'game', priority: 'high', due: '', columnId: 'col_backlog', notes: 'Complete the Blood and Wine DLC.', checklist: [{ id: uid(), text: 'Main storyline', done: true }, { id: uid(), text: 'Blood and Wine DLC', done: false }], attachments: [] },
            { id: uid(), title: 'Dune by Frank Herbert', tag: 'book', priority: 'medium', due: '', columnId: 'col_backlog', notes: 'Recommended by a friend.', checklist: [], attachments: [] },
            { id: uid(), title: 'Severance Season 2', tag: 'show', priority: 'medium', due: '', columnId: 'col_inprogress', notes: '', checklist: [], attachments: [] },
            { id: uid(), title: 'Blade Runner 2049', tag: 'film', priority: 'low', due: '', columnId: 'col_backlog', notes: 'Watch the original first.', checklist: [], attachments: [] },
            { id: uid(), title: 'Learn guitar basics', tag: 'learn', priority: 'high', due: '', columnId: 'col_inprogress', notes: '', checklist: [{ id: uid(), text: 'Find a good tutorial', done: false }, { id: uid(), text: 'Practice chords 15min/day', done: false }], attachments: [] },
            { id: uid(), title: 'Dark Souls III', tag: 'game', priority: 'medium', due: '', columnId: 'col_done', notes: 'Finally beat it.', checklist: [], attachments: [] },
            { id: uid(), title: '1984 by George Orwell', tag: 'book', priority: 'low', due: '', columnId: 'col_done', notes: '', checklist: [], attachments: [] }
          ]
        },
        {
          id: uid(),
          name: 'Watchlist',
          columns: JSON.parse(JSON.stringify(DEFAULT_COLS)),
          archive: [],
          tasks: [
            { id: uid(), title: 'Spirited Away', tag: 'anime', priority: 'medium', due: '', columnId: 'col_backlog', notes: 'Studio Ghibli classic.', checklist: [], attachments: [] },
            { id: uid(), title: 'True Detective S1', tag: 'show', priority: 'medium', due: '', columnId: 'col_backlog', notes: '', checklist: [], attachments: [] },
            { id: uid(), title: 'Oppenheimer', tag: 'film', priority: 'low', due: '', columnId: 'col_done', notes: '', checklist: [], attachments: [] }
          ]
        }
      ]
    };
    save();
  }

  function init() {
    data = load();
    migrate();
    if (!data || !data.boards) seedData();
    data.boards.forEach(b => {
      if (!b.columns) b.columns = JSON.parse(JSON.stringify(DEFAULT_COLS));
      if (!b.archive) b.archive = [];
      const fallbackCol = b.columns[0] ? b.columns[0].id : 'col_backlog';
      b.tasks.forEach(t => ensureTaskDefaults(t, fallbackCol));
      b.archive.forEach(t => ensureTaskDefaults(t, fallbackCol));
    });
    save();
    curBoard = null;
    archiveOpen = false;
    renderHub();
  }

  function renderHub() {
    curBoard = null;
    archiveOpen = false;
    const root = document.getElementById('page-backlog');
    let html = `<div class="bl-hub-bar"><span>Boards <strong>${data.boards.length}</strong></span><span>Items <strong>${data.boards.reduce((s, b) => s + b.tasks.length, 0)}</strong></span></div><div class="bl-hub" style="flex:1;overflow-y:auto;padding:32px;"><div class="bl-hub-title">All Boards</div><div class="bl-hub-grid">`;
    data.boards.forEach(b => {
      const total = b.tasks.length;
      const doneCol = b.columns.find(c => c.isDone);
      const done = doneCol ? b.tasks.filter(x => x.columnId === doneCol.id).length : 0;
      const pct = total ? Math.round(done / total * 100) : 0;
      const stats = b.columns.slice(0, 3).map(col => `<span><span class="hi">${b.tasks.filter(x => x.columnId === col.id).length}</span> ${esc(col.name)}</span>`).join('');
      html += `<div class="bl-board-card" onclick="BL.goBoard('${b.id}')"><div class="bl-board-card-actions"><button class="be" onclick="event.stopPropagation();BL.renameBoard('${b.id}')">rename</button><button class="bd" onclick="event.stopPropagation();BL.deleteBoard('${b.id}')">delete</button></div><div class="bl-board-card-name">${esc(b.name)}</div><div class="bl-board-card-stats">${stats}<span>${pct}%</span></div><div class="bl-board-card-bar"><div class="bl-board-card-bar-fill" style="width:${pct}%"></div></div></div>`;
    });
    html += '<button class="bl-new-board" onclick="BL.createBoard()">+ New Board</button></div></div>';
    root.innerHTML = html;
  }

  function goBoard(id) {
    curBoard = id;
    archiveOpen = false;
    renderBoard();
  }

  function renderBoard() {
    const board = data.boards.find(b => b.id === curBoard);
    if (!board) return renderHub();
    const root = document.getElementById('page-backlog');
    const dragHandle = '<svg viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/></svg>';
    const total = board.tasks.length;
    const doneCol = board.columns.find(c => c.isDone);
    const done = doneCol ? board.tasks.filter(t => t.columnId === doneCol.id).length : 0;
    const pct = total ? Math.round(done / total * 100) : 0;

    let statsHtml = `<span>Total <strong>${total}</strong></span>`;
    board.columns.forEach(c => {
      statsHtml += `<span>${esc(c.name)} <strong>${board.tasks.filter(t => t.columnId === c.id).length}</strong></span>`;
    });

    let colsHtml = '';
    board.columns.forEach(col => {
      const items = board.tasks.filter(t => t.columnId === col.id);
      const cards = items.map(t => {
        const hasNotes = t.notes && t.notes.trim();
        const checkTotal = t.checklist.length;
        const checkDone = t.checklist.filter(x => x.done).length;
        const hasAttachments = t.attachments.length > 0;
        let indicators = '';
        if (hasNotes) indicators += '<span class="bl-card-dot" title="Has notes"></span>';
        if (checkTotal > 0) indicators += `<span title="Checklist">${checkDone}/${checkTotal}</span>`;
        if (hasAttachments) indicators += `<span title="Attachments">${t.attachments.length}f</span>`;

        const tagClass = DEFAULT_TAGS.includes(t.tag) ? `tag-${t.tag}` : 'tag-default';
        const pri = PRIORITIES.includes(t.priority) ? t.priority : 'medium';
        return `<div class="bl-card" data-id="${t.id}"><div class="bl-card-handle" title="Drag to move">${dragHandle}</div><div class="bl-card-body"><div class="bl-card-top"><div class="bl-card-title" onclick="event.stopPropagation();BL.openPanel('${t.id}')">${esc(t.title)}</div>${indicators ? `<div class="bl-card-ind">${indicators}</div>` : ''}</div><div class="bl-card-meta"><div style="display:flex;gap:6px;align-items:center;min-width:0;"><span class="bl-card-tag ${tagClass}">${esc(t.tag)}</span><span class="bl-card-pri ${pri}">${pri.toUpperCase()}</span>${t.due ? `<span class="bl-card-due">${esc(t.due)}</span>` : ''}</div><button class="bl-card-del" onclick="event.stopPropagation();BL.deleteTask('${t.id}')">&#215;</button></div></div></div>`;
      }).join('');

      colsHtml += `<div class="bl-col${col.isDone ? ' bl-done-col' : ''}" data-colid="${col.id}"><div class="bl-col-head"><span class="bl-col-title" onclick="BL.renameCol('${col.id}')" title="Click to rename">${esc(col.name)}</span><span class="bl-col-count">${items.length}</span></div><div class="bl-col-body"><button class="bl-add-btn" onclick="BL.showAddForm('${col.id}')">+ Add</button><div id="bl-form-${col.id}"></div><div class="bl-cards" data-colid="${col.id}">${cards}</div></div></div>`;
    });

    root.innerHTML = `<div class="bl-board-nav"><button class="nav-btn" onclick="BL.goHub()">&#8592; Boards</button><span class="bl-sep">|</span><span class="bl-bnd">${esc(board.name)}</span><div class="bl-nav-right"><button class="nav-btn" onclick="BL.toggleArchive()">Archive <span class="bl-archive-badge" id="bl-arc-count">${board.archive.length}</span></button><button class="nav-btn" onclick="BL.openColMgr()">Columns</button></div></div><div class="bl-stats-bar">${statsHtml}</div><div class="bl-prog-wrap"><span>${pct}%</span><div class="bl-prog-track"><div class="bl-prog-fill" style="width:${pct}%"></div></div></div><div class="bl-columns" id="bl-columns">${colsHtml}</div><div class="bl-archive-drawer${archiveOpen ? ' open' : ''}" id="bl-archive-drawer"><div class="bl-archive-head"><span>Archived Items</span><button class="nav-btn" onclick="BL.toggleArchive()" style="font-size:10px;padding:3px 10px;">Close</button></div><div class="bl-archive-list" id="bl-archive-list"></div></div>`;

    root.querySelectorAll('.bl-card').forEach(card => {
      const handle = card.querySelector('.bl-card-handle');
      card.setAttribute('draggable', 'false');
      handle.addEventListener('mousedown', () => card.setAttribute('draggable', 'true'));
      handle.addEventListener('mouseup', () => card.setAttribute('draggable', 'false'));
      card.addEventListener('dragstart', e => {
        draggedId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.setAttribute('draggable', 'false');
        draggedId = null;
        root.querySelectorAll('.bl-col').forEach(c => c.classList.remove('drag-over'));
      });
    });

    root.querySelectorAll('.bl-col').forEach(col => {
      col.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', e => {
        if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
      });
      col.addEventListener('drop', e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        if (!draggedId) return;
        const task = board.tasks.find(t => t.id === draggedId);
        if (task) {
          task.columnId = col.dataset.colid;
          save();
          renderBoard();
        }
      });
    });

    if (archiveOpen) renderArchive();
  }

  function goHub() { renderHub(); }
  function createBoard() { openModal('New Board', '', name => { if (!name.trim()) return false; data.boards.push({ id: uid(), name: name.trim(), columns: JSON.parse(JSON.stringify(DEFAULT_COLS)), archive: [], tasks: [] }); save(); renderHub(); return true; }); }
  function renameBoard(id) { const b = data.boards.find(x => x.id === id); if (!b) return; openModal('Rename Board', b.name, name => { if (!name.trim()) return false; b.name = name.trim(); save(); renderHub(); return true; }); }
  function deleteBoard(id) { if (confirm('Delete this board and all tasks?')) { data.boards = data.boards.filter(b => b.id !== id); save(); renderHub(); } }
  function deleteTask(id) { const b = data.boards.find(x => x.id === curBoard); if (!b) return; b.tasks = b.tasks.filter(t => t.id !== id); save(); renderBoard(); }

  function showAddForm(colId) {
    document.querySelectorAll('.bl-add-form').forEach(f => f.remove());
    const formContainer = document.getElementById(`bl-form-${colId}`);
    if (!formContainer) return;
    const tags = getTagOpts();
    const options = tags.map(t => `<option value="${t}">${t}</option>`).join('') + '<option value="__custom__">+ custom...</option>';
    formContainer.innerHTML = `<div class="bl-add-form"><div class="bl-form-label">New item</div><input class="ti" type="text" id="bl-input-${colId}" placeholder="What to add..." autofocus onkeydown="if(event.key==='Enter')BL.addTask('${colId}');if(event.key==='Escape')BL.closeForm('${colId}')"><div class="bl-form-actions"><select id="bl-pri-${colId}" class="ti" style="max-width:110px;padding:7px 10px;"><option value="low">low</option><option value="medium" selected>medium</option><option value="high">high</option></select><input id="bl-due-${colId}" class="ti" type="date" style="max-width:150px;padding:7px 10px;"><div class="bl-tag-wrap"><select id="bl-tag-${colId}" onchange="BL.tagChange('${colId}')">${options}</select><input class="bl-custom-tag" id="bl-ctag-${colId}" placeholder="tag name..."></div><button class="fb btn-s" onclick="BL.addTask('${colId}')">Save</button><button class="fb btn-c" onclick="BL.closeForm('${colId}')">Cancel</button></div></div>`;
    document.getElementById(`bl-input-${colId}`).focus();
  }

  function tagChange(colId) {
    const sel = document.getElementById(`bl-tag-${colId}`);
    const custom = document.getElementById(`bl-ctag-${colId}`);
    if (sel.value === '__custom__') {
      custom.style.display = 'block';
      custom.focus();
    } else {
      custom.style.display = 'none';
    }
  }

  function closeForm(colId) {
    const el = document.getElementById(`bl-form-${colId}`);
    if (el) el.innerHTML = '';
  }

  function addTask(colId) {
    const titleInput = document.getElementById(`bl-input-${colId}`);
    const tagSel = document.getElementById(`bl-tag-${colId}`);
    const customTagInput = document.getElementById(`bl-ctag-${colId}`);
    const priSel = document.getElementById(`bl-pri-${colId}`);
    const dueInput = document.getElementById(`bl-due-${colId}`);

    let tag = tagSel.value;
    if (tag === '__custom__') {
      tag = customTagInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!tag) tag = 'task';
    }

    const title = titleInput.value.trim();
    if (!title) return;

    const board = data.boards.find(x => x.id === curBoard);
    board.tasks.push({ id: uid(), title, tag, priority: (priSel && priSel.value) || 'medium', due: (dueInput && dueInput.value) || '', columnId: colId, notes: '', checklist: [], attachments: [] });
    closeForm(colId);
    save();
    renderBoard();
  }

  function openPanel(taskId) {
    curTask = taskId;
    const t = getTask(taskId);
    if (!t) return;
    const board = data.boards.find(b => b.tasks.some(x => x.id === taskId));
    const statusBtns = board ? board.columns.map(c => `<button class="bl-panel-sbtn ${t.columnId === c.id ? 'active' : ''}" onclick="BL.setPanelStatus('${c.id}')">${esc(c.name)}</button>`).join('') : '';
    const priOpts = PRIORITIES.map(p => `<option value="${p}"${t.priority === p ? ' selected' : ''}>${p}</option>`).join('');

    document.getElementById('bl-panel').innerHTML = `<div class="bl-panel-header"><div class="bl-panel-title-wrap"><input class="bl-panel-title" id="bl-p-title" value="${esc(t.title)}" onchange="BL.savePTitle()"><div class="bl-panel-tag-row"><label>Tag</label><select class="bl-panel-tag-sel" id="bl-p-tag" onchange="BL.pTagChange()"></select><input class="bl-panel-custom" id="bl-p-ctag" placeholder="custom..." onchange="BL.savePCustomTag()" onkeydown="if(event.key==='Enter'){BL.savePCustomTag();this.blur();}"></div><div class="bl-panel-status">${statusBtns}</div><div class="bl-panel-extra"><label>Priority<select id="bl-p-priority" onchange="BL.savePPriority()">${priOpts}</select></label><label>Due Date<input id="bl-p-due" type="date" value="${esc(t.due || '')}" onchange="BL.savePDue()"></label></div></div><button class="bl-panel-close" onclick="BL.closePanel()">&#215;</button></div><div class="bl-panel-body"><div><div class="section-title">Notes</div><textarea class="bl-notes-area" id="bl-p-notes" placeholder="Add notes, links, context..." onchange="BL.savePNotes()">${esc(t.notes || '')}</textarea></div><div><div class="section-title">Checklist</div><div class="bl-checklist" id="bl-p-checklist"></div><button class="bl-add-check" onclick="BL.addCheckItem()">+ Add item</button></div><div><div class="section-title">Attachments</div><div class="bl-att" id="bl-p-att"></div><input type="file" id="bl-file-input" multiple accept="image/*,.pdf,.txt,.md,.doc,.docx,.zip" style="display:none" onchange="BL.handleFiles(event)"></div><button class="bl-panel-archive" onclick="BL.archiveCurrent()">Archive this item</button></div>`;

    buildTagSel(document.getElementById('bl-p-tag'), t.tag);
    renderChecklist();
    renderAttachments();
    document.getElementById('bl-panel-overlay').classList.remove('hidden');
    document.getElementById('bl-panel').classList.remove('hidden');
  }

  function closePanel() {
    document.getElementById('bl-panel-overlay').classList.add('hidden');
    document.getElementById('bl-panel').classList.add('hidden');
    curTask = null;
    renderBoard();
  }
  function savePTitle() { const t = getTask(curTask); if (t) { t.title = document.getElementById('bl-p-title').value; save(); } }
  function pTagChange() {
    const sel = document.getElementById('bl-p-tag');
    const custom = document.getElementById('bl-p-ctag');
    if (sel.value === '__custom__') {
      custom.style.display = 'inline-block';
      custom.value = '';
      custom.focus();
    } else {
      custom.style.display = 'none';
      const t = getTask(curTask);
      if (t) {
        t.tag = sel.value;
        save();
      }
    }
  }
  function savePCustomTag() {
    const t = getTask(curTask);
    if (!t) return;
    const v = document.getElementById('bl-p-ctag').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!v) return;
    t.tag = v;
    save();
    buildTagSel(document.getElementById('bl-p-tag'), v);
    document.getElementById('bl-p-ctag').style.display = 'none';
  }
  function savePPriority() { const t = getTask(curTask); if (t) { t.priority = document.getElementById('bl-p-priority').value; save(); } }
  function savePDue() { const t = getTask(curTask); if (t) { t.due = document.getElementById('bl-p-due').value || ''; save(); } }
  function savePNotes() { const t = getTask(curTask); if (t) { t.notes = document.getElementById('bl-p-notes').value; save(); } }
  function setPanelStatus(colId) { const t = getTask(curTask); if (t) { t.columnId = colId; save(); openPanel(curTask); } }

  function renderChecklist() {
    const t = getTask(curTask);
    const el = document.getElementById('bl-p-checklist');
    if (!t || !el) { if (el) el.innerHTML = ''; return; }
    el.innerHTML = t.checklist.map(c => `<div class="bl-check-item"><button class="bl-check-box ${c.done ? 'checked' : ''}" onclick="BL.toggleCheck('${c.id}')">${c.done ? '&#10003;' : ''}</button><input class="bl-check-text ${c.done ? 'done' : ''}" value="${esc(c.text)}" onchange="BL.updateCheckText('${c.id}',this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();BL.addCheckItem();}"><button class="bl-check-del" onclick="BL.deleteCheck('${c.id}')">&#215;</button></div>`).join('');
  }
  function addCheckItem() { const t = getTask(curTask); if (!t) return; t.checklist.push({ id: uid(), text: '', done: false }); save(); renderChecklist(); const items = document.querySelectorAll('#bl-p-checklist .bl-check-text'); if (items.length) items[items.length - 1].focus(); }
  function toggleCheck(id) { const t = getTask(curTask); const c = t.checklist.find(x => x.id === id); if (c) { c.done = !c.done; save(); renderChecklist(); } }
  function updateCheckText(id, value) { const t = getTask(curTask); const c = t.checklist.find(x => x.id === id); if (c) { c.text = value; save(); } }
  function deleteCheck(id) { const t = getTask(curTask); t.checklist = t.checklist.filter(x => x.id !== id); save(); renderChecklist(); }

  function renderAttachments() {
    const t = getTask(curTask);
    const el = document.getElementById('bl-p-att');
    if (!t || !el) { if (el) el.innerHTML = ''; return; }
    let html = '';
    t.attachments.forEach(a => {
      if (a.type === 'image') {
        html += `<div class="bl-att-item"><img class="bl-att-img" src="${a.data}" onclick="document.getElementById('lb-img').src='${a.data}';document.getElementById('lightbox').classList.remove('hidden')"><button class="bl-att-del" onclick="BL.delAtt('${a.id}')">&#215;</button></div>`;
      } else {
        html += `<div class="bl-att-item"><div class="bl-att-file" onclick="BL.downloadAtt('${a.id}')">${esc(a.name)}</div><button class="bl-att-del" onclick="BL.delAtt('${a.id}')">&#215;</button></div>`;
      }
    });
    html += '<button class="bl-att-add" onclick="document.getElementById(\'bl-file-input\').click()"><span>+</span>Add file</button>';
    el.innerHTML = html;
  }
  function handleFiles(event) {
    const t = getTask(curTask);
    if (!t) return;
    Array.from(event.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        t.attachments.push({ id: uid(), name: file.name, type: file.type.startsWith('image/') ? 'image' : 'file', data: e.target.result, mime: file.type });
        save();
        renderAttachments();
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }
  function delAtt(id) { const t = getTask(curTask); t.attachments = t.attachments.filter(a => a.id !== id); save(); renderAttachments(); }
  function downloadAtt(id) { const t = getTask(curTask); const a = t.attachments.find(x => x.id === id); if (!a) return; const link = document.createElement('a'); link.href = a.data; link.download = a.name; link.click(); }

  function toggleArchive() {
    archiveOpen = !archiveOpen;
    const drawer = document.getElementById('bl-archive-drawer');
    if (drawer) {
      if (archiveOpen) {
        drawer.classList.add('open');
        renderArchive();
      } else {
        drawer.classList.remove('open');
      }
    }
  }

  function renderArchive() {
    const board = data.boards.find(b => b.id === curBoard);
    if (!board) return;
    const el = document.getElementById('bl-archive-list');
    if (!el) return;
    if (!board.archive.length) {
      el.innerHTML = '<div class="bl-archive-empty">No archived items</div>';
      return;
    }
    el.innerHTML = board.archive.map(t => {
      const tc = DEFAULT_TAGS.includes(t.tag) ? `tag-${t.tag}` : 'tag-default';
      return `<div class="bl-archive-row"><span class="bl-archive-row-title">${esc(t.title)}</span><span class="bl-archive-row-tag ${tc}">${esc(t.tag)}</span><div class="bl-archive-row-actions"><button class="a-restore" onclick="BL.restoreArchive('${t.id}')">restore</button><button class="a-del" onclick="BL.delArchive('${t.id}')">delete</button></div></div>`;
    }).join('');
  }

  function archiveCurrent() {
    if (!curTask) return;
    const board = data.boards.find(b => b.id === curBoard);
    if (!board) return;
    const idx = board.tasks.findIndex(t => t.id === curTask);
    if (idx === -1) return;
    board.archive.push(board.tasks.splice(idx, 1)[0]);
    save();
    closePanel();
  }
  function restoreArchive(id) {
    const board = data.boards.find(b => b.id === curBoard);
    if (!board) return;
    const idx = board.archive.findIndex(t => t.id === id);
    if (idx === -1) return;
    const task = board.archive.splice(idx, 1)[0];
    task.columnId = board.columns[0] ? board.columns[0].id : 'col_backlog';
    board.tasks.push(task);
    save();
    renderBoard();
  }
  function delArchive(id) {
    const board = data.boards.find(b => b.id === curBoard);
    if (!board) return;
    board.archive = board.archive.filter(t => t.id !== id);
    save();
    renderArchive();
    const count = document.getElementById('bl-arc-count');
    if (count) count.textContent = board.archive.length;
  }

  function openColMgr() {
    const board = data.boards.find(b => b.id === curBoard);
    if (!board) return;
    document.getElementById('modal-title').textContent = 'Manage Columns';
    const body = document.getElementById('modal-body');
    function render() {
      let html = '<div class="cm-list" id="cm-list">';
      board.columns.forEach((col, i) => {
        html += `<div class="cm-item"><div class="cm-arrows"><button onclick="BL.moveCol(${i},-1)"${i === 0 ? ' disabled' : ''}>&#9650;</button><button onclick="BL.moveCol(${i},1)"${i === board.columns.length - 1 ? ' disabled' : ''}>&#9660;</button></div><input class="cm-name" value="${esc(col.name)}" onchange="BL.renameColDirect(${i},this.value)" onkeydown="if(event.key==='Enter')this.blur();"><label class="cm-done"><input type="checkbox"${col.isDone ? ' checked' : ''} onchange="BL.toggleDoneCol(${i},this.checked)">done</label><button class="cm-del" onclick="BL.removeCol(${i})">&#215;</button></div>`;
      });
      html += '</div><button class="cm-add" onclick="BL.addCol()">+ Add Column</button><div class="cm-hint">Tip: check "done" on the column that represents completion</div>';
      body.innerHTML = html;
    }
    render();
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('modal-overlay').classList.remove('hidden');
    window._cmRender = render;
  }

  function renameColDirect(i, name) { const b = data.boards.find(x => x.id === curBoard); if (!b || !name.trim()) return; b.columns[i].name = name.trim(); save(); renderBoard(); if (window._cmRender) window._cmRender(); }
  function moveCol(i, dir) { const b = data.boards.find(x => x.id === curBoard); if (!b) return; const n = i + dir; if (n < 0 || n >= b.columns.length) return; [b.columns[i], b.columns[n]] = [b.columns[n], b.columns[i]]; save(); renderBoard(); if (window._cmRender) window._cmRender(); }
  function toggleDoneCol(i, checked) { const b = data.boards.find(x => x.id === curBoard); if (!b) return; b.columns.forEach((c, j) => { c.isDone = (j === i && checked); }); save(); renderBoard(); if (window._cmRender) window._cmRender(); }
  function addCol() { const b = data.boards.find(x => x.id === curBoard); if (!b) return; b.columns.push({ id: 'col_' + uid(), name: 'New Column' }); save(); renderBoard(); if (window._cmRender) window._cmRender(); setTimeout(() => { const items = document.querySelectorAll('#cm-list .cm-name'); if (items.length) { items[items.length - 1].focus(); items[items.length - 1].select(); } }, 50); }
  function removeCol(i) { const b = data.boards.find(x => x.id === curBoard); if (!b) return; if (b.columns.length <= 1) { alert('Need at least one column.'); return; } const col = b.columns[i]; const tasks = b.tasks.filter(t => t.columnId === col.id); if (tasks.length > 0) { if (!confirm(`Move ${tasks.length} item(s) to first remaining column?`)) return; const target = b.columns.find((_, j) => j !== i); tasks.forEach(t => { t.columnId = target.id; }); } b.columns.splice(i, 1); save(); renderBoard(); if (window._cmRender) window._cmRender(); }
  function renameCol(colId) { const b = data.boards.find(x => x.id === curBoard); if (!b) return; const col = b.columns.find(c => c.id === colId); if (!col) return; openModal('Rename Column', col.name, name => { if (!name.trim()) return false; col.name = name.trim(); save(); renderBoard(); return true; }); }

  function openFromSearch(taskId, boardId) {
    if (!data) init();
    let board = boardId ? data.boards.find(b => b.id === boardId) : null;
    if (!board) board = data.boards.find(b => b.tasks.some(t => t.id === taskId));
    if (!board) return;
    curBoard = board.id;
    archiveOpen = false;
    renderBoard();
    setTimeout(() => openPanel(taskId), 40);
  }

  return {
    init,
    goHub,
    goBoard,
    createBoard,
    renameBoard,
    deleteBoard,
    deleteTask,
    showAddForm,
    tagChange,
    closeForm,
    addTask,
    openPanel,
    closePanel,
    savePTitle,
    pTagChange,
    savePCustomTag,
    savePPriority,
    savePDue,
    savePNotes,
    setPanelStatus,
    addCheckItem,
    toggleCheck,
    updateCheckText,
    deleteCheck,
    delAtt,
    downloadAtt,
    handleFiles,
    toggleArchive,
    archiveCurrent,
    restoreArchive,
    delArchive,
    openColMgr,
    renameColDirect,
    moveCol,
    toggleDoneCol,
    addCol,
    removeCol,
    renameCol,
    openFromSearch
  };
})();

window.BL = BL;