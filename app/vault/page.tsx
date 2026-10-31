import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { VaultManager } from "@/components/vault/VaultManager";

export const metadata: Metadata = {
  title: "Career Vault | iloveemployment",
  description:
    "Store your career history once, in your own browser. Every tool writes from it with citations, and nothing leaves your device until you run a tool.",
};

export default function VaultPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1000px] px-6 pb-20 pt-8">
          <header className="mb-8 max-w-2xl">
            <h1 className="text-[28px] font-bold tracking-tight text-zinc-900">Career Vault</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
              Your career history, stored only in this browser. Add your resume once and it's split into roles, bullets,
              projects and wins. Each tool retrieves just the pieces it needs, cites them, and never invents the rest.
            </p>
          </header>
          <VaultManager />
        </div>
      </main>
      <Footer />
    </>
  );
}
