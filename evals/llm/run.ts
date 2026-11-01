// ─── LLM eval runner ─────────────────────────────────────────────────────────
// npm run eval -- --models provider:model[,...] [--judge provider:model]
// Runs the selected cases across the selected models, judges the outputs and
// writes evals/results/llm-<stamp>.json plus the generated report. Every model
// call goes through the disk-cached, throttled recording wrapper, so an
// interrupted run resumes without repeating finished calls.
// npm run eval -- --agent [--dry|--estimate|--cases id[,id]|--models ...]
// Runs the agent workflow cases (evals/agentCases.ts) instead; the default run is unchanged.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { generateText, type LanguageModelV1 } from "ai";
import { createModel } from "../../lib/ai";
import { extractJson, redactSecrets } from "../../lib/pipeline";
import { runPreset, setModelFactory } from "../../lib/engine/run";
import type { RunMeta } from "../../lib/engine/types";
import type { AiRequestConfig } from "../../lib/types";
import { CASES, type EvalCase } from "../cases";
import { mainAgent } from "./agentRun";
import { computeAgreement, type AgreementBlock, type AgreementPair, type Rating } from "./agreement";
import { createDiskCache, HARNESS_VERSION, type DiskCache } from "./cache";
import { prepareCase } from "./caseRun";
import { extractCitationUnits, finalDraftText, type CitationUnit } from "./citations";
import { defaultModelSpecs, describeConfig, loadDotEnv, parseModelList, parseModelSpec, resolveKey, type ModelSpec } from "./env";
import { estimateRequests, formatEstimate, type Estimate } from "./estimate";
import { caseFingerprint } from "./fingerprint";
import { runJudge } from "./judge";
import { buildLabelItems, parseHandLabels, renderLabelSheet, selectLabelItems, type LabelItem, type LabelKey } from "./labels";
import { modelSummary, type CaseOutcome, type ModelSummary } from "./metrics";
import { listGoogleModels } from "./models";
import { lookupPrice, PRICE_TABLE_RETRIEVED } from "./prices";
import { recordingModel, type CallRecord, type RecordingContext } from "./recordingModel";
import { renderLlmReport } from "./report";
import { loadRubric, rubricHash } from "./rubric";
import { createThrottle, QuotaExhaustedError, type RetryOptions, type ThrottleEvent } from "./throttle";

type Env = Record<string, string | undefined>;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RunOutcome extends CaseOutcome {
  /** ISO time the case started; stored with the case so a resumed run reports the same value. */
  startedAt?: string;
  /** Set on placeholder outcomes for cases that were never attempted. */
  notRun?: "quota";
}

export interface ModelInfo {
  key: string;
  provider: string;
  requestedModel: string;
  reportedModelVersions: string[];
  firstCallAt: string | null;
  /** True when the key used is the project's free-tier key (usage is billed $0). */
  freeTierKey: boolean;
  skipped?: string;
}

export interface LlmRunResult {
  generatedAt: string;
  gitSha: string;
  command: string;
  node: string;
  platform: string;
  harnessVersion: string;
  caseFingerprint: string;
  caseCount: number;
  rubricHash: string;
  priceTableRetrieved: string;
  models: ModelInfo[];
  judge: { key: string; provider: string; requestedModel: string; reportedModelVersions: string[]; freeTierKey: boolean } | null;
  judgeNote?: string;
  sampling: { observedTemperatures: Record<string, number[]>; judgeTemperature: 0; note: string };
  retrieval: string;
  /** True only when every selected case was attempted and no case subset was requested. */
  complete: boolean;
  caseSubset: boolean;
  outcomes: RunOutcome[];
  summaries: Record<string, ModelSummary>;
  estimate: Estimate;
  /** Filled by `--agreement` once hand labels exist. */
  agreement?: AgreementBlock;
}

