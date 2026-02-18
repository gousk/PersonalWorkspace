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

const NAV_PAGES = ['home', 'backlog', 'notes', 'blog', 'gallery', 'calendar', 'health'];
let currentPage = 'home';
function navigateTo(page) {
  if (!NAV_PAGES.includes(page)) page = 'home';
  currentPage = page;
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
  Object.keys(nutritionDays).forEach(day => {
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
    if (item.app === 'calendar' && window.CL && CL.openFromSearch) CL.openFromSearch(item.itemId);
    if (item.app === 'health' && window.HL && HL.openFromSearch) HL.openFromSearch(item.itemId);
  }, 60);
}


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
const WSBackup = {
  exportAll() {
    const keys = ['ws_backlog', 'ws_notes', 'ws_blog', 'ws_gallery', 'ws_calendar', 'ws_health', 'ws_calendar_reminder_log', 'ws_calendar_reminder_snooze'];
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {}
    };
    keys.forEach(key => {
      payload.data[key] = parseLS(key, null);
    });
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `workspace-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    safeSetLSRaw('ws_last_backup', String(Date.now()), { silent: true });
    if (currentPage === 'home') renderHome();
  },
  importAll(event) {
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
};

function renderHome() {
  const blData = parseLS('ws_backlog', { boards: [] });
  const ntData = parseLS('ws_notes', { notes: [] });
  const bgData = parseLS('ws_blog', { posts: [] });
  const glData = parseLS('ws_gallery', { items: [] });
  const clData = parseLS('ws_calendar', { events: [] });
  const hlData = parseLS('ws_health', { nutrition: { days: {} }, water: { days: {} } });

  const blCount = (blData.boards || []).reduce((s, b) => s + ((b.tasks || []).length), 0);
  const ntCount = (ntData.notes || []).length;
  const bgCount = (bgData.posts || []).length;
  const glCount = (glData.items || []).length;
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
      <div class="home-tile home-tile-e" onclick="navigateTo('calendar')"><div class="home-tile-stat">${clCount} open</div><div class="home-tile-name">Calendar</div><div class="home-tile-desc">Plan events and reminders with upcoming visibility.</div></div>
      <div class="home-tile home-tile-f" onclick="navigateTo('health')"><div class="home-tile-stat">${hlCount} today</div><div class="home-tile-name">Health</div><div class="home-tile-desc">Track water intake, macros, activity and daily calorie targets.</div></div>
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
window.WSBackup = WSBackup;
window.WSReminders = WSReminders;
window.WSStorage = { setItem: safeSetLSRaw, setJSON: safeSetLSJSON, usage: estimateStorageUsage };


