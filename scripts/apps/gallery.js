const GL = (function () {
  const SK = 'ws_gallery';
  let data;
  let resizeBound = false;
  let reflowTimer = null;
  let openMediaId = null;
  let typeFilter = 'all';
  let onlyFavorites = false;
  let searchTerm = '';
  let tagFilter = '';
  let folderFilter = 'all'; // 'all' | 'root' | <folderId>
  let compactingMedia = false;

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
      alert('Could not save gallery data. Storage may be full.');
      return false;
    }
  }
  function ensure() {
    if (!data || !Array.isArray(data.items)) {
      data = { items: [], folders: [] };
      save();
    }
    if (!Array.isArray(data.folders)) data.folders = [];
    data.items.forEach(item => {
      if (item.tags == null) item.tags = '';
      if (item.caption == null) item.caption = '';
      if (item.kind == null) item.kind = (item.mime || '').startsWith('video/') ? 'video' : 'image';
      if (item.folderId === undefined) item.folderId = null;
      if (item.folderId && !data.folders.some(f => f.id === item.folderId)) item.folderId = null;
    });
  }

  function getFolder(id) { return data.folders.find(f => f.id === id) || null; }
  function folderName(id) { const f = getFolder(id); return f ? f.name : ''; }
  function uploadDestFolderId() {
    if (folderFilter === 'all' || folderFilter === 'root') return null;
    return data.folders.some(f => f.id === folderFilter) ? folderFilter : null;
  }
  function getOrCreateMoodboardFolder(boardId, boardName) {
    let folder = data.folders.find(f => f.moodboardId === boardId);
    if (folder) {
      if (boardName && folder.name !== boardName) {
        folder.name = boardName;
      }
      return folder;
    }
    folder = { id: uid(), name: boardName || 'Moodboard', moodboardId: boardId, created: Date.now() };
    data.folders.push(folder);
    return folder;
  }
  function renameMoodboardFolder(boardId, newName) {
    const f = data.folders.find(x => x.moodboardId === boardId);
    if (f && newName) { f.name = newName; save(); render(); }
  }

  function getItem(id) {
    return data.items.find(x => x.id === id);
  }
  function nameFromFile(name) {
    return name.replace(/\.[^.]+$/, '').trim();
  }
  function mediaKind(item) {
    if (item.kind === 'video') return 'video';
    if ((item.mime || '').startsWith('video/')) return 'video';
    if ((item.src || '').startsWith('data:video/')) return 'video';
    return 'image';
  }
  function ratioOf(item) {
    return (item.width && item.height) ? (item.width / item.height) : 1;
  }
  function legoClass(item) {
    const r = ratioOf(item);
    if (r >= 1.45) return 'lego-wide';
    if (r <= 0.78) return 'lego-tall';
    return '';
  }
  function tagsOf(item) {
    return String(item.tags || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  }
  function mediaDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('workspace_media_store', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('media');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function mediaSet(key, value) {
    const db = await mediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put(value, key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    });
  }
  async function mediaGet(key) {
    if (!key) return null;
    const db = await mediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const req = tx.objectStore('media').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }
  async function mediaDelete(key) {
    if (!key) return;
    try {
      const db = await mediaDb();
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').delete(key);
      tx.oncomplete = () => db.close();
    } catch {}
  }
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function makeImagePreview(src, maxSide = 1200, quality = 0.78) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth || maxSide, img.naturalHeight || maxSide));
        const w = Math.max(1, Math.round((img.naturalWidth || maxSide) * ratio));
        const h = Math.max(1, Math.round((img.naturalHeight || maxSide) * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ src: canvas.toDataURL('image/jpeg', quality), width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => resolve({ src, width: 0, height: 0 });
      img.src = src;
    });
  }

  function init() {
    data = load();
    ensure();
    if (!resizeBound) {
      window.addEventListener('resize', scheduleReflow);
      resizeBound = true;
    }
    render();
    setTimeout(compactStoredMedia, 250);
  }

  async function compactStoredMedia() {
    if (compactingMedia || !data || !Array.isArray(data.items)) return;
    compactingMedia = true;
    let changed = false;
    try {
      for (const item of data.items) {
        const src = item && item.src || '';
        if (item.mediaKey || !src.startsWith('data:image/')) continue;
        const mediaKey = uid();
        await mediaSet(mediaKey, src);
        const preview = await makeImagePreview(src);
        item.mediaKey = mediaKey;
        item.src = preview.src;
        item.width = item.width || preview.width || 0;
        item.height = item.height || preview.height || 0;
        changed = true;
      }
      if (changed) {
        save();
        render();
      }
    } catch {
      // If IndexedDB is unavailable, keep the existing localStorage data intact.
    } finally {
      compactingMedia = false;
    }
  }

  function tagCloud() {
    const map = new Map();
    data.items.forEach(item => tagsOf(item).forEach(tag => map.set(tag, (map.get(tag) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }

  function visibleItems() {
    const q = searchTerm.trim().toLowerCase();
    return data.items
      .filter(item => {
        const kind = mediaKind(item);
        if (typeFilter !== 'all' && kind !== typeFilter) return false;
        if (onlyFavorites && !item.favorite) return false;
        if (tagFilter && !tagsOf(item).includes(tagFilter)) return false;
        if (folderFilter === 'root' && item.folderId) return false;
        if (folderFilter !== 'all' && folderFilter !== 'root' && item.folderId !== folderFilter) return false;
        if (!q) return true;
        const hay = `${item.title} ${item.caption} ${item.tags} ${folderName(item.folderId)}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));
  }

  function render() {
    const root = document.getElementById('page-gallery');
    const all = data.items;
    const photos = all.filter(i => mediaKind(i) === 'image').length;
    const videos = all.filter(i => mediaKind(i) === 'video').length;
    const favorites = all.filter(i => i.favorite).length;
    const tags = tagCloud();

    const cards = visibleItems().map(item => {
      const title = esc(item.title || 'Untitled');
      const lego = legoClass(item);
      const kind = mediaKind(item);
      const media = kind === 'video'
        ? `<video class="gl-card-video" src="${item.src}" muted playsinline preload="metadata" onloadedmetadata="GL.captureMeta('${item.id}',this.videoWidth,this.videoHeight);GL.reflow()"></video>`
        : `<img class="gl-card-img" src="${item.src}" alt="${title}" loading="lazy" onload="GL.captureMeta('${item.id}',this.naturalWidth,this.naturalHeight);GL.reflow()">`;
      const fName = folderName(item.folderId);
      const folderTag = fName ? `<span class="gl-card-folder">${esc(fName)}</span>` : '';
      return `<div class="gl-card ${lego}" onclick="GL.open('${item.id}')"><div class="gl-photo-frame">${media}${folderTag}</div></div>`;
    }).join('');

    const tagFilters = ['<button class="gl-chip' + (tagFilter ? '' : ' active') + '" onclick="GL.setTagFilter(\'\')">All tags</button>']
      .concat(tags.map(([tag]) => `<button class="gl-chip${tagFilter === tag ? ' active' : ''}" onclick="GL.setTagFilter(decodeURIComponent('${encodeURIComponent(tag)}'))">#${esc(tag)}</button>`))
      .join('');

    const folderOpts = ['<option value="all"' + (folderFilter === 'all' ? ' selected' : '') + '>All folders</option>',
      '<option value="root"' + (folderFilter === 'root' ? ' selected' : '') + '>Root only</option>']
      .concat(data.folders.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => {
        const count = data.items.filter(it => it.folderId === f.id).length;
        return `<option value="${f.id}"${folderFilter === f.id ? ' selected' : ''}>${esc(f.name)} (${count})</option>`;
      })).join('');

    const destLabel = folderFilter === 'all' || folderFilter === 'root' ? 'Root'
      : (folderName(folderFilter) || 'Root');

    root.innerHTML = `
      <div class="gl-wrap">
        <div class="gl-toolbar">
          <div class="gl-toolbar-main">
            <div class="gl-stat-group">
              <span>Media <strong>${all.length}</strong></span>
              <span>Images <strong>${photos}</strong></span>
              <span>Videos <strong>${videos}</strong></span>
              <span>Folders <strong>${data.folders.length}</strong></span>
              <span>Favorites <strong>${favorites}</strong></span>
            </div>
            <div class="gl-filter-group" aria-label="Media filters">
              <button class="gl-chip${typeFilter === 'all' ? ' active' : ''}" onclick="GL.setTypeFilter('all')">All</button>
              <button class="gl-chip${typeFilter === 'image' ? ' active' : ''}" onclick="GL.setTypeFilter('image')">Images</button>
              <button class="gl-chip${typeFilter === 'video' ? ' active' : ''}" onclick="GL.setTypeFilter('video')">Videos</button>
              <button class="gl-chip${onlyFavorites ? ' active' : ''}" onclick="GL.toggleFavOnly()">Favs</button>
            </div>
          </div>
          <div class="gl-toolbar-actions">
            <label class="gl-upload" title="Uploads go to: ${esc(destLabel)}">+ Add<input type="file" accept="image/*,video/*,.gif" multiple onchange="GL.handleFiles(event)"></label>
            <input class="ti gl-search" placeholder="Search media..." value="${esc(searchTerm)}" oninput="GL.setSearch(this.value)">
            <div class="gl-folder-actions">
              <select class="ti gl-folder-sel" onchange="GL.setFolderFilter(this.value)" title="Filter by folder. Uploads go to selected folder.">${folderOpts}</select>
              <button class="nav-btn" onclick="GL.newFolder()" title="Create new folder">+ Folder</button>
              <button class="nav-btn" onclick="GL.manageFolders()" title="Rename or delete folders">Manage</button>
            </div>
          </div>
        </div>
        <div class="gl-list">
          <div class="gl-list-title">Gallery${folderFilter !== 'all' && folderFilter !== 'root' ? ` <span class="gl-list-sub">/ ${esc(folderName(folderFilter))}</span>` : folderFilter === 'root' ? ' <span class="gl-list-sub">/ Root</span>' : ''}</div>
          <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;">${tagFilters}</div>
          <div class="gl-grid">${cards || '<div class="gl-empty">No media here. Upload to populate this view.</div>'}</div>
        </div>
      </div>`;

    requestAnimationFrame(reflow);
    setTimeout(reflow, 120);
  }

  function scheduleReflow() {
    clearTimeout(reflowTimer);
    reflowTimer = setTimeout(reflow, 40);
  }

  function reflow() {
    const grid = document.querySelector('#page-gallery .gl-grid');
    if (!grid) return;
    const row = parseFloat(getComputedStyle(grid).getPropertyValue('grid-auto-rows')) || 1;
    const gap = parseFloat(getComputedStyle(grid).getPropertyValue('row-gap')) || 0;
    grid.querySelectorAll('.gl-card').forEach(card => {
      card.style.gridRowEnd = 'span 1';
      const h = card.getBoundingClientRect().height;
      const span = Math.max(16, Math.ceil((h + gap) / (row + gap)));
      card.style.gridRowEnd = `span ${span}`;
    });
  }

  function captureMeta(id, w, h) {
    const item = getItem(id);
    if (!item || !w || !h) return;
    if (item.width === w && item.height === h) return;
    item.width = w;
    item.height = h;
    save();
    scheduleReflow();
  }

  async function addMediaItem(file, src, done) {
    const mediaKey = uid();
    try { await mediaSet(mediaKey, src); } catch {}
    const isImage = file.type.startsWith('image/');
    const preview = isImage ? await makeImagePreview(src) : { src, width: 0, height: 0 };
    const base = {
      id: uid(),
      title: nameFromFile(file.name) || 'Untitled',
      caption: '',
      tags: '',
      src: preview.src,
      mediaKey,
      favorite: false,
      mime: file.type || '',
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      folderId: uploadDestFolderId(),
      created: Date.now(),
      updated: Date.now()
    };

    if (base.kind === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        data.items.unshift({ ...base, width: video.videoWidth, height: video.videoHeight });
        done();
      };
      video.onerror = () => {
        data.items.unshift(base);
        done();
      };
      video.src = src;
      return;
    }

    const img = new Image();
    img.onload = () => {
      data.items.unshift({ ...base, width: preview.width || img.naturalWidth, height: preview.height || img.naturalHeight });
      done();
    };
    img.onerror = () => {
      data.items.unshift(base);
      done();
    };
    img.src = src;
  }

  function handleFiles(ev) {
    const files = [...(ev.target.files || [])].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!files.length) return;
    let pending = files.length;
    const done = () => {
      pending--;
      if (pending === 0) {
        save();
        render();
      }
    };
    files.forEach(file => {
      fileToDataURL(file).then(src => addMediaItem(file, src, done)).catch(done);
    });
    ev.target.value = '';
  }

  async function open(id) {
    const item = getItem(id);
    if (!item) return;
    openMediaId = id;
    const kind = mediaKind(item);
    const date = new Date(item.updated || item.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const tags = tagsOf(item).map(tag => `<span>#${esc(tag)}</span>`).join(' ');

    const meta = document.getElementById('lb-meta');
    const img = document.getElementById('lb-img');
    const vid = document.getElementById('lb-video');

    if (meta) {
      const fName = folderName(item.folderId);
      const folderLine = fName ? `<div class="lb-meta-sub">Folder: ${esc(fName)}</div>` : '';
      meta.innerHTML = `<div class="lb-meta-title">${esc(item.title || 'Untitled')}</div><div class="lb-meta-sub">${date} | ${kind}</div>${folderLine}${tags ? `<div class="lb-meta-sub">${tags}</div>` : ''}<div class="lb-actions"><button class="lb-btn" onclick="GL.rename('${id}')">Rename</button><button class="lb-btn" onclick="GL.editTags('${id}')">Tags</button><button class="lb-btn" onclick="GL.moveItem('${id}')">Folder</button><button class="lb-btn" onclick="GL.toggleFav('${id}')">${item.favorite ? 'Unfavorite' : 'Favorite'}</button><button class="lb-btn lb-btn-danger" onclick="GL.deleteFromViewer('${id}')">Delete</button></div>`;
    }

    if (kind === 'video') {
      const fullSrc = await mediaGet(item.mediaKey) || item.src;
      if (img) {
        img.classList.add('hidden');
        img.removeAttribute('src');
      }
      if (vid) {
        vid.classList.remove('hidden');
        vid.src = fullSrc;
        vid.currentTime = 0;
        vid.play().catch(() => {});
      }
    } else {
      const fullSrc = await mediaGet(item.mediaKey) || item.src;
      if (vid) {
        vid.pause();
        vid.removeAttribute('src');
        vid.classList.add('hidden');
        vid.load();
      }
      if (img) {
        img.classList.remove('hidden');
        img.src = fullSrc;
      }
    }

    document.getElementById('lightbox').classList.remove('hidden');
  }

  function toggleFav(id) {
    const item = getItem(id);
    if (!item) return;
    item.favorite = !item.favorite;
    item.updated = Date.now();
    save();
    render();
    if (openMediaId === id) open(id);
  }

  function rename(id) {
    const item = getItem(id);
    if (!item) return;
    openModal('Rename Media', item.title || '', value => {
      const v = value.trim();
      if (!v) return false;
      item.title = v;
      item.updated = Date.now();
      save();
      render();
      if (openMediaId === id) open(id);
      return true;
    });
  }

  function editTags(id) {
    const item = getItem(id);
    if (!item) return;
    openModal('Media Tags', item.tags || '', value => {
      item.tags = value.trim();
      item.updated = Date.now();
      save();
      render();
      if (openMediaId === id) open(id);
      return true;
    });
  }

  function deleteItem(id) {
    const item = getItem(id);
    if (!item) return;
    const label = mediaKind(item) === 'video' ? 'video' : 'media';
    if (!confirm(`Delete this ${label}?`)) return;
    data.items = data.items.filter(x => x.id !== id);
    mediaDelete(item.mediaKey);
    save();
    render();
    if (openMediaId === id) {
      openMediaId = null;
      closeLightbox();
    }
  }

  function deleteFromViewer(id) {
    deleteItem(id);
  }
  function clearOpenState() {
    openMediaId = null;
  }

  function setFolderFilter(value) {
    folderFilter = value || 'all';
    render();
  }
  function newFolder() {
    openModal('New Folder', '', name => {
      const v = String(name || '').trim();
      if (!v) return false;
      const folder = { id: uid(), name: v, moodboardId: null, created: Date.now() };
      data.folders.push(folder);
      folderFilter = folder.id;
      save();
      render();
      return true;
    });
  }
  function renameFolder(id) {
    const f = getFolder(id);
    if (!f) return;
    openModal('Rename Folder', f.name, name => {
      const v = String(name || '').trim();
      if (!v) return false;
      f.name = v;
      save();
      render();
      manageFolders();
      return true;
    });
  }
  function deleteFolder(id) {
    const f = getFolder(id);
    if (!f) return;
    const items = data.items.filter(it => it.folderId === id);
    const msg = items.length
      ? `Delete folder "${f.name}"? ${items.length} item(s) will move to Root.`
      : `Delete folder "${f.name}"?`;
    if (!confirm(msg)) return;
    items.forEach(it => { it.folderId = null; it.updated = Date.now(); });
    data.folders = data.folders.filter(x => x.id !== id);
    if (folderFilter === id) folderFilter = 'all';
    save();
    render();
    manageFolders();
  }
  function manageFolders() {
    if (!data.folders.length) {
      openCustomModal('Manage Folders', '<div class="gl-fm-empty">No folders yet. Click "+ Folder" in the toolbar to create one.</div>', null, { showSave: false });
      return;
    }
    const rows = data.folders.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => {
      const count = data.items.filter(it => it.folderId === f.id).length;
      const tag = f.moodboardId ? '<span class="gl-fm-tag">moodboard</span>' : '';
      return `<div class="gl-fm-row"><div class="gl-fm-name">${esc(f.name)} ${tag}</div><div class="gl-fm-meta">${count} item${count === 1 ? '' : 's'}</div><div class="gl-fm-actions"><button class="nav-btn" onclick="GL.renameFolder('${f.id}')">Rename</button><button class="nav-btn gl-fm-del" onclick="GL.deleteFolder('${f.id}')">Delete</button></div></div>`;
    }).join('');
    openCustomModal('Manage Folders', `<div class="gl-fm-list">${rows}</div>`, null, { showSave: false });
  }
  function moveItem(id) {
    const item = getItem(id);
    if (!item) return;
    const folders = data.folders.slice().sort((a, b) => a.name.localeCompare(b.name));
    const opts = [`<option value="">Root</option>`].concat(folders.map(f => `<option value="${f.id}"${item.folderId === f.id ? ' selected' : ''}>${esc(f.name)}</option>`)).join('');
    const body = `<div class="gl-move-form"><label class="gl-move-label">Move "${esc(item.title || 'Untitled')}" to:</label><select id="gl-move-sel" class="ti">${opts}</select><div class="gl-move-hint">Tip: create new folders from the gallery toolbar.</div></div>`;
    openCustomModal('Move to Folder', body, () => {
      const sel = document.getElementById('gl-move-sel');
      const target = sel ? sel.value : '';
      item.folderId = target || null;
      item.updated = Date.now();
      save();
      render();
      if (openMediaId === id) open(id);
      return true;
    }, { saveLabel: 'Move' });
  }

  function setTypeFilter(type) {
    typeFilter = type;
    render();
  }
  function toggleFavOnly() {
    onlyFavorites = !onlyFavorites;
    render();
  }
  function setSearch(value) {
    searchTerm = value;
    render();
  }
  function setTagFilter(tag) {
    tagFilter = tag || '';
    render();
  }

  function openFromSearch(id) {
    render();
    setTimeout(() => open(id), 60);
  }

  function getOrCreateMoodboardFolderExternal(boardId, boardName) {
    if (!data) { data = load(); ensure(); }
    const f = getOrCreateMoodboardFolder(boardId, boardName);
    save();
    return f.id;
  }
  function renameMoodboardFolderExternal(boardId, newName) {
    if (!data) { data = load(); ensure(); }
    renameMoodboardFolder(boardId, newName);
  }

  return {
    init,
    handleFiles,
    open,
    toggleFav,
    rename,
    editTags,
    deleteItem,
    deleteFromViewer,
    reflow,
    captureMeta,
    clearOpenState,
    setTypeFilter,
    toggleFavOnly,
    setSearch,
    setTagFilter,
    setFolderFilter,
    newFolder,
    renameFolder,
    deleteFolder,
    manageFolders,
    moveItem,
    getOrCreateMoodboardFolder: getOrCreateMoodboardFolderExternal,
    renameMoodboardFolder: renameMoodboardFolderExternal,
    openFromSearch
  };
})();

window.GL = GL;
