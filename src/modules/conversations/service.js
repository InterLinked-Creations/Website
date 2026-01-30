/**
 * Conversations service
 * Business logic for conversation/chat operations
 */

/**
 * Get conversations for a user
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @returns {Array} Conversations with member info
 */
function getUserConversations(db, userId) {
    // Get all conversations and filter by membership
    const allConversations = db.prepare(`
        SELECT c.ConversationID, c.ConversationTitle, c.ConversationLogo, c.Members
        FROM Conversations c
        ORDER BY c.ConversationID DESC
    `).all();

    // Filter conversations where user is a member
    const userConversations = allConversations.filter(conv => {
        try {
            const memberIds = JSON.parse(conv.Members);
            return memberIds.includes(userId);
        } catch (error) {
            console.error('Error parsing conversation members:', error);
            return false;
        }
    });

    // Parse members and get user info for each conversation
    return userConversations.map(conv => {
        const memberIds = JSON.parse(conv.Members);

        // Get member information
        const membersInfo = memberIds.map(memberId => {
            return db.prepare(`
                SELECT UserID, UserName, Avatar
                FROM Users
                WHERE UserID = ?
            `).get(memberId);
        }).filter(user => user !== undefined);

        // Get last message
        const lastMessage = db.prepare(`
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
}

/**
 * Create a new conversation
 * @param {Database} db - Database instance
 * @param {number} currentUserId - Current user ID
 * @param {Array<number>} memberIds - Member user IDs
 * @param {string} conversationTitle - Optional title (required for groups)
 * @param {string} conversationLogo - Optional logo (required for groups)
 * @returns {Object} Result with conversation info
 */
function createConversation(db, currentUserId, memberIds, conversationTitle, conversationLogo) {
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return { success: false, error: 'At least one member is required' };
    }

    // Add current user to members if not already included
    const allMembers = [...new Set([currentUserId, ...memberIds])];

    // Validate all members exist and are friends with current user
    for (const memberId of memberIds) {
        const user = db.prepare('SELECT UserID FROM Users WHERE UserID = ?').get(memberId);
        if (!user) {
            return { success: false, error: `User with ID ${memberId} not found` };
        }

        // Check if they are friends (only for other users)
        if (memberId !== currentUserId) {
            const friendship = db.prepare(`
                SELECT 1 FROM Friends 
                WHERE (User1 = ? AND User2 = ?) OR (User1 = ? AND User2 = ?)
            `).get(currentUserId, memberId, memberId, currentUserId);

            if (!friendship) {
                return { success: false, error: `You are not friends with user ID ${memberId}` };
            }
        }
    }

    // Check if a conversation with these exact members already exists
    const existingConversations = db.prepare(`
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
        return {
            success: false,
            error: 'A conversation with these members already exists',
            existingConversationId: existingConversation.ConversationID
        };
    }

    // For group conversations (3+ people), title and logo are required
    if (allMembers.length >= 3) {
        if (!conversationTitle || conversationTitle.trim().length === 0) {
            return { success: false, error: 'Group conversations require a title' };
        }
        if (!conversationLogo) {
            return { success: false, error: 'Group conversations require an avatar' };
        }
    }

    // Create conversation
    const insertConversation = db.prepare(`
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
        const conversation = db.prepare(`
            SELECT ConversationID, ConversationTitle, ConversationLogo, Members
            FROM Conversations
            WHERE ConversationID = ?
        `).get(result.lastInsertRowid);

        const parsedMemberIds = JSON.parse(conversation.Members);
        const membersInfo = parsedMemberIds.map(memberId => {
            return db.prepare(`
                SELECT UserID, UserName, Avatar
                FROM Users
                WHERE UserID = ?
            `).get(memberId);
        }).filter(user => user !== undefined);

        return {
            success: true,
            conversation: {
                ...conversation,
                Members: membersInfo
            }
        };
    }

    return { success: false, error: 'Failed to create conversation' };
}

/**
 * Check if user is member of conversation
 * @param {Database} db - Database instance
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID
 * @returns {Object} Object with isMember flag and memberIds
 */
function checkMembership(db, conversationId, userId) {
    const conversation = db.prepare(`
        SELECT Members FROM Conversations WHERE ConversationID = ?
    `).get(conversationId);

    if (!conversation) {
        return { exists: false, isMember: false, memberIds: [] };
    }

    const memberIds = JSON.parse(conversation.Members);
    return {
        exists: true,
        isMember: memberIds.includes(userId),
        memberIds
    };
}

/**
 * Get messages for a conversation
 * @param {Database} db - Database instance
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - Current user ID
 * @param {number} limit - Max messages to return
 * @param {number} offset - Offset for pagination
 * @returns {Object} Messages and read status info
 */
function getMessages(db, conversationId, userId, limit = 50, offset = 0) {
    // Get user's last read time for this conversation
    const readStatus = db.prepare(`
        SELECT LastReadTimeStamp, LastReadMessageID FROM ConversationReadStatus 
        WHERE ConversationID = ? AND UserID = ?
    `).get(conversationId, userId);

    const lastReadTimeStamp = readStatus ? readStatus.LastReadTimeStamp : null;
    const lastReadMessageID = readStatus ? readStatus.LastReadMessageID : null;

    // Get all messages with sender info
    const messages = db.prepare(`
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
    const allReadStatuses = db.prepare(`
        SELECT UserID, LastReadMessageID FROM ConversationReadStatus 
        WHERE ConversationID = ?
    `).all(conversationId);

    const readStatusMap = {};
    allReadStatuses.forEach(status => {
        readStatusMap[status.UserID] = status.LastReadMessageID;
    });

    return {
        messages: messages.reverse(), // Chronological order
        lastReadTimeStamp,
        lastReadMessageID,
        allReadStatuses: readStatusMap
    };
}

/**
 * Get a single message by ID
 * @param {Database} db - Database instance
 * @param {number} messageId - Message ID
 * @returns {Object|null} Message with conversation members
 */
function getMessage(db, messageId) {
    return db.prepare(`
        SELECT cd.MessageID, cd.ConversationID, cd.SenderID, cd.Message,
               cd.Attachment, cd.Reactions, cd.Reply, cd.TimeStamp,
               cd.DeletedAt, u.UserName, u.Avatar, c.Members
        FROM ConversationData cd
        JOIN Conversations c ON cd.ConversationID = c.ConversationID
        LEFT JOIN Users u ON cd.SenderID = u.UserID
        WHERE cd.MessageID = ?
    `).get(messageId);
}

/**
 * Send a message
 * @param {Database} db - Database instance
 * @param {number} conversationId - Conversation ID
 * @param {number} senderId - Sender user ID
 * @param {string} message - Message content
 * @param {string|null} attachment - Optional attachment
 * @param {number|null} reply - Optional reply message ID
 * @returns {Object} Result with message info
 */
function sendMessage(db, conversationId, senderId, message, attachment = null, reply = null) {
    const insertMessage = db.prepare(`
        INSERT INTO ConversationData (ConversationID, SenderID, Message, Attachment, Reply)
        VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertMessage.run(conversationId, senderId, message.trim(), attachment, reply);

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

        // Update the user's read status
        const upsertReadStatus = db.prepare(`
            INSERT INTO ConversationReadStatus (ConversationID, UserID, LastReadMessageID, LastReadTimeStamp)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(ConversationID, UserID) DO UPDATE SET
                LastReadMessageID = excluded.LastReadMessageID,
                LastReadTimeStamp = excluded.LastReadTimeStamp
        `);

        upsertReadStatus.run(conversationId, senderId, result.lastInsertRowid, newMessage.TimeStamp);

        return { success: true, message: newMessage };
    }

    return { success: false, error: 'Failed to send message' };
}

/**
 * Update read status for a conversation
 * @param {Database} db - Database instance
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID
 * @param {number|null} messageId - Optional message ID
 */
function updateReadStatus(db, conversationId, userId, messageId = null) {
    let lastReadTimeStamp = new Date().toISOString();
    let lastReadMessageId = messageId;

    if (messageId) {
        const message = db.prepare(`
            SELECT TimeStamp FROM ConversationData WHERE MessageID = ?
        `).get(messageId);

        if (message) {
            lastReadTimeStamp = message.TimeStamp;
            lastReadMessageId = messageId;
        }
    }

    const upsertReadStatus = db.prepare(`
        INSERT INTO ConversationReadStatus (ConversationID, UserID, LastReadMessageID, LastReadTimeStamp)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ConversationID, UserID) DO UPDATE SET
            LastReadMessageID = MAX(COALESCE(LastReadMessageID, 0), excluded.LastReadMessageID),
            LastReadTimeStamp = excluded.LastReadTimeStamp
    `);

    upsertReadStatus.run(conversationId, userId, lastReadMessageId, lastReadTimeStamp);
}

module.exports = {
    getUserConversations,
    createConversation,
    checkMembership,
    getMessages,
    getMessage,
    sendMessage,
    updateReadStatus
};
