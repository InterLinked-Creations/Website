/**
 * Friends module
 * Registers friend routes
 */
const express = require('express');
const controller = require('./controller');

const router = express.Router();

// Import sendToUser from websocket module
const { sendToUser } = require('../../websocket');

// Inject sendToUser into controller
const friendsController = require('./controller')(sendToUser);

router.post('/check-friend-request', friendsController.checkFriendRequest);
router.post('/send-friend-request', friendsController.sendFriendRequest);
router.get('/friend-requests', friendsController.getFriendRequests);
router.post('/friend-requests/accept', friendsController.acceptFriendRequest);
router.post('/friend-requests/decline', friendsController.declineFriendRequest);
router.get('/friends', friendsController.getFriends);

module.exports = router;
