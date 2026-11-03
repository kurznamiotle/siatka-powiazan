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
  console.log(JSON.stringify({ solutions: r.solutions, unique: r.unique, necessary: r.necessary, ok: r.ok }, null, 2));
  process.exit(r.ok ? 0 : 1);
}
const N = +a1 || 2000;
const opts = { city: city || undefined, year: year ? +year : undefined, size: size || undefined };
let fail = 0; const bad = [], out = [];
const stats = { crime: {}, city: {}, size: {}, rules: {}, nodes: {} };
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  let c;
  try { c = S.generateCase(WORLD, "test-" + i, opts); } catch (e) { fail++; if (fail < 4) console.log(e.message); continue; }
  inc(stats.crime, c.crime); inc(stats.city, c.city); inc(stats.size, c.size); inc(stats.rules, c.rules.length + " reguł");
  inc(stats.nodes, `${c.nodes.filter(n => n.type === "person").length} os. / ${c.nodes.filter(n => n.type === "item").length} dow.`);
  const allText = [c.title, c.intro, c.epilogue, c.quip, c.detective, ...c.rules.map(r => r.text), ...c.hints, ...c.why.map(w => w.join(" ")),
    ...c.nodes.flatMap(n => [n.kind, ...n.text])].join("\n");
  const leftover = allText.match(/[\[\]{}]|undefined|null|NaN/g);
  if (leftover) bad.push([c.seed, leftover.slice(0, 5)]);
  out.push(c);
}
console.log(`Wygenerowano ${N - fail}/${N} spraw w ${Date.now() - t0} ms. Błędów generatora: ${fail}. Spraw z niewypełnionym tekstem: ${bad.length}`);
if (bad.length) console.log(bad.slice(0, 5));
console.log("Miasta:", stats.city);
console.log("Wielkości:", stats.size);
console.log("Obsada:", stats.nodes);
console.log("Reguły:", stats.rules);
console.log("Zbrodnie:", stats.crime);
console.log("Unikalnych obsad:", new Set(out.map(c => c.nodes.filter(n => n.type === "person").map(n => n.name).sort().join())).size);
if (a2 === "out") {
  const dir = path.join(__dirname, "..", "cases", "generated");
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  out.forEach((c, i) => fs.writeFileSync(path.join(dir, `gen_${String(i + 1).padStart(3, "0")}_${c.city}_${c.year}_${c.size}.json`), JSON.stringify(c, null, 2)));
  console.log("Zapisano do", dir);
}
if (fail || bad.length) process.exit(1);
