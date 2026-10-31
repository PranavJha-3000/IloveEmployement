import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Retired tool routes keep their search traffic by pointing at the preset that replaced them.
  async redirects() {
    return [{ source: "/recruiter-message", destination: "/tools/cold-recruiter-message", permanent: true }];
  },
};

export default nextConfig;
