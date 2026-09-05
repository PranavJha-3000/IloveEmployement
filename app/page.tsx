"use client";
import { useState, useRef } from "react";
import type { AnalysisResult, AnalyzeRequestBody, AiRequestConfig } from "@/lib/types";
import { LandingHero } from "@/components/LandingHero";
import { InputSection } from "@/components/InputSection";
import { CorporateYappingTranslator } from "@/components/CorporateYappingTranslator";
import { ResultsPanel } from "@/components/ResultsPanel";
import { LoadingState } from "@/components/LoadingState";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

type AppState = "landing" | "input" | "loading" | "results";
interface ResumeInputs { resumeText: string; jobDescription: string; linkedinUrl?: string; githubUrl?: string; }

export default function Home() {
  const [state, setState] = useState<AppState>("landing");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [desperationLevel, setDesperationLevel] = useState<number | undefined>(undefined);
  const [resumeInputs, setResumeInputs] = useState<ResumeInputs | null>(null);
  const [aiConfig, setAiConfig] = useState<AiRequestConfig | null>(null);
  const [showInputs, setShowInputs] = useState(true);
  const inputRef = useRef<HTMLDivElement>(null);

  function scrollToInputs() { setTimeout(() => { inputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100); }

  function handleGetEmployed() { setState("input"); scrollToInputs(); }

  async function handleAnalyze(data: AnalyzeRequestBody) {
    setState("loading"); setError(""); setResult(null);
    setDesperationLevel(data.desperationLevel);
    setResumeInputs({ resumeText: data.resumeText, jobDescription: data.jobDescription, linkedinUrl: data.linkedinUrl, githubUrl: data.githubUrl });
    setAiConfig(data.config);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as AnalysisResult); setShowInputs(false); setState("results");
      setTimeout(() => { document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); setState("input"); setShowInputs(true); }
  }

  function handleReset() { setResult(null); setError(""); setShowInputs(true); setState("input"); scrollToInputs(); }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <LandingHero onCta={handleGetEmployed} />
        {state !== "landing" && (
          <div ref={inputRef} className="section-transition scroll-mt-20">
            {state === "results" && (
              <div className="w-full px-6 pt-10 pb-2">
                <button onClick={() => setShowInputs(!showInputs)} className="text-sm text-zinc-500 hover:text-zinc-800 transition">{showInputs ? "Hide inputs" : "Edit inputs"}</button>
              </div>
            )}
            {(state !== "results" || showInputs) && <InputSection onAnalyze={handleAnalyze} isLoading={state === "loading"} error={error} />}
          </div>
        )}
        <div id="about" className="scroll-mt-20 max-w-[1180px] mx-auto px-6 pb-16">
          <CorporateYappingTranslator />
        </div>
        {state === "loading" && <LoadingState />}
        {state === "results" && result && (
          <div id="results" className="section-transition scroll-mt-20">
            <ResultsPanel result={result} onReset={handleReset} desperationLevel={desperationLevel} resumeInputs={resumeInputs} aiConfig={aiConfig} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
