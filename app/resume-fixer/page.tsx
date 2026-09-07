import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResumeFixerPage } from "@/components/ResumeFixerPage";

export const metadata: Metadata = {
  title: "Resume Fixer — iloveemployment",
  description:
    "Your resume doesn't need a new personality. It needs fixing. Find the weak sections and repair them without rewriting everything.",
};

export default function ResumeFixer() {
  return (
    <>
      <Header />
      <ResumeFixerPage />
      <Footer />
    </>
  );
}
