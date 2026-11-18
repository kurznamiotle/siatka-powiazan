#!/usr/bin/env node
/*
 * Kontrola warstwy językowej (część npm test).
 *   1. Każdy klucz użyty w kodzie (t("klucz"), data-i18n w index.html) istnieje w polskiej paczce (data/i18n/pl.js).
 *   2. Polskie klucze, których nic nie używa (ostrzeżenie; klucze wołane dynamicznie są na liście DYNAMIC).
 *   3. Kod gry i silnika nie ma polskich liter poza komentarzami (lista wyjątków: EXPECT).
 *   4. en.js (szkielet angielski) ma te same klucze co pl.js: raport braków (wartość null = jeszcze nieprzetłumaczone).
 *   5. Treści generatora EN (data/i18n/en/base.js, cities.js) mają ten sam kształt co polskie: te same klucze w tej samej
 *      kolejności, długości list, typy i wartości nietekstowe; pola logiki (id, tagi, k, vt, roles, at, time…) identyczne,
 *      a w tekstach te same zbiory wstawek {nazwa} (bez znaczników Kartoteki {g:…}). To samo dla wstawek w kluczach en.js.
 *      Każda różnica to błąd ze ścieżką, np. base.crimes.kradziez.scenes[3].intro.
 *   node tools/i18n-check.js [--strict]   (--strict: braki w en.js też są błędem)
 */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
require(path.join(root, "data/i18n/pl.js")); require(path.join(root, "data/i18n/pl/changelog.js"));
const I = require(path.join(root, "data/i18n/i18n.js"));
const pl = I.packs.pl.messages;
let enMsgs = null; try { require(path.join(root, "data/i18n/en.js")); enMsgs = I.packs.en.messages; } catch (_) {}
const strict = process.argv.includes("--strict");
const CODE = ["engine/engine.js", "engine/solver.js", "engine/archetypes/classic.js", "engine/archetypes/timeline.js", "js/game.js", "js/settings.js", "js/tutorial.js", "js/stats.js", "js/achievements.js", "js/history.js", "js/shareimg.js", "js/track.js", "js/audio.js"];
const DYNAMIC = [/^gen\.size\./, /^gen\.police_dat\./, /^ui\.changelog$/];
// polskie litery w kodzie poza komentarzami: dozwolone tylko tu (wyrażenia regularne i dane, nie teksty dla gracza)
const EXPECT = [/„Hasło”/];
let errors = 0, warns = 0;
const err = m => { console.log("BŁĄD " + m); errors++; }, warn = m => { console.log("uwaga " + m); warns++; };
const used = new Set();
for (const f of CODE) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of src.matchAll(/\bt\(\s*["'`]([\w.]+)["'`]/g)) { used.add(m[1]); if (!(m[1] in pl) && !(/[_.]$/.test(m[1]) && Object.keys(pl).some(k => k.startsWith(m[1])))) err(`${f}: brak klucza ${m[1]} w pl.js`); } // klucz kończący się na _ albo . to początek klucza składanego w kodzie (gen.classic.it_ + rodzaj)
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").split(/\r?\n/).map(l => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");
  code.split("\n").forEach((l, i) => { if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(l) && !EXPECT.some(r => r.test(l))) err(`${f}:${i + 1}: polski tekst w kodzie: ${l.trim().slice(0, 90)}`); });
}
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const m of html.matchAll(/data-i18n="([\w.]+)"/g)) { used.add(m[1]); if (!(m[1] in pl)) err(`index.html: brak klucza ${m[1]}`); }
for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const p of m[1].split(";")) { const k = p.slice(p.indexOf(":") + 1); used.add(k); if (!(k in pl)) err(`index.html: brak klucza ${k}`); }
used.add("ui.changelog");
const prefixes = [...used].filter(k => /[_.]$/.test(k));
const unused = Object.keys(pl).filter(k => !used.has(k) && !DYNAMIC.some(r => r.test(k)) && !prefixes.some(p => k.startsWith(p)));
if (unused.length) warn(`${unused.length} kluczy pl.js bez użycia w kodzie: ${unused.slice(0, 8).join(", ")}${unused.length > 8 ? "…" : ""}`);
if (enMsgs) {
  const missing = Object.keys(pl).filter(k => !(k in enMsgs)), nul = Object.keys(enMsgs).filter(k => enMsgs[k] == null), extra = Object.keys(enMsgs).filter(k => !(k in pl));
  console.log(`en.js: ${Object.keys(pl).length} kluczy w pl.js, przetłumaczone ${Object.keys(enMsgs).length - nul.length}, null ${nul.length}, brak w en.js ${missing.length}`);
  if (missing.length) (strict ? err : warn)(`en.js nie ma ${missing.length} kluczy z pl.js (node tools/i18n-skeleton.js je dopisze)`);
  if (extra.length) warn(`en.js ma ${extra.length} kluczy, których nie ma w pl.js: ${extra.slice(0, 5).join(", ")}`);
  if (strict && nul.length) err(`en.js: ${nul.length} kluczy bez tłumaczenia`);
}

