/*
 * Siatka Powiązań — archetyp „Oś czasu” (timeline, wydanie 2.2).
 * Nikt nie jest w dwóch miejscach naraz. W teczkach są obserwacje „X widziany w Y o T” (co do minuty),
 * w notatniku tabela czasów dojścia i reguła „sprawca był na miejscu zdarzenia między A a B”.
 * Trasę na miejsce zdarzenia w oknie ma sprawca i 1–2 niewinnych, którzy odpadają z reguł cech;
 * pozostali niewinni nie zdążą (co najmniej 1, w L–XL 2 z nich brakuje tylko 5 minut: pułapka).
 * Pytanie: kto (bez narzędzia). Hipoteza: {culprit}.
 */
(function (root) {
  const Eng = root.Siatka || require("../engine.js");
  const { cap, toMin, toHM, plList, inYears, avail, slug, fitsWho, fitsAt, atTexts, prices } = Eng.util;
  /* 2.2.1: rodzaj miejsca zdarzenia z nazwy (pt jak w data/base.js): dobiera pasujących świadków i dowody */
  const placeType = n => /Altana|Działk|działkach|Kurnik/.test(n) ? "field"
    : /Klatka schodowa/.test(n) ? "stair"
    : /Zaplecze|Maszynownia|Hydrofornia|Kotłownia|Pracownia|Gabinet|Biuro|Księgowość|Szwalnia|Spółdzielnia pracy|Zakrystia|Ciemnia|Zakład szewski|Warsztat|Piekarnia|Kasa spółdzielni|Dziedziniec mleczarni/.test(n) ? "work"
    : /Podwórko|Klatki na podwórku|Szopa|Garaż|Budka dozorcy|Wózkownia|Stodoła|Plac budowy|Barak/.test(n) ? "yard"
    : /Postój|Wiata|Przystanek|Pętla|Park|Staw|Pomnik|Muszla|Scena|Tablica|Wesołe|Zwrotnica|Stragan|Szczęka|Budka|Klatki|Brama|Wejście do|Stacja|Mur|Gablota|Furtka|Ogrodzenie|Boisko|Parking/.test(n) ? "street"
    : /Mieszkanie|Balkon|Willa|Piwnica|Gołębnik|Dach|Plebania/.test(n) ? "cellar"
    : /Kantor|Kiosk|Apteka|Cukiernia|Komis|Wypożyczalnia|Antykwariat|Kasa|Sklep|Zakład fryzjerski|Magiel|Poczta|Przychodnia|Poczekalnia|Lecznica|Bar mleczny/.test(n) ? "shop" : "work";
  const Solver = root.SiatkaSolver || require("../solver.js");
  /* typy zbrodni, w których liczy się chwila na miejscu (bez szantażu, fałszerstwa i otrucia człowieka) */
  const CRIMES = ["zabojstwo", "kradziez", "napad", "podpalenie", "wandalizm", "porwanie_psa", "sabotaz", "otrucie"];
  const NLOC = { M: 3, L: 4, XL: 5 };               // miejsca razem z miejscem zdarzenia
  const NTRAIT = { M: [1, 1], L: [1, 2], XL: [2, 2] }; // niewinni z trasą, którzy odpadają z reguł cech
  const TRAPS = { M: 1, L: 2, XL: 2 };              // ilu niewinnym brakuje tylko 5 minut
  const EV = { M: [1, 1], L: [1, 2], XL: [2, 3] };
  const RULE_TRAITS = ["height", "smoker", "glasses", "dog", "jacket"];
  const ALL_TRAITS = ["hand", "shoe", "height", "smoker", "car", "glasses", "dog", "jacket", "motive"];
  const MIN_GAP = 15, WIN = 20, STAY = 10; // STAY: najkrótszy pobyt sprawcy na miejscu zdarzenia w oknie
  const who = Pp => ({ age: Pp.age, role: Pp.role, traits: Pp.s.traits, g: Pp.s.g, cm: Pp.cm, vt: Pp.vt });
  const ofWho = (list, Pp) => (Array.isArray(list) ? list : [list]).filter(o => fitsWho(o, who(Pp)));
  const txt = o => typeof o === "string" ? o : o.t;
  const lc1 = s => s.charAt(0).toLowerCase() + s.slice(1);
  const round5 = x => Math.max(5, Math.round(x / 5) * 5);

  function build(ctx) {
    const { R, B, seed, opts, cityId, city, year, monthIdx, sizeKey, N, milicja, A, V, T, pickU } = ctx;
    if (!NLOC[sizeKey]) return null;
    const TL = B.timeline;
    const AV = opts.avoid || {}, avoidOf = k => new Set(AV[k] || []);
    const avN = avoidOf("names"), avSur = avoidOf("surnames"), avR = avoidOf("roles"), avS = avoidOf("scenes"), avF = avoidOf("flavor");
    const prefer = (list, bad) => { const f = list.filter(x => !bad(x)); return f.length ? f : list; };

    /* 1. Zbrodnia i scena (tylko typy, w których liczy się chwila na miejscu) */
    const crimeIds = CRIMES.filter(id => B.crimes[id] && (!opts.crime || id === opts.crime));
    if (!crimeIds.length) return null;
    const crimeId = R.pick(crimeIds), crime = B.crimes[crimeId];
    const scenes = crime.scenes.filter(s => inYears(s, year, monthIdx));
    if (!scenes.length) return null;
    const scene = R.pick(prefer(scenes, s => avS.has(s.title)));
    const sub = R.pick(crime.subtags);

    /* 2. Miejsca i czasy dojścia: punkty na płaszczyźnie, zaokrąglone do 5 min, potem najkrótsze drogi (nierówność trójkąta) */
    const cityLocs = (city.locations || []).filter(l => inYears(l, year, monthIdx));
    const pool = [...B.locations, ...cityLocs];
    const others = R.sample(pool, NLOC[sizeKey] - 1);
    const X = Object.assign({ desc: [scene.where ? `Tu to się stało, ${scene.where}.` : "Tu to się stało."] }, TL.scene);
    // miejsce zbrodni nosi nazwę ze sceny („Magiel przy Mariackiej”); „Miejsce zdarzenia” zostaje tylko jako rodzaj węzła i w tekstach reguł
    X.name = T((TL.places && TL.places[scene.title]) || scene.title);
    X.label = X.name.split(/ (?:z|ze|przy|w|na|u|pod|nad|obok|do) /)[0];
    X.pt = placeType(X.name);
    if (others.some(o => o.name === X.name)) X.name += " (miejsce zdarzenia)";
    if (others.some(o => o.label === X.label)) X.label = "Miejsce zdarz.";
    const LOCS = [X, ...others];          // indeks 0 = miejsce zdarzenia
    const L = LOCS.length;
    const pt = LOCS.map((_, i) => i === 0 ? [0, 0] : (a => { const r = R.int(8, 30); return [r * Math.cos(a), r * Math.sin(a)]; })(R.next() * 2 * Math.PI));
    const D = LOCS.map((_, i) => LOCS.map((_, j) => i === j ? 0 : round5(Math.hypot(pt[i][0] - pt[j][0], pt[i][1] - pt[j][1]))));
    for (let k = 0; k < L; k++) for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) if (D[i][k] + D[k][j] < D[i][j]) D[i][j] = D[i][k] + D[k][j];
    const d = (a, b) => D[a][b];

    /* 3. Czas zdarzenia: okno 20 minut (scena może nadpisać godziny) */
    const Cst = scene.time ? R.int(toMin(scene.time[0]) / 30, toMin(scene.time[1]) / 30 - 1) * 30 : R.int(18, 21) * 60 + R.pick([0, 30]);
    const A0 = Cst, B0 = Cst + WIN;

    /* 4. Kto odpada skąd */
    const cIdx = R.int(0, N - 1);
    const innocents = [...Array(N).keys()].filter(i => i !== cIdx);
    const sh = R.shuffle(innocents);
    const nT = Math.min(R.int(...NTRAIT[sizeKey]), N - 3);
    if (nT < 1) return null;
    const traitFail = sh.slice(0, nT), routeFail = sh.slice(nT);
    const traps = new Set(routeFail.slice(0, Math.min(TRAPS[sizeKey], routeFail.length)));
    const nRules = Math.min(nT, sizeKey === "XL" ? 2 : R.int(1, nT));
    const traitIds = R.sample(RULE_TRAITS, nRules);
    const rules = [{ type: "reach", where: X.id, from: toHM(A0), to: toHM(B0), stay: STAY },
      ...traitIds.map(t => ({ type: "trait", trait: t, value: R.pick(B.traits[t].ruleValues || B.traits[t].values) }))];
    const tRules = rules.filter(r => r.type === "trait");
    const assign = {};
    traitFail.forEach((i, k) => { assign[i] = tRules[k % tRules.length]; });
    for (const i of routeFail) assign[i] = rules[0];

    /* 5. Podejrzani: cechy (sprawca i niewinni z „trasy” spełniają reguły cech) */
    const S = [...Array(N)].map(() => ({ g: R.chance(.5) ? "m" : "f", traits: {}, obs: [] }));
    const valuesOf = (t, g) => t === "shoe" ? B.traits.shoe.values[g] : B.traits[t].values;
    S.forEach((s, i) => {
      for (const t of ALL_TRAITS) {
        const r = tRules.find(x => x.trait === t);
        if (r) s.traits[t] = assign[i] === r ? R.pick(valuesOf(t, s.g).filter(v => v !== r.value)) : r.value;
        else s.traits[t] = t === "motive" ? (i === cIdx ? "yes" : R.chance(.35) ? "yes" : "no") : R.pick(valuesOf(t, s.g));
      }
      s.traits.habit = "park";
    });

    /* 6. Obserwacje. Każdy ma 2–4 (rozkład nie zależy od winy). Dwie z nich obejmują okno zdarzenia:
       ostatnia przed (p, tb) i pierwsza po (q, ta). Czas, który zostaje na miejscu zdarzenia w oknie:
       len = min(ta − d(X,q), B) − max(tb + d(p,X), A). Sprawca 10–15 min, niewinni z trasą 10–20,
       pułapka 5 (o 5 min za mało przy wymogu 10), reszta od −30 do −5. */
    const nonX = [...Array(L).keys()].slice(1);
    const free = (s, loc, t) => s.obs.every(o => o.w === loc ? o.t !== t : Math.abs(o.t - t) >= Math.max(MIN_GAP, d(o.w, loc)));
    function schedule(i) {
      const s = S[i], mode = i === cIdx || traitFail.includes(i) ? "ok" : traps.has(i) ? "trap" : "far";
      for (let tries = 0; tries < 30; tries++) {
        s.obs = [];
        const p = R.pick(nonX), q = R.chance(.4) ? p : R.pick(nonX);
        const len = i === cIdx ? R.int(2, 3) * 5 : mode === "ok" ? R.int(2, 4) * 5 : mode === "trap" ? STAY - 5 : STAY - R.int(3, 8) * 5;
        // dojście α i wyjście λ = α + len; przy len > 0 cały pobyt mieści się w oknie
        const alpha = len > 0 ? R.int(A0 / 5, (B0 - len) / 5) * 5 : R.int(A0 / 5, B0 / 5) * 5, lambda = alpha + len;
        const tb = alpha - d(p, 0), ta = lambda + d(0, q);
        if (ta - tb < (p === q ? 10 : Math.max(MIN_GAP, d(p, q)))) continue;
        // niewinny bez trasy nie może spędzić 10 min na miejscu przed pierwszą ani po ostatniej obserwacji
        if (mode !== "ok" && (tb - d(p, 0) >= A0 + STAY || ta + d(q, 0) <= B0 - STAY)) continue;
        s.obs.push({ w: p, t: tb }, { w: q, t: ta });
        const k = R.int(2, 4);
        for (let e = 2; e < k; e++) {
          const before = R.chance(.5), w = R.pick(nonX);
          const t = before ? tb - Math.max(MIN_GAP, d(w, p)) - R.int(1, 6) * 5 : ta + Math.max(MIN_GAP, d(q, w)) + R.int(1, 6) * 5;
          if (free(s, w, t)) s.obs.push({ w, t });
        }
        s.obs.sort((a, b) => a.t - b.t);
        // zgodność: między kolejnymi obserwacjami da się przejść
        if (!s.obs.every((o, j) => j === 0 || o.t - s.obs[j - 1].t >= (o.w === s.obs[j - 1].w ? 5 : Math.max(MIN_GAP, d(s.obs[j - 1].w, o.w))))) continue;
        const can = Solver.reachable(s.obs.map(o => ({ w: o.w, t: o.t })), 0, A0, B0, d, STAY);
        if (can !== (mode === "ok")) continue;
        s.bracket = { p, q, tb, ta, len };
        return true;
      }
      return false;
    }
    for (let i = 0; i < N; i++) if (!schedule(i)) return null;

    /* 7. Tożsamości (jak w classic: rola, imię z pokolenia roli, portret) */
    const roles = [...A(B.roles), ...A(city.roles || []), city.worker].filter(r => r && inYears(r, year, monthIdx));
    const usedFirst = new Set(), usedSur = new Set(), usedRoles = new Set(), ids = [];
    const AGES = ["young", "mid", "old"];
    const agesOf = role => !role || !role.age ? AGES : Array.isArray(role.age) ? role.age : [role.age];
    const pickName = (g, age) => {
      const pool = (age ? [age] : AGES).flatMap(a => B.names[g][a]).filter(n => !usedFirst.has(n));
      const first = R.pick(prefer(pool, n => avN.has(n))); usedFirst.add(first);
      const sur = R.pick(prefer(B.surnames.filter(x => !usedSur.has(x[0])), x => avSur.has(x[0]))); usedSur.add(sur[0]);
      return { first, last: g === "f" ? sur[1] : sur[0] };
    };
    const HAIR_BY_AGE = { young: [0, 1, 2, 5], mid: [0, 1, 2, 3, 5], old: [3, 4, 4] };
    const SP = root.SiatkaSprites || require("../sprites.js");
    const persons = S.map((s, idx) => {
      const pool = roles.filter(r => r[s.g] && !usedRoles.has(r.id) && (!r.need || Object.entries(r.need).every(([t, v]) => s.traits[t] === v)));
      if (!pool.length) return null;
      const role = R.pick(prefer(pool, r => avR.has(r.id))); usedRoles.add(role.id);
      const age = R.pick(agesOf(role)), { first, last } = pickName(s.g, age);
      let id = slug(first); while (ids.includes(id) || id === X.id) id += "2"; ids.push(id);
      const hw = (role.headwear && role.headwear[s.g]) || [];
      return { idx, s, id, first, last, role, age, vt: scene.vt,
        sprite: { kind: "portrait", g: s.g, skin: R.int(0, 3), hair: R.pick(SP.HAIR_BY_G[s.g]), hairC: R.pick(HAIR_BY_AGE[age]),
          head: (hw.length && R.pick(hw)) || null, headC: R.int(0, 4), outfit: role.outfit, glasses: s.traits.glasses === "yes", smoker: s.traits.smoker === "yes",
          mustache: s.g === "m" && R.chance(.35) } };
    });
    if (persons.some(p => !p)) return null;
    const victim = (() => { const n = pickName(scene.vg || "m", scene.vage || R.pick(["mid", "old"])); return `${n.first} ${n.last}`; })();
    const C0 = persons[cIdx];
    const { heightOf, heightClass } = Eng.util, heightRule = tRules.some(r => r.trait === "height");
    persons.forEach(Pp => { Pp.cm = heightOf(R, Pp.s.g, heightRule ? Pp.s.traits.height : null); Pp.s.traits.height = heightClass(Pp.s.g, Pp.cm); });

    /* 8. Fakty */
    const facts = [];
    for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) facts.push({ type: "travel", a: LOCS[i].id, b: LOCS[j].id, min: d(i, j) });
    persons.forEach(Pp => {
      for (const o of Pp.s.obs) facts.push({ type: "presence", who: Pp.id, where: LOCS[o.w].id, at: toHM(o.t) });
      for (const t of [...ALL_TRAITS, "habit"]) facts.push({ type: "trait", who: Pp.id, trait: t, value: Pp.s.traits[t] });
      facts.push({ type: "trait", who: Pp.id, trait: "height_cm", value: Pp.cm });
    });

    /* 8b. Dowody rzeczowe: obserwacja z godziną przechodzi z teczki na dowód (inicjały) */
    const RE = Eng.util.makeRng(seed + "/ev");
    const ini = Pp => `${Pp.first.charAt(0)}.${Pp.last.charAt(0)}.`;
    const iniN = {}; persons.forEach(Pp => { iniN[ini(Pp)] = (iniN[ini(Pp)] || 0) + 1; });
    const evs = [];
    {
      const want = RE.int(...EV[sizeKey]);
      const cands = RE.shuffle(facts.filter(f => f.type === "presence" && iniN[ini(persons.find(p => p.id === f.who))] === 1));
      const defs = RE.shuffle(TL.evidence), per = {}, usedDefs = new Set();
      // co najmniej jeden dowód dotyczy niewinnego
      const order = [...cands.filter(f => f.who !== C0.id).slice(0, 1), ...cands];
      for (const f of order) {
        const li = LOCS.findIndex(l => l.id === f.where), def = defs.find(d => !usedDefs.has(d) && fitsAt(d, LOCS[li].pt)); // dowód pasuje do rodzaju miejsca
        if (evs.length >= want || evs.some(e => e.f === f) || per[f.who] || !def) continue;
        per[f.who] = 1; usedDefs.add(def); evs.push({ f, def, Pp: persons.find(p => p.id === f.who), li });
      }
      evs.forEach((c, k) => { c.id = "ev" + (k + 1); c.f.src = c.id; });
      if (evs.length) persons.forEach(Pp => facts.push({ type: "mark", who: Pp.id, kind: "initials", value: ini(Pp) }));
      for (const c of evs) facts.push({ type: "evidence", id: c.id, kind: "presence", owner: c.Pp.id, mark: { kind: "initials", value: ini(c.Pp) } });
    }

    /* 9. Reguły */
    const pickL = x => R.pick(Array.isArray(x) ? x : [x]);
    const shR = R.shuffle(rules);
    shR.forEach((r, k) => {
      r.id = "r" + (k + 1);
      if (r.type === "reach") r.text = T(pickL(TL.reachRule), "m", { a: r.from, b: r.to, stay: r.stay });
      else {
        const def = B.traits[r.trait], own = crime.traitRule && crime.traitRule[r.trait], rl = own || def.rule;
        r.text = cap(T(pickL(Array.isArray(rl) || typeof rl === "string" ? rl : rl[r.value]), "m", { v: r.value, where: scene.where }));
      }
    });

    /* 10. Węzły */
    const nodes = [], usedLines = new Set();
    const forP = (list, Pp) => avail(ofWho(list, Pp), year, monthIdx);
    const flavorPool = R.shuffle([...B.eraFlavor, ...(city.flavor || [])].filter(o => typeof o === "string" || inYears(o, year, monthIdx)));
    persons.forEach(Pp => {
      const s = Pp.s, g = s.g, text = [];
      for (const o of s.obs) {
        if (evs.some(c => c.Pp === Pp && c.f.at === toHM(o.t) && c.li === o.w)) continue;
        text.push(T(pickU(atTexts(TL.obsTpl, LOCS[o.w].pt)).replace("{in}", LOCS[o.w].in).replace("{t}", toHM(o.t)), g));
      }
      for (const r of tRules) {
        const def = B.traits[r.trait], list = Array.isArray(def.facts) ? def.facts : def.facts[s.traits[r.trait]];
        text.push(T(pickU(avail(ofWho(list, Pp), year, monthIdx)), g, { v: s.traits[r.trait], cm: Pp.cm }));
      }
      const l = R.chance(.5) ? (x => x && !usedLines.has(x) ? x : null)(R.pick(forP(Pp.role.flavor || [], Pp).concat([null])))
        : (f => f && txt(f))(flavorPool.find(x => !usedLines.has(txt(x)) && !avF.has(txt(x)) && fitsWho(x, who(Pp))));
      if (l && R.chance(.8)) { usedLines.add(l); text.push(T(l, g)); }
      nodes.push({ id: Pp.id, type: "person", g, age: Pp.age, label: `${Pp.first} ${Pp.last.charAt(0)}.`, name: `${Pp.first} ${Pp.last}`, kind: T(Pp.role[g], g), sprite: Pp.sprite, text });
    });
    LOCS.forEach((loc, li) => {
      const near = LOCS.map((o, j) => j !== li ? `${o.name}: ${d(li, j)} min` : null).filter(Boolean);
      const text = [T(R.pick(loc.desc)), `Stąd pieszo: ${near.join(", ")}.`];
      nodes.push({ id: loc.id, type: "location", label: loc.label, name: loc.name, kind: li === 0 ? "Miejsce zdarzenia" : "Miejsce",
        sprite: { kind: "loc", icon: loc.icon }, text, forms: [loc.gen, loc.in, loc.from].filter(Boolean) });
    });
    for (const c of evs) {
      const loc = LOCS[c.li];
      nodes.push({ id: c.id, type: "evidence", label: c.def.label, name: c.def.name, kind: "Dowód rzeczowy", sprite: { kind: "ev", icon: c.def.icon },
        text: c.def.text.map(x => T(prices(B, RE, year, x), c.Pp.g, { ini: ini(c.Pp), t: c.f.at, in: loc.in }).replace(/(\p{Lu}\.\p{Lu}\.)\./gu, "$1")) });
    }

    /* 11. Połączenia: osoba ↔ miejsce obserwacji (trasa), sprawca ↔ miejsce zdarzenia, dowód ↔ osoba i miejsce */
    const supported = [];
    persons.forEach(Pp => { for (const li of new Set(Pp.s.obs.map(o => o.w))) supported.push([Pp.id, LOCS[li].id]); });
    supported.push([C0.id, X.id]);
    for (const c of evs) supported.push([c.Pp.id, c.id], [LOCS[c.li].id, c.id]);
    const chain = [[C0.id, X.id]];

    /* 12. Podpowiedzi, rozumowanie, epilog */
    const ruleNo = r => r.id.slice(1), reach = rules[0];
    const hints = R.shuffle([TL.hint.replace("{n}", ruleNo(reach)).replace("{a}", reach.from).replace("{b}", reach.to).replace("{stay}", reach.stay),
      ...tRules.map(r => `Reguła ${ruleNo(r)}: ${lc1(B.traits[r.trait].hint)}`)]);
    if (evs.length) hints.splice(RE.int(0, 1), 0, "Dowody rzeczowe nie mają nazwisk. Porównaj inicjały z nazwiskami w teczkach.");
    const route = Pp => { const b = Pp.s.bracket, p = LOCS[b.p], q = LOCS[b.q];
      return { p, q, tb: toHM(b.tb), ta: toHM(b.ta), dp: d(b.p, 0), dq: d(0, b.q), gap: b.ta - b.tb }; };
    const why = innocents.map(i => {
      const Pp = persons[i], g = Pp.s.g, r = assign[i];
      if (r.type === "reach") {
        const x = route(Pp), b = Pp.s.bracket, E = Math.max(b.tb + x.dp, A0), Lx = Math.min(b.ta - x.dq, B0), len = Lx - E;
        const where = len > 0 ? `[mógłby|mogłaby] tam być najwyżej od ${toHM(E)} do ${toHM(Lx)}, czyli ${len} min` : "nie [zdążyłby|zdążyłaby] tam być w czasie zdarzenia ani chwili";
        return [Pp.first, T(`o ${x.tb} [był|była] ${x.p.in}, a o ${x.ta} ${x.q === x.p ? "nadal tam" : x.q.in}. Z drogą na miejsce zdarzenia (${x.dp} min) i z powrotem (${x.dq} min) ${where}, a sprawca spędził tam co najmniej ${reach.stay} min (reguła ${ruleNo(r)}).`, g)];
      }
      const def = B.traits[r.trait], wf = typeof def.whyFail === "string" ? def.whyFail : def.whyFail[r.value];
      return [Pp.first, T(`[mógł|mogła] zdążyć na miejsce zdarzenia, ale ${wf} (reguła ${ruleNo(r)}).`, g, { v: Pp.s.traits[r.trait] })];
    });
    {
      const x = route(C0), b = C0.s.bracket, arr = toHM(Math.max(b.tb + x.dp, A0)), back = toHM(Math.min(b.ta - x.dq, B0));
      const tw = tRules.map(r => { const w = B.traits[r.trait].why; return typeof w === "string" ? w.replace("{v}", r.value) : w[r.value]; });
      why.push([C0.first, T(`zdążył[|a]: o ${x.tb} ${x.p.in}, ${x.dp} min drogi, na miejscu zdarzenia [mógł|mogła] być od ${arr} do ${back}, czyli ${b.len} min w czasie zdarzenia (${reach.from}–${reach.to}); potem ${x.dq} min drogi i o ${x.ta} ${x.q.in}${tw.length ? ". Do tego " + tw.join(", ") : ""}.`, C0.s.g)]);
    }
    if (evs.length) why.push([evs.length > 1 ? "Dowody rzeczowe:" : "Dowód rzeczowy:", evs.map(c => `${lc1(c.def.name)} (${ini(c.Pp)}) to ${c.Pp.first} ${c.Pp.last}`).join("; ") + "."]);
    const motives = (m => m.length ? m : avail(crime.motives.filter(o => typeof o === "string"), year, monthIdx))(avail(ofWho(crime.motives, C0), year, monthIdx));
    const bq = C0.s.bracket;
    const epilogue = T(`${C0.first} ${R.pick(motives)}. O ${toHM(bq.tb)} [był|była] jeszcze ${LOCS[bq.p].in}, o ${toHM(bq.tb + d(bq.p, 0))} już na miejscu zdarzenia, a o ${toHM(bq.ta)} [pokazał|pokazała] się ${LOCS[bq.q].in}, jakby nic się nie stało.`, C0.s.g);
    const intro = [`${V.district}, ${V.city}, ${V.month} ${year}.`, T(scene.intro, scene.vg || "m", { victim }), T(crime.cause[sub], scene.vg || "m"),
      "Nikt nie jest w dwóch miejscach naraz. Kto zdążył?"].join(" ");

    return {
      case_id: "case_" + seed.replace(/[^a-z0-9]+/gi, "_"),
      city: cityId, city_name: city.name, district: city.district.nom, year, month: V.month, size: sizeKey,
      crime: crimeId, title: T(scene.title), intro, tool_label: null,
      time: { crime: { from: toHM(A0), to: toHM(B0) } },
      travel: (() => { const out = []; for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) out.push([LOCS[i].id, LOCS[j].id, d(i, j)]); return out; })(),
      travel_note: TL.tableNote,
      nodes, facts, rules: shR.map(r => ({ id: r.id, type: r.type, trait: r.trait, value: r.value, where: r.where, from: r.from, to: r.to, stay: r.stay, text: r.text })),
      solution: { culprit: C0.id },
      eliminations: Object.fromEntries(innocents.map(i => [persons[i].id, assign[i].id])),
      red_herrings: [], supported_connections: supported, culprit_chain: chain,
      hints: hints.slice(0, 3), why, epilogue, quip: T(R.pick(A([...B.quips, ...(city.quips || [])]))),
      detective: milicja ? `Porucznik ${B.detective} z MO` : `Komisarz ${B.detective}`,
      culprit_name: `${C0.first} ${C0.last}`, weapon_name: null,
      used: { names: persons.map(Pp => Pp.first), surnames: persons.map(Pp => B.surnames.find(x => x[0] === Pp.last || x[1] === Pp.last)[0]),
        roles: persons.map(Pp => Pp.role.id), scenes: [scene.title], flavor: [...usedLines], alibi: [] }
    };
  }

  const timeline = {
    id: "timeline",
    name: "Oś czasu",
    minSize: "M",
    weight: size => size === "S" ? 0 : 1, // ok. 25% spraw M–XL (classic ma wagę 3)
    question: "culprit",
    supports: opts => !opts.crime || CRIMES.includes(opts.crime),
    build,
    hypotheses: c => c.nodes.filter(n => n.type === "person").map(n => ({ culprit: n.id })),
    same: (h, sol) => h.culprit === sol.culprit,
    holds: (rule, h, ix, c) => Solver.pred(rule, { who: h.culprit }, ix, c)
  };
  Eng.register(timeline);
  if (typeof module !== "undefined" && module.exports) module.exports = timeline;
})(typeof window !== "undefined" ? window : globalThis);
