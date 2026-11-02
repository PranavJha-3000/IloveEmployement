import assert from "node:assert";
import { test } from "node:test";
import type { CitationUnit } from "../evals/llm/citations";
import type { JudgeResult } from "../evals/llm/judge";
import { caseMetrics, modelSummary, percentile, type CaseOutcome, type PriceLookup } from "../evals/llm/metrics";
import type { PriceRow } from "../evals/llm/prices";
import type { CallRecord } from "../evals/llm/recordingModel";
import type { RunMeta } from "../lib/engine/types";

const row = (inputPerMTok: number, outputPerMTok: number): PriceRow => ({
  provider: "google", model: "x", matches: [], inputPerMTok, outputPerMTok, freeTierAvailable: true, freeTierBilledUsd: 0,
  sourceUrl: "test", retrieved: "2026-11-01", notes: "",
});
// Generator m: $1 in / $2 out per M tokens. Judge j: $3 in / $6 out per M tokens. Anything else unknown.
const PRICES: PriceLookup = (key) => (key === "google:m" ? row(1, 2) : key === "google:j" ? row(3, 6) : null);

const call = (
  role: CallRecord["role"], p: number | null, c: number | null, t: number | null, latencyMs: number | null,
  extra: Partial<CallRecord> = {},
): CallRecord => ({
  caseId: "x", modelKey: "google:m", purpose: "generation", role, hash: "h", cached: false, latencyMs, promptTokens: p,
  completionTokens: c, thoughtsTokens: t, modelVersion: null, temperature: 0.5, finishReason: "stop", responseText: "{}", ...extra,
});
const jcall = (p: number, c: number): CallRecord => call("judge", p, c, null, 700, { modelKey: "google:j", purpose: "judge" });
const unit = (index: number, idValid: boolean): CitationUnit => ({ index, path: `p${index}`, chunkId: "c", claim: "x", idValid });

const meta = (m: Partial<RunMeta>): RunMeta => ({
  tier: "byok", model: "m", remaining: null, context: [], knowledge: [], usage: null, injection: [], grounding: [], ...m,
});
const judgeOk = (
  g: 1 | 2 | 3 | 4, t: 1 | 2 | 3 | 4, c: 1 | 2 | 3 | 4,
  verdicts: Record<number, "supports" | "partial" | "does_not_support">,
  unjudged: number[], supported: number, unsupported: number,
): JudgeResult => ({
  ok: true, scores: { groundedness: g, task_fit: t, clarity: c }, reasons: { groundedness: "", task_fit: "", clarity: "" },
  claims: [
    ...Array.from({ length: supported }, () => ({ claim: "s", status: "supported" as const, evidence: "input" })),
    ...Array.from({ length: unsupported }, () => ({ claim: "u", status: "unsupported" as const, evidence: "input" })),
  ],
  citationVerdicts: verdicts, unjudged, ignoredVerdicts: 0,
});

const base = { engine: "tailor", tags: [], modelKey: "google:m", failures: [] as string[] };

// A: 2 generation calls, 4 units (3 valid, 1 invalid), judge scores 4/3/4, 3 supported + 1 unsupported claims.
const A: CaseOutcome = {
  ...base, caseId: "A", ok: true, passed: true,
  meta: meta({
    injection: [{ field: "jd", findings: ["a", "b"] }],
    grounding: ["Dropped 1 citation(s) that did not match", "Unsupported figures: 10x"],
    review: { revised: true, issues: [{ severity: "high", where: "", problem: "", fix: "" }, { severity: "low", where: "", problem: "", fix: "" }, { severity: "medium", where: "", problem: "", fix: "" }] },
  }),
  calls: [call("generate", 1000, 500, 100, 2000), call("revise", 200, 100, 0, 1000)],
  judgeCalls: [jcall(2000, 300)],
  units: [unit(1, true), unit(2, true), unit(3, true), unit(4, false)],
  judge: judgeOk(4, 3, 4, { 1: "supports", 2: "partial", 3: "does_not_support" }, [], 3, 1),
};
// B: 1 call, 2 valid units both supported, no flags, scores 3/3/3, 4 supported claims.
const B: CaseOutcome = {
  ...base, caseId: "B", ok: true, passed: true, meta: meta({}),
  calls: [call("generate", 500, 250, 0, 1000)], judgeCalls: [jcall(1000, 200)],
  units: [unit(1, true), unit(2, true)],
  judge: judgeOk(3, 3, 3, { 1: "supports", 2: "supports" }, [], 4, 0),
};
// C: failed behaviour, 3 valid units (one unjudged), scores 2/4/2, 1 supported + 1 unsupported claim, no figure warning.
const C: CaseOutcome = {
  ...base, caseId: "C", ok: true, passed: false, failures: ["x"], meta: meta({}),
  calls: [call("generate", 600, 300, 0, 4000)], judgeCalls: [jcall(800, 100)],
  units: [unit(1, true), unit(2, true), unit(3, true)],
  judge: judgeOk(2, 4, 2, { 1: "supports", 2: "partial" }, [3], 1, 1),
};
// D: errored, one failed call (null counts), nothing else.
const D: CaseOutcome = {
  ...base, caseId: "D", ok: false, passed: false, error: "boom",
  calls: [call("generate", null, null, null, null, { error: "boom", responseText: null })], judgeCalls: [], units: [],
};

