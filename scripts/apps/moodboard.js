const MB = (function () {
  const SK = 'ws_moodboard';
  const DEFAULT_BG = '#000000';
  const DEFAULT_DOT_STRENGTH = 8;
  const CANVAS_W = 3200;
  const CANVAS_H = 1800;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2.5;
  let data;
  let curBoard = null;
  let selectedId = null;
  let drag = null;
  let mousePan = null;
  let activePointerId = null;
  let lastTextClick = null;
  let centeredBoardId = null;
  const boardScroll = {};
  let _bound = false;

  function load() { try { return JSON.parse(localStorage.getItem(SK)) || null; } catch { return null; } }
  function save() {
    if (window.WSStorage) return WSStorage.setJSON(SK, data);
    try { localStorage.setItem(SK, JSON.stringify(data)); return true; }
    catch { alert('Could not save moodboard data. Storage may be full.'); return false; }
  }
  function ensure() {
    if (!data || !Array.isArray(data.boards)) data = { boards: [] };
    data.boards.forEach(b => {
      if (!b.id) b.id = uid();
      if (!b.bgColor) b.bgColor = DEFAULT_BG;
      if (b.dotsVisible == null) b.dotsVisible = true;
      if (b.dotStrength == null) b.dotStrength = DEFAULT_DOT_STRENGTH;
      if (b.zoom == null) b.zoom = 1;
      if (!Array.isArray(b.items)) b.items = [];
      if (b.tags == null) b.tags = '';
      if (!b.created) b.created = Date.now();
      if (!b.updated) b.updated = Date.now();
      b.items.forEach(it => {
        if (it.x == null) it.x = 80;
        if (it.y == null) it.y = 80;
        if (it.w == null) it.w = 240;
        if (it.h == null) it.h = 200;
        if (it.rot == null) it.rot = 0;
        if (it.z == null) it.z = 1;
        clampItemToCanvas(it);
      });
    });
  }

  function init() {
    data = load();
    ensure();
    save();
    if (!_bound) {
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', syncEmptyOverlay);
      _bound = true;
    }
    selectedId = null;
    if (curBoard && data.boards.some(b => b.id === curBoard)) renderBoard();
    else { curBoard = null; renderHub(); }
  }

  function isActive() {
    const el = document.getElementById('page-moodboard');
    return el && !el.classList.contains('hidden');
  }
  function getBoard(id) { return data.boards.find(b => b.id === (id || curBoard)); }
  function getItem(id) { const b = getBoard(); return b ? b.items.find(x => x.id === id) : null; }
  function nextZ() { const b = getBoard(); if (!b || !b.items.length) return 1; return Math.max(...b.items.map(x => x.z || 0)) + 1; }
  function getMinZoom(wrap) {
    if (!wrap) return MIN_ZOOM;
    return Math.max(MIN_ZOOM, wrap.clientWidth / CANVAS_W, wrap.clientHeight / CANVAS_H);
  }
  function getZoom(wrap) {
    const b = getBoard();
    const z = b && Number(b.zoom);
    return Number.isFinite(z) ? Math.max(getMinZoom(wrap), Math.min(MAX_ZOOM, z)) : Math.max(getMinZoom(wrap), 1);
  }
  function hexToRgb(hex) {
    const v = String(hex || '').trim().replace('#', '');
    const full = v.length === 3 ? v.split('').map(x => x + x).join('') : v;
    if (!/^[0-9a-f]{6}$/i.test(full)) return null;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    };
  }
  function getDotColor(bgColor) {
    return getCanvasInk(bgColor, 0.1);
  }
  function getRelativeLuminance(rgb) {
    const convert = v => {
      const n = v / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * convert(rgb.r) + 0.7152 * convert(rgb.g) + 0.0722 * convert(rgb.b);
  }
  function getCanvasInk(bgColor, alpha) {
    const rgb = hexToRgb(bgColor);
    if (!rgb) return `rgba(255,255,255,${alpha})`;
    const lum = getRelativeLuminance(rgb);
    const blackContrast = (lum + 0.05) / 0.05;
    const whiteContrast = 1.05 / (lum + 0.05);
    const ink = blackContrast >= whiteContrast ? '0,0,0' : '255,255,255';
    return `rgba(${ink},${alpha})`;
  }
  function getDotStyle(board) {
    const bg = (board && board.bgColor) || DEFAULT_BG;
    const rawStrength = board && board.dotStrength != null ? Number(board.dotStrength) : DEFAULT_DOT_STRENGTH;
    const strength = Math.max(0, Math.min(100, Number.isFinite(rawStrength) ? rawStrength : DEFAULT_DOT_STRENGTH));
    if (board && board.dotsVisible === false) return {
      dot: 'transparent',
      empty: getCanvasInk(bg, 0.42)
    };
    const rgb = hexToRgb(bg);
    const lum = rgb ? getRelativeLuminance(rgb) : 0;
    const prefersDarkInk = lum > 0.18;
    const alpha = strength / 100;
    return {
      dot: getCanvasInk(bg, Number(alpha.toFixed(3))),
      empty: getCanvasInk(bg, prefersDarkInk ? 0.58 : 0.5)
    };
  }

  function renderHub() {
    curBoard = null;
    selectedId = null;
    const root = document.getElementById('page-moodboard');
    const totalItems = data.boards.reduce((s, b) => s + b.items.length, 0);
    let html = `<div class="mb-hub-bar"><span>Boards <strong>${data.boards.length}</strong></span><span>Items <strong>${totalItems}</strong></span></div><div class="mb-hub"><div class="mb-hub-title">All Moodboards</div><div class="mb-hub-grid">`;
    data.boards.forEach(b => {
      const previews = b.items.filter(x => x.type !== 'text').slice(0, 4);
      const cells = previews.map(it => it.type === 'video'
        ? `<video src="${it.src}" muted playsinline preload="metadata"></video>`
        : `<img src="${it.src}" alt="" draggable="false">`).join('');
      const tagBits = (b.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 3).map(t => `<span>#${esc(t)}</span>`).join(' ');
      html += `<div class="mb-board-card" style="background:${esc(b.bgColor || DEFAULT_BG)}" onclick="MB.goBoard('${b.id}')">
        <div class="mb-board-card-actions"><button class="be" onclick="event.stopPropagation();MB.renameBoard('${b.id}')">rename</button><button class="bd" onclick="event.stopPropagation();MB.deleteBoard('${b.id}')">delete</button></div>
        <div class="mb-board-card-preview${previews.length ? '' : ' empty'}">${cells || '<div class="mb-prev-empty">Empty</div>'}</div>
        <div class="mb-board-card-name">${esc(b.name)}</div>
        <div class="mb-board-card-meta"><span>${b.items.length} items</span>${tagBits ? `<span class="mb-board-card-tags">${tagBits}</span>` : ''}</div>
      </div>`;
    });
    html += '<button class="mb-new-board" onclick="MB.createBoard()">+ New Moodboard</button></div></div>';
    root.innerHTML = html;
  }

  function createBoard() {
    openModal('New Moodboard', '', name => {
      if (!name.trim()) return false;
      const id = uid();
      data.boards.push({ id, name: name.trim(), bgColor: DEFAULT_BG, dotsVisible: true, dotStrength: DEFAULT_DOT_STRENGTH, tags: '', items: [], created: Date.now(), updated: Date.now() });
      save();
      curBoard = id;
      renderBoard();
      return true;
    });
  }
  function renameBoard(id) {
    const b = getBoard(id); if (!b) return;
    openModal('Rename Moodboard', b.name, name => {
      if (!name.trim()) return false;
      b.name = name.trim(); b.updated = Date.now(); save();
      syncGalleryFolderName(b);
      if (curBoard === id) renderBoard(); else renderHub();
      return true;
    });
  }
  function deleteBoard(id) {
    if (!confirm('Delete this moodboard?')) return;
    data.boards = data.boards.filter(b => b.id !== id);
    save();
    if (curBoard === id) curBoard = null;
    renderHub();
  }
  function goBoard(id) { curBoard = id; selectedId = null; renderBoard(); }
  function goHub() { renderHub(); }

  function renderBoard() {
    const b = getBoard();
    if (!b) return renderHub();
    const root = document.getElementById('page-moodboard');
    const oldWrap = document.getElementById('mb-canvas-wrap');
    if (oldWrap) boardScroll[b.id] = { left: oldWrap.scrollLeft, top: oldWrap.scrollTop };
    const items = [...b.items].sort((a, c) => (a.z || 0) - (c.z || 0));
    const tagBits = (b.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => `<span>#${esc(t)}</span>`).join('');
    const imgN = b.items.filter(x => x.type === 'image').length;
    const vidN = b.items.filter(x => x.type === 'video').length;
    const txtN = b.items.filter(x => x.type === 'text').length;
    root.innerHTML = `
      <div class="mb-board-nav">
        <button class="nav-btn" onclick="MB.goHub()">&#8592; Boards</button>
        <span class="bl-sep">|</span>
        <span class="bl-bnd">${esc(b.name)}</span>
        <div class="mb-nav-actions">
          <button class="nav-btn" onclick="MB.openAssetPicker()">+ Asset</button>
          <button class="nav-btn" onclick="MB.addText()">+ Text</button>
          <button class="nav-btn" onclick="MB.editTags()">Tags</button>
          <label class="nav-btn mb-bg-pick" title="Background color">BG<input type="color" value="${esc(b.bgColor || DEFAULT_BG)}" oninput="MB.setBg(this.value)"></label>
          <button class="nav-btn${b.dotsVisible === false ? '' : ' active'}" onclick="MB.toggleDots()" title="Show or hide canvas dots">Dots</button>
          <label class="mb-dot-range" title="Dot intensity"><span>Dot alpha</span><input type="range" min="0" max="100" value="${b.dotStrength != null ? Number(b.dotStrength) : DEFAULT_DOT_STRENGTH}" oninput="MB.setDotStrength(this.value)"></label>
        </div>
      </div>
      <div class="mb-stats-bar">
        <span>Items <strong>${b.items.length}</strong></span>
        <span>Images <strong>${imgN}</strong></span>
        <span>Videos <strong>${vidN}</strong></span>
        <span>Text <strong>${txtN}</strong></span>
        ${tagBits ? `<span class="mb-stats-tags">${tagBits}</span>` : ''}
      </div>
      <div class="mb-canvas-wrap" id="mb-canvas-wrap">
        <div class="mb-canvas" id="mb-canvas" style="width:${CANVAS_W * getZoom()}px;height:${CANVAS_H * getZoom()}px;background-color:${esc(b.bgColor || DEFAULT_BG)};--mb-dot-color:${getDotStyle(b).dot};--mb-empty-color:${getDotStyle(b).empty};--mb-dot-size:${22 * getZoom()}px;--mb-dot-radius:${Math.max(0.4, getZoom())}px;--mb-dot-fade:${Math.max(0.7, 1.4 * getZoom())}px">
          ${items.map(renderItem).join('')}
        </div>
        ${b.items.length ? '' : `<div class="mb-empty" style="color:${getDotStyle(b).empty}">Drop images / videos here, or use the buttons above. Click an item to select; drag corners to scale; top knob to rotate.</div>`}
      </div>
      <div class="mb-sel-bar${selectedId ? ' visible' : ''}" id="mb-sel-bar"></div>
    `;
    bindBoard();
    renderSelBar();
    restoreOrCenterCanvas(b.id);
  }

  function restoreOrCenterCanvas(boardId) {
    const wrap = document.getElementById('mb-canvas-wrap');
    const canvas = document.getElementById('mb-canvas');
    if (!wrap || !canvas) return;
    requestAnimationFrame(() => {
      const b = getBoard(boardId);
      const z = getZoom(wrap);
      if (b && b.zoom !== z) b.zoom = z;
      applyZoomToDom();
      const saved = boardScroll[boardId];
      if (saved) {
        wrap.scrollLeft = clampScrollLeft(saved.left, wrap);
        wrap.scrollTop = clampScrollTop(saved.top, wrap);
      } else if (centeredBoardId !== boardId) {
        wrap.scrollLeft = clampScrollLeft((canvas.scrollWidth - wrap.clientWidth) / 2, wrap);
        wrap.scrollTop = clampScrollTop((canvas.scrollHeight - wrap.clientHeight) / 2, wrap);
      }
      centeredBoardId = boardId;
      rememberCanvasScroll();
      syncEmptyOverlay();
    });
  }

  function renderItem(it) {
    const z = getZoom();
    const sel = it.id === selectedId ? ' selected' : '';
    const tf = `transform:rotate(${it.rot || 0}deg);`;
    let inner = '';
    if (it.type === 'image') inner = `<img src="${it.src}" draggable="false">`;
    else if (it.type === 'video') inner = `<video src="${it.src}" muted loop playsinline autoplay></video>`;
    else if (it.type === 'text') {
      const fam = it.font === 'serif' ? 'var(--serif)' : it.font === 'mono' ? 'var(--mono)' : 'var(--body)';
      inner = `<div class="mb-text" style="color:${esc(it.color || '#fff')};font-size:${(Number(it.fontSize) || 32) * z}px;font-family:${fam};font-weight:${it.weight || 400};font-style:${it.italic ? 'italic' : 'normal'};text-align:${it.align || 'left'};">${esc(it.text || 'Double-click to edit')}</div>`;
    }
    return `<div class="mb-item${sel} mb-${it.type}" data-id="${it.id}" style="left:${it.x * z}px;top:${it.y * z}px;width:${it.w * z}px;height:${it.h * z}px;z-index:${it.z || 1};${tf}">
      ${inner}
      <div class="mb-handle mb-handle-rotate" data-action="rotate" title="Rotate"></div>
      <div class="mb-handle mb-handle-resize" data-action="resize" title="Resize"></div>
    </div>`;
  }

  function bindBoard() {
    const canvas = document.getElementById('mb-canvas');
    const wrap = document.getElementById('mb-canvas-wrap');
    if (!canvas) return;
    if (wrap) {
      wrap.addEventListener('mousedown', onWrapMouseDown);
      wrap.addEventListener('scroll', () => { rememberCanvasScroll(); syncEmptyOverlay(); });
      wrap.addEventListener('wheel', onCanvasWheel, { passive: false });
      wrap.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
      wrap.addEventListener('contextmenu', e => { if (mousePan) e.preventDefault(); });
    }
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
    canvas.addEventListener('dragover', e => e.preventDefault());
    canvas.addEventListener('drop', onCanvasDrop);
    canvas.addEventListener('dblclick', e => {
      const itemEl = e.target.closest('.mb-item.mb-text');
      if (!itemEl) return;
      e.preventDefault();
      e.stopPropagation();
      editTextInline(itemEl.dataset.id);
    });
  }

  function onCanvasPointerDown(e) {
    const canvas = e.currentTarget;
    if (e.button === 1) {
      const wrap = document.getElementById('mb-canvas-wrap');
      if (!wrap) return;
      e.preventDefault();
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
      activePointerId = e.pointerId;
      canvas.classList.add('panning');
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target && e.target.isContentEditable) return;
    const itemEl = e.target.closest('.mb-item');
    if (!itemEl) {
      if (selectedId) { selectedId = null; refreshSelection(); }
      return;
    }
    const id = itemEl.dataset.id;
    const item = getItem(id);
    if (!item) return;
    if (selectedId !== id) {
      selectedId = id;
      bringToFront(id, false);
      refreshSelection();
    }
    const action = (e.target.dataset && e.target.dataset.action) || 'move';
    if (item.type === 'text' && action === 'move') {
      const now = Date.now();
      const isDouble = e.detail >= 2 || (lastTextClick && lastTextClick.id === id && now - lastTextClick.time < 420);
      lastTextClick = { id, time: now };
      if (isDouble) {
        e.preventDefault();
        editTextInline(id);
        return;
      }
    } else {
      lastTextClick = null;
    }
    // preventDefault only on handle drags so dblclick on text body still fires
    if (action !== 'move') e.preventDefault();
    if (action === 'resize') {
      const ratio = item.w && item.h ? item.h / item.w : 1;
      drag = { id, kind: 'resize', sx: e.clientX, sy: e.clientY, sw: item.w, sh: item.h, ratio, type: item.type, rot: item.rot || 0 };
    } else if (action === 'rotate') {
      const r = itemEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const sa = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      drag = { id, kind: 'rotate', sa, sr: item.rot || 0, cx, cy };
    } else {
      drag = { id, kind: 'move', sx: e.clientX, sy: e.clientY, ix: item.x, iy: item.y };
    }
    activePointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  }

  function onWrapMouseDown(e) {
    if (e.button !== 1 || mousePan) return;
    const wrap = document.getElementById('mb-canvas-wrap');
    const canvas = document.getElementById('mb-canvas');
    if (!wrap || !canvas) return;
    e.preventDefault();
    mousePan = { sx: e.clientX, sy: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
    canvas.classList.add('panning');
    document.addEventListener('mousemove', onMousePanMove);
    document.addEventListener('mouseup', onMousePanUp);
  }

  function onMousePanMove(e) {
    if (!mousePan) return;
    const wrap = document.getElementById('mb-canvas-wrap');
    if (!wrap) return;
    wrap.scrollLeft = clampScrollLeft(mousePan.sl - (e.clientX - mousePan.sx), wrap);
    wrap.scrollTop = clampScrollTop(mousePan.st - (e.clientY - mousePan.sy), wrap);
    rememberCanvasScroll();
    syncEmptyOverlay();
  }

  function onMousePanUp(e) {
    if (!mousePan || e.button !== 1) return;
    mousePan = null;
    const canvas = document.getElementById('mb-canvas');
    if (canvas) canvas.classList.remove('panning');
    document.removeEventListener('mousemove', onMousePanMove);
    document.removeEventListener('mouseup', onMousePanUp);
  }

  function onCanvasWheel(e) {
    const b = getBoard();
    const wrap = document.getElementById('mb-canvas-wrap');
    if (!b || !wrap) return;
    e.preventDefault();
    const oldZoom = getZoom(wrap);
    const anchorX = wrap.clientWidth / 2;
    const anchorY = wrap.clientHeight / 2;
    const logicalX = (wrap.scrollLeft + anchorX) / oldZoom;
    const logicalY = (wrap.scrollTop + anchorY) / oldZoom;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const next = Math.max(getMinZoom(wrap), Math.min(MAX_ZOOM, oldZoom * factor));
    if (Math.abs(next - oldZoom) < 0.001) return;
    b.zoom = Number(next.toFixed(3));
    save();
    applyZoomToDom();
    wrap.scrollLeft = clampScrollLeft(logicalX * b.zoom - anchorX, wrap);
    wrap.scrollTop = clampScrollTop(logicalY * b.zoom - anchorY, wrap);
    rememberCanvasScroll();
    syncEmptyOverlay();
  }

  function applyZoomToDom() {
    const canvas = document.getElementById('mb-canvas');
    const b = getBoard();
    if (!canvas || !b) return;
    const wrap = document.getElementById('mb-canvas-wrap');
    const z = getZoom(wrap);
    canvas.style.width = (CANVAS_W * z) + 'px';
    canvas.style.height = (CANVAS_H * z) + 'px';
    canvas.style.setProperty('--mb-dot-size', (22 * z) + 'px');
    canvas.style.setProperty('--mb-dot-radius', Math.max(0.4, z) + 'px');
    canvas.style.setProperty('--mb-dot-fade', Math.max(0.7, 1.4 * z) + 'px');
    b.items.forEach(applyItemStyle);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== activePointerId) return;
    if (drag.kind === 'pan') {
      const wrap = document.getElementById('mb-canvas-wrap');
      if (!wrap) return;
      wrap.scrollLeft = clampScrollLeft(drag.sl - (e.clientX - drag.sx), wrap);
      wrap.scrollTop = clampScrollTop(drag.st - (e.clientY - drag.sy), wrap);
      rememberCanvasScroll();
      syncEmptyOverlay();
      return;
    }
    const item = getItem(drag.id);
    if (!item) return;
    const z = getZoom();
    if (drag.kind === 'move') {
      item.x = Math.round(drag.ix + (e.clientX - drag.sx) / z);
      item.y = Math.round(drag.iy + (e.clientY - drag.sy) / z);
      clampItemToCanvas(item);
    } else if (drag.kind === 'resize') {
      const dx = (e.clientX - drag.sx) / z;
      const dy = (e.clientY - drag.sy) / z;
      const a = -drag.rot * Math.PI / 180;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      let w = Math.max(40, drag.sw + lx);
      let h = Math.max(24, drag.sh + ly);
      if ((drag.type === 'image' || drag.type === 'video') && !e.shiftKey) {
        h = Math.max(24, Math.round(w * drag.ratio));
      }
      item.w = Math.round(w); item.h = Math.round(h);
      clampItemSizeToCanvas(item);
    } else if (drag.kind === 'rotate') {
      const angle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180 / Math.PI;
      let r = drag.sr + (angle - drag.sa);
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      item.rot = r;
    }
    applyItemStyle(item);
  }

  function onPointerUp(e) {
    if (!drag) return;
    if (e.pointerId !== activePointerId) return;
    const canvas = e.currentTarget;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    activePointerId = null;
    canvas.classList.remove('panning');
    if (drag.kind === 'pan') { drag = null; return; }
    const b = getBoard(); if (b) b.updated = Date.now();
    save();
    drag = null;
  }

  function applyItemStyle(item) {
    const el = document.querySelector(`#mb-canvas .mb-item[data-id="${item.id}"]`);
    if (!el) return;
    const z = getZoom();
    el.style.left = (item.x * z) + 'px';
    el.style.top = (item.y * z) + 'px';
    el.style.width = (item.w * z) + 'px';
    el.style.height = (item.h * z) + 'px';
    el.style.transform = `rotate(${item.rot || 0}deg)`;
    el.style.zIndex = item.z || 1;
    const text = el.querySelector('.mb-text');
    if (text && item.type === 'text') text.style.fontSize = ((Number(item.fontSize) || 32) * z) + 'px';
  }

  function refreshSelection() {
    document.querySelectorAll('#mb-canvas .mb-item').forEach(el => el.classList.toggle('selected', el.dataset.id === selectedId));
    renderSelBar();
  }

  function renderSelBar() {
    const bar = document.getElementById('mb-sel-bar');
    if (!bar) return;
    const item = getItem(selectedId);
    if (!item) { bar.classList.remove('visible'); bar.innerHTML = ''; return; }
    bar.classList.add('visible');
    let extra = '';
    if (item.type === 'text') {
      const w = Number(item.weight) || 400;
      const fnt = item.font || 'body';
      const al = item.align || 'left';
      extra = `
        <span class="mb-sel-divider"></span>
        <label class="mb-sel-prop"><span>Color</span><input type="color" value="${esc(item.color || '#ffffff')}" oninput="MB.setText('color', this.value)"></label>
        <label class="mb-sel-prop"><span>Size</span><input type="number" min="8" max="240" value="${Number(item.fontSize) || 32}" onchange="MB.setText('fontSize', this.value)"></label>
        <label class="mb-sel-prop"><span>Font</span><select onchange="MB.setText('font', this.value)">
          <option value="body"${fnt === 'body' ? ' selected' : ''}>Sans</option>
          <option value="serif"${fnt === 'serif' ? ' selected' : ''}>Serif</option>
          <option value="mono"${fnt === 'mono' ? ' selected' : ''}>Mono</option>
        </select></label>
        <label class="mb-sel-prop"><span>Weight</span><select onchange="MB.setText('weight', this.value)">
          <option value="400"${w === 400 ? ' selected' : ''}>400</option>
          <option value="500"${w === 500 ? ' selected' : ''}>500</option>
          <option value="600"${w === 600 ? ' selected' : ''}>600</option>
          <option value="700"${w === 700 ? ' selected' : ''}>700</option>
        </select></label>
        <label class="mb-sel-prop"><span>Align</span><select onchange="MB.setText('align', this.value)">
          <option value="left"${al === 'left' ? ' selected' : ''}>Left</option>
          <option value="center"${al === 'center' ? ' selected' : ''}>Center</option>
          <option value="right"${al === 'right' ? ' selected' : ''}>Right</option>
        </select></label>
        <button class="nav-btn${item.italic ? ' active' : ''}" onclick="MB.setText('italic', ${!item.italic})" title="Italic"><em>I</em></button>
        <button class="nav-btn" onclick="MB.editText()">Edit</button>`;
    }
    bar.innerHTML = `
      <span class="mb-sel-label">${esc(item.type.toUpperCase())}</span>
      <button class="nav-btn" onclick="MB.bringToFrontExt('${item.id}')">Front</button>
      <button class="nav-btn" onclick="MB.sendToBack('${item.id}')">Back</button>
      <button class="nav-btn" onclick="MB.duplicate('${item.id}')">Duplicate</button>
      ${extra}
      <button class="nav-btn mb-del" onclick="MB.deleteItem('${item.id}')">Delete</button>
    `;
  }

  function onCanvasDrop(e) {
    e.preventDefault();
    const files = [...((e.dataTransfer && e.dataTransfer.files) || [])].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!files.length) return;
    const wrap = document.getElementById('mb-canvas-wrap');
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const z = getZoom();
    addFiles(files, { x: (wrap.scrollLeft + e.clientX - r.left) / z, y: (wrap.scrollTop + e.clientY - r.top) / z });
  }

  function onKey(e) {
    if (!isActive() || !curBoard) return;
    if (typeof isTypingTarget === 'function' && isTypingTarget(document.activeElement)) return;
    if (e.target && e.target.isContentEditable) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedId) { e.preventDefault(); deleteItem(selectedId); }
    } else if (e.key === 'Escape') {
      if (selectedId) { selectedId = null; refreshSelection(); }
    }
  }

  function handleFiles(ev, forced) {
    const files = [...(ev.target.files || [])].filter(f => forced ? f.type.startsWith(forced + '/') : (f.type.startsWith('image/') || f.type.startsWith('video/')));
    addFiles(files, getViewportCenterPoint());
    ev.target.value = '';
  }

  function galleryAssets() {
    try {
      const gal = JSON.parse(localStorage.getItem('ws_gallery') || 'null') || { items: [] };
      return (gal.items || []).filter(item => {
        const src = item.src || '';
        const mime = item.mime || '';
        return src.startsWith('data:image/') || src.startsWith('data:video/') || mime.startsWith('image/') || mime.startsWith('video/') || item.kind === 'image' || item.kind === 'video';
      });
    } catch {
      return [];
    }
  }

  function mediaKindFromAsset(asset) {
    const src = asset && asset.src || '';
    const mime = asset && asset.mime || '';
    if ((asset && asset.kind) === 'video' || mime.startsWith('video/') || src.startsWith('data:video/')) return 'video';
    return 'image';
  }

  function openAssetPicker() {
    const assets = galleryAssets();
    const cards = assets.slice(0, 80).map(asset => {
      const kind = mediaKindFromAsset(asset);
      const media = kind === 'video'
        ? `<video src="${asset.src}" muted playsinline preload="metadata"></video>`
        : `<img src="${asset.src}" alt="">`;
      return `<button class="mb-asset-card" onclick="MB.addGalleryAsset('${asset.id}')">${media}<span>${esc(asset.title || 'Untitled')}</span></button>`;
    }).join('');
    const body = `
      <div class="mb-asset-picker">
        <div class="mb-asset-upload" id="mb-asset-drop" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="MB.dropAssetFiles(event)">
          <div class="mb-asset-upload-title">Upload or drop media</div>
          <div class="mb-asset-upload-sub">Images, videos, GIFs</div>
          <label class="nav-btn">Browse<input type="file" accept="image/*,video/*,.gif" multiple onchange="MB.handleAssetUpload(event)"></label>
        </div>
        <div class="mb-asset-section-title">Gallery Assets</div>
        <div class="mb-asset-grid">${cards || '<div class="mb-asset-empty">No gallery assets yet.</div>'}</div>
      </div>`;
    openCustomModal('Add Asset', body, null, { showSave: false });
  }

  function handleAssetUpload(ev) {
    const files = [...(ev.target.files || [])].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    addFiles(files, getViewportCenterPoint());
    ev.target.value = '';
    closeModal();
  }

  function dropAssetFiles(ev) {
    ev.preventDefault();
    const drop = document.getElementById('mb-asset-drop');
    if (drop) drop.classList.remove('drag');
    const files = [...((ev.dataTransfer && ev.dataTransfer.files) || [])].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    addFiles(files, getViewportCenterPoint());
    closeModal();
  }

  function addGalleryAsset(id) {
    const asset = galleryAssets().find(x => x.id === id);
    if (!asset) return;
    addExistingMediaItem(asset);
    closeModal();
  }

  function addExistingMediaItem(asset) {
    const b = getBoard(); if (!b) return;
    const id = uid();
    const type = mediaKindFromAsset(asset);
    const center = getViewportCenterPoint() || { x: 100, y: 100 };
    const w = Math.min(320, Number(asset.width) || 280);
    const ratio = asset.width && asset.height ? asset.height / asset.width : 0.75;
    const h = Math.max(40, Math.round(w * ratio));
    const pos = clampToViewport(center.x - w / 2, center.y - h / 2, w, h);
    b.items.push({ id, type, src: asset.src, mime: asset.mime || '', x: pos.x, y: pos.y, w, h, rot: 0, z: nextZ(), galleryId: asset.id, galleryFolderId: asset.folderId || null });
    b.updated = Date.now();
    selectedId = id;
    save();
    renderBoard();
  }

  function getViewportCenterPoint() {
    const wrap = document.getElementById('mb-canvas-wrap');
    if (!wrap) return null;
    const z = getZoom();
    return {
      x: (wrap.scrollLeft + wrap.clientWidth / 2) / z,
      y: (wrap.scrollTop + wrap.clientHeight / 2) / z
    };
  }

  function rememberCanvasScroll() {
    const b = getBoard();
    const wrap = document.getElementById('mb-canvas-wrap');
    if (!b || !wrap) return;
    boardScroll[b.id] = { left: wrap.scrollLeft, top: wrap.scrollTop };
  }

  function clampScrollLeft(value, wrap) {
    if (!wrap) return Math.max(0, value || 0);
    return Math.max(0, Math.min(value || 0, Math.max(0, wrap.scrollWidth - wrap.clientWidth)));
  }

  function clampScrollTop(value, wrap) {
    if (!wrap) return Math.max(0, value || 0);
    return Math.max(0, Math.min(value || 0, Math.max(0, wrap.scrollHeight - wrap.clientHeight)));
  }

  function syncEmptyOverlay() {
    const wrap = document.getElementById('mb-canvas-wrap');
    const empty = wrap && wrap.querySelector('.mb-empty');
    if (!wrap || !empty) return;
    const r = wrap.getBoundingClientRect();
    empty.style.position = 'fixed';
    empty.style.left = r.left + 'px';
    empty.style.top = r.top + 'px';
    empty.style.width = r.width + 'px';
    empty.style.height = r.height + 'px';
    empty.style.transform = 'none';
  }

  function clampItemToCanvas(item) {
    if (!item) return item;
    item.x = Math.round(Math.min(Math.max(Number(item.x) || 0, 0), Math.max(0, CANVAS_W - (Number(item.w) || 0))));
    item.y = Math.round(Math.min(Math.max(Number(item.y) || 0, 0), Math.max(0, CANVAS_H - (Number(item.h) || 0))));
    return item;
  }

  function clampItemSizeToCanvas(item) {
    if (!item) return item;
    item.w = Math.round(Math.max(40, Math.min(Number(item.w) || 40, CANVAS_W - (Number(item.x) || 0))));
    item.h = Math.round(Math.max(24, Math.min(Number(item.h) || 24, CANVAS_H - (Number(item.y) || 0))));
    clampItemToCanvas(item);
    return item;
  }

  function clampToViewport(x, y, w, h) {
    const wrap = document.getElementById('mb-canvas-wrap');
    if (!wrap) return { x, y };
    const z = getZoom();
    const minX = wrap.scrollLeft / z;
    const minY = wrap.scrollTop / z;
    const maxX = (wrap.scrollLeft + Math.max(0, wrap.clientWidth - w * z)) / z;
    const maxY = (wrap.scrollTop + Math.max(0, wrap.clientHeight - h * z)) / z;
    const lowX = Math.max(0, Math.min(minX, CANVAS_W - w));
    const lowY = Math.max(0, Math.min(minY, CANVAS_H - h));
    const highX = Math.max(lowX, Math.min(CANVAS_W - w, maxX));
    const highY = Math.max(lowY, Math.min(CANVAS_H - h, maxY));
    return {
      x: Math.round(Math.min(Math.max(x, lowX), highX)),
      y: Math.round(Math.min(Math.max(y, lowY), highY))
    };
  }

  function addFiles(files, dropAt) {
    if (!files.length) return;
    let i = 0;
    files.forEach(file => {
      const offset = i++;
      const r = new FileReader();
      r.onload = e => {
        const isVideo = file.type.startsWith('video/');
        addMediaItem(file, e.target.result, isVideo ? 'video' : 'image', dropAt, offset);
      };
      r.readAsDataURL(file);
    });
  }

  function addMediaItem(file, dataUrl, type, dropAt, offset) {
    const b = getBoard(); if (!b) return;
    const id = uid();
    const center = dropAt || getViewportCenterPoint() || { x: 100, y: 100 };
    const baseX = center.x + (offset || 0) * 24;
    const baseY = center.y + (offset || 0) * 24;
    const initial = clampToViewport(baseX - 140, baseY - 110, 280, 220);
    const item = { id, type, src: dataUrl, mime: file.type, x: initial.x, y: initial.y, w: 280, h: 220, rot: 0, z: nextZ() };
    b.items.push(item);
    b.updated = Date.now();
    pushToGallery(b, file, dataUrl, type, item);
    save();
    renderBoard();
    if (type === 'image') {
      const img = new Image();
      img.onload = () => {
        const maxW = 320;
        const ratio = img.naturalHeight / img.naturalWidth || 0.75;
        item.w = Math.min(maxW, img.naturalWidth || maxW);
        item.h = Math.max(40, Math.round(item.w * ratio));
        const pos = clampToViewport(baseX - item.w / 2, baseY - item.h / 2, item.w, item.h);
        item.x = pos.x;
        item.y = pos.y;
        save();
        const el = document.querySelector(`#mb-canvas .mb-item[data-id="${item.id}"]`);
        if (el) applyItemStyle(item);
        else renderBoard();
      };
      img.src = dataUrl;
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        const maxW = 320;
        const ratio = v.videoHeight / v.videoWidth || 0.75;
        item.w = Math.min(maxW, v.videoWidth || maxW);
        item.h = Math.max(40, Math.round(item.w * ratio));
        const pos = clampToViewport(baseX - item.w / 2, baseY - item.h / 2, item.w, item.h);
        item.x = pos.x;
        item.y = pos.y;
        save();
        const el = document.querySelector(`#mb-canvas .mb-item[data-id="${item.id}"]`);
        if (el) applyItemStyle(item);
        else renderBoard();
      };
      v.src = dataUrl;
    }
  }

  function pushToGallery(board, file, dataUrl, type, item) {
    try {
      const raw = localStorage.getItem('ws_gallery');
      const gal = raw ? JSON.parse(raw) : { items: [], folders: [] };
      if (!Array.isArray(gal.items)) gal.items = [];
      if (!Array.isArray(gal.folders)) gal.folders = [];
      let folder = gal.folders.find(f => f.moodboardId === board.id);
      if (!folder) {
        folder = { id: uid(), name: board.name || 'Moodboard', moodboardId: board.id, created: Date.now() };
        gal.folders.push(folder);
      } else if (board.name && folder.name !== board.name) {
        folder.name = board.name;
      }
      const boardTags = String(board.tags || '').split(',').map(x => x.trim()).filter(Boolean);
      const slug = String(board.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const tagSet = new Set(['moodboard']);
      boardTags.forEach(t => tagSet.add(t.toLowerCase()));
      if (slug) tagSet.add(slug);
      const gid = uid();
      gal.items.unshift({
        id: gid,
        title: (file.name || board.name).replace(/\.[^.]+$/, '') || board.name,
        caption: `From moodboard: ${board.name}`,
        tags: [...tagSet].join(', '),
        src: dataUrl,
        favorite: false,
        mime: file.type || '',
        kind: type,
        folderId: folder.id,
        created: Date.now(),
        updated: Date.now()
      });
      const ok = window.WSStorage ? WSStorage.setJSON('ws_gallery', gal) : (function () { try { localStorage.setItem('ws_gallery', JSON.stringify(gal)); return true; } catch { return false; } })();
      if (ok) { item.galleryId = gid; item.galleryFolderId = folder.id; }
    } catch {}
  }

  function syncGalleryFolderName(board) {
    try {
      const raw = localStorage.getItem('ws_gallery');
      if (!raw) return;
      const gal = JSON.parse(raw);
      if (!gal || !Array.isArray(gal.folders)) return;
      const folder = gal.folders.find(f => f.moodboardId === board.id);
      if (!folder || folder.name === board.name) return;
      folder.name = board.name;
      if (window.WSStorage) WSStorage.setJSON('ws_gallery', gal);
      else localStorage.setItem('ws_gallery', JSON.stringify(gal));
    } catch {}
  }

  function addText() {
    const b = getBoard(); if (!b) return;
    const id = uid();
    b.items.push({ id, type: 'text', text: 'Your text', x: 140, y: 140, w: 320, h: 80, rot: 0, z: nextZ(), color: '#ffffff', fontSize: 36, font: 'serif', weight: 600, italic: false, align: 'left' });
    b.updated = Date.now();
    selectedId = id;
    save();
    renderBoard();
    setTimeout(() => editTextInline(id), 30);
  }

  function editTextInline(id) {
    const node = document.querySelector(`#mb-canvas .mb-item[data-id="${id}"] .mb-text`);
    if (!node) return;
    selectedId = id;
    refreshSelection();
    node.setAttribute('contenteditable', 'true');
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    const stop = ev => { if (ev.key === 'Escape' || (ev.key === 'Enter' && !ev.shiftKey)) { ev.preventDefault(); node.blur(); } };
    const finish = () => {
      node.removeAttribute('contenteditable');
      node.removeEventListener('blur', finish);
      node.removeEventListener('keydown', stop);
      const it = getItem(id);
      if (it) { it.text = node.innerText.trim() || 'Your text'; save(); renderBoard(); }
    };
    node.addEventListener('blur', finish);
    node.addEventListener('keydown', stop);
  }
  function editText() { if (selectedId) editTextInline(selectedId); }
  function setText(prop, val) {
    const it = getItem(selectedId); if (!it || it.type !== 'text') return;
    if (prop === 'fontSize' || prop === 'weight') it[prop] = Number(val);
    else if (prop === 'italic') it.italic = !!(val === true || val === 'true');
    else it[prop] = val;
    save();
    renderBoard();
  }

  function bringToFront(id, doRender) {
    const b = getBoard(); const it = b && b.items.find(x => x.id === id);
    if (!it) return;
    it.z = nextZ();
    if (doRender !== false) { save(); renderBoard(); }
  }
  function sendToBack(id) {
    const b = getBoard(); const it = b && b.items.find(x => x.id === id);
    if (!it) return;
    const minZ = Math.min(...b.items.map(x => x.z || 0));
    it.z = minZ - 1;
    save(); renderBoard();
  }
  function duplicate(id) {
    const b = getBoard(); const it = b && b.items.find(x => x.id === id);
    if (!it) return;
    const copy = JSON.parse(JSON.stringify(it));
    copy.id = uid();
    copy.x = (it.x || 0) + 24;
    copy.y = (it.y || 0) + 24;
    copy.z = nextZ();
    delete copy.galleryId;
    delete copy.galleryFolderId;
    b.items.push(copy);
    selectedId = copy.id;
    save(); renderBoard();
  }
  function deleteItem(id) {
    const b = getBoard(); if (!b) return;
    b.items = b.items.filter(x => x.id !== id);
    if (selectedId === id) selectedId = null;
    save(); renderBoard();
  }

  function setBg(color) {
    const b = getBoard(); if (!b) return;
    b.bgColor = color;
    save();
    const c = document.getElementById('mb-canvas');
    if (c) {
      const dotStyle = getDotStyle(b);
      c.style.backgroundColor = color;
      c.style.setProperty('--mb-dot-color', dotStyle.dot);
      c.style.setProperty('--mb-empty-color', dotStyle.empty);
    }
  }
  function applyDotStyle() {
    const b = getBoard(); if (!b) return;
    const c = document.getElementById('mb-canvas');
    if (!c) return;
    const dotStyle = getDotStyle(b);
    c.style.setProperty('--mb-dot-color', dotStyle.dot);
    c.style.setProperty('--mb-empty-color', dotStyle.empty);
  }
  function toggleDots() {
    const b = getBoard(); if (!b) return;
    b.dotsVisible = b.dotsVisible === false;
    save();
    renderBoard();
  }
  function setDotStrength(value) {
    const b = getBoard(); if (!b) return;
    b.dotStrength = Math.max(0, Math.min(100, Number(value) || 0));
    save();
    applyDotStyle();
  }
  function editTags() {
    const b = getBoard(); if (!b) return;
    openModal('Board Tags (comma separated)', b.tags || '', value => {
      b.tags = String(value || '').trim();
      save(); renderBoard(); return true;
    });
  }

  function openFromSearch(id) {
    const b = data.boards.find(x => x.id === id);
    if (!b) return;
    curBoard = id;
    selectedId = null;
    renderBoard();
  }

  return {
    init, goHub, goBoard,
    createBoard, renameBoard, deleteBoard,
    handleFiles, openAssetPicker, handleAssetUpload, dropAssetFiles, addGalleryAsset,
    addText, editText, setText,
    bringToFrontExt: id => bringToFront(id, true), sendToBack, duplicate, deleteItem,
    setBg, toggleDots, setDotStrength, editTags, openFromSearch
  };
})();

window.MB = MB;
