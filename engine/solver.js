/*
 * Siatka Powiązań — ogólny solver i wspólna biblioteka predykatów.
 *
 * Archetyp sprawy podaje przestrzeń hipotez (`hypotheses(c)`) i mówi, czy reguła zachodzi
 * dla hipotezy (`holds(rule, hyp, ix, c)`). Solver sprawdza, które hipotezy spełniają wszystkie
 * reguły, czy każda reguła jest potrzebna i czy jedyne rozwiązanie zgadza się z `c.solution`.
 *
 * Predykaty (PRED) działają na zindeksowanych faktach i są wspólne dla wszystkich archetypów.
 * Hipoteza archetypu „classic” to {culprit, weapon}; predykaty biorą z niej osobę (`who`)
 * i przedmiot (`item`) przez `subject()` archetypu.
 *
 * Dowody rzeczowe (fakt `evidence` + fakty `mark`): fakt niesiony przez dowód ma `src` = id dowodu,
 * a właściciela dowodu wskazuje znak (inicjały, numer mieszkania). `checkEvidence` pilnuje,
 * żeby znak pasował do dokładnie jednej osoby i żeby była to osoba z faktu.
 */
(function (root) {
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  function indexFacts(c, skip) {
    const ix = { key: new Set(), pres: [], alibi: {}, trait: {}, origin: {}, moved: {}, fate: {}, debunked: new Set(), marks: [], evidence: {}, rel: new Set(), roster: new Set(), travel: {} };
    for (const f of c.facts) {
      if (skip && skip(f)) continue;
      if (f.type === "has_key") ix.key.add(f.who + "|" + f.where);
      else if (f.type === "presence") ix.pres.push(f);
      else if (f.type === "alibi") (ix.alibi[f.who] = ix.alibi[f.who] || []).push(f);
      else if (f.type === "trait") (ix.trait[f.who] = ix.trait[f.who] || {})[f.trait] = f.value;
      else if (f.type === "item_origin") ix.origin[f.what] = f.where;
      else if (f.type === "item_moved") ix.moved[f.what] = f;
      else if (f.type === "item_fate") ix.fate[f.what] = f.value;
      else if (f.type === "alibi_debunked") ix.debunked.add(f.who);
      else if (f.type === "mark") ix.marks.push(f);
      else if (f.type === "evidence") ix.evidence[f.id] = f;
      else if (f.type === "relation") ix.rel.add(f.a + "|" + f.b + "|" + f.rel);
      else if (f.type === "roster_entry") ix.roster.add(f.who);
      else if (f.type === "travel") { ix.travel[f.a + "|" + f.b] = f.min; ix.travel[f.b + "|" + f.a] = f.min; }
    }
    return ix;
  }

  /* 2.2 (oś czasu): czy osoba z obserwacjami obs = [{w, t}] (posortowanymi) mogła spędzić w X co najmniej
     stay minut w oknie [A, B]. d(a, b) = czas dojścia (Infinity, gdy nieznany). Przed pierwszą i po ostatniej
     obserwacji czas jest wolny. */
  function reachable(obs, X, A, B, d, stay = 0) {
    if (!obs.length) return B - A >= stay;
    if (obs.some(o => o.w === X && o.t >= A && o.t <= B)) return true;
    const first = obs[0], last = obs[obs.length - 1];
    if (Math.min(first.t - d(X, first.w), B) - A >= stay) return true;
    if (B - Math.max(last.t + d(last.w, X), A) >= stay) return true;
    for (let i = 0; i + 1 < obs.length; i++) {
      const e = obs[i].t + d(obs[i].w, X), l = obs[i + 1].t - d(X, obs[i + 1].w);
      if (Math.min(l, B) - Math.max(e, A) >= stay) return true;
    }
    return false;
  }

  /* ---------- biblioteka predykatów: s = {who, item} ---------- */
  const PRED = {
    alibi(rule, s, ix, c) {
      const a = toMin(c.time.crime.from), b = toMin(c.time.crime.to);
      if (ix.debunked.has(s.who)) return true; // alibi obalone w aktach innej osoby
      return !(ix.alibi[s.who] || []).some(f => f.confirmed && toMin(f.from) <= a && toMin(f.to) >= b);
    },
    trait: (rule, s, ix) => !!ix.trait[s.who] && String(ix.trait[s.who][rule.trait]) === String(rule.value),
    key: (rule, s, ix) => ix.key.has(s.who + "|" + ix.origin[s.item]),
    fate: (rule, s, ix) => ix.fate[s.item] === rule.value,
    /* 2.2: porównanie wzrostu z miarą w regule (refCm, dir = up/down), relacja z osobą spoza podejrzanych, zeszyt dozorcy (zamknięta lista) */
    cmp: (rule, s, ix) => { const h = ix.trait[s.who] && ix.trait[s.who].height_cm; return h != null && (rule.dir === "down" ? h < rule.refCm : h > rule.refCm); },
    relation: (rule, s, ix) => ix.rel.has(s.who + "|" + rule.refName + "|" + rule.rel),
    absent: (rule, s, ix) => !ix.roster.has(s.who),
    reach(rule, s, ix) {
      const obs = ix.pres.filter(p => p.who === s.who && p.at).map(p => ({ w: p.where, t: toMin(p.at) })).sort((a, b) => a.t - b.t);
      const d = (a, b) => a === b ? 0 : (ix.travel[a + "|" + b] ?? Infinity);
      return reachable(obs, rule.where, toMin(rule.from), toMin(rule.to), d, rule.stay || 0);
    },
    dump: (rule, s, ix) => !!ix.trait[s.who] && ix.trait[s.who].habit === ix.fate[s.item],
    window(rule, s, ix) {
      const mv = ix.moved[s.item], loc = ix.origin[s.item]; if (!mv) return false;
      const a = toMin(mv.from), b = toMin(mv.to);
      return ix.pres.some(p => p.who === s.who && p.where === loc &&
        (p.at ? (toMin(p.at) >= a && toMin(p.at) <= b) : (toMin(p.from) <= b && toMin(p.to) >= a)));
    }
  };
  const pred = (rule, s, ix, c) => { const p = PRED[rule.type]; return p ? p(rule, s, ix, c) : false; };

  /* Każdy dowód wskazuje znakiem dokładnie jedną osobę, a fakty z dowodu dotyczą właśnie jej. */
  function checkEvidence(c, ix) {
    const errors = [];
    for (const id in ix.evidence) {
      const ev = ix.evidence[id];
      if (!ev.mark) continue; // dowód bez właściciela (np. książka wydań kluczy z miejsca)
      const who = ix.marks.filter(m => m.kind === ev.mark.kind && m.value === ev.mark.value).map(m => m.who);
      if (who.length !== 1) errors.push(`${id}: znak ${ev.mark.kind}=${ev.mark.value} pasuje do ${who.length} osób`);
      else if (who[0] !== ev.owner) errors.push(`${id}: znak wskazuje ${who[0]}, a dowód należy do ${ev.owner}`);
      for (const f of c.facts) if (f.src === id && f.who && f.who !== ev.owner) errors.push(`${id}: fakt ${f.type} dotyczy ${f.who}, nie właściciela`);
    }
    return errors;
  }

  /* {solutions, unique, necessary:{ruleId:bool}, ok, errors} */
  function solve(c, A, opts = {}) {
    const ix = indexFacts(c, opts.skip);
    const hyps = A.hypotheses(c);
    const sols = rules => hyps.filter(h => rules.every(r => A.holds(r, h, ix, c)));
    const solutions = sols(c.rules);
    const necessary = {};
    for (const r of c.rules) necessary[r.id] = sols(c.rules.filter(x => x !== r)).length > 1;
    const unique = solutions.length === 1;
    const same = A.same || ((h, sol) => Object.keys(h).every(k => h[k] === sol[k]));
    const matches = unique && c.solution && same(solutions[0], c.solution);
    const errors = opts.skip ? [] : checkEvidence(c, ix);
    return { solutions, unique, necessary, errors,
      ok: unique && matches !== false && Object.values(necessary).every(Boolean) && !errors.length };
  }

  /* 2.2: metryka głębokości na poziomie faktów.
     - strongRule: najwięcej niewinnych, których odcina jedna reguła sama,
     - strongFact: najwięcej niewinnych, którzy „wracają” po usunięciu jednego faktu (fakt, od którego zależy ich eliminacja),
     - minFacts: ile faktów zostaje po zachłannym usuwaniu tych, bez których rozwiązanie dalej jest jedno (głębokość),
     - reject: jedna reguła albo jeden fakt eliminuje wszystkich niewinnych (przy co najmniej 2 niewinnych). */
  function depth(c, A) {
    const hyps = A.hypotheses(c), subj = A.subject || (h => h.culprit), culprit = c.solution.culprit;
    const innocents = [...new Set(hyps.map(subj))].filter(p => p !== culprit);
    const alive = (rules, ix) => new Set(hyps.filter(h => rules.every(r => A.holds(r, h, ix, c))).map(subj));
    const ix0 = indexFacts(c);
    let strongRule = 0;
    for (const r of c.rules) { const al = alive([r], ix0); strongRule = Math.max(strongRule, innocents.filter(p => !al.has(p)).length); }
    let strongFact = 0;
    for (const f of c.facts) {
      const al = alive(c.rules, indexFacts(c, x => x === f));
      strongFact = Math.max(strongFact, innocents.filter(p => al.has(p)).length);
    }
    // zachłannie: fakty w stałej kolejności, usuwamy te, bez których zostaje jedna hipoteza
    const removed = new Set();
    for (const f of c.facts) {
      removed.add(f);
      const ix = indexFacts(c, x => removed.has(x));
      if (hyps.filter(h => c.rules.every(r => A.holds(r, h, ix, c))).length !== 1) removed.delete(f);
    }
    const n = innocents.length;
    return { strongRule, strongFact, minFacts: c.facts.length - removed.size, innocents: n,
      reject: n >= 2 && (strongRule >= n || strongFact >= n) };
  }

  const api = { indexFacts, PRED, pred, solve, checkEvidence, depth, reachable };
  root.SiatkaSolver = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
