document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const emailCheckBox = document.getElementById('email-notifications');
    const gameRecommendationCheckBox = document.getElementById('game-recommendations');
    const themeSelector = document.getElementById('theme-selector');
    // Use localStorage to remember the user's choice. "default" means follow system.
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let mqListener = null;

    function applyTheme(selectedTheme) {
        if (selectedTheme === 'dark') {
            document.body.classList.add('dark');
        }
        else if (selectedTheme === 'light') {
            // The site uses the base (no class) as the light appearance.
            document.body.classList.remove('dark');
        }
        else { // 'default' -> follow system
            if (mediaQuery.matches) document.body.classList.add('dark');
            else document.body.classList.remove('dark');
        }
    }

    function startSystemListener() {
        if (mqListener) return;
        mqListener = (e) => {
            const current = localStorage.getItem('theme') || 'default';
            if (current === 'default') {
                if (e.matches) document.body.classList.add('dark');
                else document.body.classList.remove('dark');
            }
        };
        if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', mqListener);
        else mediaQuery.addListener(mqListener);
    }

    function stopSystemListener() {
        if (!mqListener) return;
        if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', mqListener);
        else mediaQuery.removeListener(mqListener);
        mqListener = null;
    }

    // Initialize selector from saved preference (default = system)
    const saved = localStorage.getItem('theme') || 'default';
    themeSelector.value = saved;
    applyTheme(saved);
    if (saved === 'default') startSystemListener();

    themeSelector.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        localStorage.setItem('theme', selectedTheme);
        applyTheme(selectedTheme);
        if (selectedTheme === 'default') startSystemListener();
        else stopSystemListener();
        console.log(`Theme changed to: ${selectedTheme}`);
    });
});