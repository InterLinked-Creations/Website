/**
 * Database connection singleton
 * Provides a single better-sqlite3 instance for the application
 */
const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let db = null;

/**
 * Connect to the SQLite database
 * @returns {Database} The database instance
 */
function connect() {
    if (db) return db;

    try {
        const dbPath = path.resolve(__dirname, '../../', config.dbPath);
        db = new Database(dbPath, {
            verbose: config.nodeEnv === 'development' ? console.log : null,
            fileMustExist: true
        });
        console.log('Successfully connected to the database');
        return db;
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
}

/**
 * Get the current database instance
 * @returns {Database|null} The database instance or null
 */
function getDb() {
    return db;
}

/**
 * Close the database connection gracefully
 */
function close() {
    if (db) {
        console.log('Closing database connection...');
        db.close();
        db = null;
    }
}

module.exports = {
    connect,
    getDb,
    close
};
