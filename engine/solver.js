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
    const ix = { key: new Set(), pres: [], alibi: {}, trait: {}, origin: {}, moved: {}, fate: {}, debunked: new Set(), marks: [], evidence: {} };
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
    }
    return ix;
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

  const api = { indexFacts, PRED, pred, solve, checkEvidence };
  root.SiatkaSolver = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
