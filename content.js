// content.js — draws the avatar overlay and plays the per-mood walk animation.
// Injected into the top frame of every page.
(() => {
  if (window.top !== window) return;            // top frame only
  if (window.__shimejiInjected) return;
  window.__shimejiInjected = true;

  // --- Animation data -----------------------------------------------------
  // Transcribed from animations.md. Each mood is a list of frames; `id` maps
  // to sprites/shime{id}.png (a trailing "r" is the horizontally-flipped
  // copy), and `dx` is how far the avatar moves along X when advancing TO
  // this frame, in screen px (negative = left, positive = right; 0 for the
  // first frame and any pair with no px given).
  const FRAME_MS = 200;   // 5 fps
  const FRAME_PX = 64;    // native sprite size
  const SCALE = 1;        // scale sprite up or down

  const f = (id, dx = 0) => ({ id, dx });
  const ANIMATIONS = {
    content: [
      f('22'), f('4', -32), f('43', -32), f('22', -32), f('4', -32), f('32', -32),
      f('33'), f('32'), f('33'), f('43r'),
      f('22r', 32), f('4r', 32), f('43r', 32), f('22r', 32), f('4r', 32)
    ],
    ok: [
      f('35'), f('34', -32), f('35', -32), f('34', -32), f('25'), f('23'), f('24'), f('25r'),
      f('34r', 32), f('35r', 32), f('34r', 32)
    ],
    bad: [
      f('3'), f('2', -32), f('3', -32), f('2', -32), f('38'), f('39'), f('38'),
      f('15'), f('16'), f('16'), f('16'), f('11'), f('1'),
      f('3r', 32), f('2r', 32), f('3r', 32)
    ],
    disastrous: [
      f('10'), f('8', -16), f('9', -16), f('20', -16), f('10', -16), f('8', -16), f('45', -16),
      f('11'), f('17'), f('17'), f('19'), f('18'), f('19'), f('18'), f('19'), f('20r'),
      f('8r', 16), f('10r', 16), f('9r', 16), f('8r', 16), f('10r', 16), f('20r', 16)
    ]
  };

  const LINES = {
    content: ['nice pace today :)', 'so productive!'],
    ok: ['getting cozy here...', "let's keep this break short?"],
    bad: ["um that's a lot of scrolling", 'take a stretch?'],
    disastrous: ['the screenager allegations are getting louder', 'lock innn']
  };

  let el, sprite, bubble, busy = false;

  const spriteUrl = (id) => chrome.runtime.getURL(`sprites/shime${id}.png`);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  function build() {
    el = document.createElement('div');
    el.className = 'shimeji-root';

    bubble = document.createElement('div');
    bubble.className = 'shimeji-bubble';

    sprite = document.createElement('img');
    sprite.className = 'shimeji-sprite';
    sprite.width = FRAME_PX * SCALE;
    sprite.height = FRAME_PX * SCALE;

    el.appendChild(bubble);
    el.appendChild(sprite);
    document.documentElement.appendChild(el);
  }

  // Preload so frames don't flash blank the first time a mood plays.
  function preload(frames) {
    return Promise.all([...new Set(frames.map(fr => fr.id))].map(id =>
      new Promise((res) => {
        const img = new Image();
        img.onload = img.onerror = () => res();
        img.src = spriteUrl(id);
      })
    ));
  }

  async function appear({ minutes = 0, mood = 'content' }) {
    if (busy) return;
    busy = true;
    if (!el) build();

    const seq = ANIMATIONS[mood] || ANIMATIONS.content;
    await preload(seq);

    // Precompute the running X for every frame. We start fully off the right
    // edge (ENTER) so the leftward frames read as a walk-in; since each
    // animation's moves net to ~0, the rightward frames walk her back off.
    const ENTER = 8 + FRAME_PX * SCALE + 24;   // clears the right edge + shadow
    const xs = [];
    let x = ENTER;
    for (const fr of seq) { x += fr.dx; xs.push(x); }

    // Frame where she's furthest on-screen — pause here so the bubble reads.
    let idxMin = 0;
    for (let i = 1; i < xs.length; i++) if (xs[i] < xs[idxMin]) idxMin = i;

    // Place her off-screen at frame 0 without animating the jump.
    el.style.transition = 'none';
    el.style.transform = `translateX(${xs[0]}px)`;
    sprite.src = spriteUrl(seq[0].id);
    await wait(30);

    bubble.textContent = (LINES[mood] || [])[minutes % 2] || '';

    // Step through the frames; translateX eases over one frame for a walk feel.
    el.style.transition = `transform ${FRAME_MS}ms linear`;
    for (let i = 1; i < seq.length; i++) {
      await wait(FRAME_MS);
      el.style.transform = `translateX(${xs[i]}px)`;
      sprite.src = spriteUrl(seq[i].id);
      if (i === idxMin) bubble.classList.add('show');   // reveal once on-screen
    }

    await wait(FRAME_MS);          // let the final step finish walking off
    bubble.classList.remove('show');
    busy = false;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'shimeji-appear') appear(msg);
  });
})();
