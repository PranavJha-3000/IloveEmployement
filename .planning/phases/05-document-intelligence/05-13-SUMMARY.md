---
phase: 05-document-intelligence
plan: 13
subsystem: vault-ui
tags: [resume-versions, diff, doc-04]
requires: [05-02, 05-05, 05-12, 05-14]
provides: [ResumeVersions, VersionRow, VersionDiff, versionList]
key-files:
  created: [lib/vault/versionList.ts, tests/version-list.test.ts, components/vault/ResumeVersions.tsx, components/vault/VersionRow.tsx, components/vault/VersionDiff.tsx]
  modified: [components/vault/VaultManager.tsx]
metrics:
  tests: "495 pass / 0 fail"
  typecheck: "0 errors"
---

# Phase 5 Plan 13: Resume versions section Summary

/vault now lists resume versions newest first with All/Base/Tailored filters, the targeted job per version, two-version compare (checkboxes or From/To selects, Swap, Compare with base) and a unified line diff with word emphasis, collapsed unchanged runs and previous/next change navigation.

## Commits
- 2fd9679: pure list/selection logic (`filterVersions`, `versionCounts`, `toggleCompare`, `orderPair`, `compareWithBase`, `versionSubtitle`) + 5 tests
- Section commit (components + VaultManager placement): 55d8cee

## What was built
- `ResumeVersions`: hidden until loaded; empty state (.empty) with UI-SPEC copy and a "Review your profile" button only while a review is open; single-version hint; compare fieldset with "{n} of 2 selected", From/To selects (each excludes the other), Swap, "Compare versions" (cta-primary, cta-secondary while `reviewOpen`; aria-disabled with "Select one more version."), Clear selection; focus returns to Compare versions when the diff closes.
- `VersionRow`: label, text-only Base/Tailored badge, subtitle, "View posting" only for http(s) URLs (re-checked, `rel="noopener noreferrer"`), `<time>` en-GB date, "Created by the application workflow" for agent versions, one-at-a-time View text disclosure, 44px Compare checkbox, Compare with base, inline Delete confirmation with focus on "Keep version" (no window.confirm).
- `VersionDiff`: `buildResumeDiff` view model as ul/li (+ / U+2212 gutters with hidden Added:/Removed: prefixes, changed rows as role="group" "Changed line"), role="status" counts, Previous/Next change moving focus, "Show {n} unchanged lines" expanders, identical and missing-text messages, requestAnimationFrame deferral over 2,000 lines. React text nodes only.
- VaultManager: `<ResumeVersions/>` placed directly after `<ApplicationsList/>` and before "Add a story, win or note"; import message now "Imported {n} chunks and {m} resume versions." (plus applications and kept-newer text when present) and " {d} invalid version(s) were skipped." when `versionsDropped > 0`.

## Section order check (`grep -n` on VaultManager.tsx)
`<SemanticIndex` line 230, `<ApplicationsList` 233, `<ResumeVersions` 235, "Add a story, win or note" 239.

## Deviations from Plan
None. "Compare with base" preselects the pair and opens the diff immediately.

## Verification
`npm test`: 495 pass, 0 fail. `npm run typecheck`: clean. `eval:retrieval --ci` and `eval:profile --ci` pass. Phase 3 default fingerprint untouched (no engine/preset/eval-case changes). `npm run build` not run (instructed). Acceptance greps: dangerouslySetInnerHTML 0, window.confirm 0, noopener noreferrer 1. Visual/keyboard check is left to the orchestrator's browser pass.

## Self-Check: PASSED
