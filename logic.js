const STORE_KEY = 'fw_t5';
const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
const SUPABASE_URL = String(SUPABASE_CONFIG.url || SUPABASE_CONFIG.supabaseUrl || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.anon_key || '';
const SUPABASE_TABLE = SUPABASE_CONFIG.table || 'tasks';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function calcScore(t) {
  return Math.round((t.impact * 0.4 + t.urgency * 0.35 + (6 - t.effort) * 0.25) * 20);
}

function tierLabel(s) {
  return s >= 80 ? 'High' : s >= 60 ? 'Moderate' : 'Low';
}

function scoreColor(s) {
  return s >= 80 ? '#1d6c3b' : s >= 60 ? '#8a5b00' : '#6b7280';
}

function riskLabel(r) {
  return r >= 4 ? 'High Risk' : r === 3 ? 'Med Risk' : null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(t) {
  return t.dueDate && t.dueDate < todayStr() && t.status !== 'Done';
}

const SEED = [
  { title: 'Set up infection control protocol review', status: 'In Progress', category: 'Compliance', impact: 5, urgency: 5, effort: 3, risk: 4, dueDate: '2025-02-10', assigned: 'Dr. Chen', notes: 'Quarterly review required by board' },
  { title: 'Upgrade dental chair in bay 2', status: 'Not Started', category: 'Clinical', impact: 4, urgency: 3, effort: 5, risk: 2, dueDate: '2025-03-15', assigned: '', notes: 'Get 3 quotes before ordering' },
  { title: 'Submit monthly insurance claims', status: 'In Progress', category: 'Finance', impact: 5, urgency: 5, effort: 2, risk: 3, dueDate: '2025-01-31', assigned: 'Lisa', notes: '' },
  { title: 'Update patient recall SMS templates', status: 'Not Started', category: 'Growth', impact: 3, urgency: 2, effort: 2, risk: 1, dueDate: '', assigned: '', notes: 'Use new brand tone guidelines' },
  { title: 'Fix appointment booking widget', status: 'On Hold', category: 'Systems', impact: 4, urgency: 4, effort: 3, risk: 2, dueDate: '2025-02-05', assigned: 'Dev team', notes: 'Waiting on hosting access' },
  { title: 'Staff training: new sterilisation unit', status: 'Not Started', category: 'Clinical', impact: 4, urgency: 3, effort: 2, risk: 4, dueDate: '2025-02-20', assigned: 'All staff', notes: '' },
  { title: 'Negotiate supply contract renewal', status: 'Done', category: 'Finance', impact: 3, urgency: 4, effort: 3, risk: 2, dueDate: '2025-01-15', assigned: 'Manager', notes: 'Signed 12-month extension' },
  { title: 'Set up Google Business Profile', status: 'Done', category: 'Growth', impact: 3, urgency: 2, effort: 1, risk: 1, dueDate: '', assigned: '', notes: 'Verified and live' },
  { title: 'Archive 2023 patient records', status: 'Done', category: 'Operations', impact: 2, urgency: 1, effort: 3, risk: 2, dueDate: '', assigned: '', notes: '' },
  { title: 'Review and renew professional indemnity insurance', status: 'Done', category: 'Compliance', impact: 5, urgency: 5, effort: 2, risk: 5, dueDate: '2025-01-10', assigned: 'Owner', notes: 'Renewed for 2 years at better rate' },
  { title: 'Implement online deposit payment system', status: 'Not Started', category: 'Finance', impact: 4, urgency: 3, effort: 4, risk: 2, dueDate: '2025-04-01', assigned: '', notes: 'Reduces no-shows' },
  { title: 'Conduct patient satisfaction survey', status: 'Done', category: 'Growth', impact: 3, urgency: 2, effort: 2, risk: 1, dueDate: '', assigned: '', notes: 'NPS score: 72' },
];

function seedTasks() {
  return SEED.map((t, i) => {
    const o = { ...t, id: i + 1, score: 0 };
    o.score = calcScore(o);
    return o;
  });
}

function loadLocalData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.t)) {
      return { tasks: d.t, nid: d.n || d.t.length + 1, source: 'local' };
    }
  } catch (e) {}

  const tasks = seedTasks();
  return { tasks, nid: tasks.length + 1, source: 'seed' };
}

function saveData(tasks, nid) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ t: tasks, n: nid }));
  } catch (e) {}
}

