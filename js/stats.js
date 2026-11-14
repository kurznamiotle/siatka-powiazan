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
  $("statsCard").innerHTML = t("ui.stats.statystyki_wyniki_w_tej_przegladarce_html", { cur: d.cur, best: d.best, pct: d.pct, played: d.played, row: row(3, "★★★"), row2: row(2, "★★☆"), row3: row(1, "★☆☆"), row4: row(0, t("ui.stats.umorzone")), played2: m.all.played, pct2: m.all.pct, v: m.all.avgMs ? fmt(m.all.avgMs) : "–", won: m.archive.won, played3: m.archive.played });
  $("stats").hidden = false;
  $("statsClose").onclick = () => { $("stats").hidden = true; };
  if (window.SiatkaTrack) SiatkaTrack("statystyki/otwarte", t("ui.stats.statystyki_otwarte"));
}
const ov = $("stats");
if (ov) ov.addEventListener("click", e => { if (e.target.id === "stats") e.currentTarget.hidden = true; });

window.SiatkaStats = { summary, open };
})();
