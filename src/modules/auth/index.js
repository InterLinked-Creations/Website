/**
 * Authentication module
 * Registers auth routes
 */
const express = require('express');
const controller = require('./controller');

const router = express.Router();

// Public routes
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/confirm-login', controller.confirmLogin);
router.get('/check-session', controller.checkSession);
router.get('/current-user', controller.getCurrentUser);
router.post('/logout', controller.logout);
router.post('/update-email', controller.updateEmail);

module.exports = router;
