"use client";
import { useMemo, useState } from "react";
import { TOOLS, type CategoryId, type Tool } from "@/lib/tools";
import { CategoryTabs } from "./CategoryTabs";
import { ToolCard } from "./ToolCard";

interface Props {
  /** called with the tool the user picked; parent scrolls/activates it */
  onToolSelect: (tool: Tool) => void;
}

export function ToolGrid({ onToolSelect }: Props) {
  const [active, setActive] = useState<CategoryId>("all");

  const counts = useMemo(() => {
    const c: Partial<Record<CategoryId, number>> = { all: TOOLS.length };
    for (const t of TOOLS) c[t.category] = (c[t.category] ?? 0) + 1;
    return c;
  }, []);

  const visible = useMemo(
    () => (active === "all" ? TOOLS : TOOLS.filter((t) => t.category === active)),
    [active]
  );

  return (
    <section className="tool-marketplace" id="tools">
      <div className="tool-marketplace-inner">
        <CategoryTabs active={active} onChange={setActive} counts={counts} />
        <div className="tool-grid" role="tabpanel">
          {visible.map((tool) => (
            <ToolCard
              key={`${tool.id}-${tool.category}`}
              tool={tool}
              onSelect={onToolSelect}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
