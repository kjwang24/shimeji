// Generates a filler sprite sheet at ../sprites/shimeji.png with no external
// deps (pure Node zlib PNG encoder). 4 columns = walk frames, 4 rows = moods
// (content, concerned, disappointed, alarmed). Run:  node tools/make-sprite.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CELL = 64, COLS = 4, ROWS = 4, W = CELL * COLS, H = CELL * ROWS;
const px = Buffer.alloc(W * H * 4, 0); // RGBA, transparent

function set(x, y, r, g, b, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4, ia = a / 255;
  px[i]     = Math.round(r * ia + px[i]     * (1 - ia));
  px[i + 1] = Math.round(g * ia + px[i + 1] * (1 - ia));
  px[i + 2] = Math.round(b * ia + px[i + 2] * (1 - ia));
  px[i + 3] = Math.max(px[i + 3], a);
}
const disc = (cx, cy, rad, c) => {
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++)
    if (x * x + y * y <= rad * rad) set(cx + x, cy + y, c[0], c[1], c[2], c[3] ?? 255);
};
const rrect = (x0, y0, w, h, c) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x0 + x, y0 + y, c[0], c[1], c[2], c[3] ?? 255);
};

const DARK = [40, 40, 48], WHITE = [255, 255, 255];
const moods = [[139, 195, 74], [255, 193, 7], [255, 112, 67], [229, 57, 53]];
const mouthK = [6, 0, -4, -6]; // + = smile, 0 = flat, - = frown

for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
  const ox = col * CELL, oy = row * CELL;
  const swing = [-4, 0, 4, 0][col];  // leg swing across the walk cycle
  const bob = [0, -2, 0, -2][col];   // little vertical bob
  const cx = ox + 32, cy = oy + 32 + bob;

  // ground shadow
  for (let x = -16; x <= 16; x++) for (let y = -4; y <= 4; y++)
    if ((x * x) / 256 + (y * y) / 16 <= 1) set(cx + x, oy + 58 + y, 0, 0, 0, 50);
  // legs
  rrect(cx - 9 + swing, cy + 14, 6, 12, DARK);
  rrect(cx + 3 - swing, cy + 14, 6, 12, DARK);
  // body + highlight
  disc(cx, cy, 20, moods[row]);
  disc(cx - 6, cy - 6, 5, [255, 255, 255, 60]);
  // eyes
  disc(cx - 8, cy - 3, 5, WHITE); disc(cx + 8, cy - 3, 5, WHITE);
  disc(cx - 8, cy - 2, 2, DARK);  disc(cx + 8, cy - 2, 2, DARK);
  // angry brows on tense moods
  if (row >= 2) { rrect(cx - 12, cy - 11, 8, 2, DARK); rrect(cx + 4, cy - 11, 8, 2, DARK); }
  // mouth: y = base + k*(1 - t^2)  → smile when k>0, frown when k<0
  const k = mouthK[row], w = 7, baseY = cy + 9;
  for (let x = -w; x <= w; x++) {
    const t = x / w, y = baseY + k * (1 - t * t);
    set(cx + x, y, ...DARK); set(cx + x, y + 1, ...DARK);
  }
  if (row === 3) disc(cx, cy + 11, 3, [60, 20, 20]); // worried open mouth
}

// ---- PNG encode ----
const CRC = (() => {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: none
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, y * W * 4 + W * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
const out = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

const dir = path.join(__dirname, '..', 'sprites');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'shimeji.png'), out);
console.log(`wrote sprites/shimeji.png (${out.length} bytes, ${W}x${H}, ${COLS} frames x ${ROWS} moods)`);
