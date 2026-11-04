/*
 * Siatka Powiązań — wynik sprawy jako obrazek PNG 1080×1350 (canvas).
 * Bez spoilerów: nie ma nazwisk, narzędzia ani portretów. Tablica gracza jest pomniejszona, zdjęcia są
 * zastępcze (sylwetka, dom, znak zapytania), a kolejność kart w rzędach przetasowana, żeby po układzie
 * sznurków nie dało się odczytać, kto jest sprawcą w tej samej sprawie dnia.
 * API: SiatkaShareImg.render(dane) → Promise<Blob>, .deliver(blob, nazwa) → Promise<"shared"|"saved"|"cancel">
 */
(() => {
const W = 1080, H = 1350;
const C = { room: "#16120e", desk: "#231b15", edge: "#3a2d22", cork: "#a3744a", corkDeep: "#7c5433", paper: "#ece3cf",
  shade: "#d9cdb3", ink: "#2b221b", inkSoft: "#6b5d4f", string: "#c22a2a", brass: "#d9a648", stamp: "#b3261e", ok: "#3f7a4a", fg: "#efe6d4", muted: "#a8998a" };
const F = { pixel: '"Pixelify Sans", "Courier New", monospace', type: '"Special Elite", "Courier New", monospace', body: '"Courier Prime", "Courier New", monospace' };

/* stabilna pseudolosowość z tekstu */
function rng(str) {
  let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/* pikselowe zdjęcia zastępcze 12×12 */
const GLYPH = {
  person: ["....####....", "...######...", "...######...", "...######...", "....####....", ".....##.....", "..########..", ".##########.", ".##########.", "############", "############", "############"],
  location: [".....##.....", "....####....", "...######...", "..########..", ".##########.", "############", ".##########.", ".###....###.", ".###.##.###.", ".###.##.###.", ".###.##.###.", ".##########."],
  item: ["...######...", "..##....##..", "..##....##..", "........##..", ".......##...", ".....###....", ".....##.....", ".....##.....", "............", ".....##.....", ".....##.....", "............"]
};

/* fonty: canvas nie czeka sam na webfonty, a document.fonts.ready nie ładuje nieużytych krojów */
function fontsReady() {
  if (!document.fonts) return Promise.resolve();
  const want = [`700 80px ${F.pixel}`, `600 40px ${F.pixel}`, `40px ${F.type}`, `36px ${F.body}`, `700 36px ${F.body}`];
  const load = Promise.all(want.map(f => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready);
  return Promise.race([load, new Promise(r => setTimeout(r, 3000))]); // offline bez fontów: rysujemy zapasowym
}

function corkBg(g, x, y, w, h, R) {
  const grd = g.createRadialGradient(x + w / 2, y + h * .4, 10, x + w / 2, y + h * .4, Math.max(w, h) * .75);
  grd.addColorStop(0, C.cork); grd.addColorStop(1, C.corkDeep);
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = R() < .6 ? "rgba(0,0,0,.13)" : "rgba(255,230,190,.10)";
    g.fillRect(x + R() * w, y + R() * h, 2 + R() * 2, 2 + R() * 2);
  }
  g.strokeStyle = "#4a3423"; g.lineWidth = 12; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
  g.strokeStyle = "#2c1f15"; g.lineWidth = 4; g.strokeRect(x + 14, y + 14, w - 28, h - 28);
}

function polaroid(g, n, cx, cy, w, rot, out) {
  const pad = w * .07, ph = w - pad * 2, h = w + w * .26;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 10; g.shadowOffsetY = 4;
  g.fillStyle = C.paper; g.fillRect(-w / 2, -h / 2, w, h);
  g.shadowColor = "transparent";
  const px = -w / 2 + pad, py = -h / 2 + pad;
  g.fillStyle = n.type === "person" ? "#2a2622" : "#3b4a52"; g.fillRect(px, py, ph, ph);
  const cell = ph / 14, gl = GLYPH[n.type] || GLYPH.item;
  g.fillStyle = n.type === "person" ? "#4a4038" : "#56676f";
  gl.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "#") g.fillRect(px + cell * (c + 1), py + cell * (r + 2), Math.ceil(cell), Math.ceil(cell)); }));
  if (out) {
    g.fillStyle = "rgba(20,16,12,.35)"; g.fillRect(px, py, ph, ph);
    g.strokeStyle = C.stamp; g.lineWidth = Math.max(4, w * .06); g.lineCap = "butt";
    g.beginPath(); g.moveTo(px + 4, py + 4); g.lineTo(px + ph - 4, py + ph - 4); g.moveTo(px + ph - 4, py + 4); g.lineTo(px + 4, py + ph - 4); g.stroke();
  }
  g.restore();
  // pinezka na środku górnej krawędzi (po obrocie)
  const dy = -h / 2 + 7;
  return { x: cx - dy * Math.sin(rot), y: cy + dy * Math.cos(rot) };
}

