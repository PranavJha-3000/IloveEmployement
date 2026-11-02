---
phase: 05-document-intelligence
plan: 02
subsystem: diff
tags: [diff, myers, versions, DOC-04, tdd]
requires: []
provides:
  - lib/diff.ts (diffSequences, diffWords, normalizeResumeLines, buildResumeDiff, DiffOp, WordSegment, DiffRow, ResumeDiff)
affects: [05-04]
key-files:
  created:
    - lib/diff.ts
    - tests/diff.test.ts
  modified: []
decisions:
  - "Collapse rule is uniform: any unchanged run longer than collapseOver (6) keeps `context` (3) lines beside each adjacent change and collapses the rest; leading and trailing runs keep only the side next to a change"
  - "Shared whitespace between two changed words stays unchanged in diffWords (it is an equal token), so segments alternate rather than merging across it"
metrics:
  tasks: 2
  files: 2
  completed: 2026-11-01
---

# Phase 5 Plan 02: Resume diff library Summary

Dependency-free Myers O((N+M)D) line diff with word-level emphasis and the UI-SPEC view model (added, removed, changed pairs, collapsed unchanged runs, change groups), built test-first.

## TDD gate

- RED: `9a42a33` (primitives), `f0adc3b` (buildResumeDiff). GREEN: `f6db628` (primitives) and the final feat commit for buildResumeDiff. Gate sequence is intact for both tasks.

## Verification

- 18 diff tests pass including the 2,000-line performance guard (well under 500 ms).
- `npm test`: 350 pass, 0 fail. `npm run typecheck`: clean.
- `lib/diff.ts` has no imports; `package.json` unchanged. Default eval dry run fingerprint 1ht349n unchanged; `eval:retrieval --ci` gate passed.

## Deviations from Plan

**1. [Rule 3 - Blocking] RED commits include a throwing stub.** The plan's RED step expects tests to fail because `lib/diff.ts` has no exports. A test file importing missing exports would break `tsc` (and so `npm test`) for every commit in between, and the repository must compile after each commit. The RED commits therefore add `lib/diff.ts` with signatures that throw "not implemented"; the tests still fail at run time (7 failing, then 11 failing).

**2. Test expectation corrected.** My first draft of a `diffWords` test expected "two three" to merge into one changed segment; the separating space is an equal token, so the correct result is `two`, ` `, `three`. The test was fixed before the RED commit.

## Known Stubs

None.

## Self-Check: PASSED
