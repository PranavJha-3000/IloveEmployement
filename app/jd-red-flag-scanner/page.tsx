import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JdRedFlagScannerPage } from "@/components/JdRedFlagScannerPage";

export const metadata: Metadata = {
  title: "JD Red Flag Scanner — iloveemployment",
  description:
    "Scan a job description for vague, overloaded, missing, or concerning signals. Reasonable interpretations, never accusations.",
};

export default function JdRedFlagScanner() {
  return (
    <>
      <Header />
      <JdRedFlagScannerPage />
      <Footer />
    </>
  );
}