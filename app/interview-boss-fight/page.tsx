import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { InterviewBossFightPage } from "@/components/InterviewBossFightPage";

export const metadata: Metadata = {
  title: "Interview Boss Fight — iloveemployment",
  description:
    "A 10-question mock interview generated from your resume and the actual job description. Get interrogated before the interviewer does.",
};

export default function InterviewBossFight() {
  return (
    <>
      <Header />
      <InterviewBossFightPage />
      <Footer />
    </>
  );
}