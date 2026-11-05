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
const track = (path, title) => { if (window.SiatkaTrack) window.SiatkaTrack(path, title); };
/* historia wyników (js/history.js, ładuje się przed game.js); zapasowo pusta, żeby gra działała bez niej */
const HIST = window.SiatkaHistory || { record() {}, has: () => false, dailyResult: () => null, gamesDone: () => 0, fromClosedSave() {},
  summary: () => ({ daily: { played: 0, won: 0, pct: 0, cur: 0, best: 0 }, all: { played: 0, won: 0, pct: 0, avgMs: 0 } }) };

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
/* Ostatnio użyte imiona, role, sceny i smaczki (pole `used` z ostatnich spraw). Sprawy z archiwum
   i rozgrzewka dostają je jako opts.avoid, żeby się nie powtarzały. Sprawa dnia nigdy, bo ma być wspólna. */
const RECENT_KEY = "siatka-recent";
function rememberUsed(c) {
  if (!c.used) return;
  const list = (ls.get(RECENT_KEY) || []).filter(x => x && x.seed !== c.seed);
  list.push(Object.assign({ seed: c.seed }, c.used));
  ls.set(RECENT_KEY, list.slice(-Siatka.RECENT));
}
const recentAvoid = () => Siatka.avoidFrom((ls.get(RECENT_KEY) || []).map(({ seed, ...u }) => u));
/* Ta sama sprawa może być otwarta w dwóch miejscach naraz (karta w Chrome i zainstalowana gra dzielą
   pamięć na Androidzie). Kopia, która jeszcze nie wie o rozwiązaniu, nie może nadpisać wyniku swoim
   starym stanem: zamiast tego przejmuje zamkniętą sprawę. */
const sameCase = sv => !!(sv && sv.case && CASE && sv.case.seed === CASE.seed && Siatka.caseVersion(sv.case) === Siatka.caseVersion(CASE));
/* Wersja generatora jest zapisana razem z postępem (gen). Zapis, którego wersja nie zgadza się ze sprawą,
   pomijamy: lepiej zacząć sprawę od nowa niż przywrócić sznurki do innej sprawy albo wywalić grę.
   Zapisy sprzed wersjonowania nie mają gen, tak jak ich sprawy, więc obie strony liczą się jako 2.0. */
