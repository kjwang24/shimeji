# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome/Edge **Manifest V3 browser extension** (vanilla JS, no framework, no build step, no `package.json`, no tests). It tracks time spent on "entertainment" domains and periodically walks a mascot avatar in from the bottom-right of the page; the avatar's mood reflects today's tracked minutes.

## Running / testing (there is no build or test suite)

- **Load:** `chrome://extensions` → enable Developer mode → **Load unpacked** → select this folder.
- **Reload rules after edits** (this trips people up):
  - `background.js` changes → click the **reload** ↻ on the extension card (service worker must restart).
  - `content.js` / `content.css` changes → **refresh the target web tab** (content scripts re-inject on page load); no extension reload needed.
  - `options.html` / `options.js` / options CSS → just **reopen** the options page (extension pages are read fresh each open).
  - Committing is never required to test — git is unrelated to loading.
- **Trigger the avatar:** click the toolbar icon (fires on the active tab), or use the mood buttons on the options page.
- **Previewing a mood requires a normal `http(s)` tab that has been refreshed since the last extension reload** — otherwise there's no content script to receive the message. The options page itself is a `chrome-extension://` page and can never host the avatar (see message flow below).

## Architecture (message-passing across three contexts)

Three isolated JS contexts communicate only via `chrome.runtime`/`chrome.tabs` messages:

- **`background.js`** (service worker) — the brain. Owns time tracking and mood computation. Never touches the DOM.
- **`content.js` + `content.css`** — injected into every page's **top frame only**; draws the avatar overlay and plays the walk animation. Purely a renderer driven by messages.
- **`options.html` + `options.js`** — settings UI. Reads/writes config; sends preview requests.

Message types (all `chrome.runtime` messages): `shimeji-appear` (background → content, "play this mood"), `shimeji-test` (options → background, preview a forced mood), `shimeji-status` (options → background, get today's minutes/mood), `shimeji-config-updated` (options → background, re-arm alarms).

### Time tracking (background.js)

Event-driven and resilient to the service worker being suspended: a "session" (`{domain, counting, sinceTs}`) is persisted in `chrome.storage.local`; every relevant event calls `refresh()`, which accrues elapsed time into `totals` and starts a fresh session. A 1-minute `flush` alarm keeps long uninterrupted sessions ticking. Long SW-sleep gaps are clamped to 3 min so a suspended worker can't over-count. Storage keys: `config`, `totals` (keyed by day; **only today's entry is kept** — `addTime` deletes all other days on write), `session`. Note there is no separate idle check — passive viewing (e.g. a playing video in a focused tab) still counts.

### Moods

Four moods, ordered by severity: **`good` → `ok` → `bad` → `disastrous`**. `good` is the default (below the `ok` threshold); only `ok`/`bad`/`disastrous` have configurable minute thresholds. `moodFor()` must check **highest threshold first**. These mood names are a contract that must stay identical across `background.js` (`moodFor`, `MOOD_INDEX`), `content.js` (`ANIMATIONS`, `LINES`), and `options.html` (`data-mood` on the preview buttons). `moodIndex` is still sent in messages but content.js keys animations by mood **name** — the index is legacy/unused.

### Animation system (content.js + animations.md)

- The avatar is composed of **individual `sprites/shime{N}.png` frames**. A trailing `r` (e.g. `shime22r.png`) is the horizontally-flipped copy of that frame. Frames are ~64px; all frames must be declared in `web_accessible_resources` (`sprites/*.png`) or the browser blocks them from loading into pages.
- **`animations.md` is the human-authored source of truth** for choreography; the `ANIMATIONS` table in `content.js` is a hand-transcription of it. Each entry is `{id, dx}` where `dx` is the horizontal move (px) when advancing to that frame — **negative = left, positive = right**, 0 if unspecified. Un-flipped frames face/move left (walk-in); `r` frames face/move right (walk-out).
- **Off-screen walk invariant:** the avatar starts fully off the right edge at `ENTER = 8 + SIZE` and relies on each animation's moves **netting to ~0** so it walks back off. If you edit an animation, keep left/right moves balanced or it won't exit. `SIZE` is `7.5% of window.innerHeight` (responsive, recomputed per appearance). Each `dx` is multiplied by `moveScale = SIZE / 64` (the frames were authored for a 64px sprite), so the walk distance scales with the sprite — without it, larger viewports enlarge `ENTER` but not the travel, and shorter animations never fully walk on-screen.
- **The speech bubble must stay `position: absolute`** (in content.css). It sits in a flex root; if it's a normal flow child, a long bubble line widens the root and shifts the centered sprite left, breaking the `ENTER` off-screen offset (long-lined moods then fail to walk off).

### Preview vs. normal appearance (why two code paths in background.js)

`appearOnActiveTab()` targets the current active tab (toolbar click, periodic `appear` alarm). `previewOnTab()` (options buttons) instead finds the most-recently-used real website tab, focuses it, and plays there — because when the options page is open it *is* the active tab, and it's a `chrome-extension://` URL. The `BLOCKED` regex lists schemes where content scripts can never run (`chrome:`, `chrome-extension:`, `devtools:`, the web store, etc.) — this is a browser security invariant, not a config choice.

### Config merge

`getConfig()` (background) and `load()` (options) deep-merge saved config over `DEFAULTS`, with a **separate nested spread for `thresholds`** so a partially-saved thresholds object doesn't wipe the other threshold defaults. `DEFAULTS` is defined once in `defaults.js` and imported by both `background.js` and `options.js` as ES modules — so the background service worker is declared `"type": "module"` in the manifest and `options.html` loads `options.js` with `<script type="module">`. `defaults.js` is extension-origin only (no `web_accessible_resources` entry needed).

## Stale code — do not trust as documentation

`README.md` describes an **older sprite-sheet design** that content.js no longer uses: a single `sprites/shimeji.png` grid with moods named `content, concerned, disappointed, alarmed` and layout constants (`frameW`, `walkFrames`, `scale`) that are gone from content.js. The live system uses individual per-frame PNGs and the mood names above. Treat `animations.md` + `content.js` as authoritative for anything animation- or mood-related.
