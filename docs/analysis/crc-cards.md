## Conversation

**Responsibilities**
- Holds and receives messages sent by participants
- Keeps together replied messages and attachments
- Informs users on which message the user last read.

**Collaborators**
- User
- Message
- InterWebSocket


## InterWebSocket

**Responsibilities**
- Updates users in real time when a message, letter, invite, etc. shows up.
- Updates player info in Online Multiplayer Games.

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
- Holds possible rewards that can be obtained

**Collaborators**
- User
- Conversation
- Friend