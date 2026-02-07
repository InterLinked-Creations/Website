// Global WebSocket connection
let socket = null;
// Map to store friend status data
const friendsData = new Map();
// Reply feature variables
let replyingToMessage = null;
// Draft storage for unsent messages keyed by conversation
const conversationDrafts = new Map();
const MAX_CONVERSATION_DRAFTS = 30;
const DRAFT_ATTACHMENT_EVENTS = {
    COLLECT: 'chat:draft-collect-attachments',
    RESTORE: 'chat:draft-restore-attachments',
    CLEAR: 'chat:draft-clear-attachments'
};
const conversationMessageIndex = new Map();
const MESSAGE_REPLY_SNIPPET_LIMIT = 180;
const replyMessageCache = new Map(); // messageId -> message | null (not found)
const replyMessageFetchPromises = new Map();
// The base position of the chat dialog input in vw units
const basePosition = 50; // vw

// Live read receipt tracking
let currentReadMessageId = null; // Track current user's last read message in memory
let readStatusUpdateTimeout = null; // Debounce timer for visual updates
let pendingReadStatusSave = false; // Flag to track if we need to save to DB
let wsReadStatusThrottle = null; // Throttle timer for WebSocket broadcasts
let messageObserver = null; // IntersectionObserver for tracking visible messages
const WS_READ_THROTTLE_MS = 2000; // Only send WS updates every 2 seconds max

