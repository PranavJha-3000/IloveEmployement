import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StarAnswerBuilderPage } from "@/components/StarAnswerBuilderPage";

export const metadata: Metadata = {
  title: "STAR Answer Builder — iloveemployment",
  description:
    "Turn a messy story into a structured Situation-Task-Action-Result interview answer. No invented metrics.",
};

export default function StarAnswerBuilder() {
  return (
    <>
      <Header />
      <StarAnswerBuilderPage />
      <Footer />
    </>
  );
}