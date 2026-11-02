---
phase: 04-agent-workflow
plan: 03
subsystem: agent
tags: [agent, api, planner, tool-calling, budget]
requires: [04-01]
provides:
  - lib/engine/run.ts (runPreset opts.access, modelFor, RunOutcome export)
  - lib/agent/schema.ts (agentStepRequestSchema, parseAgentStepRequest)
  - lib/agent/planner.ts (PLANNER_SYSTEM, buildPlannerPrompt, planNextTool)
  - lib/agent/step.ts (agentStep, toolInputs)
  - app/api/agent/step/route.ts (POST)
affects: [04-05]
key-files:
  created:
    - lib/agent/schema.ts
    - lib/agent/planner.ts
    - lib/agent/step.ts
    - app/api/agent/step/route.ts
  modified:
    - lib/engine/run.ts
    - tests/pipeline.test.ts
decisions:
  - "Gates, stops and completion return `blocked` before resolveAccess and any model call, so they never consume a free run"
  - "Each executed or rejected step calls resolveAccess exactly once and passes it to runPreset via opts.access"
  - "Budget = max(recomputed from step records, client claim); after a step, claim + 1 step and claim + step tokens"
  - "Planner fallbacks: UnsupportedFunctionality or no tool call -> policy order (plannedBy policy-fallback); NoSuchToolError -> raw name returned so the policy rejects and counts it; other errors rethrown and classified"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 03: Stateless agent step server Summary

POST /api/agent/step validates the run state with zod, asks the planner for one tool via AI SDK tool calling (enum-only args, toolChoice required), checks it with the shared policy, and runs it through the unchanged runPreset.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 run.ts seam | da1e2e8 | Diff limited to import, RunOutcome export, runPreset signature + access line, modelFor. 2 new pipeline tests |
| 2 schema + planner | d3b39c6 | 22 `.max(` caps in schema; no z.string in planner; JD fenced as untrusted_document, 3000 chars |
| 3 step + route | a66760d | one resolveAccess (after the blocked branch), one runPreset with `{ access }`, no logging |

## Deviations from Plan

None.

## Verification

- `npm test`: 264 tests, 264 pass, 0 fail (existing pipeline tests unchanged)
- `npm run typecheck`: exit 0
- `npm run eval -- --dry --no-dotenv`: 28 case(s), fingerprint 1ht349n (unchanged)
- `npm run build`: compiles, `/api/agent/step` present. First Load JS: shared 103 kB, `/` 137 kB, `/tools/[slug]` 156 kB (baseline 154), `/vault` 141 kB (baseline 140); the small growth comes from store.ts now importing lib/agent/record.ts (04-02).
- No real model calls. Behavioral tests of agentStep land in 04-05.

## Known Stubs

None.

## Self-Check: PASSED
