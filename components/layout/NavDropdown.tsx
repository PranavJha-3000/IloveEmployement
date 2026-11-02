"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Tool } from "@/lib/tools";
import { ToolIcon } from "@/components/tools/ToolCard";

/**
 * Hover timings. The open delay is short enough to feel instant; the close
 * delay lets the pointer travel diagonally from the trigger down to the panel
 * without the panel vanishing underneath the cursor.
 */
const HOVER_OPEN_MS = 60;
const HOVER_CLOSE_MS = 200;

interface NavDropdownProps {
  /** Trigger text, e.g. "Optimize". Ignored when `icon` is given. */
  label?: string;
  /** Leading glyph for the trigger, e.g. the "all tools" grid. */
  icon?: React.ReactNode;
  /** Tools rendered inside the panel. */
  tools: Tool[];
  /** Controlled expanded state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Anchor the panel to the trigger's right edge. */
  alignRight?: boolean;
  /** Force a column count; otherwise it is derived from the tool count. */
  columns?: 1 | 2 | 3;
}

export function NavDropdown({
  label,
  icon,
  tools,
  open,
  onOpenChange,
  alignRight = false,
  columns,
}: NavDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  // Unmount safety: never leave a pending timeout behind.
  useEffect(() => clearHoverTimer, [clearHoverTimer]);

  // A completed navigation should never leave a panel hanging open.
  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Dismiss on outside click and on Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const scheduleHover = (next: boolean) => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(
      () => onOpenChange(next),
      next ? HOVER_OPEN_MS : HOVER_CLOSE_MS,
    );
  };

  const colCount: 1 | 2 | 3 =
    columns ?? (tools.length > 9 ? 3 : tools.length > 4 ? 2 : 1);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => scheduleHover(true)}
      onMouseLeave={() => scheduleHover(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium transition-colors hover:bg-[#f3f4f7] hover:text-zinc-950 ${open ? "bg-[#f3f4f7] text-zinc-950" : "text-zinc-700"}`}
      >
        {icon}
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={`ml-0.5 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-1 w-max max-w-[min(92vw,720px)] rounded-2xl border border-[#e4e6eb] bg-white p-2.5 shadow-[0_18px_40px_-16px_rgba(21,23,28,0.25)] ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          <div
            role="group"
            aria-label={label ?? "Tools"}
            className={`grid gap-1 ${
              colCount === 1
                ? "grid-cols-1"
                : colCount === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {tools.map((tool) => (
                <Link
                  key={tool.id}
                  href={tool.target}
                  onClick={() => onOpenChange(false)}
                  className="nav-item flex w-[300px] max-w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[#f3f4f7]"
                >
                  <ToolIcon tool={tool} />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-zinc-950">
                      {tool.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] leading-snug text-zinc-500">
                      {tool.description}
                    </span>
                  </span>
                </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
