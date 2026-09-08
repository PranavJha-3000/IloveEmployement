import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AtsBossFightPage } from "@/components/AtsBossFightPage";

export const metadata: Metadata = {
  title: "ATS Boss Fight — iloveemployment",
  description:
    "Fight the robots. Again. Turn ATS optimization into a playful resume-vs-job-description challenge. Your resume has entered the ATS arena.",
};

export default function AtsBossFight() {
  return (
    <>
      <Header />
      <AtsBossFightPage />
      <Footer />
    </>
  );
}
