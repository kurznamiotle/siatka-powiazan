#!/usr/bin/env node
/*
 * Generuje sprawy i weryfikuje je solverem.
 *   node tools/generate.js                 → test 2000 spraw (wszystkie miasta, lata, wielkości)
 *   node tools/generate.js 12 out          → zapisuje 12 spraw do cases/generated/
 *   node tools/generate.js 12 out poznan 1993 XL → z ustawieniami (miasto, rok, wielkość)
 *   node tools/generate.js verify cases/case_001.json
 */
const fs = require("fs"), path = require("path");
require("../engine/sprites.js");
const S = require("../engine/engine.js");
const WORLD = { base: require("../data/base.js"), cities: require("../data/cities.js") };

const [, , a1, a2, city, year, size] = process.argv;
if (a1 === "verify") {
  const c = JSON.parse(fs.readFileSync(a2, "utf8"));
  const r = S.solve(c);
  console.log(JSON.stringify({ archetype: c.archetype || "classic", solutions: r.solutions, unique: r.unique, necessary: r.necessary, errors: r.errors, ok: r.ok }, null, 2));
  process.exit(r.ok ? 0 : 1);
}
const N = +a1 || 2000;
const opts = { city: city || undefined, year: year ? +year : undefined, size: size || undefined };
let fail = 0; const bad = [], out = [];
const stats = { crime: {}, city: {}, size: {}, rules: {}, nodes: {}, archetype: {}, evKind: {}, alibiDoc: {} };
const noInnocentEv = []; // sprawy, w których wszystkie dowody dotyczą sprawcy
const ev = {}; // wielkość → {n, sum, min, need}
/* czy rozwiązanie wymaga faktu z dowodu: bez faktów z dowodów sprawa traci jedno, właściwe rozwiązanie */
const fromEvidence = f => !!f.src || f.type === "evidence" || f.type === "mark";
function needsEvidence(c) {
  if (!c.nodes.some(n => n.type === "evidence")) return false;
  const r = S.solve(c, { skip: fromEvidence });
  return !(r.unique && r.solutions[0].culprit === c.solution.culprit && r.solutions[0].weapon === c.solution.weapon);
}
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
/* Spójność treści: reguła o oknie mówi o czasie, alibi zawodowe pasuje do roli, zdania z `ages` do wieku. */
const B = WORLD.base;
const stem = (t, g) => S.tx(t, g).split(/[{]/)[0].trim(); // stały początek zdania, bez wstawek
const workAlibi = B.alibiConfirmed.filter(a => a.roles);
const aged = [...Object.values(B.traits).flatMap(t => t.facts ? (Array.isArray(t.facts) ? t.facts : Object.values(t.facts).flat()) : []),
  ...Object.values(B.habits).flat()].filter(o => typeof o === "object" && o.ages);
const incoherent = [];
function coherence(c) {
  for (const r of c.rules) if (r.type === "window" && !/gdy [^.]*znika/.test(r.text)) incoherent.push([c.seed, "okno bez czasu: " + r.text]);
  c.nodes.filter(n => n.type === "person").forEach((n, k) => {
    const role = c.used.roles[k], txt = n.text.join(" ");
    for (const a of workAlibi) if (!a.roles.includes(role) && txt.includes(stem(a.text, n.g))) incoherent.push([c.seed, `${role} z cudzym alibi: ${stem(a.text, n.g)}`]);
    for (const o of aged) if (!o.ages.includes(n.age) && txt.includes(stem(o.t, n.g))) incoherent.push([c.seed, `${n.age}: ${o.t}`]);
  });
}
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  let c;
  try { c = S.generateCase(WORLD, "test-" + i, opts); } catch (e) { fail++; if (fail < 4) console.log(e.message); continue; }
  inc(stats.crime, c.crime); inc(stats.city, c.city); inc(stats.size, c.size); inc(stats.rules, c.rules.length + " reguł");
  inc(stats.nodes, `${c.nodes.filter(n => n.type === "person").length} os. / ${c.nodes.filter(n => n.type === "item").length} przedm.`);
  inc(stats.archetype, c.archetype);
  const nEv = c.nodes.filter(n => n.type === "evidence").length, e = ev[c.size] = ev[c.size] || { n: 0, sum: 0, min: 99, need: 0 };
  e.n++; e.sum += nEv; e.min = Math.min(e.min, nEv); if (needsEvidence(c)) e.need++;
  for (const x of c.facts.filter(x => x.type === "evidence")) { inc(stats.evKind, x.kind); if (x.kind === "alibi") inc(stats.alibiDoc, x.lie ? "obala (" + x.lie + ")" : "potwierdza"); }
  const evF = c.facts.filter(x => x.type === "evidence");
  if (evF.length && evF.every(x => x.owner === c.solution.culprit)) noInnocentEv.push(c.seed);
  const allText = [c.title, c.intro, c.epilogue, c.quip, c.detective, ...c.rules.map(r => r.text), ...c.hints, ...c.why.map(w => w.join(" ")),
    ...c.nodes.flatMap(n => [n.kind, ...n.text])].join("\n");
  const leftover = allText.match(/[\[\]{}]|undefined|null|NaN|(?<!\.)\.\.(?!\.)/g); // też podwójna kropka
  if (leftover) bad.push([c.seed, leftover.slice(0, 5)]);
  coherence(c);
  out.push(c);
}
console.log(`Niespójności treści (okno bez czasu, cudze alibi zawodowe, zdanie nie na wiek): ${incoherent.length}`);
if (incoherent.length) console.log(incoherent.slice(0, 5));
console.log(`Wygenerowano ${N - fail}/${N} spraw w ${Date.now() - t0} ms. Błędów generatora: ${fail}. Spraw z niewypełnionym tekstem: ${bad.length}`);
if (bad.length) console.log(bad.slice(0, 5));
console.log("Miasta:", stats.city);
console.log("Wielkości:", stats.size);
console.log("Obsada:", stats.nodes);
console.log("Reguły:", stats.rules);
console.log("Zbrodnie:", stats.crime);
console.log("Archetypy:", stats.archetype);
console.log("Rodzaje dowodów:", stats.evKind);
const ad = stats.alibiDoc, adAll = Object.values(ad).reduce((a, b) => a + b, 0), adLie = adAll - (ad.potwierdza || 0);
console.log(`Dokumenty alibi: ${JSON.stringify(ad)}, obalają ${(100 * adLie / Math.max(1, adAll)).toFixed(1)}%`);
console.log(`Sprawy z dowodami, w których żaden dowód nie dotyczy niewinnego: ${noInnocentEv.length}`);
const all = Object.values(ev).reduce((a, e) => ({ n: a.n + e.n, sum: a.sum + e.sum, need: a.need + e.need }), { n: 0, sum: 0, need: 0 });
console.log("Dowody rzeczowe:", Object.fromEntries(Object.entries(ev).map(([k, e]) => [k, `śr. ${(e.sum / e.n).toFixed(2)}, min ${e.min}, wymaga dowodu ${Math.round(100 * e.need / e.n)}%`])));
const evAvg = all.sum / Math.max(1, all.n), needPct = 100 * all.need / Math.max(1, all.n);
console.log(`Dowody razem: średnio ${evAvg.toFixed(2)} na sprawę, rozwiązanie wymaga dowodu w ${needPct.toFixed(1)}% spraw`);
// progi z etapu 1: średnio min. 1 dowód, w XL min. 3, w co najmniej 60% spraw dowód jest potrzebny
const evFail = all.n >= 200 && (evAvg < 1 || needPct < 60 || (ev.XL && ev.XL.min < 3));
if (evFail) console.log("BŁĄD: dowody rzeczowe poniżej progów etapu 1");
console.log("Unikalnych obsad:", new Set(out.map(c => c.nodes.filter(n => n.type === "person").map(n => n.name).sort().join())).size);
/* opts.avoid: seria spraw z archiwum jak u gracza (okno ostatnich S.RECENT spraw).
   Liczymy, jaka część imion, ról i scen nowej sprawy powtarza się z tego okna, bez avoid i z avoid. */
