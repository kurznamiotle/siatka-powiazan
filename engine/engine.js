/*
 * Siatka Powiązań — silnik: losowanie, solver, generator spraw.
 * Działa w przeglądarce (window.Siatka) i w Node (require).
 *
 * World = { base: SIATKA_BASE, cities: SIATKA_CITIES }
 *
 * Model logiczny sprawy (pole `facts`):
 *   has_key     {who, where}
 *   presence    {who, where, at}  albo {who, where, from, to}
 *   alibi       {who, from, to, confirmed}
 *   trait       {who, trait, value}
 *   item_origin {what, where}
 *   item_moved  {what, from, to}
 * Reguły (pole `rules`): {id, type: alibi|trait|window|key, trait?, value?, text}
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
  const GIDX = { m: 0, f: 1, n: 2 };
  /* najpierw {k} → vars[k], potem [a|b|c] → wariant wg rodzaju */
  function tx(str, g, vars) {
    let s = String(str);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s.replace(/\[([^\[\]]*)\]/g, (_, body) => { const parts = body.split("|"); return parts[Math.min(GIDX[g] || 0, parts.length - 1)]; });
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toHM = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  const plList = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " i " + a[a.length - 1];
  const plural = (n, one, few, many) => { if (n === 1) return one; const d = n % 10, h = n % 100; return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many; };
  const inYears = (o, y) => !o || !o.years || (y >= o.years[0] && y <= o.years[1]);
  /* lista tekstów/obiektów → to, co pasuje do roku (teksty jako stringi) */
  const avail = (list, y) => (Array.isArray(list) ? list : [list]).filter(o => typeof o === "string" || inYears(o, y)).map(o => (typeof o === "object" && o.t !== undefined && !o.id) ? o.t : o);
  const slug = s => s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

  function money(R, year) {
    if (year <= 1989) return `${R.int(2, 9) * 100} tysięcy złotych`;
    if (year < 1995) { const n = R.int(3, 60); return `${n} ${plural(n, "milion", "miliony", "milionów")} złotych`; }
    const n = R.int(2, 15); return `${n} ${plural(n, "tysiąc", "tysiące", "tysięcy")} złotych`;
  }

  /* ---------------- solver ---------------- */
  function indexFacts(c) {
    const ix = { key: new Set(), pres: [], alibi: {}, trait: {}, origin: {}, moved: {}, fate: {}, debunked: new Set() };
    for (const f of c.facts) {
      if (f.type === "has_key") ix.key.add(f.who + "|" + f.where);
      else if (f.type === "presence") ix.pres.push(f);
      else if (f.type === "alibi") (ix.alibi[f.who] = ix.alibi[f.who] || []).push(f);
      else if (f.type === "trait") (ix.trait[f.who] = ix.trait[f.who] || {})[f.trait] = f.value;
      else if (f.type === "item_origin") ix.origin[f.what] = f.where;
      else if (f.type === "item_moved") ix.moved[f.what] = f;
      else if (f.type === "item_fate") ix.fate[f.what] = f.value;
      else if (f.type === "alibi_debunked") ix.debunked.add(f.who);
    }
    return ix;
  }
  function ruleHolds(rule, who, item, ix, c) {
    const loc = ix.origin[item];
    switch (rule.type) {
      case "alibi": {
        const a = toMin(c.time.crime.from), b = toMin(c.time.crime.to);
        if (ix.debunked.has(who)) return true; // alibi obalone w aktach innej osoby
        return !(ix.alibi[who] || []).some(f => f.confirmed && toMin(f.from) <= a && toMin(f.to) >= b);
      }
      case "trait": return !!ix.trait[who] && String(ix.trait[who][rule.trait]) === String(rule.value);
      case "key": return ix.key.has(who + "|" + loc);
      case "fate": return ix.fate[item] === rule.value;
      case "dump": return !!ix.trait[who] && ix.trait[who].habit === ix.fate[item];
      case "window": {
        const mv = ix.moved[item]; if (!mv) return false;
        const a = toMin(mv.from), b = toMin(mv.to);
        return ix.pres.some(p => p.who === who && p.where === loc &&
          (p.at ? (toMin(p.at) >= a && toMin(p.at) <= b) : (toMin(p.from) <= b && toMin(p.to) >= a)));
      }
    }
    return false;
  }
  /* {solutions:[[who,item]], unique, necessary:{ruleId:bool}, ok} */
  function solve(c) {
    const ix = indexFacts(c);
    const people = c.nodes.filter(n => n.type === "person").map(n => n.id);
    const items = c.nodes.filter(n => n.type === "item").map(n => n.id);
    const sols = rules => { const out = []; for (const p of people) for (const i of items) if (rules.every(r => ruleHolds(r, p, i, ix, c))) out.push([p, i]); return out; };
    const solutions = sols(c.rules);
    const necessary = {};
    for (const r of c.rules) necessary[r.id] = sols(c.rules.filter(x => x !== r)).length > 1;
    const unique = solutions.length === 1;
    const matches = unique && c.solution && solutions[0][0] === c.solution.culprit && solutions[0][1] === c.solution.weapon;
    return { solutions, unique, necessary, ok: unique && matches !== false && Object.values(necessary).every(Boolean) };
  }

  /* ---------------- generator ---------------- */
  const TRAITS = ["hand", "shoe", "height", "smoker", "car", "glasses", "dog", "jacket", "motive"];
  /* n = podejrzani, k = liczba dowodów; miejsc jest k albo k-1 (dwa dowody w jednym miejscu) */
  const SIZES = {
    S:  { n: 3, k: [2],    name: "Mała" },
    M:  { n: 4, k: [2, 3], name: "Średnia" },
    L:  { n: 5, k: [3],    name: "Duża" },
    XL: { n: 6, k: [3, 4], name: "Ogromna" }
  };
  const MAX_RULES = 6;
  /* reguły o dowodzie: w = kto był na miejscu w czasie zniknięcia, k = kto ma klucz, f = co stało się z dowodem */
  /* d = narzędzie porzucono tam, gdzie sprawca bywa codziennie (łączy akta przedmiotu z aktami osoby) */
  const ITEM_PATTERNS = ["wk", "wk", "w", "k", "wf", "kf", "wd", "kd", "wd", "wkd"];
  const DUMP = ["smietnik", "tory", "park", "budowa", "bazar"];

  function generateCase(world, seed, opts = {}) {
    // miasto, rok i wielkość losujemy raz, żeby ponowne próby nie zmieniały proporcji
    const R0 = makeRng(seed + "/opts");
    opts = Object.assign({}, opts);
    if (!world.cities[opts.city]) opts.city = R0.pick(Object.keys(world.cities));
    if (!opts.year) opts.year = R0.int(world.base.years[0], world.base.years[1]);
    if (!SIZES[opts.size]) opts.size = R0.pick(Object.keys(SIZES));
    for (let attempt = 0; attempt < 200; attempt++) {
      const c = build(world, `${seed}#${attempt}`, opts);
      if (!c) continue;
      const res = solve(c);
      if (res.ok) { c.seed = String(seed); c.verify = { solutions: res.solutions.length, necessary: res.necessary }; return c; }
    }
    throw new Error("Nie udało się wygenerować poprawnej sprawy dla seeda " + seed);
  }

  function build(world, seed, opts) {
    const R = makeRng(seed);
    const B = world.base;

    /* 0. Miasto, rok, wielkość */
    const cityId = opts.city && world.cities[opts.city] ? opts.city : R.pick(Object.keys(world.cities));
    const city = world.cities[cityId];
    const year = opts.year || R.int(B.years[0], B.years[1]);
    const monthIdx = R.int(0, 11);
    const sizeKey = SIZES[opts.size] ? opts.size : R.pick(Object.keys(SIZES));
    const N = SIZES[sizeKey].n, K = R.pick(SIZES[sizeKey].k);
    const milicja = year === 1989 || (year === 1990 && monthIdx < 4);
    const A = list => avail(list, year);

    const streets = R.shuffle(city.streets);
    const V = {
      city: city.name, district: city.district.nom, district_gen: city.district.gen,
      district_na: city.district.na, district_na_cap: cap(city.district.na), district_po: city.district.po,
      street: streets[0], street2: streets[1],
      market_on: city.market.on, market_from: city.market.from, market_to: city.market.to,
      bar: R.pick(city.bars), church_at: city.church_at, team: R.pick(city.teams), cinema: city.cinema, gazeta: city.gazeta,
      dworzec: city.dworzec, szpital: city.szpital, walk: city.walk, uni: city.uni,
      zaklad_at: R.pick(A(city.zaklad_at)),
      month: B.months[monthIdx], year, police_dat: milicja ? "milicji" : "policji", money: money(R, year)
    };
    const T = (s, g, extra) => tx(s, g, extra ? Object.assign({}, V, extra) : V);
    /* w jednej sprawie to samo zdanie nie trafia do dwóch osób (dopóki starcza wariantów) */
    const usedTpl = new Set();
    const pickU = list => { const free = list.filter(x => !usedTpl.has(x)); const c = R.pick(free.length ? free : list); usedTpl.add(c); return c; };
    const asList = x => Array.isArray(x) ? x : [x];

    /* 1. Reguły o dowodzie i układ miejsc */
    const pattern = R.pick(ITEM_PATTERNS);
    const hasW = pattern.includes("w"), hasK = pattern.includes("k"), hasF = pattern.includes("f"), hasD = pattern.includes("d");
    // dwa dowody w jednym miejscu da się rozróżnić tylko godziną zniknięcia albo losem przedmiotu
    const share = K >= 2 && (hasW || hasF || hasD) && R.chance(.5);
    const nLoc = share ? K - 1 : K;

    /* 2. Zbrodnia, podtyp, scena, miejsca i dowody */
    const items = B.items.filter(it => inYears(it, year));
    const cityLocs = (city.locations || []).filter(l => inYears(l, year));
    const allLocs = [...B.locations, ...cityLocs];
    const locIdSet = new Set(allLocs.map(l => l.id));
    const accessOf = role => [...(role.access || []), ...cityLocs.filter(l => (l.roles || []).includes(role.id)).map(l => l.id)];
    const locsFor = (sub, exclude) => {
      const m = {};
      for (const it of items) if (it.tags.includes(sub)) for (const o of it.origins) {
        if (!locIdSet.has(o) || (exclude && exclude.includes(o))) continue;
        (m[o] = m[o] || []).push(it);
      }
      return m;
    };
    const viable = m => Object.keys(m).length >= nLoc && (!share || Object.values(m).some(a => a.length >= 2));
    const combos = [];
    for (const cid of Object.keys(B.crimes)) {
      if (opts.crime && cid !== opts.crime) continue;
      const cr = B.crimes[cid];
      for (const sub of cr.subtags) for (const sc of cr.scenes.filter(s => inYears(s, year)))
        if (viable(locsFor(sub, sc.exclude))) combos.push([cid, sub, sc]);
    }
    if (!combos.length) return null;
    const crimeId = R.pick([...new Set(combos.map(c => c[0]))]);
    const [, sub, scene] = R.pick(combos.filter(c => c[0] === crimeId));
    const crime = B.crimes[crimeId];
    const itemsByLoc = locsFor(sub, scene.exclude);
    const avLoc = Object.keys(itemsByLoc);
    const localAv = avLoc.filter(id => cityLocs.some(l => l.id === id));
    let locs = [];
    if (share) locs.push(R.pick(avLoc.filter(id => itemsByLoc[id].length >= 2)));
    if (localAv.length && R.chance(.6)) { const c = R.pick(localAv.filter(id => !locs.includes(id))); if (c) locs.push(c); }
    locs = locs.concat(R.sample(avLoc.filter(id => !locs.includes(id)), nLoc - locs.length));
    if (locs.length < nLoc) return null;
    const LOCS = locs.map(id => allLocs.find(l => l.id === id));
    // przedmioty: z miejsca dzielonego dwa, z pozostałych po jednym
    const I = [], locOf = [];
    LOCS.forEach((loc, li) => {
      const n = share && li === 0 ? 2 : 1;
      const cand = R.sample(itemsByLoc[loc.id].filter(it => !I.includes(it)), n);
      cand.forEach(it => { I.push(it); locOf.push(li); });
    });
    if (I.length !== K) return null;

    /* 3. Czas: zbrodnia + po jednym 30-minutowym oknie zniknięcia na dowód */
    const C = R.int(18, 21) * 60 + R.pick([0, 30]);
    const crimeWin = [C, C + 30];
    const order = R.shuffle([...Array(K).keys()]);
    const win = [];
    order.forEach((i, p) => { win[i] = [C - 30 * (K + 1) + 30 * p, C - 30 * K + 30 * p]; });
    const inWin = i => { const [a, b] = win[i]; return R.int((a + 5) / 5, (b - 5) / 5) * 5; };
    // poza wszystkimi oknami: przed pierwszym albo po ostatnim, przed zbrodnią
    const outT = () => R.chance(.5) ? C - 30 * (K + 1) - R.int(3, 8) * 5 : C - 30 + R.int(1, 5) * 5;

    /* 4. Sprawca, narzędzie, fałszywe tropy */
    const sameLoc = (a, b) => locOf[a] === locOf[b];
    let wIdx = R.int(0, K - 1);
    if (share && R.chance(.7)) wIdx = R.pick([...Array(K).keys()].filter(i => locOf[i] === 0));
    const herrings = [...Array(K).keys()].filter(i => i !== wIdx);
    const hMethod = {};
    for (const h of herrings) {
      const ok = [];
      if (hasW) ok.push("window");
      if (hasK && !sameLoc(h, wIdx)) ok.push("key");
      if (hasF) ok.push("fate");
      if (hasD) ok.push("dump");
      if (!ok.length) return null;
      hMethod[h] = R.pick(ok);
    }
    const H = new Set(Object.values(hMethod));
    // los przedmiotów
    const fateIds = hasD ? DUMP : Object.keys(B.fates);
    const fateV = R.pick(fateIds);
    const fate = [];
    I.forEach((_, i) => {
      if (i === wIdx) fate[i] = fateV;
      else if (hMethod[i] === "fate" || hMethod[i] === "dump") fate[i] = R.pick(fateIds.filter(f => f !== fateV));
      else fate[i] = R.pick(fateIds);
    });
    // reguła o losie musi coś eliminować: gdy nie odcina sprawcy od tropu, potrzebny trop z innym losem dla któregoś niewinnego
    if (hasF && !H.has("fate")) { const h = R.pick(herrings); fate[h] = R.pick(fateIds.filter(f => f !== fateV)); }

    /* 5. Reguły osobowe: alibi nie zawsze, za to więcej cech */
    const nInn = N - 1;
    const itemRules = [hasW && "window", hasK && "key", hasF && "fate", hasD && "dump"].filter(Boolean);
    const nonH = itemRules.filter(r => !H.has(r)).length;
    let P = nInn - nonH;
    if (P < 1) return null;
    if (P >= 3 && R.chance(.3)) P--;
    P = Math.min(P, MAX_RULES - itemRules.length);
    if (P < 1) return null;
    const useAlibi = R.chance(.6);
    const traitIds = R.sample(TRAITS, useAlibi ? P - 1 : P);
    const rules = [...(useAlibi ? [{ type: "alibi" }] : []), ...itemRules.map(t => ({ type: t, value: t === "fate" ? fateV : undefined })),
      ...traitIds.map(t => ({ type: "trait", trait: t, value: t === "shoe" ? null : R.pick(B.traits[t].ruleValues || B.traits[t].values) }))];
    if (!rules.some(r => r.type === "alibi" || r.type === "trait")) return null;
    const ruleKey = r => r.type === "trait" ? "trait:" + r.trait : r.type;

    /* 6. Podejrzani */
    const S = [...Array(N)].map(() => ({ g: R.chance(.5) ? "m" : "f", keys: new Set(), pres: [], alibi: false, fakeAlibi: false, traits: {} }));
    const cIdx = R.int(0, N - 1);
    const shoeRule = rules.find(r => r.trait === "shoe");
    if (shoeRule) shoeRule.value = R.pick(B.traits.shoe.values[S[cIdx].g]);
    const shoeFits = g => !shoeRule || B.traits.shoe.values[g].includes(shoeRule.value);
    const valuesOf = (t, g) => t === "shoe" ? B.traits.shoe.values[g] : B.traits[t].values;
    const otherVal = (t, v, g) => R.pick(valuesOf(t, g).filter(x => x !== v));
    S.forEach((s, i) => {
      for (const t of TRAITS) {
        const r = rules.find(x => x.trait === t);
        if (r) s.traits[t] = t === "shoe" ? (shoeFits(s.g) ? r.value : R.pick(valuesOf(t, s.g))) : r.value;
        else if (t === "motive") s.traits[t] = i === cIdx ? "yes" : (R.chance(.35) ? "yes" : "no");
        else s.traits[t] = R.pick(valuesOf(t, s.g));
      }
    });
    const satisfyItem = (s, i) => { if (hasW) s.pres.push({ loc: locOf[i], t: inWin(i) }); if (hasK) s.keys.add(locOf[i]); };

    const cul = S[cIdx];
    satisfyItem(cul, wIdx);
    cul.traits.habit = hasD ? fate[wIdx] : R.pick(DUMP);
    for (const h of herrings) {
      if (hMethod[h] === "window") { if (hasK) cul.keys.add(locOf[h]); if (!sameLoc(h, wIdx) && R.chance(.55)) cul.pres.push({ loc: locOf[h], t: outT() }); }
      else if (hMethod[h] === "key") { if (hasW) cul.pres.push({ loc: locOf[h], t: inWin(h) }); }
      // "fate"/"dump": sprawca może mieć wszystko do tropu, bo i tak odpada z reguły o losie
      else if (R.chance(.5) && !sameLoc(h, wIdx)) satisfyItem(cul, h);
    }

    // niewinni: każdy łamie dokładnie jedną regułę; każda reguła spoza H musi kogoś wyeliminować
    const innocents = [...Array(N).keys()].filter(i => i !== cIdx);
    const assign = {}, free = [];
    for (const i of R.shuffle(innocents)) { if (!shoeFits(S[i].g)) assign[i] = shoeRule; else free.push(i); }
    const covered = new Set(Object.values(assign).map(ruleKey));
    const must = R.shuffle(rules.filter(r => !H.has(r.type) && !covered.has(ruleKey(r))));
    if (must.length > free.length) return null;
    must.forEach((r, k) => { assign[free[k]] = r; });
    for (const i of free.slice(must.length)) assign[i] = R.pick(rules);

    const fateOk = i => !hasF || fate[i] === fateV;
    const okTraps = [...Array(K).keys()].filter(fateOk);
    const elim = {};
    for (const sIdx of innocents) {
      const s = S[sIdx], r = assign[sIdx];
      let trap;
      const habitFor = t => { s.traits.habit = hasD ? fate[t] : R.pick(DUMP); };
      if (r.type === "dump") {
        trap = R.pick(okTraps); satisfyItem(s, trap);
        s.traits.habit = R.pick(DUMP.filter(d => d !== fate[trap]));
      } else if (r.type === "fate") {
        // ktoś, kto mógł zabrać przedmiot, ale nie ten, którego los się zgadza
        const c = herrings.filter(h => !fateOk(h) && (hasW || !sameLoc(h, wIdx)));
        if (!c.length) return null;
        trap = R.pick(c); satisfyItem(s, trap); habitFor(trap);
      } else {
        const pool = okTraps.filter(i => i !== wIdx);
        trap = pool.length && R.chance(.7) ? R.pick(pool) : R.pick(okTraps);
        if (r.type === "alibi") { s.alibi = true; satisfyItem(s, trap); }
        else if (r.type === "trait") { s.traits[r.trait] = otherVal(r.trait, r.value, s.g); satisfyItem(s, trap); }
        else if (r.type === "window") { if (hasK) s.keys.add(locOf[trap]); s.pres.push({ loc: locOf[trap], t: outT() }); }
        else if (r.type === "key") { if (hasK && s.keys.has(locOf[trap])) return null; s.pres.push({ loc: locOf[trap], t: hasW ? inWin(trap) : outT() }); }
        habitFor(trap);
      }
      elim[sIdx] = { rule: r, trap };
    }
    // bez reguły o alibi część niewinnych i tak ma świadków (to tylko tło)
    if (!useAlibi) for (const i of innocents) if (R.chance(.35)) S[i].alibi = true;
    /* ZMYŁKA: fałszywe alibi. Brzmi jak potwierdzone, ale obala je zdanie w aktach innej osoby.
       Najczęściej kłamie sprawca, czasem niewinny, który i tak odpada z innego powodu. */
    if (useAlibi && R.chance(.55)) cul.fakeAlibi = true;
    if (useAlibi && R.chance(.3)) { const c = innocents.filter(i => assign[i].type !== "alibi"); if (c.length) S[R.pick(c)].fakeAlibi = true; }

    /* 7. Tożsamości */
    const roles = [...A(B.roles), ...A(city.roles || []), city.worker].filter(r => r && inYears(r, year));
    const usedFirst = new Set(), usedSur = new Set(), usedRoles = new Set(), ids = [];
    const pickName = g => {
      let first; do { first = R.pick(B.names[g]); } while (usedFirst.has(first)); usedFirst.add(first);
      let sur; do { sur = R.pick(B.surnames); } while (usedSur.has(sur[0])); usedSur.add(sur[0]);
      return { first, last: g === "f" ? sur[1] : sur[0] };
    };
    const SP = sprites();
    const persons = S.map((s, idx) => {
      const { first, last } = pickName(s.g);
      const keyLocs = [...s.keys].map(li => LOCS[li].id);
      const fits = role => role[s.g] && !usedRoles.has(role.id);
      const inter = role => accessOf(role).filter(a => locs.includes(a));
      let pool = roles.filter(r => fits(r) && sameSet(inter(r), keyLocs));
      if (!pool.length) pool = roles.filter(r => fits(r) && inter(r).length === 0);
      if (!pool.length) return null;
      const role = R.pick(pool); usedRoles.add(role.id);
      let id = slug(first); while (ids.includes(id)) id += "2"; ids.push(id);
      const hw = (role.headwear && role.headwear[s.g]) || [];
      const head = hw.length ? R.pick(hw) : "";
      return { idx, s, id, first, last, role,
        sprite: { kind: "portrait", g: s.g, skin: R.int(0, 3), hair: R.pick(SP.HAIR_BY_G[s.g]), hairC: R.int(0, 5),
          head: head || null, headC: R.int(0, 4), outfit: role.outfit, glasses: s.traits.glasses === "yes", smoker: s.traits.smoker === "yes",
          mustache: s.g === "m" && R.chance(.35) } };
    });
    if (persons.some(p => !p)) return null;
    const victim = (() => { const n = pickName(scene.vg || "m"); return `${n.first} ${n.last}`; })();

    /* 8. Fakty strukturalne */
    const facts = [];
    const crimeFrom = toHM(crimeWin[0]), crimeTo = toHM(crimeWin[1]);
    persons.forEach(Pp => {
      const s = Pp.s;
      if (hasK) for (const li of s.keys) facts.push({ type: "has_key", who: Pp.id, where: LOCS[li].id });
      for (const p of s.pres) facts.push({ type: "presence", who: Pp.id, where: LOCS[p.loc].id, at: toHM(p.t) });
      facts.push(s.alibi || s.fakeAlibi ? { type: "alibi", who: Pp.id, from: toHM(crimeWin[0] - R.int(2, 6) * 5), to: toHM(crimeWin[1] + R.int(6, 18) * 5), confirmed: true }
                         : { type: "alibi", who: Pp.id, from: toHM(crimeWin[0] - 10), to: toHM(crimeWin[1] + 60), confirmed: false });
      if (s.fakeAlibi) facts.push({ type: "alibi_debunked", who: Pp.id });
      for (const t of [...TRAITS, "habit"]) facts.push({ type: "trait", who: Pp.id, trait: t, value: s.traits[t] });
    });
    I.forEach((it, i) => {
      facts.push({ type: "item_origin", what: it.id, where: LOCS[locOf[i]].id });
      if (hasW) facts.push({ type: "item_moved", what: it.id, from: toHM(win[i][0]), to: toHM(win[i][1]) });
      facts.push({ type: "item_fate", what: it.id, value: fate[i] });
    });

    /* 9. Reguły: kolejność i teksty */
    const sh = R.shuffle(rules);
    sh.forEach((r, k) => { r.id = "r" + (k + 1); r.text = ruleText(B, R, crime, crimeId, scene, r, crimeFrom, crimeTo, T); });

    /* 10. Węzły i teksty dla gracza */
    const nodes = [];
    const debunks = [];
    const motiveRule = rules.some(r => r.trait === "motive");
    const flavorPool = R.shuffle([...A(B.eraFlavor), ...A(city.flavor || [])]);
    const usedLines = new Set();
    const fresh = list => { const c = R.shuffle(list).find(x => !usedLines.has(x)); if (c) usedLines.add(c); return c; };
    persons.forEach(Pp => {
      const s = Pp.s, g = s.g, text = [];
      LOCS.forEach((loc, li) => {
        const parts = [];
        if (hasK && s.keys.has(li)) parts.push(pickU(accessOf(Pp.role).includes(loc.id) ? B.keyTpl : B.spareKeyTpl).replace(/\{gen\}/g, loc.gen));
        for (const p of s.pres.filter(p => p.loc === li)) parts.push(pickU(B.presenceTpl).replace("{in}", loc.in).replace("{t}", toHM(p.t)));
        if (parts.length) text.push(T(parts.join(" "), g));
      });
      const al = facts.find(f => f.type === "alibi" && f.who === Pp.id);
      if (al.confirmed) {
        const a = s.fakeAlibi ? pickU(B.alibiConfirmed.filter(x => x.debunk)) : pickU(B.alibiConfirmed);
        text.push(T(`Od ${al.from} do ${al.to} ${a.text}.`, g) + " " + cap(T(a.witness, g)) + "."); Pp.alibiTxt = T(a.text, g);
        if (s.fakeAlibi) debunks.push({ who: Pp.idx, line: a.debunk });
      }
      else text.push(T(pickU(B.claimFrame).replace("{x}", pickU(A(B.alibiClaim))), g, { from: al.from }));
      for (const r of rules.filter(r => r.type === "trait")) text.push(traitFact(B, crime, pickU, r.trait, s.traits[r.trait], g, year, T));
      if (hasD || R.chance(.25)) text.push(T(pickU(B.habits[s.traits.habit]), g));
      const nTraitRules = rules.filter(r => r.type === "trait").length;
      const decoy = R.pick(TRAITS.filter(t => t !== "motive" && !rules.some(r => r.trait === t)));
      if (decoy && nTraitRules < 3 && R.chance(.6)) text.push(traitFact(B, crime, pickU, decoy, s.traits[decoy], g, year, T));
      // motyw jako tło: gdy nie jest regułą, część osób z motywem dostaje podejrzane zdanie
      if (!motiveRule && s.traits.motive === "yes" && (Pp.idx !== cIdx || R.chance(.5))) text.push(T(pickU(crime.suspicion), g));
      else {
        const l = R.chance(.5) ? fresh(A(Pp.role.flavor || [])) : flavorPool.find(x => !usedLines.has(x));
        if (l && R.chance(nTraitRules >= 3 ? .6 : .85)) { usedLines.add(l); text.push(T(l, g)); }
      }
      nodes.push({ id: Pp.id, type: "person", g, label: `${Pp.first} ${Pp.last.charAt(0)}.`, name: `${Pp.first} ${Pp.last}`, kind: T(Pp.role[g], g), sprite: Pp.sprite, text });
    });
    for (const d of debunks) {
      const others = nodes.filter(n => n.type === "person" && n.id !== persons[d.who].id);
      const n = R.pick(others);
      n.text.splice(Math.min(n.text.length, 2), 0, T(d.line, n.g));
    }
    const holders = li => persons.filter(Pp => Pp.s.keys.has(li)).map(Pp => `${Pp.first} ${Pp.last}`);
    LOCS.forEach((loc, li) => {
      const text = [T(R.pick(loc.desc))];
      const here = I.filter((_, i) => locOf[i] === li);
      if (here.length > 1) text.push(`Tego wieczoru zniknęły stąd dwie rzeczy: ${plList(here.map(it => it.name.toLowerCase()))}.`);
      if (hasK) { const h = holders(li); text.push(h.length ? `${h.length > 1 ? "Klucze mają" : "Klucz ma"} ${plList(h)}. Zamek nieuszkodzony.` : "Nikt z podejrzanych nie ma tu klucza. Zamek nieuszkodzony."); }
      else text.push(T(R.pick(loc.open || ["Drzwi zwykle stoją otwarte, wejść mógł każdy."])));
      nodes.push({ id: loc.id, type: "location", label: loc.label, name: loc.name, kind: "Miejsce", sprite: { kind: "loc", icon: loc.icon }, text });
    });
    I.forEach((it, i) => {
      const gone = { m: "Zniknął", f: "Zniknęła", n: "Zniknęło" }[it.g];
      const from = LOCS[locOf[i]].from;
      const text = [R.pick(it.desc), hasW ? `${gone} ${from} między ${toHM(win[i][0])} a ${toHM(win[i][1])}.` : `${gone} ${from} tego dnia.`, T(B.fates[fate[i]].item, it.g)];
      nodes.push({ id: it.id, type: "item", g: it.g, label: it.label, name: it.name, kind: "Przedmiot", sprite: { kind: "item", shape: it.icon.shape, pal: it.icon.p }, text });
    });

    /* 11. Połączenia zgodne z faktami, obwód sprawcy */
    const supported = [];
    persons.forEach(Pp => LOCS.forEach((loc, li) => {
      if (Pp.s.keys.has(li) || Pp.s.pres.some(p => p.loc === li)) {
        supported.push([Pp.id, loc.id]);
        I.forEach((it, i) => { if (locOf[i] === li) supported.push([Pp.id, it.id]); });
      }
    }));
    I.forEach((it, i) => supported.push([LOCS[locOf[i]].id, it.id]));
    const C0 = persons[cIdx], wLoc = LOCS[locOf[wIdx]];
    const chain = [[C0.id, wLoc.id], [wLoc.id, I[wIdx].id], [C0.id, I[wIdx].id]];

    /* 12. Podpowiedzi, rozumowanie, epilog */
    const ruleNo = r => r.id.slice(1);
    const hintRules = [...new Set([...innocents.map(i => elim[i].rule), ...rules.filter(r => H.has(r.type))])];
    let hints = R.shuffle(hintRules).map(r => hintText(B, r, ruleNo(r), crimeFrom, crimeTo, hasW));
    if (debunks.length) hints.splice(R.int(0, 1), 0, "Nie każde alibi się trzyma. Porównaj, co mówią o tym samym wieczorze różne osoby.");
    hints = hints.slice(0, 3);
    const why = innocents.map(sIdx => {
      const Pp = persons[sIdx], e = elim[sIdx];
      return [Pp.first, whyText(B, Pp, e, LOCS[locOf[e.trap]], locOf[e.trap], I[e.trap], fate[e.trap], ruleNo(e.rule), hasW, hasK, T)];
    });
    why.push([C0.first, T(`spełnia wszystkie reguły: ${describeCulprit(B, rules, wLoc, hasW, hasK, useAlibi, C0.s.fakeAlibi, T(B.fates[fate[wIdx]].place || ""))}.`, C0.s.g)]);
    const hNames = herrings.map(h => I[h].name.toLowerCase());
    why.push([cap(plList(hNames)), hNames.length > 1
      ? "to fałszywe tropy. Żaden nie pasuje do reguł o tym, skąd, kiedy i przez kogo zniknęło narzędzie."
      : "to fałszywy trop. Nie pasuje do reguł o tym, skąd, kiedy i przez kogo zniknęło narzędzie."]);
    const tTake = C0.s.pres.find(p => p.loc === locOf[wIdx] && p.t >= win[wIdx][0] && p.t <= win[wIdx][1]);
    const sceneTo = T(scene.to);
    const epilogue = T(`${C0.first} ${R.pick(crime.motives)}. ${tTake ? "O " + toHM(tTake.t) : "Tego wieczoru"} [zabrał|zabrała] ${I[wIdx].acc} ${wLoc.from} ${crime.epilogueEnd}`, C0.s.g, { to: sceneTo });

    const vg = scene.vg || "m";
    const intro = [`${V.district}, ${V.city}, ${V.month} ${year}.`, T(scene.intro, vg, { victim }), T(crime.cause[sub], vg), crime.itemsSentence].join(" ");
    const quips = [...B.quips, ...(city.quips || [])];

    return {
      case_id: "case_" + seed.replace(/[^a-z0-9]+/gi, "_"),
      city: cityId, city_name: city.name, district: city.district.nom, year, month: V.month, size: sizeKey,
      crime: crimeId, title: T(scene.title), intro, tool_label: crime.toolLabel,
      time: { crime: { from: crimeFrom, to: crimeTo } },
      nodes, facts, rules: sh.map(r => ({ id: r.id, type: r.type, trait: r.trait, value: r.value, text: r.text })),
      solution: { culprit: C0.id, weapon: I[wIdx].id },
      eliminations: Object.fromEntries(innocents.map(sIdx => [persons[sIdx].id, elim[sIdx].rule.id])),
      red_herrings: herrings.map(h => I[h].id),
      supported_connections: supported, culprit_chain: chain,
      hints, why, epilogue, quip: T(R.pick(quips)),
      detective: milicja ? `Porucznik ${B.detective} z MO` : `Komisarz ${B.detective}`,
      culprit_name: `${C0.first} ${C0.last}`, weapon_name: I[wIdx].name
    };
  }

  /* ---------------- pomocnicze teksty ---------------- */
  function ruleText(B, R, crime, crimeId, scene, r, a, b, T) {
    const pickL = x => R.pick(Array.isArray(x) ? x : [x]);
    if (r.type === "alibi") return pickL(crime.alibiRule).replace("{ev}", crime.alibiEvent).replace("{a}", a).replace("{b}", b);
    if (r.type === "window") return pickL(crime.windowRule);
    if (r.type === "key") return pickL(crime.keyRule);
    if (r.type === "fate") return T(B.fates[r.value].rule, "m");
    if (r.type === "dump") return pickL(B.dumpRule);
    if (r.trait === "motive") return pickL(crime.motiveRule);
    const def = B.traits[r.trait];
    if (r.trait === "hand" && crimeId === "zabojstwo") return pickL(def.ruleMurder[r.value]);
    const tpl = pickL(Array.isArray(def.rule) || typeof def.rule === "string" ? def.rule : def.rule[r.value]);
    return cap(T(tpl, "m", { v: r.value, where: scene.where }));
  }
  function traitFact(B, crime, pickU, trait, value, g, year, T) {
    const def = B.traits[trait];
    if (def.fromCrime) return T(pickU(value === "yes" ? crime.suspicion : crime.noMotive), g);
    const list = avail(Array.isArray(def.facts) ? def.facts : def.facts[value], year);
    return T(pickU(list), g, { v: value });
  }
  function hintText(B, r, n, a, b, hasW) {
    if (r.type === "alibi") return `Reguła ${n}: kto ma potwierdzone alibi na ${a}–${b}?`;
    if (r.type === "window") return `Reguła ${n}: porównaj godziny zniknięcia dowodów z tym, kto i kiedy był na miejscu.`;
    if (r.type === "key") return hasW ? `Reguła ${n}: kto był przy dowodzie we właściwym czasie, ale nie miał klucza?` : `Reguła ${n}: sprawdź, kto ma klucze do których miejsc.`;
    if (r.type === "fate") return `Reguła ${n}: sprawdź w aktach przedmiotów, co się z każdym z nich stało.`;
    if (r.type === "dump") return `Reguła ${n}: porównaj, gdzie znaleziono przedmioty, z tym, gdzie kto bywa codziennie.`;
    const h = B.traits[r.trait].hint; return `Reguła ${n}: ${h.charAt(0).toLowerCase() + h.slice(1)}`;
  }
  function whyText(B, Pp, e, loc, li, item, itemFate, n, hasW, hasK, T) {
    const r = e.rule, g = Pp.s.g;
    if (r.type === "alibi") return T(`ma potwierdzone alibi: ${Pp.alibiTxt} (reguła ${n}).`, g);
    if (r.type === "dump") return T(`[mógł|mogła] zabrać ${item.acc}, ale nie bywa codziennie ${T(B.fates[itemFate].place, g)}, gdzie [go|ją|je] znaleziono (reguła ${n}).`.replace(/\[go\|ją\|je\]/, ["go", "ją", "je"][{ m: 0, f: 1, n: 2 }[item.g]]), g);
    if (r.type === "window") {
      const p = Pp.s.pres.find(x => x.loc === li);
      return T(`${hasK ? `ma klucz do ${loc.gen}, ale ` : ""}[był|była] ${loc.in} o ${toHM(p.t)}, poza czasem zniknięcia dowodów (reguła ${n}).`, g);
    }
    if (r.type === "key") return T(`[był|była] ${loc.in}${hasW ? " we właściwym czasie" : ""}, ale nie ma klucza (reguła ${n}).`, g);
    if (r.type === "fate") return T(`[mógł|mogła] zabrać ${item.acc}, ale ${T(B.fates[itemFate].item, item.g).replace(/\.$/, "").toLowerCase()}, a to nie zgadza się z regułą ${n}.`, g);
    const def = B.traits[r.trait];
    const wf = typeof def.whyFail === "string" ? def.whyFail : def.whyFail[r.value];
    return T(`${wf} (reguła ${n}).`, g, { v: Pp.s.traits[r.trait] });
  }
  function describeCulprit(B, rules, loc, hasW, hasK, useAlibi, fake, dumpPlace) {
    const bits = [];
    if (hasK) bits.push(`ma klucz do ${loc.gen}`);
    if (hasW) bits.push(`[był|była] ${loc.in} we właściwym czasie`);
    if (useAlibi) bits.push(fake ? "[jego|jej] alibi okazało się kłamstwem" : "nie ma alibi");
    for (const r of rules.filter(r => r.type === "trait")) {
      const w = B.traits[r.trait].why;
      bits.push(typeof w === "string" ? w.replace("{v}", r.value) : w[r.value]);
    }
    if (rules.some(r => r.type === "fate")) bits.push("a los narzędzia zgadza się z ustaleniami");
    if (rules.some(r => r.type === "dump")) bits.push(`a narzędzie znaleziono ${dumpPlace}, gdzie [bywa|bywa] codziennie`);
    return bits.join(", ");
  }

  function sprites() {
    if (root.SiatkaSprites) return root.SiatkaSprites;
    if (typeof require !== "undefined") return require("./sprites.js");
    throw new Error("Brak modułu sprites");
  }

  /* ---------------- sprawa dnia ---------------- */
  const EPOCH = Date.UTC(2026, 10, 3); // 3 listopada 2026 = sprawa #1
  /* pon. mała → niedz. ogromna */
  const WEEK_SIZES = ["XL", "S", "S", "M", "M", "L", "L"]; // indeks = getDay(): 0 = niedziela
  function dailyNumber(date = new Date()) {
    const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((d - EPOCH) / 86400000) + 1;
  }
  function dailyCase(world, date = new Date()) {
    const n = dailyNumber(date);
    const c = generateCase(world, "daily-" + n, { size: WEEK_SIZES[date.getDay()] });
    c.number = n; return c;
  }

  const api = { makeRng, tx, solve, generateCase, dailyCase, dailyNumber, SIZES };
  root.Siatka = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
