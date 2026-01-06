document.addEventListener('DOMContentLoaded', () => {
    // Pages that require authentication
    const authRequiredPages = [
        'library', 
        'settings', 
        'friends',
        'notifications'
    ];
    
    // Get login status from account.js
    let isLoggedIn = false;
    let currentPage = 'Home';  // Default page
    
    // Function to check authentication status
    async function checkAuth() {
        try {
            const response = await fetch('/api/check-session');
            const data = await response.json();
            
            isLoggedIn = data.authenticated;
            updateAuthContent();
        } catch (error) {
            console.error('Authentication check failed:', error);
            isLoggedIn = false;
            updateAuthContent();
        }
    }
    
    // Update page content based on authentication status
    function updateAuthContent() {
        authRequiredPages.forEach(page => {
            const pageId = page.charAt(0).toUpperCase() + page.slice(1);
            const contentElement = document.getElementById(`${page}-content`);
            const signinElement = document.getElementById(`${page}-signin`);
            
            if (contentElement && signinElement) {
                if (isLoggedIn) {
                    contentElement.classList.remove('hidden');
                    signinElement.classList.add('hidden');
                } else {
                    contentElement.classList.add('hidden');
                    signinElement.classList.remove('hidden');
                }
            }
        });
    }
    
    // Add event listeners to signin buttons
    authRequiredPages.forEach(page => {
        const signinButton = document.getElementById(`${page}-signin-btn`);
        if (signinButton) {
            signinButton.addEventListener('click', () => {
                document.getElementById('account-overlay').classList.remove('hidden');
                document.getElementById('account-choice').classList.remove('hidden');
                document.getElementById('login-form').classList.add('hidden');
                document.getElementById('register-form').classList.add('hidden');
            });
        }
    });
    
    // Listen for login/logout events
    document.addEventListener('login-status-changed', (event) => {
        isLoggedIn = event.detail.isLoggedIn;
        updateAuthContent();
    });
    
    // Listen for page navigation events
    document.addEventListener('page-changed', (event) => {
        currentPage = event.detail.pageId;
        updateAuthContent();
    });
    
    // Initial auth check
    checkAuth();
});