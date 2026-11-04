/*
 * Siatka Powiązań — historia wyników (localStorage `siatka-history`). Z niej liczą się wszystkie statystyki.
 * Ładuje się przed game.js, więc wynik zapisuje się zawsze, nawet gdy reszta interfejsu się nie wczyta.
 *
 * Format (jeden obiekt, żeby dało się go przenieść na konto gracza):
 *   { v: 1,
 *     daily:   { "<numer>": wpis },        sprawy dnia, wszystkie, liczy się pierwszy wynik
 *     archive: [wpis, …],                  sprawy z archiwum, ostatnie ARCHIVE_MAX
 *     totals:  { played, won, ms, timed },  archiwum łącznie (przycinanie listy ich nie zmienia); timed = ile z czasem
 *     migrated: 1 }                        stare statystyki i zapisy przeniesione (raz)
 *   wpis: { id (numer sprawy dnia albo seed), type: "daily"|"archive", win, ms, wrong, hints, stars,
 *           size, city, year, gen, date (lokalna RRRR-MM-DD) }
 * Wpisy z tym samym id się nie dublują. Zapisy postępu (siatka-save-*) mogą znikać, historia zostaje.
 *
 * API: SiatkaHistory.record(c, r), .has(type, id), .summary(), .data(), .gamesDone()
 */
