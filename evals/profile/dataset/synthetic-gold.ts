// Hand-written gold for the three Phase 1 retrieval resumes. Transcribed by
// reading evals/retrieval/dataset/resumes.ts; that file is NOT edited (it feeds
// the retrieval fingerprint). Anything the resume does not state is left empty.
import type { StructuredProfile, YearMonth } from "../../../lib/profile/schema";
import { normalizeSkills } from "../../../lib/skills/normalize";

const ym = (year: number, month: number | null = null): YearMonth => ({ year, month });

function role(
  title: string,
  company: string,
  start: YearMonth,
  end: YearMonth | null,
  bullets: string[],
): StructuredProfile["roles"][number] {
  return { title, company, location: "", start, end, current: end === null, bullets };
}

const edu = (degree: string, institution: string, endYear: number): StructuredProfile["education"][number] => ({
  degree,
  institution,
  detail: "",
  startYear: null,
  endYear,
});

const project = (name: string): StructuredProfile["projects"][number] => ({ name, description: "", link: "", skills: [] });

const JUNIOR_FRONTEND: StructuredProfile = {
  contact: { name: "Mara Lindqvist", email: "mara.lindqvist@example.com", phone: "555-0142", location: "Leeds", links: [] },
  roles: [
    role("Frontend Intern", "Brightwell Studio", ym(2024, 6), ym(2024, 9), [
      "Rebuilt the customer onboarding form in React and TypeScript, cutting abandoned sign-ups by 18%",
      "Fixed 27 accessibility issues flagged by axe audits, including missing labels and poor colour contrast",
      "Wrote Jest and Testing Library tests that raised component coverage from 40% to 72%",
      "Paired with a senior designer to turn Figma mockups into reusable Storybook components",
    ]),
    role("Shop Assistant", "Corner Books", ym(2022, 9), ym(2024, 5), [
      "Handled up to 150 customer transactions per shift while keeping the till balanced to the penny",
      "Trained four new part-time staff on the stock system and opening procedures",
      "Organised a weekend reading event that drew 60 local visitors",
    ]),
  ],
  education: [
    edu("Bootcamp Certificate in Web Development", "Northgate Code Academy", 2024),
    edu("BA English Literature", "University of Eastmoor", 2022),
  ],
  skills: normalizeSkills(["JavaScript", "TypeScript", "React", "HTML", "CSS", "Sass", "Jest", "Testing Library", "Storybook", "Git", "Figma", "Vite"]),
  projects: [project("Recipe Finder"), project("Budget Buddy"), project("Weather Cards")],
};

const MID_DATA_ANALYST: StructuredProfile = {
  contact: { name: "Dario Okafor", email: "dario.okafor@example.com", phone: "555-0173", location: "Manchester", links: [] },
  roles: [
    role("Senior Data Analyst", "Fernhill Market", ym(2023, 2), null, [
      "Designed and analysed 14 A/B tests on checkout and search, lifting conversion by 6.5% across the programme",
      "Built a weekly KPI dashboard in Looker covering revenue, repeat rate and delivery SLA for 40 stakeholders",
      "Wrote SQL models in dbt that replaced 30 fragile spreadsheet reports with tested, documented tables",
      "Mentored two junior analysts on experiment design, power calculations and writing clear findings",
      "Presented churn analysis to the executive team that led to a loyalty discount pilot saving £210k a year",
    ]),
    role("Marketing Analyst", "Quillon Retail", ym(2020, 8), ym(2023, 1), [
      "Attributed paid media spend across five channels using SQL and Python, reallocating 15% of budget to better performing campaigns",
      "Forecast monthly demand with Prophet, keeping forecast error under 9% during the seasonal peak",
      "Cleaned and merged CRM and web analytics data covering 1.2 million customers",
      "Automated the Monday reporting pack with Python scripts, saving about six hours every week",
      "Ran customer segmentation using k-means clustering which informed the email campaign calendar",
    ]),
    role("Junior Analyst", "Pennywhistle Foods", ym(2019, 7), ym(2020, 7), [
      "Maintained Excel models for weekly sales and wrote SQL queries against the order database",
      "Reconciled supplier invoices against deliveries and flagged 3% of lines as mismatches",
      "Built the first Tableau dashboard for the category team to track stock levels",
      "Documented data definitions in a shared glossary to end arguments about what counts as an active customer",
    ]),
  ],
  education: [edu("MSc Applied Statistics", "University of Stonebridge", 2019), edu("BSc Economics", "University of Eastmoor", 2018)],
  skills: normalizeSkills(["SQL", "Python", "pandas", "dbt", "Looker", "Tableau", "Excel", "A/B testing", "Statistics", "Git", "BigQuery", "Airflow"]),
  projects: [],
};

const SENIOR_OPS_MANAGER: StructuredProfile = {
  contact: { name: "Helena Brandt", email: "helena.brandt@example.com", phone: "555-0188", location: "Birmingham", links: [] },
  roles: [
    role("Head of Operations", "Larkspur Distribution", ym(2021, 1), null, [
      "Lead 85 staff across two distribution centres and a fleet of 30 vehicles with five direct reports",
      "Cut warehouse operating cost by 12% through slotting redesign and a shift to wave picking",
      "Renegotiated carrier contracts covering 4,000 deliveries a month, saving £640k annually",
      "Raised on-time in-full delivery from 91% to 97% by introducing daily SLA reviews with each carrier",
      "Rolled out a new warehouse management system on time and 8% under a £1.2m budget",
      "Reduced voluntary staff turnover from 28% to 14% by creating a supervisor training programme",
    ]),
    role("Operations Manager", "Tolland Logistics", ym(2017, 3), ym(2020, 12), [
      "Managed a team of 40 across inbound, storage and outbound operations at a 90,000 square foot site",
      "Introduced lean 5S practices that cut picking errors by 35% within six months",
      "Owned the annual peak season plan, hiring 60 temporary workers and delivering all orders with zero missed cutoffs",
      "Led the supplier scorecard process for 25 vendors, retiring the six worst performers",
      "Negotiated a three-year lease extension that held rent flat despite rising local rates",
    ]),
    role("Supply Chain Planner", "Redmoor Manufacturing", ym(2013, 6), ym(2017, 2), [
      "Planned materials for three production lines using MRP and weekly demand reviews",
      "Cut excess inventory by £480k by setting safety stock levels based on demand variability",
      "Coordinated with procurement to qualify two new steel suppliers, shortening lead time by nine days",
      "Prepared the monthly S&OP pack for the leadership team",
    ]),
    role("Graduate Trainee", "Redmoor Manufacturing", ym(2011, 9), ym(2013, 5), [
      "Rotated through quality, procurement and dispatch departments over eighteen months",
      "Mapped the goods-in process and proposed changes that removed two handling steps",
    ]),
  ],
  education: [edu("MBA Operations Management", "Stonebridge Business School", 2016), edu("BEng Industrial Engineering", "University of Eastmoor", 2011)],
  skills: normalizeSkills([
    "Supply chain planning",
    "Warehouse management",
    "Lean",
    "Six Sigma",
    "S&OP",
    "Budgeting",
    "Carrier negotiation",
    "Team leadership",
    "SAP",
    "Excel",
  ]),
  projects: [],
};

export const SYNTHETIC_GOLD: Record<"junior-frontend" | "mid-data-analyst" | "senior-ops-manager", StructuredProfile> = {
  "junior-frontend": JUNIOR_FRONTEND,
  "mid-data-analyst": MID_DATA_ANALYST,
  "senior-ops-manager": SENIOR_OPS_MANAGER,
};
