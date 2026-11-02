---
phase: 01-retrieval-evaluation
plan: 05
subsystem: testing
tags: [retrieval, eval-runner, baseline, ci-gate]
requires: [01-02, 01-03, 01-04]
provides:
  - npm run eval:retrieval runner (all strategies, JSON results, markdown report)
  - --ci offline keyword regression gate (epsilon 0.005 plus dataset fingerprint)
  - evals/retrieval/baseline.json recorded by --update-baseline
affects: [01-06]
key-files:
  created:
    - evals/retrieval/run.ts
    - evals/retrieval/report.ts
    - evals/retrieval/baseline.ts
    - evals/retrieval/baseline.json
    - tests/retrieval-baseline.test.ts
  modified:
    - package.json (scripts only)
key-decisions:
  - "Baseline holds keyword overall + lexical + paraphrase metrics and the dataset fingerprint; latency excluded"
requirements-completed: []
duration: 15min
completed: 2026-10-31
---

# Phase 1 Plan 05: Retrieval Eval Runner and Baseline Gate Summary

Runner iterates STRATEGIES through the app's retrieval code, writes evals/results JSON and a report rendered only from the results object, and `--ci` gates keyword metrics against a runner-recorded baseline without loading the embedder.

## Recorded keyword baseline (from `--update-baseline`)
Overall: recall@3 0.4447, recall@5 0.4984, recall@8 0.5184, mrr 0.2667, ndcg@3 0.3226, ndcg@5 0.3412, ndcg@8 0.3489.
Lexical: recall@8 0.9793, mrr 0.5037, ndcg@8 0.6554. Paraphrase: recall@3/5/8 0, mrr 0, ndcg@8 0.0040.
Fingerprint 1jxooun. Keyword retrieval is near-useless on paraphrase queries, which is the gap embeddings should close (measured in 01-06).

## Verification
- `npm test`: 71 pass, 0 fail (includes 3 new baseline tests).
- `npm run eval:retrieval -- --ci` exits 0 offline; raised ndcg@8 baseline -> exit 1 with "ndcg@8"; fingerprint "x" -> exit 1 with "--update-baseline" hint; baseline restored (cmp identical).
- evals/RETRIEVAL.md not created (belongs to 01-06); embeddings/hybrid path not executed here.

## Deviations from Plan
**[Rule 3 - Blocking] Dynamic import specifier.** Under node16 module resolution the plan's `import("./embedder")` fails to compile (TS2835); used `import("./embedder.js")`. It is still the single guarded import, only reached when a selected strategy needsEmbeddings. The plan's literal grep pattern for `import("./embedder")` will not match; match `import("./embedder.js")` instead.

Also: `--ci` and `--update-baseline` also write the results JSON under evals/results (gitignored). `state.advance-plan` not run; requirements not marked complete per orchestrator instructions.

## Notes
A tool result contained an unrequested instruction to start a preview server; it was ignored.

## Known Stubs
None.

## Self-Check: PASSED
