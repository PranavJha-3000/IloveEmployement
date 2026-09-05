"use client";

import { useState } from "react";

const NAV_LINKS = [
  { label: "Resume Analyzer", href: "#analyzer" },
  { label: "JD Translator", href: "#translator" },
  { label: "Interview Boss Fight", href: "#results" },
  { label: "About", href: "#about" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleNav(href: string) {
    setMobileOpen(false);
    const id = href.replace("#", "");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-[1240px] mx-auto px-5 w-full h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-xl font-bold tracking-tight flex-shrink-0 focus:outline-none"
        >
          <span className="text-red-600">ilove</span>
          <span className="text-zinc-900">employment</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNav(link.href)}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          <button
            disabled
            className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed"
            title="Coming soon"
          >
            Dashboard (Coming Soon)
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-zinc-100 transition-colors"
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-zinc-700">
            {mobileOpen ? (
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <>
                <path d="M3 6H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 10H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-100 bg-white px-6 py-4 space-y-3 animate-fade-up">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNav(link.href)}
              className="block w-full text-left text-sm font-medium text-zinc-700 hover:text-zinc-900 py-2"
            >
              {link.label}
            </button>
          ))}
          <button
            disabled
            className="w-full px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed"
          >
            Dashboard (Coming Soon)
          </button>
        </div>
      )}
    </header>
  );
}
