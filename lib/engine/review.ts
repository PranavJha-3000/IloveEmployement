// ─── Drafter → Reviewer ──────────────────────────────────────────────────────
// A second model call with a fresh, adversarial brief reads the draft against
// the same sources and lists concrete problems. If it finds anything high or
// medium severity, the drafter revises once with that critique. The reviewer
// never writes the final text, so it has no incentive to approve its own work.

import { z } from "zod";

export const reviewSchema = z.object({
  issues: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]).describe("high = invented or misrepresented fact, or would hurt the application; medium = weak or generic; low = polish"),
      where: z.string().describe("Which part of the draft"),
      problem: z.string(),
      fix: z.string().describe("A concrete instruction for the writer"),
    }),
  ),
  verdict: z.enum(["ship", "revise"]),
});

export type Review = z.infer<typeof reviewSchema>;

export const REVIEWER_SYSTEM = `You are a strict reviewer for IloveEmployement — a hiring manager and an editor in one. You did not write the draft and you do not rewrite it. Compare the draft against the sources and report concrete problems.

Check, in order:
1. Fabrication: any employer, title, date, number, skill, tool or achievement that is not in the user's material. Always severity "high".
2. Misrepresentation: a real fact stretched beyond what the source says (e.g. "led" when the source says "contributed"). Severity "high".
3. Relevance: does it address what the target role/recipient actually needs?
4. Specificity: generic phrases, clichés, filler, buzzwords.
5. Format rules from the task (length limits, structure).

Be terse and concrete. Don't list praise. If there is nothing high or medium, set verdict to "ship". Respond with a single JSON object.`;

export function reviewPrompt(contextPrompt: string, draft: unknown): string {
  return `${contextPrompt}\n\n<draft_to_review>\n${JSON.stringify(draft, null, 2)}\n</draft_to_review>\n\nReview the draft against the sources above.`;
}

export function revisePrompt(contextPrompt: string, draft: unknown, review: Review): string {
  return `${contextPrompt}\n\n<your_previous_draft>\n${JSON.stringify(draft, null, 2)}\n</your_previous_draft>\n\n<reviewer_feedback>\n${review.issues
    .filter((i) => i.severity !== "low")
    .map((i) => `- [${i.severity}] ${i.where}: ${i.problem} → ${i.fix}`)
    .join("\n")}\n</reviewer_feedback>\n\nRevise the draft so every high and medium issue is resolved. Remove anything the reviewer flagged as unsupported rather than rewording it. Do not add new facts. Return the complete revised JSON object.`;
}

export function needsRevision(review: Review): boolean {
  return review.verdict === "revise" || review.issues.some((i) => i.severity !== "low");
}
