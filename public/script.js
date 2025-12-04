// Student Management System - Frontend JavaScript

class StudentManager {
    constructor() {
        this.students = [];
        this.filteredStudents = [];
        this.editingStudentId = null;
        this.apiBaseUrl = 'http://localhost:3000';
        this.token = null;
        this.currentUser = null;
        this.searchTerm = '';
        this.selectedCourse = '';
        this.insightsLoaded = false;
        this.shouldRefreshInsights = true;
        
        this.checkAuthentication();
        this.initializeEventListeners();
        this.setupEmailValidation();
        this.setupLogout();
    }

    // Check if user is authenticated
    checkAuthentication() {
        this.token = AuthManager.getToken();
        this.currentUser = AuthManager.getCurrentUser();
        
        if (!this.token || !this.currentUser) {
            // Redirect to login page
            window.location.href = '/login.html';
            return;
        }
        
        // Display user info
        this.displayUserInfo();
        
        // Load students after authentication check
        this.loadStudents();
    }

    // Display user information in header
    displayUserInfo() {
        if (this.currentUser) {
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            const userInfoEl = document.getElementById('userInfo');
            if (userNameEl) userNameEl.textContent = this.currentUser.username;
            if (userRoleEl) userRoleEl.textContent = this.currentUser.role;
            if (userInfoEl) userInfoEl.style.display = 'flex';
        }
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Form submission
        const studentForm = document.getElementById('studentForm');
        if (studentForm) {
            studentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        // Cancel edit button
        const cancelEditBtn = document.getElementById('cancelEdit');
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this.cancelEdit());

        // Search + filters
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) searchBtn.addEventListener('click', () => this.handleSearch());

