// ─── Eval runner ─────────────────────────────────────────────────────────────
// npm run eval            → run every case against EVAL_PROVIDER / EVAL_MODEL
// npm run eval -- --dry   → list cases without calling a model
// npm run eval -- fit     → only cases whose id contains "fit"
//
// Writes evals/results/<model>-<timestamp>.json and evals/REPORT.md.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPreset } from "../lib/engine/run";
import type { RunMeta } from "../lib/engine/types";
import { getPresetById } from "../lib/presets";
import { DEFAULT_VAULT_LIMIT } from "../lib/presets/types";
import type { ProviderId } from "../lib/types";
import { chunkResume } from "../lib/vault/chunker";
import { retrieveVault } from "../lib/vault/retrieve";
import { CASES } from "./cases";

interface CaseResult {
  id: string;
  presetId: string;
  passed: boolean;
  failures: string[];
  error?: string;
  ms: number;
  tokens: number;
  injectionFlags: number;
  droppedCitations: number;
  unsupportedFigureWarnings: number;
  reviewIssues: number;
  revised: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const filter = args.find((a) => !a.startsWith("--"));
  const cases = CASES.filter((c) => !filter || c.id.includes(filter));

  if (dry) {
    for (const c of cases) console.log(`${c.id.padEnd(26)} ${c.presetId.padEnd(24)} ${c.description}`);
    console.log(`\n${cases.length} case(s).`);
    return;
  }

  const provider = (process.env.EVAL_PROVIDER || "google") as ProviderId;
  const apiKey = process.env.EVAL_API_KEY || "";
  const model = process.env.EVAL_MODEL || "";
  if (!apiKey) {
    console.error("Set EVAL_API_KEY (and optionally EVAL_PROVIDER, EVAL_MODEL, EVAL_BASE_URL) to run evals. Use --dry to list cases.");
    process.exit(1);
  }
  const config = { provider, apiKey, model, baseUrl: process.env.EVAL_BASE_URL || undefined };

  const results: CaseResult[] = [];
  for (const c of cases) {
    const preset = getPresetById(c.presetId);
    if (!preset) throw new Error(`Unknown preset ${c.presetId}`);
    const chunks = c.resume ? chunkResume(c.resume) : [];
    const vault = preset.usesVault ? retrieveVault(chunks, preset.vaultQuery(c.inputs), preset.vaultLimit ?? DEFAULT_VAULT_LIMIT) : [];

    const started = Date.now();
    const outcome = await runPreset(preset, { inputs: c.inputs, vault, profile: { name: "Priya Sharma" }, config }, "eval");
    const ms = Date.now() - started;

    if (!outcome.ok) {
      results.push({ id: c.id, presetId: c.presetId, passed: false, failures: [], error: outcome.message, ms, tokens: 0, injectionFlags: 0, droppedCitations: 0, unsupportedFigureWarnings: 0, reviewIssues: 0, revised: false });
      console.log(`✗ ${c.id}: error: ${outcome.message}`);
      continue;
    }

    const { data, meta } = outcome.result as { data: Record<string, unknown>; meta: RunMeta };
    let failures: string[];
    try {
      failures = c.expect(data, meta);
    } catch (err) {
      failures = [`expectation threw: ${(err as Error).message}`];
    }
    const result: CaseResult = {
      id: c.id,
      presetId: c.presetId,
      passed: failures.length === 0,
      failures,
      ms,
      tokens: (meta.usage?.promptTokens ?? 0) + (meta.usage?.completionTokens ?? 0),
      injectionFlags: meta.injection.reduce((n, i) => n + i.findings.length, 0),
      droppedCitations: meta.grounding.filter((g) => g.startsWith("Dropped")).length,
      unsupportedFigureWarnings: meta.grounding.filter((g) => g.includes("figures")).length,
      reviewIssues: meta.review?.issues.filter((i) => i.severity !== "low").length ?? 0,
      revised: meta.review?.revised ?? false,
    };
    results.push(result);
    console.log(`${result.passed ? "✓" : "✗"} ${c.id} (${ms} ms)${failures.length ? `\n    ${failures.join("\n    ")}` : ""}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length / 2)] ?? 0;
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0;
  const summary = {
    model: `${provider}/${model || "default"}`,
    date: new Date().toISOString(),
    passed,
    total: results.length,
    passRate: results.length ? Math.round((passed / results.length) * 100) : 0,
    p50Ms: p50,
    p95Ms: p95,
    totalTokens: results.reduce((n, r) => n + r.tokens, 0),
    droppedCitations: results.reduce((n, r) => n + r.droppedCitations, 0),
    unsupportedFigureWarnings: results.reduce((n, r) => n + r.unsupportedFigureWarnings, 0),
    reviewerCaughtIssues: results.reduce((n, r) => n + r.reviewIssues, 0),
  };

  const dir = join(process.cwd(), "evals", "results");
  mkdirSync(dir, { recursive: true });
  const stamp = summary.date.replace(/[:.]/g, "-");
  writeFileSync(join(dir, `${summary.model.replace(/[^\w.-]+/g, "_")}-${stamp}.json`), JSON.stringify({ summary, results }, null, 2));

  const md = [
    "# Eval report",
    "",
    `Model **${summary.model}** · ${summary.date}`,
    "",
    `**${summary.passed}/${summary.total} cases passed (${summary.passRate}%)** · p50 ${p50} ms · p95 ${p95} ms · ${summary.totalTokens.toLocaleString()} tokens`,
    "",
    "Guardrail activity across the run (things the pipeline caught after generation):",
    `- Fabricated citations dropped: ${summary.droppedCitations}`,
    `- Unsupported-figure warnings: ${summary.unsupportedFigureWarnings}`,
    `- Reviewer issues (high/medium) caught before the user saw them: ${summary.reviewerCaughtIssues}`,
    "",
    "| Case | Preset | Result | ms | Notes |",
    "|---|---|---|---|---|",
    ...results.map((r) => `| ${r.id} | ${r.presetId} | ${r.passed ? "pass" : "FAIL"} | ${r.ms} | ${(r.error ? `error: ${r.error}` : r.failures.join("; ")).replace(/\|/g, "/")} |`),
    "",
  ].join("\n");
  writeFileSync(join(process.cwd(), "evals", "REPORT.md"), md);

  console.log(`\n${passed}/${results.length} passed · p50 ${p50} ms · report: evals/REPORT.md`);
  process.exitCode = passed === results.length ? 0 : 1;
}

void main();
