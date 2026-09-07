import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DeluluDetectorPage } from "@/components/DeluluDetectorPage";

export const metadata: Metadata = {
  title: "Delulu Detector — iloveemployment",
  description:
    "Are you qualified, or are we being delulu? Compare your actual experience against what the job is asking for. A career-reality tool, not an insult generator.",
};

export default function DeluluDetector() {
  return (
    <>
      <Header />
      <DeluluDetectorPage />
      <Footer />
    </>
  );
}