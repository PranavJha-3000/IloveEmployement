---
phase: 04-agent-workflow
reviewed: 2026-11-01T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - lib/agent/step.ts
  - lib/agent/planner.ts
  - lib/agent/policy.ts
  - lib/agent/schema.ts
  - lib/agent/client.ts
  - lib/agent/record.ts
  - lib/agent/config.ts
  - lib/agent/types.ts
  - app/api/agent/step/route.ts
  - lib/engine/run.ts
  - lib/vault/store.ts
  - components/agent/ApplicationsList.tsx
  - components/agent/ApplyWorkflow.tsx
  - components/agent/ArtifactEditor.tsx
  - components/agent/BudgetMeter.tsx
  - components/agent/GateBar.tsx
  - components/agent/JobInput.tsx
  - components/agent/RunBanner.tsx
  - components/agent/StepCard.tsx
  - components/agent/StepTimeline.tsx
  - app/apply/page.tsx
  - components/vault/VaultManager.tsx
  - lib/tools.ts
  - components/tools/ToolGrid.tsx
  - components/layout/Header.tsx
  - evals/agentCases.ts
  - evals/llm/agentRun.ts
  - evals/llm/run.ts
  - tests/agent-client.test.ts
  - tests/agent-evals.test.ts
  - tests/agent-policy.test.ts
  - tests/agent-step.test.ts
  - tests/agent-store.test.ts
  - tests/agentScript.ts
findings:
  critical: 3
  warning: 10
  info: 6
  total: 19
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

I reviewed the Phase 4 agent workflow: the stateless step endpoint, the policy, planner, client reducers, the IndexedDB v3 migration, the `/apply` UI and the agent eval runner.

What holds up:
- Every request is zod-validated with capped strings and arrays. The body is never echoed or logged.
- The server applies tool order and the gates (`validateChoice` plus `nextAction`), so a model choice cannot skip the fit check, run outreach before gate B, or end the run early with `finish`.
- Planner tool parameters are enums, and `toolInputs` builds every preset input from user-owned state, so no free text from the model reaches a preset.
- Every artifact goes through the unchanged `runPreset`. Message tools get `checkGrounding`, report tools get `FINALIZERS` plus the figure check. Both run the existing injection gate again on the `untrusted: true` JD field.
- API keys do not reach `agentRuns` through the app's own flow.
- The v2 to v3 upgrade only adds a store, so v2 data is not lost.
- Free-tier counting is one `resolveAccess` per executed or rejected step. Blocked requests are free.
- Budget and approval tampering by the client is an accepted residual risk (T-04-14, T-04-15) and is not re-reported here.

The serious problems are elsewhere:
1. **NaN token usage.** The AI SDK reports missing usage as `NaN`, not `null`, so the null-usage mitigation (T-04-03) never fires. A provider that omits usage permanently breaks the run: every later request gets a 400.
2. **Stale record overwrites.** The client loop writes a stale local copy of the record over changes the user makes while a step is in flight. Pause toggles and saved draft edits are silently lost.
3. **Orphaned loops.** The loop is never aborted when the page unmounts, and the in-flight guard only covers one component instance. Navigating away and back can leave two loops driving the same run. That doubles spend and loses steps through last-write-wins in IndexedDB.

## Critical Issues

### CR-01: Missing provider usage arrives as NaN, which skips the null-usage charge and breaks the run

**File:** `lib/agent/step.ts:138-140`, `lib/agent/step.ts:212`, `lib/agent/planner.ts:486`
**Issue:** In ai@4.3.19, `generateText`/`generateObject` always return a `usage` object. When the provider omits usage, `@ai-sdk/openai` and `@ai-sdk/openai-compatible` fill in `promptTokens: NaN, completionTokens: NaN` (see `node_modules/@ai-sdk/openai-compatible/dist/index.mjs:426-427`). The checks `planned.usage ? ... : AGENT_NULL_USAGE_ESTIMATE` and `meta.usage ? ... : AGENT_NULL_USAGE_ESTIMATE` see a truthy object, so the estimate is never charged and `plannerTokens`/`toolTokens` become `NaN`. Effects:
- `step.usage.total` is `NaN`. `view()` returns `tokensUsed: Math.max(NaN, …) = NaN`, and `limits.tokenBudget - NaN < 2000` is false, so the token budget never stops anything on that response. This defeats T-04-03.
- `NextResponse.json` turns `NaN` into `null`. The client stores `usage.total: null` and `budget.tokensUsed: null` in IndexedDB.
- The next `buildStepRequest` sends `claimedTokensUsed: null` and `usage.total: null`, which the zod `tokens` schema rejects. Every later step returns 400 "Invalid agent step request." The saved run is permanently broken, including after a resume.

