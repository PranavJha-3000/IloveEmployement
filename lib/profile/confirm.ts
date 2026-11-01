// Pure planner for the "Confirm profile" action. Decides exactly what gets
// saved; the component executes the plan. No IndexedDB here so it is testable.
import { normalizeResumeLines } from "../diff";
import { contentHash } from "../retrieval/fusion";
import type { VaultProfile } from "../engine/types";
import { MAX_VERSION_TEXT, newVersionId, ResumeVersionSchema, type ResumeVersion } from "../vault/versions";
import { StructuredProfileSchema, type ConfirmedProfile, type StructuredProfile } from "./schema";
import { toVaultProfile } from "./sync";

export interface ConfirmInput {
  profile: StructuredProfile;
  method: "deterministic" | "refined";
  /** The resume text being confirmed, or null when a saved profile is reopened. */
  resumeText: string | null;
  existingVaultProfile: VaultProfile;
  now: number;
}

export interface ConfirmPlan {
  confirmed: ConfirmedProfile;
  vaultProfile: VaultProfile;
  baseVersion: ResumeVersion | null;
  replaceChunks: boolean;
}

/** The base resume version: normalized lines, capped at the version text limit. Returns a schema-valid record. */
export function baseVersionFrom(resumeText: string, now: number): ResumeVersion {
  const text = normalizeResumeLines(resumeText).join("\n").slice(0, MAX_VERSION_TEXT);
  return ResumeVersionSchema.parse({
    id: newVersionId(),
    kind: "base",
    label: "Base resume",
    text,
    createdAt: now,
    origin: "profile-confirm",
  });
}

export function planConfirm(input: ConfirmInput): ConfirmPlan {
  const profile = StructuredProfileSchema.parse(input.profile);
  const hasText = input.resumeText !== null && input.resumeText.trim().length > 0;
  const text = hasText ? (input.resumeText as string) : null;
  const confirmed: ConfirmedProfile = {
    profile,
    confirmedAt: Math.floor(input.now),
    sourceHash: text !== null ? contentHash(text) : "",
    method: input.method,
  };
  let baseVersion: ResumeVersion | null = null;
  if (text !== null && normalizeResumeLines(text).join("\n").length > 0) baseVersion = baseVersionFrom(text, input.now);
  return {
    confirmed,
    vaultProfile: toVaultProfile(profile, input.existingVaultProfile),
    baseVersion,
    replaceChunks: text !== null,
  };
}
