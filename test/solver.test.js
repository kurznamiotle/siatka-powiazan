import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { solve } from "../src/solver.js";

const loadCase = () => JSON.parse(readFileSync("cases/case_001.json", "utf8"));

test("case_001 ma dokładnie jedno rozwiązanie, zgodne z polem solution", () => {
  const r = solve(loadCase());
  assert.equal(r.solutions.length, 1);
  assert.equal(r.solutions[0].culprit, "bozena");
  assert.equal(r.solutions[0].weapon, "lewar");
  assert.equal(r.matchesSolution, true);
});

test("case_001: każda z 4 reguł jest potrzebna", () => {
  const r = solve(loadCase());
  assert.equal(r.rules.length, 4);
  assert.deepEqual(r.rules.filter(x => !x.needed).map(x => x.id), []);
  assert.equal(r.ok, true);
});

test("case_001: sprawcę z fałszywym tropem odsiewa wyłącznie reguła 3", () => {
  const { candidates } = solve(loadCase());
  const k = candidates.find(x => x.culprit === "bozena" && x.weapon === "mozdzierz");
  assert.deepEqual(k.failed, ["r3"]);
});

test("potwierdzone alibi musi obejmować cały czas zgonu", () => {
  const c = loadCase();
  c.facts.find(f => f.type === "alibi" && f.who === "roman").to = "20:15";
  assert.ok(solve(c).solutions.some(s => s.culprit === "roman"));
});

test("druga para spełniająca reguły psuje jednoznaczność", () => {
  const c = loadCase();
  c.facts.find(f => f.type === "alibi" && f.who === "roman").confirmed = false;
  const r = solve(c);
  assert.equal(r.solutions.length, 2);
  assert.equal(r.matchesSolution, false);
  assert.equal(r.ok, false);
});

test("sprzeczne fakty dają zero rozwiązań", () => {
  const c = loadCase();
  c.facts.find(f => f.type === "handedness" && f.who === "bozena").value = "right";
  const r = solve(c);
  assert.equal(r.solutions.length, 0);
  assert.equal(r.ok, false);
});

test("nieznana postać reguły to błąd, nie cichy brak warunku", () => {
  const c = loadCase();
  c.rules[0].logic = "alibi_ksiezyca(culprit)";
  assert.throws(() => solve(c), /Nieznana postać reguły r1/);
});
