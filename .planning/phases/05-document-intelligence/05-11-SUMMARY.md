---
phase: 05-document-intelligence
plan: 11
subsystem: evals
tags: [eval, llm, profile, cache, quota, DOC-03]
requires: [05-09, 05-10]
provides:
  - evals/profile/llm.ts (runProfileLlm, profileCaseId, runLlmCommand, LlmProfileSection re-export)
  - npm run eval:profile -- --llm (human-run only; --yes required to spend requests)
  - LLM section rendering in evals/PROFILE.md (left pending)
affects: [05-12]
key-files:
  created: [evals/profile/llm.ts, tests/profile-llm.test.ts]
  modified: [evals/profile/run.ts, evals/profile/report.ts, evals/PROFILE.md]
decisions:
  - "LlmProfileSection is defined in report.ts (type only) and re-exported from llm.ts so the report renderer never imports the engine"
  - "The --llm command wrapper lives in llm.ts, keeping run.ts free of any model factory or key reference"
metrics:
  tasks: 2
  completed: 2026-11-01
---

# Phase 5 Plan 11: LLM-refined measurement path Summary

The LLM-refined extraction measurement is built and proven offline with scripted models; it has never been run against a real model, and PROFILE.md still records the LLM section as pending.

## What was built

- `runProfileLlm`: per model and resume, runs the hidden `profile-extract` preset through `runPreset` exactly as the app does, wrapped in the Phase 3 `recordingModel`, throttle and retry with the shared `evals/results/llm-cache` root. Case ids are `profile-extract--<resumeId>`. Per resume it stores only counts, usage and status (no resume text, no keys). It computes LLM-only counts (the finalized profile) and refined counts (`mergeExtractions` of the deterministic and LLM results), skips resumes already done in cache, and on a daily-quota error stops that model gracefully with `status: "partial"`.
- `runLlmCommand` (used by `--llm`): loads `.env` unless `--no-dotenv`, takes `--models` or the Phase 3 defaults, `--rpm` (default 5 like Phase 3), prints the request estimate, and refuses to spend any uncached request without `--yes`. `--llm` with `--ci` exits 2 with "The CI gate is deterministic only."; it is also rejected with `--update-baseline`.
- `run.ts`: `main` is exported (guarded by `require.main === module`). A measured section is written to `evals/results/profile-llm-latest.json` (gitignored) and is included in later default reports only when the dataset fingerprint, extractor version and taxonomy version all match.
- `report.ts`: renders per model resumes done, quota stop note, tokens, a refined-versus-deterministic table with F1 change, and an LLM-only table.

## Verification

- `npm test`: 481 pass, 0 fail (9 in `tests/profile-llm.test.ts`, alongside the unchanged `llm-run` and `llm-cache` tests). `npm run typecheck`: clean. Eval build clean.
- Offline behaviours covered: counts computed and cache entries written under `profile-extract--<id>/<modelKeySafe>/` with `case.json` per resume; a second run with a throwing factory completes from cache; 429 daily-quota on the 3rd resume gives partial, `stoppedByQuota`, 2 done, no throw; keyless model skipped; `--yes` gate; `--llm --ci` exit 2.
- No CASES id starts with `profile-`; `HARNESS_VERSION` is `llm-eval-1`; case fingerprint `1ht349n` (checked by test and by `npm run eval -- --dry --no-dotenv`).
- `git diff --stat -- evals/llm evals/cases.ts lib/engine/run.ts lib/engine/context.ts lib/kb` is empty.
- `npm run eval:profile -- --ci` and `npm run eval:retrieval -- --ci` pass. `grep -c "Pending: run after Phase 3 completes" evals/PROFILE.md` is 1. `--llm` appears in no workflow file. Test file contains no `createModel(` call.
- No real-model call was made in this session; `npm run eval` was only run with `--dry --no-dotenv`.

## Deviations from Plan

**1. Command wrapper placement.** The plan puts the `--llm` flow in run.ts; the wrapper (`runLlmCommand`) is in llm.ts so run.ts keeps the Plan 09 guarantee of no model factory or key reference. Behaviour is as specified.

**2. TDD RED commits not separate** (same reason as earlier plans).

## Known Stubs

None. The pending LLM section in PROFILE.md is an intentional, documented state until the post-Phase-3 run.

## Self-Check: PASSED
