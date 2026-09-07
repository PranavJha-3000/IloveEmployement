"use client";
import type { ResumeRewriteResult } from "@/lib/types";

interface Props {
  result: ResumeRewriteResult;
}

const SECTION_ORDER = ["Summary", "Experience", "Projects", "Skills", "Education"];

function orderedSections(
  sections: { title: string; content: string }[],
): { title: string; content: string }[] {
  const byTitle = new Map(sections.map((s) => [s.title, s]));
  const out: { title: string; content: string }[] = [];
  for (const t of SECTION_ORDER) {
    const found = byTitle.get(t);
    if (found && found.content.trim()) out.push(found);
  }
  // Append any sections not in the standard order.
  for (const s of sections) {
    if (!SECTION_ORDER.includes(s.title) && s.content.trim()) out.push(s);
  }
  return out;
}

export function RewriteComparison({ result }: Props) {
  const original = orderedSections(result.originalResume);
  const optimized = orderedSections(result.optimizedResume);
  const optimizedByTitle = new Map(optimized.map((s) => [s.title, s]));

  if (original.length === 0) return null;

  return (
    <section className="card">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        Original vs Optimized
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        Side-by-side by section. Optimized uses only facts from your original.
      </p>
      <div className="mt-4 space-y-4">
        {original.map((sec) => {
          const opt = optimizedByTitle.get(sec.title);
          return (
            <div key={sec.title}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                {sec.title}
              </h4>
              <div className="mt-2 grid sm:grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Original
                  </p>
                  <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                    {sec.content}
                  </p>
                </div>
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">
                    Optimized
                  </p>
                  <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
                    {opt?.content ?? sec.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}