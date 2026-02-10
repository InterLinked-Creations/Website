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

const gamesDir = path.join(__dirname, "..", "Interlinked", "games");

function getGameFolder(game) {
    return path.join(gamesDir, game.folderName);
}

function gameFolderExists(game) {
    return fs.existsSync(getGameFolder(game));
}

function getLocalManifestPath(game) {
    return path.join(getGameFolder(game), "manifest.json");
}

function localManifestExists(game) {
    return fs.existsSync(getLocalManifestPath(game));
}

function loadLocalManifest(game) {
    const manifestPath = getLocalManifestPath(game);

    if (!fs.existsSync(manifestPath)) {
        return null;
    }

    const raw = fs.readFileSync(manifestPath, "utf8");
    return JSON.parse(raw);
}

console.log("=== Game Update Status Check ===");

for (const game of games) {
    const folderExists = gameFolderExists(game);
    const manifest = loadLocalManifest(game);

    console.log(`\nGame: ${game.name}`);
    console.log(`Folder exists: ${folderExists}`);

    if (folderExists) {
        console.log("Local manifest:", manifest || "None found");
    } else {
        console.log("Local manifest: (no folder)");
    }
}

console.log("\nStep 2 complete — folder + manifest detection ready.");
