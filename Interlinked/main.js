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