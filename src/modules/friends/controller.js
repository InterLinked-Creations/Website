/**
 * Friends controller
 * Handles HTTP requests for friend endpoints
 */
const friendsService = require('./service');

/**
 * Check friend request status
 */
function checkFriendRequest(req, res) {
    try {
        const { targetUsername } = req.body;

        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = friendsService.checkFriendRequestStatus(req.db, req.session.userId, targetUsername);

        if (result.status === 'not_found') {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Friend request check error:', error);
        res.status(500).json({ error: 'Failed to check friend request status' });
    }
}

/**
 * Send friend request
 */
function sendFriendRequest(req, res) {
    try {
        const { targetUserId } = req.body;

        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = friendsService.sendFriendRequest(req.db, req.session.userId, targetUserId);

        if (!result.success) {
            return res.status(500).json({ error: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
}

/**
 * Get pending friend requests
 */
function getFriendRequests(req, res) {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const invites = friendsService.getPendingRequests(req.db, req.session.userId);

        res.json({
            success: true,
            invites,
            count: invites.length
        });
    } catch (error) {
        console.error('Get friend requests error:', error);
        res.status(500).json({ error: 'Failed to retrieve friend requests' });
    }
}

/**
 * Accept friend request
 */
function acceptFriendRequest(req, res) {
    try {
        const { inviteId } = req.body;

        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = friendsService.acceptFriendRequest(req.db, inviteId, req.session.userId);
        res.json(result);
    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to accept friend request'
        });
    }
}

/**
 * Decline friend request
 */
function declineFriendRequest(req, res) {
    try {
        const { inviteId } = req.body;

        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = friendsService.declineFriendRequest(req.db, inviteId, req.session.userId);

        if (!result.success) {
            return res.status(result.error === 'Invalid invite or not authorized' ? 403 : 500).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Decline friend request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to decline friend request'
        });
    }
}

/**
 * Get user's friends
 */
function getFriends(req, res) {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const friends = friendsService.getFriends(req.db, req.session.userId);

        res.json({
            success: true,
            friends
        });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Failed to retrieve friends' });
    }
}

module.exports = {
    checkFriendRequest,
    sendFriendRequest,
    getFriendRequests,
    acceptFriendRequest,
    declineFriendRequest,
    getFriends
};