(() => {
const KEY = "siatka-history", FORMAT = 1, ARCHIVE_MAX = 500;
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const empty = () => ({ v: FORMAT, daily: {}, archive: [], totals: { played: 0, won: 0, ms: 0, timed: 0 } });

function load() {
  try {
    const h = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!h || typeof h !== "object" || h.v !== FORMAT) return empty();
    return { v: FORMAT, daily: h.daily && typeof h.daily === "object" ? h.daily : {}, archive: Array.isArray(h.archive) ? h.archive : [],
      totals: Object.assign({ played: 0, won: 0, ms: 0 }, h.totals || {}), migrated: h.migrated };
  } catch (_) { return empty(); }
}
function save(h) { try { localStorage.setItem(KEY, JSON.stringify(h)); return true; } catch (_) { return false; } }
const ver = c => (window.Siatka && Siatka.caseVersion ? Siatka.caseVersion(c) : (c && c.gen) || "2.0");

/* r: { kind: "daily"|"random", win, ms, wrong, hints, stars, date? } */
function entry(c, r) {
  const daily = r.kind === "daily";
  return { id: daily ? c.number : c.seed, type: daily ? "daily" : "archive", win: !!r.win, ms: Math.max(0, Math.round(r.ms || 0)),
    wrong: r.wrong || 0, hints: r.hints || 0, stars: r.win ? (r.stars || 0) : 0,
    size: c.size, city: c.city, year: c.year, gen: ver(c), date: r.date || dayStr() };
}
function add(h, e) {
  if (e.type === "daily") {
    if (e.id == null || h.daily[e.id]) return false; // sprawa dnia liczy się raz
    h.daily[e.id] = e; return true;
  }
  if (e.id == null || h.archive.some(x => x.id === e.id)) return false;
  h.archive.push(e); if (h.archive.length > ARCHIVE_MAX) h.archive.splice(0, h.archive.length - ARCHIVE_MAX);
  h.totals.played++; if (e.win) h.totals.won++; h.totals.ms += e.ms; h.totals.timed++;
  return true;
}
function record(c, r) {
  try {
    const h = load();
    if (add(h, entry(c, r))) save(h);
  } catch (_) {}
}
function has(type, id) { try { const h = load(); return type === "daily" ? !!h.daily[id] : h.archive.some(x => x.id === id); } catch (_) { return false; } }
const dailyResult = n => { try { return load().daily[n] || null; } catch (_) { return null; } };

function summary() {
  const h = load(), D = h.daily, today = window.Siatka ? Siatka.dailyNumber() : 0;
  const nums = Object.keys(D).map(Number).filter(n => n > 0).sort((a, b) => a - b);
  const played = nums.length, won = nums.filter(n => D[n].win).length;
  // seria: kolejne rozwiązane sprawy dnia bez przerwy, kończące się dziś albo wczoraj
  let cur = 0, n = D[today] ? today : today - 1;
  while (D[n] && D[n].win) { cur++; n--; }
  let best = 0, run = 0, prev = null;
  for (const k of nums) { run = D[k].win ? (prev === k - 1 && run > 0 ? run + 1 : 1) : 0; best = Math.max(best, run); prev = k; }
  const dist = { 3: 0, 2: 0, 1: 0, 0: 0 };
  nums.forEach(k => { dist[D[k].win ? Math.min(3, Math.max(1, D[k].stars || 1)) : 0]++; });
  const timed = nums.filter(k => D[k].ms > 0), dMs = timed.reduce((s, k) => s + D[k].ms, 0), nT = timed.length + (h.totals.timed || 0);
  const T = h.totals, allPlayed = played + T.played, allWon = won + T.won;
  return {
    daily: { played, won, pct: played ? Math.round(won / played * 100) : 0, cur, best, dist, today: D[today] || null },
    archive: { played: T.played, won: T.won },
    all: { played: allPlayed, won: allWon, pct: allPlayed ? Math.round(allWon / allPlayed * 100) : 0, avgMs: nT ? Math.round((dMs + T.ms) / nT) : 0 }
  };
}
const gamesDone = () => { try { const h = load(); return Object.keys(h.daily).length + h.totals.played; } catch (_) { return 0; } };
const data = () => load();

/* Migracja (raz): stare statystyki `siatka-stats` i zamknięte zapisy postępu. Zapis z inną wersją generatora
   niż jego sprawa (albo bez sprawy) pomijamy. Wpisy idą po id, więc nic się nie dubluje. */
function migrate() {
  try {
    const h = load();
    if (h.migrated) return;
    const get = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } };
    const old = get("siatka-stats");
    if (old && old.daily) for (const [n, d] of Object.entries(old.daily)) {
      const num = +n; if (!(num > 0) || h.daily[num]) continue;
      h.daily[num] = { id: num, type: "daily", win: !!d.w, ms: (d.m || 0) * 1000, wrong: d.w ? Math.max(0, 3 - (d.s || 3)) : 3, hints: 0,
        stars: d.w ? d.s || 1 : 0, size: null, city: null, year: null, gen: null, date: null };
    }
    if (old && old.random) { // stare liczniki archiwum (bez czasu, więc nie wchodzą do średniej)
      h.totals.played += +old.random.played || 0; h.totals.won += +old.random.won || 0;
    }
    for (const k of ["siatka-save-daily", "siatka-save-random"]) {
      const sv = get(k);
      if (!fromSave(sv)) continue;
      const kind = k.endsWith("daily") ? "daily" : "random";
      if (kind === "daily" && !(sv.case.number > 0)) continue;
      // archiwum: stare liczniki mogły już tę sprawę policzyć, więc dopisujemy ją tylko na listę
      const e = entry(sv.case, { kind, win: sv.win, ms: sv.elapsed, wrong: sv.wrong, hints: sv.hints, stars: starsOf(sv), date: null });
      if (kind === "daily") add(h, e);
      else if (!h.archive.some(x => x.id === e.id)) { if (old && old.random && old.random.played) h.archive.push(e); else add(h, e); }
    }
    h.migrated = 1;
    save(h);
  } catch (_) {}
}
/* zamknięty zapis postępu, którego wersja zgadza się ze sprawą */
function fromSave(sv) {
  if (!sv || !sv.done || !sv.case || !Array.isArray(sv.case.nodes)) return false;
  return (sv.gen || ver(sv.case)) === ver(sv.case);
}
const starsOf = sv => sv.win ? Math.max(1, 3 - (sv.wrong || 0) - ((sv.hints || 0) > 0 ? 1 : 0)) : 0;
/* zamknięty zapis, którego nie ma w historii (np. wynik zapisała inna kopia gry): dopisujemy go */
function fromClosedSave(sv, kind) {
  if (!fromSave(sv)) return;
  if (kind === "daily" && !(sv.case.number > 0)) return;
  record(sv.case, { kind, win: sv.win, ms: sv.elapsed, wrong: sv.wrong, hints: sv.hints, stars: starsOf(sv) });
}

migrate();
window.SiatkaHistory = { record, has, dailyResult, summary, gamesDone, data, fromClosedSave, KEY, FORMAT };
})();
