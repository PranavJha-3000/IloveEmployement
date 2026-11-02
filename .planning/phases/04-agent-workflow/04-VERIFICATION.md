---
phase: 04-agent-workflow
verified: 2026-11-01T00:00:00Z
status: passed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
gaps: []
---

# Phase 4: Agent Workflow Verification Report

**Phase Goal:** A user can paste a job description and walk through a bounded, resumable "Apply to this job" workflow that reuses the existing engines and stops for their approval
**Status:** passed
**Re-verification:** No, initial verification

## Commands run (no real-model calls, no build)

| Command | Result |
|---|---|
| `npm test` | 304 pass, 0 fail |
| `npm run typecheck` | clean |
| `npm run eval -- --dry --no-dotenv` | 28 cases, fingerprint `1ht349n` (unchanged) |
| `npm run eval -- --agent --dry --no-dotenv` | 4 agent cases (strong-fit-complete, skip-stops, injection-order-holds, step-budget-stop), fingerprint `e6b03r` |

## Success Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Fit check, tailor, cover letter and outreach run as tools with the same grounding as standalone tools | VERIFIED | `lib/agent/step.ts` maps each tool to a preset (`AGENT_TOOL_PRESETS`, dev-time guard that the preset exists) and executes via the unchanged `runPreset(...)`, so citation scrubbing and the invented-figure check apply. Job text goes through `screenUntrusted`. User-owned run state wins over model args (`toolInputs`). |
| 2 | Checkpoints after fit check and before outreach; SKIP ends the run unless explicitly overridden | VERIFIED | `lib/agent/policy.ts` `nextAction`: SKIP returns a `stop` unless `approvals.skipOverride.fitStepId` matches. Gate A is required before tailor/cover letter. Gate B is required before outreach, and "decline" completes the run. Covered by `tests/agent-policy.test.ts` (33 tests) and the `agent-skip-stops` eval case. |
| 3 | Step or token budget stops the run with a visible reason | VERIFIED | `nextAction` returns `stop` with `step_budget` or `token_budget` and a user-facing `stopMessage`. The server recomputes usage from step records, so client claims can only raise it. `agent-step-budget-stop` eval case exists. |
| 4 | Closing the page and returning resumes from persisted vault state | VERIFIED | `lib/vault/store.ts` has an `agentRuns` object store (DB v3) with `saveAgentRun`, `loadAgentRun`, `listAgentRuns` and `deleteAgentRun`, plus a record validator in `lib/agent/record.ts`. `ApplyWorkflow.tsx` saves on every transition, lists runs on load, and shows a "Welcome back" banner with resume and interrupted-step handling (`?run=<id>`). `tests/agent-store.test.ts` has 11 tests. The 04-10 pre-check confirmed the resume banner in the browser. |
| 5 | Scripted-model tests cover tool selection, budget stop and approval gating; at least 3 agent eval cases in the harness | VERIFIED | `tests/agent-step.test.ts`, `agent-policy.test.ts`, `agent-client.test.ts`, `agent-store.test.ts`, `agent-evals.test.ts` and the `tests/agentScript.ts` scripted model. 4 agent eval cases in `evals/agentCases.ts`, run via `--agent` in `evals/llm/run.ts` and `agentRun.ts`. The default eval is unchanged (28 cases, `1ht349n`). |

## Requirements Coverage

All six IDs are declared in PLAN frontmatter (04-01 through 04-09) and match REQUIREMENTS.md. No orphaned requirements.

| Requirement | Plans | Status |
|---|---|---|
| AGENT-01 | 04-01, 03, 07, 08 | SATISFIED (planner and step over presets, `/apply` UI) |
| AGENT-02 | 04-01, 03, 05, 07 | SATISFIED (policy budgets, stop reasons) |
| AGENT-03 | 04-02, 04, 07, 08 | SATISFIED (vault `agentRuns` store and resume) |
| AGENT-04 | 04-01, 03, 04, 05, 06, 07 | SATISFIED (gates A and B, SKIP override) |
| AGENT-05 | 04-03, 05, 06 | SATISFIED (runPreset reuse) |
| AGENT-06 | 04-04, 05, 09 | SATISFIED (tests plus 4 eval cases) |

## Anti-Patterns

No TBD, FIXME or XXX markers in the agent files.

## Human Verification

The human checkpoint in 04-10 is resolved. The user approved the real-model flow, rejected the first `/apply` visual design, and approved the redesign (cc28d7e). The remaining 04-10 items were checked in the browser without model calls (375px has no horizontal overflow; /vault overflow fixed in d20c344).

## Notes (non-blocking)

- REQUIREMENTS.md still shows AGENT-01..06 as unchecked and "Pending", and the ROADMAP progress table has no Phase 4 row marked complete. Update these bookkeeping items when closing the phase.
- No real-model agent eval has been recorded. Only the dry run was verified here, which meets the roadmap's "at least 3 agent eval cases run in the eval harness" wording.
- `FREE_TIER_MODEL` is unset in the deployment env (see 04-10-SUMMARY). This is a deployment note, not a phase gap.
- The grounding guarantee rests on `runPreset` reuse. Only the code path was checked, not model output.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
