// ─── Retrieval strategy registry ─────────────────────────────────────────────
// Each strategy calls the same code the app does. Phase 2 registers the rerank
// strategies in plan 02-05 via createRerankStrategy with a Node scorer loaded in
// prepare() (outside timed calls). This file must not statically import the
// embedder, a reranker loader or transformers.

import type { VaultChunk, VaultContextChunk } from "../../lib/engine/types";
import { semanticRanking } from "../../lib/retrieval/fusion";
import { rerankCandidates, type PairScorer } from "../../lib/retrieval/rerank";
import { RERANK_CANDIDATES, SENSITIVITY_STRATEGIES } from "./decision";
import { WHOLE_RESUME_LIMIT, rankBySemantic, rankVault, retrieveVault, selectWithAnchor } from "../../lib/vault/retrieve";

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
  /** Rerank strategies only: how many base candidates the cross-encoder reorders. */
  topN?: number;
  prepare?: () => Promise<void>;
  retrieve(input: StrategyInput): VaultContextChunk[] | Promise<VaultContextChunk[]>;
}

function requireEmbeddings(id: string, input: StrategyInput): EmbeddingInput {
  if (!input.embeddings) throw new Error(`Strategy "${id}" needs embeddings but none were provided`);
  return input.embeddings;
}

export interface RerankInfo {
  model: string;
  dtype: string;
  transformersVersion: string;
  loadMs: number;
}

// One shared model load for all rerank strategies. The dynamic import keeps
// transformers out of keyword-only runs and the test suite.
let scorerMemo: Promise<PairScorer> | null = null;
let rerankInfo: RerankInfo | null = null;

export function getRerankInfo(): RerankInfo | null {
  return rerankInfo;
}

function loadNodeScorer(): Promise<PairScorer> {
  if (!scorerMemo) {
    scorerMemo = import("./reranker.js")
      .then((m) => m.createNodeReranker({ onProgress: (msg) => console.log(msg) }))
      .then((r) => {
        rerankInfo = { model: r.model, dtype: r.dtype, transformersVersion: r.transformersVersion, loadMs: r.loadMs };
        return r.score;
      })
      .catch((e) => {
        scorerMemo = null;
        throw e;
      });
  }
  return scorerMemo;
}

const BASE_LABEL = { hybrid: "Hybrid", embeddings: "Embeddings" } as const;

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
      const { summary, ranked } = rankBySemantic(input.chunks, semanticRanking(queryVector, chunkVectors));
      return selectWithAnchor(summary, ranked, input.limit);
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
  // The rerank candidate list and its top N come from decision.ts (which re-exports
  // the lib RERANK_TOP_N), so the decision rule and the strategies cannot drift.
  ...RERANK_CANDIDATES.map((c) =>
    createRerankStrategy({
      id: c.id,
      label: `${BASE_LABEL[c.base]} + cross-encoder rerank (top ${c.topN})`,
      base: c.base,
      topN: c.topN,
      loadScorer: loadNodeScorer,
    }),
  ),
  ...SENSITIVITY_STRATEGIES.map((c) =>
    createRerankStrategy({
      id: c.id,
      label: `${BASE_LABEL[c.base]} + cross-encoder rerank (top ${c.topN}, sensitivity)`,
      base: c.base,
      topN: c.topN,
      loadScorer: loadNodeScorer,
    }),
  ),
];

export function createRerankStrategy(opts: {
  id: string;
  label: string;
  base: "hybrid" | "embeddings";
  topN: number;
  loadScorer: () => Promise<PairScorer>;
}): RetrievalStrategy {
  let loading: Promise<PairScorer> | undefined;
  const load = () => (loading ??= opts.loadScorer());
  return {
    id: opts.id,
    label: opts.label,
    needsEmbeddings: true,
    topN: opts.topN,
    prepare: async () => {
      await load();
    },
    retrieve: async (input) => {
      const { queryVector, chunkVectors } = requireEmbeddings(opts.id, input);
      if (!loading) throw new Error(`Strategy "${opts.id}" must be prepared (call prepare()) before retrieve()`);
      const scorer = await loading;
      if (input.limit > WHOLE_RESUME_LIMIT) return retrieveVault(input.chunks, input.query, input.limit);
      const semantic = semanticRanking(queryVector, chunkVectors);
      const { summary, ranked } =
        opts.base === "hybrid" ? rankVault(input.chunks, input.query, semantic) : rankBySemantic(input.chunks, semantic);
      const reranked = await rerankCandidates(input.query, ranked, scorer, opts.topN);
      return selectWithAnchor(summary, reranked, input.limit);
    },
  };
}
