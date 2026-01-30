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

// Table definitions
const tables = {
    Users: `
        CREATE TABLE Users (
            UserID INTEGER PRIMARY KEY AUTOINCREMENT,
            UserName VARCHAR(50) NOT NULL,
            Password VARCHAR(80) NOT NULL,
            Email VARCHAR(100) NOT NULL,
            Avatar VARCHAR(100) DEFAULT 'Colors/FillBlack',
            Stars BIGINT NOT NULL DEFAULT 0,
            Silver BIGINT NOT NULL DEFAULT 0,
            Gold BIGINT NOT NULL DEFAULT 0,
            Gems BIGINT NOT NULL DEFAULT 0,
            Points BIGINT NOT NULL DEFAULT 0,
            Level BIGINT NOT NULL DEFAULT 1
        )
    `,
    Invites: `
        CREATE TABLE Invites (
            InviteID INTEGER PRIMARY KEY AUTOINCREMENT,
            FromUser INTEGER NOT NULL,
            ToUser INTEGER NOT NULL,
            FOREIGN KEY (FromUser) REFERENCES Users(UserID),
            FOREIGN KEY (ToUser) REFERENCES Users(UserID)
        )
    `,
    Mail: `
        CREATE TABLE Mail (
            MailID INTEGER PRIMARY KEY AUTOINCREMENT,
            SenderID DECIMAL NOT NULL,
            RecieverID INTEGER NOT NULL,
            Title VARCHAR(150) NOT NULL,
            Message VARCHAR(10000) NOT NULL,
            PackageContent JSON,
            FOREIGN KEY (RecieverID) REFERENCES Users(UserID)
        )
    `,
    Friends: `
        CREATE TABLE Friends (
            FriendshipID INTEGER PRIMARY KEY AUTOINCREMENT,
            User1 INTEGER NOT NULL,
            User2 INTEGER NOT NULL,
            FOREIGN KEY (User1) REFERENCES Users(UserID),
            FOREIGN KEY (User2) REFERENCES Users(UserID)
        )
    `,
    Conversations: `
        CREATE TABLE Conversations (
            ConversationID INTEGER PRIMARY KEY AUTOINCREMENT,
            Members TEXT NOT NULL,
            ConversationTitle VARCHAR(100) DEFAULT NULL,
            ConversationLogo VARCHAR(255) DEFAULT NULL
        )
    `,
    ConversationData: `
        CREATE TABLE ConversationData (
            MessageID INTEGER PRIMARY KEY AUTOINCREMENT,
            ConversationID INTEGER NOT NULL,
            SenderID INTEGER NOT NULL,
            Message TEXT NOT NULL,
            Attachment VARCHAR(1000) DEFAULT NULL,
            Reactions JSON DEFAULT NULL,
            Reply INTEGER DEFAULT NULL,
            TimeStamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            DeletedAt DATETIME DEFAULT NULL,
            FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID),
            FOREIGN KEY (SenderID) REFERENCES Users(UserID),
            FOREIGN KEY (Reply) REFERENCES ConversationData(MessageID)
        )
    `,
    ConversationReadStatus: `
        CREATE TABLE ConversationReadStatus (
            ReadStatusID INTEGER PRIMARY KEY AUTOINCREMENT,
            ConversationID INTEGER NOT NULL,
            UserID INTEGER NOT NULL,
            LastReadMessageID INTEGER,
            LastReadTimeStamp DATETIME,
            FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID),
            FOREIGN KEY (UserID) REFERENCES Users(UserID),
            FOREIGN KEY (LastReadMessageID) REFERENCES ConversationData(MessageID),
            UNIQUE(ConversationID, UserID)
        )
    `
};

// Execute table creation
try {
    for (const [tableName, sql] of Object.entries(tables)) {
        db.exec(sql);
        console.log(`${tableName} table created successfully.`);
    }
    console.log('\nDatabase setup completed successfully!');
} catch (error) {
    console.error('Error creating tables:', error);
    throw error;
} finally {
    db.close();
}
