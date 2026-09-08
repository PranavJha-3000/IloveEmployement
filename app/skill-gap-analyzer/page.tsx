import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SkillGapAnalyzerPage } from "@/components/SkillGapAnalyzerPage";

export const metadata: Metadata = {
  title: "Skill Gap Analyzer — iloveemployment",
  description:
    "Compare your actual profile against a target job and see exactly what's missing. No keyword-panic, no 'learn everything' advice.",
};

export default function SkillGapAnalyzer() {
  return (
    <>
      <Header />
      <SkillGapAnalyzerPage />
      <Footer />
    </>
  );
}