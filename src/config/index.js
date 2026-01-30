/**
 * Application configuration
 * Loads environment variables and exports config object
 */
require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    sessionSecret: process.env.SESSION_SECRET || 'interlinked-game-session-secret-key-2025',
    cookieSecure: process.env.NODE_ENV === 'production',
    dbPath: process.env.DB_PATH || 'database/interlinked.db',
    nodeEnv: process.env.NODE_ENV || 'development'
};
