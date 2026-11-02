// Authored gold profiles. Every person is fictional: example.* emails, 555-01xx
// phones, invented companies and schools. These are written BEFORE any
// extractor exists and the resume texts are rendered from them (render.ts), so
// the labels are correct by construction and cannot be shaped around parser
// behaviour. Skills go through normalizeSkills so canonicalId and matchedFrom
// match what the app itself would produce; unknown skills keep canonicalId null.
import type { StructuredProfile, YearMonth } from "../../../lib/profile/schema";
import { normalizeSkills } from "../../../lib/skills/normalize";
import type { AuthoredProfile } from "./types";

const ym = (year: number, month: number | null = null): YearMonth => ({ year, month });

type RoleIn = {
  title: string;
  company: string;
  start: YearMonth;
  end?: YearMonth;
  bullets: string[];
};

function role(r: RoleIn): StructuredProfile["roles"][number] {
  return { title: r.title, company: r.company, location: "", start: r.start, end: r.end ?? null, current: !r.end, bullets: r.bullets };
}

function edu(degree: string, institution: string, endYear: number, startYear: number | null = null): StructuredProfile["education"][number] {
  return { degree, institution, detail: "", startYear, endYear };
}

function proj(name: string, description: string, link: string, skills: string[]): StructuredProfile["projects"][number] {
  return { name, description, link, skills };
}

function profile(p: {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  roles: RoleIn[];
  education: StructuredProfile["education"];
  skills: string[];
  projects?: StructuredProfile["projects"];
}): StructuredProfile {
  return {
    contact: { name: p.name, email: p.email, phone: p.phone, location: p.location, links: p.links },
    roles: p.roles.map(role),
    education: p.education,
    skills: normalizeSkills(p.skills),
    projects: p.projects ?? [],
  };
}

