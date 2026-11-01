// Deterministic profile extractor: bounded patterns, date parsing, section and
// role extraction, confidence. Inline fixtures only. No model calls.
import assert from "node:assert";
import { test } from "node:test";
import { MAX_LINE, findEmails, findPhones, findUrls, parseDateRange, parseYearMonth } from "../lib/profile/patterns";
import { EXTRACTOR_VERSION, MAX_EXTRACT_CHARS, extractProfile, safeExtractProfile } from "../lib/profile/extract";
import { LOW_CONFIDENCE_THRESHOLD, StructuredProfileSchema, fieldPaths } from "../lib/profile/schema";
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

// ── extractor: the engine fixture
test("extractProfile reads contact, roles, education and skills from a standard resume", () => {
  const r = extractProfile(ENGINE_RESUME);
  const p = r.profile;
  assert.strictEqual(r.method, "deterministic");
  assert.strictEqual(EXTRACTOR_VERSION, "det-1");
  assert.strictEqual(p.contact.name, "Jane Doe");
  assert.strictEqual(p.contact.email, "jane@example.com");
  assert.strictEqual(p.contact.phone, "+91 98765 43210");
  assert.strictEqual(p.roles.length, 2);
  assert.strictEqual(p.roles[0].title, "Senior Software Engineer");
  assert.strictEqual(p.roles[0].company, "Zeta Payments");
  assert.deepStrictEqual(p.roles[0].start, { year: 2023, month: 3 });
  assert.strictEqual(p.roles[0].current, true);
  assert.strictEqual(p.roles[0].end, null);
  assert.strictEqual(p.roles[0].bullets.length, 3);
  assert.strictEqual(p.roles[1].title, "Software Engineer");
  assert.strictEqual(p.roles[1].company, "Acme Fintech");
  assert.deepStrictEqual(p.roles[1].start, { year: 2021, month: 6 });
  assert.deepStrictEqual(p.roles[1].end, { year: 2023, month: 2 });
  assert.strictEqual(p.roles[1].bullets.length, 2);
  assert.strictEqual(p.education.length, 1);
  assert.strictEqual(p.education[0].degree, "B.Tech Computer Science");
  assert.strictEqual(p.education[0].institution, "COEP");
  assert.strictEqual(p.education[0].endYear, 2021);
  const names = p.skills.map((s) => s.name);
  for (const n of ["Go", "PostgreSQL", "Kafka", "Kubernetes", "gRPC", "AWS"]) assert.ok(names.includes(n), n);
  assert.strictEqual(r.sourceHash.length > 0, true);
});

test("every field path has a code-computed confidence and grounded values clear the threshold", () => {
  const r = extractProfile(ENGINE_RESUME);
  assert.deepStrictEqual(Object.keys(r.confidence).sort(), fieldPaths(r.profile).sort());
  for (const path of ["contact.name", "contact.email", "contact.phone", "roles.0.title", "roles.0.company", "roles.0.start", "roles.1.end", "roles.0.bullets", "education.0.degree", "education.0.institution"]) {
    assert.ok(r.confidence[path] >= LOW_CONFIDENCE_THRESHOLD, `${path} ${r.confidence[path]}`);
  }
});

test("extraction is deterministic and the result parses with the schema", () => {
  const a = extractProfile(ENGINE_RESUME);
  const b = extractProfile(ENGINE_RESUME);
  assert.deepStrictEqual(a, b);
  assert.ok(StructuredProfileSchema.safeParse(a.profile).success);
});

// ── header layouts
function rolesFrom(experience: string) {
  return extractProfile(`Priya Nair
priya@example.org

EXPERIENCE
${experience}
`).profile.roles;
}

test("role header layouts: title at company, company dash title, two-line header", () => {
  const at = rolesFrom("Data Analyst at Northwind, Jan 2020 - Dec 2021\n- Built dashboards for the finance team");
  assert.strictEqual(at[0].title, "Data Analyst");
  assert.strictEqual(at[0].company, "Northwind");
  assert.deepStrictEqual(at[0].start, { year: 2020, month: 1 });

  const dash = rolesFrom("Orbit Labs — Product Designer (2018 – 2020)\n- Redesigned onboarding");
  assert.strictEqual(dash[0].title, "Product Designer");
  assert.strictEqual(dash[0].company, "Orbit Labs");
  assert.strictEqual(dash[0].start?.year, 2018);
  assert.strictEqual(dash[0].end?.year, 2020);

  const two = rolesFrom("Operations Manager\nHarbor Logistics | Sep 2016 – Aug 2019\n- Ran a team of twelve dispatchers");
  assert.strictEqual(two[0].title, "Operations Manager");
  assert.strictEqual(two[0].company, "Harbor Logistics");
  assert.deepStrictEqual(two[0].start, { year: 2016, month: 9 });
  assert.deepStrictEqual(two[0].end, { year: 2019, month: 8 });
});

