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
const WORLD = { base: require("../data/base.js"), cities: require("../data/cities.js") };

const [, , fileArg, ...crimeArgs] = process.argv;
const CRIMES = crimeArgs.length ? crimeArgs : ["szantaz", "falszerstwo", "sabotaz", "napad", "wandalizm", "porwanie_psa", "otrucie_czlowieka"];
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

const out = [];
const line = (s = "") => out.push(s);
CRIMES.forEach((crime, k) => {
  const c = pick(crime, k), N = t => c.nodes.filter(n => n.type === t);
  const name = id => (c.nodes.find(n => n.id === id) || {}).name || id;
  line("=".repeat(78));
  line(`${k + 1}. ${WORLD.base.crimes[crime].name.toUpperCase()}: „${c.title}”`);
  line(`${c.city_name}, ${c.month} ${c.year} · wielkość ${c.size} · seed ${c.seed} · ${c.detective}`);
  line("=".repeat(78));
  line(c.intro);
  line();
  line("NOTATNIK (reguły):");
  for (const r of c.rules) line(`  ${r.id.slice(1)}. ${r.text}   [${r.type}${r.trait ? ":" + r.trait : ""}]`);
  for (const [title, type] of [["OSOBY", "person"], ["MIEJSCA", "location"], ["PRZEDMIOTY", "item"], ["DOWODY RZECZOWE", "evidence"]]) {
    if (!N(type).length) continue;
    line(); line(title + ":");
    for (const n of N(type)) {
      line(`  • ${n.name} — ${n.kind}${type === "item" && n.g === "pl" ? " (l. mnoga)" : ""}`);
      for (const t of n.text) line(`      ${t}`);
    }
  }
  line(); line("PODPOWIEDZI:"); for (const h of c.hints) line(`  - ${h}`);
  line(); line(`ROZWIĄZANIE: ${c.culprit_name}, ${c.weapon_name.charAt(0).toLowerCase() + c.weapon_name.slice(1)}.`);
  for (const [who, why] of c.why) line(`  ${who} ${why}`);
  line(); line("EPILOG: " + c.epilogue);
  line("KOMISARZ: " + c.quip);
  line(); line(`(odpada z reguły: ${Object.entries(c.eliminations).map(([p, r]) => `${name(p)} → ${r.slice(1)}`).join(", ")}; fałszywe tropy: ${c.red_herrings.map(name).join(", ")})`);
  line();
});
const dir = path.join(__dirname, "..", "cases", "generated");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, fileArg || "review-2.1.1.txt");
fs.writeFileSync(file, out.join("\n"));
console.log(`Zapisano ${CRIMES.length} spraw do ${file}`);
