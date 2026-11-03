/*
 * Siatka Powiązań — interfejs gry (tablica, sznurki, akta, oskarżenie, wynik).
 * Wymaga: engine/sprites.js, engine/engine.js, data/base.js, data/cities.js, js/audio.js
 */
(() => {
const WORLD = { base: window.SIATKA_BASE, cities: window.SIATKA_CITIES };
const { svg: sprite } = window.SiatkaSprites;
const $ = id => document.getElementById(id);
const AU = window.SiatkaAudio || { sfx() {}, setSfx() {}, setMusic() {}, pref: { sfx: false, music: false } };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let CASE, byId, supportedSet, chainKeys, S, META, RICH, els = {};
const key = (a, b) => [a, b].sort().join("|");
const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
/* stabilna pseudolosowość z id węzła (obrót, przesunięcie) */
const h01 = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };

/* ---------- pamięć przeglądarki ---------- */
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
};
/* Zapis postępu: osobno sprawa dnia i ostatnia losowa. Zapisujemy całą sprawę, nie tylko seed,
   żeby zmiana danych po deployu nie podmieniła graczowi rozpoczętej sprawy. */
const SAVE = { daily: "siatka-save-daily", random: "siatka-save-random", last: "siatka-last" };
function saveNow() {
  clearTimeout(saveT);
  if (!S || !META) return;
  ls.set(SAVE[META.kind], { v: 1, case: CASE, label: S.label, strings: [...S.strings], out: [...S.out], read: [...S.read],
    hints: S.hints, wrong: S.wrong, done: S.done, win: S.win, elapsed: (S.tEnd || Date.now()) - S.t0 });
  ls.set(SAVE.last, META.kind);
}
let saveT;
const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); };

/* ---------- haptyka ---------- */
/* Android: Vibration API. iOS (Safari nie ma vibrate): od iOS 18 stuknięcie w <input switch> daje krótki
   impuls Taptic Engine — nieoficjalne, ale nieszkodliwe tam, gdzie nie działa. Wszędzie: sprężyste animacje CSS. */
const canVibrate = typeof navigator.vibrate === "function";
const iosTap = (() => {
  if (canVibrate) return null;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) return null;
  const l = document.createElement("label"), i = document.createElement("input");
  i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
  l.setAttribute("aria-hidden", "true"); l.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
  l.appendChild(i); document.body.appendChild(l);
  return l;
})();
function haptic(p) {
  if (canVibrate) { try { navigator.vibrate(p); } catch (_) {} }
  else if (iosTap) { try { iosTap.click(); } catch (_) {} }
}
/* restartuje jednorazową animację CSS na elemencie */
function bounce(el, cls) {
  if (!el || reduced()) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
}

/* ---------- mikrofakty: godziny, miejsca, klucze, auta ---------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function buildRich() {
  const locs = new Set();
  CASE.nodes.filter(n => n.type === "location").forEach(n => [n.name, n.label, ...(n.forms || [])].forEach(f => { if (f && f.length > 3) locs.add(f); }));
  const parts = [
    "(?<t>\\d{1,2}:\\d{2})",
    ...(locs.size ? [`(?<l>${[...locs].sort((a, b) => b.length - a.length).map(esc).join("|")})`] : []),
    "(?<k>(?:klucz|kłódk|zamk|alibi|świad)\\p{L}*|zamek)",
    "(?<v>(?:Żuk|Polonez|Maluch|Syren|Trabant|Wartburg|Fiat|Nys)\\p{L}*)"
  ];
  RICH = new RegExp(`(?<![\\p{L}\\d])(?:${parts.join("|")})(?![\\p{L}\\d])`, "giu");
}
const rich = s => String(s).replace(RICH, (m, ...a) => {
  const g = a[a.length - 1];
  return `<b class="fx fx-${g.t ? "t" : g.l ? "l" : g.k ? "k" : "v"}">${m}</b>`;
});

/* ---------- ładowanie sprawy ---------- */
function load(c, label, meta, saved) {
  CASE = c; META = meta;
  byId = Object.fromEntries(c.nodes.map(n => [n.id, n]));
  supportedSet = new Set(c.supported_connections.map(([a, b]) => key(a, b)));
  chainKeys = c.culprit_chain.map(([a, b]) => key(a, b));
  S = { strings: new Set(), out: new Set(), read: new Set(), sel: null, tab: "akta", hints: 0, wrong: 0, done: false, win: false,
    t0: Date.now(), tEnd: null, pending: null, pick: { who: null, what: null }, label };
  if (saved) {
    const ok = id => !!byId[id];
    S.strings = new Set((saved.strings || []).filter(k => k.split("|").every(ok)));
    S.out = new Set((saved.out || []).filter(ok)); S.read = new Set((saved.read || []).filter(ok));
    S.hints = saved.hints || 0; S.wrong = saved.wrong || 0; S.done = !!saved.done; S.win = !!saved.win;
    S.t0 = Date.now() - (saved.elapsed || 0); if (S.done) S.tEnd = Date.now();
  }
  buildRich();
  $("caseLine").textContent = `${label} · ${c.city_name}, ${c.year}`;
  buildBoard();
  const nh = Math.min(3, c.hints.length);
  $("hintBtn").disabled = S.done || S.hints >= nh; $("hintBtn").textContent = `Podpowiedź (${nh - S.hints})`;
  $("accuseBtn").textContent = S.done ? "Wynik" : "Oskarż";
  $("result").hidden = true; $("accuse").hidden = true; $("newCase").hidden = true;
  $("clock").textContent = fmt((S.tEnd || Date.now()) - S.t0);
  renderLives(); hideToast(); renderTabs(); renderSheet(); paintCooldown();
  window.scrollTo(0, 0);
  saveNow();
}

