/*
 * Siatka Powiązań — seria i statystyki (localStorage, ta przeglądarka).
 * Sprawy dnia: zapis po numerze sprawy (jedna próba na dzień), seria = kolejne wygrane sprawy dnia.
 * Sprawa dnia, której jeszcze dziś nie rozegrano, nie przerywa serii.
 * Sprawy z archiwum (losowe): tylko licznik rozegranych i rozwiązanych.
 * API: SiatkaStats.record(rodzaj, numer, {win, stars, ms}), .summary(), .open()
 */
(() => {
const $ = id => document.getElementById(id);
const KEY = "siatka-stats";
const empty = () => ({ daily: {}, random: { played: 0, won: 0 } });
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && s.daily ? Object.assign(empty(), s) : empty(); } catch (_) { return empty(); }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }

function record(kind, num, r) {
  const s = load();
  if (kind === "daily") {
    if (s.daily[num]) return summary(s); // sprawa dnia liczy się raz
    s.daily[num] = { w: r.win ? 1 : 0, s: r.stars, m: Math.round(r.ms / 1000) };
  } else {
    s.random.played++; if (r.win) s.random.won++;
  }
  save(s);
  return summary(s);
}
function summary(s = load()) {
  const today = Siatka.dailyNumber(), D = s.daily;
  const nums = Object.keys(D).map(Number).sort((a, b) => a - b);
  const played = nums.length, won = nums.filter(n => D[n].w).length;
  let cur = 0, n = D[today] ? today : today - 1;
  while (D[n] && D[n].w) { cur++; n--; }
  let best = 0, run = 0, prev = null;
  for (const k of nums) { run = D[k].w ? (prev === k - 1 && run > 0 ? run + 1 : 1) : 0; best = Math.max(best, run); prev = k; }
  const dist = { 3: 0, 2: 0, 1: 0, 0: 0 };
  nums.forEach(k => { dist[D[k].w ? D[k].s : 0]++; });
  return { played, won, pct: played ? Math.round(won / played * 100) : 0, cur, best, dist, today: D[today] || null, random: s.random };
}

function open() {
  const m = summary(), max = Math.max(1, ...Object.values(m.dist));
  const row = (k, label) => {
    const v = m.dist[k], here = m.today && (m.today.w ? m.today.s : 0) === +k;
    return `<div class="st-row"><span class="st-k">${label}</span><span class="st-bar"><i class="${here ? "here" : ""}" style="width:${Math.max(v ? 8 : 0, v / max * 100)}%"></i></span><span class="st-v">${v}</span></div>`;
  };
  $("statsCard").innerHTML = `<h3>Statystyki</h3><p class="sub">Sprawy dnia w tej przeglądarce.</p>
    <div class="st-grid">
      <div><b>${m.played}</b><span>rozegrane</span></div><div><b>${m.pct}%</b><span>wygrane</span></div>
      <div><b>${m.cur}</b><span>seria</span></div><div><b>${m.best}</b><span>rekord</span></div>
    </div>
    <div class="lbl">Gwiazdki</div>
    ${row(3, "★★★")}${row(2, "★★☆")}${row(1, "★☆☆")}${row(0, "umorzone")}
    <p class="stat">Sprawy z archiwum: rozwiązane ${m.random.won} z ${m.random.played}.</p>
    <div class="foot"><button class="btn ghost" id="statsClose">Zamknij</button></div>`;
  $("stats").hidden = false;
  $("statsClose").onclick = () => { $("stats").hidden = true; };
  if (window.SiatkaTrack) SiatkaTrack("statystyki/otwarte", "Statystyki otwarte");
}
$("stats").addEventListener("click", e => { if (e.target.id === "stats") e.currentTarget.hidden = true; });

window.SiatkaStats = { record, summary, open };
})();
