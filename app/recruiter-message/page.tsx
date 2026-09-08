import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RecruiterMessagePage } from "@/components/RecruiterMessagePage";

export const metadata: Metadata = {
  title: "Recruiter Message — iloveemployment",
  description:
    "Short recruiter outreach messages that feel human and specific. No fake familiarity, no flattery, no begging. Based on your actual resume.",
};

export default function RecruiterMessage() {
  return (
    <>
      <Header />
      <RecruiterMessagePage />
      <Footer />
    </>
  );
}