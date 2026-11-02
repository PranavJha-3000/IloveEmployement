---
phase: 03-llm-evaluation
plan: 07
subsystem: evals
tags: [evals, github-actions, docs, secrets]
requires: ["03-05"]
provides:
  - "evals.yml: manual workflow running npm run eval with secrets only"
  - ".env.example: documented EVAL_* variables, empty values"
  - "platform.md: Testing and evals section for the new harness"
affects: [03-09]
key-files:
  modified: [.github/workflows/evals.yml, .env.example, platform.md]
key-decisions:
  - "Dispatch inputs reach the shell only through env vars (INPUT_*) and a bash args array"
requirements-completed: []
duration: ~10min
completed: 2026-11-01
---

# Phase 3 Plan 07: Workflow and docs Summary

The manual Evals workflow now runs the new harness with keys only from GitHub secrets, and the docs describe the new command and retire `evals/REPORT.md`.

## Tasks

1. Manual Evals workflow: commit 26fc663. Inputs `models` (required), `judge`, `cases`, `rpm`; `permissions: contents: read`; six secret references; uploads `evals/LLM.md`, `evals/results/LLM.preview.md`, `evals/results/llm-*.json` as `llm-eval` (cache dir not included). `--no-judge` is added when judge is blank.
2. Docs: commit e0fb0dd. `.env.example` gained an empty-valued eval block (only `EVAL_RPM=5` has a value) with the `FREE_TIER_*` fallback note; `platform.md` evals bullet rewritten, CI note added.

## Deviations from Plan

**README.md not updated (scope).** `README.md` line 105 still says `EVAL_PROVIDER=google EVAL_API_KEY=... npm run eval   # run them, writes evals/REPORT.md`. README.md is not in this plan's files_modified, so it was left alone. Follow-up: change that line to point at `evals/LLM.md`. `.planning/PROJECT.md` line 49 also mentions `evals/run.ts`; that is planning state and was not touched.

Otherwise executed as written.

## Verification

- Plan verify command exits 0 (no `inputs.` on a `run:` line); `secrets.` count 6; key-pattern grep 0; `contents: read` 1; `ci.yml` unchanged
- `.env.example`: `EVAL_MODELS=` 1, real-key pattern 0; `platform.md`: `evals/LLM.md` 1, `evals/llm/RUBRIC.md` 1, old "writes `evals/REPORT.md`" 0
- `npm test`: 230 tests, 230 pass, 0 fail

## Known Stubs

None.

## Self-Check: PASSED

Files exist, commits 26fc663 and e0fb0dd exist. The user's uncommitted edits were not staged or touched; `.env` was not read.
