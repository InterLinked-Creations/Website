<img src="Interlinked/app/lib/icons/logo.png" width="25%">

# Interlinked Creations: Website Version Alpha

This is the base of the Interlinked Creations website.
This includes front-end and back-end activity with a local SQLite database.

## Overview
The Interlinked Creations website is the main hub for the entire [Interlinked Creations](https://github.com/InterLinked-Creations) company, which includes family-friendly content like games, books, videos, and tools. There are many back-end services available like Online Rooms (for Online Multiplayer or Live Video Chat), Game Download and Update Management (of the Interlinked App), etc.

## Features
There are hopes for many amazing features, so here are the top three features that are coming very soon:

- Online Rooms: This streamlines online multiplayer, video chat, or anything that needs live communications. All the webpage has to do is connect to the online rooms service, the website will create a room then send the data of that room back to the webpage, and get you connected just like that (unless, of course, there is an error).

- Embedded Console-like screen: The embedded screen on the webpage maintains a consistent aspect ratio. This makes CSS a lot easier to work with and allows the website to be displayed the same way across **all** screen sizes. The screen will include many different aspect ratios so people who prefer their phone to be vertical, gamers who have wide monitor screens, or anyone with a unique screen size can still enjoy the website.
image.pngimage.png

- Special UI API: Included with the Embedded Screen is the Special UI that comes with it. When receiving messages or invites, completing achievements, or a bit of news you are following, you will get cool pop-ups. You can also suspend certain pages and change some settings, use shortcuts to certain apps, and access some apps mid-game, like chat, video, etc.

## Target Users
- **Primary Audience:** This website is for all families to act like a safe haven from all the non-family-friendly content out there. We also want to deeply integrate strong Parental Controles so parents can have full control over what their kids do on this site.
- **Secondary Audience:** The website includes a wide variety of games and tools that **gamers** and **developers** can use. We want to hear feedback from them and see how we can improve on them.


## Tech Stack
Outline the technologies, frameworks, and tools used.
- Frontend: HTML/CSS/JS
- Backend: Node.js
- Database: SQLite (temporary)
- Infrastructure / DevOps: GitHub
- Other tools: npm

## The First Run!
First you will need Node.js on your machine. If you run `npm -v` and `node -v` without an error, chances are that you have Node.js. Otherwise, you need to [install Node.js](https://nodejs.org/en).

Once you have Node.js and have downloaded the project, open your terminal and make sure you're on the project folder that contains the **server.js** file. If this is your first time starting the project up, then run these commands: 
```
npm install
node DatabaseSetup.js
node server.js
```
After the first run, you can just run `node server.js` to start the server again anytime afterwards.
If everything worked, you can open [localhost:3000](http://localhost:3000/) on your browser.


## Contributors
- [ToastedToast00](https://github.com/ToastedToast00)
- [LogProgrammer92](https://github.com/logprogrammer92)

## Copyrights
© Copyright 2026 Interlinked Creations, SuperGamer001 (Alex Fischer). All rights reserved.

![Copyright Claim Gif](/Markdown%20Files/Copyright.gif)

