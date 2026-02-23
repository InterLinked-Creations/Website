## Conversation

**Responsibilities**
- Holds and receives messages sent by participants
- Maintains relationships between messages, their replies, and attachments
- Coordinates with read status tracking to determine which message each user last read.
- Contains the conversation image and title

**Collaborators**
- User
- Message
- WebSocket


## WebSocket

**Responsibilities**
- Updates users in real time when a message, letter, invite, etc. shows up.
- Handles real-time chat events such as typing indicators and read status updates.

**Collaborators**
- User
- Conversation
- Notification (Inbox)


## Message

**Responsibilities**
- Holds text info on the current message
- Keeps track of who sent the message and the date when it was sent

**Collaborators**
- Conversation
- User


## Notification (Inbox)

**Responsibilities**
- Contains information about what's in the message
- Tracks who sent it and when
- Holds any associated package content or additional data

**Collaborators**
- User
- Conversation
- Friend


## Friend

**Responsibilities**
- Represents a friendship relationship between users
- Stores friendship status and metadata (for example, when the friendship was created)
- Supports friend-related actions such as sending and responding to friend requests

**Collaborators**
- User
- Notification (Inbox)
- Conversation