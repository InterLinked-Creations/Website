/**
 * Database setup - creates all tables
 * Run this script to initialize a fresh database
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database configuration
const DB_DIR = path.resolve(__dirname, '../../database');
const DB_PATH = path.join(DB_DIR, 'interlinked.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Check if database exists and try to delete it
if (fs.existsSync(DB_PATH)) {
    try {
        fs.unlinkSync(DB_PATH);
        console.log('Existing database deleted successfully.');
    } catch (error) {
        if (error.code === 'EBUSY') {
            console.error('Database is currently in use by another process. Cannot rebuild.');
            process.exit(1);
        }
        throw error;
    }
}

// Create new database connection
const db = new Database(DB_PATH, { verbose: console.log });
const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'schema.json'), 'utf-8'));
// Execute table creation
try {
    for (const table of schema.tables) {
        const columnsDefinition = table.columns
            .map(col => `${col.name ? col.name + ' ' : ''}${col.type}`)
            .join(', ');
        const createTableSql = `CREATE TABLE IF NOT EXISTS ${table.name} (${columnsDefinition})`;
        db.exec(createTableSql);
        console.log(`${table.name} table created successfully.`);
    }
    console.log('\nDatabase setup completed successfully!');
} catch (error) {
    console.error('Error creating tables:', error);
    throw error;
} finally {
    db.close();
}
