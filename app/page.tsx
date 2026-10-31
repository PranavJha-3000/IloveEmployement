"use client";
import { useRouter } from "next/navigation";
import type { Tool } from "@/lib/tools";
import { LandingHero } from "@/components/LandingHero";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { ContactForm } from "@/components/ContactForm";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  const router = useRouter();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <LandingHero onCta={() => router.push("/tools/job-fit-checker")} />
        <ToolGrid onToolSelect={(tool: Tool) => router.push(tool.target)} />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
