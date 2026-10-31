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
        <div className="tool-hero">
          <div className="tool-hero-inner">
            <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Career Vault</h1>
            <p className="tool-lede">
              Your career history, stored only in this browser. Add your resume once and it&apos;s split into roles, bullets,
              projects and wins. Each tool retrieves just the pieces it needs, cites them, and never invents the rest.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-[1000px] px-5 pb-20 pt-8">
          <VaultManager />
        </div>
      </main>
      <Footer />
    </>
  );
}
