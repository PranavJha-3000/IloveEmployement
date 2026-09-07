import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AtsCheckerPage } from "@/components/AtsCheckerPage";

export const metadata: Metadata = {
  title: "ATS Checker — iloveemployment",
  description:
    "Will the robots understand your resume? Check formatting, structure and keyword coverage before you apply. Bring your own API key.",
};

export default function AtsChecker() {
  return (
    <>
      <Header />
      <AtsCheckerPage />
      <Footer />
    </>
  );
}