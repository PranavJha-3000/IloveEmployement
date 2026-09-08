import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GitHubResumeCheckerPage } from "@/components/GitHubResumeCheckerPage";

export const metadata: Metadata = {
  title: "GitHub Resume Checker — iloveemployment",
  description:
    "Does your GitHub actually back up your resume? Check your receipts before a recruiter does.",
};

export default function GitHubResumeChecker() {
  return (
    <>
      <Header />
      <GitHubResumeCheckerPage />
      <Footer />
    </>
  );
}