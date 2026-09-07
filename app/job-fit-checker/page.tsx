import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JobFitCheckerPage } from "@/components/JobFitCheckerPage";

export const metadata: Metadata = {
  title: "Job Fit Checker — iloveemployment",
  description:
    "Should you apply? Find out whether you're a strong candidate, a stretch, or simply delulu. Bring your own API key.",
};

export default function JobFitChecker() {
  return (
    <>
      <Header />
      <JobFitCheckerPage />
      <Footer />
    </>
  );
}