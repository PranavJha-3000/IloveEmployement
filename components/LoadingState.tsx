"use client";
import { useEffect, useState } from "react";

const MESSAGES = [
  "Checking the rizz...",
  "Fighting the ATS boss...",
  "Cooking up your report...",
  "Judging your career choices...",
  "Reading your resume...",
  "Calculating employment aura...",
];

export function LoadingState() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 1600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.getElementById("loading")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div id="loading" className="max-w-md mx-auto px-6 py-20 text-center animate-fade-up">
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>

      <p key={idx} className="text-lg text-zinc-800 font-semibold animate-fade-up">
        {MESSAGES[idx]}
      </p>

      <div className="mt-4 flex justify-center gap-1.5">
        {MESSAGES.map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === idx ? "bg-red-500" : "bg-zinc-300"
            }`}
          />
        ))}
      </div>

      <div className="mt-9 space-y-2.5 text-left max-w-xs mx-auto">
        {[80, 65, 90, 55, 70].map((w, i) => (
          <div key={i} className="shimmer h-3 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>

      <p className="text-xs text-zinc-500 mt-9">
        Usually 15-45s. Your model is vibing.
      </p>
    </div>
  );
}