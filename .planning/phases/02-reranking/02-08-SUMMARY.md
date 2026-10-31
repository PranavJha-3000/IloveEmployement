---
phase: 02-reranking
plan: 08
subsystem: retrieval
tags: [decision, no-change]
requires: [02-04, 02-07]
provides: [confirmation that app retrieval matches the recorded decision]
key-files:
  created: []
  modified: []
decisions:
  - "Outcome KEEP: no app change, no reranker ships"
metrics:
  completed: 2026-11-01
---

# Phase 2 Plan 08: App wiring for the decision Summary

**Outcome KEEP: app unchanged, no reranker ships; eval strategies and numbers only.**

Lines read from evals/retrieval/DECISION.md and confirmed identical in evals/RETRIEVAL.md (lines 169-170):

- RERANK_ADOPTED: none
- APP_BASE_MODE: hybrid

## Tasks

- Task 1 (read outcome): done. Classified KEEP. No build was run and no 02-08-build-before.txt exists, as the plan prescribes for KEEP.
- Task 2 (mode-aware retrieveVault, allow-listed label): not applicable by decision.
- Task 3 (useSemanticOrder / opt-in reranker): not applicable by decision.

## Verification

- `git diff --quiet HEAD -- lib/vault lib/retrieval lib/engine components/vault/SemanticIndex.tsx` exits 0 (retrieval code untouched).
- The literal `git diff --quiet -- lib/` check exits 1 only because of the user's own uncommitted lib/tools.ts and lib/presets/index.ts edits and untracked lib/toolIcons.ts, which are unrelated to retrieval and were not touched.
- lib/vault/reranker.ts and lib/retrieval/appMode.ts do not exist.
- No reranker import in app code. The only `@huggingface/transformers` import in lib/vault is the existing dynamic import in embeddings.ts (pre-existing).
- User-owned files PresetRunner.tsx and RunDetails.tsx untouched (their diff vs HEAD is the user's own edit, unchanged).
- `npm test`: 122 tests, 122 pass, 0 fail.

## Deviations from Plan

None. The plan executed on its KEEP path as written.

## Self-Check: PASSED