This hits any OpenAI-compatible free-tier or BYOK provider that does not return `usage` (several local and proxy providers).
**Fix:**
```ts
// lib/agent/step.ts
const tokensOf = (u: { promptTokens: number; completionTokens: number } | null | undefined): number => {
  const p = u?.promptTokens, c = u?.completionTokens;
  return Number.isFinite(p) && Number.isFinite(c) ? (p as number) + (c as number) : AGENT_NULL_USAGE_ESTIMATE;
};
const plannerTokens = tokensOf(planned.usage);
// ...
const toolTokens = tokensOf(meta.usage);
```
Also use `Number.isFinite` in `planNextTool` before returning `usage`. On the client, make `countUsage` and `localNextAction` treat non-finite values as `AGENT_NULL_USAGE_ESTIMATE` so records already saved with `null` can recover. Add a test with a mock model that returns `NaN` usage.

### CR-02: The advance loop writes a stale record over changes made while a step is in flight (lost edits and pause toggles)

**File:** `components/agent/ApplyWorkflow.tsx:224-254` (with `383-386`, `484-489`, `645`)
**Issue:** `advance` keeps its own `let rec` and, after each response, commits `applyStepResponse(rec, json, …)`. That overwrites whatever is in `recordRef.current` at that moment. Several controls stay usable while `busy`:
- The **"Pause after each step"** checkbox (line 645) is never disabled. `setPause` commits `{...recordRef.current, pauseAfterStep: true}`, then the loop's stale `rec` (still `pauseAfterStep: false`) is applied and committed. The checkbox flips back, and `applyStepResponse` reads the stale flag, so the run does not pause. This is the user's main cost control, and it silently fails.
- **ArtifactEditor "Save edit" and "Revert"** (lines 484-495) stay clickable if the editor was open before the loop started. For example: pause after the cover letter, open the editor, click Resume, then save while the tailoring step runs. The edit is committed, then the loop's next `commit(rec)` throws it away. The user's own written text is lost from IndexedDB.
- **Switching `?run=`** while a loop runs (the load effect at lines 190-214 calls `setRecord(otherRun)`). The old loop then calls `commit(rec)` for the previous run and `setRecord` switches the UI back.
**Fix:** Treat `recordRef.current` as the source of truth and apply only the server delta:
```ts
const base = recordRef.current;
if (!base || base.id !== start.id || base.status === "stopped") break; // user stopped or switched runs
rec = applyStepResponse(base, json, Date.now());
commit(rec);
```
Also disable the pause checkbox while `busy`, or read `pauseAfterStep` from `recordRef.current` inside `applyStepResponse`. Disable Save and Revert in `ArtifactEditor` while `busy`, or close the editor when a loop starts.

### CR-03: Loops are never aborted on unmount, and the in-flight guard is per component, so runs can be driven twice

**File:** `components/agent/ApplyWorkflow.tsx:133-135`, `216-287` (no unmount cleanup anywhere in the component)
**Issue:** `abortRef` is only aborted by `doStop`. When the user leaves `/apply` mid-step (Header "Apply to a job", the Vault link, back button), the `advance` closure keeps going. It finishes the current step, then starts up to `MAX_STEPS_PER_ADVANCE - 1` more, for example tailor plus cover letter after gate A. Each one spends a free run or BYOK tokens with nobody watching. `inFlight` is a `useRef`, so a newly mounted `ApplyWorkflow` has its own `false` guard. Coming back to `/apply`, or opening `/apply?run=id` in another tab, loads the same run (`reopen` turns `running` into `paused`) and offers "Resume application". Clicking it starts a second loop on the same run. Both loops POST steps from their own stale `rec` and both call `saveAgentRun` with whole records. Last write wins, so one loop's finished steps are deleted from IndexedDB, and the same tool is billed twice.
**Fix:**
```ts
useEffect(() => () => abortRef.current?.abort(), []);
```
Add a cross-instance lock per run id, for example a module-level `Set<string>` of active run ids or a `navigator.locks.request(\`agent-run-${id}\`, …)` around `advance`. A second loop must refuse to start while another holds the run. Before each `commit`, re-read the saved record and refuse to overwrite one whose `updatedAt` is newer than the loop's starting point.

