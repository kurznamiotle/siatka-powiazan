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
function track(path, title) {
  if (OFF) return;
  q.push([path, title]);
  if (flush() || timer) return;
  let n = 0; // skrypt GoatCountera ładuje się asynchronicznie; czekamy na niego do 15 s
  timer = setInterval(() => { if (flush() || ++n > 30) { clearInterval(timer); timer = null; } }, 500);
}
window.SiatkaTrack = track;

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
