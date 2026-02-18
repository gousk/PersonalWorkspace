const NT = (function () {
  const SK = 'ws_notes';
  let data;
  let curNote = null;
  let searchTerm = '';
  let tagFilter = '';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(SK)) || null;
    } catch {
      return null;
    }
  }
  function save() {
    localStorage.setItem(SK, JSON.stringify(data));
  }
  function tagsOf(note) {
    return String(note.tags || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  }

  function ensure() {
    if (!data || !Array.isArray(data.notes)) {
      data = {
        notes: [
          {
            id: uid(),
            title: 'Welcome to Notes',
            body: 'Use tags, pin important notes, and search everything quickly.',
            tags: 'welcome',
            pinned: true,
            created: Date.now(),
            updated: Date.now()
          },
          {
            id: uid(),
            title: 'Shopping list',
            body: 'Milk\nEggs\nBread\nCoffee',
            tags: 'personal,errand',
            pinned: false,
            created: Date.now() - 86400000,
            updated: Date.now() - 86400000
          }
        ]
      };
      save();
    }
    data.notes.forEach(n => {
      if (n.tags == null) n.tags = '';
      if (n.pinned == null) n.pinned = false;
      if (n.created == null) n.created = n.updated || Date.now();
      if (n.updated == null) n.updated = Date.now();
    });
    save();
  }

  function init() {
    data = load();
    ensure();
    if (curNote && !data.notes.some(n => n.id === curNote)) curNote = null;
    render();
  }

  function activeNote() {
    return curNote ? data.notes.find(n => n.id === curNote) : null;
  }

  function getTagCloud() {
    const map = new Map();
    data.notes.forEach(n => tagsOf(n).forEach(tag => map.set(tag, (map.get(tag) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }

  function filteredNotes() {
    const q = searchTerm.trim().toLowerCase();
    return data.notes
      .filter(n => {
        if (tagFilter && !tagsOf(n).includes(tagFilter)) return false;
        if (!q) return true;
        return `${n.title} ${n.body} ${n.tags}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return (b.updated || 0) - (a.updated || 0);
      });
  }

  function render() {
    const root = document.getElementById('page-notes');
    const notes = filteredNotes();
    const tagCloud = getTagCloud();

    const listHtml = notes.map(n => {
      const preview = (n.body || '').split('\n')[0] || '';
      const date = new Date(n.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const tags = tagsOf(n).slice(0, 3).map(t => `<span>#${esc(t)}</span>`).join('');
      return `<div class="nt-item${curNote === n.id ? ' active' : ''}" onclick="NT.select('${n.id}')"><div class="nt-item-top"><div class="nt-item-title">${esc(n.title || 'Untitled')}</div>${n.pinned ? '<span class="nt-pin">PIN</span>' : ''}</div><div class="nt-item-preview">${esc(preview)}</div>${tags ? `<div class="nt-item-tags">${tags}</div>` : ''}<div class="nt-item-date">${date}</div></div>`;
    }).join('');

    const tagFilters = ['<button class="gl-chip' + (tagFilter ? '' : ' active') + '" onclick="NT.filterTag(\'\')">All tags</button>']
      .concat(tagCloud.map(([tag]) => `<button class="gl-chip${tagFilter === tag ? ' active' : ''}" onclick="NT.filterTag(decodeURIComponent('${encodeURIComponent(tag)}'))">#${esc(tag)}</button>`))
      .join('');

    const note = activeNote();
    const editorHtml = note
      ? `<div class="nt-editor"><div class="nt-editor-head"><input class="nt-editor-title" value="${esc(note.title)}" placeholder="Untitled" onchange="NT.saveTitle(this.value)" onkeydown="if(event.key==='Enter')this.blur();"><div class="nt-meta-row"><input class="ti nt-editor-tags" value="${esc(note.tags || '')}" placeholder="tags, comma separated" onchange="NT.saveTags(this.value)"><button class="nt-editor-pin${note.pinned ? ' active' : ''}" onclick="NT.togglePin()">${note.pinned ? 'Pinned' : 'Pin'}</button><button class="nt-editor-del" onclick="NT.deleteNote()">Delete</button></div></div><div class="nt-editor-body"><textarea placeholder="Start writing..." oninput="NT.saveBody(this.value)">${esc(note.body || '')}</textarea></div></div>`
      : `<div class="nt-empty">Select a note or create a new one</div>`;

    root.innerHTML = `<div class="nt-wrap"><div class="nt-sidebar"><div class="nt-sidebar-head"><span class="nt-sidebar-title">Notes</span><button class="nt-sidebar-add" onclick="NT.create()">+</button></div><div class="nt-search"><input placeholder="Search notes..." value="${esc(searchTerm)}" oninput="NT.search(this.value)"></div><div class="nt-search" style="padding-top:8px">${tagFilters}</div><div class="nt-list">${listHtml || '<div class="nt-empty" style="padding:22px 14px">No notes found</div>'}</div></div>${editorHtml}</div>`;
  }

  function select(id) {
    curNote = id;
    render();
  }

  function create() {
    const now = Date.now();
    const note = { id: uid(), title: '', body: '', tags: '', pinned: false, created: now, updated: now };
    data.notes.unshift(note);
    curNote = note.id;
    save();
    render();
    setTimeout(() => {
      const el = document.querySelector('.nt-editor-title');
      if (el) el.focus();
    }, 50);
  }

  function saveTitle(val) {
    const note = activeNote();
    if (!note) return;
    note.title = val;
    note.updated = Date.now();
    save();
    render();
  }

  function saveBody(val) {
    const note = activeNote();
    if (!note) return;
    note.body = val;
    note.updated = Date.now();
    save();
  }

  function saveTags(val) {
    const note = activeNote();
    if (!note) return;
    note.tags = val;
    note.updated = Date.now();
    save();
    render();
  }

  function togglePin() {
    const note = activeNote();
    if (!note) return;
    note.pinned = !note.pinned;
    note.updated = Date.now();
    save();
    render();
  }

  function deleteNote() {
    if (!curNote) return;
    if (!confirm('Delete this note?')) return;
    data.notes = data.notes.filter(n => n.id !== curNote);
    curNote = null;
    save();
    render();
  }

  function search(val) {
    searchTerm = val;
    render();
  }

  function filterTag(tag) {
    tagFilter = tag || '';
    render();
  }

  function openFromSearch(id) {
    curNote = id;
    render();
  }

  return {
    init,
    select,
    create,
    saveTitle,
    saveBody,
    saveTags,
    togglePin,
    deleteNote,
    search,
    filterTag,
    openFromSearch
  };
})();

window.NT = NT;