export interface RunEvalOptions {
  cases: EvalCase[];
  models: ModelSpec[];
  judge: ModelSpec | null;
  baseFactory: (config: AiRequestConfig) => LanguageModelV1;
  cacheDir: string;
  rpm: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  onEvent?: (e: ThrottleEvent) => void;
  env?: Env;
  /** Recorded verbatim in the result; the CLI passes argv, never env. */
  command?: string;
  /** True when the case list is a subset (--cases / --limit). */
  caseSubset?: boolean;
  gitSha?: string;
  retry?: Partial<RetryOptions>;
}

const RETRIEVAL_NOTE = "vault chunks selected by keyword BM25 (limit <= 12) or whole resume, as in the app without the semantic index";
const SAMPLING_NOTE = "other sampling settings are provider defaults; thinking settings provider default";
const PROBE_CASE = "__probe__";

const priceFor = (modelKey: string) => {
  const i = modelKey.indexOf(":");
  return i > 0 ? lookupPrice(modelKey.slice(0, i), modelKey.slice(i + 1)) : null;
};

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

// ─── Probing ─────────────────────────────────────────────────────────────────

export interface ProbeResult {
  spec: ModelSpec;
  ok: boolean;
  skipped?: string;
  modelVersion: string | null;
}

interface SharedInfra {
  cache: DiskCache;
  throttle: ReturnType<typeof createThrottle>;
  retry: RetryOptions;
  onEvent?: (e: ThrottleEvent) => void;
}

const PROBE_SKIP = /404|not.?found|not supported|unsupported|\b400\b|invalid|\b401\b|\b403\b|permission|api key/i;

