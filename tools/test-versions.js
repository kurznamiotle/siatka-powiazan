#!/usr/bin/env node
/*
 * Test wersjonowania generatora (część npm test).
 *   1. Sprawy dnia z cases/fixtures/daily-<wersja>.json (zapisane kodem, który wtedy był wdrożony)
 *      są bajt w bajt takie same w obecnym kodzie. To pilnuje, że wydanie nie zmienia bieżącej sprawy dnia.
 *   2. Każdy dzień dostaje wersję z GENERATOR_VERSIONS, granica wypada o północy.
 *   3. Wersje są rosnąco, zamrożone pliki istnieją i są w index.html oraz w SHELL w sw.js.
 *   4. Od dnia bieżącej wersji sprawa dnia pochodzi z bieżącego generatora.
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
require("../engine/sprites.js");
const S = require("../engine/engine.js");
const W = { base: require("../data/i18n/pl/base.js"), cities: require("../data/i18n/pl/cities.js") };
const root = path.join(__dirname, "..");
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "BŁĄD"} ${msg}`); if (!ok) fails++; };
const sha = c => { const o = Object.assign({}, c); delete o.gen; return crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex"); };
const day = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };

// 1. utrwalone sprawy dnia
const fx = fs.readdirSync(path.join(root, "cases/fixtures")).filter(f => /^daily-.*\.json$/.test(f));
check(fx.length > 0, `są wzorce spraw dnia (${fx.join(", ")})`);
for (const f of fx) {
  const F = JSON.parse(fs.readFileSync(path.join(root, "cases/fixtures", f), "utf8"));
  for (const d of F.days) {
    const c = S.dailyCase(W, day(d.date));
    check(sha(c) === d.sha1 && c.number === d.number, `${d.date} #${d.number} „${d.title}” jak w ${F.commit} (wersja ${S.caseVersion(c)})`);
    check(S.caseVersion(c) === F.version, `${d.date}: sprawa dnia z wersji ${F.version}`);
    check(S.solve(c).ok, `${d.date}: solver potwierdza sprawę`);
  }
}

// 2. granica wersji o północy
const V = S.GENERATOR_VERSIONS;
for (let i = 1; i < V.length; i++) {
  const [y, m, d] = V[i].from.split("-").map(Number);
  const before = new Date(y, m - 1, d - 1, 23, 59, 59), after = new Date(y, m - 1, d, 0, 0, 1);
  check(S.versionFor(before) === V[i - 1].id && S.versionFor(after) === V[i].id, `${V[i].from}: o północy ${V[i - 1].id} → ${V[i].id}`);
}

// 3. lista wersji
const html = fs.readFileSync(path.join(root, "index.html"), "utf8"), sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
check(V.every((x, i) => i === 0 || x.from > V[i - 1].from), "daty wersji rosną");
check(V[V.length - 1].id === S.GEN_VERSION && !V[V.length - 1].frozen, `ostatnia wersja to bieżący kod (${S.GEN_VERSION})`);
for (const x of V.slice(0, -1)) {
  check(!!x.frozen && fs.existsSync(path.join(root, x.frozen)), `${x.id}: zamrożony plik ${x.frozen}`);
  check(html.includes(`<script src="${x.frozen}"></script>`) && sw.includes(`"${x.frozen}"`), `${x.id}: plik jest w index.html i w SHELL w sw.js`);
  check(!!S.legacy(x.id), `${x.id}: generator się rejestruje`);
}

// 4. bieżąca wersja w sprawie dnia
const cur = day(V[V.length - 1].from), n = S.dailyNumber(cur);
const c = S.dailyCase(W, cur), ref = S.generateCase(W, "daily-" + n, S.dailyOpts(cur)); ref.number = n;
check(c.gen === S.GEN_VERSION && JSON.stringify(c) === JSON.stringify(ref), `${V[V.length - 1].from}: sprawa dnia #${n} z bieżącego generatora`);

// 5. oś czasu w sprawach dnia dopiero od TIMELINE_DAILY_FROM; do tego dnia zawsze classic
{
  const [y, m, dd] = S.TIMELINE_DAILY_FROM.split("-").map(Number);
  let early = true, late = false;
  for (let k = -14; k < 0; k++) { const dt = new Date(y, m - 1, dd + k, 12); if (S.versionFor(dt) === S.GEN_VERSION && S.dailyCase(W, dt).archetype !== "classic") early = false; }
  for (let k = 0; k < 42; k++) if (S.dailyCase(W, new Date(y, m - 1, dd + k, 12)).archetype === "timeline") late = true;
  check(early, `przed ${S.TIMELINE_DAILY_FROM} sprawy dnia są classic`);
  check(late, `od ${S.TIMELINE_DAILY_FROM} w sprawach dnia pojawia się oś czasu`);
}
console.log(fails ? `Test wersji: ${fails} błędów` : "Test wersji: wszystko się zgadza");
process.exit(fails ? 1 : 0);
