import type { MetadataRoute } from "next";
import { PUBLIC_PRESETS } from "@/lib/presets";

const SITE = "https://iloveemployement.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/apply", "/vault"].map((path) => ({ url: `${SITE}${path}`, changeFrequency: "weekly" as const, priority: path ? 0.8 : 1 }));
  const tools = PUBLIC_PRESETS.map((p) => ({ url: `${SITE}/tools/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.7 }));
  return [...pages, ...tools];
}
