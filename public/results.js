(function () {
  const token = AuthManager.getToken();
  const user = AuthManager.getCurrentUser();
  if (!token || !user) {
    window.location.href = '/login.html';
    return;
  }

  const apiBase = 'http://localhost:3000';
  const state = {
    students: [],
    results: [],
    filtered: []
  };
  const escapeHtml = (text = '') => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const els = {
    userInfo: document.getElementById('userInfo'),
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    studentSelect: document.getElementById('studentSelectRes'),
    subjectPreset: document.getElementById('subjectPreset'),
    subjectInput: document.getElementById('subjectInput'),
    termSelect: document.getElementById('termSelect'),
    termInput: document.getElementById('termInput'),
    resultForm: document.getElementById('resultForm'),
    resultsBody: document.getElementById('resultsBody'),
    noResults: document.getElementById('noResults'),
    loading: document.getElementById('loadingSpinner'),
    messages: document.getElementById('messageContainer'),
    resultStudentFilter: document.getElementById('resultStudentFilter'),
    resultSubjectFilter: document.getElementById('resultSubjectFilter'),
    resultTermFilter: document.getElementById('resultTermFilter'),
    avgMarks: document.getElementById('avgMarks'),
    avgMarksSubject: document.getElementById('avgMarksSubject'),
    countAbove: document.getElementById('countAbove'),
    countBelow: document.getElementById('countBelow')
  };

  function init() {
    if (els.userInfo) {
      els.userName.textContent = user.username;
      els.userRole.textContent = user.role;
      els.userInfo.style.display = 'flex';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => AuthManager.logout());

    if (els.subjectPreset && els.subjectInput) {
      els.subjectPreset.addEventListener('change', () => {
        els.subjectInput.value = els.subjectPreset.value;
      });
      els.subjectInput.value = els.subjectPreset.value;
    }

    if (els.termSelect && els.termInput) {
      els.termSelect.addEventListener('change', () => {
        els.termInput.value = els.termSelect.value;
      });
      els.termInput.value = els.termSelect.value;
    }

    els.resultForm.addEventListener('submit', handleSubmit);
    els.resultStudentFilter.addEventListener('change', () => applyFilters());
    els.resultSubjectFilter.addEventListener('change', () => applyFilters());
    els.resultTermFilter.addEventListener('change', () => applyFilters());

    loadStudents();
    loadResults();
  }

  async function apiCall(endpoint, options = {}) {
    const response = await fetch(`${apiBase}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      ...options
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  function showLoading() {
    if (els.loading) els.loading.style.display = 'flex';
  }

  function hideLoading() {
    if (els.loading) els.loading.style.display = 'none';
  }

  function showMessage(message, type = 'info') {
    if (!els.messages) return;
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `<i class="fas fa-info-circle"></i><span>${message}</span>`;
    els.messages.appendChild(div);
    setTimeout(() => div.remove(), 4500);
  }

  async function loadStudents() {
    try {
      showLoading();
      const res = await apiCall('/students');
      state.students = res.data || [];
      renderStudentOptions();
    } catch (error) {
      showMessage('Unable to load students', 'error');
    } finally {
      hideLoading();
    }
  }

  async function loadResults() {
    try {
      showLoading();
      const res = await apiCall('/results');
      state.results = res.data || [];
      applyFilters();
      populateSubjectFilter();
    } catch (error) {
      showMessage('Unable to load results', 'error');
    } finally {
      hideLoading();
    }
  }

  function renderStudentOptions() {
    if (!els.studentSelect) return;
    els.studentSelect.innerHTML = state.students
      .map(student => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)
      .join('');

    if (els.resultStudentFilter) {
      els.resultStudentFilter.innerHTML = ['<option value="">All students</option>', ...state.students.map(student => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)].join('');
    }
  }

  function populateSubjectFilter() {
    if (!els.resultSubjectFilter) return;
    const subjects = Array.from(new Set(state.results.map(result => result.subject).filter(Boolean))).sort();
    els.resultSubjectFilter.innerHTML = ['<option value="">All subjects</option>', ...subjects.map(subject => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)].join('');
  }

  function applyFilters() {
    const studentFilter = els.resultStudentFilter.value;
    const subjectFilter = els.resultSubjectFilter.value;
    const termFilter = els.resultTermFilter.value;

    let dataset = [...state.results];

    if (studentFilter) dataset = dataset.filter(result => String(result.student_id) === studentFilter);
    if (subjectFilter) dataset = dataset.filter(result => result.subject === subjectFilter);
    if (termFilter) dataset = dataset.filter(result => result.term === termFilter);

    state.filtered = dataset;
    renderTable();
    updateAnalytics(subjectFilter);
  }

  function renderTable() {
    if (!els.resultsBody) return;
    if (!state.filtered.length) {
      els.resultsBody.innerHTML = '';
      if (els.noResults) els.noResults.style.display = 'block';
      return;
    }
    if (els.noResults) els.noResults.style.display = 'none';
    els.resultsBody.innerHTML = state.filtered.map(result => `
      <tr>
        <td>${escapeHtml(result.student_name || result.student_id)}</td>
        <td>${escapeHtml(result.subject)}</td>
        <td>${escapeHtml(result.term)}</td>
        <td>${result.marks}</td>
        <td><span class="grade-badge grade-${(result.grade || '').toLowerCase()}">${result.grade || '—'}</span></td>
        <td>${escapeHtml(result.remarks || '—')}</td>
      </tr>
    `).join('');
  }

  function updateAnalytics(subjectFilter) {
    const dataset = state.filtered;
    if (!dataset.length) {
      els.avgMarks.textContent = '--';
      els.avgMarksSubject.textContent = subjectFilter ? `No data for ${subjectFilter}` : 'No data for current filters';
      els.countAbove.textContent = 0;
      els.countBelow.textContent = 0;
      return;
    }
    const total = dataset.reduce((sum, item) => sum + Number(item.marks || 0), 0);
    const avg = Math.round((total / dataset.length) * 10) / 10;
    els.avgMarks.textContent = avg;
    els.avgMarksSubject.textContent = subjectFilter ? `Avg for ${subjectFilter}` : 'Filtered average';
    els.countAbove.textContent = dataset.filter(item => item.marks >= 75).length;
    els.countBelow.textContent = dataset.filter(item => item.marks < 40).length;
  }

  function computeGrade(marks) {
    if (marks >= 85) return 'A';
    if (marks >= 70) return 'B';
    if (marks >= 55) return 'C';
    if (marks >= 40) return 'D';
    return 'F';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const student_id = els.studentSelect.value;
    const subject = els.subjectInput.value.trim() || els.subjectPreset.value;
    const term = els.termInput.value.trim() || els.termSelect.value || 'Term 1';
    const marks = Number(document.getElementById('marks').value);
    const remarks = document.getElementById('remarks').value.trim();

    if (!student_id || !subject || Number.isNaN(marks)) {
      showMessage('All fields are required', 'error');
      return;
    }
    if (marks < 0 || marks > 100) {
      showMessage('Marks must be between 0 and 100', 'error');
      return;
    }

    const payload = {
      student_id,
      subject,
      marks,
      term,
      grade: computeGrade(marks),
      remarks: remarks || null
    };

    try {
      showLoading();
      const res = await apiCall('/results', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        showMessage('Result saved successfully', 'success');
        els.resultForm.reset();
        await loadResults();
      } else {
        showMessage(res.message || 'Unable to save result', 'error');
      }
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      hideLoading();
    }
  }

  init();
})();
