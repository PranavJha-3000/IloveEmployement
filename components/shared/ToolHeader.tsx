"use client";
import Link from "next/link";

interface Props {
  title: string;
  description: string;
  /** Optional icon SVG path data for the tool header. */
  iconPath?: string;
  /** Optional "back to tools" link target. */
  backHref?: string;
}

/** Shared tool header — title, description, and optional breadcrumb. */
export function ToolHeader({ title, description, iconPath, backHref }: Props) {
  return (
    <section className="workflow-card scroll-mt-24">
      <div className="workflow-heading">
        <span className="step-badge">✦</span>
        <h2 className="tool-title">{title}</h2>
      </div>
      <p className="text-sm text-zinc-600 leading-relaxed mb-5">{description}</p>

      {backHref && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <Link
            href={backHref}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            ← Back to Employment Tools
          </Link>
        </nav>
      )}
    </section>
  );
}
