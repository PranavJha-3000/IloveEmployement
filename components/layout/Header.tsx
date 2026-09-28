"use client";

import { useState } from "react";
import Link from "next/link";
import { TOOLS, type CategoryId, type Tool } from "@/lib/tools";
import { NavDropdown } from "./NavDropdown";

/**
 * The header nav is derived from the single TOOLS source of truth rather than
 * a hand-maintained list, so a tool can never be added to the marketplace and
 * silently go missing from navigation (or vice versa).
 */

/** Promoted to always-visible links beside the logo, like iLovePDF's top picks. */
const HERO_TOOL_IDS = ["resume-analyzer", "resume-roast"];

/**
 * Dropdown groups. The five marketplace categories collapse into three menus so
 * the bar stays at five items (two hero links + three menus). Each menu names
 * the categories it draws from instead of listing tools, so adding a tool to
 * lib/tools.ts is still all it takes for it to appear here.
 */
const NAV_MENUS: {
  id: string;
  label: string;
  categories: Exclude<CategoryId, "all">[];
  columns: 1 | 2 | 3;
}[] = [
  {
    id: "resume-tools",
    label: "Resume Tools",
    categories: ["analyze", "optimize"],
    columns: 2,
  },
  {
    id: "research-prep",
    label: "Research & Prep",
    categories: ["investigate", "prepare"],
    columns: 2,
  },
  { id: "chaos", label: "Chaos", categories: ["chaos"], columns: 2 },
];

interface HeaderProps {
  /** When provided, JD Translator opens the in-page overlay instead of navigating. */
  onOpenTranslator?: () => void;
}

const heroTools = HERO_TOOL_IDS.map((id) => TOOLS.find((t) => t.id === id)).filter(
  (t): t is Tool => Boolean(t),
);

const menus = NAV_MENUS.map((menu) => ({
  ...menu,
  // Hero tools already have their own link, so don't repeat them in a menu.
  tools: TOOLS.filter(
    (t) =>
      menu.categories.includes(t.category) && !HERO_TOOL_IDS.includes(t.id),
  ),
})).filter((m) => m.tools.length > 0);

const ALL_TOOLS_ICON = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <circle cx="5" cy="5" r="1.7" />
    <circle cx="10" cy="5" r="1.7" />
    <circle cx="15" cy="5" r="1.7" />
    <circle cx="5" cy="10" r="1.7" />
    <circle cx="10" cy="10" r="1.7" />
    <circle cx="15" cy="10" r="1.7" />
    <circle cx="5" cy="15" r="1.7" />
    <circle cx="10" cy="15" r="1.7" />
    <circle cx="15" cy="15" r="1.7" />
  </svg>
);

export function Header({ onOpenTranslator }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Id of the single open desktop dropdown; only one is open at a time. */
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function openTranslator() {
    setMobileOpen(false);
    setOpenMenu(null);
    onOpenTranslator?.();
  }

  function renderMobileTool(tool: Tool) {
    const className =
      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50";
    const label = (
      <>
        <span>{tool.name}</span>
        <span className="ml-auto text-[11px] text-zinc-400">
          {tool.category}
        </span>
      </>
    );

    if (tool.overlay && onOpenTranslator) {
      return (
        <button
          key={tool.id}
          type="button"
          onClick={openTranslator}
          className={className}
        >
          {label}
        </button>
      );
    }
    return (
      <Link
        key={tool.id}
        href={tool.target}
        onClick={() => setMobileOpen(false)}
        className={className}
      >
        {label}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-zinc-200">
      {/* Desktop: logo, a couple of hero links, then category dropdowns */}
      <div className="hidden lg:flex w-full h-[64px] items-center gap-1 pl-[32px] pr-[32px]">
        {/* Logo — navigates home from any page */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight flex-shrink-0 mr-4 focus:outline-none"
        >
          <span className="text-red-600">ilove</span>
          <span className="text-zinc-900">employment</span>
        </Link>

        <nav className="flex items-center gap-0.5" aria-label="Primary">
          {heroTools.map((tool) =>
            tool.overlay && onOpenTranslator ? (
              <button
                key={tool.id}
                type="button"
                onClick={openTranslator}
                className="rounded-md px-3 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {tool.name}
              </button>
            ) : (
              <Link
                key={tool.id}
                href={tool.target}
                className="rounded-md px-3 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {tool.name}
              </Link>
            ),
          )}

          {menus.map((menu) => (
            <NavDropdown
              key={menu.id}
              label={menu.label}
              tools={menu.tools}
              columns={menu.columns}
              open={openMenu === menu.id}
              onOpenChange={(next) => setOpenMenu(next ? menu.id : null)}
              onOpenTranslator={
                menu.tools.some((t) => t.overlay) ? openTranslator : undefined
              }
            />
          ))}
        </nav>

        {/* Right: every tool, then the Dashboard placeholder */}
        <div className="ml-auto flex items-center gap-2">
          <NavDropdown
            icon={ALL_TOOLS_ICON}
            label="All tools"
            tools={TOOLS}
            open={openMenu === "all"}
            onOpenChange={(next) => setOpenMenu(next ? "all" : null)}
            onOpenTranslator={
              TOOLS.some((t) => t.overlay) ? openTranslator : undefined
            }
            alignRight
            columns={3}
          />

          <button
            className="ml-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-[13px] font-medium text-zinc-400 cursor-not-allowed select-none"
            disabled
            aria-disabled
            title="Coming soon"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Mobile: logo + hamburger */}
      <div className="lg:hidden w-full h-[64px] flex items-center pl-[20px] pr-[16px]">
        {/* Logo — navigates home from any page */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight flex-shrink-0 focus:outline-none"
        >
          <span className="text-red-600">ilove</span>
          <span className="text-zinc-900">employment</span>
        </Link>

        {/* Mobile hamburger pinned to right */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="ml-auto p-2 rounded-lg hover:bg-zinc-100 transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="text-zinc-700"
          >
            {mobileOpen ? (
              <path
                d="M5 5L15 15M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path
                  d="M3 6H17"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M3 10H17"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M3 14H17"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu — every tool, grouped by category */}
      {mobileOpen && (
        <div className="lg:hidden max-h-[calc(100vh-64px)] overflow-y-auto border-t border-zinc-100 bg-white px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Start here
          </p>
          <div className="mt-1 space-y-0.5">
            {heroTools.map((tool) => renderMobileTool(tool))}
          </div>

          {menus.map((menu) => (
            <div key={menu.id} className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {menu.label}
              </p>
              <div className="mt-1 space-y-0.5">
                {menu.tools.map((tool) => renderMobileTool(tool))}
              </div>
            </div>
          ))}

          <div className="mt-5 border-t border-zinc-100 pt-4">
            <button
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-400 cursor-not-allowed select-none"
              disabled
              aria-disabled
            >
              Dashboard (Coming Soon)
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
