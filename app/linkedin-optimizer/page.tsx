import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LinkedInOptimizerPage } from "@/components/LinkedInOptimizerPage";

export const metadata: Metadata = {
  title: "LinkedIn Optimizer — iloveemployment",
  description:
    "Analyze and improve your LinkedIn profile so it's consistent with your actual experience and target role. No fabrication, no fluff, just recruiter-ready copy.",
};

export default function LinkedInOptimizer() {
  return (
    <>
      <Header />
      <LinkedInOptimizerPage />
      <Footer />
    </>
  );
}
