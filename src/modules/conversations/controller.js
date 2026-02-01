/**
 * Conversations controller
 * Handles HTTP requests for conversation endpoints
 */
const conversationsService = require('./service');

/**
 * Get user's conversations
 */
function getConversations(req, res) {
    try {
        const conversations = conversationsService.getUserConversations(req.db, req.session.userId);

        res.json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get conversations'
        });
    }
}

/**
 * Create new conversation
 */
function createConversation(req, res) {
    try {
        const { memberIds, conversationTitle, conversationLogo } = req.body;

        const result = conversationsService.createConversation(
            req.db,
            req.session.userId,
            memberIds,
            conversationTitle,
            conversationLogo
        );

        if (!result.success) {
            const statusCode = result.existingConversationId ? 409 : 400;
            return res.status(statusCode).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create conversation'
        });
    }
}

/**
 * Get messages for a conversation
 */
function getMessages(req, res) {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Verify user is a member
        const membership = conversationsService.checkMembership(req.db, conversationId, req.session.userId);

        if (!membership.exists) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }

        if (!membership.isMember) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to access this conversation'
            });
        }

        const result = conversationsService.getMessages(req.db, conversationId, req.session.userId, limit, offset);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get messages'
        });
    }
}

/**
 * Get single message
 */
function getMessage(req, res) {
    try {
        const messageId = parseInt(req.params.messageId);

        if (Number.isNaN(messageId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid message ID'
            });
        }

        const record = conversationsService.getMessage(req.db, messageId);

        if (!record) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        let members;
        try {
            members = JSON.parse(record.Members || '[]');
        } catch (error) {
            console.error('Error parsing conversation members for message fetch:', error);
            members = [];
        }

        if (!members.includes(req.session.userId)) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this message'
            });
        }

        const { Members, ...message } = record;

        res.json({
            success: true,
            message
        });
    } catch (error) {
        console.error('Get message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message'
        });
    }
}

/**
 * Send a message
 */
function sendMessage(req, res) {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const { message, attachment, reply } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message content is required'
            });
        }

        // Verify user is a member
        const membership = conversationsService.checkMembership(req.db, conversationId, req.session.userId);

        if (!membership.exists) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }

        if (!membership.isMember) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to send messages to this conversation'
            });
        }

        const result = conversationsService.sendMessage(
            req.db,
            conversationId,
            req.session.userId,
            message,
            attachment || null,
            reply || null
        );

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
}

/**
 * Update read status
 */
function updateReadStatus(req, res) {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const { messageId } = req.body;

        // Verify user is a member
        const membership = conversationsService.checkMembership(req.db, conversationId, req.session.userId);

        if (!membership.exists) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }

        if (!membership.isMember) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to update read status for this conversation'
            });
        }

        conversationsService.updateReadStatus(req.db, conversationId, req.session.userId, messageId);

        res.json({
            success: true,
            message: 'Read status updated'
        });
    } catch (error) {
        console.error('Update read status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update read status'
        });
    }
}

module.exports = {
    getConversations,
    createConversation,
    getMessages,
    getMessage,
    sendMessage,
    updateReadStatus
};
