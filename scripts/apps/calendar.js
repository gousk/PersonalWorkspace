const CL = (function () {
  const SK = 'ws_calendar';
  const PRE_OPTS = [0, 1, 5, 10, 30];
  let data;
  let viewDate = new Date();
  let filterMode = 'open';
  let selectedDate = '';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(SK)) || null;
    } catch {
      return null;
    }
  }

  function save() {
    if (window.WSStorage) WSStorage.setJSON(SK, data, { silent: true });
    else localStorage.setItem(SK, JSON.stringify(data));
    if (window.WSReminders && typeof window.WSReminders.checkNow === 'function') {
      window.WSReminders.checkNow();
    }
  }

  function ensure() {
    if (!data || !Array.isArray(data.events)) {
      data = {
        events: [
          {
            id: uid(),
            title: 'Weekly review',
            date: new Date().toISOString().slice(0, 10),
            time: '19:00',
            notes: 'Review backlog and notes for next week.',
            tags: 'planning,weekly',
            remindDays: 1,
            preReminderMin: 5,
            done: false,
            created: Date.now(),
            updated: Date.now()
          }
        ]
      };
      save();
    }

    data.events.forEach(ev => {
      if (ev.tags == null) ev.tags = '';
      if (ev.notes == null) ev.notes = '';
      if (ev.remindDays == null || Number.isNaN(Number(ev.remindDays))) ev.remindDays = 0;
      if (ev.preReminderMin == null || Number.isNaN(Number(ev.preReminderMin))) ev.preReminderMin = 0;
      if (ev.done == null) ev.done = false;
    });

    save();
  }

  function eventTs(ev) {
    if (!ev || !ev.date) return null;
    const ts = Date.parse(`${ev.date}T${ev.time || '23:59'}`);
    return Number.isFinite(ts) ? ts : null;
  }

  function mainReminderTs(ev) {
    const base = eventTs(ev);
    if (!base) return null;
    return base - Math.max(0, Number(ev.remindDays || 0)) * 24 * 60 * 60 * 1000;
  }

  function reminderMeta(ev) {
    const main = mainReminderTs(ev);
    const preMin = Math.max(0, Number(ev.preReminderMin || 0));
    const mainLabel = main
      ? new Date(main).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: ev.time ? '2-digit' : undefined,
          minute: ev.time ? '2-digit' : undefined
        })
      : 'N/A';
    return preMin > 0 ? `Main ${mainLabel} • + pre ${preMin}m` : `Main ${mainLabel}`;
  }

  function init() {
    data = load();
    ensure();
    render();
  }

  function setFilter(mode) {
    filterMode = mode;
    render();
  }

  function pickDate(date) {
    selectedDate = selectedDate === date ? '' : date;
    render();
  }

  function prevMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    render();
  }

  function nextMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    render();
  }

  function monthGridHtml() {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);
    const countByDate = new Map();
    data.events.forEach(ev => countByDate.set(ev.date, (countByDate.get(ev.date) || 0) + 1));

    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push('<div class="cl-day empty"></div>');
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const has = countByDate.get(date) || 0;
      const cls = [
        'cl-day',
        date === today ? 'today' : '',
        selectedDate === date ? 'selected' : '',
        has ? 'has' : ''
      ].join(' ').trim();
      cells.push(`<button class="${cls}" onclick="CL.pickDate('${date}')"><span>${day}</span>${has ? `<b>${has}</b>` : ''}</button>`);
    }

    return `
      <div class="cl-month-head">
        <button class="nav-btn" onclick="CL.prevMonth()">&#8592;</button>
        <div class="cl-month-title">${viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <button class="nav-btn" onclick="CL.nextMonth()">&#8594;</button>
      </div>
      <div class="cl-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
      <div class="cl-grid">${cells.join('')}</div>`;
  }

  function filteredEvents() {
    const now = Date.now();
    return data.events
      .filter(ev => {
        if (selectedDate && ev.date !== selectedDate) return false;
        if (filterMode === 'open' && ev.done) return false;
        if (filterMode === 'done' && !ev.done) return false;
        if (filterMode === 'upcoming') {
          const ts = eventTs(ev);
          if (!ts || ts < now || ev.done) return false;
        }
        return true;
      })
      .map(ev => ({ ...ev, ts: eventTs(ev) || 0 }))
      .sort((a, b) => a.ts - b.ts);
  }

  function render() {
    const root = document.getElementById('page-calendar');
    const events = filteredEvents();
    const openCount = data.events.filter(x => !x.done).length;
    const doneCount = data.events.filter(x => x.done).length;
    const upcomingCount = data.events.filter(x => !x.done && (eventTs(x) || 0) >= Date.now()).length;

    const cards = events
      .map(ev => {
        const dateLabel = ev.ts
          ? new Date(ev.ts).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: ev.time ? '2-digit' : undefined,
              minute: ev.time ? '2-digit' : undefined
            })
          : ev.date;
        const tags = String(ev.tags || '')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
          .slice(0, 5)
          .map(t => `<span>#${esc(t)}</span>`)
          .join('');

        return `
        <div class="cl-card${ev.done ? ' done' : ''}" id="cl-event-${ev.id}">
          <div class="cl-card-top">
            <div>
              <div class="cl-card-title">${esc(ev.title || 'Untitled reminder')}</div>
              <div class="cl-card-date">${dateLabel}</div>
            </div>
            <div class="cl-card-actions">
              <button class="nav-btn" onclick="CL.toggleDone('${ev.id}')">${ev.done ? 'Reopen' : 'Done'}</button>
              <button class="nav-btn" onclick="CL.editEvent('${ev.id}')">Edit</button>
              <button class="nav-btn" onclick="CL.deleteEvent('${ev.id}')">Delete</button>
            </div>
          </div>
          ${ev.notes ? `<div class="cl-card-notes">${esc(ev.notes)}</div>` : ''}
          ${window.WSLinks ? WSLinks.renderPanel({ app: 'calendar', id: ev.id }) : ''}
          <div class="cl-card-foot"><span>Lead ${Number(ev.remindDays || 0)} day(s) | ${reminderMeta(ev)}</span><div class="cl-tags">${tags}</div></div>
        </div>`;
      })
      .join('');

    root.innerHTML = `
      <div class="cl-wrap">
        <div class="cl-toolbar">
          <span>Open <strong>${openCount}</strong></span>
          <span>Upcoming <strong>${upcomingCount}</strong></span>
          <span>Done <strong>${doneCount}</strong></span>
          <div class="cl-filters">
            <button class="nav-btn${filterMode === 'open' ? ' active' : ''}" onclick="CL.setFilter('open')">Open</button>
            <button class="nav-btn${filterMode === 'upcoming' ? ' active' : ''}" onclick="CL.setFilter('upcoming')">Upcoming</button>
            <button class="nav-btn${filterMode === 'all' ? ' active' : ''}" onclick="CL.setFilter('all')">All</button>
            <button class="nav-btn${filterMode === 'done' ? ' active' : ''}" onclick="CL.setFilter('done')">Done</button>
          </div>
          <button class="fb btn-s" onclick="CL.addEvent()">+ Reminder</button>
        </div>
        <div class="cl-main">
          <div class="cl-month">${monthGridHtml()}</div>
          <div class="cl-list"><div class="cl-list-title">${selectedDate ? `Events on ${selectedDate}` : 'Reminder Timeline'}</div>${cards || '<div class="cl-empty">No reminders for this view.</div>'}</div>
        </div>
      </div>`;
  }

  function openEventModal(title, ev) {
    const preValue = Number((ev && ev.preReminderMin) || 0);
    const preOptions = PRE_OPTS.map(v => `<option value="${v}"${preValue === v ? ' selected' : ''}>${v === 0 ? 'None' : `${v} min`}</option>`).join('');

    const body = `
      <div class="cl-form">
        <label>Title</label>
        <input id="cl-form-title" class="modal-input" type="text" value="${esc((ev && ev.title) || '')}" placeholder="Reminder title">
        <label>Date</label>
        <input id="cl-form-date" class="modal-input" type="date" value="${esc((ev && ev.date) || new Date().toISOString().slice(0, 10))}">
        <label>Time</label>
        <input id="cl-form-time" class="modal-input" type="time" value="${esc((ev && ev.time) || '')}">
        <label>Tags (comma separated)</label>
        <input id="cl-form-tags" class="modal-input" type="text" value="${esc((ev && ev.tags) || '')}" placeholder="work, personal, urgent">
        <label>Reminder lead time (days)</label>
        <input id="cl-form-remind" class="modal-input" type="number" min="0" max="365" value="${ev ? Number(ev.remindDays || 0) : 0}">
        <label>Pre-reminder (minutes)</label>
        <select id="cl-form-pre" class="modal-input">${preOptions}</select>
        <label>Notes</label>
        <textarea id="cl-form-notes" class="ti" rows="4" placeholder="Optional details">${esc((ev && ev.notes) || '')}</textarea>
      </div>`;

    openCustomModal(title, body, () => {
      const titleEl = document.getElementById('cl-form-title');
      const dateEl = document.getElementById('cl-form-date');
      const timeEl = document.getElementById('cl-form-time');
      const tagsEl = document.getElementById('cl-form-tags');
      const remindEl = document.getElementById('cl-form-remind');
      const preEl = document.getElementById('cl-form-pre');
      const notesEl = document.getElementById('cl-form-notes');

      const next = {
        id: ev ? ev.id : uid(),
        title: titleEl.value.trim(),
        date: dateEl.value,
        time: timeEl.value,
        tags: tagsEl.value.trim(),
        remindDays: Math.max(0, Number(remindEl.value || 0)),
        preReminderMin: Math.max(0, Number(preEl.value || 0)),
        notes: notesEl.value.trim(),
        done: ev ? !!ev.done : false,
        created: ev ? ev.created : Date.now(),
        updated: Date.now()
      };

      if (!next.title || !next.date) {
        alert('Title and date are required.');
        return false;
      }

      if (ev) {
        const idx = data.events.findIndex(x => x.id === ev.id);
        if (idx >= 0) data.events[idx] = next;
      } else {
        data.events.push(next);
      }

      save();
      render();
      return true;
    });

    setTimeout(() => {
      const titleInput = document.getElementById('cl-form-title');
      if (titleInput) titleInput.focus();
    }, 20);
  }

  function addEvent() {
    openEventModal('New Reminder');
  }

  function editEvent(id) {
    const ev = data.events.find(x => x.id === id);
    if (!ev) return;
    openEventModal('Edit Reminder', ev);
  }

  function toggleDone(id) {
    const ev = data.events.find(x => x.id === id);
    if (!ev) return;
    ev.done = !ev.done;
    ev.updated = Date.now();
    save();
    render();
  }

  function deleteEvent(id) {
    if (!confirm('Delete this reminder?')) return;
    data.events = data.events.filter(x => x.id !== id);
    save();
    render();
  }

  function openFromSearch(id) {
    selectedDate = '';
    filterMode = 'all';
    render();
    setTimeout(() => {
      const el = document.getElementById(`cl-event-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  return {
    init,
    setFilter,
    pickDate,
    prevMonth,
    nextMonth,
    addEvent,
    editEvent,
    toggleDone,
    deleteEvent,
    openFromSearch
  };
})();

window.CL = CL;
