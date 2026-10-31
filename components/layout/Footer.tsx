"use client";

import Link from "next/link";
import { TOOLS } from "@/lib/tools";

export function Footer() {
  const featured = ["tailor-resume", "job-fit-check", "cold-recruiter-message"]
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <footer className="mt-16 border-t border-[#e4e6eb] bg-white">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-[20px] font-extrabold tracking-[-0.03em]">
              <span className="text-red-600">ilove</span>
              <span className="text-[#15171c]">employment</span>
            </p>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
              Because apparently getting a job wasn&apos;t already hard enough.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="mb-3 text-[14px] font-semibold text-zinc-900">Product</p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/#tools"
                  className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  All Tools
                </Link>
              </li>
              <li>
                <Link href="/vault" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
                  Career Vault
                </Link>
              </li>
              {featured.map((tool) => (
                <li key={tool.id}>
                  <Link href={tool.target} className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <p className="mb-3 text-[14px] font-semibold text-zinc-900">Links</p>
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
            <p className="mb-3 text-[14px] font-semibold text-zinc-900">Security</p>
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
