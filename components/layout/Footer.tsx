"use client";

interface FooterProps {
  /** When provided, the JD Translator link opens the in-page overlay instead of navigating. */
  onOpenTranslator?: () => void;
}

export function Footer({ onOpenTranslator }: FooterProps) {
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
                <button
                  onClick={() => document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" })}
                  className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  All Tools
                </button>
              </li>
              <li>
                <button
                  onClick={() => document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" })}
                  className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  Resume Analyzer
                </button>
              </li>
              <li>
                {onOpenTranslator ? (
                  <button
                    onClick={onOpenTranslator}
                    className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                  >
                    JD Translator
                  </button>
                ) : (
                  <a
                    href="/jd-translator"
                    className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                  >
                    JD Translator
                  </a>
                )}
              </li>
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
                <button
                  onClick={() => document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" })}
                  className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  About
                </button>
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
