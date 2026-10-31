---
phase: 03-llm-evaluation
plan: 05
subsystem: evals
tags: [evals, runner, report, resume, quota, cli]
requires: ["03-01", "03-02", "03-03", "03-04"]
provides:
  - "run.ts: runEval (injectable), probeModels, parseArgs, main; LlmRunResult, RunOutcome, ModelInfo types"
  - "report.ts: renderLlmReport (pure, deterministic)"
  - "npm run eval now runs evals/llm/run.js; evals/run.ts retired"
affects: [03-06, 03-07, 03-08]
tech-stack:
  added: []
  patterns: ["quota remembered by a doGenerate wrapper because runPreset converts every error into ok:false", "key literals scrubbed from the serialised result as a last line of defence", "entry point guarded by require.main === module so tests can import runEval"]
key-files:
  created: [evals/llm/run.ts, evals/llm/report.ts, tests/llm-run.test.ts, tests/llm-report.test.ts]
  modified: [package.json]
  deleted: [evals/run.ts]
key-decisions:
  - "A case is marked done in the cache only when it ran ok and the judge (if any) succeeded; errored cases and judge failures are retried on resume, with finished model calls served from the call cache"
  - "Default judge when --judge and EVAL_JUDGE are absent is the first selected generator (no hardcoded model ids); the report states self-preference when the judge shares a provider with a generator"
  - "Probe failures skip a model only when the message looks like not-found/unsupported/400/auth; other errors are harness errors"
  - "firstCallAt comes from a startedAt stored with each case record, so a resumed run reports identical values"
requirements-completed: []
duration: ~45min
completed: 2026-11-01
---

# Phase 3 Plan 05: Runner, report and CLI Summary

One command, `npm run eval`, now runs cases across models, judges, aggregates, writes results JSON and the generated report, resumes from the disk cache and stops cleanly on daily quota. The old runner is gone. No real-model calls were made; `.env` was never read (all CLI checks used `--no-dotenv`), and evals/LLM.md was not written.

## Tasks

1. runEval, probeModels, parseArgs, main, with offline end-to-end tests: commit 16c508e
2. renderLlmReport and fixture tests: commit 65a5247
3. `npm run eval` script change and `git rm evals/run.ts`: commit 854f6b6

## Behaviour notes

- Models outer, cases inner, sequential. The per-case factory wraps the base model in `recordingModel` and `setModelFactory(null)` runs in a `finally`.
- `runPreset` turns every thrown error into `{ ok: false }`, which would hide a daily-quota stop. The factory wrapper remembers a `QuotaExhaustedError` and the runner rethrows it after `runPreset` returns. Remaining outcomes become `notRun: "quota"` placeholders, `complete` is false, no throw.
- Placeholders are excluded from summaries, so unattempted cases do not count as failures.
- Probes (`__probe__` case id) run before any case through the cache, so a resumed run makes zero base-model calls (asserted by a test that counts mock calls).
- Result JSON passes through a literal-key scrub; a fake `AIzaFAKEKEY1234567890` is asserted absent from the result and the rendered report.
- CLI: `--dry` and `--estimate` need no key; missing key exits 2 naming the provider; no models exits 2 with the `--models` hint; estimate over `--max-requests` exits 2; partial runs (case subset, or any case not attempted) write `evals/results/LLM.preview.md`, only complete full runs write `evals/LLM.md` (or `--report`).

## Deviations from Plan

**1. [Rule 2 - correctness] Cache-done only on clean success**
- The plan said to store the outcome via markCaseDone after judging. Doing that for errored cases or failed judge calls would freeze the error across resumes, so those cases are left not-done and retried (their successful calls still come from the cache).

**2. [Rule 3 - design] Result additions**
- `RunOutcome` extends `CaseOutcome` with `startedAt` and `notRun`; `ModelInfo` has `freeTierKey` (key equals `FREE_TIER_API_KEY`) to drive the "Billed on free tier" row; `LlmRunResult` has `caseSubset`, `judgeNote` and an optional `agreement` slot for plan 06.

**3. Default judge**
- Not specified in the plan; chosen as described under key-decisions.

Otherwise the plan was executed as written. References to `evals/run`/`REPORT.md` remain in `.github/workflows/evals.yml`, `README.md` and `platform.md`; the plan defers those to Plan 07.

## Verification

- `npm test`: 211 tests, 211 pass, 0 fail (8 runner tests, 6 report tests added)
- `npm run typecheck`: clean
- `npm run eval:retrieval -- --ci`: baseline gate passed (retrieval scripts unaffected)
- `npm run eval -- --dry --no-dotenv` with FREE_TIER_API_KEY and EVAL_API_KEY unset: exit 0, 28 case rows, fingerprint line, "no models selected"
- `--estimate --models google:model-a,google:model-b --judge google:model-c`: `Total: 123-131 requests (worst case with JSON fallbacks: +72)`
- `--no-dotenv --models google:x` with no keys: exit 2, "No API key for provider google..."
- Greps: `setModelFactory(null)` present, `export async function runEval` 1, `QuotaExhaustedError` present, `do not edit by hand` 1, `Single run: each case ran once per model` 1, three section headings 3, `evals/llm/run.js` in package.json 1, evals/run.ts absent

## Known Stubs

None. The agreement section renders "Pending" by design until Plan 06.

## Self-Check: PASSED

All four created files exist, evals/run.ts is gone, commits 16c508e, 65a5247 and 854f6b6 exist. The user's uncommitted edits were not staged or touched.
