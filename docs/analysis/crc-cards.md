## User

**Responsibilities**
- Register and authenticate into the platform
- Manage profile settings (avatar, bio, preferences)
- Send and respond to friend requests
- View achievements, rewards, and game progress

**Collaborators**
- Friendship
- Achievement
- Reward
- Game

---
## Friendship

**Responsibilities**
- Create and remove friend connections
- Track friendship status (pending, accepted, blocked)
- Notify users of friend request updates

**Collaborators**
- User
- NotificationService

---
## Achievement

**Responsibilities**
- Track user progress toward achievement goals
- Determine when an achievement is completed
- Trigger reward distribution when requirements are met

**Collaborators**
- User
- Reward
- Game

---
## Reward

**Responsibilities**
- Grant rewards to users upon achievement completion
- Track reward types (XP, coins, cosmetics)
- Apply reward rules or multipliers

**Collaborators**
- User
- Achievement

---
## Game

**Responsibilities**
- Provide metadata (title, genre, developer)
- Maintain the list of achievements associated with the game
- Update game information when the catalog changes

**Collaborators**
- Achievement
- User

---
## SupportRequest

**Responsibilities**
- Create and submit support tickets
- Track ticket status and updates
- Route requests to the appropriate support channel

**Collaborators**
- User
- SupportService
