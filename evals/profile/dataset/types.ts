// Profile extraction dataset types. Gold profiles are authored first and the
// resume texts are rendered from them, so every label is correct by construction.
import type { StructuredProfile } from "../../../lib/profile/schema";

export type SectionKey = "summary" | "experience" | "education" | "skills" | "projects";

export interface RenderStyle {
  id: string;
  sectionNames: { experience: string; education: string; skills: string; projects: string; summary?: string };
  dateStyle: "mon-yyyy" | "month-yyyy" | "mm/yyyy" | "yyyy-mm" | "yyyy" | "mon.-yyyy";
  rangeSep: " – " | " - " | " to " | " — ";
  presentWord: "Present" | "Current" | "Now";
  bullet: "•" | "-" | "*" | "▪" | "numbered";
  order: SectionKey[];
  header: "one-line" | "title-then-company" | "company-dash-title" | "title-at-company";
  contactLayout: "pipes" | "lines" | "two-column";
  skillsLayout: "comma" | "labelled-groups" | "bullets" | "tabbed-columns";
  linkStyle: "bare" | "https";
  uppercaseHeadings: boolean;
}

export interface GoldResume {
  id: string;
  source: "rendered" | "synthetic";
  styleId: string | null;
  text: string;
  gold: StructuredProfile;
}

/** An authored person: the gold profile, the style to render it in and an optional summary paragraph. */
export interface AuthoredProfile {
  id: string;
  styleId: string;
  domain: "software" | "data" | "design" | "product" | "operations" | "business" | "marketing";
  seniority: "junior" | "mid" | "senior";
  summary?: string;
  gold: StructuredProfile;
}
