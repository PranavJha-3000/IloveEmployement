// ─── Retrieval strategy registry ─────────────────────────────────────────────
// Each strategy calls the same code the app does. Phase 2 registers
// "hybrid+rerank" by appending one object to STRATEGIES (use `prepare` to load
// a reranker model once, outside timed calls). This file must not import the
// embedder or the transformers package.

import type { VaultChunk, VaultContextChunk } from "../../lib/engine/types";
import { semanticRanking } from "../../lib/retrieval/fusion";
import { retrieveVault, selectWithAnchor } from "../../lib/vault/retrieve";

export interface EmbeddingInput {
  queryVector: number[];
  chunkVectors: { id: string; vector: number[] }[];
}

export interface StrategyInput {
  chunks: VaultChunk[];
  query: string;
  limit: number;
  embeddings?: EmbeddingInput;
}

export interface RetrievalStrategy {
  id: string;
  label: string;
  needsEmbeddings: boolean;
  prepare?: () => Promise<void>;
  retrieve(input: StrategyInput): VaultContextChunk[] | Promise<VaultContextChunk[]>;
}

function requireEmbeddings(id: string, input: StrategyInput): EmbeddingInput {
  if (!input.embeddings) throw new Error(`Strategy "${id}" needs embeddings but none were provided`);
  return input.embeddings;
}

export const STRATEGIES: RetrievalStrategy[] = [
  {
    id: "keyword",
    label: "Keyword (BM25)",
    needsEmbeddings: false,
    retrieve: ({ chunks, query, limit }) => retrieveVault(chunks, query, limit),
  },
  {
    id: "embeddings",
    label: "Embeddings only (cosine)",
    needsEmbeddings: true,
    retrieve: (input) => {
      const { queryVector, chunkVectors } = requireEmbeddings("embeddings", input);
      const summary = input.chunks.find((c) => c.kind === "summary");
      const pool = input.chunks.filter((c) => c !== summary);
      const byId = new Map(pool.map((c) => [c.id, c]));
      const ordered = semanticRanking(queryVector, chunkVectors)
        .filter((id) => byId.has(id))
        .map((id) => byId.get(id)!);
      return selectWithAnchor(summary, ordered, input.limit);
    },
  },
  {
    id: "hybrid",
    label: "Hybrid (BM25 + cosine, RRF k=60)",
    needsEmbeddings: true,
    retrieve: (input) => {
      const { queryVector, chunkVectors } = requireEmbeddings("hybrid", input);
      return retrieveVault(input.chunks, input.query, input.limit, semanticRanking(queryVector, chunkVectors));
    },
  },
];
