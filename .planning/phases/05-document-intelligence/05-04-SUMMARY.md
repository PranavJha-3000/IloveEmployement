---
phase: 05-document-intelligence
plan: 04
subsystem: engine-scoring
tags: [skills, scoring, ats, fit, DOC-02]
requires: [05-01]
provides:
  - canonical-aware keywordCoverage (new `canonical` field)
  - canonicalSkillEvidence, applySkillEvidence, skillInText in lib/engine/scoring.ts
  - fit, gap and resume finalizers matching on taxonomy aliases
  - report UI note for code-corrected requirements
affects: []
key-files:
  created:
    - tests/skills-scoring.test.ts
  modified:
    - lib/engine/scoring.ts
    - lib/engine/reports.ts
    - components/engine/ReportView.tsx
decisions:
  - "Aliases of a taxonomy skill that are ordinary words (Go, Rust, Swift) count only with exact capitalisation, so 'we go to market' never satisfies Golang"
  - "The model's own term and synonyms keep the legacy strict whole-term rule; only taxonomy aliases tolerate a sentence-final period"
  - "applySkillEvidence only moves MISSING to PARTIAL, never to STRONG, and only when every taxonomy skill the requirement names is in the user's text"
metrics:
  tasks: 2
  files: 4
  completed: 2026-11-01
---

# Phase 5 Plan 04: Canonical skills in fit and ATS scoring Summary

Fit, gap, ATS and tailored-resume finalizers now match on canonical skills: "JS" in a resume satisfies "JavaScript" in a posting (and the reverse), a model-marked MISSING is corrected to PARTIAL by code when the resume provably has the skill, and the correction is shown in the report.

## What changed

- `lib/engine/scoring.ts`: `keywordCoverage` builds candidates as the term, then its taxonomy forms, then each synonym and its forms (deduplicated case-insensitively, order preserved); `matchedAs` is the first candidate found, and a new `canonical` field reports the taxonomy name. `normalize`, `containsTerm`, `scoreRequirements` and `formatChecks` are untouched.
- `lib/engine/reports.ts`: `FINALIZERS.fit` and `FINALIZERS.gap` call `applySkillEvidence` after scrubbing chunk ids and before `scoreRequirements`; `FINALIZERS.resume` keeps a skill when any taxonomy form of it is in the source (`k8s` supports `Kubernetes`). `REPORT_SCHEMAS` and prompts are unchanged.
- `components/engine/ReportView.tsx`: a requirement line "Found in your resume as {...}; marked partial because the fit check didn't cite it." and ATS chips titled `Matched as "JS" (JavaScript)` when the wording differs.
- `tests/skills-scoring.test.ts`: 13 tests, including a scripted-model `runPreset("ats-check")` pipeline test (found via "JS", `canonical` "JavaScript").

## Verification

- `npm test`: 381 pass, 0 fail. `npm run typecheck`: clean.
- `tests/engine.test.ts` and `tests/pipeline.test.ts` assertions are unchanged and pass (fit still 67, pipeline 50 / STRETCH, Go does not match Google).
- `npm run eval:retrieval -- --ci`: baseline gate passed, no regression or improvement lines. `git diff --stat -- lib/vault lib/kb lib/retrieval` is empty.
- Default eval dry run: 28 cases, fingerprint 1ht349n unchanged. Agent dry run: 4 cases, e6b03r unchanged.
- No existing assertion in `tests/engine.test.ts` needed updating, so that file is untouched.

## Deviations from Plan

**1. [Rule 1 - Bug] Sentence-final period.** `containsTerm` keeps "." attached to a token, so a resume line ending "...on k8s." did not match the alias. Aliases (not the model's original term) are now also checked against a haystack with dots stripped; the legacy strict rule for the term itself is unchanged.

**2. [Rule 2 - Missing critical] Case-sensitivity of ordinary-word aliases.** Expanding "Golang" to the taxonomy name "Go" through case-insensitive `containsTerm` would have matched the common word "go". Forms listed as `caseSensitive` in the taxonomy now require exact capitalisation (word-boundary regex built from an escaped literal).

**3. Acceptance count.** `grep -c "applySkillEvidence" lib/engine/reports.ts` returns 3, not 2: the two call sites plus the import line.

**4. TDD RED not committed separately.** Tests were written first and confirmed failing locally (type errors for the missing exports and for `skillMatch` before wiring); a failing-compile commit would break the tree, so each task is a single commit.

**5. Added export `skillInText`** in scoring.ts (not in the plan's list) for the resume finalizer.

## Threat notes

- T-05-09 mitigated as specified (MISSING to PARTIAL only, all named skills must be found, labelled in the UI).
- T-05-10 accepted: the finalizer change can alter pass/fail of not-yet-cached Phase 3 cases; prompts and cache keys are unchanged.

## Known Stubs

None.

## Self-Check: PASSED
