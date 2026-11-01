---
phase: 05-document-intelligence
plan: 12
subsystem: vault-ui
tags: [resume-import, profile-review, confirm, doc-01, doc-04]
requires: [05-05, 05-07, 05-08, 05-10]
provides: [ResumeImport, planConfirm, baseVersionFrom]
affects: [components/vault/VaultManager.tsx]
key-files:
  created: [components/vault/ResumeImport.tsx, lib/profile/confirm.ts, tests/profile-confirm.test.ts]
  modified: [components/vault/VaultManager.tsx]
metrics:
  tests: "485 pass / 0 fail"
  typecheck: "0 errors"
---

# Phase 5 Plan 12: Resume import, extraction and confirm Summary

Upload or paste on /vault now runs local deterministic extraction, shows the Profile Review panel, offers an explicit "Refine profile" pass, and Confirm profile saves chunks, structured profile, synced quick profile and a base resume version through a tested pure planner.

## Commits
- 7650394: pure confirm planner (`planConfirm`, `baseVersionFrom`) + 4 tests
- f118dcd: ResumeImport + VaultManager wiring

## What was built
- `lib/profile/confirm.ts`: pure; validates via `StructuredProfileSchema` (throws on invalid), `replaceChunks` only when resume text exists, base version = normalized lines (capped at `MAX_VERSION_TEXT`), `sourceHash = contentHash(text)`, quick profile keeps headline/targetRole.
- `components/vault/ResumeImport.tsx`: "Add your resume" section moved out of VaultManager. Upload/paste, live chunk preview and "Save to vault" (chunk-only, existing replace prompt) preserved. States: idle, refining (spinner, 5-bar skeleton, aria-busy, readOnly textarea, "Stop reading" aborts via AbortController), ready (emerald status, ProfileReview, chunk preview in `details`), failed (exact UI-SPEC copy, "Try again", chunk flow still works), confirmed (summary row + "Review structured profile").
- VaultManager: renders `<ResumeImport/>`; Profile section gains "Review structured profile" (opens ProfileReview with `{ saved }`, saves structured + quick profile only); "Save profile" also applies the quick profile onto the structured contact. Section order unchanged (SemanticIndex, Applications in progress, then manual entries).

## Judgement calls
- Deterministic pass runs automatically on upload and on "Extract profile"; the network refinement is a separate explicit "Refine profile" button in ProfileReview `headerExtra` with the specified help copy, disabled when `useAccess().ready` is false or text > 11,000 chars. Refine failure keeps the quick-read result and shows an amber polite note.
- ProfileReview exposes no "dirty" flag, so Refine and starting a new upload while a review is open always show an inline Keep/Replace confirmation (focus on the Keep choice) rather than only when edits exist.
- The profile under review is tied to a snapshot of the text it was extracted from (`extractedText`), so later textarea edits cannot desync confirm/chunks.
- `onReviewOpenChange` is exposed and VaultManager tracks `reviewOpen` for Plan 13's "Compare versions" button styling.
- Base version text is capped at 40,000 chars (version schema limit) so a 50k-char resume cannot throw at confirm.

## Deviations from Plan
None beyond the above; `npm run build` not run (instructed: dev server on 3124).

## Verification
`npm test`: 485 pass, 0 fail. `npm run typecheck`: clean. Acceptance greps: safeExtractProfile 2, refineProfile 2, AbortController 2, failure copy 1, replace prompt 1, banned words 0.

## Self-Check: PASSED
