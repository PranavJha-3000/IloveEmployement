import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TellMeAboutYourselfPage } from "@/components/TellMeAboutYourselfPage";

export const metadata: Metadata = {
  title: "Tell Me About Yourself — iloveemployment",
  description:
    "Build a concise, natural answer to the classic interview opener from your actual background and the target role.",
};

export default function TellMeAboutYourself() {
  return (
    <>
      <Header />
      <TellMeAboutYourselfPage />
      <Footer />
    </>
  );
}