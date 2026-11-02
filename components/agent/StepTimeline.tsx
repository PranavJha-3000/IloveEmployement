"use client";

import { StepCard, type StepCardProps } from "./StepCard";

/** Ordered list of the four steps, plus the one persistent polite live region for progress. */
export function StepTimeline({ cards, liveMessage }: { cards: StepCardProps[]; liveMessage: string }) {
  return (
    <div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
      <ol className="agent-timeline" aria-label="Application steps">
        {cards.map((card) => (
          <StepCard key={card.tool} {...card} />
        ))}
      </ol>
    </div>
  );
}
