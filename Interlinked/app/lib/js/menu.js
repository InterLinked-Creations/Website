// Image Library to preload and keep images in memory
const ImageLibrary = {
    images: {},
    
    // Preload an image and store it in memory
    preload: function(key, src) {
        const img = new Image();
        img.src = src;
        this.images[key] = img;
        return img;
    },
    
    // Get a preloaded image
    get: function(key) {
        return this.images[key] || null;
    },
    
    // Check if image is loaded
    isLoaded: function(key) {
        return this.images[key] && this.images[key].complete;
    },
    
    // Initialize with a set of images
    init: function(imageList) {
        Object.entries(imageList).forEach(([key, src]) => {
            this.preload(key, src);
        });
        console.log('Image library initialized with', Object.keys(imageList).length, 'images');
    }
};

// Initialize the image library with button images
ImageLibrary.init({
    'button': 'app/lib/icons/button.png',
    'bronzeButton': 'app/lib/icons/bronze-button.png',
    'goldButton': 'app/lib/icons/gold-button.png'
});

// Game data loaded from the API
let gameData = {};

// Currently selected game URL for launching
let currentGameURL = '';

// Creates a game card DOM element
function createGameCard(game) {
    const card = document.createElement('div');
    card.classList.add('game-card');

    const imageDiv = document.createElement('div');
    imageDiv.classList.add('game-card-image');
    if (game.coverURL) {
        imageDiv.style.backgroundImage = `url('${game.coverURL}')`;
    }

    const titleDiv = document.createElement('div');
    titleDiv.classList.add('game-card-title');
    const titleP = document.createElement('p');
    titleP.textContent = game.title || game.name;
    titleDiv.appendChild(titleP);

    card.appendChild(imageDiv);
    card.appendChild(titleDiv);

    card.addEventListener('click', () => {
        openGameOverlay(game.title || game.name);
    });

    return card;
}

// Populates a game ribbon element with game cards
function populateRibbon(ribbonElement, games) {
    ribbonElement.innerHTML = '';
    if (!games || games.length === 0) {
        const msg = document.createElement('p');
        msg.classList.add('no-games-message');
        msg.textContent = 'No games are currently available.';
        ribbonElement.appendChild(msg);
        return;
    }

    games.forEach(game => {
        ribbonElement.appendChild(createGameCard(game));
    });
}

// Fetches games from the API and populates all ribbons
async function loadGames() {
    try {
        const response = await fetch('/api/games');
        const data = await response.json();

        if (!data.success || !data.games || data.games.length === 0) {
            return;
        }

        // Build gameData lookup from API results
        gameData = {};
        data.games.forEach(game => {
            const key = game.title || game.name;
            gameData[key] = {
                cover: game.coverURL || '',
                developer: game.creator || '',
                release: game.yearCreated || '',
                rating: '???',
                description: game.description || '',
                tags: game.tags || [],
                folderName: game.folderName || ''
            };
        });

        // Populate ribbons
        const newestRibbon = document.getElementById('newest-games-ribbon');
        const popularRibbon = document.getElementById('popular-games-ribbon');

        if (newestRibbon) {
            populateRibbon(newestRibbon, data.games);
        }
        if (popularRibbon) {
            populateRibbon(popularRibbon, data.games);
        }

        // Preload game covers
        preloadGameCovers();
    } catch (err) {
        console.error('Failed to load games from API:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('game-overlay');
    const closeButton = document.querySelector('.overlay-close');
    
    // Close overlay when clicking the X button
    closeButton.addEventListener('click', () => {
        closeGameOverlay();
    });

    // Play Now button launches the game with transition
    const playNowBtn = document.getElementById('play-now-btn');
    playNowBtn.addEventListener('click', () => {
        window.parent.mainFrame.page.launch(currentGameURL, closeGameOverlay);
    });
    
    // Close overlay when clicking outside the content
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeGameOverlay();
        }
    });
    
    // Close overlay with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            closeGameOverlay();
        }
    });

    // Load games from API
    loadGames();
});

function openGameOverlay(gameTitle) {
    const overlay = document.getElementById('game-overlay');
    const game = gameData[gameTitle];
    
    if (!game) {
        console.error('Game data not found for:', gameTitle);
        return;
    }
    
    // Set game details in the overlay
    document.getElementById('game-cover-img').src = game.cover;
    document.getElementById('game-title').textContent = gameTitle;
    document.getElementById('game-developer').textContent = game.developer;
    document.getElementById('game-release').textContent = game.release;
    document.getElementById('game-description').textContent = game.description;
    document.getElementById('game-rating-number').textContent = game.rating === "???" ? "???" : game.rating.toFixed(1);

    // Store the game URL for launching
    currentGameURL = '/games/' + game.folderName || '';
    
    // Create star rating
    if (game.rating === "???") {
        const starsContainer = document.querySelector('.stars');
        starsContainer.innerHTML = '';
        const fullStars = Math.floor(game.rating);
        const hasHalfStar = game.rating % 1 >= 0.5;
        
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                starsContainer.innerHTML += '★'; // Full star
            } else if (i === fullStars && hasHalfStar) {
                starsContainer.innerHTML += '⯨'; // Half star
            } else {
                starsContainer.innerHTML += '☆'; // Empty star
            }
        }
    } else {
        document.querySelector('.stars').innerHTML = '???';
    }
    
    // Add tags
    const tagsContainer = document.getElementById('game-tags');
    tagsContainer.innerHTML = '';
    game.tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.classList.add('game-tag');
        tagElement.textContent = tag;
        tagsContainer.appendChild(tagElement);
    });
    
    // Show overlay
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling behind overlay
}

function closeGameOverlay() {
    const overlay = document.getElementById('game-overlay');
    overlay.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
}

// Utility functions to use the button images from the image library
function createButtonElement(type = 'button', options = {}) {
    const buttonDiv = document.createElement('div');
    buttonDiv.className = options.className || 'custom-button';
    
    const buttonImg = document.createElement('img');
    
    // Use image from the library
    if (ImageLibrary.isLoaded(type)) {
        buttonImg.src = ImageLibrary.get(type).src;
    } else {
        console.warn(`Button image "${type}" not loaded, using default`);
        buttonImg.src = ImageLibrary.get('button').src;
    }
    
    buttonImg.alt = options.alt || 'Button';
    buttonDiv.appendChild(buttonImg);
    
    if (options.text) {
        const buttonText = document.createElement('span');
        buttonText.textContent = options.text;
        buttonText.className = 'button-text';
        buttonDiv.appendChild(buttonText);
    }
    
    if (options.onClick) {
        buttonDiv.addEventListener('click', options.onClick);
    }
    
    return buttonDiv;
}

// Example of how to use the button creation function (for demonstration)
function addDynamicButton(parentElement, type, text, clickHandler) {
    const button = createButtonElement(type, {
        text: text,
        className: 'dynamic-button',
        onClick: clickHandler
    });
    
    parentElement.appendChild(button);
    return button;
}

// Preload additional images as needed
function preloadGameCovers() {
    // Preload all game covers from gameData
    Object.entries(gameData).forEach(([title, data]) => {
        ImageLibrary.preload(`cover-${title.replace(/\s+/g, '-').toLowerCase()}`, data.cover);
    });
    console.log('Game covers preloaded');
}
