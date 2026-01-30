/**
 * Database Update/Migration Script
 * Exports data, rebuilds database, and imports data back
 * 
 * Usage: node scripts/dbUpdate.js
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const DB_PATH = path.resolve(__dirname, '../database/interlinked.db');
const BACKUP_DIR = path.resolve(__dirname, '../Data/Temp');
const MIGRATION_FILE = path.join(BACKUP_DIR, 'migration.json');

// Statistics
const stats = {
    exported: {},
    imported: {},
    failed: {}
};

const TABLES = ['Users', 'Invites', 'Mail', 'Friends', 'Conversations', 'ConversationData', 'ConversationReadStatus'];

// Initialize stats
TABLES.forEach(table => {
    stats.exported[table] = 0;
    stats.imported[table] = 0;
    stats.failed[table] = 0;
});

/**
 * Ensures the backup directory exists
 */
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`Created backup directory: ${BACKUP_DIR}`);
    }
}

/**
 * Checks if the database exists
 */
function databaseExists() {
    return fs.existsSync(DB_PATH);
}

/**
 * Export all data from the database to a JSON file
 */
function exportData() {
    console.log('Starting data export...');
    const db = new Database(DB_PATH);

    const exportedData = {};

    // Check which tables exist
    const existingTables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all().map(row => row.name);

    console.log(`Found tables: ${existingTables.join(', ')}`);

    // Export data from each existing table
    TABLES.forEach(table => {
        if (existingTables.includes(table)) {
            try {
                const rows = db.prepare(`SELECT * FROM ${table}`).all();
                exportedData[table] = rows;
                stats.exported[table] = rows.length;
                console.log(`Exported ${rows.length} rows from ${table}`);
            } catch (error) {
                console.error(`Error exporting table ${table}:`, error.message);
                exportedData[table] = [];
            }
        } else {
            console.log(`Table ${table} does not exist, skipping...`);
            exportedData[table] = [];
        }
    });

    db.close();

    // Save to JSON file
    fs.writeFileSync(MIGRATION_FILE, JSON.stringify(exportedData, null, 2));
    console.log(`Data exported to ${MIGRATION_FILE}`);

    return exportedData;
}

/**
 * Rebuild the database
 */
async function rebuildDatabase() {
    console.log('Rebuilding database...');

    try {
        const setupScript = path.resolve(__dirname, './dbSetup.js');
        const { stdout, stderr } = await execAsync(`node "${setupScript}"`);
        console.log('Database rebuild stdout:', stdout);
        if (stderr) {
            console.error('Database rebuild stderr:', stderr);
        }

        if (!databaseExists()) {
            throw new Error('Database was not created after running setup');
        }

        console.log('Database rebuilt successfully');
    } catch (error) {
        console.error('Failed to rebuild database:', error.message);
        throw error;
    }
}

/**
 * Import data from the JSON file
 */
function importData(data) {
    console.log('Starting data import...');
    const db = new Database(DB_PATH);

    // Import Users
    if (data.Users && data.Users.length > 0) {
        const insertUser = db.prepare(`
            INSERT INTO Users (UserName, Password, Email, Avatar, Stars, Silver, Gold, Gems, Points, Level) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        data.Users.forEach(user => {
            try {
                insertUser.run(
                    user.UserName, user.Password, user.Email, user.Avatar,
                    user.Stars || 0, user.Silver || 0, user.Gold || 0,
                    user.Gems || 0, user.Points || 0, user.Level || 1
                );
                stats.imported.Users++;
            } catch (error) {
                console.error(`Failed to import user ${user.UserName}:`, error.message);
                stats.failed.Users++;
            }
        });
        console.log(`Imported ${stats.imported.Users} users`);
    }

    // Import Friends
    if (data.Friends && data.Friends.length > 0) {
        const insertFriend = db.prepare(`
            INSERT INTO Friends (User1, User2) VALUES (?, ?)
        `);

        data.Friends.forEach(friendship => {
            try {
                insertFriend.run(friendship.User1, friendship.User2);
                stats.imported.Friends++;
            } catch (error) {
                console.error(`Failed to import friendship:`, error.message);
                stats.failed.Friends++;
            }
        });
        console.log(`Imported ${stats.imported.Friends} friendships`);
    }

    // Import Invites
    if (data.Invites && data.Invites.length > 0) {
        const insertInvite = db.prepare(`
            INSERT INTO Invites (FromUser, ToUser) VALUES (?, ?)
        `);

        data.Invites.forEach(invite => {
            try {
                insertInvite.run(invite.FromUser, invite.ToUser);
                stats.imported.Invites++;
            } catch (error) {
                console.error(`Failed to import invite:`, error.message);
                stats.failed.Invites++;
            }
        });
        console.log(`Imported ${stats.imported.Invites} invites`);
    }

    // Import Conversations
    if (data.Conversations && data.Conversations.length > 0) {
        const insertConversation = db.prepare(`
            INSERT INTO Conversations (Members, ConversationTitle, ConversationLogo) VALUES (?, ?, ?)
        `);

        data.Conversations.forEach(conv => {
            try {
                insertConversation.run(conv.Members, conv.ConversationTitle, conv.ConversationLogo);
                stats.imported.Conversations++;
            } catch (error) {
                console.error(`Failed to import conversation:`, error.message);
                stats.failed.Conversations++;
            }
        });
        console.log(`Imported ${stats.imported.Conversations} conversations`);
    }

    // Import ConversationData
    if (data.ConversationData && data.ConversationData.length > 0) {
        const insertMessage = db.prepare(`
            INSERT INTO ConversationData (ConversationID, SenderID, Message, Attachment, Reactions, Reply, TimeStamp, DeletedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        data.ConversationData.forEach(msg => {
            try {
                insertMessage.run(
                    msg.ConversationID, msg.SenderID, msg.Message,
                    msg.Attachment, msg.Reactions, msg.Reply,
                    msg.TimeStamp, msg.DeletedAt
                );
                stats.imported.ConversationData++;
            } catch (error) {
                console.error(`Failed to import message:`, error.message);
                stats.failed.ConversationData++;
            }
        });
        console.log(`Imported ${stats.imported.ConversationData} messages`);
    }

    // Import ConversationReadStatus
    if (data.ConversationReadStatus && data.ConversationReadStatus.length > 0) {
        const insertReadStatus = db.prepare(`
            INSERT INTO ConversationReadStatus (ConversationID, UserID, LastReadMessageID, LastReadTimeStamp)
            VALUES (?, ?, ?, ?)
        `);

        data.ConversationReadStatus.forEach(status => {
            try {
                insertReadStatus.run(
                    status.ConversationID, status.UserID,
                    status.LastReadMessageID, status.LastReadTimeStamp
                );
                stats.imported.ConversationReadStatus++;
            } catch (error) {
                console.error(`Failed to import read status:`, error.message);
                stats.failed.ConversationReadStatus++;
            }
        });
        console.log(`Imported ${stats.imported.ConversationReadStatus} read statuses`);
    }

    db.close();
    console.log('\nImport complete!');
    console.log('Statistics:', JSON.stringify(stats, null, 2));
}

/**
 * Main migration function
 */
async function main() {
    try {
        ensureBackupDir();

        if (!databaseExists()) {
            console.log('No existing database found. Creating fresh database...');
            await rebuildDatabase();
            return;
        }

        // Export existing data
        const data = exportData();

        // Rebuild database
        await rebuildDatabase();

        // Import data back
        importData(data);

        console.log('\nMigration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main();
