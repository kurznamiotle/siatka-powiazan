#!/usr/bin/env node
/*
 * Generuje sprawy i weryfikuje je solverem.
 *   node tools/generate.js                 → test 2000 spraw (wszystkie miasta, lata, wielkości)
 *   node tools/generate.js 12 out          → zapisuje 12 spraw do cases/generated/
 *   node tools/generate.js 12 out poznan 1993 XL → z ustawieniami (miasto, rok, wielkość)
 *   node tools/generate.js verify cases/case_001.json
 */
const fs = require("fs"), path = require("path");
require("../engine/sprites.js");
const S = require("../engine/engine.js");
const WORLD = { base: require("../data/base.js"), cities: require("../data/cities.js") };

const [, , a1, a2, city, year, size] = process.argv;
if (a1 === "verify") {
  const c = JSON.parse(fs.readFileSync(a2, "utf8"));
  const r = S.solve(c);
  console.log(JSON.stringify({ archetype: c.archetype || "classic", solutions: r.solutions, unique: r.unique, necessary: r.necessary, errors: r.errors, ok: r.ok }, null, 2));
  process.exit(r.ok ? 0 : 1);
}
const N = +a1 || 2000;
// archetyp: node tools/generate.js 1000 --arch timeline (bez tego: losowanie z wag)
const archArg = process.argv.indexOf("--arch") > 0 ? process.argv[process.argv.indexOf("--arch") + 1] : undefined;
const opts = { city: city && city !== "--arch" ? city : undefined, year: year && +year ? +year : undefined, size: size || undefined, archetype: archArg };
let fail = 0; const bad = [], out = [];
const stats = { crime: {}, scene: {}, city: {}, size: {}, rules: {}, nodes: {}, archetype: {}, evKind: {}, alibiDoc: {}, evTpl: {}, unusual: {}, depth: {}, tries: 0, depthRej: 0 };
const noInnocentEv = []; // sprawy, w których wszystkie dowody dotyczą sprawcy
const ev = {}; // wielkość → {n, sum, min, need}
/* czy rozwiązanie wymaga faktu z dowodu: bez faktów z dowodów sprawa traci jedno, właściwe rozwiązanie */
const fromEvidence = f => !!f.src || f.type === "evidence" || f.type === "mark";
function needsEvidence(c) {
  if (!c.nodes.some(n => n.type === "evidence")) return false;
  const r = S.solve(c, { skip: fromEvidence });
  return !(r.unique && r.solutions[0].culprit === c.solution.culprit && r.solutions[0].weapon === c.solution.weapon);
}
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
/* Spójność treści: reguła o oknie mówi o czasie, alibi zawodowe pasuje do roli, zdania z `ages` do wieku. */
const B = WORLD.base;
const stem = (t, g) => S.tx(t, g).split(/[{]/)[0].trim(); // stały początek zdania, bez wstawek
/* 2.2.1: kontrole danych (raz) i świadków (każda sprawa): rodzaj poszkodowanego (vt), godziny scen, rodzaje miejsc (pt). */
const staticErrors = [];
{
  const fitsWho = S.util.fitsWho, bad = m => staticErrors.push(m);
  // 1. zdania z vt: wszystkie sceny takiego typu zbrodni mają vt, a każdy rodzaj poszkodowanego ma dość zdań
  for (const [k, c] of Object.entries(B.crimes)) {
    const tagged = ["motives", "suspicion", "noMotive", "letters"].some(l => (c[l] || []).some(o => o && o.vt));
    if (!tagged) continue;
    const untagged = c.scenes.filter(s => !s.vt || !s.vt.length);
    // napad: tylko część scen ma vt (zdania „rent”, „elder” dotyczą dwóch scen), reszta ma pustą listę
    if (k !== "napad" && untagged.length) bad(`${k}: sceny bez vt: ${untagged.map(s => s.title).join(", ")}`);
    for (const cb of new Set(c.scenes.map(s => JSON.stringify(s.vt || [])))) {
      const vt = JSON.parse(cb), n = l => (c[l] || []).filter(o => fitsWho(o, { role: {}, vt })).length;
      if (n("suspicion") < 6 || n("noMotive") < 6 || n("motives") < 2) bad(`${k} ${cb}: za mało zdań (motywy ${n("motives")}, podejrzenia ${n("suspicion")}, bez motywu ${n("noMotive")})`);
      if ((c.letters || []).length && !(c.letters || []).some(o => fitsWho(o, { role: {}, vt }))) bad(`${k} ${cb}: brak dowodu z motywem dla tego poszkodowanego`);
    }
  }
  // 2. godziny scen: okno mieści się w wieczorze (teksty mówią „tego wieczoru”) i daje co najmniej jedną godzinę (krok 30 min)
  for (const [k, c] of Object.entries(B.crimes)) for (const s of c.scenes) if (s.time) {
    const a = S.util.toMin(s.time[0]), b = S.util.toMin(s.time[1]);
    if (a < 16 * 60 + 30 || b > 23 * 60 + 30 || b - a < 30) bad(`${k}/${s.title}: godziny sceny ${s.time} poza 16:30–23:30 albo za wąskie`);
  }
  // 3. rodzaje miejsc: każde miejsce ma pt, a każdy pt dość szablonów świadków i dowodów
  const PT = ["street", "yard", "field", "shop", "stair", "cellar", "work"];
  const locs = [...B.locations, ...Object.values(WORLD.cities).flatMap(ct => ct.locations || [])];
  for (const l of locs) if (!PT.includes(l.pt)) bad(`miejsce ${l.id}: brak albo zły rodzaj miejsca pt (${l.pt})`);
  for (const pt of PT) {
    const n = (list, f = S.util.fitsAt) => list.filter(o => f(o, pt)).length;
    if (pt !== "stair" && n(B.presenceTpl) < 5) bad(`świadkowie (presenceTpl) dla ${pt}: ${n(B.presenceTpl)} szablonów`);
    if (n(B.timeline.obsTpl) < (pt === "stair" ? 2 : 4)) bad(`świadkowie osi czasu dla ${pt}: ${n(B.timeline.obsTpl)} szablonów`);
    if (n(B.timeline.evidence) < 1) bad(`dowody osi czasu dla ${pt}: brak`);
    if (pt !== "stair" && n(B.evidence.presence) < 2) bad(`zapiski obecności dla ${pt}: ${n(B.evidence.presence)}`);
  }
}
/* świadek pasuje do miejsca: szablon z `at` nie może trafić do miejsca innego rodzaju */
const ptOfIn = {}; for (const l of [...B.locations, ...Object.values(WORLD.cities).flatMap(ct => ct.locations || [])]) ptOfIn[l.in] = l.pt;
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, m => "\\" + m);
const toRe = t => new RegExp(t.split(/(\[[^\]]+\]|\{in\}|\{t\})/).map(p => p === "{in}" ? "(.+?)" : p === "{t}" ? "\\d+:\\d\\d" : /^\[.*\]$/.test(p) ? "(?:" + p.slice(1, -1).split("|").map(esc).join("|") + ")" : esc(p)).join(""));
const witnessTpl = [...B.presenceTpl, ...B.timeline.obsTpl].filter(o => typeof o === "object" && o.at).map(o => ({ o, re: toRe(o.t) }));
function witnessCheck(c) {
  for (const n of c.nodes.filter(n => n.type === "person")) for (const { o, re } of witnessTpl) {
    const m = n.text.join(" ").match(re);
    if (m && ptOfIn[m[1]] && !o.at.includes(ptOfIn[m[1]])) incoherent.push([c.seed, `świadek nie pasuje do miejsca (${ptOfIn[m[1]]}): ${m[0]}`]);
  }
}
const workAlibi = B.alibiConfirmed.filter(a => a.roles);
/* Teksty z ograniczeniem (ages, k, roles, trait): zdania cech, nawyki, smaczki, motywy, ramy alibi, mieszkanie.
   Silnik filtruje je przez fitsWho; tu sprawdzamy gotowy tekst, czy żaden nie trafił do niepasującej osoby. */