test("a company suffix stays with the company name", () => {
  const r = rolesFrom("Backend Developer, Acme, Inc. | 2019 - 2021\n- Wrote services");
  assert.strictEqual(r[0].company, "Acme, Inc.");
});

// ── skills
test("skills are split, normalized and unknowns kept as written", () => {
  const p = extractProfile(`Sam Okafor

SKILLS
Languages: JS, ReactJS; Zorblax Query Language
Tools: Docker | Git • Terraform`).profile;
  const js = p.skills.find((s) => s.name === "JavaScript");
  assert.ok(js && js.matchedFrom.includes("JS"));
  const react = p.skills.find((s) => s.name === "React");
  assert.ok(react && react.matchedFrom.includes("ReactJS"));
  const unk = p.skills.find((s) => s.name === "Zorblax Query Language");
  assert.ok(unk);
  assert.strictEqual(unk.canonicalId, null);
  assert.ok(p.skills.some((s) => s.name === "Docker"));
  assert.ok(p.skills.some((s) => s.name === "Terraform"));
  assert.ok(!p.skills.some((s) => /languages|tools/i.test(s.name)));
});

// ── projects
test("projects get a name, joined description, link and mentioned skills", () => {
  const p = extractProfile(`Lee Chan
lee@example.com

PROJECTS
TaskFlow (2022) https://github.com/lee/taskflow
- Built a job queue in Go
- Stores state in Redis

Notes App
- Offline first mobile client`).profile;
  assert.strictEqual(p.projects.length, 2);
  assert.strictEqual(p.projects[0].name, "TaskFlow");
  assert.strictEqual(p.projects[0].link, "https://github.com/lee/taskflow");
  assert.strictEqual(p.projects[0].description, "Built a job queue in Go Stores state in Redis");
  assert.ok(p.projects[0].skills.includes("Go"));
  assert.strictEqual(p.projects[1].name, "Notes App");
});

// ── contact
test("contact location comes from a short non-contact segment", () => {
  const p = extractProfile("Maria Gonzalez-Ruiz\nMadrid, Spain | maria@example.com | linkedin.com/in/mgr\n\nSKILLS\nPython").profile;
  assert.strictEqual(p.contact.name, "Maria Gonzalez-Ruiz");
  assert.strictEqual(p.contact.location, "Madrid, Spain");
  assert.deepStrictEqual(p.contact.links, ["linkedin.com/in/mgr"]);
});

// ── safety
test("safeExtractProfile returns null for short, empty or non-string input and never throws", () => {
  assert.strictEqual(safeExtractProfile("too short"), null);
  assert.strictEqual(safeExtractProfile("lorem ipsum dolor sit amet, ".repeat(20).toLowerCase()), null);
  assert.strictEqual(safeExtractProfile(undefined as unknown as string), null);
  assert.strictEqual(safeExtractProfile(42 as unknown as string), null);
  assert.ok(safeExtractProfile(ENGINE_RESUME));
});

test("input over the cap is truncated with a warning", () => {
  const big = ENGINE_RESUME + "\n" + "filler line of text\n".repeat(4000);
  assert.ok(big.length > MAX_EXTRACT_CHARS);
  const r = extractProfile(big);
  assert.ok(r.warnings.includes("Resume text was longer than 50,000 characters; only the first 50,000 were read."));
  assert.strictEqual(r.profile.contact.name, "Jane Doe");
});

test("extracting adversarial input finishes quickly", () => {
  const t0 = performance.now();
  extractProfile("a@".repeat(25_000));
  extractProfile(("Mar 2020 - " + "x".repeat(50) + "\n").repeat(900));
  extractProfile("EXPERIENCE\n" + "Role, Co | 2020 - 2021\n- bullet\n".repeat(1500));
  assert.ok(performance.now() - t0 < 2000);
});