const close = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test("percentile: nearest rank, empty is null", () => {
  assert.strictEqual(percentile([], 0.5), null);
  assert.strictEqual(percentile([5], 0.95), 5);
  assert.strictEqual(percentile([4000, 1000, 3000], 0.5), 3000);
  assert.strictEqual(percentile([4000, 1000, 3000], 0.95), 4000);
  assert.strictEqual(percentile([1, 2, 3, 4], 0.5), 3); // floor(4 * 0.5) = 2 -> third value
});

test("caseMetrics for A matches the hand computation", () => {
  const m = caseMetrics(A, PRICES);
  // Generation: prompt 1000 + 200, completion 500 + 100, thoughts 100 + 0.
  assert.deepStrictEqual(m.tokens, { prompt: 1200, completion: 600, thoughts: 100, total: 1900, partial: { prompt: false, completion: false, thoughts: false } });
  assert.strictEqual(m.judgeTokens.total, 2300);
  assert.strictEqual(m.judgeTokens.partial.thoughts, true);
  assert.strictEqual(m.latencyMs, 3000);
  // 1200 * 1 + (600 + 100) * 2 = 2600 micro-dollars.
  close(m.costUsd, 0.0026);
  // Judge: 2000 * 3 + 300 * 6 = 7800 micro-dollars.
  close(m.judgeCostUsd, 0.0078);
  assert.deepStrictEqual(m.callsByRole, { generate: 1, revise: 1 });
  assert.deepStrictEqual(m.guardrails, { injectionFlags: 2, droppedCitations: 1, unsupportedFigureWarnings: 1, reviewIssues: 2, revised: true });
  assert.deepStrictEqual(m.citation, { units: 4, validIds: 3, supports: 1, partial: 1, doesNotSupport: 1, unjudged: 0, judged: true });
  assert.deepStrictEqual(m.fabrication, { supportedClaims: 3, unsupportedClaims: 1, judgeFlag: true, figureFlag: true, combinedFlag: true });
});

test("caseMetrics: errored case has no cost or latency, failed call flagged, no judged fields", () => {
  const m = caseMetrics(D, PRICES);
  assert.strictEqual(m.costUsd, null);
  assert.strictEqual(m.latencyMs, null);
  assert.strictEqual(m.failedCalls, 1);
  assert.strictEqual(m.tokens.total, 0);
  assert.strictEqual(m.fabrication.combinedFlag, null);
  assert.strictEqual(m.citation.judged, false);
});

test("caseMetrics: unknown price or a null token count makes cost null, partial flagged", () => {
  const noPrice: CaseOutcome = { ...B, calls: [call("generate", 10, 10, 0, 5, { modelKey: "google:unpriced" })] };
  assert.strictEqual(caseMetrics(noPrice, PRICES).costUsd, null);
  const nullTokens: CaseOutcome = { ...B, calls: [call("generate", 10, null, 0, 5)] };
  const m = caseMetrics(nullTokens, PRICES);
  assert.strictEqual(m.costUsd, null);
  assert.strictEqual(m.tokens.partial.completion, true);
});

