---
phase: 04-agent-workflow
plan: 07
subsystem: ui
tags: [agent, apply, workflow, a11y, persistence]
requires: [04-02, 04-04, 04-06]
provides:
  - app/apply/page.tsx (/apply route)
  - components/agent/ApplyWorkflow.tsx (loop driver, persistence, resume, focus, live region)
  - components/agent/JobInput.tsx, BudgetMeter.tsx, RunBanner.tsx
affects: [04-08, 04-09]
key-files:
  created:
    - app/apply/page.tsx
    - components/agent/ApplyWorkflow.tsx
    - components/agent/JobInput.tsx
    - components/agent/BudgetMeter.tsx
    - components/agent/RunBanner.tsx
  modified:
    - components/agent/GateBar.tsx
    - app/globals.css
decisions:
  - "All persistence goes through one commit() helper that sets the ref, state and calls saveAgentRun, so every reducer result is saved"
  - "A user-stopped run reopens as paused (stopReason cleared) so it can be resumed later as the Stop copy promises"
  - "While a step is in flight the first allowed tool shows Running; the response then shows which tool the planner really picked"
  - "Fetch failures are held in component state plus a form-error banner, with Retry in the active card; the saved record only gets status error"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 07: /apply workflow Summary

The /apply page drives the full gated, budgeted, persisted agent loop from the browser: start, fit check, gate A, automatic tailor and cover letter, gate B, optional outreach, with SKIP override, budget stops, edits, stop and resume.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 JobInput, BudgetMeter, RunBanner (+ mobile items) | eb5f5e8 | UI-SPEC copy verbatim; no hard-coded limits in BudgetMeter |
| 2 ApplyWorkflow and /apply page | bf6311c | `advance()` guarded by an in-flight ref; auto-continues only while next is a step, the run is not paused, and the last step did not error |

## UI-SPEC mobile items left out by 04-06 (implemented here)

- Under 1024px the gate A bar shows the primary action and Edit; "Stop here" moves under a native "More" disclosure (GateBar uses matchMedia; other modes have two actions so need no overflow). Budget meter collapses to "Steps 3/6 · Tokens 21k/50k" with aria-expanded.
- The sticky action bar is hidden under 1024px while an input, textarea or select outside the bar has focus (ApplyWorkflow sets `data-input-focus` on `.agent-layout`; CSS hides `.agent-actionbar`). Fields inside the bar (gate B recipient) are exempt so they stay usable.
- GateBar.tsx and globals.css are outside this plan's files_modified but needed for these items.

## Verification

- `npm test`: 291 pass, 0 fail. `npm run typecheck`: clean. `npm run eval -- --dry --no-dotenv`: 28 cases, fingerprint 1ht349n (unchanged).
- `npm run build` exits 0 and lists `/apply`.

Route sizes (First Load JS) vs 04-BASELINE.md:

| Route | Baseline | Now | Delta |
|-------|----------|-----|-------|
| shared by all | 103 kB | 103 kB | +0 (limit +3) |
| / | 4.83 kB / 137 kB | 4.83 kB / 137 kB | 0 |
| /tools/[slug] | 21.6 kB / 154 kB | 6.48 kB / 157 kB | +3 kB first load |
| /vault | 7.02 kB / 140 kB | 5.19 kB / 141 kB | +1 kB first load |
| /apply (new) | n/a | 13.6 kB / 164 kB | own chunk |

The +3 and +1 kB on tool and vault pages were already present after 04-03 (store.ts pulls in lib/agent/record.ts); this plan adds nothing to them. components/agent is imported only from app/apply.

## Deviations from Plan

### Acceptance criteria not met literally

- `grep -c "saveAgentRun(" ApplyWorkflow.tsx` returns 1, not >= 3. All saves go through the single `commit()` helper, which every reducer result, gate action, edit and step response calls. This is intentional (one place cannot forget to save).

### Auto-fixed / additions

**1. [Rule 2 - Missing functionality] Reopening user-stopped runs**
- Issue: stopRun leaves status stopped with no way back, but the Stop copy says you can resume later.
- Fix: `reopen()` in ApplyWorkflow clears a user stopReason and loads the run as paused.

**2. [Scope] GateBar and globals.css touched** for the two UI-SPEC mobile items the caller asked for.

`npm run lint` is not set up (next lint prompts for configuration), so it was not run.

## Known Stubs

None.

## Not verified

No browser run (preview servers were out of scope). Visual and keyboard review at 375px and desktop is left to the 04-10 checkpoint.

## Self-Check: PASSED
