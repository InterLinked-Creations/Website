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
function getGames(req, res) {
    try {
        if (!fs.existsSync(installedPath)) {
            return res.json({ success: true, games: [] });
        }

        const raw = fs.readFileSync(installedPath, 'utf8');
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
