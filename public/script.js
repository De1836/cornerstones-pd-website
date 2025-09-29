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

  // Base URL for API endpoints - use relative URL from the root
  const API_BASE_URL = '';
  
  // Function to handle API errors consistently
  function handleApiError(error, context = '') {
    console.error(`API Error (${context}):`, error);
    const message = error.message || 'An unknown error occurred';
    alert(`Error: ${message}. Please check the console for more details.`);
    throw error;
  }

  async function fetchSubmissions() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions`, { 
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || `HTTP error! status: ${res.status}`);
      }
      
      return await res.json();
    } catch (error) {
      return handleApiError(error, 'fetchSubmissions');
    }
  }

  async function postSubmission(entry) {
    try {
      console.log('Submitting data:', JSON.stringify(entry, null, 2));
      
      const res = await fetch(`${API_BASE_URL}/api/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify(entry)
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.message || `HTTP error! status: ${res.status}`);
      }
      
      console.log('Submission successful:', data);
      return data;
    } catch (error) {
      return handleApiError(error, 'postSubmission');
    }
  }

  async function clearSubmissionsOnServer() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions`, { 
        method: 'DELETE',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.message || `HTTP error! status: ${res.status}`);
      }
      
      console.log('Submissions cleared successfully');
      return data;
    } catch (error) {
      return handleApiError(error, 'clearSubmissionsOnServer');
    }
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
      'timestamp', 'consentParticipate', 'studentStatus', 'responsibility', 'location', 'mainGoal',
      'problems_avg', 'features', 'interestLevel', 'decisionMaker', 'usersCount', 'openEnded'
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
      // Get responses from the responses object, with fallback to empty object
      const resp = (it.responses && typeof it.responses === 'object' ? it.responses : {}) || {};
      
      // For debugging - log the response structure
      console.log('Response data:', JSON.stringify(it, null, 2));
      
      const row = [
        it.created_at || resp.created_at || '',
        it.consentParticipate || resp.consentParticipate || '',
        resp.studentStatus || '',
        resp.responsibility || '',
        resp.location || '',
        resp.mainGoal || '',
        (resp.problems_avg || ''),  // Removed problemsAverage call since we expect this to be pre-calculated
        (Array.isArray(resp.features) ? resp.features.join('; ') : ''),
        resp.interestLevel || '',
        resp.decisionMaker || '',
        resp.usersCount || '',
        resp.openEnded || '',
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

  // Function to refresh the submissions table
  async function refreshTable() {
    try {
      const response = await fetch('/api/submissions');
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      const submissions = await response.json();
      
      // Update the table with new data
      const table = document.getElementById('submissionsTable');
      if (table) {
        const tbody = table.querySelector('tbody');
        if (tbody) {
          tbody.innerHTML = ''; // Clear existing rows
          submissions.forEach(submission => {
            const row = document.createElement('tr');
            const resp = submission.responses || {};
            
            // Create table cells for each field
            const fields = [
              submission.created_at || '',
              submission.consentParticipate ? 'Yes' : 'No',
              resp.studentStatus || '',
              resp.responsibility || '',
              resp.location || '',
              resp.mainGoal || '',
              (resp.problems_avg || ''),
              (Array.isArray(resp.features) ? resp.features.join(', ') : ''),
              resp.interestLevel || '',
              resp.decisionMaker || '',
              resp.usersCount || '',
              resp.openEnded || ''
            ];
            
            // Add cells to the row
            fields.forEach(field => {
              const cell = document.createElement('td');
              cell.textContent = field;
              row.appendChild(cell);
            });
            
            tbody.appendChild(row);
          });
        }
      }
    } catch (error) {
      console.error('Error refreshing table:', error);
    }
  }

  // Track if form is being submitted to prevent multiple submissions
  let isSubmitting = false;

  // Event handlers
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      formMessage.textContent = '';
      formMessage.className = '';
      
      const entry = getFormData(form);
      const errors = validate(entry);

      if (errors.length > 0) {
        formMessage.textContent = errors.map(e => `- ${e}`).join('\n');
        formMessage.className = 'error';
        return;
      }
      
      // If validation passes, submit the form
      try {
        const result = await postSubmission(entry);
        formMessage.textContent = 'Thank you for your submission!';
        formMessage.className = 'success';
        form.reset();
        await refreshTable();
      } catch (err) {
        console.error('Submission error:', err);
        formMessage.textContent = `Error: ${err.message || 'Failed to submit. Please try again.'}`;
        formMessage.className = 'error';
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      formMessage.textContent = 'An unexpected error occurred. Please try again.';
      formMessage.className = 'error';
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
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
