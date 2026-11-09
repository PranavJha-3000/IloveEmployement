# Groq Free Trial + Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors must sign in (email code) to use the server-paid Groq free tier, get exactly 1 free run per day, and can still bring their own key; the design leaves room for a paid plan later.

**Architecture:** Keep the existing `resolveAccess` → `runPreset` pipeline. Replace the per-IP counter with a per-user counter keyed on the Supabase user id. Auth and counting use Supabase's REST API through `fetch` (no new dependencies). Groq is already a provider; it becomes the free-tier default with current model ids. When Supabase env vars are unset, the app behaves as today (IP counter), so local dev and existing tests keep working.

**Tech Stack:** Next.js 15, Vercel AI SDK (`@ai-sdk/openai-compatible`), Supabase Auth (email OTP) + Postgres RPC, Groq API, node:test.

**Spec:** the user's request (this conversation) and `docs/RESTRUCTURE_PLAN.md` (its "no accounts" decision is superseded for the free tier only; the Career Vault stays local-first).

## Global Constraints

- Cost: Groq free tier + Supabase free tier + Vercel hobby only. No paid dependency.
- No new npm dependencies.
- API keys never logged or stored; BYOK path unchanged (unlimited, no sign-in needed).
- `FREE_TIER_DAILY_LIMIT` default becomes `1`; the day boundary is UTC.
- The agent workflow (many model calls per run) is BYOK-only on the free tier.
- A run that fails (validation error, provider error) must not burn the user's daily run.
- Server secrets: `FREE_TIER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` never reach the client.

## Review Focus

- Signed-out request without a key → 401 "Sign in", no model call.
- Second free run same UTC day → 429; a failed first run → still has its run.
- Forged / expired bearer token → 401, not a free run.
- Two concurrent requests with 1 run left → exactly one succeeds (atomic SQL).
- BYOK request with no sign-in → works, no counter touched.

## Files

- Modify `lib/providers.ts` (Groq model list), `.env.example`, `lib/engine/access.ts`, `lib/engine/run.ts`, `lib/agent/step.ts`, `app/api/run/[preset]/route.ts`, `app/api/agent/step/route.ts`, `app/api/access/route.ts`, `components/engine/AccessPanel.tsx` (+ its `useAccess`), the fetch call sites (`PresetRunner`, `MockSession`, `ApplyWorkflow`).
- Create `lib/auth/supabase.ts` (server REST helpers), `lib/auth/client.ts` (browser sign-in + token), `supabase/schema.sql`, `tests/access.test.ts`, `tests/prompts.test.ts`.

---

### Task 1: Groq as the free-tier default

**Files:** Modify `lib/providers.ts`, `.env.example`; Test `tests/access.test.ts`

**Interfaces:** Produces `PROVIDERS.groq.defaultModel === "llama-3.3-70b-versatile"`; `freeTierInfo().dailyLimit === 1` when env unset.

