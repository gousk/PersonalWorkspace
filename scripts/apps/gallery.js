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
      data = { items: [] };
      save();
    }
    data.items.forEach(item => {
      if (item.tags == null) item.tags = '';
      if (item.caption == null) item.caption = '';
      if (item.kind == null) item.kind = (item.mime || '').startsWith('video/') ? 'video' : 'image';
    });
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

  function init() {
    data = load();
    ensure();
    if (!resizeBound) {
      window.addEventListener('resize', scheduleReflow);
      resizeBound = true;
    }
    render();
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
        if (!q) return true;
        const hay = `${item.title} ${item.caption} ${item.tags}`.toLowerCase();
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
      return `<div class="gl-card ${lego}" onclick="GL.open('${item.id}')"><div class="gl-photo-frame">${media}</div></div>`;
    }).join('');

    const tagFilters = ['<button class="gl-chip' + (tagFilter ? '' : ' active') + '" onclick="GL.setTagFilter(\'\')">All tags</button>']
      .concat(tags.map(([tag]) => `<button class="gl-chip${tagFilter === tag ? ' active' : ''}" onclick="GL.setTagFilter(decodeURIComponent('${encodeURIComponent(tag)}'))">#${esc(tag)}</button>`))
      .join('');

    root.innerHTML = `
      <div class="gl-wrap">
        <div class="gl-toolbar">
          <span style="font-size:11px;color:var(--g4)">Media <strong style="color:var(--g2)">${all.length}</strong></span>
          <span style="font-size:11px;color:var(--g4)">Images <strong style="color:var(--g2)">${photos}</strong></span>
          <span style="font-size:11px;color:var(--g4)">Videos <strong style="color:var(--g2)">${videos}</strong></span>
          <span style="font-size:11px;color:var(--g4)">Favorites <strong style="color:var(--g2)">${favorites}</strong></span>
          <div class="gl-filter-group">
            <button class="gl-chip${typeFilter === 'all' ? ' active' : ''}" onclick="GL.setTypeFilter('all')">All</button>
            <button class="gl-chip${typeFilter === 'image' ? ' active' : ''}" onclick="GL.setTypeFilter('image')">Images</button>
            <button class="gl-chip${typeFilter === 'video' ? ' active' : ''}" onclick="GL.setTypeFilter('video')">Videos</button>
            <button class="gl-chip${onlyFavorites ? ' active' : ''}" onclick="GL.toggleFavOnly()">Favs</button>
          </div>
          <input class="ti" placeholder="Search media..." value="${esc(searchTerm)}" oninput="GL.setSearch(this.value)">
          <label class="gl-upload">+ Add Media<input type="file" accept="image/*,video/*,.gif" multiple onchange="GL.handleFiles(event)"></label>
        </div>
        <div class="gl-list">
          <div class="gl-list-title">Gallery</div>
          <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;">${tagFilters}</div>
          <div class="gl-grid">${cards || '<div class="gl-empty">Upload your first media file to start this gallery.</div>'}</div>
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

  function addMediaItem(file, src, done) {
    const base = {
      id: uid(),
      title: nameFromFile(file.name) || 'Untitled',
      caption: '',
      tags: '',
      src,
      favorite: false,
      mime: file.type || '',
      kind: file.type.startsWith('video/') ? 'video' : 'image',
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
      data.items.unshift({ ...base, width: img.naturalWidth, height: img.naturalHeight });
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
      const r = new FileReader();
      r.onload = e => addMediaItem(file, e.target.result, done);
      r.readAsDataURL(file);
    });
    ev.target.value = '';
  }

  function open(id) {
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
      meta.innerHTML = `<div class="lb-meta-title">${esc(item.title || 'Untitled')}</div><div class="lb-meta-sub">${date} | ${kind}</div>${tags ? `<div class="lb-meta-sub">${tags}</div>` : ''}<div class="lb-actions"><button class="lb-btn" onclick="GL.rename('${id}')">Rename</button><button class="lb-btn" onclick="GL.editTags('${id}')">Tags</button><button class="lb-btn" onclick="GL.toggleFav('${id}')">${item.favorite ? 'Unfavorite' : 'Favorite'}</button><button class="lb-btn lb-btn-danger" onclick="GL.deleteFromViewer('${id}')">Delete</button></div>`;
    }

    if (kind === 'video') {
      if (img) {
        img.classList.add('hidden');
        img.removeAttribute('src');
      }
      if (vid) {
        vid.classList.remove('hidden');
        vid.src = item.src;
        vid.currentTime = 0;
        vid.play().catch(() => {});
      }
    } else {
      if (vid) {
        vid.pause();
        vid.removeAttribute('src');
        vid.classList.add('hidden');
        vid.load();
      }
      if (img) {
        img.classList.remove('hidden');
        img.src = item.src;
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
    openFromSearch
  };
})();

window.GL = GL;