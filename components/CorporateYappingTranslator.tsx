"use client";
import { useRef, useState } from "react";
import type { AiRequestConfig, CorporateYappingResult, YappingCategory } from "@/lib/types";
import { ProviderConfig } from "./ProviderConfig";
type Phase = "idle" | "loading" | "success" | "error";
const CAT: { key: YappingCategory; label: string; accent: string }[] = [
  { key: "what_they_want", label: "What they actually want", accent: "text-green-700" },
  { key: "required_skills", label: "Required skills", accent: "text-blue-700" },
  { key: "nice_to_have", label: "Nice-to-have", accent: "text-amber-700" },
  { key: "likely_interview_topics", label: "Likely interview topics", accent: "text-purple-700" },
  { key: "potential_red_flags", label: "Potential red flags", accent: "text-red-700" },
  { key: "corporate_yapping", label: "Corporate yapping", accent: "text-zinc-500" },
];
const LOAD = ["Decoding corporate speak...", "Translating HR to human...", "Detecting buzzwords...", "Reading between the bullet points..."];
const TA = "w-full bg-white border border-zinc-300 rounded-lg px-3.5 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition resize-y disabled:opacity-60";
export function CorporateYappingTranslator() {
  const [jd, setJd] = useState("");
  const [config, setConfig] = useState<AiRequestConfig>({ provider: "openai", apiKey: "", model: "gpt-4o-mini" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CorporateYappingResult | null>(null);
  const [err, setErr] = useState("");
  const [vErr, setVErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [mi, setMi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  async function go() {
    setVErr(""); setErr("");
    if (!config.apiKey.trim()) { setVErr("API key is required."); return; }
    if (!jd.trim()) { setVErr("Job description is required."); return; }
    setPhase("loading"); setResult(null); setMi(0);
    const t = setInterval(() => setMi((i) => (i + 1) % LOAD.length), 1500);
    try {
      const r = await fetch("/api/translate-jd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config, jobDescription: jd }) });
      const j = await r.json(); clearInterval(t);
      if (!r.ok) throw new Error(j.error || "Translation failed.");
      setResult(j as CorporateYappingResult); setPhase("success");
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { clearInterval(t); setErr(e instanceof Error ? e.message : "Translation failed."); setPhase("error"); }
  }
  async function copyAll() {
    if (!result) return;
    const lines = result.translations.map((t) => "COMPANY SAID: " + t.companySaid + "\nTHEY MEAN: " + t.theyProbablyMean + "\nWE SAY: " + t.iLoveEmploymentSays);
    await navigator.clipboard.writeText(lines.join("\n\n")); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  const grouped = CAT.map((m) => ({ ...m, items: result?.translations.filter((t) => t.category === m.key) ?? [] })).filter((g) => g.items.length > 0);
  return (
    <div id="translator" className="scroll-mt-20">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900">Corporate Yapping Translator</h2>
        <p className="mt-2 text-sm text-zinc-500 max-w-lg mx-auto">Paste a job description. We translate the corporate speak into something a human can understand.</p>
      </div>
      <div className="card">
        <label htmlFor="jdTranslate" className="block text-sm font-semibold text-zinc-700 mb-2">Job Description to Translate</label>
        <textarea id="jdTranslate" value={jd} onChange={(e) => setJd(e.target.value)} disabled={phase === "loading"} placeholder="Paste the corporate yapping here..." rows={8} className={TA} />
        <div className="mt-4"><ProviderConfig config={config} onChange={setConfig} /></div>
        {vErr && <p className="text-xs text-red-500 mt-2">{vErr}</p>}
        <button onClick={go} disabled={phase === "loading"} className="cta-primary w-full mt-4">{phase === "loading" ? LOAD[mi] : "Translate the Corporate Yapping"}</button>
      </div>
      {phase === "loading" && <div className="text-center py-8"><div className="w-8 h-8 border-4 border-zinc-200 border-t-red-600 rounded-full animate-spin mx-auto"></div><p className="text-sm text-zinc-500 mt-3">{LOAD[mi]}</p></div>}
      {phase === "error" && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mt-4">{err}</div>}
      {phase === "success" && result && (
        <div ref={ref} className="mt-8 space-y-4 scroll-mt-6">
          <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">The Translation</p><button onClick={copyAll} className="text-xs text-zinc-500 hover:text-red-600 underline underline-offset-2 transition">{copied ? "Copied" : "Copy all"}</button></div>
          {grouped.length === 0 ? <p className="text-sm text-zinc-500 italic">No meaningful corporate jargon detected.</p> : (
            <div className="space-y-3">{grouped.map((g) => (
              <div key={g.key} className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200"><span className={"text-sm font-bold " + g.accent}>{g.label}</span><span className="text-xs text-zinc-400 ml-2">{g.items.length}</span></div>
                <div className="p-4 space-y-3">{g.items.map((t, i) => (
                  <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-lg p-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Company Said</p><p className="text-sm text-zinc-600 italic">&ldquo;{t.companySaid}&rdquo;</p></div>
                      <div><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">They Probably Mean</p><p className="text-sm text-zinc-700">{t.theyProbablyMean}</p></div>
                      <div><p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">IloveEmployment Says</p><p className="text-sm text-zinc-800 font-medium">{t.iLoveEmploymentSays}</p></div>
                    </div>
                  </div>
                ))}</div>
              </div>
            ))}</div>
          )}
        </div>
      )}
    </div>
  );
}
