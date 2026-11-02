// Offline tests of resumeToText and the tailored version builders.
import assert from "node:assert";
import { test } from "node:test";
import { resumeToText } from "../lib/engine/resumeText";
import type { ReportResult } from "../lib/engine/reports";
import { jobHintFromJd, tailoredVersionFromAgentRun, tailoredVersionFromTool } from "../lib/vault/tailoredVersion";
import { ResumeVersionSchema } from "../lib/vault/versions";

const fixture = {
  headline: "Backend Engineer",
  summary: { text: "Builds payments systems.", chunkIds: [] },
  sections: [
    {
      title: "Experience",
      entries: [{ heading: "Engineer, Acme (2020-2024)", bullets: [{ text: "Cut latency 30%", chunkIds: [], change: "kept" }, { text: "Shipped refunds API", chunkIds: [], change: "tailored" }] }],
    },
  ],
  skills: ["Go", "SQL"],
  changes: [],
  gapsLeft: [],
} as unknown as ReportResult<"resume">;

test("resumeToText renders the plain-text resume exactly", () => {
  assert.equal(
    resumeToText(fixture, "Asha Rao"),
    "Asha Rao\nBackend Engineer\n\nSUMMARY\nBuilds payments systems.\n\nEXPERIENCE\nEngineer, Acme (2020-2024)\n• Cut latency 30%\n• Shipped refunds API\n\nSKILLS\nGo, SQL",
  );
});

test("jobHintFromJd takes the first line and cuts at a separator", () => {
  assert.deepEqual(jobHintFromJd("Senior Backend Engineer — Payments Platform\nMore text"), { title: "Senior Backend Engineer", company: "" });
  assert.deepEqual(jobHintFromJd("\n\n  Data Analyst | Remote\n"), { title: "Data Analyst", company: "" });
  assert.deepEqual(jobHintFromJd(""), { title: "", company: "" });
  assert.equal(jobHintFromJd("x".repeat(200)).title.length, 80);
});

test("tailoredVersionFromTool builds a valid tailored version", () => {
  const v = tailoredVersionFromTool({ text: "Resume text", job: { title: "Dev", company: "Acme", url: "https://acme.example/j/1" }, now: 5 });
  assert.ok(ResumeVersionSchema.safeParse(v).success);
  assert.equal(v.kind, "tailored");
  assert.equal(v.origin, "tailor-tool");
  assert.equal(v.label, "Tailored: Dev, Acme");
  assert.equal(v.job?.url, "https://acme.example/j/1");
});

test("tailoredVersionFromAgentRun is idempotent per run", () => {
  const a = tailoredVersionFromAgentRun({ runId: "run-1", text: "one", job: { title: "Dev", company: "Acme" }, now: 1 });
  const b = tailoredVersionFromAgentRun({ runId: "run-1", text: "two", job: { title: "Dev", company: "Acme" }, now: 2 });
  assert.equal(a.id, "agent-run-1");
  assert.equal(a.id, b.id);
  assert.equal(a.origin, "agent");
  assert.equal(a.sourceRunId, "run-1");
});

test("non-http posting links are dropped", () => {
  const v = tailoredVersionFromTool({ text: "t", job: { title: "Dev", company: "Acme", url: "javascript:alert(1)" }, now: 1 });
  assert.equal(v.job?.url, undefined);
  assert.ok(ResumeVersionSchema.safeParse(v).success);
});
