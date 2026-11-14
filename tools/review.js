#!/usr/bin/env node
/*
 * Sprawy do przeczytania przez człowieka, jako zwykły tekst.
 *   node tools/review.js                          → po jednej sprawie z 7 typów zbrodni z 2.1.1
 *   node tools/review.js plik.txt szantaz napad   → wybrane typy do wybranego pliku (w cases/generated/)
 * Przy zbrodniach bez kontaktu (szantaż, fałszerstwo, sabotaż, wandalizm) bierze sprawę z regułą cechy,
 * żeby było widać ślady na przedmiocie albo w miejscu czynu.
 */
const fs = require("fs"), path = require("path");
require("../engine/sprites.js");
const S = require("../engine/engine.js");
const WORLD = { base: require("../data/i18n/pl/base.js"), cities: require("../data/i18n/pl/cities.js") };

const [, , fileArg, ...crimeArgs] = process.argv;
const MIX = crimeArgs[0] === "mix", V22 = crimeArgs[0] === "v22", V221 = crimeArgs[0] === "v221"; // 20 spraw: 15 z różnych typów i wielkości + 5 XL (w tym seed ze zgłoszenia gracza)
const CRIMES = MIX ? [] : crimeArgs.length ? crimeArgs : ["szantaz", "falszerstwo", "sabotaz", "napad", "wandalizm", "porwanie_psa", "otrucie_czlowieka"];
const NO_CONTACT = ["szantaz", "falszerstwo", "sabotaz", "wandalizm"];
const SIZES = ["M", "L", "XL", "M", "L", "XL", "L"];
const cityIds = Object.keys(WORLD.cities);

function pick(crime, k) {
  for (let i = 0; i < 200; i++) {
    const c = S.generateCase(WORLD, `review-${crime}-${i}`, { crime, size: SIZES[k % SIZES.length], city: cityIds[k % cityIds.length] });
    const traitRule = c.rules.some(r => r.type === "trait" && r.trait !== "motive");
    if ((!NO_CONTACT.includes(crime) || traitRule) && c.nodes.some(n => n.type === "evidence")) return c;
  }
  throw new Error("Brak sprawy do przeglądu dla " + crime);
}

