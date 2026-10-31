// Three fully fictional resumes for retrieval evaluation. Names, companies and
// schools are invented; emails use example.com and phones use the 555-01xx range.
import type { SyntheticResume } from "./types";

const JUNIOR_FRONTEND = `Mara Lindqvist
mara.lindqvist@example.com | 555-0142 | Leeds

SUMMARY
Early-career frontend developer who completed a twelve-week bootcamp and a summer internship, with a focus on accessible React interfaces and clean component design.

EXPERIENCE
Frontend Intern, Brightwell Studio | Jun 2024 – Sep 2024
• Rebuilt the customer onboarding form in React and TypeScript, cutting abandoned sign-ups by 18%
• Fixed 27 accessibility issues flagged by axe audits, including missing labels and poor colour contrast
• Wrote Jest and Testing Library tests that raised component coverage from 40% to 72%
• Paired with a senior designer to turn Figma mockups into reusable Storybook components

Shop Assistant, Corner Books | Sep 2022 – May 2024
• Handled up to 150 customer transactions per shift while keeping the till balanced to the penny
• Trained four new part-time staff on the stock system and opening procedures
• Organised a weekend reading event that drew 60 local visitors

PROJECTS
Recipe Finder | 2024
• Built a recipe search app with React, Vite and a public REST API, with debounced search and pagination
• Added keyboard navigation and ARIA live regions so screen reader users hear result counts
• Deployed to Netlify with a GitHub Actions pipeline that runs linting and tests on every push
• Cached API responses in localStorage which halved repeat load time

Budget Buddy | 2023
• Created a personal budgeting dashboard with Chart.js showing monthly spending by category
• Stored data in IndexedDB so the app works offline as a progressive web app
• Wrote a CSV import feature that validates dates and amounts before saving
• Gathered feedback from five friends and reworked the navigation based on their comments

Weather Cards | 2023
• Designed a responsive weather widget using CSS Grid and custom properties for light and dark themes
• Fetched forecasts with async await and handled network failures with a friendly retry message
• Achieved a Lighthouse performance score of 96 on mobile
• Open sourced the widget and accepted two pull requests from strangers

SKILLS
JavaScript, TypeScript, React, HTML, CSS, Sass, Jest, Testing Library, Storybook, Git, Figma, Vite

EDUCATION
Bootcamp Certificate in Web Development, Northgate Code Academy, 2024
BA English Literature, University of Eastmoor, 2022

ACHIEVEMENTS
• Winner of the Northgate Code Academy demo day audience vote 2024
• Completed the freeCodeCamp responsive web design certification
• Volunteer mentor at a Saturday coding club for teenagers
• Spoke at a local meetup about learning accessibility as a beginner
`;

const MID_DATA_ANALYST = `Dario Okafor
dario.okafor@example.com | 555-0173 | Manchester

SUMMARY
Product and marketing data analyst with five years in e-commerce, turning messy event data into experiments, dashboards and decisions that the commercial team actually uses.

EXPERIENCE
Senior Data Analyst, Fernhill Market | Feb 2023 – Present
• Designed and analysed 14 A/B tests on checkout and search, lifting conversion by 6.5% across the programme
• Built a weekly KPI dashboard in Looker covering revenue, repeat rate and delivery SLA for 40 stakeholders
• Wrote SQL models in dbt that replaced 30 fragile spreadsheet reports with tested, documented tables
• Mentored two junior analysts on experiment design, power calculations and writing clear findings
• Presented churn analysis to the executive team that led to a loyalty discount pilot saving £210k a year

Marketing Analyst, Quillon Retail | Aug 2020 – Jan 2023
• Attributed paid media spend across five channels using SQL and Python, reallocating 15% of budget to better performing campaigns
• Forecast monthly demand with Prophet, keeping forecast error under 9% during the seasonal peak
• Cleaned and merged CRM and web analytics data covering 1.2 million customers
• Automated the Monday reporting pack with Python scripts, saving about six hours every week
• Ran customer segmentation using k-means clustering which informed the email campaign calendar

Junior Analyst, Pennywhistle Foods | Jul 2019 – Jul 2020
• Maintained Excel models for weekly sales and wrote SQL queries against the order database
• Reconciled supplier invoices against deliveries and flagged 3% of lines as mismatches
• Built the first Tableau dashboard for the category team to track stock levels
• Documented data definitions in a shared glossary to end arguments about what counts as an active customer

SKILLS
SQL, Python, pandas, dbt, Looker, Tableau, Excel, A/B testing, Statistics, Git, BigQuery, Airflow

EDUCATION
MSc Applied Statistics, University of Stonebridge, 2019
BSc Economics, University of Eastmoor, 2018

ACHIEVEMENTS
• Analytics team award for the experimentation framework at Fernhill Market 2024
• Google Data Analytics certificate completed 2020
• Internal talk on common A/B testing mistakes, rated the best session of the quarter
• Wrote the company guide to writing SQL that other people can read
• Contributed a bug fix to the open source dbt-utils package
`;

