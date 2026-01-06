const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database configuration
const DB_PATH = path.join(__dirname, 'database', 'interlinked.db');
const DB_DIR = path.join(__dirname, 'database');

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

// Create Users table
const createUsersTable = `
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
`;

// Create Invites table for friend invites
const createInvitesTable = `
    CREATE TABLE Invites (
        InviteID INTEGER PRIMARY KEY AUTOINCREMENT,
        FromUser INTEGER NOT NULL,
        ToUser INTEGER NOT NULL,
        FOREIGN KEY (FromUser) REFERENCES Users(UserID),
        FOREIGN KEY (ToUser) REFERENCES Users(UserID)
    )
`;

// Create Mail table for messages/packages
const createMailTable = `
    CREATE TABLE Mail (
        MailID INTEGER PRIMARY KEY AUTOINCREMENT,
        SenderID DECIMAL NOT NULL,
        RecieverID INTEGER NOT NULL,
        Title VARCHAR(150) NOT NULL,
        Message VARCHAR(10000) NOT NULL,
        PackageContent JSON,
        FOREIGN KEY (RecieverID) REFERENCES Users(UserID)
    )
`;

// Create Friends table
const createFriendsTable = `
    CREATE TABLE Friends (
        FriendshipID INTEGER PRIMARY KEY AUTOINCREMENT,
        User1 INTEGER NOT NULL,
        User2 INTEGER NOT NULL,
        FOREIGN KEY (User1) REFERENCES Users(UserID),
        FOREIGN KEY (User2) REFERENCES Users(UserID)
    )
`;

// Create Conversations table
const createConversationsTable = `
    CREATE TABLE Conversations (
        ConversationID INTEGER PRIMARY KEY AUTOINCREMENT,
        Members TEXT NOT NULL,
        ConversationTitle VARCHAR(100) DEFAULT NULL,
        ConversationLogo VARCHAR(255) DEFAULT NULL
    )
`;

// Create ConversationData table for chat messages
const createConversationDataTable = `
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
`;

// Create ConversationReadStatus table to track when each user last read messages
const createConversationReadStatusTable = `
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
`;

// Execute table creation
try {
    db.exec(createUsersTable);
    console.log('Users table created successfully.');
    
    db.exec(createInvitesTable);
    console.log('Invites table created successfully.');
    
    db.exec(createMailTable);
    console.log('Mail table created successfully.');
    
    db.exec(createFriendsTable);
    console.log('Friends table created successfully.');
    
    db.exec(createConversationsTable);
    console.log('Conversations table created successfully.');
    
    db.exec(createConversationDataTable);
    console.log('ConversationData table created successfully.');
    
    db.exec(createConversationReadStatusTable);
    console.log('ConversationReadStatus table created successfully.');
} catch (error) {
    console.error('Error creating tables:', error);
    throw error;
}

// Close the database connection
db.close();
console.log('Database setup completed successfully.');
