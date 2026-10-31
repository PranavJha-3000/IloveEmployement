"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TOOLS, searchTools, type CategoryId } from "@/lib/tools";
import { CategoryTabs } from "./CategoryTabs";
import { ToolCard } from "./ToolCard";

const SUGGESTIONS = ["resume", "salary", "interview", "cold email", "quit"];

const PROMISES = ["Free daily runs, no sign-up", "Your resume stays in your browser", "Nothing invented, every claim cited"];

const CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/**
 * The home page tool finder: a search box, stage chips and one flat grid of
 * every tool, like iLovePDF. Searching ranks the grid and Enter opens the
 * first match.
 */
export function ToolGrid({ hero }: { hero: ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<CategoryId>("all");

  const counts = useMemo(() => {
    const c: Partial<Record<CategoryId, number>> = { all: TOOLS.length };
    for (const t of TOOLS) c[t.category] = (c[t.category] ?? 0) + 1;
    return c;
  }, []);

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    const found = searchTools(query);
    return active === "all" ? found : found.filter((t) => t.category === active);
  }, [query, active]);
  const top = searching ? results[0] : undefined;

  // "/" jumps to search from anywhere on the page, like most tool directories.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function pickCategory(id: CategoryId) {
    setActive(id);
    // Keep the chip bar in view instead of leaving the reader mid-page in a shorter list.
    const shelf = shelfRef.current;
    if (shelf && shelf.getBoundingClientRect().top < 0) {
      window.scrollTo({ top: window.scrollY + shelf.getBoundingClientRect().top - 140, behavior: "smooth" });
    }
  }

  return (
    <>
      <section className="hero">
        {hero}
        <div className={`search${searching ? " is-searching" : ""}`} role="search">
          <label className="search-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="sr-only">Search tools</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && top) router.push(top.target);
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="What do you need to do?"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="search-hint"
            />
            {searching ? (
              <button type="button" className="search-clear" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
                Clear
              </button>
            ) : (
              <kbd className="kbd hidden sm:inline-block" aria-hidden>/</kbd>
            )}
          </label>
          <p id="search-hint" className="search-hint" aria-live="polite">
            {top ? (
              <>
                Press Enter to open <strong>{top.name}</strong>
                {results.length > 1 && `, or pick from ${results.length} matches below`}
              </>
            ) : searching ? (
              "No match yet. Try a different word."
            ) : null}
          </p>
        </div>
        <ul className="promises">
          {PROMISES.map((p) => (
            <li key={p}>
              {CHECK}
              {p}
            </li>
          ))}
        </ul>
      </section>

      <CategoryTabs active={active} onChange={pickCategory} counts={counts} />

      <div className="shelf" id="tools" ref={shelfRef}>
        {results.length > 0 ? (
          <section aria-label="Matching tools">
            <div key={`${active}:${searching}`} className="tool-grid tool-grid-enter">
              {results.map((tool) => (
                <ToolCard key={tool.id} tool={tool} showCategory={searching} top={tool === top} />
              ))}
            </div>
          </section>
        ) : (
          <div className="empty">
            <h2>No tool for “{query.trim()}” yet</h2>
            <p>
              {active !== "all" ? "Nothing in this stage matches. Search every stage, or try one of these:" : "Try one of these, or tell us what to build below."}
            </p>
            <div className="empty-suggest">
              {active !== "all" && (
                <button type="button" className="chip" onClick={() => setActive("all")}>
                  Search all tools
                </button>
              )}
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => setQuery(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