const CITIES = Object.values(WORLD.cities);
const factsOf = t => !t.facts ? [] : Array.isArray(t.facts) ? t.facts : Object.values(t.facts).flat();
const crimeTexts = Object.values(B.crimes).flatMap(cr => [...cr.suspicion, ...cr.noMotive, ...cr.motives]);
const allRoleDefs = [...B.roles, ...CITIES.flatMap(ct => [...(ct.roles || []), ct.worker])];
const limited = [...Object.values(B.traits).flatMap(factsOf), ...Object.values(B.habits).flat(), ...B.eraFlavor, ...CITIES.flatMap(ct => ct.flavor || []),
  ...allRoleDefs.flatMap(r => r.flavor || []), ...crimeTexts, ...B.flatTpl, ...B.claimFrame]
  .filter(o => typeof o === "object" && o.t && (o.ages || o.k || o.roles || o.trait || o.vt));
const limitedAlibi = B.alibiConfirmed.filter(a => a.k);
/* siatka bezpieczeństwa: słowa, które nie mogą paść w teczce danej roli, nawet w tekście bez tagu */
const NOJOB = /zwolni(ł|ła|ć)\b|zwolnion|zwolnienie (z pracy|dyscyplinarne)|wymówieni|\bz pracy\b|\bw pracy\b|\bDo pracy\b|pensj|podwyżk|premi[ęai]\b|razem z pracą/i;
const ROLE_FORBID = {
  licealista: new RegExp(NOJOB.source + /|komornik|\bdług(i|ów|ach|u)\b(?! Targ)|lombard|weksel|na raty|czynsz|zaleg|Jeździ (Polonezem|Żukiem|Golfem|nowiutkim)|Ma Malucha|swoje(go)? (auto|aucie)|swojego (auta|samochodu)|swoją Syrenkę|Cinquecento|na wyborach/.source, "i"),
  weterynarz: /alergi\S* na sierść|boi się (psów|od dziecka)|Psów boi|na widok (cudzego )?psa/i,
  student: NOJOB,
  emeryt: NOJOB, kombatant: NOJOB, gospodyni: NOJOB,
  // 2.2: role, które jeżdżą zawodowo, nie mogą nie mieć auta ani nie umieć jeździć; opiekun w zoo bez lęku przed psami
  ...Object.fromEntries(["mechanik", "taksowkarz", "kierowca", "cpn"].map(r => [r, /prawa jazdy|nie umie jeździć|nauczył\S* się prowadzić|boi się samochodów|[Ss]amochodu nie ma|[Aa]uta nie ma|samochodu nigdy nie|żadnego nie ma|z pojazdów ma tylko rower/])),
  zoo: /alergi\S* na sierść|boi się (psów|od dziecka)|Psów boi|na widok (cudzego )?psa/i,
  bezrobotny: /Ma (stałą|dobrą) pracę|pensj|podwyżk|Zarabia w markach|\bDo pracy\b|\bw pracy\b/i
};
/* smaczki ról: zdanie z flavor jednej roli nie może trafić do teczki innej roli */
const roleFlavor = new Map();
for (const r of allRoleDefs) for (const o of r.flavor || []) { const t = typeof o === "string" ? o : o.t; roleFlavor.set(t, new Set([...(roleFlavor.get(t) || []), r.id])); }
/* kartki na mięso zniesiono 31 lipca 1989: kartki (na mięso, cukier, buty) tylko styczeń–lipiec 1989 */
const KARTKI = /[Kk]art(ki|ek|kach|kami) na (mięso|cukier|buty)|[Kk]artki na cukier/;
const incoherent = [];
/* 2.1.2: nikt nie jest w dwóch miejscach naraz (< 15 min) ani w trakcie własnego alibi (sprawdzane na gotowych faktach) */
const tm = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
function noDoubleBooking(c) {
  const crimeFrom = tm(c.time.crime.from);
  for (const id of new Set(c.facts.filter(f => f.type === "presence" || f.type === "roster_entry").map(f => f.who))) {
    const ps = c.facts.filter(f => (f.type === "presence" || f.type === "roster_entry") && f.who === id), al = c.facts.find(f => f.type === "alibi" && f.who === id);
    for (let i = 0; i < ps.length; i++) {
      const t = tm(ps[i].at);
      if (al && t >= crimeFrom - 10) incoherent.push([c.seed, `${id}: obecność ${ps[i].at} w trakcie alibi`]);
      else if (al && al.confirmed && t >= tm(al.from) && t <= tm(al.to)) incoherent.push([c.seed, `${id}: obecność ${ps[i].at} w trakcie alibi ${al.from}–${al.to}`]);
      for (let j = i + 1; j < ps.length; j++) if (ps[i].where !== ps[j].where && Math.abs(t - tm(ps[j].at)) < 15) incoherent.push([c.seed, `${id}: w dwóch miejscach naraz (${ps[i].where}@${ps[i].at}, ${ps[j].where}@${ps[j].at})`]);
    }
  }
}
const hStats = {}, cmpStats = { n: 0, sum: 0, up: 0 };
function coherence2(c) {
  const bad = what => incoherent.push([c.seed, what]);
  const persons = c.nodes.filter(n => n.type === "person"), tr = (id, t) => (c.facts.find(f => f.type === "trait" && f.who === id && f.trait === t) || {}).value;
  // wzrost: w realnym zakresie dla płci, a opis (wysoki/niski/średni) wynika z liczby
  for (const p of persons) {
    const cm = tr(p.id, "height_cm"), h = tr(p.id, "height"), H = S.util.HEIGHT[p.g];
    if (cm == null || cm < H.lo || cm > H.hi || S.util.heightClass(p.g, cm) !== h) bad(`${p.id}: wzrost ${cm} cm nie pasuje do „${h}” (${p.g})`);
    if (cm != null) (hStats[p.g] = hStats[p.g] || []).push(cm);
    const m = p.text.join(" ").match(/(\d{3}) cm/); if (m && +m[1] !== cm) bad(`${p.id}: w teczce ${m[1]} cm, w faktach ${cm}`);
  }
  for (const r of c.rules) {
    if (r.type === "cmp") {
      if (persons.some(p => p.name === r.refName)) bad("porównanie: miarą jest podejrzany");
      const cms = persons.map(p => tr(p.id, "height_cm"));
      if (cms.some(v => Math.abs(v - r.refCm) <= 3)) bad(`porównanie: ktoś z podejrzanych w promieniu 3 cm od miary ${r.refCm}`);
      const pass = v => r.dir === "down" ? v < r.refCm : v > r.refCm;
      if (!pass(tr(c.solution.culprit, "height_cm"))) bad("porównanie: sprawca nie spełnia reguły");
      const nf = persons.filter(p => !pass(tr(p.id, "height_cm"))).length;
      if (nf < (c.size === "L" || c.size === "XL" ? 2 : 1)) bad(`porównanie odcina tylko ${nf} podejrzanych`);
      cmpStats.n++; cmpStats.sum += nf; cmpStats.up += r.dir === "up" ? 1 : 0;
      if (/samego siebie/.test(c.why.map(w => w.join(" ")).join(" "))) bad("porównanie: „nikt nie jest wyższy od samego siebie”");
    }
    if (r.type === "relation") {
      if (persons.some(p => p.name === r.refName)) bad("relacja: osoba-odniesienie jest podejrzanym");
      const rel = c.facts.filter(f => f.type === "relation" && f.b === r.refName);
      if (rel.length < (c.size === "L" || c.size === "XL" ? 3 : 2)) bad(`relacja: nazwisko ${r.refName} tylko w ${rel.length} teczkach`);
      if (new Set(rel.map(f => f.rel)).size < 2) bad("relacja: wszyscy mają tę samą relację");
      if (rel.every(f => f.a === c.solution.culprit || f.rel !== r.rel)) bad("relacja: relacja z reguły tylko u sprawcy");
    }
    if (r.type === "absent") {
      const on = c.facts.filter(f => f.type === "roster_entry").length;
      if (on > Math.max(1, Math.floor((persons.length - 1) / 2))) bad(`zeszyt dozorcy eliminuje ${on} z ${persons.length - 1} niewinnych`);
      // jedynym źródłem wiedzy dozorcy jest zeszyt z reguły: bez dowodu „Zeszyt dozorcy” i bez świadków-dozorców w teczkach
      // obecność z godziną od dozorcy (np. dowód „Zeszyt dozorcy”); książka wydań kluczy sprzed miesiąca nie koliduje
      const presEv = new Set(c.facts.filter(f => f.type === "evidence" && f.kind === "presence").map(f => f.id));
      if (c.nodes.some(n => presEv.has(n.id) && /dozorc/i.test(n.name + " " + n.text.join(" ")))) bad("zeszyt dozorcy: dowód obecności od dozorcy w sprawie z listą");
      for (const p of persons) {
        const own = c.facts.filter(f => f.type === "roster_entry" && f.who === p.id).map(f => f.at);
        for (const line of p.text) if (/dozorc/i.test(line) && /\d:\d\d/.test(line) && !own.some(t => line.includes(t))) bad(`zeszyt dozorcy: świadek-dozorca w teczce ${p.id}: ${line}`);
      }
    }
  }
}
/* 2.2: oś czasu. Liczba obserwacji nie zależy od winy, a co najmniej 1 (L–XL: 2) niewinnych bez trasy
   ma „prawie lukę” (brakuje im najwyżej 5 min). Statystyki w tl. */