- [ ] **Step 1:** Write `tests/access.test.ts` with `freeTierInfo defaults`: with `FREE_TIER_PROVIDER=groq`, `FREE_TIER_API_KEY=x`, no limit env → `{enabled:true, provider:"groq", model:"llama-3.3-70b-versatile", dailyLimit:1}`.
- [ ] **Step 2:** Run `npm test` → FAIL (model/limit differ).
- [ ] **Step 3:** In `lib/providers.ts` set Groq `defaultModel` `llama-3.3-70b-versatile`, models `["llama-3.3-70b-versatile","llama-3.1-8b-instant","openai/gpt-oss-120b","openai/gpt-oss-20b"]` (the old 70b-versatile 3.1, mixtral and gemma2 are decommissioned). In `access.ts` default limit `|| 1`. In `.env.example` set `FREE_TIER_PROVIDER=groq`, `FREE_TIER_MODEL=llama-3.3-70b-versatile`, `FREE_TIER_DAILY_LIMIT=1`, and add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: default free tier to Groq, 1 run per day`.

### Task 2: Server auth + atomic daily counter

**Files:** Create `lib/auth/supabase.ts`, `supabase/schema.sql`; Modify `lib/engine/access.ts`; Test `tests/access.test.ts`

**Interfaces:**
- Produces `authConfigured(): boolean`
- Produces `getUserId(headers: Headers, fetchImpl?: typeof fetch): Promise<string | null>` (verifies `Authorization: Bearer` via `GET {url}/auth/v1/user`)
- Produces `consumeRun(userId, limit, fetchImpl?): Promise<{ok: boolean; used: number}>` and `refundRun(userId, fetchImpl?): Promise<void>` (RPC `consume_daily_run(uid uuid, lim int)`, `refund_daily_run(uid uuid)`)
- Produces `identify(headers: Headers): Promise<string | null>` in `access.ts`: user id when auth is configured (null if missing/invalid), else `clientIp(headers)`.
- Changes `resolveAccess(config, id: string | null)`: free tier with `id === null` → `{ok:false,status:401,message:"Sign in to use your free daily run."}`; auth configured → `consumeRun`, over limit → 429; otherwise the existing IP counter. Result for tier `"free"` gains `refund: () => Promise<void>`.

- [ ] **Step 1:** Tests with an injected fake `fetch`: invalid token → `getUserId` null; `resolveAccess(undefined, null)` → 401; BYOK with `null` id → ok; second call over limit → 429; `refund()` restores the run.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `schema.sql`: table `daily_runs(user_id uuid, day date, used int, primary key(user_id, day))`; `consume_daily_run` does `insert … on conflict do update set used = used+1 where daily_runs.used < lim returning used` and returns a row only on success; `refund_daily_run` decrements floor 0; both `security definer`, execute granted to `service_role` only. Paid later = pass a bigger `lim`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: per-user daily free run via Supabase`.

### Task 3: Wire routes, refund on failure, agent BYOK-only

**Files:** Modify `lib/engine/run.ts`, `lib/agent/step.ts`, both route files, `app/api/access/route.ts`; Test `tests/access.test.ts`

**Interfaces:** Consumes Task 2. `runPreset(preset, body, id: string | null, opts?)` and `agentStep(raw, id: string | null, opts?)` keep their shape with the widened id. `/api/access` returns `{freeTier, model, dailyLimit, signedIn, remaining}`.

- [ ] **Step 1:** Tests: `runPreset` with a missing required field and the free tier → outcome 400 and the run is refunded; `agentStep` without a key → 400 "Add your own API key…" and no counter touched.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** In `runPreset`, call `access.refund()` for any `ok:false` outcome after access resolved. In `agentStep`, resolve with free tier disabled (BYOK only). Routes use `await identify(req.headers)`.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat: refund failed runs, agent is BYOK-only`.

### Task 4: Sign-in UI

**Files:** Create `lib/auth/client.ts`; Modify `components/engine/AccessPanel.tsx`, run call sites.

**Interfaces:** Produces `sendCode(email)`, `verifyCode(email, code)`, `signOut()`, `authHeader(): Record<string,string>` (`{}` when signed out), `useSession(): {email: string|null}`. Tokens in `localStorage`; refresh with the stored refresh token when expiring.

- [ ] **Step 1:** Implement the client against Supabase `/auth/v1/otp` and `/auth/v1/verify` (type `email`).
- [ ] **Step 2:** `useAccess`: `ready` = BYOK key, or (free tier and signed in). `AccessPanel` shows an email → code box when signed out, "1 free run left today" / "used today's run" when signed in, plus the existing "use my own key" switch.
- [ ] **Step 3:** Add `...authHeader()` to the fetches of `/api/run/*` and `/api/agent/step`.
- [ ] **Step 4:** `npm run typecheck` and `npm run build` → PASS; verify in the browser pane that the panel renders signed-out.
- [ ] **Step 5:** Commit `feat: email-code sign-in and free-run panel`.

### Task 5: Prompt audit

**Files:** Create `tests/prompts.test.ts`; fix whatever it finds in `lib/presets/*`.

- [ ] **Step 1:** Test over `PRESETS`: ids and slugs unique; every `kbTags` entry matches a KB entry tag; `task(sampleInputs)` is at least 60 chars; no task asks the model to invent facts (no "make up", "fabricate"); every `engine:"message"` preset resolves a format.
- [ ] **Step 2:** Run; fix any preset it flags.
- [ ] **Step 3:** Commit `test: prompt lint over every preset`.

### Not in this plan (YAGNI)

Paid subscription (Stripe/Razorpay), Google sign-in, admin dashboard. The RPC's `lim` argument is the hook for a paid daily limit later.
