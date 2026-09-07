import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CorporateYappingTranslator } from "@/components/CorporateYappingTranslator";

export const metadata: Metadata = {
  title: "JD Translator — iloveemployment",
  description:
    "Decode corporate job-description yapping into human language.",
};

export default function JDTranslatorPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <CorporateYappingTranslator />
      </main>
      <Footer />
    </>
  );
}
