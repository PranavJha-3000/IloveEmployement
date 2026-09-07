"use client";

import { useState } from "react";
import Link from "next/link";

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
  overlay?: boolean;
  navigate?: boolean;
  chevron?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { label: "ATS Checker", href: "/ats-checker", navigate: true },
  { label: "CV Generator", href: "analyzer" },
  { label: "Resume Analyzer", href: "/resume-analyzer", navigate: true },
  { label: "Resume Roast", href: "/resume-roast", navigate: true },
  { label: "Resume Rewriter", href: "/resume-rewriter", navigate: true },
  { label: "Resume Fixer", href: "/resume-fixer", navigate: true },
  { label: "Job Fit Checker", href: "/job-fit-checker", navigate: true },
  { label: "Delulu Detector", href: "/delulu-detector", navigate: true },
  {
    label: "JD Translator",
    href: "/jd-translator",
    external: true,
    overlay: true,
  },
  { label: "Interview Boss Fight", href: "analyzer", chevron: true },
];

interface HeaderProps {
  /** When provided, JD Translator opens the in-page overlay instead of navigating. */
  onOpenTranslator?: () => void;
}

export function Header({ onOpenTranslator }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleNav(id: string) {
    setMobileOpen(false);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const chevronIcon = (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  function renderNavItem(link: NavLink, prefix: string) {
    const isDesktop = prefix === "desktop-";
    const baseClass = isDesktop
      ? "text-[13px] font-medium text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1"
      : "block w-full text-left text-sm font-medium text-zinc-700 hover:text-zinc-900 py-2.5";
    const key = prefix + link.label;

    if (link.overlay && onOpenTranslator) {
      return (
        <button
          key={key}
          onClick={() => {
            setMobileOpen(false);
            onOpenTranslator();
          }}
          className={baseClass}
        >
          {link.label}
          {link.chevron && chevronIcon}
        </button>
      );
    }
    if (link.navigate) {
      return (
        <Link
          key={key}
          href={link.href}
          onClick={() => setMobileOpen(false)}
          className={baseClass}
        >
          {link.label}
          {link.chevron && chevronIcon}
        </Link>
      );
    }
    if (link.external) {
      return (
        <a
          key={key}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
        >
          {link.label}
          {link.chevron && chevronIcon}
        </a>
      );
    }
    return (
      <button
        key={key}
        onClick={() => handleNav(link.href)}
        className={baseClass}
      >
        {link.label}
        {link.chevron && chevronIcon}
      </button>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-zinc-200">
      {/* Desktop layout: full-width flex, left group + right button */}
      <div className="hidden lg:flex w-full h-[64px] items-center">
        {/* Left group: logo + nav */}
        <div className="flex items-center gap-8 pl-[32px]">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="text-xl font-bold tracking-tight flex-shrink-0 focus:outline-none"
          >
            <span className="text-red-600">ilove</span>
            <span className="text-zinc-900">employment</span>
          </button>

          {/* Desktop nav */}
          <nav className="flex items-center gap-8">
            {NAV_LINKS.map((link) => renderNavItem(link, "desktop-"))}
          </nav>
        </div>

        {/* Right: Dashboard button pinned to far right */}
        <div className="ml-auto pr-[32px]">
          <button
            className="border border-zinc-300 text-zinc-400 rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-zinc-50 transition-colors"
            disabled
            aria-disabled
          >
            Dashboard (Coming Soon)
          </button>
        </div>
      </div>

      {/* Mobile: left group + hamburger */}
      <div className="lg:hidden w-full h-[64px] flex items-center pl-[20px] pr-[16px]">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-xl font-bold tracking-tight flex-shrink-0 focus:outline-none"
        >
          <span className="text-red-600">ilove</span>
          <span className="text-zinc-900">employment</span>
        </button>

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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-zinc-100 bg-white px-6 py-4 space-y-0">
          {NAV_LINKS.map((link) => (
            <div key={"mobile-" + link.label} className="pb-1">
              {renderNavItem(link, "mobile-")}
            </div>
          ))}
          <div className="pt-3 mt-2 border-t border-zinc-100">
            <button
              className="w-full border border-zinc-300 text-zinc-400 rounded-lg px-4 py-2.5 text-sm font-medium cursor-not-allowed opacity-60"
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
