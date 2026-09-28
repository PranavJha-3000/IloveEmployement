"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Tool } from "@/lib/tools";

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
  /** When provided, tools flagged `overlay` open that panel instead of navigating. */
  onOpenTranslator?: () => void;
  /** Anchor the panel to the trigger's right edge. */
  alignRight?: boolean;
  /** Force a column count; otherwise it is derived from the tool count. */
  columns?: 1 | 2 | 3;
}

/** Small tinted icon tile, matching the marketplace tool cards. */
function ToolIcon({ tool }: { tool: Tool }) {
  return (
    <span
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: tool.tint }}
      aria-hidden
    >
      <svg
        width="17"
        height="17"
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
  );
}

export function NavDropdown({
  label,
  icon,
  tools,
  open,
  onOpenChange,
  onOpenTranslator,
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
        className="flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
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
          className={`absolute top-full z-50 mt-1 w-max max-w-[min(92vw,720px)] rounded-xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/5 ${
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
            {tools.map((tool) =>
              tool.overlay && onOpenTranslator ? (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenTranslator();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-zinc-50"
                >
                  <ToolIcon tool={tool} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-zinc-900">
                      {tool.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {tool.description}
                    </span>
                  </span>
                </button>
              ) : (
                <Link
                  key={tool.id}
                  href={tool.target}
                  onClick={() => onOpenChange(false)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-zinc-50"
                >
                  <ToolIcon tool={tool} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-zinc-900">
                      {tool.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {tool.description}
                    </span>
                  </span>
                </Link>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
