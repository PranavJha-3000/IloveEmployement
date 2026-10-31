// Node-only cross-encoder loader for the retrieval eval. Shared rerank logic
// lives in lib/retrieval/rerank.ts; this file only loads the model and exposes a
// PairScorer. There is deliberately NO score cache: the timed retrieve() calls
// must include real candidate scoring so latency numbers are honest (nothing to key).

import path from "node:path";
import { RERANK_DTYPE, RERANK_MODEL, type PairScorer } from "../../lib/retrieval/rerank";

export interface NodeReranker {
  model: string;
  dtype: string;
  transformersVersion: string;
  loadMs: number;
  score: PairScorer;
}

type Tokenizer = (texts: string[], opts: { text_pair: string[]; padding: boolean; truncation: boolean }) => unknown;
type SeqModel = (inputs: unknown) => Promise<{ logits: { dims: number[]; tolist(): number[][] } }>;

export async function createNodeReranker(
  opts: { model?: string; dtype?: string; cacheDir?: string; onProgress?: (msg: string) => void } = {},
): Promise<NodeReranker> {
  const model = opts.model ?? process.env.RERANK_MODEL ?? RERANK_MODEL;
  const dtype = opts.dtype ?? RERANK_DTYPE;
  const log = opts.onProgress ?? (() => {});
  const hfCache = opts.cacheDir ?? path.join(process.cwd(), "evals", "results", "hf-cache");

  const { AutoTokenizer, AutoModelForSequenceClassification, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.cacheDir = hfCache;
  log(`Loading ${model} (${dtype})`);
  const t0 = performance.now();
  const tokenizer = (await AutoTokenizer.from_pretrained(model)) as unknown as Tokenizer;
  const net = (await AutoModelForSequenceClassification.from_pretrained(model, {
    dtype: dtype as "q8",
  })) as unknown as SeqModel;
  const loadMs = performance.now() - t0;

  const score: PairScorer = async (query, passages) => {
    if (passages.length === 0) return [];
    const inputs = tokenizer(passages.map(() => query), { text_pair: passages, padding: true, truncation: true });
    const { logits } = await net(inputs);
    const dims = logits.dims;
    const rows = logits.tolist();
    let out: number[];
    if (dims.length === 2 && dims[1] === 1) out = rows.map((r) => r[0]);
    else if (dims.length === 2 && dims[1] === 2) out = rows.map((r) => r[1]);
    else throw new Error(`Unsupported reranker logits dims [${dims.join(", ")}]`);
    if (out.length !== passages.length) throw new Error(`Reranker returned ${out.length} scores for ${passages.length} passages`);
    if (!out.every((s) => typeof s === "number" && Number.isFinite(s))) throw new Error("Reranker returned a non-finite score");
    log(`logits dims [${dims.join(", ")}]`);
    return out;
  };

  return {
    model,
    dtype,
    transformersVersion: typeof env.version === "string" ? env.version : "unknown",
    loadMs,
    score,
  };
}
