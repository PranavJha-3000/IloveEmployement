"use client";

// ─── In-browser embeddings ───────────────────────────────────────────────────
// all-MiniLM-L6-v2 (quantised, ~23 MB) runs in the browser via Transformers.js.
// The model is downloaded once and cached by the browser; vault text never
// leaves the device to be embedded. Loading is lazy, so pages that don't use
// semantic search never pay for it.

import type { VaultChunk } from "../engine/types";
import { contentHash } from "../retrieval/fusion";
import { loadVectors, saveVectors, type StoredVector } from "./store";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;

/** Loads the model once per page; progress reports download percentage (0–100). */
export function loadEmbedder(onProgress?: (pct: number) => void): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, {
        dtype: "q8",
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === "progress" && typeof p.progress === "number") onProgress?.(Math.round(p.progress));
        },
      });
      return extractor as unknown as Extractor;
    })().catch((err) => {
      extractorPromise = null;
      throw err;
    });
  }
  return extractorPromise;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await loadEmbedder();
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  return out.tolist();
}

const chunkText = (c: Pick<VaultChunk, "title" | "text">) => `${c.title}: ${c.text}`;

/** Which chunks have a current embedding. */
export async function indexStatus(chunks: VaultChunk[]): Promise<{ indexed: number; total: number; vectors: StoredVector[] }> {
  const vectors = await loadVectors();
  const byId = new Map(vectors.map((v) => [v.id, v]));
  const current = chunks.filter((c) => byId.get(c.id)?.hash === contentHash(chunkText(c)));
  return { indexed: current.length, total: chunks.length, vectors: current.map((c) => byId.get(c.id)!) };
}

/** Embeds every chunk that is missing or stale, in small batches. */
export async function buildIndex(chunks: VaultChunk[], onProgress: (done: number, total: number) => void): Promise<void> {
  const existing = new Map((await loadVectors()).map((v) => [v.id, v]));
  const todo = chunks.filter((c) => existing.get(c.id)?.hash !== contentHash(chunkText(c)));
  onProgress(0, todo.length);
  for (let i = 0; i < todo.length; i += 16) {
    const batch = todo.slice(i, i + 16);
    const vecs = await embedTexts(batch.map(chunkText));
    await saveVectors(batch.map((c, j) => ({ id: c.id, hash: contentHash(chunkText(c)), vector: vecs[j] })));
    onProgress(Math.min(i + batch.length, todo.length), todo.length);
  }
}
