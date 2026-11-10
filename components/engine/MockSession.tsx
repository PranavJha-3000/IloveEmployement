"use client";

import { useState } from "react";
import { authHeaders } from "@/lib/auth/client";
import type { ReportResult } from "@/lib/engine/reports";
import type { RunMeta, RunSuccess, VaultChunk, VaultContextChunk, VaultProfile } from "@/lib/engine/types";
import type { AiRequestConfig } from "@/lib/types";
import { retrieveVault } from "@/lib/vault/retrieve";
import { AnswerEvalView } from "./ReportView";
import { RunDetails } from "./RunDetails";

type Plan = ReportResult<"mockPlan">;
type Graded = ReportResult<"answerEval">;

interface Turn {
  question: string;
  answer: string;
  eval: Graded;
  sent: VaultContextChunk[];
}

const DIMENSIONS = ["structure", "specificity", "relevance", "ownership", "credibility"] as const;

const DIFFICULTY_STYLE = {
  warmup: "bg-emerald-50 text-emerald-700",
  standard: "bg-zinc-100 text-zinc-600",
  hard: "bg-amber-50 text-amber-700",
  final: "bg-red-50 text-red-700",
} as const;

/**
 * Drives a mock interview from a planned question list. Each answer is graded
 * by the hidden "mock-answer" preset with vault chunks retrieved for that
 * answer; the session summary averages are computed here, not by the model.
 */
export function MockSession({
  plan,
  planMeta,
  inputs,
  sourceChunks,
  profile,
  config,
  onRemaining,
}: {
  plan: Plan;
  planMeta: RunMeta;
  inputs: Record<string, string>;
  sourceChunks: VaultChunk[];
  profile: Partial<VaultProfile>;
  config: AiRequestConfig | undefined;
  onRemaining: (n: number | null) => void;
}) {
  const [queue, setQueue] = useState(plan.questions.map((q) => ({ ...q, followUp: false })));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [current, setCurrent] = useState<Turn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const done = index >= queue.length;
  const question = queue[index];

  async function submit() {
    if (!answer.trim() || !question) return;
    setBusy(true);
    setError("");
    const vault = retrieveVault(sourceChunks, `${question.question} ${answer}`, 8);
    try {
      const res = await fetch("/api/run/mock-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          inputs: { question: question.question, answer, jobDescription: inputs.jobDescription ?? "", style: inputs.style ?? "" },
          vault,
          profile,
          config,
        }),
      });
      const json = (await res.json()) as RunSuccess<Graded> | { error: string };
      if (!res.ok || "error" in json) throw new Error("error" in json ? json.error : "Grading failed.");
      const turn = { question: question.question, answer, eval: json.data, sent: vault };
      setCurrent(turn);
      setTurns((t) => [...t, turn]);
      onRemaining(json.meta.remaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed.");
    } finally {
      setBusy(false);
    }
  }

  function next(withFollowUp: boolean) {
    if (withFollowUp && current) {
      setQueue((q) => [...q.slice(0, index + 1), { question: current.eval.followUp, intent: "Follow-up", difficulty: "hard", followUp: true }, ...q.slice(index + 1)]);
    }
    setIndex((i) => i + 1);
    setAnswer("");
    setCurrent(null);
  }

  if (done) {
    const avg = (d: (typeof DIMENSIONS)[number]) => turns.reduce((s, t) => s + t.eval.scores[d], 0) / (turns.length || 1);
    const overall = Math.round(turns.reduce((s, t) => s + t.eval.overall, 0) / (turns.length || 1));
    const weakest = [...DIMENSIONS].sort((a, b) => avg(a) - avg(b))[0];
    const weakestTurn = [...turns].sort((a, b) => a.eval.overall - b.eval.overall)[0];
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-[14px] font-semibold text-zinc-500">Session summary</p>
          <p className={`mt-2 text-[40px] font-bold leading-none ${overall >= 70 ? "text-emerald-600" : overall >= 50 ? "text-amber-600" : "text-red-600"}`}>{overall}</p>
          <p className="mt-1 text-[13px] text-zinc-600">
            Average over {turns.length} answer{turns.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-zinc-600">
            {DIMENSIONS.map((d) => (
              <span key={d}>
                {d} <span className="font-bold text-zinc-900">{avg(d).toFixed(1)}</span>
              </span>
            ))}
          </div>
          {turns.length > 0 && (
            <p className="mt-3 text-[13px] text-zinc-700">
              Work on <span className="font-semibold">{weakest}</span> first. Your weakest answer was to “{weakestTurn.question}”; redo it using the stronger version below.
            </p>
          )}
        </div>
        {weakestTurn && <AnswerEvalView r={weakestTurn.eval} chunks={new Map(weakestTurn.sent.map((c) => [c.id, c]))} />}
        <RunDetails meta={planMeta} sentChunks={[]} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {index === 0 && !current && <p className="rounded-xl bg-zinc-50 p-4 text-[13.5px] italic text-zinc-700">“{plan.opener}”</p>}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
          <span>
            Question {index + 1} of {queue.length}
          </span>
          <span className={`rounded px-1.5 py-0.5 font-semibold ${DIFFICULTY_STYLE[question.difficulty]}`}>{question.followUp ? "follow-up" : question.difficulty}</span>
        </div>
        <p className="mt-2 text-[16px] font-semibold leading-snug text-zinc-900">{question.question}</p>
        {!current && (
          <>
            <textarea
              className="field-control mt-3"
              rows={7}
              value={answer}
              disabled={busy}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer as you would out loud. Typing it or pasting a transcript both work."
            />
            {error && <p className="form-error">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" className="cta-primary flex-1 disabled:opacity-50" disabled={busy || !answer.trim()} onClick={() => void submit()}>
                {busy ? "Grading…" : "Submit answer"}
              </button>
              <button type="button" className="cta-secondary" disabled={busy} onClick={() => next(false)}>
                Skip
              </button>
            </div>
          </>
        )}
      </div>

      {current && (
        <>
          <AnswerEvalView r={current.eval} chunks={new Map(current.sent.map((c) => [c.id, c]))} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="cta-primary flex-1" onClick={() => next(true)}>
              Take the follow-up: “{current.eval.followUp.slice(0, 60)}
              {current.eval.followUp.length > 60 ? "…" : ""}”
            </button>
            <button type="button" className="cta-secondary" onClick={() => next(false)}>
              {index + 1 < queue.length ? "Next question" : "Finish"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
