import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResumeTruthDetectorPage } from "@/components/ResumeTruthDetectorPage";

export const metadata: Metadata = {
  title: "Resume Truth Detector — iloveemployment",
  description:
    "Receipts or trust-me-bro? See which resume claims are backed by actual evidence in your sources.",
};

export default function ResumeTruthDetector() {
  return (
    <>
      <Header />
      <ResumeTruthDetectorPage />
      <Footer />
    </>
  );
}