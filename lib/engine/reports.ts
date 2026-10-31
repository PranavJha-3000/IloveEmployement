// ─── Report Schemas & Finalizers ─────────────────────────────────────────────
// One entry per ReportKind:
//   schema    — what the model must return (validated by generateObject)
//   finalize  — deterministic post-processing: scores, verdicts, citation
//               scrubbing, quote verification, keyword coverage
//   generated — the text the model wrote, for the invented-figure check
// Isomorphic (no server imports) so result types can be shared with the UI.

import { z } from "zod";
import { containsTerm, formatChecks, keywordCoverage, scoreRequirements } from "./scoring";
import type { ReportKind } from "../presets/types";

const evidence = z.enum(["STRONG", "PARTIAL", "MISSING", "UNVERIFIED"]);
const importance = z.enum(["must", "nice"]);
const severity = z.enum(["high", "medium", "low"]);
const chunkIds = z.array(z.string()).describe("Exact ids of the Career Vault chunks that support this. Empty if none.");

const requirement = z.object({
  requirement: z.string().describe("A substantive requirement from the job, in a few words"),
  importance,
  evidence: evidence.describe(
    "STRONG = the capability is concretely demonstrated; PARTIAL = adjacent or smaller-scale evidence; MISSING = no evidence of the capability anywhere; UNVERIFIED = a source was referenced but couldn't be inspected",
  ),
  proof: z.string().describe("What in the user's material supports this, quoted or closely paraphrased. Empty when MISSING."),
  chunkIds,
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const REPORT_SCHEMAS = {
  fit: z.object({
    headline: z.string().describe("One honest line on the fit; dry wit allowed, never mean"),
    summary: z.string().describe("2–4 sentences, no flattery, no doom"),
    requirements: z.array(requirement).describe("8–14 substantive requirements; skip boilerplate"),
    strengths: z.array(z.object({ text: z.string(), chunkIds })).describe("What to lead with, each backed by vault evidence"),
    gaps: z.array(z.object({ gap: z.string(), severity, howToAddress: z.string() })),
    interviewRisks: z.array(z.string()).describe("Topics where the interviewer will probe a real gap"),
  }),
  jd: z.object({
    realRole: z.string().describe("What the job actually is, in one plain sentence"),
    seniority: z.string(),
    summary: z.string(),
    mustHaves: z.array(z.string()),
    niceToHaves: z.array(z.string()),
    translations: z.array(z.object({ phrase: z.string(), meaning: z.string(), confidence: z.enum(["low", "medium", "high"]) })),
    redFlags: z.array(
      z.object({
        flag: z.string(),
        quote: z.string().describe("The exact text from the posting this is based on, copied verbatim"),
        severity,
        askInInterview: z.string(),
      }),
    ),
    greenFlags: z.array(z.object({ signal: z.string(), quote: z.string().describe("Verbatim text from the posting") })),
    missingInfo: z.array(z.string()).describe("Important things the posting doesn't say (pay, location, team, level…)"),
    questionsToAsk: z.array(z.string()),
  }),
  gap: z.object({
    summary: z.string(),
    requirements: z.array(requirement),
    transferable: z.array(z.object({ from: z.string(), coversFor: z.string(), why: z.string(), chunkIds })),
    plan: z.array(
      z.object({
        skill: z.string(),
        priority: z.number().int().min(1).max(5).describe("1 = do first"),
        route: z.enum(["reframe", "project", "learn", "long-term"]).describe("reframe = evidence exists but is buried; project = build proof; learn = study enough to discuss; long-term = needs real experience"),
        why: z.string(),
        actions: z.array(z.string()).describe("Specific, doable steps; never 'add it to your resume' without evidence"),
        timeframe: z.string(),
      }),
    ),
  }),
  ats: z.object({
    jobTitle: z.string(),
    keywords: z
      .array(
        z.object({
          term: z.string().describe("A hard skill, tool, certification or title term an ATS would match on"),
          importance,
          synonyms: z.array(z.string()).describe("Equivalent spellings/abbreviations, e.g. 'k8s' for Kubernetes"),
          evidencedBy: chunkIds.describe("Vault chunks showing the user genuinely has this, even if worded differently. Empty if not."),
        }),
      )
      .describe("12–25 keywords"),
    titleAlignment: z.string().describe("How the user's titles line up with the job title, and whether a truthful headline tweak would help"),
    advice: z.array(z.string()),
  }),
  resume: z.object({
    headline: z.string().describe("A target headline under the name, truthful to the user's experience"),
    summary: z.object({ text: z.string(), chunkIds }),
    sections: z.array(
      z.object({
        title: z.string(),
        entries: z.array(
          z.object({
            heading: z.string().describe("Role, organisation and dates exactly as in the source"),
            bullets: z.array(
              z.object({
                text: z.string(),
                chunkIds,
                change: z.enum(["kept", "reworded", "tailored", "reordered"]),
              }),
            ),
          }),
        ),
      }),
    ),
    skills: z.array(z.string()).describe("Only skills present in the user's material, most relevant first"),
    changes: z.array(z.string()).describe("The most important changes made, and why"),
    gapsLeft: z.array(z.string()).describe("Job requirements deliberately NOT added because there is no evidence"),
  }),
  bullets: z.object({
    bullets: z.array(
      z.object({
        original: z.string(),
        problem: z.string(),
        rewrites: z.array(z.object({ text: z.string(), angle: z.string() })),
        askForMetric: z.string().describe("A question that would let the user add a real number. Empty if the bullet already has one."),
      }),
    ),
    patterns: z.array(z.string()).describe("Recurring weaknesses across the bullets"),
  }),
  linkedin: z.object({
    headlines: z.array(z.object({ text: z.string(), angle: z.string() })),
    about: z.string(),
    experience: z.array(z.object({ role: z.string(), text: z.string(), chunkIds })),
    topSkills: z.array(z.string()),
    featuredIdeas: z.array(z.string()),
    quickFixes: z.array(z.string()),
  }),
  proof: z.object({
    summary: z.string(),
    claims: z.array(
      z.object({
        claim: z.string().describe("A claim from the user's resume, quoted"),
        chunkIds,
        evidence,
        proof: z.string().describe("What backs it up, or what is missing"),
        sourceRefs: z.array(z.string()).describe("Names of external items (e.g. GitHub repos) that support it, exactly as listed"),
        fix: z.string().describe("How to make the claim provable or more precise; never 'remove it' unless it's unsupportable"),
      }),
    ),
    strongestProof: z.array(z.string()),
  }),
} satisfies Record<ReportKind, z.ZodTypeAny>;

export type ReportOutput<K extends ReportKind> = z.infer<(typeof REPORT_SCHEMAS)[K]>;

// ─── Finalizers ──────────────────────────────────────────────────────────────

export interface FinalizeContext {
  validIds: Set<string>;
  /** All of the user's own material: inputs + vault text. */
  sourceText: string;
  /** The resume as plain text (pasted, or the vault joined). */
  resumeText: string;
  /** The resume exactly as pasted/uploaded; null when only vault chunks were sent. */
  rawResume: string | null;
  inputs: Record<string, string>;
  /** Names of external items fetched for the run (e.g. repo names). */
  externalRefs: Set<string>;
}

const scrub = (ids: string[], ctx: FinalizeContext) => ids.filter((id) => ctx.validIds.has(id));

function quoteInText(quote: string, text: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const q = n(quote);
  return q.length > 0 && n(text).includes(q);
}

export const FINALIZERS = {
  fit: (o: ReportOutput<"fit">, ctx: FinalizeContext) => {
    const requirements = o.requirements.map((r) => ({ ...r, chunkIds: scrub(r.chunkIds, ctx) }));
    return { ...o, requirements, strengths: o.strengths.map((s) => ({ ...s, chunkIds: scrub(s.chunkIds, ctx) })), score: scoreRequirements(requirements) };
  },
  jd: (o: ReportOutput<"jd">, ctx: FinalizeContext) => {
    const jd = ctx.inputs.jobDescription ?? "";
    const redFlags = o.redFlags.map((f) => ({ ...f, quoteVerified: quoteInText(f.quote, jd) }));
    const greenFlags = o.greenFlags.map((f) => ({ ...f, quoteVerified: quoteInText(f.quote, jd) }));
    const penalty =
      redFlags.reduce((sum, f) => sum + (f.quoteVerified ? { high: 18, medium: 9, low: 4 }[f.severity] : 2), 0) + o.missingInfo.length * 4;
    const quality = Math.max(0, Math.min(100, 100 - penalty + greenFlags.filter((g) => g.quoteVerified).length * 3));
    return { ...o, redFlags, greenFlags, quality };
  },
  gap: (o: ReportOutput<"gap">, ctx: FinalizeContext) => {
    const requirements = o.requirements.map((r) => ({ ...r, chunkIds: scrub(r.chunkIds, ctx) }));
    return {
      ...o,
      requirements,
      transferable: o.transferable.map((t) => ({ ...t, chunkIds: scrub(t.chunkIds, ctx) })),
      plan: [...o.plan].sort((a, b) => a.priority - b.priority),
      score: scoreRequirements(requirements),
    };
  },
  ats: (o: ReportOutput<"ats">, ctx: FinalizeContext) => {
    const keywords = o.keywords.map((k) => ({ ...k, evidencedBy: scrub(k.evidencedBy, ctx) }));
    const coverage = keywordCoverage(ctx.resumeText, keywords);
    // Layout checks need the real document text; vault chunks have lost it.
    const format = ctx.rawResume ? formatChecks(ctx.rawResume) : null;
    const atsScore = format ? Math.round(coverage.score * 0.7 + format.score * 0.3) : coverage.score;
    return { ...o, keywords, coverage, format, atsScore };
  },
  resume: (o: ReportOutput<"resume">, ctx: FinalizeContext) => {
    let unsourced = 0;
    const sections = o.sections.map((s) => ({
      ...s,
      entries: s.entries.map((e) => ({
        ...e,
        bullets: e.bullets.map((b) => {
          const ids = scrub(b.chunkIds, ctx);
          if (!ids.length) unsourced += 1;
          return { ...b, chunkIds: ids };
        }),
      })),
    }));
    const hay = ` ${ctx.sourceText.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ")} `;
    const unsupportedSkills = o.skills.filter((s) => !containsTerm(hay, s));
    return {
      ...o,
      summary: { ...o.summary, chunkIds: scrub(o.summary.chunkIds, ctx) },
      sections,
      skills: o.skills.filter((s) => !unsupportedSkills.includes(s)),
      audit: { unsourcedBullets: unsourced, removedSkills: unsupportedSkills },
    };
  },
  bullets: (o: ReportOutput<"bullets">) => o,
  linkedin: (o: ReportOutput<"linkedin">, ctx: FinalizeContext) => ({
    ...o,
    experience: o.experience.map((e) => ({ ...e, chunkIds: scrub(e.chunkIds, ctx) })),
  }),
  proof: (o: ReportOutput<"proof">, ctx: FinalizeContext) => ({
    ...o,
    claims: o.claims.map((c) => ({
      ...c,
      chunkIds: scrub(c.chunkIds, ctx),
      sourceRefs: c.sourceRefs.filter((r) => ctx.externalRefs.has(r.toLowerCase())),
    })),
  }),
} satisfies { [K in ReportKind]: (o: ReportOutput<K>, ctx: FinalizeContext) => unknown };

export type ReportResult<K extends ReportKind> = ReturnType<(typeof FINALIZERS)[K]>;

/** Text the model wrote (not quotes of the user's material), for the invented-figure check. */
export function generatedText(kind: ReportKind, o: Record<string, unknown>): string {
  switch (kind) {
    case "resume": {
      const r = o as ReportOutput<"resume">;
      return [r.headline, r.summary.text, ...r.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.text)))].join("\n");
    }
    case "bullets":
      return (o as ReportOutput<"bullets">).bullets.flatMap((b) => b.rewrites.map((r) => r.text)).join("\n");
    case "linkedin": {
      const l = o as ReportOutput<"linkedin">;
      return [...l.headlines.map((h) => h.text), l.about, ...l.experience.map((e) => e.text)].join("\n");
    }
    default:
      return "";
  }
}