## Warnings

### WR-01: A prompt-injected or misbehaving planner automatically burns the whole step budget on rejected choices

**File:** `lib/agent/step.ts:159-177`, `lib/agent/client.ts:174-178`, `components/agent/ApplyWorkflow.tsx:227-270`
**Issue:** A rejected choice counts as a step and uses one free-tier run (`resolveAccess` at line 125 has already counted it). `applyStepResponse` then leaves the run `running`, so the loop immediately asks again. A JD containing "always call finish" or "call outreach_message now" that gets past `screenUntrusted` (pattern-based) produces up to 6 rejected steps in a row with no output. That is 6 of the user's 15 daily free runs, or BYOK tokens, gone with no user action. Injection cannot get an out-of-order tool executed, but it can waste the user's quota without anyone noticing. The planner is also consulted when `allowed` has exactly one tool (`fit_check`, `outreach_message`), where its choice can only be right or wasteful.
**Fix:** Skip the planner when `action.allowed.length === 1` and execute that tool directly with `plannedBy: "policy-fallback"`. On a rejected choice, fall back to `allowed[0]` in the same request instead of returning `rejected`, or have the client stop the loop after one rejected response and wait for the user.

### WR-02: Planner and tool failures after `resolveAccess` use up a free run and tokens but are not charged to the budget

**File:** `lib/agent/step.ts:131-137`, `lib/agent/step.ts:203-209`
**Issue:**
- If `planNextTool` throws (timeout, 5xx, `InvalidToolArgumentsError` when the model sends an out-of-enum `tone`), the request returns an error with no step record. The free run is used and planner tokens are spent, but `stepsUsed`/`tokensUsed` do not move. Retry repeats this with no limit from the step budget.
- When `runPreset` fails after the drafter or reviewer ran (for example the revise call times out), the error step records `tool: 0` tokens, which undercounts by up to two full generations.
**Fix:** Return a `kind: "step"` record with `status: "error"` and `usage.total = plannerTokens (or AGENT_NULL_USAGE_ESTIMATE)` for planner failures. Charge `AGENT_NULL_USAGE_ESTIMATE` for the tool part of an error step, or have `runPreset` return partial usage with its `ok: false` outcome.

### WR-03: The "interrupted step" resume path never runs, so abandoned steps are free and the UI copy never shows

**File:** `lib/agent/record.ts:131-140`, `lib/agent/policy.ts:259-268`, `components/agent/ApplyWorkflow.tsx:216-254`, `components/agent/StepCard.tsx:237`
**Issue:** `normalizeForResume` turns `running` steps into `interrupted`, and `countUsage` charges them. But nothing ever saves a step with `status: "running"`: the client only appends the server's finished record. When the user stops mid-step (abort), closes the tab or loses the network, the server still finishes the step, counts the free run and spends the tokens. The client records nothing, so the budget is not charged, and the "This step was interrupted when the page closed and will restart" state can never appear. Resume works only because it silently runs the step again.
**Fix:** Before each `fetch`, commit a placeholder `{ id: tempId, tool: next.allowed[0], status: "running", usage: { planner: 0, tool: 0, total: AGENT_NULL_USAGE_ESTIMATE }, … }` and replace it with the server's step when the response arrives. On `AbortError`, keep it as `interrupted`.

### WR-04: The route's 60s `maxDuration` is shorter than a worst-case step, and the timeout response is not JSON

