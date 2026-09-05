"use client";
import type { AnalysisResult } from "@/lib/types";
interface Props { result: AnalysisResult; }
function band(s: number) { if (s >= 70) return { label: "Strong", color: "text-green-700", stroke: "#16a34a" }; if (s >= 45) return { label: "Partial", color: "text-amber-600", stroke: "#d97706" }; if (s >= 25) return { label: "Weak", color: "text-orange-500", stroke: "#f97316" }; return { label: "Critical", color: "text-red-600", stroke: "#ef4444" }; }
export function ScoreBreakdown({ result }: Props) {
  const totalSkills = result.matchedSkills.length + result.missingSkills.length;
  const skillsScore = totalSkills > 0 ? Math.round((result.matchedSkills.length / totalSkills) * 100) : null;
  const metrics = [
    { label: "JD Match", score: result.overallScore, note: result.overallScore >= 70 ? "Resume and JD are speaking the same language." : result.overallScore >= 45 ? "Some hits, some gaps." : "Major gaps." },
    { label: "Skills", score: skillsScore, note: skillsScore == null ? "No skills data to work with." : result.matchedSkills.length + " of " + totalSkills + " required skills demonstrated." },
    { label: "Experience", score: result.experienceScore, note: result.experienceScore >= 70 ? "Experience level fits." : result.experienceScore >= 45 ? "Some gaps." : "Experience falls short." },
    { label: "Projects", score: result.projectScore, note: result.projectScore >= 70 ? "Projects are carrying this application." : result.projectScore >= 45 ? "Somewhat relevant." : "Where are the projects?" },
    { label: "ATS", score: result.atsScore, note: result.atsScore >= 70 ? "Keywords and formatting look ATS-friendly." : result.atsScore >= 45 ? "Moderate ATS alignment." : "Poor ATS alignment." },
    { label: "Evidence", score: result.evidenceScore, note: result.evidenceScore >= 70 ? "Claims backed by evidence." : result.evidenceScore >= 45 ? "Mixed evidence." : "Mostly unsupported claims." },
  ];
  return (
    <section className="card">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">Score Breakdown</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.map((m) => {
          if (m.score == null) return <div key={m.label} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4"><div className="flex items-baseline justify-between"><span className="text-sm font-medium text-zinc-600">{m.label}</span><span className="text-2xl font-bold text-zinc-300">-</span></div><p className="text-xs text-zinc-400 mt-2">{m.note}</p></div>;
          const b = band(m.score);
          return <div key={m.label} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4"><div className="flex items-baseline justify-between"><span className="text-sm font-medium text-zinc-600">{m.label}</span><span className={"text-2xl font-bold " + b.color}>{m.score}</span></div><div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden mt-2.5"><div className="h-full rounded-full transition-all duration-700" style={{ width: m.score + "%", backgroundColor: b.stroke }} /></div><p className={"text-[10px] uppercase tracking-wide mt-2 font-semibold " + b.color}>{b.label}</p><p className="text-xs text-zinc-500 mt-1 leading-relaxed">{m.note}</p></div>;
        })}
      </div>
    </section>
  );
}
