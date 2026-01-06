document.addEventListener('DOMContentLoaded', () => {
    // Navigation elements
    const homeNav = document.getElementById('Home');
    const searchNav = document.getElementById('Search');
    const libraryNav = document.getElementById('Library');
    const settingsNav = document.getElementById('Settings');
    const friendsNav = document.getElementById('Friends');
    const notificationsNav = document.getElementById('Notifications');
    const helpNav = document.getElementById('Help');

    // Page content elements
    const homePage = document.getElementById('home-page');
    const searchPage = document.getElementById('search-page');
    const libraryPage = document.getElementById('library-page');
    const settingsPage = document.getElementById('settings-page');
    const friendsPage = document.getElementById('friends-page');
    const notificationsPage = document.getElementById('notifications-page');
    const helpPage = document.getElementById('help-page');

    // Navigation mapping
    const navigationMap = {
        'Home': homePage,
        'Search': searchPage,
        'Library': libraryPage,
        'Settings': settingsPage,
        'Friends': friendsPage,
        'Notifications': notificationsPage,
        'Help': helpPage
    };

    // Function to handle navigation
    function navigateTo(pageId) {
        // Hide all pages
        Object.values(navigationMap).forEach(page => {
            if (page) {
                page.classList.add('hidden');
            }
        });

        // Remove active class from all nav items
        document.querySelectorAll('.sideNav, .lowerNav').forEach(nav => {
            nav.classList.remove('active');
        });

        // Show selected page
        const selectedPage = navigationMap[pageId];
        if (selectedPage) {
            selectedPage.classList.remove('hidden');
            
            // Trigger a custom event that auth-check.js can listen for
            document.dispatchEvent(new CustomEvent('page-changed', {
                detail: {
                    pageId: pageId
                }
            }));
        }

        // Set active class on selected nav item
        document.getElementById(pageId).classList.add('active');
    }

    // Add click event listeners to navigation items
    if (homeNav) {
        homeNav.addEventListener('click', () => navigateTo('Home'));
    }

    if (searchNav) {
        searchNav.addEventListener('click', () => navigateTo('Search'));
    }

    if (libraryNav) {
        libraryNav.addEventListener('click', () => navigateTo('Library'));
    }

    if (settingsNav) {
        settingsNav.addEventListener('click', () => navigateTo('Settings'));
    }

    if (friendsNav) {
        friendsNav.addEventListener('click', () => navigateTo('Friends'));
    }

    if (notificationsNav) {
        notificationsNav.addEventListener('click', () => navigateTo('Notifications'));
    }

    if (helpNav) {
        helpNav.addEventListener('click', () => navigateTo('Help'));
    }

    // Initialize navigation (Home is default)
    document.getElementById('Home').classList.add('active');
});
