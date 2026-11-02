// Node embedder for the retrieval eval. Loads @huggingface/transformers lazily
// (dynamic import) and caches chunk vectors on disk under the gitignored
// evals/results/. The model download is the only network call in the phase.
//
// Cache key: the file name binds model id, dtype, pooling, normalize, the
// transformers version and EMBEDDING_CACHE_VERSION (hashed config); entries are
// keyed by sha256 of the exact embedding text. Cached vectors of the wrong
// length or with non-finite values are discarded and recomputed.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VaultChunk } from "../../lib/engine/types";
import { EMBEDDING_DTYPE, EMBEDDING_MODEL, embeddingQuery, embeddingText } from "../../lib/retrieval/embedText";

/** Output size of all-MiniLM-L6-v2. */
export const EMBEDDING_DIM = 384;
/** Bump to invalidate every existing cache file. */
export const EMBEDDING_CACHE_VERSION = 2;

/** Single source for the extractor options and the cache config. */
const POOLING_OPTS = { pooling: "mean" as const, normalize: true };

export interface EmbeddingCacheConfig {
  model: string;
  dtype: string;
  pooling: "mean";
  normalize: boolean;
  transformersVersion: string;
  cacheVersion: number;
}

export function embeddingEntryKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function embeddingCacheFile(dir: string, cfg: EmbeddingCacheConfig): string {
  const ordered = JSON.stringify({
    model: cfg.model,
    dtype: cfg.dtype,
    pooling: cfg.pooling,
    normalize: cfg.normalize,
    transformersVersion: cfg.transformersVersion,
    cacheVersion: cfg.cacheVersion,
  });
  const digest = createHash("sha256").update(ordered).digest("hex").slice(0, 16);
  return path.join(dir, `${cfg.model.replace(/\W/g, "_")}-${cfg.dtype}-${digest}.json`);
}

export function isValidVector(v: unknown, dim: number): v is number[] {
  return Array.isArray(v) && v.length === dim && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

export function sanitizeCache(raw: unknown, dim: number): Record<string, number[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidVector(v, dim)) out[k] = v;
  }
  return out;
}

export interface NodeEmbedder {
  model: string;
  dtype: string;
  cacheConfig: EmbeddingCacheConfig;
  embedChunks(chunks: VaultChunk[]): Promise<{ id: string; vector: number[] }[]>;
  embedQuery(query: string): Promise<number[]>;
}

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

export async function createNodeEmbedder(opts: { cacheDir?: string; onProgress?: (msg: string) => void } = {}): Promise<NodeEmbedder> {
  const resultsDir = path.join(process.cwd(), "evals", "results");
  const hfCache = opts.cacheDir ?? path.join(resultsDir, "hf-cache");
  const vecDir = path.join(resultsDir, "embeddings-cache");
  const log = opts.onProgress ?? (() => {});

  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.cacheDir = hfCache;
  log(`Loading ${EMBEDDING_MODEL} (${EMBEDDING_DTYPE})`);
  const extractor = (await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: EMBEDDING_DTYPE })) as unknown as Extractor;

  const run = async (texts: string[]) => (await extractor(texts, POOLING_OPTS)).tolist();
  const cacheConfig: EmbeddingCacheConfig = {
    model: EMBEDDING_MODEL,
    dtype: EMBEDDING_DTYPE,
    pooling: POOLING_OPTS.pooling,
    normalize: POOLING_OPTS.normalize,
    transformersVersion: typeof env.version === "string" ? env.version : "unknown",
    cacheVersion: EMBEDDING_CACHE_VERSION,
  };
  const cacheFile = embeddingCacheFile(vecDir, cacheConfig);

  return {
    model: EMBEDDING_MODEL,
    dtype: EMBEDDING_DTYPE,
    cacheConfig,
    async embedChunks(chunks) {
      let cache: Record<string, number[]> = {};
      if (fs.existsSync(cacheFile)) {
        try {
          cache = sanitizeCache(JSON.parse(fs.readFileSync(cacheFile, "utf8")), EMBEDDING_DIM);
        } catch {
          cache = {};
        }
      }
      const keyOf = (c: VaultChunk) => embeddingEntryKey(embeddingText(c));
      const misses = chunks.filter((c) => !cache[keyOf(c)]);
      for (let i = 0; i < misses.length; i += 16) {
        const batch = misses.slice(i, i + 16);
        const vecs = await run(batch.map(embeddingText));
        batch.forEach((c, j) => {
          if (!isValidVector(vecs[j], EMBEDDING_DIM)) {
            const bad: unknown = vecs[j];
            const len = Array.isArray(bad) ? bad.length : typeof bad;
            throw new Error(`Invalid embedding for chunk ${c.id}: expected ${EMBEDDING_DIM} finite numbers, got length ${len}`);
          }
          cache[keyOf(c)] = vecs[j];
        });
        log(`Embedded ${Math.min(i + batch.length, misses.length)}/${misses.length} chunks`);
      }
      if (misses.length) {
        fs.mkdirSync(vecDir, { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify(cache));
      }
      return chunks.map((c) => ({ id: c.id, vector: cache[keyOf(c)] }));
    },
    async embedQuery(query) {
      const [v] = await run([embeddingQuery(query)]);
      if (!isValidVector(v, EMBEDDING_DIM)) throw new Error(`Invalid query embedding: expected ${EMBEDDING_DIM} finite numbers`);
      return v;
    },
  };
}
