const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const fs = require('fs');
const session = require('express-session');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Session configuration
app.use(session({
    secret: 'interlinked-game-session-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true when using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database connection
let db = null;

// Connect to database
function connectToDatabase() {
    try {
        db = new Database(path.join(__dirname, 'database', 'interlinked.db'), {
            verbose: console.log,
            fileMustExist: true
        });
        console.log('Successfully connected to the database');
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
}

// Close database connection gracefully
function closeDatabaseConnection() {
    if (db) {
        console.log('Closing database connection...');
        db.close();
        db = null;
    }
}

// Connect to database when starting server
connectToDatabase();

// Create HTTP server
const server = http.createServer(app);

// Set up WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected WebSocket clients
const clients = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');
    
    // Handle messages from client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Handle authentication message - link socket to user
            if (data.type === 'authenticate' && data.userId) {
                // Store this connection with the user ID
                clients.set(data.userId, ws);
                ws.userId = data.userId;
                console.log(`User ${data.userId} authenticated on WebSocket`);
                
                // Send online status update for this user to all clients
                broadcastUserStatus(data.userId, 'online');
                
                // Send this user the status of all their friends
                sendFriendStatusUpdates(data.userId);
            }
            
            // Handle chat message sending
            else if (data.type === 'message_send' && ws.userId) {
                handleChatMessage(ws.userId, data);
            }
            
            // Handle typing indicators
            else if (data.type === 'typing_start' && ws.userId) {
                handleTypingIndicator(ws.userId, data, true);
            }
            else if (data.type === 'typing_stop' && ws.userId) {
                handleTypingIndicator(ws.userId, data, false);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        if (ws.userId) {
            // Remove from clients map
            clients.delete(ws.userId);
            // Broadcast offline status
            broadcastUserStatus(ws.userId, 'offline');
            console.log(`User ${ws.userId} disconnected from WebSocket`);
        }
    });
});

// Function to broadcast a user's status to their friends
function broadcastUserStatus(userId, status) {
    // Find all friends of this user
    const friends = db.prepare(`
        SELECT 
            CASE 
                WHEN f.User1 = ? THEN f.User2 
                ELSE f.User1 
            END as FriendID
        FROM Friends f
        WHERE f.User1 = ? OR f.User2 = ?
    `).all(userId, userId, userId);
    
    // Get user info
    const user = db.prepare('SELECT UserName, Avatar FROM Users WHERE UserID = ?').get(userId);
    if (!user) return;
    
    const statusUpdate = {
        type: 'status_update',
        user: {
            id: userId,
            username: user.UserName,
            avatar: user.Avatar,
            status: status
        }
    };
    
    // Send status update to each friend who is connected
    friends.forEach(friend => {
        const friendWs = clients.get(friend.FriendID);
        if (friendWs && friendWs.readyState === WebSocket.OPEN) {
            friendWs.send(JSON.stringify(statusUpdate));
        }
    });
}

// Function to send status updates of all friends to a specific user
function sendFriendStatusUpdates(userId) {
    // Find all friends of this user
    const friends = db.prepare(`
        SELECT 
            u.UserID, u.UserName, u.Avatar,
            CASE 
                WHEN f.User1 = ? THEN f.User2 
                ELSE f.User1 
            END as FriendID
        FROM Friends f
        JOIN Users u ON (f.User1 = u.UserID OR f.User2 = u.UserID)
        WHERE (f.User1 = ? OR f.User2 = ?) AND u.UserID != ?
    `).all(userId, userId, userId, userId);
    
    // Get the WebSocket for this user
    const ws = clients.get(userId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    // Send status for each friend
    friends.forEach(friend => {
        const isOnline = clients.has(friend.UserID);
        const statusUpdate = {
            type: 'status_update',
            user: {
                id: friend.UserID,
                username: friend.UserName,
                avatar: friend.Avatar,
                status: isOnline ? 'online' : 'offline'
            }
        };
        ws.send(JSON.stringify(statusUpdate));
    });
}

// Handle chat message via WebSocket
function handleChatMessage(senderId, data) {
    try {
        const { conversationId, message, attachment, reply } = data;
        
        if (!conversationId || !message || message.trim().length === 0) {
            return;
        }
        
        // Verify user is a member of this conversation
        const conversation = db.prepare(`
            SELECT Members FROM Conversations WHERE ConversationID = ?
        `).get(conversationId);
        
        if (!conversation) {
            return;
        }
        
        const memberIds = JSON.parse(conversation.Members);
        if (!memberIds.includes(senderId)) {
            return;
        }
        
        // Insert the message into database
        const insertMessage = db.prepare(`
            INSERT INTO ConversationData (ConversationID, SenderID, Message, Attachment, Reply)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const result = insertMessage.run(
            conversationId, 
            senderId, 
            message.trim(), 
            attachment || null, 
            reply || null
        );
        
        if (result.changes > 0) {
            // Get the created message with sender info
            const newMessage = db.prepare(`
                SELECT cd.MessageID, cd.ConversationID, cd.SenderID, cd.Message, 
                       cd.Attachment, cd.Reactions, cd.Reply, cd.TimeStamp,
                       u.UserName, u.Avatar
                FROM ConversationData cd
                JOIN Users u ON cd.SenderID = u.UserID
                WHERE cd.MessageID = ?
            `).get(result.lastInsertRowid);
            
            // Broadcast the message to all conversation members
            const messageData = {
                type: 'message_received',
                message: newMessage
            };
            
            memberIds.forEach(memberId => {
                const memberWs = clients.get(memberId);
                if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                    memberWs.send(JSON.stringify(messageData));
                }
            });
        }
    } catch (error) {
        console.error('Error handling chat message:', error);
    }
}

// Handle typing indicators
function handleTypingIndicator(senderId, data, isTyping) {
    try {
        const { conversationId } = data;
        
        if (!conversationId) {
            return;
        }
        
        // Verify user is a member of this conversation
        const conversation = db.prepare(`
            SELECT Members FROM Conversations WHERE ConversationID = ?
        `).get(conversationId);
        
        if (!conversation) {
            return;
        }
        
        const memberIds = JSON.parse(conversation.Members);
        if (!memberIds.includes(senderId)) {
            return;
        }
        
        // Get sender info
        const sender = db.prepare(`
            SELECT UserName, Avatar FROM Users WHERE UserID = ?
        `).get(senderId);
        
        if (!sender) {
            return;
        }
        
        // Broadcast typing indicator to all other conversation members
        const typingData = {
            type: isTyping ? 'typing_start' : 'typing_stop',
            conversationId: conversationId,
            user: {
                id: senderId,
                username: sender.UserName,
                avatar: sender.Avatar
            }
        };
        
        memberIds.forEach(memberId => {
            // Don't send typing indicator back to the sender
            if (memberId !== senderId) {
                const memberWs = clients.get(memberId);
                if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                    memberWs.send(JSON.stringify(typingData));
                }
            }
        });
    } catch (error) {
        console.error('Error handling typing indicator:', error);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    closeDatabaseConnection();
    
    // Close all WebSocket connections
    wss.clients.forEach(client => {
        client.close();
    });
    
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    closeDatabaseConnection();
    
    // Close all WebSocket connections
    wss.clients.forEach(client => {
        client.close();
    });
    
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Make database available in requests
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Helper function to check friendship count (replaced placeholder function)
function getFriendCount(userId) {
    if (!userId) return 0;
    
    try {
        // Check how many friends the user has
        const friendCount = db.prepare('SELECT COUNT(*) as count FROM Friends WHERE User1 = ? OR User2 = ?').get(userId, userId);
        return friendCount.count;
    } catch (error) {
        console.error('Error checking friend count:', error);
        return 0;
    }
}

// Serve static files from the Interlinked directory
app.use(express.static(path.join(__dirname, 'Interlinked')));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Interlinked', 'index.html'));
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;
        const errors = [];

        // Validate password match
        if (password !== confirmPassword) {
            errors.push('Passwords do not match');
        }

        // Check if username exists
        const existingUsername = req.db.prepare('SELECT 1 FROM Users WHERE UserName = ?').get(username);
        if (existingUsername) {
            errors.push('Username is already taken');
        }

        // Check if email exists
        const existingEmail = req.db.prepare('SELECT 1 FROM Users WHERE Email = ?').get(email);
        if (existingEmail) {
            errors.push('Email is already registered');
        }

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const insertUser = req.db.prepare(`
            INSERT INTO Users (UserName, Email, Password, Avatar)
            VALUES (?, ?, ?, ?)
        `);

        const result = insertUser.run(username, email, hashedPassword, 'lib/avatars/Colors/FillBlack.png');
        
        res.json({
            success: true,
            userId: result.lastInsertRowid,
            username,
            avatar: 'lib/avatars/Colors/FillBlack.png'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ errors: ['An unexpected error occurred'] });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user by username or email
        const user = req.db.prepare(`
            SELECT UserID, UserName, Password, Avatar 
            FROM Users 
            WHERE UserName = ? OR Email = ?
        `).get(username, username);

        if (!user) {
            return res.status(400).json({ errors: ['Invalid username/email or password'] });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.Password);
        if (!validPassword) {
            return res.status(400).json({ errors: ['Invalid username/email or password'] });
        }

        // Don't create session yet - wait for confirmation
        res.json({
            success: true,
            userId: user.UserID,
            username: user.UserName,
            avatar: user.Avatar
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ errors: ['An unexpected error occurred'] });
    }
});

// Confirm login endpoint (creates the actual session)
app.post('/api/confirm-login', (req, res) => {
    try {
        const { userId } = req.body;
        
        // Verify user exists
        const user = req.db.prepare(`
            SELECT UserID, UserName, Avatar 
            FROM Users 
            WHERE UserID = ?
        `).get(userId);

        if (!user) {
            return res.status(400).json({ errors: ['User not found'] });
        }

        // Create session
        req.session.userId = user.UserID;
        req.session.username = user.UserName;
        req.session.avatar = user.Avatar;
        
        // Log the number of friends (for information only)
        const friendCount = getFriendCount(user.UserID);
        console.log(`User ${user.UserName} has ${friendCount} friends`);

        res.json({
            success: true,
            userId: user.UserID,
            username: user.UserName,
            avatar: user.Avatar
        });
    } catch (error) {
        console.error('Login confirmation error:', error);
        res.status(500).json({ errors: ['Failed to confirm login'] });
    }
});

// Update avatar endpoint
app.post('/api/update-avatar', (req, res) => {
    try {
        const { userId, avatar } = req.body;
        
        const updateAvatar = req.db.prepare('UPDATE Users SET Avatar = ? WHERE UserID = ?');
        updateAvatar.run(avatar, userId);
        
        res.json({ success: true, avatar });
    } catch (error) {
        console.error('Avatar update error:', error);
        res.status(500).json({ errors: ['Failed to update avatar'] });
    }
});

// Get available avatars endpoint
app.get('/api/avatars', (req, res) => {
    try {
        const avatarsDir = path.join(__dirname, 'Interlinked', 'app', 'lib', 'avatars', 'Colors');
        const filesColors = fs.readdirSync(avatarsDir);
        const avatarsColors = filesColors.map(file => `lib/avatars/Colors/${file}`);
        
        res.json({ avatars: avatarsColors });
    } catch (error) {
        console.error('Error getting avatars:', error);
        res.status(500).json({ errors: ['Failed to get avatars'] });
    }
});

// Check session endpoint
app.get('/api/check-session', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ authenticated: false });
        }

        // Verify user still exists in database
        const user = req.db.prepare(`
            SELECT UserID, UserName, Avatar 
            FROM Users 
            WHERE UserID = ?
        `).get(req.session.userId);

        if (!user) {
            // User no longer exists, destroy session
            req.session.destroy();
            return res.json({ authenticated: false });
        }

        // Update session with current user data
        req.session.username = user.UserName;
        req.session.avatar = user.Avatar;

        res.json({
            authenticated: true,
            userId: user.UserID,
            username: user.UserName,
            avatar: user.Avatar
        });
    } catch (error) {
        console.error('Session check error:', error);
        res.status(500).json({ errors: ['Failed to check session'] });
    }
});

// Get current user endpoint for WebSocket authentication
app.get('/api/current-user', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ authenticated: false });
        }
        
        res.json({
            userId: req.session.userId,
            username: req.session.username,
            avatar: req.session.avatar
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to get current user' });
    }
});

// Get user by ID
app.get('/api/users/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        const user = req.db.prepare(`
            SELECT UserID, UserName, Avatar FROM Users WHERE UserID = ?
        `).get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user.UserID,
                username: user.UserName,
                avatar: user.Avatar
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user'
        });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({ errors: ['Failed to logout'] });
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ errors: ['Failed to logout'] });
    }
});

// Check friend request status endpoint
app.post('/api/check-friend-request', (req, res) => {
    try {
        const { targetUsername } = req.body;
        
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Find the target user by username, include their avatar
        const targetUser = req.db.prepare('SELECT UserID, UserName, Avatar FROM Users WHERE UserName = ?').get(targetUsername);
        
        if (!targetUser) {
            return res.status(404).json({ status: 'not_found', message: 'User not found' });
        }

        // Check if they're already friends
        const existingFriendship = req.db.prepare(`
            SELECT 1 FROM Friends 
            WHERE (User1 = ? AND User2 = ?) OR (User1 = ? AND User2 = ?)
        `).get(req.session.userId, targetUser.UserID, targetUser.UserID, req.session.userId);

        if (existingFriendship) {
            return res.json({ 
                status: 'already_friends', 
                message: 'You are already friends with this user',
                targetUser: {
                    id: targetUser.UserID,
                    username: targetUser.UserName,
                    avatar: targetUser.Avatar
                }
            });
        }

        // Check if there's a pending invite from current user to target
        const pendingSentInvite = req.db.prepare(`
            SELECT 1 FROM Invites 
            WHERE FromUser = ? AND ToUser = ?
        `).get(req.session.userId, targetUser.UserID);

        if (pendingSentInvite) {
            return res.json({ 
                status: 'invite_already_sent', 
                message: 'You already sent a friend request to this user',
                targetUser: {
                    id: targetUser.UserID,
                    username: targetUser.UserName,
                    avatar: targetUser.Avatar
                }
            });
        }

        // Check if there's a pending invite from target to current user
        const pendingReceivedInvite = req.db.prepare(`
            SELECT 1 FROM Invites 
            WHERE FromUser = ? AND ToUser = ?
        `).get(targetUser.UserID, req.session.userId);

        if (pendingReceivedInvite) {
            return res.json({ 
                status: 'invite_already_received', 
                message: 'This user has already sent you a friend request',
                targetUser: {
                    id: targetUser.UserID,
                    username: targetUser.UserName,
                    avatar: targetUser.Avatar
                }
            });
        }

        // No existing relationship
        res.json({ 
            status: 'can_send_request', 
            message: 'You can send a friend request to this user',
            targetUser: {
                id: targetUser.UserID,
                username: targetUser.UserName,
                avatar: targetUser.Avatar
            }
        });
    } catch (error) {
        console.error('Friend request check error:', error);
        res.status(500).json({ error: 'Failed to check friend request status' });
    }
});

// Send friend request endpoint
app.post('/api/send-friend-request', (req, res) => {
    try {
        const { targetUserId } = req.body;
        
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        // Insert the friend request
        const insertInvite = req.db.prepare(`
            INSERT INTO Invites (FromUser, ToUser)
            VALUES (?, ?)
        `);
        
        const result = insertInvite.run(req.session.userId, targetUserId);
        
        if (result.changes > 0) {
            res.json({ success: true, message: 'Friend request sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send friend request' });
        }
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

// Get pending friend requests endpoint
app.get('/api/friend-requests', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        // Get all pending invites sent to the current user
        const pendingInvites = req.db.prepare(`
            SELECT i.InviteID, i.FromUser, u.UserName, u.Avatar
            FROM Invites i
            JOIN Users u ON i.FromUser = u.UserID
            WHERE i.ToUser = ?
        `).all(req.session.userId);
        
        res.json({ 
            success: true, 
            invites: pendingInvites,
            count: pendingInvites.length
        });
    } catch (error) {
        console.error('Get friend requests error:', error);
        res.status(500).json({ error: 'Failed to retrieve friend requests' });
    }
});

// Accept friend request endpoint
app.post('/api/friend-requests/accept', (req, res) => {
    try {
        const { inviteId } = req.body;
        
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        // Start a transaction
        const transaction = req.db.transaction(() => {
            // Get the invite to verify it belongs to the current user
            const invite = req.db.prepare(`
                SELECT InviteID, FromUser, ToUser 
                FROM Invites 
                WHERE InviteID = ? AND ToUser = ?
            `).get(inviteId, req.session.userId);
            
            if (!invite) {
                throw new Error('Invalid invite or not authorized');
            }
            
            // Add both users as friends
            const addFriends = req.db.prepare(`
                INSERT INTO Friends (User1, User2) 
                VALUES (?, ?)
            `);
            addFriends.run(invite.FromUser, invite.ToUser);
            
            // Delete the invite
            const deleteInvite = req.db.prepare('DELETE FROM Invites WHERE InviteID = ?');
            deleteInvite.run(inviteId);
            
            // Get the friend's info for the response
            const friend = req.db.prepare(`
                SELECT UserID, UserName, Avatar 
                FROM Users 
                WHERE UserID = ?
            `).get(invite.FromUser);
            
            return {
                success: true,
                message: 'Friend request accepted',
                friend: {
                    id: friend.UserID,
                    username: friend.UserName,
                    avatar: friend.Avatar
                }
            };
        });
        
        // Execute the transaction and send the response
        const result = transaction();
        res.json(result);
        
    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to accept friend request' 
        });
    }
});

// Decline friend request endpoint
// Get user's friends
app.get('/api/friends', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        // Get all friends of the current user
        // Since friendship is bidirectional, we need to check both User1 and User2 columns
        const friends = req.db.prepare(`
            SELECT u.UserID, u.UserName, u.Avatar,
                   'offline' as Status,  -- Placeholder: In a real app, this would be determined from session data
                   NULL as LastSeen,    -- Placeholder: In a real app, this would come from a sessions table
                   NULL as CurrentGame, -- Placeholder: In a real app, this would come from user activity
                   NULL as LastGame     -- Placeholder: In a real app, this would come from user activity history
            FROM Friends f
            JOIN Users u ON (f.User1 = u.UserID OR f.User2 = u.UserID)
            WHERE (f.User1 = ? AND u.UserID != ?) OR (f.User2 = ? AND u.UserID != ?)
        `).all(req.session.userId, req.session.userId, req.session.userId, req.session.userId);
        
        res.json({ 
            success: true, 
            friends: friends
        });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Failed to retrieve friends' });
    }
});

app.post('/api/friend-requests/decline', (req, res) => {
    try {
        const { inviteId } = req.body;
        
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        // Verify the invite belongs to the current user
        const invite = req.db.prepare(`
            SELECT 1 FROM Invites WHERE InviteID = ? AND ToUser = ?
        `).get(inviteId, req.session.userId);
        
        if (!invite) {
            return res.status(403).json({ 
                success: false,
                error: 'Invalid invite or not authorized' 
            });
        }
        
        // Delete the invite
        const deleteInvite = req.db.prepare('DELETE FROM Invites WHERE InviteID = ?');
        const result = deleteInvite.run(inviteId);
        
        if (result.changes > 0) {
            res.json({ 
                success: true, 
                message: 'Friend request declined' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to decline friend request' 
            });
        }
    } catch (error) {
        console.error('Decline friend request error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to decline friend request' 
        });
    }
});

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    // Add database connection to request for convenience
    req.db = db;
    next();
}

// Get user conversations
app.get('/api/conversations', requireAuth, (req, res) => {
    try {
        // Get all conversations and filter by membership in JavaScript for proper JSON parsing
        const allConversations = req.db.prepare(`
            SELECT c.ConversationID, c.ConversationTitle, c.ConversationLogo, c.Members
            FROM Conversations c
            ORDER BY c.ConversationID DESC
        `).all();
        
        // Filter conversations where user is a member
        const userConversations = allConversations.filter(conv => {
            try {
                const memberIds = JSON.parse(conv.Members);
                return memberIds.includes(req.session.userId);
            } catch (error) {
                console.error('Error parsing conversation members:', error);
                return false;
            }
        });

        // Parse members and get user info for each conversation
        const conversationsWithInfo = userConversations.map(conv => {
            const memberIds = JSON.parse(conv.Members);
            
            // Get member information
            const membersInfo = memberIds.map(memberId => {
                const user = req.db.prepare(`
                    SELECT UserID, UserName, Avatar
                    FROM Users
                    WHERE UserID = ?
                `).get(memberId);
                return user;
            }).filter(user => user !== undefined);

            // Get last message
            const lastMessage = req.db.prepare(`
                SELECT cd.Message, cd.TimeStamp, u.UserName
                FROM ConversationData cd
                JOIN Users u ON cd.SenderID = u.UserID
                WHERE cd.ConversationID = ? AND cd.DeletedAt IS NULL
                ORDER BY cd.TimeStamp DESC
                LIMIT 1
            `).get(conv.ConversationID);

            return {
                ...conv,
                Members: membersInfo,
                LastMessage: lastMessage
            };
        });

        res.json({
            success: true,
            conversations: conversationsWithInfo
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get conversations'
        });
    }
});

// Create new conversation
app.post('/api/conversations', requireAuth, (req, res) => {
    try {
        const { memberIds, conversationTitle, conversationLogo } = req.body;
        
        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one member is required'
            });
        }

        // Add current user to members if not already included
        const allMembers = [...new Set([req.session.userId, ...memberIds])];
        
        // Validate all members exist and are friends with current user (except current user)
        for (const memberId of memberIds) {
            const user = req.db.prepare('SELECT UserID FROM Users WHERE UserID = ?').get(memberId);
            if (!user) {
                return res.status(400).json({
                    success: false,
                    error: `User with ID ${memberId} not found`
                });
            }

            // Check if they are friends (only for other users, not current user)
            if (memberId !== req.session.userId) {
                const friendship = req.db.prepare(`
                    SELECT 1 FROM Friends 
                    WHERE (User1 = ? AND User2 = ?) OR (User1 = ? AND User2 = ?)
                `).get(req.session.userId, memberId, memberId, req.session.userId);
                
                if (!friendship) {
                    return res.status(400).json({
                        success: false,
                        error: `You are not friends with user ID ${memberId}`
                    });
                }
            }
        }

        // Check if a conversation with these exact members already exists
        const existingConversations = req.db.prepare(`
            SELECT ConversationID, Members
            FROM Conversations
            WHERE JSON_EXTRACT(Members, '$') IS NOT NULL
        `).all();
        
        const sortedNewMembers = allMembers.slice().sort((a, b) => a - b);
        const existingConversation = existingConversations.find(conv => {
            const existingMembers = JSON.parse(conv.Members).sort((a, b) => a - b);
            return existingMembers.length === sortedNewMembers.length &&
                   existingMembers.every((id, index) => id === sortedNewMembers[index]);
        });
        
        if (existingConversation) {
            return res.status(409).json({
                success: false,
                error: 'A conversation with these members already exists',
                existingConversationId: existingConversation.ConversationID
            });
        }

        // For group conversations (3+ people), title and logo are required
        if (allMembers.length >= 3) {
            if (!conversationTitle || conversationTitle.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Group conversations require a title'
                });
            }
            if (!conversationLogo) {
                return res.status(400).json({
                    success: false,
                    error: 'Group conversations require an avatar'
                });
            }
        }

        // Create conversation
        const insertConversation = req.db.prepare(`
            INSERT INTO Conversations (Members, ConversationTitle, ConversationLogo)
            VALUES (?, ?, ?)
        `);

        const result = insertConversation.run(
            JSON.stringify(allMembers),
            allMembers.length >= 3 ? conversationTitle : null,
            allMembers.length >= 3 ? conversationLogo : null
        );

        if (result.changes > 0) {
            // Get the created conversation with member info
            const conversation = req.db.prepare(`
                SELECT ConversationID, ConversationTitle, ConversationLogo, Members
                FROM Conversations
                WHERE ConversationID = ?
            `).get(result.lastInsertRowid);

            const memberIds = JSON.parse(conversation.Members);
            const membersInfo = memberIds.map(memberId => {
                const user = req.db.prepare(`
                    SELECT UserID, UserName, Avatar
                    FROM Users
                    WHERE UserID = ?
                `).get(memberId);
                return user;
            }).filter(user => user !== undefined);

            res.json({
                success: true,
                conversation: {
                    ...conversation,
                    Members: membersInfo
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to create conversation'
            });
        }
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create conversation'
        });
    }
});

// Get messages for a conversation
app.get('/api/conversations/:conversationId/messages', requireAuth, (req, res) => {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        // Verify user is a member of this conversation
        const conversation = req.db.prepare(`
            SELECT Members FROM Conversations WHERE ConversationID = ?
        `).get(conversationId);
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        
        const memberIds = JSON.parse(conversation.Members);
        if (!memberIds.includes(req.session.userId)) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to access this conversation'
            });
        }
        
        // Get user's last read time for this conversation
        const readStatus = req.db.prepare(`
            SELECT LastReadTimeStamp, LastReadMessageID FROM ConversationReadStatus 
            WHERE ConversationID = ? AND UserID = ?
        `).get(conversationId, req.session.userId);
        
        const lastReadTimeStamp = readStatus ? readStatus.LastReadTimeStamp : null;
        const lastReadMessageID = readStatus ? readStatus.LastReadMessageID : null;
        
        // Get all messages with sender info (not filtered by read status)
        const messages = req.db.prepare(`
            SELECT cd.MessageID, cd.ConversationID, cd.SenderID, cd.Message, 
                   cd.Attachment, cd.Reactions, cd.Reply, cd.TimeStamp,
                   u.UserName, u.Avatar
            FROM ConversationData cd
            JOIN Users u ON cd.SenderID = u.UserID
            WHERE cd.ConversationID = ? AND cd.DeletedAt IS NULL
            ORDER BY cd.TimeStamp DESC
            LIMIT ? OFFSET ?
        `).all(conversationId, limit, offset);
        
        // Get all read statuses for all users in this conversation
        const allReadStatuses = req.db.prepare(`
            SELECT UserID, LastReadMessageID FROM ConversationReadStatus 
            WHERE ConversationID = ?
        `).all(conversationId);
        
        const readStatusMap = {};
        allReadStatuses.forEach(status => {
            readStatusMap[status.UserID] = status.LastReadMessageID;
        });
        
        res.json({
            success: true,
            messages: messages.reverse(), // Reverse to get chronological order
            lastReadTimeStamp: lastReadTimeStamp,
            lastReadMessageID: lastReadMessageID,
            allReadStatuses: readStatusMap
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get messages'
        });
    }
});

// Get single message (including deleted ones) for reply previews
app.get('/api/messages/:messageId', requireAuth, (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);

        if (Number.isNaN(messageId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid message ID'
            });
        }

        const record = req.db.prepare(`
            SELECT cd.MessageID, cd.ConversationID, cd.SenderID, cd.Message,
                   cd.Attachment, cd.Reactions, cd.Reply, cd.TimeStamp,
                   cd.DeletedAt, u.UserName, u.Avatar, c.Members
            FROM ConversationData cd
            JOIN Conversations c ON cd.ConversationID = c.ConversationID
            LEFT JOIN Users u ON cd.SenderID = u.UserID
            WHERE cd.MessageID = ?
        `).get(messageId);

        if (!record) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        let members;
        try {
            members = JSON.parse(record.Members || '[]');
        } catch (error) {
            console.error('Error parsing conversation members for message fetch:', error);
            members = [];
        }

        if (!members.includes(req.session.userId)) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this message'
            });
        }

        const { Members, ...message } = record;

        res.json({
            success: true,
            message
        });
    } catch (error) {
        console.error('Get message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message'
        });
    }
});

// Send a message
app.post('/api/conversations/:conversationId/messages', requireAuth, (req, res) => {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const { message, attachment, reply } = req.body;
        
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message content is required'
            });
        }
        
        // Verify user is a member of this conversation
        const conversation = req.db.prepare(`
            SELECT Members FROM Conversations WHERE ConversationID = ?
        `).get(conversationId);
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        
        const memberIds = JSON.parse(conversation.Members);
        if (!memberIds.includes(req.session.userId)) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to send messages to this conversation'
            });
        }
        
        // Insert the message
        const insertMessage = req.db.prepare(`
            INSERT INTO ConversationData (ConversationID, SenderID, Message, Attachment, Reply)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const result = insertMessage.run(
            conversationId, 
            req.session.userId, 
            message.trim(), 
            attachment || null, 
            reply || null
        );
        
        if (result.changes > 0) {
            // Get the created message with sender info
            const newMessage = req.db.prepare(`
                SELECT cd.MessageID, cd.ConversationID, cd.SenderID, cd.Message, 
                       cd.Attachment, cd.Reactions, cd.Reply, cd.TimeStamp,
                       u.UserName, u.Avatar
                FROM ConversationData cd
                JOIN Users u ON cd.SenderID = u.UserID
                WHERE cd.MessageID = ?
            `).get(result.lastInsertRowid);
            
            // Update the user's read status to the current time (they've just read the message they sent)
            const messageTimeStamp = newMessage.TimeStamp;
            const upsertReadStatus = req.db.prepare(`
                INSERT INTO ConversationReadStatus (ConversationID, UserID, LastReadMessageID, LastReadTimeStamp)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(ConversationID, UserID) DO UPDATE SET
                    LastReadMessageID = excluded.LastReadMessageID,
                    LastReadTimeStamp = excluded.LastReadTimeStamp
            `);
            
            upsertReadStatus.run(conversationId, req.session.userId, result.lastInsertRowid, messageTimeStamp);
            
            res.json({
                success: true,
                message: newMessage
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send message'
            });
        }
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// Update read status for a conversation
app.post('/api/conversations/:conversationId/read-status', requireAuth, (req, res) => {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const { messageId } = req.body;
        
        // Verify user is a member of this conversation
        const conversation = req.db.prepare(`
            SELECT Members FROM Conversations WHERE ConversationID = ?
        `).get(conversationId);
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        
        const memberIds = JSON.parse(conversation.Members);
        if (!memberIds.includes(req.session.userId)) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to update read status for this conversation'
            });
        }
        
        // Get the message timestamp
        let lastReadTimeStamp = new Date().toISOString();
        let lastReadMessageId = messageId;
        
        if (messageId) {
            const message = req.db.prepare(`
                SELECT TimeStamp FROM ConversationData WHERE MessageID = ?
            `).get(messageId);
            
            if (message) {
                lastReadTimeStamp = message.TimeStamp;
                lastReadMessageId = messageId;
            }
        }
        
        // Update or insert read status
        const upsertReadStatus = req.db.prepare(`
            INSERT INTO ConversationReadStatus (ConversationID, UserID, LastReadMessageID, LastReadTimeStamp)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(ConversationID, UserID) DO UPDATE SET
                LastReadMessageID = excluded.LastReadMessageID,
                LastReadTimeStamp = excluded.LastReadTimeStamp
        `);
        
        upsertReadStatus.run(conversationId, req.session.userId, lastReadMessageId, lastReadTimeStamp);
        
        res.json({
            success: true,
            message: 'Read status updated'
        });
    } catch (error) {
        console.error('Update read status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update read status'
        });
    }
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
