window.mainFrame = {
    /**
     * @type {string}
     * @description The mode of the MainFrame, which can affect how certain functions behave.
     * For example, in "web" mode, a game will try to quit to the main menu instead of closing the entire window.
     */
    mode: "web",

    /**
     * @type {HTMLElement}
     * @description The main iframe element on the page.
     */
    html: document.getElementById('mainframe'),

    /**
     * @type {boolean}
     * @description Indicates whether the frame is currently active. Some Interlinked pages wait to start up till the overlay is no longer active.
     * @default false
     */
    overlayOn: false, 

    /**
     * @namespace page
     * @description Functions for changing the page displayed in the iframe.
     */
    page: {
        /**
         * @description Flashes the overlay screen to a new page.
         * @param {string} src The path to the new page.
         */
        flash: function(src = false) {
            if (src) {
                const flashElement = document.getElementById('screenOverlay');
                flashElement.classList.add('active', 'flash');
                this.overlayOn = true;
                setTimeout(() => {
                    mainFrame.html.src = "app/"+src;
                }, 800);
            }
        },

        /**
         * @description Changes the page displayed in the iframe without flashing the overlay screen.
         * @param {string} src The path to the new page.
         */
        fade: function(src = false) {
            if (src) {
                const flashElement = document.getElementById('screenOverlay');
                flashElement.classList.add('active');
                this.overlayOn = true;
                setTimeout(() => {
                    mainFrame.html.src = "app/"+src;
                }, 800);
            }
        },

        /**
         * @description Changes the page displayed in the iframe without flashing the overlay screen.
         * @param {string} src The path to the new page.
         */
        shortcut: function(src = false) {
            if (src) {
                mainFrame.html.src = "app/"+src;
            }
        },

        /**
         * @description Navigates the main iframe to the home page (index.html) using a fade transition.
         */
        home: function() { this.fade('index.html'); },

        /**
         * @description Launches a game with the full-screen transition overlay.
         * @param {string} gameURL The URL of the game to launch.
         * @param {Function} [onComplete] Optional callback invoked when the transition finishes.
         */
        launch: function(gameURL, onComplete) {
            if (!gameURL) {
                console.error('No game URL set');
                return;
            }

            const innerDoc = mainFrame.html.contentDocument;
            const overlay = innerDoc.getElementById('game-transition-overlay');
            const branding = innerDoc.getElementById('game-transition-branding');
            const gameFrame = innerDoc.getElementById('MainFrame');
            const errorDialog = innerDoc.getElementById('game-error-dialog');
            const errorDialogMessage = innerDoc.getElementById('error-dialog-message');
            const errorDialogClose = innerDoc.getElementById('error-dialog-close');

            // Step 1: Fade to black
            overlay.classList.add('active');

            // Step 2: Show branding text after the screen is opaque
            setTimeout(() => {
                branding.classList.add('visible');
            }, 650);

            // Step 3: Start loading the game behind the black screen
            setTimeout(() => {
                gameFrame.style.display = 'block';
                gameFrame.src = gameURL;
            }, 1000);

            // Step 4 & 5: Once game finishes loading, remove text then fade away
            let transitionComplete = false;
            let errorOccurred = false;

            function showError(errorMessage) {
                if (errorOccurred) return;
                errorOccurred = true;

                // Fade out the branding text
                branding.classList.add('fade-out');
                branding.classList.remove('visible');

                // Keep the overlay active (black screen stays opaque)
                // Navigate back to home page while keeping overlay active
                setTimeout(() => {
                    gameFrame.style.display = 'none';
                    gameFrame.src = 'about:blank';
                    
                    // Show error dialog
                    errorDialogMessage.textContent = errorMessage || 'The game could not be loaded. Please try again later.';
                    errorDialog.classList.remove('hidden');

                    // Setup close button handler
                    errorDialogClose.onclick = function() {
                        errorDialog.classList.add('hidden');
                        branding.classList.remove('fade-out');
                        overlay.classList.remove('active');
                    };
                }, 500);
            }

            function finishTransition() {
                if (transitionComplete || errorOccurred) return;
                transitionComplete = true;

                setTimeout(() => {
                    branding.classList.remove('visible');
                }, 500);

                setTimeout(() => {
                    overlay.classList.remove('active');
                    if (onComplete) onComplete();
                }, 1100);
            }

            // Error detection for the iframe
            gameFrame.onerror = function() {
                showError('The game failed to load. The server may be unavailable.');
            };

            gameFrame.onload = function() {
                try {
                    // Try to access the iframe's content to check if it loaded properly
                    const iframeDoc = gameFrame.contentDocument || gameFrame.contentWindow.document;
                    
                    // Check if we got an error page (this won't work for all cases due to CORS)
                    // But we can at least check if the document exists
                    if (!iframeDoc) {
                        showError('The game failed to load. Please check your connection.');
                        return;
                    }

                    // Check if the page is blank or has an error
                    const bodyText = iframeDoc.body ? iframeDoc.body.textContent.trim() : '';
                    const title = iframeDoc.title ? iframeDoc.title.toLowerCase() : '';
                    
                    // Common error page indicators
                    if (title.includes('404') || title.includes('not found') || 
                        title.includes('500') || title.includes('error') ||
                        bodyText.includes('404') || bodyText.includes('Not Found') ||
                        bodyText.includes('500') || bodyText.includes('Internal Server Error')) {
                        showError('The game could not be found (Error 404). It may have been moved or removed.');
                        return;
                    }

                    // If we got here, assume the page loaded successfully
                    finishTransition();
                } catch (e) {
                    // CORS error - we can't access the iframe content
                    // In this case, we'll assume it loaded successfully if onload fired
                    // unless it's a same-origin error page
                    console.warn('Cannot verify iframe content due to CORS:', e);
                    finishTransition();
                }
            };

            // Fallback: if the iframe never fires onload, finish after 8 seconds
            setTimeout(() => {
                if (!transitionComplete && !errorOccurred) {
                    showError('The game took too long to load. The server may be unavailable.');
                }
            }, 8000);
        }
    },

    /**
    * @namespace toast
    * @description System-level toast notification API for displaying pop-up messages
    * above the MainFrame screen. Supports multiple notification types such as normal,
    * success, info, warning, error, congrats, invite, and special events.
    */
    toast: {
        normal: function(message, options) { this._create("normal", message, options); },
        success: function(message, options) { this._create("success", message, options); },
        info: function(message, options) { this._create("info", message, options); },
        warn: function(message, options) { this._create("warn", message, options); },
        error: function(message, options) { this._create("error", message, options); },
        congrats: function(message, options) { this._create("congrats", message, options); },
        invite: function(message, options) { this._create("invite", message, options); },
        special: function(message, options) { this._create("special", message, options); },

        _create: function(type, message, options = {}) {
            if (!message) return;

            const container = document.getElementById("toast-container");
            if (!container) return;

            const toast = document.createElement("div");
            toast.classList.add("toast", `toast-${type}`);
            toast.textContent = message;

            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.add("fade-out");
                setTimeout(() => toast.remove(), 300);
            }, options.duration || 3000);
        }
    }

}

// window.addEventListener('DOMContentLoaded', e => {
//     setTimeout(() => {window.mainFrame.page.shortcut('index.html');}, 250)
// });

document.getElementById('mainframe').src = "app/intro.html";

document.getElementById('mainframe').addEventListener('load', e => {
    mainFrame.html.style.display = 'block';
    document.getElementById('loadingText').style.display = 'none';  
    const iframe = e.currentTarget;
    const flashElement = document.getElementById('screenOverlay');
    flashElement.classList.remove('active');
    setTimeout(() => {
        flashElement.classList.remove('flash');
        mainFrame.overlayOn = false;
    }, 500);
});