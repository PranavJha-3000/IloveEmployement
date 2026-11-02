// Profile extraction eval runner.
// Flags: --ci, --update-baseline, --dataset-changed, --report <path>, --llm (see llm.ts: needs --yes
// when it would spend requests; never combined with --ci). The deterministic paths never construct a model.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { extractProfile, EXTRACTOR_VERSION } from "../../lib/profile/extract";
import { TAXONOMY_VERSION } from "../../lib/skills/taxonomy";
import { compareProfileBaseline, validateProfileBaseline, type ProfileBaseline } from "./baseline";
import { loadProfileDataset, profileDatasetFingerprint } from "./dataset/load";
import { runLlmCommand } from "./llm";
import { FIELD_KEYS, aggregateCounts, prf, scoreProfile, type FieldCounts } from "./metrics";
import { renderProfileReport, type LlmProfileSection, type ProfileRunResult } from "./report";

const BASELINE_PATH = path.join("evals", "profile", "baseline.json");
const LLM_LATEST_PATH = path.join("evals", "results", "profile-llm-latest.json");
const UPDATE_CMD = "npm run eval:profile -- --update-baseline --dataset-changed";

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const rate = (r: { hit: number; total: number }) => (r.total > 0 ? Math.round((r.hit / r.total) * 10000) / 10000 : null);

function toBaselineBody(r: ProfileRunResult): Omit<ProfileBaseline, "recordedAt"> {
  const fields = {} as ProfileBaseline["fields"];
  for (const k of FIELD_KEYS) {
    const m = prf(r.overall[k]);
    fields[k] = { precision: m.precision, recall: m.recall, support: m.support };
  }
  return {
    kind: "profile-deterministic",
    fingerprint: r.datasetFingerprint,
    extractorVersion: r.extractorVersion,
    taxonomyVersion: r.taxonomyVersion,
    fields,
    exact: { contact: rate(r.overall.exact.contact), roles: rate(r.overall.exact.roles) },
  };
}

/** The measured LLM section from the last --llm run, only when it describes this exact dataset and extractor. */
function loadMeasuredLlm(fingerprint: string): LlmProfileSection | null {
  try {
    if (!fs.existsSync(LLM_LATEST_PATH)) return null;
    const j = JSON.parse(fs.readFileSync(LLM_LATEST_PATH, "utf8")) as {
      datasetFingerprint?: string;
      extractorVersion?: string;
      taxonomyVersion?: string;
      section?: LlmProfileSection;
    };
    if (j.datasetFingerprint !== fingerprint || j.extractorVersion !== EXTRACTOR_VERSION || j.taxonomyVersion !== TAXONOMY_VERSION) return null;
    return j.section && Array.isArray(j.section.models) ? j.section : null;
  } catch {
    return null;
  }
}

