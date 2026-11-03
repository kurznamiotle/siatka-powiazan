/*
 * Siatka Powiązań — osiągnięcia (localStorage, ta przeglądarka).
 * Po zamkniętej sprawie game.js woła SiatkaAch.onFinish(info). Nowe odznaki pokazują się kolejno na planszy
 * z fanfarą, iskrami i wibracją. Lista z postępem jest w Ustawieniach.
 * Odznaka: medal 17×17 pikseli, kolor wg klasy (brąz, srebro, złoto), w środku znak 7×7 (GLYPH).
 * Nowe osiągnięcie = wpis w ACH (+ znak w GLYPH, jeśli nowy). Licznik w `need` + `prog` daje pasek postępu.
 * API: SiatkaAch.onFinish(info), .open(), .count() → {got, all}
 */
(() => {
const $ = id => document.getElementById(id);
const AU = window.SiatkaAudio || { sfx() {} };
const track = (p, t) => { if (window.SiatkaTrack) window.SiatkaTrack(p, t); };
const tap = p => { if (window.SiatkaGame) window.SiatkaGame.haptic(p); };
const KEY = "siatka-ach";
const CITIES = 7, YEARS = 11, CRIMES = 4; // 7 miast, lata 1989–1999, 4 typy zbrodni

/* ---------- stan ---------- */
function statsSolved() { // statystyki zapisują każdą zamkniętą sprawę, więc liczba rozwiązanych jest stamtąd
  try {
    const s = JSON.parse(localStorage.getItem("siatka-stats") || "null") || {};
    return Object.values(s.daily || {}).filter(d => d.w).length + ((s.random || {}).won || 0);
  } catch (_) { return 0; }
}
const fresh = () => ({ got: {}, cities: [], years: [], crimes: [] });
function load() { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "null") || {}); } catch (_) { return fresh(); } }
function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} }

/* ---------- lista ---------- */
const streak = () => (window.SiatkaStats ? SiatkaStats.summary().cur : 0);
const ACH = [
  { id: "pierwsza", name: "Pierwsza sprawa", desc: "Zamknij pierwszą sprawę.", tier: 1, g: "lupa", ok: (i) => i.win },
  { id: "bez-pudla", name: "Bez pudła", desc: "Zamknij sprawę na trzy gwiazdki.", tier: 1, g: "star", ok: (i) => i.win && i.stars === 3 },
  { id: "ostatni-naboj", name: "Ostatni nabój", desc: "Wygraj przy ostatniej próbie.", tier: 1, g: "bullet", ok: (i) => i.win && i.wrong === 2 },
  { id: "sito", name: "Sito", desc: "Przed oskarżeniem wyklucz wszystkich niewinnych.", tier: 1, g: "x", ok: (i) => i.win && i.allOut },
  { id: "nocna-zmiana", name: "Nocna zmiana", desc: "Zamknij sprawę między północą a czwartą rano.", tier: 1, g: "moon", ok: (i) => i.win && i.hour < 4 },
  { id: "seria-3", name: "Stały rytm", desc: "Rozwiąż sprawę dnia trzy dni z rzędu.", tier: 1, g: "flame", need: 3, prog: () => streak() },
  { id: "bywalec", name: "Stały bywalec", desc: "Zamknij 10 spraw.", tier: 1, g: "tally", need: 10, prog: () => statsSolved() },

  { id: "blyskawica", name: "Błyskawica", desc: "Zamknij sprawę w mniej niż dwie minuty.", tier: 2, g: "clock", ok: (i) => i.win && i.ms < 120000 },
  { id: "czysta-robota", name: "Czysta robota", desc: "Wygraj z domkniętym obwodem sprawcy i bez ani jednego sznurka bez pokrycia.", tier: 2, g: "check", ok: (i) => i.win && i.chain && i.bad === 0 },
  { id: "pajeczyna", name: "Pajęczyna", desc: "Wygraj z co najmniej 10 sznurkami zgodnymi z faktami.", tier: 2, g: "web", ok: (i) => i.win && i.good >= 10 },
  { id: "grube-akta", name: "Grube akta", desc: "Zamknij sprawę z sześcioma podejrzanymi.", tier: 2, g: "folder", ok: (i) => i.win && i.size === "XL" },
  { id: "seria-7", name: "Tydzień na służbie", desc: "Rozwiąż sprawę dnia siedem dni z rzędu.", tier: 2, g: "flame", need: 7, prog: () => streak() },
  { id: "delegacja", name: "Delegacja", desc: "Zamknij sprawę w każdym z siedmiu miast.", tier: 2, g: "pin", need: CITIES, prog: (st) => st.cities.length },
  { id: "wszechstronny", name: "Wszechstronny", desc: "Zamknij zabójstwo, kradzież, otrucie i podpalenie.", tier: 2, g: "four", need: CRIMES, prog: (st) => st.crimes.length },

  { id: "wielka-szostka", name: "Wielka szóstka", desc: "Zamknij sprawę z sześcioma podejrzanymi na trzy gwiazdki.", tier: 3, g: "crown", ok: (i) => i.win && i.size === "XL" && i.stars === 3 },
  { id: "seria-30", name: "Miesiąc na służbie", desc: "Rozwiąż sprawę dnia 30 dni z rzędu.", tier: 3, g: "flame", need: 30, prog: () => streak() },
  { id: "dekada", name: "Cała dekada", desc: "Zamknij sprawę z każdego roku od 1989 do 1999.", tier: 3, g: "cal", need: YEARS, prog: (st) => st.years.length },
  { id: "weteran", name: "Weteran", desc: "Zamknij 50 spraw.", tier: 3, g: "tally", need: 50, prog: () => statsSolved() }
];
const TIER = { 1: ["brąz", "#c07a3c", "#6e3f17", "#e7a56a"], 2: ["srebro", "#c8c8c2", "#6b6b66", "#f2f2ec"], 3: ["złoto", "#e3b347", "#8a5f12", "#fbe08c"] };

