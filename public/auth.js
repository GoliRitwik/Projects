// Authentication System - Frontend JavaScript

class AuthManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000';
        this.currentUser = null;
        this.token = null;
        
        this.initializeEventListeners();
        this.setupEmailValidation();
        this.checkExistingAuth();
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Tab switching
        document.getElementById('loginTab').addEventListener('click', () => {
            this.switchTab('login');
        });

        document.getElementById('registerTab').addEventListener('click', () => {
            this.switchTab('register');
        });

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Password confirmation validation - inline error only
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const passwordInput = document.getElementById('registerPassword');
        const confirmPasswordError = document.getElementById('confirmPasswordError');
        
        if (confirmPasswordInput && passwordInput && confirmPasswordError) {
            const validatePasswords = () => {
                const password = passwordInput.value;
                const confirmPassword = confirmPasswordInput.value;
                
                // Only show error if both fields have values and they don't match
                if (password && confirmPassword && password !== confirmPassword) {
                    confirmPasswordError.textContent = 'Passwords do not match';
                    confirmPasswordError.style.display = 'block';
                    confirmPasswordInput.setCustomValidity('Passwords do not match');
                } else {
                    confirmPasswordError.textContent = '';
                    confirmPasswordError.style.display = 'none';
                    confirmPasswordInput.setCustomValidity('');
                }
            };
            
            confirmPasswordInput.addEventListener('input', validatePasswords);
            passwordInput.addEventListener('input', validatePasswords);
        }
    }

    setupEmailValidation() {
        const emailInput = document.getElementById('registerEmail');
        const errorEl = document.getElementById('registerEmailError');
        if (!emailInput || !errorEl) return;

        const validate = () => {
            const value = emailInput.value.trim();
            if (!value) {
                errorEl.textContent = '';
                emailInput.setCustomValidity('');
                return;
            }

            if (!this.isValidGmail(value)) {
                errorEl.textContent = 'Please enter a valid gmail.com address';
                emailInput.setCustomValidity('Invalid email');
            } else {
                errorEl.textContent = '';
                emailInput.setCustomValidity('');
            }
        };

        emailInput.addEventListener('input', validate);
    }

    isValidGmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.toLowerCase().endsWith('@gmail.com');
    }

    // Validate strong password requirements
    validateStrongPassword(password) {
        if (password.length < 6) {
            return { valid: false, message: 'Password must be at least 6 characters long' };
        }
        
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        
        const missing = [];
        if (!hasUpperCase) missing.push('1 uppercase letter');
        if (!hasLowerCase) missing.push('1 lowercase letter');
        if (!hasNumber) missing.push('1 number');
        if (!hasSpecialChar) missing.push('1 special character');
        
        if (missing.length > 0) {
            return { 
                valid: false, 
                message: `Password must contain: ${missing.join(', ')}` 
            };
        }
        
        return { valid: true };
    }

    // Switch between login and register tabs
    switchTab(tab) {
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    }

    // Show loading spinner
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    // Hide loading spinner
    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    // Show message
    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('messageContainer');
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

    // API call helper
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'An error occurred');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Handle login
    async handleLogin() {
        const formData = new FormData(document.getElementById('loginForm'));
        const loginData = {
            username: formData.get('username').trim(),
            password: formData.get('password')
        };

        // Validation
        if (!loginData.username || !loginData.password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        try {
            this.showLoading();
            
            const response = await this.apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            });

            // Store token and user data
            this.token = response.token;
            this.currentUser = response.user;
            
            // Save to localStorage if remember me is checked
            const rememberMe = document.getElementById('rememberMe').checked;
            if (rememberMe) {
                localStorage.setItem('sms_token', this.token);
                localStorage.setItem('sms_user', JSON.stringify(this.currentUser));
            } else {
                sessionStorage.setItem('sms_token', this.token);
                sessionStorage.setItem('sms_user', JSON.stringify(this.currentUser));
            }

            this.showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect to main application after a short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);

        } catch (error) {
            this.showMessage(`Login failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Handle registration
    async handleRegister() {
        const formData = new FormData(document.getElementById('registerForm'));
        const registerData = {
            username: formData.get('username').trim(),
            email: formData.get('email').trim(),
            password: formData.get('password')
        };

        // Validation
        if (!registerData.username || !registerData.email || !registerData.password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        if (!this.isValidGmail(registerData.email)) {
            this.showMessage('Email must be a valid gmail.com address', 'error');
            return;
        }

        // Strong password validation
        const passwordValidation = this.validateStrongPassword(registerData.password);
        if (!passwordValidation.valid) {
            this.showMessage(passwordValidation.message, 'error');
            return;
        }

        if (!this.validatePasswordConfirmation()) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        try {
            this.showLoading();
            
            const response = await this.apiCall('/auth/register', {
                method: 'POST',
                body: JSON.stringify(registerData)
            });

            // Store token and user data
            this.token = response.token;
            this.currentUser = response.user;
            
            // Save to session storage
            sessionStorage.setItem('sms_token', this.token);
            sessionStorage.setItem('sms_user', JSON.stringify(this.currentUser));

            this.showMessage('Registration successful! Redirecting...', 'success');
            
            // Redirect to main application after a short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);

        } catch (error) {
            this.showMessage(`Registration failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Validate password confirmation
    validatePasswordConfirmation() {
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (confirmPassword && password !== confirmPassword) {
            document.getElementById('confirmPassword').setCustomValidity('Passwords do not match');
            return false;
        } else {
            document.getElementById('confirmPassword').setCustomValidity('');
            return true;
        }
    }

    // Check for existing authentication
    checkExistingAuth() {
        // Check localStorage first (remember me), then sessionStorage
        let token = localStorage.getItem('sms_token') || sessionStorage.getItem('sms_token');
        let user = localStorage.getItem('sms_user') || sessionStorage.getItem('sms_user');

        if (token && user) {
            try {
                this.token = token;
                this.currentUser = JSON.parse(user);
                
                // Verify token is still valid
                this.verifyToken();
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                this.clearAuth();
            }
        }
    }

    // Verify token with server
    async verifyToken() {
        try {
            const response = await this.apiCall('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            // Token is valid, redirect to main app
            window.location.href = '/';
        } catch (error) {
            // Token is invalid, clear auth and stay on login page
            this.clearAuth();
            this.showMessage('Session expired. Please login again.', 'error');
        }
    }

    // Clear authentication data
    clearAuth() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('sms_token');
        localStorage.removeItem('sms_user');
        sessionStorage.removeItem('sms_token');
        sessionStorage.removeItem('sms_user');
    }

    // Logout function (called from main app)
    static logout() {
        localStorage.removeItem('sms_token');
        localStorage.removeItem('sms_user');
        sessionStorage.removeItem('sms_token');
        sessionStorage.removeItem('sms_user');
        window.location.href = '/login.html';
    }

    // Get current user (static method for use in main app)
    static getCurrentUser() {
        const user = localStorage.getItem('sms_user') || sessionStorage.getItem('sms_user');
        return user ? JSON.parse(user) : null;
    }

    // Get token (static method for use in main app)
    static getToken() {
        return localStorage.getItem('sms_token') || sessionStorage.getItem('sms_token');
    }
}

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// Handle page visibility change to check auth status
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.authManager) {
        // Check if user is still authenticated when page becomes visible
        const token = AuthManager.getToken();
        if (!token) {
            window.location.href = '/login.html';
        }
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.authManager) {
        authManager.showMessage('Connection restored!', 'success');
    }
});

window.addEventListener('offline', () => {
    if (window.authManager) {
        authManager.showMessage('You are offline. Some features may not work.', 'error');
    }
});