export async function main(argv: string[]): Promise<number> {
  const ci = argv.includes("--ci");
  const update = argv.includes("--update-baseline");
  const datasetChanged = argv.includes("--dataset-changed");
  const llm = argv.includes("--llm");
  const reportPath = argValue(argv, "--report") ?? path.join("evals", "PROFILE.md");

  if (llm && ci) {
    console.error("The CI gate is deterministic only.");
    return 2;
  }
  if (llm && update) {
    console.error("--llm cannot be combined with --update-baseline.");
    return 2;
  }

  let measured: LlmProfileSection | null = null;
  let llmExit = 0;
  if (llm) {
    const out = await runLlmCommand(argv);
    if (!out.section) return out.code;
    measured = out.section;
    llmExit = out.code;
  }

  const dataset = loadProfileDataset();
  const per = dataset.map((d) => ({
    id: d.id,
    source: d.source,
    styleId: d.styleId,
    counts: scoreProfile(extractProfile(d.text).profile, d.gold),
  }));
  const of = (s: "rendered" | "synthetic"): FieldCounts => aggregateCounts(per.filter((p) => p.source === s).map((p) => p.counts));

  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    /* keep unknown */
  }

  const result: ProfileRunResult = {
    generatedAt: new Date().toISOString(),
    command: argv.join(" "),
    gitSha,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    datasetFingerprint: profileDatasetFingerprint(dataset),
    extractorVersion: EXTRACTOR_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    resumes: per,
    overall: aggregateCounts(per.map((p) => p.counts)),
    bySource: { rendered: of("rendered"), synthetic: of("synthetic") },
    llm: { status: "pending" },
  };

  if (measured) {
    fs.mkdirSync(path.join("evals", "results"), { recursive: true });
    fs.writeFileSync(
      LLM_LATEST_PATH,
      JSON.stringify(
        {
          datasetFingerprint: result.datasetFingerprint,
          extractorVersion: result.extractorVersion,
          taxonomyVersion: result.taxonomyVersion,
          generatedAt: result.generatedAt,
          section: measured,
        },
        null,
        2,
      ),
    );
  }
  const section = measured ?? (ci || update ? null : loadMeasuredLlm(result.datasetFingerprint));
  if (section) result.llm = section;

  console.log(["field", "precision", "recall", "f1", "support"].join("\t"));
  for (const k of FIELD_KEYS) {
    const m = prf(result.overall[k]);
    const f = (v: number | null) => (v === null ? "n/a" : v.toFixed(3));
    console.log([k, f(m.precision), f(m.recall), f(m.f1), m.support].join("\t"));
  }

  if (update) {
    const next: ProfileBaseline = { ...toBaselineBody(result), recordedAt: result.generatedAt };
    if (fs.existsSync(BASELINE_PATH)) {
      let old: unknown = null;
      try {
        old = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
      } catch {
        /* treated as invalid below */
      }
      const valid = validateProfileBaseline(old);
      if (valid.ok) {
        const changed =
          valid.baseline.fingerprint !== next.fingerprint ||
          valid.baseline.extractorVersion !== next.extractorVersion ||
          valid.baseline.taxonomyVersion !== next.taxonomyVersion;
        const cmp = compareProfileBaseline(valid.baseline, {
          ...toBaselineBody(result),
          fingerprint: valid.baseline.fingerprint,
          extractorVersion: valid.baseline.extractorVersion,
          taxonomyVersion: valid.baseline.taxonomyVersion,
        });
        for (const r of cmp.regressions) console.log(`WARNING baseline would drop: ${r}`);
        if (changed && !datasetChanged) {
          console.error("Refusing to re-record the baseline: dataset fingerprint or version changed. Pass --dataset-changed to confirm, and commit baseline.json with the change.");
          return 1;
        }
      } else {
        console.error(`previous baseline.json is invalid: ${valid.problems.join("; ")}. Restore it from git or pass --dataset-changed to re-record.`);
        if (!datasetChanged) return 1;
      }
    }
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(`Baseline written to ${BASELINE_PATH}. Commit it with an explanation of why it changed.`);
    return 0;
  }

  if (ci) {
    if (!fs.existsSync(BASELINE_PATH)) {
      console.error(`No baseline recorded; run ${UPDATE_CMD}`);
      return 1;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    } catch (err) {
      console.error(`INVALID BASELINE could not parse ${BASELINE_PATH}: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    const valid = validateProfileBaseline(parsed);
    if (!valid.ok) {
      for (const p of valid.problems) console.error(`INVALID BASELINE ${p}`);
      console.error(`Run ${UPDATE_CMD}`);
      return 1;
    }
    const cmp = compareProfileBaseline(valid.baseline, toBaselineBody(result));
    for (const r of cmp.regressions) console.error(`REGRESSION ${r}`);
    for (const i of cmp.improvements) console.log(`improvement ${i} (consider re-recording the baseline)`);
    if (cmp.ok) console.log("Profile baseline gate passed (deterministic extractor).");
    return cmp.ok ? 0 : 1;
  }

  const resultsDir = path.join("evals", "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, "profile-latest.json"), JSON.stringify(result, null, 2));
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, renderProfileReport(result));
  console.log(`Report written to ${reportPath}`);
  return llmExit;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    },
  );
}
