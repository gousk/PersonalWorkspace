const BG = (function () {
  const SK = 'ws_blog';
  const BTYPES = ['text', 'h1', 'h2', 'h3', 'quote', 'callout', 'code', 'list', 'image', 'divider'];
  const BLABELS = { text: 'Text', h1: 'H1', h2: 'H2', h3: 'H3', quote: 'Quote', callout: 'Callout', code: 'Code', list: 'List', image: 'Image', divider: 'Divider' };
  let data;
  let curPost = null;
  let listSearch = '';
  let listStatus = 'all';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(SK)) || null;
    } catch {
      return null;
    }
  }
  function save() {
    if (window.WSStorage) return WSStorage.setJSON(SK, data);
    try {
      localStorage.setItem(SK, JSON.stringify(data));
      return true;
    } catch {
      alert('Could not save blog data. Storage may be full.');
      return false;
    }
  }

  function init() {
    data = load();
    if (!data || !data.posts) {
      data = {
        posts: [
          {
            id: uid(),
            title: 'Welcome to Blog',
            summary: 'Use this workspace to publish rich internal posts.',
            tags: 'welcome,getting-started',
            blocks: [
              { id: uid(), type: 'text', content: 'This is your block-based editor. Add text, headings, images, quotes, and code.' },
              { id: uid(), type: 'h2', content: 'How to use it' },
              { id: uid(), type: 'list', content: 'Create a new post\nAdd blocks from the toolbar\nUse tags for discoverability\nPublish when ready' }
            ],
            status: 'published',
            coverImg: '',
            created: Date.now() - 86400000,
            updated: Date.now() - 3600000
          },
          {
            id: uid(),
            title: 'Draft: Team update format',
            summary: '',
            tags: 'internal,process',
            blocks: [{ id: uid(), type: 'text', content: 'Draft content...' }],
            status: 'draft',
            coverImg: '',
            created: Date.now(),
            updated: Date.now()
          }
        ]
      };
      save();
    }

    data.posts.forEach(p => {
      if (!p.blocks) {
        p.blocks = (p.body || '').split('\n\n').filter(Boolean).map(t => ({ id: uid(), type: 'text', content: t.replace(/\n/g, ' ') }));
        if (!p.blocks.length) p.blocks = [{ id: uid(), type: 'text', content: '' }];
      }
      if (p.tags == null) p.tags = '';
      if (p.summary == null) p.summary = '';
      if (p.status == null) p.status = 'draft';
      if (p.coverImg == null) p.coverImg = '';
      if (p.created == null) p.created = Date.now();
      if (p.updated == null) p.updated = Date.now();
      delete p.body;
    });
    save();

    if (curPost && !data.posts.some(p => p.id === curPost)) curPost = null;
    if (curPost) renderEditor();
    else renderList();
  }

  function getText(post) {
    return (post.blocks || [])
      .filter(b => b.type !== 'divider' && b.type !== 'image')
      .map(b => b.content || '')
      .join(' ');
  }
  function wordCount(post) {
    return getText(post).split(/\s+/).filter(Boolean).length;
  }
  function excerpt(post) {
    const base = post.summary || getText(post);
    return (base || '').slice(0, 180);
  }
  function firstImg(post) {
    const i = (post.blocks || []).find(b => b.type === 'image' && b.content);
    return i ? i.content : (post.coverImg || '');
  }
  function readTime(post) {
    return Math.max(1, Math.round(wordCount(post) / 200));
  }

  function visiblePosts() {
    const q = listSearch.trim().toLowerCase();
    return data.posts
      .filter(p => {
        if (listStatus !== 'all' && p.status !== listStatus) return false;
        if (!q) return true;
        const hay = `${p.title} ${p.summary} ${p.tags} ${getText(p)}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }

  function renderList() {
    curPost = null;
    const root = document.getElementById('page-blog');
    const pub = data.posts.filter(p => p.status === 'published').length;
    const drf = data.posts.filter(p => p.status === 'draft').length;
    const posts = visiblePosts();

    const cards = posts.map(p => {
      const date = new Date(p.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const statusClass = p.status === 'published' ? 'bg-status-published' : 'bg-status-draft';
      const thumb = firstImg(p);
      const tags = String(p.tags || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 4).map(t => `#${esc(t)}`).join(' ');
      return `<div class="bg-post-card" onclick="BG.edit('${p.id}')"><div class="bg-post-card-actions"><button class="be" onclick="event.stopPropagation();BG.renamePost('${p.id}')">rename</button><button class="bd" onclick="event.stopPropagation();BG.deletePost('${p.id}')">delete</button></div>${thumb ? `<img class="bg-post-card-thumb" src="${thumb}">` : ''}<div class="bg-post-card-title">${esc(p.title || 'Untitled')}</div><div class="bg-post-card-excerpt">${esc(excerpt(p))}</div><div class="bg-post-card-meta"><span class="bg-post-status ${statusClass}">${p.status}</span><span>${date}</span><span>${wordCount(p)} words</span><span>${readTime(p)} min read</span>${tags ? `<span>${esc(tags)}</span>` : ''}</div></div>`;
    }).join('');

    root.innerHTML = `
      <div class="bg-wrap">
        <div class="bg-toolbar">
          <span style="font-size:11px;color:var(--g4)">Published <strong style="color:var(--g2)">${pub}</strong></span>
          <span style="font-size:11px;color:var(--g4)">Drafts <strong style="color:var(--g2)">${drf}</strong></span>
          <input class="ti" style="max-width:260px" placeholder="Search posts..." value="${esc(listSearch)}" oninput="BG.setSearch(this.value)">
          <select onchange="BG.setStatusFilter(this.value)">
            <option value="all"${listStatus === 'all' ? ' selected' : ''}>All</option>
            <option value="published"${listStatus === 'published' ? ' selected' : ''}>Published</option>
            <option value="draft"${listStatus === 'draft' ? ' selected' : ''}>Draft</option>
          </select>
          <button class="nav-btn" onclick="BG.clearFilters()">Clear</button>
        </div>
        <div class="bg-list">
          <div class="bg-list-title">All Posts</div>
          <div class="bg-grid">${cards || '<div class="bg-list-empty">No posts found for this filter.</div>'}<button class="bg-new-post" onclick="BG.create()">+ New Post</button></div>
        </div>
      </div>`;
  }

  function getPost() {
    return data.posts.find(x => x.id === curPost);
  }
  function getBlock(blockId) {
    const p = getPost();
    return p ? p.blocks.find(b => b.id === blockId) : null;
  }

  function renderEditor() {
    const p = getPost();
    if (!p) {
      renderList();
      return;
    }
    const root = document.getElementById('page-blog');
    const blocksHtml = p.blocks.map((b, i) => renderBlock(b, i, p.blocks.length)).join('');

    root.innerHTML = `
      <div class="bg-editor">
        <div class="bg-editor-head"><button class="nav-btn" onclick="BG.backToList()">&#8592; Posts</button><input class="bg-editor-title" value="${esc(p.title)}" placeholder="Post title..." onchange="BG.saveTitle(this.value)"></div>
        <div class="bg-editor-meta">
          <label>Status</label>
          <select onchange="BG.saveStatus(this.value)"><option value="draft"${p.status === 'draft' ? ' selected' : ''}>Draft</option><option value="published"${p.status === 'published' ? ' selected' : ''}>Published</option></select>
          <label>Tags</label>
          <input type="text" value="${esc(p.tags || '')}" placeholder="comma-separated..." onchange="BG.saveTags(this.value)" style="max-width:220px;">
          <label>Summary</label>
          <input type="text" value="${esc(p.summary || '')}" placeholder="short summary..." onchange="BG.saveSummary(this.value)" style="flex:1;min-width:180px;">
          <span style="margin-left:auto;font-family:var(--mono);font-size:10px">${new Date(p.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
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
        <div class="bg-canvas"><div class="bg-canvas-center" id="bg-blocks">${blocksHtml}</div></div>
        <div class="bg-word-count"><span>${wordCount(p)} words</span><span>${p.blocks.length} blocks</span><span>${readTime(p)} min read</span></div>
      </div>`;

    document.querySelectorAll('#bg-blocks textarea').forEach(el => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
  }

  function renderBlock(block, i, total) {
    const id = block.id;
    const canUp = i > 0;
    const canDown = i < total - 1;
    const handle = `<div class="bg-block-handle"><button class="bg-block-hbtn" onclick="BG.move('${id}',-1)"${canUp ? '' : ' disabled style="opacity:.12"'} title="Move up">&#9650;</button><button class="bg-block-hbtn" onclick="BG.move('${id}',1)"${canDown ? '' : ' disabled style="opacity:.12"'} title="Move down">&#9660;</button><button class="bg-block-hbtn" onclick="BG.dup('${id}')" title="Duplicate">&#10697;</button><button class="bg-block-hbtn bg-blk-del" onclick="BG.del('${id}')" title="Delete">&#215;</button></div>`;

    if (block.type === 'divider') {
      return `<div class="bg-block bg-blk-divider" data-bid="${id}"><div class="bg-blk-divider-line"></div>${handle}</div>`;
    }

    if (block.type === 'image') {
      const fileInput = `<input type="file" id="bg-fi-${id}" accept="image/*" style="display:none" onchange="BG.handleImg('${id}',event)">`;
      if (block.content) {
        return `<div class="bg-block bg-blk-image" data-bid="${id}"><img src="${block.content}"><div class="bg-blk-img-actions"><button onclick="BG.replaceImg('${id}')">Replace</button><button onclick="BG.removeImg('${id}')">Remove</button></div><input class="bg-blk-image-caption" value="${esc(block.caption || '')}" placeholder="Add a caption..." onchange="BG.saveCap('${id}',this.value)">${fileInput}${handle}</div>`;
      }
      return `<div class="bg-block bg-blk-image" data-bid="${id}"><div class="bg-blk-image-ph" onclick="BG.pickImg('${id}')"><span>+</span>Click to add image</div>${fileInput}${handle}</div>`;
    }

    const classMap = { text: 'bg-blk-text', h1: 'bg-blk-text bg-blk-h1', h2: 'bg-blk-text bg-blk-h2', h3: 'bg-blk-text bg-blk-h3', quote: 'bg-blk-quote', callout: 'bg-blk-callout', code: 'bg-blk-code', list: 'bg-blk-list' };
    const placeholderMap = { h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', quote: 'Write a quote...', callout: 'Callout text...', code: 'Paste or write code...', list: 'List items (one per line)...' };
    const cls = classMap[block.type] || 'bg-blk-text';
    const placeholder = placeholderMap[block.type] || 'Start writing...';

    const canConvert = block.type !== 'image' && block.type !== 'divider';
    const typeOptions = canConvert ? BTYPES.filter(t => t !== 'image' && t !== 'divider').map(t => `<option value="${t}"${t === block.type ? ' selected' : ''}>${BLABELS[t]}</option>`).join('') : '';
    const typeSelect = canConvert ? `<select class="bg-block-type-sel" onchange="BG.convert('${id}',this.value)">${typeOptions}</select>` : '';

    return `<div class="bg-block ${cls}" data-bid="${id}"><textarea placeholder="${placeholder}" oninput="BG.saveBlock('${id}',this.value);this.style.height='auto';this.style.height=this.scrollHeight+'px'" onkeydown="BG.onKey(event,'${id}')">${esc(block.content || '')}</textarea>${typeSelect}${handle}</div>`;
  }

  function refreshWordCount() {
    const p = getPost();
    if (!p) return;
    const el = document.querySelector('.bg-word-count');
    if (el) el.innerHTML = `<span>${wordCount(p)} words</span><span>${p.blocks.length} blocks</span><span>${readTime(p)} min read</span>`;
  }

  function add(type, afterId) {
    const p = getPost();
    if (!p) return;
    const next = { id: uid(), type, content: '', caption: '' };
    if (afterId) {
      const i = p.blocks.findIndex(b => b.id === afterId);
      p.blocks.splice(i + 1, 0, next);
    } else {
      p.blocks.push(next);
    }
    p.updated = Date.now();
    save();
    renderEditor();
    if (type !== 'divider' && type !== 'image') {
      setTimeout(() => {
        const el = document.querySelector(`[data-bid="${next.id}"] textarea`);
        if (el) el.focus();
      }, 20);
    }
  }

  function saveBlock(blockId, value) {
    const b = getBlock(blockId);
    if (!b) return;
    b.content = value;
    const p = getPost();
    p.updated = Date.now();
    save();
    refreshWordCount();
  }

  function saveCap(blockId, value) {
    const b = getBlock(blockId);
    if (!b) return;
    b.caption = value;
    getPost().updated = Date.now();
    save();
  }

  function saveTitle(value) {
    const p = getPost();
    if (!p) return;
    p.title = value;
    p.updated = Date.now();
    save();
  }

  function saveStatus(value) {
    const p = getPost();
    if (!p) return;
    p.status = value;
    p.updated = Date.now();
    save();
  }

  function saveTags(value) {
    const p = getPost();
    if (!p) return;
    p.tags = value;
    p.updated = Date.now();
    save();
  }

  function saveSummary(value) {
    const p = getPost();
    if (!p) return;
    p.summary = value;
    p.updated = Date.now();
    save();
  }

  function del(blockId) {
    const p = getPost();
    if (!p || p.blocks.length <= 1) return;
    const i = p.blocks.findIndex(b => b.id === blockId);
    p.blocks.splice(i, 1);
    p.updated = Date.now();
    save();
    renderEditor();
  }

  function move(blockId, direction) {
    const p = getPost();
    if (!p) return;
    const i = p.blocks.findIndex(b => b.id === blockId);
    const n = i + direction;
    if (n < 0 || n >= p.blocks.length) return;
    [p.blocks[i], p.blocks[n]] = [p.blocks[n], p.blocks[i]];
    p.updated = Date.now();
    save();
    renderEditor();
  }

  function dup(blockId) {
    const p = getPost();
    if (!p) return;
    const i = p.blocks.findIndex(b => b.id === blockId);
    const copy = { ...JSON.parse(JSON.stringify(p.blocks[i])), id: uid() };
    p.blocks.splice(i + 1, 0, copy);
    p.updated = Date.now();
    save();
    renderEditor();
  }

  function convert(blockId, nextType) {
    const b = getBlock(blockId);
    if (!b) return;
    b.type = nextType;
    getPost().updated = Date.now();
    save();
    renderEditor();
  }

  function onKey(e, blockId) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const b = getBlock(blockId);
      if (b && b.type !== 'code' && b.type !== 'list') {
        e.preventDefault();
        add('text', blockId);
      }
    }
    if (e.key === 'Backspace' && e.target.value === '' && e.target.selectionStart === 0) {
      const p = getPost();
      if (!p || p.blocks.length <= 1) return;
      e.preventDefault();
      del(blockId);
    }
  }

  function pickImg(blockId) {
    const input = document.getElementById(`bg-fi-${blockId}`);
    if (input) input.click();
  }

  function replaceImg(blockId) {
    pickImg(blockId);
  }

  function removeImg(blockId) {
    const b = getBlock(blockId);
    if (!b) return;
    b.content = '';
    b.caption = '';
    getPost().updated = Date.now();
    save();
    renderEditor();
  }

  function handleImg(blockId, ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const b = getBlock(blockId);
      if (!b) return;
      b.content = e.target.result;
      getPost().updated = Date.now();
      save();
      renderEditor();
    };
    reader.readAsDataURL(file);
  }

  function backToList() {
    renderList();
  }

  function create() {
    const now = Date.now();
    const p = {
      id: uid(),
      title: '',
      summary: '',
      tags: '',
      blocks: [{ id: uid(), type: 'text', content: '' }],
      status: 'draft',
      coverImg: '',
      created: now,
      updated: now
    };
    data.posts.unshift(p);
    save();
    edit(p.id);
  }

  function edit(id) {
    curPost = id;
    renderEditor();
  }

  function renamePost(id) {
    const p = data.posts.find(x => x.id === id);
    if (!p) return;
    openModal('Rename Post', p.title || '', value => {
      if (!value.trim()) return false;
      p.title = value.trim();
      p.updated = Date.now();
      save();
      renderList();
      return true;
    });
  }

  function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    data.posts = data.posts.filter(p => p.id !== id);
    if (curPost === id) curPost = null;
    save();
    renderList();
  }

  function setSearch(value) {
    listSearch = value;
    renderList();
  }

  function setStatusFilter(value) {
    listStatus = value;
    renderList();
  }

  function clearFilters() {
    listSearch = '';
    listStatus = 'all';
    renderList();
  }

  function openFromSearch(id) {
    edit(id);
  }

  return {
    init,
    edit,
    backToList,
    create,
    saveTitle,
    saveBlock,
    saveCap,
    saveStatus,
    saveTags,
    saveSummary,
    renamePost,
    deletePost,
    add,
    del,
    move,
    dup,
    convert,
    onKey,
    pickImg,
    replaceImg,
    removeImg,
    handleImg,
    setSearch,
    setStatusFilter,
    clearFilters,
    openFromSearch
  };
})();

window.BG = BG;