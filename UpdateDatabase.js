const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const DB_PATH = path.join(__dirname, 'database', 'interlinked.db');
const BACKUP_DIR = path.join(__dirname, 'Data', 'Temp');
const MIGRATION_FILE = path.join(BACKUP_DIR, 'migration.json');

// Statistics
const stats = {
    exported: {
        Users: 0,
        Invites: 0,
        Mail: 0,
        Friends: 0,
        Conversations: 0,
        ConversationData: 0,
        ConversationReadStatus: 0
    },
    imported: {
        Users: 0,
        Invites: 0,
        Mail: 0,
        Friends: 0,
        Conversations: 0,
        ConversationData: 0,
        ConversationReadStatus: 0
    },
    failed: {
        Users: 0,
        Invites: 0,
        Mail: 0,
        Friends: 0,
        Conversations: 0,
        ConversationData: 0,
        ConversationReadStatus: 0
    }
};

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
 * @returns {boolean} True if the database exists
 */
function databaseExists() {
    return fs.existsSync(DB_PATH);
}

/**
 * Export all data from the database to a JSON file
 * @returns {Object} The exported data
 */
function exportData() {
    console.log('Starting data export...');
    const db = new Database(DB_PATH);
    
    const exportedData = {};
    const tables = ['Users', 'Invites', 'Mail', 'Friends', 'Conversations', 'ConversationData', 'ConversationReadStatus'];
    
    // Check which tables exist in the current database
    const existingTables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all().map(row => row.name);

    console.log(`Found tables: ${existingTables.join(', ')}`);
    
    // Export data from each existing table
    tables.forEach(table => {
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
            console.log(`Table ${table} does not exist in the current database, skipping...`);
            exportedData[table] = [];
        }
    });
    
    db.close();
    
    // Save the data to a JSON file
    fs.writeFileSync(MIGRATION_FILE, JSON.stringify(exportedData, null, 2));
    console.log(`Data exported to ${MIGRATION_FILE}`);
    
    return exportedData;
}

/**
 * Rebuild the database by running DatabaseSetup.js
 * @returns {Promise<void>}
 */
async function rebuildDatabase() {
    console.log('Rebuilding database...');
    
    try {
        const { stdout, stderr } = await execAsync('node DatabaseSetup.js');
        console.log('Database rebuild stdout:', stdout);
        if (stderr) {
            console.error('Database rebuild stderr:', stderr);
        }
        
        // Verify the database was created
        if (!databaseExists()) {
            throw new Error('Database was not created after running DatabaseSetup.js');
        }
        
        console.log('Database rebuilt successfully');
    } catch (error) {
        console.error('Failed to rebuild database:', error.message);
        throw error;
    }
}

/**
 * Import data from the JSON file to the database
 * @param {Object} data - The data to import
 */
