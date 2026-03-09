# Features and Use Cases

## Features
- Log In 
- Log Out
- Register
- Game library
- Search
- User Interactions

## Brief Use Cases

### UC1: User Logs In
- Primary Actor: User of this site.
- Goal: User successfully logs into the site using credentials.

### UC2: User Logs Out
- Primary Actor: User of this site.
- Goal: User successfully logs out the site.

### UC3: User Registers
- Primary Actor: User of this site.
- Goal: User successfully registers a account into the site using credentials.

### UC4: User Accesses Game Library
- Primary Actor: User of this site.
- Goal: User can access a catalog of games that are available through the site.

### UC5: User Searches For Specific Games
- Primary Actor: User of this site.
- Goal: User can search for specific games within the site.

### UC6: User Interacts With Another User
- Primary Actor: User of this site.
- Goal: User can open one on one communications with another user.

### UC7: User Interacts With Multiple Users
- Primary Actor: User of this site.
- Goal: User successfully opens a group chat with multiple users.

### UC8: User Befriends Other Users
- Primary Actor: User of this site.
- Goal: User establishes a friendship relationship with another or multiple users.

## Use Case Traceability

| Use Case | Feature(s) |
|---|---|
| UC1: User Logs In | Log In, Register, User Interactions |
| UC2: User Logs Out | Log In, Register, Log Out |
| UC3: User Registers | Log In, Register, Log Out, User Interactions |
| UC4: User Accesses Game Library | Game Library, Search |
| UC5: User Searches For Specific Games | Search, Game Library |
| UC6: User Interacts With Another User | Log In, Register, User Interactions |
| UC7: User Interacts With Multiple Users | Log In, Register, User Interactions |
| UC8: User Befriends Other Users | Log In, Register, User Interactions |

## Use Case Diagram

### UML Use Case Diagram
- I made this using https://app.diagrams.net

![Use Case Diagram](./CPW207-Assignment3.drawio.png)






















# Features and Use Cases

## Features
- Register
- Maintain WS connections
- Online Activities
- Inbox Messages
- Game Library
- Search
- Friends
- Achievement system
- Toast NotificationsExpand comment

...

## Brief Use Cases

### UC1: User creates an account
- Primary Actor: New user
- Goal: User successfully creates and registers his account.    

### UC2: User plays a game
- Primary Actor: User
- Goal: User opens an available game and plays.

### UC3: User plays online
- Primary Actor: Registered User
- Goal: User connects to online services and plays online game.

### UC4: System sends an inbox letter to user
- Primary Actor: System
- Goal: System sends a letter to the user's inbox

### UC5: System alerts user of achievement
- Primary Actor: System
- Goal: System alerts user when he has completed an achievement.

### UC6: User views the Game Library
- Primary Actor: User
- Goal: User receives the site's library of games

### UC7: User searches for a specific game, genre, etc.
- Primary Actor: User
- Goal: User receives the results of his search

### UC8: User becomes friends with another user
- Primary Actor: Registered User
- Goal: The registered user becomes friends with another user and can chat and play online together.



...

## Use Case Traceability

| Use Case | Feature(s) |
|---|---|
| UC1: User creates an account | Register |
| UC2: User plays a game | Game Library, WS connections |
| UC3: User plays online | Register, Online Activities, Game Library, WS connections |
| UC4: System sends an inbox letter to user | Register, Inbox Messages |
| UC5: System alerts user of achievement | Register, Achievement system, Toast Notifications |
| UC6: User views the Game Library | Game Library |
| UC7: User searches for a specific game, genre, etc. | Game Library, Search |
| UC8: User becomes friends with another user | Register, Online Activities, Friends |
...

## Use Case Diagram
Here is my diagram built with PlantUML (AI assisted, so it might not look the greatest)

![Use Case Diagram](use-case-diagram.png)















## Features
- User Blocking and Safety Controls
- User Reporting System
- Support Ticket System
- Game Progress Tracking
- Notification Preferences Management
- Role and Permission Management
- Account Recovery
- Privacy and Visibility Settings

## Brief Use Cases

### UC1: User Blocks Another User
- Primary Actor: User
- Goal: User prevents another user from sending messages, friend requests, or interacting with them.

### UC2: User Reports Another User
- Primary Actor: User
- Goal: User submits a report about inappropriate behavior or content.

### UC3: User Submits a Support Ticket
- Primary Actor: User
- Goal: User creates a support request for technical issues, account problems, or abuse concerns.

### UC4: User Views Game Progress
- Primary Actor: User
- Goal: User views their saved progress for a specific game.

### UC5: User Updates Notification Preferences
- Primary Actor: User
- Goal: User customizes which notifications they receive (friend requests, achievements, messages, etc.).

### UC6: Admin Assigns User Roles
- Primary Actor: Admin
- Goal: Admin grants or modifies user roles such as moderator or developer.

### UC7: Admin Moderates User Reports
- Primary Actor: Admin
- Goal: Admin reviews submitted reports and takes appropriate action.

### UC8: User Recovers Account
- Primary Actor: User
- Goal: User regains access to their account after losing credentials.

### UC9: User Adjusts Privacy Settings
- Primary Actor: User
- Goal: User controls who can view their profile, activity, and online status.

## Use Case Traceability

| Use Case | Feature(s) |
|---|---|
| UC1: User Blocks Another User | User Blocking and Safety Controls |
| UC2: User Reports Another User | User Reporting System |
| UC3: User Submits a Support Ticket | Support Ticket System |
| UC4: User Views Game Progress | Game Progress Tracking |
| UC5: User Updates Notification Preferences | Notification Preferences Management |
| UC6: Admin Assigns User Roles | Role and Permission Management |
| UC7: Admin Moderates User Reports | User Reporting System, Role and Permission Management |
| UC8: User Recovers Account | Account Recovery |
| UC9: User Adjusts Privacy Settings | Privacy and Visibility Settings |

## Use Case Diagram

I made this in paint(the one built into windows) because of how artistic I am

![Use Case Diagram](use-case-diagramToast.png)