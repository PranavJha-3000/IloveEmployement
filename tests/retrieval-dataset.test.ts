// Validation tests for the retrieval eval dataset resolver. Inline fixtures only.
import assert from "node:assert";
import { test } from "node:test";
import { DatasetError, MIN_CHUNKS_PER_RESUME, loadDataset, resolveDataset } from "../evals/retrieval/dataset/load";
import { RESUMES } from "../evals/retrieval/dataset/resumes";
import type { RetrievalQuery, SyntheticResume } from "../evals/retrieval/dataset/types";
import { chunkResume } from "../lib/vault/chunker";

const FIXTURE: SyntheticResume = {
  id: "fx",
  seniority: "mid",
  domain: "backend",
  text: `Jane Doe
jane@example.com

SUMMARY
Backend engineer with four years building payment systems for high-traffic fintech products.

EXPERIENCE
Senior Software Engineer, Zeta Payments | Mar 2023 – Present
• Cut checkout latency from 900ms to 280ms by redesigning the ledger write path
• Led migration of forty services to Kubernetes with zero downtime
• Mentored three junior engineers through first on-call rotations

Software Engineer, Acme Fintech | Jun 2021 – Feb 2023
- Built a reconciliation service processing two million transactions daily
- Mentored interns on code review practices

SKILLS
Go, PostgreSQL, Kafka

EDUCATION
B.Tech Computer Science, 2021`,
};

function q(over: Partial<RetrievalQuery>): RetrievalQuery {
  return {
    id: "q1",
    resumeId: "fx",
    query: "ledger latency",
    type: "lexical",
    labels: [{ kind: "bullet", match: "ledger write path", grade: 3 }],
    ...over,
  };
}

function problemsOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof DatasetError, "expected DatasetError");
    return (e as DatasetError).problems;
  }
  assert.fail("expected DatasetError to be thrown");
}

test("resolves a stable-key label to the chunk id", () => {
  const ds = resolveDataset([FIXTURE], [q({})]);
  const chunks = ds.corpora.get("fx")!;
  const target = chunks.find((c) => c.kind === "bullet" && c.text.includes("ledger write path"))!;
  assert.strictEqual(ds.queries[0].relevance.size, 1);
  assert.strictEqual(ds.queries[0].relevance.get(target.id), 3);
  assert.ok(ds.fingerprint.length > 0);
});

test("zero-match label throws naming query and fragment", () => {
  const p = problemsOf(() => resolveDataset([FIXTURE], [q({ labels: [{ kind: "bullet", match: "nonexistent fragment", grade: 3 }] })]));
  assert.ok(p.some((m) => m.includes("q1") && m.includes("nonexistent fragment")));
});

test("multi-match label throws mentioning 2 chunks", () => {
  const p = problemsOf(() => resolveDataset([FIXTURE], [q({ labels: [{ kind: "bullet", match: "Mentored", grade: 3 }] })]));
  assert.ok(p.some((m) => m.includes("2 chunks")));
});

test("paraphrase sharing a BM25 token with labelled chunk throws", () => {
  const p = problemsOf(() => resolveDataset([FIXTURE], [q({ type: "paraphrase", query: "kubernetes experience" , labels: [{ kind: "bullet", match: "migration of forty", grade: 3 }] })]));
  assert.ok(p.some((m) => m.includes("kubernet")));
});

test("paraphrase with no shared tokens passes", () => {
  const ds = resolveDataset([FIXTURE], [q({ type: "paraphrase", query: "container orchestration rollout", labels: [{ kind: "bullet", match: "migration of forty", grade: 3 }] })]);
  assert.strictEqual(ds.queries.length, 1);
});

test("structural errors: no grade>=2, bad grade, duplicate id, unknown resume", () => {
  const p = problemsOf(() =>
    resolveDataset(
      [FIXTURE],
      [
        q({ id: "a", labels: [{ kind: "bullet", match: "ledger write path", grade: 1 }] }),
        q({ id: "b", labels: [{ kind: "bullet", match: "ledger write path", grade: 5 as 3 }] }),
        q({ id: "a" }),
        q({ id: "c", resumeId: "nope" }),
      ],
    ),
  );
  assert.ok(p.some((m) => m.includes('"a"') && m.includes("grade >= 2")));
  assert.ok(p.some((m) => m.includes("invalid grade 5")));
  assert.ok(p.some((m) => m.includes("duplicate query id")));
  assert.ok(p.some((m) => m.includes("unknown resumeId")));
});

test("all problems are aggregated in one error", () => {
  let err: DatasetError | undefined;
  try {
    resolveDataset([FIXTURE], [q({ id: "x", labels: [{ kind: "bullet", match: "zzz1", grade: 3 }] }), q({ id: "y", labels: [{ kind: "bullet", match: "zzz2", grade: 3 }] })]);
  } catch (e) {
    err = e as DatasetError;
  }
  assert.ok(err);
  assert.ok(err!.message.includes('"x"') && err!.message.includes('"y"'));
});

test("minimums enforced", () => {
  const p = problemsOf(() => resolveDataset([FIXTURE], [q({})], { minimums: true }));
  assert.ok(p.some((m) => m.includes("at least 3 resumes")));
  assert.ok(p.some((m) => m.includes("at least 60 queries")));
  assert.ok(p.some((m) => m.includes(`at least ${MIN_CHUNKS_PER_RESUME}`)));
});

test("RESUMES: unique ids, >= min chunks, core kinds present", () => {
  assert.strictEqual(new Set(RESUMES.map((r) => r.id)).size, RESUMES.length);
  assert.ok(RESUMES.length >= 3);
  for (const r of RESUMES) {
    const chunks = chunkResume(r.text);
    assert.ok(chunks.length >= MIN_CHUNKS_PER_RESUME, `${r.id} has ${chunks.length} chunks`);
    for (const kind of ["summary", "bullet", "experience", "skill", "education"]) {
      assert.ok(chunks.some((c) => c.kind === kind), `${r.id} missing ${kind}`);
    }
  }
});

test("committed retrieval dataset validates", () => {
  let ds: ReturnType<typeof loadDataset> | undefined;
  assert.doesNotThrow(() => {
    ds = loadDataset();
  });
  const queries = ds!.queries;
  assert.ok(queries.length >= 60, `only ${queries.length} queries`);

  const breakdown: string[] = [];
  for (const r of RESUMES) {
    const mine = queries.filter((q) => q.resumeId === r.id);
    assert.ok(mine.length >= 18, `${r.id} has ${mine.length} queries`);
    const lex = mine.filter((q) => q.type === "lexical").length;
    breakdown.push(`${r.id}=${mine.length} (lexical ${lex}, paraphrase ${mine.length - lex})`);
  }
  const lexical = queries.filter((q) => q.type === "lexical").length;
  const paraphrase = queries.filter((q) => q.type === "paraphrase").length;
  assert.ok(lexical >= 24, `only ${lexical} lexical queries`);
  assert.ok(paraphrase >= 24, `only ${paraphrase} paraphrase queries`);
  for (const q of queries) {
    assert.ok(q.labels.some((l) => l.grade === 3), `${q.id} has no grade-3 label`);
  }
  console.log(`retrieval dataset: ${queries.length} queries; ${breakdown.join("; ")}; lexical ${lexical}, paraphrase ${paraphrase}`);
});
