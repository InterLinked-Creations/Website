const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");


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

function getGameStatus(localManifest, remoteManifest) {
    if (!localManifest) {
        if (!remoteManifest) {
            return "not-installed";
        }
        if (!remoteManifest.version) {
            return "remote-no-version";
        }
        return "not-installed";
    }

    if (!localManifest.version) {
        return "installed-no-version";
    }

    if (!remoteManifest || !remoteManifest.version) {
        return "remote-no-version";
    }

    if (localManifest.version === remoteManifest.version) {
        return "up-to-date";
    }

    return "update-available";
}

function getRequiredAction(status) {
    switch (status) {
        case "not-installed":
            return "install";
        case "update-available":
            return "update";
        case "up-to-date":
            return "none";
        default:
            return "error";
    }
}

async function cloneGameRepo(game) {
    const git = simpleGit();
    const folder = getGameFolder(game);

    console.log(`Cloning ${game.repo} into ${folder}`);
    await git.clone(game.repo, folder);
}

async function pullGameRepo(game) {
    const folder = getGameFolder(game);
    const git = simpleGit(folder);

    console.log(`Pulling latest changes in ${folder}`);
    await git.pull();
}

async function performAction(game, action) {
    switch (action) {
        case "install":
            console.log("Installing game...");
            await cloneGameRepo(game);
            console.log("Install complete");
            break;

        case "update":
            console.log("→ Updating game...");
            await pullGameRepo(game);
            console.log("Update complete");
            break;

        case "none":
            console.log("No action needed");
            break;

        default:
            console.log("Cannot perform action due to error state");
            break;
    }
}


async function main() {
    console.log("=== Game Update Status Check ===");
    console.log("Loading game list...");

    if (games.length === 0) {
        console.log("No games found in game.json");
        return;
    }

    console.log("Ensuring games directory exists...");
    ensureGamesDir();

    for (const game of games) {
        console.log("\n----------------------------------------");
        console.log(`Starting update check for: ${game.name}`);

        const folderExists = gameFolderExists(game);
        const localManifest = loadLocalManifest(game);

        console.log(`Folder exists: ${folderExists}`);
        console.log("Local manifest:", localManifest || "None");

        let remoteManifest = null;

        console.log("Fetching remote manifest...");
        try {
            remoteManifest = await fetchRemoteManifest(game);
            console.log("Remote manifest:", remoteManifest);
        } catch (err) {
            console.error(`Failed to load remote manifest for "${game.name}":`, err.message);
        }

        console.log("Comparing versions...");
        const status = getGameStatus(localManifest, remoteManifest);
        console.log("Status:", status);

        console.log("Determining required action...");
        const action = getRequiredAction(status);
        console.log("Action:", action);

        console.log("Performing action...");
        await performAction(game, action);

        console.log(`Finished processing ${game.name}`);
    }

    console.log("\n=== Game update process complete ===");
}


main().catch(err => {
    console.error("Unexpected error in gameUpdate script:", err);
    process.exit(1);
});