/* ---------- tablica: układ zależny od liczby węzłów ---------- */
const board = $("board"), svgEl = $("strings");
function buildBoard() {
  board.querySelectorAll(".node,.pin").forEach(e => e.remove());
  els = {};
  CASE.nodes.forEach(n => {
    const b = document.createElement("button");
    b.className = `node ${n.type === "location" ? "loc" : n.type}${S.read.has(n.id) ? "" : " unread"}${S.out.has(n.id) ? " out" : ""}`;
    b.dataset.node = n.id;
    const r = Math.round((h01(n.id + "r") * 2 - 1) * 3);
    b.style.setProperty("--r", r + "deg");
    b.innerHTML = `<span class="ph">${sprite(n.sprite)}</span><span class="lb">${n.label}</span>`;
    b.setAttribute("aria-label", `${n.name}, otwórz akta`);
    b.addEventListener("click", () => cardTap(n.id));
    board.appendChild(b);
    const p = document.createElement("button");
    p.className = "pin"; p.dataset.pin = n.id; p.setAttribute("aria-label", `Pinezka: ${n.name}`);
    board.appendChild(p);
    els[n.id] = { card: b, pin: p, r, n };
  });
  requestAnimationFrame(layout);
}
function rowsOf() {
  const of = t => CASE.nodes.filter(n => n.type === t);
  const P = of("person"), rows = [];
  if (P.length <= 4) rows.push(P); else { const h = Math.ceil(P.length / 2); rows.push(P.slice(0, h), P.slice(h)); }
  rows.push(of("location"), of("item"));
  return rows;
}
/* Tablica dostaje wysokość z CSS (cała przestrzeń między nagłówkiem a szufladą).
   Karty mają szerokość z szerokości tablicy, a gdy rzędy nie mieszczą się w pionie, kurczą się
   (do MIN_W). Wolne miejsce w pionie rozkłada się równo między rzędy, a całość jest wyśrodkowana.
   Gdy nawet najmniejsze karty się nie mieszczą, tablica rośnie i strona się przewija. */
