// DOC-02: scoring and finalizers match on canonical skills. No model calls.
import assert from "node:assert";
import { test } from "node:test";
import { applySkillEvidence, canonicalSkillEvidence, keywordCoverage } from "../lib/engine/scoring";

const kw = (term: string, synonyms: string[] = []) => ({ term, importance: "must" as const, synonyms, evidencedBy: [] as string[] });

test("keywordCoverage: alias in the resume satisfies the canonical term", () => {
  const c = keywordCoverage("Skills: JS, ReactJS", [kw("JavaScript"), kw("React")]);
  assert.deepStrictEqual(c.items.map((i) => i.found), [true, true]);
  assert.deepStrictEqual(c.items.map((i) => i.matchedAs), ["JS", "ReactJS"]);
  assert.deepStrictEqual(c.items.map((i) => i.canonical), ["JavaScript", "React"]);
  assert.strictEqual(c.score, 100);
});

test("keywordCoverage: works in the other direction too", () => {
  const c = keywordCoverage("Skills: JavaScript", [kw("JS")]);
  assert.strictEqual(c.items[0].found, true);
  assert.strictEqual(c.items[0].matchedAs, "JavaScript");
});

test("keywordCoverage: Go still does not match Google, and lowercase 'go' is not Go via aliases", () => {
  assert.strictEqual(keywordCoverage("Worked at Google on search", [kw("Go", ["Golang"])]).items[0].found, false);
  assert.strictEqual(keywordCoverage("We go to market fast", [kw("Golang")]).items[0].found, false);
  assert.strictEqual(keywordCoverage("Services written in Go", [kw("Golang")]).items[0].found, true);
});

test("keywordCoverage: unknown terms behave exactly as before", () => {
  const c = keywordCoverage("Built a zorblax pipeline", [kw("Zorblax"), kw("Flarbo", ["zorblax"]), kw("Quux")]);
  assert.deepStrictEqual(c.items.map((i) => i.found), [true, true, false]);
  assert.deepStrictEqual(c.items.map((i) => i.canonical), [null, null, null]);
  assert.strictEqual(c.items[1].matchedAs, "zorblax");
});

test("keywordCoverage: model synonyms are expanded to canonical aliases", () => {
  const c = keywordCoverage("Ran workloads on k8s", [kw("Container orchestration", ["Kubernetes"])]);
  assert.strictEqual(c.items[0].found, true);
  assert.strictEqual(c.items[0].canonical, "Kubernetes");
});

test("canonicalSkillEvidence", () => {
  assert.deepStrictEqual(canonicalSkillEvidence("Strong JavaScript and React", "Built UIs in JS and ReactJS"), {
    skills: ["JavaScript", "React"],
    matchedAs: ["JS", "ReactJS"],
  });
  assert.strictEqual(canonicalSkillEvidence("Excellent communication", "Built UIs in JS"), null);
  assert.strictEqual(canonicalSkillEvidence("5+ years experience", "Built UIs in JS"), null);
  assert.strictEqual(canonicalSkillEvidence("Strong JavaScript and React", "Built UIs in JS"), null, "every named skill must be present");
});

test("applySkillEvidence upgrades only MISSING to PARTIAL and does not mutate", () => {
  const reqs = [
    { requirement: "JavaScript", importance: "must" as const, evidence: "MISSING" as const },
    { requirement: "JavaScript", importance: "must" as const, evidence: "UNVERIFIED" as const },
    { requirement: "JavaScript", importance: "must" as const, evidence: "STRONG" as const },
    { requirement: "Rust", importance: "nice" as const, evidence: "MISSING" as const },
  ];
  const frozen = JSON.stringify(reqs);
  const out = applySkillEvidence(reqs, "Built UIs in JS");
  assert.strictEqual(JSON.stringify(reqs), frozen);
  assert.deepStrictEqual(out.map((r) => r.evidence), ["PARTIAL", "UNVERIFIED", "STRONG", "MISSING"]);
  assert.deepStrictEqual(out[0].skillMatch, { skills: ["JavaScript"], matchedAs: ["JS"], correctedFrom: "MISSING" });
  assert.strictEqual(out[1].skillMatch, undefined);
  assert.strictEqual(out[3].skillMatch, undefined);
  assert.notStrictEqual(out, reqs);
});

test("case-sensitive alias check escapes regex metacharacters", () => {
  const c = keywordCoverage("Wrote C++ and C# daily", [kw("C++"), kw("C#")]);
  assert.deepStrictEqual(c.items.map((i) => i.found), [true, true]);
});