const tl = { n: 0, obsC: 0, obsI: 0, nI: 0, traps: {}, open: {}, stay: 0, stayHist: {} };
function timelineCheck(c) {
  if (c.archetype !== "timeline") return;
  const bad = what => incoherent.push([c.seed, what]);
  const r = c.rules.find(r => r.type === "reach"), A = tm(r.from), B = tm(r.to), X = r.where;
  const tr = {}; for (const f of c.facts.filter(f => f.type === "travel")) { tr[f.a + "|" + f.b] = f.min; tr[f.b + "|" + f.a] = f.min; }
  const d = (a, b) => a === b ? 0 : tr[a + "|" + b];
  let traps = 0, open = 0;
  for (const p of c.nodes.filter(n => n.type === "person")) {
    const obs = c.facts.filter(f => f.type === "presence" && f.who === p.id).map(f => ({ w: f.where, t: tm(f.at) })).sort((a, b) => a.t - b.t);
    if (p.id === c.solution.culprit) tl.obsC += obs.length; else { tl.obsI += obs.length; tl.nI++; }
    if (obs.some(o => o.w === X)) bad(p.id + ": obserwacja na miejscu zdarzenia");
    // najmniejszy brak czasu w luce wokół okna (ujemny = zapas)
    // najdłuższy możliwy pobyt na miejscu w oknie; brak = wymagany pobyt − ten czas (ujemny = zapas)
    let len = Math.max(Math.min(obs[0].t - d(X, obs[0].w), B) - A, B - Math.max(obs[obs.length - 1].t + d(obs[obs.length - 1].w, X), A));
    for (let i = 0; i + 1 < obs.length; i++) len = Math.max(len, Math.min(obs[i + 1].t - d(X, obs[i + 1].w), B) - Math.max(obs[i].t + d(obs[i].w, X), A));
    const def = (r.stay || 0) - len;
    if (p.id === c.solution.culprit) { tl.stay += len; inc(tl.stayHist, len); if (len < (r.stay || 0)) bad("oś czasu: sprawca nie ma wymaganego pobytu"); }
    if (def <= 0) open++;
    else if (def <= 5) traps++;
  }
  tl.n++; inc(tl.traps, traps); inc(tl.open, open);
  if (traps < (c.size === "M" ? 1 : 2)) bad(`oś czasu: tylko ${traps} pułapek (brak ≤ 5 min)`);
  if (open < 2) bad("oś czasu: trasę ma tylko sprawca");
  if (!r.stay || !/co najmniej \d+ minut/.test(r.text)) bad("oś czasu: reguła bez minimalnego pobytu");
  if (/od (\d+:\d\d) do \1/.test(c.why.map(w => w.join(" ")).join(" "))) bad("oś czasu: zerowy pobyt w wyjaśnieniu");
}
function coherence(c) {
  noDoubleBooking(c); coherence2(c); timelineCheck(c);
  // testament na kogoś innego niż sprawca nie idzie w parze z epilogiem o spadku albo mieszkaniu po ofierze
  for (const e of c.facts.filter(f => f.type === "evidence" && f.kind === "trait:motive" && f.owner !== c.solution.culprit)) {
    const n = c.nodes.find(x => x.id === e.id);
    if (n && /testament/i.test(n.name) && /spadek|mieszkanie ofiary/i.test(c.epilogue)) incoherent.push([c.seed, "epilog o spadku mimo testamentu na inną osobę: " + c.epilogue]);
  }
  const city = WORLD.cities[c.city];
  const roleDef = id => [...B.roles, ...(city.roles || []), city.worker].find(r => r.id === id);
  const traitsOf = id => Object.fromEntries(c.facts.filter(f => f.type === "trait" && f.who === id).map(f => [f.trait, f.value]));
  const persons = c.nodes.filter(n => n.type === "person");
  const sceneVt = (B.crimes[c.crime].scenes.find(s => s.title === c.used.scenes[0]) || {}).vt;
  const whoOf = (n, k) => ({ age: n.age, role: roleDef(c.used.roles[k]), traits: traitsOf(n.id), vt: sceneVt });
  const bad = (what) => incoherent.push([c.seed, what]);
  // dokument „z innego dnia” nie może jednocześnie mówić o „tamtym wieczorze”
  for (const n of c.nodes.filter(n => n.type === "evidence")) { const t = n.text.join(" "); if (/tamt/i.test(t) && B.docOtherDay.some(d => t.includes(d))) bad("dokument z innego dnia o tamtym wieczorze: " + n.name); }
  // realia miesięcy i gramatyka całej sprawy (cały tekst widoczny dla gracza)
  const all = JSON.stringify([c.title, c.intro, c.epilogue, c.nodes.map(n => [n.name, n.text]), c.rules.map(r => r.text), c.why]);
  const mIdx = B.months.indexOf(c.month);
  if (c.year === 1989 && mIdx >= 7 || c.year > 1989) { const m = all.match(KARTKI); if (m) bad(`kartki po lipcu 1989 (${c.month} ${c.year}): ${m[0]}`); }
  if (c.year === 1989 && mIdx < 6 && /w czerwcu skreślał/.test(all)) bad(`wybory czerwcowe przed czerwcem 1989 (${c.month})`);
  { const m = all.match(/(żądaniem|zażądał[a]?|chce|nie dostanie) \d+ (tysiące|tysiąc|miliony|milion) /); if (m) bad("kwota nie w dopełniaczu: " + m[0]); }
  // „zajrzał” wymaga kierunku („do”, „na”), a {in} daje miejscownik („w kiosku”, „na zapleczu”)
  { const m = all.match(/zajrzał[a]? (\S+ )?(w|we|na) [^ ,.]+(u|iu|e|ni|ce|dzie|ach)\b/); if (m) bad("„zajrzał” z miejscownikiem: " + m[0]); }
  for (const r of c.rules) if (r.type === "window" && !/gdy [^.]*znik/.test(r.text)) bad("okno bez czasu: " + r.text);
  persons.forEach((n, k) => {
    const role = c.used.roles[k], txt = n.text.join(" "), W = whoOf(n, k);
    for (const a of workAlibi) if (!a.roles.includes(role) && txt.includes(stem(a.text, n.g))) bad(`${role} z cudzym alibi: ${stem(a.text, n.g)}`);
    for (const a of limitedAlibi) if (!S.util.fitsWho({ k: a.k }, W) && txt.includes(stem(a.text, n.g))) bad(`${role}: alibi nie dla tej roli: ${a.text}`);
    for (const o of limited) { const st = stem(o.t, n.g); if (st.length >= 15 && txt.includes(st) && !S.util.fitsWho(o, W)) bad(`${role}/${n.age}: ${o.t}`); }
    if (ROLE_FORBID[role] && ROLE_FORBID[role].test(txt)) bad(`${role}: ${txt.match(ROLE_FORBID[role])[0]} w teczce`);
    if (W.role && W.role.need) for (const [t, v] of Object.entries(W.role.need)) if (W.traits[t] !== v) bad(`${role} z cechą ${t}=${W.traits[t]}`);
    for (const [ft, ids] of roleFlavor) { const st = stem(ft, n.g); if (!ids.has(role) && st.length >= 15 && txt.includes(st)) bad(`${role} ze smaczkiem roli ${[...ids].join("/")}: ${ft}`); }
  });
  // dowody z motywem i epilog też muszą pasować do właściciela / sprawcy
  const crime = B.crimes[c.crime];
  for (const f of c.facts.filter(f => f.type === "evidence")) {
    const k = persons.findIndex(n => n.id === f.owner), n = persons[k], node = c.nodes.find(x => x.id === f.id), W = whoOf(n, k);
    const def = f.kind === "trait:motive" ? crime.letters.find(l => l.name === node.name) : null;
    if (def && !S.util.fitsWho(def, W)) bad(`${c.used.roles[k]}: dowód z motywem nie dla tej roli: ${def.name}`);
    if (ROLE_FORBID[c.used.roles[k]] && ROLE_FORBID[c.used.roles[k]].test(node.text.join(" "))) bad(`${c.used.roles[k]}: dowód „${node.name}” nie pasuje do roli`);
  }
  const ck = persons.findIndex(n => n.id === c.solution.culprit), CW = whoOf(persons[ck], ck);
  for (const o of crime.motives) { const t = typeof o === "string" ? o : o.t; if (typeof o === "object" && c.epilogue.includes(stem(t, persons[ck].g)) && !S.util.fitsWho(o, CW)) bad(`${c.used.roles[ck]}: motyw w epilogu: ${t}`); }
  // opis sprawy (intro) i reguły nie mogą nazywać narzędzia, którego nie ma wśród kandydatów w sprawie (np. „sznurem” przy przedłużaczu)
  {
    const TOOLWORDS = [ // [rdzeń w tekście, nazwa przedmiotu, który pasuje do tego słowa]
      [/sznur|powróz/i, /sznur|lin[ak]|szpagat/i], [/n[oó]ż|nożem|nożyk/i, /nóż|nożyk/i], [/młot/i, /młot/i], [/łom/i, /łom/i], [/siekier|topor/i, /siekier/i],
      [/brzytw/i, /brzytw/i], [/widł/i, /widł/i], [/obcęg|przecinak/i, /obcęg|przecinak/i], [/śrubokręt/i, /śrubokręt/i], [/nożyc|nożyczk/i, /nożyc|nożyczk/i],
      [/benzyn/i, /benzyn/i], [/nafty|naftą/i, /naft/i], [/farb/i, /farb|pędzel|spray/i], [/pędzel|pędzlem/i, /pędzel/i],
      [/przeci[ąę]|przecięt/i, /przecinak|nożyc|nożyk|nóż|obcęg|piłk|sekator|brzytw|żyletk|dłuto|widł|bosak|hak|siekier/i], [/rozkr[ęe]c|odkr[ęe]c/i, /klucz|śrubokręt|obcęg/i],
    ];
    const cands = c.nodes.filter(n => n.type === "item").map(n => n.name);
    const texts = [c.intro, ...(c.rules || []).map(r => r.text)].filter(Boolean).join(" ");
    for (const [re, ok] of TOOLWORDS) if (re.test(texts)) for (const nm of cands) if (!ok.test(nm)) bad(`opis nazywa narzędzie (${re}), a kandydatem jest „${nm}”`);
  }
  // przedmioty w liczbie mnogiej: „zniknęły”, „znalezione”, „odniesione”, „je”
  for (const n of c.nodes.filter(n => n.type === "item")) {
    const t = n.text.join(" ");
    if (n.g === "pl" && (!/Zniknęły/.test(t) || /\b(Zniknął|Zniknęła|Zniknęło|Znaleziony|Znaleziona|Wyłowiony|Wyłowiona|Odniesiony|Odniesiona|odnaleziony|odnaleziona)\b|Kto (go|ją) przyniósł/.test(t))) bad("liczba mnoga: " + n.name + ": " + t);
    if (n.g !== "pl" && /Zniknęły/.test(t)) bad("liczba pojedyncza z „zniknęły”: " + n.name);
  }
  for (const [, w] of c.why) for (const n of c.nodes.filter(n => n.type === "item" && n.g === "pl")) if (w.includes(n.name.toLowerCase()) && /gdzie (go|ją) znaleziono/.test(w)) bad("liczba mnoga w wyjaśnieniu: " + w);
  // w jednej sprawie nie ma dwóch dowodów z tego samego szablonu
  const evNames = c.nodes.filter(n => n.type === "evidence").map(n => n.name);
  if (new Set(evNames).size !== evNames.length) bad("dwa dowody z jednego szablonu: " + evNames.join(", "));
}
/* szablony dowodów: co najmniej 3 na rodzaj (obecność, klucze, każda cecha z dowodem, listy z motywem w każdej zbrodni, dokumenty alibi) */
const tplKinds = { presence: B.evidence.presence, keys: B.evidence.keys, alibi: B.alibiConfirmed.filter(a => a.doc).map(a => a.doc),
  ...Object.fromEntries(Object.entries(B.traits).filter(([, t]) => t.evidence).map(([k, t]) => ["trait:" + k, t.evidence])),
  ...Object.fromEntries(Object.entries(B.crimes).map(([k, cr]) => ["trait:motive/" + k, cr.letters])) };
