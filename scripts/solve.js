// Raport solvera. Użycie: node scripts/solve.js [plik.json ...], domyślnie wszystkie sprawy z cases/.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { solve } from "../src/solver.js";

const paths = process.argv.slice(2);
if (!paths.length) {
  for (const f of readdirSync("cases").sort()) if (f.endsWith(".json")) paths.push(join("cases", f));
}

let allOk = true;
for (const path of paths) {
  const c = JSON.parse(readFileSync(path, "utf8"));
  const r = solve(c);
  allOk &&= r.ok;

  console.log(`\n${c.case_id}: ${c.title}`);
  console.log(`Rozwiązania: ${r.solutions.length} (${r.solutions.map(s => `${s.culprit} + ${s.weapon}`).join(", ") || "brak"})`);
  console.log(`Zgodne z polem solution: ${r.matchesSolution ? "tak" : "NIE"}`);
  console.log("Potrzebność reguł:");
  for (const rule of r.rules) {
    console.log(`  ${rule.id}: ${rule.needed ? "potrzebna" : "ZBĘDNA"} (bez niej rozwiązań: ${rule.solutionsWithout})`);
  }
  console.log("Kandydaci:");
  for (const k of r.candidates) {
    console.log(`  ${`${k.culprit} + ${k.weapon}`.padEnd(20)} ${k.failed.length ? `łamie ${k.failed.join(", ")}` : "spełnia wszystkie"}`);
  }
  console.log(r.ok ? "WYNIK: OK" : "WYNIK: ODRZUCIĆ");
}
process.exit(allOk ? 0 : 1);
