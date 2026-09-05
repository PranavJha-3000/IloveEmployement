"use client";
import { useEffect, useState } from "react";
import type { AiRequestConfig, AnalysisResult } from "@/lib/types";
import { ReportHeader } from "./sections/ReportHeader";
import { VerdictCard } from "./sections/VerdictCard";
import { RecruiterSimulator } from "./sections/RecruiterSimulator";
import { ResumeCapDetector } from "./sections/ResumeCapDetector";
import { ScoreBreakdown } from "./sections/ScoreBreakdown";
import { ComparativeAnalysis } from "./sections/ComparativeAnalysis";
import { ResumeOptimization } from "./sections/ResumeOptimization";
import { AuraCheck } from "./sections/AuraCheck";
import { StrategySection } from "./sections/StrategySection";
import { ReportActions } from "./sections/ReportActions";
import { InterviewBossFight } from "./sections/InterviewBossFight";
interface Props { result: AnalysisResult; onReset: () => void; desperationLevel?: number; resumeInputs?: { resumeText: string; jobDescription: string; linkedinUrl?: string; githubUrl?: string; } | null; aiConfig?: AiRequestConfig | null; }
const NAV = [
  { id: "report-header", label: "Report" },
  { id: "verdict", label: "Verdict" },
  { id: "recruiter", label: "Recruiter" },
  { id: "cap-detector", label: "Cap Detector" },
  { id: "scores", label: "Scores" },
  { id: "comparison", label: "Comparison" },
  { id: "resume-optimization", label: "Resume" },
  { id: "aura-check", label: "Aura" },
  { id: "strategy", label: "Strategy" },
  { id: "boss-fight", label: "Boss Fight" },
];
export function ResultsPanel({ result, onReset, desperationLevel, resumeInputs, aiConfig }: Props) {
  const [activeSection, setActiveSection] = useState(NAV[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => { for (const entry of entries) { if (entry.isIntersecting) setActiveSection(entry.target.id); } }, { rootMargin: "-15% 0px -65% 0px" });
    for (const s of NAV) { const el = document.getElementById(s.id); if (el) observer.observe(el); }
    return () => observer.disconnect();
  }, []);
  return (
    <div className="relative w-full px-6 pb-24 space-y-5">
      <nav aria-label="Report sections" className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-3 z-40">
        {NAV.map((s) => <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })} title={s.label} aria-label={"Jump to " + s.label} className={"w-2 h-2 rounded-full transition-all " + (activeSection === s.id ? "bg-red-600 scale-125" : "bg-zinc-300 hover:bg-zinc-400")} />)}
      </nav>
      <div id="report-header" className="scroll-mt-20"><ReportHeader result={result} desperationLevel={desperationLevel} /></div>
      <div id="verdict" className="scroll-mt-20"><VerdictCard result={result} /></div>
      <div id="recruiter" className="scroll-mt-20"><RecruiterSimulator result={result} /></div>
      <div id="cap-detector" className="scroll-mt-20"><ResumeCapDetector result={result} /></div>
      <div id="scores" className="scroll-mt-20"><ScoreBreakdown result={result} /></div>
      <div id="comparison" className="scroll-mt-20"><ComparativeAnalysis result={result} /></div>
      <div id="resume-optimization" className="scroll-mt-20"><ResumeOptimization result={result} /></div>
      <div id="aura-check" className="scroll-mt-20"><AuraCheck result={result} /></div>
      <div id="strategy" className="scroll-mt-20"><StrategySection result={result} /></div>
      <div id="boss-fight" className="scroll-mt-20"><InterviewBossFight result={result} /></div>
      <ReportActions result={result} onReset={onReset} resumeInputs={resumeInputs} aiConfig={aiConfig} />
    </div>
  );
}
