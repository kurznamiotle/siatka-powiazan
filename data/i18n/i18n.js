/*
 * Siatka Powiązań — warstwa językowa (i18n).
 *
 * Paczka języka (data/i18n/<język>.js) rejestruje się przez SiatkaI18n.register(język, { messages, grammar }),
 * a jego treści generatora (data/i18n/<język>/base.js, cities.js) przez register(język, { content: { base } }).
 *   messages : płaska mapa klucz → tekst z wstawkami {nazwa} (albo lista/obiekt dla danych, np. „Co nowego”)
 *   grammar  : gramatyka języka dla silnika szablonów: tx (odmiana [a|b] wg rodzaju), plural, list, slug,
 *              amount (kwota słownie), moneyGen (kwota w dopełniaczu)
 *   content  : base (role, cechy, alibi, sceny…) i cities (paczki miast) dla generatora
 * Brakujący klucz w języku bieżącym bierze tekst z polskiego (pl), a gdy go nie ma, zwraca sam klucz.
 *
 * Kod gry i silnik nie zawierają polskich tekstów: wołają t("klucz", { zmienne }).
 */
(function (root) {
  "use strict";
  const I = {
    lang: "pl",
    packs: {},
    register(lang, pack) {
      const p = this.packs[lang] || (this.packs[lang] = { messages: {} });
      // null = „jeszcze nieprzetłumaczone”: nie nadpisuje wartości z innego pliku tego języka (np. en/changelog.js przed en.js)
      if (pack.messages) for (const k in pack.messages) if (pack.messages[k] != null || !(k in p.messages)) p.messages[k] = pack.messages[k];
      if (pack.grammar) p.grammar = pack.grammar;
      if (pack.content) p.content = Object.assign(p.content || {}, pack.content);
    },
    use(lang) { if (!this.packs[lang]) throw new Error("Unknown language: " + lang); this.lang = lang; },
    /* wartość klucza (tekst, funkcja, lista albo obiekt) z bieżącego języka, a gdy brak (null) z polskiego */
    get(key, lang) {
      const cur = this.packs[lang || this.lang], pl = this.packs.pl;
      let v = cur && cur.messages[key];
      if (v == null && pl) v = pl.messages[key];
      return v;
    },
    has(key) { return this.get(key) != null; },
    /* tekst z wstawkami {nazwa}: jeden przebieg, więc wstawiona wartość nie jest ponownie przetwarzana; nieznane {x} zostają */
    /* Język GENERATORA (teksty zbudowane w kodzie sprawy: klucze gen.*, gramatyka szablonów). Zależy od treści, nie od
       interfejsu: dopóki język nie ma własnych treści (content.base), sprawa powstaje po polsku, choć interfejs jest
       w tym języku. genOverride wymusza język generatora (testy: angielskie gen.* i gramatyka na polskich treściach). */
    genLang() {
      if (this.genOverride) return this.genOverride;
      const p = this.packs[this.lang];
      return p && p.content && p.content.base ? this.lang : "pl";
    },
    tg(key, vars) { return this.t(key, vars, this.genLang()); },
    t(key, vars, lang) {
      const v = this.get(key, lang);
      if (v == null) return key;
      if (typeof v === "function") return v(vars || {});
      if (typeof v !== "string" || !vars) return v;
      return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    },
    /* tekst statycznego HTML: data-i18n="klucz" (textContent), data-i18n-vars='{"v":3}', data-i18n-attr="atrybut:klucz;…" */
    apply(doc) {
      doc = doc || document;
      doc.querySelectorAll("[data-i18n]").forEach(el => {
        const vars = el.getAttribute("data-i18n-vars");
        el.textContent = this.t(el.getAttribute("data-i18n"), vars ? JSON.parse(vars) : undefined);
      });
      doc.querySelectorAll("[data-i18n-attr]").forEach(el => el.getAttribute("data-i18n-attr").split(";").forEach(pair => {
        const i = pair.indexOf(":"); el.setAttribute(pair.slice(0, i), this.t(pair.slice(i + 1)));
      }));
    },
    /* znacznik Kartoteki {g:hasło} w szablonach: miejsce na podmianę (np. na odnośnik do hasła); na razie sam tekst */
    glossary(id, label) { return label != null ? label : id; },
    /* hasło Kartoteki { term, text, note? } w bieżącym języku, a gdy go brak, po polsku (data/i18n/<język>/glossary.js) */
    glossaryEntry(id, lang) {
      const cur = this.packs[lang || this.lang], pl = this.packs.pl, g = p => p && p.content && p.content.glossary;
      return (g(cur) && g(cur)[id]) || (g(pl) && g(pl)[id]) || null;
    },
    grammar(lang) { const p = this.packs[lang || this.lang]; return (p && p.grammar) || this.packs.pl.grammar; },
    genGrammar() { return this.grammar(this.genLang()); },
    /* treści generatora bieżącego języka: { base, cities } */
    world(lang) {
      const p = this.packs[lang || this.lang], pl = this.packs.pl;
      const c = (p && p.content && p.content.base && p.content) || (pl && pl.content);
      return { base: c.base, cities: c.cities };
    }
  };
  root.SiatkaI18n = I;
  // skrót t(klucz, zmienne) dla kodu interfejsu (przeglądarka); silnik i narzędzia biorą go z SiatkaI18n / Siatka.t
  if (typeof window !== "undefined" && !window.t) window.t = (key, vars, lang) => I.t(key, vars, lang);
  if (typeof module !== "undefined" && module.exports) module.exports = I;
})(typeof window !== "undefined" ? window : globalThis);
