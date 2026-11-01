---
phase: 05-document-intelligence
verified: 2026-11-02T00:00:00Z
status: passed
score: 4/4 roadmap success criteria verified
overrides_applied: 0
---

# Phase 5: Document Intelligence Verification Report

**Phase Goal:** Uploading a resume yields a confirmed, structured profile with normalized skills and tracked resume versions, with extraction accuracy measured
**Status:** passed (human checkpoint approved by the user per 05-15-SUMMARY.md)
**Re-verification:** No, initial verification

## Commands run

| Command | Result |
| --- | --- |
| `npm test` | 495 pass, 0 fail |
| `npm run typecheck` | clean |
| `npm run eval:profile -- --ci` | "Profile baseline gate passed (deterministic extractor)" |
| `npm run eval:retrieval -- --ci` | Baseline gate passed (no regression) |
| `npm run eval -- --dry --no-dotenv` | 28 cases, fingerprint 1ht349n (unchanged) |
| `npm run build` | Not run, by instruction |

No real-model calls were made.

## Success criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | After upload the user sees a typed, validated profile and can confirm or correct each field | VERIFIED | `lib/profile/schema.ts`, `extract.ts`, `confirm.ts` and `reviewState.ts` exist, with tests (profile-schema, profile-extract, profile-confirm, profile-review-state). `components/vault/ProfileReview.tsx` is rendered from both `ResumeImport.tsx` (focused when import is ready) and `VaultManager.tsx`. `SkillEditor.tsx` covers skill correction. |
| 2 | Skill aliases resolve to canonical entries, and fit and ATS scoring match on the canonical skill | VERIFIED | `lib/skills/taxonomy.ts` and `normalize.ts` exist. `lib/engine/scoring.ts` imports from `lib/skills`. The profile extractor and the refinement pass use the same module. Tests `skills.test.ts` and `skills-scoring.test.ts` pass. |
| 3 | A script reports field-level precision/recall against labelled resumes, with results committed | VERIFIED | `npm run eval:profile` prints a per-field P/R/F1 table over 13 labelled resumes (10 rendered, 3 synthetic), 15 fields, macro-F1 0.880. `evals/PROFILE.md` and `evals/profile/baseline.ts` are committed. CI (`.github/workflows/ci.yml`) runs `eval:profile -- --ci` offline. |
| 4 | The vault lists resume versions (base and tailored) with the targeted job, and the user can view a diff | VERIFIED | `lib/vault/versions.ts`, `versionList.ts` and `tailoredVersion.ts` exist. `ResumeVersions.tsx`, `VersionRow.tsx` and `VersionDiff.tsx` are mounted in `VaultManager.tsx`. Tailored versions are recorded from `PresetRunner.tsx` and `ApplyWorkflow.tsx`. Tests (vault-versions, version-list, tailored-version, diff) pass, including export/import of versions. |

## Requirements coverage

| Requirement | Plans | Status | Evidence |
| --- | --- | --- | --- |
| DOC-01 | 05-03, 05-05, 05-07, 05-08, 05-10, 05-12, 05-15 | SATISFIED | SC1 |
| DOC-02 | 05-01, 05-04, 05-07, 05-08, 05-15 | SATISFIED | SC2 |
| DOC-03 | 05-06, 05-09, 05-11, 05-15 | SATISFIED (see below) | SC3 |
| DOC-04 | 05-02, 05-05, 05-12, 05-13, 05-14, 05-15 | SATISFIED | SC4 |

All four IDs are claimed by plans, and no orphaned Phase 5 requirements were found. REQUIREMENTS.md and the ROADMAP progress table still show Phase 5 as Pending or Not started. That is a bookkeeping update for the orchestrator.

### DOC-03 judgement

DOC-03 reads "Profile extraction accuracy is measured against labelled resumes (field-level precision/recall)". Roadmap SC3 reads "A script reports field-level precision/recall of profile extraction against labelled resumes, with results committed". Both are met. The shipped extractor is the deterministic one. It is measured field by field against 13 labelled resumes. The results are committed in `evals/PROFILE.md`, and a CI gate fails on regression against `baseline.json`.

The LLM-refinement measurement (`npm run eval:profile -- --llm`) is built in `evals/profile/llm.ts` with `tests/profile-llm.test.ts`. It is explicitly marked "Pending" in `evals/PROFILE.md` until the Phase 3 quota frees up. Neither the requirement nor the success criterion requires the LLM variant, so this does not block the phase. It is a follow-up, listed below.

## Anti-patterns

No TBD, FIXME or XXX markers were found in `lib/profile`, `lib/skills`, `lib/vault`, `components/vault` or `evals/profile`. No stubs were found in the wired artifacts.

## Non-blocking observations

- **LLM-refined accuracy is not yet measured.** Run `npm run eval:profile -- --llm` after Phase 3 and commit the result.
- **Weak spots in the deterministic extractor.** `projects.name` has precision 0.455 and F1 0.588. `education.institution` has precision 0.667. Rendered resumes score worse than synthetic ones (macro-F1 0.839 versus 0.994). The CI gate protects against regression only.
- **Stray untracked-looking path.** The repo root contains a directory named `UserspranaOneDriveDesktopCodeIloveEmployementappglobals.css`, which looks like a path-mangling accident. It is unrelated to the phase goal, but worth removing.
- **Bookkeeping.** ROADMAP and REQUIREMENTS still mark Phase 5 and DOC-01 to DOC-04 as pending.

## Human verification

None outstanding. The visual and flow checkpoint was approved by the user (05-15-SUMMARY.md).

## Gaps Summary

No gaps. The phase goal is achieved: upload leads to a reviewable and confirmable typed profile with canonical skills, resume versions with a diff are tracked, and extraction accuracy is measured and gated.

_Verified: 2026-11-02_
_Verifier: Claude (gsd-verifier)_
