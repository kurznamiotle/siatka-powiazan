/*
 * Siatka Powiązań — silnik: losowanie, tekst, rejestr archetypów, sprawa dnia.
 * Działa w przeglądarce (window.Siatka) i w Node (require).
 *
 * World = { base: SIATKA_BASE, cities: SIATKA_CITIES }
 *
 * Archetyp (engine/archetypes/*.js) rejestruje się przez Siatka.register({...}):
 *   id, name, minSize, weight (liczba albo fn(size)), question,
 *   build(ctx) → sprawa | null, hypotheses(c) → [...], holds(rule, hyp, ix, c) → bool
 * Ogólny solver i biblioteka predykatów: engine/solver.js.
 *
 * Model logiczny sprawy (pole `facts`):
 *   has_key     {who, where}
 *   presence    {who, where, at}  albo {who, where, from, to}
 *   alibi       {who, from, to, confirmed}
 *   trait       {who, trait, value}
 *   item_origin {what, where}
 *   item_moved  {what, from, to}
 *   item_fate   {what, value}
 *   alibi_debunked {who}
 *   evidence    {id, kind, owner?, mark?:{kind, value}}   dowód rzeczowy (etap 1)
 *   mark        {who, kind, value}                         znak rozpoznawczy w teczce osoby
 * Fakt pokazany na dowodzie ma src = id dowodu (i nie ma go w teczce).
 * Reguły (pole `rules`): {id, type: alibi|trait|window|key|fate|dump, trait?, value?, text}
 */
