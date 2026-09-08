import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { EmploymentAuraPage } from "@/components/EmploymentAuraPage";

export const metadata: Metadata = {
  title: "Employment Aura — iloveemployment",
  description:
    "Not scientific. Unfortunately. Take our entirely unserious career aura reading — five component scores, a funny job-title archetype, and real feedback to improve your profile.",
};

export default function EmploymentAura() {
  return (
    <>
      <Header />
      <EmploymentAuraPage />
      <Footer />
    </>
  );
}
