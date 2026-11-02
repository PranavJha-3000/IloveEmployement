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
const HERO_TOOL_IDS = ["tailor-resume"];

/**
 * Dropdown groups. The lifecycle categories collapse into four menus so the
 * bar stays short. Each menu names the categories it draws from instead of
 * listing tools, so adding a tool to lib/tools.ts (or a preset to
 * lib/presets) is still all it takes for it to appear here.
 */
const NAV_MENUS: {
  id: string;
  label: string;
  categories: Exclude<CategoryId, "all">[];
  columns: 1 | 2 | 3;
}[] = [
  { id: "job-search", label: "Job Search", categories: ["target", "materials"], columns: 2 },
  { id: "apply-interview", label: "Apply & Interview", categories: ["outreach", "interview", "offer"], columns: 2 },
  { id: "work-career", label: "Work & Career", categories: ["transition", "work", "growth"], columns: 2 },
  { id: "fun", label: "Fun", categories: ["fun"], columns: 2 },
];

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

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Id of the single open desktop dropdown; only one is open at a time. */
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function renderMobileTool(tool: Tool) {
    const className =
      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-[15px] font-medium text-zinc-800 transition-colors hover:bg-[#f3f4f7]";
    const label = (
      <>
        <span>{tool.name}</span>

      </>
    );

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
    <header className="sticky top-0 z-50 w-full border-b border-[#e4e6eb] bg-white/95 backdrop-blur">
      {/* Desktop: logo, a couple of hero links, then category dropdowns */}
      <div className="hidden xl:flex w-full h-[64px] items-center gap-1 pl-[32px] pr-[32px]">
        {/* Logo — navigates home from any page */}
        <Link
          href="/"
          className="mr-5 flex-shrink-0 text-[21px] font-extrabold tracking-[-0.03em]"
        >
          <span className="text-red-600">ilove</span>
          <span className="text-[#15171c]">employment</span>
        </Link>

        <nav className="flex items-center gap-0.5" aria-label="Primary">
          {heroTools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.target}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium text-zinc-700 transition-colors hover:bg-[#f3f4f7] hover:text-zinc-950"
              >
                {tool.name}
              </Link>
          ))}

          <Link
            href="/apply"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium text-zinc-700 transition-colors hover:bg-[#f3f4f7] hover:text-zinc-950"
          >
            Apply to a job
          </Link>

          {menus.map((menu) => (
            <NavDropdown
              key={menu.id}
              label={menu.label}
              tools={menu.tools}
              columns={menu.columns}
              open={openMenu === menu.id}
              onOpenChange={(next) => setOpenMenu(next ? menu.id : null)}
            />
          ))}
        </nav>

        {/* Right: every tool, then the Career Vault */}
        <div className="ml-auto flex items-center gap-2">
          <NavDropdown
            icon={ALL_TOOLS_ICON}
            label="All tools"
            tools={TOOLS}
            open={openMenu === "all"}
            onOpenChange={(next) => setOpenMenu(next ? "all" : null)}
            alignRight
            columns={3}
          />

          <Link
            href="/vault"
            className="ml-2 whitespace-nowrap rounded-[10px] bg-[#e5322d] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#c4241f]"
          >
            Career Vault
          </Link>
        </div>
      </div>

      {/* Mobile: logo + hamburger */}
      <div className="xl:hidden w-full h-[64px] flex items-center pl-[20px] pr-[16px]">
        {/* Logo — navigates home from any page */}
        <Link
          href="/"
          className="flex-shrink-0 text-[20px] font-extrabold tracking-[-0.03em]"
        >
          <span className="text-red-600">ilove</span>
          <span className="text-[#15171c]">employment</span>
        </Link>

        {/* Mobile hamburger pinned to right */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="ml-auto p-2 rounded-lg hover:bg-zinc-100 transition-colors"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
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
        <div className="xl:hidden max-h-[calc(100vh-64px)] overflow-y-auto border-t border-zinc-100 bg-white px-5 py-4">
          <Link
            href="/#tools"
            onClick={() => setMobileOpen(false)}
            className="mb-3 block w-full rounded-[10px] border border-[#e4e6eb] px-4 py-3 text-center text-[15px] font-semibold text-zinc-900"
          >
            Search all {TOOLS.length} tools
          </Link>
          <p className="text-[13px] font-semibold text-zinc-500">
            Start here
          </p>
          <div className="mt-1 space-y-0.5">
            {heroTools.map((tool) => renderMobileTool(tool))}
            <Link
              href="/apply"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-[15px] font-medium text-zinc-800 transition-colors hover:bg-[#f3f4f7]"
            >
              Apply to a job
            </Link>
          </div>

          {menus.map((menu) => (
            <div key={menu.id} className="mt-4">
              <p className="text-[13px] font-semibold text-zinc-500">
                {menu.label}
              </p>
              <div className="mt-1 space-y-0.5">
                {menu.tools.map((tool) => renderMobileTool(tool))}
              </div>
            </div>
          ))}

          <div className="mt-5 border-t border-zinc-100 pt-4">
            <Link
              href="/vault"
              onClick={() => setMobileOpen(false)}
              className="block w-full rounded-[10px] bg-[#e5322d] px-4 py-3 text-center text-[15px] font-semibold text-white"
            >
              Career Vault
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
