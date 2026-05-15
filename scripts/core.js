const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function esc(s) {
  const e = document.createElement('span');
  e.textContent = s == null ? '' : String(s);
  return e.innerHTML;
}

let storageWarnAt = 0;
function safeSetLSRaw(key, value, options = {}) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (!options.silent) {
      const now = Date.now();
      if (now - storageWarnAt > 4000) {
        storageWarnAt = now;
        alert('Could not save local data. Storage may be full. Create a backup and remove large media files if needed.');
      }
    }
    return false;
  }
}
function safeSetLSJSON(key, data, options = {}) {
  try {
    return safeSetLSRaw(key, JSON.stringify(data), options);
  } catch {
    if (!options.silent) alert('Could not serialize data for saving.');
    return false;
  }
}
function estimateStorageUsage() {
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k) || '';
    used += k.length + v.length;
  }
  const usedBytes = used * 2;
  const quotaBytes = 5 * 1024 * 1024;
  const pct = Math.max(0, Math.min(100, Math.round((usedBytes / quotaBytes) * 100)));
  return {
    usedBytes,
    quotaBytes,
    usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
    quotaMB: (quotaBytes / (1024 * 1024)).toFixed(0),
    percent: pct
  };
}
let modalCb = null;
function openCustomModal(title, bodyHtml, cb, options = {}) {
  modalCb = cb;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.textContent = options.saveLabel || 'Save';
  saveBtn.style.display = options.showSave === false ? 'none' : '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function openModal(title, val, cb) {
  const body = `<input class="modal-input" type="text" id="modal-input" placeholder="Name..." onkeydown="if(event.key==='Enter')modalConfirm();if(event.key==='Escape')closeModal()">`;
  openCustomModal(title, body, () => {
    const input = document.getElementById('modal-input');
    return cb ? cb(input ? input.value : '') : true;
  });
  const input = document.getElementById('modal-input');
  if (input) {
    input.value = val || '';
    setTimeout(() => input.focus(), 50);
  }
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  modalCb = null;
  window._cmRender = null;
  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.textContent = 'Save';
  saveBtn.style.display = '';
}
function modalConfirm() {
  if (!modalCb) {
    closeModal();
    return;
  }
  const keepOpen = modalCb();
  if (keepOpen === false) return;
  closeModal();
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lb-img');
  const vid = document.getElementById('lb-video');
  const meta = document.getElementById('lb-meta');
  if (vid) {
    vid.pause();
    vid.removeAttribute('src');
    vid.classList.add('hidden');
    vid.load();
  }
  if (img) {
    img.removeAttribute('src');
    img.classList.remove('hidden');
  }
  if (meta) meta.innerHTML = '';
  if (lb) lb.classList.add('hidden');
  if (window.GL && typeof window.GL.clearOpenState === 'function') window.GL.clearOpenState();
}

function updateClock() {
  document.getElementById('g-clock').textContent = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
updateClock();
setInterval(updateClock, 1000);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const cvs=document.getElementById('ascii-bg'),cx=cvs.getContext('2d');let mX=-1,mY=-1;const CW=12,CH=20;
function initCanvas(){cvs.width=window.innerWidth;cvs.height=window.innerHeight;}
function noise(x,y,t){return Math.sin(x*.08+t)*.4+Math.sin(y*.06-t*.7)*.3+Math.sin((x+y)*.05+t*.5)*.2+Math.sin(x*.12-y*.1+t*.3)*.15;}
function drawBg(time){
  cx.clearRect(0,0,cvs.width,cvs.height);cx.font='13px JetBrains Mono';cx.textBaseline='top';
  const t=time*.00025,cols=Math.ceil(cvs.width/CW),rows=Math.ceil(cvs.height/CH),mCol=Math.floor(mX/CW),mRow=Math.floor(mY/CH),levels=[-0.3,-0.1,0.1,0.3,0.5];
  for(let i=0;i<rows;i++){for(let j=0;j<cols;j++){
    const val=noise(j,i,t);let near=false,str=0;
    for(const lv of levels){const d=Math.abs(val-lv);if(d<.06){near=true;str=Math.max(str,1-d/.06);}}
    let mb=0;if(mX>=0){const dx=j-mCol,dy=i-mRow,d=Math.sqrt(dx*dx+dy*dy);if(d<14)mb=(1-d/14)*.5;}
    if(!near&&mb<.1)continue;let gray,ch;
    if(near){const dx2=noise(j+.5,i,t)-noise(j-.5,i,t),dy2=noise(j,i+.5,t)-noise(j,i-.5,t),angle=Math.atan2(dy2,dx2),a=((angle+Math.PI)/(Math.PI*2))*8;
      if(a<1||a>=7)ch='\u2500';else if(a<2)ch='\u2572';else if(a<3)ch='\u2502';else if(a<4)ch='\u2571';else if(a<5)ch='\u2500';else if(a<6)ch='\u2572';else ch='\u2502';
      if(str>.85&&Math.sin(i*17.3+j*31.7)>.6)ch=['\u253C','\u25CB','\u2218','\u00B7'][Math.floor(Math.abs(Math.sin(j*7+i*11))*4)];
      gray=14+Math.floor(str*24+mb*32);}else{ch='\u00B7';gray=Math.floor(mb*40);}
    gray=Math.min(gray,58);cx.fillStyle=`rgb(${gray},${gray},${gray})`;cx.fillText(ch,j*CW,i*CH);
  }}requestAnimationFrame(drawBg);}
window.addEventListener('resize',initCanvas);window.addEventListener('mousemove',e=>{mX=e.clientX;mY=e.clientY;});window.addEventListener('mouseleave',()=>{mX=-1;mY=-1;});
initCanvas();requestAnimationFrame(drawBg);

const NAV_PAGES = ['home', 'backlog', 'notes', 'blog', 'gallery', 'moodboard', 'calendar', 'health'];
let currentPage = 'home';
function navigateTo(page) {
  if (!NAV_PAGES.includes(page)) page = 'home';
  currentPage = page;
  document.body.classList.toggle('moodboard-active', page === 'moodboard');
  safeSetLSRaw('ws_last_page', page, { silent: true });
  NAV_PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (!el) return;
    if (p === page) {
      el.classList.remove('hidden');
      el.style.display = 'flex';
    } else {
      el.classList.add('hidden');
    }
  });
  document.querySelectorAll('.g-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  if (page === 'home') renderHome();
  if (page === 'backlog') BL.init();
  if (page === 'notes') NT.init();
  if (page === 'blog') BG.init();
  if (page === 'gallery') GL.init();
  if (page === 'moodboard') MB.init();
  if (page === 'calendar') CL.init();
  if (page === 'health') HL.init();
}

