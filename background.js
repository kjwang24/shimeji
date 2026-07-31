// mv3 service worker

import { DEFAULTS } from './defaults.js';

async function getConfig() {
  const { config } = await chrome.storage.local.get('config');
  return {
    ...DEFAULTS,
    ...(config || {}),
    thresholds: { ...DEFAULTS.thresholds, ...(config?.thresholds || {}) }
  };
}

/* track time */

function todayKey(ts = Date.now()) { // all-text date key for accessing screen time records
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hostOf(url) { // standardize host names
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function isEnt(host, cfg) { // is host an entertainment site
  if (!host) return false;
  return cfg.entertainmentDomains.some(d => host === d || host.endsWith('.' + d));
}

// add time to today's total
async function addTime(ms) {
  if (ms <= 0) return;
  const today = todayKey();
  const { totals = {} } = await chrome.storage.local.get('totals');
  const day = totals[today] || { ms: 0 };
  day.ms += ms;
  totals[today] = day;
  for (let key of Object.keys(totals)) {
    if (key !== today) delete totals[key]; // only need to track today's time
  }
  await chrome.storage.local.set({ totals });
}

// reset session starting now
async function refresh() {
  const now = Date.now();
  const s = (await chrome.storage.local.get('session')).session;
  if (s && s.counting) {
    let delta = now - s.sinceTs;
    if (delta > 0) {
      if (delta > 3 * 60 * 1000) delta = 3 * 60 * 1000; // in case computer sleeps and racks up a lot of time
      await addTime(delta);
    }
  }
  const cfg = await getConfig();
  let host = null, active = true;
  try {
    const win = await chrome.windows.getLastFocused(); // check if user is currently active
    if (!win || win.focused === false) active = false;
  }
  catch { active = false; }
  if (active) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); // identify currently active tab
    host = tab ? hostOf(tab.url) : null;
  }
  await chrome.storage.local.set({ session: { domain: host, counting: !!(active && isEnt(host, cfg)), sinceTs: now } });
}

/* mood determination */

async function minutesToday() {
  const { totals = {} } = await chrome.storage.local.get('totals');
  return Math.round(((totals[todayKey()]?.ms) || 0) / 60000);
}

function moodFor(mins, t) {
  if (mins >= t.disastrous) return { name: 'disastrous', index: 3 };
  if (mins >= t.bad) return { name: 'bad', index: 2 };
  if (mins >= t.ok) return { name: 'ok', index: 1 };
  return { name: 'good', index: 0 };
}

const MOOD_INDEX = { good: 0, ok: 1, bad: 2, disastrous: 3 };

async function resolveMood(forceMood) {
  const cfg = await getConfig();
  const mins = await minutesToday();
  const mood = (forceMood && forceMood in MOOD_INDEX)
    ? { name: forceMood, index: MOOD_INDEX[forceMood] } // override screen time count with user-specified mood
    : moodFor(mins, cfg.thresholds); // calculate mood based on screen time
  return { mood, mins };
}

/* sprite behavior */

const BLOCKED = /^(chrome|edge|about|chrome-extension|devtools|https:\/\/chrome\.google\.com\/webstore):/;

async function sendAppear(tabId, forceMood) {
  const { mood, mins } = await resolveMood(forceMood);
  await chrome.tabs.sendMessage(tabId, {
    type: 'shimeji-appear', mood: mood.name, moodIndex: mood.index, minutes: mins
  }); // mins influences what the sprite says, value may not match mood threshold but only its parity matters
}

// make sprite try to appear on current tab (for natural appearance or toolbar click)
async function appearOnActiveTab(forceMood) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.id || BLOCKED.test(tab.url || '')) return;
  try { await sendAppear(tab.id, forceMood); }
  catch {} // current page has no content script, just give up
}

// make sprite appear on last active injectable tab (for preview buttons on options.html)
async function previewOnTab(forceMood) {
  const tabs = (await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })) // everything http
    .filter(t => !BLOCKED.test(t.url || ''));
  if (!tabs.length) return { ok: false, reason: 'Open a normal website tab first, then try previewing again' };
  const tab = tabs.reduce((a, b) => b.lastAccessed > a.lastAccessed ? b : a);
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  try {
    await sendAppear(tab.id, forceMood);
    return { ok: true };
  }
  catch { return { ok: false, reason: 'Refresh your last-used tab, then try previewing again' }; }
}

/* alarms */

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
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'shimeji-test') { previewOnTab(msg.mood).then(sendResponse); return true; }
  else if (msg.type === 'shimeji-status') {
    minutesToday().then(async (mins) => {
      const cfg = await getConfig();
      sendResponse({ minutes: mins, mood: moodFor(mins, cfg.thresholds).name });
    });
    return true;
  }
  else if (msg.type === 'shimeji-config-updated') {
    ensureAlarms();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'flush') await refresh();
  else if (alarm.name === 'appear') await appearOnActiveTab();
});

chrome.tabs.onActivated.addListener(() => refresh());
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.url || info.status === 'complete') refresh(); });
chrome.windows.onFocusChanged.addListener(() => refresh());
chrome.action.onClicked.addListener(() => appearOnActiveTab());
