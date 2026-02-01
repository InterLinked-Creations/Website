/**
 * Friends module
 * Registers friend routes
 */
const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.post('/check-friend-request', controller.checkFriendRequest);
router.post('/send-friend-request', controller.sendFriendRequest);
router.get('/friend-requests', controller.getFriendRequests);
router.post('/friend-requests/accept', controller.acceptFriendRequest);
router.post('/friend-requests/decline', controller.declineFriendRequest);
router.get('/friends', controller.getFriends);

module.exports = router;
