// Retrieval eval runner. Flags: --ci, --update-baseline, --allow-regression,
// --strategies a,b, --report <path>, --repeat <n>. Keyword-only runs never load the embedder.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { BASELINE_EPSILON, compareToBaseline, planBaselineUpdate, validateBaseline, type KeywordBaseline } from "./baseline";
import { DatasetError, loadDataset } from "./dataset/load";
import { METRIC_KEYS, PRIMARY_METRIC, RELEVANCE_THRESHOLD, aggregate, percentile, scoreQuery, type MetricSet } from "./metrics";
import { renderReport } from "./report";
import { STRATEGIES, type EmbeddingInput } from "./strategies";
import { RESUMES } from "./dataset/resumes";
import type { QueryType } from "./dataset/types";
import type { VaultChunk } from "../../lib/engine/types";

export interface RetrievalRunResult {
  generatedAt: string;
  command: string;
  gitSha: string;
  node: string;
  platform: string;
  repeat: number;
  dataset: {
    fingerprint: string;
    resumes: { id: string; seniority: string; domain: string; chunks: number }[];
    queries: number;
    lexical: number;
    paraphrase: number;
  };
  embeddingModel: { id: string; dtype: string } | null;
  primaryMetric: string;
  relevanceThreshold: number;
  strategies: {
    id: string;
    label: string;
    overall: MetricSet;
    byType: { lexical: MetricSet; paraphrase: MetricSet };
    byResume: Record<string, MetricSet>;
    latency: { p50: number; p95: number; embedP50: number };
    perQuery: { id: string; type: QueryType; query: string; metrics: MetricSet; rankedIds: string[]; totalMs: number }[];
  }[];
}

