document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const accountBtn = document.getElementById('account');
    const accountOverlay = document.getElementById('account-overlay');
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const avatarOverlay = document.getElementById('avatar-overlay');
    const loginConfirmOverlay = document.getElementById('login-confirm-overlay');
    const closeButtons = document.querySelectorAll('.overlay-close');
    const loginChoiceBtn = document.getElementById('login-choice');
    const registerChoiceBtn = document.getElementById('register-choice');
    const accountChoiceScreen = document.getElementById('account-choice');
    const loginFormScreen = document.getElementById('login-form');
    const registerFormScreen = document.getElementById('register-form');
    const backButtons = document.querySelectorAll('.back-button');
    
    let currentUser = null;
    let isLoggedIn = false;
    let pendingLoginData = null; // Store login data until confirmation

    // Check session on page load
    checkSession();

    async function checkSession() {
        try {
            const response = await fetch('/api/check-session');
            const data = await response.json();
            
            if (data.authenticated) {
                currentUser = {
                    userId: data.userId,
                    username: data.username,
                    avatar: data.avatar
                };
                isLoggedIn = true;
                updateAccountButton();
            } else {
                currentUser = null;
                isLoggedIn = false;
                updateAccountButton();
            }
        } catch (error) {
            console.error('Session check failed:', error);
            currentUser = null;
            isLoggedIn = false;
            updateAccountButton();
        }
    }

    function updateAccountButton() {
        if (isLoggedIn && currentUser) {
            // Show user avatar on account button
            accountBtn.style.backgroundImage = `url('${currentUser.avatar}')`;
            accountBtn.style.backgroundSize = 'cover';
            accountBtn.style.backgroundPosition = 'center';
            accountBtn.style.borderRadius = '50%';
        } else {
            // Reset to default button appearance
            accountBtn.style.backgroundImage = '';
            accountBtn.style.backgroundSize = '';
            accountBtn.style.backgroundPosition = '';
            accountBtn.style.borderRadius = '';
        }
        
        // Dispatch event for login status change
        document.dispatchEvent(new CustomEvent('login-status-changed', {
            detail: {
                isLoggedIn: isLoggedIn
            }
        }));
    }

    // Show account overlay when clicking account button
    accountBtn.addEventListener('click', () => {
        accountOverlay.classList.remove('hidden');
        if (isLoggedIn) {
            showUserSettings();
        } else {
            showScreen('account-choice');
        }
    });

    // Close overlays when clicking close button
    closeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.target.closest('.overlay-content').parentElement.classList.add('hidden');
        });
    });

    // Close overlays when clicking outside
    if (accountOverlay) {
        accountOverlay.addEventListener('click', (e) => {
            if (e.target === accountOverlay) {
                accountOverlay.classList.add('hidden');
            }
        });
    }

    // Show login form
    if (loginChoiceBtn) {
        loginChoiceBtn.addEventListener('click', () => {
            document.getElementById('account-choice').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        });
    }

    // Show register form
    if (registerChoiceBtn) {
        registerChoiceBtn.addEventListener('click', () => {
            document.getElementById('account-choice').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        });
    }

    // Back button functionality
    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('account-choice').classList.remove('hidden');
            clearErrors();
        });
    });

    // Register form submission
    const registerForm = document.querySelector('#register-form form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const formData = {
                username: document.getElementById('register-username').value,
                email: document.getElementById('register-email').value,
                password: document.getElementById('register-password').value,
                confirmPassword: document.getElementById('register-confirm-password').value
            };

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (data.errors) {
                    showErrors(data.errors);
                } else {
                    handleSuccessfulLogin(data);
                    showWelcomeScreen(data.username, data.avatar);
                }
            } catch (error) {
                showErrors(['An unexpected error occurred']);
            }
        });
    }

    // Login form submission
    const loginForm = document.querySelector('#login-form form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const formData = {
                username: document.getElementById('login-username').value,
                password: document.getElementById('login-password').value
            };

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (data.errors) {
                    document.getElementById('login-error').textContent = data.errors[0];
                } else {
                    // Store login data for confirmation, don't log in yet
                    pendingLoginData = data;
                    showLoginConfirmation(data.username, data.avatar);
                }
            } catch (error) {
                document.getElementById('login-error').textContent = 'An unexpected error occurred';
            }
        });
    }

    // Avatar change functionality
    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    const saveAvatarBtn = document.getElementById('save-avatar-btn');
    const welcomeCloseBtn = document.getElementById('welcome-close-btn');
    const confirmLoginBtn = document.getElementById('confirm-login-btn');
    const cancelLoginBtn = document.getElementById('cancel-login-btn');
    const avatarGrid = document.getElementById('avatar-grid');
    
    // Avatar change button
    if (changeAvatarBtn && avatarGrid) {
        changeAvatarBtn.addEventListener('click', async () => {
            try {
                welcomeOverlay.classList.add('hidden');
                const response = await fetch('/api/avatars');
                const data = await response.json();
                
                avatarGrid.innerHTML = data.avatars.map(avatar => `
                    <div class="avatar-option" data-avatar="${avatar}">
                        <img src="${avatar}" alt="Avatar option">
                    </div>
                `).join('');

                // Handle avatar selection
                const avatarOptions = avatarGrid.querySelectorAll('.avatar-option');
                avatarOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        avatarOptions.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                    });
                });

                avatarOverlay.classList.remove('hidden');
            } catch (error) {
                console.error('Failed to load avatars:', error);
            }
        });
    }

    // Save avatar selection
    if (saveAvatarBtn) {
        saveAvatarBtn.addEventListener('click', async () => {
            const selectedAvatar = document.querySelector('.avatar-option.selected');
            if (!selectedAvatar) return;

            const avatar = selectedAvatar.dataset.avatar;
            
            try {
                const response = await fetch('/api/update-avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.userId, avatar })
                });

                const data = await response.json();
                if (data.success) {
                    // Update current user avatar
                    if (currentUser) {
                        currentUser.avatar = avatar;
                        updateAccountButton();
                    }
                    
                    const welcomeAvatar = document.getElementById('welcome-avatar');
                    if (welcomeAvatar) {
                        welcomeAvatar.src = avatar;
                    }
                    if (avatarOverlay) {
                        avatarOverlay.classList.add('hidden');
                    }
                    if (welcomeOverlay) {
                        welcomeOverlay.classList.remove('hidden');
                    } else {
                        // If coming from settings, show settings again
                        accountOverlay.classList.remove('hidden');
                        showUserSettings();
                    }
                }
            } catch (error) {
                console.error('Failed to update avatar:', error);
            }
        });
    }

    // Welcome screen close button
    if (welcomeCloseBtn) {
        welcomeCloseBtn.addEventListener('click', () => {
            location.reload();
        });
    }

    // Login confirmation buttons
    if (confirmLoginBtn) {
        confirmLoginBtn.addEventListener('click', async () => {
            if (pendingLoginData) {
                // Now actually confirm the login on server
                try {
                    const response = await fetch('/api/confirm-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: pendingLoginData.userId })
                    });
                    
                    if (response.ok) {
                        handleSuccessfulLogin(pendingLoginData);
                        location.reload();
                        pendingLoginData = null;
                    } else {
                        console.error('Failed to confirm login');
                    }
                } catch (error) {
                    console.error('Login confirmation error:', error);
                }
            }
        });
    }

    if (cancelLoginBtn) {
        cancelLoginBtn.addEventListener('click', () => {
            // Clear pending login data
            pendingLoginData = null;
            if (loginConfirmOverlay) {
                loginConfirmOverlay.classList.add('hidden');
            }
            showScreen('account-choice');
        });
    }

    // Helper function to show specific screen
    function showScreen(screenId) {
        [accountChoiceScreen, loginFormScreen, registerFormScreen].forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }

    // Helper function to show welcome screen
    function showWelcomeScreen(username, avatar) {
        if (accountOverlay) {
            accountOverlay.classList.add('hidden');
        }
        
        const welcomeAvatar = document.getElementById('welcome-avatar');
        const welcomeUsername = document.getElementById('welcome-username');
        
        if (welcomeAvatar) {
            welcomeAvatar.src = avatar;
        }
        if (welcomeUsername) {
            welcomeUsername.textContent = username;
        }
        if (welcomeOverlay) {
            welcomeOverlay.classList.remove('hidden');
        }
    }

    // Helper function to show login confirmation
    function showLoginConfirmation(username, avatar) {
        if (accountOverlay) {
            accountOverlay.classList.add('hidden');
        }
        
        const confirmAvatar = document.getElementById('login-confirm-avatar');
        const confirmUsername = document.getElementById('login-confirm-username');
        
        if (confirmAvatar) {
            confirmAvatar.src = avatar;
        }
        if (confirmUsername) {
            confirmUsername.textContent = username;
        }
        if (loginConfirmOverlay) {
            loginConfirmOverlay.classList.remove('hidden');
        }
    }

    // Helper function to show form errors
    function showErrors(errors) {
        errors.forEach(error => {
            let errorElement = null;
            if (error.includes('Username')) {
                errorElement = document.getElementById('username-error');
            } else if (error.includes('Email')) {
                errorElement = document.getElementById('email-error');
            } else if (error.includes('Password')) {
                errorElement = document.getElementById('password-error');
            }
            
            if (errorElement) {
                errorElement.textContent = error;
            }
        });
    }

    // Helper function to clear form errors
    function clearErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        if (errorElements) {
            errorElements.forEach(element => {
                if (element) {
                    element.textContent = '';
                }
            });
        }
    }

    // Show user settings screen
    function showUserSettings() {
        if (!currentUser) return;
        
        // Hide all other screens
        document.querySelectorAll('.account-screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show user settings
        const userSettings = document.getElementById('user-settings');
        const userAvatar = document.getElementById('user-avatar');
        const userUsername = document.getElementById('user-username');
        
        if (userSettings) {
            userSettings.classList.remove('hidden');
        }
        if (userAvatar) {
            userAvatar.src = currentUser.avatar;
        }
        if (userUsername) {
            userUsername.textContent = currentUser.username;
        }
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                if (data.success) {
                    currentUser = null;
                    isLoggedIn = false;
                    updateAccountButton();
                    accountOverlay.classList.add('hidden');
                    
                    location.reload();
                }
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });
    }

    // Change avatar from settings
    const changeAvatarSettingsBtn = document.getElementById('change-avatar-settings-btn');
    if (changeAvatarSettingsBtn) {
        changeAvatarSettingsBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/avatars');
                const data = await response.json();
                
                avatarGrid.innerHTML = data.avatars.map(avatar => `
                    <div class="avatar-option" data-avatar="${avatar}">
                        <img src="${avatar}" alt="Avatar option">
                    </div>
                `).join('');

                // Handle avatar selection
                const avatarOptions = avatarGrid.querySelectorAll('.avatar-option');
                avatarOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        avatarOptions.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                    });
                });

                accountOverlay.classList.add('hidden');
                avatarOverlay.classList.remove('hidden');
            } catch (error) {
                console.error('Failed to load avatars:', error);
            }
        });
    }

    // Update login/register to set user state
    function handleSuccessfulLogin(userData) {
        currentUser = {
            userId: userData.userId,
            username: userData.username,
            avatar: userData.avatar
        };
        isLoggedIn = true;
        updateAccountButton();
        accountOverlay.classList.add('hidden');
        
        // Update authenticated content immediately
        document.dispatchEvent(new CustomEvent('login-status-changed', {
            detail: {
                isLoggedIn: true
            }
        }));
    }
});
