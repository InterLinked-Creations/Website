const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

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

console.log("\nStep 2 complete — folder + manifest detection ready.");

function getRemoteManifestUrl(game) {
    const repoUrl = game.repo;
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git)?/);
    if (!match) {
        throw new Error(`Invalid GitHub repo URL for game "${game.name}": ${repoUrl}`);
    }
    const owner = match[1];
    const repoName = match[2];
    return `https://raw.githubusercontent.com/${owner}/${repoName}/main/manifest.json`;
}

async function fetchRemoteManifest(game) {
    const url = getRemoteManifestUrl(game);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch remote manifest for "${game.name}" from ${url} (status ${response.status})`);
    }
    const text = await response.text();
    return JSON.parse(text);
}

async function main() {
    console.log("=== Game Update Status Check ===");

    if (games.length === 0) {
        console.log("No games found in game.json");
        console.log("\nStep 3 complete — remote manifest fetching logic ready.");
        return;
    }

    for (const game of games) {
        const folderExists = gameFolderExists(game);
        const localManifest = loadLocalManifest(game);

        console.log(`\nGame: ${game.name}`);
        console.log(`Folder exists: ${folderExists}`);
        console.log("Local manifest:", localManifest || "None found");

        try {
            const remoteManifest = await fetchRemoteManifest(game);
            console.log("Remote manifest:", remoteManifest);
        } catch (err) {
            console.error(`Failed to load remote manifest for "${game.name}":`, err.message);
        }
    }

    console.log("\nStep 3 complete — remote manifest fetching ready.");
}

main().catch(err => {
    console.error("Unexpected error in gameUpdate script:", err);
    process.exit(1);
});