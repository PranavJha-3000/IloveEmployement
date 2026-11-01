// Plain-text rendering of a tailored resume. Shared by the Copy/.txt buttons and
// by code that saves tailored resume versions.
import type { ReportResult } from "./reports";

export function resumeToText(r: ReportResult<"resume">, name: string): string {
  const out: string[] = [];
  if (name) out.push(name);
  out.push(r.headline, "", "SUMMARY", r.summary.text, "");
  for (const s of r.sections) {
    out.push(s.title.toUpperCase());
    for (const e of s.entries) {
      out.push(e.heading);
      for (const b of e.bullets) out.push(`• ${b.text}`);
      out.push("");
    }
  }
  if (r.skills.length) out.push("SKILLS", r.skills.join(", "));
  return out.join("\n").trim();
}
