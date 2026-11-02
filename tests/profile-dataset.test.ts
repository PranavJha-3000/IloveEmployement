// Checks that the profile extraction dataset is honest: gold values are present
// in the text they label, people are fictional, and the formats are varied.
import assert from "node:assert";
import { test } from "node:test";
import { AUTHORED } from "../evals/profile/dataset/gold";
import { loadProfileDataset, profileDatasetFingerprint } from "../evals/profile/dataset/load";
import { fmtDate, renderResume, RENDER_STYLES } from "../evals/profile/dataset/render";
import { RESUMES } from "../evals/retrieval/dataset/resumes";
import { StructuredProfileSchema, validateProfile, type StructuredProfile } from "../lib/profile/schema";
import { chunkResume } from "../lib/vault/chunker";

const ds = loadProfileDataset();
const rendered = ds.filter((d) => d.source === "rendered");
const synthetic = ds.filter((d) => d.source === "synthetic");

test("dataset size and sources", () => {
  assert.ok(ds.length >= 11);
  assert.ok(rendered.length >= 8);
  assert.equal(synthetic.length, 3);
  assert.deepEqual(synthetic.map((d) => d.id), ["junior-frontend", "mid-data-analyst", "senior-ops-manager"]);
  synthetic.forEach((d, i) => assert.equal(d.text, RESUMES[i].text));
  assert.equal(new Set(ds.map((d) => d.id)).size, ds.length);
});

test("every gold passes the schema and validateProfile is clean", () => {
  for (const d of ds) {
    StructuredProfileSchema.parse(d.gold);
    assert.deepEqual(validateProfile(d.gold), {}, d.id);
  }
});

function goldStrings(g: StructuredProfile): string[] {
  const out = [g.contact.name, g.contact.email, g.contact.phone, g.contact.location, ...g.contact.links];
  for (const r of g.roles) out.push(r.title, r.company, ...r.bullets);
  for (const e of g.education) out.push(e.degree, e.institution);
  for (const p of g.projects) out.push(p.name);
  return out.filter((s) => s.length > 0);
}

test("gold by construction: every gold value is present verbatim in its text", () => {
  for (const d of ds) {
    for (const s of goldStrings(d.gold)) assert.ok(d.text.includes(s), `${d.id}: "${s}" missing from text`);
    const years: number[] = [];
    for (const r of d.gold.roles) for (const x of [r.start, r.end]) if (x) years.push(x.year);
    for (const e of d.gold.education) for (const y of [e.startYear, e.endYear]) if (y !== null) years.push(y);
    for (const y of years) assert.ok(d.text.includes(String(y)), `${d.id}: year ${y} missing`);
    for (const s of d.gold.skills) for (const raw of s.matchedFrom) assert.ok(d.text.includes(raw), `${d.id}: skill "${raw}" missing`);
  }
});

test("rendered dates carry the gold month in the style's own format", () => {
  for (const a of AUTHORED) {
    const style = RENDER_STYLES.find((s) => s.id === a.styleId)!;
    const d = rendered.find((r) => r.id === a.id)!;
    for (const r of a.gold.roles) {
      if (r.start) assert.ok(d.text.includes(fmtDate(r.start, style.dateStyle)), `${a.id} start`);
      if (r.end) assert.ok(d.text.includes(fmtDate(r.end, style.dateStyle)), `${a.id} end`);
      if (r.current) assert.ok(d.text.includes(style.presentWord), `${a.id} present word`);
    }
    // A year-only style cannot carry months, so gold for it must not claim any.
    if (style.dateStyle === "yyyy") {
      for (const r of a.gold.roles) assert.ok((!r.start || r.start.month === null) && (!r.end || r.end.month === null), a.id);
    }
  }
});

test("every person is fictional", () => {
  const denylist = ["google", "amazon", "microsoft", "meta platforms", "apple", "netflix"];
  for (const d of ds) {
    const c = d.gold.contact;
    assert.match(c.email, /@example\.(com|org|net)$/, d.id);
    assert.ok(c.phone.includes("555-01"), d.id);
    const names = [c.name, ...d.gold.roles.map((r) => r.company), ...d.gold.education.map((e) => e.institution)];
    for (const n of names) for (const bad of denylist) assert.ok(!n.toLowerCase().includes(bad), `${d.id}: ${n}`);
  }
});

