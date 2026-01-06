# Code of Conduct
Here are some rules to follow when working on this site.

---
## Interlinked-Frame Page rules
An Interlinked-Frame Page is a page displayed in the iframe in the main `index.html`. These are web pages located inside the `/app` directory.

### CSS rules
- Use `padding-bottom` as a substitute for `height` if you are working on an Interlinked-Frame page. There may become rare cases when you may need to use `height`, but try to not use 
- Use `vw` for `width` and `padding-bottom`.
- Try to avoid using absolute units for scalability and position. `vw` is preferred.
- Use `px` for border radius
- If you use one unit for `width`, use the same for `padding-bottom`