function parseLS(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}
function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(x => String(x).trim().toLowerCase()).filter(Boolean);
  return String(raw)
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}
function eventTs(ev) {
  if (!ev || !ev.date) return null;
  const raw = `${ev.date}T${ev.time || '23:59'}`;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}
function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildGlobalIndex() {
  const items = [];
  const backlog = parseLS('ws_backlog', { boards: [] });
  const notes = parseLS('ws_notes', { notes: [] });
  const blog = parseLS('ws_blog', { posts: [] });
  const gallery = parseLS('ws_gallery', { items: [] });
  const calendar = parseLS('ws_calendar', { events: [] });
  const health = parseLS('ws_health', { nutrition: { days: {} }, water: { days: {} }, profile: {} });

  (backlog.boards || []).forEach(board => {
    (board.tasks || []).forEach(task => {
      items.push({
        app: 'backlog',
        itemId: task.id,
        title: task.title || 'Untitled task',
        snippet: `${board.name || ''} ${(task.notes || '').slice(0, 180)}`.trim(),
        tags: [task.tag].filter(Boolean),
        date: task.due ? Date.parse(`${task.due}T12:00`) : Date.now(),
        page: 'backlog',
        boardId: board.id
      });
    });
  });

  (notes.notes || []).forEach(note => {
    items.push({
      app: 'notes',
      itemId: note.id,
      title: note.title || 'Untitled note',
      snippet: (note.body || '').replace(/\n/g, ' ').slice(0, 220),
      tags: parseTags(note.tags),
      date: note.updated || note.created || Date.now(),
      page: 'notes'
    });
  });

  (blog.posts || []).forEach(post => {
    const text = (post.blocks || []).map(b => b.content || '').join(' ').slice(0, 220);
    items.push({
      app: 'blog',
      itemId: post.id,
      title: post.title || 'Untitled post',
      snippet: text,
      tags: parseTags(post.tags),
      date: post.updated || post.created || Date.now(),
      page: 'blog'
    });
  });

  (gallery.items || []).forEach(media => {
    items.push({
      app: 'gallery',
      itemId: media.id,
      title: media.title || 'Untitled media',
      snippet: media.caption || '',
      tags: parseTags(media.tags),
      date: media.updated || media.created || Date.now(),
      page: 'gallery'
    });
  });

  const moodboard = parseLS('ws_moodboard', { boards: [] });
  (moodboard.boards || []).forEach(board => {
    items.push({
      app: 'moodboard',
      itemId: board.id,
      title: board.name || 'Untitled moodboard',
      snippet: `${(board.items || []).length} items`,
      tags: parseTags(board.tags),
      date: board.updated || board.created || Date.now(),
      page: 'moodboard'
    });
  });

  (calendar.events || []).forEach(ev => {
    items.push({
      app: 'calendar',
      itemId: ev.id,
      title: ev.title || 'Untitled reminder',
      snippet: ev.notes || '',
      tags: parseTags(ev.tags),
      date: eventTs(ev) || ev.updated || Date.now(),
      page: 'calendar'
    });
  });

  const nutritionDays = (health.nutrition && health.nutrition.days) || {};
  const healthDays = new Set();
  Object.keys(nutritionDays).forEach(day => {
    healthDays.add(day);
    const dayItems = (nutritionDays[day] && nutritionDays[day].items) || [];
    dayItems.forEach(food => {
      const dts = Date.parse(`${day}T12:00`);
      items.push({
        app: 'health',
        itemId: `food:${day}:${food.id || food.name || uid()}`,
        title: food.name || 'Food entry',
        snippet: `${day} | P${Number(food.protein || 0)} C${Number(food.carbs || 0)} F${Number(food.fat || 0)}`,
        tags: ['health', 'nutrition'],
        date: Number.isFinite(dts) ? dts : Date.now(),
        page: 'health'
      });
    });
  });

  const waterDays = (health.water && health.water.days) || {};
  Object.keys(waterDays).forEach(day => {
    healthDays.add(day);
    const dts = Date.parse(`${day}T12:00`);
    const ml = Number((waterDays[day] && waterDays[day].totalMl) || 0);
    items.push({
      app: 'health',
      itemId: `water:${day}`,
      title: `Water ${day}`,
      snippet: `${ml} ml`,
      tags: ['health', 'water'],
      date: Number.isFinite(dts) ? dts : Date.now(),
      page: 'health'
    });
  });
  const weightEntries = (health.weight && health.weight.entries) || [];
  weightEntries.forEach(entry => {
    const day = String(entry.date || '').slice(0, 10);
    if (day) healthDays.add(day);
    const dts = Date.parse(`${day}T12:00`);
    items.push({
      app: 'health',
      itemId: `weight:${day}:${entry.id || day}`,
      title: `Weight ${day}`,
      snippet: `${Number(entry.kg || 0)} kg ${entry.note || ''}`.trim(),
      tags: ['health', 'weight'],
      date: Number.isFinite(dts) ? dts : Date.now(),
      page: 'health'
    });
  });
  healthDays.forEach(day => {
    const dts = Date.parse(`${day}T12:00`);
    items.push({
      app: 'health',
      itemId: `day:${day}`,
      title: `Health ${day}`,
      snippet: 'Daily health log',
      tags: ['health'],
      date: Number.isFinite(dts) ? dts : Date.now(),
      page: 'health'
    });
  });
  return items;
}