const tplFew = Object.entries(tplKinds).filter(([, l]) => new Set(l.map(d => d.name)).size < 3).map(([k, l]) => `${k} (${l.length})`);
/* 2.2: w danych każde pole `t` jest napisem (zagnieżdżone {t:{t:…}} dawało w teczce „object Object”) */
const badT = [];
(function walk(o, p) {
  if (!o || typeof o !== "object") return;
  if (!Array.isArray(o) && "t" in o && typeof o.t !== "string") badT.push(p);
  for (const [k, v] of Object.entries(o)) walk(v, p + "." + k);
})({ base: WORLD.base, cities: WORLD.cities }, "");
if (badT.length) console.log("BŁĄD: pole t nie jest napisem:", badT.slice(0, 5));
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  let c;
  try { c = S.generateCase(WORLD, "test-" + i, archArg === "timeline" && !opts.size ? Object.assign({}, opts, { size: ["M", "L", "XL"][i % 3] }) : opts); } catch (e) { fail++; if (fail < 4) console.log(e.message); continue; }
  inc(stats.crime, c.crime); inc(stats.scene, c.crime + ": " + c.used.scenes[0]); inc(stats.city, c.city); inc(stats.size, c.size); inc(stats.rules, c.rules.length + " reguł");
  inc(stats.nodes, `${c.nodes.filter(n => n.type === "person").length} os. / ${c.nodes.filter(n => n.type === "item").length} przedm.`);
  inc(stats.archetype, c.archetype);
  // 2.2: reguły nietypowe i głębokość
  const unu = c.rules.filter(r => ["cmp", "relation", "absent"].includes(r.type) || r.trait === "known").map(r => r.trait === "known" ? "known" : r.type);
  inc(stats.unusual, unu.length + " nietyp."); for (const u of unu) inc(stats.unusual, u);
  const uMax = c.size === "S" || c.size === "M" ? 1 : 2;
  if (unu.length > uMax) incoherent.push([c.seed, `${unu.length} reguł nietypowych w ${c.size}`]);
  if (c.verify && c.verify.depth) {
    const d = stats.depth[c.archetype + " " + c.size] = stats.depth[c.archetype + " " + c.size] || { n: 0, sum: 0, hist: {}, sr: {}, sf: {} };
    d.n++; d.sum += c.verify.depth.minFacts; inc(d.hist, c.verify.depth.minFacts); inc(d.sr, c.verify.depth.strongRule); inc(d.sf, c.verify.depth.strongFact);
    stats.tries += c.verify.tries; stats.depthRej += c.verify.depthRejects;
  }
  const nEv = c.nodes.filter(n => n.type === "evidence").length, e = ev[c.size] = ev[c.size] || { n: 0, sum: 0, min: 99, need: 0 };
  if (c.archetype === "classic") { e.n++; e.sum += nEv; e.min = Math.min(e.min, nEv); if (needsEvidence(c)) e.need++; } // progi etapu 1 tylko dla classic
  for (const x of c.facts.filter(x => x.type === "evidence")) {
    inc(stats.evKind, x.kind); if (x.kind === "alibi") inc(stats.alibiDoc, x.lie ? "obala (" + x.lie + ")" : "potwierdza");
    const tk = x.kind === "trait:motive" ? "trait:motive/" + c.crime : x.kind;
    inc(stats.evTpl[tk] = stats.evTpl[tk] || {}, c.nodes.find(n => n.id === x.id).name);
  }
  const evF = c.facts.filter(x => x.type === "evidence");
  if (evF.length && evF.every(x => x.owner === c.solution.culprit)) noInnocentEv.push(c.seed);
  const allText = [c.title, c.intro, c.epilogue, c.quip, c.detective, ...c.rules.map(r => r.text), ...c.hints, ...c.why.map(w => w.join(" ")),
    ...c.nodes.flatMap(n => [n.kind, ...n.text])].join("\n");
  // 2.2: też „object Object” (obiekt zamiast napisu: nawiasy „[object Object]” zjada odmiana [m|f]) i nazwy węzłów
  const leftover = [allText, ...c.nodes.flatMap(n => [n.name, n.label])].join("\n").match(/[\[\]{}]|undefined|null|NaN|object Object|\[object|(?<!\.)\.\.(?!\.)/g); // też podwójna kropka
  if (leftover) bad.push([c.seed, leftover.slice(0, 5)]);
  coherence(c);
  witnessCheck(c);
  out.push(c);
}
console.log(`Niespójności treści (okno bez czasu, cudze alibi zawodowe, zdanie nie na wiek/rolę/cechę, obcy smaczek roli, liczba mnoga, powtórzony szablon dowodu, dokument z innego dnia, osoba w dwóch miejscach naraz albo w trakcie alibi): ${incoherent.length}`);
if (incoherent.length) console.log(incoherent.slice(0, 5));
if (staticErrors.length) console.log(`Błędy danych (vt, godziny scen, rodzaje miejsc): ${staticErrors.length}`, staticErrors);
console.log(`Wygenerowano ${N - fail}/${N} spraw w ${Date.now() - t0} ms. Błędów generatora: ${fail}. Spraw z niewypełnionym tekstem: ${bad.length}`);
if (bad.length) console.log(bad.slice(0, 5));
console.log("Miasta:", stats.city);
console.log("Wielkości:", stats.size);
console.log("Obsada:", stats.nodes);
console.log("Reguły:", stats.rules);
/* rozkład typów zbrodni i scen (etap 11): typy po równo (±3 p.p. od równego udziału), żadna scena powyżej 2% */
const nOk = N - fail, pct = v => 100 * v / Math.max(1, nOk);
const crimeIds = archArg === "timeline" ? ["zabojstwo", "kradziez", "napad", "podpalenie", "wandalizm", "porwanie_psa", "sabotaz", "otrucie"] : Object.keys(WORLD.base.crimes), fair = 100 / crimeIds.length;
console.log("Zbrodnie (%):", Object.fromEntries(crimeIds.map(k => [k, +pct(stats.crime[k] || 0).toFixed(1)])), `· równy udział ${fair.toFixed(1)}%`);
const crimeOff = crimeIds.filter(k => Math.abs(pct(stats.crime[k] || 0) - fair) > 3);
const scenes = Object.entries(stats.scene).sort((a, b) => b[1] - a[1]);
const allScenes = crimeIds.reduce((n, k) => n + WORLD.base.crimes[k].scenes.length, 0);
console.log(`Sceny: ${scenes.length} z ${allScenes} użyte, najczęstsze:`, scenes.slice(0, 3).map(([k, v]) => `${k} ${pct(v).toFixed(2)}%`).join(" · "));
const sceneOver = scenes.filter(([, v]) => pct(v) > 2);
const distFail = nOk >= 1000 && (crimeOff.length > 0 || sceneOver.length > 0);
if (distFail) console.log("BŁĄD: rozkład zbrodni albo scen", { crimeOff, sceneOver: sceneOver.slice(0, 5) });
console.log("Archetypy:", stats.archetype);
console.log("Reguły nietypowe:", stats.unusual);
for (const g of Object.keys(hStats)) { const a = hStats[g].slice().sort((x, y) => x - y), q = p => a[Math.floor(p * (a.length - 1))];
  console.log(`Wzrost (${g}): ${a.length} osób, min ${a[0]}, 10% ${q(.1)}, mediana ${q(.5)}, 90% ${q(.9)}, max ${a[a.length - 1]}, średnio ${(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1)} cm`); }