function pin(g, p) {
  g.save();
  g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 4; g.shadowOffsetY = 3;
  const grd = g.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, 11);
  grd.addColorStop(0, "#fff3c4"); grd.addColorStop(.3, C.brass); grd.addColorStop(1, "#8a6420");
  g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.fill();
  g.restore();
}

function star(g, cx, cy, r, filled) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath();
  if (filled) { g.fillStyle = C.brass; g.fill(); g.lineWidth = 3; g.strokeStyle = "#8a6420"; g.stroke(); }
  else { g.lineWidth = 4; g.strokeStyle = "#b5a88f"; g.stroke(); }
}

/* d: { label, place, win, stars, time, wrong, hints, streak|null, seed, nodes:[{id,type}], rows:[[id]], strings:[[a,b]], out:[id], url } */
function draw(d) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), R = rng(d.seed + "|obrazek");
  g.fillStyle = C.room; g.fillRect(0, 0, W, H);
  const vig = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 900);
  vig.addColorStop(0, "rgba(255,220,170,.05)"); vig.addColorStop(1, "rgba(0,0,0,.35)");
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  g.textAlign = "center"; g.textBaseline = "alphabetic";

  // nagłówek
  g.fillStyle = C.fg; g.font = `700 84px ${F.pixel}`; g.fillText("Siatka Powiązań", W / 2, 140);
  g.fillStyle = C.muted; g.font = `40px ${F.type}`; g.fillText(`${d.label} · ${d.place}`, W / 2, 204);

  // tablica: rzędy jak w grze, ale kolejność w rzędzie przetasowana
  const BX = 90, BY = 250, BW = 900, BH = 560;
  corkBg(g, BX, BY, BW, BH, R);
  const byId = Object.fromEntries(d.nodes.map(n => [n.id, n]));
  const rows = d.rows.map(r => { const a = r.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
  const maxPer = Math.max(4, ...rows.map(r => r.length)), Rn = rows.length;
  const innerW = BW - 80, innerH = BH - 70;
  let w = Math.min(130, innerW / maxPer * .72);
  const cardH = r => w + w * .26;
  w = Math.min(w, (innerH - 24 * (Rn - 1)) / Rn / 1.26);
  const gap = (innerH - Rn * cardH()) / Math.max(1, Rn - 1);
  const pins = {};
  let y = BY + 35 + cardH() / 2 + (Rn === 1 ? (innerH - cardH()) / 2 : 0);
  const cards = [];
  rows.forEach(row => {
    const slot = innerW / row.length;
    row.forEach((id, i) => {
      const cx = BX + 40 + slot * i + slot / 2 + (R() - .5) * Math.max(0, slot - w) * .4;
      const cy = y + (R() - .5) * 10;
      cards.push({ id, cx, cy, rot: (R() * 2 - 1) * 3 * Math.PI / 180 });
    });
    y += cardH() + gap;
  });
  const outSet = new Set(d.out);
  cards.forEach(c => { pins[c.id] = polaroid(g, byId[c.id], c.cx, c.cy, w, c.rot, outSet.has(c.id)); });
  // sznurki z lekkim zwisem
  g.save(); g.strokeStyle = C.string; g.lineWidth = 5; g.lineCap = "round";
  g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 3; g.shadowOffsetY = 3;
  d.strings.forEach(([a, b]) => {
    const p = pins[a], q = pins[b]; if (!p || !q) return;
    const dist = Math.hypot(q.x - p.x, q.y - p.y), sag = 14 + dist * .09;
    g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 + sag, q.x, q.y); g.stroke();
  });
  g.restore();
  Object.values(pins).forEach(p => pin(g, p));

  // kartka z wynikiem
  const PX = 110, PY = 860, PW = 860, PH = 360;
  g.save(); g.translate(W / 2, PY + PH / 2); g.rotate(-.008);
  g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 24; g.shadowOffsetY = 8;
  g.fillStyle = C.paper; g.fillRect(-PW / 2, -PH / 2, PW, PH);
  g.shadowColor = "transparent";
  g.strokeStyle = "rgba(90,120,160,.16)"; g.lineWidth = 2;
  for (let ly = -PH / 2 + 40; ly < PH / 2; ly += 34) { g.beginPath(); g.moveTo(-PW / 2, ly); g.lineTo(PW / 2, ly); g.stroke(); }
  g.restore();

  // gwiazdki
  for (let i = 0; i < 3; i++) star(g, W / 2 - 90 + i * 90, PY + 82, 36, i < d.stars);
  // statystyki
  const cells = [["czas", d.time], ["pomyłki", String(d.wrong)], ["podpowiedzi", String(d.hints)]];
  if (d.streak) cells.push(["seria", `${d.streak} ${d.streak === 1 ? "dzień" : "dni"}`]);
  const cw = (PW - 60) / cells.length;
  cells.forEach(([k, v], i) => {
    const cx = PX + 30 + cw * i + cw / 2;
    g.fillStyle = "rgba(0,0,0,.06)"; g.fillRect(cx - cw / 2 + 8, PY + 150, cw - 16, 130);
    g.fillStyle = C.ink; g.font = `600 52px ${F.pixel}`; g.fillText(v, cx, PY + 222);
    g.fillStyle = C.inkSoft; g.font = `30px ${F.body}`; g.fillText(k, cx, PY + 260);
  });

  // pieczątka na styku tablicy i kartki
  g.save(); g.translate(W / 2 + 150, PY - 10); g.rotate(-6 * Math.PI / 180);
  const txt = d.win ? "SPRAWA ZAMKNIĘTA" : "SPRAWA UMORZONA", col = d.win ? C.ok : C.stamp;
  g.font = `700 58px ${F.pixel}`;
  const tw = g.measureText(txt).width;
  g.globalAlpha = .93;
  g.fillStyle = "rgba(236,227,207,.88)"; g.fillRect(-tw / 2 - 24, -50, tw + 48, 84);
  g.strokeStyle = col; g.lineWidth = 7; g.strokeRect(-tw / 2 - 18, -44, tw + 36, 72);
  g.fillStyle = col; g.textBaseline = "middle"; g.fillText(txt, 0, -6);
  g.restore();

  // adres
  g.textBaseline = "alphabetic"; g.fillStyle = C.brass; g.font = `700 40px ${F.body}`; g.fillText(d.url, W / 2, H - 58);
  return cv;
}

function render(d) {
  return fontsReady().then(() => new Promise((res, rej) => {
    const cv = draw(d);
    if (cv.toBlob) cv.toBlob(b => b ? res(b) : rej(new Error("toBlob")), "image/png");
    else rej(new Error("toBlob"));
  }));
}

const phone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
/* telefon z udostępnianiem plików → systemowe „Udostępnij”; reszta → pobranie pliku */
async function deliver(blob, name) {
  let file = null;
  try { file = new File([blob], name, { type: "image/png" }); } catch (_) {}
  if (file && phone() && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  }
  download(blob, name);
  return "saved";
}

window.SiatkaShareImg = { render, deliver };
})();
