// ─── Agent eval runner ───────────────────────────────────────────────────────
// Drives the real agent loop (agentStep + the client reducers) for the cases in
// evals/agentCases.ts. Gates are answered by the harness; a SKIP verdict is never
// overridden. Reached only through `npm run eval -- --agent`, so the Phase 3 case
// set, fingerprint, estimate and cache keys are untouched. Agent results go to
// evals/results/agent-*.json and never to llm-latest.json or evals/LLM.md.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LanguageModelV1 } from "ai";
import { createModel } from "../../lib/ai";
import { AGENT_STEP_BUDGET } from "../../lib/agent/config";
import {
  applyStepResponse,
  approveGateA,
  approveGateB,
  buildStepRequest,
  localNextAction,
  retrieveForTools,
} from "../../lib/agent/client";
import { createRunRecord } from "../../lib/agent/record";
import { agentStep } from "../../lib/agent/step";
import type { AgentRunRecord, AgentStepResponse } from "../../lib/agent/types";
import { setModelFactory } from "../../lib/engine/run";
import { redactSecrets } from "../../lib/pipeline";
import { contentHash } from "../../lib/retrieval/fusion";
import type { AiRequestConfig } from "../../lib/types";
import { AGENT_CASES, type AgentEvalCase } from "../agentCases";
import { createDiskCache, HARNESS_VERSION } from "./cache";
import { stableChunks } from "./caseRun";
import { defaultModelSpecs, resolveKey, type ModelSpec } from "./env";
import { recordingModel, type CallRecord, type RecordingContext } from "./recordingModel";
import type { EvalArgs } from "./run";
import { createThrottle, QuotaExhaustedError, type RetryOptions, type ThrottleEvent } from "./throttle";

type Env = Record<string, string | undefined>;

// ─── Fingerprint and estimate ────────────────────────────────────────────────

export function agentCaseFingerprint(cases: AgentEvalCase[]): string {
  return contentHash(
    JSON.stringify(
      cases.map((c) => ({
        id: c.id,
        description: c.description,
        job: c.job,
        resume: c.resume,
        limits: c.limits,
        tags: c.tags,
        expect: c.expect.toString(),
      })),
    ),
  );
}

export interface AgentModelEstimate {
  modelKey: string;
  cases: number;
  cachedCases: number;
  upper: number;
}

export interface AgentEstimate {
  perModel: AgentModelEstimate[];
  upper: number;
}

/** Upper bound per case: step budget x (1 planner call + up to 3 tool calls: draft, review, revision). */
export function estimateAgentRequests(
  cases: AgentEvalCase[],
  models: ModelSpec[],
  cache?: { caseDone(caseId: string, modelKey: string): boolean } | null,
): AgentEstimate {
  const perModel = models.map((m) => {
    let cachedCases = 0;
    let upper = 0;
    for (const c of cases) {
      if (cache?.caseDone(c.id, m.key)) {
        cachedCases++;
        continue;
      }
      upper += (c.limits?.stepBudget ?? AGENT_STEP_BUDGET) * (1 + 3);
    }
    return { modelKey: m.key, cases: cases.length, cachedCases, upper };
  });
  return { perModel, upper: perModel.reduce((a, e) => a + e.upper, 0) };
}

export function formatAgentEstimate(est: AgentEstimate): string {
  const lines = est.perModel.map((e) => `${e.modelKey}: ${e.cases} agent case(s) (${e.cachedCases} cached) -> up to ${e.upper} requests`);
  lines.push(`Total: up to ${est.upper} requests`);
  return lines.join("\n");
}

// ─── One case ────────────────────────────────────────────────────────────────

export interface AgentCaseRun {
  record: AgentRunRecord;
  failures: string[];
}

