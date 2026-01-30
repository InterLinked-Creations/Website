/**
 * Conversations module
 * Registers conversation routes
 */
const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const controller = require('./controller');

const router = express.Router();

router.get('/', requireAuth, controller.getConversations);
router.post('/', requireAuth, controller.createConversation);
router.get('/:conversationId/messages', requireAuth, controller.getMessages);
router.post('/:conversationId/messages', requireAuth, controller.sendMessage);
router.post('/:conversationId/read-status', requireAuth, controller.updateReadStatus);

// Single message endpoint (outside conversation context)
router.get('/messages/:messageId', requireAuth, controller.getMessage);

module.exports = router;
