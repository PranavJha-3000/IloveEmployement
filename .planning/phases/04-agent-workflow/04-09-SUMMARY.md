---
phase: 04-agent-workflow
plan: 09
subsystem: evals
tags: [agent, evals, harness, fingerprint]
requires: [04-03, 04-04]
provides:
  - evals/agentCases.ts (AGENT_CASES x4, AgentEvalCase)
  - evals/llm/agentRun.ts (runAgentCase, runAgentEval, estimateAgentRequests, agentCaseFingerprint, mainAgent)
  - evals/llm/run.ts --agent flag, exported selectCases
  - tests/agent-evals.test.ts
affects: [04-10]
key-files:
  created:
    - evals/agentCases.ts
    - evals/llm/agentRun.ts
    - tests/agent-evals.test.ts
  modified:
    - evals/llm/run.ts
decisions:
  - "The eval loop stops as soon as the server returns stop or complete, because custom limits (c.limits) live only on the server; the client policy knows the default budget only"
  - "Agent outcomes are cached per case under the same disk cache and HARNESS_VERSION with agent- case ids, so they cannot collide with Phase 3 keys"
  - "runAgentEval does not probe models and has no judge; expects are deterministic over the run record"
metrics:
  completed: 2026-11-01
---

# Phase 4 Plan 09: Agent eval cases Summary

Four deterministic agent eval cases run the real loop (agentStep plus client reducers, gates pre-approved, SKIP never overridden) behind `npm run eval -- --agent`, leaving the Phase 3 28-case run untouched.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Cases and runner | 4684acf | agent-strong-fit-complete, agent-skip-stops, agent-injection-order-holds, agent-step-budget-stop; offline tests through the scripted model, including a synthetic record that must fail agent-skip-stops and a cache-resume test for runAgentEval |
| 2 --agent flag and pin tests | 89e23b9 | One new EvalArgs field, one parseArgs case, one early branch in main(), `export` on selectCases, a usage comment |

## Phase 3 isolation

- `git diff` shows only evals/llm/run.ts changed among existing files; cases.ts, caseRun.ts, fingerprint.ts, estimate.ts, cache.ts, recordingModel.ts are untouched. `grep -c AGENT_CASES evals/cases.ts` is 0.
- `npm run eval -- --dry --no-dotenv`: "28 case(s). Case fingerprint: 1ht349n", identical to 04-BASELINE.md. A test pins CASES.length 28, the literal 1ht349n, `selectCases(parseArgs([]))` equals CASES, and the default estimate equals the one computed from CASES directly.
- `npm run eval -- --agent --dry --no-dotenv` lists the 4 agent cases and fingerprint e6b03r, no network. Real runs are guarded by --models, --max-requests and the agent estimate (steps x 4 per case); none were run. Agent results would go only to evals/results/agent-*.json (gitignored).
- Verification: `npm test` 304 pass, 0 fail; `npm run typecheck` clean.

## Deviations from Plan

**1. [Rule 1 - Bug in my own first draft] Eval loop did not stop on server stop**
- Found during: Task 1 test run (agent-step-budget-stop).
- Issue: with `limits.stepBudget: 2` the server returns a stop, but the client policy uses default limits, so the loop kept asking until maxLoops.
- Fix: break when a response's `next` is stop or complete; a "loop limit reached" failure is raised only if the loop never settles.
- Commit: 4684acf (before it landed).

No lib/agent bug found. The same client/server limit asymmetry exists in the UI (ApplyWorkflow breaks the loop on a blocked response, so it is handled there).

## Known Stubs

None.

## Self-Check: PASSED
