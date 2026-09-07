import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResumeRewriterPage } from "@/components/ResumeRewriterPage";

export const metadata: Metadata = {
  title: "Resume Rewriter — iloveemployment",
  description:
    "Make your resume actually fit the job. Reposition what you already have. We do not manufacture experience. Truth filter always on.",
};

export default function ResumeRewriter() {
  return (
    <>
      <Header />
      <ResumeRewriterPage />
      <Footer />
    </>
  );
}