---
phase: 05-document-intelligence
plan: 03
subsystem: profile
tags: [zod, schema, confidence, validation, DOC-01]
requires: [05-01]
provides:
  - lib/profile/schema.ts (StructuredProfileSchema, ConfirmedProfileSchema, ExtractionResult, fieldPaths, validateProfile, emptyProfile, MSG_* copy, LOW_CONFIDENCE_THRESHOLD)
  - lib/profile/confidence.ts (computeConfidence, groundingText, isGrounded, dateGrounded, needsLookCount, CONFIDENCE)
  - lib/profile/sync.ts (toVaultProfile, applyQuickProfile)
affects: [05-04]
key-files:
  created:
    - lib/profile/schema.ts
    - lib/profile/confidence.ts
    - lib/profile/sync.ts
    - tests/profile-schema.test.ts
  modified: []
decisions:
  - "Confidence is a pure function of (profile, sourceText); the schema has no confidence field and zod strips any model-supplied one"
  - "A field that fails validation is capped at 0.3 even when grounded; empty is 0; present but absent from the text is 0.4"
  - "The end date of a current role scores 1 when empty (nothing to verify), so it does not inflate the needs-a-look count"
  - "toVaultProfile and applyQuickProfile never let a blank value wipe an existing one"
metrics:
  tasks: 2
  files: 4
  completed: 2026-11-01
---

# Phase 5 Plan 03: Profile schema, confidence and sync Summary

A single zod StructuredProfile contract (contact, roles, education, skills, projects) with hard length and count caps, UI-SPEC validation copy, grounding-based per-field confidence computed in code, and a non-destructive mapping onto the existing five-field VaultProfile.

## What was built

- `schema.ts`: caps (200/254/40 chars, 40 bullets of 600, 10 links of 300, 30 roles/education/projects, 150 skills); `validateProfile(p, now)` returns path to message with the exact strings from 05-UI-SPEC; the email check is a regex-free bounded parser; `now` is injected so the year bound is deterministic in tests.
- `confidence.ts`: whole-token grounding after normalisation, month detection through 12 literal bounded patterns built once, phone grounded by digit sequence, links compared without protocol or trailing slash, bullets need every line grounded, skills need any `matchedFrom` form grounded. Source text is capped at 60,000 characters.
- `sync.ts`: structured to quick profile and back; only name, location and links move.

## Verification

- 19 tests in `tests/profile-schema.test.ts` pass, including: a "confidence" key is stripped from every level, `computeConfidence.length === 2`, `Object.keys(StructuredProfileSchema.shape)` is `contact, roles, education, skills, projects`, and the confidence keys equal `fieldPaths(p)` exactly.
- `npm test`: 369 pass, 0 fail. `npm run typecheck`: clean.
- Default eval dry run fingerprint 1ht349n unchanged; `eval:retrieval --ci` baseline gate passed.

## Deviations from Plan

**1. TDD RED commits not separate.** Both tasks are `tdd="true"`. The RED step was run locally (tests written first; `tsc` failed with "Cannot find module" before the modules existed) but not committed, because a test file importing absent modules breaks `npm test` compilation and the tree must compile after every commit. Each task is one commit containing tests plus implementation. (Plan 02 used throwing stubs instead, where the surface was small.)

**2. Behaviour choices where the plan was silent.**
- `grep -c confidence lib/profile/schema.ts` is higher than the plan's "only ExtractionResult and LOW_CONFIDENCE_THRESHOLD" because explanatory comments mention the word; there is no confidence field in `StructuredProfileSchema` (verified by key listing in the test).
- Year bounds for education also use 1950 to next year.

## Known Stubs

None.

## Self-Check: PASSED
