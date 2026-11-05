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
const opts = { city: city || undefined, year: year ? +year : undefined, size: size || undefined };
let fail = 0; const bad = [], out = [];
const stats = { crime: {}, scene: {}, city: {}, size: {}, rules: {}, nodes: {}, archetype: {}, evKind: {}, alibiDoc: {}, evTpl: {} };
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
const workAlibi = B.alibiConfirmed.filter(a => a.roles);
/* Teksty z ograniczeniem (ages, k, roles, trait): zdania cech, nawyki, smaczki, motywy, ramy alibi, mieszkanie.
   Silnik filtruje je przez fitsWho; tu sprawdzamy gotowy tekst, czy żaden nie trafił do niepasującej osoby. */
const CITIES = Object.values(WORLD.cities);
const factsOf = t => !t.facts ? [] : Array.isArray(t.facts) ? t.facts : Object.values(t.facts).flat();
const crimeTexts = Object.values(B.crimes).flatMap(cr => [...cr.suspicion, ...cr.noMotive, ...cr.motives]);
const allRoleDefs = [...B.roles, ...CITIES.flatMap(ct => [...(ct.roles || []), ct.worker])];
const limited = [...Object.values(B.traits).flatMap(factsOf), ...Object.values(B.habits).flat(), ...B.eraFlavor, ...CITIES.flatMap(ct => ct.flavor || []),
  ...allRoleDefs.flatMap(r => r.flavor || []), ...crimeTexts, ...B.flatTpl, ...B.claimFrame]
  .filter(o => typeof o === "object" && o.t && (o.ages || o.k || o.roles || o.trait));
