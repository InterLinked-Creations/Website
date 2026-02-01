/**
 * Database Query Script
 * Run ad-hoc queries against the database
 * 
 * Usage: node scripts/dbQuery.js
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database configuration
const DB_PATH = path.resolve(__dirname, '../database/interlinked.db');
const DB_DIR = path.dirname(DB_PATH);

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Create database connection
const db = new Database(DB_PATH, { verbose: console.log });

// Run the query - modify this as needed
const DBQuery = `
    SELECT *
    FROM Users
`;

// Print the output of the query to the console
try {
    const rows = db.prepare(DBQuery).all();
    console.log('Query Results:', rows);
} catch (error) {
    console.error('Error running query:', error);
    throw error;
}

// Close the database connection
db.close();
console.log('Database query completed successfully.');
