"use client";
import type { AnalysisResult } from "@/lib/types";
interface Props { result: AnalysisResult; }
export function AuraCheck({ result }: Props) {
  const obs: string[] = [];
  if (result.trollComment) obs.push(result.trollComment);
  if (result.evidenceScore >= 75) obs.push("Your receipts are actually lining up. Disturbingly competent aura.");
  else if (result.evidenceScore <= 25 && result.evidenceScore > 0) obs.push("The evidence section is running on vibes alone. Aura: unverified.");
  return (
    <section className="card">
      <p className="text-xs uppercase tracking-widest text-red-500 font-semibold">The Aura Check</p>
      <div className="mt-2 space-y-1.5">
        {obs.length === 0 ? <p className="text-sm text-zinc-800 italic">Your digital presence is... present.</p> : obs.map((o, i) => <p key={i} className="text-sm text-zinc-800 italic leading-relaxed">{o}</p>)}
      </div>
    </section>
  );
}
