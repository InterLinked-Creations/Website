document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const emailCheckBox = document.getElementById('email-notifications');
    const gameRecommendationCheckBox = document.getElementById('game-recommendations');
    const themeSelector = document.getElementById('theme-selector');

    themeSelector.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        document.body.className = selectedTheme; // Apply the selected theme
        console.log(`Theme changed to: ${selectedTheme}`);
    });
});