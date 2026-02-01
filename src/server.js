/**
 * Server entry point
 * Creates HTTP/WebSocket server and starts listening
 */
const http = require('http');
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

// Handle graceful shutdown
function shutdown() {
    console.log('Shutting down server...');
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
