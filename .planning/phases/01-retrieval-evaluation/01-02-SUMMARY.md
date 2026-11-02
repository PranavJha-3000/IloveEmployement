---
phase: 01-retrieval-evaluation
plan: 02
subsystem: testing
tags: [retrieval, eval, dataset, ground-truth]
requires:
  - 01-01 (dataset types, resolver/validator, synthetic resumes, dump CLI)
provides:
  - QUERIES: 85 graded retrieval queries over 3 synthetic resumes
  - "committed retrieval dataset validates" test guarding the dataset in npm test
affects: [01-05]
tech-stack:
  added: []
  patterns: [ground truth authored from chunk text only, before any strategy run]
key-files:
  created: []
  modified:
    - evals/retrieval/dataset/queries.ts
    - tests/retrieval-dataset.test.ts
key-decisions:
  - "Retrieval ground truth labelled from chunk text only, before any strategy run; 85 queries, 40 paraphrase (47%)"
  - "Role containers graded 2 when they hold a grade-3 bullet; skills list graded 1 when a bullet is the real evidence"
requirements-completed: [REVAL-01]
duration: 25min
completed: 2026-10-31
---

# Phase 1 Plan 02: Labelled Retrieval Queries Summary

85 graded queries over the three synthetic resumes. Each one has at least one grade-3 label and is tagged lexical or paraphrase. Every paraphrase query shares zero BM25 tokens with every chunk labelled for it, and `loadDataset()` enforces that rule with minimums on.

## Counts
| Resume | Queries | Lexical | Paraphrase |
|--------|---------|---------|------------|
| junior-frontend | 27 | 14 | 13 |
| mid-data-analyst | 28 | 15 | 13 |
| senior-ops-manager | 30 | 16 | 14 |
| **Total** | **85** | **45** | **40 (47%)** |

- Grade distribution (241 labels): grade 3 = 89, grade 2 = 86, grade 1 = 66
- Hard cases (queries with a `note`): 41. They cover terms that appear in two roles, acronyms in both directions (CI/CD, CRM, OTIF, WMS, S&OP), number paraphrases ("six-figure yearly", "six percentage points", "more than a week" for nine days), skills list vs evidence bullet, multi-target queries spanning roles, people management spread across two roles, answers in the oldest/lowest-ranked role, and distractors that share vocabulary with an unlabelled chunk.

## Tasks
1. junior-frontend + mid-data-analyst queries: 50c90ea
2. senior-ops-manager queries + committed-dataset test: 151c1ed

## Fairness
I wrote the labels by reading the chunk dump (`node .eval-build/evals/retrieval/dump.js`). No retrieval strategy was run and no ranking was consulted. I made one validation-driven edit: mid-data-analyst-24 used "wrote", and that token also appears in its labelled container, so I changed the word to "compiled". That was a fix to the overlap rule, not to how hard the query is.

## Verification
- `loadDataset()` (minimums on): 85 queries, no DatasetError
- `npm test`: 68 tests, 68 pass, 0 fail, including "committed retrieval dataset validates", which logs the per-resume breakdown above
- Acceptance greps: senior-ops-manager 30, resumeId 85, paraphrase 40, grade 3 89

## Requirements
REVAL-01 was marked complete early by plan 01-01. With this dataset it is now actually satisfied (3 resumes, 85 graded queries, 47% paraphrase with zero proven overlap, validator passes), so I left it as Complete.

## Deviations from Plan
None. The plan only set minimums, so I wrote more queries per resume than the 21 required.

## Known Stubs
None.

## Self-Check: PASSED
- FOUND: evals/retrieval/dataset/queries.ts, tests/retrieval-dataset.test.ts
- FOUND commits: 50c90ea, 151c1ed
