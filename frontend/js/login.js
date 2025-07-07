// Warframe Market Login Handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    const authStatus = document.getElementById('auth-status');
    const statusContent = document.getElementById('status-content');
    const logoutBtn = document.getElementById('logout-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Check authentication status on page load
    checkAuthStatus();

    // Login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            showMessage('Please enter both email and password', 'error');
            return;
        }
        
        // Disable login button and show loading state
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
        
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showMessage(result.message, 'success');
                // Clear form
                loginForm.reset();
                // Update UI to show logged in state
                checkAuthStatus();
            } else {
                showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Login failed. Please try again.', 'error');
        } finally {
            // Re-enable login button
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });

    // Logout button
    logoutBtn.addEventListener('click', async function() {
        try {
            const response = await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showMessage(result.message, 'success');
                // Update UI to show logged out state
                checkAuthStatus();
            } else {
                showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Logout error:', error);
            showMessage('Logout failed. Please try again.', 'error');
        }
    });

    async function checkAuthStatus() {
        try {
            const response = await fetch('/auth/status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            
            if (result.logged_in) {
                // Show logged in state
                authStatus.style.display = 'block';
                loginForm.style.display = 'none';
                
                const sessionAge = Math.floor(result.session_age / 60); // Convert to minutes
                statusContent.innerHTML = `
                    <p><strong>Status:</strong> Logged In</p>
                    <p><strong>Session Age:</strong> ${sessionAge} minutes</p>
                    <p><strong>CSRF Token:</strong> ${result.has_csrf_token ? 'Present' : 'Missing'}</p>
                `;
            } else {
                // Show logged out state
                authStatus.style.display = 'none';
                loginForm.style.display = 'flex';
            }
        } catch (error) {
            console.error('Auth status check error:', error);
            // On error, assume logged out
            authStatus.style.display = 'none';
            loginForm.style.display = 'flex';
        }
    }

    function showMessage(message, type) {
        loginMessage.textContent = message;
        loginMessage.className = `login-message ${type}`;
        loginMessage.style.display = 'block';
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                loginMessage.style.display = 'none';
            }, 3000);
        }
    }

    // Auto-hide error messages when user starts typing
    emailInput.addEventListener('input', function() {
        if (loginMessage.style.display === 'block' && loginMessage.classList.contains('error')) {
            loginMessage.style.display = 'none';
        }
    });
    
    passwordInput.addEventListener('input', function() {
        if (loginMessage.style.display === 'block' && loginMessage.classList.contains('error')) {
            loginMessage.style.display = 'none';
        }
    });
}); 