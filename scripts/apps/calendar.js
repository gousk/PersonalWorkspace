const CL = (function () {
  const SK = 'ws_calendar';
  let data;
  let viewDate = new Date();
  let filterMode = 'open';
  let selectedDate = '';
  let viewMode = 'events';

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
    if (window.WSReminders && typeof window.WSReminders.checkNow === 'function') WSReminders.checkNow();
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function normalizeOffsets(ev) {
    const raw = Array.isArray(ev.offsets) && ev.offsets.length
      ? ev.offsets
      : [
          { days: Math.max(0, num(ev.remindDays)), mins: 0 },
          ...(num(ev.preReminderMin) > 0 ? [{ days: Math.max(0, num(ev.remindDays)), mins: Math.max(0, num(ev.preReminderMin)) }] : [])
        ];
    const seen = new Set();
    return raw
      .map(x => ({ days: Math.max(0, Math.round(num(x.days))), mins: Math.max(0, Math.round(num(x.mins))) }))
      .filter(x => {
        const key = `${x.days}:${x.mins}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.days * 1440 + b.mins) - (a.days * 1440 + a.mins));
  }

  function normalizeBirthday(bd) {
    return {
      id: bd.id || uid(),
      name: String(bd.name || '').trim() || 'Birthday',
      month: Math.max(1, Math.min(12, Math.round(num(bd.month, 1)))),
      day: Math.max(1, Math.min(31, Math.round(num(bd.day, 1)))),
      year: bd.year ? Math.max(1, Math.round(num(bd.year))) : '',
      notes: String(bd.notes || ''),
      remindDays: Math.max(0, Math.round(num(bd.remindDays))),
      created: Number(bd.created || Date.now()),
      updated: Number(bd.updated || bd.created || Date.now())
    };
  }

  function ensure() {
    if (!data || typeof data !== 'object') data = {};
    if (!Array.isArray(data.events)) {
      data.events = [{
        id: uid(),
        title: 'Weekly review',
        date: todayKey(),
        time: '19:00',
        notes: 'Review backlog and notes for next week.',
        tags: 'planning,weekly',
        offsets: [{ days: 1, mins: 0 }, { days: 1, mins: 5 }],
        done: false,
        created: Date.now(),
        updated: Date.now()
      }];
    }
    if (!Array.isArray(data.birthdays)) data.birthdays = [];

    data.events = data.events.map(ev => ({
      ...ev,
      id: ev.id || uid(),
      title: String(ev.title || ''),
      date: String(ev.date || todayKey()).slice(0, 10),
      time: String(ev.time || ''),
      tags: ev.tags == null ? '' : String(ev.tags),
      notes: ev.notes == null ? '' : String(ev.notes),
      offsets: normalizeOffsets(ev),
      done: !!ev.done,
      created: Number(ev.created || Date.now()),
      updated: Number(ev.updated || ev.created || Date.now())
    }));
    data.birthdays = data.birthdays.map(normalizeBirthday);
    save();
  }

  function eventTs(ev) {
    if (!ev || !ev.date) return null;
    const ts = Date.parse(`${ev.date}T${ev.time || '23:59'}`);
    return Number.isFinite(ts) ? ts : null;
  }

  function offsetLabel(offset) {
    const parts = [];
    if (offset.days) parts.push(`${offset.days}d`);
    if (offset.mins) parts.push(`${offset.mins}m`);
    return parts.length ? parts.join(' ') + ' before' : 'At time';
  }

  function reminderMeta(ev) {
    const offsets = normalizeOffsets(ev);
    return offsets.length ? offsets.map(offsetLabel).join(' | ') : 'At time';
  }

  function birthdayDateForYear(bd, year) {
    const date = new Date(year, bd.month - 1, bd.day, 9, 0, 0, 0);
    if (date.getMonth() !== bd.month - 1) return null;
    return date;
  }

  function birthdayNextDate(bd, now = new Date()) {
    const thisYear = birthdayDateForYear(bd, now.getFullYear());
    if (thisYear && thisYear >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return thisYear;
    return birthdayDateForYear(bd, now.getFullYear() + 1);
  }

  function birthdayAge(bd, date) {
    if (!bd.year || !date) return '';
    return Math.max(0, date.getFullYear() - Number(bd.year));
  }

  function birthdayDaysUntil(bd) {
    const next = birthdayNextDate(bd);
    if (!next) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    next.setHours(0, 0, 0, 0);
    return Math.round((next - start) / 86400000);
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

  function setView(mode) {
    viewMode = mode === 'birthdays' ? 'birthdays' : 'events';
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
    const today = todayKey();
    const countByDate = new Map();

    data.events.forEach(ev => countByDate.set(ev.date, { events: ((countByDate.get(ev.date) || {}).events || 0) + 1, birthdays: ((countByDate.get(ev.date) || {}).birthdays || 0) }));
    data.birthdays.forEach(bd => {
      const date = `${y}-${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`;
      const prev = countByDate.get(date) || { events: 0, birthdays: 0 };
      prev.birthdays += 1;
      countByDate.set(date, prev);
    });

    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push('<div class="cl-day empty"></div>');
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const count = countByDate.get(date) || { events: 0, birthdays: 0 };
      const total = count.events + count.birthdays;
      const cls = [
        'cl-day',
        date === today ? 'today' : '',
        selectedDate === date ? 'selected' : '',
        total ? 'has' : '',
        count.birthdays ? 'has-birthday' : ''
      ].join(' ').trim();
      cells.push(`<button class="${cls}" onclick="CL.pickDate('${date}')"><span>${day}</span>${total ? `<b>${count.events}${count.birthdays ? '/' + count.birthdays : ''}</b>` : ''}</button>`);
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

  function birthdaysForView() {
    const y = viewDate.getFullYear();
    return data.birthdays
      .filter(bd => !selectedDate || selectedDate.slice(5, 10) === `${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`)
      .map(bd => {
        const date = birthdayNextDate(bd) || birthdayDateForYear(bd, y);
        return { ...bd, next: date, daysUntil: birthdayDaysUntil(bd), age: birthdayAge(bd, date) };
      })
      .sort((a, b) => num(a.daysUntil, 9999) - num(b.daysUntil, 9999));
  }

  function eventCardsHtml(events) {
    return events.map(ev => {
      const dateLabel = ev.ts
        ? new Date(ev.ts).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: ev.time ? '2-digit' : undefined,
            minute: ev.time ? '2-digit' : undefined
          })
        : ev.date;
      const tags = String(ev.tags || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 5).map(t => `<span>#${esc(t)}</span>`).join('');

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
        <div class="cl-card-foot"><span>${esc(reminderMeta(ev))}</span><div class="cl-tags">${tags}</div></div>
      </div>`;
    }).join('');
  }

  function birthdayCardsHtml(items) {
    return items.map(bd => {
      const nextLabel = bd.next ? bd.next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : `${bd.month}/${bd.day}`;
      const ageLabel = bd.age ? `turns ${bd.age}` : 'age not set';
      const dueLabel = bd.daysUntil === 0 ? 'today' : `in ${bd.daysUntil} days`;
      return `
      <div class="cl-card cl-birthday-card" id="cl-birthday-${bd.id}">
        <div class="cl-card-top">
          <div>
            <div class="cl-card-title">${esc(bd.name)}</div>
            <div class="cl-card-date">${esc(nextLabel)} | ${esc(ageLabel)} | ${esc(dueLabel)}</div>
          </div>
          <div class="cl-card-actions">
            <button class="nav-btn" onclick="CL.editBirthday('${bd.id}')">Edit</button>
            <button class="nav-btn" onclick="CL.deleteBirthday('${bd.id}')">Delete</button>
          </div>
        </div>
        ${bd.notes ? `<div class="cl-card-notes">${esc(bd.notes)}</div>` : ''}
        <div class="cl-card-foot"><span>Reminder ${Number(bd.remindDays || 0)} day(s) before</span></div>
      </div>`;
    }).join('');
  }

  function render() {
    const root = document.getElementById('page-calendar');
    const events = filteredEvents();
    const birthdays = birthdaysForView();
    const openCount = data.events.filter(x => !x.done).length;
    const doneCount = data.events.filter(x => x.done).length;
    const upcomingCount = data.events.filter(x => !x.done && (eventTs(x) || 0) >= Date.now()).length;
    const cards = viewMode === 'birthdays' ? birthdayCardsHtml(birthdays) : eventCardsHtml(events);

    root.innerHTML = `
      <div class="cl-wrap">
        <div class="cl-toolbar">
          <span>Open <strong>${openCount}</strong></span>
          <span>Upcoming <strong>${upcomingCount}</strong></span>
          <span>Done <strong>${doneCount}</strong></span>
          <span>Birthdays <strong>${data.birthdays.length}</strong></span>
          <div class="cl-filters">
            <button class="nav-btn${viewMode === 'events' ? ' active' : ''}" onclick="CL.setView('events')">Events</button>
            <button class="nav-btn${viewMode === 'birthdays' ? ' active' : ''}" onclick="CL.setView('birthdays')">Birthdays</button>
            ${viewMode === 'events' ? `
              <button class="nav-btn${filterMode === 'open' ? ' active' : ''}" onclick="CL.setFilter('open')">Open</button>
              <button class="nav-btn${filterMode === 'upcoming' ? ' active' : ''}" onclick="CL.setFilter('upcoming')">Upcoming</button>
              <button class="nav-btn${filterMode === 'all' ? ' active' : ''}" onclick="CL.setFilter('all')">All</button>
              <button class="nav-btn${filterMode === 'done' ? ' active' : ''}" onclick="CL.setFilter('done')">Done</button>
            ` : ''}
          </div>
          <button class="fb btn-s" onclick="${viewMode === 'birthdays' ? 'CL.addBirthday()' : 'CL.addEvent()'}">${viewMode === 'birthdays' ? '+ Birthday' : '+ Reminder'}</button>
        </div>
        <div class="cl-main">
          <div class="cl-month">${monthGridHtml()}</div>
          <div class="cl-list"><div class="cl-list-title">${selectedDate ? `${viewMode === 'birthdays' ? 'Birthdays' : 'Events'} on ${selectedDate}` : (viewMode === 'birthdays' ? 'Birthdays' : 'Reminder Timeline')}</div>${cards || `<div class="cl-empty">No ${viewMode === 'birthdays' ? 'birthdays' : 'reminders'} for this view.</div>`}</div>
        </div>
      </div>`;
  }

  function offsetRowsHtml(offsets) {
    return offsets.map((offset, i) => `
      <div class="cl-offset-row">
        <input class="modal-input cl-offset-days" type="number" min="0" max="365" value="${offset.days}" placeholder="Days">
        <input class="modal-input cl-offset-mins" type="number" min="0" max="1440" value="${offset.mins}" placeholder="Minutes">
        <button class="nav-btn" onclick="CL.removeOffsetRow(this)">Remove</button>
      </div>`).join('');
  }

  function addOffsetRow() {
    const host = document.getElementById('cl-offsets');
    if (!host) return;
    host.insertAdjacentHTML('beforeend', offsetRowsHtml([{ days: 0, mins: 0 }]));
  }

  function removeOffsetRow(btn) {
    const row = btn && btn.closest('.cl-offset-row');
    if (row) row.remove();
  }

  function readOffsets() {
    const rows = [...document.querySelectorAll('#cl-offsets .cl-offset-row')];
    const offsets = rows.map(row => ({
      days: Math.max(0, Math.round(num(row.querySelector('.cl-offset-days')?.value))),
      mins: Math.max(0, Math.round(num(row.querySelector('.cl-offset-mins')?.value)))
    }));
    return normalizeOffsets({ offsets: offsets.length ? offsets : [{ days: 0, mins: 0 }] });
  }

  function birthdayNameFromTitle(title) {
    const raw = String(title || '').trim();
    const cleaned = raw
      .replace(/\b(birthday|bday|birth day)\b/ig, '')
      .replace(/\b(do[gğ]um\s*g[uü]n[uü]|do[gğ]umg[uü]n[uü])\b/ig, '')
      .replace(/[-–—:|]+$/g, '')
      .replace(/^[-–—:|]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return cleaned || raw || 'Birthday';
  }

  function openEventModal(title, ev, dateOverride = '') {
    const dateValue = (ev && ev.date) || dateOverride || selectedDate || todayKey();
    const body = `
      <div class="cl-form">
        <label>Title</label>
        <input id="cl-form-title" class="modal-input" type="text" value="${esc((ev && ev.title) || '')}" placeholder="Reminder title">
        <label>Date</label>
        <input id="cl-form-date" class="modal-input" type="date" value="${esc(dateValue)}">
        <label>Time</label>
        <input id="cl-form-time" class="modal-input" type="time" value="${esc((ev && ev.time) || '')}">
        <label>Tags (comma separated)</label>
        <input id="cl-form-tags" class="modal-input" type="text" value="${esc((ev && ev.tags) || '')}" placeholder="work, personal, urgent">
        <label>Reminder offsets</label>
        <div id="cl-offsets" class="cl-offsets">${offsetRowsHtml(normalizeOffsets(ev || { offsets: [{ days: 0, mins: 0 }] }))}</div>
        <button class="nav-btn cl-add-offset" onclick="CL.addOffsetRow()">Add Offset</button>
        <label>Notes</label>
        <textarea id="cl-form-notes" class="ti" rows="4" placeholder="Optional details">${esc((ev && ev.notes) || '')}</textarea>
        ${ev ? `<div class="cl-form-secondary"><span>Birthday reminder?</span><button type="button" class="nav-btn" onclick="CL.convertEditingReminderToBirthday('${ev.id}')">Convert to Birthday</button></div>` : ''}
      </div>`;

    openCustomModal(title, body, () => {
      const next = {
        id: ev ? ev.id : uid(),
        title: document.getElementById('cl-form-title').value.trim(),
        date: document.getElementById('cl-form-date').value,
        time: document.getElementById('cl-form-time').value,
        tags: document.getElementById('cl-form-tags').value.trim(),
        offsets: readOffsets(),
        notes: document.getElementById('cl-form-notes').value.trim(),
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

    setTimeout(() => document.getElementById('cl-form-title')?.focus(), 20);
  }

  function addEvent() {
    openEventModal('New Reminder', null, selectedDate || todayKey());
  }

  function editEvent(id) {
    const ev = data.events.find(x => x.id === id);
    if (!ev) return;
    openEventModal('Edit Reminder', ev);
  }

  function convertEditingReminderToBirthday(id) {
    const ev = data.events.find(x => x.id === id);
    if (!ev) return;

    const title = document.getElementById('cl-form-title')?.value.trim() || ev.title || '';
    const date = document.getElementById('cl-form-date')?.value || ev.date || '';
    if (!date) {
      alert('Set a date before converting this reminder.');
      return;
    }

    const offsets = readOffsets();
    const leadDays = offsets.length ? Math.max(0, Math.round(num(offsets[0].days))) : Math.max(0, Math.round(num(ev.remindDays)));
    const birthday = normalizeBirthday({
      id: uid(),
      name: birthdayNameFromTitle(title),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
      year: '',
      remindDays: leadDays,
      notes: document.getElementById('cl-form-notes')?.value.trim() || ev.notes || '',
      created: Date.now(),
      updated: Date.now()
    });

    data.birthdays.push(birthday);
    data.events = data.events.filter(x => x.id !== id);
    viewMode = 'birthdays';
    selectedDate = `${new Date().getFullYear()}-${String(birthday.month).padStart(2, '0')}-${String(birthday.day).padStart(2, '0')}`;
    save();
    closeModal();
    render();
  }

  function openBirthdayModal(title, bd) {
    const body = `
      <div class="cl-form">
        <label>Name</label>
        <input id="cl-bd-name" class="modal-input" type="text" value="${esc((bd && bd.name) || '')}" placeholder="Name">
        <label>Month</label>
        <input id="cl-bd-month" class="modal-input" type="number" min="1" max="12" value="${esc((bd && bd.month) || (selectedDate ? Number(selectedDate.slice(5, 7)) : 1))}">
        <label>Day</label>
        <input id="cl-bd-day" class="modal-input" type="number" min="1" max="31" value="${esc((bd && bd.day) || (selectedDate ? Number(selectedDate.slice(8, 10)) : 1))}">
        <label>Birth year</label>
        <input id="cl-bd-year" class="modal-input" type="number" min="1" max="9999" value="${esc((bd && bd.year) || '')}" placeholder="optional">
        <label>Reminder lead days</label>
        <input id="cl-bd-remind" class="modal-input" type="number" min="0" max="365" value="${esc((bd && bd.remindDays) || 0)}">
        <label>Notes</label>
        <textarea id="cl-bd-notes" class="ti" rows="4" placeholder="Optional details">${esc((bd && bd.notes) || '')}</textarea>
      </div>`;
    openCustomModal(title, body, () => {
      const next = normalizeBirthday({
        id: bd ? bd.id : uid(),
        name: document.getElementById('cl-bd-name').value.trim(),
        month: document.getElementById('cl-bd-month').value,
        day: document.getElementById('cl-bd-day').value,
        year: document.getElementById('cl-bd-year').value,
        remindDays: document.getElementById('cl-bd-remind').value,
        notes: document.getElementById('cl-bd-notes').value.trim(),
        created: bd ? bd.created : Date.now(),
        updated: Date.now()
      });
      if (!next.name) {
        alert('Name is required.');
        return false;
      }
      if (bd) {
        const idx = data.birthdays.findIndex(x => x.id === bd.id);
        if (idx >= 0) data.birthdays[idx] = next;
      } else {
        data.birthdays.push(next);
      }
      save();
      render();
      return true;
    });
    setTimeout(() => document.getElementById('cl-bd-name')?.focus(), 20);
  }

  function addBirthday() {
    openBirthdayModal('New Birthday');
  }

  function editBirthday(id) {
    const bd = data.birthdays.find(x => x.id === id);
    if (bd) openBirthdayModal('Edit Birthday', bd);
  }

  function deleteBirthday(id) {
    if (!confirm('Delete this birthday?')) return;
    data.birthdays = data.birthdays.filter(x => x.id !== id);
    save();
    render();
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
    if (String(id || '').startsWith('birthday:')) {
      selectedDate = '';
      viewMode = 'birthdays';
      render();
      setTimeout(() => {
        const el = document.getElementById(`cl-birthday-${String(id).slice(9)}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return;
    }
    selectedDate = '';
    filterMode = 'all';
    viewMode = 'events';
    render();
    setTimeout(() => {
      const el = document.getElementById(`cl-event-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  return {
    init,
    setFilter,
    setView,
    pickDate,
    prevMonth,
    nextMonth,
    addEvent,
    editEvent,
    convertEditingReminderToBirthday,
    toggleDone,
    deleteEvent,
    addOffsetRow,
    removeOffsetRow,
    addBirthday,
    editBirthday,
    deleteBirthday,
    openFromSearch
  };
})();

window.CL = CL;
