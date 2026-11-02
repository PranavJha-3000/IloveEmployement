// ─── Report Schemas & Finalizers ─────────────────────────────────────────────
// One entry per ReportKind:
//   schema    — what the model must return (validated by generateObject)
//   finalize  — deterministic post-processing: scores, verdicts, citation
//               scrubbing, quote verification, keyword coverage
//   generated — the text the model wrote, for the invented-figure check
// Isomorphic (no server imports) so result types can be shared with the UI.

import { z } from "zod";
import { answerSignals, applySkillEvidence, formatChecks, keywordCoverage, offerTotals, scoreRequirements, skillInText } from "./scoring";
import type { ReportKind } from "../presets/types";
import { ModelProfileSchema, refinedResult } from "../profile/refine";

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
  prep: z.object({
    recruiterScan: z.object({
      firstImpression: z.string().describe("What a recruiter notices in the first few seconds of the resume, for this job"),
      theyWillLookFor: z.array(z.string()),
      makeOrBreak: z.string().describe("The single factor most likely to decide keep-reading vs move-on"),
    }),
    questions: z
      .array(
        z.object({
          question: z.string(),
          category: z.enum(["behavioral", "technical", "role", "motivation", "curveball"]),
          why: z.string().describe("What the interviewer is really probing"),
          risk: severity.describe("How exposed the user is, given their actual evidence"),
          answerPlan: z.string().describe("A truthful plan for answering, rooted in the user's real experience"),
          storyHint: z.string().describe("Which of the user's experiences to use. Empty if none fits"),
          chunkIds,
        }),
      )
      .describe("10–14 questions this interviewer is likely to ask, mixing categories"),
    weakSpots: z.array(z.object({ topic: z.string(), whyExposed: z.string(), honestBridge: z.string().describe("How to acknowledge the gap and bridge to real adjacent strength") })),
    questionsToAsk: z.array(z.string()).describe("Sharp questions for the user to ask them"),
  }),
  star: z.object({
    title: z.string(),
    question: z.string().describe("The interview question this story answers best"),
    situation: z.string(),
    task: z.string(),
    action: z.string().describe("What the USER did, in first person singular"),
    result: z.string().describe("The outcome; only real numbers, otherwise a [placeholder]"),
    spoken: z.string().describe("The story as said aloud in 60–120 seconds"),
    chunkIds,
    missing: z.array(z.string()).describe("Questions whose answers would make the story stronger"),
    alsoAnswers: z.array(z.string()).describe("Other common questions this story can answer"),
  }),
  mockPlan: z.object({
    opener: z.string().describe("How the interviewer opens, in character"),
    questions: z
      .array(z.object({ question: z.string(), intent: z.string(), difficulty: z.enum(["warmup", "standard", "hard", "final"]) }))
      .describe("5–6 questions, escalating, ending with the hardest one for this candidate"),
  }),
  answerEval: z.object({
    scores: z.object({
      structure: z.number().int().min(1).max(5),
      specificity: z.number().int().min(1).max(5),
      relevance: z.number().int().min(1).max(5),
      ownership: z.number().int().min(1).max(5).describe("Is it clear what the candidate personally did?"),
      credibility: z.number().int().min(1).max(5).describe("Consistent with the candidate's material, no overclaiming"),
    }),
    whatWorked: z.array(z.string()),
    fix: z.array(z.string()).describe("The 1–3 changes that would most improve this answer"),
    strongerAnswer: z.string().describe("A better version using only facts from the answer and the Career Vault; [placeholders] for unknowns"),
    followUp: z.string().describe("The follow-up question a sharp interviewer would ask next"),
    chunkIds,
  }),
  offers: z.object({
    currency: z.string().describe("e.g. INR, USD. If offers use different currencies, say so in tradeoffs"),
    offers: z.array(
      z.object({
        name: z.string(),
        title: z.string(),
        base: z.number().describe("Annual fixed/base pay as a plain number in full units (₹32 LPA → 3200000). 0 if not stated"),
        baseQuote: z.string().describe("The exact text the base comes from, copied verbatim. Empty if not stated"),
        variablePct: z.number().describe("Target variable/bonus as % of base. 0 if not stated"),
        variableQuote: z.string(),
        joiningBonus: z.number(),
        joiningQuote: z.string(),
        otherCash: z.number().describe("Relocation, retention or other one-time cash"),
        otherCashQuote: z.string(),
        equityKind: z.enum(["rsu", "options", "none"]),
        equityGrantValue: z.number().describe("Total grant value as stated by the company, full units. 0 if only unit counts are given"),
        equityVestYears: z.number(),
        equityQuote: z.string(),
        nonCash: z.array(z.string()).describe("Remote policy, leave, insurance, learning budget, etc."),
        risks: z.array(z.string()).describe("Clawbacks, long notice, unclear variable payout, early-stage risk"),
      }),
    ),
    current: z.object({ total: z.number().describe("Current annual compensation, 0 if not given"), quote: z.string() }),
    equityExplainer: z.string().describe("Plain-English explanation of the equity in these offers: RSU vs options, vesting, cliff, liquidity"),
    tradeoffs: z.array(z.string()),
    questionsToClarify: z.array(z.string()).describe("What to ask each company before deciding"),
  }),
  roast: z.object({
    headline: z.string().describe("One savage-but-fair line about the resume as a document"),
    dimensions: z
      .array(z.object({ name: z.string(), score: z.number().int().min(1).max(10), comment: z.string() }))
      .describe("The 4–5 dimensions named in the task, each scored 1–10 (10 = excellent)"),
    burns: z
      .array(
        z.object({
          quote: z.string().describe("Exact text from the resume being roasted, copied verbatim"),
          burn: z.string().describe("The joke, about the text, never the person"),
          realFix: z.string().describe("The genuinely useful fix"),
        }),
      )
      .describe("5–8 roasts, each anchored to a verbatim quote"),
    buriedGold: z.array(z.string()).describe("Strong things the resume undersells"),
    topFixes: z.array(z.string()),
  }),
  court: z.object({
    caseTitle: z.string().describe("e.g. 'The People v. Your Resume'"),
    charges: z
      .array(
        z.object({
          claim: z.string().describe("A claim from the resume, copied verbatim"),
          charge: z.string().describe("The comedic charge, e.g. 'Buzzword possession with intent to impress'"),
          evidence,
          prosecution: z.string(),
          defense: z.string().describe("The best honest defence from the user's own material"),
          sentence: z.string().describe("The real fix that would make the claim stand up"),
          chunkIds,
        }),
      )
      .describe("5–8 claims on trial"),
    closing: z.string(),
  }),
  aura: z.object({
    archetype: z.string().describe("A playful career archetype, e.g. 'Quiet Backend Assassin'"),
    vibe: z.string().describe("Two sentences on the overall career aura"),
    components: z
      .array(
        z.object({
          name: z.string(),
          points: z.number().int().min(-500).max(500).describe("Aura points gained (+) or lost (−) for this, grounded in the material"),
          reason: z.string(),
          chunkIds,
        }),
      )
      .describe("6–10 aura events from the user's real career material"),
    glowUp: z.array(z.string()).describe("Concrete moves that would raise the aura"),
  }),
  bingo: z.object({
    squares: z
      .array(z.object({ phrase: z.string().describe("Short, 1–5 words"), quote: z.string().describe("Verbatim text it was found in; empty for the classic board") }))
      .describe("Exactly 24 phrases"),
    commentary: z.string(),
  }),
  // Model-facing profile shape: deliberately no confidence field (FINALIZERS.profile computes it).
  profile: ModelProfileSchema,
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
    // DOC-02: a MISSING the resume provably satisfies under an alias is corrected to PARTIAL by code.
    const requirements = applySkillEvidence(
      o.requirements.map((r) => ({ ...r, chunkIds: scrub(r.chunkIds, ctx) })),
      ctx.resumeText,
    );
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
    const requirements = applySkillEvidence(
      o.requirements.map((r) => ({ ...r, chunkIds: scrub(r.chunkIds, ctx) })),
      ctx.resumeText,
    );
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
    // A skill is supported when the source has it under its own name or any taxonomy alias ("k8s" supports "Kubernetes").
    const unsupportedSkills = o.skills.filter((s) => !skillInText(s, ctx.sourceText));
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
  prep: (o: ReportOutput<"prep">, ctx: FinalizeContext) => ({
    ...o,
    questions: o.questions.map((q) => ({ ...q, chunkIds: scrub(q.chunkIds, ctx) })),
  }),
  star: (o: ReportOutput<"star">, ctx: FinalizeContext) => ({
    ...o,
    chunkIds: scrub(o.chunkIds, ctx),
    signals: answerSignals(o.spoken),
  }),
  mockPlan: (o: ReportOutput<"mockPlan">) => o,
  answerEval: (o: ReportOutput<"answerEval">, ctx: FinalizeContext) => {
    const values = Object.values(o.scores);
    return {
      ...o,
      chunkIds: scrub(o.chunkIds, ctx),
      overall: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 20),
      signals: answerSignals(ctx.inputs.answer ?? ""),
    };
  },
  offers: (o: ReportOutput<"offers">, ctx: FinalizeContext) => {
    const sources = [ctx.inputs.offerA, ctx.inputs.offerB, ctx.inputs.offerC].filter(Boolean);
    const unverified: string[] = [];
    const offers = o.offers.slice(0, sources.length).map((offer, i) => {
      const text = sources[i] ?? "";
      // A number the model can't quote from the offer text is treated as unstated.
      const keep = (value: number, quote: string, label: string) => {
        if (!value) return 0;
        if (quoteInText(quote, text)) return value;
        unverified.push(`${offer.name}: ${label}`);
        return 0;
      };
      const numbers = {
        name: offer.name,
        base: keep(offer.base, offer.baseQuote, "base pay"),
        variablePct: keep(offer.variablePct, offer.variableQuote, "variable pay"),
        joiningBonus: keep(offer.joiningBonus, offer.joiningQuote, "joining bonus"),
        otherCash: keep(offer.otherCash, offer.otherCashQuote, "other cash"),
        equityKind: offer.equityKind,
        equityGrantValue: keep(offer.equityGrantValue, offer.equityQuote, "equity value"),
        equityVestYears: offer.equityVestYears,
      };
      return { ...offer, ...numbers, totals: offerTotals(numbers) };
    });
    const currentOk = o.current.total > 0 && quoteInText(o.current.quote, ctx.inputs.current ?? "");
    const rankedByFourYear = [...offers].sort((a, b) => b.totals.fourYearTotal - a.totals.fourYearTotal).map((x) => x.name);
    return { ...o, offers, current: currentOk ? o.current : { total: 0, quote: "" }, rankedByFourYear, unverified };
  },
  roast: (o: ReportOutput<"roast">, ctx: FinalizeContext) => {
    // You can only roast what's actually there.
    const burns = o.burns.filter((b) => quoteInText(b.quote, ctx.resumeText));
    const avg = o.dimensions.reduce((s, d) => s + d.score, 0) / (o.dimensions.length || 1);
    return { ...o, burns, droppedBurns: o.burns.length - burns.length, score: Math.round(avg * 10) };
  },
  court: (o: ReportOutput<"court">, ctx: FinalizeContext) => {
    const VERDICT = { STRONG: "Acquitted", PARTIAL: "Probation", UNVERIFIED: "Hung jury", MISSING: "Guilty" } as const;
    const charges = o.charges
      .filter((c) => quoteInText(c.claim, ctx.resumeText))
      .map((c) => ({ ...c, chunkIds: scrub(c.chunkIds, ctx), verdict: VERDICT[c.evidence] }));
    const guilty = charges.filter((c) => c.verdict === "Guilty").length;
    return { ...o, charges, guilty, droppedCharges: o.charges.length - charges.length };
  },
  aura: (o: ReportOutput<"aura">, ctx: FinalizeContext) => {
    const components = o.components.map((c) => ({ ...c, chunkIds: scrub(c.chunkIds, ctx) }));
    const total = components.reduce((s, c) => s + c.points, 0);
    const tier = total >= 1500 ? "Main character" : total >= 700 ? "Certified aura farmer" : total >= 0 ? "Respectable NPC" : "Aura debt";
    return { ...o, components, total, tier };
  },
  bingo: (o: ReportOutput<"bingo">, ctx: FinalizeContext) => {
    const source = ctx.inputs.text ?? "";
    const squares = o.squares
      .slice(0, 24)
      .map((s) => ({ ...s, verified: Boolean(source) && quoteInText(s.quote || s.phrase, source) }));
    return { ...o, squares, fromText: Boolean(source) };
  },
  // Confidence is computed here from the resume text; the model never supplies it.
  profile: (o: ReportOutput<"profile">, ctx: FinalizeContext) => refinedResult(o, ctx.inputs.resumeText ?? ""),
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
    case "star":
      return (o as ReportOutput<"star">).spoken;
    case "answerEval":
      return (o as ReportOutput<"answerEval">).strongerAnswer;
    case "profile": {
      // Every string value, so the invented-figure check flags numbers absent from the resume.
      const out: string[] = [];
      const walk = (v: unknown) => {
        if (typeof v === "string") out.push(v);
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") Object.values(v).forEach(walk);
      };
      walk(o);
      return out.join("\n");
    }
    default:
      return "";
  }
}
