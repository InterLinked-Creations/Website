const fs = require("fs");
const path = require("path");

// Path to game.json
const gameListPath = path.join(__dirname, "..", "Interlinked", "game.json");

// Load and parse game.json
function loadGameList() {
    if (!fs.existsSync(gameListPath)) {
        throw new Error("game.json not found at: " + gameListPath);
    }

    const raw = fs.readFileSync(gameListPath, "utf8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data.games)) {
        throw new Error("game.json is missing a 'games' array");
    }

    return data.games;
}

// For now, just test loading
const games = loadGameList();
console.log("Loaded games:", games);
