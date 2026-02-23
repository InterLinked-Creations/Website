## Game

**Responsibilities**
- Tracks the score
- Tracks the players involved
- Holds the date when event took place
- Manages the price to play

**Collaborators**
- Users
- Friend
- Currency

## User

**Responsibilities**
- Stores personal information about a person
- Stores how much currency a user has available
- Holds the userId
- Holds the avatar

**Collaborators**
- Friend

## Friend

**Responsibilities**
- Links multiple users together.
- Holds a Friendship ID with status and metadata info.

**Collaborators**
- Users

## Conversation

**Responsibilities**
- Allow multiple users to communicate with each other simultaneously.
- Contain 2 or more users.
- Has a title and a logo.
- Updates read status of messages exchanged.

**Collaborators**
- Users
- Friend