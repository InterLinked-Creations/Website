/**
 * Express application configuration
 * Sets up middleware and mounts routes
 */
const express = require('express');
const path = require('path');
const session = require('express-session');
const config = require('./config');
const { attachDb } = require('./middleware/auth');

// Import route modules
const authRoutes = require('./modules/auth');
const usersRoutes = require('./modules/users');
const friendsRoutes = require('./modules/friends');
const conversationsRoutes = require('./modules/conversations');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Session configuration
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.cookieSecure,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Attach database to all requests
app.use(attachDb);

// Serve static files from the Interlinked directory
const publicDir = path.resolve(__dirname, '../Interlinked');
app.use(express.static(publicDir));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

// Mount API routes
app.use('/api', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', friendsRoutes);
app.use('/api/conversations', conversationsRoutes);

// Legacy route for avatars (to maintain backwards compatibility)
app.get('/api/avatars', (req, res) => {
    const usersController = require('./modules/users/controller');
    usersController.getAvatars(req, res);
});

// Legacy route for update-avatar (to maintain backwards compatibility)
app.post('/api/update-avatar', (req, res) => {
    const usersController = require('./modules/users/controller');
    usersController.updateAvatar(req, res);
});

module.exports = app;
