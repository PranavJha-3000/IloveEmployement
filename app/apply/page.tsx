import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApplyWorkflow } from "@/components/agent/ApplyWorkflow";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Apply to this job | iloveemployment",
  description:
    "Paste a job description. Check your fit, tailor your resume, write a cover letter and draft outreach, with checkpoints you approve and a budget you can see.",
  alternates: { canonical: "/apply" },
};

export default function ApplyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="tool-hero">
          <div className="tool-hero-inner">
            <nav aria-label="Breadcrumb" className="crumbs">
              <Link href="/#tools">All tools</Link>
              <span aria-hidden>/</span>
              <span>Apply</span>
              <span aria-hidden>/</span>
              <span aria-current="page">Apply to this job</span>
            </nav>
            <div className="tool-title">
              <h1>Apply to this job</h1>
            </div>
            <p className="tool-lede">
              Paste a job description. We check your fit, tailor your resume, write a cover letter and draft outreach, and you approve the checkpoints.
            </p>
          </div>
        </div>

        <div className="tool-body">
          <Suspense fallback={null}>
            <ApplyWorkflow />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
