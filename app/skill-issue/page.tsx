import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SkillIssuePage } from "@/components/SkillIssuePage";

export const metadata: Metadata = {
  title: "Skill Issue — iloveemployment",
  description:
    "Find out exactly why you're getting rejected. No corporate sugarcoating. Just the receipts. A blunt diagnostic tool that explains why a candidate may repeatedly be rejected.",
};

export default function SkillIssue() {
  return (
    <>
      <Header />
      <SkillIssuePage />
      <Footer />
    </>
  );
}