if (cmpStats.n) console.log(`Porównanie wzrostu: ${cmpStats.n} spraw, odcina średnio ${(cmpStats.sum / cmpStats.n).toFixed(2)} podejrzanych, „wyższy” w ${Math.round(100 * cmpStats.up / cmpStats.n)}%`);
if (tl.n) console.log(`Oś czasu: ${tl.n} spraw, obserwacji na osobę: sprawca ${(tl.obsC / tl.n).toFixed(2)}, niewinni ${(tl.obsI / Math.max(1, tl.nI)).toFixed(2)}; pułapki na sprawę ${JSON.stringify(tl.traps)}; osób z trasą ${JSON.stringify(tl.open)}; pobyt sprawcy średnio ${(tl.stay / tl.n).toFixed(1)} min, rozkład ${JSON.stringify(tl.stayHist)}`);
console.log(`Odrzucone próby generatora: ${(100 * (1 - nOk / Math.max(1, stats.tries))).toFixed(1)}%, w tym przez głębokość: ${(100 * stats.depthRej / Math.max(1, stats.tries)).toFixed(1)}%`);
console.log("Głębokość (min. liczba faktów do rozwiązania; najsilniejsza reguła / fakt = ilu niewinnych odcina sama):");
for (const k of Object.keys(stats.depth).sort()) { const d = stats.depth[k];
  console.log(`  ${k}: śr. ${(d.sum / d.n).toFixed(1)}, rozkład ${JSON.stringify(d.hist)}, reguła ${JSON.stringify(d.sr)}, fakt ${JSON.stringify(d.sf)}`); }
