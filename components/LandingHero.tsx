import { TOOLS } from "@/lib/tools";

export function LandingHero() {
  return (
    <>
      <h1>Every tool for getting hired</h1>
      <p className="hero-sub">
        {TOOLS.length} free tools to check your fit, fix your resume, prep for interviews and write every email from the
        first cold message to the resignation letter.
      </p>
    </>
  );
}