function repeats(useAvoid, n = 300) {
  const recent = [], hit = { names: [0, 0], roles: [0, 0], scenes: [0, 0] };
  for (let i = 0; i < n; i++) {
    const avoid = S.avoidFrom(recent);
    const c = S.generateCase(WORLD, "seria-" + i, Object.assign({}, opts, useAvoid ? { avoid } : {}));
    for (const k in hit) { const seen = new Set(avoid[k] || []); hit[k][0] += c.used[k].filter(x => seen.has(x)).length; hit[k][1] += c.used[k].length; }
    recent.push(c.used); if (recent.length > S.RECENT) recent.shift();
  }
  return Object.fromEntries(Object.entries(hit).map(([k, [a, b]]) => [k, +(100 * a / b).toFixed(1)]));
}
const rep0 = repeats(false), rep1 = repeats(true);
console.log(`Powtórki z ostatnich ${S.RECENT} spraw (%): bez avoid`, rep0, "· z avoid", rep1);
const avoidFail = N >= 200 && Object.keys(rep1).some(k => rep1[k] > rep0[k]);
if (avoidFail) console.log("BŁĄD: avoid nie zmniejsza powtórek");
if (a2 === "out") {
  const dir = path.join(__dirname, "..", "cases", "generated");
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  out.forEach((c, i) => fs.writeFileSync(path.join(dir, `gen_${String(i + 1).padStart(3, "0")}_${c.city}_${c.year}_${c.size}.json`), JSON.stringify(c, null, 2)));
  console.log("Zapisano do", dir);
}
if (fail || bad.length || evFail || avoidFail || incoherent.length || noInnocentEv.length) process.exit(1);