let gsTag = '';
let gsCache = {};
function collectGlobalTags() {
  const map = new Map();
  buildGlobalIndex().forEach(item => {
    item.tags.forEach(tag => map.set(tag, (map.get(tag) || 0) + 1));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
function renderGlobalTagFilters() {
  const tags = collectGlobalTags().slice(0, 16);
  const html = ['<button class="gs-tag-btn' + (gsTag ? '' : ' active') + '" onclick="selectGlobalTag(\'\')">All</button>']
    .concat(tags.map(([tag]) => `<button class="gs-tag-btn${gsTag === tag ? ' active' : ''}" onclick="selectGlobalTag(decodeURIComponent('${encodeURIComponent(tag)}'))">#${esc(tag)}</button>`))
    .join('');
  document.getElementById('gs-tags').innerHTML = html;
}
function selectGlobalTag(tag) {
  gsTag = tag || '';
  renderGlobalTagFilters();
  const input = document.getElementById('gs-input');
  runGlobalSearch(input ? input.value : '');
}
function openGlobalSearch(prefill = '') {
  gsTag = '';
  document.getElementById('gs-overlay').classList.remove('hidden');
  const input = document.getElementById('gs-input');
  input.value = prefill;
  renderGlobalTagFilters();
  runGlobalSearch(prefill);
  setTimeout(() => input.focus(), 20);
}
function closeGlobalSearch() {
  document.getElementById('gs-overlay').classList.add('hidden');
  gsCache = {};
}
function runGlobalSearch(term) {
  const q = (term || '').trim().toLowerCase();
  const resultsEl = document.getElementById('gs-results');
  const all = buildGlobalIndex();
  const filtered = all.filter(item => {
    if (gsTag && !item.tags.includes(gsTag)) return false;
    if (!q) return true;
    const hay = `${item.title} ${item.snippet} ${item.tags.join(' ')} ${item.app}`.toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 80);

  if (!filtered.length) {
    resultsEl.innerHTML = '<div class="gs-empty">No results found.</div>';
    return;
  }

  gsCache = {};
  resultsEl.innerHTML = filtered.map((item, i) => {
    const id = `r${i}_${item.app}_${item.itemId}`;
    gsCache[id] = item;
    const tags = item.tags.slice(0, 4).map(t => `<span>#${esc(t)}</span>`).join('');
    return `<button class="gs-item" onclick="globalSearchOpenResult('${id}')"><div class="gs-item-top"><span class="gs-app">${item.app}</span><span class="gs-date">${new Date(item.date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div><div class="gs-title">${esc(item.title)}</div><div class="gs-snippet">${esc(item.snippet || '')}</div><div class="gs-tags-row">${tags}</div></button>`;
  }).join('');
}
function globalSearchOpenResult(id) {
  const item = gsCache[id];
  if (!item) return;
  closeGlobalSearch();
  navigateTo(item.page);
  setTimeout(() => {
    if (item.app === 'backlog' && window.BL && BL.openFromSearch) BL.openFromSearch(item.itemId, item.boardId);
    if (item.app === 'notes' && window.NT && NT.openFromSearch) NT.openFromSearch(item.itemId);
    if (item.app === 'blog' && window.BG && BG.openFromSearch) BG.openFromSearch(item.itemId);
    if (item.app === 'gallery' && window.GL && GL.openFromSearch) GL.openFromSearch(item.itemId);
    if (item.app === 'moodboard' && window.MB && MB.openFromSearch) MB.openFromSearch(item.itemId);
    if (item.app === 'calendar' && window.CL && CL.openFromSearch) CL.openFromSearch(item.itemId);
    if (item.app === 'health' && window.HL && HL.openFromSearch) HL.openFromSearch(item.itemId);
  }, 60);
}

const WSLinks = (function () {
  const KEY = 'ws_links';
  const LABELS = {
    backlog: 'Backlog',
    notes: 'Note',
    blog: 'Blog',
    gallery: 'Gallery',
    moodboard: 'Moodboard',
    calendar: 'Calendar',
    health: 'Health',
    'gallery-folder': 'Gallery Folder'
  };
  const REFRESH_DELAY = 80;
  let pickerSource = null;
  let pickerApp = 'all';

  function load() {
    const data = parseLS(KEY, { links: [] });
    if (!data || !Array.isArray(data.links)) return { links: [] };
    return data;
  }
  function save(data) {
    if (window.WSStorage) return WSStorage.setJSON(KEY, data, { silent: true });
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      alert('Could not save links. Storage may be full.');
      return false;
    }
  }
  function normalizeRef(ref) {
    if (!ref || !ref.app || !ref.id) return null;
    return {
      app: String(ref.app),
      id: String(ref.id),
      boardId: ref.boardId ? String(ref.boardId) : undefined
    };
  }
  function keyOf(ref) {
    const n = normalizeRef(ref);
    return n ? `${n.app}:${n.id}` : '';
  }
  function sameRef(a, b) {
    return keyOf(a) === keyOf(b);
  }
  function encodeRef(ref) {
    return encodeURIComponent(JSON.stringify(normalizeRef(ref)));
  }
  function decodeRef(raw) {
    try {
      return normalizeRef(JSON.parse(decodeURIComponent(raw)));
    } catch {
      return null;
    }
  }
  function domId(ref) {
    return `ws-links-${keyOf(ref).replace(/[^a-z0-9_-]/gi, '-')}`;
  }
  function allLinks() {
    return load().links.filter(link => link && link.source && link.target && link.id);
  }
  function linksFor(ref) {
    const key = keyOf(ref);
    if (!key) return [];
    return allLinks().filter(link => keyOf(link.source) === key || keyOf(link.target) === key);
  }
  function otherRef(link, ref) {
    return sameRef(link.source, ref) ? normalizeRef(link.target) : normalizeRef(link.source);
  }
  function alreadyLinked(a, b) {
    const ak = keyOf(a);
    const bk = keyOf(b);
    if (!ak || !bk) return false;
    return allLinks().some(link => {
      const sk = keyOf(link.source);
      const tk = keyOf(link.target);
      return (sk === ak && tk === bk) || (sk === bk && tk === ak);
    });
  }
  function appLabel(app) {
    return LABELS[app] || String(app || 'Item');
  }
  function healthDayMeta(ref) {
    const id = String(ref.id || '');
    if (!id.startsWith('day:')) return null;
    const day = id.slice(4);
    return {
      app: 'health',
      itemId: id,
      title: `Health ${day}`,
      snippet: 'Daily health log',
      tags: ['health'],
      date: Date.parse(`${day}T12:00`) || Date.now(),
      page: 'health'
    };
  }
  function galleryFolderMeta(ref) {
    if (ref.app !== 'gallery-folder') return null;
    const gallery = parseLS('ws_gallery', { folders: [], items: [] });
    const folder = (gallery.folders || []).find(f => f.id === ref.id);
    if (!folder) return null;
    const count = (gallery.items || []).filter(item => item.folderId === folder.id).length;
    return {
      app: 'gallery-folder',
      itemId: folder.id,
      title: folder.name || 'Gallery folder',
      snippet: `${count} media item${count === 1 ? '' : 's'}`,
      tags: ['gallery'],
      date: folder.created || Date.now(),
      page: 'gallery'
    };
  }
  function metaFor(ref) {
    const n = normalizeRef(ref);
    if (!n) return null;
    if (n.app === 'health') {
      const day = healthDayMeta(n);
      if (day) return day;
    }
    if (n.app === 'gallery-folder') return galleryFolderMeta(n);
    return buildGlobalIndex().find(item => item.app === n.app && String(item.itemId) === n.id) || null;
  }
  function autoLinksFor(ref) {
    const n = normalizeRef(ref);
    if (!n) return [];
    const links = [];
    if (n.app === 'gallery') {
      const moodboard = parseLS('ws_moodboard', { boards: [] });
      (moodboard.boards || []).forEach(board => {
        if ((board.items || []).some(item => item.galleryId === n.id)) {
          links.push({
            id: `auto-gallery-moodboard-${n.id}-${board.id}`,
            virtual: true,
            source: n,
            target: { app: 'moodboard', id: board.id },
            label: 'Used in moodboard'
          });
        }
      });
    }
    if (n.app === 'moodboard') {
      const gallery = parseLS('ws_gallery', { folders: [], items: [] });
      const folder = (gallery.folders || []).find(f => f.moodboardId === n.id);
      if (folder) {
        links.push({
          id: `auto-moodboard-gallery-${n.id}-${folder.id}`,
          virtual: true,
          source: n,
          target: { app: 'gallery-folder', id: folder.id },
          label: 'Gallery folder'
        });
      }
    }
    return links;
  }
  function linkRows(ref) {
    const key = keyOf(ref);
    const seen = new Set();
    return linksFor(ref).concat(autoLinksFor(ref)).filter(link => {
      const other = otherRef(link, ref);
      const otherKey = keyOf(other);
      if (!key || !otherKey || seen.has(otherKey)) return false;
      seen.add(otherKey);
      return true;
    });
  }
  function panelInner(ref, options = {}) {
    const n = normalizeRef(ref);
    if (!n) return '';
    const rows = linkRows(n);
    const encoded = encodeRef(n);
    const title = options.title || 'Linked Items';
    const addLabel = options.addLabel || '+ Link';
    const rowsHtml = rows.map(link => {
      const other = otherRef(link, n);
      const meta = metaFor(other);
      const missing = !meta;
      const label = link.label ? `<span class="ws-link-reason">${esc(link.label)}</span>` : '';
      const remove = link.virtual ? '' : `<button class="ws-link-mini danger" onclick="event.stopPropagation();WSLinks.removeAndRefresh('${link.id}','${encoded}')">Remove</button>`;
      return `
        <div class="ws-link-row${missing ? ' missing' : ''}">
          <button class="ws-link-main" onclick="WSLinks.openEncoded('${encodeRef(other)}')">
            <span class="ws-link-app">${esc(appLabel(other.app))}</span>
            <span class="ws-link-title">${esc(meta ? meta.title : 'Missing item')}</span>
            <span class="ws-link-snippet">${esc(meta ? (meta.snippet || '') : keyOf(other))}</span>
            ${label}
          </button>
          <div class="ws-link-actions">${remove}</div>
        </div>`;
    }).join('');

    return `
      <div class="ws-link-head">
        <div class="section-title">${esc(title)}</div>
        <button class="nav-btn ws-link-add" onclick="WSLinks.openPicker('${encoded}')">${esc(addLabel)}</button>
      </div>
      <div class="ws-link-list">${rowsHtml || '<div class="ws-link-empty">No linked items yet.</div>'}</div>`;
  }
  function renderPanel(ref, options = {}) {
    const n = normalizeRef(ref);
    if (!n) return '';
    return `<div class="ws-links" id="${domId(n)}">${panelInner(n, options)}</div>`;
  }
  function refreshPanel(ref) {
    const n = normalizeRef(ref);
    if (!n) return;
    const el = document.getElementById(domId(n));
    if (el) el.innerHTML = panelInner(n);
  }
  function refreshSoon(ref) {
    setTimeout(() => refreshPanel(ref), REFRESH_DELAY);
  }
  function addLink(source, target) {
    const src = normalizeRef(source);
    const tgt = normalizeRef(target);
    if (!src || !tgt || sameRef(src, tgt) || alreadyLinked(src, tgt)) return false;
    const data = load();
    const now = Date.now();
    data.links.push({ id: uid(), source: src, target: tgt, label: '', note: '', created: now, updated: now });
    return save(data);
  }
  function remove(linkId) {
    const data = load();
    data.links = data.links.filter(link => link.id !== linkId);
    save(data);
  }
  function removeAndRefresh(linkId, encodedRef) {
    const ref = decodeRef(encodedRef);
    remove(linkId);
    refreshSoon(ref);
  }
  function openRef(ref) {
    const n = normalizeRef(ref);
    if (!n) return;
    if (n.app === 'gallery-folder') {
      navigateTo('gallery');
      setTimeout(() => {
        if (window.GL && GL.openFolderFromLink) GL.openFolderFromLink(n.id);
      }, 80);
      return;
    }
    const page = n.app === 'notes' ? 'notes' : n.app;
    navigateTo(page);
    setTimeout(() => {
      if (n.app === 'backlog' && window.BL && BL.openFromSearch) BL.openFromSearch(n.id, n.boardId);
      if (n.app === 'notes' && window.NT && NT.openFromSearch) NT.openFromSearch(n.id);
      if (n.app === 'blog' && window.BG && BG.openFromSearch) BG.openFromSearch(n.id);
      if (n.app === 'gallery' && window.GL && GL.openFromSearch) GL.openFromSearch(n.id);
      if (n.app === 'moodboard' && window.MB && MB.openFromSearch) MB.openFromSearch(n.id);
      if (n.app === 'calendar' && window.CL && CL.openFromSearch) CL.openFromSearch(n.id);
      if (n.app === 'health' && window.HL && HL.openFromSearch) HL.openFromSearch(n.id);
    }, 80);
  }
  function openEncoded(encodedRef) {
    closeModal();
    closeLightbox();
    openRef(decodeRef(encodedRef));
  }
  function linkableItems() {
    const map = new Map();
    buildGlobalIndex().forEach(item => {
      const ref = normalizeRef({ app: item.app, id: item.itemId, boardId: item.boardId });
      if (!ref) return;
      map.set(keyOf(ref), { ...item, ref });
    });
    return [...map.values()];
  }
  function renderPickerResults(term = '') {
    const root = document.getElementById('ws-link-picker-results');
    if (!root || !pickerSource) return;
    const q = String(term || '').trim().toLowerCase();
    const rows = linkableItems()
      .filter(item => {
        if (sameRef(item.ref, pickerSource)) return false;
        if (alreadyLinked(item.ref, pickerSource)) return false;
        if (pickerApp !== 'all' && item.app !== pickerApp) return false;
        if (!q) return true;
        const hay = `${item.title} ${item.snippet} ${(item.tags || []).join(' ')} ${item.app}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .slice(0, 80);
    root.innerHTML = rows.length ? rows.map(item => `
      <button class="ws-picker-row" onclick="WSLinks.pickTarget('${encodeRef(item.ref)}')">
        <span class="ws-link-app">${esc(appLabel(item.app))}</span>
        <strong>${esc(item.title || 'Untitled')}</strong>
        <span>${esc(item.snippet || '')}</span>
      </button>`).join('') : '<div class="ws-link-empty">No available items found.</div>';
  }
  function setPickerApp(app) {
    pickerApp = app || 'all';
    const input = document.getElementById('ws-link-picker-search');
    renderPickerResults(input ? input.value : '');
  }
  function openPicker(encodedSource) {
    pickerSource = decodeRef(encodedSource);
    pickerApp = 'all';
    if (!pickerSource) return;
    const body = `
      <div class="ws-link-picker">
        <div class="ws-picker-tools">
          <input id="ws-link-picker-search" class="modal-input" placeholder="Search workspace..." oninput="WSLinks.renderPickerResults(this.value)">
          <select class="modal-input" onchange="WSLinks.setPickerApp(this.value)">
            <option value="all">All apps</option>
            <option value="backlog">Backlog</option>
            <option value="notes">Notes</option>
            <option value="blog">Blog</option>
            <option value="gallery">Gallery</option>
            <option value="moodboard">Moodboard</option>
            <option value="calendar">Calendar</option>
            <option value="health">Health</option>
          </select>
        </div>
        <div id="ws-link-picker-results" class="ws-picker-results"></div>
      </div>`;
    openCustomModal('Link Workspace Item', body, null, { showSave: false });
    setTimeout(() => {
      const input = document.getElementById('ws-link-picker-search');
      if (input) input.focus();
      renderPickerResults('');
    }, 20);
  }
  function pickTarget(encodedTarget) {
    const target = decodeRef(encodedTarget);
    if (!pickerSource || !target) return;
    addLink(pickerSource, target);
    const source = pickerSource;
    closeModal();
    refreshSoon(source);
  }

  return {
    getLinksFor: linksFor,
    renderPanel,
    refreshPanel,
    openPicker,
    renderPickerResults,
    setPickerApp,
    pickTarget,
    openRef,
    openEncoded,
    removeAndRefresh
  };
})();


const WSReminders = (function () {
  const CALENDAR_KEY = 'ws_calendar';
  const LOG_KEY = 'ws_calendar_reminder_log';
  const SNOOZE_KEY = 'ws_calendar_reminder_snooze';
  const POLL_MS = 20000;
  const MAX_LATE_MS = 24 * 60 * 60 * 1000;
  let intervalId = null;
  let audioCtx = null;
  let audioReady = false;

  function parseJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function getCalendarEvents() {
    const calendar = parseJSON(CALENDAR_KEY, { events: [] });
    return Array.isArray(calendar.events) ? calendar.events : [];
  }

  function eventBaseTs(ev) {
    if (!ev || !ev.date) return null;
    const hhmm = ev.time || '09:00';
    const ts = Date.parse(`${ev.date}T${hhmm}`);
    return Number.isFinite(ts) ? ts : null;
  }

  function mainReminderTs(ev) {
    const base = eventBaseTs(ev);
    if (!base) return null;
    const leadDays = Math.max(0, Number(ev.remindDays || 0));
    return base - leadDays * 24 * 60 * 60 * 1000;
  }

  function triggersForEvent(ev) {
    const mainTs = mainReminderTs(ev);
    if (!mainTs) return [];
    const preMin = Math.max(0, Number(ev.preReminderMin || 0));
    const triggers = [];
    if (preMin > 0) {
      triggers.push({ kind: 'pre', ts: mainTs - preMin * 60 * 1000, label: `${preMin} min before reminder` });
    }
    triggers.push({ kind: 'main', ts: mainTs, label: 'Reminder time' });
    const used = new Set();
    return triggers.filter(t => {
      const key = `${t.kind}|${Math.floor(t.ts / 1000)}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    });
  }

  function triggerKey(ev, trig) {
    return `${ev.id}|${trig.kind}|${Math.floor(trig.ts / 1000)}`;
  }

  function getLog() {
    return parseJSON(LOG_KEY, {});
  }

  function setLog(log) {
    safeSetLSJSON(LOG_KEY, log, { silent: true });
  }

  function getSnooze() {
    return parseJSON(SNOOZE_KEY, {});
  }

  function setSnooze(snooze) {
    safeSetLSJSON(SNOOZE_KEY, snooze, { silent: true });
  }

  function cleanState(activeKeys, log, snooze) {
    Object.keys(log).forEach(k => {
      if (!activeKeys.has(k)) delete log[k];
    });
    Object.keys(snooze).forEach(k => {
      if (!activeKeys.has(k)) delete snooze[k];
    });
  }

  function ensureHost() {
    let host = document.getElementById('rm-stack');
    if (!host) {
      host = document.createElement('div');
      host.id = 'rm-stack';
      host.className = 'rm-stack';
      document.body.appendChild(host);
    }
    return host;
  }

  function primeAudio() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      audioReady = true;
    } catch {
      audioReady = false;
    }
  }

  function playTone() {
    if (!audioCtx) primeAudio();
    if (!audioCtx || !audioReady) return;
    const now = audioCtx.currentTime;
    const notes = [880, 660, 880];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.18);
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.18 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.13);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.14);
    });
  }

  function eventLabel(ev) {
    const base = eventBaseTs(ev);
    if (!base) return ev.date || 'Unknown date';
    const hasTime = !!ev.time;
    return new Date(base).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: hasTime ? '2-digit' : undefined,
      minute: hasTime ? '2-digit' : undefined
    });
  }

  function openEvent(ev) {
    navigateTo('calendar');
    setTimeout(() => {
      if (window.CL && typeof window.CL.openFromSearch === 'function') {
        window.CL.openFromSearch(ev.id);
      }
    }, 80);
  }

  function dismissToast(node) {
    if (!node) return;
    node.classList.add('hide');
    setTimeout(() => node.remove(), 180);
  }

  function showVisualReminder(ev, trig, key) {
    const host = ensureHost();
    const el = document.createElement('div');
    el.className = 'rm-toast';
    el.innerHTML = `<div class="rm-title">Reminder</div><div class="rm-name">${esc(ev.title || 'Untitled reminder')}</div><div class="rm-meta">${esc(eventLabel(ev))}</div><div class="rm-meta">${esc(trig.label)}</div><div class="rm-actions"><button class="rm-btn" data-act="open">Open</button><button class="rm-btn" data-act="snooze">Snooze 10m</button><button class="rm-btn" data-act="dismiss">Dismiss</button></div>`;

    el.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const action = btn.getAttribute('data-act');
      if (action === 'open') {
        openEvent(ev);
        dismissToast(el);
      }
      if (action === 'dismiss') {
        dismissToast(el);
      }
      if (action === 'snooze') {
        const snooze = getSnooze();
        snooze[key] = Date.now() + 10 * 60 * 1000;
        setSnooze(snooze);
        dismissToast(el);
      }
    });

    host.prepend(el);
    setTimeout(() => dismissToast(el), 18000);
  }

  function checkNow() {
    const events = getCalendarEvents().filter(ev => ev && ev.id && !ev.done);
    const now = Date.now();
    const log = getLog();
    const snooze = getSnooze();
    const activeKeys = new Set();

    events.forEach(ev => {
      triggersForEvent(ev).forEach(trig => {
        activeKeys.add(triggerKey(ev, trig));
      });
    });

    cleanState(activeKeys, log, snooze);

    events.forEach(ev => {
      triggersForEvent(ev).forEach(trig => {
        const key = triggerKey(ev, trig);
        if (now < trig.ts) return;
        if (now - trig.ts > MAX_LATE_MS) {
          log[key] = String(trig.ts);
          return;
        }

        const snoozeUntil = Number(snooze[key] || 0);
        const hasSnooze = snoozeUntil > 0;
        const dueAfterSnooze = hasSnooze && now >= snoozeUntil;
        const dueFirstTime = !log[key] || String(log[key]) !== String(trig.ts);

        if (hasSnooze && now < snoozeUntil) return;
        if (!dueFirstTime && !dueAfterSnooze) return;

        showVisualReminder(ev, trig, key);
        playTone();
        log[key] = String(trig.ts);
        if (hasSnooze) delete snooze[key];
      });
    });

    setLog(log);
    setSnooze(snooze);
  }

  function start() {
    if (intervalId) clearInterval(intervalId);
    checkNow();
    intervalId = setInterval(checkNow, POLL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkNow();
  });

  document.addEventListener('pointerdown', () => {
    primeAudio();
  }, { once: true });
  document.addEventListener('keydown', () => {
    primeAudio();
  }, { once: true });

  return { start, checkNow, primeAudio, playTone };
})();

