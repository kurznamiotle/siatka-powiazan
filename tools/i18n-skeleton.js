#!/usr/bin/env node
/*
 * Szkielet pliku językowego: wszystkie klucze z pl.js, wartość null = jeszcze nieprzetłumaczone.
 *   node tools/i18n-skeleton.js [język]     (domyślnie en → data/i18n/en.js)
 * Istniejące tłumaczenia (wartości inne niż null) zostają, brakujące klucze są dopisywane, a klucze, których nie
 * ma już w pl.js, znikają. Gramatyka (tx, plural…) i treści generatora (base, cities) to osobne części paczki języka.
 */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const lang = process.argv[2] || "en";
require(path.join(root, "data/i18n/pl.js")); require(path.join(root, "data/i18n/pl/changelog.js"));
const I = require(path.join(root, "data/i18n/i18n.js"));
const pl = I.packs.pl.messages, file = path.join(root, `data/i18n/${lang}.js`);
let old = {};
if (fs.existsSync(file)) { try { delete require.cache[file]; require(file); old = (I.packs[lang] && I.packs[lang].messages) || {}; } catch (_) {} }
const body = Object.keys(pl).map(k => `    ${JSON.stringify(k)}: ${JSON.stringify(old[k] == null ? null : old[k])}`).join(",\n");
const out = `/*
 * Siatka Powiązań — język: ${lang}. SZKIELET: te same klucze co data/i18n/pl.js, wartość null = jeszcze nieprzetłumaczone
 * (gra bierze wtedy tekst polski). Odtwarza go node tools/i18n-skeleton.js ${lang}; sprawdza node tools/i18n-check.js.
 * Brakuje jeszcze: gramatyki angielskiej (grammar: tx, plural, list, slug, amount, moneyGen) i treści generatora
 * (content: base, cities), więc ten język nie jest jeszcze wybieralny w grze i nie ładuje się w index.html.
 */
(function (root) {
  "use strict";
  const messages = {
${body}
  };
  const I18N = root.SiatkaI18n || (typeof module !== "undefined" && module.exports ? require("./i18n.js") : null);
  if (I18N) I18N.register(${JSON.stringify(lang)}, { messages });
  if (typeof module !== "undefined" && module.exports) module.exports = { messages };
})(typeof window !== "undefined" ? window : globalThis);
`;
fs.writeFileSync(file, out);
console.log(`${file}: ${Object.keys(pl).length} kluczy (przetłumaczone: ${Object.keys(pl).filter(k => old[k] != null).length})`);
