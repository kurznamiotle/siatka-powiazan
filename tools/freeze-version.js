#!/usr/bin/env node
/*
 * Zamraża generator spraw z danego commita do jednego pliku engine/versions/v<wersja>.js.
 *   node tools/freeze-version.js <commit> <wersja>      np. node tools/freeze-version.js 0879423 2.0
 *
 * Bierze z commita pliki silnika i danych w kolejności z index.html (bez sprites.js, który jest
 * wspólny) i zamyka je w osobnym „root”, żeby nie nadpisały bieżących Siatka, SIATKA_BASE itd.
 * `module` i `require` są w środku zasłonięte, więc stary kod nie widzi Node i nie dociąga plików.
 * Wynik rejestruje się jako SiatkaLegacy[wersja] = { generateCase, dailyCase, solve }.
 *
 * Zamrażaj wersję PRZED zmianą generatora, a potem dopisz ją do GENERATOR_VERSIONS w engine.js,
 * do index.html i do SHELL w sw.js. Zamrożonego pliku nie edytuj ręcznie.
 */
const { execSync } = require("child_process");
const fs = require("fs"), path = require("path");
const [, , ref, id] = process.argv;
if (!ref || !id) { console.error("Użycie: node tools/freeze-version.js <commit> <wersja>"); process.exit(1); }
const root = path.join(__dirname, "..");
const show = f => execSync(`git show ${ref}:${f}`, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
const sha = execSync(`git rev-parse --short ${ref}`, { cwd: root, encoding: "utf8" }).trim();

const files = [...show("index.html").matchAll(/<script src="((?:engine|data)\/[^"]+)"><\/script>/g)].map(m => m[1])
  .filter(f => f !== "engine/sprites.js" && !f.startsWith("engine/versions/"));
const GLOBAL = `(typeof window !== "undefined" ? window : globalThis)`;
const body = files.map(f => {
  const src = show(f);
  if (!src.includes(GLOBAL)) throw new Error(`${f}: brak wywołania modułu ${GLOBAL}`);
  return `/* ===== ${f} @ ${sha} ===== */\n(function (module, require) {\n${src.split(GLOBAL).join("(fake)")}\n})(undefined, undefined);`;
}).join("\n\n");

const out = `/*
 * Siatka Powiązań — ZAMROŻONY generator spraw w wersji ${id} (commit ${sha}).
 * Plik zrobiło narzędzie tools/freeze-version.js. Nie edytuj go ręcznie.
 * Używa go sprawa dnia z dni, w których obowiązywała ta wersja (GENERATOR_VERSIONS w engine.js).
 * Pliki: ${files.join(", ")}
 */
(function (root) {
  "use strict";
  const fake = { SiatkaSprites: root.SiatkaSprites || (typeof require !== "undefined" ? require("../sprites.js") : undefined) };

${body}

  const world = { base: fake.SIATKA_BASE, cities: fake.SIATKA_CITIES };
  const E = fake.Siatka;
  const gen = {
    id: ${JSON.stringify(id)}, commit: ${JSON.stringify(sha)},
    generateCase: (seed, opts) => E.generateCase(world, seed, opts),
    dailyCase: date => E.dailyCase(world, date),
    solve: c => E.solve(c)
  };
  (root.SiatkaLegacy = root.SiatkaLegacy || {})[${JSON.stringify(id)}] = gen;
  if (typeof module !== "undefined" && module.exports) module.exports = gen;
})(typeof window !== "undefined" ? window : globalThis);
`;
const dest = path.join(root, "engine", "versions", `v${id.replace(/\./g, "_")}.js`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(`${path.relative(root, dest)}: ${files.length} plików z ${sha}, ${(out.length / 1024).toFixed(0)} KB`);
