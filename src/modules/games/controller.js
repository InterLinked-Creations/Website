/**
 * Games controller
 * Handles game-related API requests
 */
const fs = require('fs');
const path = require('path');

const installedPath = path.resolve(__dirname, '../../../Interlinked/games/installed.json');

/**
 * Get all installed games
 */
async function getGames(req, res) {
    try {
        try {
            await fs.promises.access(installedPath);
        } catch {
            return res.json({ success: true, games: [] });
        }

        const raw = await fs.promises.readFile(installedPath, 'utf8');
        const data = JSON.parse(raw);

        return res.json({ success: true, games: data.games || [] });
    } catch (error) {
        console.error('Error reading installed games:', error);
        return res.status(500).json({ success: false, error: 'Failed to load games' });
    }
}

module.exports = {
    getGames
};
