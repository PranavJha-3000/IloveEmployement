// LLM-refined profile extraction measurement over the gold dataset. Runs the
// hidden profile-extract preset exactly as the app does, through the Phase 3
// disk cache, throttle, retry and recording wrapper. Case ids are
// profile-extract--<resumeId> so they can never collide with a Phase 3 case.
// Nothing here is run against a real model by the test suite or CI.
import path from "node:path";
import type { LanguageModelV1 } from "ai";
import { createDiskCache } from "../llm/cache";
import { defaultModelSpecs, loadDotEnv, parseModelList, resolveKey, type ModelSpec } from "../llm/env";
import { recordingModel, type CallRecord, type RecordingContext } from "../llm/recordingModel";
import { QuotaExhaustedError, createThrottle, type RetryOptions } from "../llm/throttle";
import { createModel } from "../../lib/ai";
import { runPreset, setModelFactory } from "../../lib/engine/run";
import type { RunMeta } from "../../lib/engine/types";
import { getPresetById } from "../../lib/presets";
import { extractProfile } from "../../lib/profile/extract";
import { mergeExtractions } from "../../lib/profile/refine";
import type { ExtractionResult } from "../../lib/profile/schema";
import type { AiRequestConfig } from "../../lib/types";
import { loadProfileDataset } from "./dataset/load";
import type { GoldResume } from "./dataset/types";
import { aggregateCounts, scoreProfile, type FieldCounts } from "./metrics";
import type { LlmProfileModelResult, LlmProfileSection } from "./report";

export type { LlmProfileSection } from "./report";

type Env = Record<string, string | undefined>;

/** Max characters sent for refinement; mirrors the preset's maxLength and lib/profile/client REFINE_MAX_CHARS. */
const SEND_MAX_CHARS = 11000;

export const profileCaseId = (resumeId: string): string => `profile-extract--${resumeId}`;

export interface RunProfileLlmOptions {
  dataset: GoldResume[];
  models: ModelSpec[];
  baseFactory: (c: AiRequestConfig) => LanguageModelV1;
  cacheDir: string;
  rpm: number;
  env?: Env;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  retry?: Partial<RetryOptions>;
  log?: (line: string) => void;
}

/** Stored per resume and model. Counts, usage and status only: never resume text or keys. */
interface StoredRecord {
  status: "ok";
  refined: FieldCounts;
  llmOnly: FieldCounts;
  usage: { promptTokens: number; completionTokens: number };
}

const isStored = (v: unknown): v is StoredRecord =>
  !!v && typeof v === "object" && (v as StoredRecord).status === "ok" && !!(v as StoredRecord).refined && !!(v as StoredRecord).llmOnly;

export async function runProfileLlm(opts: RunProfileLlmOptions): Promise<LlmProfileSection> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? (() => {});
  const cache = createDiskCache(opts.cacheDir);
  const throttle = createThrottle({ rpm: opts.rpm, now, sleep: opts.sleep });
  const retry: RetryOptions = { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 60000, sleep: opts.sleep, now, ...opts.retry };
  const preset = getPresetById("profile-extract");
  if (!preset) throw new Error("profile-extract preset is missing");

  const models: LlmProfileModelResult[] = [];

  for (const spec of opts.models) {
    const apiKey = resolveKey(spec.provider, env);
    if (!apiKey) {
      log(`skipped ${spec.key}: no key for ${spec.provider}`);
      continue;
    }
    const refinedList: FieldCounts[] = [];
    const llmOnlyList: FieldCounts[] = [];
    const usage = { promptTokens: 0, completionTokens: 0 };
    let done = 0;
    let stoppedByQuota = false;

    for (const item of opts.dataset) {
      if (stoppedByQuota) break;
      const caseId = profileCaseId(item.id);
      const stored = cache.readCaseRecord(caseId, spec.key);
      if (isStored(stored) && cache.caseDone(caseId, spec.key)) {
        refinedList.push(stored.refined);
        llmOnlyList.push(stored.llmOnly);
        usage.promptTokens += stored.usage.promptTokens;
        usage.completionTokens += stored.usage.completionTokens;
        done += 1;
        log(`cached ${spec.key} ${caseId}`);
        continue;
      }

      const text = item.text.slice(0, SEND_MAX_CHARS);
      const transcript: CallRecord[] = [];
      const ctx: RecordingContext = { caseId, modelKey: spec.key, purpose: "generation", cache, throttle, retry, transcript };
      let quota: QuotaExhaustedError | null = null;
      let outcome: Awaited<ReturnType<typeof runPreset>>;
      try {
        setModelFactory((cfg) => {
          const wrapped = recordingModel(opts.baseFactory(cfg), ctx);
          const orig = wrapped.doGenerate.bind(wrapped);
          wrapped.doGenerate = async (o) => {
            try {
              return await orig(o);
            } catch (e) {
              // runPreset turns every error into { ok: false }; remember quota so the run can stop.
              if (e instanceof QuotaExhaustedError) quota = e;
              throw e;
            }
          };
          return wrapped;
        });
        outcome = await runPreset(preset, { inputs: { resumeText: text }, config: { provider: spec.provider, apiKey, model: spec.model } }, "eval");
      } finally {
        setModelFactory(null);
      }
      if (quota) {
        stoppedByQuota = true;
        log(`quota exhausted on ${spec.key}; stopping. Re-run to resume from the cache.`);
        break;
      }
      if (!outcome.ok) {
        log(`error ${spec.key} ${caseId}: ${outcome.message.slice(0, 120)}`);
        continue;
      }

      const { data, meta } = outcome.result as { data: ExtractionResult; meta: RunMeta };
      const det = extractProfile(item.text);
      const llmOnly = scoreProfile(data.profile, item.gold);
      const refined = scoreProfile(mergeExtractions(det, data, item.text).profile, item.gold);
      const used = { promptTokens: meta.usage?.promptTokens ?? 0, completionTokens: meta.usage?.completionTokens ?? 0 };
      const record: StoredRecord = { status: "ok", refined, llmOnly, usage: used };
      cache.markCaseDone(caseId, spec.key, record);
      refinedList.push(refined);
      llmOnlyList.push(llmOnly);
      usage.promptTokens += used.promptTokens;
      usage.completionTokens += used.completionTokens;
      done += 1;
      log(`ok ${spec.key} ${caseId}`);
    }

    models.push({
      key: spec.key,
      refined: aggregateCounts(refinedList),
      llmOnly: aggregateCounts(llmOnlyList),
      resumesDone: done,
      resumesTotal: opts.dataset.length,
      stoppedByQuota,
      usage,
    });
  }

  const complete = models.length > 0 && models.every((m) => m.resumesDone === m.resumesTotal);
  return { status: complete ? "measured" : "partial", models };
}

