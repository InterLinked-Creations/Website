# Commonality and Variability Analysis

## Commonalities
- User must register on the site to access certain features.
- Users can form friendships with other users.
- Users can complete achievements and receive rewards.
- The user is a central actor for the site.
- The user is able to search for games using the built-in search engine.
- An achievement belongs to a game and has completion criteria.

## Variabilities
- Game catalogue
  - Why it may change: Games will be constantly added, updated, and removed.
  - How it is isolated: Only certain users with certain privileges will add, update, and remove games.

- Contact Support
  - Why it may change: As the platform grows, we may get a better support system that allows a user to get a support ticket.
  - How it is isolated: We would make our own support service.

- Amount of achievements
  - Why it may change: Developers can add content that will also contain achievements players can earn rewards.
  - How it is isolated: Modify the achievement system in that specific game (presumably `achievement.js`).

- Editing the List of Avatars
  - Why it may change: We'll continuously add, delete, or update more avatars as more games roll in.
  - How it is isolated: We'll have a dedicated service for admins that allows us to perform this action.

- User Permission/Role Policies
  - Why it may change: New roles sch as admin/moderator as well as developer may be added, permissions may shift as platform grows
  - How it is isolated: A permissionPolicy object to define role capabilities

- Website Themes 
  - Why it may change: Sometimes the coloring may be off, or we'll add more themes.
  - How it is isolated: Have a new .theme.css file for each theme.

- Functionality of the Search Engine
  - Why it may change: As the library grows, there will be a more robust way to find results.
  - How it is isolated: We optimize the code to use better O Notation for searches.