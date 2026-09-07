import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BulletPointFixerPage } from "@/components/BulletPointFixerPage";

export const metadata: Metadata = {
  title: "Bullet Point Fixer — iloveemployment",
  description:
    "Transform weak resume bullets into concise, specific, impact-oriented bullets. Fix that bullet. Truth filter always on.",
};

export default function BulletPointFixer() {
  return (
    <>
      <Header />
      <BulletPointFixerPage />
      <Footer />
    </>
  );
}