import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CoverLetterGeneratorPage } from "@/components/CoverLetterGeneratorPage";

export const metadata: Metadata = {
  title: "Cover Letter Generator — iloveemployment",
  description:
    "Generate a concise, job-specific cover letter based on your actual experience. No corporate fan fiction, no generic AI sludge, no fabrication.",
};

export default function CoverLetterGenerator() {
  return (
    <>
      <Header />
      <CoverLetterGeneratorPage />
      <Footer />
    </>
  );
}