test("render styles are distinct and every variation is exercised", () => {
  assert.ok(RENDER_STYLES.length >= 8);
  assert.equal(new Set(RENDER_STYLES.map((s) => s.id)).size, RENDER_STYLES.length);
  const used = new Set(AUTHORED.map((a) => a.styleId));
  assert.ok(used.size >= 8);
  const styles = RENDER_STYLES.filter((s) => used.has(s.id));
  const seen = (pick: (s: (typeof styles)[number]) => string) => new Set(styles.map(pick));
  assert.equal(seen((s) => s.dateStyle).size, 6);
  assert.equal(seen((s) => s.bullet).size, 5);
  assert.equal(seen((s) => s.header).size, 4);
  assert.equal(seen((s) => s.contactLayout).size, 3);
  assert.equal(seen((s) => s.skillsLayout).size, 4);
  assert.equal(seen((s) => s.linkStyle).size, 2);
  assert.equal(seen((s) => s.presentWord).size, 3);
  assert.equal(seen((s) => s.rangeSep).size, 4);
  assert.ok(styles.some((s) => s.uppercaseHeadings) && styles.some((s) => !s.uppercaseHeadings));
});

test("some headings are ones the chunker does not recognise, and some styles put education first", () => {
  const unrecognised = (heading: string) => {
    const probe = `${heading}\nDev, Acme | 2020 – 2021\n• built the api for the whole system today\n• fixed another bug in the whole system\n`;
    return chunkResume(probe).every((c) => c.kind === "summary" || c.kind === "note");
  };
  const styles = RENDER_STYLES.filter((s) => AUTHORED.some((a) => a.styleId === s.id));
  const withOdd = styles.filter((s) => Object.values(s.sectionNames).some((h) => h && unrecognised(h)));
  assert.ok(withOdd.length >= 2, `styles with unrecognised headings: ${withOdd.length}`);
  // Sanity: the probe does recognise a standard heading.
  assert.equal(unrecognised("EXPERIENCE"), false);
  const eduFirst = styles.filter((s) => s.order.indexOf("education") < s.order.indexOf("experience"));
  assert.ok(eduFirst.length >= 2);
});

test("coverage of domains, seniority and special cases", () => {
  const domains = new Set(AUTHORED.map((a) => a.domain));
  for (const d of ["software", "data", "design", "product", "operations", "business"]) assert.ok(domains.has(d as never), d);
  const seniority = new Set(AUTHORED.map((a) => a.seniority));
  for (const s of ["junior", "mid", "senior"]) assert.ok(seniority.has(s as never), s);
  assert.ok(AUTHORED.some((a) => a.gold.roles.some((r) => r.current)), "a current role");
  assert.ok(AUTHORED.some((a) => a.gold.education.length === 0), "no education entry");
  const gap = AUTHORED.some((a) => {
    const rs = a.gold.roles;
    for (let i = 0; i + 1 < rs.length; i++) {
      const later = rs[i].start!;
      const earlier = rs[i + 1].end;
      if (!earlier) continue;
      const months = (later.year - earlier.year) * 12 + ((later.month ?? 1) - (earlier.month ?? 1));
      if (months >= 12) return true;
    }
    return false;
  });
  assert.ok(gap, "a career gap of a year or more");
  const withUnknown = AUTHORED.filter((a) => a.gold.skills.some((s) => s.canonicalId === null));
  assert.ok(withUnknown.length >= 3, `profiles with an unknown skill: ${withUnknown.length}`);
  assert.ok(AUTHORED.some((a) => a.gold.skills.some((s) => s.matchedFrom.some((m) => m !== s.name))), "an alias such as JS or k8s");
});

test("rendering and the fingerprint are deterministic and sensitive", () => {
  for (const a of AUTHORED) {
    const style = RENDER_STYLES.find((s) => s.id === a.styleId)!;
    assert.equal(renderResume(a.gold, style, { summary: a.summary }), renderResume(a.gold, style, { summary: a.summary }));
  }
  const fp = profileDatasetFingerprint();
  assert.equal(fp, profileDatasetFingerprint());
  const edited = loadProfileDataset();
  edited[0].gold = structuredClone(edited[0].gold);
  edited[0].gold.roles[0].bullets[0] += " (edited)";
  assert.notEqual(profileDatasetFingerprint(edited), fp);
});
