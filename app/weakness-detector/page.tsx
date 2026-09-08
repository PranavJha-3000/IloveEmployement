import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WeaknessDetectorPage } from "@/components/WeaknessDetectorPage";

export const metadata: Metadata = {
  title: "Weakness Detector — iloveemployment",
  description:
    "Find the interview questions and topics most likely to expose your gaps. Truthful prep strategies, no fake experience.",
};

export default function WeaknessDetector() {
  return (
    <>
      <Header />
      <WeaknessDetectorPage />
      <Footer />
    </>
  );
}