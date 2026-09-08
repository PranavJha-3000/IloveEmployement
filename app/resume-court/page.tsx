import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResumeCourtPage } from "@/components/ResumeCourtPage";

export const metadata: Metadata = {
  title: "Resume Court — iloveemployment",
  description:
    "Put your resume on trial. Every impressive claim needs receipts. A playful evidence-analysis tool that determines whether your resume claims are supported.",
};

export default function ResumeCourt() {
  return (
    <>
      <Header />
      <ResumeCourtPage />
      <Footer />
    </>
  );
}