const limitedAlibi = B.alibiConfirmed.filter(a => a.k);
/* siatka bezpieczeństwa: słowa, które nie mogą paść w teczce danej roli, nawet w tekście bez tagu */
const NOJOB = /zwolni(ł|ła|ć)\b|zwolnion|zwolnienie (z pracy|dyscyplinarne)|wymówieni|\bz pracy\b|\bw pracy\b|\bDo pracy\b|pensj|podwyżk|premi[ęai]\b|razem z pracą/i;
const ROLE_FORBID = {
  licealista: new RegExp(NOJOB.source + /|komornik|\bdług(i|ów|ach|u)\b|lombard|weksel|na raty|czynsz|zaleg|Jeździ (Polonezem|Żukiem|Golfem|nowiutkim)|Ma Malucha|swoje(go)? (auto|aucie)|swojego (auta|samochodu)|swoją Syrenkę|Cinquecento|na wyborach/.source, "i"),
  weterynarz: /alergi\S* na sierść|boi się (psów|od dziecka)|Psów boi|na widok (cudzego )?psa/i,
  student: NOJOB,
  emeryt: NOJOB, kombatant: NOJOB, gospodyni: NOJOB,
  bezrobotny: /Ma (stałą|dobrą) pracę|pensj|podwyżk|Zarabia w markach|\bDo pracy\b|\bw pracy\b/i
};
/* smaczki ról: zdanie z flavor jednej roli nie może trafić do teczki innej roli */
const roleFlavor = new Map();
for (const r of allRoleDefs) for (const o of r.flavor || []) { const t = typeof o === "string" ? o : o.t; roleFlavor.set(t, new Set([...(roleFlavor.get(t) || []), r.id])); }
/* kartki na mięso zniesiono 31 lipca 1989: kartki (na mięso, cukier, buty) tylko styczeń–lipiec 1989 */
const KARTKI = /[Kk]art(ki|ek|kach|kami) na (mięso|cukier|buty)|[Kk]artki na cukier/;
const incoherent = [];
function coherence(c) {
  const city = WORLD.cities[c.city];
  const roleDef = id => [...B.roles, ...(city.roles || []), city.worker].find(r => r.id === id);
  const traitsOf = id => Object.fromEntries(c.facts.filter(f => f.type === "trait" && f.who === id).map(f => [f.trait, f.value]));
  const persons = c.nodes.filter(n => n.type === "person");
  const whoOf = (n, k) => ({ age: n.age, role: roleDef(c.used.roles[k]), traits: traitsOf(n.id) });
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
  for (const r of c.rules) if (r.type === "window" && !/gdy [^.]*znika/.test(r.text)) bad("okno bez czasu: " + r.text);
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
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  let c;
  try { c = S.generateCase(WORLD, "test-" + i, opts); } catch (e) { fail++; if (fail < 4) console.log(e.message); continue; }
  inc(stats.crime, c.crime); inc(stats.scene, c.crime + ": " + c.used.scenes[0]); inc(stats.city, c.city); inc(stats.size, c.size); inc(stats.rules, c.rules.length + " reguł");
  inc(stats.nodes, `${c.nodes.filter(n => n.type === "person").length} os. / ${c.nodes.filter(n => n.type === "item").length} przedm.`);
  inc(stats.archetype, c.archetype);
  const nEv = c.nodes.filter(n => n.type === "evidence").length, e = ev[c.size] = ev[c.size] || { n: 0, sum: 0, min: 99, need: 0 };
  e.n++; e.sum += nEv; e.min = Math.min(e.min, nEv); if (needsEvidence(c)) e.need++;
  for (const x of c.facts.filter(x => x.type === "evidence")) {
    inc(stats.evKind, x.kind); if (x.kind === "alibi") inc(stats.alibiDoc, x.lie ? "obala (" + x.lie + ")" : "potwierdza");
    const tk = x.kind === "trait:motive" ? "trait:motive/" + c.crime : x.kind;
    inc(stats.evTpl[tk] = stats.evTpl[tk] || {}, c.nodes.find(n => n.id === x.id).name);
  }
  const evF = c.facts.filter(x => x.type === "evidence");
  if (evF.length && evF.every(x => x.owner === c.solution.culprit)) noInnocentEv.push(c.seed);
  const allText = [c.title, c.intro, c.epilogue, c.quip, c.detective, ...c.rules.map(r => r.text), ...c.hints, ...c.why.map(w => w.join(" ")),
    ...c.nodes.flatMap(n => [n.kind, ...n.text])].join("\n");
  const leftover = allText.match(/[\[\]{}]|undefined|null|NaN|(?<!\.)\.\.(?!\.)/g); // też podwójna kropka
  if (leftover) bad.push([c.seed, leftover.slice(0, 5)]);
  coherence(c);
  out.push(c);
}
console.log(`Niespójności treści (okno bez czasu, cudze alibi zawodowe, zdanie nie na wiek/rolę/cechę, obcy smaczek roli, liczba mnoga, powtórzony szablon dowodu, dokument z innego dnia): ${incoherent.length}`);
if (incoherent.length) console.log(incoherent.slice(0, 5));
console.log(`Wygenerowano ${N - fail}/${N} spraw w ${Date.now() - t0} ms. Błędów generatora: ${fail}. Spraw z niewypełnionym tekstem: ${bad.length}`);
if (bad.length) console.log(bad.slice(0, 5));
console.log("Miasta:", stats.city);
console.log("Wielkości:", stats.size);
console.log("Obsada:", stats.nodes);
console.log("Reguły:", stats.rules);
/* rozkład typów zbrodni i scen (etap 11): typy po równo (±3 p.p. od równego udziału), żadna scena powyżej 2% */
const nOk = N - fail, pct = v => 100 * v / Math.max(1, nOk);
const crimeIds = Object.keys(WORLD.base.crimes), fair = 100 / crimeIds.length;
console.log("Zbrodnie (%):", Object.fromEntries(crimeIds.map(k => [k, +pct(stats.crime[k] || 0).toFixed(1)])), `· równy udział ${fair.toFixed(1)}%`);
const crimeOff = crimeIds.filter(k => Math.abs(pct(stats.crime[k] || 0) - fair) > 3);
const scenes = Object.entries(stats.scene).sort((a, b) => b[1] - a[1]);
const allScenes = crimeIds.reduce((n, k) => n + WORLD.base.crimes[k].scenes.length, 0);
console.log(`Sceny: ${scenes.length} z ${allScenes} użyte, najczęstsze:`, scenes.slice(0, 3).map(([k, v]) => `${k} ${pct(v).toFixed(2)}%`).join(" · "));
const sceneOver = scenes.filter(([, v]) => pct(v) > 2);
const distFail = nOk >= 1000 && (crimeOff.length > 0 || sceneOver.length > 0);
if (distFail) console.log("BŁĄD: rozkład zbrodni albo scen", { crimeOff, sceneOver: sceneOver.slice(0, 5) });
console.log("Archetypy:", stats.archetype);
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
const evFail = all.n >= 200 && (evAvg < 1 || needPct < 60 || (ev.XL && ev.XL.min < 3));
if (evFail) console.log("BŁĄD: dowody rzeczowe poniżej progów etapu 1");
console.log("Unikalnych obsad:", new Set(out.map(c => c.nodes.filter(n => n.type === "person").map(n => n.name).sort().join())).size);
/* opts.avoid: seria spraw z archiwum jak u gracza (okno ostatnich S.RECENT spraw).
   Liczymy, jaka część imion, ról i scen nowej sprawy powtarza się z tego okna, bez avoid i z avoid. */
function repeats(useAvoid, n = 300) {
  const recent = [], hit = { names: [0, 0], roles: [0, 0], scenes: [0, 0] };
  for (let i = 0; i < n; i++) {
    const avoid = S.avoidFrom(recent);
    const c = S.generateCase(WORLD, "seria-" + i, Object.assign({}, opts, useAvoid ? { avoid } : {}));
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
if (fail || bad.length || evFail || avoidFail || distFail || incoherent.length || noInnocentEv.length || tplFew.length) process.exit(1);