(function (root) {
  /* ---------------- losowanie ---------------- */
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function makeRng(seed) {
    let a = hash(String(seed));
    const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const r = {
      next,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      pick: arr => arr[Math.floor(next() * arr.length)],
      chance: p => next() < p,
      shuffle: arr => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; }
    };
    r.sample = (arr, n) => r.shuffle(arr).slice(0, n);
    return r;
  }

  /* ---------------- tekst ---------------- */
  const GIDX = { m: 0, f: 1, n: 2, pl: 3 }; // pl = liczba mnoga przedmiotu (widły, nożyce); bez 4. wariantu bierze 3.
  /* najpierw {k} → vars[k], potem [a|b|c] → wariant wg rodzaju */
  function tx(str, g, vars) {
    let s = String(str);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    s = s.replace(/\[([^\[\]]*)\]/g, (_, body) => { const parts = body.split("|"); return parts[Math.min(GIDX[g] || 0, parts.length - 1)]; });
    // „z Słowiańskiej” → „ze Słowiańskiej”: przed nazwą zaczynającą się zbitką s/z/ś/ź/ż + spółgłoska
    return s.replace(/(^|[\s„(])([zZ]) (?=(?:Sz|Rz)[^aeiouyąęó\s]|[SZŚŹŻ](?![zh])[^aeiouyąęóz\s])/g, "$1$2e ");
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toHM = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  const plList = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " i " + a[a.length - 1];
  const plural = (n, one, few, many) => { if (n === 1) return one; const d = n % 10, h = n % 100; return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many; };
  /* years:[od,do] i opcjonalnie months:[od,do] (1–12, w każdym roku z zakresu); m = indeks miesiąca sprawy 0–11 */
  const inYears = (o, y, m) => !o || ((!o.years || (y >= o.years[0] && y <= o.years[1])) && (!o.months || m === undefined || (m + 1 >= o.months[0] && m + 1 <= o.months[1])));
  /* lista tekstów/obiektów → to, co pasuje do roku (teksty jako stringi) */
  const avail = (list, y, m) => (Array.isArray(list) ? list : [list]).filter(o => typeof o === "string" || inYears(o, y, m)).map(o => (typeof o === "object" && o.t !== undefined && !o.id) ? o.t : o);
  const slug = s => s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

  function money(R, year) {
    if (year <= 1989) return `${R.int(2, 9) * 100} tysięcy złotych`;
    if (year < 1995) { const n = R.int(3, 60); return `${n} ${plural(n, "milion", "miliony", "milionów")} złotych`; }
    const n = R.int(2, 15); return `${n} ${plural(n, "tysiąc", "tysiące", "tysięcy")} złotych`;
  }
  /* 2.2: kwota z cennika (B.prices): rodzaj → zakres dla 1989, 1990–94 i od 1995. Dwie cyfry znaczące,
     od tysiąca słownie („37 tysięcy”, „2,5 miliona”); w nowych złotych pełne tysiące też słownie. */
  function price(B, R, year, kind) {
    const p = (B.prices || {})[kind]; if (!p) throw new Error("Brak ceny: " + kind);
    const [lo, hi] = p[year <= 1989 ? 0 : year < 1995 ? 1 : 2];
    let v = R.int(lo, hi);
    const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); v = Math.max(lo, Math.round(v / step) * step);
    if (v >= 1e6) {
      const m = v / 1e6;
      return Number.isInteger(m) ? `${m} ${plural(m, "milion", "miliony", "milionów")} złotych` : `${String(m).replace(".", ",")} miliona złotych`;
    }
    if (v >= 1000 && v % 1000 === 0) { const k = v / 1000; return `${k} ${plural(k, "tysiąc", "tysiące", "tysięcy")} złotych`; }
    if (v >= 10000) { const k = Math.round(v / 1000); return `${k} ${plural(k, "tysiąc", "tysiące", "tysięcy")} złotych`; }
    return `${v} ${plural(v, "złoty", "złote", "złotych")}`;
  }
  /* 2.2: wzrost w cm. Rozkład trójkątny wg płci (m 165–190, najczęściej 176; k 155–178, najczęściej 164).
     Opis: wysoki od progu tall, niski do progu short, pomiędzy „mid” (bez zdań o wzroście).
     want = "tall" / "short": losowanie tylko z tej klasy (gdy wzrost opisowy jest regułą). */
  const HEIGHT = { m: { lo: 165, mode: 176, hi: 190, tall: 182, short: 168 }, f: { lo: 155, mode: 164, hi: 178, tall: 174, short: 158 } };
  function heightOf(R, g, want) {
    const H = HEIGHT[g];
    if (want === "tall") return R.int(H.tall, H.hi);
    if (want === "short") return R.int(H.lo, H.short);
    const u = R.next(), F = (H.mode - H.lo) / (H.hi - H.lo);
    return Math.round(u < F ? H.lo + Math.sqrt(u * (H.hi - H.lo) * (H.mode - H.lo)) : H.hi - Math.sqrt((1 - u) * (H.hi - H.lo) * (H.hi - H.mode)));
  }
  const heightClass = (g, cm) => cm >= HEIGHT[g].tall ? "tall" : cm <= HEIGHT[g].short ? "short" : "mid";
  /* {kwota_<rodzaj>} w tekście → kwota z cennika */
  const prices = (B, R, year, s) => s.replace(/\{kwota_(\w+)\}/g, (_, k) => price(B, R, year, k));
  /* {money} w dopełniaczu: liczba zostaje cyframi, zmienia się rzeczownik (2 tysiące → 2 tysięcy, 3 miliony → 3 milionów) */
  const moneyGen = s => s.replace(/ (tysiące|tysiąc|miliony|milion)(?= )/, (_, w) => w[0] === "t" ? " tysięcy" : " milionów");
  /* drobna kwota na kwitach i paragonach: do 1994 stare złote, od denominacji nowe */
  function smallMoney(R, year) {
    if (year <= 1989) { const n = R.int(3, 9); return `${n} ${plural(n, "tysiąc", "tysiące", "tysięcy")} złotych`; }
    if (year < 1995) { const n = R.int(5, 40) * 10; return `${n} ${plural(n, "tysiąc", "tysiące", "tysięcy")} złotych`; }
    const n = R.int(15, 90); return `${n} ${plural(n, "złoty", "złote", "złotych")}`;
  }
  /* Czy tekst (napis albo {t, ages, k, roles, trait}) pasuje do postaci {age, role, traits}:
     ages = wiek postaci, roles = tylko te role, k = tagi, których rola nie może mieć (role.no),
     trait = wymagane wartości cech (np. zdanie o własnym aucie tylko z autem). */
  function fitsWho(o, who) {
    if (!o || typeof o === "string" || !who) return true;
    if (o.ages && who.age && !o.ages.includes(who.age)) return false;
    if (o.cm && who.cm != null && who.g) { const [lo, hi] = o.cm[who.g] || [0, 999]; if (who.cm < lo || who.cm > hi) return false; } // 2.2: zdania o wzroście
    const role = who.role || {};
    if (o.roles && !o.roles.includes(role.id)) return false;
    if (o.k && o.k.some(k => (role.no || []).includes(k))) return false;
    if (o.trait && who.traits && Object.entries(o.trait).some(([t, v]) => who.traits[t] !== v)) return false;
    return true;
  }

  /* ---------------- wielkości ---------------- */
  /* n = podejrzani, k = liczba dowodów; miejsc jest k albo k-1 (dwa dowody w jednym miejscu) */
  const SIZES = {
    S:  { n: 3, k: [2],    name: "Mała" },
    M:  { n: 4, k: [2, 3], name: "Średnia" },
    L:  { n: 5, k: [3],    name: "Duża" },
    XL: { n: 6, k: [3, 4], name: "Ogromna" }
  };

  /* ---------------- archetypy ---------------- */
  const ARCH = {};
  const SIZE_ORDER = Object.keys(SIZES);
  const ALIAS = {};
  function register(a) { ARCH[a.id] = a; for (const x of a.aliases || []) ALIAS[x] = a.id; }
  const archetypeOf = c => { const id = (c && c.archetype) || "classic"; return ARCH[id] || ARCH[ALIAS[id]]; };
  const weightOf = (a, size) => typeof a.weight === "function" ? a.weight(size) : (a.weight == null ? 1 : a.weight);
  /* archetyp losujemy z osobnego strumienia, żeby nie zmieniać losowań samej sprawy */
  function pickArchetype(seed, opts) {
    if (opts.archetype && ARCH[opts.archetype]) return ARCH[opts.archetype];
    const ok = Object.values(ARCH).filter(a => SIZE_ORDER.indexOf(opts.size) >= SIZE_ORDER.indexOf(a.minSize || "S") && weightOf(a, opts.size) > 0 && (!a.supports || a.supports(opts)));
    if (!ok.length) throw new Error("Brak archetypu dla wielkości " + opts.size);
    if (ok.length === 1) return ok[0];
    const R = makeRng(seed + "/arch"), total = ok.reduce((s, a) => s + weightOf(a, opts.size), 0);
    let x = R.next() * total;
    for (const a of ok) { x -= weightOf(a, opts.size); if (x < 0) return a; }
    return ok[ok.length - 1];
  }

  /* ---------------- wspólny kontekst sprawy ---------------- */
  /* Kolejność losowań jest częścią formatu: te same seedy muszą dawać te same sprawy. */
  function context(world, seed, opts) {
    const R = makeRng(seed);
    const B = world.base;
    const cityId = opts.city && world.cities[opts.city] ? opts.city : R.pick(Object.keys(world.cities));
    const city = world.cities[cityId];
    const year = opts.year || R.int(B.years[0], B.years[1]);
    const monthIdx = R.int(0, 11);
    const sizeKey = SIZES[opts.size] ? opts.size : R.pick(Object.keys(SIZES));
    const N = SIZES[sizeKey].n, K = R.pick(SIZES[sizeKey].k);
    const milicja = year === 1989 || (year === 1990 && monthIdx < 4);
    const A = list => avail(list, year, monthIdx);

    const streets = R.shuffle(city.streets);
    const V = {
      city: city.name, district: city.district.nom, district_gen: city.district.gen,
      district_na: city.district.na, district_na_cap: cap(city.district.na), district_po: city.district.po,
      street: streets[0], street2: streets[1],
      market_on: city.market.on, market_from: city.market.from, market_to: city.market.to,
      bar: R.pick(city.bars), church_at: city.church_at, team: R.pick(city.teams), cinema: city.cinema, gazeta: city.gazeta,
      dworzec: city.dworzec, szpital: city.szpital, walk: city.walk, uni: city.uni,
      zaklad_at: R.pick(A(city.zaklad_at)),
      month: B.months[monthIdx], year, police_dat: milicja ? "milicji" : "policji", money: price(B, R, year, "money"), ransom: price(B, R, year, "ransom")
    };
    V.money_gen = moneyGen(V.money); V.ransom_gen = moneyGen(V.ransom); // „z żądaniem 2 tysięcy złotych”
    const T = (s, g, extra) => tx(s, g, extra ? Object.assign({}, V, extra) : V);
    /* w jednej sprawie to samo zdanie nie trafia do dwóch osób (dopóki starcza wariantów) */
    const usedTpl = new Set();
    const pickU = list => { const free = list.filter(x => !usedTpl.has(x)); const c = R.pick(free.length ? free : list); usedTpl.add(c); return c; };
    return { R, B, world, seed, opts, cityId, city, year, monthIdx, sizeKey, N, K, milicja, A, V, T, pickU, streets };
  }

  /* ---------------- solver i generator ---------------- */
  const solver = () => root.SiatkaSolver || require("./solver.js");
  function solve(c, opts) {
    const A = archetypeOf(c);
    if (!A) throw new Error("Nieznany archetyp: " + c.archetype);
    return solver().solve(c, A, opts);
  }

  function generateCase(world, seed, opts = {}) {
    // miasto, rok i wielkość losujemy raz, żeby ponowne próby nie zmieniały proporcji
    const R0 = makeRng(seed + "/opts");
    opts = Object.assign({}, opts);
    if (!world.cities[opts.city]) opts.city = R0.pick(Object.keys(world.cities));
    if (!opts.year) opts.year = R0.int(world.base.years[0], world.base.years[1]);
    if (!SIZES[opts.size]) opts.size = R0.pick(Object.keys(SIZES));
    const Arch = pickArchetype(seed, opts);
    let depthRejects = 0;
    for (let attempt = 0; attempt < 200; attempt++) {
      const c = Arch.build(context(world, `${seed}#${attempt}`, opts));
      if (!c) continue;
      c.archetype = Arch.id; c.question = c.question || Arch.question; c.gen = GEN_VERSION;
      const res = solve(c);
      if (!res.ok) continue;
      // 2.2: odrzucamy sprawy, które rozwiązuje jedna reguła albo jeden wyjątkowo mocny fakt
      const d = solver().depth(c, archetypeOf(c));
      if (d.reject) { depthRejects++; continue; }
      c.seed = String(seed); c.verify = { solutions: res.solutions.length, necessary: res.necessary, tries: attempt + 1, depthRejects,
        depth: { minFacts: d.minFacts, strongRule: d.strongRule, strongFact: d.strongFact } };
      return c;
    }
    throw new Error("Nie udało się wygenerować poprawnej sprawy dla seeda " + seed);
  }

  /* ---------------- sprawa dnia ---------------- */
  const EPOCH = Date.UTC(2026, 10, 3); // 3 listopada 2026 = sprawa #1
  /* pon. mała → niedz. ogromna */
  const WEEK_SIZES = ["XL", "S", "S", "M", "M", "L", "L"]; // indeks = getDay(): 0 = niedziela
  function dailyNumber(date = new Date()) {
    const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((d - EPOCH) / 86400000) + 1;
  }
  const dailySize = (date = new Date()) => WEEK_SIZES[date.getDay()];
  /* ---------------- wersje generatora ----------------
     Sprawa dnia ma być taka sama dla wszystkich i nie może się zmienić w trakcie dnia, więc każda
     wersja generatora obowiązuje od podanego dnia (lokalna data sprawy dnia, RRRR-MM-DD).
     Starsze wersje są zamrożone w engine/versions/ (tools/freeze-version.js) i rejestrują się
     w SiatkaLegacy. Nowe wydanie: zamroź poprzednią wersję, dopisz nową z datą od NAJBLIŻSZEJ
     północy po wdrożeniu (nigdy dziś), podbij GEN_VERSION. Sprawy z archiwum biorą zawsze bieżącą. */
  const GEN_VERSION = "2.2";
  const GENERATOR_VERSIONS = [
    { id: "2.0", from: "2026-11-03", frozen: "engine/versions/v2_0.js" }, // commit 0879423
    { id: "2.1", from: "2026-11-05", frozen: "engine/versions/v2_1.js" }, // commit c3e4f77
    { id: "2.1.1", from: "2026-11-06", frozen: "engine/versions/v2_1_1.js" }, // commit 7b359e1
    { id: "2.1.2", from: "2026-11-11", frozen: "engine/versions/v2_1_2.js" }, // commit 0891a91 (obowiązuje do 14.11 włącznie)
    { id: "2.2", from: "2026-11-15" }                                      // bieżący kod; wydanie przesunięte z 13.11 (nie wdrożone w czwartek), data = północ po dniu wypchnięcia (14.11)
  ];
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function versionFor(date = new Date()) {
    const day = ymd(date); let v = GENERATOR_VERSIONS[0].id;
    for (const x of GENERATOR_VERSIONS) if (x.from <= day) v = x.id;
    return v;
  }
  function legacy(id) {
    const L = root.SiatkaLegacy && root.SiatkaLegacy[id];
    if (L) return L;
    const meta = GENERATOR_VERSIONS.find(x => x.id === id);
    if (meta && meta.frozen && typeof module !== "undefined" && module.exports) { require("../" + meta.frozen); return root.SiatkaLegacy && root.SiatkaLegacy[id]; }
    return null;
  }
  /* 2.2: oś czasu wchodzi do spraw dnia dopiero od TIMELINE_DAILY_FROM (zapowiedź dla graczy); wcześniej sprawa dnia
     jest zawsze classic, a archiwum dostaje oś czasu od razu. */
  const TIMELINE_DAILY_FROM = "2026-11-18";
  const dailyOpts = date => Object.assign({ size: dailySize(date) }, ymd(date) < TIMELINE_DAILY_FROM ? { archetype: "classic" } : {});
  function dailyCase(world, date = new Date()) {
    const n = dailyNumber(date), ver = versionFor(date);
    if (ver !== GEN_VERSION) {
      const L = legacy(ver);
      if (L) { const c = L.dailyCase(date); c.gen = ver; return c; }
      // brak zamrożonej wersji (np. plik się nie wczytał): lepsza inna sprawa niż wywalona gra
      if (typeof console !== "undefined") console.warn("Brak generatora w wersji " + ver + ", sprawa dnia z wersji " + GEN_VERSION);
    }
    const c = generateCase(world, "daily-" + n, dailyOpts(date));
    c.number = n; return c;
  }
  /* wersja generatora, z której pochodzi sprawa (sprawy sprzed wersjonowania nie mają pola gen) */
  const caseVersion = c => (c && c.gen) || GENERATOR_VERSIONS[0].id;

  /* pola `used` z ostatnich spraw gracza → opts.avoid (imiona, nazwiska, role, sceny, smaczki).
     Sprawa dnia nigdy nie dostaje avoid, żeby była taka sama dla wszystkich. */
  const RECENT = 10;
  function avoidFrom(usedList) {
    const out = {};
    for (const u of (usedList || []).slice(-RECENT)) for (const k in u || {}) out[k] = [...new Set([...(out[k] || []), ...u[k]])];
    return out;
  }

  const util = { hash, makeRng, tx, cap, toMin, toHM, plList, plural, inYears, avail, slug, sameSet, money, moneyGen, smallMoney, price, prices, fitsWho, HEIGHT, heightOf, heightClass };
  const api = { makeRng, tx, solve, generateCase, dailyCase, dailyNumber, dailySize, SIZES, util, register, archetypes: ARCH, context, avoidFrom, RECENT,
    GEN_VERSION, GENERATOR_VERSIONS, versionFor, caseVersion, legacy, dailyOpts, TIMELINE_DAILY_FROM };
  root.Siatka = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    // w Node dociągamy solver i archetypy (w przeglądarce ładuje je index.html)
    require("./solver.js");
    require("./archetypes/classic.js");
    require("./archetypes/timeline.js");
  }
})(typeof window !== "undefined" ? window : globalThis);
