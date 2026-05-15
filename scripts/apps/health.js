
const HL = (function () {
  const SK = 'ws_health';
  const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 };

  let data;
  let selectedDate = dayKey();
  let reminderTimer = null;
  let reminderBound = false;
  let chartBound = false;
  let analyticsRange = 30;
  let calendarMetric = 'balance';
  let calendarMonth = startOfMonth(new Date());

  function dayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDay(day) { return new Date(`${day}T00:00:00`); }
  function startOfMonth(d) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function shiftDay(day, diff) {
    const d = parseDay(day);
    d.setDate(d.getDate() + diff);
    return dayKey(d);
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function compactNum(v) {
    const n = Math.round(num(v));
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(SK)) || null; }
    catch { return null; }
  }

  function persist(updateHome = true) {
    if (window.WSStorage) WSStorage.setJSON(SK, data, { silent: true });
    else localStorage.setItem(SK, JSON.stringify(data));
    if (updateHome && window.renderHome) renderHome();
  }

  function ensure() {
    if (!data || typeof data !== 'object') data = {};

    if (!data.profile) {
      data.profile = { sex: 'male', age: 28, heightCm: 175, weightKg: 75, activity: 'moderate', goalMode: 'maintain', goalDelta: 400 };
    }

    if (!data.nutrition || !data.nutrition.days) data.nutrition = { days: {} };
    if (!data.activity || !data.activity.days) data.activity = { days: {} };

    if (!data.water || typeof data.water !== 'object') data.water = {};
    if (!data.water.days || typeof data.water.days !== 'object') data.water.days = {};
    if (data.water.targetMl == null) data.water.targetMl = 2500;
    if (!data.water.reminder || typeof data.water.reminder !== 'object') data.water.reminder = {};
    if (data.water.reminder.enabled == null) data.water.reminder.enabled = true;
    if (data.water.reminder.intervalMin == null) data.water.reminder.intervalMin = 90;
    if (data.water.reminder.startHour == null) data.water.reminder.startHour = 9;
    if (data.water.reminder.endHour == null) data.water.reminder.endHour = 22;
    if (data.water.reminder.lastPingAt == null) data.water.reminder.lastPingAt = 0;
    if (data.water.reminder.lastPingDay == null) data.water.reminder.lastPingDay = '';

    if (!data.weight || typeof data.weight !== 'object') data.weight = {};
    if (!Array.isArray(data.weight.entries)) data.weight.entries = [];
    data.weight.entries = data.weight.entries
      .filter(x => x && x.date && Number.isFinite(Number(x.kg)))
      .map(x => ({ id: x.id || uid(), date: String(x.date).slice(0, 10), kg: Number(x.kg), note: String(x.note || ''), created: Number(x.created || Date.now()), updated: Number(x.updated || x.created || Date.now()) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    ensureDay(selectedDate);
    persist(false);
  }

  function ensureDay(day) {
    if (!data.nutrition.days[day]) data.nutrition.days[day] = { items: [] };
    if (!Array.isArray(data.nutrition.days[day].items)) data.nutrition.days[day].items = [];

    if (!data.activity.days[day]) data.activity.days[day] = { steps: 0, workoutMin: 0, extraBurn: 0 };
    if (data.activity.days[day].steps == null) data.activity.days[day].steps = 0;
    if (data.activity.days[day].workoutMin == null) data.activity.days[day].workoutMin = 0;
    if (data.activity.days[day].extraBurn == null) data.activity.days[day].extraBurn = 0;

    if (!data.water.days[day]) data.water.days[day] = { totalMl: 0, logs: [] };
    if (data.water.days[day].totalMl == null) data.water.days[day].totalMl = 0;
    if (!Array.isArray(data.water.days[day].logs)) data.water.days[day].logs = [];

    return { nutrition: data.nutrition.days[day], activity: data.activity.days[day], water: data.water.days[day] };
  }

  function getDay(day = selectedDate) { return ensureDay(day); }

  function calcBmr(profile) {
    const w = Math.max(25, num(profile.weightKg, 75));
    const h = Math.max(120, num(profile.heightCm, 175));
    const a = Math.max(10, num(profile.age, 28));
    const sexAdj = profile.sex === 'female' ? -161 : 5;
    return 10 * w + 6.25 * h - 5 * a + sexAdj;
  }

  function calcTargets() {
    const p = data.profile;
    const bmr = calcBmr(p);
    const tdee = bmr * (ACTIVITY_FACTORS[p.activity] || ACTIVITY_FACTORS.moderate);
    let target = tdee;
    const delta = Math.max(0, num(p.goalDelta, 0));
    if (p.goalMode === 'cut') target = tdee - delta;
    if (p.goalMode === 'bulk') target = tdee + delta;
    return { bmr, tdee, target, proteinTarget: Math.max(60, num(p.weightKg, 75) * 1.8), waterTarget: Math.max(1000, num(data.water.targetMl, 2500)) };
  }

  function calcBurn(steps, workoutMin, extraBurn) {
    const weight = Math.max(40, num(data.profile.weightKg, 75));
    const fromSteps = num(steps) * 0.04;
    const fromWorkout = num(workoutMin) * Math.max(4.2, weight * 0.08);
    return fromSteps + fromWorkout + num(extraBurn);
  }

  function getDaySnapshot(day) {
    const foods = (((data.nutrition || {}).days || {})[day] || {}).items || [];
    const activity = (((data.activity || {}).days || {})[day]) || {};
    const water = (((data.water || {}).days || {})[day]) || {};

    let calories = 0, protein = 0, carbs = 0, fat = 0;
    foods.forEach(it => {
      calories += num(it.calories);
      protein += num(it.protein);
      carbs += num(it.carbs);
      fat += num(it.fat);
    });

    const steps = num(activity.steps);
    const workoutMin = num(activity.workoutMin);
    const extraBurn = num(activity.extraBurn);
    const waterMl = num(water.totalMl);
    const burn = calcBurn(steps, workoutMin, extraBurn);
    const hasData = calories > 0 || protein > 0 || carbs > 0 || fat > 0 || steps > 0 || workoutMin > 0 || extraBurn > 0 || waterMl > 0;

    return { day, calories, protein, carbs, fat, steps, workoutMin, extraBurn, waterMl, burn, net: calories - burn, hasData };
  }

  function dayNutritionTotals(day = selectedDate) {
    const s = getDaySnapshot(day);
    return { calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat };
  }

  function dayActivityBurn(day = selectedDate) { return getDaySnapshot(day).burn; }
  function hydrationPct(day = selectedDate) {
    const total = num(((((data.water || {}).days || {})[day]) || {}).totalMl);
    const target = Math.max(1, num(data.water.targetMl, 2500));
    return Math.max(0, Math.min(100, Math.round((total / target) * 100)));
  }

  function reminderWindowOpen(now = new Date()) {
    const r = data.water.reminder;
    const h = now.getHours();
    const start = Math.max(0, Math.min(23, Math.round(num(r.startHour, 9))));
    const end = Math.max(0, Math.min(23, Math.round(num(r.endHour, 22))));
    if (start <= end) return h >= start && h <= end;
    return h >= start || h <= end;
  }
  function ensureReminderLoop() {
    if (reminderTimer) clearInterval(reminderTimer);
    reminderTimer = setInterval(checkWaterReminder, 60000);
    if (!reminderBound) {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) checkWaterReminder(); });
      reminderBound = true;
    }
    checkWaterReminder();
  }

  function ensureChartHooks() {
    if (chartBound) return;
    chartBound = true;
    window.addEventListener('resize', () => {
      if (window.currentPage === 'health') drawProgressCharts();
    });
  }

  function showReminderToast(title, subtitle) {
    let host = document.getElementById('rm-stack');
    if (!host) {
      host = document.createElement('div');
      host.id = 'rm-stack';
      host.className = 'rm-stack';
      document.body.appendChild(host);
    }

    const toast = document.createElement('div');
    toast.className = 'rm-toast';
    toast.innerHTML = `<div class="rm-title">Hydration</div><div class="rm-name">${esc(title)}</div><div class="rm-meta">${esc(subtitle)}</div><div class="rm-actions"><button class="rm-btn" data-act="open">Open Health</button><button class="rm-btn" data-act="add">+250ml</button><button class="rm-btn" data-act="dismiss">Dismiss</button></div>`;

    toast.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'open') navigateTo('health');
      if (act === 'add') {
        addWater(250, false);
        if (window.currentPage === 'health') render();
      }
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 180);
    });

    host.prepend(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 180);
    }, 16000);

    if (window.WSReminders && typeof window.WSReminders.playTone === 'function') {
      window.WSReminders.playTone();
    }
  }

  function checkWaterReminder() {
    const r = data.water.reminder;
    if (!r.enabled) return;

    const now = Date.now();
    const today = dayKey();
    ensureDay(today);
    if (!reminderWindowOpen(new Date(now))) return;

    const intervalMs = Math.max(10, num(r.intervalMin, 90)) * 60000;
    const elapsed = now - num(r.lastPingAt, 0);
    const dayWater = num(data.water.days[today].totalMl, 0);
    const target = Math.max(1000, num(data.water.targetMl, 2500));

    if (r.lastPingDay !== today) {
      r.lastPingDay = today;
      r.lastPingAt = 0;
    }

    if (dayWater >= target) return;
    if (elapsed < intervalMs && r.lastPingAt > 0) return;

    r.lastPingAt = now;
    r.lastPingDay = today;
    persist(false);
    showReminderToast('Time to drink water', `${dayWater} / ${target} ml logged today`);
  }

  function setDate(value) {
    selectedDate = value || dayKey();
    ensureDay(selectedDate);
    calendarMonth = startOfMonth(parseDay(selectedDate));
    render();
  }

  function updateProfile(field, value) {
    if (!data.profile) return;
    if (['age', 'heightCm', 'weightKg', 'goalDelta'].includes(field)) data.profile[field] = num(value, data.profile[field]);
    else data.profile[field] = value;
    persist();
    render();
  }

  function addFood() {
    const name = (document.getElementById('hl-food-name')?.value || '').trim();
    if (!name) return;

    const item = {
      id: uid(),
      name,
      calories: num(document.getElementById('hl-food-cal')?.value),
      protein: num(document.getElementById('hl-food-p')?.value),
      carbs: num(document.getElementById('hl-food-c')?.value),
      fat: num(document.getElementById('hl-food-f')?.value),
      created: Date.now()
    };

    getDay().nutrition.items.unshift(item);
    persist();
    render();
  }

  function removeFood(id) {
    const day = getDay();
    day.nutrition.items = day.nutrition.items.filter(x => x.id !== id);
    persist();
    render();
  }

  function updateActivity(field, value) {
    const day = getDay();
    day.activity[field] = Math.max(0, num(value));
    persist();
    render();
  }

  function addWater(amount, rerender = true) {
    const ml = Math.max(0, Math.round(num(amount)));
    if (!ml) return;

    const day = getDay();
    day.water.totalMl = Math.max(0, num(day.water.totalMl) + ml);
    day.water.logs.unshift({ id: uid(), ml, at: Date.now() });
    if (day.water.logs.length > 24) day.water.logs = day.water.logs.slice(0, 24);
    persist();
    if (rerender) render();
  }

  function setWaterTarget(value) {
    data.water.targetMl = Math.max(1000, Math.round(num(value, data.water.targetMl || 2500)));
    persist();
    render();
  }

  function resetWater() {
    const day = getDay();
    day.water.totalMl = 0;
    day.water.logs = [];
    persist();
    render();
  }

  function updateReminder(field, value) {
    const r = data.water.reminder;
    if (field === 'enabled') r.enabled = !!value;
    else if (field === 'intervalMin') r.intervalMin = Math.max(10, num(value, r.intervalMin));
    else if (field === 'startHour') r.startHour = Math.max(0, Math.min(23, num(value, r.startHour)));
    else if (field === 'endHour') r.endHour = Math.max(0, Math.min(23, num(value, r.endHour)));

    persist(false);
    ensureReminderLoop();
    render();
  }
  function sortedWeightEntries() { return [...data.weight.entries].sort((a, b) => a.date.localeCompare(b.date)); }
  function latestWeightEntry() {
    const entries = sortedWeightEntries();
    return entries.length ? entries[entries.length - 1] : null;
  }

  function weightOnOrBefore(day) {
    const entries = sortedWeightEntries();
    let found = null;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].date <= day) found = entries[i];
      else break;
    }
    return found;
  }

  function addWeightEntry(dateValue, kgValue, noteValue = '') {
    const date = String(dateValue || '').slice(0, 10);
    const kg = num(kgValue, 0);
    if (!date || kg <= 0) {
      alert('Enter a valid date and weight.');
      return;
    }

    const note = String(noteValue || '').trim();
    const existing = data.weight.entries.find(x => x.date === date);
    if (existing) {
      existing.kg = kg;
      existing.note = note;
      existing.updated = Date.now();
    } else {
      data.weight.entries.push({ id: uid(), date, kg, note, created: Date.now(), updated: Date.now() });
    }

    data.weight.entries.sort((a, b) => a.date.localeCompare(b.date));
    const latest = latestWeightEntry();
    if (latest) data.profile.weightKg = latest.kg;
    persist();
    render();
  }

  function deleteWeightEntry(id) {
    if (!confirm('Delete this weight entry?')) return;
    data.weight.entries = data.weight.entries.filter(x => x.id !== id);
    const latest = latestWeightEntry();
    if (latest) data.profile.weightKg = latest.kg;
    persist();
    render();
  }

  function useProfileWeight() { addWeightEntry(selectedDate, data.profile.weightKg, 'profile sync'); }

  function weightChangeFrom(daysBack) {
    const end = weightOnOrBefore(selectedDate) || latestWeightEntry();
    if (!end) return null;
    const base = weightOnOrBefore(shiftDay(end.date, -daysBack));
    if (!base) return null;
    return end.kg - base.kg;
  }

  function setRange(days) {
    analyticsRange = Math.max(7, Math.min(180, Number(days) || 30));
    render();
  }

  function setCalMetric(metric) {
    const allowed = ['balance', 'calories', 'water', 'steps'];
    if (!allowed.includes(metric)) return;
    calendarMetric = metric;
    render();
  }

  function prevCalMonth() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    render();
  }

  function nextCalMonth() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    render();
  }

  function scoreForMetric(snapshot, targets, metric) {
    if (!snapshot.hasData) return { score: 0, label: '' };

    const waterScore = Math.max(0, Math.min(1, snapshot.waterMl / Math.max(1, targets.waterTarget)));
    const proteinScore = Math.max(0, Math.min(1, snapshot.protein / Math.max(1, targets.proteinTarget)));
    const stepsScore = Math.max(0, Math.min(1, snapshot.steps / 9000));
    const calorieDiff = Math.abs(snapshot.calories - targets.target);
    const calorieScore = Math.max(0, 1 - calorieDiff / Math.max(350, targets.target * 0.3));
    const balance = (waterScore + proteinScore + stepsScore + calorieScore) / 4;

    if (metric === 'calories') return { score: calorieScore, label: compactNum(snapshot.calories) };
    if (metric === 'water') return { score: waterScore, label: compactNum(snapshot.waterMl) };
    if (metric === 'steps') return { score: stepsScore, label: compactNum(snapshot.steps) };
    return { score: balance, label: `${Math.round(balance * 100)}` };
  }

  function scoreLevel(score) {
    if (score <= 0) return 0;
    if (score < 0.26) return 1;
    if (score < 0.51) return 2;
    if (score < 0.76) return 3;
    return 4;
  }

  function healthCalendarHtml() {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = dayKey();
    const targets = calcTargets();
    const cells = [];

    for (let i = 0; i < startDay; i++) cells.push('<div class="hl-cal-day hl-cal-empty"></div>');

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const s = getDaySnapshot(date);
      const metric = scoreForMetric(s, targets, calendarMetric);
      const lvl = scoreLevel(metric.score);
      const cls = `hl-cal-day hl-i-${lvl}${date === selectedDate ? ' selected' : ''}${date === today ? ' today' : ''}`;
      const title = `${date} | kcal ${Math.round(s.calories)} | water ${Math.round(s.waterMl)}ml | steps ${Math.round(s.steps)}`;
      cells.push(`<button class="${cls}" title="${esc(title)}" onclick="HL.setDate('${date}')"><span class="d">${day}</span><span class="v">${esc(metric.label)}</span></button>`);
    }

    return cells.join('');
  }

  function rollingDays(endDay, count) {
    const days = [];
    for (let i = count - 1; i >= 0; i--) days.push(shiftDay(endDay, -i));
    return days;
  }

  function buildChartSeries() {
    const targets = calcTargets();
    const days = rollingDays(selectedDate, analyticsRange);
    return {
      days,
      calories: days.map(d => getDaySnapshot(d).calories),
      target: days.map(() => targets.target),
      burn: days.map(d => getDaySnapshot(d).burn),
      net: days.map(d => getDaySnapshot(d).net),
      water: days.map(d => getDaySnapshot(d).waterMl),
      steps: days.map(d => getDaySnapshot(d).steps),
      waterTarget: days.map(() => targets.waterTarget),
      weight: days.map(d => {
        const w = weightOnOrBefore(d);
        return w ? w.kg : null;
      })
    };
  }

  function drawLineChart(canvasId, datasets, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(250, Math.round(rect.width));
    const height = Math.max(145, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padL = 30, padR = 10, padT = 14, padB = 24;
    const left = padL, right = width - padR, top = padT, bottom = height - padB;

    const values = [];
    datasets.forEach(ds => ds.values.forEach(v => { if (v != null && Number.isFinite(v)) values.push(v); }));
    if (!values.length) {
      ctx.fillStyle = 'rgba(136,136,136,.7)';
      ctx.font = '11px JetBrains Mono';
      ctx.fillText('No data in this range', left, top + 24);
      return;
    }

    let min = opts.min != null ? opts.min : Math.min(...values);
    let max = opts.max != null ? opts.max : Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const yPad = (max - min) * 0.12;
    min -= yPad;
    max += yPad;

    const count = datasets[0].values.length;
    const xStep = count > 1 ? (right - left) / (count - 1) : 0;
    const range = Math.max(1e-6, max - min);

    ctx.strokeStyle = 'rgba(58,58,58,.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = top + ((bottom - top) * i / 4);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }

    datasets.forEach(ds => {
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let open = false;
      ds.values.forEach((v, i) => {
        if (v == null || !Number.isFinite(v)) { open = false; return; }
        const x = left + xStep * i;
        const y = bottom - ((v - min) / range) * (bottom - top);
        if (!open) { ctx.moveTo(x, y); open = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(90,90,90,.95)';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText(opts.firstLabel || '', left, height - 8);
    ctx.fillText(opts.midLabel || '', left + (right - left) / 2 - 16, height - 8);
    ctx.fillText(opts.lastLabel || '', right - 42, height - 8);
  }

  function drawProgressCharts() {
    const s = buildChartSeries();
    const first = new Date(`${s.days[0]}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const mid = new Date(`${s.days[Math.floor((s.days.length - 1) / 2)]}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const last = new Date(`${s.days[s.days.length - 1]}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    drawLineChart('hl-chart-weight', [{ values: s.weight, color: '#e5e5e5' }], { firstLabel: first, midLabel: mid, lastLabel: last });
    drawLineChart('hl-chart-calories', [{ values: s.calories, color: '#cfcfcf' }, { values: s.target, color: '#6f6f6f' }], { firstLabel: first, midLabel: mid, lastLabel: last });
    drawLineChart('hl-chart-net', [{ values: s.net, color: '#d2bdbd' }, { values: s.burn, color: '#8f8f8f' }], { firstLabel: first, midLabel: mid, lastLabel: last });
    drawLineChart('hl-chart-water-steps', [{ values: s.water.map(v => v / 100), color: '#b9c9d8' }, { values: s.steps.map(v => v / 100), color: '#9a9a9a' }], { firstLabel: first, midLabel: mid, lastLabel: last, min: 0 });
  }

  function weightListHtml() {
    const list = sortedWeightEntries().reverse().slice(0, 12);
    if (!list.length) return '<div class="hl-empty">No weight entries yet.</div>';
    return list.map(entry => {
      const dateLabel = new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `<div class="hl-weight-item"><button class="hl-weight-date" onclick="HL.setDate('${entry.date}')">${dateLabel}</button><div class="hl-weight-val">${entry.kg.toFixed(1)} kg</div><button class="nav-btn" onclick="HL.deleteWeightEntry('${entry.id}')">Delete</button></div>`;
    }).join('');
  }
  function render() {
    const page = document.getElementById('page-health');
    if (!page) return;

    const day = getDay();
    const snapshot = getDaySnapshot(selectedDate);
    const totals = dayNutritionTotals();
    const burn = dayActivityBurn();
    const targets = calcTargets();
    const net = totals.calories - burn;
    const waterTotal = num(day.water.totalMl);
    const waterTarget = Math.max(1000, num(data.water.targetMl, 2500));
    const waterProgress = hydrationPct();
    const reminder = data.water.reminder;
    const latestWeight = latestWeightEntry();
    const change7 = weightChangeFrom(7);
    const change30 = weightChangeFrom(30);

    page.innerHTML = `
      <div class="hl-wrap">
        <div class="hl-toolbar">
          <div class="hl-toolbar-title">Health</div>
          <label>Date
            <input class="ti hl-date" type="date" value="${selectedDate}" onchange="HL.setDate(this.value)">
          </label>
          <div class="hl-toolbar-note">Water reminder: ${reminder.enabled ? 'On' : 'Off'} / ${Math.round(num(reminder.intervalMin, 90))}m</div>
        </div>
        ${window.WSLinks ? WSLinks.renderPanel({ app: 'health', id: `day:${selectedDate}` }) : ''}

        <div class="hl-grid">
          <section class="hl-card hl-card-wide hl-pane-calendar">
            <div class="hl-card-title">Health Calendar</div>
            <div class="hl-cal-head">
              <button class="nav-btn" onclick="HL.prevCalMonth()">&#8592;</button>
              <div class="hl-cal-title">${calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
              <button class="nav-btn" onclick="HL.nextCalMonth()">&#8594;</button>
            </div>
            <div class="hl-chip-row">
              <button class="hl-chip${calendarMetric === 'balance' ? ' active' : ''}" onclick="HL.setCalMetric('balance')">Balance</button>
              <button class="hl-chip${calendarMetric === 'calories' ? ' active' : ''}" onclick="HL.setCalMetric('calories')">Calories</button>
              <button class="hl-chip${calendarMetric === 'water' ? ' active' : ''}" onclick="HL.setCalMetric('water')">Water</button>
              <button class="hl-chip${calendarMetric === 'steps' ? ' active' : ''}" onclick="HL.setCalMetric('steps')">Steps</button>
            </div>
            <div class="hl-cal-week"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
            <div class="hl-cal-grid">${healthCalendarHtml()}</div>
            <div class="hl-day-kpis">
              <div><span>Calories</span><strong>${Math.round(snapshot.calories)} kcal</strong></div>
              <div><span>Water</span><strong>${Math.round(snapshot.waterMl)} ml</strong></div>
              <div><span>Steps</span><strong>${Math.round(snapshot.steps)}</strong></div>
              <div><span>Workout</span><strong>${Math.round(snapshot.workoutMin)} min</strong></div>
              <div><span>Protein</span><strong>${Math.round(snapshot.protein)} g</strong></div>
              <div><span>Net</span><strong>${Math.round(snapshot.net)} kcal</strong></div>
            </div>
          </section>

          <section class="hl-card hl-pane-profile">
            <div class="hl-card-title">Profile & Targets</div>
            <div class="hl-form-grid">
              <label>Sex
                <select class="ti" onchange="HL.updateProfile('sex', this.value)">
                  <option value="male"${data.profile.sex === 'male' ? ' selected' : ''}>Male</option>
                  <option value="female"${data.profile.sex === 'female' ? ' selected' : ''}>Female</option>
                </select>
              </label>
              <label>Age
                <input class="ti" type="number" min="10" max="99" value="${Math.round(num(data.profile.age, 28))}" onchange="HL.updateProfile('age', this.value)">
              </label>
              <label>Height (cm)
                <input class="ti" type="number" min="120" max="230" value="${Math.round(num(data.profile.heightCm, 175))}" onchange="HL.updateProfile('heightCm', this.value)">
              </label>
              <label>Weight (kg)
                <input class="ti" type="number" min="35" max="250" value="${Math.round(num(data.profile.weightKg, 75))}" onchange="HL.updateProfile('weightKg', this.value)">
              </label>
              <label>Activity
                <select class="ti" onchange="HL.updateProfile('activity', this.value)">
                  <option value="sedentary"${data.profile.activity === 'sedentary' ? ' selected' : ''}>Sedentary</option>
                  <option value="light"${data.profile.activity === 'light' ? ' selected' : ''}>Light</option>
                  <option value="moderate"${data.profile.activity === 'moderate' ? ' selected' : ''}>Moderate</option>
                  <option value="active"${data.profile.activity === 'active' ? ' selected' : ''}>Active</option>
                  <option value="very"${data.profile.activity === 'very' ? ' selected' : ''}>Very active</option>
                </select>
              </label>
              <label>Goal
                <select class="ti" onchange="HL.updateProfile('goalMode', this.value)">
                  <option value="maintain"${data.profile.goalMode === 'maintain' ? ' selected' : ''}>Maintain</option>
                  <option value="cut"${data.profile.goalMode === 'cut' ? ' selected' : ''}>Cut</option>
                  <option value="bulk"${data.profile.goalMode === 'bulk' ? ' selected' : ''}>Bulk</option>
                </select>
              </label>
              <label>Goal Delta (kcal)
                <input class="ti" type="number" min="0" max="1200" value="${Math.round(num(data.profile.goalDelta, 400))}" onchange="HL.updateProfile('goalDelta', this.value)">
              </label>
              <label>Water Target (ml)
                <input class="ti" type="number" min="1000" max="8000" value="${Math.round(waterTarget)}" onchange="HL.setWaterTarget(this.value)">
              </label>
            </div>
            <div class="hl-stats">
              <div><span>BMR</span><strong>${Math.round(targets.bmr)} kcal</strong></div>
              <div><span>TDEE</span><strong>${Math.round(targets.tdee)} kcal</strong></div>
              <div><span>Daily Target</span><strong>${Math.round(targets.target)} kcal</strong></div>
              <div><span>Protein Target</span><strong>${Math.round(targets.proteinTarget)} g</strong></div>
            </div>
          </section>

          <section class="hl-card hl-pane-weight">
            <div class="hl-card-title">Weight Tracking</div>
            <div class="hl-weight-form">
              <label>Date
                <input id="hl-weight-date" class="ti" type="date" value="${selectedDate}">
              </label>
              <label>Weight (kg)
                <input id="hl-weight-kg" class="ti" type="number" min="20" max="300" step="0.1" value="${latestWeight ? latestWeight.kg.toFixed(1) : num(data.profile.weightKg, 75).toFixed(1)}" onkeydown="if(event.key==='Enter'){event.preventDefault();HL.addWeightEntry(document.getElementById('hl-weight-date').value,document.getElementById('hl-weight-kg').value,document.getElementById('hl-weight-note').value)}">
              </label>
              <label>Note
                <input id="hl-weight-note" class="ti" type="text" placeholder="optional">
              </label>
              <button class="fb btn-s" onclick="HL.addWeightEntry(document.getElementById('hl-weight-date').value,document.getElementById('hl-weight-kg').value,document.getElementById('hl-weight-note').value)">Save</button>
            </div>
            <div class="hl-stats">
              <div><span>Current</span><strong>${latestWeight ? `${latestWeight.kg.toFixed(1)} kg` : 'No entries'}</strong></div>
              <div><span>7d Change</span><strong>${change7 == null ? 'N/A' : `${change7 > 0 ? '+' : ''}${change7.toFixed(1)} kg`}</strong></div>
              <div><span>30d Change</span><strong>${change30 == null ? 'N/A' : `${change30 > 0 ? '+' : ''}${change30.toFixed(1)} kg`}</strong></div>
              <div><span>Sync</span><strong><button class="nav-btn" onclick="HL.useProfileWeight()">Use Profile</button></strong></div>
            </div>
            <div class="hl-weight-list">${weightListHtml()}</div>
          </section>
          <section class="hl-card hl-pane-nutrition">
            <div class="hl-card-title">Nutrition</div>
            <div class="hl-food-form">
              <input id="hl-food-name" class="ti" type="text" placeholder="Food name" onkeydown="if(event.key==='Enter'){event.preventDefault();HL.addFood();}">
              <input id="hl-food-cal" class="ti" type="number" min="0" placeholder="Kcal" onkeydown="if(event.key==='Enter'){event.preventDefault();HL.addFood();}">
              <input id="hl-food-p" class="ti" type="number" min="0" placeholder="P" onkeydown="if(event.key==='Enter'){event.preventDefault();HL.addFood();}">
              <input id="hl-food-c" class="ti" type="number" min="0" placeholder="C" onkeydown="if(event.key==='Enter'){event.preventDefault();HL.addFood();}">
              <input id="hl-food-f" class="ti" type="number" min="0" placeholder="F" onkeydown="if(event.key==='Enter'){event.preventDefault();HL.addFood();}">
              <button class="fb btn-s" onclick="HL.addFood()">Add</button>
            </div>
            <div class="hl-macro-row">Calories <strong>${Math.round(totals.calories)} kcal</strong></div>
            <div class="hl-macro-row">Protein <strong>${Math.round(totals.protein)} g</strong></div>
            <div class="hl-macro-row">Carbs <strong>${Math.round(totals.carbs)} g</strong></div>
            <div class="hl-macro-row">Fat <strong>${Math.round(totals.fat)} g</strong></div>
            <div class="hl-macro-row">Activity Burn <strong>${Math.round(burn)} kcal</strong></div>
            <div class="hl-macro-row">Net Calories <strong>${Math.round(net)} kcal</strong></div>
            <div class="hl-list">${day.nutrition.items.length ? day.nutrition.items.map(item => `
              <div class="hl-row-item">
                <div>
                  <div class="hl-row-title">${esc(item.name)}</div>
                  <div class="hl-row-sub">P ${Math.round(num(item.protein))} / C ${Math.round(num(item.carbs))} / F ${Math.round(num(item.fat))}</div>
                </div>
                <div class="hl-row-right">${Math.round(num(item.calories))} kcal <button class="nav-btn" onclick="HL.removeFood('${item.id}')">Delete</button></div>
              </div>
            `).join('') : '<div class="hl-empty">No foods logged for this day.</div>'}</div>
          </section>

          <section class="hl-card hl-pane-activity">
            <div class="hl-card-title">Activity</div>
            <div class="hl-form-grid">
              <label>Steps
                <input class="ti" type="number" min="0" value="${Math.round(num(day.activity.steps))}" onchange="HL.updateActivity('steps', this.value)">
              </label>
              <label>Workout Minutes
                <input class="ti" type="number" min="0" value="${Math.round(num(day.activity.workoutMin))}" onchange="HL.updateActivity('workoutMin', this.value)">
              </label>
              <label>Extra Burn (kcal)
                <input class="ti" type="number" min="0" value="${Math.round(num(day.activity.extraBurn))}" onchange="HL.updateActivity('extraBurn', this.value)">
              </label>
            </div>
            <div class="hl-stats">
              <div><span>From Steps</span><strong>${Math.round(num(day.activity.steps) * 0.04)} kcal</strong></div>
              <div><span>Total Burn</span><strong>${Math.round(burn)} kcal</strong></div>
            </div>
          </section>

          <section class="hl-card hl-pane-water">
            <div class="hl-card-title">Water Intake</div>
            <div class="hl-macro-row">Today <strong>${Math.round(waterTotal)} / ${Math.round(waterTarget)} ml</strong></div>
            <div class="hl-progress"><div class="hl-progress-fill" style="width:${waterProgress}%"></div></div>
            <div class="hl-water-actions">
              <button class="nav-btn" onclick="HL.addWater(250)">+250ml</button>
              <button class="nav-btn" onclick="HL.addWater(500)">+500ml</button>
              <input id="hl-water-custom" class="ti hl-custom" type="number" min="0" placeholder="ml" onkeydown="if(event.key==='Enter'){event.preventDefault();HL.addWater(document.getElementById('hl-water-custom').value)}">
              <button class="nav-btn" onclick="HL.addWater(document.getElementById('hl-water-custom').value)">Add</button>
              <button class="nav-btn" onclick="HL.resetWater()">Reset Day</button>
            </div>
            <div class="hl-form-grid">
              <label class="hl-check">
                <input type="checkbox" ${reminder.enabled ? 'checked' : ''} onchange="HL.updateReminder('enabled', this.checked)"> Enable hydration reminders
              </label>
              <label>Interval (min)
                <input class="ti" type="number" min="10" max="360" value="${Math.round(num(reminder.intervalMin, 90))}" onchange="HL.updateReminder('intervalMin', this.value)">
              </label>
              <label>Start hour
                <input class="ti" type="number" min="0" max="23" value="${Math.round(num(reminder.startHour, 9))}" onchange="HL.updateReminder('startHour', this.value)">
              </label>
              <label>End hour
                <input class="ti" type="number" min="0" max="23" value="${Math.round(num(reminder.endHour, 22))}" onchange="HL.updateReminder('endHour', this.value)">
              </label>
            </div>
            <div class="hl-log-list">${day.water.logs.length ? day.water.logs.map(log => `<div class="hl-log"><strong>${Math.round(num(log.ml))} ml</strong><span>${new Date(log.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') : '<div class="hl-empty">No water logs yet.</div>'}</div>
          </section>

          <section class="hl-card hl-card-wide hl-pane-graphs">
            <div class="hl-card-title">Progression Graphs</div>
            <div class="hl-chart-tools">
              <span>Range</span>
              <button class="hl-chip${analyticsRange === 14 ? ' active' : ''}" onclick="HL.setRange(14)">14d</button>
              <button class="hl-chip${analyticsRange === 30 ? ' active' : ''}" onclick="HL.setRange(30)">30d</button>
              <button class="hl-chip${analyticsRange === 90 ? ' active' : ''}" onclick="HL.setRange(90)">90d</button>
            </div>
            <div class="hl-chart-grid">
              <div class="hl-chart-card"><div class="hl-chart-title">Weight (kg)</div><canvas id="hl-chart-weight" class="hl-chart"></canvas><div class="hl-legend"><span class="dot" style="background:#e5e5e5"></span>Weight</div></div>
              <div class="hl-chart-card"><div class="hl-chart-title">Calories vs Target</div><canvas id="hl-chart-calories" class="hl-chart"></canvas><div class="hl-legend"><span class="dot" style="background:#cfcfcf"></span>Calories <span class="dot" style="background:#6f6f6f"></span>Target</div></div>
              <div class="hl-chart-card"><div class="hl-chart-title">Net & Burn</div><canvas id="hl-chart-net" class="hl-chart"></canvas><div class="hl-legend"><span class="dot" style="background:#d2bdbd"></span>Net <span class="dot" style="background:#8f8f8f"></span>Burn</div></div>
              <div class="hl-chart-card"><div class="hl-chart-title">Water / Steps (x100)</div><canvas id="hl-chart-water-steps" class="hl-chart"></canvas><div class="hl-legend"><span class="dot" style="background:#b9c9d8"></span>Water/100 <span class="dot" style="background:#9a9a9a"></span>Steps/100</div></div>
            </div>
          </section>
        </div>
      </div>
    `;

    requestAnimationFrame(drawProgressCharts);
  }
  function init() {
    data = load();
    ensure();
    ensureReminderLoop();
    ensureChartHooks();
    render();
  }

  function openFromSearch(itemId) {
    if (!itemId) {
      init();
      return;
    }

    if (itemId.startsWith('day:')) {
      selectedDate = itemId.slice(4);
    } else if (itemId.startsWith('food:') || itemId.startsWith('water:') || itemId.startsWith('weight:')) {
      const parts = itemId.split(':');
      if (parts[1]) selectedDate = parts[1];
    }

    ensureDay(selectedDate);
    calendarMonth = startOfMonth(parseDay(selectedDate));
    render();
  }

  return {
    init,
    setDate,
    updateProfile,
    addFood,
    removeFood,
    updateActivity,
    addWater,
    setWaterTarget,
    resetWater,
    updateReminder,
    setRange,
    setCalMetric,
    prevCalMonth,
    nextCalMonth,
    addWeightEntry,
    deleteWeightEntry,
    useProfileWeight,
    openFromSearch
  };
})();

window.HL = HL;




