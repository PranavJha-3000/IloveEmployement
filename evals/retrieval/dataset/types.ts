// Retrieval evaluation dataset types. Labels reference chunks by a stable key
// (kind + text fragment), never by chunk id, because chunkResume assigns random
// ids on every call. Ids are resolved at load time.
import type { VaultChunk, VaultChunkKind } from "../../../lib/engine/types";

export type QueryType = "lexical" | "paraphrase";

/** 3 = directly answers, 2 = strongly supports, 1 = topically related. Unlabelled = 0. */
export type RelevanceGrade = 1 | 2 | 3;

export interface RelevanceLabel {
  kind: VaultChunkKind;
  /** Case-sensitive substring of the chunk text; must match exactly one chunk of `kind`. */
  match: string;
  grade: RelevanceGrade;
}

export interface SyntheticResume {
  id: string;
  seniority: string;
  domain: string;
  text: string;
}

export interface RetrievalQuery {
  id: string;
  resumeId: string;
  query: string;
  type: QueryType;
  labels: RelevanceLabel[];
  /** Why this case is hard (optional). */
  note?: string;
}

export interface ResolvedQuery extends RetrievalQuery {
  /** chunk id -> grade */
  relevance: Map<string, number>;
}

export interface ResolvedDataset {
  corpora: Map<string, VaultChunk[]>;
  queries: ResolvedQuery[];
  fingerprint: string;
}
