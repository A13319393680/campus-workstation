/* =============================================================
   校园工作站 · 应用主逻辑
   纯前端、无依赖、可离线；数据存本地文件或浏览器。
   ============================================================= */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const LS_KEY = 'campus-workstation-v1';

  const CATS = [
    { id: 'teach', name: '教学楼', color: '#4f6ef7', icon: '🏫' },
    { id: 'lab', name: '实验楼', color: '#8b5cf6', icon: '🔬' },
    { id: 'lib', name: '图书馆', color: '#12b3a1', icon: '📚' },
    { id: 'food', name: '食堂', color: '#f0a020', icon: '🍜' },
    { id: 'dorm', name: '宿舍', color: '#ec4899', icon: '🛏️' },
    { id: 'sport', name: '运动场', color: '#22c55e', icon: '⚽' },
    { id: 'other', name: '其他', color: '#64748b', icon: '📍' },
  ];
  const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

  const F_TYPES = [
    { v: 'text', n: '文本' },
    { v: 'number', n: '数字' },
    { v: 'date', n: '日期' },
    { v: 'select', n: '选项' },
    { v: 'textarea', n: '长文本' },
  ];

  const DEFAULT_MODULES = [
    {
      id: 'grades', name: '成绩', icon: '📘', color: '#4f6ef7', builtin: true, enabled: true,
      fields: [
        { key: 'term', label: '学期', type: 'text', ph: '2026-2027-1' },
        { key: 'course', label: '课程', type: 'text', ph: '高等数学A' },
        { key: 'credit', label: '学分', type: 'number' },
        { key: 'score', label: '成绩', type: 'number' },
        { key: 'type', label: '类型', type: 'select', options: ['必修', '选修', '体育', '实践', '通识'] },
        { key: 'date', label: '日期', type: 'date' },
        { key: 'note', label: '备注', type: 'textarea' },
      ],
    },
    {
      id: 'tasks', name: '任务', icon: '✅', color: '#f0a020', builtin: true, enabled: true,
      fields: [
        { key: 'title', label: '事项', type: 'text', ph: '实验二 链表实现' },
        { key: 'course', label: '课程', type: 'text' },
        { key: 'due', label: '截止', type: 'date' },
        { key: 'priority', label: '优先级', type: 'select', options: ['高', '中', '低'] },
        { key: 'status', label: '状态', type: 'select', options: ['未开始', '进行中', '已完成'] },
        { key: 'note', label: '备注', type: 'textarea' },
      ],
    },
    {
      id: 'notes', name: '笔记', icon: '📝', color: '#8b5cf6', builtin: true, enabled: true,
      fields: [
        { key: 'title', label: '标题', type: 'text', ph: '这周想明白的一件事' },
        { key: 'body', label: '内容', type: 'textarea' },
        { key: 'tags', label: '标签', type: 'text', ph: '复盘,数学' },
        { key: 'date', label: '日期', type: 'date' },
      ],
    },
    {
      id: 'habits', name: '打卡', icon: '🔥', color: '#ef5b6b', builtin: true, enabled: true,
      fields: [
        { key: 'habit', label: '习惯', type: 'text', ph: '背单词 30 分钟' },
        { key: 'date', label: '日期', type: 'date' },
        { key: 'note', label: '备注', type: 'textarea' },
      ],
    },
  ];

  /* ---------------- 状态 ---------------- */
  let state = null;
  let fileHandle = null;
  let pendingHandle = null;
  let currentView = 'overview';
  let currentModule = null;
  let mapTab = 'image';
  let addMode = false;
  const catOn = new Set(CATS.map((c) => c.id));
  let searchQ = '';
  let amapInst = null;
  let saveTimer = null;
  let reportOffset = 0;
  let pendingFiles = [];

  /* ---------------- 工具 ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const parseDay = (s) => { if (!s) return null; const t = new Date(s + 'T00:00:00'); return isNaN(t) ? null : t; };
  const dayDiff = (a, b) => Math.round((a - b) / 86400000);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const round1 = (n) => Math.round(n * 10) / 10;

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    $('#toastRoot').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 320); }, 2200);
  }

  /* ---------------- 数据 ---------------- */
  function defaultState() {
    return {
      version: 2,
      settings: { school: '我的学校', tagline: '我的学习与我的一亩三分地', amapKey: '', amapSecret: '', center: null, ghToken: '', ghGist: '', lastSync: 0 },
      modules: JSON.parse(JSON.stringify(DEFAULT_MODULES)),
      entries: { grades: [], tasks: [], notes: [], habits: [] },
      map: { image: '', markers: [] },
      amapMarkers: [],
      createdAt: Date.now(),
    };
  }

  function migrate(s) {
    const d = defaultState();
    s = s || {};
    s.settings = Object.assign({}, d.settings, s.settings || {});
    s.modules = Array.isArray(s.modules) && s.modules.length ? s.modules : d.modules;
    // 补齐内置模块（老数据缺少时）
    d.modules.forEach((dm) => { if (!s.modules.some((m) => m.id === dm.id)) s.modules.push(dm); });
    // 「学习时长」已下线：只从模块列表里拿掉，历史数据留在文件里不删
    s.modules = s.modules.filter((m) => m.id !== 'study');
    s.entries = s.entries || {};
    s.modules.forEach((m) => { if (!Array.isArray(s.entries[m.id])) s.entries[m.id] = []; });
    s.map = Object.assign({ image: '', markers: [] }, s.map || {});
    s.amapMarkers = Array.isArray(s.amapMarkers) ? s.amapMarkers : [];
    s.version = 2;
    return s;
  }

  function loadLocal() {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? migrate(JSON.parse(raw)) : defaultState(); } catch (e) { return defaultState(); }
  }

  function mirrorLocal() {
    try {
      const raw = JSON.stringify(state);
      localStorage.setItem(LS_KEY, raw);
      return raw.length;
    } catch (e) { return 0; /* 超出浏览器容量，或附件太大 */ }
  }

  let bigWarned = false;
  function save(opts) {
    opts = opts || {};
    if (!opts.keepTime) state.updatedAt = Date.now();
    const size = mirrorLocal();
    if (!fileHandle && (size === 0 || size > 4.4 * 1024 * 1024) && !bigWarned) {
      bigWarned = true;
      toast('数据已经太大了，浏览器可能存不下。点左下角绑定一个数据文件更稳妥', 'err');
    }
    if (fileHandle) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => writeFile().catch(() => {}), 400);
    }
    if (!opts.silent) updateSaveCard();
  }

  async function writeFile() {
    if (!fileHandle) return;
    let p = await fileHandle.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') p = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (p !== 'granted') { toast('没有写入权限，数据暂存在浏览器里', 'err'); return; }
    const w = await fileHandle.createWritable();
    await w.write(JSON.stringify(state, null, 2));
    await w.close();
    updateSaveCard(true);
  }

  function updateSaveCard(fresh) {
    const dot = $('#saveDot'), title = $('#saveTitle'), desc = $('#saveDesc');
    if (!dot) return;
    if (fileHandle) {
      dot.classList.add('ok');
      title.textContent = '已连接数据文件';
      desc.textContent = fresh ? '刚刚保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '改动会自动写入';
    } else {
      dot.classList.remove('ok');
      title.textContent = '本地浏览器存储';
      desc.textContent = '点这里绑定数据文件';
    }
  }

  /* ---------- IndexedDB 记住文件句柄 ---------- */
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('campus-ws', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbSet(k, v) { const db = await idb(); return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; }); }
  async function idbGet(k) { const db = await idb(); return new Promise((res) => { const t = db.transaction('kv', 'readonly'); const q = t.objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }

  async function restoreFile() {
    try {
      const h = await idbGet('handle');
      if (!h) return;
      const p = await h.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') {
        const f = await h.getFile();
        const txt = await f.text();
        if (txt && txt.trim()) { state = migrate(JSON.parse(txt)); }
        fileHandle = h;
      } else {
        pendingHandle = h;
      }
    } catch (e) { /* ignore */ }
  }

  async function pickDataFile() {
    if (!window.showSaveFilePicker) { toast('这个浏览器不支持直接写文件，请用 Edge 或 Chrome', 'err'); return; }
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: 'campus-data.json',
        types: [{ description: 'JSON 数据', accept: { 'application/json': ['.json'] } }],
      });
      fileHandle = h;
      await idbSet('handle', h);
      await writeFile();
      updateSaveCard(true);
      toast('已绑定数据文件，之后每次改动自动保存', 'ok');
    } catch (e) { /* 用户取消 */ }
  }

  async function importJSON() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { state = migrate(JSON.parse(await f.text())); save(); render(); toast('数据已导入', 'ok'); }
      catch (e) { toast('文件解析失败，确认是本站导出的 JSON', 'err'); }
    };
    inp.click();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'campus-data-' + todayStr() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已导出到下载文件夹', 'ok');
  }

  /* ---------------- 取数 ---------------- */
  const getModule = (id) => state.modules.find((m) => m.id === id);
  const recs = (id) => (state.entries[id] || []).slice();

  function activeModules() { return state.modules.filter((m) => m.enabled); }

  function firstText(m, r) {
    for (const f of m.fields) {
      const v = r.values[f.key];
      if (v != null && String(v).trim() !== '') return String(v);
    }
    return '未命名';
  }

  /* ---------------- 统计 ---------------- */
  function gradeStats() {
    const rows = recs('grades').map((r) => ({ c: num(r.values.credit), s: num(r.values.score) })).filter((x) => x.s != null);
    const totalCredit = rows.reduce((a, x) => a + (x.c || 0), 0);
    const weighted = totalCredit ? rows.reduce((a, x) => a + (x.c || 0) * x.s, 0) / totalCredit : null;
    const plain = rows.length ? rows.reduce((a, x) => a + x.s, 0) / rows.length : null;
    const failed = rows.filter((x) => x.s < 60).length;
    return { rows, totalCredit, weighted, plain, failed, count: rows.length };
  }

  function taskStats() {
    const rows = recs('tasks');
    const t = todayStr();
    let open = 0, overdue = 0, done = 0;
    rows.forEach((r) => {
      const st = r.values.status || '';
      if (st === '已完成') { done++; return; }
      open++;
      const d = r.values.due;
      if (d && d < t) overdue++;
    });
    return { rows, open, overdue, done, total: rows.length };
  }

  function activityStats() {
    const ws = ymd(weekStartOf(new Date()));
    const today = todayStr();
    let week = 0, total = 0;
    state.modules.forEach((m) => {
      recs(m.id).forEach((r) => {
        total++;
        const d = entryDay(r);
        if (d && d >= ws && d <= today) week++;
      });
    });
    return { week, total };
  }

  function entryDay(r) {
    const v = r.values || {};
    return v.date || v.due || (r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '');
  }

  function weekCheckins() {
    const ws = ymd(weekStartOf(new Date()));
    const today = todayStr();
    let n = 0;
    recs('habits').forEach((r) => { const d = r.values.date; if (d && d >= ws && d <= today) n++; });
    return n;
  }

  function streak() {
    const days = new Set();
    state.modules.forEach((m) => {
      recs(m.id).forEach((r) => {
        const d = entryDay(r);
        if (d) days.add(d);
        if (r.createdAt) days.add(new Date(r.createdAt).toISOString().slice(0, 10));
      });
    });
    let n = 0; const d = new Date();
    if (!days.has(todayStr())) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function activity14() {
    const map = {};
    state.modules.forEach((m) => {
      recs(m.id).forEach((r) => { const d = entryDay(r); if (d) map[d] = (map[d] || 0) + 1; });
    });
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const k = ymd(d);
      out.push({ key: k, label: (d.getMonth() + 1) + '/' + d.getDate(), v: map[k] || 0 });
    }
    return out;
  }

  /* ---------------- 图表 ---------------- */
  function sparkline(data, floor) {
    const W = 640, H = 150, PL = 34, PR = 10, PT = 14, PB = 22;
    const max = Math.max(floor || 1, ...data.map((d) => d.v));
    const iw = W - PL - PR, ih = H - PT - PB;
    const x = (i) => PL + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = (v) => PT + ih - (v / max) * ih;
    const pts = data.map((d, i) => [x(i), y(d.v)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + x(data.length - 1).toFixed(1) + ' ' + (PT + ih) + ' L' + PL + ' ' + (PT + ih) + ' Z';
    const grid = [0, 0.5, 1].map((r) => {
      const yy = PT + ih - r * ih;
      return '<line class="grid-line" x1="' + PL + '" y1="' + yy + '" x2="' + (W - PR) + '" y2="' + yy + '"/>' +
        '<text class="axis-text" x="' + (PL - 8) + '" y="' + (yy + 3) + '" text-anchor="end">' + Math.round(max * r) + '</text>';
    }).join('');
    const dots = pts.map((p, i) => (data[i].v > 0 ? '<circle class="dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.4"/>' : '')).join('');
    const labels = data.map((d, i) => (i % 2 === 0 ? '<text class="axis-text" x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + d.label + '</text>' : '')).join('');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5b78ff" stop-opacity=".22"/><stop offset="100%" stop-color="#5b78ff" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<path class="area" d="' + area + '"/>' + '<path class="line" d="' + line + '"/>' + dots + labels + '</svg>';
  }

  function gradeBuckets() {
    const rows = gradeStats().rows;
    const b = [
      { n: '90-100', v: 0, c: '#4f6ef7' }, { n: '80-89', v: 0, c: '#12b3a1' },
      { n: '70-79', v: 0, c: '#8b5cf6' }, { n: '60-69', v: 0, c: '#f0a020' }, { n: '60 以下', v: 0, c: '#ef5b6b' },
    ];
    rows.forEach((r) => {
      if (r.s >= 90) b[0].v++; else if (r.s >= 80) b[1].v++; else if (r.s >= 70) b[2].v++; else if (r.s >= 60) b[3].v++; else b[4].v++;
    });
    return b;
  }

  /* ---------------- 通用 UI ---------------- */
  function openModal(html, opts) {
    opts = opts || {};
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal" role="dialog">' + html + '</div>';
    mask.addEventListener('click', (e) => { if (e.target === mask) closeModal(); });
    document.body.appendChild(mask);
    const first = mask.querySelector('input,select,textarea');
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 60);
    return mask;
  }
  function closeModal() { const m = $('.modal-mask'); if (m) m.remove(); }

  function fieldHTML(f, val) {
    const v = val == null ? '' : val;
    const req = f.required ? ' <span class="req">*</span>' : '';
    let inner = '';
    if (f.type === 'textarea') {
      inner = '<textarea data-k="' + f.key + '" rows="3" placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>';
    } else if (f.type === 'select') {
      const opts = (f.options || []);
      inner = '<select data-k="' + f.key + '"><option value="">—</option>' +
        opts.map((o) => '<option' + (String(o) === String(v) ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
    } else if (f.type === 'number') {
      inner = '<input type="number" step="any" data-k="' + f.key + '" value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '">';
    } else if (f.type === 'date') {
      inner = '<input type="date" data-k="' + f.key + '" value="' + esc(v) + '">';
    } else {
      inner = '<input type="text" data-k="' + f.key + '" value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '">';
    }
    return '<div class="field"><label>' + esc(f.label) + req + '</label>' + inner + '</div>';
  }

  function formValues(root, m) {
    const out = {};
    m.fields.forEach((f) => {
      const el = root.querySelector('[data-k="' + f.key + '"]');
      if (!el) return;
      let v = el.value;
      if (f.type === 'number') v = v === '' ? '' : Number(v);
      out[f.key] = v;
    });
    return out;
  }

  /* ---------------- 路由 ---------------- */
  const VIEW_META = {
    overview: { t: '概览', s: '今天也慢慢来，先把手里的事排明白。' },
    study: { t: '学习', s: '记录、统计、复盘，都在这一个地方。' },
    report: { t: '周报', s: '把这一周发生了什么，自己讲给自己听。' },
    map: { t: '地图', s: '把学校里的人和地方，放到一张图上。' },
    settings: { t: '设置', s: '数据存在哪、模块开不开、地图接哪个。' },
  };

  function go(v) {
    currentView = v;
    if (v === 'study' && !currentModule) {
      const a = activeModules(); currentModule = a.length ? a[0].id : null;
    }
    render();
    $('.view').scrollTop = 0;
  }

  function render() {
    $$('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === currentView));
    const meta = VIEW_META[currentView] || VIEW_META.overview;
    $('#pageTitle').textContent = meta.t;
    $('#pageSub').textContent = meta.s;
    $('#brandName').textContent = state.settings.school || '校园工作站';
    $('#brandSub').textContent = state.settings.tagline || '我的学习与我的一亩三分地';
    const d = new Date();
    const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    $('#todayPill').textContent = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 周' + wk;
    updateSaveCard();

    const view = $('#view');
    if (currentView === 'overview') { view.innerHTML = renderOverview(); }
    else if (currentView === 'study') { view.innerHTML = renderStudy(); }
    else if (currentView === 'report') { view.innerHTML = renderReport(); }
    else if (currentView === 'map') { view.innerHTML = renderMap(); afterMap(); }
    else { view.innerHTML = renderSettings(); }
  }

  /* ---------------- 概览 ---------------- */
  function renderOverview() {
    const h = new Date().getHours();
    const hi = h < 6 ? '还没睡' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
    const g = gradeStats(), t = taskStats(), st = streak();
    const data = activity14();
    const weekN = weekCheckins();
    const habits = habitStats();

    const stats = [
      { label: '待处理', val: t.open, unit: '项', ico: '📌', bg: 'var(--amber-soft)', sub: t.overdue ? t.overdue + ' 项已逾期' : '没有逾期，稳' },
      { label: '加权均分', val: g.weighted == null ? '—' : round1(g.weighted), unit: '', ico: '📘', bg: 'var(--primary-soft)', sub: g.count ? '共 ' + g.count + ' 门课' : '还没有成绩' },
      { label: '本周打卡', val: weekN, unit: '次', ico: '🔥', bg: 'var(--rose-soft)', sub: habits.length ? habits.length + ' 个习惯在跟' : '还没有开始打卡' },
      { label: '连续记录', val: st, unit: '天', ico: '📝', bg: 'var(--teal-soft)', sub: st > 2 ? '保持住' : '今天记一笔就能续上' },
    ];

    const recent = t.rows
      .filter((r) => r.values.status !== '已完成')
      .sort((a, b) => String(a.values.due || '9999').localeCompare(String(b.values.due || '9999')))
      .slice(0, 5);

    const buckets = gradeBuckets();
    const maxB = Math.max(1, ...buckets.map((b) => b.v));

    const heroMsg = t.overdue
      ? '有 ' + t.overdue + ' 项已经过期了。别急，先挑一件最小的收尾，剩下的重新排个期。'
      : t.open
        ? '手上还有 ' + t.open + ' 件事没结。今天先解决最靠前的那一件，就够了。'
        : '清单是空的，这种时候适合把攒下的想法写进笔记。';

    return '' +
      '<div class="hero">' +
        '<div><h2>' + hi + '，今天想做点什么？</h2><p>' + esc(heroMsg) + '</p></div>' +
        '<div class="hero-badge"><b>' + weekN + '</b><span>本周打卡次数</span></div>' +
      '</div>' +

      '<div class="section grid grid-4">' +
        stats.map((x) =>
          '<div class="stat">' +
            '<div class="stat-top"><span class="stat-label">' + x.label + '</span><span class="stat-ico" style="background:' + x.bg + '">' + x.ico + '</span></div>' +
            '<div class="stat-val">' + x.val + (x.unit ? '<small>' + x.unit + '</small>' : '') + '</div>' +
            '<div class="stat-foot">' + esc(x.sub) + '</div>' +
          '</div>').join('') +
      '</div>' +

      '<div class="section grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">' +
        '<div class="card">' +
          '<div class="section-head"><h2>近 14 天记录活跃度</h2><span class="hint">单位：条</span></div>' +
          '<div class="chart-wrap">' + sparkline(data, 3) + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="section-head"><h2>成绩分布</h2><span class="hint">' + g.count + ' 门</span></div>' +
          (g.count ? buckets.map((b) =>
            '<div class="bar-row"><span class="bar-name">' + b.n + '</span>' +
            '<span class="bar-track"><span class="bar-fill" style="width:' + (b.v / maxB * 100) + '%;background:' + b.c + '"></span></span>' +
            '<span class="bar-val">' + b.v + '</span></div>').join('')
            : '<div class="empty" style="padding:26px 0"><div class="e-ico">📘</div><p style="margin:0">还没有成绩，去「学习」里记第一门。</p></div>') +
        '</div>' +
      '</div>' +

      '<div class="section grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">' +
        '<div class="card">' +
          '<div class="section-head"><h2>接下来要做的</h2><button class="btn btn-soft btn-sm" data-act="add-record" data-id="tasks">+ 加一件</button></div>' +
          (recent.length ? '<div class="mini-list">' + recent.map((r) => {
            const due = r.values.due;
            const left = due ? dayDiff(parseDay(due), parseDay(todayStr())) : null;
            const tag = left == null ? '' : left < 0 ? '<span class="mi-tag" style="background:var(--rose-soft);color:var(--rose)">逾期 ' + (-left) + ' 天</span>'
              : left === 0 ? '<span class="mi-tag" style="background:var(--amber-soft);color:#b8770a">今天</span>'
                : '<span class="mi-tag" style="background:#f2f4fa;color:var(--muted)">' + left + ' 天后</span>';
            return '<div class="mini-item"><span class="mi-dot" style="background:' + (left != null && left < 0 ? 'var(--rose)' : 'var(--primary)') + '"></span>' +
              '<div class="mi-main"><div class="mi-title">' + esc(r.values.title || '未命名') + '</div>' +
              '<div class="mi-sub">' + esc(r.values.course || '未分类') + (due ? ' · ' + esc(due) : '') + '</div></div>' + tag + '</div>';
          }).join('') + '</div>'
            : '<div class="empty" style="padding:30px 0"><div class="e-ico">🌤️</div><p style="margin:0">这周暂时没有要交的东西。</p></div>') +
        '</div>' +
        '<div class="card">' +
          '<div class="section-head"><h2>本周打卡</h2><span class="hint">前 6 个习惯</span></div>' +
          habitBars() +
        '</div>' +
      '</div>';
  }

  function habitBars() {
    const list = habitStats();
    if (!list.length) {
      return '<div class="empty" style="padding:30px 0"><div class="e-ico">🔥</div><p style="margin:0">还没有打卡记录，去「学习 → 打卡」开一个习惯。</p></div>';
    }
    const ws = weekStartOf(new Date());
    const arr = list.slice(0, 6).map((h) => {
      let n = 0;
      for (let i = 0; i < 7; i++) if (h.dates.has(ymd(addDays(ws, i)))) n++;
      return [h.name, n];
    });
    return arr.map(([k, v]) =>
      '<div class="bar-row"><span class="bar-name">' + esc(k) + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + (v / 7 * 100) + '%;background:linear-gradient(90deg,#ff9aa7,#ef5b6b)"></span></span>' +
      '<span class="bar-val">' + v + '/7</span></div>').join('');
  }

  /* ---------------- 学习 ---------------- */
  function renderStudy() {
    const mods = activeModules();
    if (!currentModule || !mods.some((m) => m.id === currentModule)) currentModule = mods.length ? mods[0].id : null;
    if (!mods.length) {
      return '<div class="empty" style="padding-top:80px"><div class="e-ico">🧩</div><h4>还没有开启任何模块</h4><p>去设置里打开，或者新建一个属于自己的模块。</p>' +
        '<button class="btn btn-primary" data-act="nav" data-view="settings">去设置</button></div>';
    }
    const m = getModule(currentModule);
    const all = recs(m.id);
    const q = searchQ.trim().toLowerCase();
    const list = q ? all.filter((r) => m.fields.some((f) => String(r.values[f.key] || '').toLowerCase().includes(q))) : all;

    const chips = mods.map((x) =>
      '<button class="chip' + (x.id === m.id ? ' is-active' : '') + '" data-act="switch-module" data-id="' + x.id + '">' +
      '<span class="chip-ico">' + x.icon + '</span>' + esc(x.name) +
      '<span style="opacity:.55;font-size:11px">' + recs(x.id).length + '</span></button>').join('') +
      '<button class="chip chip-add" data-act="new-module">＋ 新建模块</button>';

    return '<div class="module-bar">' + chips + '</div>' +
      (m.id === 'habits' ? habitsBlock() : '') +
      '<div class="panel" style="margin-top:14px">' +
        '<div class="panel-head">' +
          '<div class="panel-title"><div class="pt-ico" style="background:' + (m.color || '#4f6ef7') + '22">' + m.icon + '</div>' +
            '<div><h3>' + esc(m.name) + '</h3><span>' + all.length + ' 条记录' + (m.builtin ? '' : ' · 自定义') + '</span></div></div>' +
          '<div class="panel-actions">' +
            '<div class="search"><svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 1 0 3.5 10.9l4.3 4.3 1.4-1.4-4.3-4.3A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/></svg>' +
              '<input id="modSearch" placeholder="搜索…" value="' + esc(searchQ) + '"></div>' +
            (m.builtin ? '' : '<button class="btn btn-ghost btn-sm" data-act="edit-module" data-id="' + m.id + '">改字段</button>') +
            '<button class="btn btn-primary btn-sm" data-act="add-record" data-id="' + m.id + '">＋ 新增</button>' +
          '</div>' +
        '</div>' +
        statsStrip(m, all) +
        tableHTML(m, list) +
      '</div>';
  }

  function statsStrip(m, rows) {
    const cells = [];
    const n = (k) => { const f = m.fields.find((x) => x.key === k); return f ? f : null; };
    if (m.id === 'grades') {
      const g = gradeStats();
      cells.push(['加权均分', g.weighted == null ? '—' : round1(g.weighted)]);
      cells.push(['学分合计', round1(g.totalCredit)]);
      cells.push(['不及格', g.failed + ' 门']);
    } else if (m.id === 'tasks') {
      const t = taskStats();
      cells.push(['待处理', t.open]);
      cells.push(['已逾期', t.overdue]);
      cells.push(['已完成', t.done]);
    } else if (m.id === 'habits') {
      const hs = habitStats();
      const total = hs.reduce((a, h) => a + h.total, 0);
      cells.push(['习惯', hs.length + ' 个']);
      cells.push(['累计打卡', total + ' 次']);
      cells.push(['最长连续', (hs.length ? Math.max(...hs.map((h) => h.best)) : 0) + ' 天']);
    } else {
      cells.push(['记录数', rows.length]);
      const nf = m.fields.find((f) => f.type === 'number');
      if (nf) {
        const vals = rows.map((r) => num(r.values[nf.key])).filter((v) => v != null);
        cells.push([nf.label + '合计', round1(vals.reduce((a, b) => a + b, 0))]);
        cells.push([nf.label + '均值', vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : '—']);
      }
    }
    return '<div style="display:flex;gap:28px;padding:14px 22px;background:#fbfcff;border-bottom:1px solid var(--line-2)">' +
      cells.map(([k, v]) => '<div><div style="font-size:11px;color:var(--muted)">' + esc(k) + '</div><div style="font-size:17px;font-weight:700;letter-spacing:-.5px">' + v + '</div></div>').join('') +
      '</div>';
  }

  function tableHTML(m, rows) {
    if (!rows.length) {
      return '<div class="empty"><div class="e-ico">' + (m.icon || '📄') + '</div><h4>' + (searchQ ? '没搜到' : '还是空的') + '</h4>' +
        '<p>' + (searchQ ? '换个关键词试试。' : '记第一条，后面就顺了。') + '</p>' +
        (searchQ ? '' : '<button class="btn btn-primary" data-act="add-record" data-id="' + m.id + '">＋ 记第一条</button>') + '</div>';
    }
    const cols = m.fields.slice(0, 5);
    const sorted = rows.slice().sort((a, b) => {
      const mf = m.fields.find((f) => f.type === 'date');
      if (mf) return String(b.values[mf.key] || '').localeCompare(String(a.values[mf.key] || ''));
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return '<div class="table-wrap"><table class="tbl"><thead><tr>' +
      cols.map((f) => '<th>' + esc(f.label) + '</th>').join('') +
      '<th style="width:92px;text-align:right">操作</th></tr></thead><tbody>' +
      sorted.map((r) => '<tr>' + cols.map((f, i) => '<td>' + cellHTML(m, f, r, i) + '</td>').join('') +
        '<td style="text-align:right"><div class="row-actions" style="justify-content:flex-end">' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-act="edit-record" data-id="' + m.id + '" data-rid="' + r.id + '" title="编辑">✎</button>' +
        '<button class="btn btn-danger btn-icon btn-sm" data-act="del-record" data-id="' + m.id + '" data-rid="' + r.id + '" title="删除">✕</button>' +
        '</div></td></tr>').join('') +
      '</tbody></table></div>';
  }

  function cellHTML(m, f, r, idx) {
    const v = r.values[f.key];
    if (v == null || v === '') return '<span style="color:#c3c9db">—</span>';
    if (f.type === 'select') {
      let cls = 'tag-grey';
      const s = String(v);
      if (/已完成|已达成|优秀|出勤/.test(s)) cls = 'tag-teal';
      else if (/逾期|旷课|不及格|高/.test(s)) cls = 'tag-rose';
      else if (/进行中|中/.test(s)) cls = 'tag-amber';
      else if (/未开始|低/.test(s)) cls = 'tag-grey';
      else cls = 'tag-blue';
      return '<span class="tag ' + cls + '">' + esc(s) + '</span>';
    }
    if (f.type === 'date') {
      const left = f.key === 'due' && v ? dayDiff(parseDay(v), parseDay(todayStr())) : null;
      const warn = left != null && left < 0 ? ' style="color:var(--rose);font-weight:600"' : '';
      return '<span' + warn + '>' + esc(v) + '</span>';
    }
    if (idx === 0) {
      const n = (r.files || []).length;
      return '<span class="cell-main">' + esc(v) + '</span>' +
        (n ? '<span class="clip" title="' + n + ' 个附件">📎' + n + '</span>' : '');
    }
    const str = String(v);
    return esc(str.length > 26 ? str.slice(0, 26) + '…' : str);
  }

  /* ---------------- 记录表单 ---------------- */
  function openRecordForm(moduleId, rid) {
    const m = getModule(moduleId);
    const rec = rid ? recs(moduleId).find((r) => r.id === rid) : null;
    const vals = rec ? rec.values : seedValues(m);
    pendingFiles = rec && Array.isArray(rec.files) ? JSON.parse(JSON.stringify(rec.files)) : [];
    const html = '<div class="modal-head"><div><h3>' + (rec ? '编辑' : '新增') + ' · ' + esc(m.name) + '</h3><p>存下来就好，格式不完美也没关系。</p></div>' +
      '<button class="btn btn-ghost btn-icon" data-act="close-modal">✕</button></div>' +
      '<div class="modal-body">' + m.fields.map((f) => fieldHTML(f, vals[f.key])).join('') + attachFieldHTML() + '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-act="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-act="save-record" data-id="' + m.id + '" data-rid="' + (rid || '') + '">保存</button></div>';
    openModal(html);
  }

  /* ---------------- 附件 ---------------- */
  function fmtSize(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return round1(n / 1024) + ' KB';
    return round1(n / 1024 / 1024) + ' MB';
  }

  function fileIcon(type, name) {
    const t = String(type || '').toLowerCase();
    const ext = String(name || '').split('.').pop().toLowerCase();
    if (/^image\//.test(t)) return '🖼️';
    if (t.includes('pdf') || ext === 'pdf') return '📕';
    if (t.includes('word') || ['doc', 'docx'].includes(ext)) return '📘';
    if (t.includes('sheet') || t.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return '📗';
    if (t.includes('presentation') || t.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) return '📙';
    if (t.includes('zip') || t.includes('rar') || ['zip', 'rar', '7z'].includes(ext)) return '🗜️';
    return '📄';
  }

  function attachRowHTML(f, i) {
    const isImg = /^image\//.test(f.type || '');
    return '<div class="attach-item">' +
      (isImg
        ? '<img class="attach-thumb" src="' + esc(f.data) + '" alt="">'
        : '<span class="attach-thumb attach-ico">' + fileIcon(f.type, f.name) + '</span>') +
      '<div class="attach-main">' +
        '<div class="attach-name">' + esc(f.name) + '</div>' +
        '<div class="attach-meta">' + fmtSize(f.size) + '</div>' +
      '</div>' +
      '<a class="btn btn-ghost btn-sm" href="' + esc(f.data) + '" download="' + esc(f.name) + '" target="_blank" rel="noopener">打开</a>' +
      '<button class="btn btn-danger btn-icon btn-sm" data-act="rm-file" data-i="' + i + '" title="移除">✕</button>' +
    '</div>';
  }

  function attachFieldHTML() {
    return '<div class="field"><label>附件</label>' +
      '<div class="attach-box">' +
        '<div id="attachList">' + pendingFiles.map((f, i) => attachRowHTML(f, i)).join('') + '</div>' +
        '<label class="attach-add"><input type="file" id="attachInput" multiple><span>＋ 添加文件</span></label>' +
        '<div class="help">课件、作业截图、录音都能放。图片会自动压缩，单个文件别超过 8MB。</div>' +
      '</div></div>';
  }

  function renderAttachList() {
    const box = $('#attachList');
    if (box) box.innerHTML = pendingFiles.map((f, i) => attachRowHTML(f, i)).join('');
  }

  function readDataURL(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  async function addFiles(list) {
    const arr = Array.from(list || []);
    if (!arr.length) return;
    let added = 0;
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      if (f.size > 8 * 1024 * 1024) { toast('「' + f.name + '」超过 8MB，换个小一点的吧', 'err'); continue; }
      try {
        if (/^image\//.test(f.type)) {
          const d = await compressImage(f, 1400, 0.8);
          pendingFiles.push({ id: uid(), name: f.name, size: f.size, type: 'image/jpeg', data: d });
        } else {
          const d = await readDataURL(f);
          pendingFiles.push({ id: uid(), name: f.name, size: f.size, type: f.type || 'application/octet-stream', data: d });
        }
        added++;
      } catch (e) { toast('「' + f.name + '」读不出来', 'err'); }
    }
    renderAttachList();
    if (added) toast('加了 ' + added + ' 个文件', 'ok');
  }

  function seedValues(m) {
    const v = {};
    m.fields.forEach((f) => { if (f.type === 'date') v[f.key] = todayStr(); });
    return v;
  }

  function saveRecord(id, rid) {
    const mask = $('.modal-mask'); if (!mask) return;
    const m = getModule(id);
    const values = formValues(mask, m);
    const first = m.fields[0];
    if (first && !values[first.key]) { toast('「' + first.label + '」不能空着', 'err'); return; }
    if (rid) {
      const rec = (state.entries[id] || []).find((r) => r.id === rid);
      if (rec) { rec.values = values; rec.files = pendingFiles.slice(); rec.updatedAt = Date.now(); }
    } else {
      state.entries[id] = state.entries[id] || [];
      state.entries[id].push({ id: uid(), values: values, files: pendingFiles.slice(), createdAt: Date.now() });
    }
    pendingFiles = [];
    save(); closeModal(); render(); toast(rid ? '已更新' : '记下了', 'ok');
  }

  function delRecord(id, rid) {
    const m = getModule(id);
    if (!confirm('删除这条「' + m.name + '」记录？删掉就找不回来了。')) return;
    state.entries[id] = (state.entries[id] || []).filter((r) => r.id !== rid);
    save(); render(); toast('已删除');
  }

  /* ---------------- 模块编辑 ---------------- */
  function openModuleForm(id) {
    const isNew = !id;
    const m = isNew ? { id: '', name: '', icon: '🧩', color: '#4f6ef7', fields: [{ key: 'title', label: '标题', type: 'text' }] } : JSON.parse(JSON.stringify(getModule(id)));
    let fields = m.fields;

    function body() {
      return '<div class="field"><label>模块名称 <span class="req">*</span></label>' +
        '<input type="text" id="mfName" value="' + esc(m.name) + '" placeholder="比如：实验记录 / 竞赛 / 读书"></div>' +
        '<div class="field-row"><div class="field"><label>图标</label><input type="text" id="mfIcon" value="' + esc(m.icon) + '" maxlength="4"></div>' +
        '<div class="field"><label>主题色</label><input type="color" id="mfColor" value="' + esc(m.color) + '" style="width:100%;height:42px;border:1px solid var(--line);border-radius:11px;padding:4px;background:#fbfcff"></div></div>' +
        '<div class="field"><label>字段（第一行作为主标题）</label>' +
        '<div id="fieldList">' + fields.map((f, i) =>
          '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center" data-fi="' + i + '">' +
          '<input type="text" class="f-label" value="' + esc(f.label) + '" placeholder="字段名" style="flex:1;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:#fbfcff">' +
          '<select class="f-type" style="width:96px;padding:9px 8px;border:1px solid var(--line);border-radius:10px;background:#fbfcff">' +
          F_TYPES.map((t) => '<option value="' + t.v + '"' + (f.type === t.v ? ' selected' : '') + '>' + t.n + '</option>').join('') + '</select>' +
          '<button class="btn btn-danger btn-icon btn-sm" data-act="rm-field" data-i="' + i + '">✕</button></div>').join('') + '</div>' +
        '<button class="btn btn-soft btn-sm" data-act="add-field">＋ 加一个字段</button>' +
        '<div class="help">选项类型的值用逗号分隔，例如：未开始,进行中,已完成</div></div>';
    }

    const html = '<div class="modal-head"><div><h3>' + (isNew ? '新建模块' : '编辑模块') + '</h3><p>想记什么就建什么，字段随时能改。</p></div>' +
      '<button class="btn btn-ghost btn-icon" data-act="close-modal">✕</button></div>' +
      '<div class="modal-body" id="mfBody">' + body() + '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-act="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-act="save-module" data-id="' + (id || '') + '">保存</button></div>';
    openModal(html, { noFocus: true });
  }

  function readModuleForm() {
    const name = $('#mfName').value.trim();
    const icon = $('#mfIcon').value.trim() || '🧩';
    const color = $('#mfColor').value || '#4f6ef7';
    const out = [];
    $$('#fieldList [data-fi]').forEach((row, i) => {
      const label = row.querySelector('.f-label').value.trim();
      const type = row.querySelector('.f-type').value;
      if (!label) return;
      const key = 'f' + i + '_' + label.replace(/\s/g, '').slice(0, 8) + '_' + Math.random().toString(36).slice(2, 5);
      const old = (window.__editFields || [])[i];
      out.push({ key: old ? old.key : key, label: label, type: type });
    });
    return { name, icon, color, fields: out };
  }

  function saveModule(id) {
    const data = readModuleForm();
    if (!data.name) { toast('给模块起个名字', 'err'); return; }
    if (!data.fields.length) { toast('至少留一个字段', 'err'); return; }
    if (id) {
      const m = getModule(id);
      Object.assign(m, { name: data.name, icon: data.icon, color: data.color, fields: data.fields });
    } else {
      const nid = 'm_' + uid();
      state.modules.push({ id: nid, name: data.name, icon: data.icon, color: data.color, builtin: false, enabled: true, fields: data.fields });
      state.entries[nid] = [];
      currentModule = nid;
    }
    save(); closeModal(); render(); toast('模块已保存', 'ok');
  }

  /* ---------------- 地图 ---------------- */
  function renderMap() {
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:18px;flex-wrap:wrap">' +
      '<div class="tabs">' +
        '<button class="tab' + (mapTab === 'image' ? ' is-active' : '') + '" data-act="map-tab" data-tab="image">校区平面图</button>' +
        '<button class="tab' + (mapTab === 'amap' ? ' is-active' : '') + '" data-act="map-tab" data-tab="amap">高德地图</button>' +
      '</div>' +
      (mapTab === 'image' && state.map.image
        ? '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-' + (addMode ? 'primary' : 'ghost') + ' btn-sm" data-act="toggle-add">' + (addMode ? '✓ 标注模式：点图放置' : '＋ 添加标记') + '</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="change-image">换底图</button></div>'
        : '') +
      '</div>' +
      (mapTab === 'image' ? mapImageHTML() : amapHTML());
  }

  function mapImageHTML() {
    if (!state.map.image) {
      return '<div class="map-stage" style="margin-top:18px"><div class="map-empty">' +
        '<div><div class="me-ico">🗺️</div><h3>先放一张校区平面图</h3>' +
        '<p>截图、招生简章上的那张图、或者你自己画的都行。放进来之后，就能在上面钉标记：教学楼、食堂、失物招领点、常去的自习室。</p>' +
        '<button class="btn btn-primary" data-act="upload-image">选择图片</button>' +
        '<p style="margin-top:14px;font-size:11.5px">图片只存在你自己的设备上，不会上传。</p></div></div></div>';
    }
    const markers = state.map.markers.filter((mk) => catOn.has(mk.cat));
    const pins = markers.map((mk) => {
      const c = catOf(mk.cat);
      return '<div class="marker" style="left:' + mk.x + '%;top:' + mk.y + '%" data-act="open-marker" data-mid="' + mk.id + '">' +
        '<div class="pin" style="background:' + c.color + '"><span>' + c.icon + '</span></div>' +
        '<div class="marker-label">' + esc(mk.name) + '</div></div>';
    }).join('');

    const legend = CATS.map((c) =>
      '<div class="legend-item' + (catOn.has(c.id) ? '' : ' is-off') + '" data-act="toggle-cat" data-cat="' + c.id + '">' +
      '<span class="legend-dot" style="background:' + c.color + '"></span>' + c.name +
      '<span style="color:var(--muted)">' + state.map.markers.filter((m) => m.cat === c.id).length + '</span></div>').join('');

    const list = state.map.markers.length ? state.map.markers.map((mk) =>
      '<div class="ml-item" data-act="focus-marker" data-mid="' + mk.id + '">' +
      '<span class="ml-dot" style="background:' + catOf(mk.cat).color + '"></span>' +
      '<span class="ml-name">' + esc(mk.name) + '</span>' +
      '<span class="ml-cat">' + catOf(mk.cat).name + '</span></div>').join('')
      : '<div style="font-size:12px;color:var(--muted);padding:8px 4px;line-height:1.7">还没有标记。点上面的「添加标记」，然后在图上点一下。</div>';

    return '<div class="map-layout">' +
      '<div class="map-stage' + (addMode ? ' add-mode' : '') + '" id="mapStage">' +
        '<div class="map-canvas" id="mapCanvas"><div class="map-inner" id="mapInner">' +
          '<img class="map-img" id="mapImg" src="' + state.map.image + '" alt="校区平面图">' + pins +
        '</div></div>' +
      '</div>' +
      '<div class="map-side">' +
        '<div class="side-card"><h4>分类 <span style="font-weight:400;color:var(--muted);font-size:10.5px">点一下可隐藏</span></h4><div class="legend">' + legend + '</div></div>' +
        '<div class="side-card" style="flex:1"><h4>标记 <span style="font-weight:400;color:var(--muted);font-size:10.5px">' + state.map.markers.length + ' 个</span></h4>' +
          '<div class="marker-list">' + list + '</div></div>' +
        '<div class="side-card" style="font-size:11.5px;color:var(--muted);line-height:1.8">' +
          '提示：先点「添加标记」，再点图上位置；点已有的标记可以改名字或删掉。</div>' +
      '</div></div>';
  }

  function amapHTML() {
    if (!state.settings.amapKey) {
      return '<div class="map-stage" style="margin-top:18px"><div class="map-empty">' +
        '<div><div class="me-ico">📍</div><h3>接一张真实地图</h3>' +
        '<p>填上高德 Key 之后，这里会显示学校周边的真实地图：可以搜索、看公交、标位置。<br>Key 在「设置 → 高德地图」里填，申请方法看旁边的说明。</p>' +
        '<button class="btn btn-primary" data-act="nav" data-view="settings">去填 Key</button></div></div></div>';
    }
    return '<div class="map-layout" style="margin-top:18px">' +
      '<div id="amapStage"></div>' +
      '<div class="map-side">' +
        '<div class="side-card"><h4>地图标记</h4><div id="amapList" style="font-size:12px;color:var(--muted)">加载中…</div></div>' +
        '<div class="side-card"><h4>操作</h4>' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
            '<button class="btn btn-ghost btn-sm" data-act="amap-locate">🎯 定位到学校</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="amap-add">＋ 在地图上标一个点</button>' +
          '</div></div>' +
      '</div></div>';
  }

  function afterMap() {
    if (mapTab !== 'amap' || !state.settings.amapKey) return;
    loadAMap().then(() => initAMap()).catch((e) => {
      const s = $('#amapStage');
      if (s) s.innerHTML = '<div class="amap-hint">地图加载失败：' + esc(e.message || '检查 Key 是否正确、是否开通了 Web 端（JS API）') + '</div>';
    });
  }

  function loadAMap() {
    if (window.AMap) return Promise.resolve();
    return new Promise((res, rej) => {
      if (state.settings.amapSecret) window._AMapSecurityConfig = { securityJsCode: state.settings.amapSecret };
      const s = document.createElement('script');
      s.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(state.settings.amapKey);
      s.onload = () => (window.AMap ? res() : rej(new Error('脚本已加载但 AMap 未就绪')));
      s.onerror = () => rej(new Error('网络或 Key 有问题，脚本没加载成功'));
      document.head.appendChild(s);
      setTimeout(() => { if (!window.AMap) rej(new Error('加载超时')); }, 12000);
    });
  }

  function initAMap() {
    if (amapInst) { try { amapInst.destroy(); } catch (e) { } amapInst = null; }
    const center = state.settings.center || [116.397, 39.909];
    const zoom = state.settings.center ? 16 : 4;
    amapInst = new AMap.Map('amapStage', { zoom: zoom, center: center, viewMode: '2D' });
    amapInst.on('click', (e) => {
      if (!window.__amapAdd) return;
      window.__amapAdd = false;
      openAmapMarkerForm(null, [e.lnglat.getLng(), e.lnglat.getLat()]);
    });
    renderAmapMarkers();
  }

  function renderAmapMarkers() {
    if (!amapInst) return;
    amapInst.clearMap();
    (state.amapMarkers || []).forEach((mk) => {
      const c = catOf(mk.cat);
      const marker = new AMap.Marker({
        position: [mk.lng, mk.lat],
        content: '<div style="transform:translate(-50%,-100%);text-align:center;cursor:pointer">' +
          '<div style="width:28px;height:28px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:' + c.color + ';border:2.5px solid #fff;box-shadow:0 6px 12px rgba(0,30,60,.3);display:grid;place-items:center">' +
          '<span style="transform:rotate(45deg);font-size:12px">' + c.icon + '</span></div>' +
          '<div style="font-size:10.5px;font-weight:600;background:rgba(27,35,64,.85);color:#fff;padding:1px 7px;border-radius:99px;white-space:nowrap;margin-top:2px">' + esc(mk.name) + '</div></div>',
        offset: new AMap.Pixel(0, 0),
      });
      marker.on('click', () => openAmapMarkerForm(mk));
      amapInst.add(marker);
    });
    const list = $('#amapList');
    if (list) {
      list.innerHTML = (state.amapMarkers || []).length
        ? state.amapMarkers.map((mk) => '<div class="ml-item" style="padding:6px 2px"><span class="ml-dot" style="background:' + catOf(mk.cat).color + '"></span><span class="ml-name">' + esc(mk.name) + '</span></div>').join('')
        : '<span style="font-size:12px;color:var(--muted)">还没有标记。</span>';
    }
    if (state.settings.center) amapInst.setCenter(state.settings.center);
  }

  function openAmapMarkerForm(existing, lnglat) {
    const mk = existing || { name: '', cat: 'teach', desc: '', lng: lnglat[0], lat: lnglat[1] };
    const html = '<div class="modal-head"><div><h3>' + (existing ? '编辑标记' : '新标记') + '</h3><p>' + mk.lng.toFixed(5) + ', ' + mk.lat.toFixed(5) + '</p></div>' +
      '<button class="btn btn-ghost btn-icon" data-act="close-modal">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>名称 <span class="req">*</span></label><input type="text" id="apName" value="' + esc(mk.name) + '" placeholder="比如：第三教学楼"></div>' +
        '<div class="field"><label>分类</label><select id="apCat">' + CATS.map((c) => '<option value="' + c.id + '"' + (mk.cat === c.id ? ' selected' : '') + '>' + c.icon + ' ' + c.name + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>备注</label><textarea id="apDesc" rows="3">' + esc(mk.desc || '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' + (existing ? '<button class="btn btn-danger" data-act="del-amap-marker" data-mid="' + mk.id + '">删除</button>' : '') +
      '<button class="btn btn-ghost" data-act="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-act="save-amap-marker" data-mid="' + (mk.id || '') + '">保存</button></div>';
    const mask = openModal(html);
    mask.dataset.lng = mk.lng; mask.dataset.lat = mk.lat;
  }

  function openMarkerForm(mid, pt) {
    const mk = mid ? state.map.markers.find((m) => m.id === mid) : { name: '', cat: 'teach', desc: '', x: pt.x, y: pt.y };
    const html = '<div class="modal-head"><div><h3>' + (mid ? '编辑标记' : '新标记') + '</h3><p>位置 (' + mk.x.toFixed(1) + '%, ' + mk.y.toFixed(1) + '%)</p></div>' +
      '<button class="btn btn-ghost btn-icon" data-act="close-modal">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>名称 <span class="req">*</span></label><input type="text" id="mkName" value="' + esc(mk.name) + '" placeholder="比如：三食堂 / 自习室 A302"></div>' +
        '<div class="field"><label>分类</label><select id="mkCat">' + CATS.map((c) => '<option value="' + c.id + '"' + (mk.cat === c.id ? ' selected' : '') + '>' + c.icon + ' ' + c.name + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>备注</label><textarea id="mkDesc" rows="2">' + esc(mk.desc || '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' + (mid ? '<button class="btn btn-danger" data-act="del-marker" data-mid="' + mid + '">删除</button>' : '') +
      '<button class="btn btn-ghost" data-act="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-act="save-marker" data-mid="' + (mid || '') + '">保存</button></div>';
    const mask = openModal(html);
    mask.dataset.x = mk.x; mask.dataset.y = mk.y;
  }

  function compressImage(file, boxW, quality) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxW = boxW || 1800;
          const scale = Math.min(1, maxW / img.width);
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * scale);
          cv.height = Math.round(img.height * scale);
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', quality || 0.86));
        };
        img.onerror = rej;
        img.src = fr.result;
      };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  /* ---------------- 打卡 ---------------- */
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { const t = new Date(d); t.setDate(t.getDate() + n); return t; }
  function weekStartOf(d) { const t = new Date(d); const w = (t.getDay() + 6) % 7; t.setDate(t.getDate() - w); t.setHours(0, 0, 0, 0); return t; }

  function habitStats() {
    const map = new Map();
    recs('habits').forEach((r) => {
      const h = String(r.values.habit || '').trim();
      const d = r.values.date;
      if (!h || !d) return;
      if (!map.has(h)) map.set(h, new Set());
      map.get(h).add(d);
    });
    const today = ymd(new Date());
    const yst = ymd(addDays(new Date(), -1));
    const month = today.slice(0, 7);
    const list = [];
    map.forEach((set, name) => {
      let cur = 0;
      let probe = set.has(today) ? new Date() : set.has(yst) ? addDays(new Date(), -1) : null;
      while (probe && set.has(ymd(probe))) { cur++; probe = addDays(probe, -1); }
      let best = 0, run = 0, prev = null;
      Array.from(set).sort().forEach((d) => {
        const t = parseDay(d);
        run = prev && dayDiff(t, prev) === 1 ? run + 1 : 1;
        if (run > best) best = run;
        prev = t;
      });
      list.push({
        name, dates: set, current: cur, best,
        total: set.size,
        month: Array.from(set).filter((d) => d.startsWith(month)).length,
        todayDone: set.has(today),
      });
    });
    list.sort((a, b) => b.current - a.current || b.total - a.total);
    return list;
  }

  function heatmapHTML(set, weeks) {
    weeks = weeks || 13;
    const end = weekStartOf(new Date());
    const today = ymd(new Date());
    let cells = '';
    for (let w = weeks - 1; w >= 0; w--) {
      const start = addDays(end, -w * 7);
      for (let i = 0; i < 7; i++) {
        const k = ymd(addDays(start, i));
        cells += '<span class="hm-cell' + (set.has(k) ? ' on' : '') + (k > today ? ' future' : '') + '" title="' + k + '"></span>';
      }
    }
    return '<div class="hm-grid">' + cells + '</div>';
  }

  function habitsBlock() {
    const list = habitStats();
    if (!list.length) {
      return '<div class="card" style="margin-top:14px"><div class="empty" style="padding:34px 20px">' +
        '<div class="e-ico">🔥</div><h4>还没有开始打卡</h4>' +
        '<p>先想一个真想坚持的小习惯——背单词、跑步、早睡都行。每天点一下，这里会长出一条热力图。</p>' +
        '<button class="btn btn-primary" data-act="add-record" data-id="habits">＋ 加一个习惯</button></div></div>';
    }
    const cards = list.map((h) =>
      '<div class="habit-card">' +
        '<div class="hc-top"><div class="hc-name">' + esc(h.name) + '</div>' +
        (h.todayDone
          ? '<span class="tag tag-teal">今天 ✓</span>'
          : '<button class="btn btn-primary btn-sm" data-act="checkin" data-habit="' + encodeURIComponent(h.name) + '">今天打卡</button>') +
        '</div>' +
        '<div class="hc-nums"><span><b>' + h.current + '</b> 天连续</span><span><b>' + h.month + '</b> 本月</span><span><b>' + h.total + '</b> 累计</span></div>' +
        '<div class="hm">' + heatmapHTML(h.dates) + '</div>' +
      '</div>').join('');
    return '<div class="habit-grid" style="margin-top:14px">' + cards + '</div>';
  }

  function checkinToday(name) {
    const today = ymd(new Date());
    const dup = recs('habits').some((r) => String(r.values.habit || '').trim() === name && r.values.date === today);
    if (dup) { toast('今天已经打过卡了'); return; }
    state.entries.habits = state.entries.habits || [];
    state.entries.habits.push({ id: uid(), values: { habit: name, date: today, note: '' }, createdAt: Date.now() });
    save(); render(); toast('打卡成功 · ' + name, 'ok');
  }

  /* ---------------- 周报 ---------------- */
  function reportData(offset) {
    const start = addDays(weekStartOf(new Date()), offset * 7);
    const end = addDays(start, 6);
    const s = ymd(start), e = ymd(end);
    const inWeek = (d) => !!d && d >= s && d <= e;
    const today = ymd(new Date());

    const records = [];
    state.modules.forEach((m) => {
      recs(m.id).forEach((r) => { const d = entryDay(r); if (inWeek(d)) records.push({ m, r, d }); });
    });
    const byModule = {};
    records.forEach((x) => { byModule[x.m.name] = (byModule[x.m.name] || 0) + 1; });

    const ps = ymd(addDays(start, -7)), pe = ymd(addDays(start, -1));
    let prevRecords = 0;
    state.modules.forEach((m) => recs(m.id).forEach((r) => { const d = entryDay(r); if (d && d >= ps && d <= pe) prevRecords++; }));

    const tasks = recs('tasks');
    const weekTasks = tasks.filter((r) => inWeek(r.values.due));
    const doneWeek = weekTasks.filter((r) => r.values.status === '已完成');
    const overdue = tasks.filter((r) => r.values.status !== '已完成' && r.values.due && r.values.due < today);

    const habits = [];
    const hmap = new Map();
    recs('habits').forEach((r) => {
      const h = String(r.values.habit || '').trim();
      if (!h || !inWeek(r.values.date)) return;
      hmap.set(h, (hmap.get(h) || 0) + 1);
    });
    hmap.forEach((v, k) => habits.push({ name: k, days: v }));

    const grades = recs('grades').filter((r) => inWeek(r.values.date));
    const notes = recs('notes').filter((r) => inWeek(r.values.date));
    const attached = records.filter((x) => (x.r.files || []).length).length;

    return { start, end, s, e, records, byModule, prevRecords, weekTasks, doneWeek, overdue, habits, grades, notes, attached, offset };
  }

  function buildReportText(offset) {
    const d = reportData(offset);
    const L = [];
    L.push('# 校园周报 · ' + d.s + ' ~ ' + d.e);
    L.push('');

    L.push('## 这一周');
    if (d.records.length) {
      const parts = Object.entries(d.byModule).map(([k, v]) => k + ' ' + v).join('、');
      L.push('- 新增记录 ' + d.records.length + ' 条（' + parts + '）');
      if (d.attached) L.push('- 其中 ' + d.attached + ' 条带了附件');
      if (d.prevRecords) {
        const diff = d.records.length - d.prevRecords;
        L.push('- 比上一周' + (diff >= 0 ? '多 ' : '少 ') + Math.abs(diff) + ' 条');
      }
    } else {
      L.push('- 这一周没有新增任何记录。');
    }
    L.push('');

    L.push('## 任务');
    if (d.weekTasks.length || d.overdue.length) {
      L.push('- 本周到期 ' + d.weekTasks.length + ' 项，完成 ' + d.doneWeek.length + ' 项');
      if (d.doneWeek.length) L.push('- 完成的：' + d.doneWeek.map((r) => r.values.title || '未命名').join('、'));
      if (d.overdue.length) {
        const os = d.overdue.slice(0, 4).map((r) => (r.values.title || '未命名') + '（' + r.values.due + '）').join('、');
        L.push('- 目前逾期 ' + d.overdue.length + ' 项：' + os + (d.overdue.length > 4 ? ' 等' : ''));
      }
    } else {
      L.push('- 这一周没有到期任务。');
    }
    L.push('');

    L.push('## 打卡');
    if (d.habits.length) {
      d.habits.forEach((x) => L.push('- ' + x.name + '：' + x.days + '/7 天'));
    } else {
      L.push('- 这一周还没有打卡记录。');
    }
    L.push('');

    if (d.grades.length) {
      L.push('## 成绩');
      L.push('- 新录入 ' + d.grades.length + ' 门：' +
        d.grades.map((r) => (r.values.course || '未命名') + ' ' + (r.values.score == null ? '' : r.values.score)).join('、'));
      L.push('');
    }

    if (d.notes.length) {
      L.push('## 笔记');
      L.push('- 写了 ' + d.notes.length + ' 条：' + d.notes.map((r) => r.values.title || '未命名').join('、'));
      L.push('');
    }

    L.push('## 一句话');
    const bits = [];
    if (d.records.length) bits.push('这周记了 ' + d.records.length + ' 条');
    else bits.push('这周什么都没记');
    if (d.doneWeek.length) bits.push('完成了 ' + d.doneWeek.length + ' 件事');
    if (d.overdue.length) bits.push('还有 ' + d.overdue.length + ' 件逾期没结');
    if (d.habits.length) bits.push('打卡 ' + d.habits.reduce((a, x) => a + x.days, 0) + ' 次');
    L.push(bits.join('，') + '。');
    return L.join('\n');
  }

  function renderReport() {
    const d = reportData(reportOffset);
    const text = buildReportText(reportOffset);
    const label = reportOffset === 0 ? '本周' : reportOffset === -1 ? '上周' : Math.abs(reportOffset) + ' 周前';
    const stats = [
      ['本周记录', d.records.length + ' 条'],
      ['完成任务', d.doneWeek.length + ' 项'],
      ['逾期中', d.overdue.length + ' 项'],
      ['打卡', d.habits.reduce((a, x) => a + x.days, 0) + ' 次'],
    ];
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:18px;gap:12px;flex-wrap:wrap">' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<button class="btn btn-ghost btn-icon" data-act="report-nav" data-d="-1">‹</button>' +
          '<div style="min-width:180px;text-align:center"><b style="font-size:14px">' + label + '</b>' +
            '<span style="color:var(--muted);font-size:12px;margin-left:6px">' + d.s + ' ~ ' + d.e + '</span></div>' +
          '<button class="btn btn-ghost btn-icon" data-act="report-nav" data-d="1"' + (reportOffset >= 0 ? ' style="opacity:.35;pointer-events:none"' : '') + '>›</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-ghost btn-sm" data-act="copy-report">复制文字</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="download-report">下载 .md</button>' +
        '</div>' +
      '</div>' +
      '<div class="section grid grid-4">' +
        stats.map(([k, v]) => '<div class="stat"><div class="stat-label">' + k + '</div><div class="stat-val" style="font-size:22px">' + v + '</div></div>').join('') +
      '</div>' +
      '<div class="section card"><pre class="report-pre" id="reportText">' + esc(text) + '</pre></div>';
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => toast('已复制，去粘到备忘录里', 'ok'), () => fallbackCopy(t));
    } else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制', 'ok'); } catch (e) { toast('复制失败，手动选中吧', 'err'); }
    ta.remove();
  }
  function downloadText(name, t) {
    const blob = new Blob([t], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已下载', 'ok');
  }

  /* ---------------- 云同步（GitHub Gist） ---------------- */
  const GIST_FILE = 'campus-data.json';

  async function gistCall(path, opts) {
    const tok = (state.settings.ghToken || '').trim();
    if (!tok) throw new Error('先填 GitHub Token');
    const res = await fetch('https://api.github.com' + path, Object.assign({
      headers: {
        Authorization: 'Bearer ' + tok,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
    }, opts || {}));
    if (!res.ok) {
      let msg = res.status;
      try { const j = await res.json(); msg = (j.message || msg) + '（' + res.status + '）'; } catch (e) { }
      throw new Error(msg);
    }
    return res.json();
  }

  async function gistPush() {
    const btn = $('#gistStatus');
    if (btn) btn.textContent = '上传中…';
    try {
      const content = JSON.stringify({ updatedAt: Date.now(), data: state });
      const id = (state.settings.ghGist || '').trim();
      if (id) {
        await gistCall('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content } } }) });
      } else {
        const r = await gistCall('/gists', {
          method: 'POST',
          body: JSON.stringify({ description: '校园工作站数据（自动生成）', public: false, files: { [GIST_FILE]: { content } } }),
        });
        state.settings.ghGist = r.id;
      }
      state.settings.lastSync = Date.now();
      save({ silent: true });
      toast('已上传到云端', 'ok');
      render();
    } catch (e) {
      toast('上传失败：' + e.message, 'err');
      if (btn) btn.textContent = '上传失败';
    }
  }

  async function gistPull() {
    try {
      const id = (state.settings.ghGist || '').trim();
      if (!id) { toast('还没有云端副本，先点「上传」', 'err'); return; }
      const r = await gistCall('/gists/' + id);
      const f = r.files && r.files[GIST_FILE];
      if (!f) { toast('云端没有数据文件', 'err'); return; }
      let text = f.content;
      if (f.truncated && f.raw_url) {
        const raw = await fetch(f.raw_url, { headers: { Authorization: 'Bearer ' + state.settings.ghToken } });
        text = await raw.text();
      }
      const remote = JSON.parse(text);
      const remoteTime = remote.updatedAt || 0;
      if ((state.updatedAt || 0) > remoteTime + 1000) {
        if (!confirm('本地数据看起来比云端新，确定用云端覆盖本地？')) return;
      }
      state = migrate(remote.data || remote);
      state.updatedAt = remoteTime;
      save({ keepTime: true }); render();
      toast('已从云端同步下来', 'ok');
    } catch (e) { toast('下载失败：' + e.message, 'err'); }
  }

  /* ---------------- 设置 ---------------- */
  function syncStatus() {
    if (!state.settings.ghGist) return '还没有云端副本。填好 Token 后点「上传到云端」，会自动创建一个私有 Gist。';
    const t = state.settings.lastSync ? new Date(state.settings.lastSync).toLocaleString('zh-CN') : '未知';
    return '云端副本：' + state.settings.ghGist + '<br>上次同步：' + t;
  }

  function renderSettings() {
    const modRows = state.modules.map((m) =>
      '<div class="set-row"><div class="sr-main"><strong>' + m.icon + ' ' + esc(m.name) + '</strong>' +
      '<span>' + (m.builtin ? '内置模块' : '自定义模块') + ' · ' + (state.entries[m.id] || []).length + ' 条</span></div>' +
      '<div class="sr-ctl">' +
      (m.builtin ? '' : '<button class="btn btn-ghost btn-sm" data-act="edit-module" data-id="' + m.id + '">字段</button>' +
        '<button class="btn btn-danger btn-sm" data-act="del-module" data-id="' + m.id + '">删除</button>') +
      '<button class="switch' + (m.enabled ? ' on' : '') + '" data-act="toggle-module" data-id="' + m.id + '"></button></div></div>').join('');

    return '<div class="section grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">' +
      '<div class="card"><div class="section-head"><h2>基本信息</h2></div>' +
        '<div class="field"><label>学校名称</label><input type="text" id="setSchool" value="' + esc(state.settings.school) + '"></div>' +
        '<div class="field"><label>一句话签名</label><input type="text" id="setTagline" value="' + esc(state.settings.tagline) + '"></div>' +
        '<button class="btn btn-primary btn-sm" data-act="save-basic">保存</button>' +
      '</div>' +
      '<div class="card"><div class="section-head"><h2>数据存放</h2></div>' +
        '<div class="set-list">' +
          '<div class="set-row"><div class="sr-main"><strong>' + (fileHandle ? '已绑定数据文件' : '未绑定文件') + '</strong>' +
            '<span>' + (fileHandle ? '每次改动自动写入，可随时拷走备份' : '现在只存在这个浏览器里，清缓存会丢') + '</span></div>' +
            '<div class="sr-ctl"><button class="btn btn-ghost btn-sm" data-act="pick-file">' + (fileHandle ? '更换' : '选择文件') + '</button></div></div>' +
          '<div class="set-row"><div class="sr-main"><strong>导出 / 导入</strong><span>手动备份一份 JSON，换电脑时用得上</span></div>' +
            '<div class="sr-ctl"><button class="btn btn-ghost btn-sm" data-act="export">导出</button><button class="btn btn-ghost btn-sm" data-act="import">导入</button></div></div>' +
          '<div class="set-row"><div class="sr-main"><strong>清空全部数据</strong><span>不可撤销，先导出一份备份</span></div>' +
            '<div class="sr-ctl"><button class="btn btn-danger btn-sm" data-act="clear">清空</button></div></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">' +
      '<div class="card"><div class="section-head"><h2>模块</h2><button class="btn btn-soft btn-sm" data-act="new-module">＋ 新建</button></div>' +
        '<div class="set-list">' + modRows + '</div></div>' +

      '<div class="card"><div class="section-head"><h2>高德地图</h2></div>' +
        '<div class="field"><label>Web 端 Key（JS API）</label><div class="key-box">' +
          '<input type="text" id="setAmapKey" value="' + esc(state.settings.amapKey) + '" placeholder="一串 32 位字符"></div></div>' +
        '<div class="field"><label>安全密钥 jscode（2021 年 12 月后申请的 Key 需要）</label>' +
          '<input type="text" id="setAmapSecret" value="' + esc(state.settings.amapSecret) + '" placeholder="可留空"></div>' +
        '<div class="field-row"><div class="field"><label>中心经度</label><input type="number" step="0.000001" id="setLng" value="' + (state.settings.center ? state.settings.center[0] : '') + '"></div>' +
          '<div class="field"><label>中心纬度</label><input type="number" step="0.000001" id="setLat" value="' + (state.settings.center ? state.settings.center[1] : '') + '"></div></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<button class="btn btn-primary btn-sm" data-act="save-amap">保存</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="find-school">搜学校坐标</button>' +
        '</div>' +
        '<div class="help" style="margin-top:12px;line-height:1.9">申请方式：<br>' +
          '1. 打开 <a href="https://lbs.amap.com" target="_blank" rel="noopener" style="color:var(--primary)">lbs.amap.com</a> 注册并完成实名认证<br>' +
          '2. 控制台 → 应用管理 → 我的应用 → 创建新应用<br>' +
          '3. 添加 Key，服务平台选「Web 端（JS API）」<br>' +
          '4. 把 Key 和「安全密钥」分别填到上面两栏</div>' +
      '</div>' +
    '</div>' +

    '<div class="section grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">' +
      '<div class="card"><div class="section-head"><h2>云同步（可选）</h2>' +
        '<span class="hint">' + (state.settings.ghGist ? '已连接' : '未启用') + '</span></div>' +
        '<div class="field"><label>GitHub Token（只需 gist 权限）</label>' +
          '<input type="password" id="setGhToken" value="' + esc(state.settings.ghToken || '') + '" placeholder="ghp_…">' +
          '<div class="help">让手机和电脑共用同一份数据。不用的话完全不填，不影响本地使用。</div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-primary btn-sm" data-act="gist-save">保存 Token</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="gist-push">上传到云端</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="gist-pull">从云端下载</button>' +
        '</div>' +
        '<div id="gistStatus" style="font-size:11.5px;color:var(--muted);margin-top:10px;line-height:1.8">' + syncStatus() + '</div>' +
      '</div>' +
      '<div class="card"><div class="section-head"><h2>在手机上用</h2></div>' +
        '<div class="help" style="line-height:2;font-size:12px">' +
          '<b>① 同一个 Wi-Fi</b><br>手机连同一个网络，访问 <code>http://电脑IP:8765</code>。<br><br>' +
          '<b>② 电脑关着也要用</b><br>把 app 文件夹传到静态托管（GitHub Pages 等），手机随时打开；数据靠左边的云同步保持一致。<br><br>' +
          '完整步骤见根目录的 <b>手机访问.md</b>。' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 动作 ---------------- */
  const ACT = {
    nav: (el) => go(el.dataset.view),
    'switch-module': (el) => { currentModule = el.dataset.id; searchQ = ''; render(); },
    'add-record': (el) => openRecordForm(el.dataset.id, null),
    'edit-record': (el) => openRecordForm(el.dataset.id, el.dataset.rid),
    'del-record': (el) => delRecord(el.dataset.id, el.dataset.rid),
    'save-record': (el) => saveRecord(el.dataset.id, el.dataset.rid),
    'close-modal': () => closeModal(),
    'new-module': () => { window.__editFields = []; openModuleForm(null); },
    'edit-module': (el) => { const m = getModule(el.dataset.id); window.__editFields = JSON.parse(JSON.stringify(m.fields)); openModuleForm(el.dataset.id); },
    'del-module': (el) => {
      const m = getModule(el.dataset.id);
      if (!confirm('删除模块「' + m.name + '」和它的 ' + (state.entries[m.id] || []).length + ' 条记录？')) return;
      state.modules = state.modules.filter((x) => x.id !== m.id);
      delete state.entries[m.id];
      save(); render(); toast('已删除');
    },
    'toggle-module': (el) => { const m = getModule(el.dataset.id); m.enabled = !m.enabled; save(); render(); },
    'add-field': () => {
      const list = $('#fieldList');
      const i = list.children.length;
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
      div.dataset.fi = i;
      div.innerHTML = '<input type="text" class="f-label" placeholder="字段名" style="flex:1;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:#fbfcff">' +
        '<select class="f-type" style="width:96px;padding:9px 8px;border:1px solid var(--line);border-radius:10px;background:#fbfcff">' +
        F_TYPES.map((t) => '<option value="' + t.v + '">' + t.n + '</option>').join('') + '</select>' +
        '<button class="btn btn-danger btn-icon btn-sm" data-act="rm-field" data-i="' + i + '">✕</button>';
      list.appendChild(div);
    },
    'rm-field': (el) => { const row = el.closest('[data-fi]'); if (row) row.remove(); },
    'save-module': (el) => saveModule(el.dataset.id),
    'map-tab': (el) => { mapTab = el.dataset.tab; render(); },
    'toggle-add': () => { addMode = !addMode; render(); },
    'upload-image': () => pickImage(),
    'change-image': () => pickImage(),
    'toggle-cat': (el) => { const c = el.dataset.cat; catOn.has(c) ? catOn.delete(c) : catOn.add(c); render(); },
    'open-marker': (el) => { const mk = state.map.markers.find((m) => m.id === el.dataset.mid); if (mk) openMarkerForm(mk.id); },
    'focus-marker': (el) => { const mk = state.map.markers.find((m) => m.id === el.dataset.mid); if (mk) openMarkerForm(mk.id); },
    'save-marker': (el) => {
      const mask = $('.modal-mask');
      const name = $('#mkName').value.trim();
      if (!name) { toast('给它起个名字', 'err'); return; }
      const cat = $('#mkCat').value, desc = $('#mkDesc').value;
      const mid = el.dataset.mid;
      if (mid) { const mk = state.map.markers.find((m) => m.id === mid); Object.assign(mk, { name, cat, desc }); }
      else {
        state.map.markers.push({ id: uid(), name, cat, desc, x: parseFloat(mask.dataset.x), y: parseFloat(mask.dataset.y) });
      }
      save(); addMode = false; closeModal(); render(); toast('标记已保存', 'ok');
    },
    'del-marker': (el) => {
      if (!confirm('删除这个标记？')) return;
      state.map.markers = state.map.markers.filter((m) => m.id !== el.dataset.mid);
      save(); closeModal(); render();
    },
    'save-amap-marker': (el) => {
      const mask = $('.modal-mask');
      const name = $('#apName').value.trim();
      if (!name) { toast('给它起个名字', 'err'); return; }
      const cat = $('#apCat').value, desc = $('#apDesc').value;
      const mid = el.dataset.mid;
      if (mid) { const mk = state.amapMarkers.find((m) => m.id === mid); Object.assign(mk, { name, cat, desc }); }
      else state.amapMarkers.push({ id: uid(), name, cat, desc, lng: parseFloat(mask.dataset.lng), lat: parseFloat(mask.dataset.lat) });
      save(); closeModal(); renderAmapMarkers(); toast('标记已保存', 'ok');
    },
    'del-amap-marker': (el) => {
      if (!confirm('删除这个标记？')) return;
      state.amapMarkers = state.amapMarkers.filter((m) => m.id !== el.dataset.mid);
      save(); closeModal(); renderAmapMarkers();
    },
    'amap-add': () => { window.__amapAdd = true; toast('在地图上点一下你要标的位置'); },
    'amap-locate': () => locateSchool(),
    'save-basic': () => {
      state.settings.school = $('#setSchool').value.trim() || '我的学校';
      state.settings.tagline = $('#setTagline').value.trim() || '我的学习与我的一亩三分地';
      save(); render(); toast('已保存', 'ok');
    },
    'save-amap': () => {
      state.settings.amapKey = $('#setAmapKey').value.trim();
      state.settings.amapSecret = $('#setAmapSecret').value.trim();
      const lng = parseFloat($('#setLng').value), lat = parseFloat($('#setLat').value);
      state.settings.center = (!isNaN(lng) && !isNaN(lat)) ? [lng, lat] : null;
      save(); toast('已保存，去地图页看看', 'ok');
    },
    'find-school': () => findSchoolCoords(),
    'pick-file': () => pickDataFile(),
    export: () => exportJSON(),
    import: () => importJSON(),
    clear: () => {
      if (!confirm('清空全部数据？建议先导出一份备份。')) return;
      if (!confirm('真的确定？这一步不可撤销。')) return;
      state = defaultState(); save(); go('overview'); toast('已清空');
    },
    checkin: (el) => checkinToday(decodeURIComponent(el.dataset.habit)),
    'rm-file': (el) => { pendingFiles.splice(Number(el.dataset.i), 1); renderAttachList(); },
    'report-nav': (el) => { reportOffset = Math.min(0, reportOffset + Number(el.dataset.d)); render(); },
    'copy-report': () => copyText(buildReportText(reportOffset)),
    'download-report': () => {
      const d = reportData(reportOffset);
      downloadText('校园周报-' + d.s + '.md', buildReportText(reportOffset));
    },
    'gist-save': () => {
      state.settings.ghToken = $('#setGhToken').value.trim();
      save(); render();
      toast(state.settings.ghToken ? 'Token 已保存' : '已清空 Token', 'ok');
    },
    'gist-push': () => gistPush(),
    'gist-pull': () => gistPull(),
  };

  function pickImage() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      toast('正在处理图片…');
      try {
        const data = await compressImage(f);
        state.map.image = data;
        state.map.markers = [];
        save(); render(); toast('底图已就位，点「添加标记」开始钉', 'ok');
      } catch (e) { toast('图片读取失败，换一张试试', 'err'); }
    };
    inp.click();
  }

  function findSchoolCoords() {
    const name = $('#setSchool').value.trim() || state.settings.school;
    if (!window.AMap) { toast('先把 Key 填上并保存，再来搜坐标', 'err'); return; }
    const ps = new AMap.PlaceSearch({ pageSize: 1, pageIndex: 1 });
    ps.search(name, (status, result) => {
      const poi = result && result.poiList && result.poiList.pois && result.poiList.pois[0];
      if (!poi) { toast('没搜到，手动填经纬度吧', 'err'); return; }
      $('#setLng').value = poi.location.lng;
      $('#setLat').value = poi.location.lat;
      toast('找到了：' + poi.name + '，记得点保存', 'ok');
    });
  }

  function locateSchool() {
    if (!amapInst) return;
    const ps = new AMap.PlaceSearch({ pageSize: 1 });
    ps.search(state.settings.school || '学校', (status, result) => {
      const poi = result && result.poiList && result.poiList.pois && result.poiList.pois[0];
      if (!poi) { toast('没搜到，手动设个中心点', 'err'); return; }
      state.settings.center = [poi.location.lng, poi.location.lat];
      save();
      amapInst.setZoomAndCenter(16, state.settings.center);
      toast('已定位到 ' + poi.name, 'ok');
    });
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    try { fn(el, e); } catch (err) { console.error(err); toast('出了点问题：' + err.message, 'err'); }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'modSearch') {
      searchQ = e.target.value;
      const cur = document.activeElement;
      render();
      const inp = $('#modSearch');
      if (inp) { inp.focus(); inp.setSelectionRange(searchQ.length, searchQ.length); }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      const btn = $('.modal [data-act="save-record"], .modal [data-act="save-module"]');
      if (btn) btn.click();
    }
  });

  $('#quickAdd').addEventListener('click', () => {
    const mods = activeModules();
    if (!mods.length) { go('settings'); return; }
    const html = '<div class="modal-head"><div><h3>记一笔</h3><p>想记到哪个模块？</p></div>' +
      '<button class="btn btn-ghost btn-icon" data-act="close-modal">✕</button></div>' +
      '<div class="modal-body"><div style="display:flex;flex-direction:column;gap:8px">' +
      mods.map((m) => '<button class="btn btn-ghost" style="justify-content:flex-start;padding:14px 16px" data-act="quick-pick" data-id="' + m.id + '">' +
        '<span style="font-size:18px">' + m.icon + '</span><span style="font-weight:600">' + esc(m.name) + '</span></button>').join('') +
      '</div></div>';
    openModal(html);
  });

  ACT['quick-pick'] = (el) => { closeModal(); openRecordForm(el.dataset.id, null); };
  ACT['save-card'] = () => pickDataFile();

  const saveCardEl = $('#saveCard');
  if (saveCardEl) saveCardEl.addEventListener('click', () => {
    if (fileHandle) { go('settings'); } else pickDataFile();
  });

  /* 附件选择 */
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'attachInput') {
      const files = e.target.files;
      e.target.value = '';
      addFiles(files);
    }
  });

  /* 地图点击放置标记 */
  document.addEventListener('click', (e) => {
    const stage = e.target.closest('#mapStage');
    if (!stage || !addMode) return;
    if (e.target.closest('[data-act]')) return;
    const inner = $('#mapInner');
    const r = inner.getBoundingClientRect();
    const x = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
    const y = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
    openMarkerForm(null, { x, y });
  });

  /* ---------------- 启动 ---------------- */
  async function boot() {
    state = loadLocal();
    await restoreFile();
    if (pendingHandle) {
      setTimeout(() => {
        toast('上次的数据文件需要重新授权，点左下角继续使用');
      }, 800);
    }
    render();
    if (location.protocol === 'file:') {
      setTimeout(() => toast('直接双击打开时，数据可能存不下来。请用同目录的「启动.cmd」打开', 'err'), 900);
    }
  }

  boot();
})();