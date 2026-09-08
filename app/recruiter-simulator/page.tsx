import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RecruiterSimulatorPage } from "@/components/RecruiterSimulatorPage";

export const metadata: Metadata = {
  title: "Recruiter Simulator — iloveemployment",
  description:
    "Simulate the first 30 seconds of a recruiter's resume review. Model-based simulation, not a prediction.",
};

export default function RecruiterSimulator() {
  return (
    <>
      <Header />
      <RecruiterSimulatorPage />
      <Footer />
    </>
  );
}