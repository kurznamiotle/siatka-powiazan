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
 *   6. Równość tekstów PL ⇔ EN (etykiety i nazwy dowodów, zdania) i trafienia base.textRe w obu językach.
 *   7. Kartoteka: każde id ze znacznika {g:id} ma hasło w data/i18n/pl/glossary.js i en/glossary.js.
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
  "ruleValues", "roles", "keyBookLocs", "vt", "subtags", "time", "vg", "vage", "exclude", "need", "trait",
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
  /* 6. Silnik porównuje niektóre teksty: etykiety i nazwy dowodów muszą być w sprawie różne, pickU nie daje dwa razy tego
     samego zdania, textRe rozpoznaje treść. Żeby ten sam seed dawał tę samą sprawę, równość tekstów musi być taka sama
     w obu językach: dwa wpisy mają równy tekst po polsku wtedy i tylko wtedy, gdy mają równy po angielsku. */
  const partition = (name, list) => {
    let bad = 0;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [pi, a1, b1] = list[i], [pj, a2, b2] = list[j];
      if ((a1 === a2) !== (b1 === b2)) { bad++; if (bad <= 10) err(`${name}: ${pi} i ${pj}: po polsku ${a1 === a2 ? "równe" : "różne"} („${a1}”, „${a2}”), po angielsku ${b1 === b2 ? "równe" : "różne"} („${b1}”, „${b2}”)`); }
    }
    return bad;
  };
  const evDefs = B => { const o = []; const add = (arr, p) => (arr || []).forEach((d, i) => d && d.label != null && o.push([`${p}[${i}]`, d]));
    add(B.evidence.presence, "evidence.presence"); add(B.evidence.keys, "evidence.keys"); B.alibiConfirmed.forEach((a, i) => a.doc && o.push([`alibiConfirmed[${i}].doc`, a.doc]));
    for (const [k, tr] of Object.entries(B.traits)) add(tr.evidence, `traits.${k}.evidence`); for (const [k, cr] of Object.entries(B.crimes)) add(cr.letters, `crimes.${k}.letters`);
    add((B.timeline || {}).evidence, "timeline.evidence"); return o; };
  const pd = evDefs(plc.base), ed = evDefs(enContent.base);
  let pBad = partition("etykiety dowodów", pd.map(([p, d], i) => [p, d.label, ed[i][1].label])) + partition("nazwy dowodów", pd.map(([p, d], i) => [p, d.name, ed[i][1].name]));
  const sentences = [];
  (function walk(a, b, p) {
    if (Array.isArray(a)) return a.forEach((x, i) => walk(x, b[i], `${p}[${i}]`));
    if (a && typeof a === "object") return Object.keys(a).forEach(k => walk(a[k], b[k], `${p}.${k}`));
    if (typeof a === "string" && a.length > 25 && /\s/.test(a) && !/\.(title|name|label|m|f)$/.test(p) && !/places/.test(p)) sentences.push([p, a, b]);
  })(plc, enContent, "");
  // grupy zamiast par: zdań są tysiące
  const grp = new Map(); sentences.forEach(([p, a, b]) => { (grp.get(a) || grp.set(a, []).get(a)).push([p, a, b]); });
  const grpEn = new Map(); sentences.forEach(([p, a, b]) => { (grpEn.get(b) || grpEn.set(b, []).get(b)).push([p, a, b]); });
  for (const g of [...grp.values(), ...grpEn.values()]) if (g.length > 1) pBad += partition("zdania", g);
  // textRe: wyrażenie z danych języka trafia w te same wpisy
  const P = plc.base, E = enContent.base, txt = x => typeof x === "string" ? x : (x.t != null ? x.t : `${x.name || ""} ${(x.text || []).join(" ")}`);
  const reCheck = (name, re1, re2, flags, items) => items.forEach(([p, a, b]) => { if (new RegExp(re1, flags).test(a) !== new RegExp(re2, flags).test(b)) { pBad++; err(`textRe.${name}: ${p} trafia tylko w jednym języku`); } });
  reCheck("janitor", P.textRe.janitor, E.textRe.janitor, "i", [["evidence.presence", P.evidence.presence, E.evidence.presence], ["presenceTpl", P.presenceTpl, E.presenceTpl], ["claimFrame", P.claimFrame, E.claimFrame]].flatMap(([n, a, b]) => a.map((x, i) => [`${n}[${i}]`, txt(x), txt(b[i])])));
  const docs = P.alibiConfirmed.map((a, i) => [a, E.alibiConfirmed[i], i]).filter(([a]) => a.doc);
  reCheck("thatEvening", P.textRe.thatEvening, E.textRe.thatEvening, "i", docs.map(([a, b, i]) => [`alibiConfirmed[${i}].doc`, a.doc.text.join(" "), b.doc.text.join(" ")]));
  reCheck("lateDoc", P.textRe.lateDoc, E.textRe.lateDoc, "", docs.map(([a, b, i]) => [`alibiConfirmed[${i}].doc`, a.doc.text.join(" ") + a.text, b.doc.text.join(" ") + b.text]));
  console.log(`treści EN: ${pBad ? pBad + " rozbieżności w równości tekstów" : "równość etykiet, nazw dowodów i zdań oraz trafienia textRe jak w PL"}`);
}
// wyjątki: *_re to wyrażenia regularne ({L} = klasa znaków), {v} w samouczku to polski zaimek „go”/„ją” (po angielsku zbędny)
const HOLE_EXCEPT = { "ui.tutorial.widziano_o_ma_do_od_html": ["v"] };
const holesExcept = (k, str) => holes(str).split(" ").filter(h => !(HOLE_EXCEPT[k] || []).includes(h)).join(" ");
if (enMsgs) for (const k of Object.keys(pl)) if (!/_re$/.test(k) && typeof pl[k] === "string" && typeof enMsgs[k] === "string" && holesExcept(k, pl[k]) !== holes(enMsgs[k])) err(`en.js ${k}: wstawki {${holes(pl[k])}} / {${holes(enMsgs[k])}}`);