export const AUTHORED: AuthoredProfile[] = [
  {
    id: "teodora-vance",
    styleId: "classic-caps",
    domain: "software",
    seniority: "senior",
    summary: "Backend engineer with nine years building payment and ledger systems, comfortable owning a service from design through on-call.",
    gold: profile({
      name: "Teodora Vance",
      email: "teodora.vance@example.com",
      phone: "555-0118",
      location: "Denver, CO",
      links: ["github.com/tvance-dev", "linkedin.com/in/teodoravance"],
      roles: [
        {
          title: "Staff Backend Engineer",
          company: "Hollowbrook Payments",
          start: ym(2022, 4),
          bullets: [
            "Designed the settlement service that moves 2.3 million transfers a day with exactly-once semantics",
            "Cut p99 write latency from 840ms to 190ms by batching ledger entries per account shard",
            "Led a team of six engineers through a zero-downtime migration to Kubernetes",
            "Introduced chaos drills that exposed three silent failure modes before launch",
          ],
        },
        {
          title: "Senior Software Engineer",
          company: "Quillfeather Labs",
          start: ym(2018, 9),
          end: ym(2022, 3),
          bullets: [
            "Built the card authorisation API in Go and Postgres handling 600 requests per second",
            "Reduced cloud spend by 31% by right-sizing Kafka consumers and retiring idle clusters",
            "Mentored four engineers, two of whom were promoted within a year",
          ],
        },
        {
          title: "Software Engineer",
          company: "Marrowgate Software",
          start: ym(2015, 6),
          end: ym(2018, 8),
          bullets: [
            "Maintained the invoicing platform used by 1,800 small businesses",
            "Replaced a nightly batch export with an event stream, shrinking report delay from 18 hours to 4 minutes",
            "Wrote the team's first load test suite and ran it in CI",
          ],
        },
      ],
      education: [edu("BS Computer Science", "Westmarch State University", 2015, 2011)],
      skills: ["Go", "k8s", "Kafka", "Postgres", "gRPC", "Terraform", "Chaos drills", "Hexagonal architecture"],
      projects: [
        proj("ledgerlite", "Open source double-entry ledger library with property-based tests", "github.com/tvance-dev/ledgerlite", ["Go", "PostgreSQL"]),
      ],
    }),
  },
  {
    id: "kofi-ranganathan",
    styleId: "modern-informal",
    domain: "data",
    seniority: "mid",
    summary: "Data scientist who likes turning claims data into models that adjusters actually use.",
    gold: profile({
      name: "Kofi Ranganathan",
      email: "kofi.ranganathan@example.org",
      phone: "555-0127",
      location: "Toronto, ON",
      links: ["github.com/kofir-data"],
      roles: [
        {
          title: "Data Scientist",
          company: "Brackenfield Insurance",
          start: ym(2021, 2),
          bullets: [
            "Built a claims triage model that sends 38% of simple claims to fast-track review",
            "Cut model retraining from two days to three hours with Airflow pipelines",
            "Presented fraud-signal findings to the underwriting leadership team each quarter",
          ],
        },
        {
          title: "Junior Data Scientist",
          company: "Tallowmere Analytics",
          start: ym(2019, 7),
          end: ym(2021, 1),
          bullets: [
            "Forecast weekly demand for 120 retail stores using gradient boosting",
            "Wrote SQL feature tables that replaced a set of hand-edited spreadsheets",
          ],
        },
      ],
      education: [edu("MSc Statistics", "Lakehurst University", 2019), edu("BSc Mathematics", "Lakehurst University", 2017)],
      skills: ["Python", "scikit-learn", "SQL", "pandas", "XGBoost", "Bayesian shrinkage", "Airflow", "Tableau"],
      projects: [
        proj("Claims Triage Notebook", "Walkthrough of the triage model with synthetic data", "", ["Python", "scikit-learn"]),
        proj("Bike Share Forecast", "Hourly demand forecast for a city bike share dataset", "", []),
      ],
    }),
  },
  {
    id: "linnea-abara",
    styleId: "education-first-years",
    domain: "design",
    seniority: "junior",
    gold: profile({
      name: "Linnea Abara",
      email: "linnea.abara@example.net",
      phone: "555-0133",
      location: "Bristol",
      links: ["linneaabara.example.net"],
      roles: [
        {
          title: "Product Designer",
          company: "Pinecrest Health",
          start: ym(2023),
          bullets: [
            "Redesigned the appointment booking flow, reducing abandoned bookings by 22%",
            "Ran six usability sessions with patients over 65 and fixed the three biggest blockers",
            "Maintained the component library in Figma shared with four engineers",
          ],
        },
        {
          title: "UX Design Intern",
          company: "Cobblestone Studio",
          start: ym(2022),
          end: ym(2023),
          bullets: [
            "Produced wireframes and clickable prototypes for two client websites",
            "Interviewed eight small business owners for a discovery study",
          ],
        },
      ],
      education: [edu("BA Interaction Design", "Harrowgate College of Art", 2022, 2019)],
      skills: ["Figma", "Sketch", "User research", "Prototyping", "Design systems", "Paper sketch critiques", "Miro boards"],
      projects: [proj("Bus Stop Wayfinding Redesign", "Concept for clearer signage at a busy interchange", "linneaabara.example.net/wayfinding", ["Figma"])],
    }),
  },
  {
    id: "marcus-tillbrook",
    styleId: "slash-dates",
    domain: "product",
    seniority: "senior",
    summary: "Product leader who has taken three B2B products from first customer to profitability.",
    gold: profile({
      name: "Marcus Tillbrook",
      email: "marcus.tillbrook@example.com",
      phone: "555-0141",
      location: "Austin, TX",
      links: ["linkedin.com/in/marcustillbrook"],
      roles: [
        {
          title: "Director of Product",
          company: "Lanternfly Software",
          start: ym(2020, 1),
          bullets: [
            "Own the roadmap for a platform with 900 business customers and a team of 14",
            "Launched usage-based pricing that raised net revenue retention from 98% to 112%",
            "Set quarterly OKRs with engineering and sales and reviewed them in monthly business reviews",
          ],
        },
        {
          title: "Senior Product Manager",
          company: "Stonecrop Systems",
          start: ym(2015, 10),
          end: ym(2019, 12),
          bullets: [
            "Shipped the reporting suite that became the second largest source of upgrades",
            "Interviewed 60 customers a year and turned the findings into a ranked problem list",
          ],
        },
        {
          title: "Business Analyst",
          company: "Ashgrove Consulting",
          start: ym(2012, 9),
          end: ym(2015, 9),
          bullets: [
            "Modelled market entry options for retail clients and presented them to boards",
            "Built the firm's first customer churn dashboard in Excel and SQL",
          ],
        },
      ],
      education: [edu("MBA", "Ashgrove Business School", 2012), edu("BA Economics", "Ashgrove University", 2008)],
      skills: ["Product management", "Roadmapping", "OKRs", "SQL", "Pricing strategy", "Stakeholder management"],
    }),
  },
  {
    id: "sunita-eberhardt",
    styleId: "career-numbered",
    domain: "operations",
    seniority: "mid",
    // Career changer: teaching, a gap of nearly two years, then logistics.
    gold: profile({
      name: "Sunita Eberhardt",
      email: "sunita.eberhardt@example.org",
      phone: "555-0152",
      location: "Leicester",
      links: [],
      roles: [
        {
          title: "Operations Coordinator",
          company: "Fairweather Freight",
          start: ym(2023, 3),
          bullets: [
            "Schedule 40 daily collections across six depots using a shared planning sheet",
            "Cut late pickups by a third after introducing a morning handover checklist",
            "Train new coordinators on the freight tracking system",
          ],
        },
        {
          title: "Mathematics Teacher",
          company: "Greystone Academy",
          start: ym(2015, 9),
          end: ym(2021, 7),
          bullets: [
            "Taught GCSE and A level mathematics to classes of up to 30 students",
            "Raised the share of students reaching grade 5 or above from 61% to 78%",
            "Led the department timetable for two years",
          ],
        },
      ],
      education: [edu("PGCE Secondary Mathematics", "University of Ashby", 2015), edu("BSc Mathematics", "University of Ashby", 2014)],
      skills: ["Excel", "Process improvement", "Route planning", "SAP", "Lesson planning"],
    }),
  },
  {
    id: "joaquin-pellegrini",
    styleId: "toolkit-dotted",
    domain: "business",
    seniority: "mid",
    summary: "Financial analyst who builds planning models and dashboards for finance leaders.",
    gold: profile({
      name: "Joaquin Pellegrini",
      email: "joaquin.pellegrini@example.com",
      phone: "555-0164",
      location: "Chicago, IL",
      links: ["linkedin.com/in/joaquinpellegrini"],
      roles: [
        {
          title: "Senior Financial Analyst",
          company: "Wexcombe Bank",
          start: ym(2021, 6),
          bullets: [
            "Own the monthly forecast for a 220 million dollar loan book",
            "Rebuilt the variance analysis pack in Power BI, saving the team two days every close",
            "Reconciled intercompany balances across four legal entities",
            "Presented budget scenarios to the CFO and regional heads",
          ],
        },
        {
          title: "Financial Analyst",
          company: "Calder Wealth Partners",
          start: ym(2017, 8),
          end: ym(2021, 5),
          bullets: [
            "Prepared quarterly performance reports for 300 private clients",
            "Automated portfolio data pulls with VBA macros and SQL queries",
          ],
        },
      ],
      education: [edu("BCom Finance", "Calder University", 2017, 2013)],
      skills: ["Financial modelling", "Excel", "Power BI", "SQL", "VBA", "Variance analysis", "Hyperion Planning Suite"],
      projects: [proj("Budget Variance Dashboard", "Interactive report of spend against plan by department", "", ["Power BI"])],
    }),
  },
  {
    id: "ngozi-halvorsen",
    styleId: "learning-dash",
    domain: "software",
    seniority: "junior",
    // Self-taught: no education entry at all.
    gold: profile({
      name: "Ngozi Halvorsen",
      email: "ngozi.halvorsen@example.net",
      phone: "555-0175",
      location: "Cork",
      links: ["github.com/ngozih"],
      roles: [
        {
          title: "Frontend Developer (Contract)",
          company: "Peppermill Digital",
          start: ym(2023, 8),
          end: ym(2024, 6),
          bullets: [
            "Built accessible marketing pages in React for three small clients",
            "Converted a jQuery storefront to TypeScript components without changing the design",
            "Fixed 40 browser compatibility bugs reported by the QA tester",
          ],
        },
        {
          title: "Customer Support Agent",
          company: "Dunmore Telecom",
          start: ym(2021, 2),
          end: ym(2023, 7),
          bullets: [
            "Resolved around 35 customer contacts a day with a 94% satisfaction score",
            "Wrote 20 help articles that cut repeat contacts about billing",
          ],
        },
      ],
      education: [],
      skills: ["JS", "ReactJS", "HTML5", "CSS3", "Git", "TypeScript"],
      projects: [
        proj("Plant Tracker", "Watering reminder app that stores data in the browser", "github.com/ngozih/plant-tracker", ["React", "IndexedDB"]),
        proj("Pixel Palette", "Colour contrast checker for designers", "", ["JavaScript"]),
      ],
    }),
  },
  {
    id: "bastien-oyelaran",
    styleId: "skills-first",
    domain: "software",
    seniority: "mid",
    summary: "Site reliability engineer focused on calm on-call rotations and boring deployments.",
    gold: profile({
      name: "Bastien Oyelaran",
      email: "bastien.oyelaran@example.org",
      phone: "555-0186",
      location: "Lyon",
      links: ["github.com/boyelaran", "bastien.example.com"],
      roles: [
        {
          title: "Site Reliability Engineer",
          company: "Kestrel Cloudworks",
          start: ym(2022, 1),
          bullets: [
            "Run the on-call rotation for 35 services and cut pages per week from 40 to 11",
            "Moved the deployment pipeline to GitOps with Terraform and Helm",
            "Wrote the incident review template now used by every engineering team",
          ],
        },
        {
          title: "Systems Administrator",
          company: "Ravenmoor Hosting",
          start: ym(2018, 5),
          end: ym(2021, 12),
          bullets: [
            "Administered 200 Linux servers and automated patching with Ansible",
            "Built Grafana dashboards that gave the support team their first view of disk and memory trends",
          ],
        },
      ],
      education: [edu("BSc Computer Networks", "Thornbury University", 2018, 2014)],
      skills: ["Kubernetes", "Terraform", "Prometheus", "Grafana", "Linux", "AWS", "Python", "Runbook design", "Incident command"],
      projects: [proj("homelab-gitops", "Declarative cluster config for a three node home lab", "github.com/boyelaran/homelab-gitops", ["Kubernetes", "Helm"])],
    }),
  },
  {
    id: "priya-kowalczyk",
    styleId: "plain-no-summary",
    domain: "marketing",
    seniority: "senior",
    gold: profile({
      name: "Priya Kowalczyk",
      email: "priya.kowalczyk@example.com",
      phone: "555-0197",
      location: "Portland, OR",
      links: ["linkedin.com/in/priyakowalczyk"],
      roles: [
        {
          title: "VP Marketing",
          company: "Sablewood Outdoors",
          start: ym(2019, 3),
          bullets: [
            "Lead a marketing team of 18 and a 4.5 million dollar annual budget",
            "Grew organic search traffic by 140% in two years through a content and SEO programme",
            "Repositioned the brand around repair and reuse, lifting repeat purchase rate by 9 points",
          ],
        },
        {
          title: "Marketing Manager",
          company: "Elderfield Goods",
          start: ym(2014, 6),
          end: ym(2019, 2),
          bullets: [
            "Launched the email programme that became 27% of online revenue",
            "Managed agency relationships for paid social and display",
          ],
        },
        {
          title: "Marketing Coordinator",
          company: "Brightloom Media",
          start: ym(2010, 9),
          end: ym(2014, 5),
          bullets: [
            "Coordinated 12 trade shows a year including logistics and speaker booking",
            "Wrote product copy and newsletter articles for six brands",
          ],
        },
      ],
      education: [edu("MA Communications", "Pemberton University", 2010)],
      skills: ["SEO", "Content strategy", "Google Analytics", "HubSpot", "Brand strategy", "Budget management"],
    }),
  },
  {
    id: "wendell-achterberg",
    styleId: "iso-numbered",
    domain: "data",
    seniority: "junior",
    summary: "Recent statistics graduate with analyst internship experience in retail.",
    gold: profile({
      name: "Wendell Achterberg",
      email: "wendell.achterberg@example.net",
      phone: "555-0109",
      location: "Madison, WI",
      links: ["github.com/wachterberg"],
      roles: [
        {
          title: "Data Analyst Intern",
          company: "Coppergate Retail",
          start: ym(2024, 6),
          end: ym(2024, 9),
          bullets: [
            "Cleaned six months of store sales data and flagged 1,200 duplicate transactions",
            "Built a Tableau view of weekly sales by region used in the Monday meeting",
          ],
        },
        {
          title: "Research Assistant",
          company: "Eastlake University",
          start: ym(2023, 1),
          end: ym(2024, 5),
          bullets: [
            "Ran survey analysis in R for a study of 2,400 students",
            "Wrote the methods section for a conference poster",
            "Documented the cleaning steps so the next student could repeat them",
          ],
        },
      ],
      education: [edu("BSc Statistics", "Eastlake University", 2024, 2020)],
      skills: ["SQL", "Excel", "Python", "Tableau", "R", "Survey weighting"],
      projects: [proj("Campus Bike Rentals Analysis", "Seasonal trends in a public rental dataset", "github.com/wachterberg/bike-rentals", ["Python", "pandas"])],
    }),
  },
];
