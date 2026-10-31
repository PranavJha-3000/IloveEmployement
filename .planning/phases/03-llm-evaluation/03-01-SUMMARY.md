---
phase: 03-llm-evaluation
plan: 01
subsystem: evals
tags: [evals, golden-cases, determinism, fingerprint]
requires: []
provides:
  - "28 tagged golden eval cases covering all six engines"
  - "prepareCase/stableChunks: deterministic vault chunks (stable ids, createdAt 0)"
  - "caseFingerprint over the case set"
affects: [03-02, 03-08]
tech-stack:
  added: []
  patterns: ["content-derived chunk ids so prompt hashes are stable across runs"]
key-files:
  created: [evals/llm/caseRun.ts, evals/llm/fingerprint.ts, tests/llm-cases.test.ts]
  modified: [evals/cases.ts]
key-decisions:
  - "Chunk ids are `<contentHash(resume)>-NN`; createdAt forced to 0"
  - "Fingerprint includes expect.toString(), so editing a check changes it"
requirements-completed: []
duration: ~25min
completed: 2026-11-01
---

# Phase 3 Plan 01: Case set growth and deterministic preparation Summary

Grew the eval set from 10 to 28 tagged cases across message, match, tailor, interview, offer and fun engines, with deterministic case preparation and a case-set fingerprint. No model calls were made.

## Tasks

1. Case tags, `prepareCase`/`stableChunks`, `caseFingerprint` and tests. Commit ce2f276.
2. 18 new cases (all fictional people/companies) plus structural tests. Commit e8b8859.

## Results

- Tag coverage: injection on 4 lines of cases.ts (type plus 3 cases), fabrication-bait, missing-info, and unstated-offer (5 mentions incl. type) each on at least 2 cases.
- Offline tests (9 in tests/llm-cases.test.ts): determinism, preset resolution, required fields/limits/chip options, fictional contact data, and no expectation passing on empty output.
- `npm run eval -- --dry` prints `28 case(s).`; `npm run typecheck` clean; `npm test`: 138 pass, 0 fail.

## Deviations from Plan

- Existing `expect` logic was left unchanged. The emptiness test passes for all 28 cases (via failed checks or throws).
- The phone-number test skips BACKEND_RESUME (pre-existing Priya resume, not a new case's own text); new cases' own inputs and RESUMES texts are checked.
- Skill-gap case uses Spark, Scala and Kafka as absent terms (Airflow is present in the Dario resume, so it was not used).

## Known Stubs

None.

## Issues

None. User's uncommitted edits were not touched. No app files (lib/presets, lib/vault, lib/engine) were modified.

## Self-Check: PASSED
