## Game

**Responsibilities**
- Tracks the score
- Tracks the players involved
- Holds the date when event took place
- Manages the price to play

**Collaborators**
- Users
- Friends
- Currency

## User

**Responsibilities**
- Stores personal information about a person
- Stores how much currency a user has available
- Holds the userId
- Holds the avatar

**Collaborators**
- Friends

## Friends

**Responsibilities**
- Links users together
- Holds a friendship ID

**Collaborators**
- Users

## Conversations

**Responsibilities**
- Allow multiple users to communicate with each other simultaneously.
- Contain 2 or more users.
- Has a title.
- Has a logo.

**Collaborators**
- Users
- Friends