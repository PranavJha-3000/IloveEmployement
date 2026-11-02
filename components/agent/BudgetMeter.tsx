"use client";

import { useId, useState } from "react";
import type { AgentBudgetView } from "@/lib/agent/types";

const num = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

function Meter({ id, label, used, limit }: { id: string; label: string; used: number; limit: number }) {
  const max = Math.max(1, limit);
  const warn = used / max >= 0.8;
  return (
    <div className="agent-meter" data-warn={warn || undefined}>
      <label htmlFor={id}>
        {label} {num(used)} of {num(limit)}
        {used >= limit ? " (limit reached)" : warn ? " (nearly used)" : ""}
      </label>
      <progress id={id} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(used, max)} value={Math.min(used, max)} max={max} />
    </div>
  );
}

/** Steps and tokens meters. Limits always come from the budget view, never from constants here. */
export function BudgetMeter({ budget }: { budget: AgentBudgetView }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const panelId = `${uid}-meters`;
  return (
    <div className="agent-budget">
      <button type="button" className="agent-budget-toggle cta-secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        Steps {budget.stepsUsed}/{budget.stepBudget} · Tokens {compact(budget.tokensUsed)}/{compact(budget.tokenBudget)}
      </button>
      <div id={panelId} className="agent-budget-meters" data-open={open}>
        <Meter id={`${uid}-steps`} label="Steps" used={budget.stepsUsed} limit={budget.stepBudget} />
        <Meter id={`${uid}-tokens`} label="Tokens" used={budget.tokensUsed} limit={budget.tokenBudget} />
      </div>
    </div>
  );
}
