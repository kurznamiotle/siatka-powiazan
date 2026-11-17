#!/usr/bin/env node
/*
 * Test języków (część npm test): ten sam seed daje w pl i w en tę samą STRUKTURĘ sprawy (osoby, miejsca, przedmioty,
 * dowody, reguły, fakty, rozwiązanie), różnią się tylko teksty. Dopóki angielskich treści (data/i18n/en/) nie ma,
 * en = angielskie teksty gen.* i angielska gramatyka na polskich treściach (SiatkaI18n.genOverride).
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
const N = +process.argv[2] || 300;
let bad = 0;
const fail = m => { if (bad++ < 10) console.log("BŁĄD " + m); };
const structure = c => JSON.stringify({
  meta: [c.archetype, c.size, c.city_name, c.year, c.month, c.question, c.crime],
  nodes: c.nodes.map(n => [n.id, n.type, n.name, n.type === "location" ? 0 : n.label, n.g, n.text.length]), // etykieta miejsca zdarzenia to tekst gen.*
  facts: c.facts, solution: c.solution,
  rules: c.rules.map(r => ({ id: r.id, type: r.type, trait: r.trait, value: r.value, rel: r.rel, dir: r.dir })),
  elim: c.eliminations, herrings: c.red_herrings, hints: c.hints.length, why: c.why.length, travel: c.travel
});
const gen = (lang, seed, opts) => { I.genOverride = lang === "pl" ? null : lang; try { return S.generateCase(W, seed, opts); } finally { I.genOverride = null; } };
const kinds = [{}, { archetype: "classic" }, { archetype: "timeline", size: "M" }, { archetype: "timeline", size: "XL" }, { size: "XL" }, { size: "S" }];
for (let i = 0; i < N; i++) {
  const opts = kinds[i % kinds.length], seed = "lang-" + i;
  const a = gen("pl", seed, opts), b = gen("en", seed, opts);
  if (structure(a) !== structure(b)) fail(`${seed}: struktura sprawy różni się między pl i en`);
  const text = [b.intro, b.epilogue, b.detective, ...b.hints, ...b.why.flat(), ...b.rules.map(r => r.text)].join(" ");
  if (/\{[a-zA-Z_]+\}/.test(text)) fail(`${seed}: nierozwiązana wstawka w tekście en`);
  if (!/[Rr]ule|[Ee]vidence|[Pp]apers|alibi/.test(b.hints.join(" "))) fail(`${seed}: podpowiedzi en nie są po angielsku: ${b.hints[0]}`);
}
console.log(bad ? `Test języków: ${bad} błędów` : `Test języków: ${N} spraw, struktura pl = en`);
process.exit(bad ? 1 : 0);
