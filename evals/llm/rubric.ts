// Judge rubric constants. The prose lives in RUBRIC.md; rubricHash goes into
// judge cache keys and the report so a changed rubric is visible.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contentHash } from "../../lib/retrieval/fusion";

export const RUBRIC_DIMENSIONS = ["groundedness", "task_fit", "clarity"] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

export const SCORE_SCALE = [1, 2, 3, 4] as const;
export const CITATION_VERDICTS = ["supports", "partial", "does_not_support"] as const;
export const CLAIM_STATUSES = ["supported", "unsupported"] as const;

export const AGREEMENT_SEED = 20261101;
export const BOOTSTRAP_ITERATIONS = 10000;

export function loadRubric(path = "evals/llm/RUBRIC.md"): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

export function rubricHash(text: string): string {
  return contentHash(text);
}
