---
phase: 03-llm-evaluation
plan: 04
subsystem: evals
tags: [evals, citations, judge, metrics, zod, prompt-injection]
requires: ["03-01", "03-02", "03-03"]
provides:
  - "citations.ts: extractCitationUnits over the raw model object, finalDraftText"
  - "judge.ts: judgeSchema, fence, buildJudgePrompt, parseJudge, runJudge, JUDGE_SYSTEM"
  - "metrics.ts: percentile, caseMetrics, modelSummary, CaseOutcome"
affects: [03-05, 03-08]
tech-stack:
  added: []
  patterns: ["fence neutralises every fence tag in all untrusted text", "string-enum scores converted to numbers after parse", "null for zero denominators, never 0 or NaN"]
key-files:
  created: [evals/llm/citations.ts, evals/llm/judge.ts, evals/llm/metrics.ts, tests/llm-citations.test.ts, tests/llm-judge.test.ts, tests/llm-metrics.test.ts]
  modified: []
key-decisions:
  - "Precision uses judged outputs only; units of outputs whose judge failed leave the precision denominator, but id validity (deterministic) still counts them"
  - "Figure-only fabrication rate uses the same judged-output denominator as the combined rate so the two sit side by side"
  - "Failed calls (error set) are skipped for token, latency and cost sums and counted as failedCalls"
requirements-completed: []
duration: ~40min
completed: 2026-11-01
---

# Phase 3 Plan 04: Citations, judge and metrics Summary

Citation-unit extraction, a fenced zod-validated judge and pure metric aggregation, all following evals/llm/RUBRIC.md (unchanged). No real-model calls were made; every test uses scripted models.

## Tasks

1. Citation-unit extraction: commit 68f8630
2. Fenced judge: commit 4f64d16
3. Metric aggregation: commit d481d77

## Notes

- Units get path `$` when `chunkIds` sits on the root object. The claim for an id array is the JSON of the holding object's top-level string fields, capped at 600 chars.
- `fence()` neutralises every fence tag (open or close, any case or spacing) with `&lt;`, not just its own, so model output cannot fake `<supplied_vault>` either. Test: a fence-break string leaves exactly one closing tag.
- `runJudge` calls `generateObject` with temperature 0 and maxRetries 0 through `recordingModel` (purpose judge). On bad output it makes one `generateText` fallback and validates locally; a second failure gives `{ ok: false }`. Quota exhaustion is rethrown so the runner can stop.
- Token `partial` flags are per component (prompt, completion, thoughts) so a provider that never reports thinking tokens is visible without making cost unknown.

## Deviations from Plan

**1. [Rule 3 - design] Rubric hash goes into the system prompt, not RecordingContext**
- The plan said to add the rubric hash to the recordingModel ctx. That would need a change to recordingModel.ts, which is outside this plan's files. JUDGE_SYSTEM embeds the full RUBRIC.md text plus a `Rubric hash:` line, and the system prompt is part of the request hash, so any rubric change still invalidates cached judgements.

Otherwise the plan was executed as written.

## Verification

- `npm test`: 197 tests, 197 pass, 0 fail (8 citation, 11 judge, 7 metrics tests added)
- `npm run typecheck`: clean
- Plan greps: `untrusted_model_output`, `untrusted_case_material`, `temperature: 0`, `maxRetries: 0`, `loadRubric` present in judge.ts; `Number.isFinite` present in the metrics test

## Known Stubs

None.

## Self-Check: PASSED

All six files exist; commits 68f8630, 4f64d16 and d481d77 exist. The user's uncommitted edits were not staged or touched.
