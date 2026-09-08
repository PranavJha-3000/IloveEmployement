import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { InterviewPrepPage } from "@/components/InterviewPrepPage";

export const metadata: Metadata = {
  title: "Interview Prep — iloveemployment",
  description:
    "Generate interview questions from your actual resume and the actual job description. Know what they're going to ask.",
};

export default function InterviewPrep() {
  return (
    <>
      <Header />
      <InterviewPrepPage />
      <Footer />
    </>
  );
}