/** Runs one case through the real loop. The model factory is set by the caller (scripted in tests, recording in runAgentEval). */
export async function runAgentCase(
  c: AgentEvalCase,
  opts: { config: AiRequestConfig; ip?: string; maxLoops?: number },
): Promise<AgentCaseRun> {
  const ip = opts.ip ?? "eval";
  const chunks = stableChunks(c.resume);
  const firstLine = c.resume.split("\n").map((l) => l.trim()).find(Boolean);
  const profile = { name: c.profileName ?? firstLine ?? "Priya Sharma" };
  let record: AgentRunRecord = { ...createRunRecord(c.job, { id: `eval-${c.id}`, now: Date.now() }), status: "running" };
  const loopFailures: string[] = [];
  const maxLoops = opts.maxLoops ?? 20;
  let settled = false;

  for (let i = 0; i < maxLoops; i++) {
    const action = localNextAction(record);
    if (action.kind === "stop" || action.kind === "complete") {
      settled = true;
      break;
    }
    if (action.kind === "gate") {
      if (action.gate === "A") {
        const fit = [...record.steps].reverse().find((s) => s.tool === "fit_check" && s.status === "done" && !s.invalidated);
        if (fit?.verdict === "SKIP") {
          settled = true; // never overridden
          break;
        }
        record = approveGateA(record, Date.now());
      } else {
        record = approveGateB(record, {}, Date.now());
      }
      continue;
    }
    const retrieved = retrieveForTools(chunks, c.job, action.allowed);
    const req = buildStepRequest(record, { vault: retrieved.vault, retrieval: retrieved.retrieval, profile, config: opts.config });
    const res = await agentStep(req, ip, c.limits ? { limits: c.limits } : {});
    if (res.status !== 200) {
      const message = "error" in res.body ? res.body.error : "unknown error";
      loopFailures.push(`step error: ${redactSecrets(message).replace(opts.config.apiKey, "[REDACTED]")}`);
      settled = true;
      break;
    }
    const body = res.body as AgentStepResponse;
    record = applyStepResponse(record, body, Date.now());
    // The server owns custom limits; once it says stop or complete the client must not ask again.
    if (body.next.kind === "stop" || body.next.kind === "complete") {
      settled = true;
      break;
    }
  }
  if (!settled) loopFailures.push("loop limit reached before the run settled");

  let expectFailures: string[];
  try {
    expectFailures = c.expect(record);
  } catch (err) {
    expectFailures = [`expectation threw: ${redactSecrets((err as Error).message)}`];
  }
  return { record, failures: [...loopFailures, ...expectFailures] };
}

// ─── Batch run ───────────────────────────────────────────────────────────────

export interface AgentOutcome {
  caseId: string;
  modelKey: string;
  tags: string[];
  ok: boolean;
  passed: boolean;
  failures: string[];
  status: string;
  stopReason?: string;
  steps: { tool: string; status: string; usage: { planner: number; tool: number; total: number } }[];
  calls: CallRecord[];
  startedAt?: string;
  error?: string;
  notRun?: "quota";
}

export interface AgentEvalResult {
  generatedAt: string;
  gitSha: string;
  command: string;
  harnessVersion: string;
  models: string[];
  agentCaseFingerprint: string;
  caseSubset: boolean;
  complete: boolean;
  estimate: AgentEstimate;
  outcomes: AgentOutcome[];
}

export interface RunAgentEvalOptions {
  cases: AgentEvalCase[];
  models: ModelSpec[];
  baseFactory: (config: AiRequestConfig) => LanguageModelV1;
  cacheDir: string;
  rpm: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  onEvent?: (e: ThrottleEvent) => void;
  env?: Env;
  command?: string;
  caseSubset?: boolean;
  gitSha?: string;
  retry?: Partial<RetryOptions>;
}

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

function placeholder(c: AgentEvalCase, modelKey: string): AgentOutcome {
  return { caseId: c.id, modelKey, tags: [...c.tags], ok: false, passed: false, failures: [], status: "not run", steps: [], calls: [], notRun: "quota" };
}

