// background.js — Shimeji screen-time tracker (MV3 service worker)
//
// Time tracking is event-driven (robust to the service worker being
// suspended): we remember when the current "counting session" started and
// accrue elapsed time on every event that could change what's active, plus a
// 1-minute alarm so long, uninterrupted sessions still tick.

const DEFAULTS = {
  entertainmentDomains: [
    'youtube.com', 'netflix.com', 'reddit.com', 'tiktok.com', 'twitch.tv',
    'instagram.com', 'x.com', 'twitter.com', 'hulu.com', 'disneyplus.com',
    'primevideo.com', '9gag.com', 'pinterest.com'
  ],
  thresholds: { ok: 30, bad: 60, disastrous: 90 }, // minutes a day
  appearEveryMin: 30,
  flushEveryMin: 1
};

async function getConfig() {
  const { config } = await chrome.storage.local.get('config');
  return {
    ...DEFAULTS,
    ...(config || {}),
    thresholds: { ...DEFAULTS.thresholds, ...(config?.thresholds || {}) }
  };
}

function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}
function isEnt(host, cfg) {
  if (!host) return false;
  return cfg.entertainmentDomains.some(d => host === d || host.endsWith('.' + d));
}

async function getSession() { return (await chrome.storage.local.get('session')).session || null; }
async function setSession(s) { await chrome.storage.local.set({ session: s }); }

async function addTime(ms) {
  if (ms <= 0) return;
  const key = todayKey();
  const { totals = {} } = await chrome.storage.local.get('totals');
  const day = totals[key] || { ms: 0 };
  day.ms += ms;
  totals[key] = day;
  const keys = Object.keys(totals).sort();
  while (keys.length > 21) delete totals[keys.shift()]; // keep ~3 weeks
  await chrome.storage.local.set({ totals });
}

// Accrue elapsed time for the current session without ending it.
async function flush(now) {
  const s = await getSession();
  if (s && s.counting) {
    let delta = now - s.sinceTs;
    if (delta > 0) {
      if (delta > 3 * 60 * 1000) delta = 3 * 60 * 1000; // clamp long SW sleeps
      await addTime(delta);
    }
  }
}

// Flush, then recompute what's currently active and start a fresh session.
async function refresh() {
  const now = Date.now();
  await flush(now);
  const cfg = await getConfig();

  let host = null, active = true;
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win || win.focused === false) active = false;
  } catch { active = false; }

  if (active) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    host = tab ? hostOf(tab.url) : null;
  }

  await setSession({ domain: host, counting: !!(active && isEnt(host, cfg)), sinceTs: now });
}

async function minutesToday() {
  const { totals = {} } = await chrome.storage.local.get('totals');
  return Math.round(((totals[todayKey()]?.ms) || 0) / 60000);
}
function moodFor(mins, t) {
  if (mins >= t.disastrous) return { name: 'disastrous', index: 3 };
  if (mins >= t.bad) return { name: 'bad', index: 2 };
  if (mins >= t.ok) return { name: 'ok', index: 1 };
  return { name: 'content', index: 0 };
}

async function appearOnActiveTab() {
  const cfg = await getConfig();
  const mins = await minutesToday();
  const mood = moodFor(mins, cfg.thresholds);
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.id) return;
  if (/^(chrome|edge|about|chrome-extension|devtools|https:\/\/chrome\.google\.com\/webstore):/.test(tab.url || '')) return;
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'shimeji-appear', mood: mood.name, moodIndex: mood.index, minutes: mins
    });
  } catch { /* page has no content script (e.g. store, new tab) */ }
}

async function ensureAlarms() {
  const cfg = await getConfig();
  await chrome.alarms.create('flush', { periodInMinutes: cfg.flushEveryMin });
  await chrome.alarms.create('appear', { periodInMinutes: cfg.appearEveryMin });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { config } = await chrome.storage.local.get('config');
  if (!config) await chrome.storage.local.set({ config: DEFAULTS });
  await ensureAlarms();
  await refresh();
});
chrome.runtime.onStartup.addListener(async () => { await ensureAlarms(); await refresh(); });

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === 'flush') await refresh();
  else if (a.name === 'appear') await appearOnActiveTab();
});

chrome.tabs.onActivated.addListener(() => refresh());
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.url || info.status === 'complete') refresh(); });
chrome.windows.onFocusChanged.addListener(() => refresh());

// Click the toolbar icon to summon the avatar immediately (handy for testing).
chrome.action.onClicked.addListener(appearOnActiveTab);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'shimeji-test') { appearOnActiveTab(); sendResponse({ ok: true }); }
  else if (msg.type === 'shimeji-status') {
    minutesToday().then(async m => {
      const cfg = await getConfig();
      sendResponse({ minutes: m, mood: moodFor(m, cfg.thresholds).name });
    });
    return true; // async response
  } else if (msg.type === 'shimeji-config-updated') {
    ensureAlarms();
  }
});