function taskFromRow(row) {
  const task = {
    id: row.id,
    title: row.title || '',
    status: row.status || 'Not Started',
    category: row.category || 'Clinical',
    impact: Number(row.impact) || 3,
    urgency: Number(row.urgency) || 3,
    effort: Number(row.effort) || 3,
    risk: Number(row.risk) || 3,
    dueDate: row.due_date || row.dueDate || '',
    assigned: row.assigned || '',
    notes: row.notes || '',
    score: Number(row.score) || 0,
  };
  task.score = task.score || calcScore(task);
  return task;
}

function taskToRow(task) {
  return {
    title: task.title,
    status: task.status,
    category: task.category,
    impact: task.impact,
    urgency: task.urgency,
    effort: task.effort,
    risk: task.risk,
    due_date: task.dueDate || null,
    assigned: task.assigned || '',
    notes: task.notes || '',
    score: calcScore(task),
  };
}

async function supabaseRequest(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (prefer) {
    headers.Prefer = prefer;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = data && typeof data === 'object' && data.message ? data.message : String(data || `Supabase request failed (${res.status})`);
    throw new Error(msg);
  }

  return data;
}

async function loadDataFromSupabase() {
  if (!SUPABASE_ENABLED) return null;

  try {
    let rows = await supabaseRequest(`${SUPABASE_TABLE}?select=*&order=id.asc`);

    if (!Array.isArray(rows)) {
      rows = [];
    }

    if (!rows.length) {
      const seedRows = seedTasks().map(taskToRow);
      await supabaseRequest(`${SUPABASE_TABLE}?select=*`, {
        method: 'POST',
        body: seedRows,
        prefer: 'return=representation',
      });
      rows = await supabaseRequest(`${SUPABASE_TABLE}?select=*&order=id.asc`);
      if (!Array.isArray(rows)) rows = [];
    }

    const tasks = rows.map(taskFromRow);
    const nid = tasks.length ? Math.max(...tasks.map(t => Number(t.id) || 0)) + 1 : 1;
    return { tasks, nid, source: 'supabase' };
  } catch (error) {
    console.warn('Supabase load failed, falling back to local storage.', error);
    return null;
  }
}

async function loadData() {
  const remote = await loadDataFromSupabase();
  if (remote) return remote;
  return loadLocalData();
}

async function createTaskRemote(task) {
  if (!SUPABASE_ENABLED) return null;
  try {
    const rows = await supabaseRequest(`${SUPABASE_TABLE}?select=*`, {
      method: 'POST',
      body: taskToRow(task),
      prefer: 'return=representation',
    });
    return Array.isArray(rows) && rows[0] ? taskFromRow(rows[0]) : null;
  } catch (error) {
    console.warn('Supabase create failed.', error);
    return null;
  }
}

async function patchTaskRemote(id, fields) {
  if (!SUPABASE_ENABLED) return null;
  try {
    const rows = await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${id}&select=*`, {
      method: 'PATCH',
      body: fields,
      prefer: 'return=representation',
    });
    return Array.isArray(rows) && rows[0] ? taskFromRow(rows[0]) : null;
  } catch (error) {
    console.warn('Supabase update failed.', error);
    return null;
  }
}

async function deleteTaskRemote(id) {
  if (!SUPABASE_ENABLED) return false;
  try {
    await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.warn('Supabase delete failed.', error);
    return false;
  }
}

function applyFilters(tasks, cf, sf) {
  return tasks.filter(t => {
    const cOk = cf === 'All' || t.category === cf;
    const sOk = sf === 'Active' ? t.status !== 'Done'
      : sf === 'All' ? true
      : t.status === sf;
    return cOk && sOk;
  });
}

function applySort(arr, sb) {
  const a = [...arr];
  if (sb === 'score') {
    a.sort((x, y) => y.score - x.score);
  } else if (sb === 'name') {
    a.sort((x, y) => x.title.localeCompare(y.title));
  } else {
    a.sort((x, y) => {
      if (!x.dueDate && !y.dueDate) return 0;
      if (!x.dueDate) return 1;
      if (!y.dueDate) return -1;
      return x.dueDate.localeCompare(y.dueDate);
    });
  }
  return a;
}

function calcStats(tasks) {
  return {
    active: tasks.filter(t => t.status !== 'Done').length,
    hi: tasks.filter(t => t.status !== 'Done' && t.score >= 80).length,
    done: tasks.filter(t => t.status === 'Done').length,
    total: tasks.length,
  };
}
