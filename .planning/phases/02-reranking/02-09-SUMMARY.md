---
phase: 02-reranking
plan: 09
subsystem: vault-ui
tags: [decision, no-change]
requires: [02-08]
provides: [confirmation that the app UI is unchanged for outcome KEEP]
key-files:
  created: []
  modified: []
decisions:
  - "Outcome KEEP: no reranker ships, not even as opt-in; panel copy stays as is"
metrics:
  completed: 2026-11-01
---

# Phase 2 Plan 09: Opt-in UI, bundle check, label checkpoint Summary

**Outcome KEEP (RERANK_ADOPTED: none, APP_BASE_MODE: hybrid) per 02-08-SUMMARY: no reranker ships.**

## Tasks

- Task 1 (SemanticIndex.tsx copy and opt-in): not applicable. `git diff --quiet HEAD -- components/vault/SemanticIndex.tsx` exits 0. The existing copy ("fuses keyword and semantic rankings") already describes hybrid, the retained mode.
- Task 2 (first-load bundle check): skipped. No app code changed, so there is nothing to compare; no 02-08-build-before.txt or 02-09-build-after.txt exist.
- Task 3 (blocking human-action checkpoint for PresetRunner.tsx / RunDetails.tsx): **not triggered**. The plan marks it not applicable on KEEP. Nothing changed, so the existing "hybrid" / "keyword" / "whole" labels remain accurate, and the user's files were not touched.

## Verification

- No file in the plan's files_modified changed.
- `npm test`: 122 tests, 122 pass, 0 fail.

## Deviations from Plan

None.

## Self-Check: PASSED
