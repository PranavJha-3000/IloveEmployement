---
phase: 02-reranking
plan: 01
subsystem: testing
tags: [retrieval, eval, baseline, regression-gate]
requires: []
provides:
  - validateBaseline, planBaselineUpdate, fail-closed compareToBaseline
  - "--allow-regression flag on eval:retrieval"
  - isolation test able to fail
affects: [02-reranking]
key-files:
  modified:
    - evals/retrieval/baseline.ts
    - evals/retrieval/run.ts
    - tests/retrieval-baseline.test.ts
    - tests/retrieval-strategies.test.ts
key-decisions:
  - "Baseline drops need explicit --allow-regression; fingerprint changes alone are allowed"
requirements-completed: []
duration: 20min
completed: 2026-11-01
---

# Phase 2 Plan 01: Retrieval gate hardening Summary

Retrieval baseline gate now fails closed on malformed or NaN metrics, refuses silent baseline lowering, and the transformers-isolation test inspects compiled source so it can actually fail (closes WR-02, WR-03, WR-05).

## Commits
- 505bdf7: validateBaseline, non-numeric fail-closed compare, planBaselineUpdate plus tests
- 22030bd: runner wiring and isolation test

## CLI proofs (baseline.json restored from copy each time)
1. ndcg@8 set to 0.9, `--update-baseline`: exit 1, "WARNING baseline would drop: overall ndcg@8: 0.3489 < 0.9000", file kept at 0.9
2. `--update-baseline --allow-regression`: exit 0, ndcg@8 rewritten to 0.3489
3. "mrr" deleted from overall, `--ci`: exit 1, "INVALID BASELINE overall mrr: expected a finite number (got undefined)"
4. Original restored, `git diff --quiet` on baseline.json exit 0; `--ci` exit 0, "Baseline gate passed (epsilon 0.005)."

## Isolation test proof
With `import "./embedder";` temporarily prepended to strategies.ts: "strategies module does not load transformers" failed with "strategies.ts must not statically import the embedder, reranker or transformers" (81 pass / 1 fail). Line removed; strategies.ts diff clean.

## Deviations from Plan
- [Rule 3] The first scripted edit of run.ts silently missed the update-baseline branch (escaping); the CLI proof caught it (update wrote unguarded) and it was fixed with a direct edit before the task commit. No other deviations.

## Verification
`npm test`: 82 pass, 0 fail. baseline.json, strategies.ts, RETRIEVAL.md unchanged versus HEAD. No stubs. User uncommitted files untouched.

## Self-Check: PASSED
