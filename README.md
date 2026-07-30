# Shimeji for Screen-Time

A cute lil guy (just Kirby, for now) that walks into the bottom-right corner of your
browser every now and then to remind you how much screen time you've spent on entertainment
today.

## Install
1. Go to `chrome://extensions` (or `edge://extensions`) and enable **developer mode**
2. **Load unpacked** >> select this folder
3. Test by clicking extension icon in the toolbar, this should summon the shimeji immediately

## Customize
Right click the extension icon at top right >> **Options** (or from the extensions page >> 
Details >> Extension options). Here you can check your shimeji's current mood and edit:
* The list of what sites are tracked as entertainment
* The threshold number of minutes where your shimeji's mood deteriorates
* How often the shimeji appears

## Swap in your own sprite
Not supported yet :'\(  I'm working on a feature to generate animation frames
for any inputted character

## Anatomy
* `background.js`: service worker, manages screen time count, computes mood, and
  fires an `appear` alarm at regular intervals
* `content.js` / `content.css`: injects the overlay and animates the avatar
* `options.html` / `options.js`: settings page
* `manifest.json`: Chrome extension metadata
* `sprites/` / `animations.md`: manually added, default Kirby animation frames and
  how they're spliced together

## Notes
* Avatar runs in the browser viewport (extensions can't draw over the OS taskbar)
* Doesn't work on `chrome://` pages, the web store, or any other page that's
  strict with script injection
* Artwork is from the [shimeji.org community library](https://shimeji.org/u/cwy7gsoc)
