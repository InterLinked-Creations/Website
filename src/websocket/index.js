/**
 * WebSocket handler
 * Manages real-time connections for status, chat, and typing indicators
 */
const WebSocket = require('ws');
const dbConnection = require('../db/connection');

// Store connected WebSocket clients
const clients = new Map();

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 * @returns {WebSocket.Server} WebSocket server
 */
function initialize(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        console.log('WebSocket client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                handleMessage(ws, data);
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        });

        ws.on('close', () => {
            console.log('WebSocket client disconnected');
            if (ws.userId) {
                clients.delete(ws.userId);
                broadcastUserStatus(ws.userId, 'offline');
                console.log(`User ${ws.userId} disconnected from WebSocket`);
            }
        });
    });

    return wss;
}

/**
 * Handle incoming WebSocket message
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} data - Message data
 */
function handleMessage(ws, data) {
    switch (data.type) {
        case 'authenticate':
            if (data.userId) {
                clients.set(data.userId, ws);
                ws.userId = data.userId;
                console.log(`User ${data.userId} authenticated on WebSocket`);
                broadcastUserStatus(data.userId, 'online');
                sendFriendStatusUpdates(data.userId);
            }
            break;

        case 'message_send':
            if (ws.userId) {
                handleChatMessage(ws.userId, data);
            }
            break;

        case 'typing_start':
            if (ws.userId) {
                handleTypingIndicator(ws.userId, data, true);
            }
            break;

        case 'typing_stop':
            if (ws.userId) {
                handleTypingIndicator(ws.userId, data, false);
            }
            break;

        case 'read_status_update':
            if (ws.userId) {
                handleReadStatusUpdate(ws.userId, data);
            }
            break;
    }
}

/**
 * Broadcast a user's status to their friends
 * @param {number} userId - User ID
 * @param {string} status - Status ('online' or 'offline')
 */
function broadcastUserStatus(userId, status) {
    const db = dbConnection.getDb();

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

/**
 * Send status updates of all friends to a specific user
 * @param {number} userId - User ID
 */
function sendFriendStatusUpdates(userId) {
    const db = dbConnection.getDb();

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

/**
 * Handle chat message via WebSocket
 * @param {number} senderId - Sender user ID
 * @param {Object} data - Message data
 */
function handleChatMessage(senderId, data) {
    try {
        const db = dbConnection.getDb();
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

/**
 * Handle typing indicators
 * @param {number} senderId - Sender user ID
 * @param {Object} data - Typing data
 * @param {boolean} isTyping - Whether user is typing
 */
function handleTypingIndicator(senderId, data, isTyping) {
    try {
        const db = dbConnection.getDb();
        const { conversationId } = data;

        if (!conversationId) {
            return;
        }

        // Verify user is a member
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

/**
 * Handle read status updates via WebSocket
 * @param {number} senderId - Sender user ID
 * @param {Object} data - Read status data
 */
function handleReadStatusUpdate(senderId, data) {
    try {
        const db = dbConnection.getDb();
        const { conversationId, messageId } = data;

        if (!conversationId || !messageId) {
            return;
        }

        // Verify user is a member
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

        // Broadcast read status update to all other conversation members
        const readStatusData = {
            type: 'read_status_update',
            conversationId: conversationId,
            messageId: messageId,
            user: {
                id: senderId,
                username: sender.UserName,
                avatar: sender.Avatar
            }
        };

        memberIds.forEach(memberId => {
            if (memberId !== senderId) {
                const memberWs = clients.get(memberId);
                if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                    memberWs.send(JSON.stringify(readStatusData));
                }
            }
        });
    } catch (error) {
        console.error('Error handling read status update:', error);
    }
}

/**
 * Get the clients map
 * @returns {Map} Clients map
 */
function getClients() {
    return clients;
}

/**
 * Close all WebSocket connections
 * @param {WebSocket.Server} wss - WebSocket server
 */
function closeAll(wss) {
    wss.clients.forEach(client => {
        client.close();
    });
}

module.exports = {
    initialize,
    getClients,
    closeAll,
    broadcastUserStatus
};
