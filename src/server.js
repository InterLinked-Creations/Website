/**
 * Server entry point
 * Creates HTTP/WebSocket server and starts listening
 */
const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const app = require('./app');
const config = require('./config');
const dbConnection = require('./db/connection');
const websocket = require('./websocket');

// Connect to database
dbConnection.connect();

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = websocket.initialize(server);

// Run the game update script
const gameUpdateScript = path.resolve(__dirname, '../scripts/gameUpdate.js');

function runGameUpdate() {
    execFile(process.execPath, [gameUpdateScript], (error, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        if (error) {
            console.error('Game update failed:', error.message);
        }
    });
}

// Run game update on startup and then every 1 minute
runGameUpdate();
const gameUpdateInterval = setInterval(runGameUpdate, 60 * 1000);

// Handle graceful shutdown
function shutdown() {
    console.log('Shutting down server...');
    clearInterval(gameUpdateInterval);
    dbConnection.close();
    websocket.closeAll(wss);

    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
server.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
});
