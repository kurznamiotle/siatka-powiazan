#!/usr/bin/env node
/*
 * Test realiów miesięcy i form kwot (część npm test).
 *   1. `months:[od,do]` w filtrze lat: kartki (na mięso, cukier, buty) tylko styczeń–lipiec 1989,
 *      bo kartki na mięso zniesiono 31 lipca 1989. Wybory czerwcowe 1989 wspominane dopiero od lipca 1989.
 *   2. Sprawy z 1989: żadna z sierpnia–grudnia nie ma kartek, a w styczniu–lipcu kartki się pojawiają.
 *   3. Talony (na benzynę i na auto) zniesiono z początkiem 1989: w sprawach tylko jako wspomnienie („kiedyś”).
 *   4. {money_gen}: kwota w dopełniaczu („z żądaniem 2 tysięcy złotych”).
 *   6. (2.2.1) kontrola epoki w danych: „Klan”, Koło Fortuny, pager, telefon komórkowy, Cinquecento, Daewoo Tico, Pegasus,
 *      „Dynastia”, bony, „Gazeta Wyborcza”, Polsat i kartki tylko w latach, kiedy istniały (`years`/`months` wpisu albo przodka).
 */
require("../engine/sprites.js");
const S = require("../engine/engine.js");
const W = { base: require("../data/i18n/pl/base.js"), cities: require("../data/i18n/pl/cities.js") };
const B = W.base;
let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log("BŁĄD " + msg); fails++; } };

// 1. filtr
const kart = { years: [1989, 1989], months: [1, 7] };
check(S.util.inYears(kart, 1989, 0) && S.util.inYears(kart, 1989, 6), "kartki w styczniu i lipcu 1989");
check(!S.util.inYears(kart, 1989, 7) && !S.util.inYears(kart, 1990, 0), "brak kartek od sierpnia 1989");
check(S.util.inYears({ years: [1989, 1990] }, 1989, 11), "wpis bez months działa cały rok");
check(S.util.avail(["x", Object.assign({ t: "k" }, kart)], 1989, 8).join() === "x", "avail odrzuca wpis spoza miesięcy");
const KARTKI = /[Kk]art(ki|ek|kach|kami) na (mięso|cukier|buty)/;
// każdy wpis z kartkami w danych ma years:[1989,1989] i months:[1,7]
(function walk(o, path) {
  if (!o || typeof o !== "object") return;
  if (!Array.isArray(o) && Object.values(o).some(v => typeof v === "string" && KARTKI.test(v)))
    check(String(o.years) === "1989,1989" && String(o.months) === "1,7", "wpis z kartkami bez ograniczenia do sty–lip 1989: " + path);
  for (const [k, v] of Object.entries(o)) walk(v, path + "." + k);
})(B, "base");

// 2. sprawy z 1989
let early = 0, earlyK = 0, late = 0;
for (let i = 0; i < 1500; i++) {
  const c = S.generateCase(W, "realia-" + i, { year: 1989 });
  if (!c) continue;
  const all = JSON.stringify(c), mi = B.months.indexOf(c.month);
  if (mi >= 7) { late++; const m = all.match(KARTKI); check(!m, `${c.seed} (${c.month} 1989): ${m && m[0]}`); }
  else { early++; if (KARTKI.test(all)) earlyK++; }
  if (mi < 6) check(!/w czerwcu skreślał/.test(all), `${c.seed} (${c.month} 1989): wybory przed czerwcem`);
  const tal = all.match(/[^."]*[Tt]alon[^."]*/);
  check(!tal || /kiedyś/.test(tal[0]), `${c.seed}: talon w teraźniejszości: ${tal && tal[0]}`);
  const g = all.match(/(żądaniem|zażądał[a]?|chce|nie dostanie) \d+ (tysiące|tysiąc|miliony|milion) /);
  check(!g, `${c.seed}: kwota nie w dopełniaczu: ${g && g[0]}`);
}
check(late > 300 && early > 300, `za mało spraw do testu (sty–lip ${early}, sie–gru ${late})`);
check(earlyK > 0, "kartki nie pojawiają się wcale w styczniu–lipcu 1989");

