"use client";
import { useState } from "react";

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Collapsible result section — used across all tool result pages.
 * Each section can be expanded/collapsed independently.
 */
export function ResultSection({ id, title, children, className, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className={`scroll-mt-20 ${className || ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          {open ? "−" : "+"}
        </button>
      </div>
      {open && children}
    </section>
  );
}