/** One short call per distinct model (cached, throttled, counted). A missing or unsupported model is skipped, not fatal. */
export async function probeModels(
  specs: ModelSpec[],
  deps: { baseFactory: RunEvalOptions["baseFactory"]; keyFor: (spec: ModelSpec) => string | null } & SharedInfra,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const seen = new Set<string>();
  for (const spec of specs) {
    if (seen.has(spec.key)) continue;
    seen.add(spec.key);
    const apiKey = deps.keyFor(spec);
    if (!apiKey) {
      results.push({ spec, ok: false, skipped: `no key for ${spec.provider}`, modelVersion: null });
      continue;
    }
    const transcript: CallRecord[] = [];
    const ctx: RecordingContext = {
      caseId: PROBE_CASE, modelKey: spec.key, purpose: "probe",
      cache: deps.cache, throttle: deps.throttle, retry: deps.retry, transcript, onEvent: deps.onEvent,
    };
    try {
      const model = recordingModel(deps.baseFactory({ provider: spec.provider, apiKey, model: spec.model }), ctx);
      await generateText({ model, prompt: "Reply with the word OK.", maxTokens: 8, maxRetries: 0 });
      results.push({ spec, ok: true, modelVersion: transcript.find((r) => r.modelVersion)?.modelVersion ?? null });
    } catch (err) {
      if (err instanceof QuotaExhaustedError) throw err;
      const message = redactSecrets(err instanceof Error ? err.message : String(err)).replace(apiKey, "[REDACTED]").slice(0, 300);
      if (!PROBE_SKIP.test(message)) throw new Error(message);
      results.push({ spec, ok: false, skipped: `probe failed: ${message}`, modelVersion: null });
    }
  }
  return results;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

function placeholder(c: EvalCase, modelKey: string, notRun: "quota"): RunOutcome {
  const prepared = prepareCase(c);
  return {
    caseId: c.id, engine: prepared.engine, tags: [...c.tags], modelKey, ok: false, passed: false, failures: [],
    calls: [], judgeCalls: [], units: [], notRun,
  };
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export async function runEval(options: RunEvalOptions): Promise<LlmRunResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const sleep = options.sleep;
  const log = options.log ?? (() => {});
  const cache = createDiskCache(options.cacheDir);
  const throttle = createThrottle({ rpm: options.rpm, now, sleep, onEvent: options.onEvent });
  const retry: RetryOptions = { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 60000, sleep, now, ...options.retry };
  const infra: SharedInfra = { cache, throttle, retry, onEvent: options.onEvent };
  const keyFor = (spec: ModelSpec) => resolveKey(spec.provider, env);
  const isFree = (spec: ModelSpec) => {
    const k = keyFor(spec);
    return Boolean(k && env.FREE_TIER_API_KEY && k === env.FREE_TIER_API_KEY);
  };
  const secrets = uniq(
    [...options.models, ...(options.judge ? [options.judge] : [])].map(keyFor).filter((k): k is string => Boolean(k)),
  );

  const infoFor = (spec: ModelSpec): ModelInfo => ({
    key: spec.key, provider: spec.provider, requestedModel: spec.model, reportedModelVersions: [], firstCallAt: null, freeTierKey: isFree(spec),
  });
  const modelInfos: ModelInfo[] = options.models.map(infoFor);
  for (const m of modelInfos) {
    if (!resolveKey(m.provider as ModelSpec["provider"], env)) m.skipped = `no key for ${m.provider}`;
  }
  if (modelInfos.every((m) => m.skipped)) throw new Error("no model with a key");

  let judgeSpec = options.judge;
  let judgeNote: string | undefined;
  if (judgeSpec && !keyFor(judgeSpec)) {
    judgeNote = `judge skipped: no key for ${judgeSpec.provider}`;
    judgeSpec = null;
  }

  const estimate = estimateRequests({
    cases: options.cases,
    models: options.models.filter((m) => !modelInfos.find((i) => i.key === m.key)?.skipped),
    judge: judgeSpec,
    cache,
  });

  const outcomes: RunOutcome[] = [];
  let stoppedByQuota = false;
  let judgeVersions: string[] = [];

  const finish = (): LlmRunResult => buildResult();

  // Probe before any case.
  try {
    const probeSpecs = [...options.models.filter((m) => !modelInfos.find((i) => i.key === m.key)?.skipped), ...(judgeSpec ? [judgeSpec] : [])];
    const probes = await probeModels(probeSpecs, { baseFactory: options.baseFactory, keyFor, ...infra });
    for (const p of probes) {
      const info = modelInfos.find((m) => m.key === p.spec.key);
      if (info && p.skipped) info.skipped = p.skipped;
      if (info && p.modelVersion) info.reportedModelVersions.push(p.modelVersion);
      if (judgeSpec && p.spec.key === judgeSpec.key) {
        if (p.skipped) {
          judgeNote = `judge skipped: ${p.skipped}`;
          judgeSpec = null;
        } else if (p.modelVersion) judgeVersions.push(p.modelVersion);
      }
    }
    if (modelInfos.every((m) => m.skipped)) {
      throw new Error(`no usable model (${modelInfos.map((m) => `${m.key}: ${m.skipped}`).join("; ")})`);
    }
  } catch (err) {
    if (!(err instanceof QuotaExhaustedError)) throw err;
    stoppedByQuota = true;
  }

  const active = options.models.filter((m) => !modelInfos.find((i) => i.key === m.key)?.skipped);

  outer: for (const spec of active) {
    for (const c of options.cases) {
      if (stoppedByQuota) {
        outcomes.push(placeholder(c, spec.key, "quota"));
        continue;
      }
      const stored = cache.readCaseRecord(c.id, spec.key) as RunOutcome | null;
      if (stored && cache.caseDone(c.id, spec.key)) {
        outcomes.push(stored);
        log(`cached ${spec.key} ${c.id}`);
        continue;
      }
      try {
        const o = await runOneCase(c, spec);
        outcomes.push(o.outcome);
        if (o.done) cache.markCaseDone(c.id, spec.key, o.outcome);
        log(`${o.outcome.ok ? (o.outcome.passed ? "pass" : "FAIL") : "error"} ${spec.key} ${c.id}`);
      } catch (err) {
        if (!(err instanceof QuotaExhaustedError)) throw err;
        stoppedByQuota = true;
        log(`quota exhausted on ${spec.key}; stopping. Re-run to resume from the cache.`);
        outcomes.push(placeholder(c, spec.key, "quota"));
      }
    }
    if (stoppedByQuota) continue outer;
  }

  return finish();

  // ── One case on one model ──
  async function runOneCase(c: EvalCase, spec: ModelSpec): Promise<{ outcome: RunOutcome; done: boolean }> {
    const apiKey = keyFor(spec) as string;
    const prepared = prepareCase(c);
    const transcript: CallRecord[] = [];
    const startedAt = new Date(now()).toISOString();
    let quota: QuotaExhaustedError | null = null;
    const ctx: RecordingContext = { caseId: c.id, modelKey: spec.key, purpose: "generation", cache, throttle, retry, transcript, onEvent: options.onEvent };

    let outcome: Awaited<ReturnType<typeof runPreset>>;
    try {
      setModelFactory((cfg) => {
        const wrapped = recordingModel(options.baseFactory(cfg), ctx);
        const orig = wrapped.doGenerate.bind(wrapped);
        wrapped.doGenerate = async (o) => {
          try {
            return await orig(o);
          } catch (e) {
            // runPreset turns every error into { ok: false }; remember quota so it can stop the run.
            if (e instanceof QuotaExhaustedError) quota = e;
            throw e;
          }
        };
        return wrapped;
      });
      outcome = await runPreset(
        prepared.preset,
        { inputs: c.inputs, vault: prepared.vault, profile: prepared.profile, config: { provider: spec.provider, apiKey, model: spec.model } },
        "eval",
      );
    } finally {
      setModelFactory(null);
    }
    if (quota) throw quota;

    const base: RunOutcome = {
      caseId: c.id, engine: prepared.engine, tags: [...c.tags], modelKey: spec.key, startedAt,
      ok: false, passed: false, failures: [], calls: transcript, judgeCalls: [], units: [],
    };

    if (!outcome.ok) {
      return { outcome: { ...base, error: scrub(redactSecrets(outcome.message)).slice(0, 300) }, done: false };
    }

    const { data, meta } = outcome.result as { data: Record<string, unknown>; meta: RunMeta };
    let failures: string[];
    try {
      failures = c.expect(data, meta);
    } catch (err) {
      failures = [`expectation threw: ${scrub(redactSecrets((err as Error).message))}`];
    }

    // Citation units come from the raw final draft, before the finalizers scrub unknown ids.
    const validIds = new Set(prepared.vault.map((v) => v.id));
    const draft = finalDraftText(transcript);
    let units: CitationUnit[] = [];
    if (draft) {
      try {
        units = extractCitationUnits(extractJson(draft), validIds);
      } catch {
        units = [];
      }
    }

    const full: RunOutcome = { ...base, ok: true, passed: failures.length === 0, failures, meta, units };

    let done = true;
    if (judgeSpec) {
      const judgeKey = keyFor(judgeSpec) as string;
      const judgeCalls: CallRecord[] = [];
      const result = await runJudge({
        prepared, finalData: data, units,
        base: options.baseFactory({ provider: judgeSpec.provider, apiKey: judgeKey, model: judgeSpec.model }),
        ctx: { caseId: c.id, modelKey: judgeSpec.key, cache, throttle, retry, transcript: judgeCalls, onEvent: options.onEvent },
      });
      full.judgeCalls = judgeCalls;
      full.judge = result;
      // A failed judge is retried on the next run (generation calls come from the cache).
      if (!result.ok) done = false;
      for (const r of judgeCalls) if (r.modelVersion) judgeVersions.push(r.modelVersion);
    }
    return { outcome: full, done };
  }

  function scrub(text: string): string {
    let out = text;
    for (const s of secrets) out = out.split(s).join("[REDACTED]");
    return out;
  }

  function buildResult(): LlmRunResult {
    const summaries: Record<string, ModelSummary> = {};
    for (const m of modelInfos) {
      if (m.skipped) continue;
      const mine = outcomes.filter((o) => o.modelKey === m.key);
      const attempted = mine.filter((o) => !o.notRun);
      summaries[m.key] = modelSummary(attempted, priceFor);
      m.reportedModelVersions = uniq([...m.reportedModelVersions, ...attempted.flatMap((o) => o.calls.map((c) => c.modelVersion).filter((v): v is string => Boolean(v)))]).sort();
      const starts = attempted.map((o) => o.startedAt).filter((s): s is string => Boolean(s)).sort();
      m.firstCallAt = starts[0] ?? null;
    }
    const temps: Record<string, Set<number>> = {};
    for (const o of outcomes) {
      for (const c of o.calls) {
        if (c.temperature === null) continue;
        (temps[c.role] ??= new Set()).add(c.temperature);
      }
    }
    const observedTemperatures = Object.fromEntries(Object.entries(temps).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));

    const result: LlmRunResult = {
      generatedAt: new Date(now()).toISOString(),
      gitSha: options.gitSha ?? getGitSha(),
      command: options.command ?? "",
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      harnessVersion: HARNESS_VERSION,
      caseFingerprint: caseFingerprint(options.cases),
      caseCount: options.cases.length,
      rubricHash: rubricHash(loadRubric()),
      priceTableRetrieved: PRICE_TABLE_RETRIEVED,
      models: modelInfos,
      judge: judgeSpec
        ? { key: judgeSpec.key, provider: judgeSpec.provider, requestedModel: judgeSpec.model, reportedModelVersions: uniq(judgeVersions).sort(), freeTierKey: isFree(judgeSpec) }
        : null,
      ...(judgeNote ? { judgeNote } : {}),
      sampling: { observedTemperatures, judgeTemperature: 0, note: SAMPLING_NOTE },
      retrieval: RETRIEVAL_NOTE,
      complete: !options.caseSubset && !outcomes.some((o) => o.notRun) && !stoppedByQuota,
      caseSubset: Boolean(options.caseSubset),
      outcomes,
      summaries,
      estimate,
    };
    // Last line of defence: no key literal may appear anywhere in the serialised result.
    return JSON.parse(scrub(JSON.stringify(result))) as LlmRunResult;
  }
}

