// animations, injected into the top frame of every page

(() => {
  if (window.top !== window) return; // top frame only
  if (window.__shimejiInjected) return;
  window.__shimejiInjected = true;

  // more human-readable animation instructions found in animations.md
  const FRAME_MS = 200;   // 1 frame per 200 ms = 5 fps
  const SIZE_VH = 0.075;   // avatar dims are 7.5% of viewport height
  const spriteSize = () => Math.max(24, Math.round(window.innerHeight * SIZE_VH));

  // single frame, id maps to sprites/shime{id}.png, dx is horizontal movement from prev frame
  // r denotes horizontal flip, e.g. shime43r.png is shime43.png but facing the opposite way
  const f = (id, dx = 0) => ({ id, dx });
  const ANIMATIONS = {
    good: [
      f('22'), f('4', -32), f('43', -32), f('22', -32), f('4', -32), f('32', -32),
      f('33'), f('32'), f('33'), f('43r'),
      f('22r', 32), f('4r', 32), f('43r', 32), f('22r', 32), f('4r', 32)
    ],
    ok: [
      f('35'), f('34', -32), f('35', -32), f('34', -32), f('35', -32), f('34', -32), f('25'), f('23'), f('24'), f('25r'),
      f('34r', 32), f('35r', 32), f('34r', 32), f('35r', 32), f('34r', 32)
    ],
    bad: [
      f('3'), f('2', -32), f('3', -32), f('2', -32), f('3', -32), f('2', -32), f('38'), f('39'), f('38'),
      f('15'), f('16'), f('16'), f('16'), f('11'), f('1'),
      f('3r', 32), f('2r', 32), f('3r', 32), f('2r', 32), f('3r', 32)
    ],
    disastrous: [
      f('10'), f('8', -16), f('9', -16), f('20', -16), f('10', -16), f('8', -16), f('9', -16), f('20', -16), f('10', -16), f('8', -16), f('45', -16),
      f('11'), f('17'), f('17'), f('19'), f('18'), f('19'), f('18'), f('19'), f('20r'),
      f('8r', 16), f('10r', 16), f('9r', 16), f('8r', 16), f('10r', 16), f('9r', 16), f('8r', 16), f('10r', 16), f('9r', 16), f('8r', 16)
    ]
  };

  const LINES = {
    good: ['nice pace today :)', 'so productive!'],
    ok: ['getting cozy here...', "let's keep this break short?"],
    bad: ["hey, that's a lot of rotting", 'take a stretch?'],
    disastrous: ['stop the scroll!', "hi, you need to lock in"]
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
    sprite.width = sprite.height = spriteSize();

    el.appendChild(bubble);
    el.appendChild(sprite);
    document.documentElement.appendChild(el);
  }

  // preload so frames show content on first run
  function preload(frames) {
    return Promise.all([...new Set(frames.map(fr => fr.id))].map(id =>
      new Promise((res) => {
        const img = new Image();
        img.onload = img.onerror = () => res();
        img.src = spriteUrl(id);
      })
    ));
  }

  async function appear({ minutes = 0, mood = 'good' }) {
    if (busy) return;
    busy = true;
    if (!el) build();

    const seq = ANIMATIONS[mood] || ANIMATIONS.good;
    await preload(seq);

    const SIZE = spriteSize();
    sprite.width = sprite.height = SIZE;
    const moveScale = SIZE / 64; // movement amount needs to match sprite size

    const ENTER = 8 + SIZE; // safely out of view
    const xs = [];
    let x = ENTER;
    for (const fr of seq) { x += fr.dx * moveScale; xs.push(x); } // precompute position for each frame

    let idxMin = 0;
    for (let i = 1; i < xs.length; i++) if (xs[i] < xs[idxMin]) idxMin = i; // find furthest onscreen location

    el.style.transition = 'none';
    el.style.transform = `translateX(${xs[0]}px)`; // starting position offscreen
    sprite.src = spriteUrl(seq[0].id);
    await wait(30);

    bubble.textContent = (LINES[mood] || [])[minutes % 2] || ''; // there are 2 lines per mood

    el.style.transition = `transform ${FRAME_MS}ms linear`;
    for (let i = 1; i < seq.length; i++) {
      await wait(FRAME_MS);
      el.style.transform = `translateX(${xs[i]}px)`;
      sprite.src = spriteUrl(seq[i].id);
      if (i === idxMin) bubble.classList.add('show'); // show speech bubble
    }

    await wait(FRAME_MS);
    bubble.classList.remove('show');
    busy = false;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'shimeji-appear') appear(msg);
  });
})();
