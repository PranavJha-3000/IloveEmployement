// Builders for tailored resume versions (from the Tailor tool and from agent
// runs). Pure: no IndexedDB, so they are unit-testable.
import { MAX_VERSION_TEXT, newVersionId, ResumeVersionSchema, versionLabel, type ResumeVersion } from "./versions";

export interface VersionJob {
  title: string;
  company: string;
  url?: string;
}

const MAX_HINT_TITLE = 80;
const SEPARATORS = [" — ", " - ", " | "];

/** A best-guess job title from the first line of a pasted description. The company is left for the user to fill in. */
export function jobHintFromJd(jd: string): { title: string; company: string } {
  const first = jd.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  if (!first) return { title: "", company: "" };
  let cut = -1;
  for (const sep of SEPARATORS) {
    const at = first.indexOf(sep);
    if (at > 0 && (cut === -1 || at < cut)) cut = at;
  }
  const left = cut > 0 ? first.slice(0, cut).trim() : first;
  const title = left.length <= MAX_HINT_TITLE ? left : first.slice(0, MAX_HINT_TITLE).trim();
  return { title, company: "" };
}

function httpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanJob(job: VersionJob): NonNullable<ResumeVersion["job"]> {
  const url = job.url?.trim();
  return {
    title: job.title.trim().slice(0, 200),
    company: job.company.trim().slice(0, 200),
    ...(url && httpUrl(url) && url.length <= 2048 ? { url } : {}),
  };
}

function build(id: string, text: string, job: VersionJob, now: number, origin: "tailor-tool" | "agent", sourceRunId?: string): ResumeVersion {
  const cleaned = cleanJob(job);
  return ResumeVersionSchema.parse({
    id,
    kind: "tailored",
    label: versionLabel({ kind: "tailored", job: cleaned }),
    text: text.slice(0, MAX_VERSION_TEXT),
    createdAt: now,
    origin,
    job: cleaned,
    ...(sourceRunId ? { sourceRunId } : {}),
  });
}

export function tailoredVersionFromTool(input: { text: string; job: VersionJob; now: number }): ResumeVersion {
  return build(newVersionId(), input.text, input.job, input.now, "tailor-tool");
}

/** The id is derived from the run, so saving again (resume, re-run) overwrites instead of duplicating. */
export function tailoredVersionFromAgentRun(input: { runId: string; text: string; job: VersionJob; now: number }): ResumeVersion {
  return build(`agent-${input.runId}`.slice(0, 80), input.text, input.job, input.now, "agent", input.runId.slice(0, 80));
}
