// ─── BM25 ────────────────────────────────────────────────────────────────────
// Small, dependency-free Okapi BM25 used on both sides: the browser ranks the
// user's vault chunks, the server ranks knowledge-base entries. Lexical scoring
// is the first half of hybrid retrieval; embeddings slot in beside it later.

const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have i if in into is it its me my of on or our " +
    "so that the their them they this to was we were what when which who will with you your"
  ).split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** Crude suffix stripping so "negotiating" matches "negotiation". */
function stem(token: string): string {
  if (token.length <= 4) return token;
  return token.replace(/(ations?|ing|ed|es|s)$/, "") || token;
}

export interface Bm25Doc {
  id: string;
  text: string;
}

export interface Bm25Hit {
  id: string;
  score: number;
}

export class Bm25Index {
  private docs: { id: string; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(
    docs: Bm25Doc[],
    private k1 = 1.2,
    private b = 0.75,
  ) {
    let total = 0;
    for (const doc of docs) {
      const tokens = tokenize(doc.text);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ id: doc.id, tf, len: tokens.length });
      total += tokens.length;
    }
    this.avgLen = docs.length ? total / docs.length : 0;
  }

  search(query: string, limit = 8): Bm25Hit[] {
    const terms = [...new Set(tokenize(query))];
    const n = this.docs.length;
    if (!terms.length || !n) return [];

    const hits: Bm25Hit[] = [];
    for (const doc of this.docs) {
      let score = 0;
      for (const term of terms) {
        const f = doc.tf.get(term);
        if (!f) continue;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * doc.len) / (this.avgLen || 1)));
      }
      if (score > 0) hits.push({ id: doc.id, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
