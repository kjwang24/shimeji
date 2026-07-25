const DEFAULTS = {
  entertainmentDomains: [
    'youtube.com', 'netflix.com', 'reddit.com', 'tiktok.com', 'twitch.tv',
    'instagram.com', 'x.com', 'twitter.com', 'hulu.com', 'disneyplus.com',
    'primevideo.com', '9gag.com', 'pinterest.com', 'hbomax.com'
  ],
  thresholds: { ok: 30, bad: 60, disastrous: 90 },
  appearEveryMin: 30
};

const $ = (id) => document.getElementById(id);

async function load() {
  const { config } = await chrome.storage.local.get('config');
  const c = { ...DEFAULTS, ...(config || {}), thresholds: { ...DEFAULTS.thresholds, ...(config?.thresholds || {}) } };

  $('domains').value = c.entertainmentDomains.join('\n');
  $('t-ok').value = c.thresholds.ok;
  $('t-bad').value = c.thresholds.bad;
  $('t-disastrous').value = c.thresholds.disastrous;
  $('appear').value = c.appearEveryMin;

  chrome.runtime.sendMessage({ type: 'shimeji-status' }, (r) => {
    if (chrome.runtime.lastError || !r) { $('status').textContent = 'No data yet, browse a bit first.'; return; }
    // $('status').textContent = `Today: ${r.minutes} min on entertainment • current mood: ${r.mood}`;
  });
}

async function save() {
  const domains = $('domains').value.split('\n').map(s => s.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter(Boolean);
  const config = {
    entertainmentDomains: domains,
    thresholds: {
      ok: Number($('t-ok').value) || DEFAULTS.thresholds.ok,
      bad: Number($('t-bad').value) || DEFAULTS.thresholds.bad,
      disastrous: Number($('t-disastrous').value) || DEFAULTS.thresholds.disastrous
    },
    appearEveryMin: Number($('appear').value) || DEFAULTS.appearEveryMin
  };
  await chrome.storage.local.set({ config });
  chrome.runtime.sendMessage({ type: 'shimeji-config-updated' });
  const msg = $('savedMsg');
  msg.textContent = 'saved ✓';
  msg.className = 'saved';
  setTimeout(() => { msg.textContent = ''; }, 2000);
}

$('save').addEventListener('click', save);
$('test').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'shimeji-test' }));
$('reset').addEventListener('click', async () => {
  await chrome.storage.local.set({ totals: {} });
  load();
});

load();