const MIN_W = 46, PAD_X = 12, MAX_GAP = 64;
function sizeCards(nodeW) {
  const lbfs = nodeW < 60 ? 8.5 : nodeW < 70 ? 9.5 : nodeW < 82 ? 10.5 : 11.5;
  for (const id in els) {
    // długie pojedyncze słowa (np. „Pogrzebacz”) dostają mniejszą czcionkę zamiast łamania
    const longest = Math.max(...els[id].n.label.split(/\s+/).map(w => w.length));
    const fit = Math.floor((nodeW - 14) / (longest * 0.6) * 10) / 10;
    els[id].card.style.width = nodeW + "px";
    els[id].card.style.setProperty("--lbfs", Math.min(lbfs, fit) + "px");
  }
  return Math.max(...Object.values(els).map(e => e.card.offsetHeight));
}
function layout() {
  if (!CASE) return;
  board.style.minHeight = "";
  const W = board.clientWidth, H = board.clientHeight;
  const rows = rowsOf(), R = rows.length;
  const tight = H < 360, PAD_Y = tight ? 10 : 16, MIN_GAP = tight ? 10 : 16; // niska tablica: ciaśniej
  const maxPer = Math.max(4, ...rows.map(r => r.length));
  let nodeW = Math.round(Math.min(104, (W - PAD_X * 2) / maxPer * 0.84));
  let nodeH = sizeCards(nodeW);
  const room = H - PAD_Y * 2 - MIN_GAP * (R - 1);
  // podpis nie maleje proporcjonalnie do zdjęcia, więc zmniejszamy, aż się zmieści
  for (let i = 0; i < 40 && R * nodeH > room && nodeW > MIN_W; i++) {
    nodeW = Math.max(MIN_W, Math.min(nodeW - 2, Math.floor(nodeW * room / (R * nodeH))));
    nodeH = sizeCards(nodeW);
  }
  const need = R * nodeH + MIN_GAP * (R - 1) + PAD_Y * 2;
  if (need > H) board.style.minHeight = Math.ceil(need) + "px";
  const BH = Math.max(H, need);
  const gap = Math.max(MIN_GAP, Math.min(MAX_GAP, (BH - PAD_Y * 2 - R * nodeH) / Math.max(1, R - 1)));
  let y = (BH - (R * nodeH + gap * (R - 1))) / 2;
  rows.forEach(row => {
    const slot = (W - PAD_X * 2) / row.length;
    row.forEach((n, i) => {
      const free = Math.max(0, slot - nodeW);
      const x = PAD_X + slot * i + free / 2 + (h01(n.id + "x") - .5) * free * .5;
      const yy = y + (h01(n.id + "y") - .5) * Math.min(8, gap / 3);
      els[n.id].card.style.left = Math.round(x) + "px"; els[n.id].card.style.top = Math.round(yy) + "px";
    });
    y += nodeH + gap;
  });
  placePins();
}
function placePins() {
  const br = board.getBoundingClientRect();
  for (const id in els) {
    const { card: c, r } = els[id];
    const rad = r * Math.PI / 180, cx = c.offsetLeft + c.offsetWidth / 2, cy = c.offsetTop + c.offsetHeight / 2, dy = -(c.offsetHeight / 2) + 5;
    const px = cx - dy * Math.sin(rad), py = cy + dy * Math.cos(rad);
    els[id].pin.style.left = px + "px"; els[id].pin.style.top = py + "px"; els[id].pt = { x: px, y: py };
  }
  svgEl.setAttribute("viewBox", `0 0 ${br.width} ${br.height}`);
  drawStrings();
}
/* sznurek zwisa pod własnym ciężarem; m skaluje zwis (animacja „brzdęknięcia”) */
function pathD(a, b, m = 1) { const d = Math.hypot(b.x - a.x, b.y - a.y), sag = (10 + d * .09) * m; return `M${a.x},${a.y} Q${(a.x + b.x) / 2},${(a.y + b.y) / 2 + sag} ${b.x},${b.y}`; }
function drawStrings(fresh) {
  let h = "";
  S.strings.forEach(k => { const [a, b] = k.split("|"); const d = pathD(els[a].pt, els[b].pt, k === fresh && !reduced() ? 0 : 1);
    h += `<path class="s" data-k="${k}" d="${d}"/><path class="hit" data-k="${k}" d="${d}"><title>Przetnij sznurek</title></path>`; });
  svgEl.innerHTML = h + `<path class="tmp" id="tmp" d=""/>`;
  svgEl.querySelectorAll(".hit").forEach(p => p.addEventListener("click", e => { e.stopPropagation(); cut(p.dataset.k); }));
  if (fresh && !reduced()) twang(fresh);
}
/* nowy sznurek napina się i dobija sprężyście do zwisu */
function twang(k) {
  const [a, b] = k.split("|"), t0 = performance.now();
  const step = now => {
    if (!S.strings.has(k) || !els[a] || !els[b]) return;
    const t = (now - t0) / 1000, m = t > 0.9 ? 1 : 1 - Math.exp(-5.5 * t) * Math.cos(2 * Math.PI * 3.6 * t);
    const d = pathD(els[a].pt, els[b].pt, m);
    svgEl.querySelectorAll(`[data-k="${k}"]`).forEach(p => p.setAttribute("d", d));
    if (t <= 0.9) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function cut(k) {
  if (!S.strings.has(k)) return;
  const v = svgEl.querySelector(`.s[data-k="${k}"]`); if (v) v.classList.add("cut");
  S.strings.delete(k); AU.sfx("snip"); haptic([6, 40, 6]);
  setTimeout(() => { drawStrings(); if (S.sel) renderSheet(true); }, 250);
  saveSoon();
}
/* Połączyć można tylko węzły różnego typu (osoba, miejsce, przedmiot). To nie zdradza rozwiązania:
   pulsują wszystkie pasujące typem węzły, a nie te, których połączenie ma pokrycie w faktach. */
const canLink = (a, b) => !!a && !!b && a !== b && byId[a].type !== byId[b].type && !S.strings.has(key(a, b));
function connect(a, b) {
  if (S.done || !canLink(a, b)) return;
  const k = key(a, b); S.strings.add(k);
  drawStrings(k);
  [a, b].forEach(id => { bounce(els[id].card, "bump"); bounce(els[id].pin, "pop"); });
  AU.sfx("pluck", (S.strings.size - 1) % 8); haptic(18);
  if (S.sel) renderSheet(true);
  saveSoon();
}
function nope(id) { bounce(els[id].card, "nope"); AU.sfx("nope"); haptic([8, 50, 8]); }
function refuse(from, to) { if (to && to !== from && byId[from].type === byId[to].type) nope(to); }
function showCompatible(from) {
  for (const id in els) {
    const on = !!from && canLink(from, id);
    els[id].pin.classList.toggle("can", on); els[id].card.classList.toggle("can", on);
    els[id].card.classList.toggle("dim", !!from && !on && id !== from);
  }
}

/* ---------- gesty: przeciąganie sznurka ---------- */
const SNAP = 44; // promień przyciągania do pinezki (px)
function targetAt(cx, cy, from) {
  const br = board.getBoundingClientRect(), p = { x: cx - br.left, y: cy - br.top };
  let best = null, bd = SNAP;
  for (const id in els) {
    if (!canLink(from, id) || !els[id].pt) continue;
    const d = Math.hypot(els[id].pt.x - p.x, els[id].pt.y - p.y); if (d < bd) { bd = d; best = id; }
  }
  if (best) return { id: best, ok: true, p };
  const under = document.elementFromPoint(cx, cy), el = under && under.closest("[data-node],[data-pin]");
  const id = el ? el.dataset.node || el.dataset.pin : null;
  return { id, ok: canLink(from, id), p };
}
let drag = null, raf = 0, lastPt = null;
board.addEventListener("pointerdown", e => {
  const pin = e.target.closest("[data-pin]"); if (!pin || S.done || drag) return;
  e.preventDefault();
  try { pin.setPointerCapture(e.pointerId); } catch (_) {}
  const id = pin.dataset.pin;
  drag = { id, pid: e.pointerId, x: e.clientX, y: e.clientY, moved: false, snap: null };
  bounce(pin, "pop"); AU.sfx("pin"); haptic(8);
  if (!S.pending) showCompatible(id);
});
window.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.pid) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
    drag.moved = true;
    if (S.pending) { setPending(null); showCompatible(drag.id); }
  }
  if (!drag.moved) return;
  lastPt = { x: e.clientX, y: e.clientY };
  if (!raf) raf = requestAnimationFrame(dragFrame);
});
function dragFrame() {
  raf = 0; if (!drag || !lastPt) return;
  const t = targetAt(lastPt.x, lastPt.y, drag.id), snap = t.ok ? t.id : null;
  if (snap !== drag.snap) {
    if (drag.snap) els[drag.snap].pin.classList.remove("snap");
    if (snap) { els[snap].pin.classList.add("snap"); AU.sfx("tick"); haptic(4); }
    drag.snap = snap;
  }
  const tmp = $("tmp");
  if (tmp) { tmp.setAttribute("d", pathD(els[drag.id].pt, snap ? els[snap].pt : t.p)); tmp.classList.toggle("on", !!snap); }
}
function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.pid) return;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  const d = drag; drag = null; lastPt = null;
  if (d.snap) els[d.snap].pin.classList.remove("snap");
  const tmp = $("tmp"); if (tmp) { tmp.setAttribute("d", ""); tmp.classList.remove("on"); }
  if (cancelled) { showCompatible(S.pending); return; }
  if (d.moved) {
    const t = targetAt(e.clientX, e.clientY, d.id);
    if (t.ok) connect(d.id, t.id); else refuse(d.id, t.id);
    showCompatible(null); return;
  }
  // stuknięcie: pierwsza pinezka czeka, druga domyka sznurek
  if (S.pending && S.pending !== d.id) {
    const from = S.pending; setPending(null);
    if (canLink(from, d.id)) connect(from, d.id); else refuse(from, d.id);
  } else setPending(S.pending === d.id ? null : d.id);
}
window.addEventListener("pointerup", e => endDrag(e, false));
window.addEventListener("pointercancel", e => endDrag(e, true));
function setPending(id) {
  if (S.pending && els[S.pending]) els[S.pending].pin.classList.remove("pending");
  S.pending = id; showCompatible(id);
  if (id) { els[id].pin.classList.add("pending"); toast("Łączenie", `Stuknij pulsującą pinezkę albo zdjęcie, żeby przeciągnąć sznurek od: ${byId[id].name}.`, 0); }
  else hideToast();
}
function cardTap(id) {
  if (S.pending && S.pending !== id) {
    const from = S.pending;
    if (canLink(from, id)) { setPending(null); connect(from, id); return; }
    setPending(null);
  }
  select(id);
}