**File:** `app/api/agent/step/route.ts:10`, `lib/agent/config.ts:11`, `lib/engine/run.ts:271-283`, `components/agent/ApplyWorkflow.tsx:245`
**Issue:** One step can run the planner (20s timeout) plus draft, review and revise for `tailor-resume`/`cover-letter` (`review: true`), each with `DEFAULT_TIMEOUT` 55s. That is more than 60s on slower models, so the platform kills the function after the free run was counted and tokens were spent. The client then calls `res.json()` on an HTML or empty 504, which throws `SyntaxError`. The catch block shows that raw message ("Unexpected token '<'…") as the error banner.
**Fix:** Raise `maxDuration` to cover planner plus three calls (or skip the planner as in WR-01), or give `runPreset` a total deadline. On the client, check `res.headers.get("content-type")` before `json()` and show a fixed timeout message.

### WR-05: The v3 upgrade can hang indefinitely against tabs still running the v2 code

**File:** `lib/vault/store.ts:39-52`, `lib/vault/store.ts:54-62`
**Issue:** Code from before Phase 4 never set `db.onversionchange`, so an open tab running the old bundle keeps its v2 connection. The new `indexedDB.open(DB_NAME, 3)` fires `blocked` and waits. There is no `req.onblocked`, so `openDb()` never settles, and `loadChunks`/`listAgentRuns` hang instead of "degrading to an empty vault" as the header comment promises (`useVault().loaded` stays false). Separately, `tx()` does not handle `t.onabort`. A `QuotaExceededError` aborts the transaction without `onerror`, so `saveAgentRun` never resolves. This becomes more likely now that each step stores the full artifact plus up to 60 sent chunks.
**Fix:** Add `req.onblocked = () => reject(new Error("Close other IloveEmployement tabs to finish the update."))`, or surface a notice. Add `t.onabort = () => reject(t.error ?? new Error("Transaction aborted"))`.

### WR-06: `isAgentRunRecord` validation is too shallow: malformed imports crash the Vault page and break budget math

**File:** `lib/agent/record.ts:64-75`, `lib/agent/record.ts:142-147`, `components/agent/ApplicationsList.tsx:96`
**Issue:** Only `job.description` is type-checked. A record without `job.role`/`job.company` (hand-edited or older export) passes, then `jobLabel` calls `job.role.trim()` and throws a TypeError while `ApplicationsList` renders, which takes down `/vault`. `budget` is only checked with `isObj`. Missing or non-numeric `stepsUsed`/`tokensUsed`/`resets` make `Math.max(n, undefined) = NaN` in `localNextAction`, so the client never shows a budget stop, and the server rejects every request because zod needs numbers.
**Fix:** Validate `job.company`/`job.role` as strings, every `budget` field with `Number.isFinite`, `approvals` subfields, and each step's `usage.total`. Make `jobLabel` defensive: `(job.role ?? "").trim()`.

### WR-07: Importing a vault overwrites newer local runs with older exported copies

**File:** `lib/vault/store.ts:213-219`
**Issue:** `importVault` calls `saveAgentRun(r)`, which `put`s by id. Importing yesterday's backup after doing more work today replaces the newer run, with its later steps and edits, by the older snapshot, without warning.
**Fix:** Load the existing record first and skip the import when `existing.updatedAt >= r.updatedAt`, or report conflicts to the user.

### WR-08: `toStorable` only whitelists top-level fields; nested objects pass through unchecked

**File:** `lib/agent/record.ts:77-129`
**Issue:** The comment says "unknown keys (a stray config or apiKey) never reach storage or export". But `approvals`, `stopReason`, and each step's `inputs`, `output` (including `meta`), `edit` and `target` are copied by reference. An imported file (T-04-05) can store arbitrary nested data, such as `approvals.gateB.apiKey` or extra fields in `output`, which then re-exports. In the in-app flow these objects come from the server and hold no keys today, but the T-04-06 mitigation is weaker than documented and depends on every future `RunMeta` field staying key-free.
**Fix:** Rebuild `approvals` (`gateA`, `gateB`, `skipOverride` with explicit fields), `stopReason`, `edit`, and `target` field by field. Restrict `inputs` to string values for the preset's own field keys. At minimum, drop any key matching `/api.?key|secret|token/i` from `output.meta`.

### WR-09: Free-tier users can never "Continue with a new budget" after reloading the page

