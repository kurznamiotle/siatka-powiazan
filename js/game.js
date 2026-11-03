/*
 * Siatka Powiązań — interfejs gry (tablica, sznurki, akta, oskarżenie, wynik).
 * Wymaga: engine/sprites.js, engine/engine.js, data/base.js, data/cities.js
 */
(() => {
const WORLD = { base: window.SIATKA_BASE, cities: window.SIATKA_CITIES };
const { svg: sprite } = window.SiatkaSprites;
const $ = id => document.getElementById(id);

let CASE, byId, supportedSet, chainKeys, S, els = {};
const key = (a, b) => [a, b].sort().join("|");
const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
/* stabilna pseudolosowość z id węzła (obrót, przesunięcie) */
const h01 = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };

/* ---------- ładowanie sprawy ---------- */
function load(c, label) {
  CASE = c;
  byId = Object.fromEntries(c.nodes.map(n => [n.id, n]));
  supportedSet = new Set(c.supported_connections.map(([a, b]) => key(a, b)));
  chainKeys = c.culprit_chain.map(([a, b]) => key(a, b));
  S = { strings: new Set(), out: new Set(), sel: null, tab: "akta", hints: 0, wrong: 0, done: false, win: false, t0: Date.now(), tEnd: null, pending: null, pick: { who: null, what: null }, label };
  $("caseLine").textContent = `${label} · ${c.city_name}, ${c.year}`;
  buildBoard();
  const nh = Math.min(3, c.hints.length);
  $("hintBtn").disabled = nh === 0; $("hintBtn").textContent = `Podpowiedź (${nh})`;
  $("result").hidden = true; $("accuse").hidden = true; $("newCase").hidden = true; $("clock").textContent = "0:00";
  renderLives(); hideToast(); renderTabs(); renderSheet();
  window.scrollTo(0, 0);
}

/* ---------- tablica: układ zależny od liczby węzłów ---------- */
const board = $("board"), svgEl = $("strings");
function buildBoard() {
  board.querySelectorAll(".node,.pin").forEach(e => e.remove());
  els = {};
  CASE.nodes.forEach(n => {
    const b = document.createElement("button");
    b.className = `node ${n.type === "location" ? "loc" : n.type} unread`; b.dataset.node = n.id;
    const r = Math.round((h01(n.id + "r") * 2 - 1) * 3);
    b.style.setProperty("--r", r + "deg");
    b.innerHTML = `<span class="ph">${sprite(n.sprite)}</span><span class="lb">${n.label}</span>`;
    b.setAttribute("aria-label", `${n.name}, otwórz akta`);
    b.addEventListener("click", () => select(n.id));
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
function layout() {
  if (!CASE) return;
  const W = board.clientWidth, pad = 12;
  const rows = rowsOf();
  const maxPer = Math.max(4, ...rows.map(r => r.length));
  const nodeW = Math.round(Math.min(100, (W - pad * 2) / maxPer * 0.84));
  const lbfs = nodeW < 70 ? "9.5px" : nodeW < 82 ? "10.5px" : "11.5px";
  for (const id in els) {
    // długie pojedyncze słowa (np. „Pogrzebacz”) dostają mniejszą czcionkę zamiast łamania
    const longest = Math.max(...els[id].n.label.split(/\s+/).map(w => w.length));
    const fit = Math.floor((nodeW - 14) / (longest * 0.6) * 10) / 10;
    els[id].card.style.width = nodeW + "px";
    els[id].card.style.setProperty("--lbfs", Math.min(parseFloat(lbfs), fit) + "px");
  }
  const nodeH = Math.max(...Object.values(els).map(e => e.card.offsetHeight));
  const gapY = 22;
  let y = 20;
  rows.forEach(row => {
    const slot = (W - pad * 2) / row.length;
    row.forEach((n, i) => {
      const free = Math.max(0, slot - nodeW);
      const x = pad + slot * i + free / 2 + (h01(n.id + "x") - .5) * free * .5;
      const yy = y + (h01(n.id + "y") - .5) * 8;
      els[n.id].card.style.left = Math.round(x) + "px"; els[n.id].card.style.top = Math.round(yy) + "px";
    });
    y += nodeH + gapY;
  });
  board.style.height = Math.round(y - gapY + 18) + "px";
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
function pathD(a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y), sag = 10 + d * .09; return `M${a.x},${a.y} Q${(a.x + b.x) / 2},${(a.y + b.y) / 2 + sag} ${b.x},${b.y}`; }
function drawStrings() {
  let h = "";
  S.strings.forEach(k => { const [a, b] = k.split("|"); const d = pathD(els[a].pt, els[b].pt);
    h += `<path class="s" data-k="${k}" d="${d}"/><path class="hit" data-k="${k}" d="${d}"><title>Przetnij sznurek</title></path>`; });
  svgEl.innerHTML = h + `<path class="tmp" id="tmp" d=""/>`;
  svgEl.querySelectorAll(".hit").forEach(p => p.addEventListener("click", e => { e.stopPropagation(); cut(p.dataset.k); }));
}
function cut(k) { const v = svgEl.querySelector(`.s[data-k="${k}"]`); if (v) v.classList.add("cut"); S.strings.delete(k); setTimeout(() => { drawStrings(); if (S.sel) renderSheet(); }, 250); }
function connect(a, b) { if (a === b || S.done) return; const k = key(a, b); if (S.strings.has(k)) return; S.strings.add(k); drawStrings(); if (S.sel) renderSheet(); }

let drag = null;
board.addEventListener("pointerdown", e => { const pin = e.target.closest("[data-pin]"); if (!pin || S.done) return; e.preventDefault(); drag = { id: pin.dataset.pin, x: e.clientX, y: e.clientY, moved: false }; });
window.addEventListener("pointermove", e => {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
  if (!drag.moved) return;
  const br = board.getBoundingClientRect(), t = $("tmp");
  if (t) t.setAttribute("d", pathD(els[drag.id].pt, { x: e.clientX - br.left, y: e.clientY - br.top }));
});
window.addEventListener("pointerup", e => {
  if (!drag) return; const d = drag; drag = null;
  const t = $("tmp"); if (t) t.setAttribute("d", "");
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const tgt = under && (under.closest("[data-pin]") || under.closest("[data-node]"));
  const id = tgt && (tgt.dataset.pin || tgt.dataset.node);
  if (d.moved) { if (id && id !== d.id) connect(d.id, id); setPending(null); return; }
  if (S.pending && S.pending !== d.id) { connect(S.pending, d.id); setPending(null); }
  else setPending(S.pending === d.id ? null : d.id);
});
function setPending(id) {
  if (S.pending && els[S.pending]) els[S.pending].pin.classList.remove("pending");
  S.pending = id;
  if (id) { els[id].pin.classList.add("pending"); toast("Łączenie", `Stuknij drugą pinezkę, żeby przeciągnąć sznurek od: ${byId[id].name}.`, 0); }
  else hideToast();
}

/* ---------- akta i notatnik ---------- */
const sheet = $("sheet");
function select(id) {
  S.sel = id; S.tab = "akta";
  els[id].card.classList.remove("unread");
  Object.values(els).forEach(o => o.card.classList.remove("sel")); els[id].card.classList.add("sel");
  renderTabs(); renderSheet();
}
function renderTabs() { $("tab-akta").setAttribute("aria-selected", S.tab === "akta"); $("tab-notes").setAttribute("aria-selected", S.tab === "notes"); }
function renderSheet() {
  sheet.scrollTop = 0;
  if (S.tab === "notes") {
    sheet.innerHTML = `<h2>Notatnik detektywa</h2><div class="kind">Ustalenia techników i lekarza</div><ol>${CASE.rules.map(r => `<li>${r.text}</li>`).join("")}</ol>`;
    return;
  }
  if (!S.sel) {
    const np = CASE.nodes.filter(n => n.type === "person").length, ni = CASE.nodes.filter(n => n.type === "item").length;
    sheet.innerHTML = `<h2>${CASE.title}</h2><div class="kind">Akta sprawy · ${np} podejrzanych · ${ni} ${ni > 4 ? "dowodów" : "dowody"} · ${CASE.rules.length} reguł${CASE.rules.length < 5 ? "y" : ""}</div><p>${CASE.intro}</p>
      <p class="how">Stuknij zdjęcie, żeby przeczytać akta. Przeciągnij sznurek od pinezki do pinezki, żeby powiązać fakty. Stuknij sznurek, żeby go przeciąć. Reguły znajdziesz w notatniku.</p>`;
    return;
  }
  const n = byId[S.sel];
  const linked = [...S.strings].filter(k => k.split("|").includes(n.id)).map(k => byId[k.split("|").find(x => x !== n.id)].label);
  const canOut = n.type !== "location";
  sheet.innerHTML = `<h2>${n.name}</h2><div class="kind">${n.kind}</div><ul>${n.text.map(f => `<li>${f}</li>`).join("")}</ul>
    <div class="row">${canOut ? `<button class="chip ${S.out.has(n.id) ? "on" : ""}" id="outBtn">${S.out.has(n.id) ? "Przywróć" : "Wyklucz"}</button>` : ""}
    <button class="chip" id="backBtn">Akta sprawy</button></div>
    ${linked.length ? `<p class="how">Powiązania: ${linked.join(", ")}</p>` : ""}`;
  const ob = $("outBtn");
  if (ob) ob.onclick = () => { S.out.has(n.id) ? S.out.delete(n.id) : S.out.add(n.id); els[n.id].card.classList.toggle("out", S.out.has(n.id)); renderSheet(); };
  $("backBtn").onclick = () => { S.sel = null; Object.values(els).forEach(o => o.card.classList.remove("sel")); renderSheet(); };
}
$("tab-akta").onclick = () => { S.tab = "akta"; renderTabs(); renderSheet(); };
$("tab-notes").onclick = () => { S.tab = "notes"; renderTabs(); renderSheet(); };

/* ---------- dymek, podpowiedzi, zegar ---------- */
const toastEl = $("toast"); let toastT;
function toast(title, txt, ms = 6000) { toastEl.innerHTML = `<b>${title}</b>${txt}`; toastEl.hidden = false; clearTimeout(toastT); if (ms) toastT = setTimeout(hideToast, ms); }
function hideToast() { toastEl.hidden = true; }
toastEl.addEventListener("click", hideToast);
$("hintBtn").onclick = () => {
  const max = Math.min(3, CASE.hints.length);
  if (S.hints >= max || S.done) return;
  toast(`Podpowiedź ${S.hints + 1}/${max}`, CASE.hints[S.hints], 9000);
  S.hints++; $("hintBtn").textContent = `Podpowiedź (${max - S.hints})`; if (S.hints >= max) $("hintBtn").disabled = true;
};
setInterval(() => { if (S && !S.done) $("clock").textContent = fmt(Date.now() - S.t0); }, 1000);

/* ---------- oskarżenie ---------- */
const goBtn = $("accuseGo"), msg = $("accuseMsg");
function buildPicks() {
  $("toolLbl").textContent = CASE.tool_label;
  const mk = (boxId, type, field) => {
    const box = $(boxId); box.innerHTML = "";
    CASE.nodes.filter(n => n.type === type).forEach(n => {
      const b = document.createElement("button"); b.className = "pick"; b.textContent = n.name + (S.out.has(n.id) ? " · wykluczony" : "");
      b.onclick = () => { S.pick[field] = n.id; box.querySelectorAll(".pick").forEach(x => x.classList.remove("on")); b.classList.add("on"); goBtn.disabled = !(S.pick.who && S.pick.what); msg.textContent = ""; };
      box.appendChild(b);
    });
  };
  mk("pickWho", "person", "who"); mk("pickWhat", "item", "what");
  S.pick = { who: null, what: null }; goBtn.disabled = true; msg.textContent = "";
}
$("accuseBtn").onclick = () => { if (S.done) return showResult(); buildPicks(); $("accuse").hidden = false; };
$("accuseCancel").onclick = () => { $("accuse").hidden = true; };
goBtn.onclick = () => {
  if (S.pick.who === CASE.solution.culprit && S.pick.what === CASE.solution.weapon) return finish(true);
  S.wrong++; renderLives();
  if (S.wrong >= 3) return finish(false);
  const card = $("accuseCard"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
  const left = 3 - S.wrong;
  msg.textContent = `Prokurator odrzuca akt oskarżenia. Fakty się nie spinają. ${left === 1 ? "Została 1 próba." : `Zostały ${left} próby.`}`;
};
function renderLives() { document.querySelectorAll("#lives i").forEach((i, ix) => i.classList.toggle("lost", ix >= 3 - S.wrong)); }
function finish(win) { S.done = true; S.win = win; S.tEnd = Date.now(); $("accuse").hidden = true; setPending(null); showResult(); }

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
    try { navigator.clipboard.writeText(share).then(() => b.textContent = "Skopiowano", sel); } catch (_) { sel(); }
  };
  $("againBtn").onclick = openNewCase;
}
$("result").addEventListener("click", e => { if (e.target.id === "result") e.currentTarget.hidden = true; });

/* ---------- nowa sprawa: miasto, rok, wielkość ---------- */
const store = {
  get() { try { return JSON.parse(localStorage.getItem("siatka-opts") || "{}"); } catch (_) { return {}; } },
  set(v) { try { localStorage.setItem("siatka-opts", JSON.stringify(v)); } catch (_) {} }
};
let OPT = Object.assign({ city: "", year: "", size: "M" }, store.get());
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
let randomN = 0;
function newCase() {
  randomN++;
  const seed = "losowa-" + Date.now().toString(36) + "-" + randomN;
  const o = DEV() ? OPT : {};
  if (DEV()) store.set(OPT);
  load(Siatka.generateCase(WORLD, seed, { city: o.city || undefined, year: o.year ? +o.year : undefined, size: o.size || undefined }), "Sprawa z archiwum");
}
function dailyCase() { const c = Siatka.dailyCase(WORLD); load(c, `Sprawa #${String(c.number).padStart(3, "0")}`); }
$("dailyBtn").onclick = dailyCase;
$("newBtn").onclick = openNewCase;
$("newCancel").onclick = () => { $("newCase").hidden = true; };
$("newGo").onclick = newCase;
$("newCase").addEventListener("click", e => { if (e.target.id === "newCase") e.currentTarget.hidden = true; });

let rT;
window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(layout, 60); });
if (document.fonts) document.fonts.ready.then(layout);
dailyCase();
})();
