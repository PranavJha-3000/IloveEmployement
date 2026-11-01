---
phase: 04-agent-workflow
plan: 06
subsystem: ui
tags: [agent, components, css, a11y]
requires: [04-01, 04-02]
provides:
  - components/agent/StepCard.tsx (StepCard, StepCardProps, StepCardState)
  - components/agent/StepTimeline.tsx (StepTimeline)
  - components/agent/GateBar.tsx (GateBar, GateMode, OutreachOptions)
  - components/agent/ArtifactEditor.tsx (ArtifactEditor)
  - app/globals.css .agent-* block
affects: [04-07]
key-files:
  created:
    - components/agent/StepCard.tsx
    - components/agent/StepTimeline.tsx
    - components/agent/GateBar.tsx
    - components/agent/ArtifactEditor.tsx
  modified:
    - app/globals.css
decisions:
  - "StepCard renders the <li> itself (aria-current/aria-disabled on it); the timeline connector is drawn by the <ol> and li pseudo-elements, the card keeps its own border"
  - "The step header has a separate Expand/Collapse button (aria-expanded) next to the h3, because a heading cannot sit inside a button"
  - "GateBar disables all actions on press (local pressed state plus busy prop) so double-clicks cannot double-run"
  - "Stop here at gate A and Stop run in error mode act directly; only running-mode Stop and SKIP override use inline confirmations"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 06: Agent step components Summary

Presentational components for the Apply workflow per 04-UI-SPEC: ordered timeline of four step cards, gate and confirmation actions, and a plain-text draft editor. They take props only; ApplyWorkflow (04-07) owns state.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 StepCard, StepTimeline, CSS | 6007a42 | All ten states with icon plus text; fit/resume via ReportView, cover/outreach via MessageResultView (edited body substituted, edit grounding shown in the amber "Check before using" block); Tool call disclosure; one persistent aria-live region |
| 2 GateBar, ArtifactEditor | eaad8c7 | UI-SPEC copy verbatim; "Keep ..." buttons take initial focus in confirmations; Esc closes and returns focus to the opener |

## Verification

- `npm test`: 276 pass. `npm run typecheck`: clean. `npm run eval -- --dry`: 28 cases, fingerprint 1ht349n (unchanged).
- Greps: no window.confirm, no dangerouslySetInnerHTML, no VerdictBadge/RunWarnings/RunDetails re-implementation; new CSS uses only weights 400/600.
- `npm run build` exits 0. Route sizes (components are not imported by any route yet, so no size change): `/` 4.83 kB (137 kB first load), `/tools/[slug]` 18.8 kB (156 kB), `/vault` 4.07 kB (141 kB), `/api/agent/step` 132 B, shared 103 kB.
- Visual review at 375px and desktop is deferred to the 04-10 human checkpoint (no preview run here).

## Deviations from Plan

None to the task contract. Two UI-SPEC mobile niceties were not implemented because the plan does not list them: moving non-primary actions into a "More" disclosure on mobile, and hiding the sticky bar while an input has focus. On mobile all actions stack full width at 48px in the sticky bar instead. 04-07 can add either if the checkpoint wants them.

## Known Stubs

None.

## Self-Check: PASSED
