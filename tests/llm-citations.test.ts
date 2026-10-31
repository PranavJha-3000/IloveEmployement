import assert from "node:assert";
import { test } from "node:test";
import { extractCitationUnits, finalDraftText } from "../evals/llm/citations";
import type { CallRecord } from "../evals/llm/recordingModel";

const ids = (...a: string[]) => new Set(a);

test("citations[] yields a unit with claim and validity", () => {
  const units = extractCitationUnits({ citations: [{ chunkId: "a", claim: "x" }] }, ids("a"));
  assert.deepStrictEqual(units, [{ index: 1, path: "citations[0]", chunkId: "a", claim: "x", idValid: true }]);
});

test("fit-report chunkIds: one unit per id, claim from string fields only", () => {
  const raw = { requirements: [{ requirement: "Go", proof: "Built it", score: 3, chunkIds: ["a", "zz"] }] };
  const units = extractCitationUnits(raw, ids("a"));
  assert.strictEqual(units.length, 2);
  assert.deepStrictEqual(units.map((u) => [u.path, u.chunkId, u.idValid]), [["requirements[0]", "a", true], ["requirements[0]", "zz", false]]);
  assert.strictEqual(units[0].claim, JSON.stringify({ requirement: "Go", proof: "Built it" }));
  assert.ok(!units[0].claim.includes("chunkIds"));
});

test("claim is truncated to 600 chars", () => {
  const units = extractCitationUnits({ items: [{ text: "x".repeat(2000), chunkIds: ["a"] }] }, ids("a"));
  assert.strictEqual(units[0].claim.length, 600);
});

test("evidencedBy on ATS keywords", () => {
  const units = extractCitationUnits({ keywords: [{ term: "Kubernetes", importance: "must", evidencedBy: ["c3"] }] }, ids("c3"));
  assert.strictEqual(units.length, 1);
  assert.strictEqual(units[0].path, "keywords[0]");
  assert.ok(units[0].claim.includes("Kubernetes"));
});

test("nested arrays are walked recursively and numbered in document order", () => {
  const raw = {
    summary: { text: "S", chunkIds: ["c1"] },
    sections: [{ title: "Exp", entries: [{ heading: "Zeta", bullets: [{ text: "B1", chunkIds: ["c3", "bad"] }, { text: "B2", chunkIds: ["c1"] }] }] }],
  };
  const units = extractCitationUnits(raw, ids("c1", "c3"));
  assert.deepStrictEqual(units.map((u) => u.index), [1, 2, 3, 4]);
  assert.deepStrictEqual(units.map((u) => u.path), ["summary", "sections[0].entries[0].bullets[0]", "sections[0].entries[0].bullets[0]", "sections[0].entries[0].bullets[1]"]);
  assert.deepStrictEqual(units.map((u) => u.idValid), [true, true, false, true]);
});

test("non-string ids and duplicate (path,id) pairs are ignored; null input is empty", () => {
  const raw = { a: { text: "t", chunkIds: ["x", "x", 5, null, { id: 1 }] }, citations: [{ chunkId: 7, claim: "c" }] };
  const units = extractCitationUnits(raw, ids("x"));
  assert.strictEqual(units.length, 1);
  assert.strictEqual(units[0].chunkId, "x");
  assert.deepStrictEqual(extractCitationUnits(null, ids()), []);
  assert.deepStrictEqual(extractCitationUnits(undefined, ids()), []);
  assert.deepStrictEqual(extractCitationUnits("str", ids()), []);
});

test("raw (pre-scrub) ids stay visible as invalid", () => {
  const units = extractCitationUnits({ chunkIds: ["ghost"] }, ids("real"));
  assert.strictEqual(units[0].idValid, false);
  assert.strictEqual(units[0].path, "$");
});

const rec = (role: CallRecord["role"], purpose: CallRecord["purpose"], responseText: string | null, error?: string): CallRecord => ({
  caseId: "c", modelKey: "m", purpose, role, hash: "h", cached: false, latencyMs: 1, promptTokens: 1, completionTokens: 1,
  thoughtsTokens: null, modelVersion: null, temperature: 0, finishReason: "stop", responseText, error,
});

test("finalDraftText picks the last generate/revise/fallback-json generation call", () => {
  assert.strictEqual(finalDraftText([rec("generate", "generation", "D1"), rec("review", "generation", "R"), rec("revise", "generation", "D2"), rec("judge", "judge", "J")]), "D2");
  assert.strictEqual(finalDraftText([rec("generate", "generation", "D1"), rec("review", "generation", "R")]), "D1");
  assert.strictEqual(finalDraftText([rec("fallback-json", "generation", "F")]), "F");
  assert.strictEqual(finalDraftText([rec("generate", "generation", null, "boom")]), null);
  assert.strictEqual(finalDraftText([]), null);
});