/* ---------- odznaki: piksele ---------- */
const GLYPH = {
  lupa:   [".###...", "#...#..", "#...#..", "#...#..", ".###...", ".....#.", "......#"],
  star:   ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##.", "##...##"],
  bullet: ["...#...", "..###..", "..###..", "..###..", "..###..", ".#####.", ".#####."],
  x:      ["##...##", ".##.##.", "..###..", "...#...", "..###..", ".##.##.", "##...##"],
  moon:   ["..####.", ".##....", "##.....", "##.....", "##.....", ".##....", "..####."],
  flame:  ["...#...", "..##...", "..###.#", ".#####.", "###.###", "##...##", ".#####."],
  tally:  ["#.#.#.#", "#.#.#.#", "#######", "#.#.#.#", "#.#.#.#", "#.#.#.#", "......."],
  clock:  [".#####.", "#..#..#", "#..#..#", "#..##.#", "#.....#", "#.....#", ".#####."],
  check:  ["......#", ".....##", "#...##.", "##.##..", ".###...", "..#....", "......."],
  web:    ["#..#..#", ".#.#.#.", "..###..", "#######", "..###..", ".#.#.#.", "#..#..#"],
  folder: ["###....", "#######", "#.....#", "#.....#", "#.....#", "#.....#", "#######"],
  pin:    ["..###..", ".#####.", ".##.##.", ".#####.", "..###..", "...#...", "...#..."],
  four:   ["###.###", "#.#.#.#", "###.###", ".......", "###.###", "#.#.#.#", "###.###"],
  crown:  ["#..#..#", "##.#.##", "#######", "#######", "#.#.#.#", "#######", "......."],
  cal:    [".#...#.", "#######", "#######", "#.#.#.#", "#######", "#.#.#.#", "#######"]
};
function badge(a, on) {
  const [, fill, rim, hi] = on ? TIER[a.tier] : ["", "#b9ad94", "#8a7d68", "#cfc4ab"];
  const r = [], px = (x, y, c) => r.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`);
  // wstążka
  for (let y = 0; y < 6; y++) for (let x = 5; x < 12; x++) px(x, y, on ? (x < 7 || x > 9 ? "#b3261e" : "#ece3cf") : (x < 7 || x > 9 ? "#9a8c76" : "#cfc4ab"));
  // krążek: środek (8.5, 10.5), promień 5.6; obwódka i blask w lewym górnym rogu
  for (let y = 4; y < 17; y++) for (let x = 2; x < 15; x++) {
    const d = Math.hypot(x + 0.5 - 8.5, y + 0.5 - 10.5);
    if (d > 5.6) continue;
    px(x, y, d > 4.6 ? rim : (x - y < -4 && d > 3.4 ? hi : fill));
  }
  GLYPH[a.g].forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") px(x + 5, y + 7, rim); }));
  return `<svg class="ach-b" viewBox="0 0 17 17" shape-rendering="crispEdges" aria-hidden="true">${r.join("")}</svg>`;
}

/* ---------- sprawdzanie po sprawie ---------- */
const queue = [];
function onFinish(info) {
  const st = load();
  if (info.win) {
    const add = (k, v) => { if (v != null && !st[k].includes(v)) st[k].push(v); };
    add("cities", info.city); add("years", info.year); add("crimes", info.crime);
  }
  const fresh = ACH.filter(a => !st.got[a.id] && (a.need ? a.prog(st) >= a.need : a.ok(info)));
  fresh.forEach(a => { st.got[a.id] = Date.now(); track(`osiagniecie/${a.id}`, `Osiągnięcie: ${a.name}`); });
  save(st);
  if (fresh.length) { queue.push(...fresh); setTimeout(showNext, 1300); } // po pieczątce i dzwonku wygranej
}

/* ---------- plansza zdobycia ---------- */
let showing = false;
function showNext() {
  if (showing) return;
  const a = queue.shift(); if (!a) return;
  showing = true;
  const left = queue.length, [tierName] = TIER[a.tier];
  $("achPopCard").innerHTML = `
    <div class="ach-kicker">Nowe osiągnięcie</div>
    <div class="ach-stage"><div class="ach-rays"></div>${badge(a, true)}${"<i></i>".repeat(10)}</div>
    <div class="ach-tier t${a.tier}">${tierName}</div>
    <h3>${a.name}</h3>
    <p class="ach-desc">${a.desc}</p>
    <div class="foot"><button class="btn red" id="achOk">${left ? `Dalej (${left})` : "Do akt"}</button></div>`;
  $("achPop").hidden = false;
  AU.sfx("medal", a.tier); tap([15, 40, 15, 40, 15, 40, 90]);
  $("achOk").onclick = () => { $("achPop").hidden = true; showing = false; AU.sfx("tick"); if (queue.length) setTimeout(showNext, 180); };
}

/* ---------- lista w ustawieniach ---------- */
function count() { const st = load(); return { got: ACH.filter(a => st.got[a.id]).length, all: ACH.length }; }
function open() {
  const st = load(), c = count(), date = t => new Date(t).toLocaleDateString("pl-PL");
  const rows = ACH.map(a => {
    const on = !!st.got[a.id];
    const prog = !on && a.need ? Math.min(a.need, a.prog(st)) : 0;
    return `<li class="ach-row${on ? "" : " off"}">${badge(a, on)}<div><b>${a.name}</b><span>${a.desc}</span>
      ${on ? `<small>${TIER[a.tier][0]} · zdobyte ${date(st.got[a.id])}</small>`
        : a.need ? `<div class="ach-bar"><i style="width:${prog / a.need * 100}%"></i></div><small>${prog} z ${a.need}</small>` : `<small>${TIER[a.tier][0]}</small>`}</div></li>`;
  }).join("");
  $("achListCard").innerHTML = `<h3>Osiągnięcia</h3><p class="sub">Zdobyte: ${c.got} z ${c.all}. Zapisane w tej przeglądarce.</p>
    <ul class="ach-list">${rows}</ul>
    <div class="foot"><button class="btn ghost" id="achClose">Zamknij</button></div>`;
  $("achList").hidden = false; AU.sfx("paper");
  $("achClose").onclick = () => { $("achList").hidden = true; };
  // #dev: stuknięcie w odznakę pokazuje jej planszę (podgląd, bez zapisu)
  if (location.hash === "#dev") $("achListCard").querySelectorAll(".ach-row").forEach((row, k) => {
    row.style.cursor = "pointer"; row.onclick = () => { queue.push(ACH[k]); showNext(); };
  });
  track("osiagniecia/otwarte", "Osiągnięcia otwarte");
}

/* ---------- okna i style ---------- */
document.body.insertAdjacentHTML("beforeend", `
  <div class="overlay ach-pop" id="achPop" hidden><div class="card" id="achPopCard" role="dialog" aria-modal="true" aria-live="assertive"></div></div>
  <div class="overlay" id="achList" hidden><div class="card" id="achListCard" role="dialog" aria-modal="true" aria-label="Osiągnięcia"></div></div>`);
$("achList").addEventListener("click", e => { if (e.target.id === "achList") e.currentTarget.hidden = true; });
document.head.insertAdjacentHTML("beforeend", `<style>
.ach-pop{z-index:12;align-items:center}
.ach-pop .card{text-align:center;max-width:340px;overflow:hidden}
.ach-kicker{font-family:var(--f-body);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--stamp)}
.ach-stage{position:relative;width:132px;height:132px;margin:8px auto 2px;display:grid;place-items:center}
.ach-stage .ach-b{width:112px;height:112px;position:relative;z-index:1;animation:achIn .9s cubic-bezier(.34,1.56,.64,1) both;filter:drop-shadow(0 4px 0 rgba(0,0,0,.25))}
.ach-rays{position:absolute;inset:-30px;background:repeating-conic-gradient(rgba(217,166,72,.32) 0 12deg,transparent 12deg 30deg);border-radius:50%;
  -webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);mask:radial-gradient(circle,#000 30%,transparent 70%);animation:achSpin 9s linear infinite,achFade .6s .2s both}
.ach-stage i{position:absolute;left:50%;top:50%;width:6px;height:6px;background:var(--brass);z-index:2;opacity:0;animation:achSpark 1s cubic-bezier(.2,.7,.3,1) .35s both}
.ach-stage i:nth-of-type(odd){background:#fff4ea;width:4px;height:4px}
${Array.from({ length: 10 }, (_, k) => { const ang = k / 10 * Math.PI * 2, d = 62 + (k % 3) * 10; return `.ach-stage i:nth-of-type(${k + 1}){--x:${Math.round(Math.cos(ang) * d)}px;--y:${Math.round(Math.sin(ang) * d)}px;animation-delay:${0.3 + (k % 4) * 0.05}s}`; }).join("\n")}
.ach-tier{display:inline-block;font-family:var(--f-pixel);font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:1px 8px;margin:6px 0 4px;color:#fff4ea;animation:achFade .4s .6s both}
.ach-tier.t1{background:#8f5527}.ach-tier.t2{background:#6b6b66}.ach-tier.t3{background:#9a6a12}
.ach-pop h3{animation:achFade .4s .7s both}
.ach-desc{font-family:var(--f-body);font-size:14px;color:var(--ink-soft);margin:4px 0 0;animation:achFade .4s .8s both}
@keyframes achIn{0%{transform:scale(.2) rotate(-25deg);opacity:0}55%{transform:scale(1.15) rotate(6deg);opacity:1}75%{transform:scale(.95) rotate(-2deg)}100%{transform:none}}
@keyframes achSpin{to{transform:rotate(360deg)}}
@keyframes achFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes achSpark{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(.4)}}
.ach-list{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column}
.ach-row{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--paper-shade)}
.ach-row:last-child{border-bottom:none}
.ach-row .ach-b{width:44px;height:44px}
.ach-row b{display:block;font-family:var(--f-pixel);font-size:15px}
.ach-row span{display:block;font-family:var(--f-body);font-size:12.5px;color:var(--ink-soft)}
.ach-row small{display:block;font-family:var(--f-body);font-size:11px;color:var(--ink-soft);margin-top:2px;text-transform:none}
.ach-row.off b{color:var(--ink-soft)}
.ach-row.off .ach-b{opacity:.55}
.set-ach small{font-family:var(--f-body);font-size:12px;opacity:.7;margin-left:4px}
.ach-bar{height:6px;background:rgba(0,0,0,.08);margin-top:4px}
.ach-bar i{display:block;height:100%;background:var(--brass)}
</style>`);

window.SiatkaAch = { onFinish, open, count };
})();
