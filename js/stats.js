/*
 * Siatka Powiązań — okno Statystyki. Liczby pochodzą z historii wyników (js/history.js).
 * Sprawy dnia: seria (kolejne rozwiązane sprawy dnia, kończące się dziś albo wczoraj), rekord, % wygranych.
 * Sprawa dnia, której jeszcze dziś nie rozegrano, nie przerywa serii. Wszystkie sprawy: z archiwum też.
 * API: SiatkaStats.summary(), .open()
 */
(() => {
const $ = id => document.getElementById(id);
const fmt = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const EMPTY = { daily: { played: 0, won: 0, pct: 0, cur: 0, best: 0, dist: { 3: 0, 2: 0, 1: 0, 0: 0 }, today: null }, archive: { played: 0, won: 0 }, all: { played: 0, won: 0, pct: 0, avgMs: 0 } };
function summary() {
  try { return window.SiatkaHistory ? SiatkaHistory.summary() : EMPTY; } catch (_) { return EMPTY; }
}

function open() {
  const m = summary(), d = m.daily, max = Math.max(1, ...Object.values(d.dist));
  const row = (k, label) => {
    const v = d.dist[k], here = d.today && (d.today.win ? d.today.stars : 0) === +k;
    return `<div class="st-row"><span class="st-k">${label}</span><span class="st-bar"><i class="${here ? "here" : ""}" style="width:${Math.max(v ? 8 : 0, v / max * 100)}%"></i></span><span class="st-v">${v}</span></div>`;
  };
  $("statsCard").innerHTML = `<h3>Statystyki</h3><p class="sub">Wyniki w tej przeglądarce.</p>
    <div class="lbl">Sprawy dnia</div>
    <div class="st-grid">
      <div><b>${d.cur}</b><span>seria</span></div><div><b>${d.best}</b><span>rekord</span></div>
      <div><b>${d.pct}%</b><span>wygrane</span></div><div><b>${d.played}</b><span>rozegrane</span></div>
    </div>
    <div class="lbl">Gwiazdki w sprawach dnia</div>
    ${row(3, "★★★")}${row(2, "★★☆")}${row(1, "★☆☆")}${row(0, "umorzone")}
    <div class="lbl">Wszystkie sprawy</div>
    <div class="st-grid three">
      <div><b>${m.all.played}</b><span>rozegrane</span></div><div><b>${m.all.pct}%</b><span>wygrane</span></div>
      <div><b>${m.all.avgMs ? fmt(m.all.avgMs) : "–"}</b><span>średni czas</span></div>
    </div>
    <p class="stat">Sprawy z archiwum: rozwiązane ${m.archive.won} z ${m.archive.played}.</p>
    <div class="foot"><button class="btn ghost" id="statsClose">Zamknij</button></div>`;
  $("stats").hidden = false;
  $("statsClose").onclick = () => { $("stats").hidden = true; };
  if (window.SiatkaTrack) SiatkaTrack("statystyki/otwarte", "Statystyki otwarte");
}
const ov = $("stats");
if (ov) ov.addEventListener("click", e => { if (e.target.id === "stats") e.currentTarget.hidden = true; });

window.SiatkaStats = { summary, open };
})();
