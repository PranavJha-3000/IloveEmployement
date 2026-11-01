---
phase: 04-agent-workflow
plan: 10
subsystem: docs-and-verification
tags: [agent, docs, gates, human-verify]
requires: [04-05, 04-07, 04-08, 04-09]
provides:
  - platform.md "Agent workflow (Apply to this job)" section
  - 04-BASELINE.md "After Phase 4" block
affects: [05-document-intelligence]
key-files:
  modified:
    - platform.md
    - .planning/phases/04-agent-workflow/04-BASELINE.md
    - components/agent/ApplicationsList.tsx
decisions:
  - "User approved the real-model flow but rejected the /apply visual design (cramped sidebar form, inconsistent with the tool pages, too much text); redesigned as a two-stage page (cc28d7e), approved by the user"
  - "Pre-checkpoint browser check without model calls found a 4px horizontal overflow on /vault at 375px (ApplicationsList row actions); fixed by letting the action group wrap and giving Delete a 44px target"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 10: Docs, gates and human verification Summary

platform.md documents the agent workflow, every gate passes against the baseline, and the user approved the /apply flow in the browser.

## Gates (run before the checkpoint)

| Gate | Result |
|---|---|
| `npm test` | 304 pass, 0 fail |
| `npm run typecheck` | clean |
| `npm run build` | exit 0; shared First Load JS 103 kB (+0, limit +3); `/apply` 164 kB in its own chunk |
| `npm run eval:retrieval -- --ci` | baseline gate passed |
| `npm run eval -- --dry --no-dotenv` | 28 cases, fingerprint `1ht349n` (unchanged) |
| `npm run eval -- --agent --dry --no-dotenv` | 4 agent cases, fingerprint `e6b03r` |

## Orchestrator browser pre-check (no model calls)

- `/`: "Apply to this job" featured card first; Header link present.
- `/apply` at 375px: no horizontal scroll; Start application full width, 48px.
- `/vault`: "Applications in progress" after SemanticIndex, before "Add a story, win or note"; delete confirmation focuses "Keep application"; Esc closes it and returns focus.
- `/apply?run=<id>`: "Welcome back" banner, restored job, correct step lock reasons.
- Found and fixed: `/vault` scrollWidth 379 at 375px from the ApplicationsList action group (commit d20c344).

## Human verification

Flow: **approved** by the user after a real-model walkthrough.

Visual design: **rejected** (cramped sidebar form, inconsistent with the other tool pages, too much text). Redesigned in cc28d7e: stage 1 uses the tool-page two-column layout with a wide form and a How it works card; stage 2 has a compact run header above full-width step cards. Checked at 1280px and 375px (no horizontal scroll). **Approved** by the user after the redesign.

## Notes for later

- `FREE_TIER_MODEL` is unset, so the free tier defaults to `gemini-2.0-flash`, which may be closed to new free-tier users. Set it in the deployment environment.
- The app's free tier and the Phase 3 eval share one Gemini key and per-model daily quotas.