**File:** `components/agent/ApplyWorkflow.tsx:399-400`, `components/agent/ApplyWorkflow.tsx:123`
**Issue:** `canContinueBudget` needs `remaining !== null && remaining >= 1` for users without BYOK. `remaining` is component state that only a step response sets. After a reload or resume, a budget-stopped run starts with `remaining === null` and gets no further step response, so the button never appears even with free runs left.
**Fix:** Get the free-tier remaining count from `useAccess()` (or a lightweight status endpoint), or show the button when `remaining === null` and let the server's 429 handle exhaustion.

### WR-10: A job URL that fails server validation makes every step return a generic 400

**File:** `components/agent/JobInput.tsx:80-88`, `components/agent/ApplyWorkflow.tsx:57-63`, `components/agent/ApplyWorkflow.tsx:432-443`, `lib/agent/schema.ts:25-30`
**Issue:** The server requires `^https?://`. The start form relies on `type="url"`, which accepts `ftp://…` and `javascript:…`, and the "Edit job details" form at lines 432-443 is not a `<form>`, so it has no browser validation at all. Any such URL makes `/api/agent/step` return the opaque "Invalid agent step request." on every attempt, and the user has no hint that the URL is the cause. The value is not rendered as a link anywhere, so this is not XSS, but the run cannot continue until the job is edited.
**Fix:** Validate in `cleanJob` (drop or reject non-http(s) URLs with an inline field error) and apply the same check to the edit form's "Re-run fit check" button.

## Info

### IN-01: The stored `sent` chunks are the raw request list, not what `runPreset` actually used

**File:** `lib/agent/step.ts:183`, `lib/agent/step.ts:216`
**Issue:** `sent = req.vault[tool]` is the unsliced client array. `runPreset` uses `cleanVault(body.vault, vaultLimit)`. With the in-app client the two match, but for any other client the "what was sent" view and `saveArtifactEdit` grounding (`client.ts:262`) check against chunks the model never saw.
**Fix:** Return the cleaned vault from `runPreset` (for example `meta.sentIds`) and store that.

### IN-02: The planner prompt states the wrong budget when limits differ from the defaults

**File:** `lib/agent/planner.ts:35-36`, `lib/agent/planner.ts:48`
**Issue:** `buildPlannerPrompt` recomputes `countUsage(req.steps)` and `budgetLimits(req.budget.resets)`. It ignores `opts.limits` (used by eval cases) and the claimed floor, so the model sees "x of 6 steps" when the real limit is 2.
**Fix:** Pass the `budget` view computed in `agentStep` into `buildPlannerPrompt`.

### IN-03: The token budget is checked only before a step, so one step can overshoot it by a large margin

**File:** `lib/agent/policy.ts:124-130`
**Issue:** A tailoring step (14k-token context, draft plus review plus revise) can use tens of thousands of tokens after passing the 2,000-token threshold. The UI copy suggests a hard cap.
**Fix:** Document the cap as soft, or reserve an estimated per-tool cost before starting the step.

### IN-04: Each step makes two model calls under one free run

**File:** `lib/agent/step.ts:125-133`
**Issue:** The planner call plus tool calls run on the free-tier key for a single count. Combined with WR-01, the planner doubles the cost for steps where only one tool is allowed.
**Fix:** See WR-01. Short-circuit when only one tool is allowed.

### IN-05: `job.role` and `job.company` sit outside the untrusted fence in the planner prompt

**File:** `lib/agent/planner.ts:62`
**Issue:** These fields are user-typed, but users often paste them from the posting. They are not screened and sit in the trusted part of the prompt. Policy validation limits the damage, as in WR-01.
**Fix:** Run them through `screenUntrusted` or put them inside the `<untrusted_document>` block.

### IN-06: "Saved" is announced before the save finishes, and save failures are swallowed

**File:** `components/agent/ApplyWorkflow.tsx:162-173`, `components/agent/ApplyWorkflow.tsx:71`
**Issue:** `liveStep` announces "Saved to your Career Vault." right away, while `saveAgentRun` failures are dropped silently by `.catch(() => {})`. With WR-05 (quota or blocked database), the user is told work is saved when it is not.
**Fix:** Announce "Saved" only in the `.then`, and show a persistent "Not saved" notice in the `.catch`.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