const saveOk = sv => !!(sv && sv.case && Array.isArray(sv.case.nodes)) && (sv.gen || Siatka.caseVersion(sv.case)) === Siatka.caseVersion(sv.case);
/* zapis dzisiejszej sprawy dnia, ale tylko z wersji generatora, która dziś obowiązuje */
function todaySave() {
  const sv = ls.get(SAVE.daily);
  return saveOk(sv) && sv.case.number === Siatka.dailyNumber() && Siatka.caseVersion(sv.case) === Siatka.versionFor() ? sv : null;
}
function closedElsewhere() {
  if (!S || !META || S.done) return null;
  const sv = ls.get(SAVE[META.kind]);
  return sameCase(sv) && sv.done ? sv : null;
}
function adoptClosed() {
  const sv = closedElsewhere();
  if (sv) load(sv.case, S.label, META, sv);
}
window.addEventListener("storage", e => { if (e.key === SAVE.daily || e.key === SAVE.random) adoptClosed(); });
function saveNow() {
  clearTimeout(saveT);
  if (!S || !META) return;
  if (closedElsewhere()) return;
  ls.set(SAVE[META.kind], { v: 1, gen: Siatka.caseVersion(CASE), case: CASE, label: S.label, strings: [...S.strings], out: [...S.out], read: [...S.read],
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
  if (window.SiatkaPrefs && !window.SiatkaPrefs.haptic) return; // wyłączone w ustawieniach
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
    // klucze i alibi, a do łączenia dowodów z teczkami: inicjały (B.S.) i numery mieszkań
    "(?<k>(?:klucz|kłódk|zamk|alibi|świad)\\p{L}*|zamek|\\p{Lu}\\.\\p{Lu}\\.|m\\. \\d+|(?:mieszkani\\p{L}*|numer\\p{L}*|spod) (?:nr )?\\d+)",
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
  // zamknięta sprawa, której wyniku nie ma w historii (zapisała go inna kopia gry): dopisujemy go
  if (saved && saved.done && saved.case) HIST.fromClosedSave(saved, meta.kind);
  buildRich();
  $("caseLine").textContent = `${label} · ${c.city_name}, ${c.year}`;
  buildBoard();
  const nh = Math.min(3, c.hints.length);
  $("hintBtn").disabled = S.done || S.hints >= nh; $("hintBtn").textContent = `Podpowiedź (${nh - S.hints})`;
  $("accuseBtn").textContent = S.done ? "Wynik" : "Oskarż";
  $("result").hidden = true; $("accuse").hidden = true; $("newCase").hidden = true;
  $("clock").textContent = fmt((S.tEnd || Date.now()) - S.t0);
  renderLives(); hideToast(); renderTabs(); renderSheet(); paintQuota();
  window.scrollTo(0, 0);
  saveNow(); paintDaily();
  if (!saved) rememberUsed(c);
  if (!saved) track(`sprawa/start/${meta.kind}/${c.size}`, `Start: ${meta.kind === "daily" ? "sprawa dnia" : "archiwum"} ${c.size}`);
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
  const E = of("evidence"); if (E.length) rows.push(E); // dowody rzeczowe: osobny rząd pod przedmiotami
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
  AU.sfx("attach"); haptic(18);
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
  // szuranie: krótkie ziarna co ≥70 ms, tylko gdy palec się rusza; głośność zależy od szybkości
  const now = performance.now(), prev = drag.rub;
  if (!prev) drag.rub = { x: lastPt.x, y: lastPt.y, t: now };
  else if (now - prev.t >= 70) {
    const v = Math.hypot(lastPt.x - prev.x, lastPt.y - prev.y) / (now - prev.t); // px/ms
    if (v > 0.08) AU.sfx("rub", Math.min(1, v / 1.2));
    drag.rub = { x: lastPt.x, y: lastPt.y, t: now };
  }
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
    const np = CASE.nodes.filter(n => n.type === "person").length, ni = CASE.nodes.filter(n => n.type === "item").length, ne = CASE.nodes.filter(n => n.type === "evidence").length;
    const evTxt = ne ? ` · ${ne} ${ne === 1 ? "dowód rzeczowy" : ne < 5 ? "dowody rzeczowe" : "dowodów rzeczowych"}` : "";
    sheet.innerHTML = `<h2>${CASE.title}</h2><div class="kind">Akta sprawy · ${np} podejrzanych · ${ni} ${ni > 4 ? "przedmiotów" : "przedmioty"}${evTxt} ·${CASE.rules.length} reguł${CASE.rules.length < 5 ? "y" : ""}</div><p>${rich(CASE.intro)}</p>
      <p class="how">Stuknij zdjęcie, żeby przeczytać akta. Przeciągnij sznurek od pinezki do pinezki, żeby powiązać fakty. Stuknij sznurek, żeby go przeciąć. Reguły znajdziesz w notatniku.</p>`;
    return;
  }
  const n = byId[S.sel];
  const linked = [...S.strings].filter(k => k.split("|").includes(n.id)).map(k => byId[k.split("|").find(x => x !== n.id)].label);
  const canOut = n.type === "person" || n.type === "item";
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
  track(`podpowiedz/${S.hints}`, `Podpowiedź ${S.hints}`);
};
setInterval(() => { if (S && !S.done && !document.hidden) $("clock").textContent = fmt(Date.now() - S.t0); }, 1000);
/* zegar stoi, gdy gra jest w tle */
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); saveNow(); }
  else { if (hiddenAt) { if (S && !S.done) S.t0 += Date.now() - hiddenAt; hiddenAt = 0; } adoptClosed(); }
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
  $("clock").textContent = fmt(S.tEnd - S.t0); // ten sam czas co w wyniku i po powrocie
  $("accuseBtn").textContent = "Wynik"; $("hintBtn").disabled = true;
  AU.sfx(win ? "win" : "lose"); haptic(win ? [20, 60, 20, 60, 80] : [120]);
  saveNow();
  HIST.record(CASE, { kind: META.kind, win, stars: starsOf(), ms: S.tEnd - S.t0, wrong: S.wrong, hints: S.hints });
  paintDaily();
  track(`sprawa/${win ? "wygrana" : "przegrana"}/${META.kind}`, `${win ? "Wygrana" : "Przegrana"}: ${META.kind === "daily" ? "sprawa dnia" : "archiwum"}`);
  if (win) track(`wynik/${starsOf()}-gwiazdki`, `Wynik: ${starsOf()} z 3 gwiazdek`);
  const cur = META.kind === "daily" ? HIST.summary().daily.cur : 0;
  if ([3, 7, 14, 30, 60, 100].includes(cur)) track(`seria/${cur}`, `Seria ${cur} dni`);
  showResult();
  if (window.SiatkaAch) {
    const strs = [...S.strings], good = strs.filter(k => supportedSet.has(k)).length;
    const people = CASE.nodes.filter(n => n.type === "person" && n.id !== CASE.solution.culprit);
    SiatkaAch.onFinish({ win, stars: starsOf(), wrong: S.wrong, hints: S.hints, ms: S.tEnd - S.t0, size: CASE.size,
      city: CASE.city, year: CASE.year, crime: CASE.crime, good, bad: strs.length - good, chain: chainKeys.every(k => S.strings.has(k)),
      allOut: people.every(n => S.out.has(n.id)) && !S.out.has(CASE.solution.culprit), hour: new Date().getHours() });
  }
}
const starsOf = () => S.win ? Math.max(1, 3 - S.wrong - (S.hints > 0 ? 1 : 0)) : 0;
const URL_GRY = "siatkapowiazan.pl";

