import type { MetadataRoute } from "next";
import { climbingGyms } from "@/data/climbing-gyms";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();
  const top: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/climbing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/climbing-curate`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
  const gymPages: MetadataRoute.Sitemap = climbingGyms.map((g) => ({
    url: `${base}/climbing/${g.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  return [...top, ...gymPages];
}
