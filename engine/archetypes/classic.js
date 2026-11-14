/*
 * Siatka Powiązań — archetyp „classic”: jeden sprawca, każdy niewinny odpada z dokładnie jednej reguły.
 * Pytanie: kto i czym (culprit_weapon). Hipoteza: {culprit, weapon}.
 *
 * build(ctx) dostaje od silnika wspólny kontekst sprawy (RNG, miasto, rok, wielkość, wstawki V,
 * funkcje tekstu T i pickU) i zwraca obiekt sprawy albo null (wtedy silnik losuje ponownie).
 */
(function (root) {
  const Eng = root.Siatka || require("../engine.js");
  const t = Eng.t;
  const { tx, cap, toMin, toHM, plList, plural, inYears, avail, slug, sameSet, smallMoney, prices, fitsWho, fitsAt, atTexts, HEIGHT, heightOf, heightClass } = Eng.util;
  const Solver = root.SiatkaSolver || require("../solver.js");
  const TRAITS = ["hand", "shoe", "height", "smoker", "car", "glasses", "dog", "jacket", "motive", "known"];
  /* 2.2: reguły nietypowe (przeczenie = cecha known, porównanie wzrostu, relacja, zeszyt dozorcy); limit na sprawę */
  const UNUSUAL = ["known", "cmp", "relation", "absent"];
  const RELS = ["workmate", "stairwell", "inlaw"];
  const MAX_RULES = 6;
  /* reguły o dowodzie: w = kto był na miejscu w czasie zniknięcia, k = kto ma klucz, f = co stało się z dowodem */
  /* d = narzędzie porzucono tam, gdzie sprawca bywa codziennie (łączy akta przedmiotu z aktami osoby) */
  const ITEM_PATTERNS = ["wk", "wk", "w", "k", "wf", "kf", "wd", "kd", "wd", "wkd"];
  const DUMP = ["smietnik", "tory", "park", "budowa", "bazar"];
  /* mała litera tylko na początku nazwy: „Łucznik”, „Sama” i inne nazwy własne zostają duże */
  const lc1 = s => s.charAt(0).toLowerCase() + s.slice(1);
  /* teksty tylko dla pasującej postaci: `ages` (emeryci bez firmowego Żuka), `k` kontra role.no
     (licealista bez długów i zwolnień), `roles` (smaczki zawodu), `trait` (zdanie o własnym aucie tylko z autem) */
  const who = Pp => ({ age: Pp.age, role: Pp.role, traits: Pp.s.traits, cm: Pp.cm, g: Pp.s.g, vt: Pp.vt });
  const ofWho = (list, Pp) => (Array.isArray(list) ? list : [list]).filter(o => fitsWho(o, who(Pp)));
  const txt = o => typeof o === "string" ? o : o.t;
  /* rola pasuje do cech postaci: licealista bez auta, taksówkarz z autem */
  const roleFitsTraits = (role, s) => !role.need || Object.entries(role.need).every(([t, v]) => s.traits[t] === v);
  /* ile dowodów rzeczowych [min, max] na wielkość sprawy */
  const EV_COUNT = { S: [1, 2], M: [1, 2], L: [2, 3], XL: [3, 4] };
  const LIE_DOCS = 0.3; // szansa, że dokumenty alibi w sprawie obalają alibi zamiast je potwierdzać

  function build(ctx) {
    /* 0. Wspólny kontekst z silnika: miasto, rok, wielkość, wstawki i teksty */
    const { R, B, seed, opts, cityId, city, year, monthIdx, sizeKey, N, K, milicja, A, V, T, pickU } = ctx;
    /* opts.avoid: imiona, nazwiska, role, sceny i smaczki z ostatnich spraw gracza (tylko archiwum).
       Omijamy je, dopóki starcza innych; przy pustym avoid losowania są takie same jak bez niego. */
    const AV = opts.avoid || {}, avoidOf = k => new Set(AV[k] || []);
    const avN = avoidOf("names"), avSur = avoidOf("surnames"), avR = avoidOf("roles"), avS = avoidOf("scenes"), avF = avoidOf("flavor");
    const prefer = (list, bad) => { const f = list.filter(x => !bad(x)); return f.length ? f : list; };

    /* 1. Reguły o dowodzie i układ miejsc */
    const pattern = R.pick(ITEM_PATTERNS);
    const hasW = pattern.includes("w"), hasK = pattern.includes("k"), hasF = pattern.includes("f"), hasD = pattern.includes("d");
    // dwa dowody w jednym miejscu da się rozróżnić tylko godziną zniknięcia albo losem przedmiotu
    const share = K >= 2 && (hasW || hasF || hasD) && R.chance(.5);
    const nLoc = share ? K - 1 : K;

    /* 2. Zbrodnia, podtyp, scena, miejsca i dowody */
    const items = B.items.filter(it => inYears(it, year, monthIdx));
    const cityLocs = (city.locations || []).filter(l => inYears(l, year, monthIdx));
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
      for (const sub of cr.subtags) for (const sc of cr.scenes.filter(s => inYears(s, year, monthIdx)))
        if (viable(locsFor(sub, sc.exclude))) combos.push([cid, sub, sc]);
    }
    if (!combos.length) return null;
    const crimeId = R.pick([...new Set(combos.map(c => c[0]))]);
    const [, sub, scene] = R.pick(prefer(combos.filter(c => c[0] === crimeId), c => avS.has(c[2].title)));
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
    // scena może nadpisać godziny zbrodni (time:[od, do]), np. poczta przed zamknięciem
    const C = scene.time ? R.int(toMin(scene.time[0]) / 30, toMin(scene.time[1]) / 30 - 1) * 30 : R.int(18, 21) * 60 + R.pick([0, 30]);
    const crimeWin = [C, C + 30];
    const order = R.shuffle([...Array(K).keys()]);
    const win = [];
    order.forEach((i, p) => { win[i] = [C - 30 * (K + 1) + 30 * p, C - 30 * K + 30 * p]; });
    const inWin = i => { const [a, b] = win[i]; return R.int((a + 5) / 5, (b - 5) / 5) * 5; };
    /* poza wszystkimi oknami: przed pierwszym albo po ostatnim, przed zbrodnią. Alibi (potwierdzone
       i „twierdzi”) zaczyna się najwcześniej o C-10, więc późna gałąź kończy się przed nim (2.1.2). */
    const ALIBI_FROM = C - 10, MIN_GAP = 15;
    const outT = () => R.chance(.5) ? C - 30 * (K + 1) - R.int(3, 8) * 5 : C - 30 + R.int(1, 3) * 5;
    /* 2.1.2: obecność nigdy nie wypada w trakcie alibi ani mniej niż 15 min od obecności tej osoby w innym
       miejscu. Przy kolizji losuje czas od nowa (do 10 razy); zwraca false, gdy się nie udało. */
    const addPresence = (s, loc, gen) => {
      for (let k = 0; k < 10; k++) {
        const t = gen();
        if (t >= ALIBI_FROM || s.pres.some(p => p.loc !== loc && Math.abs(p.t - t) < MIN_GAP)) continue;
        if (s.yard != null && loc !== -1 && Math.abs(s.yard - t) < MIN_GAP) continue;
        if (loc === -1) s.yard = t; else s.pres.push({ loc, t });
        return true;
      }
      return false;
    };

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
    const traitIds = R.sample(TRAITS.filter(t => t !== "known"), useAlibi ? P - 1 : P);
    const rules = [...(useAlibi ? [{ type: t("gen.classic.alibi") }] : []), ...itemRules.map(t => ({ type: t, value: t === "fate" ? fateV : undefined })),
      ...traitIds.map(t => ({ type: "trait", trait: t, value: t === "shoe" ? null : R.pick(B.traits[t].ruleValues || B.traits[t].values) }))];
    /* 2.2: reguły nietypowe zastępują reguły cech: najwyżej 1 w S–M, 2 w L–XL */
    {
      const uMax = sizeKey === "S" || sizeKey === "M" ? 1 : 2;
      let nU = R.chance(.6) ? R.int(1, uMax) : 0;
      for (const kind of R.shuffle(UNUSUAL).slice(0, nU)) {
        const pool = rules.filter(r => r.type === "trait" && !r.u);
        if (!pool.length) break;
        const old = (kind === "cmp" && pool.find(r => r.trait === "height")) || R.pick(pool);
        rules[rules.indexOf(old)] = kind === "known" ? { type: "trait", trait: "known", value: R.pick(B.traits.known.ruleValues), u: 1 }
          : kind === "cmp" ? { type: "cmp", u: 1 } : kind === "relation" ? { type: "relation", rel: R.pick(RELS), u: 1 } : { type: "absent", u: 1 };
      }
    }
    if (rules.some(r => r.type === "cmp") && rules.some(r => r.trait === "height")) return null;
    if (rules.some(r => r.trait === "known") && rules.some(r => r.trait === "motive")) return null;
    if (!rules.some(r => r.type === t("gen.classic.alibi") || r.type === "trait" || r.u)) return null;
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
    const satisfyItem = (s, i) => { if (hasW && !addPresence(s, locOf[i], () => inWin(i))) return false; if (hasK) s.keys.add(locOf[i]); return true; };

    const cul = S[cIdx];
    if (!satisfyItem(cul, wIdx)) return null;
    cul.traits.habit = hasD ? fate[wIdx] : R.pick(DUMP);
    for (const h of herrings) {
      if (hMethod[h] === "window") { if (hasK) cul.keys.add(locOf[h]); if (!sameLoc(h, wIdx) && R.chance(.55)) addPresence(cul, locOf[h], outT); }
      else if (hMethod[h] === "key") { if (hasW && !addPresence(cul, locOf[h], () => inWin(h))) return null; }
      // "fate"/"dump": sprawca może mieć wszystko do tropu, bo i tak odpada z reguły o losie
      else if (R.chance(.5) && !sameLoc(h, wIdx)) satisfyItem(cul, h); // opcjonalne: przy kolizji pomijamy
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
    // 2.2: porównanie wzrostu w L–XL odcina co najmniej 2 osoby: drugiego odpadającego bierzemy z wolnych niewinnych
    { const cr = rules.find(r => r.type === "cmp");
      if (cr && (sizeKey === "L" || sizeKey === "XL")) { const extra = free.slice(must.length).filter(i => assign[i] !== cr);
        while (innocents.filter(i => assign[i] === cr).length < 2 && extra.length) assign[extra.pop()] = cr; } }

    const fateOk = i => !hasF || fate[i] === fateV;
    const okTraps = [...Array(K).keys()].filter(fateOk);
    const elim = {};
    for (const sIdx of innocents) {
      const s = S[sIdx], r = assign[sIdx];
      let trap;
      const habitFor = t => { s.traits.habit = hasD ? fate[t] : R.pick(DUMP); };
      if (r.type === "dump") {
        trap = R.pick(okTraps); if (!satisfyItem(s, trap)) return null;
        s.traits.habit = R.pick(DUMP.filter(d => d !== fate[trap]));
      } else if (r.type === "fate") {
        // ktoś, kto mógł zabrać przedmiot, ale nie ten, którego los się zgadza
        const c = herrings.filter(h => !fateOk(h) && (hasW || !sameLoc(h, wIdx)));
        if (!c.length) return null;
        trap = R.pick(c); if (!satisfyItem(s, trap)) return null; habitFor(trap);
      } else {
        const pool = okTraps.filter(i => i !== wIdx);
        trap = pool.length && R.chance(.7) ? R.pick(pool) : R.pick(okTraps);
        if (r.type === t("gen.classic.alibi")) { s.alibi = true; if (!satisfyItem(s, trap)) return null; }
        else if (r.type === "trait") { s.traits[r.trait] = otherVal(r.trait, r.value, s.g); if (!satisfyItem(s, trap)) return null; }
        else if (r.u) { if (!satisfyItem(s, trap)) return null; } // cmp, relation, absent: wartości po tożsamościach
        else if (r.type === "window") { if (hasK) s.keys.add(locOf[trap]); if (!addPresence(s, locOf[trap], outT)) return null; }
        else if (r.type === "key") { if (hasK && s.keys.has(locOf[trap])) return null; if (!addPresence(s, locOf[trap], hasW ? () => inWin(trap) : outT)) return null; }
        habitFor(trap);
      }
      elim[sIdx] = { rule: r, trap };
    }
    /* 2.2: zeszyt dozorcy. Przed zbrodnią, poza alibi i co najmniej 15 min od innych obecności tej osoby.
       Lista nie może sama eliminować większości podejrzanych. */
    const absentRule = rules.find(r => r.type === "absent");
    if (absentRule) {
      absentRule.a = C - 90; absentRule.b = C - 30;
      const on = innocents.filter(i => assign[i] === absentRule);
      if (on.length > Math.max(1, Math.floor((N - 1) / 2))) return null;
      for (const i of on) if (!addPresence(S[i], -1, () => R.int((absentRule.a + 5) / 5, (absentRule.b - 5) / 5) * 5)) return null;
    }
    // bez reguły o alibi część niewinnych i tak ma świadków (to tylko tło)
    if (!useAlibi) for (const i of innocents) if (R.chance(.35)) S[i].alibi = true;
    /* ZMYŁKA: fałszywe alibi. Brzmi jak potwierdzone, ale obala je zdanie w aktach innej osoby.
       Najczęściej kłamie sprawca, czasem niewinny, który i tak odpada z innego powodu. */
    if (useAlibi && R.chance(.55)) cul.fakeAlibi = true;
    if (useAlibi && R.chance(.3)) { const c = innocents.filter(i => assign[i].type !== t("gen.classic.alibi")); if (c.length) S[R.pick(c)].fakeAlibi = true; }

    /* 7. Tożsamości */
    const roles = [...A(B.roles), ...A(city.roles || []), city.worker].filter(r => r && inYears(r, year, monthIdx));
    const usedFirst = new Set(), usedSur = new Set(), usedRoles = new Set(), ids = [];
    /* imię z pokolenia roli (emerytka to raczej Leokadia, studentka Agnieszka) */
    const AGES = ["young", "mid", "old"];
    const agesOf = role => !role || !role.age ? AGES : Array.isArray(role.age) ? role.age : [role.age];
    const pickName = (g, age) => {
      const pool = (age ? [age] : AGES).flatMap(a => B.names[g][a]).filter(n => !usedFirst.has(n));
      const first = R.pick(prefer(pool, n => avN.has(n))); usedFirst.add(first);
      const sur = R.pick(prefer(B.surnames.filter(x => !usedSur.has(x[0])), x => avSur.has(x[0]))); usedSur.add(sur[0]);
      return { first, last: g === "f" ? sur[1] : sur[0] };
    };
    // siwizna u starszych, bez siwych włosów u młodych (indeksy z SiatkaSprites.HAIR_C)
    const HAIR_BY_AGE = { young: [0, 1, 2, 5], mid: [0, 1, 2, 3, 5], old: [3, 4, 4] };
    const SP = sprites();
    const persons = S.map((s, idx) => {
      const keyLocs = [...s.keys].map(li => LOCS[li].id);
      const fits = role => role[s.g] && !usedRoles.has(role.id) && roleFitsTraits(role, s);
      const inter = role => accessOf(role).filter(a => locs.includes(a));
      let pool = roles.filter(r => fits(r) && sameSet(inter(r), keyLocs));
      if (!pool.length) pool = roles.filter(r => fits(r) && inter(r).length === 0);
      if (!pool.length) return null;
      const role = R.pick(prefer(pool, r => avR.has(r.id))); usedRoles.add(role.id);
      const age = R.pick(agesOf(role));
      const { first, last } = pickName(s.g, age);
      let id = slug(first); while (ids.includes(id)) id += "2"; ids.push(id);
      const hw = (role.headwear && role.headwear[s.g]) || [];
      const head = hw.length ? R.pick(hw) : "";
      return { idx, s, id, first, last, role, age, vt: scene.vt,
        sprite: { kind: "portrait", g: s.g, skin: R.int(0, 3), hair: R.pick(SP.HAIR_BY_G[s.g]), hairC: R.pick(HAIR_BY_AGE[age]),
          head: head || null, headC: R.int(0, 4), outfit: role.outfit, glasses: s.traits.glasses === "yes", smoker: s.traits.smoker === "yes",
          mustache: s.g === "m" && R.chance(.35) } };
    });
    if (persons.some(p => !p)) return null;
    const victim = (() => { const n = pickName(scene.vg || "m", scene.vage || R.pick(["mid", "old"])); return `${n.first} ${n.last}`; })();
    /* 2.2: wzrost w cm z realnego rozkładu wg płci, niezależnie od reguł. Tylko gdy wzrost opisowy jest regułą,
       losujemy z klasy wylosowanej wcześniej (wysoki/niski); opis zawsze wynika z liczby. */
    const heightRule = rules.some(r => r.trait === "height");
    persons.forEach(Pp => { Pp.cm = heightOf(R, Pp.s.g, heightRule ? Pp.s.traits.height : null); Pp.s.traits.height = heightClass(Pp.s.g, Pp.cm); });
    /* porównanie: miarą jest świadek spoza podejrzanych, ze wzrostem w regule. Kierunek losowy. Nikt z podejrzanych
       nie jest w promieniu 3 cm od miary; odpadają co najmniej 1 (L–XL: 2) podejrzani, ale nie wszyscy niewinni. */
    const cmpRule = rules.find(r => r.type === "cmp");
    if (cmpRule) {
      const fail = innocents.filter(i => assign[i] === cmpRule), need = Math.max(fail.length, sizeKey === "L" || sizeKey === "XL" ? 2 : 1);
      const refG = R.chance(.5) ? "m" : "f", H = HEIGHT[refG];
      let opts = [];
      // wzrosty są z tego samego rozkładu co zawsze; gdy żadna miara nie pasuje do układu, losujemy je od nowa (do 40 razy)
      // najlepiej, gdy porównanie odcina dokładnie przypisanych mu niewinnych (inaczej ich druga reguła przestaje być konieczna)
      let exact = [];
      for (let k = 0; k < 40 && !exact.length; k++) {
        if (k) persons.forEach(Pp => { Pp.cm = heightOf(R, Pp.s.g, null); Pp.s.traits.height = heightClass(Pp.s.g, Pp.cm); });
        for (const dir of ["up", "down"]) for (let v = H.lo; v <= H.hi; v++) {
          if (persons.some(Pp => Math.abs(Pp.cm - v) <= 3)) continue;
          const pass = Pp => dir === "up" ? Pp.cm > v : Pp.cm < v;
          if (!pass(persons[cIdx]) || fail.some(i => pass(persons[i]))) continue;
          const nf = innocents.filter(i => !pass(persons[i])).length;
          if (nf >= need && nf < innocents.length) opts.push([dir, v, nf]);
        }
        exact = opts.filter(o => o[2] === fail.length);
        if (!exact.length && k < 39) opts = [];
      }
      if (exact.length) opts = exact;
      if (!opts.length) return null;
      const least = Math.min(...opts.map(o => o[2])), [dir, v] = R.pick(opts.filter(o => o[2] === least));
      const n = pickName(refG, R.pick(["young", "mid", "old"]));
      Object.assign(cmpRule, { dir, refCm: v, refName: `${n.first} ${n.last}`, refG });
    }
    /* relacja z osobą spoza podejrzanych. Kto nie odpada z tej reguły, ma z nią relację z reguły (sprawca też),
       odpadający mają inną relację, więc nazwisko pada w teczkach wielu osób i samo niczego nie zdradza. */
    const relRule = rules.find(r => r.type === "relation");
    if (relRule) {
      const refG = R.chance(.5) ? "m" : "f", n = pickName(refG, R.pick(["mid", "old"]));
      Object.assign(relRule, { refName: `${n.first} ${n.last}`, refG });
      const fitsT = (Pp, t) => t !== "workmate" || fitsWho({ k: ["job"] }, who(Pp));
      const fail = innocents.filter(i => assign[i] === relRule), keep = persons.filter(Pp => !fail.includes(Pp.idx));
      // relacja z reguły musi pasować do wszystkich, którzy ją mają (student nie pracuje w zakładzie)
      const okRel = RELS.filter(t => keep.every(Pp => fitsT(Pp, t)));
      if (!okRel.length) return null;
      if (!okRel.includes(relRule.rel)) relRule.rel = R.pick(okRel);
      for (const Pp of keep) Pp.rel = relRule.rel;
      const others = R.shuffle(RELS.filter(t => t !== relRule.rel));
      fail.forEach((i, k) => { const Pp = persons[i], ok = others.filter(t => fitsT(Pp, t)); if (!ok.length) return; Pp.rel = ok[k % ok.length]; });
      // nazwisko pada w co najmniej 2 (S–M) albo 3 (L–XL) teczkach i co najmniej jeden odpadający ma inną relację
      if (persons.filter(Pp => Pp.rel).length < (sizeKey === "L" || sizeKey === "XL" ? 3 : 2) || !fail.some(i => persons[i].rel)) return null;
    }

    /* 8. Fakty strukturalne */
    const facts = [];
    const crimeFrom = toHM(crimeWin[0]), crimeTo = toHM(crimeWin[1]);
    persons.forEach(Pp => {
      const s = Pp.s;
      if (hasK) for (const li of s.keys) facts.push({ type: "has_key", who: Pp.id, where: LOCS[li].id });
      for (const p of s.pres) facts.push({ type: "presence", who: Pp.id, where: LOCS[p.loc].id, at: toHM(p.t) });
      facts.push(s.alibi || s.fakeAlibi ? { type: t("gen.classic.alibi"), who: Pp.id, from: toHM(crimeWin[0] - R.int(1, 2) * 5), to: toHM(crimeWin[1] + R.int(6, 18) * 5), confirmed: true }
                         : { type: t("gen.classic.alibi"), who: Pp.id, from: toHM(crimeWin[0] - 10), to: toHM(crimeWin[1] + 60), confirmed: false });
      if (s.fakeAlibi) facts.push({ type: "alibi_debunked", who: Pp.id });
      for (const t of [...TRAITS, "habit"]) facts.push({ type: "trait", who: Pp.id, trait: t, value: s.traits[t] });
      facts.push({ type: "trait", who: Pp.id, trait: "height_cm", value: Pp.cm });
      if (Pp.rel) facts.push({ type: "relation", a: Pp.id, b: relRule.refName, rel: Pp.rel });
      if (s.yard != null) facts.push({ type: "roster_entry", who: Pp.id, where: "podworko", at: toHM(s.yard) });
    });
    if (absentRule) facts.push({ type: "roster", where: "podworko", from: toHM(absentRule.a), to: toHM(absentRule.b) });
    I.forEach((it, i) => {
      facts.push({ type: "item_origin", what: it.id, where: LOCS[locOf[i]].id });
      if (hasW) facts.push({ type: "item_moved", what: it.id, from: toHM(win[i][0]), to: toHM(win[i][1]) });
      facts.push({ type: "item_fate", what: it.id, value: fate[i] });
    });

    /* 8b. Dowody rzeczowe. Fakt przechodzi z teczki na dowód, a właściciela wskazuje znak:
       inicjały (z nazwiska w teczce) albo numer mieszkania (w teczce każdego podejrzanego).
       Osobny strumień losowań, żeby dowody nie przestawiały reszty sprawy. */
    const RE = Eng.util.makeRng(seed + "/ev");
    /* 2.2: przy regule z zeszytem dozorcy jedynym źródłem wiedzy dozorcy jest ten zeszyt: bez dowodów i świadków-dozorców */
    const noJanitor = list => absentRule ? list.filter(x => !/dozorc/i.test(typeof x === "string" ? x : x.name + " " + x.text.join(" "))) : list;
    const ini = Pp => `${Pp.first.charAt(0)}.${Pp.last.charAt(0)}.`;
    const evs = [];
    {
      const [lo, hi] = EV_COUNT[sizeKey]; let want = RE.int(lo, hi);
      const iniN = {}; persons.forEach(Pp => { iniN[ini(Pp)] = (iniN[ini(Pp)] || 0) + 1; });
      const iniOk = Pp => iniN[ini(Pp)] === 1;
      const byPid = Object.fromEntries(persons.map(Pp => [Pp.id, Pp]));
      const wLocId = LOCS[locOf[wIdx]].id;
      const ruleTraits = new Set(rules.filter(r => r.type === "trait").map(r => r.trait));
      // w części spraw dokument alibi obala alibi zamiast je potwierdzać (ton teczki jest ten sam)
      const lieMode = RE.chance(LIE_DOCS);
      const cands = [];
      for (const f of facts) {
        const Pp = byPid[f.who]; if (!Pp) continue;
        const isC = Pp.idx === cIdx, li = f.where ? LOCS.findIndex(l => l.id === f.where) : -1;
        if (f.type === "presence" && iniOk(Pp))
          cands.push({ kind: "presence", f, Pp, li, mark: "initials", defs: noJanitor(B.evidence.presence.filter(d => fitsAt(d, (LOCS[li] || {}).pt))),
            ess: isC && hasW && f.where === wLocId && toMin(f.at) >= win[wIdx][0] && toMin(f.at) <= win[wIdx][1] });
        // tylko klucz zapasowy: klucz „z urzędu” zdradza sama rola (stolarz ↔ warsztat)
        else if (f.type === "has_key" && B.keyBookLocs.includes(f.where) && !accessOf(Pp.role).includes(f.where))
          cands.push({ kind: "keys", f, Pp, li, mark: "flat", defs: B.evidence.keys, ess: isC && f.where === wLocId });
        else if (f.type === t("gen.classic.alibi") && !Pp.s.fakeAlibi && iniOk(Pp)) {
          const docs = alibisFor(Pp).filter(a => a.doc).map(a => Object.assign({ alibi: a }, a.doc));
          // dokument potwierdza alibi albo (u kogoś bez alibi) je obala: inne godziny albo inny dzień
          if (f.confirmed && !lieMode) cands.push({ kind: t("gen.classic.alibi"), f, Pp, li: -1, mark: "initials", defs: docs, ess: !isC && elim[Pp.idx].rule.type === t("gen.classic.alibi") });
          else if (!f.confirmed && lieMode) cands.push({ kind: t("gen.classic.alibi"), f, Pp, li: -1, mark: "initials", defs: docs, ess: false, lie: true });
        }
        else if (f.type === "trait" && ruleTraits.has(f.trait) && iniOk(Pp) && (f.trait === "shoe" || f.value === "yes")) {
          // listy z motywem i kwity tylko pasujące do osoby (licealista bez weksla i wymówienia z pracy)
          const defs = ofWho((f.trait === "motive" ? crime.letters : B.traits[f.trait].evidence) || [], Pp);
          if (defs.length) cands.push({ kind: "trait:" + f.trait, f, Pp, li: -1, mark: "initials", defs, ess: isC });
        }
      }
      // najpierw (zwykle) dowód potrzebny do rozwiązania, potem różne rodzaje, na końcu cokolwiek
      // w jednej sprawie każdy szablon (nazwa) i każda etykieta najwyżej raz
      const labels = new Set(), names = new Set(), per = {}, kinds = {}, keyLocs = new Set();
      const take = (c, strict) => {
        if (evs.length >= want || evs.some(x => x.f === c.f)) return;
        if ((per[c.Pp.id] || 0) >= (strict ? 1 : 2) || (strict && kinds[c.kind])) return;
        if (c.kind === "keys" && keyLocs.has(c.li)) return;
        const def = RE.shuffle(c.defs).find(d => !labels.has(d.label) && !names.has(d.name));
        if (!def) return;
        labels.add(def.label); names.add(def.name); per[c.Pp.id] = (per[c.Pp.id] || 0) + 1; kinds[c.kind] = 1;
        if (c.kind === "keys") keyLocs.add(c.li);
        evs.push(Object.assign({ def }, c));
      };
      const ess = RE.shuffle(cands.filter(c => c.ess));
      if (ess.length && RE.chance(.9)) take(ess[0], false);
      const rest = RE.shuffle(cands);
      for (const strict of [true, false]) for (const c of rest) take(c, strict);
      // co najmniej jeden dowód dotyczy niewinnego: gdy wszystkie są sprawcy, ostatni ustępuje miejsca
      const innocentEv = () => evs.some(c => c.Pp.idx !== cIdx);
      if (evs.length && !innocentEv()) {
        if (evs.length >= hi && evs.length > 1) { const d = evs.pop(); labels.delete(d.def.label); names.delete(d.def.name); per[d.Pp.id]--; if (d.kind === "keys") keyLocs.delete(d.li); }
        want = Math.max(want, evs.length + 1);
        for (const c of rest) { if (c.Pp.idx !== cIdx) take(c, false); if (innocentEv()) break; }
        if (!innocentEv()) return null;
      }
      if (evs.length < lo) return null;
      // dokument, który obala alibi: fakt alibi dostaje godziny z dokumentu (nie pokrywają zbrodni)
      // albo zostaje niepotwierdzony, a dokument jest z innego dnia; teczka podaje godziny z zeznania
      for (const c of evs.filter(c => c.lie)) {
        c.claim = { from: c.f.from, to: c.f.to };
        c.lie = !/tamt/i.test(c.def.text.join(" ")) && RE.chance(.4) ? "day" : "hours";
        if (c.lie === "hours") {
          const [a, b] = crimeWin, span = RE.int(6, 14) * 5;
          // „ostatni seans”, „nocna zmiana”: godziny po zbrodni, bo przed nią brzmiałyby nieprawdopodobnie
          const late = /ostatni|nocn/.test(c.def.text.join(" ") + c.def.alibi.text);
          const early = () => a - RE.int(2, 6) * 5 - span, after = () => b + RE.int(1, 4) * 5;
          // 2.1.2: dokument nie obejmuje czasu, w którym ta osoba ma obecność gdzie indziej
          const hit = from => [...c.Pp.s.pres, ...(c.Pp.s.yard != null ? [{ t: c.Pp.s.yard }] : [])].some(p => p.t >= from - 5 && p.t <= from + span + 5);
          let from = !late && RE.chance(.6) ? early() : after();
          for (let k = 0; k < 10 && hit(from) && !late; k++) from = early();
          if (hit(from)) from = after();
          Object.assign(c.f, { from: toHM(from), to: toHM(from + span), confirmed: true });
        } else c.f.day = "other";
        c.otherDay = c.lie === "day" ? RE.pick(B.docOtherDay) : null;
      }
      evs.forEach((c, k) => { c.id = "ev" + (k + 1); c.f.src = c.id; });
      if (evs.some(c => c.mark === "initials")) persons.forEach(Pp => facts.push({ type: "mark", who: Pp.id, kind: "initials", value: ini(Pp) }));
      if (evs.some(c => c.mark === "flat")) {
        const nums = RE.sample([...Array(44).keys()].map(x => x + 2), persons.length);
        persons.forEach((Pp, i) => { Pp.flat = nums[i]; facts.push({ type: "mark", who: Pp.id, kind: "flat", value: String(nums[i]) }); });
      }
      for (const c of evs) facts.push({ type: "evidence", id: c.id, kind: c.kind, owner: c.Pp.id, ...(c.lie ? { lie: c.lie } : {}),
        mark: { kind: c.mark, value: c.mark === "flat" ? String(c.Pp.flat) : ini(c.Pp) } });
    }
    /* 2.1.2: kontrola spójności. Nikt nie jest w dwóch miejscach naraz ani w trakcie własnego alibi. */
    for (const Pp of persons) {
      const ps = facts.filter(f => (f.type === "presence" || f.type === "roster_entry") && f.who === Pp.id).map(f => ({ w: f.where, t: toMin(f.at) }));
      const al = facts.find(f => f.type === t("gen.classic.alibi") && f.who === Pp.id);
      for (let i = 0; i < ps.length; i++) {
        if (ps[i].t >= ALIBI_FROM) return null;
        if (al && al.confirmed && ps[i].t >= toMin(al.from) && ps[i].t <= toMin(al.to)) return null;
        for (let j = i + 1; j < ps.length; j++) if (ps[i].w !== ps[j].w && Math.abs(ps[i].t - ps[j].t) < MIN_GAP) return null;
      }
    }
    // alibi zawodowe (pole roles) tylko dla pasującej roli, reszta dla każdego
    function alibisFor(Pp) { return A(B.alibiConfirmed).filter(a => (!a.roles || a.roles.includes(Pp.role.id)) && fitsWho({ k: a.k }, who(Pp))); }
    const usedAlibi = [];
    const evOf = (Pp, kind, test) => evs.find(c => c.Pp === Pp && c.kind === kind && (!test || test(c.f)));

    /* 9. Reguły: kolejność i teksty */
    const sh = R.shuffle(rules);
    sh.forEach((r, k) => { r.id = "r" + (k + 1); r.text = ruleText(B, R, crime, crimeId, scene, r, crimeFrom, crimeTo, T, sub); });

    /* 10. Węzły i teksty dla gracza */
    const nodes = [];
    const debunks = [];
    const motiveRule = rules.some(r => r.trait === "motive");
    // smaczki z ostatnich spraw gracza (avoid) idą na koniec kolejki; zostają obiektami, żeby było widać ich tagi
    const flavorPool = (p => [...p.filter(x => !avF.has(txt(x))), ...p.filter(x => avF.has(txt(x)))])(R.shuffle([...B.eraFlavor, ...(city.flavor || [])].filter(o => typeof o === "string" || inYears(o, year, monthIdx))));
    const usedLines = new Set();
    const fresh = list => { const sh = R.shuffle(list), c = sh.find(x => !usedLines.has(x) && !avF.has(x)) || sh.find(x => !usedLines.has(x)); if (c) usedLines.add(c); return c; };
    const forP = (list, Pp) => avail(ofWho(list, Pp), year, monthIdx); // teksty dla tej osoby i tego roku, jako napisy
    persons.forEach(Pp => {
      const s = Pp.s, g = s.g, text = [];
      LOCS.forEach((loc, li) => {
        const parts = [];
        if (hasK && s.keys.has(li) && !evOf(Pp, "keys", f => f.where === loc.id))
          parts.push(pickU(accessOf(Pp.role).includes(loc.id) ? forP(B.keyTpl, Pp) : B.spareKeyTpl).replace(/\{gen\}/g, loc.gen));
        for (const p of s.pres.filter(p => p.loc === li && !evOf(Pp, "presence", f => f.where === loc.id && f.at === toHM(p.t))))
          parts.push(pickU(noJanitor(atTexts(B.presenceTpl, loc.pt))).replace("{in}", loc.in).replace("{t}", toHM(p.t)));
        if (parts.length) text.push(T(parts.join(" "), g));
      });
      if (Pp.flat) text.push(T(pickU(forP(B.flatTpl, Pp)), g, { flat: Pp.flat }));
      const al = facts.find(f => f.type === t("gen.classic.alibi") && f.who === Pp.id);
      const evAl = evOf(Pp, t("gen.classic.alibi"));
      if (evAl) { // alibi potwierdza dopiero dowód rzeczowy
        const said = evAl.claim || al; // przy dokumencie, który obala alibi, teczka podaje godziny z zeznania
        text.push(T(pickU(B.alibiPaperTpl).replace("{x}", evAl.def.alibi.text), g, { from: said.from, to: said.to })); Pp.alibiTxt = T(evAl.def.alibi.text, g);
        usedAlibi.push(evAl.def.alibi.text);
      }
      else if (al.confirmed) {
        // alibi z pracy tylko dla pasującej roli; zawodowe wybieramy mniej więcej co drugi raz, gdy rola je ma
        const pool = alibisFor(Pp).filter(x => !s.fakeAlibi || x.debunk), own = pool.filter(x => x.roles);
        const a = pickU(own.length && R.chance(.5) ? own : pool);
        usedAlibi.push(a.text);
        text.push(T(`Od ${al.from} do ${al.to} ${a.text}.`, g) + " " + cap(T(a.witness, g)) + "."); Pp.alibiTxt = T(a.text, g);
        if (s.fakeAlibi) debunks.push({ who: Pp.idx, line: a.debunk });
      }
      else text.push(T(pickU(noJanitor(forP(B.claimFrame, Pp))).replace("{x}", pickU(A(B.alibiClaim))), g, { from: al.from }));
      for (const r of rules.filter(r => r.type === "trait")) if (!evOf(Pp, "trait:" + r.trait)) text.push(traitFact(B, crime, pickU, r.trait, s.traits[r.trait], Pp, year, T, monthIdx));
      if (cmpRule) text.push(T(pickU(forP(B.rules2.heightCm, Pp)), g, { cm: Pp.cm, cmm: (Pp.cm / 100).toFixed(2).replace(".", ",") }));
      if (Pp.rel) text.push(T(pickU(forP(B.rules2.relation[Pp.rel].fact, Pp)), g, { ref: relRule.refName, szw: relRule.refG === "f" ? t("gen.classic.szwagierka") : t("gen.classic.szwagier") }));
      if (s.yard != null) text.push(T(pickU(B.rules2.absent.fact), g, { t: toHM(s.yard) }));
      if (hasD || R.chance(.25)) text.push(T(pickU(forP(B.habits[s.traits.habit], Pp)), g));
      const nTraitRules = rules.filter(r => r.type === "trait").length;
      const decoy = R.pick(TRAITS.filter(t => t !== "motive" && t !== "known" && !(t === "height" && (cmpRule || s.traits.height === "mid")) && !rules.some(r => r.trait === t)));
      if (decoy && nTraitRules < 3 && R.chance(.6)) text.push(traitFact(B, crime, pickU, decoy, s.traits[decoy], Pp, year, T, monthIdx));
      // motyw jako tło: gdy nie jest regułą, część osób z motywem dostaje podejrzane zdanie
      if (!motiveRule && s.traits.motive === "yes" && (Pp.idx !== cIdx || R.chance(.5))) text.push(T(pickU(forP(crime.suspicion, Pp)), g));
      else {
        // smaczek roli albo epoki i miasta, ale tylko pasujący do tej osoby (wiek, rola, cechy)
        const l = R.chance(.5) ? fresh(forP(Pp.role.flavor || [], Pp)) : (f => f && txt(f))(flavorPool.find(x => !usedLines.has(txt(x)) && fitsWho(x, who(Pp))));
        if (l && R.chance(nTraitRules >= 3 ? .6 : .85)) { usedLines.add(l); text.push(T(l, g)); }
      }
      nodes.push({ id: Pp.id, type: "person", g, age: Pp.age, label: `${Pp.first} ${Pp.last.charAt(0)}.`, name: `${Pp.first} ${Pp.last}`, kind: T(Pp.role[g], g), sprite: Pp.sprite, text });
    });
    for (const d of debunks) {
      const others = nodes.filter(n => n.type === "person" && n.id !== persons[d.who].id);
      const n = R.pick(others);
      n.text.splice(Math.min(n.text.length, 2), 0, T(d.line, n.g));
    }
    // klucz, który jest tylko na dowodzie, nie trafia na listę posiadaczy w aktach miejsca
    const holders = li => persons.filter(Pp => Pp.s.keys.has(li) && !evOf(Pp, "keys", f => f.where === LOCS[li].id)).map(Pp => `${Pp.first} ${Pp.last}`);
    LOCS.forEach((loc, li) => {
      const text = [T(R.pick(loc.desc))];
      const here = I.filter((_, i) => locOf[i] === li);
      if (here.length > 1) text.push(t("gen.classic.tego_wieczoru_zniknely_stad_dwie_rzeczy", { plList: plList(here.map(it => lc1(it.name))) }));
      if (hasK) {
        const h = holders(li), book = evs.some(c => c.kind === "keys" && c.li === li);
        if (book) text.push(h.length ? t("gen.classic.v_pllist_others_zamek_nieuszkodzony", { v: h.length > 1 ? t("gen.classic.klucze_maja") : t("gen.classic.klucz_ma"), plList: plList(h), others: B.keyBookNote.others }) : t("gen.classic.only_zamek_nieuszkodzony", { only: B.keyBookNote.only }));
        else text.push(h.length ? t("gen.classic.v_pllist_zamek_nieuszkodzony", { v: h.length > 1 ? t("gen.classic.klucze_maja") : t("gen.classic.klucz_ma"), plList: plList(h) }) : t("gen.classic.nikt_z_podejrzanych_nie_ma_tu"));
      }
      else text.push(T(R.pick(loc.open || [t("gen.classic.drzwi_zwykle_stoja_otwarte_wejsc_mogl")])));
      nodes.push({ id: loc.id, type: "location", label: loc.label, name: loc.name, kind: t("gen.classic.miejsce"), sprite: { kind: "loc", icon: loc.icon }, text,
        forms: [loc.gen, loc.in, loc.from].filter(Boolean) }); // formy do wyróżniania w tekście
    });
    I.forEach((it, i) => {
      const gone = { m: t("gen.classic.zniknal"), f: t("gen.classic.zniknela"), n: t("gen.classic.zniknelo"), pl: t("gen.classic.zniknely") }[it.g];
      const from = LOCS[locOf[i]].from;
      const text = [R.pick(it.desc), hasW ? t("gen.classic.gone_from_miedzy_tohm_a_tohm2", { gone, from, toHM: toHM(win[i][0]), toHM2: toHM(win[i][1]) }) : t("gen.classic.gone_from_tego_dnia", { gone, from }), T(B.fates[fate[i]].item, it.g)];
      nodes.push({ id: it.id, type: "item", g: it.g, label: it.label, name: it.name, kind: t("gen.classic.przedmiot"), sprite: { kind: "item", shape: it.icon.shape, pal: it.icon.p }, text });
    });
    for (const c of evs) {
      const loc = c.li >= 0 ? LOCS[c.li] : null, f = c.f;
      // losowe szczegóły (imię psa, film, zespół, papierosy, towar, kwota), z osobnego strumienia dowodów
      const D = B.details;
      const vars = { ini: ini(c.Pp), flat: c.Pp.flat, t: f.at, in: loc && loc.in, gen: loc && loc.gen, from: f.from, to: f.to, v: f.value,
        dogname: RE.pick(D.dogs), dogbreed: RE.pick(D.breeds), film: RE.pick(A(D.films)), band: RE.pick(A(D.bands)),
        cig: RE.pick(A(D.cigs)), packs: RE.pick(D.packs), goods: RE.pick(A(D.goods)), kwota: smallMoney(RE, year) };
      nodes.push({ id: c.id, type: "evidence", label: c.def.label, name: c.def.name, kind: t("gen.classic.dowod_rzeczowy_2"), sprite: { kind: "ev", icon: c.def.icon },
        text: [...c.def.text, ...(c.otherDay ? [c.otherDay] : [])].map(x => T(prices(B, RE, year, x), c.Pp.g, vars).replace(/(\p{Lu}\.\p{Lu}\.)\./gu, "$1")) }); // „M.M..” → „M.M.”
    }

    /* 11. Połączenia zgodne z faktami, obwód sprawcy */
    const supported = [];
    persons.forEach(Pp => LOCS.forEach((loc, li) => {
      if (Pp.s.keys.has(li) || Pp.s.pres.some(p => p.loc === li)) {
        supported.push([Pp.id, loc.id]);
        I.forEach((it, i) => { if (locOf[i] === li) supported.push([Pp.id, it.id]); });
      }
    }));
    I.forEach((it, i) => supported.push([LOCS[locOf[i]].id, it.id]));
    // dowód łączy się z właścicielem, a zapiski z miejsca także z tym miejscem
    for (const c of evs) { supported.push([c.Pp.id, c.id]); if (c.li >= 0) supported.push([LOCS[c.li].id, c.id]); }
    const C0 = persons[cIdx], wLoc = LOCS[locOf[wIdx]];
    const chain = [[C0.id, wLoc.id], [wLoc.id, I[wIdx].id], [C0.id, I[wIdx].id]];

    /* 12. Podpowiedzi, rozumowanie, epilog */
    const ruleNo = r => r.id.slice(1);
    const hintRules = [...new Set([...innocents.map(i => elim[i].rule), ...rules.filter(r => H.has(r.type))])];
    let hints = R.shuffle(hintRules).map(r => hintText(B, r, ruleNo(r), crimeFrom, crimeTo, hasW));
    if (debunks.length) hints.splice(R.int(0, 1), 0, t("gen.classic.nie_kazde_alibi_sie_trzyma_porownaj"));
    if (evs.some(c => c.ess)) hints.splice(RE.int(0, 2), 0, evs.some(c => c.mark === "flat")
      ? t("gen.classic.dowody_rzeczowe_nie_maja_nazwisk_inicjaly")
      : t("gen.classic.dowody_rzeczowe_nie_maja_nazwisk_porownaj"));
    if (useAlibi && evs.some(c => c.kind === t("gen.classic.alibi"))) hints.splice(RE.int(0, 2), 0, t("gen.classic.papiery_nie_zawsze_mowia_to_samo"));
    hints = hints.slice(0, 3);
    // 2.2.1: para zapisana rzeczownikami w mianowniku, po dwukropku, z pełnymi nazwiskami obu osób („Piotr Kowal i Alicja Baran: szwagrostwo”),
    // bo „Piotr i Alicja Baran to szwagrostwo” czyta się jak dwie osoby o tym samym nazwisku; bez odmiany nazwisk (zbyt ryzykowna)
    const relNoun = (rel, g1, g2, neg) => rel === "workmate" ? t("gen.classic.wspolpracownicy_z_jednego_zakladu")
      : rel === "stairwell" ? (neg ? t("gen.classic.sasiedzi_z_klatki") : t("gen.classic.sasiedzi_z_jednej_klatki"))
      : (g1 === "m" && g2 === "m" ? t("gen.classic.szwagrowie") : g1 === "f" && g2 === "f" ? t("gen.classic.szwagierki") : t("gen.classic.szwagrostwo"));
    const why = innocents.map(sIdx => {
      const Pp = persons[sIdx], e = elim[sIdx], n = ruleNo(e.rule), g = Pp.s.g;
      if (e.rule.type === "cmp") return [Pp.first, t("gen.classic.ma_cm_cm_a_sprawca_jest", { cm: Pp.cm, v: e.rule.dir === "up" ? t("gen.classic.wyzszy") : t("gen.classic.nizszy"), refName: e.rule.refName, refCm: e.rule.refCm, n })];
      if (e.rule.type === "relation") return [`${Pp.first} ${Pp.last} i ${e.rule.refName}:`, Pp.rel ? t("gen.classic.relnoun_a_nie_relnoun2_regula_n", { relNoun: relNoun(Pp.rel, g, e.rule.refG), relNoun2: relNoun(e.rule.rel, g, e.rule.refG, true), n })
        : t("gen.classic.w_teczce_nie_ma_nic_co", { n })];
      if (e.rule.type === "absent") return [Pp.first, T(t("gen.classic.jest_w_zeszycie_dozorcy_o_tohm", { toHM: toHM(Pp.s.yard), n }), g)];
      return [Pp.first, whyText(B, Pp, e, LOCS[locOf[e.trap]], locOf[e.trap], I[e.trap], fate[e.trap], ruleNo(e.rule), hasW, hasK, T)];
    });
    const extraBits = [];
    if (cmpRule) extraBits.push(t("gen.classic.ma_cm_cm_v_niz_refname", { cm: C0.cm, v: cmpRule.dir === "up" ? t("gen.classic.wiecej") : t("gen.classic.mniej"), refName: cmpRule.refName, refCm: cmpRule.refCm }));
    if (relRule) extraBits.push(t("gen.classic.relacja_z_osoba_refname_what", { refName: relRule.refName, what: B.rules2.relation[relRule.rel].what }));
    if (absentRule) extraBits.push(t("gen.classic.nie_ma_go_jej_w_zeszycie"));
    why.push([C0.first, T(t("gen.classic.spelnia_wszystkie_reguly_join", { join: [describeCulprit(B, rules, wLoc, hasW, hasK, useAlibi, C0.s.fakeAlibi, T(B.fates[fate[wIdx]].place || ""), (evs.find(c => c.Pp === C0 && c.lie) || {}).lie), ...extraBits].filter(Boolean).join(", ") }), C0.s.g)]);
    if (evs.length) {
      const owners = evs.map(c => `${lc1(c.def.name)} (${c.mark === "flat" ? "m. " + c.Pp.flat : ini(c.Pp)}) to ${c.Pp.first} ${c.Pp.last}`);
      why.push([evs.length > 1 ? t("gen.classic.dowody_rzeczowe") : t("gen.classic.dowod_rzeczowy"), owners.join("; ") + "."]);
    }
    const hNames = herrings.map(h => lc1(I[h].name));
    why.push([cap(plList(hNames)), hNames.length > 1
      ? t("gen.classic.to_falszywe_tropy_zaden_nie_pasuje")
      : t("gen.classic.to_falszywy_trop_nie_pasuje_do")]);
    const tTake = C0.s.pres.find(p => p.loc === locOf[wIdx] && p.t >= win[wIdx][0] && p.t <= win[wIdx][1]);
    const sceneTo = T(scene.to);
    // gdy odpis testamentu wskazuje kogoś innego niż sprawcę, epilog nie może mówić o spadku ani mieszkaniu po ofierze (heir)
    const heirTaken = evs.some(c => c.kind === "trait:motive" && c.def.heir && c.Pp.idx !== cIdx);
    const mList = heirTaken ? crime.motives.filter(o => !(o && o.heir)) : crime.motives;
    // gdy nic nie pasuje do osoby, zapasowo tylko motywy bez tagów (nigdy dorosłe sprawy u licealisty)
    const motives = (m => m.length ? m : avail(mList.filter(o => typeof o === "string" || !(o.k || o.ages || o.roles || o.trait || o.vt)), year, monthIdx))(forP(mList, C0)); // motyw pasujący do sprawcy (licealista nie mści się za zwolnienie z pracy)
    const epilogue = T(t("gen.classic.first_pick_v_zabral_zabrala_acc", { first: C0.first, pick: R.pick(motives.length ? motives : avail(mList, year, monthIdx)), v: tTake ? "O " + toHM(tTake.t) : t("gen.classic.tego_wieczoru"), acc: I[wIdx].acc, from: wLoc.from, epilogueEnd: crime.epilogueEnd }), C0.s.g, { to: sceneTo });

    const vg = scene.vg || "m";
    const intro = [`${V.district}, ${V.city}, ${V.month} ${year}.`, T(scene.intro, vg, { victim }), T(crime.cause[sub], vg), crime.itemsSentence].join(" ");
    let quipRaw; const avQ = avoidOf("quips"), quips = prefer(A([...B.quips, ...(city.quips || [])]), x => avQ.has(x)); // 2.2.1: komentarze sezonowe (months) tylko w pasującym miesiącu

    return {
      case_id: "case_" + seed.replace(/[^a-z0-9]+/gi, "_"),
      city: cityId, city_name: city.name, district: city.district.nom, year, month: V.month, size: sizeKey,
      crime: crimeId, title: T(scene.title), intro, tool_label: crime.toolLabel,
      time: { crime: { from: crimeFrom, to: crimeTo } },
      nodes, facts, rules: sh.map(r => ({ id: r.id, type: r.type, trait: r.trait, value: r.value, ref: r.ref, refName: r.refName, refCm: r.refCm, dir: r.dir, rel: r.rel, text: r.text })),
      solution: { culprit: C0.id, weapon: I[wIdx].id },
      eliminations: Object.fromEntries(innocents.map(sIdx => [persons[sIdx].id, elim[sIdx].rule.id])),
      red_herrings: herrings.map(h => I[h].id),
      supported_connections: supported, culprit_chain: chain,
      hints, why, epilogue, quip: T(quipRaw = R.pick(quips)),
      detective: milicja ? t("gen.classic.porucznik_detective_z_mo", { detective: B.detective }) : t("gen.classic.komisarz_detective", { detective: B.detective }),
      culprit_name: `${C0.first} ${C0.last}`, weapon_name: I[wIdx].name,
      // co ta sprawa zużyła z pul treści: gra zapamiętuje to i podaje kolejnym sprawom z archiwum jako opts.avoid
      used: { names: persons.map(Pp => Pp.first), surnames: persons.map(Pp => B.surnames.find(x => x[0] === Pp.last || x[1] === Pp.last)[0]),
        roles: persons.map(Pp => Pp.role.id), scenes: [scene.title], quips: [quipRaw], flavor: [...usedLines], alibi: usedAlibi }
    };
  }

  /* ---------------- pomocnicze teksty ---------------- */
  function ruleText(B, R, crime, crimeId, scene, r, a, b, T, sub) {
    const pickL = x => R.pick(Array.isArray(x) ? x : [x]);
    if (r.type === t("gen.classic.alibi")) return pickL(crime.alibiRule).replace("{ev}", crime.alibiEvent).replace("{a}", a).replace("{b}", b);
    if (r.type === "window") return pickL(crime.windowRule);
    if (r.type === "key") return pickL(crime.keyRule);
    if (r.type === "fate") return T(B.fates[r.value].rule, "m");
    if (r.type === "dump") return pickL(B.dumpRule);
    const f = r.refG === "f";
    if (r.type === "cmp") return T(pickL(B.rules2.cmp.rule[r.dir]), "m", { ref: r.refName, refm: (r.refCm / 100).toFixed(2).replace(".", ","), ref_od: f ? t("gen.classic.niej") : t("gen.classic.niego"),
      stal: f ? t("gen.classic.stala") : t("gen.classic.stal"), widzial: f ? t("gen.classic.widziala") : t("gen.classic.widzial"), ktory: f ? t("gen.classic.ktora") : t("gen.classic.ktory") });
    if (r.type === "relation") return T(pickL(B.rules2.relation[r.rel].rule), "m", { ref: r.refName, zeznal: f ? t("gen.classic.zeznala") : t("gen.classic.zeznal"), ref_jego: f ? t("gen.classic.jej") : t("gen.classic.jego") });
    if (r.type === "absent") return T(pickL(B.rules2.absent.rule), "m", { a: toHM(r.a), b: toHM(r.b) });
    if (r.trait === "motive") return pickL(crime.motiveRule);
    const def = B.traits[r.trait];
    // przy uduszeniu nie ma rany ani ciosu: osobne zdania o tym, która ręka zaciągnęła sznur
    if (r.trait === "hand" && crimeId === "zabojstwo") return pickL((sub === "sznur" ? def.ruleStrangle : def.ruleMurder)[r.value]);
    // typ zbrodni może podać własne zdania reguły cechy (np. psia sierść przy porwaniu psa); jedno losowanie, jak niżej
    const own = crime.traitRule && crime.traitRule[r.trait], rule = own || def.rule;
    const tpl = pickL(Array.isArray(rule) || typeof rule === "string" ? rule : rule[r.value]);
    return cap(T(tpl, "m", { v: r.value, where: scene.where }));
  }
  /* zdanie o cesze osoby: tylko warianty pasujące do jej wieku, roli i roku */
  function traitFact(B, crime, pickU, trait, value, Pp, year, T, monthIdx) {
    const def = B.traits[trait], g = Pp.s.g;
    const list = def.fromCrime ? (value === "yes" ? crime.suspicion : crime.noMotive) : (Array.isArray(def.facts) ? def.facts : def.facts[value]);
    return T(pickU(avail(ofWho(list, Pp), year, monthIdx)), g, { v: value, cm: Pp.cm });
  }
  function hintText(B, r, n, a, b, hasW) {
    if (r.type === t("gen.classic.alibi")) return t("gen.classic.regula_n_kto_ma_potwierdzone_alibi", { n, a, b });
    if (r.type === "window") return t("gen.classic.regula_n_porownaj_godziny_znikniecia_przedmi", { n });
    if (r.type === "key") return hasW ? t("gen.classic.regula_n_kto_byl_przy_przedmiocie", { n }) : t("gen.classic.regula_n_sprawdz_kto_ma_klucze", { n });
    if (r.type === "fate") return t("gen.classic.regula_n_sprawdz_w_aktach_przedmiotow", { n });
    if (r.type === "dump") return t("gen.classic.regula_n_porownaj_gdzie_znaleziono_przedmiot", { n });
    if (r.type === "cmp") return t("gen.classic.regula_n_replace", { n, replace: B.rules2.cmp.hint.replace("{ref}", r.refName).replace("{refm}", (r.refCm / 100).toFixed(2).replace(".", ",")) });
    if (r.type === "relation") return t("gen.classic.regula_n_replace", { n, replace: B.rules2.relation.hint.replace("{ref}", r.refName) });
    if (r.type === "absent") return t("gen.classic.regula_n_hint", { n, hint: B.rules2.absent.hint });
    const h = B.traits[r.trait].hint; return t("gen.classic.regula_n_v", { n, v: h.charAt(0).toLowerCase() + h.slice(1) });
  }
  function whyText(B, Pp, e, loc, li, item, itemFate, n, hasW, hasK, T) {
    const r = e.rule, g = Pp.s.g;
    if (r.type === t("gen.classic.alibi")) return T(t("gen.classic.ma_potwierdzone_alibi_alibitxt_regula_n", { alibiTxt: Pp.alibiTxt, n }), g);
    if (r.type === "dump") return T(t("gen.classic.mogl_mogla_zabrac_acc_ale_nie", { acc: item.acc, T: T(B.fates[itemFate].place, g), n, it: t("gen.classic.it_" + item.g) }), g); // it = „go / ją / je / je” wg rodzaju przedmiotu
    if (r.type === "window") {
      const p = Pp.s.pres.find(x => x.loc === li);
      return T(t("gen.classic.v_byl_byla_in_o_tohm", { v: hasK ? t("gen.classic.ma_klucz_do_gen_ale", { gen: loc.gen }) : "", in: loc.in, toHM: toHM(p.t), n }), g);
    }
    if (r.type === "key") return T(t("gen.classic.byl_byla_in_v_ale_nie", { in: loc.in, v: hasW ? t("gen.classic.we_wlasciwym_czasie") : "", n }), g);
    if (r.type === "fate") return T(t("gen.classic.mogl_mogla_zabrac_acc_ale_t", { acc: item.acc, T: T(B.fates[itemFate].why, g), n }), g);
    const def = B.traits[r.trait];
    const wf = typeof def.whyFail === "string" ? def.whyFail : def.whyFail[r.value];
    return T(t("gen.classic.wf_regula_n", { wf, n }), g, { v: Pp.s.traits[r.trait] });
  }
  function describeCulprit(B, rules, loc, hasW, hasK, useAlibi, fake, dumpPlace, lie) {
    const bits = [];
    if (hasK) bits.push(t("gen.classic.ma_klucz_do_gen", { gen: loc.gen }));
    if (hasW) bits.push(t("gen.classic.byl_byla_in_we_wlasciwym_czasie", { in: loc.in }));
    if (useAlibi) bits.push(fake ? t("gen.classic.jego_jej_alibi_okazalo_sie_klamstwem")
      : lie === "hours" ? t("gen.classic.jego_jej_papiery_pokazuja_inne_godziny")
      : lie === "day" ? t("gen.classic.jego_jej_papiery_sa_z_innego") : t("gen.classic.nie_ma_alibi"));
    for (const r of rules.filter(r => r.type === "trait")) {
      const w = B.traits[r.trait].why;
      bits.push(typeof w === "string" ? w.replace("{v}", r.value) : w[r.value]);
    }
    if (rules.some(r => r.type === "fate")) bits.push(t("gen.classic.a_los_narzedzia_zgadza_sie_z"));
    if (rules.some(r => r.type === "dump")) bits.push(t("gen.classic.a_narzedzie_znaleziono_dumpplace_gdzie_bywa", { dumpPlace }));
    return bits.join(", ");
  }

  function sprites() {
    if (root.SiatkaSprites) return root.SiatkaSprites;
    if (typeof require !== "undefined") return require("../sprites.js");
    throw new Error(t("gen.classic.brak_modulu_sprites"));
  }

  const classic = {
    id: "classic",
    aliases: ["single_culprit_one_reason_each"], // nazwa z ręcznej case_001.json
    name: t("gen.classic.klasyczna_sprawa"),
    minSize: "S",
    weight: 3, // oś czasu ma wagę 1 od M: ok. 25% spraw M–XL
    question: "culprit_weapon",
    build,
    hypotheses(c) {
      const people = c.nodes.filter(n => n.type === "person").map(n => n.id);
      const items = c.nodes.filter(n => n.type === "item").map(n => n.id);
      const out = [];
      for (const p of people) for (const i of items) out.push({ culprit: p, weapon: i });
      return out;
    },
    holds: (rule, h, ix, c) => Solver.pred(rule, { who: h.culprit, item: h.weapon }, ix, c)
  };
  Eng.register(classic);
  if (typeof module !== "undefined" && module.exports) module.exports = classic;
})(typeof window !== "undefined" ? window : globalThis);