// ─── Arguments ───────────────────────────────────────────────────────────────

export interface EvalArgs {
  dry: boolean;
  estimate: boolean;
  listModels: boolean;
  probe: boolean;
  noDotenv: boolean;
  noJudge: boolean;
  /** Run the agent workflow cases (evals/agentCases.ts) instead of the Phase 3 cases. */
  agent: boolean;
  labelsSheet: boolean;
  agreement: boolean;
  cases: string[] | null;
  limit: number | null;
  models: ModelSpec[] | null;
  judge: ModelSpec | null;
  rpm: number | null;
  maxRequests: number;
  report: string | null;
}

export function parseArgs(argv: string[]): EvalArgs {
  const a: EvalArgs = {
    dry: false, estimate: false, listModels: false, probe: false, noDotenv: false, noJudge: false, agent: false,
    labelsSheet: false, agreement: false, cases: null, limit: null, models: null, judge: null, rpm: null, maxRequests: 300, report: null,
  };
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  const posInt = (v: string, flag: string): number => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${flag} needs a non-negative integer, got "${v}"`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    switch (f) {
      case "--dry": a.dry = true; break;
      case "--estimate": a.estimate = true; break;
      case "--list-models": a.listModels = true; break;
      case "--probe": a.probe = true; break;
      case "--no-dotenv": a.noDotenv = true; break;
      case "--no-judge": a.noJudge = true; break;
      case "--agent": a.agent = true; break;
      case "--labels-sheet": a.labelsSheet = true; break;
      case "--agreement": a.agreement = true; break;
      case "--cases": a.cases = value(i++, f).split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--limit": a.limit = posInt(value(i++, f), f); break;
      case "--models": a.models = parseModelList(value(i++, f)); break;
      case "--judge": a.judge = parseModelSpec(value(i++, f)); break;
      case "--rpm": a.rpm = posInt(value(i++, f), f); break;
      case "--max-requests": a.maxRequests = posInt(value(i++, f), f); break;
      case "--report": a.report = value(i++, f); break;
      default: throw new Error(`Unknown argument "${f}"`);
    }
  }
  return a;
}

// ─── Judge calibration: labelling sheet and agreement (no model calls) ──────

export interface LabelPaths {
  /** Saved run, input to both steps. */
  latest: string;
  /** Holds items.json, key.json, sheet.html, hand-labels.json and agreement.json. */
  dir: string;
  /** Where the re-rendered report goes when the saved run is complete. */
  report: string;
  rubric?: string;
}

export const DEFAULT_LABEL_PATHS: LabelPaths = {
  latest: path.join("evals", "results", "llm-latest.json"),
  dir: path.join("evals", "llm", "labels"),
  report: path.join("evals", "LLM.md"),
};

export type StepResult = { ok: true; message: string } | { ok: false; problems: string[] };

function readJson(file: string): { ok: true; value: unknown } | { ok: false; problem: string } {
  if (!fs.existsSync(file)) return { ok: false, problem: `${file} not found` };
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (err) {
    return { ok: false, problem: `${file} is not valid JSON: ${(err as Error).message}` };
  }
}

/** Reads the saved run, selects items without looking at judge scores, and writes items.json, key.json and sheet.html. */
export function writeLabelSheet(paths: LabelPaths = DEFAULT_LABEL_PATHS): StepResult {
  const latest = readJson(paths.latest);
  if (!latest.ok) return { ok: false, problems: [latest.problem, "Run `npm run eval` first."] };
  const result = latest.value as LlmRunResult;
  if (!result.complete) return { ok: false, problems: [`${paths.latest} is from a run that was not complete; finish the run before labelling.`] };
  const selected = selectLabelItems(result.outcomes);
  if (!selected.length) return { ok: false, problems: ["No judged outputs in the saved run to label."] };
  const { items, key } = buildLabelItems(selected);
  const rubricText = loadRubric(paths.rubric);
  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(path.join(paths.dir, "items.json"), JSON.stringify(items, null, 2));
  fs.writeFileSync(path.join(paths.dir, "key.json"), JSON.stringify(key, null, 2));
  const sheet = path.join(paths.dir, "sheet.html");
  fs.writeFileSync(sheet, renderLabelSheet(items, rubricText));
  return {
    ok: true,
    message: `${items.length} item(s) written. Open ${path.resolve(sheet)} in a browser, label every item, download hand-labels.json and save it to ${path.join(paths.dir, "hand-labels.json")}.`,
  };
}

/** Compares hand labels with the judge, writes agreement.json, attaches the result to the saved run and re-renders the report. */
export function applyAgreement(paths: LabelPaths = DEFAULT_LABEL_PATHS): StepResult {
  const latest = readJson(paths.latest);
  const items = readJson(path.join(paths.dir, "items.json"));
  const key = readJson(path.join(paths.dir, "key.json"));
  const hand = readJson(path.join(paths.dir, "hand-labels.json"));
  const missing = [latest, items, key, hand].flatMap((r) => (r.ok ? [] : [r.problem]));
  if (missing.length) return { ok: false, problems: [...missing, "Run `npm run eval -- --labels-sheet` and label the sheet first."] };

  const result = (latest as { value: LlmRunResult }).value;
  const itemList = (items as { value: LabelItem[] }).value;
  const keyMap = (key as { value: LabelKey }).value;
  const parsed = parseHandLabels((hand as { value: unknown }).value, itemList, rubricHash(loadRubric(paths.rubric)));
  if (!parsed.ok) return { ok: false, problems: parsed.problems };
  const labels = parsed.labels;
  if (result.rubricHash !== labels.rubricHash) {
    return { ok: false, problems: [`The saved run used rubric ${result.rubricHash} but the labels use ${labels.rubricHash}.`] };
  }

  const problems: string[] = [];
  const pairs: AgreementPair[] = [];
  const detail: Array<Record<string, unknown>> = [];
  for (const li of labels.items) {
    const k = keyMap[li.itemId];
    const outcome = k && result.outcomes.find((o) => o.caseId === k.caseId && o.modelKey === k.modelKey);
    if (!outcome || !outcome.judge || !outcome.judge.ok) {
      problems.push(`item ${li.itemId}: no judged outcome in the saved run`);
      continue;
    }
    const j = outcome.judge;
    const human: Rating = {
      scores: { groundedness: li.groundedness, task_fit: li.task_fit, clarity: li.clarity },
      fabricationPresent: li.fabricationPresent,
      citations: Object.fromEntries(li.citations.map((c) => [c.index, c.verdict])),
    };
    const judge: Rating = { scores: j.scores, fabricationPresent: j.claims.some((c) => c.status === "unsupported"), citations: j.citationVerdicts };
    pairs.push({ itemId: li.itemId, human, judge });
    detail.push({ itemId: li.itemId, caseId: k.caseId, modelKey: k.modelKey, human, judge, notes: li.notes });
  }
  if (problems.length) return { ok: false, problems };

  const summary = computeAgreement(pairs);
  const block: AgreementBlock = { labeller: labels.labeller, labelledAt: labels.labelledAt, rubricHash: labels.rubricHash, items: pairs.length, summary };
  fs.writeFileSync(path.join(paths.dir, "agreement.json"), JSON.stringify({ ...block, pairs: detail }, null, 2));
  result.agreement = block;
  fs.writeFileSync(paths.latest, JSON.stringify(result, null, 2));
  const target = result.complete && !result.caseSubset ? paths.report : path.join(path.dirname(paths.latest), "LLM.preview.md");
  fs.writeFileSync(target, renderLlmReport(result));
  return { ok: true, message: `Agreement computed over ${pairs.length} item(s); report written to ${target}.` };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

export function selectCases(args: EvalArgs): EvalCase[] {
  let cases = CASES;
  if (args.cases) {
    const unknown = args.cases.filter((id) => !CASES.some((c) => c.id === id));
    if (unknown.length) throw new Error(`Unknown case id(s): ${unknown.join(", ")}`);
    cases = CASES.filter((c) => args.cases!.includes(c.id));
  }
  if (args.limit !== null) cases = cases.slice(0, args.limit);
  return cases;
}

function pickJudge(args: EvalArgs, models: ModelSpec[], env: Env): ModelSpec | null {
  if (args.noJudge) return null;
  if (args.judge) return args.judge;
  if (env.EVAL_JUDGE) return parseModelSpec(env.EVAL_JUDGE);
  return models[0] ?? null;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  let args: EvalArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 2;
    return;
  }
  if (args.labelsSheet || args.agreement) {
    // Offline steps over saved files: no .env, no keys, no model is ever constructed.
    const step = args.labelsSheet ? writeLabelSheet() : applyAgreement();
    if (step.ok) console.log(step.message);
    else {
      for (const p of step.problems) console.error(p);
      process.exitCode = 2;
    }
    return;
  }
  if (!args.noDotenv) {
    const names = loadDotEnv(".env");
    if (names.length) console.log(`Loaded ${names.length} variable(s) from .env`);
  }
  if (args.agent) {
    await mainAgent(args, argv);
    return;
  }
  const env = process.env;
  const cases = selectCases(args);
  const models = args.models ?? defaultModelSpecs(env);
  const judge = pickJudge(args, models, env);
  const cacheDir = path.join("evals", "results", "llm-cache");
  const cache = createDiskCache(cacheDir);
  const fingerprint = caseFingerprint(cases);

  if (args.dry) {
    for (const c of cases) {
      const p = prepareCase(c);
      console.log(`${c.id.padEnd(32)} ${c.presetId.padEnd(26)} ${p.engine.padEnd(9)} [${c.tags.join(",")}] ${c.description}`);
    }
    console.log(`\n${cases.length} case(s). Case fingerprint: ${fingerprint}`);
    console.log(models.length ? formatEstimate(estimateRequests({ cases, models, judge, cache })) : "no models selected");
    return;
  }

  if (args.estimate) {
    if (!models.length) {
      console.log("no models selected (pass --models provider:model[,provider:model])");
      return;
    }
    console.log(formatEstimate(estimateRequests({ cases, models, judge, cache })));
    return;
  }

  if (args.listModels) {
    for (const provider of uniq(models.map((m) => m.provider).concat(env.FREE_TIER_PROVIDER ? [env.FREE_TIER_PROVIDER as ModelSpec["provider"]] : []))) {
      const key = resolveKey(provider, env);
      if (!key) {
        console.log(`${provider}: no key`);
        continue;
      }
      if (provider === "google") {
        try {
          console.log(`${provider}:\n${(await listGoogleModels(key)).join("\n")}`);
        } catch (err) {
          console.error(redactSecrets((err as Error).message).split(key).join("[REDACTED]"));
          process.exitCode = 1;
        }
      } else console.log(`listing not implemented for ${provider}`);
    }
    return;
  }

  if (!models.length) {
    console.error("pass --models provider:model[,provider:model] (see --list-models)");
    process.exitCode = 2;
    return;
  }
  const keyless = uniq(models.filter((m) => !resolveKey(m.provider, env)).map((m) => m.provider));
  if (keyless.length && models.every((m) => !resolveKey(m.provider, env))) {
    console.error(`No API key for provider ${keyless.join(", ")}. Set EVAL_${keyless[0].toUpperCase()}_API_KEY (or EVAL_API_KEY / FREE_TIER_API_KEY).`);
    process.exitCode = 2;
    return;
  }

  const rpm = args.rpm ?? (Number(env.EVAL_RPM) > 0 ? Number(env.EVAL_RPM) : 5);
  console.log(describeConfig(judge && !models.some((m) => m.key === judge.key) ? [...models, judge] : models, env));
  const estimate = estimateRequests({ cases, models, judge, cache });
  console.log(formatEstimate(estimate));
  if (args.probe) {
    const throttle = createThrottle({ rpm });
    const results = await probeModels(judge ? [...models, judge] : models, {
      baseFactory: createModel, keyFor: (s) => resolveKey(s.provider, env), cache, throttle,
      retry: { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30000 },
    });
    for (const r of results) console.log(`${r.spec.key}: ${r.ok ? `ok (reported ${r.modelVersion ?? "unknown"})` : `skipped (${r.skipped})`}`);
    return;
  }
  if (estimate.upper > args.maxRequests) {
    console.error(`Estimated up to ${estimate.upper} requests exceeds --max-requests ${args.maxRequests}. Narrow the run (--cases, --limit, fewer models) or raise the limit.`);
    process.exitCode = 2;
    return;
  }

  let result: LlmRunResult;
  try {
    result = await runEval({
      cases, models, judge, baseFactory: createModel, cacheDir, rpm, env,
      command: argv.join(" "), caseSubset: args.cases !== null || args.limit !== null,
      log: (l) => console.log(l),
      onEvent: (e) => console.log(`${e.type} ${e.modelKey}${e.ms ? ` ${e.ms} ms` : ""}${e.status ? ` (HTTP ${e.status})` : ""}`),
    });
  } catch (err) {
    const message = (err as Error).message;
    console.error(redactSecrets(message));
    process.exitCode = /no model with a key|no usable model/.test(message) ? 2 : 1;
    return;
  }

  const dir = path.join("evals", "results");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  const json = JSON.stringify(result, null, 2);
  fs.writeFileSync(path.join(dir, `llm-${stamp}.json`), json);
  fs.writeFileSync(path.join(dir, "llm-latest.json"), json);
  const md = renderLlmReport(result);
  if (result.complete && !result.caseSubset) {
    const target = args.report ?? path.join("evals", "LLM.md");
    fs.writeFileSync(target, md);
    console.log(`Report written to ${target}`);
  } else {
    const target = path.join(dir, "LLM.preview.md");
    fs.writeFileSync(target, md);
    console.log(`Partial run (${result.caseSubset ? "case subset" : "not every case was attempted"}); preview written to ${target}, evals/LLM.md untouched.`);
  }
  if (result.outcomes.some((o) => o.notRun === "quota")) {
    console.error("Daily quota exhausted. Finished cases are cached; re-run after the quota resets to resume.");
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(redactSecrets(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  });
}
