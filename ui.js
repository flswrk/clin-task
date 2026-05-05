let tasks = [];
let nid = 1;
let cf = 'All';
let sf = 'Active';
let sb = 'score';
let eid = null;
let appReady = false;

function esc(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function syncLocalCache() {
  saveData(tasks, nid);
}

function upsertLocalTask(task) {
  const i = tasks.findIndex(x => x.id === task.id);
  if (i >= 0) {
    tasks[i] = task;
  } else {
    tasks.push(task);
  }
}

function renderStats() {
  const s = calcStats(tasks);
  document.getElementById('stats-row').innerHTML =
    `<div class="stat-pill"><span class="sv">${s.active}</span><span class="sl">Active</span></div>` +
    `<div class="stat-pill hi"><span class="sv">${s.hi}</span><span class="sl">High priority</span></div>` +
    `<div class="stat-pill"><span class="sv">${s.done}</span><span class="sl">Done</span></div>` +
    `<div class="stat-pill"><span class="sv">${s.total}</span><span class="sl">Total</span></div>`;
}

function chipCls(status) {
  if (status === 'In Progress') return 'chip chip-prog';
  if (status === 'On Hold') return 'chip chip-hold';
  if (status === 'Done') return 'chip chip-done';
  return 'chip chip-def';
}

function cardHTML(t, isDone) {
  const sc = t.score;
  const col = scoreColor(sc);
  const tl = tierLabel(sc);
  const np = t.notes && t.notes.length > 80 ? t.notes.slice(0, 80) + '...' : t.notes;
  const toggleLabel = isDone ? 'Mark as active' : 'Mark as done';

  let chips = `<span class="${chipCls(t.status)}">${esc(t.status)}</span>`;
  chips += `<span class="chip chip-def">${esc(t.category)}</span>`;

  if (t.risk >= 4) chips += `<span class="chip chip-rhi">High Risk</span>`;
  else if (t.risk === 3) chips += `<span class="chip chip-rmd">Med Risk</span>`;

  if (isOverdue(t)) chips += `<span class="chip chip-over">Overdue ${esc(t.dueDate)}</span>`;
  else if (t.dueDate) chips += `<span class="chip chip-def">${esc(t.dueDate)}</span>`;

  if (t.assigned) chips += `<span class="chip chip-def">${esc(t.assigned)}</span>`;

  return `
    <article class="task-card${isDone ? ' done' : ''}" role="button" tabindex="0" onclick="openModal(${t.id})" onkeydown="cardKeydown(event, ${t.id})" aria-label="Edit ${esc(t.title)}">
      <button class="card-delete" type="button" aria-label="Delete ${esc(t.title)}" onclick="event.stopPropagation(); delTask(${t.id})">×</button>
      <div class="card-top">
        <button class="task-toggle${isDone ? ' is-done' : ''}" type="button" aria-label="${toggleLabel}" aria-pressed="${isDone ? 'true' : 'false'}" onclick="event.stopPropagation(); toggleTask(${t.id})">
          <span class="task-toggle-mark">${isDone ? '✓' : ''}</span>
        </button>
        <div class="score-col">
          <div class="s-num" style="color:${col}">${sc}</div>
          <div class="s-bar"><div class="s-fill" style="width:${sc}%;background:${col}"></div></div>
          <div class="s-lbl">${tl}</div>
        </div>
        <div class="card-body">
          <h3 class="c-title${isDone ? ' struck' : ''}">${esc(t.title)}</h3>
          <div class="chips">${chips}</div>
          ${np ? `<p class="c-notes">${esc(np)}</p>` : ''}
        </div>
      </div>
    </article>`;
}

function renderSection(title, subtitle, content, actionHtml = '') {
  return `
    <section class="task-section">
      <div class="task-section-head">
        <div>
          <h2 class="task-section-title">${title}</h2>
          <p class="task-section-meta">${subtitle}</p>
        </div>
        ${actionHtml}
      </div>
      <div class="task-stack">${content}</div>
    </section>`;
}

function render() {
  cf = document.getElementById('cat-filter').value;
  sf = document.getElementById('status-filter').value;
  sb = document.getElementById('sort-filter').value;

  if (!appReady) {
    document.getElementById('task-count').textContent = 'Loading...';
    document.getElementById('stats-row').innerHTML = '';
    document.getElementById('list-wrap').innerHTML = renderSection(
      'Active tasks',
      'Loading from storage',
      '<p class="empty-msg">Loading tasks...</p>',
    );
    return;
  }

  const fil = applySort(applyFilters(tasks, cf, sf), sb);
  const active = fil.filter(t => t.status !== 'Done');
  const done = fil.filter(t => t.status === 'Done');

  renderStats();
  document.getElementById('task-count').textContent =
    `${fil.length} task${fil.length !== 1 ? 's' : ''}`;

  let h = '';

  h += renderSection(
    'Active tasks',
    active.length ? 'Focused work for now' : 'Nothing active right now',
    active.length ? active.map(t => cardHTML(t, false)).join('') : '<p class="empty-msg">No active tasks</p>',
  );

  if (sf === 'Done') {
    h += renderSection(
      'Completed tasks',
      done.length ? 'Finished work' : 'Nothing done yet',
      done.length ? done.map(t => cardHTML(t, true)).join('') : '<p class="empty-msg">Nothing done yet</p>',
    );
  }

  document.getElementById('list-wrap').innerHTML = h;
  document.getElementById('sort-filter').value = sb;
}

function setSort(v) {
  sb = v;
  document.getElementById('sort-filter').value = sb;
  render();
}

function cardKeydown(e, id) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openModal(id);
  }
}

