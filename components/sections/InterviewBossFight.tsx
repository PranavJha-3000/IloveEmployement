"use client";
import { useState } from "react";
import type { AnalysisResult, BossDifficulty, InterviewQuestion } from "@/lib/types";
interface Props { result: AnalysisResult; }
const DM: Record<BossDifficulty, { label: string; badge: string; border: string }> = {
  EASY: { label: "EASY", badge: "bg-green-50 text-green-700 border-green-200", border: "border-green-200" },
  MEDIUM: { label: "MEDIUM", badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-amber-200" },
  HARD: { label: "HARD", badge: "bg-orange-50 text-orange-700 border-orange-200", border: "border-orange-200" },
  FINAL_BOSS: { label: "FINAL BOSS", badge: "bg-red-50 text-red-700 border-red-200", border: "border-red-300" },
};
export function InterviewBossFight({ result }: Props) {
  const questions = result.interviewBossFight?.questions ?? [];
  const [revealed, setRevealed] = useState(0);
  if (questions.length === 0) return null;
  function handleStart() { if (revealed >= questions.length) setRevealed(0); else setRevealed(questions.length); }
  function handleNext() { setRevealed((r) => Math.min(r + 1, questions.length)); }
  const allRevealed = revealed >= questions.length;
  return (
    <section className="card overflow-hidden">
      <div className="text-center pb-2"><p className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Interview Prep</p><h3 className="text-lg font-bold tracking-tight text-zinc-900 mt-1">Interview Boss Fight</h3><p className="text-sm text-zinc-500 mt-1">Five questions. One shot. No save scumming.</p></div>
      <div className="mt-4"><button onClick={handleStart} className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3 rounded-xl text-sm transition-all">{allRevealed ? "Replay Fight" : "START BOSS FIGHT"}</button></div>
      {revealed > 0 && (
        <div className="mt-5 space-y-4">
          {questions.slice(0, revealed).map((q, i) => <QuestionCard key={i} q={q} index={i} total={questions.length} />)}
          {!allRevealed && <button onClick={handleNext} className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition">Next Boss ({revealed}/{questions.length})</button>}
          {allRevealed && <p className="text-center text-xs text-zinc-400 pt-1">All bosses revealed. No saves, no mercy.</p>}
        </div>
      )}
    </section>
  );
}
function QuestionCard({ q, index, total }: { q: InterviewQuestion; index: number; total: number }) {
  const m = DM[q.difficulty] ?? DM.MEDIUM;
  const isBoss = q.difficulty === "FINAL_BOSS";
  return (
    <div className={"bg-zinc-50 border rounded-xl overflow-hidden animate-fade-up " + (isBoss ? "border-red-300" : m.border)}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-200 bg-zinc-100"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Question {index + 1}/{total}</span><span className={"text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border " + m.badge}>{m.label}</span></div>
      {isBoss && q.bossWarning && <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg"><p className="text-xs text-red-700 font-semibold">! {q.bossWarning}</p></div>}
      <div className="px-4 py-3.5 space-y-3">
        <p className="text-sm font-semibold text-zinc-900 leading-relaxed">&ldquo;{q.question}&rdquo;</p>
        {q.whyTheyreAsking && <div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Why they are asking</p><p className="text-sm text-zinc-600 leading-relaxed">{q.whyTheyreAsking}</p></div>}
        {q.yourRisk && <div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Your risk</p><p className="text-sm text-zinc-600 leading-relaxed">{q.yourRisk}</p></div>}
        {q.howToAnswer && <div className="bg-zinc-100 border border-zinc-200 rounded-lg p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-green-700 mb-1">How to answer</p><p className="text-sm text-zinc-800 leading-relaxed">{q.howToAnswer}</p></div>}
      </div>
    </div>
  );
}
