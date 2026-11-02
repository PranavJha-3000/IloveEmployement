---
phase: 04-agent-workflow
plan: 05
subsystem: agent
tags: [agent, testing, scripted-model, budget, gates, grounding]
requires: [04-03, 04-04]
provides:
  - tests/agent-step.test.ts (15 offline behavioral tests for agentStep + client reducers)
affects: [04-09]
key-files:
  created:
    - tests/agent-step.test.ts
decisions:
  - "Cases 1-9 and 10-15 were written in one file and committed together; they all passed against 04-03/04-04 with no change to lib/agent"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 05: Agent loop behavioral suite Summary

Fifteen offline tests drive `agentStep` through the client reducers with the scripted model, proving tool selection, rejection, both budgets, both gates, SKIP, resume, grounding and free-tier counting.

## Tasks

| Task | Notes |
|------|-------|
| 1 Cases 1-9 (selection, rejection, injection, early finish, step/token budget, forged claims, gate A, gate B) | one `drive`/`go` helper pair shared by all cases |
| 2 Cases 10-15 (SKIP end/override, full run, resume incl. interrupted step, grounding, free tier) | free-tier env restored in `finally` |

Both tasks landed in a single commit because they edit one new file.

## Notes

- The scripted planner tool-call branch in tests/agentScript.ts is exercised through `agentStep` in every case (`plannerCalls()` is asserted in cases 1, 3, 5, 6, 7, 8, 9, 10 and 15).
- Case 7 sends a hand-built request (forged `claimedTokensUsed: 0`) directly to `agentStep`; case 8 strips `approvals` the same way.
- Case 13 runs twice (clean resume, and a `running` step normalized to `interrupted`) and asserts the fit prompt was generated exactly once per run.
- All models are `MockLanguageModelV1`; keys are fake (`sk-test-not-real-...`); no network.

## Verification

- `npm test`: 291 pass, 0 fail (was 276). `npm run typecheck`: clean.

## Deviations from Plan

None. No genuine bug was found in lib/agent/*, so no fix commits were needed.

## Known Stubs

None.

## Self-Check: PASSED
