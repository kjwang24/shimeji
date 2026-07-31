// settings page, accessed by right clicking extension >> options

import { DEFAULTS } from './defaults.js';

const $ = (id) => document.getElementById(id);

let enabled = true;

function renderToggle() {
  $('toggle').textContent = enabled ? 'Extension on' : 'Extension off';
  $('toggle').className = enabled ? 'on' : 'off';
}

async function load() {
  const { config } = await chrome.storage.local.get('config');
  const c = { ...DEFAULTS, ...(config || {}), thresholds: { ...DEFAULTS.thresholds, ...(config?.thresholds || {}) } };

  enabled = c.enabled !== false;
  renderToggle();
  $('domains').value = c.entertainmentDomains.join('\n');
  $('t-ok').value = c.thresholds.ok;
  $('t-bad').value = c.thresholds.bad;
  $('t-disastrous').value = c.thresholds.disastrous;
  $('appear').value = c.appearEveryMin;

  chrome.runtime.sendMessage({ type: 'shimeji-status' }, (r) => {
    if (chrome.runtime.lastError || !r) { $('status').textContent = 'No data yet, browse a bit first.'; } else
    { $('status').textContent = `${r.minutes} minutes spent on entertainment today (${r.mood})`; }
  });
}

// number of mins in a limit has to be >= 1
const numOr = (id, def) => {
  const n = Math.floor(Number($(id).value));
  return Number.isFinite(n) && n >= 1 ? n : def;
};

async function save() {
  const domains = $('domains').value.split('\n').map(s => s.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter(Boolean);
  const config = {
    entertainmentDomains: domains,
    thresholds: {
      ok: numOr('t-ok', DEFAULTS.thresholds.ok),
      bad: numOr('t-bad', DEFAULTS.thresholds.bad),
      disastrous: numOr('t-disastrous', DEFAULTS.thresholds.disastrous)
    },
    appearEveryMin: numOr('appear', DEFAULTS.appearEveryMin),
    enabled
  };
  await chrome.storage.local.set({ config });
  chrome.runtime.sendMessage({ type: 'shimeji-config-updated' });
  const msg = $('savedMsg');
  msg.textContent = 'saved ✓';
  msg.className = 'saved';
  setTimeout(() => { msg.textContent = ''; }, 2000);
}

$('toggle').addEventListener('click', async () => {
  enabled = !enabled;
  renderToggle();
  const { config } = await chrome.storage.local.get('config');
  await chrome.storage.local.set({ config: { ...(config || {}), enabled } });
  chrome.runtime.sendMessage({ type: 'shimeji-config-updated' });
});

$('save').addEventListener('click', save);

document.querySelectorAll('button.test').forEach(btn =>
  btn.addEventListener('click', () =>
    chrome.runtime.sendMessage({ type: 'shimeji-test', mood: btn.dataset.mood }, (r) => {
      if (!chrome.runtime.lastError && r && !r.ok) $('status').textContent = r.reason;
    })));

$('reset').addEventListener('click', async () => {
  await chrome.storage.local.set({ totals: {} });
  load();
});

load();