console.log("Rodzaje dowodów:", stats.evKind);
const ad = stats.alibiDoc, adAll = Object.values(ad).reduce((a, b) => a + b, 0), adLie = adAll - (ad.potwierdza || 0);
console.log(`Dokumenty alibi: ${JSON.stringify(ad)}, obalają ${(100 * adLie / Math.max(1, adAll)).toFixed(1)}%`);
console.log(`Sprawy z dowodami, w których żaden dowód nie dotyczy niewinnego: ${noInnocentEv.length}`);
/* rozkład szablonów dowodów: każdy rodzaj, ile razy padł każdy szablon (dokumenty alibi: 8 najczęstszych) */
console.log("Szablony dowodów (rodzaj: szablon × liczba):");
for (const k of Object.keys(tplKinds).sort()) {
  const used = Object.entries(stats.evTpl[k] || {}).sort((a, b) => b[1] - a[1]), all = new Set(tplKinds[k].map(d => d.name)).size;
  const shown = k === "alibi" ? used.slice(0, 8) : used;
  console.log(`  ${k} [${used.length}/${all} użyte]: ${shown.map(([n, v]) => `${n} ${v}`).join(" · ")}${shown.length < used.length ? " · …" : ""}`);
}
if (tplFew.length) console.log("BŁĄD: mniej niż 3 szablony dowodu:", tplFew);
const all = Object.values(ev).reduce((a, e) => ({ n: a.n + e.n, sum: a.sum + e.sum, need: a.need + e.need }), { n: 0, sum: 0, need: 0 });
console.log("Dowody rzeczowe:", Object.fromEntries(Object.entries(ev).map(([k, e]) => [k, `śr. ${(e.sum / e.n).toFixed(2)}, min ${e.min}, wymaga dowodu ${Math.round(100 * e.need / e.n)}%`])));
const evAvg = all.sum / Math.max(1, all.n), needPct = 100 * all.need / Math.max(1, all.n);
console.log(`Dowody razem: średnio ${evAvg.toFixed(2)} na sprawę, rozwiązanie wymaga dowodu w ${needPct.toFixed(1)}% spraw`);
// progi z etapu 1: średnio min. 1 dowód, w XL min. 3, w co najmniej 60% spraw dowód jest potrzebny
// progi etapu 1 dotyczą spraw classic (oś czasu ma mniej dowodów: obserwacje z godziną)
const evFail = archArg !== "timeline" && all.n >= 200 && (evAvg < 1 || needPct < 60 || (ev.XL && ev.XL.min < 3));
if (evFail) console.log("BŁĄD: dowody rzeczowe poniżej progów etapu 1");
console.log("Unikalnych obsad:", new Set(out.map(c => c.nodes.filter(n => n.type === "person").map(n => n.name).sort().join())).size);
/* opts.avoid: seria spraw z archiwum jak u gracza (okno ostatnich S.RECENT spraw).
   Liczymy, jaka część imion, ról i scen nowej sprawy powtarza się z tego okna, bez avoid i z avoid. */
