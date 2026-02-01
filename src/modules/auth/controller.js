/**
 * Authentication controller
 * Handles HTTP requests for authentication endpoints
 */
const authService = require('./service');

/**
 * Register a new user
 */
async function register(req, res) {
    try {
        const result = await authService.registerUser(req.db, req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.errors });
        }

        res.json(result);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ errors: ['An unexpected error occurred'] });
    }
}

/**
 * Login user (validates credentials, doesn't create session)
 */
async function login(req, res) {
    try {
        const { username, password } = req.body;
        const result = await authService.validateLogin(req.db, username, password);

        if (!result.success) {
            return res.status(400).json({ errors: result.errors });
        }

        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ errors: ['An unexpected error occurred'] });
    }
}

/**
 * Confirm login (creates session)
 */
function confirmLogin(req, res) {
    try {
        const { userId } = req.body;

        // Verify user exists
        const user = authService.getUserById(req.db, userId);

        if (!user) {
            return res.status(400).json({ errors: ['User not found'] });
        }

        // Create session
        req.session.userId = user.UserID;
        req.session.username = user.UserName;
        req.session.avatar = user.Avatar;

        // Log the number of friends (for information only)
        const friendCount = authService.getFriendCount(req.db, user.UserID);
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
}

/**
 * Check current session
 */
function checkSession(req, res) {
    try {
        if (!req.session.userId) {
            return res.json({ authenticated: false });
        }

        // Verify user still exists in database
        const user = authService.getUserById(req.db, req.session.userId);

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
}

/**
 * Get current user info
 */
function getCurrentUser(req, res) {
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
}

/**
 * Logout user
 */
function logout(req, res) {
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
}

module.exports = {
    register,
    login,
    confirmLogin,
    checkSession,
    getCurrentUser,
    logout
};
