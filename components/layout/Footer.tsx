"use client";

import Link from "next/link";
import { TOOLS } from "@/lib/tools";

interface FooterProps {
  /** When provided, the JD Translator link opens the in-page overlay instead of navigating. */
  onOpenTranslator?: () => void;
}

export function Footer({ onOpenTranslator }: FooterProps) {
  const featured = ["resume-analyzer", "jd-translator"]
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 mt-20">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-lg font-bold tracking-tight">
              <span className="text-red-600">ilove</span>
              <span className="text-zinc-900">employment</span>
            </p>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
              Because apparently getting a job wasn&apos;t already hard enough.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Product</p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/#tools"
                  className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  All Tools
                </Link>
              </li>
              {featured.map((tool) => (
                <li key={tool.id}>
                  {tool.overlay && onOpenTranslator ? (
                    <button
                      onClick={onOpenTranslator}
                      className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      {tool.name}
                    </button>
                  ) : (
                    <Link
                      href={tool.target}
                      className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      {tool.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Links</p>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">Privacy Policy</a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">GitHub</a>
              </li>
              <li>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">LinkedIn</a>
              </li>
              <li>
                <Link
                  href="/#tools"
                  className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Security */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Security</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Your API key is used per-request and never stored. Nothing about you is saved. Not affiliated with Ilovepdf &mdash; we just admire the naming strategy.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} iloveemployment. All rights reserved.
          </p>
          <p className="text-xs text-zinc-400">
            Built with spite and API keys.
          </p>
        </div>
      </div>
    </footer>
  );
}
