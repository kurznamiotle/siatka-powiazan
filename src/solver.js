// Solver spraw. Czysty JS bez zależności: ten sam kod działa w przeglądarce i w skryptach Node.
// Sprawdza wszystkie pary (sprawca, narzędzie) względem reguł zapisanych w polu `logic`.

const minutes = hhmm => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
// Fakt z godziną `at` to przedział zerowej długości, dzięki czemu obecność „o 19:10” liczy się jak każda inna.
const span = f => (f.at ? { from: minutes(f.at), to: minutes(f.at) } : { from: minutes(f.from), to: minutes(f.to) });
const overlaps = (a, b) => a.from <= b.to && b.from <= a.to;
const covers = (a, b) => a.from <= b.from && b.to <= a.to;

const factsOf = (c, type) => c.facts.filter(f => f.type === type);
const originOf = (c, item) => factsOf(c, "item_origin").find(f => f.what === item)?.where;

const RULE_FORMS = [
  {
    // Alibi oczyszcza tylko wtedy, gdy jest potwierdzone i obejmuje cały czas zgonu.
    pattern: /^no_confirmed_alibi\(culprit, time_of_death\)$/,
    test: (c, { culprit }) =>
      !factsOf(c, "alibi").some(f => f.who === culprit && f.confirmed && covers(span(f), span(c.time_of_death))),
  },
  {
    pattern: /^handedness\(culprit\) == (\w+)$/,
    test: (c, { culprit }, [, hand]) => factsOf(c, "handedness").some(f => f.who === culprit && f.value === hand),
  },
  {
    pattern: /^present\(culprit, origin\(weapon\)\) during item_moved\(weapon\)$/,
    test: (c, { culprit, weapon }) => {
      const moved = factsOf(c, "item_moved").find(f => f.what === weapon);
      const where = originOf(c, weapon);
      return factsOf(c, "presence").some(f => f.who === culprit && f.where === where && overlaps(span(f), span(moved)));
    },
  },
  {
    pattern: /^has_key\(culprit, origin\(weapon\)\)$/,
    test: (c, { culprit, weapon }) => {
      const where = originOf(c, weapon);
      return factsOf(c, "has_key").some(f => f.who === culprit && f.where === where);
    },
  },
];

function compileRule(rule) {
  for (const form of RULE_FORMS) {
    const match = rule.logic.match(form.pattern);
    if (match) return (c, suspect) => form.test(c, suspect, match);
  }
  throw new Error(`Nieznana postać reguły ${rule.id}: ${rule.logic}`);
}

export function solve(c) {
  const checks = c.rules.map(rule => ({ id: rule.id, test: compileRule(rule) }));
  const ids = type => c.nodes.filter(n => n.type === type).map(n => n.id);

  const candidates = ids("person").flatMap(culprit =>
    ids("item").map(weapon => ({
      culprit,
      weapon,
      failed: checks.filter(({ test }) => !test(c, { culprit, weapon })).map(({ id }) => id),
    }))
  );
  const solutions = candidates.filter(k => k.failed.length === 0);

  // Reguła jest potrzebna, gdy bez niej sprawa przestaje być jednoznaczna.
  const rules = c.rules.map(({ id }) => {
    const solutionsWithout = candidates.filter(k => k.failed.every(r => r === id)).length;
    return { id, solutionsWithout, needed: solutionsWithout > 1 };
  });

  const only = solutions.length === 1 ? solutions[0] : null;
  const matchesSolution = !!only && only.culprit === c.solution.culprit && only.weapon === c.solution.weapon;

  return { candidates, solutions, rules, matchesSolution, ok: matchesSolution && rules.every(r => r.needed) };
}
