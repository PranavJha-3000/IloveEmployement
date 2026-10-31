import type { NextConfig } from "next";

/** Retired tool routes → the engine preset that replaced them (keeps links and search traffic). */
const RETIRED_ROUTES: Record<string, string> = {
  "/recruiter-message": "/tools/cold-recruiter-message",
  "/resume-analyzer": "/tools/job-fit-checker",
  "/job-fit-checker": "/tools/job-fit-checker",
  "/delulu-detector": "/tools/job-fit-checker",
  "/resume-rewriter": "/tools/resume-tailor",
  "/resume-fixer": "/tools/resume-tailor",
  "/bullet-point-fixer": "/tools/resume-bullet-point-fixer",
  "/ats-checker": "/tools/ats-resume-checker",
  "/jd-translator": "/tools/job-description-decoder",
  "/jd-red-flag-scanner": "/tools/job-description-decoder",
  "/skill-gap-analyzer": "/tools/skill-gap-analyzer",
  "/linkedin-optimizer": "/tools/linkedin-profile-optimizer",
  "/cover-letter-generator": "/tools/cover-letter-generator",
  "/github-resume-checker": "/tools/resume-proof-check",
  "/resume-truth-detector": "/tools/resume-proof-check",
};

const nextConfig: NextConfig = {
  async redirects() {
    return Object.entries(RETIRED_ROUTES).map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default nextConfig;
