import os

path = r"c:\Users\prana\OneDrive\Desktop\Code\IloveEmployement\components\BulletPointFixerPage.tsx"

content = '''"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  AiRequestConfig,
  BulletFixRequestBody,
  BulletFixResult,
} from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
import { LoadingState } from "./LoadingState";
import { BulletFixResultView } from "./sections/BulletFixResult";

type Phase = "idle" | "loading" | "results";

const LOADING_MESSAGES = [
  "Reading your bullet...",
  "Diagnosing the issues...",
  "Crafting a better version...",
  "Checking the facts...",
  "Almost done...",
];

export function BulletPointFixerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<BulletFixResult | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const [config, setConfig] = useState<AiRequestConfig>({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [bullet, setBullet] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [roleContext, setRoleContext] = useState("");
  const [technology, setTechnology] = useState("");
  const [desperationLevel, setDesperationLevel] = useState(2);

  const canSubmit = Boolean(bullet.trim() && config.apiKey.trim());

  async function handleFix(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setError("");
    if (!config.apiKey.trim())
      return setValidationError("API key is required. This app runs on your key.");
    if (!bullet.trim())
      return setValidationError("A bullet point is required.");

    setPhase("loading");
    const body: BulletFixRequestBody = {
      config,
      bullet,
      jobDescription: jobDescription.trim() || undefined,
      roleContext: roleContext.trim() || undefined,
      technology: technology.trim() || undefined,
      desperationLevel,
    };
    try {
      const res = await fetch("/api/fix-bullet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
      setResult(json as BulletFixResult);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function handleReset() {
    setResult(null);
    setError("");
    setValidationError("");
    setPhase("idle");
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-[1180px] mx-auto px-6 pt-6">
          <Breadcrumb />
        </div>
        <LoadingState messages={LOADING_MESSAGES} />
      </main>
    );
  }

  if (phase === "results" && result) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-[800px] mx-auto px-6 pt-6 pb-20 space-y-4">
          <Breadcrumb />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleReset}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              &larr; Fix another bullet
            </button>
          </div>
          <BulletFixResultView result={result} />
          <p className="text-xs text-zinc-400 text-center pt-4">
            TRUTH FILTER: ON. No fabricated metrics or experience. No slang in the output.
          </p>
        </div>
      </main>
    );
  }

  return <IdleView {...{ phase, error, validationError, canSubmit, config, setConfig, bullet, setBullet, jobDescription, setJobDescription, roleContext, setRoleContext, technology, setTechnology, desperationLevel, onFix: handleFix }} />;
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Link href="/" className="hover:text-zinc-600 transition-colors">
        Employment Tools
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-600 font-medium">Bullet Point Fixer</span>
    </nav>
  );
}
'''

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully wrote first part ({len(content)} chars)")