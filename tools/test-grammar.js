#!/usr/bin/env node
/*
 * Test liczby mnogiej przedmiotów (rodzaj "pl": widły, nożyce, nożyczki, obcęgi).
 *   node tools/test-grammar.js
 * 1) Każdy los przedmiotu daje w liczbie mnogiej „znalezione / odniesione / odnalezione / wyłowione”, „je”.
 * 2) W wygenerowanych sprawach przedmiot w liczbie mnogiej „zniknęły”, a wyjaśnienie mówi „gdzie je znaleziono”.
 */
require("../engine/sprites.js");
const S = require("../engine/engine.js");
const WORLD = { base: require("../data/i18n/pl/base.js"), cities: require("../data/i18n/pl/cities.js") };
const B = WORLD.base;
const errors = [];
const SINGULAR = /\b(Znaleziony|Znaleziona|Wyłowiony|Wyłowiona|Odniesiony|Odniesiona|odnaleziony|odnaleziona|Zniknął|Zniknęła|Zniknęło)\b|Kto (go|ją) /;

// 1) losy przedmiotów: forma dla każdego rodzaju
const EXPECT = { m: /Znaleziony|Odniesiony|odnaleziony|Wyłowiony/, f: /Znaleziona|Odniesiona|odnaleziona|Wyłowiona/, n: /Znalezione|Odniesione|odnalezione|Wyłowione/, pl: /Znalezione|Odniesione|odnalezione|Wyłowione/ };
for (const [id, f] of Object.entries(B.fates)) for (const g of ["m", "f", "n", "pl"]) {
  const t = S.tx(f.item, g, { market_on: "na targu" });
  if (!EXPECT[g].test(t)) errors.push(`los ${id}, rodzaj ${g}: ${t}`);
  if (g === "pl" && SINGULAR.test(t)) errors.push(`los ${id} w liczbie mnogiej ma formę pojedynczą: ${t}`);
}
if (!/Kto je przyniósł/.test(S.tx(B.fates.odniesione.item, "pl"))) errors.push("odniesione: brak „Kto je przyniósł” w liczbie mnogiej");

// 2) przedmioty w liczbie mnogiej w gotowych sprawach
const plItems = B.items.filter(it => it.g === "pl");
if (plItems.length < 2) errors.push("za mało przedmiotów w liczbie mnogiej: " + plItems.length);
const seen = {};
const tries = [["krakow", "zabojstwo"], ["krakow", "napad"], ["lodz", "zabojstwo"], ["lodz", "napad"], [undefined, "szantaz"], [undefined, "sabotaz"]];
for (const [city, crime] of tries) for (let i = 0; i < 150; i++) {
  const c = S.generateCase(WORLD, `pl-${crime}-${city}-${i}`, { city, crime });
  for (const n of c.nodes.filter(n => n.type === "item" && n.g === "pl")) {
    seen[n.id] = (seen[n.id] || 0) + 1;
    const t = n.text.join(" ");
    if (!/Zniknęły/.test(t)) errors.push(`${c.seed} ${n.name}: brak „Zniknęły”: ${t}`);
    if (SINGULAR.test(t)) errors.push(`${c.seed} ${n.name}: forma pojedyncza: ${t}`);
    for (const [, w] of c.why) if (w.includes(n.name.toLowerCase()) && /gdzie (go|ją) znaleziono/.test(w)) errors.push(`${c.seed} wyjaśnienie: ${w}`);
  }
}
for (const it of plItems) if (!seen[it.id]) errors.push(`przedmiot ${it.name} nie pojawił się w żadnej sprawie testowej`);
console.log("Przedmioty w liczbie mnogiej w sprawach testowych:", seen);
// 3) (i18n) znacznik Kartoteki {g:hasło} zostaje samym tekstem, a odmiana i podstawianie działają jak dotąd
if (S.tx("To {g:dozorca} z {street}.", "m", { street: "Ząbkowskiej" }) !== "To dozorca z Ząbkowskiej.") errors.push("{g:hasło} bez tekstu");
if (S.tx("[Był|Była] {g:dozorca|dozorcą}.", "f") !== "Była dozorcą.") errors.push("{g:hasło|tekst} razem z [a|b]");
if (S.t("gen.size.XL") !== "Ogromna" || S.t("nie.ma.takiego.klucza") !== "nie.ma.takiego.klucza") errors.push("t(): klucz z paczki albo sam klucz");
if (S.t("gen.timeline.name_d_min", { name: "Kiosk", d: 10 }) !== "Kiosk: 10 min") errors.push("t(): wstawki {zmienne}");
if (errors.length) { console.log("BŁĄD liczby mnogiej:", errors.slice(0, 10)); process.exit(1); }
console.log("Liczba mnoga: OK");