function showResult() {
  const win = S.win, time = fmt(S.tEnd - S.t0);
  const stars = starsOf();
  const sm = HIST.summary(), sum = META.kind === "daily" ? sm.daily : null;
  const strs = [...S.strings], good = strs.filter(k => supportedSet.has(k)).length, bad = strs.length - good;
  const chainDone = chainKeys.every(k => S.strings.has(k));
  const cul = byId[CASE.solution.culprit], wpn = byId[CASE.solution.weapon], loc = byId[CASE.culprit_chain[0][1]];
  const share = `Siatka Powiązań · ${S.label}\n${CASE.city_name}, ${CASE.year}\n${"🔴".repeat(S.wrong)}${win ? "🟢" : ""} ${"★".repeat(stars)}${"☆".repeat(3 - stars)}\nPodpowiedzi: ${S.hints} · ${time}` +
    (sum && sum.cur >= 2 ? `\nSeria: ${sum.cur} 🔥` : "") + `\n${URL_GRY}`;
  $("resultCard").innerHTML = `
    <div class="stamp ${win ? "ok" : ""}">${win ? "SPRAWA ZAMKNIĘTA" : "SPRAWA UMORZONA"}</div>
    <h3></h3>
    ${win ? `<div class="stars" aria-label="${stars} z 3">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>` : `<p>Sprawcą ${cul.g === "f" ? "była" : "był"} ${cul.name}, a narzędziem ${(wpn.name.charAt(0).toLowerCase() + wpn.name.slice(1))}.</p>`}
    <p class="epi">${CASE.epilogue}</p>
    <div class="lbl">Rozumowanie</div>
    <ul class="why">${CASE.why.map(([w, t]) => `<li><b>${w}</b> ${t}</li>`).join("")}</ul>
    <div class="lbl">Twoja tablica</div>
    <div class="stat">Sznurki zgodne z faktami: ${good} · bez pokrycia: ${bad}<br>Obwód sprawcy (${cul.label} → ${loc.label} → ${wpn.label}): ${chainDone ? "domknięty" : "niedomknięty"}</div>
    ${win ? `<p class="quip">${CASE.detective}: „${CASE.quip}”</p>` : ""}
    <div class="lbl">Sprawy dnia</div>
    <div class="st-grid mini"><div><b>${sm.daily.cur}</b><span>seria</span></div><div><b>${sm.daily.best}</b><span>rekord</span></div><div><b>${sm.daily.pct}%</b><span>wygrane</span></div><div><b>${sm.daily.played}</b><span>rozegrane</span></div></div>
    <div class="lbl">Wszystkie sprawy</div>
    <div class="st-grid mini three"><div><b>${sm.all.played}</b><span>rozegrane</span></div><div><b>${sm.all.pct}%</b><span>wygrane</span></div><div><b>${sm.all.avgMs ? fmt(sm.all.avgMs) : "–"}</b><span>średni czas</span></div></div>
    <div class="lbl">Wynik do udostępnienia</div>
    <div class="share" id="shareTxt"></div>
    <div class="foot wrap"><button class="btn ghost" id="copyBtn">${navigator.share ? "Udostępnij" : "Kopiuj wynik"}</button><button class="btn ghost" id="imgBtn">Zapisz obrazek</button>${S.label === WARMUP ? `<button class="btn red full" id="toDailyBtn">Sprawa dnia</button>` : `<button class="btn red full" id="againBtn">Nowa sprawa</button>`}</div>
    <p class="fb-line"><button class="linkish" id="fbBtn">Coś się nie zgadza? Zgłoś uwagę</button></p>`;
  $("resultCard").querySelector("h3").textContent = `${cul.name} · ${wpn.name}`;
  $("shareTxt").textContent = share;
  $("result").hidden = false;
  $("copyBtn").onclick = e => {
    const b = e.currentTarget;
    const sel = () => { const r = document.createRange(); r.selectNodeContents($("shareTxt")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Zaznaczono, skopiuj"; };
    const copy = () => { try { navigator.clipboard.writeText(share).then(() => { b.textContent = "Skopiowano"; AU.sfx("tick"); haptic(8); track("wynik/kopiuj", "Wynik skopiowany"); }, sel); } catch (_) { sel(); } };
    // telefon: systemowe „Udostępnij”; anulowanie nic nie robi, brak wsparcia → kopiowanie
    if (navigator.share) navigator.share({ text: share }).then(() => track("wynik/udostepnij", "Wynik udostępniony"), err => { if (!err || err.name !== "AbortError") copy(); });
    else copy();
  };
  if ($("againBtn")) $("againBtn").onclick = openNewCase;
  if ($("toDailyBtn")) $("toDailyBtn").onclick = () => { AU.sfx("page"); dailyCase(); };
  $("fbBtn").onclick = () => { if (window.SiatkaFeedback) SiatkaFeedback.open("wynik", "Błąd w sprawie/logice"); };
  paintQuota();
  /* obrazek rysujemy od razu w tle: kliknięcie musi wywołać „Udostępnij” bez czekania, inaczej
     przeglądarka uzna, że to już nie gest gracza */
  const imgName = `siatka-${CASE.number ? "sprawa-" + String(CASE.number).padStart(3, "0") : "archiwum"}.png`;
  const img = window.SiatkaShareImg ? SiatkaShareImg.render({
    label: S.label, place: `${CASE.city_name}, ${CASE.year}`, win, stars, time, wrong: S.wrong, hints: S.hints,
    streak: sum && sum.cur ? sum.cur : null, seed: CASE.seed, url: URL_GRY,
    nodes: CASE.nodes.map(n => ({ id: n.id, type: n.type })), rows: rowsOf().map(r => r.map(n => n.id)),
    strings: strs.map(k => k.split("|")), out: [...S.out]
  }).catch(() => null) : Promise.resolve(null);
  $("imgBtn").onclick = async e => {
    const b = e.currentTarget;
    try {
      const blob = await img;
      if (!blob) throw new Error("brak obrazka");
      const r = await SiatkaShareImg.deliver(blob, imgName);
      if (r === "cancel") return;
      b.textContent = r === "shared" ? "Udostępniono" : "Zapisano"; AU.sfx("tick"); haptic(8);
      track("wynik/obrazek", "Wynik jako obrazek");
    } catch (_) { b.textContent = "Nie udało się"; }
  };
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
  if (!quota.left()) { paintQuota(); showLimit(); return; } // wynik zostaje pod kartką
  $("result").hidden = true;
  if (!DEV()) { newCase(); return; }
  chips("optCity", [["", "Losowo"], ...Object.entries(WORLD.cities).map(([id, c]) => [id, c.name])], "city");
  const ys = []; for (let y = WORLD.base.years[0]; y <= WORLD.base.years[1]; y++) ys.push([y, String(y)]);
  chips("optYear", [["", "Losowo"], ...ys], "year");
  const sz = Siatka.SIZES;
  chips("optSize", [["", "Losowo"], ...Object.entries(sz).map(([k, v]) => [k, v.name, `${v.n} os.`])], "size");
  $("newCase").hidden = false;
}
/* Limit nowych spraw: DAILY_NEW_CASES na dzień wg lokalnej daty gracza. Licznik z datą w localStorage,
   nowy dzień = nowy licznik. Sprawa dnia i rozgrzewka się nie liczą. W #dev bez limitu. */
const DAILY_NEW_CASES = 5;
const QUOTA_KEY = "siatka-quota";
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const quota = {
  used() {
    try { const q = JSON.parse(localStorage.getItem(QUOTA_KEY) || "null"); return q && q.d === dayStr() ? Math.max(0, +q.n || 0) : 0; } catch (_) { return 0; }
  },
  take() { const n = this.used() + 1; try { localStorage.setItem(QUOTA_KEY, JSON.stringify({ d: dayStr(), n })); } catch (_) {} },
  left() { return DEV() ? Infinity : Math.max(0, DAILY_NEW_CASES - this.used()); }
};
try { localStorage.removeItem("siatka-next-case"); } catch (_) {} // po dawnej blokadzie 2 min
/* Przy 0/5 przycisk jest wyszarzony, ale klikalny: pokazuje kartkę „archiwum zamknięte”. */
function paintQuota() {
  const left = quota.left(), dev = left === Infinity;
  const label = dev ? "Nowa sprawa" : `Nowa sprawa · ${left}/${DAILY_NEW_CASES}`;
  ["newBtn", "againBtn"].forEach(id => {
    const b = $(id); if (!b) return;
    b.textContent = label; b.disabled = false; b.classList.toggle("spent", !left);
    b.setAttribute("aria-label", dev ? label : `Nowa sprawa, na dziś ${left === 1 ? "została" : "zostało"} ${left} z ${DAILY_NEW_CASES}`);
  });
}
function showLimit() {
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const min = Math.max(1, Math.ceil((mid - now) / 60000)), h = Math.floor(min / 60);
  $("limitWhen").textContent = `Nowe sprawy za ${h ? `${h} h ` : ""}${min % 60} min, o północy.`;
  $("limit").hidden = false;
  AU.sfx("stamp"); haptic([20, 50, 20]);
  track("limit/wyczerpany", "Limit nowych spraw wyczerpany");
}
$("limitClose").onclick = () => { $("limit").hidden = true; };
$("limitDaily").onclick = () => { $("limit").hidden = true; $("result").hidden = true; saveNow(); AU.sfx("page"); dailyCase(); };
$("limit").addEventListener("click", e => { if (e.target.id === "limit") e.currentTarget.hidden = true; });

/* Znaczek na „Sprawa dnia”: ✓ rozwiązana, ✗ umorzona. Ze stanu zapisu dzisiejszej sprawy
   (zapasowo ze statystyk); po północy numer się zmienia i znaczek znika. */
function dailyState() {
  const n = Siatka.dailyNumber(), sv = todaySave();
  if (sv && sv.done) return sv.win ? "win" : "lose";
  const st = HIST.dailyResult(n);
  return st ? (st.win ? "win" : "lose") : null;
}
function paintDaily() {
  const st = dailyState(), b = $("dailyBtn");
  b.innerHTML = "Sprawa dnia" + (st ? `<i class="mk ${st}" aria-hidden="true">${st === "win" ? "✓" : "✗"}</i>` : "");
  b.setAttribute("aria-label", st ? `Sprawa dnia, ${st === "win" ? "rozwiązana" : "umorzona"}` : "Sprawa dnia");
}
const paintDay = () => { paintQuota(); paintDaily(); };
/* o północy: nowy licznik i nowa sprawa dnia (timery w tle bywają uśpione, więc też przy powrocie do karty) */
(function armMidnight() {
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
  setTimeout(() => { paintDay(); armMidnight(); }, next - now);
})();
document.addEventListener("visibilitychange", () => { if (!document.hidden) paintDay(); });

/* Tempo dla nowych graczy: liczymy ukończone gry (sprawy dnia + losowe, ze statystyk) i przez pierwsze
   10 gier losowa sprawa jest mała: gry 1–3 S, 4–5 S/M, 6–7 M, 8–10 M/L. Od 11. pełna losowość. */
const gamesDone = () => HIST.gamesDone();
function rampSize() {
  const g = gamesDone() + 1, any = a => a[Math.floor(Math.random() * a.length)];
  return g <= 3 ? "S" : g <= 5 ? any(["S", "M"]) : g <= 7 ? "M" : g <= 10 ? any(["M", "L"]) : undefined;
}
/* Rozgrzewka: nowy gracz (0 ukończonych gier), który trafia na sprawę dnia L lub XL, dostaje najpierw małą
   sprawę spoza serii. Sprawa dnia zostaje wspólna dla wszystkich i czeka pod przyciskiem. */
const WARMUP = "Sprawa na rozgrzewkę";
function warmupCase() {
  if (gamesDone() > 0 || !["L", "XL"].includes(Siatka.dailySize())) return false;
  if (todaySave()) return false; // sprawa dnia już zaczęta
  load(Siatka.generateCase(WORLD, "rozgrzewka-" + Date.now().toString(36), { size: "S", avoid: recentAvoid() }), WARMUP, { kind: "random" });
  return true;
}

let randomN = 0;
function newCase() {
  if (!quota.left()) { $("newCase").hidden = true; paintQuota(); showLimit(); return; }
  if (!DEV()) quota.take();
  randomN++;
  const seed = "losowa-" + Date.now().toString(36) + "-" + randomN;
  const o = DEV() ? OPT : { size: rampSize() };
  if (DEV()) ls.set("siatka-opts", OPT);
  AU.sfx("page");
  load(Siatka.generateCase(WORLD, seed, { city: o.city || undefined, year: o.year ? +o.year : undefined, size: o.size || undefined, avoid: recentAvoid() }), "Sprawa z archiwum", { kind: "random" });
  paintQuota();
}
function dailyCase() {
  const n = Siatka.dailyNumber(), sv = todaySave();
  const label = `Sprawa #${String(n).padStart(3, "0")}`;
  /* Historia mówi, że sprawa dnia jest rozegrana, a zapis tablicy nie (np. nadpisała go starsza kopia
     gry albo zapis był z innej wersji generatora): zamykamy ją z wynikiem z historii. Drugi raz się jej nie rozegra. */
  const st = HIST.dailyResult(n);
  const closed = st && { done: true, win: !!st.win, elapsed: st.ms || 0, hints: st.hints || 0, wrong: st.wrong || 0 };
  if (sv) {
    if (closed && !sv.done) Object.assign(sv, closed);
    try { return load(sv.case, label, { kind: "daily" }, sv); } catch (e) { console.warn("Zapis sprawy dnia pominięty", e); }
  }
  // brak pasującego zapisu: świeża sprawa; rozegrana już (wg statystyk) wraca od razu zamknięta
  load(Siatka.dailyCase(WORLD), label, { kind: "daily" }, closed || undefined);
}
function resumeRandom() {
  const sv = ls.get(SAVE.random);
  if (!saveOk(sv) || sv.done) return false;
  try { load(sv.case, sv.label || "Sprawa z archiwum", { kind: "random" }, sv); return true; } catch (_) { return false; }
}
$("dailyBtn").onclick = () => { saveNow(); AU.sfx("page"); dailyCase(); };
$("newBtn").onclick = openNewCase;
$("newCancel").onclick = () => { $("newCase").hidden = true; };
$("newGo").onclick = newCase;
$("newCase").addEventListener("click", e => { if (e.target.id === "newCase") e.currentTarget.hidden = true; });

/* pełny ekran i ustawienia: js/settings.js; po zmianie trybu przeliczamy tablicę */
["fullscreenchange", "webkitfullscreenchange"].forEach(ev => document.addEventListener(ev, () => setTimeout(layout, 80)));

/* ---------- offline ---------- */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

let rT;
window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(layout, 60); });
if (document.fonts) document.fonts.ready.then(layout);
if (!(ls.get(SAVE.last) === "random" && resumeRandom()) && !warmupCase()) dailyCase();