test("modelSummary for the four-outcome fixture", () => {
  const s = modelSummary([A, B, C, D], PRICES);
  // Behavioural: A and B pass of 4 attempted, D is an error.
  assert.strictEqual(s.cases, 4);
  assert.strictEqual(s.passRate, 0.5);
  assert.strictEqual(s.errors, 1);
  assert.strictEqual(s.judged, 3);
  assert.strictEqual(s.outputsWithUnits, 3);
  // Id validity: valid 3 + 2 + 3 = 8 of 4 + 2 + 3 = 9 units.
  assert.strictEqual(s.citationIdValidity, 8 / 9);
  // Precision: denominator 9 units - 1 unjudged = 8. Strict 1 + 2 + 1 = 4 supports; lenient adds partial 1 + 0 + 1 = 6.
  assert.strictEqual(s.citationPrecisionStrict, 4 / 8);
  assert.strictEqual(s.citationPrecisionLenient, 6 / 8);
  assert.deepStrictEqual(s.citation, { units: 9, validIds: 8, supports: 4, partial: 2, doesNotSupport: 1, unjudged: 1 });
  // Claims: unsupported 1 + 0 + 1 = 2 of supported 3 + 4 + 1 = 8 plus 2.
  assert.strictEqual(s.claimFabricationRate, 2 / 10);
  // Output flags: A (claim + figure), C (claim only) of 3 judged; figure check alone flags only A.
  assert.strictEqual(s.outputFabricationRate, 2 / 3);
  assert.strictEqual(s.figureOnlyFabricationRate, 1 / 3);
  // Judge means: groundedness (4+3+2)/3, task_fit (3+3+4)/3, clarity (4+3+2)/3.
  assert.strictEqual(s.judgeMeans.groundedness, 3);
  assert.strictEqual(s.judgeMeans.task_fit, 10 / 3);
  assert.strictEqual(s.judgeMeans.clarity, 3);
  // Tokens: prompt 1200 + 500 + 600, completion 600 + 250 + 300, thoughts 100; mean over the 3 cases with calls.
  assert.deepStrictEqual(
    [s.tokens.prompt, s.tokens.completion, s.tokens.thoughts, s.tokens.total, s.tokens.meanPerCase, s.tokens.partialCases],
    [2300, 1150, 100, 3550, 3550 / 3, 0],
  );
  assert.strictEqual(s.judgeTokens.total, 2300 + 1200 + 900);
  // Latency over non-errored cases: [3000, 1000, 4000] -> sorted [1000, 3000, 4000].
  assert.strictEqual(s.latencyP50Ms, 3000);
  assert.strictEqual(s.latencyP95Ms, 4000);
  // Cost: A 2600 + B 1000 + C 1200 micro-dollars; D unknown.
  close(s.costTotalUsd, 0.0048);
  close(s.costPerCaseUsd, 0.0016);
  assert.deepStrictEqual([s.costKnownCases, s.costUnknownCases], [3, 1]);
  // Judge cost: 7800 + 4200 + 3000 micro-dollars.
  close(s.judgeCostTotalUsd, 0.015);
  assert.strictEqual(s.judgeCostUnknownOutputs, 0);
});

test("a failed judge excludes the output from judged denominators and is counted", () => {
  const failedJudge: CaseOutcome = { ...B, judge: { ok: false, error: "bad" } };
  const s = modelSummary([A, failedJudge], PRICES);
  assert.strictEqual(s.judged, 1);
  assert.strictEqual(s.judgeErrors, 1);
  assert.strictEqual(s.citationPrecisionStrict, 1 / 4);
  assert.strictEqual(s.judgeMeans.groundedness, 4);
  // Id validity is deterministic, so it still counts the unjudged output's units: (3 + 2) / (4 + 2).
  assert.strictEqual(s.citationIdValidity, 5 / 6);
});

function walkNumbers(value: unknown, path: string, bad: string[]) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) bad.push(path);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkNumbers(v, `${path}.${k}`, bad);
  } else if (value !== null) {
    bad.push(`${path} (${typeof value})`);
  }
}

test("zero-denominator models: every numeric field is a finite number or null, never NaN", () => {
  for (const outcomes of [[], [D], [{ ...B, units: [], judge: undefined, judgeCalls: [] }]] as CaseOutcome[][]) {
    const s = modelSummary(outcomes, PRICES);
    const bad: string[] = [];
    walkNumbers(s, "summary", bad);
    assert.deepStrictEqual(bad, [], `non-finite or non-number fields: ${bad.join(", ")}`);
    assert.ok(Object.values(s).every((v) => typeof v !== "number" || Number.isFinite(v)));
  }
  const empty = modelSummary([], PRICES);
  assert.strictEqual(empty.passRate, null);
  assert.strictEqual(empty.citationPrecisionStrict, null);
  assert.strictEqual(empty.outputFabricationRate, null);
  assert.strictEqual(empty.latencyP50Ms, null);
  assert.strictEqual(empty.costTotalUsd, null);
  assert.strictEqual(modelSummary([D], PRICES).passRate, 0);
  assert.strictEqual(modelSummary([D], PRICES).errors, 1);
});