// ─── Command wrapper for `npm run eval:profile -- --llm` ─────────────────────

const DEFAULT_RPM = 5; // the Phase 3 default

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

export interface LlmCommandDeps {
  baseFactory?: (c: AiRequestConfig) => LanguageModelV1;
  env?: Env;
  cacheDir?: string;
  dataset?: GoldResume[];
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

/**
 * Human-run entry. Prints the request estimate and refuses to spend a single
 * request without --yes. Never invoked by CI; tests pass a scripted factory.
 */
export async function runLlmCommand(argv: string[], deps: LlmCommandDeps = {}): Promise<{ code: number; section?: LlmProfileSection }> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const env = deps.env ?? process.env;
  if (!argv.includes("--no-dotenv") && !deps.env) {
    const names = loadDotEnv(".env");
    if (names.length) log(`Loaded ${names.length} variable(s) from .env`);
  }
  let models: ModelSpec[];
  try {
    const csv = flagValue(argv, "--models");
    models = csv ? parseModelList(csv) : defaultModelSpecs(env);
  } catch (err) {
    console.error((err as Error).message);
    return { code: 2 };
  }
  if (!models.length) {
    console.error("pass --models provider:model[,provider:model] (or set EVAL_MODELS / FREE_TIER_*)");
    return { code: 2 };
  }
  const usable = models.filter((m) => resolveKey(m.provider, env));
  if (!usable.length) {
    console.error(`No API key for ${models.map((m) => m.provider).join(", ")}. Set EVAL_<PROVIDER>_API_KEY (or EVAL_API_KEY / FREE_TIER_API_KEY).`);
    return { code: 2 };
  }
  const dataset = deps.dataset ?? loadProfileDataset();
  const cacheDir = deps.cacheDir ?? path.join("evals", "results", "llm-cache");
  const cache = createDiskCache(cacheDir);
  const uncached = usable.reduce((n, m) => n + dataset.filter((d) => !cache.caseDone(profileCaseId(d.id), m.key)).length, 0);
  log(usable.map((m) => `${m.key} (key: set)`).join(", "));
  log(`Requests: ${dataset.length} resumes x ${usable.length} model(s); ${uncached} not cached (about ${uncached} request(s), more if a call is retried).`);
  if (uncached > 0 && !argv.includes("--yes")) {
    console.error("This would spend model requests (shared free-tier quota). Re-run with --yes to proceed.");
    return { code: 2 };
  }
  const rpmArg = Number(flagValue(argv, "--rpm"));
  const rpm = rpmArg > 0 ? rpmArg : Number(env.EVAL_RPM) > 0 ? Number(env.EVAL_RPM) : DEFAULT_RPM;
  const section = await runProfileLlm({
    dataset,
    models: usable,
    baseFactory: deps.baseFactory ?? createModel,
    cacheDir,
    rpm,
    env,
    sleep: deps.sleep,
    log,
  });
  const quota = section.models.some((m) => m.stoppedByQuota);
  if (quota) console.error("Daily quota exhausted. Finished resumes are cached; re-run after the quota resets to resume.");
  return { code: quota ? 2 : 0, section };
}