async function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  t.status = t.status === 'Done' ? 'Not Started' : 'Done';
  syncLocalCache();
  render();
  void patchTaskRemote(id, { status: t.status });
}

async function markDone(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  t.status = 'Done';
  syncLocalCache();
  render();
  void patchTaskRemote(id, { status: t.status });
}

async function reopen(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  t.status = 'Not Started';
  syncLocalCache();
  render();
  void patchTaskRemote(id, { status: t.status });
}

async function delTask(id) {
  if (!confirm('Delete permanently?')) return;
  tasks = tasks.filter(x => x.id !== id);
  syncLocalCache();
  render();
  toast('Task deleted');
  void deleteTaskRemote(id);
}

function openModal(id) {
  eid = id;
  const t = id ? tasks.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = t ? 'Edit Task' : 'New Task';
  document.getElementById('f-title').value = t ? t.title : '';
  document.getElementById('f-status').value = t ? t.status : 'Not Started';
  document.getElementById('f-cat').value = t ? t.category : 'Clinical';
  document.getElementById('f-due').value = t ? t.dueDate : '';
  document.getElementById('f-assigned').value = t ? t.assigned : '';
  document.getElementById('f-notes').value = t ? t.notes : '';

  ['imp', 'urg', 'eff', 'risk'].forEach(k => {
    const fk = { imp: 'impact', urg: 'urgency', eff: 'effort', risk: 'risk' }[k];
    document.getElementById('f-' + k).value = t ? t[fk] : 3;
  });

  updateScorePreview();
  document.getElementById('modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('f-title').focus(), 60);
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  eid = null;
}

function overlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function updateScorePreview() {
  const imp = +document.getElementById('f-imp').value;
  const urg = +document.getElementById('f-urg').value;
  const eff = +document.getElementById('f-eff').value;
  const risk = +document.getElementById('f-risk').value;

  ['imp', 'urg', 'eff', 'risk'].forEach(k => {
    const v = { imp, urg, eff, risk }[k];
    document.getElementById('sv-' + k).textContent = v;
    document.getElementById('lv-' + k).textContent = v;
  });

  const s = Math.round((imp * 0.4 + urg * 0.35 + (6 - eff) * 0.25) * 20);
  const col = scoreColor(s);
  document.getElementById('sp-val').textContent = s;
  document.getElementById('sp-val').style.color = col;
  document.getElementById('sp-tier').textContent = tierLabel(s) + ' Priority';
  const bar = document.getElementById('sp-bar');
  bar.style.width = s + '%';
  bar.style.background = col;
}

async function saveTask() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) {
    document.getElementById('f-title').focus();
    toast('Title is required');
    return;
  }

  const draft = {
    title,
    status: document.getElementById('f-status').value,
    category: document.getElementById('f-cat').value,
    impact: +document.getElementById('f-imp').value,
    urgency: +document.getElementById('f-urg').value,
    effort: +document.getElementById('f-eff').value,
    risk: +document.getElementById('f-risk').value,
    dueDate: document.getElementById('f-due').value,
    assigned: document.getElementById('f-assigned').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    score: 0,
  };
  draft.score = calcScore(draft);

  if (eid) {
    const updated = { ...draft, id: eid };
    const i = tasks.findIndex(x => x.id === eid);
    if (i >= 0) tasks[i] = updated;
    syncLocalCache();
    closeModal();
    render();
    toast('Task updated');

    const remote = await patchTaskRemote(eid, taskToRow(updated));
    if (remote) {
      upsertLocalTask(remote);
      nid = Math.max(nid, (Number(remote.id) || eid) + 1);
      syncLocalCache();
      render();
    }
    return;
  }

  const remote = await createTaskRemote(draft);
  const created = remote || { ...draft, id: nid };
  if (!remote) nid++;
  else nid = Math.max(nid, (Number(created.id) || nid) + 1);

  tasks.push(created);
  syncLocalCache();
  closeModal();
  render();
  toast('Task created');
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('fw-toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 2200);
}

(async function bootstrap() {
  const data = await loadData();
  tasks = data.tasks;
  nid = data.nid;
  appReady = true;
  render();
})();
