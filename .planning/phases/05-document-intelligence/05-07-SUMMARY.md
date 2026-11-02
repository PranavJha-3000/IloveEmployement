---
phase: 05-document-intelligence
plan: 07
subsystem: ui
tags: [react, vault, review, skills, accessibility, DOC-01, DOC-02]
requires: [05-03]
provides:
  - lib/profile/reviewState.ts (initReview, reviewReducer, fieldStatus, summaryCounts, needsLookPaths, canConfirm, getFieldValue, splitBullets)
  - components/vault/ProfileReview.tsx (ProfileReview, focusProfileReview, PROFILE_REVIEW_HEADING_ID)
  - components/vault/ReviewField.tsx (ReviewField, fieldDomId)
  - components/vault/SkillEditor.tsx (SkillEditor, mergeSkills)
  - app/globals.css Document intelligence block (review, badge, skill-chip, doc-spinner, skeleton-bar, diff classes)
affects: [05-12, 05-13]
key-files:
  created:
    - lib/profile/reviewState.ts
    - tests/profile-review-state.test.ts
    - components/vault/ProfileReview.tsx
    - components/vault/ReviewField.tsx
    - components/vault/SkillEditor.tsx
  modified:
    - app/globals.css
decisions:
  - "Statuses: invalid > confirmed > edited > (low | empty | high). Empty means no value AND confidence below the threshold, so the empty end date of a current role (confidence 1) is not counted as needing a look"
  - "Confirm profile is enabled when a name is present and no displayed field is invalid; hidden errors (an untouched bad email) are caught on click, which focuses the first invalid field and shows the Fix {n} field(s) alert"
  - "Panel sub-components (Text, Area, DateField, Card, AddButton) are module-level and share state through a context, so inputs keep focus while typing"
  - "Bullets and date inputs hold local text and re-sync only when the stored value stops matching, so trimming and blank-line filtering never fight typing"
metrics:
  tasks: 2
  completed: 2026-11-01
---

# Phase 5 Plan 07: Profile review panel and skill editor Summary

A prop-driven Review your profile panel and skill editor that follow UI-SPEC Surface 2 and its Consistency with Phase 4 section, with every state transition in a pure, tested reducer. Nothing is wired into VaultManager yet (Plan 12).

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Pure review state reducer | fe38d14 | 14 tests: statuses, validation timing, confirm-all-high, re-keying on remove, saved profile, deep-frozen input |
| 2 Components and CSS | 7d423b1 | ProfileReview, ReviewField, SkillEditor, Document intelligence CSS block |

## UI-SPEC points implemented

- h2 `text-[15px] font-bold`, groups as fieldset/legend with h3 15/600, polite status summary, "Next field to check" (moves to the next low or empty field in DOM order, wraps, reports when none are left), `headerExtra` slot, exported `focusProfileReview()`.
- Badges carry text ("Check this", "Edited", "Confirmed"); low confidence also has hidden text and `aria-describedby`; per-field confirm is a 44x44 icon toggle at 520px and above and a full-width text button below it (CSS swaps the two).
- Inline two-button confirmations with initial focus on "Keep ..." for removing a role, school or project and for Discard (exact UI-SPEC copy); no `window.confirm`. After a removal focus moves to the previous card's Remove button or the group's Add button.
- Sticky footer with `env(safe-area-inset-bottom)`; on mobile the primary sits below the secondary actions.
- Skill chips show the canonical name, "from {alias}" (two aliases, then +N), the dashed warning variant with "Not in taxonomy" (a "?" under 520px), an inline expandable details row (Esc closes and returns focus), Rename, Keep as written, Remove with a polite "Removed {name}." status and Undo, a combobox add input over `suggestSkills` with arrow keys, Enter and Esc, and the "{N} skills · {K} not in taxonomy" count.
- Copy rule: no "AI", "LLM" or "model" in the three components (grep 0). No `dangerouslySetInnerHTML`. Links are inputs, never anchors.

## Deviations from Plan

**1. `npm run build` not run.** Caller instruction (dev server on port 3124). Verification was `npm run typecheck`, `npm test`, and a throwaway server-side render of ProfileReview in the scratchpad (compiled with tsc, `@/` aliases resolved by a require hook, fixture: dataset resume `kofi-ranganathan`) which rendered all expected headings and copy. Browser interaction (focus movement, combobox, sticky footer, 375px layout) is NOT exercised; it needs a manual pass once Plan 12 mounts the panel.

**2. Colours.** Per Consistency with Phase 4, the success and warning families use the Tailwind emerald and amber values (emerald 50/200/700, amber 50/200/800) as `--ok-*` and `--warn-*` custom properties in CSS rather than the earlier hex values. Components that need a banner use Tailwind classes elsewhere (Plan 12).

**3. Mobile input size.** New fields use `font-size: 16px` under 520px (UI-SPEC Assumption 15, iOS zoom prevention), which is outside the plan's 13/15 size list; weights stay at 400 and 600 (grep for 500/650/700/800 in the block returns 0).

**4. "Keep as written" is stored as the skill's confirmed flag** (the skill schema has no custom-skill field), so a re-opened saved profile shows a confirmed skill without the warning styling but the count line still reports it as not in taxonomy.

**5. Links removal has no confirmation** (they are single inputs, not cards, and are re-addable); the Remove/Keep confirmation covers roles, schools and projects as specified. Per-card "Confirm all" was not added (the plan lists only the panel-level shortcut). Project "Skills used" is a comma-separated input with read-only chips below it.

**6. TDD RED not committed separately** (same reason as Plans 03 and 06).

## Verification

- `npm test`: 431 tests, 431 pass, 0 fail
- `npm run typecheck`: clean
- Greps: `Document intelligence` x1, `dangerouslySetInnerHTML` and `window.confirm` 0 in all three components, copy-rule grep 0, `Confirm all high-confidence fields` x1, `Not in taxonomy` x1 in SkillEditor, forbidden font weights in the CSS block 0
- No model calls

## Known Stubs

None. The components are intentionally unmounted until Plan 12.

## Self-Check: PASSED