const SENIOR_OPS_MANAGER = `Helena Brandt
helena.brandt@example.com | 555-0188 | Birmingham

SUMMARY
Senior supply chain and operations manager with twelve years running warehouses, transport networks and supplier relationships, known for steady cost reduction and strong team retention.

EXPERIENCE
Head of Operations, Larkspur Distribution | Jan 2021 – Present
• Lead 85 staff across two distribution centres and a fleet of 30 vehicles with five direct reports
• Cut warehouse operating cost by 12% through slotting redesign and a shift to wave picking
• Renegotiated carrier contracts covering 4,000 deliveries a month, saving £640k annually
• Raised on-time in-full delivery from 91% to 97% by introducing daily SLA reviews with each carrier
• Rolled out a new warehouse management system on time and 8% under a £1.2m budget
• Reduced voluntary staff turnover from 28% to 14% by creating a supervisor training programme

Operations Manager, Tolland Logistics | Mar 2017 – Dec 2020
• Managed a team of 40 across inbound, storage and outbound operations at a 90,000 square foot site
• Introduced lean 5S practices that cut picking errors by 35% within six months
• Owned the annual peak season plan, hiring 60 temporary workers and delivering all orders with zero missed cutoffs
• Led the supplier scorecard process for 25 vendors, retiring the six worst performers
• Negotiated a three-year lease extension that held rent flat despite rising local rates

Supply Chain Planner, Redmoor Manufacturing | Jun 2013 – Feb 2017
• Planned materials for three production lines using MRP and weekly demand reviews
• Cut excess inventory by £480k by setting safety stock levels based on demand variability
• Coordinated with procurement to qualify two new steel suppliers, shortening lead time by nine days
• Prepared the monthly S&OP pack for the leadership team

Graduate Trainee, Redmoor Manufacturing | Sep 2011 – May 2013
• Rotated through quality, procurement and dispatch departments over eighteen months
• Mapped the goods-in process and proposed changes that removed two handling steps

SKILLS
Supply chain planning, Warehouse management, Lean, Six Sigma, S&OP, Budgeting, Carrier negotiation, Team leadership, SAP, Excel

EDUCATION
MBA Operations Management, Stonebridge Business School, 2016
BEng Industrial Engineering, University of Eastmoor, 2011

CERTIFICATIONS
• Six Sigma Black Belt, certified 2019
• CIPS Level 5 Diploma in Procurement and Supply
• First aid at work and manual handling trainer
• Chartered Institute of Logistics member since 2014
`;

export const RESUMES: SyntheticResume[] = [
  { id: "junior-frontend", seniority: "junior", domain: "frontend web development", text: JUNIOR_FRONTEND },
  { id: "mid-data-analyst", seniority: "mid", domain: "e-commerce product and marketing analytics", text: MID_DATA_ANALYST },
  { id: "senior-ops-manager", seniority: "senior", domain: "supply chain and operations management", text: SENIOR_OPS_MANAGER },
];
