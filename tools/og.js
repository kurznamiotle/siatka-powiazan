#!/usr/bin/env node
/* Robi zrzut tools/og.html do icons/og.jpg (1200×630, JPEG) — grafika podglądu przy udostępnianiu linku.
 *   node tools/og.js
 * JPEG, bo WhatsApp potrafi pominąć podgląd większy niż ok. 300 KB.
 * Wymaga Chrome/Chromium (ścieżka w zmiennej CHROME albo domyślna), Node 22+ (WebSocket) i internetu (fonty Google). */
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const root = path.join(__dirname, "..");
const chrome = process.env.CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium"
].find(p => fs.existsSync(p));
if (!chrome) { console.error("Nie znaleziono Chrome. Ustaw zmienną CHROME."); process.exit(1); }
const PORT = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "siatka-og-"));
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const done = code => { proc.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {} process.exit(code); }, 500); };

(async () => {
  let ver;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (_) { await sleep(250); } }
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId: s } } = await send("Target.attachToTarget", { targetId, flatten: true });
  const C = (m, p) => send(m, p, s);
  await C("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await C("Page.navigate", { url: pathToFileURL(path.join(__dirname, "og.html")).href });
  for (let i = 0; i < 80; i++) {
    const r = await C("Runtime.evaluate", { expression: "document.body && document.body.dataset.ready", returnByValue: true });
    if (r.result && r.result.result && r.result.result.value === "1") break;
    await sleep(150);
  }
  await sleep(300);
  const shot = await C("Page.captureScreenshot", { format: "jpeg", quality: 86 });
  const out = path.join(root, "icons", "og.jpg");
  fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log("icons/og.jpg", Math.round(fs.statSync(out).size / 1024) + " KB");
  done(0);
})().catch(e => { console.error(e); done(1); });
