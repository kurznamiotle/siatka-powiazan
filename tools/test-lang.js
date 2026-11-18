#!/usr/bin/env node
/*
 * Test języków (część npm test): ten sam seed daje w pl i w en tę samą STRUKTURĘ sprawy (osoby, miejsca, przedmioty,
 * dowody, reguły, fakty, rozwiązanie), różnią się tylko teksty. Dwa przebiegi: (1) angielskie teksty gen.* i gramatyka
 * na polskich treściach (SiatkaI18n.genOverride), (2) pełny angielski: treści data/i18n/en/ (wtedy różnią się też nazwy
 * miejsc, przedmiotów i dowodów, więc porównujemy id, typy, fakty i rozwiązanie, a z tekstów tylko liczbę zdań w aktach).
 * Sprawdza też, że teksty składane w kodzie (reguły, podpowiedzi, wyjaśnienie, epilog) nie zostawiają wstawek {…}
 * i że podpowiedzi są po angielsku.
 *   node tools/test-lang.js [liczba spraw]
 */
const path = require("path");
const root = path.join(__dirname, "..");
require(path.join(root, "data/i18n/pl.js")); require(path.join(root, "data/i18n/en.js"));
require(path.join(root, "engine/sprites.js"));
const I = require(path.join(root, "data/i18n/i18n.js"));
const S = require(path.join(root, "engine/engine.js"));
const W = { base: require(path.join(root, "data/i18n/pl/base.js")), cities: require(path.join(root, "data/i18n/pl/cities.js")) };
const WEN = { base: require(path.join(root, "data/i18n/en/base.js")), cities: require(path.join(root, "data/i18n/en/cities.js")) };
const N = +process.argv[2] || 300;
let bad = 0;
const fail = m => { if (bad++ < 10) console.log("BŁĄD " + m); };
const structure = c => JSON.stringify({
  meta: [c.archetype, c.size, c.city_name, c.year, c.month, c.question, c.crime],
  nodes: c.nodes.map(n => [n.id, n.type, n.type === "location" ? 0 : n.name, n.type === "location" ? 0 : n.label, n.g, n.text.length]), // nazwa i etykieta miejsca zdarzenia bywają tekstem gen.* („(miejsce zdarzenia)”)
  facts: c.facts, solution: c.solution,
  rules: c.rules.map(r => ({ id: r.id, type: r.type, trait: r.trait, value: r.value, rel: r.rel, dir: r.dir })),
  elim: c.eliminations, herrings: c.red_herrings, hints: c.hints.length, why: c.why.length, travel: c.travel
});
const gen = (lang, seed, opts, world) => { I.genOverride = lang === "pl" ? null : lang; try { return S.generateCase(world || W, seed, opts); } finally { I.genOverride = null; } };
/* struktura bez tekstów treści: nazwy osób są wspólne, nazwy miejsc, przedmiotów i dowodów zależą od języka */
const skeleton = (c, w) => JSON.stringify({
  meta: [c.archetype, c.size, c.year, w.base.months.indexOf(c.month), c.question, c.crime],
  nodes: c.nodes.map(n => [n.id, n.type, n.type === "person" ? n.name : 0, n.g, n.text.length, n.pt]),
  facts: c.facts, solution: c.solution,
  rules: c.rules.map(r => ({ id: r.id, type: r.type, trait: r.trait, value: r.value, rel: r.rel, dir: r.dir })),
  elim: c.eliminations, herrings: c.red_herrings, hints: c.hints.length, why: c.why.length,
  travel: c.travel && c.travel.map ? c.travel.map(r => Array.isArray(r) ? r.map(x => typeof x === "number" ? x : 0) : r) : c.travel
});
let full = 0;
const kinds = [{}, { archetype: "classic" }, { archetype: "timeline", size: "M" }, { archetype: "timeline", size: "XL" }, { size: "XL" }, { size: "S" }];
for (let i = 0; i < N; i++) {
  const opts = kinds[i % kinds.length], seed = "lang-" + i;
  const a = gen("pl", seed, opts), b = gen("en", seed, opts);
  if (structure(a) !== structure(b)) fail(`${seed}: struktura sprawy różni się między pl i en`);
  const text = [b.intro, b.epilogue, b.detective, ...b.hints, ...b.why.flat(), ...b.rules.map(r => r.text)].join(" ");
  if (/\{[a-zA-Z_]+\}/.test(text)) fail(`${seed}: nierozwiązana wstawka w tekście en`);
  if (!/[Rr]ule|[Ee]vidence|[Pp]apers|alibi/.test(b.hints.join(" "))) fail(`${seed}: podpowiedzi en nie są po angielsku: ${b.hints[0]}`);
  // (2) pełny angielski
  const e = gen("en", seed, opts, WEN), sa = skeleton(a, W), se = skeleton(e, WEN);
  if (sa !== se) { const A = JSON.parse(sa), E = JSON.parse(se); fail(`${seed}: struktura pl ≠ en (treści EN) w: ${Object.keys(A).filter(k => JSON.stringify(A[k]) !== JSON.stringify(E[k])).join(", ")}`); }
  else full++;
  const etext = [e.title, e.intro, e.epilogue, ...e.hints, ...e.why.flat(), ...e.rules.map(r => r.text), ...e.nodes.flatMap(n => [n.name, n.label, ...n.text])].join(" ");
  if (/\{[a-zA-Z_:]+[|}]|\[[^\]]*\|[^\]]*\]|undefined|NaN/.test(etext)) fail(`${seed}: nierozwiązana wstawka, nawias albo undefined w sprawie EN: ${(etext.match(/.{0,40}(\{[a-zA-Z_:]+[|}]|\[[^\]]*\|[^\]]*\]|undefined|NaN).{0,40}/) || [""])[0]}`);
}
/* (3) avoid niezależny od języka: ostatnie sprawy zapisane jako ścieżki w danych (encodeUsed), następna sprawa
   z avoid odczytanym w PL i w EN ma tę samą strukturę; zakodowanie i odczytanie w tym samym języku nic nie gubi */
