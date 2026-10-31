// Pure embedding-text helpers shared by the browser embedder and the Node eval embedder.
import type { VaultChunk } from "../engine/types";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DTYPE = "q8" as const;
export const QUERY_MAX_CHARS = 2000;

/** Text embedded for a chunk. */
export function embeddingText(c: Pick<VaultChunk, "title" | "text">): string {
  return `${c.title}: ${c.text}`;
}

/** Text embedded for a query. */
export function embeddingQuery(query: string): string {
  return query.slice(0, QUERY_MAX_CHARS);
}
