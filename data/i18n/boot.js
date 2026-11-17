/*
 * Siatka Powiązań — wybór języka interfejsu (ładuje się po wszystkich paczkach językowych, przed grą).
 * Kolejność: ?lang=pl|en w adresie (nadpisuje i zapamiętuje, do linków z itch i Reddita) → zapamiętany wybór
 * (localStorage "siatka-lang") → pierwsza wizyta: navigator.language (pl* → polski, reszta → angielski), też zapamiętane.
 * Angielski jest wybieralny tylko w #dev, dopóki EN_PUBLIC jest false (angielskich treści spraw jeszcze nie ma:
 * interfejs byłby po angielsku, a sprawa po polsku). Gdy treści data/i18n/en/ będą gotowe, ustaw EN_PUBLIC = true.
 */
(function (root) {
  "use strict";
  const I = root.SiatkaI18n;
  if (!I) return;
  const KEY = "siatka-lang", EN_PUBLIC = false;
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (_) {} }
  };
  const loc = root.location || { search: "", hash: "" };
  I.EN_PUBLIC = EN_PUBLIC;
  /* czy angielski jest dostępny w tej sesji */
  I.enAvailable = () => !!I.packs.en && (EN_PUBLIC || loc.hash === "#dev");
  /* język interfejsu dla tej sesji */
  I.pick = function () {
    if (!I.enAvailable()) return "pl";
    let q = null;
    try { q = new URLSearchParams(loc.search).get("lang"); } catch (_) {}
    q = q && q.toLowerCase();
    if (q === "pl" || q === "en") { store.set(q); return q; }
    const saved = store.get();
    if (saved === "pl" || saved === "en") return saved;
    const nav = (root.navigator && (root.navigator.languages && root.navigator.languages[0] || root.navigator.language)) || "pl";
    const lang = /^pl/i.test(nav) ? "pl" : "en";
    store.set(lang);
    return lang;
  };
  /* <html lang> i <title> zgodne z językiem */
  I.applyDocument = function () {
    if (typeof document === "undefined") return;
    document.documentElement.lang = I.lang;
    document.title = I.t("ui.html.title");
  };
  /* zmiana języka z Ustawień: zapis, usunięcie ?lang z adresu (inaczej nadpisałby wybór) i przeładowanie */
  I.setLang = function (lang) {
    store.set(lang);
    try {
      const u = new URL(loc.href);
      u.searchParams.delete("lang");
      root.history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    } catch (_) {}
    root.location.reload();
  };
  I.use(I.pick());
  I.applyDocument();
})(typeof window !== "undefined" ? window : globalThis);
