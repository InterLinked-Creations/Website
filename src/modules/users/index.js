/**
 * Users module
 * Registers user routes
 */
const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/:userId', controller.getUser);
router.post('/update-avatar', controller.updateAvatar);
router.get('/avatars/list', controller.getAvatars);

module.exports = router;