/* ---------- akta i notatnik ---------- */
const sheet = $("sheet");
function select(id) {
  S.sel = id; S.tab = "akta";
  if (!S.read.has(id)) { S.read.add(id); saveSoon(); }
  els[id].card.classList.remove("unread");
  Object.values(els).forEach(o => o.card.classList.remove("sel")); els[id].card.classList.add("sel");
  AU.sfx("paper");
  renderTabs(); renderSheet();
}
function renderTabs() { $("tab-akta").setAttribute("aria-selected", S.tab === "akta"); $("tab-notes").setAttribute("aria-selected", S.tab === "notes"); }
function renderSheet(keep) {
  if (!keep) { sheet.scrollTop = 0; bounce(sheet, "flip"); }
  if (S.tab === "notes") {
    sheet.innerHTML = `<h2>Notatnik detektywa</h2><div class="kind">Ustalenia techników i lekarza</div><ol>${CASE.rules.map(r => `<li>${rich(r.text)}</li>`).join("")}</ol>`;
    return;
  }
  if (!S.sel) {
    const np = CASE.nodes.filter(n => n.type === "person").length, ni = CASE.nodes.filter(n => n.type === "item").length;
    sheet.innerHTML = `<h2>${CASE.title}</h2><div class="kind">Akta sprawy · ${np} podejrzanych · ${ni} ${ni > 4 ? "dowodów" : "dowody"} · ${CASE.rules.length} reguł${CASE.rules.length < 5 ? "y" : ""}</div><p>${rich(CASE.intro)}</p>
      <p class="how">Stuknij zdjęcie, żeby przeczytać akta. Przeciągnij sznurek od pinezki do pinezki, żeby powiązać fakty. Stuknij sznurek, żeby go przeciąć. Reguły znajdziesz w notatniku.</p>`;
    return;
  }
  const n = byId[S.sel];
  const linked = [...S.strings].filter(k => k.split("|").includes(n.id)).map(k => byId[k.split("|").find(x => x !== n.id)].label);
  const canOut = n.type !== "location";
  sheet.innerHTML = `<h2>${n.name}</h2><div class="kind">${n.kind}</div><ul>${n.text.map(f => `<li>${rich(f)}</li>`).join("")}</ul>
    <div class="row">${canOut ? `<button class="chip ${S.out.has(n.id) ? "on" : ""}" id="outBtn">${S.out.has(n.id) ? "Przywróć" : "Wyklucz"}</button>` : ""}
    <button class="chip" id="backBtn">Akta sprawy</button></div>
    ${linked.length ? `<p class="how">Powiązania: ${linked.join(", ")}</p>` : ""}`;
  const ob = $("outBtn");
  if (ob) ob.onclick = () => {
    S.out.has(n.id) ? S.out.delete(n.id) : S.out.add(n.id);
    els[n.id].card.classList.toggle("out", S.out.has(n.id)); bounce(els[n.id].card, "squish");
    AU.sfx("out"); haptic(14); renderSheet(true); saveSoon();
  };
  $("backBtn").onclick = () => { S.sel = null; Object.values(els).forEach(o => o.card.classList.remove("sel")); AU.sfx("paper"); renderSheet(); };
}
$("tab-akta").onclick = () => { if (S.tab === "akta") return; S.tab = "akta"; AU.sfx("paper"); renderTabs(); renderSheet(); };
$("tab-notes").onclick = () => { if (S.tab === "notes") return; S.tab = "notes"; AU.sfx("page"); renderTabs(); renderSheet(); };

