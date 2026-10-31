---
phase: 03-llm-evaluation
plan: 02
subsystem: evals
tags: [evals, cache, throttle, retry, quota, recording-model]
requires: ["03-01"]
provides:
  - "env.ts: loadDotEnv, parseModelSpec, resolveKey (EVAL_* then FREE_TIER_*), describeConfig (key: set/missing only)"
  - "models.ts: listGoogleModels via x-goog-api-key header"
  - "cache.ts: versioned atomic disk cache, case-level done records"
  - "throttle.ts: per-model RPM throttle, withRetry, Retry-After/retryDelay parsing, daily-quota stop"
  - "recordingModel.ts: LanguageModelV1 wrapper (cache -> throttle -> retry -> delegate) with call transcript"
  - "estimate.ts: cache-aware request estimate including reviewer loop and judge"
affects: [03-04, 03-05, 03-08]
tech-stack:
  added: []
  patterns: ["allowlist-rebuilt cache entries", "plain Error after retries so SDK maxRetries cannot multiply attempts", "fresh AbortSignal per attempt"]
key-files:
  created: [evals/llm/env.ts, evals/llm/models.ts, evals/llm/cache.ts, evals/llm/throttle.ts, evals/llm/recordingModel.ts, evals/llm/estimate.ts, tests/llm-cache.test.ts, tests/llm-throttle.test.ts, tests/llm-recording.test.ts]
  modified: []
key-decisions:
  - "Cache entries are rebuilt from an allowlist on write, so stray fields (headers, raw body, keys) can never persist"
  - "Unknown token counts (NaN from provider) are stored as null and handed back to the SDK as NaN, matching provider behaviour"
  - "Estimator adds one probe per generation model plus one for the judge when the judge is not also a generation model"
requirements-completed: []
duration: ~35min
completed: 2026-11-01
---

# Phase 3 Plan 02: Quota-safe call infrastructure Summary

Env and key resolution, model listing, a disk cache, throttle plus retry, a recording model wrapper and a request estimator. No real-model or network calls were made; the `.env` file was never read.

## Tasks

1. Env/key resolution, model listing, disk cache: commit 0b40676
2. Throttle, retry with backoff and Retry-After, daily-quota detection: commit 2643e97
3. Recording model wrapper and estimator: 3d5b214

## Estimate figures

For the 28-case set, 2 generation models and a judge: 4 review-preset cases, so generation 64-72, judge 56, probes 3 (two models plus the judge) gives Total 123-131 requests, worst case with JSON fallbacks +72. The test asserts these exact numbers when the case/review counts match, and otherwise asserts the computed formula.

## Deviations from Plan

**1. [Rule 1 - Bug in plan assumption] Mock models must declare an object generation mode**
- Found during: Task 3
- Issue: `MockLanguageModelV1` without `defaultObjectGenerationMode` makes `generateObject` throw before any call, so `run.ts` always takes the generateText fallback and the first call classifies as `fallback-json`, not `generate`. The existing pipeline tests run in that mode.
- Fix: the recording tests' mock sets `defaultObjectGenerationMode: "json"`, so roles are generate, review, revise as specified. Real Gemini models declare a mode, so this only affects mocks.

**2. [Rule 2 - estimator] Judge probe**
- The first estimator counted one probe per generation model (122-130). Added one probe for the judge model when it is not a generation model to match the planned 123-131.

Otherwise the plan was executed as written. The live model-listing check was not required by the plan and was not run.

## Verification

- `npm test`: 171 tests, 171 pass, 0 fail
- `npm run typecheck`: clean
- `git check-ignore evals/results/llm-cache/x.json` prints the path (cache dir already ignored)
- Greps: `x-goog-api-key` present and `?key=` absent in models.ts; `rawResponse: |headers: ` count 0 in cache.ts; `setTimeout` count 0 in the throttle test

## Known Stubs

None.

## Self-Check: PASSED

All nine files exist; commits 0b40676, 2643e97 and 3d5b214 exist. The user's uncommitted edits were not staged or touched.