/* ---------- samouczek: przy pierwszym uruchomieniu i pod „Jak grać”; zegar stoi, gdy jest otwarty ---------- */
function openHowto(auto) {
  const H = window.SiatkaHowto; if (!H) return;
  track(auto === true ? "samouczek/start-auto" : "samouczek/start-przycisk", auto === true ? "Samouczek: pierwsze uruchomienie" : "Samouczek: przycisk");
  const t = Date.now(); setPending(null);
  H.open(() => { if (S && !S.done) S.t0 += Date.now() - t; saveSoon(); }, { install: auto === true });
}
window.addEventListener("load", () => { if (window.SiatkaHowto && !window.SiatkaHowto.seen()) openHowto(true); });
/* opis bieżącej sprawy do zgłoszeń: wystarczy, żeby ją odtworzyć (seed + miasto, rok, wielkość) */
function caseInfo() {
  if (!CASE || !S) return "";
  const st = S.done ? (S.win ? "rozwiązana" : "umorzona") : "w trakcie";
  return `${S.label} · ${CASE.city_name}, ${CASE.year} · ${CASE.size} · seed ${CASE.seed} · generator ${Siatka.caseVersion(CASE)} · ${st}, pomyłki ${S.wrong}, podpowiedzi ${S.hints}`;
}
window.SiatkaGame = { openHowto: () => openHowto(), haptic: p => haptic(p), caseInfo };
})();
