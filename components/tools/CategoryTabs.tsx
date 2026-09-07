"use client";
import { CATEGORIES, type CategoryId } from "@/lib/tools";

interface Props {
  active: CategoryId;
  onChange: (id: CategoryId) => void;
  /** tools remaining per category, shown as a small count */
  counts?: Partial<Record<CategoryId, number>>;
}

export function CategoryTabs({ active, onChange, counts }: Props) {
  return (
    <div className="tool-tabs" role="tablist" aria-label="Filter tools by category">
      {CATEGORIES.map((cat) => {
        const selected = cat.id === active;
        const count = counts?.[cat.id];
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(cat.id)}
            className={`tool-tab ${selected ? "tool-tab-active" : ""}`}
          >
            {cat.label}
            {count != null && <span className="tool-tab-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