WSReminders.start();
const WSBackup = (function () {
  const DATA_KEYS = ['ws_backlog', 'ws_notes', 'ws_blog', 'ws_gallery', 'ws_moodboard', 'ws_calendar', 'ws_health', 'ws_links', 'ws_calendar_reminder_log', 'ws_calendar_reminder_snooze'];
  const SETTINGS_KEY = 'ws_backup_settings';
  const DB_NAME = 'workspace_backup_handles';
  const DB_STORE = 'handles';
  const DIR_KEY = 'backup_dir';
  const DEFAULT_SETTINGS = { enabled: false, intervalMinutes: 60, maxBackups: 10, dirName: '', lastAutoBackup: 0, lastAutoError: '' };
  let autoTimer = null;
  let autoRunning = false;

  function settings() {
    const raw = parseLS(SETTINGS_KEY, {});
    return {
      ...DEFAULT_SETTINGS,
      ...(raw || {}),
      intervalMinutes: Math.max(5, Number(raw && raw.intervalMinutes) || DEFAULT_SETTINGS.intervalMinutes),
      maxBackups: Math.max(1, Number(raw && raw.maxBackups) || DEFAULT_SETTINGS.maxBackups)
    };
  }
  function saveSettings(next) {
    safeSetLSJSON(SETTINGS_KEY, { ...settings(), ...next }, { silent: true });
  }
  function payloadText() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {}
    };
    DATA_KEYS.forEach(key => {
      payload.data[key] = parseLS(key, null);
    });
    return JSON.stringify(payload, null, 2);
  }
  function stamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }
  async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getDirectoryHandle(options = {}) {
    if (!('showDirectoryPicker' in window)) return null;
    const handle = await idbGet(DIR_KEY);
    if (!handle) return null;
    const mode = { mode: 'readwrite' };
    const permission = await handle.queryPermission(mode);
    if (permission === 'granted') return handle;
    if (options.requestPermission) {
      const requested = await handle.requestPermission(mode);
      if (requested === 'granted') return handle;
    }
    return null;
  }
  async function pickDirectoryHandle() {
    if (!('showDirectoryPicker' in window)) {
      alert('Auto backup folder selection is not supported in this browser. Use Chrome or Edge.');
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await idbSet(DIR_KEY, handle);
      saveSettings({ dirName: handle.name, lastAutoError: '' });
      return handle;
    } catch (err) {
      if (err && err.name !== 'AbortError') alert('Could not select backup folder.');
      return null;
    }
  }
  async function chooseDirectory() {
    const handle = await pickDirectoryHandle();
    if (handle) openSettings();
  }
  async function writeBackupToDirectory(handle, reason) {
    const fileName = `workspace-auto-backup-${stamp()}.json`;
    const file = await handle.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable();
    await writable.write(payloadText());
    await writable.close();
    await pruneBackups(handle, settings().maxBackups);
    const now = Date.now();
    saveSettings({ lastAutoBackup: now, lastAutoError: '' });
    safeSetLSRaw('ws_last_backup', String(now), { silent: true });
    if (currentPage === 'home') renderHome();
    return { fileName, reason };
  }
  async function pruneBackups(handle, maxBackups) {
    const backups = [];
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file' && /^workspace-auto-backup-.*\.json$/.test(name)) {
        let modified = 0;
        try { modified = (await entry.getFile()).lastModified || 0; } catch {}
        backups.push({ name, modified });
      }
    }
    backups.sort((a, b) => b.modified - a.modified);
    const extra = backups.slice(Math.max(1, maxBackups));
    for (const item of extra) {
      try { await handle.removeEntry(item.name); } catch {}
    }
  }
  function scheduleAutoCheck() {
    if (autoTimer) clearTimeout(autoTimer);
    const s = settings();
    if (!s.enabled) return;
    const intervalMs = s.intervalMinutes * 60 * 1000;
    const last = Number(s.lastAutoBackup || localStorage.getItem('ws_last_backup') || 0);
    const dueIn = Math.max(30 * 1000, intervalMs - Math.max(0, Date.now() - last));
    autoTimer = setTimeout(() => checkAuto('timer'), dueIn);
  }
  async function checkAuto(reason = 'check') {
    const s = settings();
    if (!s.enabled || autoRunning) { scheduleAutoCheck(); return false; }
    const intervalMs = s.intervalMinutes * 60 * 1000;
    const last = Number(s.lastAutoBackup || localStorage.getItem('ws_last_backup') || 0);
    if (Date.now() - last < intervalMs) { scheduleAutoCheck(); return false; }
    autoRunning = true;
    try {
      const handle = await getDirectoryHandle({ requestPermission: false });
      if (!handle) {
        saveSettings({ lastAutoError: 'Backup folder permission is missing. Open Backup Settings and reselect the folder.' });
        return false;
      }
      await writeBackupToDirectory(handle, reason);
      return true;
    } catch (err) {
      saveSettings({ lastAutoError: 'Auto backup failed. Check folder permissions and available disk space.' });
      return false;
    } finally {
      autoRunning = false;
      scheduleAutoCheck();
    }
  }
  async function exportAll() {
    let handle = await getDirectoryHandle({ requestPermission: true });
    if (!handle) handle = await pickDirectoryHandle();
    if (!handle) {
      return;
    }
    try {
      await writeBackupToDirectory(handle, 'manual-header');
      scheduleAutoCheck();
      alert('Backup created in the selected folder.');
    } catch {
      saveSettings({ lastAutoError: 'Manual backup failed. Check folder permissions and available disk space.' });
      alert('Could not create backup in the selected folder.');
    }
  }
  function openSettings() {
    const s = settings();
    const supported = 'showDirectoryPicker' in window;
    const last = s.lastAutoBackup ? new Date(Number(s.lastAutoBackup)).toLocaleString() : 'Never';
    const folder = s.dirName ? esc(s.dirName) : 'No folder selected';
    const body = `
      <div class="backup-settings">
        <label class="backup-toggle"><span>Auto Backup</span><input id="bk-enabled" type="checkbox"${s.enabled ? ' checked' : ''}><i></i></label>
        <div class="backup-folder-row">
          <div class="backup-folder-meta"><div class="backup-label">Backup Folder</div><div class="backup-folder">${folder}</div></div>
          <button class="nav-btn" onclick="WSBackup.chooseDirectory()">Choose Folder</button>
        </div>
        <div class="backup-grid">
          <label><span>Interval (minutes)</span><input id="bk-interval" class="ti backup-input" type="number" min="5" step="5" value="${s.intervalMinutes}"></label>
          <label><span>Keep backups</span><input id="bk-max" class="ti backup-input" type="number" min="1" step="1" value="${s.maxBackups}"></label>
        </div>
        <div class="backup-status">
          <div>Last auto backup: ${esc(last)}</div>
          ${supported ? '' : '<div class="warn">Folder auto backup needs Chrome or Edge File System Access support.</div>'}
          ${s.lastAutoError ? `<div class="warn">${esc(s.lastAutoError)}</div>` : ''}
        </div>
        <div class="backup-actions">
          <button class="fb btn-c" onclick="closeModal()">Cancel</button>
          <button class="fb btn-c" onclick="WSBackup.runNow()">Run Now</button>
          <button class="fb btn-s" onclick="WSBackup.saveSettingsFromModal()">Save Settings</button>
        </div>
      </div>`;
    openCustomModal('Backup Settings', body, null, { showSave: false });
  }
  function saveSettingsFromModal() {
    const enabled = !!document.getElementById('bk-enabled')?.checked;
    const intervalMinutes = Math.max(5, Number(document.getElementById('bk-interval')?.value) || DEFAULT_SETTINGS.intervalMinutes);
    const maxBackups = Math.max(1, Number(document.getElementById('bk-max')?.value) || DEFAULT_SETTINGS.maxBackups);
    saveSettings({ enabled, intervalMinutes, maxBackups });
    closeModal();
    scheduleAutoCheck();
  }
  async function runNow() {
    saveSettingsFromModal();
    let handle = await getDirectoryHandle({ requestPermission: true });
    if (!handle) handle = await pickDirectoryHandle();
    if (!handle) { openSettings(); return; }
    try {
      await writeBackupToDirectory(handle, 'manual-auto-folder');
      scheduleAutoCheck();
      alert('Backup created in the selected folder.');
    } catch {
      alert('Could not create backup in the selected folder.');
    }
  }
  function importAll(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!payload || typeof payload !== 'object' || !payload.data) {
          alert('Invalid backup file.');
          return;
        }
        if (!confirm('Restore backup now? Current local data will be replaced.')) return;
        const keys = Object.keys(payload.data);
        const snapshot = {};
        keys.forEach(key => {
          snapshot[key] = localStorage.getItem(key);
        });

        let restoreOk = true;
        for (const key of keys) {
          if (!safeSetLSJSON(key, payload.data[key], { silent: true })) {
            restoreOk = false;
            break;
          }
        }

        if (!restoreOk) {
          keys.forEach(key => {
            const prev = snapshot[key];
            if (prev == null) localStorage.removeItem(key);
            else safeSetLSRaw(key, prev, { silent: true });
          });
          alert('Restore failed due storage limits. Existing data was kept.');
          return;
        }

        safeSetLSRaw('ws_last_restore', String(Date.now()), { silent: true });
        if (window.WSReminders && typeof window.WSReminders.checkNow === 'function') WSReminders.checkNow();
        navigateTo(currentPage);
      } catch {
        alert('Backup file could not be read.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
  function init() {
    scheduleAutoCheck();
    setTimeout(() => checkAuto('startup'), 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkAuto('visible');
      else checkAuto('hidden');
    });
    window.addEventListener('pagehide', () => { checkAuto('pagehide'); });
  }
  return { exportAll, importAll, openSettings, chooseDirectory, saveSettingsFromModal, runNow, checkAuto, init };
})();

