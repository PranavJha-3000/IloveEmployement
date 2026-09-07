import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResumeRoastPage } from "@/components/ResumeRoastPage";

export const metadata: Metadata = {
  title: "Resume Roast — iloveemployment",
  description:
    "Send us your resume. We'll tell you what a recruiter is probably thinking. Brutally honest, grounded in your actual resume, never about you as a person.",
};

export default function ResumeRoast() {
  return (
    <>
      <Header />
      <ResumeRoastPage />
      <Footer />
    </>
  );
}