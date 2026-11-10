/*
 * Siatka Powiązań — analityka (GoatCounter, bez ciasteczek i bez danych osobowych).
 * Panel: https://kurznamiotle.goatcounter.com
 * Zdarzenia to ścieżki, np. „sprawa/wygrana/daily”. Nic nie wychodzi lokalnie, z pliku ani w trybie #dev.
 * Powroty: gra pamięta tylko dzień pierwszej wizyty (w tej przeglądarce) i raz wysyła
 * „powrot/po-N-dniach”, gdy gracz wróci co najmniej N dni później. „gracz/nowy” to mianownik.
 * API: SiatkaTrack(ścieżka, tytuł?)
 */
(() => {
const OFF = location.hash === "#dev" || !/^https?:$/.test(location.protocol) ||
  /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(location.hostname);
if (OFF) window.goatcounter = { no_onload: true, no_events: true };

const q = [];
let timer = null;
function flush() {
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== "function") return false;
  while (q.length) { const [path, title] = q.shift(); try { gc.count({ path, title: title || path, event: true }); } catch (_) {} }
  return true;
}
const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
function track(path, title) {
  // dzień pierwszej rozpoczętej sprawy: punkt odniesienia dla return_d1 i return_d7
  if (path.startsWith("sprawa/start/")) { try { if (!localStorage.getItem("siatka-first-game-day")) localStorage.setItem("siatka-first-game-day", String(dayNo())); } catch (_) {} }
  if (OFF) return;
  q.push([path, title]);
  if (flush() || timer) return;
  let n = 0; // skrypt GoatCountera ładuje się asynchronicznie; czekamy na niego do 15 s
  timer = setInterval(() => { if (flush() || ++n > 30) { clearInterval(timer); timer = null; } }, 500);
}
/* typ urządzenia jako sufiks ścieżki zdarzeń (case_win, case_abandon, tutorial_*, return_d*) */
track.device = () => { try { return matchMedia("(pointer:fine) and (min-width:1024px)").matches ? "desktop" : "mobile"; } catch (_) { return "mobile"; } };
window.SiatkaTrack = track;

/* retencja od pierwszej gry: return_d1 = pierwsza wizyta w kalendarzowym dniu po dniu pierwszej gry, return_d7 = siódmego dnia.
   Sprawdzane przy wczytaniu i przy powrocie na kartę (gra zainstalowana jako PWA bywa tygodniami w tle). */
function checkReturn() {
  try {
    const g = +localStorage.getItem("siatka-first-game-day"); if (!g) return;
    const since = dayNo() - g, sent = JSON.parse(localStorage.getItem("siatka-ret2") || "[]");
    for (const n of [1, 7]) if (since === n && !sent.includes(n)) { sent.push(n); localStorage.setItem("siatka-ret2", JSON.stringify(sent)); track(`return_d${n}/${track.device()}`, `Powrót w dniu ${n} po pierwszej grze (${track.device()})`); }
  } catch (_) {}
}
checkReturn();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkReturn(); });

/* powroty: dzień pierwszej wizyty i jednorazowe zdarzenia po 1, 3, 7, 14, 30 dniach */
try {
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  let first = +localStorage.getItem("siatka-first-day");
  if (!first) { first = day; localStorage.setItem("siatka-first-day", String(day)); track("gracz/nowy", "Nowy gracz"); }
  const sent = JSON.parse(localStorage.getItem("siatka-ret") || "[]"), since = day - first;
  const label = { 1: "po-1-dniu", 3: "po-3-dniach", 7: "po-7-dniach", 14: "po-14-dniach", 30: "po-30-dniach" };
  for (const n of [1, 3, 7, 14, 30]) {
    if (since >= n && !sent.includes(n)) { track("powrot/" + label[n], `Powrót po ${n} ${n === 1 ? "dniu" : "dniach"}`); sent.push(n); }
  }
  localStorage.setItem("siatka-ret", JSON.stringify(sent));
} catch (_) {}
})();
