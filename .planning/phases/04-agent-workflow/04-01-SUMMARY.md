---
phase: 04-agent-workflow
plan: 01
subsystem: agent
tags: [agent, policy, budget, contracts]
requires: []
provides:
  - lib/agent/config.ts (budgets, tool -> preset map)
  - lib/agent/types.ts (run/step records, wire types)
  - lib/agent/policy.ts (nextAction, validateChoice, countUsage, budgetLimits, stopMessage, latestFitStep, doneTools)
affects: [04-02, 04-03]
key-files:
  created:
    - .planning/phases/04-agent-workflow/04-BASELINE.md
    - lib/agent/config.ts
    - lib/agent/types.ts
    - lib/agent/policy.ts
    - tests/agent-policy.test.ts
decisions:
  - "Budget is checked only when the computed action is a step; gates, complete and skip_verdict are returned regardless"
  - "finish is always rejected by validateChoice while work remains; completion is decided by policy only"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 01: Agent contracts and policy Summary

Client-safe agent config/types plus a pure policy that fixes tool order, gates A/B, the SKIP stop and the step/token budget stops, with exact UI-SPEC copy.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Baselines | b5a5d6b | First Load JS shared 103 kB; `/` 137 kB, `/tools/[slug]` 154 kB, `/vault` 140 kB; 28 cases, fingerprint 1ht349n (matches planner) |
| 2 Config and types | b56e5dc | No zod/ai/next imports; records carry no API key |
| 3 Policy | 71b9020 | 20 tests in tests/agent-policy.test.ts |

## Deviations from Plan

None. The config assertion tests were committed with Task 2 (the tree must compile at every commit), the policy tests with Task 3.

## Verification

- `npm test`: 251 tests, 251 pass, 0 fail
- `npm run typecheck`: exit 0
- Only `npm run eval -- --dry --no-dotenv` was run; evals/results untouched; fingerprint unchanged.

## Known Stubs

None.

## Self-Check: PASSED
