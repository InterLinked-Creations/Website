/**
 * Games module
 * Registers game routes
 */
const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/', controller.getGames);

module.exports = router;