document.addEventListener('DOMContentLoaded', () => {
    // Friend system elements
    const sendFriendInviteBtn = document.getElementById('send-friend-invite');
    const friendInviteInput = document.querySelector('.friend-invite-input');
    const showInvitesBtn = document.getElementById('show-invites');
    const friendsList = document.querySelector('.friends-list');

    // Reply preview elements
    const replyPreview = document.querySelector('.reply-preview');
    const replyPreviewContent = document.querySelector('.reply-preview-content');
    
    // Check for friend requests on page load
    updateFriendRequestCount();
    
    // Load friends on page load
    loadFriends();
    
    // Initialize WebSocket connection
    initWebSocket();
    
    // Chat dialog elements
    const chatDialog = document.getElementById('chat-dialog');
    const chatDialogClose = document.querySelector('.chat-dialog-close');
    const chatMuteBtn = document.getElementById('chat-mute-btn');
    const chatFriendAvatars = document.querySelectorAll('.chat-friend-avatar');
    const chatDialogUsername = document.querySelector('.chat-dialog-username');
    const chatDialogAvatar = document.querySelector('.chat-dialog-avatar');
    const chatDialogGameStatus = document.querySelector('.chat-dialog-game-status');
    const chatDialogMessages = document.querySelector('.chat-dialog-messages');
    const chatInput = document.querySelector('#message-input');
    const sendMessageBtn = document.querySelector('.send-message-btn');

    // Profile overlay elements
    const profileOverlay = document.getElementById('profile-overlay');
    const profileClose = document.querySelector('.profile-close');
    const profileUsername = document.querySelector('.profile-username');
    const profileAvatar = document.querySelector('.profile-avatar');
    const profileStatus = document.querySelector('.profile-status');
    const profileChatBtn = document.querySelector('.profile-action-btn.chat-btn');

    // Chat buttons
    const chatButtons = document.querySelectorAll('.friend-action-btn.chat-btn');
    
    // Profile buttons
    const profileButtons = document.querySelectorAll('.friend-action-btn.profile-btn');

    // Friend request confirmation elements
    const friendRequestOverlay = document.getElementById('friend-request-overlay');
    const friendRequestMessage = document.getElementById('friend-request-message');
    const friendRequestAvatar = document.getElementById('friend-request-avatar');
    const friendRequestUsername = document.getElementById('friend-request-username');
    const confirmFriendRequestBtn = document.getElementById('confirm-friend-request-btn');
    const cancelFriendRequestBtn = document.getElementById('cancel-friend-request-btn');
    const friendRequestCloseBtn = friendRequestOverlay ? friendRequestOverlay.querySelector('.overlay-close') : null;
    
    // Friend request state
    let pendingFriendRequest = {
        targetUsername: null,
        targetUserId: null,
        targetAvatar: null
    };

    // Friend invite functionality
    if (sendFriendInviteBtn) {
        sendFriendInviteBtn.addEventListener('click', () => {
            const username = friendInviteInput.value.trim();
            if (username) {
                checkFriendRequestStatus(username);
            } else {
                parent.window.mainFrame.toast.warn('Please enter a username to send a friend request.');
            }
        });
    }
    
    // Function to load friends
    function loadFriends() {
        const friendsList = document.querySelector('.friends-list');
        if (!friendsList) return;
        
        fetch('/api/friends')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Clear the friends list
                    friendsList.innerHTML = '';
                    
                    // The empty state will now be handled by reorganizeFriendsList()
                    
                    // Store friend data in global map for status updates
                    data.friends.forEach(friend => {
                        friendsData.set(friend.UserID, {
                            id: friend.UserID,
                            username: friend.UserName,
                            avatar: friend.Avatar,
                            status: friend.Status,
                            currentGame: friend.CurrentGame,
                            lastGame: friend.LastGame
                        });
                    });
                    
                    // Create friend cards but don't add them to the DOM yet
                    const onlineFriends = data.friends.filter(friend => friend.Status === 'online');
                    const offlineFriends = data.friends.filter(friend => friend.Status === 'offline');
                    
                    // Create all the friend cards and append them to the DOM
                    onlineFriends.forEach(friend => {
                        const cardHTML = createFriendCard(friend, 'online');
                        const tempContainer = document.createElement('div');
                        tempContainer.innerHTML = cardHTML;
                        const friendCard = tempContainer.firstElementChild;
                        friendsList.appendChild(friendCard);
                    });
                    
                    offlineFriends.forEach(friend => {
                        const cardHTML = createFriendCard(friend, 'offline');
                        const tempContainer = document.createElement('div');
                        tempContainer.innerHTML = cardHTML;
                        const friendCard = tempContainer.firstElementChild;
                        friendsList.appendChild(friendCard);
                    });
                    
                    // Use reorganize function to properly organize the cards
                    reorganizeFriendsList();
                } else {
                    // Error loading friends
                    friendsList.innerHTML = `
                        <div class="no-friends-message">
                            <p>Failed to load friends. Please try again later.</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading friends:', error);
                friendsList.innerHTML = `
                    <div class="no-friends-message">
                        <p>An error occurred while loading your friends.</p>
                        <p>Please try again later.</p>
                    </div>
                `;
            });
    }
    
    // Function to create a friend card HTML
    function createFriendCard(friend, status) {
        const statusDotClass = status === 'online' ? 'blue' : 'gray';
        const statusText = status === 'online' ? 'Online Now' : `Last online: ${formatLastSeen(friend.LastSeen || 'a while ago')}`;
        
        // Handle game info
        let gameInfo = '';
        if (status === 'online') {
            gameInfo = friend.CurrentGame || 'In Lobby';
        } else {
            gameInfo = friend.LastGame ? `Last played: ${friend.LastGame}` : 'No recent games';
        }
        
        return `
        <div class="friend-card ${status}" data-user-id="${friend.UserID}">
            <div class="friend-card-header">
                <div class="avatar-container">
                    <img src="${friend.Avatar}" alt="${friend.UserName}'s Avatar" class="friend-avatar">
                    <div class="status-dot ${statusDotClass}"></div>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.UserName}</div>
                    <div class="friend-status-info ${status}">${statusText}</div>
                    <div class="friend-${status === 'online' ? 'current' : 'last'}-game">${gameInfo}</div>
                </div>
            </div>
            <div class="friend-actions">
                <button class="friend-action-btn profile-btn" data-user-id="${friend.UserID}">See Profile</button>
                <button class="friend-action-btn chat-btn" data-user-id="${friend.UserID}" data-username="${friend.UserName}" data-avatar="${friend.Avatar}">Open Conversation with this user</button>
            </div>
        </div>
        `;
    }
    
    // Helper function to format last seen time
    function formatLastSeen(lastSeen) {
        if (!lastSeen) return 'a while ago';
        
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffMs = now - lastSeenDate;
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        if (diffMins ) {
            return 'Just now';
        }
        else if (diffMins < 60) {
            return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
        } else if (diffHours < 24) {
            return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        } else {
            return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
        }
    }
    
    // Function to add event listeners to friend cards
    function addFriendCardEventListeners() {
        // Profile buttons
        const profileButtons = document.querySelectorAll('.friend-action-btn.profile-btn');
        profileButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                // Handle profile click
                // For now, we just show the existing profile overlay
                showProfile(userId);
            });
        });
        
        // Chat buttons
        const chatButtons = document.querySelectorAll('.friend-action-btn.chat-btn');
        chatButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                // Handle chat click
                // For now, we just show the existing chat dialog
                showChat(userId);
            });
        });
    }
    
    // Function to reorganize the friends list based on online/offline status
    function reorganizeFriendsList() {
        const friendsList = document.querySelector('.friends-list');
        if (!friendsList) return;
        
        // Get all friend cards currently in the DOM
        const onlineCards = friendsList.querySelectorAll('.friend-card.online');
        const offlineCards = friendsList.querySelectorAll('.friend-card.offline');
        
        // Create temporary container for the cards
        const fragment = document.createDocumentFragment();
        
        // Check if we have any friends at all
        const totalFriends = onlineCards.length + offlineCards.length;
        
        if (totalFriends === 0) {
            // No friends at all - check if we need to fetch data from server
            // or if this is truly an empty friends list
            if (friendsData.size === 0) {
                // If our friendsData map is empty, it means we've already checked and have no friends
                const noFriendsMessage = document.createElement('div');
                noFriendsMessage.className = 'no-friends-message';
                noFriendsMessage.innerHTML = `
                    <p>You currently have no friends in your friends list.</p>
                    <p>Send a friend invite to start connecting!</p>
                `;
                fragment.appendChild(noFriendsMessage);
            } else {
                // If we have friendsData but no cards, it might be a rendering issue
                // Let's try to refresh the entire list
                loadFriends();
                return;
            }
        } else {
            // Add online section
            const onlineHeading = document.createElement('div');
            onlineHeading.className = 'friend-status';
            onlineHeading.textContent = `Online Friends (${onlineCards.length})`;
            fragment.appendChild(onlineHeading);
            
            if (onlineCards.length > 0) {
                // Add all online cards
                onlineCards.forEach(card => fragment.appendChild(card.cloneNode(true)));
            } else {
                // No online friends
                const noOnlineFriends = document.createElement('div');
                noOnlineFriends.className = 'empty-list-message';
                noOnlineFriends.textContent = 'None of your friends are online right now.';
                fragment.appendChild(noOnlineFriends);
            }
            
            // Add offline section
            const offlineHeading = document.createElement('div');
            offlineHeading.className = 'friend-status';
            offlineHeading.textContent = `Offline Friends (${offlineCards.length})`;
            fragment.appendChild(offlineHeading);
            
            if (offlineCards.length > 0) {
                // Add all offline cards
                offlineCards.forEach(card => fragment.appendChild(card.cloneNode(true)));
            } else {
                // No offline friends
                const noOfflineFriends = document.createElement('div');
                noOfflineFriends.className = 'empty-list-message';
                noOfflineFriends.textContent = 'All your friends are currently online!';
                fragment.appendChild(noOfflineFriends);
            }
        }
        
        // Replace existing content
        friendsList.innerHTML = '';
        friendsList.appendChild(fragment);
        
        // Re-attach event listeners
        addFriendCardEventListeners();
    }
    
    // Function to refresh the friends list
    function refreshFriendsList() {
        loadFriends();
    }
    
    // Function to check friend request status
    function checkFriendRequestStatus(username) {
        fetch('/api/check-friend-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetUsername: username })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'can_send_request') {
                // Show confirmation overlay
                pendingFriendRequest.targetUsername = data.targetUser.username;
                pendingFriendRequest.targetUserId = data.targetUser.id;
                pendingFriendRequest.targetAvatar = data.targetUser.avatar;
                
                // Set the avatar and username in the confirmation dialog
                friendRequestAvatar.src = data.targetUser.avatar;
                friendRequestUsername.textContent = data.targetUser.username;
                friendRequestMessage.textContent = `Do you want to send a friend request?`;
                
                // Show the overlay
                friendRequestOverlay.classList.remove('hidden');
            } else if (data.status === 'already_friends') {
                parent.window.mainFrame.toast.normal(`You are already friends with ${data.targetUser.username}.`);
            } else if (data.status === 'invite_already_sent') {
                parent.window.mainFrame.toast.normal(`You have already sent a friend request to ${data.targetUser.username}.`);
            } else if (data.status === 'invite_already_received') {
                parent.window.mainFrame.toast.info(`${data.targetUser.username} has already sent you a friend request. Check your invites!`);
            } else if (data.status === 'not_found') {
                parent.window.mainFrame.toast.warn('User not found. Please check the username and try again.');
            } else {
                parent.window.mainFrame.toast.error('Unable to process your request at this time.');
            }
        })
        .catch(error => {
            console.error('Error checking friend request status:', error);
            parent.window.mainFrame.toast.error('Failed to check friend request status. Please try again later.');
        });
    }
    
    // Function to send friend request
    function sendFriendRequest() {
        if (!pendingFriendRequest.targetUserId) {
            parent.window.mainFrame.toast.error('Invalid request. Please try again.');
            return;
        }
        
        fetch('/api/send-friend-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetUserId: pendingFriendRequest.targetUserId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                parent.window.mainFrame.toast.success(`Friend request sent to ${pendingFriendRequest.targetUsername} successfully!`);
                friendInviteInput.value = '';
            } else {
                parent.window.mainFrame.toast.error(`Failed to send friend request: ${data.error}`);
            }
            // Close the overlay
            friendRequestOverlay.classList.add('hidden');
            // Reset the pending request
            pendingFriendRequest.targetUsername = null;
            pendingFriendRequest.targetUserId = null;
            pendingFriendRequest.targetAvatar = null;
        })
        .catch(error => {
            console.error('Error sending friend request:', error);
            parent.window.mainFrame.toast.error('Failed to send friend request. Please try again later.');
            friendRequestOverlay.classList.add('hidden');
        });
    }
    
    // Function to show profile overlay
    function showProfile(userId) {
        // For now, we'll just show the existing profile overlay with placeholder data
        // In a real implementation, we would fetch the user's profile data from the server
        if (profileOverlay) {
            profileOverlay.classList.remove('hidden');
            // Additional logic to populate the profile overlay with user data would go here
        }
    }
    
    // Function to show chat dialog
    function showChat(userId) {
        // Get the friend's data from the friend card
        const friendCard = document.querySelector(`.friend-card[data-user-id="${userId}"]`);
        if (!friendCard) return;
        
        const friendName = friendCard.querySelector('.friend-name').textContent;
        const friendAvatar = friendCard.querySelector('.friend-avatar').src;
        const statusDot = friendCard.querySelector('.status-dot').cloneNode(true);
        
        // Get game status based on online/offline state
        let gameStatus;
        if (friendCard.classList.contains('online')) {
            gameStatus = friendCard.querySelector('.friend-current-game').textContent;
        } else {
            gameStatus = 'Offline';
        }
        
        // Show the chat dialog
        chatDialog.classList.remove('hidden');
        
        // Reset the chat input height and position
        if (chatInput) {
            chatInput.style.height = 'auto';
            const chatDialogInput = document.querySelector('.chat-dialog-input');
            if (chatDialogInput) {
                chatDialogInput.style.top = basePosition+'vw';
            }
        }
        
        // Load conversations
        loadConversations();
        
        // Show chat with this friend (will either find existing conversation or create new one)
        showFriendChat(userId, friendName, friendAvatar, statusDot, gameStatus);
    }
    
    function getDraftKey(conversationId) {
        if (conversationId === null || conversationId === undefined) {
            return null;
        }
        return String(conversationId);
    }

    function getConversationMessageStore(conversationId, { createIfMissing = true } = {}) {
        const key = getDraftKey(conversationId);
        if (!key) return null;

        let store = conversationMessageIndex.get(key);

        if (!store && createIfMissing) {
            store = new Map();
            conversationMessageIndex.set(key, store);
        }

        return store || null;
    }

    function resetConversationMessageStore(conversationId) {
        const key = getDraftKey(conversationId);
        if (!key) return;
        conversationMessageIndex.set(key, new Map());
    }

    function rememberMessageForConversation(message) {
        if (!message || !message.MessageID) return;
        const store = getConversationMessageStore(message.ConversationID);
        if (!store) return;
        store.set(message.MessageID, message);
    }

    function getCachedReplyMessage(messageId) {
        if (!messageId) return null;
        if (replyMessageCache.has(messageId)) {
            return replyMessageCache.get(messageId);
        }
        return null;
    }

    function cacheReplyMessage(messageId, message) {
        if (!messageId) return;
        replyMessageCache.set(messageId, message || null);
    }

    function fetchReplyMessage(messageId) {
        if (!messageId) return Promise.resolve(null);

        if (replyMessageCache.has(messageId)) {
            return Promise.resolve(replyMessageCache.get(messageId));
        }

        if (replyMessageFetchPromises.has(messageId)) {
            return replyMessageFetchPromises.get(messageId);
        }

        const fetchPromise = fetch(`/api/messages/${messageId}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().catch(() => ({})).then(data => {
                        throw new Error(data.error || 'Failed to fetch message');
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success && data.message) {
                    cacheReplyMessage(messageId, data.message);
                    rememberMessageForConversation(data.message);
                    return data.message;
                }
                cacheReplyMessage(messageId, null);
                return null;
            })
            .catch(error => {
                console.error('Error fetching reply message:', error);
                cacheReplyMessage(messageId, null);
                return null;
            })
            .finally(() => {
                replyMessageFetchPromises.delete(messageId);
            });

        replyMessageFetchPromises.set(messageId, fetchPromise);
        return fetchPromise;
    }

    function dispatchAttachmentEvent(eventName, detail = {}) {
        try {
            const event = new CustomEvent(eventName, {
                detail,
                bubbles: false,
                cancelable: false
            });
            document.dispatchEvent(event);
            return event.detail || detail;
        } catch (error) {
            console.error(`Error dispatching ${eventName} event:`, error);
            return detail;
        }
    }

    function captureAttachmentDraft() {
        const detail = dispatchAttachmentEvent(DRAFT_ATTACHMENT_EVENTS.COLLECT, { attachments: [] });
        const attachments = detail && Array.isArray(detail.attachments) ? detail.attachments : [];
        return attachments.slice();
    }

    function restoreAttachmentDraft(attachments) {
        if (!attachments || attachments.length === 0) {
            clearAttachmentDraftUI();
            return;
        }

        dispatchAttachmentEvent(DRAFT_ATTACHMENT_EVENTS.RESTORE, {
            attachments: attachments.slice()
        });
    }

    function clearAttachmentDraftUI() {
        dispatchAttachmentEvent(DRAFT_ATTACHMENT_EVENTS.CLEAR);
    }

    function setReplyPreviewFromDraft(replyDraft, { suppressResize = false } = {}) {
        if (!replyPreview) return;

        if (replyDraft) {
            replyingToMessage = {
                id: replyDraft.id,
                senderId: replyDraft.senderId,
                text: replyDraft.text,
                senderName: replyDraft.senderName
            };

            const previewText = replyingToMessage.text && replyingToMessage.text.length > 200
                ? `${replyingToMessage.text.substring(0, 200)}...`
                : (replyingToMessage.text || '');

            replyPreviewContent.textContent = previewText;
            replyPreview.classList.add('active');
        } else {
            replyingToMessage = null;
            replyPreviewContent.textContent = '';
            replyPreview.classList.remove('active');
        }

        if (!suppressResize && typeof autoResizeTextarea === 'function') {
            autoResizeTextarea();
        }
    }

    function resetComposerState() {
        if (chatInput && chatInput.value !== '') {
            chatInput.value = '';
        }

        setReplyPreviewFromDraft(null, { suppressResize: true });
        clearAttachmentDraftUI();

        if (typeof autoResizeTextarea === 'function') {
            autoResizeTextarea();
        }
    }

    function captureComposerState() {
        if (!chatInput) return null;

        const messageValue = chatInput.value;
        const draftReply = replyingToMessage ? { ...replyingToMessage } : null;
        const attachments = captureAttachmentDraft();

        const hasMessageContent = messageValue && messageValue.trim().length > 0;
        const hasReply = !!draftReply;
        const hasAttachments = attachments.length > 0;

        if (!hasMessageContent && !hasReply && !hasAttachments) {
            return null;
        }

        return {
            message: messageValue,
            reply: draftReply,
            attachments,
            savedAt: Date.now()
        };
    }

    function enforceDraftLimit() {
        if (conversationDrafts.size <= MAX_CONVERSATION_DRAFTS) {
            return;
        }

        let oldestKey = null;
        let oldestTimestamp = Number.POSITIVE_INFINITY;

        conversationDrafts.forEach((draft, key) => {
            if (draft.savedAt && draft.savedAt < oldestTimestamp) {
                oldestTimestamp = draft.savedAt;
                oldestKey = key;
            }
        });

        if (oldestKey !== null) {
            conversationDrafts.delete(oldestKey);
        }
    }

    function persistCurrentDraft() {
        const draftKey = getDraftKey(currentConversationId);
        if (!draftKey) return;

        if (typeof sendTypingIndicator === 'function') {
            sendTypingIndicator(false);
        }

        const composerState = captureComposerState();

        if (!composerState) {
            conversationDrafts.delete(draftKey);
            return;
        }

        conversationDrafts.set(draftKey, composerState);
        enforceDraftLimit();
    }

    function restoreConversationDraft(conversationId) {
        const draftKey = getDraftKey(conversationId);

        if (!draftKey) {
            resetComposerState();
            return;
        }

        const draft = conversationDrafts.get(draftKey);

        if (!draft) {
            resetComposerState();
            return;
        }

        if (chatInput) {
            chatInput.value = draft.message || '';
        }

        setReplyPreviewFromDraft(draft.reply, { suppressResize: true });

        if (typeof autoResizeTextarea === 'function') {
            autoResizeTextarea();
        }

        if (draft.attachments && draft.attachments.length > 0) {
            restoreAttachmentDraft(draft.attachments);
        } else {
            clearAttachmentDraftUI();
        }

        if (chatInput) {
            chatInput.focus();
        }
    }

    // Function to initialize WebSocket connection
    function initWebSocket() {
        // Close any existing connection
        if (socket) {
            socket.close();
        }
        
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        socket = new WebSocket(`${protocol}//${host}`);
        
        // Connection opened
        socket.addEventListener('open', (event) => {
            console.log('WebSocket connection established');
            
            // Get current user ID from session
            fetch('/api/current-user')
                .then(response => response.json())
                .then(data => {
                    if (data.userId) {
                        // Authenticate WebSocket connection
                        socket.send(JSON.stringify({
                            type: 'authenticate',
                            userId: data.userId
                        }));
                    }
                })
                .catch(error => {
                    console.error('Error fetching current user:', error);
                });
        });
        
        // Connection closed
        socket.addEventListener('close', (event) => {
            console.log('WebSocket connection closed');
            // Try to reconnect after a delay
            setTimeout(() => {
                console.log('Attempting to reconnect WebSocket...');
                initWebSocket();
            }, 5000);
        });
        
        // Connection error
        socket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
        });
        
        // Listen for messages
        socket.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle different message types
                if (data.type === 'status_update') {
                    handleStatusUpdate(data.user);
                }
                else if (data.type === 'message_received') {
                    handleMessageReceived(data.message);
                }
                else if (data.type === 'typing_start') {
                    handleTypingIndicator(data.conversationId, data.user, true);
                }
                else if (data.type === 'typing_stop') {
                    handleTypingIndicator(data.conversationId, data.user, false);
                }
                else if (data.type === 'read_status_update') {
                    handleReadStatusUpdate(data.conversationId, data.messageId, data.user);
                }
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        });
    }
    
    // Function to handle friend status updates
    function handleStatusUpdate(user) {
        // Store/update the user data
        friendsData.set(user.id, {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            status: user.status
        });
        
        // Update the UI
        updateFriendCardStatus(user.id, user.status);
    }
    
    // Function to handle received messages
    function handleMessageReceived(message) {
        // Only show message if we're currently viewing this conversation
        if (currentConversationId === message.ConversationID) {
            // Add the message to the display
            displayMessages([message], true);
            
            // Scroll to bottom
            const messagesContainer = document.querySelector('.chat-dialog-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // Check visible messages and update read receipt
                setTimeout(() => {
                    checkVisibleMessages();
                }, 100);
            }
        }
        
        rememberMessageForConversation(message);

        // Update conversation preview in sidebar (if visible)
        updateConversationPreview(message);
    }
    
    // Function to handle read status updates from other users
    function handleReadStatusUpdate(conversationId, messageId, user) {
        // Only handle read status updates for current conversation
        if (currentConversationId !== conversationId) {
            return;
        }
        
        const messagesContainer = document.querySelector('.chat-dialog-messages');
        if (!messagesContainer) return;
        
        // Update the read status in allReadStatuses
        try {
            const allReadStatuses = JSON.parse(messagesContainer.dataset.allReadStatuses || '{}');
            const oldMessageId = allReadStatuses[user.id];
            allReadStatuses[user.id] = messageId;
            messagesContainer.dataset.allReadStatuses = JSON.stringify(allReadStatuses);
            
            // Update UI
            updateReadMarkerUI(user.id, messageId, oldMessageId);
        } catch (error) {
            console.error('Error handling read status update:', error);
        }
    }
    
    // Store typing indicators by conversation
    const typingUsers = new Map(); // conversationId -> Set of userIds
    
    // Function to handle typing indicators
    function handleTypingIndicator(conversationId, user, isTyping) {
        // Only handle typing indicators for current conversation
        if (currentConversationId !== conversationId) {
            return;
        }
        
        if (!typingUsers.has(conversationId)) {
            typingUsers.set(conversationId, new Set());
        }
        
        const conversationTyping = typingUsers.get(conversationId);
        
        if (isTyping) {
            conversationTyping.add(user.id);
        } else {
            conversationTyping.delete(user.id);
        }
        
        // Update typing indicator UI
        updateTypingIndicatorUI(conversationId, conversationTyping);
    }
    
    // Function to update conversation preview in sidebar
    function updateConversationPreview(message) {
        const conversationItem = document.querySelector(`[data-conversation-id="${message.ConversationID}"]`);
        if (conversationItem) {
            const previewElement = conversationItem.querySelector('.conversation-preview');
            
            if (previewElement) {
                previewElement.textContent = `${message.UserName}: ${message.Message}`;
            }
            
            // Move conversation to top of list
            const conversationList = conversationItem.parentNode;
            if (conversationList) {
                conversationList.insertBefore(conversationItem, conversationList.firstChild);
            }
        }
    }
    
    // Function to update typing indicator UI
    function updateTypingIndicatorUI(conversationId, typingUserIds) {
        const typingContainer = document.querySelector('.typing-indicator');
        
        if (typingUserIds.size === 0) {
            // Hide typing indicator
            if (typingContainer) {
                typingContainer.style.display = 'none';
            }
        } else {
            // Show typing indicator
            if (!typingContainer) {
                // Create typing indicator element if it doesn't exist
                const messagesContainer = document.querySelector('.chat-dialog-messages');
                if (messagesContainer) {
                    const indicator = document.createElement('div');
                    indicator.className = 'typing-indicator';
                    indicator.innerHTML = `
                        <div class="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <div class="typing-text"></div>
                    `;
                    messagesContainer.appendChild(indicator);
                }
            }
            
            const indicator = document.querySelector('.typing-indicator');
            const textElement = indicator?.querySelector('.typing-text');
            
            if (indicator && textElement) {
                indicator.style.display = 'block';
                
                // Create typing text based on number of users
                const typingArray = Array.from(typingUserIds);
                let typingText = '';
                
                if (typingArray.length === 1) {
                    const userId = typingArray[0];
                    const user = friendsData.get(userId);
                    typingText = `${user?.username || 'Someone'} is typing...`;
                } else if (typingArray.length === 2) {
                    const user1 = friendsData.get(typingArray[0]);
                    const user2 = friendsData.get(typingArray[1]);
                    typingText = `${user1?.username || 'Someone'} and ${user2?.username || 'someone'} are typing...`;
                } else {
                    typingText = 'Several people are typing...';
                }
                
                textElement.textContent = typingText;
                
                // Scroll to bottom to show typing indicator
                const messagesContainer = document.querySelector('.chat-dialog-messages');
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }
        }
    }
    
    // Function to update the status of a friend card in the UI
    function updateFriendCardStatus(userId, status) {
        // Find the friend card
        const friendCard = document.querySelector(`.friend-card[data-user-id="${userId}"]`);
        if (!friendCard) return; // Card not found
        
        // Store previous status for checking if it changed
        const previousStatus = friendCard.classList.contains('online') ? 'online' : 'offline';
        
        // Skip update if status hasn't changed
        if ((status === 'online' && previousStatus === 'online') || 
            (status === 'offline' && previousStatus === 'offline')) {
            return;
        }
        
        // Add a highlight animation class
        friendCard.classList.add('status-change');
        setTimeout(() => {
            friendCard.classList.remove('status-change');
        }, 2000);
        
        // Update class and status dot
        if (status === 'online') {
            friendCard.classList.remove('offline');
            friendCard.classList.add('online');
            friendCard.querySelector('.status-dot').classList.remove('gray');
            friendCard.querySelector('.status-dot').classList.add('blue');
            friendCard.querySelector('.friend-status-info').textContent = 'Online Now';
            friendCard.querySelector('.friend-status-info').className = 'friend-status-info online';
            
            // Update game info element
            const gameInfo = friendCard.querySelector('.friend-last-game');
            if (gameInfo) {
                gameInfo.className = 'friend-current-game';
                
                // Use the data from friendsData map if available, otherwise use a generic message
                const userData = friendsData.get(userId);
                if (userData && userData.currentGame) {
                    gameInfo.textContent = `Playing: ${userData.currentGame}`;
                } else {
                    gameInfo.textContent = 'In Lobby';
                }
            }
        } else {
            friendCard.classList.remove('online');
            friendCard.classList.add('offline');
            friendCard.querySelector('.status-dot').classList.remove('blue');
            friendCard.querySelector('.status-dot').classList.add('gray');
            friendCard.querySelector('.friend-status-info').textContent = 'Last online: just now';
            friendCard.querySelector('.friend-status-info').className = 'friend-status-info offline';
            
            // Update game info element
            const gameInfo = friendCard.querySelector('.friend-current-game');
            if (gameInfo) {
                gameInfo.className = 'friend-last-game';
                const user = friendsData.get(userId);
                if (user && user.lastGame) {
                    gameInfo.textContent = `Last played: ${user.lastGame}`;
                } else {
                    gameInfo.textContent = 'No recent games';
                }
            }
        }
        
        // Always re-organize the friends list when a status changes
        reorganizeFriendsList();
    }
    
    // Confirm friend request button
    if (confirmFriendRequestBtn) {
        confirmFriendRequestBtn.addEventListener('click', () => {
            sendFriendRequest();
        });
    }
    
    // Cancel friend request button
    if (cancelFriendRequestBtn) {
        cancelFriendRequestBtn.addEventListener('click', () => {
            friendRequestOverlay.classList.add('hidden');
            pendingFriendRequest.targetUsername = null;
            pendingFriendRequest.targetUserId = null;
            pendingFriendRequest.targetAvatar = null;
        });
    }
    
    // Close friend request overlay
    if (friendRequestCloseBtn) {
        friendRequestCloseBtn.addEventListener('click', () => {
            friendRequestOverlay.classList.add('hidden');
            pendingFriendRequest.targetUsername = null;
            pendingFriendRequest.targetUserId = null;
            pendingFriendRequest.targetAvatar = null;
        });
    }

    // Friend invites overlay elements
    const friendInvitesOverlay = document.getElementById('friend-invites-overlay');
    const friendInvitesList = document.getElementById('friend-invites-list');
    const friendInvitesCloseBtn = friendInvitesOverlay ? friendInvitesOverlay.querySelector('.overlay-close') : null;

    // Show invites functionality
    if (showInvitesBtn) {
        showInvitesBtn.addEventListener('click', () => {
            loadFriendRequests();
        });
    }
    
    // Close friend invites overlay
    if (friendInvitesCloseBtn) {
        friendInvitesCloseBtn.addEventListener('click', () => {
            friendInvitesOverlay.classList.add('hidden');
        });
    }
    
    // Function to update the friend request count
    function updateFriendRequestCount() {
        fetch('/api/friend-requests')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update the invite count in the button
                    const inviteCountElement = document.querySelector('.invite-count');
                    if (inviteCountElement) {
                        inviteCountElement.textContent = data.count;
                    }
                }
            })
            .catch(error => {
                console.error('Error updating friend request count:', error);
            });
    }
    
    // Function to accept a friend request
    function acceptFriendRequest(inviteId) {
        // Disable the buttons for this invite to prevent multiple clicks
        const inviteCard = document.querySelector(`.invite-card[data-invite-id="${inviteId}"]`);
        if (inviteCard) {
            const buttons = inviteCard.querySelectorAll('.invite-btn');
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            });
        }
        
        fetch('/api/friend-requests/accept', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inviteId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                if (inviteCard) {
                    inviteCard.innerHTML = `
                        <div class="invite-header">
                            <img src="${data.friend.avatar}" alt="${data.friend.username}'s avatar" class="invite-avatar">
                            <div class="invite-info">
                                <div class="invite-username">${data.friend.username}</div>
                                <div class="invite-message" style="color: #4eff7a;">Friend request accepted!</div>
                            </div>
                        </div>
                    `;
                    
                    // Add animation class
                    inviteCard.classList.add('fade-out');
                    
                    // Remove the card after animation
                    setTimeout(() => {
                        inviteCard.remove();
                        
                        // If this was the last invite, show the no invites message
                        if (friendInvitesList.children.length === 0) {
                            friendInvitesList.innerHTML = `
                                <div class="no-invites-message">
                                    <p>You don't have any friend requests at the moment.</p>
                                </div>
                            `;
                        }
                    }, 2000);
                }
                
                // Update the friend request count
                updateFriendRequestCount();
                
                // Refresh friends list if it's visible
                refreshFriendsList();
            } else {
                parent.window.mainFrame.toast.error(`Failed to accept friend request: ${data.error}`);
                // Re-enable buttons if there was an error
                if (inviteCard) {
                    const buttons = inviteCard.querySelectorAll('.invite-btn');
                    buttons.forEach(btn => {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error accepting friend request:', error);
            parent.window.mainFrame.toast.error('An error occurred while accepting the friend request.');
            // Re-enable buttons if there was an error
            if (inviteCard) {
                const buttons = inviteCard.querySelectorAll('.invite-btn');
                buttons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                });
            }
        });
    }
    
    // Function to decline a friend request
    function declineFriendRequest(inviteId) {
        // Disable the buttons for this invite to prevent multiple clicks
        const inviteCard = document.querySelector(`.invite-card[data-invite-id="${inviteId}"]`);
        if (inviteCard) {
            const buttons = inviteCard.querySelectorAll('.invite-btn');
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            });
        }
        
        fetch('/api/friend-requests/decline', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inviteId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Add animation class
                if (inviteCard) {
                    inviteCard.classList.add('fade-out');
                    
                    // Remove the card after animation
                    setTimeout(() => {
                        inviteCard.remove();
                        
                        // If this was the last invite, show the no invites message
                        if (friendInvitesList.children.length === 0) {
                            friendInvitesList.innerHTML = `
                                <div class="no-invites-message">
                                    <p>You don't have any friend requests at the moment.</p>
                                </div>
                            `;
                        }
                    }, 1000);
                }
                
                // Update the friend request count
                updateFriendRequestCount();
            } else {
                parent.window.mainFrame.toast.error(`Failed to decline friend request: ${data.error}`);
                // Re-enable buttons if there was an error
                if (inviteCard) {
                    const buttons = inviteCard.querySelectorAll('.invite-btn');
                    buttons.forEach(btn => {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error declining friend request:', error);
            parent.window.mainFrame.toast.error('An error occurred while declining the friend request.');
            // Re-enable buttons if there was an error
            if (inviteCard) {
                const buttons = inviteCard.querySelectorAll('.invite-btn');
                buttons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                });
            }
        });
    }

    // Function to load friend requests
    function loadFriendRequests() {
        fetch('/api/friend-requests')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update the invite count in the button
                    const inviteCountElement = document.querySelector('.invite-count');
                    if (inviteCountElement) {
                        inviteCountElement.textContent = data.count;
                    }
                    
                    // Clear the current list
                    friendInvitesList.innerHTML = '';
                    
                    if (data.invites.length === 0) {
                        // Display no invites message
                        friendInvitesList.innerHTML = `
                            <div class="no-invites-message">
                                <p>You don't have any friend requests at the moment.</p>
                            </div>
                        `;
                    } else {
                        // Create a card for each invite
                        data.invites.forEach(invite => {
                            const inviteCard = document.createElement('div');
                            inviteCard.className = 'invite-card';
                            inviteCard.dataset.inviteId = invite.InviteID;
                            
                            inviteCard.innerHTML = `
                                <div class="invite-header">
                                    <img src="${invite.Avatar}" alt="${invite.UserName}'s avatar" class="invite-avatar">
                                    <div class="invite-info">
                                        <div class="invite-username">${invite.UserName}</div>
                                        <div class="invite-message">Sent you a friend request</div>
                                    </div>
                                </div>
                                <div class="invite-actions">
                                    <button class="invite-btn accept" data-invite-id="${invite.InviteID}" data-action="accept">Accept</button>
                                    <button class="invite-btn decline" data-invite-id="${invite.InviteID}" data-action="decline">Decline</button>
                                </div>
                            `;
                            
                            friendInvitesList.appendChild(inviteCard);
                        });
                        
                        // Add event listeners to the buttons
                        const acceptButtons = friendInvitesList.querySelectorAll('.invite-btn.accept');
                        const declineButtons = friendInvitesList.querySelectorAll('.invite-btn.decline');
                        
                        acceptButtons.forEach(button => {
                            button.addEventListener('click', (e) => {
                                const inviteId = e.target.dataset.inviteId;
                                acceptFriendRequest(inviteId);
                            });
                        });
                        
                        declineButtons.forEach(button => {
                            button.addEventListener('click', (e) => {
                                const inviteId = e.target.dataset.inviteId;
                                declineFriendRequest(inviteId);
                            });
                        });
                    }
                    
                    // Show the overlay
                    friendInvitesOverlay.classList.remove('hidden');
                } else {
                    parent.window.mainFrame.toast.error('Failed to load friend requests. Please try again later.');
                }
            })
            .catch(error => {
                console.error('Error loading friend requests:', error);
                parent.window.mainFrame.toast.error('An error occurred while loading friend requests.');
            });
    }

    // Chat functions
    // Function to show the main chat dialog (without specific conversation)
    function showMainChat() {
        persistCurrentDraft();
        currentConversationId = null;
        currentConversationData = null;
        resetComposerState();

        // Show the dialog
        chatDialog.classList.remove('hidden');
        
        // Show welcome screen, hide conversation view
        const chatWelcomeScreen = document.querySelector('.chat-welcome-screen');
        const chatConversationView = document.querySelector('.chat-conversation-view');
        
        if (chatWelcomeScreen && chatConversationView) {
            // Ensure welcome screen is fully visible
            chatWelcomeScreen.classList.remove('hidden');
            chatWelcomeScreen.style.display = 'flex';
            
            // Ensure conversation view is fully hidden
            chatConversationView.classList.add('hidden');
            chatConversationView.style.display = 'none';
        }
        
        // Deactivate all conversation items in the sidebar
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => item.classList.remove('active'));
        
        // Load conversations for the sidebar
        loadConversations();
    }
    
    // Function to show chat with a specific friend
    function showFriendChat(friendId, friendName, friendAvatar, statusDot, gameStatus) {
        persistCurrentDraft();

        // Show the dialog
        chatDialog.classList.remove('hidden');
        
        // Hide welcome screen, show conversation view
        const chatWelcomeScreen = document.querySelector('.chat-welcome-screen');
        const chatConversationView = document.querySelector('.chat-conversation-view');
        
        if (chatWelcomeScreen && chatConversationView) {
            // Ensure welcome screen is completely hidden
            chatWelcomeScreen.classList.add('hidden');
            chatWelcomeScreen.style.display = 'none';
            
            // Ensure conversation view is fully visible
            chatConversationView.classList.remove('hidden');
            chatConversationView.style.display = 'flex';
        }
        
        // Set the chat dialog info
        chatDialogUsername.textContent = friendName;
        chatDialogAvatar.src = friendAvatar;
        chatDialogGameStatus.textContent = gameStatus;
        
        // Update status dot in chat header
        const chatHeaderStatusDot = document.querySelector('.chat-dialog-avatar-container .status-dot');
        if (chatHeaderStatusDot) {
            chatHeaderStatusDot.className = statusDot.className;
        }
        
        // Find or create conversation with this friend after a short delay
        // to ensure the conversations have loaded in the sidebar
        setTimeout(() => {
            findOrCreateDirectConversation(friendId);
        }, 100);
    }
    
    // Function to load conversations for the sidebar
    function loadConversations() {
        const conversationList = document.querySelector('.chat-conversation-list');
        const noConversationsMessage = document.querySelector('.no-conversations-message');
        
        // Clear existing conversations (except no conversations message)
        const existingConversations = conversationList.querySelectorAll('.conversation-item');
        existingConversations.forEach(item => item.remove());
        
        // Load actual conversations from the server
        fetch('/api/conversations')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.conversations.length > 0) {
                    // Hide no conversations message
                    if (noConversationsMessage) {
                        noConversationsMessage.style.display = 'none';
                    }
                    
                    // Create conversation items
                    data.conversations.forEach(conversation => {
                        const conversationItem = createConversationItem(conversation);
                        conversationList.appendChild(conversationItem);
                    });
                } else {
                    // Show no conversations message
                    if (noConversationsMessage) {
                        noConversationsMessage.style.display = 'block';
                    }
                }
            })
            .catch(error => {
                console.error('Error loading conversations:', error);
                // Show no conversations message on error
                if (noConversationsMessage) {
                    noConversationsMessage.style.display = 'block';
                }
            });
    }
    
    // Function to update read status for a conversation (saves to database)
    function updateReadStatus(conversationId, lastMessageId = null, immediate = false) {
        if (!conversationId) return;
        
        // If immediate is false, just mark that we need to save later
        if (!immediate) {
            pendingReadStatusSave = true;
            return;
        }
        
        fetch(`/api/conversations/${conversationId}/read-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messageId: lastMessageId })
        })
        .then(() => {
            pendingReadStatusSave = false;
        })
        .catch(error => {
            console.error('Error updating read status:', error);
        });
    }
    
    // Function to save pending read status to database
    function savePendingReadStatus() {
        if (pendingReadStatusSave && currentConversationId && currentReadMessageId) {
            updateReadStatus(currentConversationId, currentReadMessageId, true);
        }
    }
    
    // Function to update live read receipt visuals
    function updateLiveReadReceipt(messageId, sendWS = true) {
        if (!currentUserId || !messageId) return;
        
        // Don't allow read receipt to go backwards
        if (currentReadMessageId) {
            const numericMessageId = parseInt(messageId, 10);
            const numericCurrentReadMessageId = parseInt(currentReadMessageId, 10);
            
            if (!Number.isNaN(numericMessageId) &&
                !Number.isNaN(numericCurrentReadMessageId) &&
                numericMessageId <= numericCurrentReadMessageId) {
                return;
            }
        }
        
        const oldReadMessageId = currentReadMessageId;
        currentReadMessageId = messageId;
        pendingReadStatusSave = true;
        
        // Send read status update via WebSocket to other users (throttled)
        if (sendWS && socket && socket.readyState === WebSocket.OPEN && currentConversationId) {
            // Clear existing throttle timer
            if (wsReadStatusThrottle) {
                clearTimeout(wsReadStatusThrottle);
            }
            
            // Throttle WS sends to avoid spam
            wsReadStatusThrottle = setTimeout(() => {
                socket.send(JSON.stringify({
                    type: 'read_status_update',
                    conversationId: currentConversationId,
                    messageId: currentReadMessageId
                }));
                wsReadStatusThrottle = null;
            }, WS_READ_THROTTLE_MS);
        }
        
        // Update UI
        updateReadMarkerUI(currentUserId, messageId, oldReadMessageId);
    }
    
    // Function to update read marker UI for a specific user
    function updateReadMarkerUI(userId, newMessageId, oldMessageId) {
        const messagesContainer = document.querySelector('.chat-dialog-messages');
        if (!messagesContainer) return;
        
        // Remove any existing read indicators for this user
        const existingIndicators = messagesContainer.querySelectorAll(`.message-read-status [data-read-by-user="${userId}"]`);
        existingIndicators.forEach(indicator => indicator.remove());
        
        // Add new read indicator
        const newMessage = messagesContainer.querySelector(`[data-message-id="${newMessageId}"]`);
        if (!newMessage) return;
        
        // Get user info
        const getUserInfo = userId === currentUserId 
            ? fetch('/api/current-user').then(r => r.json()).then(d => ({ avatar: d.avatar, username: 'You' }))
            : fetch(`/api/users/${userId}`).then(r => r.json()).then(d => d.success ? { avatar: d.user.avatar, username: d.user.username } : null);
        
        getUserInfo.then(userInfo => {
            if (!userInfo) return;
            
            // Create or get read status container
            let readStatusContainer = newMessage.querySelector('.message-read-status');
            if (!readStatusContainer) {
                readStatusContainer = document.createElement('div');
                readStatusContainer.className = 'message-read-status';
                newMessage.appendChild(readStatusContainer);
            }
            
            // Add avatar for this user
            const avatarImg = document.createElement('img');
            avatarImg.className = 'read-status-avatar';
            avatarImg.src = userInfo.avatar || 'lib/avatars/Colors/FillBlack';
            avatarImg.alt = `${userInfo.username} read`;
            avatarImg.title = `${userInfo.username} read up to here`;
            avatarImg.dataset.readByUser = userId;
            
            readStatusContainer.appendChild(avatarImg);
        }).catch(error => {
            console.error('Error updating read marker UI:', error);
        });
    }
    
    // Function to setup IntersectionObserver for message visibility tracking
    function setupMessageObserver() {
        const messagesContainer = document.querySelector('.chat-dialog-messages');
        if (!messagesContainer) return;
        
        // Disconnect existing observer
        if (messageObserver) {
            messageObserver.disconnect();
        }
        
        // Create observer to track messages near the bottom of viewport
        const observerOptions = {
            root: messagesContainer,
            rootMargin: '-100px 0px 0px 0px', // Trigger when message is 100px above bottom
            threshold: 0.1
        };
        
        messageObserver = new IntersectionObserver((entries) => {
            // Find the last visible message (highest messageId that's intersecting)
            let lastVisibleMessageId = null;
            
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageId = parseInt(entry.target.dataset.messageId);
                    if (isNaN(messageId)) {
                        return;
                    }
                    if (!lastVisibleMessageId || messageId > lastVisibleMessageId) {
                        lastVisibleMessageId = messageId;
                    }
                }
            });
            
            // Update read receipt if we found a visible message
            if (lastVisibleMessageId) {
                // Debounce the update
                clearTimeout(readStatusUpdateTimeout);
                readStatusUpdateTimeout = setTimeout(() => {
                    updateLiveReadReceipt(lastVisibleMessageId);
                }, 300);
            }
        }, observerOptions);
        
        // Observe all message elements
        const messageElements = messagesContainer.querySelectorAll('[data-message-id]');
        messageElements.forEach(el => messageObserver.observe(el));
    }
    
    // Function to check which messages are visible and update read receipt (DEPRECATED - keeping for compatibility)
    function checkVisibleMessages() {
        // This function is now handled by IntersectionObserver
        // Kept for any existing calls during transition
        setupMessageObserver();
    }
    
    // Function to load messages for a specific conversation
    function loadMessages(conversationId, offset = 0) {
        if (!conversationId) return;
        
        const messagesContainer = document.querySelector('.chat-dialog-messages');
        if (!messagesContainer) return;

        if (offset === 0) {
            resetConversationMessageStore(conversationId);
        }
        
        // Show loading if this is the initial load
        if (offset === 0) {
            messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
            lastDisplayedDate = null; // Reset date tracking for new conversation
        }
        
        fetch(`/api/conversations/${conversationId}/messages?limit=50&offset=${offset}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (offset === 0) {
                        // Clear container for initial load
                        messagesContainer.innerHTML = '';
                        
                        // Remove existing scroll listener if any
                        messagesContainer.removeEventListener('scroll', scrollListener);
                        
                        // Add scroll listener for loading more messages and tracking read status
                        scrollListener = () => {
                            if (messagesContainer.scrollTop === 0 && !messagesContainer.dataset.loading) {
                                // Load more messages when scrolled to top
                                loadMoreMessages();
                            }
                            // Note: Read tracking now handled by IntersectionObserver
                        };
                        messagesContainer.addEventListener('scroll', scrollListener);
                    }
                    
                    if (data.messages.length === 0) {
                        if (offset === 0) {
                            messagesContainer.innerHTML = '<p class="start-conversation-message">Start your conversation here</p>';
                            // Mark conversation as read even if there are no messages
                            updateReadStatus(conversationId);
                        }
                        return;
                    }
                    
                    displayMessages(data.messages, offset === 0);
                    
                    // Handle scrolling and read status for initial load
                    if (offset === 0) {
                        // Store read status data for later use
                        messagesContainer.dataset.lastReadMessageId = data.lastReadMessageID || '';
                        messagesContainer.dataset.allReadStatuses = JSON.stringify(data.allReadStatuses || {});
                        
                        // Initialize current read message ID from server data
                        currentReadMessageId = data.lastReadMessageID || null;
                        
                        // Add read status indicators (user avatars)
                        addReadStatusIndicators(messagesContainer);
                        
                        // Find first unread message
                        let firstUnreadMessageElement = null;
                        if (data.lastReadMessageID) {
                            // Find message after the last read one
                            const messageElements = messagesContainer.querySelectorAll('[data-message-id]');
                            const lastReadIndex = Array.from(messageElements).findIndex(el => 
                                parseInt(el.dataset.messageId) === data.lastReadMessageID
                            );
                            
                            if (lastReadIndex !== -1 && lastReadIndex < messageElements.length - 1) {
                                firstUnreadMessageElement = messageElements[lastReadIndex + 1];
                            }
                        } else if (data.messages.length > 0) {
                            // If no messages read yet, scroll to first message
                            firstUnreadMessageElement = messagesContainer.querySelector('[data-message-id]');
                        }
                        
                        // Scroll first unread message to bottom of screen
                        if (firstUnreadMessageElement) {
                            setTimeout(() => {
                                scrollMessageToBottom(firstUnreadMessageElement, messagesContainer);
                                // Setup IntersectionObserver after scrolling
                                setTimeout(() => {
                                    setupMessageObserver();
                                }, 150);
                            }, 100);
                        } else {
                            // No unread messages, scroll to very bottom
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            // Setup IntersectionObserver
                            setTimeout(() => {
                                setupMessageObserver();
                            }, 150);
                        }
                    }
                } else {
                    console.error('Failed to load messages:', data.error);
                    if (offset === 0) {
                        messagesContainer.innerHTML = '<p class="error-message">Failed to load messages</p>';
                    }
                }
            })
            .catch(error => {
                console.error('Error loading messages:', error);
                if (offset === 0) {
                    messagesContainer.innerHTML = '<p class="error-message">Error loading messages</p>';
                }
            });
    }
    
    // Helper function to scroll a message to the bottom of the screen
    function scrollMessageToBottom(messageElement, container) {
        const containerRect = container.getBoundingClientRect();
        const messageRect = messageElement.getBoundingClientRect();
        
        // Calculate the scroll position to place the message at the bottom
        const messageBottom = messageRect.bottom - containerRect.top;
        const scrollOffset = messageBottom - containerRect.height;
        
        container.scrollTop += scrollOffset;
    }
    
    // Helper function to add read status indicators (user avatars) under last read message
    function addReadStatusIndicators(messagesContainer) {
        const readStatusMap = JSON.parse(messagesContainer.dataset.allReadStatuses || '{}');
        const currentConversation = getCurrentConversation();
        
        if (!currentConversation || !currentConversation.Members) return;
        
        // For each member, find their last read message and add avatar under it
        const memberPromises = [];
        
        Object.entries(readStatusMap).forEach(([userId, lastReadMessageId]) => {
            if (!lastReadMessageId) return;
            
            memberPromises.push(
                fetch(`/api/users/${userId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.user) {
                            const user = data.user;
                            const messageElement = messagesContainer.querySelector(`[data-message-id="${lastReadMessageId}"]`);
                            
                            if (messageElement) {
                                // Check if read indicator already exists for this user/message combo
                                const existingIndicator = messageElement.querySelector(`[data-read-by-user="${userId}"]`);
                                if (existingIndicator) {
                                    return; // Already added
                                }
                                
                                // Create read status container if it doesn't exist
                                let readStatusContainer = messageElement.querySelector('.message-read-status');
                                if (!readStatusContainer) {
                                    readStatusContainer = document.createElement('div');
                                    readStatusContainer.className = 'message-read-status';
                                    messageElement.appendChild(readStatusContainer);
                                }
                                
                                // Add avatar for this user
                                const avatarImg = document.createElement('img');
                                avatarImg.className = 'read-status-avatar';
                                avatarImg.src = user.avatar || 'lib/avatars/Colors/FillBlack';
                                avatarImg.alt = `${user.username} read`;
                                avatarImg.title = `${user.username} read this message`;
                                avatarImg.dataset.readByUser = userId;
                                
                                readStatusContainer.appendChild(avatarImg);
                            }
                        }
                    })
                    .catch(error => {
                        console.error(`Error fetching user ${userId}:`, error);
                    })
            );
        });
        
        // Execute all promises
        Promise.all(memberPromises).catch(error => {
            console.error('Error adding read status indicators:', error);
        });
    }
    
    // Function to display messages in the chat
    function displayMessages(messages, isInitialLoad = true) {
        const messagesContainer = document.querySelector('.chat-dialog-messages');
        if (!messagesContainer) return;
        
        const fragment = document.createDocumentFragment();
        
        messages.forEach(message => {
            const messageStore = getConversationMessageStore(message.ConversationID);
            // Add date separator if needed
            const messageDate = new Date(message.TimeStamp).toDateString();
            if (lastDisplayedDate !== messageDate) {
                lastDisplayedDate = messageDate;
                const dateElement = document.createElement('p');
                dateElement.className = 'message-date';
                dateElement.textContent = formatMessageDate(message.TimeStamp);
                if (isInitialLoad) {
                    fragment.appendChild(dateElement);
                } else {
                    messagesContainer.insertBefore(dateElement, messagesContainer.firstChild);
                }
            }
            
            // Create message element
            const messageDiv = document.createElement('div');
            const isOwnMessage = message.SenderID === currentUserId;
            messageDiv.className = `message ${isOwnMessage ? 'user' : 'friend'}`;
            
            // Check if this is a group conversation
            const currentConversation = getCurrentConversation();
            const isGroupChat = currentConversation && currentConversation.Members.length > 2;
            
            // Add action buttons container
            let actionsHTML = '<div class="message-actions">';
            
            // Add buttons - 4 for user's own messages, 2 for friend's messages
            if (isOwnMessage) {
                actionsHTML += `
                    <button class="message-action-btn reply-btn" title="Reply">↩</button>
                    <button class="message-action-btn"></button>
                    <button class="message-action-btn"></button>
                    <button class="message-action-btn"></button>
                `;
            } else {
                actionsHTML += `
                    <button class="message-action-btn reply-btn" title="Reply">↩</button>
                    <button class="message-action-btn"></button>
                `;
            }
            
            actionsHTML += '</div>';
            
            let messageHTML = actionsHTML;
            
            if (!isOwnMessage && isGroupChat) {
                // Show sender name and avatar for group chats
                messageHTML += `
                    <div class="message-sender-info">
                        <img src="${message.Avatar}" alt="${message.UserName}" class="message-sender-avatar">
                        <span class="message-sender-name">${message.UserName}</span>
                    </div>
                `;
            }
            
            const replyPreviewBlock = buildReplyPreviewBlock(message, messageStore);
            if (replyPreviewBlock) {
                messageHTML += replyPreviewBlock;
            }
            
            messageHTML += `
                <div class="message-content">${escapeHtml(message.Message)}</div>
                <div class="message-time">${formatMessageTime(message.TimeStamp)}</div>
            `;
            
            messageDiv.innerHTML = messageHTML;
            
            // Store message data for reply functionality
            messageDiv.dataset.messageId = message.MessageID;
            messageDiv.dataset.messageId = message.MessageID;
            messageDiv.dataset.senderId = message.SenderID;
            messageDiv.dataset.messageText = message.Message;
            messageDiv.dataset.senderName = message.UserName || '';
            if (message.Reply) {
                messageDiv.dataset.replyToId = message.Reply;
            } else {
                delete messageDiv.dataset.replyToId;
            }
            
            rememberMessageForConversation(message);
            cacheReplyMessage(message.MessageID, message);
            
            // Add click event for reply button
            setTimeout(() => {
                const replyBtn = messageDiv.querySelector('.reply-btn');
                if (replyBtn) {
                    replyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handleReply(messageDiv);
                    });
                }
            }, 0);
            
            if (isInitialLoad) {
                fragment.appendChild(messageDiv);
            } else {
                messagesContainer.insertBefore(messageDiv, messagesContainer.firstChild);
            }
        });
        
        if (isInitialLoad) {
            messagesContainer.appendChild(fragment);
        }
    }
    
    // Store current conversation data
    let currentConversationData = null;
    
    // Function to get current conversation info
    function getCurrentConversation() {
        return currentConversationData;
    }
    
    // Variable to track message loading state
    let messageOffset = 0;
    let isLoadingMessages = false;
    let scrollListener = null;
    let lastDisplayedDate = null; // Track last displayed date across all messages
    
    // Function to load more messages when scrolling up
    function loadMoreMessages() {
        if (isLoadingMessages || !currentConversationId) return;
        
        isLoadingMessages = true;
        const messagesContainer = document.querySelector('.chat-dialog-messages');
        messagesContainer.dataset.loading = 'true';
        
        messageOffset += 10;
        
        fetch(`/api/conversations/${currentConversationId}/messages?limit=10&offset=${messageOffset}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.messages.length > 0) {
                    const oldScrollHeight = messagesContainer.scrollHeight;
                    displayMessages(data.messages, false);
                    // Maintain scroll position
                    messagesContainer.scrollTop = messagesContainer.scrollHeight - oldScrollHeight;
                }
                isLoadingMessages = false;
                delete messagesContainer.dataset.loading;
            })
            .catch(error => {
                console.error('Error loading more messages:', error);
                isLoadingMessages = false;
                delete messagesContainer.dataset.loading;
            });
    }
    
    // Chat button click handler
    chatButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Get the friend's data from the button's data attributes
            const friendId = e.target.getAttribute('data-user-id');
            const friendName = e.target.getAttribute('data-username');
            const friendAvatar = e.target.getAttribute('data-avatar');
            
            // Get the friend card for additional info
            const friendCard = e.target.closest('.friend-card');
            if (!friendCard) return;
            
            const statusDot = friendCard.querySelector('.status-dot').cloneNode(true);
            
            // Get game status based on online/offline state
            let gameStatus;
            if (friendCard.classList.contains('online')) {
                gameStatus = friendCard.querySelector('.friend-current-game').textContent;
            } else {
                gameStatus = 'Offline';
            }
            
            // Show chat with this friend
            showFriendChat(friendId, friendName, friendAvatar, statusDot, gameStatus);
        });
    });

    // Close chat dialog
    if (chatDialogClose) {
        chatDialogClose.addEventListener('click', () => {
            persistCurrentDraft();
            // Save pending read status before closing
            savePendingReadStatus();
            chatDialog.classList.add('hidden');
        });
    }
    
    // Open Chat main button
    const openChatBtn = document.getElementById('open-chat');
    if (openChatBtn) {
        openChatBtn.addEventListener('click', () => {
            showMainChat();
        });
    }
    
    // Mute chat toggle
    if (chatMuteBtn) {
        chatMuteBtn.addEventListener('click', () => {
            chatMuteBtn.classList.toggle('muted');
            
            // Update the icon and title based on mute status
            if (chatMuteBtn.classList.contains('muted')) {
                chatMuteBtn.textContent = '🔇';
                chatMuteBtn.title = 'Unmute Conversation';
            } else {
                chatMuteBtn.textContent = '🔊';
                chatMuteBtn.title = 'Mute Conversation';
            }
        });
    }

    // New Conversation button
    const newConversationBtn = document.querySelector('.new-conversation-btn');
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', () => {
            showNewConversationDialog();
        });
    }

    // New conversation dialog elements
    const newConversationDialog = document.getElementById('new-conversation-dialog');
    const newConversationClose = document.querySelector('.dialog-close');
    const prevStepBtn = document.getElementById('prev-step-btn');
    const nextStepBtn = document.getElementById('next-step-btn');
    const createConversationBtn = document.getElementById('create-conversation-btn');
    const cancelConversationBtn = document.getElementById('cancel-conversation-btn');

    // Dialog state
    let currentStep = 0;
    let selectedFriends = [];
    let selectedAvatar = '';
    const steps = ['select-friends-step', 'group-name-step', 'group-avatar-step', 'conversation-summary-step'];

    // Close new conversation dialog
    if (newConversationClose) {
        newConversationClose.addEventListener('click', () => {
            closeNewConversationDialog();
        });
    }

    if (cancelConversationBtn) {
        cancelConversationBtn.addEventListener('click', () => {
            closeNewConversationDialog();
        });
    }

    // Dialog navigation
    if (prevStepBtn) {
        prevStepBtn.addEventListener('click', () => {
            navigateToStep(currentStep - 1);
        });
    }

    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', () => {
            if (validateCurrentStep()) {
                navigateToStep(currentStep + 1);
            }
        });
    }

    if (createConversationBtn) {
        createConversationBtn.addEventListener('click', () => {
            createNewConversation();
        });
    }

    // Create conversation item HTML
    function createConversationItem(conversation) {
        const conversationItem = document.createElement('div');
        conversationItem.className = 'conversation-item';
        conversationItem.setAttribute('data-conversation-id', conversation.ConversationID);
        
        let displayName, avatarSrc, statusIndicatorHtml = '', activityStatus = '';
        
        if (conversation.Members.length === 2) {
            // Direct conversation - show other person's info
            const otherMember = conversation.Members.find(member => member.UserID !== getCurrentUserId());
            displayName = otherMember ? otherMember.UserName : 'Unknown User';
            avatarSrc = otherMember ? otherMember.Avatar : 'lib/avatars/Colors/FillBlack.png';
            
            // Store the other user's ID as a data attribute for direct conversations
            if (otherMember) {
                conversationItem.setAttribute('data-user-id', otherMember.UserID);
            }
            
            // Add status indicator for single user conversations
            if (otherMember) {
                const friendCard = document.querySelector(`[data-user-id="${otherMember.UserID}"]`);
                let statusClass = 'gray'; // Default offline
                
                if (friendCard) {
                    const statusDot = friendCard.querySelector('.status-dot');
                    if (statusDot) {
                        if (statusDot.classList.contains('blue')) statusClass = 'blue';
                        else if (statusDot.classList.contains('green')) statusClass = 'green';
                        else if (statusDot.classList.contains('yellow')) statusClass = 'yellow';
                        else if (statusDot.classList.contains('red')) statusClass = 'red';
                    }
                    
                    // Get activity status from friend card
                    const statusText = friendCard.querySelector('.friend-status-info');
                    if (statusText && statusClass !== 'gray') {
                        activityStatus = statusText.textContent.trim();
                    } else {
                        activityStatus = 'Offline';
                    }
                }
                
                statusIndicatorHtml = `<div class="status-dot ${statusClass}"></div>`;
            }
        } else {
            // Group conversation - show group info (no status indicator)
            displayName = conversation.ConversationTitle || 'Group Chat';
            avatarSrc = conversation.ConversationLogo || 'lib/avatars/Conversation/ChatBlue.png';
            activityStatus = `${conversation.Members.length} members`;
        }
        
        const lastMessageText = conversation.LastMessage 
            ? `${conversation.LastMessage.UserName}: ${conversation.LastMessage.Message}`
            : '<b>New conversation</b>';
            
        const timeText = conversation.LastMessage 
            ? formatTimeStamp(conversation.LastMessage.TimeStamp)
            : 'New';
        
        conversationItem.innerHTML = `
            <div class="avatar-container">
                <img src="${avatarSrc}" alt="Conversation Avatar" class="conversation-avatar">
                ${statusIndicatorHtml}
            </div>
            <div class="conversation-info">
                <div class="conversation-name">${displayName}</div>
                <div class="conversation-preview">${conversation.Members.length === 2 ? activityStatus : lastMessageText}</div>
            </div>
            <div class="conversation-unread" style="display: none;"></div>
        `;
        
        // Add click handler
        conversationItem.addEventListener('click', () => {
            selectConversation(conversation);
        });
        
        return conversationItem;
    }

    // Select a conversation
    function selectConversation(conversation) {
        persistCurrentDraft();

        const newConversationId = conversation.ConversationID;
        const isSameConversation = currentConversationId === newConversationId;

        // Set all items as inactive
        const allConversationItems = document.querySelectorAll('.conversation-item');
        allConversationItems.forEach(item => item.classList.remove('active'));
        
        // Set this item as active
        const selectedItem = document.querySelector(`[data-conversation-id="${newConversationId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }
        
        // Hide welcome screen, show conversation
        const chatWelcomeScreen = document.querySelector('.chat-welcome-screen');
        const chatConversationView = document.querySelector('.chat-conversation-view');
        
        if (chatWelcomeScreen && chatConversationView) {
            chatWelcomeScreen.classList.add('hidden');
            chatWelcomeScreen.style.display = 'none';
            
            chatConversationView.classList.remove('hidden');
            chatConversationView.style.display = 'flex';
        }
        
        // Update conversation header
        let displayName, avatarSrc, gameStatusText;
        const chatHeaderStatusDot = document.querySelector('.chat-dialog-avatar-container .status-dot');
        
        if (conversation.Members.length === 2) {
            // Single user conversation - show friend's info and status
            const otherMember = conversation.Members.find(member => member.UserID !== getCurrentUserId());
            displayName = otherMember ? otherMember.UserName : 'Unknown User';
            avatarSrc = otherMember ? otherMember.Avatar : 'lib/avatars/Colors/FillBlack.png';
            
            // Get friend's activity status and update status indicator
            if (otherMember) {
                const friendCard = document.querySelector(`[data-user-id="${otherMember.UserID}"]`);
                let statusClass = 'gray';
                gameStatusText = 'Offline' // Default
                
                console.log('Debug - Looking for friend card with ID:', otherMember.UserID);
                console.log('Debug - Friend card found:', !!friendCard);
                
                if (friendCard) {
                    const statusDot = friendCard.querySelector('.status-dot');
                    console.log('Debug - Status dot found:', !!statusDot);
                    
                    if (statusDot) {
                        // Check all possible status classes
                        if (statusDot.classList.contains('blue')) {
                            statusClass = 'blue';
                            console.log('Debug - Status is blue (online)');
                        } else if (statusDot.classList.contains('green')) {
                            statusClass = 'green';
                            console.log('Debug - Status is green');
                        } else if (statusDot.classList.contains('yellow')) {
                            statusClass = 'yellow';
                            console.log('Debug - Status is yellow');
                        } else if (statusDot.classList.contains('red')) {
                            statusClass = 'red';
                            console.log('Debug - Status is red');
                        } else {
                            console.log('Debug - Status is gray (offline)');
                        }
                    }
                    
                    // Get activity status from friend card
                    const statusText = friendCard.querySelector('.friend-status-info');
                    console.log('Debug - Status text element found:', !!statusText);
                    console.log('Debug - Status text content:', statusText ? statusText.textContent.trim() : 'N/A');
                    
                    if (statusText) {
                        const statusContent = statusText.textContent.trim();
                        if (statusClass !== 'gray' && statusContent) {
                            gameStatusText = statusContent;
                            console.log('Debug - Using status text:', gameStatusText);
                        } else {
                            gameStatusText = statusClass !== 'gray' ? 'Online' : 'Offline';
                            console.log('Debug - Using fallback status:', gameStatusText);
                        }
                    } else {
                        // Fallback based on status class
                        gameStatusText = statusClass !== 'gray' ? 'Online' : 'Offline';
                        console.log('Debug - No status text, using class-based status:', gameStatusText);
                    }
                } else {
                    console.log('Debug - No friend card found, defaulting to Offline');
                }
                
                // Show and update status indicator
                if (chatHeaderStatusDot) {
                    chatHeaderStatusDot.style.display = 'block';
                    chatHeaderStatusDot.className = `status-dot ${statusClass}`;
                }
            } else {
                gameStatusText = 'Unknown User';
                if (chatHeaderStatusDot) {
                    chatHeaderStatusDot.style.display = 'none';
                }
            }
        } else {
            // Group conversation - show group info, hide status indicator
            displayName = conversation.ConversationTitle || 'Group Chat';
            avatarSrc = conversation.ConversationLogo || 'lib/avatars/Conversation/ChatBlue.png';
            gameStatusText = `${conversation.Members.length} members`;
            
            // Hide status indicator for group chats
            if (chatHeaderStatusDot) {
                chatHeaderStatusDot.style.display = 'none';
            }
        }
        
        chatDialogUsername.textContent = displayName;
        chatDialogAvatar.src = avatarSrc;
        chatDialogGameStatus.textContent = gameStatusText;

        currentConversationData = conversation;

        if (!isSameConversation) {
            // Save read status for the previous conversation before switching
            if (currentConversationId) {
                savePendingReadStatus();
            }
            
            currentConversationId = newConversationId;
            currentReadMessageId = null; // Reset for new conversation
            messageOffset = 0;
            lastDisplayedDate = null; // Reset date tracking for new conversation

            // Load messages for this conversation
            loadMessages(newConversationId);
        }

        restoreConversationDraft(newConversationId);
    }

    // Global variable to store current user ID and conversation
    let currentUserId = null;
    let currentConversationId = null;
    
    // Initialize current user ID
    fetch('/api/current-user')
        .then(response => response.json())
        .then(data => {
            if (data.userId) {
                currentUserId = data.userId;
            }
        })
        .catch(error => {
            console.error('Error fetching current user:', error);
        });

    // Save read status when window is about to close or navigate away
    window.addEventListener('beforeunload', () => {
        savePendingReadStatus();
    });
    
    // Also save periodically (every 30 seconds) if there's a pending save
    setInterval(() => {
        if (pendingReadStatusSave && currentConversationId && currentReadMessageId) {
            savePendingReadStatus();
        }
    }, 30000);

    // Helper function to get current user ID
    function getCurrentUserId() {
        return currentUserId;
    }

    // Format message date
    function formatMessageDate(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    }
    
    // Format message time
    function formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Escape HTML to prevent XSS and preserve line breaks
    function escapeHtml(text) {
        if (!text) return '';
        
        // First, escape HTML characters
        const div = document.createElement('div');
        div.textContent = text;
        const escaped = div.innerHTML;
        
        // Then, replace line breaks with <br> tags
        return escaped.replace(/\n/g, '<br>');
    }

    function escapeInlineText(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function buildReplyPreviewBlock(message, messageStore) {
        if (!message || !message.Reply) {
            return '';
        }

        const replyTarget = messageStore ? messageStore.get(message.Reply) : null;
        const cachedTarget = getCachedReplyMessage(message.Reply);

        let authorLabel = 'Unknown message';
        let bodySnippet = 'Original message unavailable';

        const resolvedTarget = replyTarget || cachedTarget;

        if (resolvedTarget === undefined) {
            // Should never happen because Map returns undefined for missing entries
            // but leaving here for clarity
        }

        if (replyTarget) {
            const isSelf = replyTarget.SenderID === currentUserId;
            authorLabel = replyTarget.UserName ? replyTarget.UserName : (isSelf ? 'You' : 'Unknown user');

            const rawBody = replyTarget.Message || '';
            const normalizedBody = rawBody.replace(/\s+/g, ' ').trim();
            if (normalizedBody.length > 0) {
                bodySnippet = normalizedBody.length > MESSAGE_REPLY_SNIPPET_LIMIT
                    ? `${normalizedBody.substring(0, MESSAGE_REPLY_SNIPPET_LIMIT)}…`
                    : normalizedBody;
            } else if (replyTarget.Attachment) {
                bodySnippet = '[Attachment]';
            }
        } else if (cachedTarget) {
            const isSelf = cachedTarget.SenderID === currentUserId;
            authorLabel = cachedTarget.UserName ? cachedTarget.UserName : (isSelf ? 'You' : 'Unknown user');

            const rawBody = cachedTarget.Message || '';
            const normalizedBody = rawBody.replace(/\s+/g, ' ').trim();
            if (normalizedBody.length > 0) {
                bodySnippet = normalizedBody.length > MESSAGE_REPLY_SNIPPET_LIMIT
                    ? `${normalizedBody.substring(0, MESSAGE_REPLY_SNIPPET_LIMIT)}…`
                    : normalizedBody;
            } else if (cachedTarget.Attachment) {
                bodySnippet = '[Attachment]';
            }
        } else {
            // Trigger fetch for missing reply and update UI upon completion
            fetchReplyMessage(message.Reply).then(fetchedMessage => {
                if (!fetchedMessage) return;

                const previewElement = document.querySelector(`.message[data-message-id="${message.MessageID}"] .message-reply-preview`);
                if (!previewElement) return;

                const authorEl = previewElement.querySelector('.message-reply-author');
                const textEl = previewElement.querySelector('.message-reply-text');
                if (!authorEl || !textEl) return;

                const isSelfMessage = fetchedMessage.SenderID === currentUserId;
                const authorName = fetchedMessage.UserName ? fetchedMessage.UserName : (isSelfMessage ? 'You' : 'Unknown user');

                const rawFetchedBody = fetchedMessage.Message || '';
                const normalizedFetchedBody = rawFetchedBody.replace(/\s+/g, ' ').trim();
                let snippet = 'Original message unavailable';

                if (normalizedFetchedBody.length > 0) {
                    snippet = normalizedFetchedBody.length > MESSAGE_REPLY_SNIPPET_LIMIT
                        ? `${normalizedFetchedBody.substring(0, MESSAGE_REPLY_SNIPPET_LIMIT)}…`
                        : normalizedFetchedBody;
                } else if (fetchedMessage.Attachment) {
                    snippet = '[Attachment]';
                }

                authorEl.innerHTML = escapeInlineText(authorName);
                textEl.innerHTML = escapeInlineText(snippet);
            });
        }

        const safeAuthor = escapeInlineText(authorLabel);
        const safeSnippet = escapeInlineText(bodySnippet);

        return `
            <div class="message-reply-preview" data-reply-to-id="${message.Reply}">
                <div class="message-reply-author">${safeAuthor}</div>
                <div class="message-reply-text">${safeSnippet}</div>
            </div>
        `;
    }

    // Format timestamp
    function formatTimeStamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);
        
        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m`;
        } else if (diffHours < 24) {
            return `${diffHours}h`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else {
            return `${diffDays}d`;
        }
    }

    // New Conversation Dialog Functions
    function showNewConversationDialog() {
        currentStep = 0;
        selectedFriends = [];
        selectedAvatar = '';
        
        if (newConversationDialog) {
            newConversationDialog.classList.remove('hidden');
            loadFriendsList();
            navigateToStep(0);
        }
    }

    function closeNewConversationDialog() {
        if (newConversationDialog) {
            newConversationDialog.classList.add('hidden');
        }
        // Reset dialog state
        currentStep = 0;
        selectedFriends = [];
        selectedAvatar = '';
    }

    function navigateToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= steps.length) return;
        
        // Hide all steps
        steps.forEach((stepId, index) => {
            const stepElement = document.getElementById(stepId);
            if (stepElement) {
                stepElement.classList.toggle('hidden', index !== stepIndex);
            }
        });
        
        currentStep = stepIndex;
        
        // Update navigation buttons
        updateNavigationButtons();
        
        // Load step-specific data
        if (stepIndex === 2) { // Avatar selection step
            loadAvatarSelection();
        } else if (stepIndex === 3) { // Summary step
            updateConversationSummary();
        }
    }

    function updateNavigationButtons() {
        const totalParticipants = selectedFriends.length + 1; // +1 for current user
        
        // Show/hide steps based on participant count
        if (totalParticipants < 3) {
            // Skip group name and avatar steps for direct conversations
            if (currentStep === 1) navigateToStep(3); // Skip to summary
        }
        
        // Update button visibility
        if (prevStepBtn) {
            prevStepBtn.classList.toggle('hidden', currentStep === 0);
        }
        
        if (nextStepBtn) {
            const isLastStep = (totalParticipants >= 3 && currentStep === 3) || 
                              (totalParticipants < 3 && currentStep === 3);
            nextStepBtn.classList.toggle('hidden', isLastStep);
        }
        
        if (createConversationBtn) {
            const isLastStep = (totalParticipants >= 3 && currentStep === 3) || 
                              (totalParticipants < 3 && currentStep === 3);
            createConversationBtn.classList.toggle('hidden', !isLastStep);
        }
    }

    function validateCurrentStep() {
        switch (currentStep) {
            case 0: // Friends selection
                if (selectedFriends.length === 0) {
                    parent.window.mainFrame.toast.warn('Please select at least one friend to start a conversation.');
                    return false;
                }
                return true;
            case 1: // Group name (only for 3+ people)
                const groupNameInput = document.getElementById('group-name-input');
                if (selectedFriends.length + 1 >= 3 && (!groupNameInput.value || groupNameInput.value.trim().length === 0)) {
                    parent.window.mainFrame.toast.warn('Please enter a group name.');
                    return false;
                }
                return true;
            case 2: // Group avatar (only for 3+ people)
                if (selectedFriends.length + 1 >= 3 && !selectedAvatar) {
                    parent.window.mainFrame.toast.warn('Please select a group avatar.');
                    return false;
                }
                return true;
            default:
                return true;
        }
    }

    function loadFriendsList() {
        const friendsSelectionList = document.querySelector('.friends-selection-list');
        if (!friendsSelectionList) return;
        
        friendsSelectionList.innerHTML = '<p>Loading friends...</p>';
        
        fetch('/api/friends')
            .then(response => response.json())
            .then(data => {
                friendsSelectionList.innerHTML = '';
                
                if (data.success && data.friends.length > 0) {
                    data.friends.forEach(friend => {
                        const friendItem = createFriendSelectionItem(friend);
                        friendsSelectionList.appendChild(friendItem);
                    });
                } else {
                    friendsSelectionList.innerHTML = '<p>You have no friends to add to a conversation.</p>';
                }
            })
            .catch(error => {
                console.error('Error loading friends:', error);
                friendsSelectionList.innerHTML = '<p>Failed to load friends.</p>';
            });
    }

    function createFriendSelectionItem(friend) {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-selection-item';
        friendItem.setAttribute('data-user-id', friend.UserID);
        
        const statusText = friend.Status === 'online' ? 'Online' : 'Offline';
        
        friendItem.innerHTML = `
            <div class="friend-selection-checkbox"></div>
            <img src="${friend.Avatar}" alt="${friend.UserName}'s Avatar" class="friend-selection-avatar">
            <div class="friend-selection-info">
                <div class="friend-selection-name">${friend.UserName}</div>
                <div class="friend-selection-status">${statusText}</div>
            </div>
        `;
        
        friendItem.addEventListener('click', () => {
            toggleFriendSelection(friend.UserID, friendItem);
        });
        
        return friendItem;
    }

    function toggleFriendSelection(friendId, friendElement) {
        const checkbox = friendElement.querySelector('.friend-selection-checkbox');
        const isSelected = selectedFriends.includes(friendId);
        
        if (isSelected) {
            // Deselect
            selectedFriends = selectedFriends.filter(id => id !== friendId);
            friendElement.classList.remove('selected');
            checkbox.classList.remove('checked');
        } else {
            // Select
            selectedFriends.push(friendId);
            friendElement.classList.add('selected');
            checkbox.classList.add('checked');
        }
        
        updateNavigationButtons();
    }

    function loadAvatarSelection() {
        const avatarGrid = document.querySelector('.avatar-selection-grid');
        if (!avatarGrid) return;
        
        avatarGrid.innerHTML = '';
        
        // Load avatars from the Conversation directory
        const conversationAvatars = [
            'ChatBlack.png', 'ChatBlue.png', 'ChatDarkBlue.png', 'ChatDarkGray.png',
            'ChatDarkGreen.png', 'ChatDarkOrange.png', 'ChatDarkPink.png', 'ChatDarkPurple.png',
            'ChatDarkRed.png', 'ChatGray.png', 'ChatGreen.png', 'ChatLightBlue.png',
            'ChatLightGray.png', 'ChatLightGreen.png', 'ChatLightPink.png', 'ChatLightPurple.png',
            'ChatOrange.png', 'ChatPink.png', 'ChatPurple.png', 'ChatRed.png',
            'ChatYellow.png', 'ChatYellowGreen.png'
        ];
        
        conversationAvatars.forEach(avatarFile => {
            const avatarImg = document.createElement('img');
            avatarImg.src = `lib/avatars/Conversation/${avatarFile}`;
            avatarImg.className = 'avatar-option';
            avatarImg.alt = avatarFile;
            
            avatarImg.addEventListener('click', () => {
                selectAvatar(avatarFile, avatarImg);
            });
            
            avatarGrid.appendChild(avatarImg);
        });
    }

    function selectAvatar(avatarFile, avatarElement) {
        // Remove selection from all avatars
        document.querySelectorAll('.avatar-option').forEach(img => {
            img.classList.remove('selected');
        });
        
        // Select this avatar
        avatarElement.classList.add('selected');
        selectedAvatar = `lib/avatars/Conversation/${avatarFile}`;
    }

    function updateConversationSummary() {
        const participantsList = document.getElementById('summary-participants-list');
        const groupNameElement = document.getElementById('summary-group-name');
        const groupAvatarElement = document.getElementById('summary-group-avatar');
        const summaryNameDiv = document.querySelector('.summary-name');
        const summaryAvatarDiv = document.querySelector('.summary-avatar');
        
        if (participantsList) {
            // Get friend names
            const friendNames = selectedFriends.map(friendId => {
                const friendElement = document.querySelector(`[data-user-id="${friendId}"] .friend-selection-name`);
                return friendElement ? friendElement.textContent : 'Unknown';
            });
            
            participantsList.textContent = `You, ${friendNames.join(', ')}`;
        }
        
        const totalParticipants = selectedFriends.length + 1;
        
        if (totalParticipants >= 3) {
            // Show group name and avatar for group conversations
            if (summaryNameDiv) {
                summaryNameDiv.hidden = false;
                const groupName = document.getElementById('group-name-input').value || 'Untitled Group';
                if (groupNameElement) {
                    groupNameElement.textContent = groupName;
                }
            }
            
            if (summaryAvatarDiv) {
                summaryAvatarDiv.hidden = false;
                if (groupAvatarElement && selectedAvatar) {
                    groupAvatarElement.src = selectedAvatar;
                }
            }
        } else {
            // Hide group name and avatar for direct conversations
            if (summaryNameDiv) summaryNameDiv.hidden = true;
            if (summaryAvatarDiv) summaryAvatarDiv.hidden = true;
        }
    }

    function createNewConversation() {
        const groupNameInput = document.getElementById('group-name-input');
        const totalParticipants = selectedFriends.length + 1;
        
        const conversationData = {
            memberIds: selectedFriends,
            conversationTitle: totalParticipants >= 3 ? groupNameInput.value : null,
            conversationLogo: totalParticipants >= 3 ? selectedAvatar : null
        };
        
        fetch('/api/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(conversationData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                parent.window.mainFrame.toast.success('Conversation created successfully!');
                closeNewConversationDialog();
                // Refresh conversations list
                loadConversations();
            } else {
                if (data.existingConversationId) {
                    parent.window.mainFrame.toast.info('A conversation with these members already exists! :)');
                    closeNewConversationDialog();
                    // TODO: Could select the existing conversation in the list
                    loadConversations();
                } else {
                    parent.window.mainFrame.toast.error(`Failed to create conversation: ${data.error}`);
                }
            }
        })
        .catch(error => {
            console.error('Error creating conversation:', error);
            parent.window.mainFrame.toast.error('Failed to create conversation. Please try again.');
        });
    }

    // Send message functionality
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', () => {
            sendMessage();
        });
        
        // Handle Enter key and typing indicators
        let typingTimeout = null;
        let isCurrentlyTyping = false;
        
        // Helper function to scroll chat to bottom
        function scrollChatToBottom() {
            const messagesContainer = document.querySelector('.chat-dialog-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
        
        // Auto-resize the textarea when text is entered
        function autoResizeTextarea() {
            // Reset height to auto to get the correct scrollHeight
            chatInput.style.height = 'auto';
            
            // Calculate line height and apply a reduction of one line
            const style = window.getComputedStyle(chatInput);
            let lineHeight = parseFloat(style.lineHeight);
            // If lineHeight is not a number, estimate it based on font size
            if (isNaN(lineHeight)) {
                const fontSize = parseFloat(style.fontSize);
                lineHeight = fontSize * 1.4; // Standard approximation for line height
            }
            
            // Set the height to the scrollHeight minus one line height to fix the extra line issue
            const adjustedHeight = Math.max(chatInput.scrollHeight - (lineHeight * 1.6), 0);
            chatInput.style.height = `${adjustedHeight}px`;
            
            // Adjust the position of the chat-dialog-input container based on textarea height
            const chatDialogInput = document.querySelector('.chat-dialog-input');
            if (chatDialogInput) {
                // Calculate the base top position
                // and adjust based on additional textarea height beyond its initial size
                const initialTextareaHeight = 1.2; // vw (min-height from CSS)
                const currentHeightInPx = adjustedHeight;
                const vwRatio = window.innerWidth / 100;
                const currentHeightInVw = currentHeightInPx / vwRatio;

                // Calculate the adjustment needed (how much taller than initial is the textarea)
                let adjustment = currentHeightInVw - initialTextareaHeight;
                if (adjustment < 0) { adjustment = 0; }

                // Limit the adjustment to max 7 lines
                const lineHeightVw = lineHeight / vwRatio;
                const maxLines = 7;
                const maxAdjustment = lineHeightVw * maxLines - initialTextareaHeight;
                if (adjustment > maxAdjustment) { adjustment = maxAdjustment; }

                // Apply the new position (move up by the difference)
                let newTopPosition = basePosition - adjustment;

                // If reply preview is active, add its height (converted to vw) to the top offset
                if (replyPreview && replyPreview.classList.contains('active')) {
                    newTopPosition -= 3.6;
                }

                chatDialogInput.style.top = `${newTopPosition}vw`;
            }
            
            // Make sure chat messages remain visible by scrolling to bottom
            scrollChatToBottom();
        }
        
        // Initialize height on page load
        if (chatInput) {
            autoResizeTextarea();
            
            // Handle window resize events
            window.addEventListener('resize', () => {
                if ( document.querySelector('.chat-dialog-input')) {
                    autoResizeTextarea();
                }
            });
        }
        
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent default behavior (new line)
                sendMessage();
            }
        });
        
        chatInput.addEventListener('input', (e) => {
            const hasText = e.target.value.trim().length > 0;
            
            // Auto-resize the textarea
            autoResizeTextarea();
            
            // Start typing indicator if user has text and isn't already typing
            if (hasText && !isCurrentlyTyping) {
                isCurrentlyTyping = true;
                sendTypingIndicator(true);
            }
            
            // Reset the typing timeout
            clearTimeout(typingTimeout);
            
            if (hasText) {
                // Set new timeout to stop typing indicator
                typingTimeout = setTimeout(() => {
                    if (isCurrentlyTyping) {
                        isCurrentlyTyping = false;
                        sendTypingIndicator(false);
                    }
                }, 5000); // Stop typing indicator after 2 seconds of inactivity
            } else {
                // No text, immediately stop typing indicator
                if (isCurrentlyTyping) {
                    isCurrentlyTyping = false;
                    sendTypingIndicator(false);
                }
            }
        });
        
        // Stop typing indicator when input loses focus
        chatInput.addEventListener('blur', () => {
            if (isCurrentlyTyping) {
                isCurrentlyTyping = false;
                sendTypingIndicator(false);
                clearTimeout(typingTimeout);
            }
        });
    }
    
    // Function to find or create a direct conversation with a friend
    function findOrCreateDirectConversation(friendId) {
        // First try to find existing conversation with this friend
        fetch('/api/conversations')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Look for existing 2-person conversation with this friend
                    const existingConversation = data.conversations.find(conv => 
                        conv.Members.length === 2 && 
                        conv.Members.some(member => member.UserID === parseInt(friendId))
                    );
                    
                    if (existingConversation) {
                        // Use existing conversation
                        currentConversationId = existingConversation.ConversationID;
                        currentConversationData = existingConversation;
                        messageOffset = 0;
                        lastDisplayedDate = null; // Reset date tracking for new conversation

                        restoreConversationDraft(currentConversationId);
                        
                        // Highlight the conversation in the sidebar
                        const conversationItems = document.querySelectorAll('.conversation-item');
                        conversationItems.forEach(item => {
                            if (item.getAttribute('data-conversation-id') === String(existingConversation.ConversationID)) {
                                item.classList.add('active');
                            } else {
                                item.classList.remove('active');
                            }
                        });
                        
                        // Load messages
                        loadMessages(existingConversation.ConversationID);
                        
                        // Ensure the conversation view is visible (not the welcome screen)
                        const chatWelcomeScreen = document.querySelector('.chat-welcome-screen');
                        const chatConversationView = document.querySelector('.chat-conversation-view');
                        if (chatWelcomeScreen && chatConversationView) {
                            chatWelcomeScreen.classList.add('hidden');
                            chatWelcomeScreen.style.display = 'none';
                            chatConversationView.classList.remove('hidden');
                            chatConversationView.style.display = 'flex';
                        }
                    } else {
                        // Ask user if they want to create a new conversation with this friend
                        if (confirm(`Do you want to start a new conversation with this user?`)) {
                            // Create new conversation
                            fetch('/api/conversations', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    memberIds: [parseInt(friendId)]
                                })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    currentConversationId = data.conversation.ConversationID;
                                    currentConversationData = data.conversation;
                                    messageOffset = 0;
                                    lastDisplayedDate = null; // Reset date tracking for new conversation

                                    restoreConversationDraft(currentConversationId);
                                    
                                    // Reload conversations to include the new one
                                    loadConversations();
                                    
                                    // After a short delay to ensure conversations are loaded, load messages
                                    setTimeout(() => {
                                        // Highlight the conversation in the sidebar
                                        const conversationItems = document.querySelectorAll('.conversation-item');
                                        conversationItems.forEach(item => {
                                            if (item.getAttribute('data-conversation-id') === String(data.conversation.ConversationID)) {
                                                item.classList.add('active');
                                            } else {
                                                item.classList.remove('active');
                                            }
                                        });
                                        
                                        // Load messages
                                        loadMessages(data.conversation.ConversationID);
                                        
                                        // Ensure the conversation view is visible
                                        const chatWelcomeScreen = document.querySelector('.chat-welcome-screen');
                                        const chatConversationView = document.querySelector('.chat-conversation-view');
                                        if (chatWelcomeScreen && chatConversationView) {
                                            chatWelcomeScreen.classList.add('hidden');
                                            chatWelcomeScreen.style.display = 'none';
                                            chatConversationView.classList.remove('hidden');
                                            chatConversationView.style.display = 'flex';
                                        }
                                    }, 300);
                                } else {
                                    console.error('Failed to create conversation:', data.error);
                                    const messagesContainer = document.querySelector('.chat-dialog-messages');
                                    if (messagesContainer) {
                                        messagesContainer.innerHTML = '<p class="error-message">Failed to create conversation</p>';
                                    }
                                }
                            })
                            .catch(error => {
                                console.error('Error creating conversation:', error);
                                const messagesContainer = document.querySelector('.chat-dialog-messages');
                                if (messagesContainer) {
                                    messagesContainer.innerHTML = '<p class="error-message">Error creating conversation</p>';
                                }
                            });
                        } else {
                            // User declined to create a new conversation
                            // Just show the main chat view without selecting a conversation
                            showMainChat();
                        }
                    }
                } else {
                    console.error('Failed to load conversations:', data.error);
                    const messagesContainer = document.querySelector('.chat-dialog-messages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '<p class="error-message">Failed to load conversation</p>';
                    }
                }
            })
            .catch(error => {
                console.error('Error loading conversations:', error);
                const messagesContainer = document.querySelector('.chat-dialog-messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '<p class="error-message">Error loading conversation</p>';
                }
            });
    }

    // Function to handle replying to messages
    function handleReply(messageElement) {
        const messageText = messageElement.dataset.messageText;
        const senderName = messageElement.dataset.senderName;
        const messageId = messageElement.dataset.messageId;
        const senderId = messageElement.dataset.senderId;
        
        const replyDraft = {
            id: messageId,
            senderId: senderId,
            text: messageText,
            senderName: senderName
        };

        setReplyPreviewFromDraft(replyDraft);

        if (chatInput) {
            chatInput.focus();
        }
    }
    
    // Function to cancel reply
    function cancelReply() {
        setReplyPreviewFromDraft(null);
    }
    
    // Initialize reply close button
    const replyPreviewClose = document.querySelector('.reply-preview-close');
    if (replyPreviewClose) {
        replyPreviewClose.addEventListener('click', cancelReply);
    }

    function sendMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText || !currentConversationId || !socket || socket.readyState !== WebSocket.OPEN) return;
        
        // Stop typing indicator
        sendTypingIndicator(false);
        
        // Send message via WebSocket
        const messageData = {
            type: 'message_send',
            conversationId: currentConversationId,
            message: messageText,
        };
        
        // Add reply data if replying to a message
        if (replyingToMessage) {
            messageData.reply = replyingToMessage.id;
            
            // Clear the reply after sending
            cancelReply();
        }
        
        socket.send(JSON.stringify(messageData));

    // Remove any stored draft for this conversation now that it has been sent
    conversationDrafts.delete(getDraftKey(currentConversationId));
    clearAttachmentDraftUI();
        
        // Clear the input immediately for better UX
        chatInput.value = '';
        // Reset the height of the textarea
        chatInput.style.height = 'auto';
        
        // Reset the chat-dialog-input position to default
        const chatDialogInput = document.querySelector('.chat-dialog-input');
        if (chatDialogInput) {
            chatDialogInput.style.top = basePosition+'vw';
        }
        
        chatInput.focus();
    }
    
    // Function to send typing indicators
    function sendTypingIndicator(isTyping) {
        if (!currentConversationId || !socket || socket.readyState !== WebSocket.OPEN) return;
        
        const typingData = {
            type: isTyping ? 'typing_start' : 'typing_stop',
            conversationId: currentConversationId
        };
        
        socket.send(JSON.stringify(typingData));
    }

    // Profile functionality
    profileButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Get the friend's info from the card
            const friendCard = e.target.closest('.friend-card');
            const friendName = friendCard.querySelector('.friend-name').textContent;
            const friendAvatar = friendCard.querySelector('.friend-avatar').src;
            const statusDot = friendCard.querySelector('.status-dot').cloneNode(true);
            const isOnline = friendCard.classList.contains('online');
            
            // Update profile overlay
            profileUsername.textContent = friendName;
            profileAvatar.src = friendAvatar;
            
            // Update status dot in profile
            const profileStatusDot = document.querySelector('.profile-avatar-container .status-dot');
            profileStatusDot.className = statusDot.className;
            
            if (isOnline) {
                profileStatus.textContent = 'Online Now';
                profileStatus.className = 'profile-status online';
            } else {
                const statusInfo = friendCard.querySelector('.friend-status-info').textContent;
                profileStatus.textContent = statusInfo;
                profileStatus.className = 'profile-status offline';
            }
            
            // Show profile overlay
            profileOverlay.classList.remove('hidden');
        });
    });

    // Close profile overlay
    if (profileClose) {
        profileClose.addEventListener('click', () => {
            profileOverlay.classList.add('hidden');
        });
    }

    // Open chat from profile
    if (profileChatBtn) {
        profileChatBtn.addEventListener('click', () => {
            // Close profile overlay
            profileOverlay.classList.add('hidden');
            
            // Get friend info
            const friendName = profileUsername.textContent;
            const friendAvatar = profileAvatar.src;
            const friendId = profileChatBtn.getAttribute('data-user-id') || 'unknown';
            
            // Get status dot
            const profileStatusDot = document.querySelector('.profile-avatar-container .status-dot');
            const statusDot = profileStatusDot ? profileStatusDot.cloneNode(true) : null;
            
            // Get status text
            const statusText = profileStatus.textContent || 'Unknown Status';
            
            // Use our new function to show the chat
            showFriendChat(friendId, friendName, friendAvatar, statusDot, statusText);
        });
    }
});
