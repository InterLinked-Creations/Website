const BG_glow = document.getElementById("BG_Glow");
const MainLogo = document.getElementById("MainLogo");
const Logo_Glow = document.getElementById("Logo_Glow");
const Name = document.getElementById("Name");
const startBTN = document.getElementById("startBTN");


// The screen should start entirely black.
// This timeout starts the animation sequence.
// Have the logo slowly zoom in. The background should start glowing.
setTimeout(() => {
    BG_glow.classList = "glowing";
    MainLogo.classList = "growing";
}, 200);

// After the logo has grown for a few seconds, have the screen flash white.
// The logo and the logo glow element should both become
// fully visible, and have the brightness filter set to 1.
setTimeout(() => {
    document.body.classList = "flash";
    MainLogo.classList = "light";
    Logo_Glow.classList = "light";
}, 6500);

// After the flash, have the background and logo glow stop glowing.
setTimeout(() => {
    BG_glow.classList = "";
    Logo_Glow.classList = "finish";
}, 7500);

// After a few seconds, move the logo to the side to make room for the name.
setTimeout(() => {
    MainLogo.classList = "Sidestep"
}, 10500);

// After the logo has moved, have the name fade in beside it.
setTimeout(() => {
    Name.classList = "show";
}, 11500);

// After the name has faded in, have both the logo and name move up a bit.
// Then, after a short delay, have the start button appear below them.
setTimeout(() => {
    Name.classList.add("up");
    MainLogo.classList.add("up");
    setTimeout(() => {
        startBTN.classList = "show";
    }, 1000);
}, 14500);