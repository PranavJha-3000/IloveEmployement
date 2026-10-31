import Link from "next/link";
import type { CSSProperties } from "react";
import { CATEGORIES, type Tool } from "@/lib/tools";

/**
 * iLovePDF-style composite icon: a small, lighter tile with a badge sits
 * behind a solid tile with the main symbol. Tools without a badge get one
 * larger tile. Drawn on a 56-unit square; CSS sets the rendered size.
 */
export function ToolIcon({ tool }: { tool: Tool }) {
  const { glyph, badge } = tool.icon;
  return (
    <svg className="tool-card-icon" viewBox="0 0 56 56" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {badge ? (
        <>
          <rect x="0" y="0" width="30" height="30" rx="7" style={{ fill: `color-mix(in srgb, ${tool.accent} 22%, white)` }} />
          <path d={badge} transform="translate(3 3) scale(.625)" stroke={tool.accent} strokeWidth="3" />
          <rect x="18" y="18" width="38" height="38" rx="9" fill={tool.accent} />
          <path d={glyph} transform="translate(25 25)" stroke="#fff" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="50" height="50" rx="11" fill={tool.accent} />
          <path d={glyph} transform="translate(13 13) scale(1.25)" stroke="#fff" strokeWidth="1.7" />
        </>
      )}
    </svg>
  );
}

interface Props {
  tool: Tool;
  /** show the category name at the bottom, for flat (search/filter) results */
  showCategory?: boolean;
  /** the result Enter will open */
  top?: boolean;
}

export function ToolCard({ tool, showCategory = false, top = false }: Props) {
  return (
    <Link href={tool.target} className={`tool-card${top ? " is-top" : ""}`} style={{ "--accent": tool.accent } as CSSProperties}>
      <ToolIcon tool={tool} />
      <span className="min-w-0">
        <h3 className="tool-card-name">{tool.name}</h3>
        <p className="tool-card-desc">{tool.description}</p>
      </span>
      {showCategory && <span className="tool-card-tag">{CATEGORIES.find((c) => c.id === tool.category)?.label}</span>}
    </Link>
  );
}
