// ─── Disk cache for model calls ──────────────────────────────────────────────
// dir/<harnessVersion>/<caseId>/<modelKeySafe>/<hash>.json. Entries hold only
// text, tool calls, usage and metadata: never headers, raw responses or keys.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const HARNESS_VERSION = "llm-eval-1";

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]));
  }
  return v;
}

export function requestHash(parts: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(parts)) ?? "null").digest("hex");
}

export interface CacheEntry {
  harnessVersion: string;
  caseId: string;
  modelKey: string;
  hash: string;
  createdAt: number;
  latencyMs: number;
  response: {
    text?: string;
    toolCalls?: unknown[];
    finishReason: string;
    usage: { promptTokens: number | null; completionTokens: number | null };
    thoughtsTokens: number | null;
    modelVersion: string | null;
  };
}

export interface DiskCache {
  get(caseId: string, modelKey: string, hash: string): CacheEntry | null;
  set(entry: CacheEntry): void;
  has(caseId: string, modelKey: string, hash: string): boolean;
  caseDone(caseId: string, modelKey: string): boolean;
  markCaseDone(caseId: string, modelKey: string, record: unknown): void;
  readCaseRecord(caseId: string, modelKey: string): unknown | null;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

function writeAtomic(file: string, data: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export function createDiskCache(rootDir: string): DiskCache {
  const dirFor = (caseId: string, modelKey: string) => path.join(rootDir, HARNESS_VERSION, safe(caseId), safe(modelKey));
  const readJson = (file: string): unknown | null => {
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      console.warn(`cache: ignoring unreadable entry ${path.basename(file)}`);
      return null;
    }
  };
  const get: DiskCache["get"] = (caseId, modelKey, hash) => {
    const e = readJson(path.join(dirFor(caseId, modelKey), `${safe(hash)}.json`)) as CacheEntry | null;
    if (!e || typeof e !== "object" || e.harnessVersion !== HARNESS_VERSION || e.hash !== hash || !e.response) return null;
    return e;
  };
  return {
    get,
    has: (c, m, h) => get(c, m, h) !== null,
    set(entry) {
      const { harnessVersion, caseId, modelKey, hash, createdAt, latencyMs, response } = entry;
      // Rebuild from an allowlist so stray fields (headers, raw bodies) can never persist.
      const clean: CacheEntry = {
        harnessVersion, caseId, modelKey, hash, createdAt, latencyMs,
        response: {
          text: response.text,
          toolCalls: response.toolCalls,
          finishReason: response.finishReason,
          usage: { promptTokens: response.usage.promptTokens, completionTokens: response.usage.completionTokens },
          thoughtsTokens: response.thoughtsTokens,
          modelVersion: response.modelVersion,
        },
      };
      writeAtomic(path.join(dirFor(caseId, modelKey), `${safe(hash)}.json`), JSON.stringify(clean));
    },
    caseDone: (c, m) => readJson(path.join(dirFor(c, m), "case.json")) !== null,
    markCaseDone: (c, m, record) => writeAtomic(path.join(dirFor(c, m), "case.json"), JSON.stringify(record)),
    readCaseRecord: (c, m) => readJson(path.join(dirFor(c, m), "case.json")),
  };
}
