"use client";
import { useState } from "react";
import type { AiRequestConfig, AnalysisResult } from "@/lib/types";
import { ResumeRewriteModal } from "@/components/ResumeRewriteModal";
interface Props { result: AnalysisResult; onReset: () => void; resumeInputs?: { resumeText: string; jobDescription: string; linkedinUrl?: string; githubUrl?: string; } | null; aiConfig?: AiRequestConfig | null; }
function buildReportText(r: AnalysisResult): string {
  const l: string[] = [];
  l.push("YOUR EMPLOYMENT REPORT"); l.push("======================");
  l.push("Estimated selection chance: " + r.selectionChance + "%"); l.push("Verdict: " + r.verdict); l.push("");
  l.push("SUMMARY"); l.push(r.summary); l.push("");
  l.push("SCORES"); l.push("- JD Match (overall): " + r.overallScore); l.push("- Experience: " + r.experienceScore); l.push("- Projects: " + r.projectScore); l.push("- ATS: " + r.atsScore); l.push("- Evidence: " + r.evidenceScore); l.push("");
  l.push("STRONGEST MATCHES"); r.strengths.slice(0, 5).forEach((s) => l.push("- " + s.text + " [" + s.evidence + " evidence]")); l.push("");
  l.push("BIGGEST PROBLEMS"); r.weaknesses.forEach((w) => l.push("- " + (w.area ? w.area + ": " : "") + w.text));
  if (r.fatalGaps.length > 0) { l.push(""); l.push("FATAL GAPS"); r.fatalGaps.forEach((g) => l.push("- " + g.text)); }
  l.push(""); l.push("RESUME OPTIMIZATION");
  const pairs = Math.max(r.resumeProblems.length, r.resumeChanges.length);
  for (let i = 0; i < pairs; i++) { if (r.resumeProblems[i]) l.push((i + 1) + ". PROBLEM: " + r.resumeProblems[i]); if (r.resumeChanges[i]) l.push("   FIX: " + r.resumeChanges[i]); }
  l.push(""); l.push("APPLICATION STRATEGY"); r.applicationStrategy.forEach((s) => l.push("- " + s));
  if (r.interviewRisks.length > 0) { l.push(""); l.push("INTERVIEW RISKS"); r.interviewRisks.forEach((x) => l.push("- " + x)); }
  if (r.trollComment) { l.push(""); l.push("AURA CHECK: " + r.trollComment); }
  return l.join("\n");
}
export function ReportActions({ result, onReset, resumeInputs, aiConfig }: Props) {
  const [copied, setCopied] = useState(false);
  const [showPrep, setShowPrep] = useState(false);
  const [showModal, setShowModal] = useState(false);
  async function handleCopyReport() { try { await navigator.clipboard.writeText(buildReportText(result)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }
  const hasPrep = result.interviewRisks.length > 0 || result.strengths.length > 0;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => { if (resumeInputs && aiConfig) setShowModal(true); }} disabled={!resumeInputs || !aiConfig} className="cta-primary">Rewrite My Resume</button>
        <button onClick={() => setShowPrep(!showPrep)} disabled={!hasPrep} className="cta-secondary">{showPrep ? "Hide Interview Prep" : "Prepare Me For The Interview"}</button>
      </div>
      {showPrep && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 animate-fade-up space-y-5">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">They WILL ask about</h4>
            {result.interviewRisks.length === 0 ? <p className="text-sm text-zinc-500 italic">No specific risks flagged.</p> : <ul className="space-y-1.5">{result.interviewRisks.map((risk, i) => <li key={i} className="text-sm text-zinc-700 leading-relaxed flex gap-2"><span className="text-red-500/60 flex-shrink-0">-</span>{risk}</li>)}</ul>}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-2">You SHOULD bring up</h4>
            <ul className="space-y-1.5">{result.strengths.slice(0, 3).map((s, i) => <li key={i} className="text-sm text-zinc-700 leading-relaxed flex gap-2"><span className="text-green-600/60 flex-shrink-0">+</span>{s.text}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-4 pt-1">
        <button onClick={handleCopyReport} className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 transition">{copied ? "Report copied" : "Copy Report"}</button>
        <span className="text-zinc-300">|</span>
        <button onClick={onReset} className="text-sm text-zinc-500 hover:text-zinc-800 transition">Analyze another job</button>
      </div>
      {resumeInputs && aiConfig && <ResumeRewriteModal open={showModal} onClose={() => setShowModal(false)} aiConfig={aiConfig} analysis={result} resumeText={resumeInputs.resumeText} jobDescription={resumeInputs.jobDescription} linkedinUrl={resumeInputs.linkedinUrl} githubUrl={resumeInputs.githubUrl} />}
    </div>
  );
}
