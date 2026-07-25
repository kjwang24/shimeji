# Shimeji Screen-Time

A cute avatar that walks in from the bottom-right corner of the browser about
every 30 minutes. Its mood reflects how much time you've spent on entertainment
sites today.

## Load it
1. Run `node tools/make-sprite.js` (already done once — regenerate any time).
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select this folder.
4. Click the toolbar icon to summon the avatar immediately for testing.

## Configure
Right-click the icon → **Options** (or the extensions page → Details → Extension
options): edit the entertainment site list, the mood thresholds, and how often
the avatar appears. "Test appearance now" triggers it on the active tab.

## Swap in your own sprite
Replace `sprites/shimeji.png` with your own sheet, then update the layout
constants at the top of `content.js`:
- `frameW` / `frameH` — pixel size of one cell
- `walkFrames` — number of columns (walk-cycle frames)
- rows are moods, top to bottom: **content, concerned, disappointed, alarmed**
- `scale` / `fps` — display size and animation speed

## How it works
- `background.js` — service worker. Tracks active-tab time on entertainment
  domains (event-driven + a 1-min flush alarm), stores daily totals, computes
  mood, and fires an `appear` alarm.
- `content.js` / `content.css` — injects the overlay and runs the
  walk-in → linger → walk-out sprite animation.
- `options.html` / `options.js` — settings UI.

Notes: the avatar is confined to the browser viewport (extensions can't draw
over the OS taskbar); it won't show on `chrome://` pages or the web store.