function repeats(useAvoid, n = 300) {
  const recent = [], hit = { names: [0, 0], roles: [0, 0], scenes: [0, 0] };
  for (let i = 0; i < n; i++) {
    const avoid = S.avoidFrom(recent);
    const c = S.generateCase(WORLD, "seria-" + i, Object.assign({}, opts, archArg === "timeline" && !opts.size ? { size: ["M", "L", "XL"][i % 3] } : {}, useAvoid ? { avoid } : {}));
    for (const k in hit) { const seen = new Set(avoid[k] || []); hit[k][0] += c.used[k].filter(x => seen.has(x)).length; hit[k][1] += c.used[k].length; }
    recent.push(c.used); if (recent.length > S.RECENT) recent.shift();
  }
  return Object.fromEntries(Object.entries(hit).map(([k, [a, b]]) => [k, +(100 * a / b).toFixed(1)]));
}
const rep0 = repeats(false), rep1 = repeats(true);
console.log(`Powtórki z ostatnich ${S.RECENT} spraw (%): bez avoid`, rep0, "· z avoid", rep1);
const avoidFail = N >= 200 && Object.keys(rep1).some(k => rep1[k] > rep0[k]);
if (avoidFail) console.log("BŁĄD: avoid nie zmniejsza powtórek");
if (a2 === "out") {
  const dir = path.join(__dirname, "..", "cases", "generated");
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  out.forEach((c, i) => fs.writeFileSync(path.join(dir, `gen_${String(i + 1).padStart(3, "0")}_${c.city}_${c.year}_${c.size}.json`), JSON.stringify(c, null, 2)));
  console.log("Zapisano do", dir);
}
if (badT.length || fail || bad.length || evFail || avoidFail || distFail || incoherent.length || staticErrors.length || noInnocentEv.length || tplFew.length) process.exit(1);