export async function runAgentEval(options: RunAgentEvalOptions): Promise<AgentEvalResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const sleep = options.sleep;
  const log = options.log ?? (() => {});
  const cache = createDiskCache(options.cacheDir);
  const throttle = createThrottle({ rpm: options.rpm, now, sleep, onEvent: options.onEvent });
  const retry: RetryOptions = { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 60000, sleep, now, ...options.retry };
  const keyFor = (spec: ModelSpec) => resolveKey(spec.provider, env);
  const active = options.models.filter((m) => keyFor(m));
  if (!active.length) throw new Error("no model with a key");
  const secrets = active.map(keyFor).filter((k): k is string => Boolean(k));
  const scrub = (text: string) => secrets.reduce((out, s) => out.split(s).join("[REDACTED]"), text);

  const estimate = estimateAgentRequests(options.cases, active, cache);
  const outcomes: AgentOutcome[] = [];
  let stoppedByQuota = false;

  for (const spec of active) {
    for (const c of options.cases) {
      if (stoppedByQuota) {
        outcomes.push(placeholder(c, spec.key));
        continue;
      }
      const stored = cache.readCaseRecord(c.id, spec.key) as AgentOutcome | null;
      if (stored && cache.caseDone(c.id, spec.key)) {
        outcomes.push(stored);
        log(`cached ${spec.key} ${c.id}`);
        continue;
      }
      const apiKey = keyFor(spec) as string;
      const transcript: CallRecord[] = [];
      const startedAt = new Date(now()).toISOString();
      let quota: QuotaExhaustedError | null = null;
      const ctx: RecordingContext = { caseId: c.id, modelKey: spec.key, purpose: "generation", cache, throttle, retry, transcript, onEvent: options.onEvent };
      let run: AgentCaseRun;
      try {
        setModelFactory((cfg) => {
          const wrapped = recordingModel(options.baseFactory(cfg), ctx);
          const orig = wrapped.doGenerate.bind(wrapped);
          wrapped.doGenerate = async (o) => {
            try {
              return await orig(o);
            } catch (e) {
              if (e instanceof QuotaExhaustedError) quota = e;
              throw e;
            }
          };
          return wrapped;
        });
        run = await runAgentCase(c, { config: { provider: spec.provider, apiKey, model: spec.model } });
      } finally {
        setModelFactory(null);
      }
      if (quota) {
        stoppedByQuota = true;
        log(`quota exhausted on ${spec.key}; stopping. Re-run to resume from the cache.`);
        outcomes.push(placeholder(c, spec.key));
        continue;
      }
      const { record, failures } = run;
      const hardError = failures.find((f) => f.startsWith("step error:"));
      const outcome: AgentOutcome = {
        caseId: c.id,
        modelKey: spec.key,
        tags: [...c.tags],
        ok: !hardError,
        passed: failures.length === 0,
        failures: failures.map((f) => scrub(f)),
        status: record.status,
        ...(record.stopReason ? { stopReason: record.stopReason.kind } : {}),
        steps: record.steps.map((s) => ({ tool: s.requestedTool && s.status === "rejected" ? s.requestedTool : s.tool, status: s.status, usage: s.usage })),
        calls: transcript,
        startedAt,
        ...(hardError ? { error: scrub(hardError).slice(0, 300) } : {}),
      };
      outcomes.push(outcome);
      // A transport or provider error is retried next run (finished model calls come from the cache).
      if (!hardError) cache.markCaseDone(c.id, spec.key, outcome);
      log(`${outcome.ok ? (outcome.passed ? "pass" : "FAIL") : "error"} ${spec.key} ${c.id}`);
    }
  }

  const result: AgentEvalResult = {
    generatedAt: new Date(now()).toISOString(),
    gitSha: options.gitSha ?? getGitSha(),
    command: options.command ?? "",
    harnessVersion: HARNESS_VERSION,
    models: active.map((m) => m.key),
    agentCaseFingerprint: agentCaseFingerprint(options.cases),
    caseSubset: Boolean(options.caseSubset),
    complete: !options.caseSubset && !stoppedByQuota,
    estimate,
    outcomes,
  };
  return JSON.parse(scrub(JSON.stringify(result))) as AgentEvalResult;
}

