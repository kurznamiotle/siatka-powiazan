#!/usr/bin/env node
/* Test dymny w prawdziwej przeglądarce (headless Chrome, świeży profil = pusty localStorage):
 *   1. start gry: samouczek otwiera się sam, przejście wszystkich kroków (ostatni: „Oskarżenie”),
 *   2. nowy gracz bez kropki „Co nowego” przy zębatce,
 *   3. Ustawienia → „Jak grać” otwiera samouczek od kroku 1,
 *   4. sprawa dnia, akta pierwszego zdjęcia, notatnik z regułami,
 *   5. zero błędów w konsoli i zero wyjątków przez cały czas.
 *   node tools/smoke.js            (część npm test; ma przechodzić przed każdym pushem)
 * Wymaga Chrome/Edge (ścieżka w zmiennej CHROME albo domyślna) i Node 22+ (WebSocket, fetch). */
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), { spawn } = require("child_process");
const root = path.join(__dirname, "..");
const chrome = process.env.CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
].find(p => fs.existsSync(p));
if (!chrome) { console.error("smoke: nie znaleziono Chrome. Ustaw zmienną CHROME."); process.exit(1); }

/* statyczny serwer na losowym porcie (z file:// nie działa service worker i część API) */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  const f = path.join(root, u === "/" ? "index.html" : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [], steps = [];
let proc, profile, ws;
const finish = code => {
  try { ws && ws.close(); } catch (_) {}
  try { proc && proc.kill(); } catch (_) {}
  server.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {} process.exit(code); }, 600);
};
const fail = msg => { console.error("smoke: BŁĄD – " + msg); if (errors.length) console.error("Konsola:\n  " + errors.join("\n  ")); finish(1); throw new Error("stop"); };

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const URL = process.env.SMOKE_URL || `http://127.0.0.1:${server.address().port}/index.html`; // SMOKE_URL: test produkcji (dopisz #dev, żeby nie wysyłać analityki)
  const PORT = 9400 + Math.floor(Math.random() * 400);
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "siatka-smoke-"));
  proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--mute-audio",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });

  let ver;
  for (let i = 0; i < 80 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (_) { await sleep(250); } }
  if (!ver) fail("Chrome nie wystartował");
  ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; return; }
    const p = d.params || {};
    if (d.method === "Runtime.exceptionThrown") {
      const e = p.exceptionDetails; errors.push("wyjątek: " + ((e.exception && e.exception.description) || e.text) + (e.url ? ` (${e.url.replace(/^.*\//, "")}:${e.lineNumber + 1})` : ""));
    } else if (d.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "assert")) {
      errors.push("console.error: " + p.args.map(a => a.value !== undefined ? a.value : a.description).join(" "));
    } else if (d.method === "Log.entryAdded" && p.entry.level === "error") {
      // zasoby z zewnątrz (fonty Google, analityka) mogą nie dojść bez internetu; własne pliki gry muszą
      const u = p.entry.url || "";
      if (!(p.entry.source === "network" && u && !u.startsWith("http://127.0.0.1"))) errors.push("log: " + p.entry.text + (u ? " " + u : ""));
    }
  };
  const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId: s } } = await send("Target.attachToTarget", { targetId, flatten: true });
  const C = (m, p) => send(m, p, s);
  await C("Runtime.enable"); await C("Log.enable"); await C("Page.enable");
  await C("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await C("Emulation.setTouchEmulationEnabled", { enabled: true });

  const ev = async expr => {
    const r = await C("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) fail(`wyrażenie testu się wywróciło: ${expr}\n  ${r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description}`);
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const waitFor = async (expr, what, ms = 8000) => {
    for (let t = 0; t < ms; t += 100) { if (await ev(`!!(${expr})`)) return; await sleep(100); }
    fail(what);
  };
  const ok = msg => { steps.push(msg); console.log("  ✓ " + msg); };
  const visible = idv => `(document.getElementById(${JSON.stringify(idv)}) && !document.getElementById(${JSON.stringify(idv)}).hidden)`;
  // prawdziwe stuknięcie palcem (gest użytkownika: wibracja, dźwięk), nie syntetyczne .click()
  const tapSel = async (sel, what) => {
    // czekamy, aż przycisk stoi w miejscu (karty wjeżdżają z animacją) i nic go nie zasłania
    let pt = null, last = "";
    for (let t = 0; t < 4000 && !pt; t += 100) {
      const r = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: "center" });
        const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y);
        return { x, y, ok: !!r.width && !!h && (h === b || b.contains(h)), at: x.toFixed(1) + "," + y.toFixed(1) }; })()`);
      if (r && r.ok && r.at === last) pt = r; else { last = r ? r.at : ""; await sleep(100); }
    }
    if (!pt) fail(`brak (albo zasłonięty) przycisk ${what || sel}`);
    await C("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y }] });
    await sleep(40);
    await C("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(200);
  };
  const click = idv => tapSel("#" + idv);

  console.log("smoke: " + URL);
  await C("Page.navigate", { url: URL });
  await waitFor(`document.readyState === "complete" && document.querySelector("#board .node")`, "tablica się nie zbudowała", 15000);
  ok("gra wystartowała, tablica ma " + await ev(`document.querySelectorAll("#board .node").length`) + " zdjęć");

  // 1. samouczek przy pierwszym uruchomieniu, wszystkie kroki
  await waitFor(visible("howto"), "samouczek nie otworzył się sam przy pierwszym uruchomieniu");
  const total = +(await ev(`(document.getElementById("hwStep").textContent.match(/z (\\d+)/) || [])[1]`));
  if (!(total >= 4)) fail(`samouczek ma ${total} kroków, a powinien co najmniej 4`);
  const titles = [];
  for (let k = 1; k <= total; k++) {
    const st = await ev(`({ step: document.getElementById("hwStep").textContent, title: document.getElementById("hwTitle").textContent,
      stage: document.getElementById("hwStage").innerHTML.length, txt: document.getElementById("hwTxt").textContent.length })`);
    if (st.step !== `Krok ${k} z ${total}`) fail(`oczekiwano „Krok ${k} z ${total}”, jest „${st.step}”`);
    if (!st.title || st.stage < 200 || st.txt < 20) fail(`pusta plansza samouczka na kroku ${k} (${st.title})`);
    if (/undefined|NaN|object Object/.test(await ev(`document.getElementById("hwCard").innerHTML`))) fail(`plansza ${k} („${st.title}”) ma „undefined”/„NaN” w treści`);
    titles.push(st.title);
    await click("hwNext");
  }
  if (await ev(visible("howto"))) fail("samouczek nie zamknął się po ostatnim kroku");
  if (titles[titles.length - 1] !== "Oskarżenie") fail(`ostatnia plansza to „${titles[titles.length - 1]}”, a powinno być „Oskarżenie”`);
  ok(`samouczek: ${total} kroki (${titles.join(" → ")})`);
  if (await ev(`localStorage.getItem("siatka-howto")`) !== "1") fail("samouczek nie zapisał flagi siatka-howto");

  // 2. nowy gracz bez kropki „Co nowego”
  if (await ev(`document.getElementById("menuBtn").classList.contains("has-dot")`)) fail("nowy gracz ma kropkę „Co nowego” przy zębatce");
  ok("nowy gracz bez kropki „Co nowego”");

  // 3. Ustawienia → Jak grać
  await click("menuBtn");
  await waitFor(visible("menu") + ` && document.getElementById("setHowto")`, "Ustawienia się nie otworzyły");
  await click("setHowto");
  await waitFor(visible("howto"), "„Jak grać” nie otworzyło samouczka");
  if (await ev(`document.getElementById("hwStep").textContent`) !== `Krok 1 z ${total}`) fail("„Jak grać” nie zaczyna od kroku 1");
  for (let k = 1; k < total; k++) await click("hwNext");
  if (await ev(`document.getElementById("hwTitle").textContent`) !== "Oskarżenie") fail("„Jak grać”: ostatni krok to nie „Oskarżenie”");
  await click("hwSkip");
  if (await ev(visible("howto"))) fail("„Pomiń” nie zamknęło samouczka");
  ok("Ustawienia → „Jak grać” → wszystkie kroki → Pomiń");

  // 4. sprawa dnia, akta, notatnik
  await click("dailyBtn");
  await waitFor(`document.querySelector("#board .node") && /Sprawa/.test(document.getElementById("caseLine").textContent)`, "sprawa dnia się nie wczytała");
  const line = await ev(`document.getElementById("caseLine").textContent.trim()`);
  await tapSel("#board .node", "pierwszego zdjęcia na tablicy");
  const akta = await ev(`document.getElementById("sheet").innerText`);
  if (!akta || akta.length < 60) fail("akta pierwszego zdjęcia są puste");
  await click("tab-notes");
  const notes = await ev(`document.getElementById("sheet").innerText`);
  if (!notes || notes.length < 60 || notes === akta) fail("notatnik się nie otworzył");
  if (/undefined|NaN|object Object/.test(akta + notes)) fail("„undefined”/„NaN”/„object Object” w aktach albo notatniku");
  ok(`sprawa dnia (${line.replace(/\s+/g, " ")}): akta i notatnik`);

  await sleep(500);
  if (errors.length) fail(`${errors.length} błędów w konsoli`);
  console.log(`smoke: OK (${steps.length} kroków, 0 błędów w konsoli)`);
  finish(0);
})().catch(e => { if (e.message !== "stop") { console.error("smoke:", e); finish(1); } });
