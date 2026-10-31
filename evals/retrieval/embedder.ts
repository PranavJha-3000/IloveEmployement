// Node embedder for the retrieval eval. Loads @huggingface/transformers lazily
// (dynamic import) and caches chunk vectors on disk under the gitignored
// evals/results/. The model download is the only network call in the phase.

import fs from "node:fs";
import path from "node:path";
import type { VaultChunk } from "../../lib/engine/types";
import { contentHash } from "../../lib/retrieval/fusion";
import { EMBEDDING_DTYPE, EMBEDDING_MODEL, embeddingQuery, embeddingText } from "../../lib/retrieval/embedText";

export interface NodeEmbedder {
  model: string;
  dtype: string;
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

  const run = async (texts: string[]) => (await extractor(texts, { pooling: "mean", normalize: true })).tolist();
  const cacheFile = path.join(vecDir, `${EMBEDDING_MODEL.replace(/\W/g, "_")}-${EMBEDDING_DTYPE}.json`);

  return {
    model: EMBEDDING_MODEL,
    dtype: EMBEDDING_DTYPE,
    async embedChunks(chunks) {
      let cache: Record<string, number[]> = {};
      if (fs.existsSync(cacheFile)) {
        try {
          cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        } catch {
          cache = {};
        }
      }
      const keyOf = (c: VaultChunk) => contentHash(embeddingText(c));
      const misses = chunks.filter((c) => !cache[keyOf(c)]);
      for (let i = 0; i < misses.length; i += 16) {
        const batch = misses.slice(i, i + 16);
        const vecs = await run(batch.map(embeddingText));
        batch.forEach((c, j) => {
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
      return v;
    },
  };
}
