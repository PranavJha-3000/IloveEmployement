"use client";
import type { Tool } from "@/lib/tools";

interface Props {
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

export function ToolCard({ tool, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      className="tool-card"
      aria-label={`Open ${tool.name}`}
    >
      <span className="tool-card-icon" style={{ backgroundColor: tool.tint }} aria-hidden>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={tool.accent}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {tool.iconPaths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      </span>
      <h3 className="tool-card-name">{tool.name}</h3>
      <p className="tool-card-desc">{tool.description}</p>
    </button>
  );
}
