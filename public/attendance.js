(() => {
  const token = AuthManager.getToken();
  const user = AuthManager.getCurrentUser();
  if (!token || !user) {
    window.location.href = '/login.html';
    return;
  }

  const apiBase = 'http://localhost:3000';
  const state = {
    students: [],
    attendance: [],
    filtered: []
  };
  const escapeHtml = (text = '') => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const els = {
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    userInfo: document.getElementById('userInfo'),
    studentSelect: document.getElementById('studentSelect'),
    filterCourse: document.getElementById('filterCourse'),
    filterStatus: document.getElementById('filterStatus'),
    filterFrom: document.getElementById('filterFrom'),
    filterTo: document.getElementById('filterTo'),
    statusSelect: document.getElementById('statusSelect'),
    attendanceBody: document.getElementById('attendanceBody'),
    noAttendance: document.getElementById('noAttendance'),
    presentPercent: document.getElementById('attPresentPercent'),
    absenceCount: document.getElementById('attAbsenceCount'),
    loading: document.getElementById('loadingSpinner'),
    messageContainer: document.getElementById('messageContainer'),
    toggleBulkMode: document.getElementById('toggleBulkMode'),
    bulkAttendanceSection: document.getElementById('bulkAttendanceSection'),
    bulkAttendanceList: document.getElementById('bulkAttendanceList'),
    submitBulkAttendance: document.getElementById('submitBulkAttendance'),
    cancelBulkMode: document.getElementById('cancelBulkMode'),
    attendanceForm: document.getElementById('attendanceForm')
  };
  
  let bulkAttendanceData = {}; // { student_id: 'present'|'absent'|'late' }

  function init() {
    if (els.userInfo) {
      els.userName.textContent = user.username;
      els.userRole.textContent = user.role;
      els.userInfo.style.display = 'flex';
    }
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('attDate');
    if (dateInput) dateInput.value = today;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => AuthManager.logout());

    els.attendanceForm.addEventListener('submit', handleSubmit);
    document.getElementById('applyFilters').addEventListener('click', () => applyFilters());
    document.getElementById('resetFilters').addEventListener('click', () => resetFilters());
    
    // Bulk attendance handlers
    if (els.toggleBulkMode) {
      els.toggleBulkMode.addEventListener('click', () => toggleBulkMode(true));
    }
    if (els.cancelBulkMode) {
      els.cancelBulkMode.addEventListener('click', () => toggleBulkMode(false));
    }
    if (els.submitBulkAttendance) {
      els.submitBulkAttendance.addEventListener('click', handleBulkSubmit);
    }

    loadStudents();
    loadAttendance();
  }
  
  function toggleBulkMode(enable) {
    if (enable) {
      els.attendanceForm.style.display = 'none';
      els.bulkAttendanceSection.style.display = 'block';
      els.toggleBulkMode.textContent = 'Switch to Single Mode';
      renderBulkAttendanceList();
    } else {
      els.attendanceForm.style.display = 'block';
      els.bulkAttendanceSection.style.display = 'none';
      els.toggleBulkMode.textContent = 'Switch to Bulk Mode';
      bulkAttendanceData = {};
    }
  }
  
  function renderBulkAttendanceList() {
    if (!els.bulkAttendanceList) return;
    
    const date = document.getElementById('attDate').value;
    if (!date) {
      showMessage('Please select a date first', 'error');
      return;
    }
    
    if (state.students.length === 0) {
      els.bulkAttendanceList.innerHTML = '<p class="text-muted">No students available</p>';
      return;
    }
    
    // Initialize bulk data with default "present" for all students
    state.students.forEach(student => {
      if (!bulkAttendanceData[student.id]) {
        bulkAttendanceData[student.id] = 'present';
      }
    });
    
    els.bulkAttendanceList.innerHTML = state.students.map(student => {
      const currentStatus = bulkAttendanceData[student.id] || 'present';
      return `
        <div class="bulk-attendance-item">
          <div class="bulk-student-info" style="display: flex; align-items: center; gap: 0.75rem;">
            ${student.photo ? 
              `<img src="/${student.photo}" alt="${escapeHtml(student.name)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%; border: 2px solid var(--border-soft);">` : 
              `<div style="width: 50px; height: 50px; border-radius: 50%; background: var(--surface-200); display: flex; align-items: center; justify-content: center; border: 2px solid var(--border-soft);">
                <i class="fas fa-user" style="color: var(--text-muted);"></i>
              </div>`
            }
            <div>
              <strong>${escapeHtml(student.name)}</strong>
              <span class="text-muted" style="display: block; font-size: 0.85rem;">${escapeHtml(student.course || '')}</span>
            </div>
          </div>
          <div class="bulk-status-buttons">
            <button type="button" class="status-btn ${currentStatus === 'present' ? 'active' : ''}" 
                    data-student-id="${student.id}" data-status="present">
              Present
            </button>
            <button type="button" class="status-btn ${currentStatus === 'absent' ? 'active' : ''}" 
                    data-student-id="${student.id}" data-status="absent">
              Absent
            </button>
            <button type="button" class="status-btn ${currentStatus === 'late' ? 'active' : ''}" 
                    data-student-id="${student.id}" data-status="late">
              Late
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers for status buttons
    els.bulkAttendanceList.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const studentId = parseInt(btn.dataset.studentId);
        const status = btn.dataset.status;
        bulkAttendanceData[studentId] = status;
        
        // Update UI
        btn.parentElement.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
  
  async function handleBulkSubmit() {
    const dateInput = document.getElementById('attDate');
    if (!dateInput) {
      showMessage('Date input not found', 'error');
      return;
    }
    
    const date = dateInput.value.trim();
    if (!date) {
      showMessage('Please select a date first', 'error');
      dateInput.focus();
      return;
    }
    
    // Ensure we have students loaded
    if (!state.students || state.students.length === 0) {
      showMessage('No students available. Please wait for students to load.', 'error');
      return;
    }
    
    // Build records from all students, using their current status or defaulting to 'present'
    const records = [];
    state.students.forEach(student => {
      // Use the status from bulkAttendanceData if set, otherwise default to 'present'
      const status = bulkAttendanceData[student.id] || 'present';
      records.push({
        student_id: parseInt(student.id),
        status: status
      });
    });
    
    if (records.length === 0) {
      showMessage('No students to mark attendance for', 'error');
      return;
    }
    
    // Validate all records before sending
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record.student_id || isNaN(record.student_id)) {
        showMessage(`Invalid student ID at position ${i + 1}`, 'error');
        return;
      }
      if (!record.status || !['present', 'absent', 'late'].includes(record.status)) {
        showMessage(`Invalid status at position ${i + 1}`, 'error');
        return;
      }
    }
    
    try {
      showLoading();
      
      const payload = {
        bulk: true,
        date: date,
        records: records
      };
      
      console.log('Submitting bulk attendance:', {
        date: payload.date,
        recordCount: payload.records.length,
        firstRecord: payload.records[0],
        lastRecord: payload.records[payload.records.length - 1]
      });
      
      const res = await apiCall('/attendance', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      console.log('Bulk attendance response:', res);
      
      if (res && res.success) {
        showMessage(`Attendance recorded for ${res.count || records.length} student(s)`, 'success');
        bulkAttendanceData = {};
        toggleBulkMode(false);
        // Reset date to today after successful submission
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        await loadAttendance();
      } else {
        showMessage(res?.message || 'Unable to record attendance', 'error');
      }
    } catch (error) {
      console.error('Bulk attendance error:', error);
      const errorMsg = error.message || 'Error recording attendance. Please check console for details.';
      showMessage(errorMsg, 'error');
    } finally {
      hideLoading();
    }
  }

  async function apiCall(endpoint, options = {}) {
    const response = await fetch(`${apiBase}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      ...options
    });
    
    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error('Invalid response from server');
    }
    
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }
    return data;
  }

  function showLoading() {
    if (els.loading) els.loading.style.display = 'flex';
  }

  function hideLoading() {
    if (els.loading) els.loading.style.display = 'none';
  }

  function showMessage(message, type = 'info') {
    if (!els.messageContainer) return;
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `<i class="fas fa-info-circle"></i><span>${message}</span>`;
    els.messageContainer.appendChild(div);
    setTimeout(() => div.remove(), 4500);
  }

  async function loadStudents() {
    try {
      showLoading();
      const res = await apiCall('/students');
      state.students = res.data || [];
      renderStudentOptions();
      renderCourseFilter();
    } catch (error) {
      showMessage('Unable to load students', 'error');
    } finally {
      hideLoading();
    }
  }

  async function loadAttendance() {
    try {
      showLoading();
      const res = await apiCall('/attendance');
      state.attendance = res.data || [];
      applyFilters();
    } catch (error) {
      showMessage('Unable to load attendance', 'error');
    } finally {
      hideLoading();
    }
  }

  function renderStudentOptions() {
    if (!els.studentSelect) return;
    els.studentSelect.innerHTML = state.students
      .map(student => `<option value="${student.id}">${escapeHtml(student.name)} (${escapeHtml(student.course)})</option>`)
      .join('');
  }

  function renderCourseFilter() {
    if (!els.filterCourse) return;
    const courses = Array.from(new Set(state.students.map(s => s.course).filter(Boolean))).sort();
    els.filterCourse.innerHTML = ['<option value="">All courses</option>', ...courses.map(course => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`)].join('');
  }

  function applyFilters() {
    const from = els.filterFrom.value;
    const to = els.filterTo.value;
    const course = els.filterCourse.value;
    const status = els.filterStatus.value;

    const studentMap = new Map(state.students.map(s => [s.id, s]));

    let dataset = state.attendance.map(record => {
      const student = studentMap.get(record.student_id) || {};
      return {
        ...record,
        student_name: record.student_name || student.name || record.student_id,
        course: student.course || '—'
      };
    });

    if (from) {
      dataset = dataset.filter(record => record.date >= from);
    }
    if (to) {
      dataset = dataset.filter(record => record.date <= to);
    }
    if (course) {
      dataset = dataset.filter(record => record.course === course);
    }
    if (status) {
      dataset = dataset.filter(record => record.status === status);
    }

    state.filtered = dataset;
    renderTable();
    updateStats();
  }

  function resetFilters() {
    els.filterFrom.value = '';
    els.filterTo.value = '';
    els.filterCourse.value = '';
    els.filterStatus.value = '';
    applyFilters();
  }

  function renderTable() {
    if (!els.attendanceBody) return;
    if (!state.filtered.length) {
      els.attendanceBody.innerHTML = '';
      if (els.noAttendance) els.noAttendance.style.display = 'block';
      return;
    }

    if (els.noAttendance) els.noAttendance.style.display = 'none';
    els.attendanceBody.innerHTML = state.filtered.map(record => {
      const student = state.students.find(s => s.id === record.student_id) || {};
      return `
      <tr>
        <td>${record.id}</td>
        <td style="display: flex; align-items: center; gap: 0.5rem;">
          ${student.photo ? 
            `<img src="/${student.photo}" alt="${escapeHtml(record.student_name || '')}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%; border: 2px solid var(--border-soft);">` : 
            `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--surface-200); display: flex; align-items: center; justify-content: center; border: 2px solid var(--border-soft);">
              <i class="fas fa-user" style="color: var(--text-muted); font-size: 0.8rem;"></i>
            </div>`
          }
          <span>${escapeHtml(record.student_name || '')}</span>
        </td>
        <td>${escapeHtml(record.course || '')}</td>
        <td>${record.date}</td>
        <td><span class="status-badge status-${record.status}">${record.status}</span></td>
        <td>${escapeHtml(record.notes || '—')}</td>
      </tr>
    `;
    }).join('');
  }

  function updateStats() {
    const total = state.filtered.length;
    const present = state.filtered.filter(record => record.status === 'present').length;
    const absent = state.filtered.filter(record => record.status === 'absent').length;

    els.presentPercent.textContent = total ? `${Math.round((present / total) * 100)}%` : '--%';
    els.absenceCount.textContent = absent;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const student_id = els.studentSelect.value;
    const date = document.getElementById('attDate').value;
    const status = els.statusSelect.value;
    const notes = document.getElementById('notes').value.trim();

    if (!student_id || !date) {
      showMessage('Please select student and date', 'error');
      return;
    }

    try {
      showLoading();
      const payload = { student_id, date, status, notes: notes || null };
      const res = await apiCall('/attendance', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        showMessage('Attendance recorded', 'success');
        document.getElementById('attendanceForm').reset();
        document.getElementById('attDate').value = date;
        await loadAttendance();
      } else {
        showMessage(res.message || 'Unable to record attendance', 'error');
      }
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      hideLoading();
    }
  }

  init();
})();
