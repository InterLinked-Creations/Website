/**
 * Authentication middleware
 */
const dbConnection = require('../db/connection');

/**
 * Middleware to require authentication
 * Attaches user session and database to request
 */
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    // Add database connection to request for convenience
    req.db = dbConnection.getDb();
    next();
}

/**
 * Middleware to optionally attach database to request
 */
function attachDb(req, res, next) {
    req.db = dbConnection.getDb();
    next();
}

module.exports = {
    requireAuth,
    attachDb
};
