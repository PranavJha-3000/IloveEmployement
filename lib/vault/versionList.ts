// Pure list, filter and compare-selection rules for the Resume versions section.
import type { ResumeVersion } from "./versions";

export type VersionFilter = "all" | "base" | "tailored";

export function filterVersions(vs: ResumeVersion[], f: VersionFilter): ResumeVersion[] {
  return f === "all" ? vs : vs.filter((v) => v.kind === f);
}

export function versionCounts(vs: ResumeVersion[]): { all: number; base: number; tailored: number } {
  const base = vs.filter((v) => v.kind === "base").length;
  return { all: vs.length, base, tailored: vs.length - base };
}

/** At most two ids; toggling a selected id removes it and a third id is ignored. */
export function toggleCompare(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  if (selected.length >= 2) return selected;
  return [...selected, id];
}

/** The older version is From. Ties keep the argument order. */
export function orderPair(vs: ResumeVersion[], a: string, b: string): { from: ResumeVersion; to: ResumeVersion } {
  const va = vs.find((v) => v.id === a);
  const vb = vs.find((v) => v.id === b);
  if (!va || !vb) throw new Error("Unknown version.");
  return vb.createdAt < va.createdAt ? { from: vb, to: va } : { from: va, to: vb };
}

/** [most recent base id, tailoredId], or null when there is no base. */
export function compareWithBase(vs: ResumeVersion[], tailoredId: string): string[] | null {
  let base: ResumeVersion | null = null;
  for (const v of vs) if (v.kind === "base" && (!base || v.createdAt > base.createdAt)) base = v;
  return base ? [base.id, tailoredId] : null;
}

export function versionSubtitle(v: Pick<ResumeVersion, "kind" | "job">): string {
  if (v.kind === "base") return "Your base resume";
  const title = v.job?.title?.trim() ?? "";
  const company = v.job?.company?.trim() ?? "";
  if (!title) return "Targeted job not recorded";
  return company ? `Targeted: ${title} at ${company}` : `Targeted: ${title}`;
}