        const clearSearchBtn = document.getElementById('clearSearch');
        if (clearSearchBtn) clearSearchBtn.addEventListener('click', () => this.clearSearch());

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.handleSearch(); } });
            searchInput.addEventListener('input', () => {
                this.searchTerm = searchInput.value.trim().toLowerCase();
                this.applyFilters();
            });
        }

        const courseFilter = document.getElementById('courseFilter');
        if (courseFilter) {
            courseFilter.addEventListener('change', () => {
                this.selectedCourse = courseFilter.value;
                this.applyFilters();
            });
        }

        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadDashboardStats());

        // Modal confirmation
        const confirmYes = document.getElementById('confirmYes');
        const confirmNo = document.getElementById('confirmNo');
        const confirmModal = document.getElementById('confirmModal');
        if (confirmYes) confirmYes.addEventListener('click', () => this.confirmDelete());
        if (confirmNo) confirmNo.addEventListener('click', () => this.hideModal());
        if (confirmModal) confirmModal.addEventListener('click', (e) => { if (e.target.id === 'confirmModal') this.hideModal(); });
        
        // Photo upload handler
        const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
        if (uploadPhotoBtn) {
            uploadPhotoBtn.addEventListener('click', () => {
                if (this.editingStudentId) {
                    this.uploadStudentPhoto(this.editingStudentId);
                } else {
                    this.showMessage('Please edit a student first', 'error');
                }
            });
        }
    }

    setupEmailValidation() {
        const emailInput = document.getElementById('email');
        const errorEl = document.getElementById('emailError');
        if (!emailInput) return;

        const validate = () => {
            const value = emailInput.value.trim();
            if (!value) {
                errorEl.textContent = '';
                emailInput.setCustomValidity('');
                return;
            }

            if (!this.isValidGmail(value)) {
                errorEl.textContent = 'Enter a valid Gmail address (example@gmail.com).';
                emailInput.setCustomValidity('Invalid email');
            } else {
                errorEl.textContent = '';
                emailInput.setCustomValidity('');
            }
        };

        emailInput.addEventListener('input', validate);
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => AuthManager.logout());
        }
    }

    isValidGmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.toLowerCase().endsWith('@gmail.com');
    }

    // Show loading spinner
    showLoading() {
        const loader = document.getElementById('loadingSpinner');
        if (loader) loader.style.display = 'flex';
    }

    // Hide loading spinner
    hideLoading() {
        const loader = document.getElementById('loadingSpinner');
        if (loader) loader.style.display = 'none';
    }

    // Show message
    showMessage(message, type = 'info') {
        let messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'messageContainer';
            messageContainer.className = 'message-container';
            document.body.appendChild(messageContainer);
        }
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const icon = type === 'success' ? 'fas fa-check-circle' : 
                    type === 'error' ? 'fas fa-exclamation-circle' : 
                    'fas fa-info-circle';
        
        messageDiv.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        messageContainer.appendChild(messageDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }

    // Show modal
    showModal(message) {
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmModal = document.getElementById('confirmModal');
        if (confirmMessage) confirmMessage.textContent = message;
        if (confirmModal) confirmModal.style.display = 'flex';
    }

    // Hide modal
    hideModal() {
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) confirmModal.style.display = 'none';
    }

    // API call helper
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Token expired or invalid, redirect to login
                    this.showMessage('Session expired. Please login again.', 'error');
                    setTimeout(() => {
                        AuthManager.logout();
                    }, 2000);
                    return;
                }
                throw new Error(data.message || 'An error occurred');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Load all students
    async loadStudents() {
        try {
            this.showLoading();
            const response = await this.apiCall('/students');
            this.students = response.data;
            this.updateCourseFilterOptions();
            this.applyFilters();
            await this.loadDashboardStats();
            if (this.shouldRefreshInsights || !this.insightsLoaded) {
                await this.loadInsights();
                this.insightsLoaded = true;
                this.shouldRefreshInsights = false;
            }
        } catch (error) {
            this.showMessage(`Error loading students: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Handle form submission (Add/Update)
    async handleFormSubmit() {
        const formData = new FormData(document.getElementById('studentForm'));
        const studentData = {
            name: formData.get('name').trim(),
            age: parseInt(formData.get('age')),
            course: formData.get('course').trim(),
            email: formData.get('email').trim()
        };

        // Validation
        if (!studentData.name || !studentData.age || !studentData.course || !studentData.email) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        if (studentData.age < 1 || studentData.age > 150) {
            this.showMessage('Age must be between 1 and 150', 'error');
            return;
        }

        if (!this.isValidGmail(studentData.email)) {
            this.showMessage('Email must be a valid gmail.com address', 'error');
            return;
        }

        try {
            this.showLoading();
            
            if (this.editingStudentId) {
                // Update existing student
                await this.apiCall(`/students/${this.editingStudentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(studentData)
                });
                this.showMessage('Student updated successfully!', 'success');
                this.cancelEdit();
            } else {
                // Add new student
                const response = await this.apiCall('/students', {
                    method: 'POST',
                    body: JSON.stringify(studentData)
                });
                
                // Enable photo upload for the newly created student
                // Response structure: { success: true, message: '...', data: { id, name, age, course, email } }
                if (response && response.data && response.data.id) {
                    const newStudentId = response.data.id;
                    this.enablePhotoUpload(newStudentId);
                    // Keep form filled so user can upload photo immediately
                    this.showMessage('Student added successfully! You can now upload a photo above.', 'success');
                } else if (response && response.data && response.data.insertId) {
                    // Fallback: try insertId if id is not available
                    const newStudentId = response.data.insertId;
                    this.enablePhotoUpload(newStudentId);
                    this.showMessage('Student added successfully! You can now upload a photo above.', 'success');
                } else {
                    this.showMessage('Student added successfully!', 'success');
                    this.resetForm();
                }
            }
            
            this.shouldRefreshInsights = true;
            this.insightsLoaded = false;
            await this.loadStudents();
        } catch (error) {
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Enable photo upload for a student (after creation or when editing)
    enablePhotoUpload(studentId) {
        this.editingStudentId = studentId;
        const photoInput = document.getElementById('studentPhotoInput');
        const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
        const photoUploadHint = document.getElementById('photoUploadHint');
        
        if (photoInput) {
            photoInput.disabled = false;
            photoInput.style.cursor = 'pointer';
        }
        if (uploadPhotoBtn) {
            uploadPhotoBtn.disabled = false;
            uploadPhotoBtn.style.cursor = 'pointer';
        }
        if (photoUploadHint) {
            photoUploadHint.innerHTML = '<i class="fas fa-info-circle"></i> Photo will appear in student list, attendance records, and ID card';
        }
    }
    
    // Disable photo upload (when form is reset)
    disablePhotoUpload() {
        this.editingStudentId = null;
        const photoInput = document.getElementById('studentPhotoInput');
        const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
        const photoUploadHint = document.getElementById('photoUploadHint');
        const photoPreview = document.getElementById('studentPhotoPreview');
        
        if (photoInput) {
            photoInput.disabled = true;
            photoInput.value = '';
            photoInput.style.cursor = 'not-allowed';
        }
        if (uploadPhotoBtn) {
            uploadPhotoBtn.disabled = true;
            uploadPhotoBtn.style.cursor = 'not-allowed';
        }
        if (photoUploadHint) {
            photoUploadHint.innerHTML = '<i class="fas fa-info-circle"></i> Create the student first, then you can upload a photo';
        }
        if (photoPreview) {
            photoPreview.src = '';
            photoPreview.style.display = 'none';
        }
    }

    // Edit student
    editStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        // Fill form with student data
        document.getElementById('name').value = student.name;
        document.getElementById('age').value = student.age;
        document.getElementById('course').value = student.course;
        document.getElementById('email').value = student.email;

        // Show photo upload section and preview
        const photoPreview = document.getElementById('studentPhotoPreview');
        const photoInput = document.getElementById('studentPhotoInput');
        
        // Enable photo upload
        this.enablePhotoUpload(studentId);
        
        // Show existing photo if available
        if (student.photo) {
            photoPreview.src = `/${student.photo}`;
            photoPreview.style.display = 'block';
        } else {
            photoPreview.style.display = 'none';
        }
        if (photoInput) photoInput.value = '';

        // Update UI for edit mode
        const formTitle = document.getElementById('formTitle');
        if (formTitle) formTitle.textContent = 'Edit student';
        document.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> Update Student';
        document.getElementById('cancelEdit').style.display = 'inline-flex';
        const downloadIdCardBtn = document.getElementById('downloadIdCardBtn');
        if (downloadIdCardBtn) {
            downloadIdCardBtn.style.display = 'inline-flex';
            downloadIdCardBtn.onclick = () => this.downloadIdCard(studentId);
        }
        
        // Scroll to form
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
        
        this.showMessage('Edit mode activated. You can now upload or change the student photo below.', 'info');
    }

    // Cancel edit mode
    cancelEdit() {
        this.disablePhotoUpload();
        this.resetForm();
        const formTitle = document.getElementById('formTitle');
        if (formTitle) formTitle.textContent = 'Add new student';
        document.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-plus"></i> Add Student';
        document.getElementById('cancelEdit').style.display = 'none';
        const downloadIdCardBtn = document.getElementById('downloadIdCardBtn');
        if (downloadIdCardBtn) downloadIdCardBtn.style.display = 'none';
    }

    // Reset form
    resetForm() {
        const form = document.getElementById('studentForm');
        if (form) form.reset();
        const emailError = document.getElementById('emailError');
        const emailInput = document.getElementById('email');
        if (emailError) emailError.textContent = '';
        if (emailInput) emailInput.setCustomValidity('');
        // Photo upload will be disabled by disablePhotoUpload() if needed
    }
    
    // Upload student photo
    async uploadStudentPhoto(studentId) {
        const photoInput = document.getElementById('studentPhotoInput');
        if (!photoInput || !photoInput.files || photoInput.files.length === 0) {
            this.showMessage('Please select a photo first', 'error');
            return;
        }
        
        const file = photoInput.files[0];
        
        // Validate file
        if (file.size > 2 * 1024 * 1024) {
            this.showMessage('Photo size must be less than 2MB', 'error');
            return;
        }
        
        if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
            this.showMessage('Only JPG and PNG images are allowed', 'error');
            return;
        }
        
        try {
            this.showLoading();
            
            const formData = new FormData();
            formData.append('photo', file);
            
            const response = await fetch(`${this.apiBaseUrl}/students/upload-photo/${studentId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Error uploading photo');
            }
            
            if (data.success) {
                this.showMessage('Photo uploaded successfully!', 'success');
                // Update preview
                const photoPreview = document.getElementById('studentPhotoPreview');
                if (photoPreview && data.photo) {
                    photoPreview.src = `/${data.photo}?t=${Date.now()}`;
                    photoPreview.style.display = 'block';
                }
                // Reload students to update photo in list
                await this.loadStudents();
            }
        } catch (error) {
            this.showMessage(`Error uploading photo: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    // Download student ID card
    async downloadIdCard(studentId) {
        try {
            this.showLoading();
            const response = await fetch(`${this.apiBaseUrl}/students/${studentId}/id-card`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error generating ID card');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `id-card-${studentId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showMessage('ID card downloaded successfully!', 'success');
        } catch (error) {
            this.showMessage(`Error downloading ID card: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Delete student
    deleteStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        this.pendingDeleteId = studentId;
        this.showModal(`Are you sure you want to delete "${student.name}"? This action cannot be undone.`);
    }

    // Confirm delete
    async confirmDelete() {
        if (!this.pendingDeleteId) return;

        try {
            this.showLoading();
            await this.apiCall(`/students/${this.pendingDeleteId}`, {
                method: 'DELETE'
            });
            
            this.showMessage('Student deleted successfully!', 'success');
            this.shouldRefreshInsights = true;
            this.insightsLoaded = false;
            await this.loadStudents();
        } catch (error) {
            this.showMessage(`Error deleting student: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
            this.hideModal();
            this.pendingDeleteId = null;
        }
    }

    // Handle search
    handleSearch() {
        const searchInput = document.getElementById('searchInput');
        this.searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        this.applyFilters();
        this.showMessage(`Showing ${this.filteredStudents.length} result(s)`, 'info');
    }

    // Clear search
    clearSearch() {
        document.getElementById('searchInput').value = '';
        const courseFilter = document.getElementById('courseFilter');
        if (courseFilter) {
            courseFilter.value = '';
        }
        this.searchTerm = '';
        this.selectedCourse = '';
        this.applyFilters();
        this.showMessage('Search cleared', 'info');
    }

    updateCourseFilterOptions() {
        const courseFilter = document.getElementById('courseFilter');
        if (!courseFilter) return;

        const uniqueCourses = Array.from(
            new Set(this.students.map(s => s.course).filter(Boolean))
        ).sort();

        courseFilter.innerHTML = ['<option value="">All courses</option>', ...uniqueCourses.map(course => `<option value="${this.escapeHtml(course)}">${this.escapeHtml(course)}</option>`)].join('');

        if (this.selectedCourse && uniqueCourses.includes(this.selectedCourse)) {
            courseFilter.value = this.selectedCourse;
        } else {
            courseFilter.value = '';
            this.selectedCourse = '';
        }
    }

    applyFilters() {
        let dataset = [...this.students];

        if (this.searchTerm) {
            dataset = dataset.filter(student => {
                const needle = this.searchTerm;
                return (
                    student.name.toLowerCase().includes(needle) ||
                    student.email.toLowerCase().includes(needle) ||
                    (student.course || '').toLowerCase().includes(needle)
                );
            });
        }

        if (this.selectedCourse) {
            dataset = dataset.filter(student => student.course === this.selectedCourse);
        }

        this.filteredStudents = dataset;
        this.renderStudents();
        this.updateStudentCount();
    }

    async loadDashboardStats() {
        const totalStudentsEl = document.getElementById('statTotalStudents');
        if (!totalStudentsEl) return;

        try {
            const [feesRes, attendanceRes] = await Promise.allSettled([
                this.apiCall('/fees'),
                this.apiCall('/attendance')
            ]);

            // Students stats
            const totalStudents = this.students.length;
            totalStudentsEl.textContent = totalStudents;
            const newStudents = this.students.filter(student => {
                if (!student.created_at) return false;
                const created = new Date(student.created_at);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return created >= weekAgo;
            }).length;
            const newStudentsEl = document.getElementById('statNewStudents');
            if (newStudentsEl) {
                newStudentsEl.textContent = newStudents ? `+${newStudents} this week` : 'No new enrollments';
            }

            // Fees stats
            if (feesRes.status === 'fulfilled' && feesRes.value?.data) {
                const invoices = feesRes.value.data;
                document.getElementById('statInvoices').textContent = invoices.length;

                let pendingAmount = 0;
                let pendingCount = 0;
                let upcomingDue = null;

                invoices.forEach(invoice => {
                    const paidTotal = parseFloat(invoice.paid_total || 0);
                    const balance = Math.max(parseFloat(invoice.amount) - paidTotal, 0);
                    const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
                    if (invoice.status !== 'paid' && balance > 0) {
                        pendingCount += 1;
                        pendingAmount += balance;
                        if (dueDate && (!upcomingDue || dueDate < upcomingDue)) {
                            upcomingDue = dueDate;
                        }
                    }
                });

                document.getElementById('statPendingFees').textContent = this.formatCurrency(pendingAmount);
                document.getElementById('statPendingDue').textContent = pendingCount ? `${pendingCount} pending invoice(s)` : 'All settled';
                document.getElementById('statInvoicesStatus').textContent = upcomingDue
                    ? `Next due ${upcomingDue.toLocaleDateString()}`
                    : 'No upcoming dues';
            }

            // Attendance stats
            if (attendanceRes.status === 'fulfilled' && attendanceRes.value?.data) {
                const attendance = attendanceRes.value.data;
                const today = new Date().toISOString().split('T')[0];
                const todayRecords = attendance.filter(record => record.date === today);
                const presentToday = todayRecords.filter(record => record.status === 'present').length;

                const attendancePercent = todayRecords.length
                    ? Math.round((presentToday / todayRecords.length) * 100)
                    : null;

                document.getElementById('statAttendance').textContent = attendancePercent !== null ? `${attendancePercent}%` : '--%';
                document.getElementById('statAttendanceLabel').textContent = todayRecords.length
                    ? `${presentToday}/${todayRecords.length} present today`
                    : 'No records yet today';
            }
        } catch (error) {
            this.showMessage('Unable to refresh dashboard stats', 'error');
        }
    }

    formatCurrency(amount) {
        const safeAmount = isNaN(amount) ? 0 : amount;
        try {
            return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(safeAmount);
        } catch {
            return `₹${safeAmount.toFixed(2)}`;
        }
    }

    async loadInsights() {
        try {
            const response = await this.apiCall('/analytics/insights');
            if (response?.data) {
                this.renderAtRisk(response.data.atRiskStudents || []);
                this.renderHeatmap(response.data.heatmap || { subjects: [], terms: [], values: [] });
            }
        } catch (error) {
            console.error('Error loading insights:', error);
        }
    }

    renderAtRisk(students) {
        const listEl = document.getElementById('atRiskList');
        const counterEl = document.getElementById('atRiskCount');
        const emptyState = document.getElementById('noAtRisk');
        if (!listEl || !counterEl) return;

        counterEl.textContent = students.length;
        if (!students.length) {
            listEl.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        listEl.innerHTML = students.slice(0, 6).map((student) => {
            const attendance = student.attendancePercent !== null ? `${student.attendancePercent}%` : 'N/A';
            const marks = student.latestAverage !== null ? `${student.latestAverage}%` : 'N/A';
            return `
                <li class="at-risk-item">
                    <div>
                        <p class="name">${this.escapeHtml(student.name)}</p>
                        <p class="meta">${this.escapeHtml(student.course || '—')}</p>
                    </div>
                    <div class="at-risk-metrics">
                        <span>Attendance <strong>${attendance}</strong></span>
                        <span>Marks <strong>${marks}</strong></span>
                    </div>
                    <span class="risk-badge">At Risk</span>
                </li>
            `;
        }).join('');
    }

    renderHeatmap(heatmap) {
        const heatmapEl = document.getElementById('performanceHeatmap');
        const emptyState = document.getElementById('noHeatmap');
        if (!heatmapEl) return;
        const subjects = heatmap.subjects || [];
        const terms = heatmap.terms || [];
        const values = heatmap.values || [];

        if (!subjects.length || !terms.length) {
            heatmapEl.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        heatmapEl.style.gridTemplateColumns = `repeat(${subjects.length + 1}, minmax(90px, 1fr))`;
        heatmapEl.innerHTML = '';

        const leadingHeader = document.createElement('div');
        leadingHeader.className = 'heatmap-cell header';
        leadingHeader.textContent = 'Term / Subject';
        heatmapEl.appendChild(leadingHeader);

        subjects.forEach(subject => {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell header';
            cell.textContent = subject;
            heatmapEl.appendChild(cell);
        });

        terms.forEach((term, termIndex) => {
            const labelCell = document.createElement('div');
            labelCell.className = 'heatmap-cell label';
            labelCell.textContent = term;
            heatmapEl.appendChild(labelCell);

            const rowValues = values[termIndex] || [];
            subjects.forEach((subject, subjectIndex) => {
                const score = rowValues[subjectIndex];
                const cell = document.createElement('div');
                cell.className = `heatmap-cell ${score === null ? 'empty' : 'value'}`;
                if (score === null || typeof score === 'undefined') {
                    cell.textContent = '—';
                } else {
                    const color = this.getHeatColor(score);
                    cell.style.background = color;
                    cell.textContent = `${score}%`;
                    cell.setAttribute('aria-label', `${term} ${subject} average ${score}%`);
                }
                heatmapEl.appendChild(cell);
            });
        });
    }

    getHeatColor(score) {
        const safeScore = Math.max(0, Math.min(100, score));
        const hue = (safeScore / 100) * 120; // 0=red, 120=green
        return `hsl(${hue}, 70%, 45%)`;
    }

    // Render students table
    renderStudents() {
        const tbody = document.getElementById('studentsTableBody');
        const noStudentsDiv = document.getElementById('noStudents');
        if (!tbody) return; // nothing to render into

        const dataset = this.filteredStudents.length ? this.filteredStudents : [];

        if (dataset.length === 0) {
            tbody.innerHTML = '';
            if (noStudentsDiv) noStudentsDiv.style.display = 'block';
            return;
        }

        if (noStudentsDiv) noStudentsDiv.style.display = 'none';

        tbody.innerHTML = dataset.map(student => `
            <tr>
                <td>
                    ${student.photo ? 
                        `<img src="/${student.photo}" alt="${this.escapeHtml(student.name)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%; border: 2px solid var(--border-soft);">` : 
                        `<div style="width: 50px; height: 50px; border-radius: 50%; background: var(--surface-200); display: flex; align-items: center; justify-content: center; border: 2px solid var(--border-soft);">
                            <i class="fas fa-user" style="color: var(--text-muted);"></i>
                        </div>`
                    }
                </td>
                <td>${student.id}</td>
                <td>${this.escapeHtml(student.name)}</td>
                <td>${student.age}</td>
                <td>${this.escapeHtml(student.course)}</td>
                <td>${this.escapeHtml(student.email)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit" onclick="studentManager.editStudent(${student.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-delete" onclick="studentManager.deleteStudent(${student.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Update student count
    updateStudentCount() {
        const total = this.students.length;
        const visible = this.filteredStudents.length;
        const counter = document.getElementById('studentCount');
        if (counter) {
            counter.textContent = total ? `${visible} / ${total}` : '0';
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.studentManager = new StudentManager();
    
    // Disable photo upload initially (until student is created)
    if (window.studentManager) {
        window.studentManager.disablePhotoUpload();
    }
    
    // Show welcome message
    setTimeout(() => {
        studentManager.showMessage('Welcome to Student Management System!', 'success');
    }, 1000);
});

// Handle page visibility change to refresh data when user returns
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.studentManager) {
        window.studentManager.loadStudents();
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.studentManager) {
        studentManager.showMessage('Connection restored!', 'success');
        studentManager.loadStudents();
    }
});

window.addEventListener('offline', () => {
    if (window.studentManager) {
        studentManager.showMessage('You are offline. Some features may not work.', 'error');
    }
});
const AuthManager = {
  logout: function() {
    // Clear authentication tokens
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_user');
    sessionStorage.removeItem('sms_token');
    sessionStorage.removeItem('sms_user');

    // Redirect to login page
    window.location.href = '/login.html';
  },

  getToken: function() {
    return localStorage.getItem('sms_token') || sessionStorage.getItem('sms_token');
  },

  getCurrentUser: function() {
    const user = localStorage.getItem('sms_user') || sessionStorage.getItem('sms_user');
    return user ? JSON.parse(user) : null;
  }
};

