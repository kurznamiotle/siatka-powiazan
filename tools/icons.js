#!/usr/bin/env node
/* Rysuje ikony PWA (pixel art 32×32: korek, trzy pinezki, czerwony sznurek) i zapisuje PNG do icons/.
 *   node tools/icons.js
 * Bez zależności: własny koder PNG (zlib z Node). Treść mieści się w strefie bezpiecznej ikon „maskable”. */
const zlib = require("zlib"), fs = require("fs"), path = require("path");

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const P = { room: hex("#16120e"), cork: hex("#a3744a"), deep: hex("#7c5433"), frame: hex("#4a3423"),
  str: hex("#c22a2a"), strD: hex("#8e1d1d"), brass: hex("#d9a648"), brassD: hex("#8a6420"), hi: hex("#fff3c4") };

const N = 32, G = Array.from({ length: N }, () => Array(N).fill(P.room));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) G[y][x] = c; };
for (let y = 3; y <= 28; y++) for (let x = 3; x <= 28; x++) {
  const edge = x === 3 || y === 3 || x === 28 || y === 28;
  const corner = (x === 3 || x === 28) && (y === 3 || y === 28);
  if (corner) continue;
  set(x, y, edge ? P.frame : (x * 7 + y * 13) % 11 === 0 || (x * 5 + y * 3) % 17 === 0 ? P.deep : P.cork);
}
const pins = [[9, 9], [23, 12], [13, 23]];
function line([x0, y0], [x1, y1]) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    set(x0, y0, P.str); set(x0, y0 + 1, P.strD);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
line(pins[0], pins[1]); line(pins[1], pins[2]); line(pins[2], pins[0]);
pins.forEach(([cx, cy]) => {
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    const d = Math.hypot(x, y); if (d > 2.9) continue;
    set(cx + x, cy + y, x + y >= 2 ? P.brassD : P.brass);
  }
  set(cx - 1, cy - 1, P.hi);
});

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size) {
  const row = size * 3 + 1, raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = G[Math.floor(y * N / size)][Math.floor(x * N / size)];
    raw.set(c, y * row + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const dir = path.join(__dirname, "..", "icons");
fs.mkdirSync(dir, { recursive: true });
[["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]].forEach(([f, s]) => {
  fs.writeFileSync(path.join(dir, f), png(s)); console.log("icons/" + f, s + "px");
});
