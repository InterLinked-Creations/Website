/**
 * Users controller
 * Handles HTTP requests for user endpoints
 */
const path = require('path');
const usersService = require('./service');

/**
 * Get user by ID
 */
function getUser(req, res) {
    try {
        const userId = parseInt(req.params.userId);

        const user = usersService.getUserById(req.db, userId);

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
}

/**
 * Update user avatar
 */
function updateAvatar(req, res) {
    try {
        const { userId, avatar } = req.body;

        usersService.updateAvatar(req.db, userId, avatar);

        res.json({ success: true, avatar });
    } catch (error) {
        console.error('Avatar update error:', error);
        res.status(500).json({ errors: ['Failed to update avatar'] });
    }
}

/**
 * Get available avatars
 */
function getAvatars(req, res) {
    try {
        const publicDir = path.resolve(__dirname, '../../../Interlinked');
        const avatars = usersService.getAvailableAvatars(publicDir);

        res.json({ avatars });
    } catch (error) {
        console.error('Error getting avatars:', error);
        res.status(500).json({ errors: ['Failed to get avatars'] });
    }
}

module.exports = {
    getUser,
    updateAvatar,
    getAvatars
};