/* 5. kształt treści EN = kształt treści PL */
const STRUCT = new Set(["id", "age", "ages", "access", "shape", "no", "pt", "icon", "g", "tags", "origins", "k", "at", "anc", "values",
  "ruleValues", "roles", "keyBookLocs", "vt", "subtags", "time", "vg", "vage", "exclude", "placeTypes", "placeTypeDefault", "need", "trait",
  "cm", "outfit", "headwear", "hair"]);
// klucz logiki (np. roles:["worker"]) bywa też nazwą listy treści (base.roles = lista ról z tekstami): lista obiektów to treść
const isStruct = (k, v) => STRUCT.has(k) && !(Array.isArray(v) && v.some(x => x && typeof x === "object")) && k !== "months";
const holes = str => [...String(str).replace(/\{g:[^{}]*\}/g, "").matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(" ");
let shapeDiffs = 0;
const diff = (p, m) => { shapeDiffs++; err(`kształt EN ≠ PL: ${p}: ${m}`); };
function same(a, b, p, struct) {
  if (Array.isArray(a) !== Array.isArray(b) || typeof a !== typeof b || (a === null) !== (b === null)) return diff(p, `typ ${Array.isArray(a) ? "lista" : a === null ? "null" : typeof a} / ${Array.isArray(b) ? "lista" : b === null ? "null" : typeof b}`);
  if (Array.isArray(a)) { if (a.length !== b.length) diff(p, `długość ${a.length} / ${b.length}`); for (let i = 0; i < Math.min(a.length, b.length); i++) same(a[i], b[i], `${p}[${i}]`, struct); return; }
  if (a && typeof a === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    const miss = ka.filter(k => !(k in b)), more = kb.filter(k => !(k in a));
    if (miss.length || more.length) diff(p, `klucze: brak w EN [${miss.join(", ")}], nadmiar w EN [${more.join(", ")}]`);
    else if (ka.join("") !== kb.join("")) diff(p, "inna kolejność kluczy");
    for (const k of ka) if (k in b) same(a[k], b[k], `${p}.${k}`, struct || isStruct(k, a[k]));
    return;
  }
  if (typeof a === "string") {
    // pole logiki to id, tag albo godzina (bez spacji); zdanie pod kluczem logiki (traits.known.facts.no) to treść
    if (struct && !/\s/.test(a)) { if (a !== b) diff(p, `pole logiki: „${a}” / „${b}”`); }
    else if (holes(a) !== holes(b)) diff(p, `wstawki {${holes(a)}} / {${holes(b)}}`);
    return;
  }
  if (a !== b) diff(p, `wartość ${a} / ${b}`);
}
let enContent = null;
try {
  require(path.join(root, "data/i18n/pl/base.js")); require(path.join(root, "data/i18n/pl/cities.js"));
  if (fs.existsSync(path.join(root, "data/i18n/en/base.js"))) { require(path.join(root, "data/i18n/en/base.js")); require(path.join(root, "data/i18n/en/cities.js")); enContent = I.packs.en && I.packs.en.content; }
} catch (e) { err("treści EN się nie wczytały: " + e.message); }
if (enContent) {
  const plc = I.packs.pl.content;
  same(plc.base, enContent.base, "base", false); same(plc.cities, enContent.cities, "cities", false);
  console.log(`treści EN: ${shapeDiffs ? shapeDiffs + " różnic kształtu" : "kształt = PL (klucze, kolejność, długości, typy, pola logiki, wstawki)"}`);
}
// wyjątki: *_re to wyrażenia regularne ({L} = klasa znaków), {v} w samouczku to polski zaimek „go”/„ją” (po angielsku zbędny)
const HOLE_EXCEPT = { "ui.tutorial.widziano_o_ma_do_od_html": ["v"] };
const holesExcept = (k, str) => holes(str).split(" ").filter(h => !(HOLE_EXCEPT[k] || []).includes(h)).join(" ");
if (enMsgs) for (const k of Object.keys(pl)) if (!/_re$/.test(k) && typeof pl[k] === "string" && typeof enMsgs[k] === "string" && holesExcept(k, pl[k]) !== holes(enMsgs[k])) err(`en.js ${k}: wstawki {${holes(pl[k])}} / {${holes(enMsgs[k])}}`);

console.log(errors ? `i18n: ${errors} błędów` : `i18n: ${Object.keys(pl).length} kluczy, wszystkie użyte klucze istnieją, w kodzie brak polskiego tekstu${warns ? ` (uwag: ${warns})` : ""}`);
process.exit(errors ? 1 : 0);