function importData(data) {
    console.log('Starting data import...');
    const db = new Database(DB_PATH);
    
    // Import Users table
    if (data.Users && data.Users.length > 0) {
        const insertUser = db.prepare(`
            INSERT INTO Users (UserName, Password, Email, Avatar, Stars, Silver, Gold, Gems, Points, Level) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.Users.forEach(user => {
            try {
                insertUser.run(
                    user.UserName, 
                    user.Password, 
                    user.Email, 
                    user.Avatar || 'Colors/FillBlack',
                    user.Stars || 0,
                    user.Silver || 0,
                    user.Gold || 0,
                    user.Gems || 0,
                    user.Points || 0,
                    user.Level || 1
                );
                stats.imported.Users++;
            } catch (error) {
                console.error(`Failed to import user ${user.UserName}:`, error.message);
                stats.failed.Users++;
            }
        });
    }
    
    // Import Invites table
    if (data.Invites && data.Invites.length > 0) {
        const insertInvite = db.prepare(`
            INSERT INTO Invites (From, To) 
            VALUES (?, ?)
        `);
        
        data.Invites.forEach(invite => {
            try {
                insertInvite.run(invite.From, invite.To);
                stats.imported.Invites++;
            } catch (error) {
                console.error(`Failed to import invite:`, error.message);
                stats.failed.Invites++;
            }
        });
    }
    
    // Import Mail table
    if (data.Mail && data.Mail.length > 0) {
        const insertMail = db.prepare(`
            INSERT INTO Mail (SenderID, RecieverID, Title, Message, PackageContent) 
            VALUES (?, ?, ?, ?, ?)
        `);
        
        data.Mail.forEach(mail => {
            try {
                insertMail.run(
                    mail.SenderID,
                    mail.RecieverID,
                    mail.Title,
                    mail.Message,
                    mail.PackageContent ? JSON.stringify(mail.PackageContent) : null
                );
                stats.imported.Mail++;
            } catch (error) {
                console.error(`Failed to import mail:`, error.message);
                stats.failed.Mail++;
            }
        });
    }
    
    // Import Friends table
    if (data.Friends && data.Friends.length > 0) {
        const insertFriend = db.prepare(`
            INSERT INTO Friends (User1, User2) 
            VALUES (?, ?)
        `);
        
        data.Friends.forEach(friend => {
            try {
                insertFriend.run(friend.User1, friend.User2);
                stats.imported.Friends++;
            } catch (error) {
                console.error(`Failed to import friendship:`, error.message);
                stats.failed.Friends++;
            }
        });
    }
    
    // Import Conversations table
    if (data.Conversations && data.Conversations.length > 0) {
        const insertConversation = db.prepare(`
            INSERT INTO Conversations (Members, ConversationTitle, ConversationLogo) 
            VALUES (?, ?, ?)
        `);
        
        data.Conversations.forEach(conversation => {
            try {
                insertConversation.run(
                    conversation.Members,
                    conversation.ConversationTitle,
                    conversation.ConversationLogo
                );
                stats.imported.Conversations++;
            } catch (error) {
                console.error(`Failed to import conversation:`, error.message);
                stats.failed.Conversations++;
            }
        });
    }
    
    // Import ConversationData table
    if (data.ConversationData && data.ConversationData.length > 0) {
        const insertMessage = db.prepare(`
            INSERT INTO ConversationData (ConversationID, SenderID, Message, Attachment, Reactions, Reply, TimeStamp, DeletedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.ConversationData.forEach(message => {
            try {
                insertMessage.run(
                    message.ConversationID,
                    message.SenderID,
                    message.Message,
                    message.Attachment,
                    message.Reactions ? JSON.stringify(message.Reactions) : null,
                    message.Reply,
                    message.TimeStamp,
                    message.DeletedAt
                );
                stats.imported.ConversationData++;
            } catch (error) {
                console.error(`Failed to import message:`, error.message);
                stats.failed.ConversationData++;
            }
        });
    }
    
    // Import ConversationReadStatus table
    if (data.ConversationReadStatus && data.ConversationReadStatus.length > 0) {
        const insertReadStatus = db.prepare(`
            INSERT INTO ConversationReadStatus (ConversationID, UserID, LastReadMessageID, LastReadTimeStamp) 
            VALUES (?, ?, ?, ?)
        `);
        
        data.ConversationReadStatus.forEach(readStatus => {
            try {
                insertReadStatus.run(
                    readStatus.ConversationID,
                    readStatus.UserID,
                    readStatus.LastReadMessageID,
                    readStatus.LastReadTimeStamp
                );
                stats.imported.ConversationReadStatus++;
            } catch (error) {
                console.error(`Failed to import read status:`, error.message);
                stats.failed.ConversationReadStatus++;
            }
        });
    }
    
    db.close();
    console.log('Data import completed');
}

/**
 * Print statistics of the migration process
 */
function printStatistics() {
    console.log('\n=== Migration Statistics ===');
    
    const tables = ['Users', 'Invites', 'Mail', 'Friends', 'Conversations', 'ConversationData', 'ConversationReadStatus'];
    
    tables.forEach(table => {
        console.log(`\n${table}:`);
        console.log(`  - Exported: ${stats.exported[table]}`);
        console.log(`  - Imported: ${stats.imported[table]}`);
        console.log(`  - Failed:   ${stats.failed[table]}`);
        
        const success = stats.imported[table] === stats.exported[table];
        console.log(`  - Status:   ${success ? 'SUCCESS' : 'INCOMPLETE'}`);
    });
    
    console.log('\nTotal:');
    const totalExported = Object.values(stats.exported).reduce((sum, val) => sum + val, 0);
    const totalImported = Object.values(stats.imported).reduce((sum, val) => sum + val, 0);
    const totalFailed = Object.values(stats.failed).reduce((sum, val) => sum + val, 0);
    
    console.log(`  - Exported: ${totalExported}`);
    console.log(`  - Imported: ${totalImported}`);
    console.log(`  - Failed:   ${totalFailed}`);
    console.log(`  - Success Rate: ${totalExported > 0 ? ((totalImported / totalExported) * 100).toFixed(2) + '%' : 'N/A'}`);
}

/**
 * Main migration process
 */
async function migrate() {
    console.log('Starting database migration process...');
    
    try {
        // Step 1: Ensure backup directory exists
        ensureBackupDir();
        
        // Step 2: Check if database exists
        if (!databaseExists()) {
            console.log('Database does not exist. Running DatabaseSetup.js...');
            await rebuildDatabase();
            console.log('Migration completed (no data to migrate)');
            return;
        }
        
        // Step 3: Export data from the database
        const data = exportData();
        
        // Step 4: Rebuild the database
        await rebuildDatabase();
        
        // Step 5: Import data back into the database
        importData(data);
        
        // Step 6: Print statistics
        printStatistics();
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

// Run the migration
migrate();