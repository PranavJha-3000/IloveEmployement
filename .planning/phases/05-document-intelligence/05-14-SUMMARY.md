---
phase: 05-document-intelligence
plan: 14
subsystem: resume-versions
tags: [tailored-versions, doc-04, agent-hook]
requires: [05-05, 05-10]
provides: [resumeToText, tailoredVersionFromTool, tailoredVersionFromAgentRun, jobHintFromJd]
key-files:
  created: [lib/engine/resumeText.ts, lib/vault/tailoredVersion.ts, tests/tailored-version.test.ts]
  modified: [components/engine/ReportView.tsx, components/engine/PresetRunner.tsx, components/agent/ApplyWorkflow.tsx]
metrics:
  tests: "490 pass / 0 fail"
  typecheck: "0 errors"
---

# Phase 5 Plan 14: Tailored resume versions Summary

Tailored versions now come from two sources: a "Save as version" inline form on the Tailor My Resume result, and an idempotent hook in the Phase 4 Apply workflow that saves each finished tailor step as `agent-<runId>`.

## Commits
- d766d6b: `resumeToText` moved to `lib/engine/resumeText.ts` verbatim; builders + 5 tests (output snapshot asserted)
- 4adcd68: ReportView/PresetRunner form and the ApplyWorkflow hook

## What was built
- `jobHintFromJd`, `tailoredVersionFromTool`, `tailoredVersionFromAgentRun` (pure, schema-validated; non-http(s) links dropped; text capped at the 40,000 version limit; label via `versionLabel`).
- ReportView: `onSaveVersion` / `versionJobHint` props; "Save as version" button opens an inline form (Job title required, Company, Posting link optional with "Use a link that starts with https://" inline error, Save version / Cancel) and then a polite status "Saved to Resume versions in your Career Vault." with a link to /vault. PresetRunner wires it for preset `tailor-resume` only.

## Phase 4 hook location
`components/agent/ApplyWorkflow.tsx`: helper `saveTailoredVersion` (line 124) is called in the advance loop (line 308) immediately after `rebaseStepResponse` + `settle(rec)`, i.e. after the step is applied onto the latest committed record (CR-02 reducers untouched) and inside `withRunLock` (CR-03). It only calls `saveResumeVersion` (a separate store from agentRuns) in a try/catch, so it cannot fail a step, change the record, the budget, approvals or layout. Job fields come from `step.target` (recorded server-side by step.ts) falling back to the run's job; text from `resumeToText(step.output.data, profile.name)`. Re-running or resuming the tailor step overwrites the same `agent-<runId>` version.

## Deviations from Plan
- The "Save as version" button and form render at the top of the result card body (directly under the card header) rather than inside the header's button row, to give the form room; same bordered button style.
- No automated test for the ApplyWorkflow hook itself (React component); the pure builders it uses are tested. Needs manual check: finish a tailor step in /apply and confirm one "Tailored: role, company" row appears in /vault.

## Verification
`npm test`: 490 pass, 0 fail (Phase 4 agent tests included). `npm run typecheck`: clean. `npm run build` not run (instructed).

## Self-Check: PASSED