// ─── CLI branch ──────────────────────────────────────────────────────────────

/** Handles `--agent`. Never writes evals/LLM.md, llm-latest.json or LLM.preview.md. */
export async function mainAgent(args: EvalArgs, argv: string[]): Promise<void> {
  const env = process.env;
  let cases = AGENT_CASES;
  if (args.cases) {
    const unknown = args.cases.filter((id) => !AGENT_CASES.some((c) => c.id === id));
    if (unknown.length) {
      console.error(`Unknown agent case id(s): ${unknown.join(", ")}`);
      process.exitCode = 2;
      return;
    }
    cases = AGENT_CASES.filter((c) => args.cases!.includes(c.id));
  }
  if (args.limit !== null) cases = cases.slice(0, args.limit);

  const models = args.models ?? defaultModelSpecs(env);
  const cacheDir = path.join("evals", "results", "llm-cache");
  const cache = createDiskCache(cacheDir);
  const fingerprint = agentCaseFingerprint(cases);

  if (args.dry) {
    for (const c of cases) console.log(`${c.id.padEnd(32)} [${c.tags.join(",")}] ${c.description}`);
    console.log(`\n${cases.length} agent case(s). Agent case fingerprint: ${fingerprint}`);
    console.log(models.length ? formatAgentEstimate(estimateAgentRequests(cases, models, cache)) : "no models selected");
    return;
  }
  const estimate = estimateAgentRequests(cases, models, cache);
  if (args.estimate) {
    console.log(models.length ? formatAgentEstimate(estimate) : "no models selected (pass --models provider:model[,provider:model])");
    return;
  }
  if (!models.length) {
    console.error("pass --models provider:model[,provider:model] (see --list-models)");
    process.exitCode = 2;
    return;
  }
  if (models.every((m) => !resolveKey(m.provider, env))) {
    console.error("No API key for the selected model(s). Set EVAL_<PROVIDER>_API_KEY (or EVAL_API_KEY / FREE_TIER_API_KEY).");
    process.exitCode = 2;
    return;
  }
  console.log(formatAgentEstimate(estimate));
  if (estimate.upper > args.maxRequests) {
    console.error(`Estimated up to ${estimate.upper} requests exceeds --max-requests ${args.maxRequests}. Narrow the run (--cases, --limit, fewer models) or raise the limit.`);
    process.exitCode = 2;
    return;
  }

  const rpm = args.rpm ?? (Number(env.EVAL_RPM) > 0 ? Number(env.EVAL_RPM) : 5);
  let result: AgentEvalResult;
  try {
    result = await runAgentEval({
      cases, models, baseFactory: createModel, cacheDir, rpm, env,
      command: argv.join(" "), caseSubset: args.cases !== null || args.limit !== null,
      log: (l) => console.log(l),
      onEvent: (e) => console.log(`${e.type} ${e.modelKey}${e.ms ? ` ${e.ms} ms` : ""}${e.status ? ` (HTTP ${e.status})` : ""}`),
    });
  } catch (err) {
    console.error(redactSecrets((err as Error).message));
    process.exitCode = /no model with a key/.test((err as Error).message) ? 2 : 1;
    return;
  }

  const dir = path.join("evals", "results");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  const json = JSON.stringify(result, null, 2);
  fs.writeFileSync(path.join(dir, `agent-${stamp}.json`), json);
  fs.writeFileSync(path.join(dir, "agent-latest.json"), json);
  for (const o of result.outcomes) {
    console.log(`${o.notRun ? "not run" : o.ok ? (o.passed ? "PASS" : "FAIL") : "ERROR"} ${o.modelKey} ${o.caseId}${o.failures.length ? `: ${o.failures.join("; ")}` : ""}`);
  }
  console.log(`Agent results written to ${path.join(dir, "agent-latest.json")}`);
  if (result.outcomes.some((o) => o.notRun)) {
    console.error("Daily quota exhausted. Finished cases are cached; re-run after the quota resets to resume.");
    process.exitCode = 2;
  }
}
