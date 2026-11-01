// Deterministic resume renderer. Takes a gold profile and a style and prints a
// plain-text resume whose layout varies in section names, dates, bullets,
// ordering, header layout, contact layout and noise. Everything printed comes
// from the gold profile, so labels are correct by construction.
import type { StructuredProfile, YearMonth } from "../../../lib/profile/schema";
import type { RenderStyle, SectionKey } from "./types";

export type { RenderStyle } from "./types";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const RENDER_STYLES: RenderStyle[] = [
  {
    id: "classic-caps", sectionNames: { experience: "Experience", education: "Education", skills: "Skills", projects: "Projects", summary: "Summary" },
    dateStyle: "mon-yyyy", rangeSep: " – ", presentWord: "Present", bullet: "•", order: ["summary", "experience", "education", "skills", "projects"],
    header: "one-line", contactLayout: "pipes", skillsLayout: "comma", linkStyle: "bare", uppercaseHeadings: true,
  },
  {
    id: "modern-informal", sectionNames: { experience: "Where I've Worked", education: "Learning", skills: "Toolkit", projects: "Things I've Built", summary: "About me" },
    dateStyle: "month-yyyy", rangeSep: " - ", presentWord: "Current", bullet: "-", order: ["summary", "skills", "experience", "projects", "education"],
    header: "title-then-company", contactLayout: "lines", skillsLayout: "labelled-groups", linkStyle: "https", uppercaseHeadings: false,
  },
  {
    id: "education-first-years", sectionNames: { experience: "Employment History", education: "Education", skills: "Technical Skills", projects: "Selected Projects" },
    dateStyle: "yyyy", rangeSep: " to ", presentWord: "Now", bullet: "*", order: ["education", "experience", "skills", "projects"],
    header: "company-dash-title", contactLayout: "two-column", skillsLayout: "bullets", linkStyle: "bare", uppercaseHeadings: false,
  },
  {
    id: "slash-dates", sectionNames: { experience: "Professional Experience", education: "Academic Background", skills: "Core Competencies", projects: "Personal Projects", summary: "Profile" },
    dateStyle: "mm/yyyy", rangeSep: " — ", presentWord: "Present", bullet: "▪", order: ["summary", "experience", "education", "skills", "projects"],
    header: "title-at-company", contactLayout: "pipes", skillsLayout: "tabbed-columns", linkStyle: "https", uppercaseHeadings: true,
  },
  {
    id: "career-numbered", sectionNames: { experience: "Career", education: "Education", skills: "Skills", projects: "Projects" },
    dateStyle: "yyyy-mm", rangeSep: " – ", presentWord: "Current", bullet: "numbered", order: ["education", "experience", "skills", "projects"],
    header: "one-line", contactLayout: "lines", skillsLayout: "comma", linkStyle: "bare", uppercaseHeadings: true,
  },
  {
    id: "toolkit-dotted", sectionNames: { experience: "Work Experience", education: "Education", skills: "Toolkit", projects: "Projects", summary: "Summary" },
    dateStyle: "mon.-yyyy", rangeSep: " - ", presentWord: "Now", bullet: "•", order: ["summary", "experience", "projects", "skills", "education"],
    header: "title-then-company", contactLayout: "two-column", skillsLayout: "labelled-groups", linkStyle: "https", uppercaseHeadings: false,
  },
  {
    id: "learning-dash", sectionNames: { experience: "Experience", education: "Learning", skills: "Skills", projects: "Projects" },
    dateStyle: "mon-yyyy", rangeSep: " — ", presentWord: "Present", bullet: "-", order: ["experience", "education", "skills", "projects"],
    header: "company-dash-title", contactLayout: "pipes", skillsLayout: "bullets", linkStyle: "bare", uppercaseHeadings: false,
  },
  {
    id: "skills-first", sectionNames: { experience: "Professional Experience", education: "Education", skills: "Key Skills", projects: "Projects", summary: "Professional Summary" },
    dateStyle: "month-yyyy", rangeSep: " to ", presentWord: "Current", bullet: "*", order: ["summary", "skills", "experience", "education", "projects"],
    header: "title-at-company", contactLayout: "lines", skillsLayout: "tabbed-columns", linkStyle: "https", uppercaseHeadings: true,
  },
  {
    id: "plain-no-summary", sectionNames: { experience: "Experience", education: "Education", skills: "Skills", projects: "Projects" },
    dateStyle: "mm/yyyy", rangeSep: " - ", presentWord: "Present", bullet: "▪", order: ["experience", "education", "skills", "projects"],
    header: "one-line", contactLayout: "two-column", skillsLayout: "comma", linkStyle: "bare", uppercaseHeadings: false,
  },
  {
    id: "iso-numbered", sectionNames: { experience: "Employment", education: "Education", skills: "Skills", projects: "Projects", summary: "Objective" },
    dateStyle: "yyyy-mm", rangeSep: " – ", presentWord: "Now", bullet: "numbered", order: ["summary", "experience", "projects", "skills", "education"],
    header: "title-then-company", contactLayout: "pipes", skillsLayout: "bullets", linkStyle: "https", uppercaseHeadings: false,
  },
];

export function fmtDate(d: YearMonth, style: RenderStyle["dateStyle"]): string {
  const m = d.month;
  if (style === "yyyy" || m === null) return String(d.year);
  switch (style) {
    case "mon-yyyy":
      return `${MONTHS_SHORT[m - 1]} ${d.year}`;
    case "month-yyyy":
      return `${MONTHS_LONG[m - 1]} ${d.year}`;
    case "mm/yyyy":
      return `${String(m).padStart(2, "0")}/${d.year}`;
    case "yyyy-mm":
      return `${d.year}-${String(m).padStart(2, "0")}`;
    case "mon.-yyyy":
      return `${MONTHS_SHORT[m - 1]}${m === 5 ? "" : "."} ${d.year}`;
  }
}

