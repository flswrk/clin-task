const STORE_KEY = 'fw_t5';

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

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.t)) return { tasks: d.t, nid: d.n || d.t.length + 1 };
  } catch (e) {}

  const tasks = SEED.map((t, i) => {
    const o = { ...t, id: i + 1, score: 0 };
    o.score = calcScore(o);
    return o;
  });
  return { tasks, nid: tasks.length + 1 };
}

function saveData(tasks, nid) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ t: tasks, n: nid }));
  } catch (e) {}
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
