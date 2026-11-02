---
phase: 04-agent-workflow
fixed_at: 2026-11-01T00:00:00Z
review_path: .planning/phases/04-agent-workflow/04-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-11-01
**Source review:** .planning/phases/04-agent-workflow/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (3 critical, 10 warning; Info findings were out of scope)
- Fixed: 13
- Skipped: 0

**Verification (main checkout, after the fast-forward):**
- `npm test`: 321 tests, 321 pass, 0 fail (baseline was 304; 17 new regression tests)
- `npm run typecheck`: clean
- `npm run eval -- --dry --no-dotenv`: 28 cases, fingerprint `1ht349n` (unchanged)
- `lib/engine/run.ts`, presets and the eval cases are unchanged. No real-model calls. `npm run build` was not run.

## Fixed Issues

### CR-01: Missing provider usage arrives as NaN, which skips the null-usage charge and breaks the run

**Files modified:** `lib/agent/policy.ts`, `lib/agent/step.ts`, `lib/agent/planner.ts`, `lib/agent/client.ts`, `tests/agent-step.test.ts`
**Commit:** 697fe85
**Applied fix:** Added `usageTokens`, `finiteUsage` and `finiteCount` to policy.ts. Planner and tool tokens now go through `usageTokens`, so NaN is charged `AGENT_NULL_USAGE_ESTIMATE`. `planNextTool` reports non-finite usage as null. `countUsage`, `summarizeStep`, `localNextAction` and `buildStepRequest` make every value finite, so records already saved with `null` recover. Tests 16 and 17: a scripted model with NaN usage is charged 2 x the estimate, the JSON round-tripped response produces a zod-valid next request, and a saved record with null usage passes `parseAgentStepRequest`.

### CR-02: The advance loop writes a stale record over changes made while a step is in flight

**Files modified:** `lib/agent/client.ts`, `components/agent/ApplyWorkflow.tsx`, `tests/agent-client.test.ts`
**Commit:** 8799a44
**Applied fix:** Added pure reducers `loopBase`, `rebaseStepResponse` and `markRunError`. The loop re-bases on `recordRef.current` before each request, and applies every response and error to the latest committed record. A pause toggle or saved edit made mid-step is kept. A user stop wins, and the paid step is still kept. If the UI switches to another run, the loop stops and saves the step to its own run without taking over the UI. The pause checkbox stays enabled, because it now works mid-step. Three reducer tests.

### CR-03: Loops are never aborted on unmount, and the in-flight guard is per component

**Files modified:** `lib/agent/runLock.ts` (new), `components/agent/ApplyWorkflow.tsx`, `tests/agent-client.test.ts`
**Commit:** 9f9babd
**Applied fix:** A `useEffect` cleanup aborts the loop on unmount, and the loop also checks `signal.aborted` at the top of each iteration. The new `withRunLock(runId, fn)` takes the Web Locks API lock (`navigator.locks`, `ifAvailable`) across tabs. It also keeps a module-level set as an in-tab guard, and falls back to that set when Web Locks is missing or throws. A second loop on the same run refuses to start and shows a "running in another tab" message. Two tests: in-tab refusal, a cross-tab fake lock manager, the broken-manager fallback, and error propagation.

### WR-01: A prompt-injected planner burns the whole step budget on rejected choices

**Files modified:** `lib/agent/config.ts`, `lib/agent/policy.ts`, `lib/agent/step.ts`, `tests/agent-step.test.ts`
**Commit:** d8bce86
**Applied fix:** Added `AGENT_MAX_CONSECUTIVE_REJECTIONS = 2` and `trailingRejections(steps)`. After 2 rejections in a row, the step skips the planner and runs `allowed[0]`, marked `plannedBy: "policy-fallback"`, with 0 planner tokens. Once a step runs, the planner is asked again. Test 18. The planner prompt, schema, temperature and the single-allowed-tool path are unchanged.

### WR-02: Planner and tool failures after `resolveAccess` are not charged to the budget

**Files modified:** `lib/agent/step.ts`, `tests/agent-step.test.ts`
**Commit:** 1150cf8
**Applied fix:** A planner failure now returns a `kind: "step"` record with `status: "error"`, charged `AGENT_NULL_USAGE_ESTIMATE`, so retries hit the step budget. One exception: an `auth` error (rejected key) stays a plain 401, because nothing was spent and a retry cannot help. A tool failure now charges the estimate for the tool part. Test 19.

### WR-03: The "interrupted step" resume path never runs

**Files modified:** `lib/agent/client.ts`, `components/agent/ApplyWorkflow.tsx`, `tests/agent-client.test.ts`
**Commit:** f0531d5
**Applied fix:** Added reducers `beginStep` and `interruptRunning`, and gave `markRunError` an `{ interrupted }` option. The loop builds the request, then saves a `running` placeholder (charged the estimate), and then sends. `applyStepResponse` replaces the placeholder with the server's step. An abort turns it into `interrupted`. A clean server error drops it. A network failure keeps it as interrupted. `localNextAction` ignores in-flight placeholders, so the view does not change during a step.

