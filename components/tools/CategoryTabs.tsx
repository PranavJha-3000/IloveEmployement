"use client";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/tools";

interface Props {
  active: CategoryId;
  onChange: (id: CategoryId) => void;
  /** tools per category, shown as a small count */
  counts: Partial<Record<CategoryId, number>>;
}

export function CategoryTabs({ active, onChange, counts }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // A zero-height marker just above the bar tells us when it has stuck under the header.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { rootMargin: "-65px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden />
      <div className={`chip-bar${stuck ? " is-stuck" : ""}`}>
        <div className="chips" role="toolbar" aria-label="Filter tools by stage">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" aria-pressed={cat.id === active} onClick={() => onChange(cat.id)} className="chip">
              {cat.label}
              <span className="chip-count">{counts[cat.id]}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
