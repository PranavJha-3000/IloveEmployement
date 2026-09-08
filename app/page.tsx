"use client";
import { useState, useRef } from "react";
import type {
  AnalysisResult,
  AnalyzeRequestBody,
  AiRequestConfig,
} from "@/lib/types";
import { useRouter } from "next/navigation";
import type { Tool } from "@/lib/tools";
import { LandingHero } from "@/components/LandingHero";
import { InputSection } from "@/components/InputSection";
import { ResultsPanel } from "@/components/ResultsPanel";
import { LoadingState } from "@/components/LoadingState";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { JDTranslatorOverlay } from "@/components/JDTranslatorOverlay";
import { ContactForm } from "@/components/ContactForm";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

type AppState = "landing" | "input" | "loading" | "results";
interface ResumeInputs {
  resumeText: string;
  jobDescription: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<AppState>("landing");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [desperationLevel, setDesperationLevel] = useState<number | undefined>(
    undefined,
  );
  const [resumeInputs, setResumeInputs] = useState<ResumeInputs | null>(null);
  const [aiConfig, setAiConfig] = useState<AiRequestConfig | null>(null);
  const [showInputs, setShowInputs] = useState(true);
  const [showTranslator, setShowTranslator] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
    setTimeout(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleGetEmployed() {
    setState("input");
    scrollToId("analyzer");
  }

  function scrollToId(id: string) {
    setTimeout(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleGetEmployed() {
    setState("input");
    scrollToId("analyzer");
  }

  /**
   * Tool cards open either:
   * - their own standalone route (most tools), or
   * - an in-page flow if a card still targets a non-route anchor.
   *
   * The Landing Hero CTA and the ToolGrid are wired the same way: they either
   * navigate to a standalone route or reveal the home-page analyzer inputs.
   */
  function handleToolSelect(tool: Tool) {
    if (tool.target.startsWith("/")) {
      router.push(tool.target);
      return;
    }
    // Reveal the analyzer inputs without discarding any in-progress state.
    setState((prev) => (prev === "landing" ? "input" : prev));
    setShowInputs(true);
    scrollToId("analyzer");
  }

  async function handleAnalyze(data: AnalyzeRequestBody) {
    setState("loading");
    setError("");
    setResult(null);
    setDesperationLevel(data.desperationLevel);
    setResumeInputs({
      resumeText: data.resumeText,
      jobDescription: data.jobDescription,
      linkedinUrl: data.linkedinUrl,
      githubUrl: data.githubUrl,
    });
    setAiConfig(data.config);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as AnalysisResult);
      setShowInputs(false);
      setState("results");
      setTimeout(() => {
        document
          .getElementById("results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("input");
      setShowInputs(true);
    }
  }

  function handleReset() {
    setResult(null);
    setError("");
    setShowInputs(true);
    setState("input");
    scrollToId("analyzer");
  }

  return (
    <>
      <Header onOpenTranslator={() => setShowTranslator(true)} />
      <main className="min-h-screen bg-white">
        <LandingHero onCta={handleGetEmployed} />
        <ToolGrid onToolSelect={handleToolSelect} />
        <ContactForm />
        {state !== "landing" && (
          <div ref={inputRef} className="section-transition scroll-mt-20">
            {state === "results" && (
              <div className="w-full px-6 pt-10 pb-2">
                <button
                  onClick={() => setShowInputs(!showInputs)}
                  className="text-sm text-zinc-500 hover:text-zinc-800 transition"
                >
                  {showInputs ? "Hide inputs" : "Edit inputs"}
                </button>
              </div>
            )}
            {(state !== "results" || showInputs) && (
              <InputSection
                onAnalyze={handleAnalyze}
                isLoading={state === "loading"}
                error={error}
              />
            )}
          </div>
        )}
        {state === "loading" && <LoadingState />}
        {state === "results" && result && (
          <div id="results" className="section-transition scroll-mt-20">
            <ResultsPanel
              result={result}
              onReset={handleReset}
              desperationLevel={desperationLevel}
              resumeInputs={resumeInputs}
              aiConfig={aiConfig}
            />
          </div>
        )}
      </main>
      <Footer onOpenTranslator={() => setShowTranslator(true)} />
      <JDTranslatorOverlay
        open={showTranslator}
        onClose={() => setShowTranslator(false)}
      />
    </>
  );
}