### WR-04: The route's 60s `maxDuration` is shorter than a worst-case step, and the timeout response is not JSON

**Files modified:** `app/api/agent/step/route.ts`, `lib/agent/client.ts`, `components/agent/ApplyWorkflow.tsx`, `tests/agent-client.test.ts`
**Commit:** d725031
**Applied fix:** `maxDuration` is now 300. The worst case is 20s for the planner plus 3 x 55s, which is 185s. A test checks the literal against `AGENT_PLANNER_TIMEOUT_MS + 3 * DEFAULT_TIMEOUT`. The new `readStepResponse` checks the content type before parsing. A non-JSON or empty response becomes a fixed "took too long" message instead of the raw `SyntaxError`, and the step counts as interrupted.

### WR-05: The v3 upgrade can hang indefinitely against tabs still running v2 code

**Files modified:** `lib/vault/store.ts`, `tests/agent-store.test.ts`
**Commit:** b629e4b
**Applied fix:** `openDb` now has `req.onblocked`, which rejects with `VAULT_BLOCKED_MESSAGE` so callers fall back to an empty vault. If the connection opens after that rejection, it is closed. `onversionchange` was already set. `tx` now has `t.onabort`, which catches `QuotaExceededError`. The test uses a fake `indexedDB`.

### WR-06: `isAgentRunRecord` validation is too shallow

**Files modified:** `lib/agent/record.ts`, `tests/agent-store.test.ts`
**Commit:** 2b159f3
**Applied fix:** Now validates the `job` strings (url and notes are optional), every `budget` field, the `approvals` subfields and step `usage`. Usage counters may still be `null`, so records saved by the NaN bug still load and recover through CR-01. `jobLabel` is defensive about missing fields.

### WR-07: Importing a vault overwrites newer local runs with older exported copies

**Files modified:** `lib/vault/store.ts`, `components/vault/VaultManager.tsx`, `tests/agent-store.test.ts`
**Commit:** 8e17f4c
**Applied fix:** Added `shouldImportRun(existing, incoming)`: a run is imported only when its `updatedAt` is newer than the local copy. `importVault` also returns `keptNewer`, and the Vault notice reports the newer runs that were kept.

### WR-08: `toStorable` only whitelists top-level fields

**Files modified:** `lib/agent/record.ts`, `tests/agent-store.test.ts`
**Commit:** e2770ac
**Applied fix:** `approvals`, `stopReason`, and each step's `inputs` (string values only), `usage`, `output.meta`, `sent` chunks, `edit`, `target` and `invalidated` are now rebuilt field by field. Key-like names (api key, secret, token, password) are dropped from `inputs` and `meta`. Preset `data` is kept as is.

### WR-09: Free-tier users can never "Continue with a new budget" after reloading

**Files modified:** `components/agent/ApplyWorkflow.tsx`
**Commit:** 19595c9
**Applied fix:** The button now shows when `remaining === null` (unknown after a reload). The server's 429 still reports an exhausted free tier. This is a one-line condition change with no new test, so it needs a manual check (see below).

### WR-10: A job URL that fails server validation makes every step return a generic 400

**Files modified:** `lib/agent/record.ts`, `lib/agent/client.ts`, `components/agent/JobInput.tsx`, `components/agent/ApplyWorkflow.tsx`, `tests/agent-client.test.ts`
**Commit:** 797af7a
**Applied fix:** The new `isJobUrl` mirrors the schema. JobInput shows an inline field error with `aria-invalid`. Start lists the bad link under "Still needed", and "Re-run fit check" is disabled while the link is invalid. `cleanJob` drops bad links. `buildStepRequest` trims the link and drops an invalid one, so saved runs that are stuck can continue. The layout is unchanged.

## Notes for human verification

- CR-02, CR-03, WR-01, WR-02 and WR-03 change loop logic. Their reducers and server paths are unit-tested. The loop wiring in `ApplyWorkflow.tsx` should be checked by hand on the dev server:
  - toggle pause mid-step
  - save an edit mid-step
  - navigate away mid-step
  - open the same run in two tabs
  - stop mid-step and check that an interrupted card appears
- WR-02 choice: a rejected key (`auth` category) still returns a plain 401 and is not charged as a step. Every other planner failure is charged.
- WR-04 assumes the deployment allows 300s functions, as Vercel does with Fluid compute. `app/api/run/[preset]/route.ts` still has the same 60s exposure for review presets. That route was out of scope.
- New file: `lib/agent/runLock.ts`, the cross-instance and cross-tab run lock required by CR-03.

---

_Fixed: 2026-11-01_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
