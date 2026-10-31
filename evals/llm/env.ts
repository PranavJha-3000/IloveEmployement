// ─── Env and key resolution ──────────────────────────────────────────────────
// Keys live only in memory. Nothing here prints a value; describeConfig reports
// "key: set" / "key: missing" only.

import fs from "node:fs";
import { PROVIDERS } from "../../lib/providers";
import type { ProviderId } from "../../lib/types";

export type ModelSpec = { provider: ProviderId; model: string; key: string };
type Env = Record<string, string | undefined>;

export function parseModelSpec(spec: string): ModelSpec {
  const s = spec.trim();
  const i = s.indexOf(":");
  if (i <= 0 || i === s.length - 1) throw new Error(`Invalid model spec "${s}": expected "provider:model" (for example google:gemini-2.5-flash)`);
  const provider = s.slice(0, i);
  const model = s.slice(i + 1);
  if (!(provider in PROVIDERS)) throw new Error(`Unknown provider "${provider}" in model spec; expected one of ${Object.keys(PROVIDERS).join(", ")}`);
  return { provider: provider as ProviderId, model, key: `${provider}:${model}` };
}

export function parseModelList(csv: string): ModelSpec[] {
  return csv.split(",").map((s) => s.trim()).filter(Boolean).map(parseModelSpec);
}

/** EVAL_<PROVIDER>_API_KEY, then EVAL_API_KEY (provider matches EVAL_PROVIDER or it is unset), then FREE_TIER_API_KEY. */
export function resolveKey(provider: ProviderId, env: Env = process.env): string | null {
  const specific = env[`EVAL_${provider.toUpperCase()}_API_KEY`];
  if (specific) return specific;
  if (env.EVAL_API_KEY && (!env.EVAL_PROVIDER || env.EVAL_PROVIDER === provider)) return env.EVAL_API_KEY;
  if (env.FREE_TIER_API_KEY && env.FREE_TIER_PROVIDER === provider) return env.FREE_TIER_API_KEY;
  return null;
}

export function defaultModelSpecs(env: Env = process.env): ModelSpec[] {
  if (env.EVAL_MODELS) return parseModelList(env.EVAL_MODELS);
  if (env.EVAL_MODEL) {
    const m = env.EVAL_MODEL;
    if (m.includes(":") && m.split(":")[0] in PROVIDERS) return [parseModelSpec(m)];
    const provider = (env.EVAL_PROVIDER || env.FREE_TIER_PROVIDER) as ProviderId | undefined;
    if (provider && provider in PROVIDERS) return [{ provider, model: m, key: `${provider}:${m}` }];
    return [];
  }
  const provider = env.FREE_TIER_PROVIDER as ProviderId | undefined;
  if (provider && provider in PROVIDERS && env.FREE_TIER_MODEL) return [{ provider, model: env.FREE_TIER_MODEL, key: `${provider}:${env.FREE_TIER_MODEL}` }];
  return [];
}

export function describeConfig(specs: ModelSpec[], env: Env = process.env): string {
  if (!specs.length) return "no models configured";
  return specs.map((s) => `${s.key} (key: ${resolveKey(s.provider, env) ? "set" : "missing"})`).join("\n");
}

function unquote(v: string): string {
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) return v.slice(1, -1);
  return v;
}

/** Loads KEY=VALUE lines into env without overriding existing keys. Returns the key names it set. */
export function loadDotEnv(path = ".env", env: Env = process.env): string[] {
  if (!fs.existsSync(path)) return [];
  const set: string[] = [];
  for (const raw of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const name = m[1];
    if (env[name] !== undefined && env[name] !== "") continue;
    const value = unquote(m[2].trim());
    if (value === "") continue;
    env[name] = value;
    set.push(name);
  }
  return set;
}