function range(start: YearMonth | null, end: YearMonth | null, current: boolean, style: RenderStyle): string {
  const s = start ? fmtDate(start, style.dateStyle) : "";
  const e = current ? style.presentWord : end ? fmtDate(end, style.dateStyle) : "";
  if (s && e) return `${s}${style.rangeSep}${e}`;
  return s || e;
}

function bulletLines(bullets: string[], style: RenderStyle): string[] {
  return bullets.map((b, i) => (style.bullet === "numbered" ? `${i + 1}. ${b}` : `${style.bullet} ${b}`));
}

function heading(name: string, style: RenderStyle): string {
  return style.uppercaseHeadings ? name.toUpperCase() : name;
}

function link(l: string, style: RenderStyle): string {
  return style.linkStyle === "https" && !/^https?:\/\//.test(l) ? `https://${l}` : l;
}

function contactBlock(p: StructuredProfile, style: RenderStyle): string[] {
  const c = p.contact;
  const links = c.links.map((l) => link(l, style));
  if (style.contactLayout === "pipes") {
    const line = [c.email, c.phone, c.location, ...links].filter(Boolean).join(" | ");
    return [c.name, line].filter(Boolean);
  }
  if (style.contactLayout === "lines") {
    return [c.name, c.location, c.email, c.phone, ...links].filter(Boolean);
  }
  // two-column noise: values on a line are separated by runs of spaces
  const pad = " ".repeat(8);
  const rows = [[c.name, c.location], [c.email, c.phone]].map((r) => r.filter(Boolean).join(pad)).filter(Boolean);
  if (links.length) rows.push(links.join(pad));
  return rows;
}

function roleBlock(r: StructuredProfile["roles"][number], style: RenderStyle): string[] {
  const dates = range(r.start, r.end, r.current, style);
  const out: string[] = [];
  switch (style.header) {
    case "one-line":
      out.push(`${r.title}, ${r.company}${dates ? ` | ${dates}` : ""}`);
      break;
    case "title-then-company":
      out.push(r.title, `${r.company}${dates ? ` | ${dates}` : ""}`);
      break;
    case "company-dash-title":
      out.push(`${r.company} — ${r.title}${dates ? ` (${dates})` : ""}`);
      break;
    case "title-at-company":
      out.push(`${r.title} at ${r.company}${dates ? `, ${dates}` : ""}`);
      break;
  }
  out.push(...bulletLines(r.bullets, style));
  return out;
}

function eduBlock(e: StructuredProfile["education"][number], style: RenderStyle): string[] {
  const years = e.startYear !== null && e.endYear !== null ? `${e.startYear}${style.rangeSep}${e.endYear}` : e.endYear !== null ? String(e.endYear) : "";
  const line = [e.degree, e.institution].filter(Boolean).join(", ");
  return [`${line}${years ? ` | ${years}` : ""}`];
}

function projectBlock(pr: StructuredProfile["projects"][number], style: RenderStyle): string[] {
  const out = [pr.link ? `${pr.name} | ${link(pr.link, style)}` : pr.name];
  if (pr.description) out.push(...bulletLines([pr.description], style));
  if (pr.skills.length) out.push(`Built with: ${pr.skills.join(", ")}`);
  return out;
}

const GROUP_LABELS = ["Languages", "Frameworks", "Tools", "Practices"];

function skillsBlock(p: StructuredProfile, style: RenderStyle): string[] {
  // Printed exactly as the author wrote them (matchedFrom), so aliases such as "JS" appear.
  const raws = p.skills.flatMap((s) => s.matchedFrom);
  switch (style.skillsLayout) {
    case "comma":
      return [raws.join(", ")];
    case "labelled-groups": {
      const per = Math.max(2, Math.ceil(raws.length / GROUP_LABELS.length));
      const lines: string[] = [];
      for (let i = 0; i * per < raws.length; i++) lines.push(`${GROUP_LABELS[i % GROUP_LABELS.length]}: ${raws.slice(i * per, (i + 1) * per).join(", ")}`);
      return lines;
    }
    case "bullets":
      return bulletLines(raws, { ...style, bullet: style.bullet === "numbered" ? "•" : style.bullet });
    case "tabbed-columns": {
      const lines: string[] = [];
      for (let i = 0; i < raws.length; i += 3) lines.push(raws.slice(i, i + 3).join("\t"));
      return lines;
    }
  }
}

export function renderResume(profile: StructuredProfile, style: RenderStyle, opts: { summary?: string } = {}): string {
  const lines: string[] = [...contactBlock(profile, style), ""];
  const section = (key: SectionKey): string[] => {
    switch (key) {
      case "summary":
        return opts.summary && style.sectionNames.summary ? [heading(style.sectionNames.summary, style), opts.summary, ""] : [];
      case "experience":
        return profile.roles.length
          ? [heading(style.sectionNames.experience, style), ...profile.roles.flatMap((r, i) => [...(i ? [""] : []), ...roleBlock(r, style)]), ""]
          : [];
      case "education":
        return profile.education.length ? [heading(style.sectionNames.education, style), ...profile.education.flatMap((e) => eduBlock(e, style)), ""] : [];
      case "skills":
        return profile.skills.length ? [heading(style.sectionNames.skills, style), ...skillsBlock(profile, style), ""] : [];
      case "projects":
        return profile.projects.length
          ? [heading(style.sectionNames.projects, style), ...profile.projects.flatMap((pr, i) => [...(i ? [""] : []), ...projectBlock(pr, style)]), ""]
          : [];
    }
  };
  for (const key of style.order) lines.push(...section(key));
  return lines.join("\n").trimEnd() + "\n";
}
