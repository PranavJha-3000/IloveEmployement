import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RizzScorePage } from "@/components/RizzScorePage";

export const metadata: Metadata = {
  title: "Rizz Score — iloveemployment",
  description:
    "Not romantic rizz. Recruiter rizz. Measure how convincing your job application is based on resume + JD alignment. A playful score, not a hiring prediction.",
};

export default function RizzScore() {
  return (
    <>
      <Header />
      <RizzScorePage />
      <Footer />
    </>
  );
}
