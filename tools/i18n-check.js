#!/usr/bin/env node
/*
 * Kontrola warstwy językowej (część npm test).
 *   1. Każdy klucz użyty w kodzie (t("klucz"), data-i18n w index.html) istnieje w polskiej paczce (data/i18n/pl.js).
 *   2. Polskie klucze, których nic nie używa (ostrzeżenie; klucze wołane dynamicznie są na liście DYNAMIC).
 *   3. Kod gry i silnika nie ma polskich liter poza komentarzami (lista wyjątków: EXPECT).
 *   4. en.js (szkielet angielski) ma te same klucze co pl.js: raport braków (wartość null = jeszcze nieprzetłumaczone).
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
console.log(errors ? `i18n: ${errors} błędów` : `i18n: ${Object.keys(pl).length} kluczy, wszystkie użyte klucze istnieją, w kodzie brak polskiego tekstu${warns ? ` (uwag: ${warns})` : ""}`);
process.exit(errors ? 1 : 0);
