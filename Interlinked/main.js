window.mainFrame = {
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
        shortcut: function(src = false) {
            if (src) {
                mainFrame.html.src = "app/"+src;
            }
        }
    },

    /**
     * @description Displays an error message above the iframe. If there is no message given, nothing happens.
     * @param {string} message The error message to display.
     */
    error: function(message) {
        // Display an error pop up above the iframe.
    }
}

window.addEventListener('DOMContentLoaded', e => {
    setTimeout(() => {window.mainFrame.page.shortcut('index.html');}, 250)
});

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