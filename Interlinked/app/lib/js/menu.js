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

// Sample game data - in a real app, this would come from a database or API
const gameData = {
    "Wonder World": {
        cover: "app/lib/covers/wonder-world.png",
        developer: "Alex Fischer",
        release: "2025",
        rating: "???",
        description: "Explore a vibrant world full of imagination and adventure. Wonder World takes you on a journey through magical landscapes and introduces you to unforgettable characters.",
        tags: ["Adventure", "Family-friendly", "Open World", "Sandbox", "Fantasy"]
    },
    "Pixel Battles": {
        cover: "app/lib/covers/pixel-battles.png",
        developer: "InterLinked Creations",
        release: "2024",
        rating: "???",
        description: "Jump into pixel-perfect arena battles against friends or AI. Master different weapons and power-ups in this fast-paced multiplayer game.",
        tags: ["Action", "Multiplayer", "PvP", "Pixel Art"]
    },
    "Kart Battle": {
        cover: "app/lib/covers/kart-battle.png",
        developer: "Alex Fischer",
        release: "2025",
        rating: "???",
        description: "Race through crazy tracks, collect power-ups, and battle your way to the finish line in this high-speed kart racing game.",
        tags: ["Racing", "Multiplayer", "Family-friendly"]
    },
    "Sonic Hockey": {
        cover: "app/lib/covers/sonic-hockey.png",
        developer: "Alex Fischer",
        release: "2024",
        rating: "???",
        description: "Experience the thrill of high-speed hockey with unique power moves and special abilities that make every match exciting.",
        tags: ["Sports", "Arcade", "Action", "Multiplayer"]
    },
    "Block Lands": {
        cover: "app/lib/covers/block-lands.png",
        developer: "InterLinked Creations",
        release: "2023",
        rating: "???",
        description: "Survive a series of challenging levels made entirely of blocks. Pull off unique moves, collect unique power-ups, and solve puzzles to progress through the game.",
        tags: ["Survival", "Platformer", "Multiplayer", "Family-friendly"]
    },
    "Pixel Quest": {
        cover: "app/lib/covers/pixel-quest.png",
        developer: "InterLinked Creations",
        release: "2024",
        rating: "???",
        description: "Embark on an epic retro-style adventure. Level up your characters, discover hidden treasures, and save the world from ancient evil. Free roam is also available, along with multiplayer co-op and free-for-all mode.",
        tags: ["Pixel Art", "Adventure", "Story-rich", "Fantasy", "Action", "Multiplayer"]
    },
    "Tank Battle": {
        cover: "app/lib/covers/tank-battle.png",
        developer: "InterLinked Creations",
        release: "2025",
        rating: "???",
        description: "Command your tank through challenging battlefields. Upgrade your arsenal and defeat enemy forces in this strategic combat game.",
        tags: ["Strategy", "Action", "Military", "Multiplayer"]
    },
    "Wonder World Race": {
        cover: "app/lib/covers/wonder-world-race.png",
        developer: "Alex Fischer",
        release: "2025",
        rating: "???",
        description: "Race through the magical realms of Wonder World with your favorite characters. Unlock special powers and discover shortcuts to victory.",
        tags: ["Racing", "Family-friendly", "Fantasy"]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const gameCards = document.querySelectorAll('.game-card');
    const overlay = document.getElementById('game-overlay');
    const closeButton = document.querySelector('.overlay-close');
    
    // Add click event to all game cards
    gameCards.forEach(card => {
        card.addEventListener('click', () => {
            const title = card.querySelector('.game-card-title p').textContent;
            openGameOverlay(title);
        });
    });
    
    // Close overlay when clicking the X button
    closeButton.addEventListener('click', () => {
        closeGameOverlay();
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

// Call preload when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Preload game covers for better performance
    preloadGameCovers();
});