WSBackup.init();

function renderHome() {
  const blData = parseLS('ws_backlog', { boards: [] });
  const ntData = parseLS('ws_notes', { notes: [] });
  const bgData = parseLS('ws_blog', { posts: [] });
  const glData = parseLS('ws_gallery', { items: [] });
  const mbData = parseLS('ws_moodboard', { boards: [] });
  const clData = parseLS('ws_calendar', { events: [] });
  const hlData = parseLS('ws_health', { nutrition: { days: {} }, water: { days: {} } });

  const blCount = (blData.boards || []).reduce((s, b) => s + ((b.tasks || []).length), 0);
  const ntCount = (ntData.notes || []).length;
  const bgCount = (bgData.posts || []).length;
  const glCount = (glData.items || []).length;
  const mbCount = (mbData.boards || []).length;
  const clCount = (clData.events || []).filter(e => !e.done).length;
  const dayKey = localDayKey();
  const hlFoods = (((hlData.nutrition || {}).days || {})[dayKey] || {}).items || [];
  const hlWaterMl = Number(((((hlData.water || {}).days || {})[dayKey] || {}).totalMl) || 0);
  const hlCount = hlFoods.length + (hlWaterMl > 0 ? 1 : 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcoming = (clData.events || [])
    .filter(e => !e.done)
    .map(e => ({ ...e, ts: eventTs(e) }))
    .filter(e => e.ts && e.ts >= todayStart.getTime())
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 5);

  const globalTags = collectGlobalTags();
  const tagSummary = globalTags.slice(0, 8)
    .map(([tag, count]) => `<span class="home-tag-chip">#${esc(tag)} <strong>${count}</strong></span>`)
    .join('');

  const backupAt = Number(localStorage.getItem('ws_last_backup') || 0);
  const restoreAt = Number(localStorage.getItem('ws_last_restore') || 0);
  const backupText = backupAt ? new Date(backupAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No backup yet';
  const restoreText = restoreAt ? new Date(restoreAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';
  const backupAgeDays = backupAt ? Math.floor((Date.now() - backupAt) / 86400000) : null;
  const backupState = backupAt ? (backupAgeDays >= 7 ? `${backupAgeDays} days old` : 'Fresh') : 'Missing';
  const storage = estimateStorageUsage();
  const storageText = `${storage.usedMB} / ${storage.quotaMB} MB (${storage.percent}%)`;

  document.getElementById('page-home').innerHTML = `
    <div class="home-greeting">${getGreeting()}</div>
    <div class="home-sub">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
    <div class="home-grid">
      <div class="home-tile home-tile-a" onclick="navigateTo('backlog')"><div class="home-tile-stat">${blCount} items</div><div class="home-tile-name">Backlog</div><div class="home-tile-desc">Track tasks with boards, priorities, due dates and progress.</div></div>
      <div class="home-tile home-tile-b" onclick="navigateTo('notes')"><div class="home-tile-stat">${ntCount} notes</div><div class="home-tile-name">Notes</div><div class="home-tile-desc">Quick capture with tags, pinning and better filtering.</div></div>
      <div class="home-tile home-tile-c" onclick="navigateTo('blog')"><div class="home-tile-stat">${bgCount} posts</div><div class="home-tile-name">Blog</div><div class="home-tile-desc">Block-based writing with search and editorial controls.</div></div>
      <div class="home-tile home-tile-d" onclick="navigateTo('gallery')"><div class="home-tile-stat">${glCount} media</div><div class="home-tile-name">Gallery</div><div class="home-tile-desc">Stacked media board for images, gifs and videos.</div></div>
      <div class="home-tile home-tile-e" onclick="navigateTo('moodboard')"><div class="home-tile-stat">${mbCount} boards</div><div class="home-tile-name">Moodboard</div><div class="home-tile-desc">Free-form canvas for images, videos and text. Move, scale, rotate.</div></div>
      <div class="home-tile home-tile-f" onclick="navigateTo('calendar')"><div class="home-tile-stat">${clCount} open</div><div class="home-tile-name">Calendar</div><div class="home-tile-desc">Plan events and reminders with upcoming visibility.</div></div>
      <div class="home-tile home-tile-g" onclick="navigateTo('health')"><div class="home-tile-stat">${hlCount} today</div><div class="home-tile-name">Health</div><div class="home-tile-desc">Track water intake, macros, activity and daily calorie targets.</div></div>
    </div>
    <div class="home-widgets">
      <div class="home-widget">
        <div class="home-widget-title">Upcoming Reminders</div>
        <div class="home-widget-body">${upcoming.length ? upcoming.map(ev => `<div class="home-widget-row"><span>${esc(ev.title)}</span><span>${new Date(ev.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>`).join('') : '<div class="home-widget-empty">No upcoming reminders</div>'}</div>
      </div>
      <div class="home-widget">
        <div class="home-widget-title">Top Tags</div>
        <div class="home-widget-tags">${tagSummary || '<div class="home-widget-empty">No tags yet</div>'}</div>
      </div>
      <div class="home-widget">
        <div class="home-widget-title">Data Safety</div>
        <div class="home-widget-body"><div class="home-widget-row"><span>Last backup</span><span>${backupText}</span></div><div class="home-widget-row${backupAgeDays != null && backupAgeDays >= 7 ? ' warn' : ''}"><span>Backup status</span><span>${backupState}</span></div><div class="home-widget-row"><span>Last restore</span><span>${restoreText}</span></div><div class="home-widget-row"><span>Storage use</span><span>${storageText}</span></div><button class="home-widget-action" onclick="WSBackup.exportAll()">Create Backup</button></div>
      </div>
    </div>`;
}

window.uid = uid;
window.esc = esc;
window.openModal = openModal;
window.openCustomModal = openCustomModal;
window.closeModal = closeModal;
window.modalConfirm = modalConfirm;
window.closeLightbox = closeLightbox;
window.navigateTo = navigateTo;
window.renderHome = renderHome;
window.openGlobalSearch = openGlobalSearch;
window.closeGlobalSearch = closeGlobalSearch;
window.runGlobalSearch = runGlobalSearch;
window.globalSearchOpenResult = globalSearchOpenResult;
window.selectGlobalTag = selectGlobalTag;
window.WSLinks = WSLinks;
window.WSBackup = WSBackup;
window.WSReminders = WSReminders;
window.WSStorage = { setItem: safeSetLSRaw, setJSON: safeSetLSJSON, usage: estimateStorageUsage };


