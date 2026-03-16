<img src="Interlinked/app/lib/icons/logo.png" width="25%">

# Interlinked Creations: Website Version Alpha

This is the base of the Interlinked Creations website.
This includes front-end and back-end activity with a local SQLite database.

## Overview
The Interlinked Creations website is the main hub for the entire [Interlinked Creations](https://github.com/InterLinked-Creations) company, which includes family-friendly content like games, books, videos, and tools. There are many back-end services available like Online Rooms (for Online Multiplayer or Live Video Chat), Game Download and Update Management (only in the Interlinked App), etc.

## Features
There are hopes for many amazing features, so here are the top three features that are coming very soon:

- Online Rooms: This streamlines online multiplayer, video chat, or anything that needs live communications. All the webpage has to do is connect to the online rooms service, the website will create a room then send the data of that room back to the webpage, and get you connected just like that (unless, of course, there is an error).

- Embedded Console-like screen: The embedded screen on the webpage maintains a consistent aspect ratio. This makes CSS a lot easier to work with and allows the website to be displayed the same way across **all** screen sizes. The screen will include many different aspect ratios so people who prefer their phone to be vertical, gamers who have wide monitor screens, or anyone with a unique screen size can still enjoy the website.
- Special UI API: Included with the Embedded Screen is the Special UI that comes with it. When receiving messages or invites, completing achievements, or a bit of news you are following, you will get cool pop-ups. You can also suspend certain pages and change some settings, use shortcuts to certain apps, and access some apps mid-game, like chat, video, etc.

## Images
The Intro Screen when the page loads up:<br>
<img src="Markdown Files/1. Intro.png" width="60%">

The Home Screen when logged out:<br>
<img src="Markdown Files/2. HomePage.png" width="60%">

Login screen:<br>
<img src="Markdown Files/3. LoginScreen.png" width="60%">

Dark Mode:<br>
<img src="Markdown Files/4. DarkMode.png" width="60%">

Friends Page:<br>
<img src="Markdown Files/5. FriendPage.png" width="60%">

The Chat Dialog with some conversations on the sides:<br>
<img src="Markdown Files/6. Chat.png" width="60%">

A dialog screen that shows after selecting a game:<br>
<img src="Markdown Files/7. GameDescription.png" width="60%">

When the game fails to load (This one showing a 404 error):<br>
<img src="Markdown Files/8. LoadingError.png" width="60%">

An active game. Notice the MainFrame CSS with large side margins when the window is stretched:<br>
<img src="Markdown Files/9. ActiveGame.png" width="60%">

## Target Users
- **Primary Audience:** This website is for all families to act like a safe haven from all the non-family-friendly content out there. We also want to deeply integrate strong Parental Controls so parents can have full control over what their kids do on this site.
- **Secondary Audience:** The website includes a wide variety of games and tools that **gamers** and **developers** can use. We want to hear feedback from them and see how we can improve on them.


## Tech Stack
Outline the technologies, frameworks, and tools used.
- Frontend: HTML/CSS/JS
- Backend: Node.js (v24.13.0)
- Database: SQLite (temporary)
- Infrastructure / DevOps: GitHub
- Other tools: npm

## The First Run!
First you will need Node.js on your machine. If you run `npm -v` and `node -v` without an error, chances are that you have everything you need. Otherwise, you need to [install Node.js](https://nodejs.org/en).

Once you have Node.js installed, you will want to clone the project onto your device. Open your terminal in an empty folder and run these commands to clone the project:
```
git clone https://github.com/InterLinked-Creations/Website.git
cd Website
```

After that, run these commands to run the project.
```bash
npm install
npm run db:setup
npm start
```
If everything worked, you can open [localhost:3000](http://localhost:3000/) on your browser.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start server with auto-reload (Node.js 18+) |
| `npm run db:setup` | Create/reset the database |
| `npm run db:update` | Migrate data (backup → rebuild → restore) |
| `npm run db:query` | Run ad-hoc database queries |
| `npm run game:update` | Run the install/update script to add games to the library.

### Environment Variables

Copy `.env.example` to `.env` and customize as needed:

```bash
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key
DB_PATH=database/interlinked.db
```

After the first run, you can run `npm start` to start the server again anytime afterwards.

## Troubleshooting tips

1. **Very often, users may have a different version of Node.js than the one we are currently using.** To solve this issue, run `npm rebuild` to compile the Node.js application. Running `node server.js` afterwards should work.

## Contributors
- [ToastedToast00](https://github.com/ToastedToast00)
- [LogProgrammer92](https://github.com/logprogrammer92)

## File Structure
### What is MainFrame?
MainFrame is an `<iframe id="mainframe">` element that shows content from `Interlinked/app/`. It was created to maintain WebSocket and Gamepad connections when opening a new page. Usually, every time we leave the current page and load a new one, those connections are lost, so this page is to preserve those connections as the MainFrame switches to a new page inside the app. In addition, the way the MainFrame is styled makes CSS in the app much easier to manage when the window or screen changes size.


### The Interlinked folder
The `Interlinked` folder contains all the files that the server will send to users. The server cannot send any file outside of this folder unless.

Inside you'll see there are three files:

- index.html: The main page that holds the MainFrame and other gaming content.
- main.css: The file that styles all the content on index.html.
- main.js: The script that exposes the MainFrame API via the `window.mainFrame` object.

### The App Folder
By default, the `app` folder is content that the MainFrame shows. With it, it can run special methods using the MainFrame API to make notifications, Gamepad Controller and WebSocket connections, use Gamepad Mice to control the app through a single controller, etc.

### The File Structure Graph
```
├── docker-compose.yml
├── Dockerfile
├── package.json
├── README.md
├── Markdown Files/             # Images and docs used in README
├── database/                   # SQLite data (gitignored)
├── Interlinked/                # Frontend static files
│   ├── index.html
│   ├── main.css
│   ├── main.js
│   ├── app/
│   │   ├── index.html
│   │   ├── intro.html
│   │   └── lib/
│   │       ├── avatars/
│   │       ├── css/
│   │       ├── icons/
│   │       └── js/
│   └── games/
├── scripts/
│   ├── dbQuery.js
│   ├── dbSetup.js
│   ├── dbUpdate.js
│   └── gameUpdate.js
└── src/                         # Source code (modular)
	├── server.js               # Entry point: HTTP/WebSocket server
	├── app.js                  # Express app config (middleware, routes)
	├── config/
	│   └── index.js            # Environment variables
	├── db/
	│   ├── connection.js       # SQLite connection singleton
	│   ├── schema.json
	│   └── setup.js            # Table definitions
	├── middleware/
	│   └── auth.js             # Authentication middleware
	├── modules/                # Feature modules
	│   ├── auth/
	│   ├── users/
	│   ├── friends/
	│   ├── games/
	│   └── conversations/
	└── websocket/
		└── index.js            # Real-time status, chat, typing
```

## Copyrights
© Copyright 2024-2026 Interlinked Creations, SuperGamer001 (Alex Fischer). All rights reserved.

![Copyright Claim Gif](/Markdown%20Files/Copyright.gif)