const ids = Object.keys(WORLD.base.crimes);
const jobs = MIX ? [
  ...[...Array(15).keys()].map(k => ({ crime: ids[k % ids.length], get: () => pick(ids[k % ids.length], k + 20) })),
  { crime: "(zgłoszenie gracza)", get: () => S.generateCase(WORLD, "losowa-mw6tvpcc-2", { size: "XL", city: "warszawa", year: 1995 }) },
  ...[...Array(4).keys()].map(k => ({ crime: ids[(k * 3 + 1) % ids.length], get: () => S.generateCase(WORLD, `review-xl-${k}`, { size: "XL", crime: ids[(k * 3 + 1) % ids.length] }) }))
] : CRIMES.map((crime, k) => ({ crime, get: () => pick(crime, k) }));
/* 2.2: 8 classic z nowymi regułami (każdy typ co najmniej raz), 8 osi czasu (M, L, XL), 4 XL mieszane */
if (V22) {
  jobs.length = 0;
  const want = ["cmp", "relation", "absent", "known", "cmp", "relation", "absent", "known"], got = [];
  const kind = c => c.rules.filter(r => ["cmp", "relation", "absent"].includes(r.type) || r.trait === "known").map(r => r.trait === "known" ? "known" : r.type);
  for (let i = 0; got.length < want.length && i < 5000; i++) {
    const c = S.generateCase(WORLD, `review22-${i}`, { archetype: "classic", size: ["M", "L", "XL"][i % 3] });
    const k = want[got.length];
    if (kind(c).includes(k)) got.push(c);
  }
  for (const c of got) jobs.push({ get: () => c });
  for (let k = 0; k < 8; k++) jobs.push({ get: () => S.generateCase(WORLD, `review22-tl-${k}`, { archetype: "timeline", size: ["M", "L", "XL"][k % 3] }) });
  for (let k = 0; k < 4; k++) jobs.push({ get: () => S.generateCase(WORLD, `review22-xl-${k}`, { size: "XL" }) });
}
/* 2.2.1: 15 spraw: 3 sabotaże (różni poszkodowani), 2 z relacją, 7 innych typów (świadkowie, godziny scen, motywy), 3 osie czasu */
if (V221) {
  jobs.length = 0;
  const vts = ["adm", "firm", "priv"], seen = new Set();
  for (let i = 0; seen.size < 3 && i < 4000; i++) {
    const c = S.generateCase(WORLD, `review221-sab-${i}`, { archetype: "classic", crime: "sabotaz", size: ["M", "L", "XL"][i % 3] });
    const sc = WORLD.base.crimes.sabotaz.scenes.find(x => x.title === c.used.scenes[0]), v = vts.find(t => (sc.vt || []).includes(t));
    if (v && !seen.has(v)) { seen.add(v); jobs.push({ get: () => c }); }
  }
  for (let i = 0, n = 0; n < 2 && i < 5000; i++) {
    const c = S.generateCase(WORLD, `review221-rel-${i}`, { archetype: "classic", size: ["L", "XL"][n % 2] });
    if (c.rules.some(r => r.type === "relation")) { n++; jobs.push({ get: () => c }); }
  }
  for (const [k, crime] of ["otrucie", "podpalenie", "wandalizm", "zabojstwo", "kradziez", "otrucie_czlowieka", "napad"].entries())
    jobs.push({ get: () => S.generateCase(WORLD, `review221-${crime}`, { archetype: "classic", crime, size: ["M", "L", "XL"][k % 3] }) });
  for (let k = 0; k < 3; k++) jobs.push({ get: () => S.generateCase(WORLD, `review221-tl-${k}`, { archetype: "timeline", size: ["M", "L", "XL"][k] }) });
}
const out = [];
const line = (s = "") => out.push(s);
jobs.forEach((job, k) => {
  const c = job.get(), crime = c.crime, N = t => c.nodes.filter(n => n.type === t);
  const name = id => (c.nodes.find(n => n.id === id) || {}).name || id;
  line("=".repeat(78));
  line(`${k + 1}. ${WORLD.base.crimes[crime].name.toUpperCase()}: „${c.title}”`);
  if (c.verify && c.verify.depth) line(`głębokość: ${c.verify.depth.minFacts} faktów · najsilniejsza reguła odcina ${c.verify.depth.strongRule}, najsilniejszy fakt ${c.verify.depth.strongFact}`);
  line(`${c.city_name}, ${c.month} ${c.year} · wielkość ${c.size} · seed ${c.seed} · ${c.detective}`);
  line("=".repeat(78));
  line(c.intro);
  line();
  line(`ARCHETYP: ${c.archetype}${c.question === "culprit" ? " (pytanie: kto)" : ""}`);
  line("NOTATNIK (reguły):");
  for (const r of c.rules) line(`  ${r.id.slice(1)}. ${r.text}   [${r.type}${r.trait ? ":" + r.trait : ""}${r.rel ? ":" + r.rel : ""}]`);
  if (c.travel) { line("  CZASY DOJŚCIA:"); for (const [a, b, m] of c.travel) line(`    ${name(a)} ↔ ${name(b)}: ${m} min`); line("  " + c.travel_note); }
  if (c.archetype === "timeline") {
    line(); line("TRASY (obserwacje, do przeglądu):");
    for (const p of N("person")) line(`  ${p.name}${p.id === c.solution.culprit ? " [SPRAWCA]" : ""}: ${c.facts.filter(f => f.type === "presence" && f.who === p.id).sort((a, b) => a.at.localeCompare(b.at)).map(f => `${f.at} ${name(f.where)}${f.src ? " (dowód)" : ""}`).join(" → ")}`);
  }
  for (const [title, type] of [["OSOBY", "person"], ["MIEJSCA", "location"], ["PRZEDMIOTY", "item"], ["DOWODY RZECZOWE", "evidence"]]) {
    if (!N(type).length) continue;
    line(); line(title + ":");
    for (const n of N(type)) {
      line(`  • ${n.name} — ${n.kind}${type === "item" && n.g === "pl" ? " (l. mnoga)" : ""}`);
      for (const t of n.text) line(`      ${t}`);
    }
  }
  line(); line("PODPOWIEDZI:"); for (const h of c.hints) line(`  - ${h}`);
  line(); line(`ROZWIĄZANIE: ${c.culprit_name}${c.weapon_name ? ", " + c.weapon_name.charAt(0).toLowerCase() + c.weapon_name.slice(1) : ""}.`);
  for (const [who, why] of c.why) line(`  ${who} ${why}`);
  line(); line("EPILOG: " + c.epilogue);
  line("KOMISARZ: " + c.quip);
  line(); line(`(odpada z reguły: ${Object.entries(c.eliminations).map(([p, r]) => `${name(p)} → ${r.slice(1)}`).join(", ")}; fałszywe tropy: ${c.red_herrings.map(name).join(", ") || "brak"})`);
  line();
});
const dir = path.join(__dirname, "..", "cases", "generated");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, fileArg || "review-2.1.2.txt");
fs.writeFileSync(file, out.join("\n"));
console.log(`Zapisano ${jobs.length} spraw do ${file}`);
