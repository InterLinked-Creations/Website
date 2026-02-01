/**
 * Friends service
 * Business logic for friend operations
 */

/**
 * Check friend request status between users
 * @param {Database} db - Database instance
 * @param {number} currentUserId - Current user ID
 * @param {string} targetUsername - Target username
 * @returns {Object} Status result
 */
function checkFriendRequestStatus(db, currentUserId, targetUsername) {
    // Find the target user by username
    const targetUser = db.prepare('SELECT UserID, UserName, Avatar FROM Users WHERE UserName = ?').get(targetUsername);

    if (!targetUser) {
        return { status: 'not_found', message: 'User not found' };
    }

    const targetUserInfo = {
        id: targetUser.UserID,
        username: targetUser.UserName,
        avatar: targetUser.Avatar
    };

    // Check if they're already friends
    const existingFriendship = db.prepare(`
        SELECT 1 FROM Friends 
        WHERE (User1 = ? AND User2 = ?) OR (User1 = ? AND User2 = ?)
    `).get(currentUserId, targetUser.UserID, targetUser.UserID, currentUserId);

    if (existingFriendship) {
        return {
            status: 'already_friends',
            message: 'You are already friends with this user',
            targetUser: targetUserInfo
        };
    }

    // Check if there's a pending invite from current user to target
    const pendingSentInvite = db.prepare(`
        SELECT 1 FROM Invites 
        WHERE FromUser = ? AND ToUser = ?
    `).get(currentUserId, targetUser.UserID);

    if (pendingSentInvite) {
        return {
            status: 'invite_already_sent',
            message: 'You already sent a friend request to this user',
            targetUser: targetUserInfo
        };
    }

    // Check if there's a pending invite from target to current user
    const pendingReceivedInvite = db.prepare(`
        SELECT 1 FROM Invites 
        WHERE FromUser = ? AND ToUser = ?
    `).get(targetUser.UserID, currentUserId);

    if (pendingReceivedInvite) {
        return {
            status: 'invite_already_received',
            message: 'This user has already sent you a friend request',
            targetUser: targetUserInfo
        };
    }

    return {
        status: 'can_send_request',
        message: 'You can send a friend request to this user',
        targetUser: targetUserInfo
    };
}

/**
 * Send a friend request
 * @param {Database} db - Database instance
 * @param {number} fromUserId - Sender user ID
 * @param {number} toUserId - Target user ID
 * @returns {Object} Result
 */
function sendFriendRequest(db, fromUserId, toUserId) {
    const insertInvite = db.prepare(`
        INSERT INTO Invites (FromUser, ToUser)
        VALUES (?, ?)
    `);

    const result = insertInvite.run(fromUserId, toUserId);

    return {
        success: result.changes > 0,
        message: result.changes > 0 ? 'Friend request sent successfully' : 'Failed to send friend request'
    };
}

/**
 * Get pending friend requests for a user
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @returns {Array} Pending invites
 */
function getPendingRequests(db, userId) {
    return db.prepare(`
        SELECT i.InviteID, i.FromUser, u.UserName, u.Avatar
        FROM Invites i
        JOIN Users u ON i.FromUser = u.UserID
        WHERE i.ToUser = ?
    `).all(userId);
}

/**
 * Accept a friend request
 * @param {Database} db - Database instance
 * @param {number} inviteId - Invite ID
 * @param {number} currentUserId - Current user ID
 * @returns {Object} Result with friend info
 */
function acceptFriendRequest(db, inviteId, currentUserId) {
    const transaction = db.transaction(() => {
        // Get the invite to verify it belongs to the current user
        const invite = db.prepare(`
            SELECT InviteID, FromUser, ToUser 
            FROM Invites 
            WHERE InviteID = ? AND ToUser = ?
        `).get(inviteId, currentUserId);

        if (!invite) {
            throw new Error('Invalid invite or not authorized');
        }

        // Add both users as friends
        const addFriends = db.prepare(`
            INSERT INTO Friends (User1, User2) 
            VALUES (?, ?)
        `);
        addFriends.run(invite.FromUser, invite.ToUser);

        // Delete the invite
        const deleteInvite = db.prepare('DELETE FROM Invites WHERE InviteID = ?');
        deleteInvite.run(inviteId);

        // Get the friend's info for the response
        const friend = db.prepare(`
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

    return transaction();
}

/**
 * Decline a friend request
 * @param {Database} db - Database instance
 * @param {number} inviteId - Invite ID
 * @param {number} currentUserId - Current user ID
 * @returns {Object} Result
 */
function declineFriendRequest(db, inviteId, currentUserId) {
    // Verify the invite belongs to the current user
    const invite = db.prepare(`
        SELECT 1 FROM Invites WHERE InviteID = ? AND ToUser = ?
    `).get(inviteId, currentUserId);

    if (!invite) {
        return { success: false, error: 'Invalid invite or not authorized' };
    }

    // Delete the invite
    const deleteInvite = db.prepare('DELETE FROM Invites WHERE InviteID = ?');
    const result = deleteInvite.run(inviteId);

    return {
        success: result.changes > 0,
        message: result.changes > 0 ? 'Friend request declined' : 'Failed to decline friend request'
    };
}

/**
 * Get all friends for a user
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @returns {Array} Friends list
 */
function getFriends(db, userId) {
    return db.prepare(`
        SELECT u.UserID, u.UserName, u.Avatar,
               'offline' as Status,
               NULL as LastSeen,
               NULL as CurrentGame,
               NULL as LastGame
        FROM Friends f
        JOIN Users u ON (f.User1 = u.UserID OR f.User2 = u.UserID)
        WHERE (f.User1 = ? AND u.UserID != ?) OR (f.User2 = ? AND u.UserID != ?)
    `).all(userId, userId, userId, userId);
}

module.exports = {
    checkFriendRequestStatus,
    sendFriendRequest,
    getPendingRequests,
    acceptFriendRequest,
    declineFriendRequest,
    getFriends
};