// talony w danych: tylko zdania o przeszłości
(function walk(o) { if (typeof o === "string") { if (/talon/i.test(o)) check(/kiedyś/.test(o), "talon w danych: " + o); return; } if (o && typeof o === "object") Object.values(o).forEach(walk); })(B);

// 4. dopełniacz kwot
const G = S.util.moneyGen;
check(G("2 tysiące złotych") === "2 tysięcy złotych" && G("3 miliony złotych") === "3 milionów złotych" &&
      G("700 tysięcy złotych") === "700 tysięcy złotych" && G("12 milionów złotych") === "12 milionów złotych", "moneyGen");

// 5. (2.2) kwoty z cennika po denominacji: parking kilka złotych, OC kilkaset, okup kilkaset do 2 tysięcy
{
  const R = S.makeRng("ceny"), zl = s => { const m = s.match(/^([\d,]+) (tysiąc|tysiące|tysięcy|milion|miliony|milionów|miliona)?/); const n = parseFloat(m[1].replace(",", ".")); return m[2] ? n * (m[2][0] === "t" ? 1e3 : 1e6) : n; };
  const range = { parking: [1, 10], oc: [200, 900], ransom: [300, 2000], fine: [10, 150], money: [500, 8000] };
  for (let y = 1995; y <= 1999; y++) for (const [k, [lo, hi]] of Object.entries(range)) for (let i = 0; i < 40; i++) {
    const v = zl(S.util.price(B, R, y, k)); check(v >= lo && v <= hi, `${k} ${y}: ${v} zł poza ${lo}–${hi}`);
  }
  for (const y of [1989, 1992]) check(/tysięcy|tysiące|milion/.test(S.util.price(B, R, y, "oc")), `OC w ${y} w starych złotych`);
}
// 6. (2.2.1) kontrola epoki w danych: tekst z anachronicznym słowem musi mieć (sam albo po przodku: rola, scena, przedmiot)
//    `years` i `months` mieszczące się w czasie, kiedy rzecz istniała. Daty: [rok, miesiąc].
{
  const ERA = [
    ["„Klan”", /\bKlan(u|em|ie)?\b/, [1997, 1], [1999, 12]],
    ["Koło Fortuny", /Koł(o|a|u|em) Fortuny/, [1992, 1], [1998, 12]],
    ["pager", /\bpager/i, [1995, 1], [1999, 12]],
    ["telefon komórkowy", /telefon\w* komórkow|komórkow\w* telefon/i, [1992, 1], [1999, 12]],
    ["Cinquecento", /Cinquecento/, [1991, 1], [1999, 12]],
    ["Daewoo Tico", /\bTico\b|Daewoo/, [1996, 1], [1999, 12]],
    ["Pegasus", /pegaz|pegasus/i, [1993, 1], [1999, 12]],
    ["„Dynastia”", /Dynasti/, [1990, 1], [1999, 12]],
    ["bony towarowe", /\bbon(y|ów|ami|ach|om)\b/, [1989, 1], [1990, 12]],
    ["„Gazeta Wyborcza”", /Gazet(a|ę|y|ą|ie|o) Wyborcz/, [1989, 5], [1999, 12]],
    ["Polsat", /Polsat/, [1992, 12], [1999, 12]],
    ["kartki", KARTKI, [1989, 1], [1989, 7]]
  ];
  const roleYears = {};
  for (const r of [...B.roles, ...Object.values(W.cities).flatMap(c => [...(c.roles || []), c.worker].filter(Boolean))]) if (r.years) roleYears[r.id] = r.years;
  const bad = new Set();
  const test = (txt, path, e) => {
    for (const [name, re, from, to] of ERA) if (re.test(txt)) {
      const first = e.y0 * 12 + (e.m0 - 1), last = e.y1 * 12 + (e.m1 - 1);
      if (first < from[0] * 12 + from[1] - 1 || last > to[0] * 12 + to[1] - 1)
        bad.add(`${name}: lata ${e.y0}-${String(e.m0).padStart(2, "0")}…${e.y1}-${String(e.m1).padStart(2, "0")}, dozwolone ${from.join("-")}…${to.join("-")}: ${path} „${txt.slice(0, 70)}”`);
    }
  };
  const visit = (v, path, e) => {
    if (typeof v === "string") return test(v, path, e);
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x, i) => visit(x, path + "[" + i + "]", e));
    const rng = a => Array.isArray(a) && a.length === 2 && typeof a[0] === "number"; // B.months to nazwy miesięcy, B.years to opis epoki
    if (rng(v.years)) e = { y0: Math.max(e.y0, v.years[0]), y1: Math.min(e.y1, v.years[1]), m0: e.m0, m1: e.m1 };
    if (rng(v.months)) e = { y0: e.y0, y1: e.y1, m0: Math.max(e.m0, v.months[0]), m1: Math.min(e.m1, v.months[1]) };
    // wpis tylko dla ról, które same istnieją w ograniczonych latach (np. Pewex 1989–1990)
    if (Array.isArray(v.roles) && v.roles.length && v.roles.every(r => roleYears[r])) {
      const ys = v.roles.map(r => roleYears[r]); e = { y0: Math.max(e.y0, Math.min(...ys.map(y => y[0]))), y1: Math.min(e.y1, Math.max(...ys.map(y => y[1]))), m0: e.m0, m1: e.m1 };
    }
    for (const [k, x] of Object.entries(v)) visit(x, path + "." + k, e);
  };
  visit({ base: B, cities: W.cities }, "dane", { y0: 1989, y1: 1999, m0: 1, m1: 12 });
  for (const m of bad) check(false, "epoka: " + m);
}

