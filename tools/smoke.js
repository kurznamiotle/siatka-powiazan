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
  const LANG = process.env.SMOKE_LANG || ((process.argv.find(a => a.startsWith("--lang=")) || "").slice(7)) || "pl"; // --lang=en (albo SMOKE_LANG=en): ?lang=en#dev (angielski interfejs, sprawa po polsku)
  const URL = process.env.SMOKE_URL || `http://127.0.0.1:${server.address().port}/index.html` + (LANG === "en" ? "?lang=en#dev" : ""); // SMOKE_URL: test produkcji (dopisz #dev, żeby nie wysyłać analityki)
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
  const total = +(await ev(`(document.getElementById("hwStep").textContent.match(/(\\d+)\\D*$/) || [])[1]`));
  const tl = (key, vars) => ev(`t(${JSON.stringify(key)}, ${JSON.stringify(vars || {})})`); // tekst w języku testu
  const lastTitle = await tl("ui.tutorial.oskarzenie");
  if (!(total >= 4)) fail(`samouczek ma ${total} kroków, a powinien co najmniej 4`);
  const titles = [];
  for (let k = 1; k <= total; k++) {
    const st = await ev(`({ step: document.getElementById("hwStep").textContent, title: document.getElementById("hwTitle").textContent,
      stage: document.getElementById("hwStage").innerHTML.length, txt: document.getElementById("hwTxt").textContent.length })`);
    const wantStep = await tl("ui.tutorial.krok_v_z_length", { v: k, length: total });
    if (st.step !== wantStep) fail(`oczekiwano „${wantStep}”, jest „${st.step}”`);
    if (!st.title || st.stage < 200 || st.txt < 20) fail(`pusta plansza samouczka na kroku ${k} (${st.title})`);
    if (/undefined|NaN|object Object/.test(await ev(`document.getElementById("hwCard").innerHTML`))) fail(`plansza ${k} („${st.title}”) ma „undefined”/„NaN” w treści`);
    titles.push(st.title);
    await click("hwNext");
  }
  if (await ev(visible("howto"))) fail("samouczek nie zamknął się po ostatnim kroku");
  if (titles[titles.length - 1] !== lastTitle) fail(`ostatnia plansza to „${titles[titles.length - 1]}”, a powinno być „${lastTitle}”`);
  ok(`samouczek: ${total} kroki (${titles.join(" → ")})`);
  if (await ev(`localStorage.getItem("siatka-howto")`) !== "1") fail("samouczek nie zapisał flagi siatka-howto");

  // 2. nowy gracz bez kropki „Co nowego”
  if (await ev(`document.getElementById("menuBtn").classList.contains("has-dot")`)) fail("nowy gracz ma kropkę „Co nowego” przy zębatce");
  ok("nowy gracz bez kropki „Co nowego”");

  // 3. Ustawienia → Jak grać
  await click("menuBtn");
  await waitFor(visible("menu") + ` && document.getElementById("setHowto")`, "Ustawienia się nie otworzyły");
  // język: przełącznik tylko w #dev, <html lang> i <title> zgodne z językiem
  const hasSwitch = await ev(`!!document.getElementById("langEn")`);
  if (hasSwitch !== (LANG === "en")) fail(LANG === "en" ? "w #dev brak przełącznika języka w Ustawieniach" : "przełącznik języka widoczny poza #dev");
  const doc = await ev(`({ lang: document.documentElement.lang, title: document.title, i18n: SiatkaI18n.lang })`);
  if (doc.lang !== LANG || doc.i18n !== LANG || doc.title !== await tl("ui.html.title")) fail(`język strony: ${JSON.stringify(doc)}, a powinno być ${LANG}`);
  // dopisek „(cases: translation in progress)” tylko wtedy, gdy angielski nie ma własnych treści spraw (data/i18n/en/)
  if (LANG === "en") {
    const st = await ev(`({ content: !!(SiatkaI18n.packs.en.content && SiatkaI18n.packs.en.content.base), gen: SiatkaI18n.genLang(), note: /translation in progress/.test(document.getElementById("menuCard").innerText) })`);
    if (st.note === st.content) fail(st.content ? "dopisek o tłumaczeniu spraw mimo treści EN" : "przy English brak dopisku o tłumaczeniu spraw");
    if (st.content && st.gen !== "en") fail("treści EN są, a sprawy powstają w języku " + st.gen);
    const cl = await ev(`(() => { const e = SiatkaI18n.get("ui.changelog", "en"), p = SiatkaI18n.packs.pl.messages["ui.changelog"]; return { ok: Array.isArray(e) && e.length === p.length && e[0].items[0] !== p[0].items[0] }; })()`);
    if (!cl.ok) fail("„Co nowego” po angielsku: brak pełnej listy z en/changelog.js");
  }
  ok(`język ${LANG}: <html lang>, <title>${hasSwitch ? ", przełącznik w Ustawieniach" : ", bez przełącznika poza #dev"}`);
  await click("setHowto");
  await waitFor(visible("howto"), "„Jak grać” nie otworzyło samouczka");
  if (await ev(`document.getElementById("hwStep").textContent`) !== await tl("ui.tutorial.krok_v_z_length", { v: 1, length: total })) fail("„Jak grać” nie zaczyna od kroku 1");
  for (let k = 1; k < total; k++) await click("hwNext");
  if (await ev(`document.getElementById("hwTitle").textContent`) !== lastTitle) fail("„Jak grać”: ostatni krok to nie „" + lastTitle + "”");
  await click("hwSkip");
  if (await ev(visible("howto"))) fail("„Pomiń” nie zamknęło samouczka");
  ok("Ustawienia → „Jak grać” → wszystkie kroki → Pomiń");

  // 4. sprawa dnia, akta, notatnik
  await click("dailyBtn");
  await waitFor(`document.querySelector("#board .node") && /·/.test(document.getElementById("caseLine").textContent)`, "sprawa dnia się nie wczytała");
  const line = await ev(`document.getElementById("caseLine").textContent.trim()`);
  // oś czasu: jednorazowa karta „Nowy typ sprawy” (pojawia się 400 ms po wczytaniu) zasłania tablicę i zakładki
  const dismissTimeline = async () => {
    for (let t = 0; t < 1500 && !await ev(`!!document.getElementById("tlGo")`); t += 100) await sleep(100);
    if (await ev(`!!document.getElementById("tlGo")`)) {
      await click("tlGo");
      if (await ev(`!!document.getElementById("tlGo")`)) fail("karta „Nowy typ sprawy: oś czasu” się nie zamknęła");
      ok("karta „Nowy typ sprawy: oś czasu” zamknięta");
    }
  };
  await dismissTimeline();
  // nagłówek akt: liczniki w liczbie mnogiej języka (bez „rulesy”, „5 miejsca”)
  const head = await ev(`document.getElementById("sheet").innerText`);
  if (LANG === "en" ? !/\b\d+ rules?\b/i.test(head) || /rules[yi]|\d+ (?:przedmiot|regu|miejsc)/i.test(head) : /\b[5-9] miejsca\b/i.test(head)) fail("nagłówek akt: zła liczba mnoga: " + head.split("\n").slice(0, 2).join(" "));
  await tapSel("#board .node", "pierwszego zdjęcia na tablicy");
  const akta = await ev(`document.getElementById("sheet").innerText`);
  if (!akta || akta.length < 60) fail("akta pierwszego zdjęcia są puste");
  await click("tab-notes");
  const notes = await ev(`document.getElementById("sheet").innerText`);
  if (!notes || notes.length < 60 || notes === akta) fail("notatnik się nie otworzył");
  if (/undefined|NaN|object Object/.test(akta + notes)) fail("„undefined”/„NaN”/„object Object” w aktach albo notatniku");
  ok(`sprawa dnia (${line.replace(/\s+/g, " ")}): akta i notatnik`);

  /* 4b. Kartoteka: hasło podkreślone w aktach (albo w notatniku), karta po stuknięciu i po kliknięciu myszką, karta nie
     zasłania przycisków akcji, zapis widzianych haseł i lista w Ustawieniach (alfabetycznie) */
  const findGloss = () => ev(`(() => { const c = SiatkaGame.caseData(), L = SiatkaI18n.genLang();
    const has = s => SiatkaGloss.spans(s, L).spans.some(x => SiatkaI18n.glossaryEntry(x.id));
    const n = c.nodes.find(n => n.text.some(has)); if (n) return { node: n.id };
    return c.rules.some(r => has(r.text)) ? { notes: true } : null; })()`);
  let gf = await findGloss();
  for (let k = 0; k < 4 && !gf; k++) { // w sprawie dnia nie ma hasła: kolejna sprawa z „Nowej sprawy”
    await click("newBtn");
    await waitFor(visible("newCase") + ` || document.querySelector("#board .node")`, "„Nowa sprawa” się nie otworzyła");
    if (await ev(visible("newCase"))) await click("newGo");
    await sleep(500); await dismissTimeline();
    gf = await findGloss();
  }
  if (!gf) fail("Kartoteka: w 5 sprawach ani jednego hasła w aktach i notatniku");
  if (gf.node) await tapSel(`#board .node[data-node="${gf.node}"]`, "zdjęcia z hasłem w aktach"); else await click("tab-notes");
  await waitFor(`document.querySelector("#sheet .gl")`, "Kartoteka: w aktach brak podkreślonego hasła");
  const gid = await ev(`document.querySelector("#sheet .gl").dataset.g`);
  const gEntry = await ev(`SiatkaI18n.glossaryEntry(${JSON.stringify(gid)})`);
  const gStyle = await ev(`getComputedStyle(document.querySelector("#sheet .gl")).borderBottomStyle`);
  if (gStyle !== "dotted") fail("Kartoteka: hasło bez kropkowanego podkreślenia (" + gStyle + ")");
  const cardOk = async how => {
    await waitFor(visible("glCard"), `Kartoteka: karta hasła nie otworzyła się (${how})`);
    const st = await ev(`(() => { const c = document.getElementById("glCard"), r = c.getBoundingClientRect();
      const hit = [...document.querySelectorAll(".actions button")].filter(b => b.offsetWidth).some(b => { const q = b.getBoundingClientRect(); return !(r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right); });
      return { term: c.querySelector("h4").textContent, text: c.querySelector("p").textContent, hit, inView: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; })()`);
    if (st.term !== gEntry.term || st.text !== gEntry.text) fail(`Kartoteka: karta pokazuje „${st.term}”, a powinna „${gEntry.term}”`);
    if (st.hit) fail("Kartoteka: karta zasłania przyciski akcji");
    if (!st.inView) fail("Kartoteka: karta wychodzi poza ekran");
  };
  await tapSel("#sheet .gl", "hasła w aktach");
  await cardOk("dotyk");
  // SMOKE_SHOT=katalog: zrzut ekranu z otwartą kartą hasła (do obejrzenia)
  if (process.env.SMOKE_SHOT) { const { result: { data } } = await C("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(process.env.SMOKE_SHOT, `kartoteka-${LANG}.png`), Buffer.from(data, "base64")); }
  await tapSel("#glClose", "przycisku zamknięcia karty");
  if (await ev(visible("glCard"))) fail("Kartoteka: przycisk zamknięcia nie zamknął karty");
  // myszką: klik w hasło otwiera, klik obok zamyka
  const mpt = await ev(`(() => { const g = document.querySelector("#sheet .gl"); g.scrollIntoView({ block: "center" }); const r = g.getClientRects()[0]; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const mouse = async (x, y) => { for (const type of ["mousePressed", "mouseReleased"]) await C("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); await sleep(200); };
  await mouse(mpt.x, mpt.y);
  await cardOk("myszka");
  await mouse(5, 5);
  if (await ev(visible("glCard"))) fail("Kartoteka: klik poza kartą jej nie zamknął");
  await sleep(400);
  if (!(await ev(`JSON.parse(localStorage.getItem("siatka-glossary") || "[]")`)).includes(gid)) fail("Kartoteka: hasło nie zapisało się w siatka-glossary");
  await click("menuBtn");
  await waitFor(visible("menu") + ` && document.getElementById("setGloss")`, "Ustawienia: brak pozycji Kartoteka");
  await click("setGloss");
  await waitFor(`document.querySelector('.gl-list .gl-e[data-g="${gid}"]')`, "Ustawienia → Kartoteka: brak widzianego hasła na liście");
  const gl = await ev(`(() => { const terms = [...document.querySelectorAll(".gl-list .gl-e b")].map(b => b.textContent.replace(/^[„“"«»]+/, "")), c = new Intl.Collator(SiatkaI18n.lang);
    return { n: terms.length, sorted: terms.every((x, i) => !i || c.compare(terms[i - 1], x) <= 0), title: document.querySelector("#menuCard h3").textContent }; })()`);
  if (!gl.sorted) fail("Ustawienia → Kartoteka: lista nie jest alfabetyczna");
  if (gl.title !== await tl("ui.gloss.title")) fail("Ustawienia → Kartoteka: zły tytuł " + gl.title);
  await click("glBack");
  await click("menuClose");
  ok(`Kartoteka: „${gEntry.term}” z ${gf.node ? "akt" : "notatnika"} (dotyk i myszka), karta nie zasłania przycisków, lista w Ustawieniach (${gl.n})`);

  if (LANG === "en") {
    /* 5. EN: sprawa dnia i sprawa z „New case” bez polskich słów (całe słowa, poza tekstem w cudzysłowach: tytuły, nazwy) */
    const PL_WORDS = ["przy", "się", "jest", "nikt", "ulic", "ulicy", "że", "nie", "był", "była", "było", "tego", "wieczoru", "sprawca", "sprawcy",
      "został", "została", "który", "która", "oraz", "gdzie", "kiedy", "bardzo", "albo", "tylko", "jego", "jej"];
    const polishIn = kind => ev(`(() => {
      const sv = JSON.parse(localStorage.getItem("siatka-save-${kind}") || "null");
      if (!sv || !sv.case) return "brak zapisu siatka-save-${kind}";
      const re = new RegExp(${JSON.stringify("(?<!\\p{L})(" + PL_WORDS.join("|") + ")(?!\\p{L})")}, "iu"), hits = [];
      (function w(v, k) {
        if (k === "used" || k === "facts") return;
        if (typeof v === "string") { const m = v.replace(/[„“"«][^„“”"«»]*[”“"»]/g, "").match(re); if (m) hits.push(m[1] + ": " + v.slice(0, 80)); return; }
        if (v && typeof v === "object") for (const kk in v) w(v[kk], kk);
      })(sv.case, "");
      return hits.slice(0, 3).join(" | ");
    })()`);
    await sleep(600);
    let bad = await polishIn("daily");
    if (bad) fail("sprawa dnia w EN ma polskie słowa: " + bad);
    await click("newBtn");
    await waitFor(visible("newCase") + ` || document.querySelector("#board .node")`, "„New case” się nie otworzyło");
    if (await ev(visible("newCase"))) await click("newGo");
    await waitFor(`document.querySelector("#board .node") && /·/.test(document.getElementById("caseLine").textContent)`, "sprawa z „New case” się nie wczytała");
    await dismissTimeline();
    await tapSel("#board .node", "pierwszego zdjęcia nowej sprawy");
    await sleep(600);
    bad = await polishIn("random");
    if (bad) fail("sprawa z „New case” w EN ma polskie słowa: " + bad);
    ok("sprawa dnia i „New case” po angielsku, bez polskich słów z listy kontrolnej");

    /* 6. zapis sprawy dnia w innym języku: ta sama sprawa od nowa z danych bieżącego języka, postęp (po id) zostaje */
    const prep = await ev(`(() => { const sv = JSON.parse(localStorage.getItem("siatka-save-daily")); const id = sv.read[0], title = sv.case.title;
      sv.lang = "pl"; sv.case.title = "STARY ZAPIS"; sv.hints = 1; localStorage.setItem("siatka-save-daily", JSON.stringify(sv)); return { id, title }; })()`);
    await C("Page.navigate", { url: URL });
    await waitFor(`document.readyState === "complete" && document.querySelector("#board .node")`, "gra nie wstała po przeładowaniu", 15000);
    await click("dailyBtn");
    await waitFor(`/·/.test(document.getElementById("caseLine").textContent) && !/STARY ZAPIS/.test(document.body.innerText)`, "sprawa dnia z zapisu w innym języku nie powstała od nowa");
    await dismissTimeline();
    await tapSel("#board .node", "zdjęcia po zmianie języka");
    await sleep(600);
    const after = await ev(`(() => { const sv = JSON.parse(localStorage.getItem("siatka-save-daily")); return { lang: sv.lang, title: sv.case.title, hints: sv.hints, read: sv.read }; })()`);
    if (after.lang !== "en" || after.title !== prep.title || after.hints !== 1 || !after.read.includes(prep.id)) fail("zmiana języka: sprawa albo postęp się nie zgadza: " + JSON.stringify({ prep, after }));
    ok("zapis sprawy dnia z innego języka: ta sama sprawa po angielsku, postęp zachowany");

    /* 7. „New case”: zmiana języka w trakcie sprawy w obie strony (en → pl → en): ten sam seed, tekst w nowym języku, postęp zostaje */
    const rs = () => ev(`(() => { const sv = JSON.parse(localStorage.getItem("siatka-save-random") || "null"); return sv && { seed: sv.case.seed, intro: sv.case.intro, lang: sv.lang, opts: !!sv.opts, hints: sv.hints, read: sv.read }; })()`);
    const r0 = await rs();
    if (!r0 || !r0.opts || r0.lang !== "en") fail("zapis sprawy z „New case” bez opcji generowania albo nie po angielsku: " + JSON.stringify(r0));
    const goRandom = async (lang, setup) => {
      // gra zapisuje się na pagehide (i ustawia siatka-last na bieżącą sprawę), więc nasz stan wpisujemy po niej, w późniejszym pagehide
      await ev(`(() => { const sv = JSON.parse(localStorage.getItem("siatka-save-random")); ${setup || ""}; const s = JSON.stringify(sv);
        const put = () => { localStorage.setItem("siatka-save-random", s); localStorage.setItem("siatka-last", JSON.stringify("random")); };
        addEventListener("pagehide", put); document.addEventListener("visibilitychange", put); put(); })()`);
      await C("Page.navigate", { url: URL.replace("lang=en", "lang=" + lang) });
      await waitFor(`document.readyState === "complete" && document.querySelector("#board .node") && SiatkaI18n.lang === ${JSON.stringify(lang)}`, `gra nie wstała po przełączeniu na ${lang}`, 15000);
      await dismissTimeline();
      await tapSel("#board .node", "zdjęcia po zmianie języka");
      await sleep(600);
      return rs();
    };
    const r1 = await goRandom("pl", "sv.hints = 2");
    if (r1.seed !== r0.seed || r1.lang !== "pl" || r1.intro === r0.intro || r1.hints !== 2 || !r1.read.includes(r0.read[0])) fail("„New case” en → pl: " + JSON.stringify({ r0, r1 }));
    const r2 = await goRandom("en");
    if (r2.seed !== r0.seed || r2.lang !== "en" || r2.intro !== r0.intro || r2.hints !== 2 || !r2.read.includes(r0.read[0])) fail("„New case” pl → en: " + JSON.stringify({ r0, r2 }));
    ok("„New case”: zmiana języka w obie strony, ta sama sprawa z danych nowego języka, postęp zachowany");

    /* 8. stary zapis bez opcji generowania: sprawa zostaje w swoim języku do następnej, w Ustawieniach informacja */
    // stary zapis angielskiej sprawy (bez opts) w sesji polskiej: przeładowanie na inny adres (lang=pl), więc to prawdziwy start gry
    const r3 = await goRandom("pl", `delete sv.opts; sv.lang = "en"; sv.case.intro = "STARY ZAPIS"`);
    if (r3.intro !== "STARY ZAPIS" || r3.lang !== "en") fail("stary zapis bez opcji powinien zostać w swoim języku: " + JSON.stringify(r3));
    await click("menuBtn");
    await waitFor(visible("menu") + ` && document.getElementById("langNext")`, "w Ustawieniach brak informacji, że sprawa zostaje w swoim języku");
    ok("stary zapis bez opcji: sprawa w swoim języku, informacja w Ustawieniach");

    /* 9. przełącznik w Ustawieniach (#dev): Polski, potem English; sprawa dnia ta sama, postęp zostaje (mechanizm z pkt 6) */
    const dsv = () => ev(`(() => { const sv = JSON.parse(localStorage.getItem("siatka-save-daily") || "null"); return sv && { lang: sv.lang, num: sv.case.title, read: sv.read, hints: sv.hints }; })()`);
    const viaSwitch = async lang => {
      if (!(await ev(visible("menu")))) await click("menuBtn");
      await waitFor(visible("menu") + ` && document.getElementById("langPl")`, "w #dev brak przełącznika języka");
      await tapSel(lang === "pl" ? "#langPl" : "#langEn", "przycisku języka " + lang);
      await waitFor(`document.readyState === "complete" && document.querySelector("#board .node") && SiatkaI18n.lang === ${JSON.stringify(lang)}`, `po kliknięciu ${lang} gra nie wstała w tym języku`, 15000);
      const st = await ev(`({ html: document.documentElement.lang, saved: localStorage.getItem("siatka-lang"), q: location.search, dev: location.hash })`);
      if (st.html !== lang || st.saved !== lang || /lang=/.test(st.q) || st.dev !== "#dev") fail("przełącznik języka: " + JSON.stringify(st));
      await click("dailyBtn");
      await waitFor(`/·/.test(document.getElementById("caseLine").textContent)`, "sprawa dnia się nie wczytała po zmianie języka");
      await dismissTimeline();
      await sleep(400);
    };
    // po kroku 8 gra jest po polsku: najpierw English, potem z powrotem Polski
    if (await ev(`SiatkaI18n.lang`) !== "pl") await viaSwitch("pl");
    const d0 = await dsv();
    await viaSwitch("en");
    const d1 = await dsv();
    if (d1.lang !== "en" || (d0.lang === "en" && d1.num !== d0.num) || d1.hints !== d0.hints || !d0.read.every(x => d1.read.includes(x))) fail("przełącznik → English: postęp sprawy dnia się nie zgadza: " + JSON.stringify({ d0, d1 }));
    await viaSwitch("pl");
    const d2 = await dsv();
    if (d2.lang !== "pl" || d2.num === d1.num || d2.hints !== d0.hints || !d0.read.every(x => d2.read.includes(x))) fail("przełącznik → Polski: sprawa albo postęp się nie zgadza: " + JSON.stringify({ d0, d2 }));
    ok("przełącznik w Ustawieniach (#dev): English → Polski, ta sama sprawa dnia, postęp zachowany");
  }

  await sleep(500);
  if (errors.length) fail(`${errors.length} błędów w konsoli`);
  console.log(`smoke: OK (${steps.length} kroków, 0 błędów w konsoli)`);
  finish(0);
})().catch(e => { if (e.message !== "stop") { console.error("smoke:", e); finish(1); } });
