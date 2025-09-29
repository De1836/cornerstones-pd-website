(function () {
  // Client preference only (kept in localStorage)
  const PREF_AUTO_JSON_KEY = 'survey_pref_auto_json_v1';

  const form = document.getElementById('surveyForm');
  const formMessage = document.getElementById('formMessage');
  const table = document.getElementById('resultsTable').querySelector('tbody');
  const emptyState = document.getElementById('emptyState');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearBtn = document.getElementById('clearBtn');
  const autoJsonToggle = document.getElementById('autoJsonToggle');

  async function fetchSubmissions() {
    const res = await fetch('/api/submissions', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Failed to fetch submissions');
    return res.json();
  }

  async function postSubmission(entry) {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to save submission');
  }

  async function clearSubmissionsOnServer() {
    const res = await fetch('/api/submissions', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear submissions');
  }

  function getFormData(formEl) {
    const fd = new FormData(formEl);

    // Features with None-of-the-above normalization
    let features = [];
    formEl.querySelectorAll('input[name="features"]:checked').forEach(cb => features.push(cb.value));
    if (features.includes('None of the above')) {
      features = ['None of the above'];
    }

    // Location/mainGoal/decisionMaker other text handling
    const location = fd.get('location') || '';
    const mainGoal = fd.get('mainGoal') || '';
    const decisionMaker = fd.get('decisionMaker') || '';
    const locationOther = (fd.get('locationOther') || '').toString().trim();
    const mainGoalOther = (fd.get('mainGoalOther') || '').toString().trim();
    const decisionMakerOther = (fd.get('decisionMakerOther') || '').toString().trim();

    const entry = {
      timestamp: new Date().toISOString(),
      consentParticipate: fd.get('consentParticipate') || '',
      studentStatus: fd.get('studentStatus') || '',
      responsibility: fd.get('responsibility') || '',
      location: location === 'Other' ? `Other: ${locationOther}` : location,
      mainGoal: mainGoal === 'Other' ? `Other: ${mainGoalOther}` : mainGoal,
      problems: {
        odors: numberOrNull(fd.get('prob_odors')),
        overflow: numberOrNull(fd.get('prob_overflow')),
        leaks: numberOrNull(fd.get('prob_leaks')),
        pests: numberOrNull(fd.get('prob_pests')),
        touching_lid: numberOrNull(fd.get('prob_touching_lid')),
      },
      features,
      interestLevel: fd.get('interestLevel') || '',
      decisionMaker: decisionMaker === 'Other' ? `Other: ${decisionMakerOther}` : decisionMaker,
      usersCount: fd.get('usersCount') || '',
      openEnded: (fd.get('openEnded') || '').toString().trim(),
    };

    return entry;
  }

  function numberOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function validate(entry) {
    const errors = [];
    if (entry.consentParticipate !== 'Yes') errors.push('Consent to participate is required (select Yes).');
    if (!entry.studentStatus) errors.push('Student status is required.');
    if (!entry.responsibility) errors.push('Responsibility frequency is required.');
    if (!entry.location) errors.push('Primary location is required.');
    if (!entry.mainGoal) errors.push('Main goal is required.');
    const probs = entry.problems || {};
    const probFields = ['odors','overflow','leaks','pests','touching_lid'];
    for (const k of probFields) {
      if (probs[k] === null) { errors.push('Please rate all problem areas (1–5).'); break; }
    }
    if (!entry.interestLevel) errors.push('Interest level is required.');
    if (!entry.decisionMaker) errors.push('Decision maker is required.');
    if (!entry.usersCount) errors.push('Users count is required.');

    // If Other chosen, ensure text present
    if ((entry.location || '').startsWith('Other') && !/Other:\s+\S/.test(entry.location)) {
      errors.push('Please specify the Other location.');
    }
    if ((entry.mainGoal || '').startsWith('Other') && !/Other:\s+\S/.test(entry.mainGoal)) {
      errors.push('Please specify the Other main goal.');
    }
    if ((entry.decisionMaker || '').startsWith('Other') && !/Other:\s+\S/.test(entry.decisionMaker)) {
      errors.push('Please specify the Other decision maker.');
    }
    return errors;
  }

  function renderTable(submissions) {
    table.innerHTML = '';
    if (!submissions.length) {
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';

    for (const s of submissions) {
      const tr = document.createElement('tr');
      const avg = problemsAverage(s.problems);
      tr.innerHTML = `
        <td>${escapeHtml(formatDate(s.timestamp))}</td>
        <td>${escapeHtml(s.consentParticipate || '')}</td>
        <td>${escapeHtml(s.studentStatus || '')}</td>
        <td>${escapeHtml(s.responsibility || '')}</td>
        <td>${escapeHtml(s.location || '')}</td>
        <td>${escapeHtml(s.mainGoal || '')}</td>
        <td>${avg !== null ? escapeHtml(avg.toFixed(2)) : ''}</td>
        <td>${escapeHtml((s.features || []).join(', '))}</td>
        <td>${escapeHtml(s.interestLevel || '')}</td>
        <td>${escapeHtml(s.decisionMaker || '')}</td>
        <td>${escapeHtml(s.usersCount || '')}</td>
        <td>${escapeHtml(s.openEnded || '')}</td>
      `;
      table.appendChild(tr);
    }
  }

  function problemsAverage(probs) {
    if (!probs) return null;
    const vals = ['odors','overflow','leaks','pests','touching_lid']
      .map(k => probs[k])
      .filter(v => typeof v === 'number');
    if (vals.length !== 5) return null;
    const sum = vals.reduce((a,b) => a + b, 0);
    return sum / vals.length;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toCSV(items) {
    if (!items.length) return '';
    const headers = [
      'timestamp','consentParticipate','studentStatus','responsibility','location','mainGoal',
      'problems_avg','features','interestLevel','decisionMaker','usersCount','openEnded'
    ];
    const escapeCell = (v) => {
      if (v === null || v === undefined) v = '';
      v = String(v);
      if (/[",\n]/.test(v)) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    };
    const rows = [headers.join(',')];
    for (const it of items) {
      const row = [
        it.timestamp,
        it.consentParticipate,
        it.studentStatus,
        it.responsibility,
        it.location,
        it.mainGoal,
        (problemsAverage(it.problems) ?? ''),
        (it.features || []).join('; '),
        it.interestLevel,
        it.decisionMaker,
        it.usersCount,
        it.openEnded,
      ].map(escapeCell).join(',');
      rows.push(row);
    }
    return rows.join('\n');
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Event handlers
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMessage.textContent = '';
    formMessage.className = 'message';

    const entry = getFormData(form);
    const errors = validate(entry);

    if (errors.length) {
      formMessage.textContent = errors.join(' ');
      formMessage.classList.add('error');
      return;
    }

    try {
      await postSubmission(entry);
      form.reset();
      formMessage.textContent = 'Thanks! Your response has been recorded on the server.';
      formMessage.classList.add('success');

      const submissions = await fetchSubmissions();
      renderTable(submissions);

      // Auto-download JSON if enabled
      try {
        const auto = localStorage.getItem(PREF_AUTO_JSON_KEY) === 'true';
        if (auto) {
          const json = JSON.stringify(submissions, null, 2);
          download('survey_submissions.json', json, 'application/json');
        }
      } catch {}
    } catch (err) {
      formMessage.textContent = 'Failed to save submission. Please try again.';
      formMessage.classList.add('error');
      console.error(err);
    }
  });

  // Handle None-of-the-above exclusivity
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.name === 'features') {
      const noneCb = document.getElementById('featuresNone');
      if (!noneCb) return;
      const all = Array.from(document.querySelectorAll('input[name="features"]'));
      if (t === noneCb && noneCb.checked) {
        all.forEach(cb => { if (cb !== noneCb) cb.checked = false; });
      } else if (t !== noneCb && t.checked) {
        noneCb.checked = false;
      }
    }
  });

  exportJsonBtn.addEventListener('click', async () => {
    try {
      const data = await fetchSubmissions();
      const json = JSON.stringify(data, null, 2);
      download('survey_submissions.json', json, 'application/json');
    } catch (err) {
      alert('Failed to export JSON.');
    }
  });

  exportCsvBtn.addEventListener('click', async () => {
    try {
      const data = await fetchSubmissions();
      const csv = toCSV(data);
      download('survey_submissions.csv', csv, 'text/csv');
    } catch (err) {
      alert('Failed to export CSV.');
    }
  });

  // Persist and initialize auto JSON toggle
  if (autoJsonToggle) {
    // initialize
    try {
      const saved = localStorage.getItem(PREF_AUTO_JSON_KEY);
      if (saved === 'true') autoJsonToggle.checked = true;
      if (saved === 'false') autoJsonToggle.checked = false;
    } catch {}
    // persist on change
    autoJsonToggle.addEventListener('change', () => {
      localStorage.setItem(PREF_AUTO_JSON_KEY, String(!!autoJsonToggle.checked));
    });
  }

  clearBtn.addEventListener('click', async () => {
    // We don't know the count without fetching; ask generally
    if (confirm('This will delete all server-stored submissions. Continue?')) {
      try {
        await clearSubmissionsOnServer();
        renderTable([]);
      } catch (err) {
        alert('Failed to clear submissions.');
      }
    }
  });

  // Init
  (async () => {
    try {
      const subs = await fetchSubmissions();
      renderTable(subs);
    } catch (err) {
      console.warn('Could not load submissions from server yet.');
    }
  })();
})();