const BASELINE_PATH = path.join("evals", "retrieval", "baseline.json");
const UPDATE_CMD = "npm run eval:retrieval -- --update-baseline";

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const round4 = (m: MetricSet): MetricSet =>
  Object.fromEntries(METRIC_KEYS.map((k) => [k, Math.round(m[k] * 10000) / 10000])) as MetricSet;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ci = args.includes("--ci");
  const update = args.includes("--update-baseline");
  const allowRegression = args.includes("--allow-regression");
  const repeat = Math.max(1, Number(argValue(args, "--repeat") ?? 3) || 3);
  const reportPath = argValue(args, "--report") ?? path.join("evals", "RETRIEVAL.md");
  const requested = ci || update ? ["keyword"] : argValue(args, "--strategies")?.split(",").map((s) => s.trim()).filter(Boolean);

  const selected = requested ? [] : [...STRATEGIES];
  for (const id of requested ?? []) {
    const s = STRATEGIES.find((x) => x.id === id);
    if (!s) {
      console.error(`Unknown strategy "${id}". Valid ids: ${STRATEGIES.map((x) => x.id).join(", ")}`);
      process.exitCode = 1;
      return;
    }
    selected.push(s);
  }

  let dataset;
  try {
    dataset = loadDataset();
  } catch (err) {
    if (err instanceof DatasetError) {
      for (const p of err.problems) console.error(`- ${p}`);
    } else console.error(err);
    process.exitCode = 1;
    return;
  }

  // Embeddings are only touched when a selected strategy needs them.
  const needsEmbed = selected.some((s) => s.needsEmbeddings);
  let embedder: {
    model: string;
    dtype: string;
    embedChunks(chunks: VaultChunk[]): Promise<{ id: string; vector: number[] }[]>;
    embedQuery(query: string): Promise<number[]>;
  } | null = null;
  const chunkVectors = new Map<string, { id: string; vector: number[] }[]>();
  if (needsEmbed) {
    try {
      const { createNodeEmbedder } = await import("./embedder.js");
      embedder = await createNodeEmbedder({ onProgress: (m) => console.log(m) });
      for (const [resumeId, chunks] of dataset.corpora) chunkVectors.set(resumeId, await embedder.embedChunks(chunks));
    } catch (err) {
      console.error(`Embedding model unavailable (needs network on first run): ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
      return;
    }
  }
  for (const s of selected) if (s.prepare) await s.prepare();

  const embeddingsFor = (resumeId: string, queryVector: number[] | null): EmbeddingInput | undefined =>
    queryVector ? { queryVector, chunkVectors: chunkVectors.get(resumeId)! } : undefined;

  // Warm-up (untimed).
  const first = dataset.queries[0];
  if (first) {
    const qv = embedder ? await embedder.embedQuery(first.query) : null;
    for (const s of selected) {
      await s.retrieve({ chunks: dataset.corpora.get(first.resumeId)!, query: first.query, limit: 8, embeddings: s.needsEmbeddings ? embeddingsFor(first.resumeId, qv) : undefined });
    }
  }

  const perStrategy = selected.map((s) => ({ s, rows: [] as RetrievalRunResult["strategies"][number]["perQuery"], embedMs: [] as number[], resumeOf: [] as string[] }));
  for (const q of dataset.queries) {
    const chunks = dataset.corpora.get(q.resumeId)!;
    let queryVector: number[] | null = null;
    let embedMs = 0;
    if (embedder) {
      const t0 = performance.now();
      queryVector = await embedder.embedQuery(q.query);
      embedMs = performance.now() - t0;
    }
    for (const ps of perStrategy) {
      const times: number[] = [];
      let ids: string[] = [];
      for (let i = 0; i < repeat; i++) {
        const t0 = performance.now();
        const out = await ps.s.retrieve({ chunks, query: q.query, limit: 8, embeddings: ps.s.needsEmbeddings ? embeddingsFor(q.resumeId, queryVector) : undefined });
        times.push(performance.now() - t0);
        ids = out.map((c) => c.id);
      }
      const totalMs = median(times) + (ps.s.needsEmbeddings ? embedMs : 0);
      if (ps.s.needsEmbeddings) ps.embedMs.push(embedMs);
      ps.rows.push({ id: q.id, type: q.type, query: q.query, metrics: scoreQuery(ids, q.relevance), rankedIds: ids, totalMs });
      ps.resumeOf.push(q.resumeId);
    }
  }

  const strategies: RetrievalRunResult["strategies"] = perStrategy.map((ps) => {
    const ofType = (t: QueryType) => aggregate(ps.rows.filter((r) => r.type === t).map((r) => r.metrics));
    const byResume: Record<string, MetricSet> = {};
    for (const id of dataset.corpora.keys()) byResume[id] = aggregate(ps.rows.filter((_, i) => ps.resumeOf[i] === id).map((r) => r.metrics));
    const totals = ps.rows.map((r) => r.totalMs);
    return {
      id: ps.s.id,
      label: ps.s.label,
      overall: aggregate(ps.rows.map((r) => r.metrics)),
      byType: { lexical: ofType("lexical"), paraphrase: ofType("paraphrase") },
      byResume,
      latency: { p50: percentile(totals, 50), p95: percentile(totals, 95), embedP50: percentile(ps.embedMs, 50) },
      perQuery: ps.rows,
    };
  });

  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    /* keep unknown */
  }

  const result: RetrievalRunResult = {
    generatedAt: new Date().toISOString(),
    command: process.argv.slice(2).join(" "),
    gitSha,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    repeat,
    dataset: {
      fingerprint: dataset.fingerprint,
      resumes: [...dataset.corpora].map(([id, chunks]) => {
        const meta = RESUMES.find((r) => r.id === id);
        return { id, seniority: meta?.seniority ?? "", domain: meta?.domain ?? "", chunks: chunks.length };
      }),
      queries: dataset.queries.length,
      lexical: dataset.queries.filter((q) => q.type === "lexical").length,
      paraphrase: dataset.queries.filter((q) => q.type === "paraphrase").length,
    },
    embeddingModel: embedder ? { id: embedder.model, dtype: embedder.dtype } : null,
    primaryMetric: PRIMARY_METRIC,
    relevanceThreshold: RELEVANCE_THRESHOLD,
    strategies,
  };

  const resultsDir = path.join("evals", "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(resultsDir, `retrieval-${stamp}.json`), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(resultsDir, "retrieval-latest.json"), JSON.stringify(result, null, 2));

  console.log(["strategy", ...METRIC_KEYS].join("\t"));
  for (const s of strategies) console.log([s.id, ...METRIC_KEYS.map((k) => s.overall[k].toFixed(3))].join("\t"));

  if (!ci && !update) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, renderReport(result));
    console.log(`Report written to ${reportPath}`);
  }

  const kw = strategies.find((s) => s.id === "keyword");
  if (update) {
    if (!kw) return;
    const baseline: KeywordBaseline = {
      strategy: "keyword",
      fingerprint: result.dataset.fingerprint,
      recordedAt: result.generatedAt,
      overall: round4(kw.overall),
      byType: { lexical: round4(kw.byType.lexical), paraphrase: round4(kw.byType.paraphrase) },
    };
    let oldRaw: unknown = null;
    if (fs.existsSync(BASELINE_PATH)) {
      const text = fs.readFileSync(BASELINE_PATH, "utf8");
      try {
        oldRaw = JSON.parse(text);
      } catch {
        oldRaw = text;
      }
    }
    const plan = planBaselineUpdate(oldRaw, baseline, allowRegression);
    for (const w of plan.warnings) console.log(`WARNING ${w}`);
    for (const i of plan.improvements) console.log(`improvement ${i}`);
    if (!plan.write) {
      for (const e of plan.errors) console.error(e);
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
    console.log(`Baseline written to ${BASELINE_PATH}. Commit it with an explanation of why it changed.`);
    return;
  }

  if (ci) {
    if (!fs.existsSync(BASELINE_PATH)) {
      console.error(`No baseline recorded; run ${UPDATE_CMD}`);
      process.exitCode = 1;
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    } catch (err) {
      console.error(`INVALID BASELINE could not parse ${BASELINE_PATH}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`Run ${UPDATE_CMD}`);
      process.exitCode = 1;
      return;
    }
    const valid = validateBaseline(parsed);
    if (!valid.ok) {
      for (const p of valid.problems) console.error(`INVALID BASELINE ${p}`);
      console.error(`Run ${UPDATE_CMD}`);
      process.exitCode = 1;
      return;
    }
    const cmp = compareToBaseline(valid.baseline, {
      strategy: "keyword",
      fingerprint: result.dataset.fingerprint,
      overall: kw!.overall,
      byType: kw!.byType,
    });
    for (const r of cmp.regressions) console.error(`REGRESSION ${r}`);
    for (const i of cmp.improvements) console.log(`improvement ${i} (consider ${UPDATE_CMD})`);
    if (cmp.ok) console.log(`Baseline gate passed (epsilon ${BASELINE_EPSILON}).`);
    else process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
