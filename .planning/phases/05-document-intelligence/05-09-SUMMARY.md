---
phase: 05-document-intelligence
plan: 09
subsystem: evals
tags: [eval, profile, baseline, ci, DOC-03]
requires: [05-06, 05-08]
provides:
  - evals/profile/baseline.ts (compareProfileBaseline, validateProfileBaseline, PROFILE_EPSILON, ProfileBaseline)
  - evals/profile/report.ts (renderProfileReport, ProfileRunResult, LlmProfileSection placeholder)
  - evals/profile/run.ts (npm run eval:profile; --ci, --update-baseline, --dataset-changed, --report; --llm reserved, exits 2)
  - evals/profile/baseline.json, evals/PROFILE.md (generated)
affects: [05-11]
key-files:
  created: [evals/profile/baseline.ts, evals/profile/report.ts, evals/profile/run.ts, evals/profile/baseline.json, evals/PROFILE.md, tests/profile-baseline.test.ts]
  modified: [package.json, .github/workflows/ci.yml]
decisions:
  - "First measurement committed exactly as produced; lib/profile/extract.ts and patterns.ts untouched (EXTRACTOR_VERSION stays det-1)"
  - "Fingerprint, extractor version and taxonomy version mismatches all fail the gate with the update instruction"
metrics:
  tasks: 2
  completed: 2026-11-01
---

# Phase 5 Plan 09: Profile extraction accuracy eval Summary

An offline `npm run eval:profile` scores the deterministic extractor against 13 labelled resumes (10 rendered, 3 synthetic), publishes `evals/PROFILE.md`, and gates regressions in CI against a committed baseline.

## First measurement (as measured, untuned), dataset fingerprint 1soomxp, extractor det-1, taxonomy skills-1

| Field | Precision | Recall | Support |
| --- | ---: | ---: | ---: |
| roles.company | 0.964 | 0.844 | 32 |
| roles.start | 1.000 | 0.875 | 32 |
| skills.canonical | 1.000 | 0.853 | 102 |
| contact.email | 1.000 | 1.000 | 13 |

Other notable fields: contact.name P 0.909 / R 0.769; contact.location 0.769/0.769; roles.title 0.964/0.844; education.degree 1.000/0.722; education.institution 0.667/0.889; projects.name 0.455/0.833 (weakest). Exact match: contact 10/13 (0.769), roles 27/32 (0.844). Rendered macro-F1 0.839 versus synthetic 0.994, so the rendered formats (unusual layouts) are the harder set; the three weakest resumes are kofi-ranganathan, sunita-eberhardt and ngozi-halvorsen (role header layouts).

## Verification

- `npm run eval:profile -- --ci` exits 0 on the committed baseline.
- Negative check: raising roles.company recall in baseline.json by 0.1 made `--ci` print `REGRESSION roles.company recall: 0.8438 < 0.9438` and exit 1; value then restored and the gate passed again.
- `npm run eval:retrieval -- --ci` green (keyword unchanged).
- `npm test`: 462 pass, 0 fail. `npm run typecheck`: clean.
- Grep gates: no key or model-factory references in run.ts; one "Pending: run after Phase 3 completes" in PROFILE.md; one CI step; package.json diff is one added line.

## Deviations from Plan

None. The two tasks were committed as 573e66a (baseline, report, tests) and 169daf3 (runner, baseline.json, PROFILE.md, script, CI step). `LlmProfileSection` is a minimal placeholder shape that Plan 11 replaces.

## Known Stubs

None. The LLM section of PROFILE.md is an intentional, documented "Pending" notice resolved by Plan 11.

## Self-Check: PASSED
