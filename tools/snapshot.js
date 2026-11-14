#!/usr/bin/env node
/*
 * Zrzut tekstów generatora do porównania przed i po refaktorze (np. i18n).
 *   node tools/snapshot.js zrzut.json [N] [--full]
 * Zapisuje sha1 całego JSON-a każdej sprawy: sprawy dnia 3–30.11.2026, N losowych (domyślnie 4000),
 * 1000 osi czasu, 300 spraw z `avoid` (z ostatnich 10). Z --full dopisuje też plik .jsonl z pełnymi sprawami,
 * żeby po rozjeździe zobaczyć różnicę tekstu. Dwa zrzuty z tych samych seedów muszą być identyczne bajt w bajt.
 */
const fs = require("fs"), crypto = require("crypto");
require("../engine/sprites.js");
const S = require("../engine/engine.js");
const WORLD = { base: require("../data/i18n/pl/base.js"), cities: require("../data/i18n/pl/cities.js") };
const [, , outFile, nArg, flag] = process.argv;
const N = +nArg || 4000, full = flag === "--full" || nArg === "--full";
const sha = s => crypto.createHash("sha1").update(s).digest("hex");
const rows = [], snap = { daily: {}, random: [], timeline: [], avoid: [] };
const add = (bucket, key, c) => { const js = JSON.stringify(c); if (bucket === "daily") snap.daily[key] = sha(js); else snap[bucket].push(sha(js)); if (full) rows.push(JSON.stringify({ bucket, key, c })); };
for (let d = 3; d <= 30; d++) { const date = new Date(2026, 10, d, 12); add("daily", `2026-11-${String(d).padStart(2, "0")}`, S.dailyCase(WORLD, date)); }
for (let i = 0; i < N; i++) add("random", i, S.generateCase(WORLD, "snap-" + i, {}));
for (let i = 0; i < 1000; i++) add("timeline", i, S.generateCase(WORLD, "snapt-" + i, { archetype: "timeline", size: ["M", "L", "XL"][i % 3] }));
const used = [];
for (let i = 0; i < 300; i++) { const c = S.generateCase(WORLD, "snapa-" + i, { avoid: S.avoidFrom(used) }); if (c && c.used) used.push(c.used); add("avoid", i, c); }
fs.writeFileSync(outFile, JSON.stringify(snap));
if (full) fs.writeFileSync(outFile.replace(/\.json$/, "") + ".jsonl", rows.join("\n"));
console.log(`Zrzut: ${Object.keys(snap.daily).length} dni, ${snap.random.length} losowych, ${snap.timeline.length} osi czasu, ${snap.avoid.length} z avoid → ${outFile}`);
