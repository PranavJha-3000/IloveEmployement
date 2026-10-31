import { Bm25Index } from "../retrieval/bm25";
import { KB, type KbEntry } from "./entries";

const index = new Bm25Index(KB.map((e) => ({ id: e.id, text: `${e.title} ${e.tags.join(" ")} ${e.text}` })));
const byId = new Map(KB.map((e) => [e.id, e]));

/**
 * Knowledge for one run: entries tagged "all" always come along, entries
 * matching the preset's tags are the candidate pool, and BM25 against the
 * task query orders that pool so the most relevant playbooks survive the cap.
 */
export function retrieveKnowledge(tags: string[], query: string, limit = 4): KbEntry[] {
  const always = KB.filter((e) => e.tags.includes("all"));
  const pool = KB.filter((e) => !e.tags.includes("all") && e.tags.some((t) => tags.includes(t)));
  const poolIds = new Set(pool.map((e) => e.id));

  const ranked = index
    .search(`${tags.join(" ")} ${query}`, KB.length)
    .filter((h) => poolIds.has(h.id))
    .map((h) => byId.get(h.id)!);
  // Tagged entries with no lexical overlap still beat nothing.
  const rest = pool.filter((e) => !ranked.includes(e));

  return [...always, ...[...ranked, ...rest].slice(0, Math.max(0, limit - always.length))];
}
