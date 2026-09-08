import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookedMeterPage } from "@/components/CookedMeterPage";

export const metadata: Metadata = {
  title: "Cooked Meter — iloveemployment",
  description:
    "How cooked are you? Put your resume against the job and get a blunt visual assessment of how difficult it is to get. A vibe check, not a hiring probability.",
};

export default function CookedMeter() {
  return (
    <>
      <Header />
      <CookedMeterPage />
      <Footer />
    </>
  );
}