// 7. (2.2.2) Milicja do 9 maja 1990, Policja od 10 maja 1990: kwiecień 1990 zawsze MO, czerwiec zawsze policja,
//    maj raz tak, raz tak (dzień z osobnego strumienia seed/day), a w sprawie z MO {police_dat} = milicji
const mo = { kwiecień: [0, 0], maj: [0, 0], czerwiec: [0, 0] };
for (let i = 0; i < 300 && (mo.maj[0] < 3 || mo.maj[1] < 3 || !mo.kwiecień[0] || !mo.czerwiec[1]); i++) {
  const c = S.generateCase(W, "realia-mo-" + i, { year: 1990 });
  if (!mo[c.month]) continue;
  const isMo = /\bMO\b/.test(c.detective);
  mo[c.month][isMo ? 0 : 1]++;
}
check(mo.kwiecień[1] === 0 && mo.kwiecień[0] > 0, `kwiecień 1990: zawsze milicja (${mo.kwiecień})`);
check(mo.czerwiec[0] === 0 && mo.czerwiec[1] > 0, `czerwiec 1990: zawsze policja (${mo.czerwiec})`);
check(mo.maj[0] > 0 && mo.maj[1] > 0, `maj 1990: i milicja (do 9.05), i policja (od 10.05) (${mo.maj})`);
// 8. (2.2.2) miejsca w aktach. Dla 2000 spraw (classic i oś czasu):
//    A1 kolejne obserwacje tej samej osoby w tym samym miejscu są w jednym zdaniu (dwa sąsiednie zdania nie mówią o tym samym miejscu),
//    A2 szablon świadka najwyżej raz w aktach osoby, A3 miejsce w zdaniu świadka to pinezka z tablicy, a etykieta polaroidu siedzi
//    w każdej formie miejsca (gen, in, out, from), C stragan ma własnych świadków, D „w środku” tylko w godzinach otwarcia (+30 min),
//    poza nimi forma „przed…” i świadkowie uliczni, E zmiana i kwity tylko w zakładach; do tego listy `at`, pory `time` i sezon.
//    B osobno: współpracownik w ok. 1/3 reguł relacji, zawsze z jednego rodzaju pracy (wp).
{
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, m => "\\" + m);
  const toRe = t => new RegExp(t.split(/(\[[^\]]+\]|\{in\}|\{out\}|\{ts\}|\{t\})/).map(p => p === "{in}" || p === "{out}" ? "(?<in>.+?)" : p === "{t}" ? "(?<t>\\d+:\\d\\d)"
    : p === "{ts}" ? "(?<ts>(?:\\S+ \\d+:\\d\\d,? )+\\S+ (?:\\S+ )*?\\S+ \\d+:\\d\\d)" : /^\[.*\]$/.test(p) ? "(?:" + p.slice(1, -1).split("|").map(esc).join("|") + ")" : esc(p)).join(""), "g");
  const tpls = [...B.presenceTpl, ...B.presence2Tpl, ...B.timeline.obsTpl].map(o => ({ o, re: toRe(o.t) }));
  const evDefs = [...B.evidence.presence, ...B.timeline.evidence];
  const worldLocs = [...B.locations, ...Object.values(W.cities).flatMap(c => c.locations || [])];
  const strip = s => String(s || "").replace(/\{g:[\w-]+\|([^{}]*)\}/g, "$1").toLowerCase();
  const stemOf = l => { const w = strip(l.label).split(/\s+/)[0]; return w.slice(0, Math.max(4, w.length - 2)); };
  const bad8 = [], dark = (pt, month) => S.util.darkMonth(B, pt, B.months.indexOf(month));
  // A3: etykieta polaroidu w każdej formie miejsca
  for (const l of worldLocs) for (const k of ["gen", "in", "out", "from"]) if (l[k] && !strip(l[k]).includes(stemOf(l))) bad8.push(`miejsce ${l.id}: etykieta „${l.label}” nie pasuje do formy ${k} „${l[k]}”`);
  // C: stragan
  for (const l of worldLocs.filter(l => /szczeka/.test(l.id))) if (l.pt !== "stall" || !/^przy /.test(l.in)) bad8.push(`szczęka: rodzaj ${l.pt}, forma ${l.in}`);
  for (const { o } of tpls) if (o.at.includes("stall") && /wózkiem|z okna|przez okno|z parteru/.test(o.t)) bad8.push(`przy straganie świadek z ulicy: ${o.t}`);
  // E: zmiana i kwity
  for (const { o } of tpls) if (/Szef zmiany|Kierownik zmiany/.test(o.t) && o.at.some(x => x !== "plant")) bad8.push(`zmiana poza zakładem: ${o.t}`);
  for (const d of evDefs) if (/^Kwit z godziną|Lista obecności|Książka wejść/.test(d.name) && d.at.some(x => !["plant", "shop", "office", "stall", "backroom"].includes(x))) bad8.push(`dowód „${d.name}” poza zakładem i lokalem: ${d.at}`);
  let nW = 0, nE = 0, nM = 0, nOut = 0, winter = 0;
  for (let i = 0; i < 2000; i++) {
    const c = S.generateCase(W, "realia-at-" + i, i % 4 === 3 ? { archetype: "timeline", size: ["M", "L", "XL"][i % 3] } : {});
    const locs = c.nodes.filter(n => n.type === "location");
    const byForm = {}; for (const n of locs) { const def = worldLocs.find(l => l.id === n.id); if (def) for (const f of [def.in, def.out].filter(Boolean)) byForm[f] = def; }
    if (["listopad", "grudzień", "styczeń", "luty", "marzec"].includes(c.month)) winter++;
    for (const n of locs) if (dark(n.pt, c.month)) bad8.push(`${c.seed}: ${n.name} (${n.pt}) w miesiącu ${c.month}`);
    for (const n of c.nodes.filter(n => n.type === "person")) {
      const hits = [];
      n.text.forEach((line, li) => { for (const { o, re } of tpls) { re.lastIndex = 0; let m; while ((m = re.exec(line))) {
        const times = m.groups.t ? [m.groups.t] : (m.groups.ts || "").match(/\d+:\d\d/g) || [];
        hits.push({ o, form: m.groups.in, times, li, at: m.index, txt: m[0] }); } } });
      hits.sort((a, b) => a.li - b.li || a.at - b.at);
      for (let k = hits.length - 1; k > 0; k--) if (hits[k].li === hits[k - 1].li && hits[k].at === hits[k - 1].at) hits.splice(k, 1); // ten sam tekst w obu listach szablonów
      const seenT = new Set();
      hits.forEach((h, k) => {
        const def = byForm[h.form];
        if (!def) { if (worldLocs.some(l => l.in === h.form || l.out === h.form)) bad8.push(`${c.seed}: miejsca „${h.form}” nie ma na tablicy: ${h.txt}`); return; }
        nW++; if (h.times.length > 1) nM++;
        if (seenT.has(h.o)) bad8.push(`${c.seed}: ${n.name}: szablon dwa razy: ${h.txt}`); seenT.add(h.o);
        if (k > 0 && hits[k - 1].form === h.form && byForm[hits[k - 1].form] && !/{out}/.test(hits[k - 1].o.t + h.o.t)) bad8.push(`${c.seed}: ${n.name}: dwa zdania z rzędu o tym samym miejscu: ${hits[k - 1].txt} | ${h.txt}`);
        for (const tm of h.times.map(S.util.toMin)) {
          const pa = S.util.placeAt(B, def, tm);
          if ((/\{out\}/.test(h.o.t) ? def.out || pa.form : pa.form) !== h.form) bad8.push(`${c.seed}: o ${S.util.toHM(tm)} forma „${h.form}”, a powinna „${pa.form}”: ${h.txt}`);
          if (!h.o.at.includes(pa.pt)) bad8.push(`${c.seed}: świadek poza listą (${pa.pt}): ${h.txt}`);
          if (h.o.time && !(tm >= S.util.toMin(h.o.time[0]) && tm < S.util.toMin(h.o.time[1]))) bad8.push(`${c.seed}: świadek o złej porze: ${h.txt}`);
          if (pa.closed) nOut++;
        }
      });
    }
    for (const n of c.nodes.filter(n => n.type === "evidence")) {
      const def = evDefs.find(d => d.name === n.name), f = c.facts.find(f => f.type === "presence" && f.src === n.id);
      if (!def || !f) continue;
      const loc = worldLocs.find(l => l.id === f.where); if (!loc) continue;
      nE++;
      const pa = S.util.placeAt(B, loc, S.util.toMin(f.at));
      if (!def.at.includes(pa.pt)) bad8.push(`${c.seed}: dowód „${n.name}” poza listą (${pa.pt})`);
    }
  }
  // B: współpracownik
  const roles = [...B.roles, ...Object.values(W.cities).flatMap(c => [...(c.roles || []), c.worker])];
  // nazwa roli może mieć wstawkę z miasta („Handlarz {market_from}”): wstawka pasuje do dowolnego tekstu
  const roleRe = (txt, g) => new RegExp("^" + S.tx(txt, g).split(/\{\w+\}/).map(p => p.replace(/[.*+?^$()|[\]\\]/g, m => "\\" + m)).join(".+") + "$");
  const wpOf = kind => (roles.find(r => roleRe(r.m, "m").test(kind) || roleRe(r.f || r.m, "f").test(kind)) || {}).wp;
  let rel = 0, wm = 0;
  for (let i = 0; i < 1600; i++) {
    const c = S.generateCase(W, "realia-wm-" + i, { archetype: "classic", size: ["S", "M", "L", "XL"][i % 4] });
    const r = c.rules.find(r => r.type === "relation"); if (!r) continue; rel++;
    if (r.rel !== "workmate") continue; wm++;
    const wps = c.facts.filter(f => f.type === "relation" && f.rel === "workmate").map(f => wpOf(c.nodes.find(n => n.id === f.a).kind));
    if (!wps[0] || new Set(wps).size !== 1) bad8.push(`${c.seed}: współpracownicy z różnych miejsc pracy (${wps})`);
  }
  check(wm / rel > 0.2 && wm / rel < 0.45, `współpracownik w ${(100 * wm / rel).toFixed(0)}% reguł relacji (${wm}/${rel}), oczekiwano ok. 1/3`);
  bad8.slice(0, 8).forEach(b => console.log("BŁĄD " + b)); fails += bad8.length;
  check(nW > 3000 && nE > 300 && winter > 500 && nM > 100 && nOut > 100, `test miejsc ma dość danych (świadkowie ${nW}, łączone ${nM}, przed lokalem ${nOut}, dowody ${nE}, zimą ${winter})`);
  console.log(`Miejsca (2000 spraw): ${nW} zdań świadków (${nM} łączonych, ${nOut} obserwacji przed lokalem po godzinach), ${nE} dowodów obecności; współpracownik ${wm}/${rel} relacji`);
}
// 9. (2.2.2) pory i miejsca świadków i dowodów:
//    A kotwice czasu: sygnał czasu i dzwony tylko o pełnej godzinie (mins:[0]), programy telewizyjne tylko w godzinie emisji (times),
//    B raport stróża nocnego tylko 20:00–6:00 (w dzień inny dowód z listy miejsca),
//    C kolejka tylko przy ladzie albo okienku (feat queue), zeszyt na kreskę tylko w spożywczym, barze, kiosku i na straganie (tab),
//      u fryzjera zeszyt zapisów (appt); świetlica, klub i fryzjer bez kolejki i kreski.
{
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, m => "\\" + m);
  const toRe = t => new RegExp(t.split(/(\[[^\]]+\]|\{in\}|\{t\})/).map(p => p === "{in}" ? "(?<in>.+?)" : p === "{t}" ? "(?<t>\\d+:\\d\\d)"
    : /^\[.*\]$/.test(p) ? "(?:" + p.slice(1, -1).split("|").map(esc).join("|") + ")" : esc(p)).join(""));
  const TL = B.timeline, tm = S.util.toMin, bad9 = [];
  const witness = [...B.presenceTpl, ...TL.obsTpl], evDefs = [...B.evidence.presence, ...TL.evidence];
  const worldLocs = [...B.locations, ...Object.values(W.cities).flatMap(c => c.locations || [])];
  const ANC_HOUR = /sygnał czasu|biły dzwony|dzwony|hejnał/i, ANC_TV = /Teleexpress|Wiadomości|Dziennik Telewizyjny|Panorama|Dobranoc/;
  const NIGHT = /stróża nocnego|Raport stróża/;
  // A, B, C: dane
  for (const o of witness) {
    if (ANC_HOUR.test(o.t) && !(o.mins && o.mins.length === 1 && o.mins[0] === 0)) bad9.push(`kotwica bez pełnej godziny (mins:[0]): ${o.t}`);
    if (ANC_TV.test(o.t) && !(o.times && o.times.length)) bad9.push(`program bez godziny emisji (times): ${o.t}`);
    if (/kolejk/i.test(o.t) && o.need !== "queue") bad9.push(`kolejka bez need:"queue": ${o.t}`);
  }
  check(TL.obsTpl.some(o => o.times && o.times.includes("17:00") && /Teleexpress/.test(o.t)), "Teleexpress o 17:00 w kotwicach osi czasu");
  for (const d of evDefs) {
    if (NIGHT.test(d.name) && !(d.time && d.time[0] === "20:00" && d.time[1] === "06:00")) bad9.push(`raport stróża bez pory 20:00–06:00: ${d.name}`);
    if (/kresk/i.test(d.name) && d.need !== "tab") bad9.push(`zeszyt na kreskę bez need:"tab": ${d.name}`);
    if (/fryzjer/i.test(d.name) && d.need !== "appt") bad9.push(`zeszyt fryzjera bez need:"appt": ${d.name}`);
  }
  const places = [...worldLocs.map(l => ({ name: l.name, feat: l.feat, id: l.id })), ...Object.values(TL.places).flat()];
  const QUEUE_OK = /^(Sklep|Kiosk|Apteka|Poczta|Bank|Kasa|Kantor|Bar|Piekarnia|Cukiernia|Stragan|Budka (?!dozorcy)|Szczęka)/;
  const TAB_OK = /^(Sklep spożywczy|Sklep przy|Bar|Kiosk|Stragan|Budka \{market_on\}|Budka z warzywami|Szczęka)/;
  for (const p of places) {
    const f = p.feat || [];
    if (f.includes("queue") && !QUEUE_OK.test(p.name)) bad9.push(`kolejka w miejscu bez lady: ${p.name}`);
    if (f.includes("tab") && !TAB_OK.test(p.name)) bad9.push(`na kreskę w miejscu, gdzie się tak nie kupuje: ${p.name}`);
    if (/fryzjer|Świetlica|Piwnica jazzowa|klub/i.test(p.name) && (f.includes("queue") || f.includes("tab"))) bad9.push(`kolejka albo kreska: ${p.name}`);
    if (/fryzjer/i.test(p.name) && !f.includes("appt")) bad9.push(`fryzjer bez zapisów (appt): ${p.name}`);
  }
  // sprawy: każda kotwica, raport stróża, kolejka, kreska i zapisy w wygenerowanym tekście spełniają warunki
  const tpls = witness.map(o => ({ o, re: toRe(o.t) }));
  const nameRe = n => new RegExp("^" + n.split(/\{\w+\}/).map(esc).join(".+"));
  const featOf = (c, id) => { const l = worldLocs.find(l => l.id === id); if (l) return l.feat || [];
    const node = c.nodes.find(n => n.id === id), p = (TL.places[c.crime] || []).find(p => nameRe(p.name).test(node.name)); return (p && p.feat) || []; };
  const cnt = { hour: 0, tv: 0, night: 0, day: 0, queue: 0, tab: 0, appt: 0 };
  for (let i = 0; i < 2400; i++) {
    const c = S.generateCase(W, "realia-anc-" + i, i % 2 ? { archetype: "timeline", size: ["M", "L", "XL"][i % 3] } : {});
    const locs = c.nodes.filter(n => n.type === "location");
    for (const n of c.nodes.filter(n => n.type === "person")) for (const line of n.text) for (const { o, re } of tpls) {
      const m = line.match(re); if (!m) continue;
      const t = tm(m.groups.t), loc = locs.find(l => (l.forms || []).includes(m.groups.in));
      if (o.mins) { cnt.hour++; if (!o.mins.includes(t % 60)) bad9.push(`${c.seed}: kotwica nie o pełnej godzinie: ${m[0]}`); }
      if (o.times) { cnt.tv++; if (!o.times.some(x => tm(x) === t)) bad9.push(`${c.seed}: program poza godziną emisji: ${m[0]}`); }
      if (o.years && !(c.year >= o.years[0] && c.year <= o.years[1])) bad9.push(`${c.seed}: kotwica spoza lat ${o.years} (${c.year}): ${m[0]}`);
      if (o.need) { cnt[o.need]++; if (!loc || !featOf(c, loc.id).includes(o.need)) bad9.push(`${c.seed}: „${o.need}” w miejscu bez tej cechy: ${m[0]}`); }
    }
    for (const n of c.nodes.filter(n => n.type === "evidence")) {
      const d = evDefs.find(d => d.name === n.name), f = c.facts.find(f => f.type === "presence" && f.src === n.id);
      if (!d || !f) continue;
      const t = tm(f.at) % 1440;
      if (NIGHT.test(d.name)) { cnt.night++; if (!(t >= 20 * 60 || t < 6 * 60)) bad9.push(`${c.seed}: raport stróża nocnego o ${f.at}`); }
      else if (t < 20 * 60) cnt.day++;
      if (d.need) { cnt[d.need]++; if (!featOf(c, f.where).includes(d.need)) bad9.push(`${c.seed}: „${d.name}” w miejscu bez cechy ${d.need}`); }
    }
  }
  bad9.slice(0, 10).forEach(b => console.log("BŁĄD " + b)); fails += bad9.length;
  check(cnt.night > 20 && cnt.day > 300 && cnt.queue > 50 && cnt.tab > 5 && cnt.appt > 5 && cnt.hour + cnt.tv > 5, `test pór i lady ma dość danych (${JSON.stringify(cnt)})`);
  console.log(`Pory i lada (2400 spraw): ${JSON.stringify(cnt)}`);
}
// 10. (2.2.2, przed wydaniem) A listonosz w lokalu i biurze tylko „przed …” ({out}), nigdy „w aptece”, „w biurze”;
//     B alibi z kolejką najwyżej 45 min (max), u fryzjera strzyżenie i farbowanie zamiast kolejki;
//     C zaplecze sklepu (backroom) to nie warsztat: ekspedientka, kierowniczka, dostawca, dzielnicowy, bez kolegi z zakładu i załogi.
{
  const bad10 = [], TL = B.timeline;
  const worldLocs = [...B.locations, ...Object.values(W.cities).flatMap(c => c.locations || [])];
  const witness = [...B.presenceTpl, ...B.presence2Tpl, ...TL.obsTpl];
  for (const o of witness) if (/Listonosz/.test(o.t) && o.at.some(x => ["shop", "office"].includes(x)) && !/\{out\}/.test(o.t)) bad10.push(`listonosz w lokalu bez {out}: ${o.t}`);
  for (const a of B.alibiConfirmed) if (/kolejce|kolejk/.test(a.text) && !(a.max && a.max <= 45)) bad10.push(`alibi z kolejką bez max ≤ 45: ${a.text}`);
  check(worldLocs.find(l => l.id === "sklep").pt === "backroom", "zaplecze sklepu to rodzaj backroom");
  const WORKY = /z zakładu|załog|zmiany zanotował|Kierownik zmiany|zamówienie/;
  for (const o of witness) if (o.at.includes("backroom") && WORKY.test(o.t)) bad10.push(`świadek z zakładu na zapleczu sklepu: ${o.t}`);
  const inside = worldLocs.filter(l => ["shop", "office"].includes(l.pt)).map(l => l.in);
  const back = worldLocs.filter(l => l.pt === "backroom").map(l => l.in);
  let nPost = 0, nBack = 0, nAl = 0;
  for (let i = 0; i < 2000; i++) {
    const c = S.generateCase(W, "realia-10-" + i, i % 3 === 2 ? { archetype: "timeline", size: ["M", "L", "XL"][i % 3] } : {});
    for (const n of c.nodes.filter(n => n.type === "person")) for (const line of n.text) {
      for (const s of line.split(/(?<=\.)\s+/)) {
        if (/^Listonosz/.test(s)) { nPost++; if (inside.some(f => s.includes(" " + f + " "))) bad10.push(`${c.seed}: listonosz w środku: ${s}`); }
        if (back.some(f => s.includes(f))) { nBack++; if (WORKY.test(s)) bad10.push(`${c.seed}: zaplecze sklepu ze świadkiem z zakładu: ${s}`); }
      }
      const m = line.match(/^Od (\d+:\d\d) do (\d+:\d\d) .*kolejce/);
      if (m) { nAl++; if (S.util.toMin(m[2]) - S.util.toMin(m[1]) > 45) bad10.push(`${c.seed}: kolejka dłuższa niż 45 min: ${line}`); }
      if (/czekał[a]? w kolejce do strzyżenia/.test(line)) bad10.push(`${c.seed}: kolejka do strzyżenia: ${line}`);
    }
  }
  bad10.slice(0, 10).forEach(b => console.log("BŁĄD " + b)); fails += bad10.length;
  check(nPost > 50 && nBack > 50, `test listonosza i zaplecza ma dość danych (listonosz ${nPost}, zaplecze ${nBack})`);
  console.log(`Listonosz, kolejka, zaplecze (2000 spraw): listonosz ${nPost}, zaplecze sklepu ${nBack}, alibi z kolejką ${nAl}`);
}
console.log(fails ? `Test realiów: ${fails} błędów` : `Test realiów: wszystko się zgadza (1989: sty–lip ${early} spraw, w ${earlyK} kartki; sie–gru ${late} bez kartek)`);
process.exit(fails ? 1 : 0);