/* 7. Kartoteka: każde id ze znacznika {g:id} albo {g:id|tekst} w treściach i tekstach (każdy język) ma hasło w pl i en */
try {
  require(path.join(root, "data/i18n/pl/glossary.js"));
  if (fs.existsSync(path.join(root, "data/i18n/en/glossary.js"))) require(path.join(root, "data/i18n/en/glossary.js"));
  const gl = l => (I.packs[l] && I.packs[l].content && I.packs[l].content.glossary) || {};
  const usedG = new Map();
  const scan = (v, where) => {
    if (typeof v === "string") { for (const m of v.matchAll(/\{g:([\w-]+)(?:\|[^{}]*)?\}/g)) if (!usedG.has(m[1])) usedG.set(m[1], where); return; }
    if (Array.isArray(v)) return v.forEach(x => scan(x, where));
    if (v && typeof v === "object") for (const k in v) scan(v[k], where);
  };
  for (const l of Object.keys(I.packs)) { scan(I.packs[l].messages, `${l}.js`); const c = I.packs[l].content || {}; scan(c.base, `${l}/base.js`); scan(c.cities, `${l}/cities.js`); }
  let missG = 0;
  for (const [id, where] of usedG) for (const l of ["pl", "en"]) { const e = gl(l)[id]; if (!e || !e.term || !e.text) { missG++; err(`Kartoteka: {g:${id}} (${where}) nie ma hasła w ${l}/glossary.js`); } }
  const pk = Object.keys(gl("pl")).sort().join(), ek = Object.keys(gl("en")).sort().join();
  if (pk !== ek) err("Kartoteka: pl/glossary.js i en/glossary.js mają różne zestawy haseł");
  const unusedG = Object.keys(gl("pl")).filter(id => !usedG.has(id));
  if (unusedG.length) warn(`Kartoteka: ${unusedG.length} haseł bez użycia: ${unusedG.join(", ")}`);
  console.log(`Kartoteka: ${usedG.size} użytych haseł, ${missG ? missG + " braków" : "wszystkie mają opis w pl i en"} (haseł: ${Object.keys(gl("pl")).length})`);
} catch (e) { err("Kartoteka się nie wczytała: " + e.message); }

console.log(errors ? `i18n: ${errors} błędów` : `i18n: ${Object.keys(pl).length} kluczy, wszystkie użyte klucze istnieją, w kodzie brak polskiego tekstu${warns ? ` (uwag: ${warns})` : ""}`);
process.exit(errors ? 1 : 0);
