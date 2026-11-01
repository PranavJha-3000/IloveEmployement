// Resume versions: a saved base resume or a tailored copy, with the job it
// targeted. Isomorphic (zod only, no IndexedDB) so import validation is
// unit-testable.
import { z } from "zod";

export const MAX_VERSIONS = 200;
export const MAX_VERSION_TEXT = 40000;

function httpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const ResumeVersionSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["base", "tailored"]),
  label: z.string().max(200),
  text: z.string().min(1).max(MAX_VERSION_TEXT),
  createdAt: z.number().finite(),
  origin: z.enum(["profile-confirm", "tailor-tool", "agent"]),
  job: z
    .object({
      title: z.string().max(200),
      company: z.string().max(200),
      url: z.string().max(2048).refine(httpUrl, "Job URL must be http or https").optional(),
    })
    .optional(),
  sourceRunId: z.string().max(80).optional(),
});
export type ResumeVersion = z.infer<typeof ResumeVersionSchema>;

export function newVersionId(prefix = "rv"): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const rand = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`.slice(0, 80);
}

export function versionLabel(v: Pick<ResumeVersion, "kind" | "job">): string {
  if (v.kind === "base") return "Base resume";
  const title = v.job?.title?.trim() ?? "";
  const company = v.job?.company?.trim() ?? "";
  if (!title) return "Tailored resume";
  return company ? `Tailored: ${title}, ${company}` : `Tailored: ${title}`;
}

/** Validates every imported version, keeps the newest MAX_VERSIONS, and counts what was dropped. */
export function sanitizeImportedVersions(raw: unknown): { versions: ResumeVersion[]; dropped: number } {
  if (!Array.isArray(raw)) return { versions: [], dropped: 0 };
  const valid: ResumeVersion[] = [];
  let dropped = 0;
  for (const item of raw) {
    const r = ResumeVersionSchema.safeParse(item);
    if (r.success) valid.push(r.data);
    else dropped += 1;
  }
  valid.sort((a, b) => b.createdAt - a.createdAt);
  if (valid.length > MAX_VERSIONS) {
    dropped += valid.length - MAX_VERSIONS;
    valid.length = MAX_VERSIONS;
  }
  return { versions: valid, dropped };
}
