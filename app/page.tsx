import { LandingHero } from "@/components/LandingHero";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { ContactForm } from "@/components/ContactForm";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="finder">
          <ToolGrid hero={<LandingHero />} />
        </div>
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
