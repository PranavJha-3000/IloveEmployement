// Deterministic profile extractor: bounded patterns, date parsing, section and
// role extraction, confidence. Inline fixtures only. No model calls.
import assert from "node:assert";
import { test } from "node:test";
import { MAX_LINE, findEmails, findPhones, findUrls, parseDateRange, parseYearMonth } from "../lib/profile/patterns";
import { chunkResume } from "../lib/vault/chunker";

const ENGINE_RESUME = `Jane Doe
jane@example.com | +91 98765 43210

SUMMARY
Backend engineer with four years building payment systems in Go and PostgreSQL for high-traffic fintech products.

EXPERIENCE
Senior Software Engineer, Zeta Payments | Mar 2023 – Present
• Cut checkout API p99 latency from 900ms to 280ms by redesigning the ledger write path
• Led migration of 40 services to Kubernetes with zero downtime
• Mentored 3 junior engineers through their first on-call rotations

Software Engineer, Acme Fintech | Jun 2021 – Feb 2023
- Built a reconciliation service processing 2M transactions a day
- Introduced contract testing that reduced integration bugs by 35%

SKILLS
Go, PostgreSQL, Kafka, Kubernetes, gRPC, AWS

EDUCATION
B.Tech Computer Science, COEP, 2021`;

// ── parseYearMonth
test("parseYearMonth accepts month names, numeric forms and bare years", () => {
  for (const t of ["Mar 2023", "March 2023", "Mar. 2023", "03/2023", "3/2023", "2023-03", "2023.03"]) {
    assert.deepStrictEqual(parseYearMonth(t), { year: 2023, month: 3 }, t);
  }
  assert.deepStrictEqual(parseYearMonth("Sept 2020"), { year: 2020, month: 9 });
  assert.deepStrictEqual(parseYearMonth("2021"), { year: 2021, month: null });
});

test("parseYearMonth rejects bad months and out-of-range years", () => {
  assert.strictEqual(parseYearMonth("Smarch 2023"), null);
  assert.strictEqual(parseYearMonth("13/2023"), null);
  assert.strictEqual(parseYearMonth("1949"), null);
  assert.strictEqual(parseYearMonth("2101"), null);
  assert.strictEqual(parseYearMonth(""), null);
});

// ── parseDateRange
test("parseDateRange reads an open-ended current role", () => {
  const r = parseDateRange("Senior Engineer, Zeta | Mar 2023 – Present");
  assert.ok(r);
  assert.deepStrictEqual(r.start, { year: 2023, month: 3 });
  assert.strictEqual(r.end, null);
  assert.strictEqual(r.current, true);
});

test("parseDateRange reads closed, year-only and parenthesised ranges", () => {
  const a = parseDateRange("Jun 2021 - Feb 2023");
  assert.ok(a);
  assert.deepStrictEqual(a.start, { year: 2021, month: 6 });
  assert.deepStrictEqual(a.end, { year: 2023, month: 2 });
  assert.strictEqual(a.current, false);
  const b = parseDateRange("2019 to 2021");
  assert.ok(b);
  assert.deepStrictEqual(b.start, { year: 2019, month: null });
  assert.deepStrictEqual(b.end, { year: 2021, month: null });
  const c = parseDateRange("(2018 — 2020)");
  assert.ok(c);
  assert.strictEqual(c.start?.year, 2018);
  assert.strictEqual(c.end?.year, 2020);
  const d = parseDateRange("2018-2020");
  assert.ok(d);
  assert.strictEqual(d.start?.year, 2018);
  assert.strictEqual(d.end?.year, 2020);
});

test("parseDateRange accepts every present word, any case, and returns null with no date", () => {
  for (const w of ["Present", "CURRENT", "now", "Today"]) {
    const r = parseDateRange(`Jan 2020 - ${w}`);
    assert.ok(r, w);
    assert.strictEqual(r.current, true, w);
  }
  assert.strictEqual(parseDateRange("Led a team of five engineers"), null);
});

// ── emails, phones, urls
test("findEmails lowercases and de-duplicates", () => {
  assert.deepStrictEqual(findEmails("Mail Jane.Doe@Example.com or jane.doe@example.com, other@x.io."), ["jane.doe@example.com", "other@x.io"]);
});

test("findPhones handles common layouts and ignores year spans", () => {
  const got = findPhones("+91 98765 43210\n555-0142\n(555) 010-0199\n2019-2021");
  assert.deepStrictEqual(got, ["+91 98765 43210", "555-0142", "(555) 010-0199"]);
});

test("findUrls finds scheme, bare-path and www links and strips trailing punctuation", () => {
  const got = findUrls("See https://x.dev, github.com/mara; linkedin.com/in/mara-l and www.site.org/p.");
  assert.deepStrictEqual(got, ["https://x.dev", "github.com/mara", "linkedin.com/in/mara-l", "www.site.org/p"]);
});

test("findUrls does not read an email domain as a link", () => {
  assert.deepStrictEqual(findUrls("jane@example.com"), []);
});

// ── ReDoS guards
test("adversarial 50,000 character input returns quickly from every parser", () => {
  const cases = ["a@".repeat(25_000), "1-".repeat(25_000), "http://" + "a.".repeat(25_000), "Mar ".repeat(12_500), "9".repeat(50_000), "a.".repeat(25_000) + "/"];
  for (const input of cases) {
    for (const fn of [findEmails, findPhones, findUrls, (s: string) => parseDateRange(s), (s: string) => parseYearMonth(s)] as ((s: string) => unknown)[]) {
      const t0 = performance.now();
      fn(input);
      const ms = performance.now() - t0;
      assert.ok(ms < 200, `${input.slice(0, 8)} took ${ms.toFixed(0)}ms`);
    }
  }
});

test("lines longer than MAX_LINE are truncated before matching", () => {
  const long = "x".repeat(MAX_LINE) + " late@example.com";
  assert.deepStrictEqual(findEmails(long), []);
  assert.deepStrictEqual(findEmails(long + "\nok@example.com"), ["ok@example.com"]);
});

// ── chunker is unchanged
test("chunkResume still produces the same chunk shape after the export-only change", () => {
  const chunks = chunkResume(ENGINE_RESUME);
  const strip = chunks.map(({ kind, title, text, source }) => ({ kind, title, text, source }));
  assert.strictEqual(strip.filter((c) => c.kind === "bullet").length, 5);
  assert.strictEqual(strip.filter((c) => c.kind === "experience").length, 2);
  assert.strictEqual(strip.find((c) => c.kind === "skill")?.text, "Go, PostgreSQL, Kafka, Kubernetes, gRPC, AWS");
  assert.strictEqual(strip.find((c) => c.kind === "education")?.text, "B.Tech Computer Science, COEP, 2021");
});