/* ---------- dymek, podpowiedzi, zegar ---------- */
const toastEl = $("toast"); let toastT;
function toast(title, txt, ms = 6000) { toastEl.innerHTML = `<b>${title}</b>${txt}`; toastEl.hidden = false; clearTimeout(toastT); if (ms) toastT = setTimeout(hideToast, ms); }
function hideToast() { toastEl.hidden = true; }
toastEl.addEventListener("click", hideToast);
$("hintBtn").onclick = () => {
  const max = Math.min(3, CASE.hints.length);
  if (S.hints >= max || S.done) return;
  toast(`Podpowiedź ${S.hints + 1}/${max}`, rich(CASE.hints[S.hints]), 9000);
  AU.sfx("hint"); haptic(10);
  S.hints++; $("hintBtn").textContent = `Podpowiedź (${max - S.hints})`; if (S.hints >= max) $("hintBtn").disabled = true;
  saveSoon();
};
setInterval(() => { if (S && !S.done && !document.hidden) $("clock").textContent = fmt(Date.now() - S.t0); }, 1000);
/* zegar stoi, gdy gra jest w tle */
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); saveNow(); }
  else if (hiddenAt) { if (S && !S.done) S.t0 += Date.now() - hiddenAt; hiddenAt = 0; }
});
window.addEventListener("pagehide", saveNow);