const NA = Math.max(60, Math.round(N / 3));
let avoidOk = 0;
for (let i = 0; i < NA; i++) {
  const prev = [0, 1, 2, 3].map(k => gen("pl", `lang-av-${i}-${k}`, kinds[(i + k) % kinds.length]));
  const keys = S.avoidFrom(prev.map(c => S.encodeUsed(W, c.used)));
  for (const c of prev) { const back = S.decodeAvoid(W, S.encodeUsed(W, c.used)); for (const k of ["scenes", "quips", "flavor", "alibi"]) for (const x of c.used[k] || []) if (!back[k].includes(x)) fail(`lang-av-${i}: tekst z used.${k} zgubiony przy kodowaniu: ${x}`); }
  const opts = Object.assign({}, kinds[i % kinds.length], { avoid: S.decodeAvoid(W, keys) });
  const a = gen("pl", `lang-av-${i}`, opts), e = gen("en", `lang-av-${i}`, Object.assign({}, kinds[i % kinds.length], { avoid: S.decodeAvoid(WEN, keys) }), WEN);
  // kontrola: avoid z tekstów (jak przed zmianą) daje w PL tę samą sprawę co avoid ze ścieżek
  const old = gen("pl", `lang-av-${i}`, Object.assign({}, kinds[i % kinds.length], { avoid: S.avoidFrom(prev.map(c => c.used)) }));
  if (JSON.stringify(old) !== JSON.stringify(a)) fail(`lang-av-${i}: avoid ze ścieżek zmienia sprawę PL`);
  if (skeleton(a, W) !== skeleton(e, WEN)) fail(`lang-av-${i}: z tym samym avoid struktura pl ≠ en`); else avoidOk++;
}
console.log(bad ? `Test języków: ${bad} błędów` : `Test języków: ${N} spraw, struktura pl = en (gen.* EN na treściach PL i ${full} spraw z treściami EN; ${avoidOk} spraw z avoid ze ścieżek)`);
process.exit(bad ? 1 : 0);
