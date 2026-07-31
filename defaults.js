// default config shared by background.js and options.js for consistency

export const DEFAULTS = {
  entertainmentDomains: [
    'youtube.com', 'netflix.com', 'reddit.com', 'tiktok.com', 'twitch.tv',
    'instagram.com', 'x.com', 'twitter.com', 'hulu.com', 'disneyplus.com',
    'primevideo.com', '9gag.com', 'pinterest.com', 'hbomax.com'
  ],
  thresholds: { ok: 30, bad: 60, disastrous: 90 }, // minutes a day
  appearEveryMin: 60,
  flushEveryMin: 1 // not used by options.js
};