/* ---------- oskarżenie ---------- */
const goBtn = $("accuseGo"), msg = $("accuseMsg");
function buildPicks() {
  $("toolLbl").textContent = CASE.tool_label;
  const mk = (boxId, type, field) => {
    const box = $(boxId); box.innerHTML = "";
    CASE.nodes.filter(n => n.type === type).forEach(n => {
      const b = document.createElement("button"); b.className = "pick"; b.textContent = n.name + (S.out.has(n.id) ? " · wykluczony" : "");
      b.onclick = () => { S.pick[field] = n.id; box.querySelectorAll(".pick").forEach(x => x.classList.remove("on")); b.classList.add("on"); goBtn.disabled = !(S.pick.who && S.pick.what); msg.textContent = ""; AU.sfx("tick"); haptic(5); };
      box.appendChild(b);
    });
  };
  mk("pickWho", "person", "who"); mk("pickWhat", "item", "what");
  S.pick = { who: null, what: null }; goBtn.disabled = true; msg.textContent = "";
}
$("accuseBtn").onclick = () => { if (S.done) return showResult(); setPending(null); buildPicks(); AU.sfx("paper"); $("accuse").hidden = false; };
$("accuseCancel").onclick = () => { $("accuse").hidden = true; };
goBtn.onclick = () => {
  if (S.pick.who === CASE.solution.culprit && S.pick.what === CASE.solution.weapon) return finish(true);
  S.wrong++; renderLives(); bounce(document.querySelectorAll("#lives i")[3 - S.wrong], "pop");
  saveSoon();
  if (S.wrong >= 3) return finish(false);
  AU.sfx("stamp"); haptic([30, 60, 30]);
  const card = $("accuseCard"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
  const left = 3 - S.wrong;
  msg.textContent = `Prokurator odrzuca akt oskarżenia. Fakty się nie spinają. ${left === 1 ? "Została 1 próba." : `Zostały ${left} próby.`}`;
};
function renderLives() { document.querySelectorAll("#lives i").forEach((i, ix) => i.classList.toggle("lost", ix >= 3 - S.wrong)); }
function finish(win) {
  S.done = true; S.win = win; S.tEnd = Date.now(); $("accuse").hidden = true; setPending(null);
  $("accuseBtn").textContent = "Wynik"; $("hintBtn").disabled = true;
  AU.sfx(win ? "win" : "lose"); haptic(win ? [20, 60, 20, 60, 80] : [120]);
  saveNow(); showResult();
}

function showResult() {
  const win = S.win, time = fmt(S.tEnd - S.t0);
  const stars = win ? Math.max(1, 3 - S.wrong - (S.hints > 0 ? 1 : 0)) : 0;
  const strs = [...S.strings], good = strs.filter(k => supportedSet.has(k)).length, bad = strs.length - good;
  const chainDone = chainKeys.every(k => S.strings.has(k));
  const cul = byId[CASE.solution.culprit], wpn = byId[CASE.solution.weapon], loc = byId[CASE.culprit_chain[0][1]];
  const share = `Siatka Powiązań · ${S.label}\n${CASE.city_name}, ${CASE.year}\n${"🔴".repeat(S.wrong)}${win ? "🟢" : ""} ${"★".repeat(stars)}${"☆".repeat(3 - stars)}\nPodpowiedzi: ${S.hints} · ${time}`;
  $("resultCard").innerHTML = `
    <div class="stamp ${win ? "ok" : ""}">${win ? "SPRAWA ZAMKNIĘTA" : "SPRAWA UMORZONA"}</div>
    <h3></h3>
    ${win ? `<div class="stars" aria-label="${stars} z 3">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>` : `<p>Sprawcą ${cul.g === "f" ? "była" : "był"} ${cul.name}, a narzędziem ${wpn.name.toLowerCase()}.</p>`}
    <p class="epi">${CASE.epilogue}</p>
    <div class="lbl">Rozumowanie</div>
    <ul class="why">${CASE.why.map(([w, t]) => `<li><b>${w}</b> ${t}</li>`).join("")}</ul>
    <div class="lbl">Twoja tablica</div>
    <div class="stat">Sznurki zgodne z faktami: ${good} · bez pokrycia: ${bad}<br>Obwód sprawcy (${cul.label} → ${loc.label} → ${wpn.label}): ${chainDone ? "domknięty" : "niedomknięty"}</div>
    ${win ? `<p class="quip">${CASE.detective}: „${CASE.quip}”</p>` : ""}
    <div class="lbl">Wynik do udostępnienia</div>
    <div class="share" id="shareTxt"></div>
    <div class="foot"><button class="btn ghost" id="copyBtn">Kopiuj wynik</button><button class="btn red" id="againBtn">Nowa sprawa</button></div>`;
  $("resultCard").querySelector("h3").textContent = `${cul.name} · ${wpn.name}`;
  $("shareTxt").textContent = share;
  $("result").hidden = false;
  $("copyBtn").onclick = e => {
    const b = e.currentTarget;
    const sel = () => { const r = document.createRange(); r.selectNodeContents($("shareTxt")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Zaznaczono, skopiuj"; };
    try { navigator.clipboard.writeText(share).then(() => { b.textContent = "Skopiowano"; AU.sfx("tick"); haptic(8); }, sel); } catch (_) { sel(); }
  };
  $("againBtn").onclick = openNewCase;
  paintCooldown();
}
$("result").addEventListener("click", e => { if (e.target.id === "result") e.currentTarget.hidden = true; });

/* ---------- nowa sprawa: miasto, rok, wielkość ---------- */
let OPT = Object.assign({ city: "", year: "", size: "M" }, ls.get("siatka-opts") || {});
function chips(boxId, items, field) {
  const box = $(boxId); box.innerHTML = "";
  items.forEach(([val, label, note]) => {
    const b = document.createElement("button");
    b.className = "chip" + (String(OPT[field]) === String(val) ? " on" : "");
    b.innerHTML = label + (note ? `<small>${note}</small>` : "");
    b.onclick = () => { OPT[field] = val; box.querySelectorAll(".chip").forEach(x => x.classList.remove("on")); b.classList.add("on"); };
    box.appendChild(b);
  });
}
/* Gracze dostają zawsze losową sprawę. Wybór miasta, roku i wielkości jest tylko w trybie
   deweloperskim: dopisz #dev do adresu strony. */
const DEV = () => location.hash === "#dev";
function openNewCase() {
  $("result").hidden = true;
  if (!DEV()) { newCase(); return; }
  chips("optCity", [["", "Losowo"], ...Object.entries(WORLD.cities).map(([id, c]) => [id, c.name])], "city");
  const ys = []; for (let y = WORLD.base.years[0]; y <= WORLD.base.years[1]; y++) ys.push([y, String(y)]);
  chips("optYear", [["", "Losowo"], ...ys], "year");
  const sz = Siatka.SIZES;
  chips("optSize", [["", "Losowo"], ...Object.entries(sz).map(([k, v]) => [k, v.name, `${v.n} os.`])], "size");
  $("newCase").hidden = false;
}
/* Blokada losowania: po nowej sprawie kolejną można wylosować dopiero po 2 minutach.
   Czas trzymany w localStorage, żeby odświeżenie strony go nie zerowało. W #dev bez blokady. */
const COOLDOWN_MS = 2 * 60 * 1000;
const cooldown = {
  until() { try { return +localStorage.getItem("siatka-next-case") || 0; } catch (_) { return 0; } },
  start() { try { localStorage.setItem("siatka-next-case", String(Date.now() + COOLDOWN_MS)); } catch (_) {} },
  left() { return DEV() ? 0 : Math.max(0, this.until() - Date.now()); }
};
function paintCooldown() {
  const ms = cooldown.left();
  const s = Math.ceil(ms / 1000);
  const label = ms ? `Nowa sprawa ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "Nowa sprawa";
  ["newBtn", "againBtn"].forEach(id => { const b = $(id); if (b) { b.disabled = !!ms; b.textContent = label; } });
}
setInterval(paintCooldown, 1000);

let randomN = 0;
function newCase() {
  if (cooldown.left()) { paintCooldown(); return; }
  cooldown.start();
  randomN++;
  const seed = "losowa-" + Date.now().toString(36) + "-" + randomN;
  const o = DEV() ? OPT : {};
  if (DEV()) ls.set("siatka-opts", OPT);
  AU.sfx("page");
  load(Siatka.generateCase(WORLD, seed, { city: o.city || undefined, year: o.year ? +o.year : undefined, size: o.size || undefined }), "Sprawa z archiwum", { kind: "random" });
  paintCooldown();
}
function dailyCase() {
  const n = Siatka.dailyNumber(), sv = ls.get(SAVE.daily);
  const label = `Sprawa #${String(n).padStart(3, "0")}`;
  if (sv && sv.case && sv.case.number === n) return load(sv.case, label, { kind: "daily" }, sv);
  load(Siatka.dailyCase(WORLD), label, { kind: "daily" });
}
function resumeRandom() {
  const sv = ls.get(SAVE.random);
  if (!sv || !sv.case || sv.done) return false;
  try { load(sv.case, sv.label || "Sprawa z archiwum", { kind: "random" }, sv); return true; } catch (_) { return false; }
}
$("dailyBtn").onclick = () => { saveNow(); AU.sfx("page"); dailyCase(); };
$("newBtn").onclick = openNewCase;
$("newCancel").onclick = () => { $("newCase").hidden = true; };
$("newGo").onclick = newCase;
$("newCase").addEventListener("click", e => { if (e.target.id === "newCase") e.currentTarget.hidden = true; });

/* ---------- pełny ekran, dźwięk, muzyka ---------- */
const ICON = {
  fsOn: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z"/></svg>`,
  fsOff: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 1h2v5H1V4h3zM10 1h2v3h3v2h-5zM1 10h5v5H4v-3H1zM10 10h5v2h-3v3h-2z"/></svg>`,
  sndOn: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 5h3l4-4v14l-4-4H1zM10 5h2v6h-2zM13 3h2v10h-2z"/></svg>`,
  sndOff: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 5h3l4-4v14l-4-4H1zM10 5h2v2h-2zM14 5h2v2h-2zM12 7h2v2h-2zM10 9h2v2h-2zM14 9h2v2h-2z"/></svg>`,
  musOn: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 1h10v11h-1v1h-3v-1h-1v-3h1V8h2V5H7v7H6v1H3v-1H2V9h1V8h2z"/></svg>`,
  musOff: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" opacity=".45"><path d="M5 1h10v11h-1v1h-3v-1h-1v-3h1V8h2V5H7v7H6v1H3v-1H2V9h1V8h2z"/></svg>`
};
const root = document.documentElement;
const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const installed = matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches || navigator.standalone === true;
const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function paintTools() {
  const fb = $("fsBtn"), on = fsActive();
  fb.hidden = !fsSupported || installed;
  fb.innerHTML = on ? ICON.fsOff : ICON.fsOn; fb.title = on ? "Wyjdź z pełnego ekranu" : "Pełny ekran"; fb.setAttribute("aria-label", fb.title);
  const sb = $("sfxBtn"), mb = $("musBtn");
  sb.innerHTML = AU.pref.sfx ? ICON.sndOn : ICON.sndOff; sb.title = "Dźwięki"; sb.setAttribute("aria-label", "Dźwięki"); sb.setAttribute("aria-pressed", AU.pref.sfx);
  mb.innerHTML = AU.pref.music ? ICON.musOn : ICON.musOff; mb.title = "Muzyka w tle"; mb.setAttribute("aria-label", "Muzyka w tle"); mb.setAttribute("aria-pressed", AU.pref.music);
}
$("fsBtn").onclick = () => {
  haptic(6);
  if (fsActive()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const r = root.requestFullscreen ? root.requestFullscreen({ navigationUI: "hide" }) : root.webkitRequestFullscreen && root.webkitRequestFullscreen();
  if (r && r.then) r.then(() => { try { screen.orientation.lock("portrait").catch(() => {}); } catch (_) {} }).catch(() => {});
};
["fullscreenchange", "webkitfullscreenchange"].forEach(ev => document.addEventListener(ev, () => { paintTools(); setTimeout(layout, 80); }));
$("sfxBtn").onclick = () => { AU.setSfx(!AU.pref.sfx); paintTools(); AU.sfx("tick"); haptic(6); };
$("musBtn").onclick = () => { AU.setMusic(!AU.pref.music); paintTools(); haptic(6); };
paintTools();

/* ---------- offline ---------- */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

let rT;
window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(layout, 60); });
if (document.fonts) document.fonts.ready.then(layout);
if (!(ls.get(SAVE.last) === "random" && resumeRandom())) dailyCase();
})();
