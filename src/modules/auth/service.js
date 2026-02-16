/**
 * Authentication service
 * Business logic for user authentication
 */
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if match
 */
async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Register a new user
 * @param {Database} db - Database instance
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Registration result
 */
async function registerUser(db, { username, email, password, confirmPassword }) {
    const errors = [];

    // Validate password match
    if (password !== confirmPassword) {
        errors.push('Passwords do not match');
    }

    // Check if username exists
    const existingUsername = db.prepare('SELECT 1 FROM Users WHERE UserName = ?').get(username);
    if (existingUsername) {
        errors.push('Username is already taken');
    }

    // Check if email exists
    const existingEmail = db.prepare('SELECT 1 FROM Users WHERE Email = ?').get(email);
    if (existingEmail) {
        errors.push('Email is already registered');
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert new user
    const insertUser = db.prepare(`
        INSERT INTO Users (UserName, Email, Password, Avatar)
        VALUES (?, ?, ?, ?)
    `);

    const result = insertUser.run(username, email, hashedPassword, 'lib/avatars/Colors/FillBlack.png');

    return {
        success: true,
        userId: result.lastInsertRowid,
        username,
        avatar: 'lib/avatars/Colors/FillBlack.png'
    };
}

/**
 * Validate user login credentials
 * @param {Database} db - Database instance
 * @param {string} username - Username or email
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} Login result
 */
async function validateLogin(db, username, password) {
    // Find user by username or email
    const user = db.prepare(`
        SELECT UserID, UserName, Password, Avatar 
        FROM Users 
        WHERE UserName = ? OR Email = ?
    `).get(username, username);

    if (!user) {
        return { success: false, errors: ['Invalid username/email or password'] };
    }

    // Check password
    const validPassword = await comparePassword(password, user.Password);
    if (!validPassword) {
        return { success: false, errors: ['Invalid username/email or password'] };
    }

    return {
        success: true,
        userId: user.UserID,
        username: user.UserName,
        avatar: user.Avatar
    };
}

/**
 * Get user by ID
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @returns {Object|null} User object or null
 */
function getUserById(db, userId) {
    return db.prepare(`
        SELECT UserID, UserName, Avatar, Email
        FROM Users 
        WHERE UserID = ?
    `).get(userId);
}

/**
 * Get friend count for a user
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @returns {number} Friend count
 */
function getFriendCount(db, userId) {
    if (!userId) return 0;

    try {
        const friendCount = db.prepare('SELECT COUNT(*) as count FROM Friends WHERE User1 = ? OR User2 = ?').get(userId, userId);
        return friendCount.count;
    } catch (error) {
        console.error('Error checking friend count:', error);
        return 0;
    }
}

/** 
 * Update user email
 * @param {Database} db - Database instance
 * @param {number} userId - User ID
 * @param {string} email - New email address
*/
function updateUserEmail(db, userId, email) {
    const updateEmail = db.prepare(`
        UPDATE Users 
        SET Email = ? 
        WHERE UserID = ?
    `);
    const result = updateEmail.run(email, userId);
    return result.changes > 0;
}
module.exports = {
    hashPassword,
    comparePassword,
    registerUser,
    validateLogin,
    getUserById,
    getFriendCount,
    updateUserEmail
};
