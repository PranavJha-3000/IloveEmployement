---
phase: 04-agent-workflow
plan: 04
subsystem: agent
tags: [agent, client, reducers, testing]
requires: [04-01, 04-02, 04-03]
provides:
  - lib/agent/client.ts (retrieveForTools, buildStepRequest, applyStepResponse, approveGateA, rerunFitCheck, overrideSkip, approveGateB, declineOutreach, stopRun, continueWithNewBudget, saveArtifactEdit, revertArtifactEdit, localNextAction, summarizeStep)
  - tests/agentScript.ts (scriptAgentModel, AGENT_VAULT, FIT_APPLY, FIT_SKIP, TAILORED, COVER, OUTREACH, REVIEW_SHIP)
affects: [04-05, 04-07, 04-09]
key-files:
  created:
    - lib/agent/client.ts
    - tests/agentScript.ts
    - tests/agent-client.test.ts
decisions:
  - "Reducers re-derive run status and stopReason from localNextAction (policy) after gate, override and budget changes, so UI and server cannot disagree"
  - "A done-with-error step response sets run status to error (next is still a step), so the UI can offer Retry"
  - "localNextAction uses max(recomputed usage, record.budget) so invalidated steps keep counting after a fit re-run"
  - "saveArtifactEdit grounds against the step's sent chunks plus its inputs; warns, never blocks"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 04: Client loop reducers Summary

Pure, client-safe reducers for the agent loop plus a shared scripted model helper, so the UI, resume test and eval runner share one implementation.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Scripted model helper | c2ef03e | planner calls return the next plan tool; reviewer prompts (draft_to_review) return REVIEW_SHIP; preset calls pick a fixture by the `Task — {preset.name}` block |
| 2 Client reducers | 5bd3408 | 13 new tests in tests/agent-client.test.ts covering every behavior bullet |

## Verification

- `npm test`: 276 pass, 0 fail. `npm run typecheck`: clean.
- Smoke (offline): the four agent presets all run through `runPreset` using `scriptAgentModel` fixtures (cover letter and tailor use two generation calls, outreach likewise, as reviewers return ship). The planner tool-call path of the helper is not yet exercised by a test; 04-05 will cover it through `agentStep`.
- lib/agent/client.ts imports neither zod nor ai.

## Deviations from Plan

None - plan executed as written. Tests were written alongside the implementation in one commit rather than a separate RED commit.

## Known Stubs

None.

## Self-Check: PASSED
