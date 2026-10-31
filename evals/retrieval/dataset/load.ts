// Resolves stable-key relevance labels to chunk ids and validates the dataset.
// All problems are collected into a single DatasetError.
import type { VaultChunk } from "../../../lib/engine/types";
import { tokenize } from "../../../lib/retrieval/bm25";
import { contentHash } from "../../../lib/retrieval/fusion";
import { chunkResume } from "../../../lib/vault/chunker";
import { QUERIES } from "./queries";
import { RESUMES } from "./resumes";
import type { ResolvedDataset, ResolvedQuery, RetrievalQuery, SyntheticResume } from "./types";

export const MIN_RESUMES = 3;
export const MIN_QUERIES = 60;
export const MIN_CHUNKS_PER_RESUME = 25;

export class DatasetError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(`Invalid retrieval dataset (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n- ${problems.join("\n- ")}`);
    this.name = "DatasetError";
    this.problems = problems;
  }
}

export function resolveDataset(
  resumes: SyntheticResume[],
  queries: RetrievalQuery[],
  opts: { minimums?: boolean } = {},
): ResolvedDataset {
  const problems: string[] = [];
  const corpora = new Map<string, VaultChunk[]>();

  for (const resume of resumes) {
    if (corpora.has(resume.id)) {
      problems.push(`duplicate resume id "${resume.id}"`);
      continue;
    }
    // Chunk exactly once: ids are random per call.
    corpora.set(resume.id, chunkResume(resume.text));
  }

  if (opts.minimums) {
    if (resumes.length < MIN_RESUMES) problems.push(`need at least ${MIN_RESUMES} resumes, found ${resumes.length}`);
    if (queries.length < MIN_QUERIES) problems.push(`need at least ${MIN_QUERIES} queries, found ${queries.length}`);
    for (const [id, chunks] of corpora) {
      if (chunks.length < MIN_CHUNKS_PER_RESUME) {
        problems.push(`resume "${id}" has ${chunks.length} chunks, need at least ${MIN_CHUNKS_PER_RESUME}`);
      }
    }
  }

  const seen = new Set<string>();
  const resolved: ResolvedQuery[] = [];

  for (const q of queries) {
    if (seen.has(q.id)) problems.push(`duplicate query id "${q.id}"`);
    seen.add(q.id);

    const chunks = corpora.get(q.resumeId);
    if (!chunks) {
      problems.push(`query "${q.id}": unknown resumeId "${q.resumeId}"`);
      continue;
    }
    if (!q.labels.some((l) => l.grade >= 2)) {
      problems.push(`query "${q.id}": needs at least one label with grade >= 2`);
    }

    const relevance = new Map<string, number>();
    const labelled: VaultChunk[] = [];
    for (const label of q.labels) {
      if (![1, 2, 3].includes(label.grade)) {
        problems.push(`query "${q.id}": label "${label.match}" has invalid grade ${label.grade}`);
        continue;
      }
      const hits = chunks.filter((c) => c.kind === label.kind && c.text.includes(label.match));
      if (hits.length !== 1) {
        problems.push(
          `query "${q.id}": label {kind: ${label.kind}, match: "${label.match}"} matched ${hits.length} chunks, expected exactly 1`,
        );
        continue;
      }
      const prev = relevance.get(hits[0].id) ?? 0;
      relevance.set(hits[0].id, Math.max(prev, label.grade));
      labelled.push(hits[0]);
    }

    if (q.type === "paraphrase") {
      const qTokens = new Set(tokenize(q.query));
      const shared = new Set<string>();
      for (const c of labelled) {
        for (const t of tokenize(`${c.title} ${c.text}`)) if (qTokens.has(t)) shared.add(t);
      }
      if (shared.size) {
        problems.push(`query "${q.id}": paraphrase shares BM25 tokens with labelled chunks: ${[...shared].join(", ")}`);
      }
    }

    resolved.push({ ...q, relevance });
  }

  if (problems.length) throw new DatasetError(problems);

  return { corpora, queries: resolved, fingerprint: contentHash(JSON.stringify({ resumes, queries })) };
}

export function loadDataset(): ResolvedDataset {
  return resolveDataset(RESUMES, QUERIES, { minimums: true });
}
