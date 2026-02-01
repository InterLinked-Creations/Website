/**
 * Users service
 * Business logic for user operations
 */
const fs = require('fs');
const path = require('path');

/**
 * Get user by ID
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @returns {Object|null} User object or null
 */
function getUserById(db, userId) {
    return db.prepare(`
        SELECT UserID, UserName, Avatar FROM Users WHERE UserID = ?
    `).get(userId);
}

/**
 * Update user avatar
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @param {string} avatar - Avatar path
 */
function updateAvatar(db, userId, avatar) {
    const updateAvatar = db.prepare('UPDATE Users SET Avatar = ? WHERE UserID = ?');
    updateAvatar.run(avatar, userId);
}

/**
 * Get available avatars
 * @param {string} publicDir - Path to public directory
 * @returns {string[]} Array of avatar paths
 */
function getAvailableAvatars(publicDir) {
    const avatarsDir = path.join(publicDir, 'app', 'lib', 'avatars', 'Colors');
    const files = fs.readdirSync(avatarsDir);
    return files.map(file => `lib/avatars/Colors/${file}`);
}

module.exports = {
    getUserById,
    updateAvatar,
    getAvailableAvatars
};
