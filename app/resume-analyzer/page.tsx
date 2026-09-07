import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResumeAnalyzerPage } from "@/components/ResumeAnalyzerPage";

export const metadata: Metadata = {
  title: "Resume Analyzer — iloveemployment",
  description:
    "Find out how badly your resume matches the job before you send it. Brutally honest AI analysis. Bring your own API key.",
};

export default function ResumeAnalyzer() {
  return (
    <>
      <Header />
      <ResumeAnalyzerPage />
      <Footer />
    </>
  );
}
