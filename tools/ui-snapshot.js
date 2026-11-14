#!/usr/bin/env node
/*
 * Zrzut interfejsu do porównania przed i po refaktorze (np. i18n): headless Chrome przechodzi przez samouczek,
 * Ustawienia, Co nowego, Statystyki, Osiągnięcia, akta, notatnik, podpowiedź, oskarżenie (błędne i trafne),
 * wynik i okno „Nowa sprawa” i zapisuje HTML każdego stanu. Dwa zrzuty z tego samego dnia muszą być identyczne.
 *   node tools/ui-snapshot.js <katalog z grą> <plik.json>
 * (katalog z grą może być starym checkoutem, np. git worktree, żeby porównać z kodem sprzed zmiany)
 */
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), { spawn } = require("child_process");
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const outFile = process.argv[3] || "ui-snapshot.json";
const chrome = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(p => fs.existsSync(p));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0].split("#")[0]), f = path.join(root, u === "/" ? "index.html" : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let proc, ws, profile; const errors = [], snap = {};
const finish = code => { try { ws && ws.close(); } catch (_) {} try { proc && proc.kill(); } catch (_) {} server.close(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {} process.exit(code); }, 600); };
(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const URL = `http://127.0.0.1:${server.address().port}/index.html#dev`;
  const PORT = 9400 + Math.floor(Math.random() * 400);
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "siatka-ui-"));
  proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio", "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
  let ver; for (let i = 0; i < 80 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (_) { await sleep(250); } }
  ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; return; }
    if (d.method === "Runtime.exceptionThrown") errors.push("wyjątek: " + ((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text)); };
  const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId: s } } = await send("Target.attachToTarget", { targetId, flatten: true });
  const C = (m, p) => send(m, p, s);
  await C("Runtime.enable"); await C("Page.enable");
  await C("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await C("Emulation.setTouchEmulationEnabled", { enabled: true });
  const ev = async expr => { const r = await C("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error("wyrażenie: " + expr + " → " + ((r.result.exceptionDetails.exception || {}).description)); return r.result.result.value; };
  const waitFor = async (expr, what, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await ev(`!!(${expr})`)) return; await sleep(100); } throw new Error("timeout: " + what); };
  const norm = h => h.replace(/ (pop|bump)(?=[" ])/g, "").replace(/ data-i18n(?:-attr|-vars)?="[^"]*"/g, "").replace(/<span id="clock">[^<]*<\/span>/g, '<span id="clock"></span>').replace(/\s+/g, " ");
  const grab = async (name, sel) => { snap[name] = norm(await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.outerHTML : "(brak)"; })()`)); };
  const tapSel = async sel => {
    let pt = null, last = "";
    for (let t = 0; t < 4000 && !pt; t += 100) {
      const r = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: "center" });
        const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y);
        return { x, y, ok: !!r.width && !!h && (h === b || b.contains(h)), at: x.toFixed(1) + "," + y.toFixed(1) }; })()`);
      if (r && r.ok && r.at === last) pt = r; else { last = r ? r.at : ""; await sleep(100); }
    }
    if (!pt) throw new Error("brak przycisku " + sel);
    await C("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y }] }); await sleep(40);
    await C("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(250);
  };
  const tap = idv => tapSel("#" + idv);
  // stała data i czas, żeby sprawa dnia, rozgrzewka (seed z Date.now) i zegar były takie same w każdym przebiegu
  await C("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const D = Date, T = 1763115600000; Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }; })();` });
  await C("Page.navigate", { url: URL });
  await waitFor(`document.readyState === "complete" && document.querySelector("#board .node") && !document.getElementById("howto").hidden`, "start");
  await sleep(600);
  await grab("start/app", "#app");
  const total = +(await ev(`(document.getElementById("hwStep").textContent.match(/z (\\d+)/) || [])[1]`));
  for (let k = 1; k <= total; k++) { await grab("tutorial/" + k, "#hwCard"); await tap("hwNext"); }
  await grab("board", "#app");
  await tap("tab-notes"); await grab("notes", "#sheet"); await tap("tab-akta");
  await tapSel("#board .node"); await grab("warmup/file", "#sheet");
  await tap("dailyBtn"); await sleep(600); await grab("daily/board", "#app");
  await tapSel("#board .node"); await grab("file/first", "#sheet");
  await tap("hintBtn"); await grab("hint", "#toast"); await grab("hint/btn", "#hintBtn");
  // ustawienia, co nowego, statystyki, osiągnięcia
  await tap("menuBtn"); await waitFor(`document.getElementById("setHowto")`, "menu"); await grab("menu", "#menuCard");
  await tap("setNews"); await sleep(300); await grab("news", "#menuCard"); await tap("newsBack"); await sleep(300);
  await tap("setStats"); await waitFor(`document.getElementById("statsCard").innerHTML.length > 50`, "stats"); await grab("stats", "#statsCard"); await tap("statsClose"); await sleep(300);
  await tap("menuBtn"); await waitFor(`document.getElementById("setAch")`, "menu2"); await tap("setAch"); await waitFor(`document.getElementById("achListCard")`, "ach"); await grab("ach/list", "#achListCard"); await tap("achClose"); await sleep(300);
  if (await ev(`!document.getElementById("menu").hidden`)) await ev(`document.getElementById("menuClose") && document.getElementById("menuClose").click()`);
  // nowa sprawa (okno)
  await ev(`document.getElementById("menu").hidden = true`);
  await tap("newBtn"); await sleep(400); await grab("newcase/card", "#newCase"); await grab("limit", "#limit");
  await ev(`document.getElementById("newCancel") && document.getElementById("newCancel").click()`);
  // oskarżenie: błędne, potem trafne
  await ev(`document.getElementById("newCase").hidden = true; document.getElementById("limit").hidden = true;`);
  await ev(`document.getElementById("accuseBtn").click()`); await sleep(300); await grab("accuse/card", "#accuse");
  const sol = await ev(`(() => { const w = window.SiatkaI18n ? SiatkaI18n.world() : { base: SIATKA_BASE, cities: SIATKA_CITIES }; const c = Siatka.dailyCase(w, new Date()); const ps = c.nodes.filter(n => n.type === "person"), is = c.nodes.filter(n => n.type === "item");
    return { who: ps.findIndex(p => p.id === c.solution.culprit), wrong: ps.findIndex(p => p.id !== c.solution.culprit), what: is.findIndex(i => i.id === c.solution.weapon), whoOnly: c.question === "culprit" }; })()`);
  await ev(`document.querySelectorAll("#pickWho .pick")[${sol.wrong}].click(); ${sol.whoOnly ? "" : `document.querySelectorAll("#pickWhat .pick")[0].click();`} document.getElementById("accuseGo").click();`);
  await sleep(500); await grab("accuse/wrong", "#accuse"); await grab("lives", "#lives");
  await ev(`document.querySelectorAll("#pickWho .pick")[${sol.who}].click(); ${sol.whoOnly ? "" : `document.querySelectorAll("#pickWhat .pick")[${sol.what}].click();`} document.getElementById("accuseGo").click();`);
  await waitFor(`!document.getElementById("result").hidden`, "wynik"); await sleep(900);
  await grab("result", "#resultCard");
  const share = await ev(`(document.getElementById("shareTxt") || {}).value || (document.getElementById("shareTxt") || {}).textContent || ""`);
  snap["result/share"] = share.replace(/\n/g, "|").replace(/\d+:\d\d/g, "T").replace(/\d+ min/g, "N min");
  snap["result/share"] = String(snap["result/share"]);
  fs.writeFileSync(outFile, JSON.stringify(snap, null, 1));
  console.log(`ui-snapshot: ${Object.keys(snap).length} stanów → ${outFile}` + (errors.length ? `\nBŁĘDY:\n  ${errors.join("\n  ")}` : ""));
  finish(errors.length ? 1 : 0);
})().catch(e => { console.error("ui-snapshot:", e.message, errors.join("\n")); fs.writeFileSync(outFile + ".partial", JSON.stringify(snap, null, 1)); finish(1); });
