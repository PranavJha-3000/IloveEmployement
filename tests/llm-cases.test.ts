// Offline structural tests of the LLM eval case set. No network, no model calls.
import assert from "node:assert";
import { test } from "node:test";
import { BACKEND_RESUME, CASES, type EvalCase } from "../evals/cases";
import { prepareCase, stableChunks } from "../evals/llm/caseRun";
import { caseFingerprint } from "../evals/llm/fingerprint";
import { contentHash } from "../lib/retrieval/fusion";
import { DEFAULT_VAULT_LIMIT } from "../lib/presets/types";

test("stableChunks is deterministic with content-derived ids", () => {
  const a = stableChunks(BACKEND_RESUME);
  const b = stableChunks(BACKEND_RESUME);
  assert.deepStrictEqual(a, b);
  assert.ok(a.length > 3);
  const key = contentHash(BACKEND_RESUME);
  a.forEach((c, i) => {
    assert.strictEqual(c.id, `${key}-${String(i + 1).padStart(2, "0")}`);
    assert.strictEqual(c.createdAt, 0);
  });
});

test("prepareCase: no resume gives an empty vault and default profile name", () => {
  const c = CASES.find((x) => x.id === "jd-red-flags-quoted") as EvalCase;
  const p = prepareCase(c);
  assert.deepStrictEqual(p.vault, []);
  assert.strictEqual(p.profile.name, "Priya Sharma");
});

test("prepareCase: vault preset respects the limit and uses stable ids", () => {
  const c = CASES.find((x) => x.id === "fit-strong-match") as EvalCase;
  const p = prepareCase(c);
  assert.ok(p.vault.length > 0);
  assert.ok(p.vault.length <= (p.preset.vaultLimit ?? DEFAULT_VAULT_LIMIT));
  const ids = new Set(stableChunks(c.resume as string).map((x) => x.id));
  for (const v of p.vault) assert.ok(ids.has(v.id), `unexpected id ${v.id}`);
  assert.strictEqual(p.profile.name, "Priya Sharma");
  assert.deepStrictEqual(prepareCase(c).vault, p.vault);
});

test("prepareCase throws on an unknown preset", () => {
  const bad: EvalCase = { id: "x", presetId: "nope", description: "", inputs: {}, tags: ["baseline"], expect: () => [] };
  assert.throws(() => prepareCase(bad), /Unknown preset nope/);
});

test("caseFingerprint is stable and sensitive to inputs", () => {
  assert.strictEqual(caseFingerprint(CASES), caseFingerprint(CASES));
  const changed = CASES.map((c, i) => (i === 0 ? { ...c, inputs: { ...c.inputs, extra: "changed" } } : c));
  assert.notStrictEqual(caseFingerprint(changed), caseFingerprint(CASES));
});
