# Commonality and Variability Analysis

## Commonalities
- User must register on the site to access friends.
- Users will have friends.
- Users can complete achievements and receive rewards.
- 
- 
- 

## Variabilities
- Game catalogue
  - Why it may change: Games will be constantly added, updated, and removed.
  - How it is isolated: Only certain users with certain privileges will add, update, and remove games.

- Contact Support
  - Why it may change: As the platform grows, we may get a better support system that allows a user to get a support ticket.
  - How it is isolated: We would make our own support service.

- Amount of achievements
  - Why it may change: Developers can add content that will also contain achievements players can earn rewards.
  - How it is isolated: 

- Editing the List of Avatars
  - Why it may change: We'll continuously add, delete, or update more avatars as more games roll in.
  - How it is isolated: We'll have a system that allows us to perform this action.

- User Permission/Role Policies
  - Why it may change: New roles sch as admin/moderator as well as developer may be added, permissions may shift as platform grows
  - How it is isolated: A permissionPolicy object to define role capabilities

- 
  - Why it may change: 
  - How it is isolated: 



<!-- EXAMPLE -->
# Commonality and Variability Analysis

## Commonalities
- A Game consists of Frames.
- A Frame records Rolls.
- A Player participates in a Game.
- A total score is computed.

## Variabilities
- Scoring rules
  - Why it may change:
    The system may support standard 10-pin, candlepin, or practice scoring.
  - How it is isolated:
    Game depends on a ScoringStrategy interface rather than a concrete scoring class.

- Game format (number of frames)
  - Why it may change:
    Casual or youth modes may use fewer frames.
  - How it is isolated:
    A GameConfiguration object defines frame count and rule parameters.