/**
 * Heuristic resume normalization.
 *
 * Splits a raw resume text into structured sections using header-based
 * detection. Does NOT use ML — just regex matching against common
 * section headers. Falls back gracefully: if no sections are detected,
 * the entire text is placed in `rawText` and all sections are empty.
 */

export interface StructuredResume {
  contact: string;
  summary: string;
  experience: string[];
  education: string[];
  projects: string[];
  skills: string[];
  certifications: string[];
  links: string[];
  rawText: string;
}

/** Map section names to regex patterns that match common header variants. */
const SECTION_PATTERNS: Record<
  keyof Omit<StructuredResume, "rawText" | "contact">,
  RegExp
> = {
  summary: /^(summary|about|overview|professional summary|career summary|about me|profile)$/i,
  experience: /^(experience|professional experience|work experience|work history|employment history|career history|professional background)$/i,
  education: /^(education|educational background|academic background|degrees)$/i,
  projects: /^(projects|portfolio projects|notable projects|personal projects)$/i,
  skills: /^(skills|technical skills|core competencies|competencies|tech stack|tools|languages & technologies)$/i,
  certifications: /^(certifications|certification|licenses|professional certifications)$/i,
  links: /^(links|portfolio|websites|social|contact|additional links)$/i,
};

/** Split content into list items: bullet points, numbered items, or newline-separated. */
function splitListItems(content: string): string[] {
  return content
    .split(/\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !/^(summary|experience|education|projects|skills|certifications|links)$/i.test(l),
    );
}

/** Check if a line looks like a section header (short, no bullet, uppercase or title case). */
function looksLikeHeader(line: string): boolean {
  if (line.length > 60) return false;
  if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*"))
    return false;
  return Object.values(SECTION_PATTERNS).some((p) => p.test(line));
}

/**
 * Group list items into entries based on dates or title patterns.
 * e.g. ["Company Name", "Job Title", "• Did thing"]
 * -> ["Company Name — Job Title\n• Did thing"]
 */
function groupEntries(items: string[]): string[] {
  if (items.length === 0) return [];

  const entries: string[] = [];
  let current: string[] = [];

  const dateRegex = /\b(20\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
  const isHeaderLike = (item: string): boolean => {
    if (item.length > 2 && !dateRegex.test(item) && !item.startsWith("•") && !item.startsWith("-")) {
      return true;
    }
    return false;
  };

  for (const item of items) {
    if (isHeaderLike(item) && current.length > 0) {
      entries.push(current.join("\n"));
      current = [];
    }
    current.push(item);
  }
  if (current.length > 0) {
    entries.push(current.join("\n"));
  }

  return entries.filter((e) => e.trim().length > 0);
}


/** Heuristic section matcher: returns section name if line matches a known header pattern. */
function matchSection(line: string): string | null {
  for (const [sectionName, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(line)) return sectionName;
  }
  return null;
}

export function normalizeResume(text: string): StructuredResume {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: StructuredResume = {
    contact: "",
    summary: "",
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    links: [],
    rawText: text,
  };

  // Find section boundaries
  const sectionStarts: { section: string; lineIndex: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!looksLikeHeader(line)) continue;
    const section = matchSection(line);
    if (section) {
      sectionStarts.push({ section, lineIndex: i });
    }
  }

  // If no sections found, return raw text with everything in summary
  if (sectionStarts.length === 0) {
    result.contact = lines.slice(0, 5).join("\n");
    result.summary = lines.join("\n");
    return result;
  }

  // Extract contact info (lines before the first section header)
  const firstSectionIdx = sectionStarts[0].lineIndex;
  if (firstSectionIdx > 0 && firstSectionIdx <= 8) {
    result.contact = lines.slice(0, firstSectionIdx).join("\n");
  }

  // Extract each section's content
  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].lineIndex + 1;
    const end =
      i + 1 < sectionStarts.length
        ? sectionStarts[i + 1].lineIndex
        : lines.length;
    const content = lines.slice(start, end).join("\n");

    const section = sectionStarts[i].section as keyof Omit<
      StructuredResume,
      "rawText" | "contact"
    >;

    if (section === "summary") {
      result.summary = content;
    } else if (section === "links") {
      result.links = splitListItems(content);
    } else if (section === "skills") {
      result.skills = splitListItems(content);
    } else if (section === "certifications") {
      result.certifications = splitListItems(content);
    } else if (section === "experience" || section === "education") {
      const items = splitListItems(content);
      result[section].push(...groupEntries(items));
    } else {
      // projects
      result[section].push(content);
    }
  }

  return result;
}
